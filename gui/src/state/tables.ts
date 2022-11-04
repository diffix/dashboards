import { message } from 'antd';
import { atom } from 'jotai';
import { abortableAtom, loadable, useAtomValue } from 'jotai/utils';
import { TOAST_DURATION } from '../constants';
import { getT, runTask } from '../shared';
import { ImportedTable, Task } from '../types';
import { actions, Loadable } from './common';

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

// Actions

export interface TableActions {
  invalidateTableList(): void;
  removeTable(tableName: string): Task<boolean>;
}

export const useTableActions = actions<TableActions>((_get, set) => {
  function invalidateTableList() {
    set($tableListInvalidator, (x) => x + 1);
  }

  return {
    invalidateTableList,

    removeTable(tableName: string) {
      return runTask(async (signal) => {
        const t = getT('messages::tables');

        message.loading({
          content: t('Removing table {{tableName}}...', { tableName }),
          key: tableName,
          duration: 0,
        });

        try {
          await window.removeTable(tableName, signal);
          message.success({
            content: t('Table {{tableName}} removed.', { tableName }),
            key: tableName,
            duration: TOAST_DURATION,
          });
          invalidateTableList();
          return true;
        } catch (e) {
          console.error(e);
          message.error({ content: t('Table removal failed.'), key: tableName, duration: TOAST_DURATION });
          return false;
        }
      });
    },
  };
});
