import { Updater } from 'use-immer';
import { Query, TableReference } from '../types';

export type UpdateQuery = Updater<Query>;

export type CommonProps = {
  query: Query;
  updateQuery: Updater<Query>;
};

export function swap<T>(array: T[], from: number, to: number): void {
  const temp = array[to];
  array[to] = array[from];
  array[from] = temp;
}

export function removeAt<T>(array: T[], index: number): void {
  if (index >= 0) {
    array.splice(index, 1);
  }
}

let nextAggKey = 1;
export function getAggKey(): number {
  return nextAggKey++;
}

export function defaultQuery(table: TableReference | null): Query {
  return {
    table,
    columns: [],
    aggregates: table ? [{ key: getAggKey(), type: 'count-rows' }] : [],
    filters: [],
  };
}
