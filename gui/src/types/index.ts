import { RcFile } from 'antd/lib/upload';
import { i18n } from 'i18next';
import { PageId } from '../Docs';

// UI State

export type ComputedData<T> =
  | { state: 'in_progress' }
  | { state: 'failed'; error: string }
  | { state: 'completed'; value: T };

// Schema

export type RowDataIndex = number;

export type RowData = {
  [dataIndex: RowDataIndex]: Value;
};

export type File = RcFile;

export type TableSchema = {
  file: File;
  columns: TableColumn[];
  rowsPreview: ResultRow[];
};

export type IntegerColumn = { name: string; type: 'integer' };
export type RealColumn = { name: string; type: 'real' };
export type TextColumn = { name: string; type: 'text' };
export type BooleanColumn = { name: string; type: 'boolean' };

export type TableColumn = IntegerColumn | RealColumn | TextColumn | BooleanColumn;

export type ColumnType = TableColumn['type'];

// Query request

export type NumericGeneralization = {
  binSize: number;
};

export type StringGeneralization = {
  substringStart: number;
  substringLength: number;
};

export type BucketColumn =
  | (IntegerColumn & { generalization: NumericGeneralization | null })
  | (RealColumn & { generalization: NumericGeneralization | null })
  | (TextColumn & { generalization: StringGeneralization | null })
  | BooleanColumn;

export type CountInput = 'Rows' | 'Entities';

// Query results

export type LoadResponse = {
  columns: ResultColumn[];
  rows: ResultRow[];
};

export type Response = LoadResponse;

export type ResultColumn = {
  name: string;
  type: ColumnType;
};

export type ResultRow = Value[];

export type Value = boolean | number | string | null;

// API

export type Importer = {
  loadSchema(file: File): Task<TableSchema>;
};

export type Task<T> = {
  cancel(): void;
  result: Promise<T>;
};

export {};
declare global {
  interface Window {
    i18n: i18n;
    i18nMissingKeys: Record<string, unknown>;
    callService(request: unknown, signal: AbortSignal): Promise<Response>;
    onOpenDocs: (page: PageId) => void;
    setMainWindowTitle: (title: string) => void;
    checkForUpdates: () => Promise<string | null>;
  }
}
