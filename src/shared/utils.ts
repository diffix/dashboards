import { postgresReservedKeywords } from './constants';
import { ColumnType, RowData, RowDataIndex, Task, Value } from '../types';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function runTask<T>(func: (signal: AbortSignal) => Promise<T>): Task<T> {
  const controller = new AbortController();

  return {
    cancel() {
      controller.abort();
    },
    result: func(controller.signal),
  };
}

export function formatPercentage(value: number, precision = 2): string {
  const factor = 10 ** precision;
  return `${Math.round(factor * 100 * value) / factor}%`;
}

function isNull(value: Value) {
  return value === '' || value === null;
}

function toBoolean(value: Value) {
  if (typeof value === 'string') value = value.toLowerCase();
  switch (value) {
    case '':
    case null:
      return null;
    case false:
    case 'false':
    case '0':
    case 0:
      return false;
    default:
      return true;
  }
}

export const columnSorter =
  (type: ColumnType, dataIndex: RowDataIndex) =>
  (rowA: RowData, rowB: RowData): number => {
    let a = rowA[dataIndex];
    let b = rowB[dataIndex];

    if (isNull(a) && isNull(b)) return 0;
    if (isNull(a)) return -1;
    if (isNull(b)) return 1;

    switch (type) {
      case 'boolean': {
        a = toBoolean(a);
        b = toBoolean(b);
        return a === b ? 0 : a ? 1 : -1;
      }
      case 'integer':
      case 'real':
        return (a as number) - (b as number);
      case 'text':
        return (a as string).localeCompare(b as string);
      case 'timestamp':
        return new Date(a as string).getTime() - new Date(b as string).getTime();
    }
  };

const tableNameRE = /^[a-z_][a-z0-9$_]*$/;
export function isPostgresIdentifier(name: string): boolean {
  return !postgresReservedKeywords.includes(name) && tableNameRE.test(name);
}

export function postgresQuote(name: string): string {
  return isPostgresIdentifier(name) ? name : `"${name}"`;
}

const BIN_SIZE_EPSILON = 0.0001;

/** Rounds to closest value in binSizes, adjusted to the appropriate power of 10. */
export function roundBinSize(x: number, binSizes: number[]): number {
  if (x <= BIN_SIZE_EPSILON) return BIN_SIZE_EPSILON;
  if (x > binSizes.at(-1)!) return 10 * roundBinSize(x / 10, binSizes);
  if (x < 1) return roundBinSize(10 * x, binSizes) / 10;

  for (let i = 0; i < binSizes.length - 1; i++) {
    if (x <= (binSizes[i] + binSizes[i + 1]) / 2) return binSizes[i];
  }

  return binSizes.at(-1)!;
}
