import { message } from 'antd';
import { atom } from 'jotai';
import { abortableAtom, loadable, useAtomValue } from 'jotai/utils';
import { useEffect, useState } from 'react';
import { TOAST_DURATION } from '../constants';
import { getT, runTask } from '../shared';
import { ColumnType, File, ImportedTable, TableSchema, Task } from '../types';
import { actions, Loadable, LOADING_STATE, useCachedLoadable } from './common';

// State

const $tableListInvalidator = atom(0);

const $tableList = abortableAtom((get, { signal }) => {
  get($tableListInvalidator);
  return window.loadTables(signal);
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
  importCSV(file: File, tableName: string, schema: TableSchema, aidColumns: string[]): Task<boolean>;
}

export const useTableActions = actions<TableActions>((_get, set) => {
  function invalidateTableList() {
    set($tableListInvalidator, (x) => x + 1);
  }

  return {
    invalidateTableList,

    removeTable(tableName) {
      return runTask(async (signal) => {
        const t = getT('messages::tables');

        message.loading({
          content: t('Removing table {{tableName}}', { tableName }),
          key: tableName,
          duration: 0,
        });

        try {
          await window.removeTable(tableName, signal);
          message.success({
            content: t('Table {{tableName}} removed', { tableName }),
            key: tableName,
            duration: TOAST_DURATION,
          });
          invalidateTableList();
          return true;
        } catch (e) {
          console.error(e);
          message.error({ content: t('Table removal failed'), key: tableName, duration: TOAST_DURATION });
          return false;
        }
      });
    },

    importCSV(file, tableName, schema, aidColumns) {
      return runTask(async (signal) => {
        const t = getT('messages::importer');

        const fileName = file.name;
        message.loading({
          content: t('Importing {{fileName}}', { fileName }),
          key: file.path,
          duration: 0,
        });

        try {
          const { aborted } = await window.importCSV(file.path, tableName, schema.columns, aidColumns, signal);
          if (aborted) {
            message.info({
              content: t('Import aborted'),
              key: file.path,
              duration: TOAST_DURATION,
            });
          } else {
            message.success({
              content: t('{{fileName}} imported successfully', { fileName }),
              key: file.path,
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
            key: file.path,
            duration: TOAST_DURATION,
          });
          return false;
        }
      });
    },
  };
});

// useSchema

const BOOLEAN_RE = /^(?:true|false|0|1)$/i;
const INTEGER_RE = /^-?\d{1,20}$/;
const REAL_RE = /^-?\d{1,20}(?:\.\d{1,20})?$/;
// Source: https://stackoverflow.com/a/3143231, extended with a subset of PostgreSQL-admissible formats.
// This is widely advised against, but there doesn't seem to be any viable approximation of the PostgreSQL
// format in the packages I've explored.
const TIMESTAMP_RE =
  /(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)?)|(\d{4}-[01]\d-[0-3]\d(T| )?([+-][0-2]\d:[0-5]\d|Z)?)/;

function detectColumnTypes(columnsCount: number, rows: string[][]): ColumnType[] {
  const typesInfo = Array(columnsCount)
    .fill(null)
    .map(() => ({ isEmpty: true, isBoolean: true, isInteger: true, isReal: true, isTimestamp: true }));

  for (const row of rows) {
    for (let index = 0; index < row.length; index++) {
      const value = row[index];
      if (value) {
        // Not null and not empty.
        const typeInfo = typesInfo[index];
        typeInfo.isEmpty = false;
        typeInfo.isBoolean &&= BOOLEAN_RE.test(value);
        typeInfo.isInteger &&= INTEGER_RE.test(value);
        typeInfo.isReal &&= REAL_RE.test(value);
        typeInfo.isTimestamp &&= TIMESTAMP_RE.test(value);
      }
    }
  }

  return typesInfo.map((info) => {
    if (info.isEmpty) return 'text';
    if (info.isBoolean) return 'boolean';
    if (info.isInteger) return 'integer';
    if (info.isReal) return 'real';
    return 'text';
  });
}

function loadSchema(file: File): Task<TableSchema> {
  return runTask(async (signal) => {
    const result = await window.readCSV(file.path, signal);

    const types = detectColumnTypes(result.headers.length, result.rows);
    const columns = types.map((type, index) => {
      return { name: result.headers[index], type };
    });

    return { file, columns, rowsPreview: result.rows };
  });
}

export function useSchema(file: File): Loadable<TableSchema> {
  const [schema, setSchema] = useState<Loadable<TableSchema>>(LOADING_STATE);

  useEffect(() => {
    setSchema(LOADING_STATE);

    let canceled = false;
    const task = loadSchema(file);

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
  }, [file]);

  return schema;
}
