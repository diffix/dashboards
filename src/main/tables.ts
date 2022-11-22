import * as csv from 'csv-string';
import events from 'events';
import fs from 'fs';
import { find } from 'lodash';
import { TransactionSql } from 'postgres';
import readline from 'readline';
import stream from 'stream';
import util from 'util';
import { PREVIEW_ROWS_COUNT, ROW_INDEX_COLUMN } from '../constants';
import { ColumnType, ImportedTable, NumberFormat, ParseOptions, TableColumn } from '../types';
import { postgresConfig } from './config';
import { sendToRenderer } from './ipc';
import { buildSampleCardEncoded, syncMetabaseSchema } from './metabase';
import { sql, SqlFragment } from './postgres';

const finished = util.promisify(stream.finished);

async function syncTables(): Promise<void> {
  await syncMetabaseSchema();
  sendToRenderer('metabase_event', 'refresh');
}

// ----------------------------------------------------------------
// Table CRUD
// ----------------------------------------------------------------

export async function loadTables(): Promise<ImportedTable[]> {
  const { adminUser } = postgresConfig;

  const allTables = await sql`SELECT tablename FROM pg_catalog.pg_tables WHERE tableowner = ${adminUser}`;

  const ret: ImportedTable[] = allTables.map((row) => ({ name: row.tablename, aidColumns: [], initialQuery: '' }));

  const aids = await sql`
    SELECT tablename, objname
    FROM pg_catalog.pg_tables, diffix.show_labels()
    WHERE objname ~ ('public\\.\\\"?' || tablename || '\\\"?\\..*')
      AND tableowner = ${adminUser}
      AND label = 'aid'
  `;

  aids.forEach((row) => find(ret, { name: row.tablename })?.aidColumns.push(row.objname.split('.').at(-1)));

  await Promise.all(
    ret.map(async (table) => {
      table.initialQuery = await buildSampleCardEncoded(table.name, table.aidColumns);
    }),
  );

  const tables = ret.map((table) => `'${table.name}'`).join(', ');
  console.info(`Found the following tables: ${tables}.`);

  return ret;
}

export async function removeTable(tableName: string): Promise<void> {
  await sql`DROP TABLE public.${sql(tableName)}`;
  await syncTables();
}

// ----------------------------------------------------------------
// CSV
// ----------------------------------------------------------------

function parseCsvSeparatorLine(line: string) {
  const regex = /^"?sep=(.)"?$/i;
  const matches = line.match(regex);
  return matches && (matches[1] as ReturnType<typeof csv.detect>);
}

async function* csvFileRows(signal: AbortSignal, fileName: string) {
  const fileStream = stream.addAbortSignal(signal, fs.createReadStream(fileName));
  const lineReader = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let separator = null;

  for await (const line of lineReader) {
    if (line.length === 0) continue;

    if (!separator) {
      // If we got a separator line, extract separator value and skip it.
      separator = parseCsvSeparatorLine(line);
      if (separator) continue;

      // Auto-detect separator from headers line.
      separator = csv.detect(line);
    }

    const row = csv.fetch(line, separator).map((value) => (value === '\\n' || value === '\\N' ? '' : value));
    yield row;
  }

  lineReader.close();
  fileStream.close();
}

function rawSql(str: string): TemplateStringsArray {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strings: any = [str];
  strings.raw = [str];
  return strings;
}

async function copyRowsFromCsvFile(
  sql: TransactionSql,
  signal: AbortSignal,
  fileName: string,
  fieldProcessors: ((_: string) => string)[],
  tableName: string,
) {
  const pgStream = stream.addAbortSignal(
    signal,
    // Hack: We can't use ${sql(tableName)} to escape the table name identifier because of a library bug.
    await sql(rawSql(`COPY "${tableName}" FROM STDIN (FORMAT CSV, DELIMITER ',', HEADER false)`)).writable(),
  );

  let isHeader = true;
  for await (const row of csvFileRows(signal, fileName)) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const line = csv.stringify(row.map((value, index) => fieldProcessors[index](value)));
    if (!pgStream.write(line)) await events.once(pgStream, 'drain'); // Handle backpressure
  }

  pgStream.end();
  await finished(pgStream);
}

function getFieldProcessor(type: ColumnType, parseOptions: ParseOptions) {
  if (parseOptions.numberFormat === NumberFormat.German && type === 'real')
    return (field: string) => field.replace(',', '.');
  return (field: string) => field;
}

export async function readCSV(
  fileName: string,
  signal: AbortSignal,
): Promise<{
  headers: string[];
  rows: string[][];
}> {
  let headers: string[] | null = null;
  const rows: string[][] = [];

  for await (const row of csvFileRows(signal, fileName)) {
    if (rows.length === PREVIEW_ROWS_COUNT) break;
    if (headers === null) headers = row;
    else rows.push(row);
  }

  if (headers === null) throw new Error('CSV parsing error: input file is empty!');

  return { headers, rows };
}

export async function importCSV(
  fileName: string,
  parseOptions: ParseOptions,
  tableName: string,
  columns: TableColumn[],
  aidColumns: string[],
  signal: AbortSignal,
): Promise<{ aborted: boolean }> {
  try {
    await sql.begin(async (sql) => {
      await sql`DROP TABLE IF EXISTS ${sql(tableName)}`;

      const columnsSQL: SqlFragment[] = columns.map((column, i) =>
        i > 0
          ? sql`, ${sql(column.name)} ${sql.unsafe(column.type)}`
          : sql`${sql(column.name)} ${sql.unsafe(column.type)}`,
      );
      await sql`CREATE TABLE ${sql(tableName)} (${columnsSQL})`;

      const fieldProcessors = columns.map((column) => getFieldProcessor(column.type, parseOptions));
      await copyRowsFromCsvFile(sql, signal, fileName, fieldProcessors, tableName);

      if (aidColumns.length > 0) {
        if (aidColumns.includes(ROW_INDEX_COLUMN)) {
          await sql`ALTER TABLE ${sql(tableName)} ADD COLUMN IF NOT EXISTS ${sql(ROW_INDEX_COLUMN)} SERIAL`;
        }

        const aidColumnsSQL: SqlFragment[] = aidColumns.map((aidColumn, i) =>
          i > 0 ? sql`, '${sql(aidColumn)}'` : sql`'${sql(aidColumn)}'`,
        );

        await sql`CALL diffix.mark_personal('${sql(tableName)}', ${aidColumnsSQL})`;
      } else {
        await sql`CALL diffix.mark_public('${sql(tableName)}')`;
      }

      await sql`GRANT SELECT ON ${sql(tableName)} TO ${sql(postgresConfig.trustedUser)}`;
    });
    await syncTables();
    return { aborted: false };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { aborted: true };
    } else {
      throw err;
    }
  }
}
