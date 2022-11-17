import * as csv from 'csv-string';
import events from 'events';
import fs from 'fs';
import pg from 'pg';
import pgCopyStreams from 'pg-copy-streams';
import readline from 'readline';
import stream from 'stream';
import util from 'util';
import { PREVIEW_ROWS_COUNT, ROW_INDEX_COLUMN } from '../constants';
import { ColumnType, ImportedTable, NumberFormat, ParseOptions, TableColumn } from '../types';
import { postgresConfig } from './config';
import { sendToRenderer } from './ipc';
import { syncMetabaseSchema } from './metabase';

const finished = util.promisify(stream.finished);

const connectionConfig = {
  database: postgresConfig.tablesDatabase,
  port: postgresConfig.port,
  user: postgresConfig.adminUser,
  password: postgresConfig.adminPassword,
  connectionTimeoutMillis: 1000,
};

async function syncTables(): Promise<void> {
  await syncMetabaseSchema();
  sendToRenderer('metabase_event', 'refresh');
}

// ----------------------------------------------------------------
// Table CRUD
// ----------------------------------------------------------------

export async function loadTables(): Promise<ImportedTable[]> {
  const client = new pg.Client(connectionConfig);
  await client.connect();

  const { adminUser } = postgresConfig;
  try {
    const ret: ImportedTable[] = [];
    const allTables = await client.query(`SELECT tablename FROM pg_catalog.pg_tables WHERE tableowner='${adminUser}';`);
    allTables.rows.forEach((row) => ret.push({ key: row.tablename, name: row.tablename, aidColumns: [] }));

    const aids = await client.query(
      'SELECT tablename, objname FROM pg_catalog.pg_tables, diffix.show_labels() ' +
        "WHERE objname ~ ('public\\.\\\"?' || tablename || '\\\"?\\..*') AND" +
        `      tableowner='${adminUser}' AND ` +
        "      label='aid';",
    );

    aids.rows.forEach((row) =>
      ret.find(({ name }) => name === row.tablename)?.aidColumns.push(row.objname.split('.').at(-1)),
    );

    const tables = ret.map((table) => `'${table.name}'`).join(', ');
    console.info(`Found the following tables: ${tables}.`);

    return ret;
  } finally {
    client.end();
  }
}

export async function removeTable(tableName: string): Promise<void> {
  const client = new pg.Client(connectionConfig);
  await client.connect();

  try {
    await client.query(`DROP TABLE public."${tableName}";`);
    await syncTables();
  } finally {
    client.end();
  }
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

async function copyRowsFromCsvFile(
  client: pg.Client,
  signal: AbortSignal,
  fileName: string,
  fieldProcessors: ((_: string) => string)[],
  tableName: string,
) {
  const pgStream = stream.addAbortSignal(
    signal,
    client.query(pgCopyStreams.from(`COPY "${tableName}" FROM STDIN (DELIMITER ',', FORMAT CSV, HEADER false)`)),
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
  const client = new pg.Client(connectionConfig);
  await client.connect();

  const columnsSQL = columns.map((column) => `"${column.name}" ${column.type}`).join(', ');
  console.info(`Table schema: ${columnsSQL}.`);

  const fieldProcessors = columns.map((column) => getFieldProcessor(column.type, parseOptions));

  try {
    await client.query(`BEGIN`);
    // TODO: should we worry about (accidental) SQL-injection here?
    await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await client.query(`CREATE TABLE "${tableName}" (${columnsSQL})`);
    await copyRowsFromCsvFile(client, signal, fileName, fieldProcessors, tableName);
    if (aidColumns.length > 0) {
      if (aidColumns.includes(ROW_INDEX_COLUMN)) {
        await client.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${ROW_INDEX_COLUMN}" SERIAL`);
      }
      const aidColumnsSQL = aidColumns.map((aidColumn) => `'"${aidColumn}"'`).join(', ');
      await client.query(`CALL diffix.mark_personal('"${tableName}"', ${aidColumnsSQL});`);
    } else {
      await client.query(`CALL diffix.mark_public('"${tableName}"');`);
    }
    await client.query(`GRANT SELECT ON "${tableName}" TO "${postgresConfig.trustedUser}"`);
    await client.query(`COMMIT`);
    await syncTables();
  } catch (err) {
    await client.query(`ROLLBACK`);
    if ((err as Error)?.name === 'AbortError') {
      return { aborted: true };
    } else {
      throw err;
    }
  } finally {
    client.end();
  }
  return { aborted: false };
}
