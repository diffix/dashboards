import { message } from 'antd';
import { atom, useSetAtom } from 'jotai';
import { abortableAtom, loadable, useAtomValue } from 'jotai/utils';
import { useEffect, useMemo, useState } from 'react';
import { runTask } from '../shared';
import { getT } from '../shared-react';
import { TOAST_DURATION } from '../shared/constants';
import {
  ColumnType,
  File,
  ImportedTable,
  NumberFormat,
  ParseOptions,
  ServiceStatus,
  TableSchema,
  Task,
} from '../types';
import { getUniqueKey, Loadable, LOADING_STATE, useCachedLoadable } from './common';
import { $metabaseStatus, $postgresqlStatus } from './services';

// State

const $tableListInvalidator = atom(0);

const $tableList = abortableAtom((get, { signal }) => {
  get($tableListInvalidator);
  const postgresqlStatus = get($postgresqlStatus);
  const metabaseStatus = get($metabaseStatus);
  if (postgresqlStatus === ServiceStatus.Running && metabaseStatus === ServiceStatus.Running) {
    return window.loadTables(signal);
  } else {
    return [] as ImportedTable[];
  }
});

const $tableListLoadable = loadable($tableList);

// Utility hooks

export function useTableList(): ImportedTable[] {
  return useAtomValue($tableList);
}

export function useTableListLoadable(): Loadable<ImportedTable[]> {
  return useAtomValue($tableListLoadable);
}

export function useTableListCached(): ImportedTable[] {
  return useCachedLoadable(useAtomValue($tableListLoadable), []);
}

// Actions

export interface TableActions {
  invalidateTableList(): void;
  removeTable(tableName: string): Task<boolean>;
  getTableExamples(table: ImportedTable): Task<number>;
  importCSV(
    file: File,
    parseOptions: ParseOptions,
    tableName: string,
    schema: TableSchema,
    aidColumns: string[],
  ): Task<boolean>;
}

export function useTableActions(): TableActions {
  const setInvalidator = useSetAtom($tableListInvalidator);

  return useMemo(() => {
    function invalidateTableList() {
      setInvalidator((x) => x + 1);
    }

    return {
      invalidateTableList,

      removeTable(tableName) {
        return runTask(async (signal) => {
          const t = getT('messages::tables');
          const key = getUniqueKey();

          message.loading({
            content: t('Removing table {{tableName}}', { tableName }),
            key,
            duration: 0,
          });

          try {
            await window.removeTable(tableName, signal);
            message.success({
              content: t('Table {{tableName}} removed', { tableName }),
              key,
              duration: TOAST_DURATION,
            });
            invalidateTableList();
            return true;
          } catch (e) {
            console.error(e);
            message.error({ content: t('Table removal failed'), key, duration: TOAST_DURATION });
            return false;
          }
        });
      },

      getTableExamples(table: ImportedTable) {
        return runTask(async (signal) => {
          const collectionId = window.getTableExamples(table, signal);
          return collectionId;
        });
      },

      importCSV(file, parseOptions, tableName, schema, aidColumns) {
        return runTask(async (signal) => {
          const t = getT('messages::importer');
          const key = getUniqueKey();

          const fileName = file.name;
          message.loading({
            content: t('Importing {{fileName}}', { fileName }),
            key,
            duration: 0,
          });

          try {
            const { aborted } = await window.importCSV(
              file.path,
              parseOptions,
              tableName,
              schema.columns,
              aidColumns,
              signal,
            );
            if (aborted) {
              message.info({
                content: t('Import aborted'),
                key,
                duration: TOAST_DURATION,
              });
            } else {
              message.success({
                content: t('{{fileName}} imported successfully', { fileName }),
                key,
                duration: TOAST_DURATION,
              });
              invalidateTableList();
            }
            return !aborted;
          } catch (e) {
            console.error(e);
            const reason = String(e).substring(0, 1000);
            message.error({
              content: t('Data import failed: {{reason}}', { reason }),
              key,
              duration: TOAST_DURATION,
            });
            return false;
          }
        });
      },
    };
  }, [setInvalidator]);
}

// useSchema

const BOOLEAN_RE = /^(?:true|false|0|1)$/i;
const INTEGER_RE = /^-?\d{1,20}$/;
const REAL_EN_RE = /^-?\d{1,20}(?:\.\d{1,20})?$/;
const REAL_DE_RE = /^-?\d{1,20}(?:,\d{1,20})?$/;
// Source: https://stackoverflow.com/a/3143231, extended with a subset of PostgreSQL-admissible formats.
// This is widely advised against, but there doesn't seem to be any viable approximation of the PostgreSQL
// format in the packages I've explored.
const TIMESTAMP_RE =
  /(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )?([+-][0-2]\d:[0-5]\d|Z)?)/;

function detectColumnTypes(parseOptions: ParseOptions, columnsCount: number, rows: string[][]): ColumnType[] {
  const typesInfo = Array(columnsCount)
    .fill(null)
    .map(() => ({ isEmpty: true, isBoolean: true, isInteger: true, isReal: true, isTimestamp: true }));

  const realRE = parseOptions.numberFormat === NumberFormat.English ? REAL_EN_RE : REAL_DE_RE;

  for (const row of rows) {
    for (let index = 0; index < row.length; index++) {
      const value = row[index];
      if (value) {
        // Not null and not empty.
        const typeInfo = typesInfo[index];
        typeInfo.isEmpty = false;
        typeInfo.isBoolean &&= BOOLEAN_RE.test(value);
        typeInfo.isInteger &&= INTEGER_RE.test(value);
        typeInfo.isReal &&= realRE.test(value);
        typeInfo.isTimestamp &&= TIMESTAMP_RE.test(value);
      }
    }
  }

  return typesInfo.map((info) => {
    if (info.isEmpty) return 'text';
    if (info.isBoolean) return 'boolean';
    if (info.isInteger) return 'integer';
    if (info.isReal) return 'real';
    if (info.isTimestamp) return 'timestamp';
    return 'text';
  });
}

function loadSchema(file: File, parseOptions: ParseOptions): Task<TableSchema> {
  return runTask(async (signal) => {
    const result = await window.readCSV(file.path, signal);

    const types = detectColumnTypes(parseOptions, result.headers.length, result.rows);
    const columns = types.map((type, index) => {
      return { name: result.headers[index], type };
    });

    return { file, columns, rowsPreview: result.rows };
  });
}

export function useSchema(file: File, parseOptions: ParseOptions): Loadable<TableSchema> {
  const [schema, setSchema] = useState<Loadable<TableSchema>>(LOADING_STATE);

  useEffect(() => {
    setSchema(LOADING_STATE);

    let canceled = false;
    const task = loadSchema(file, parseOptions);

    task.result
      .then((schema) => {
        if (!canceled) {
          setSchema({ state: 'hasData', data: schema });
          const t = getT('messages::importer');
          message.success(t('Loaded {{fileName}}', { fileName: schema.file.name }));
        }
      })
      .catch((error) => {
        if (!canceled) {
          setSchema({ state: 'hasError', error: error.toString() });
        }
      });

    return () => {
      canceled = true;
      task.cancel();
    };
  }, [file, parseOptions]);

  return schema;
}
