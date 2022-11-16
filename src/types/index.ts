import type { RcFile } from 'antd/lib/upload';
import type { EventEmitter } from 'events';
import type { i18n } from 'i18next';
import type { PageId } from '../DocsTab';

// UI State

export enum ServiceStatus {
  Starting,
  Running,
  Stopped,
}

export enum ServiceName {
  PostgreSQL,
  Metabase,
}

export enum NumberFormat {
  English,
  German,
}

export type ParseOptions = {
  numberFormat: NumberFormat;
};

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
export type TimestampColumn = { name: string; type: 'timestamp' };

export type TableColumn = IntegerColumn | RealColumn | TextColumn | BooleanColumn | TimestampColumn;

export type ColumnType = TableColumn['type'];

// Query request

export type ImportedTable = { key: string; name: string; aidColumns: string[] };

// Query results

export type LoadResponse = {
  headers: string[];
  rows: string[][];
};

export type ResultRow = Value[];

export type Value = boolean | number | string | Date | null;

// API

export type Importer = {
  loadTables(): Task<ImportedTable[]>;
  removeTable(tableName: string): Task<void>;
  loadSchema(file: File): Task<TableSchema>;
  importCSV(
    file: File,
    parseOptions: ParseOptions,
    tableName: string,
    columns: TableColumn[],
    aidColumns: string[],
  ): Task<boolean>;
};

export type Task<T> = {
  cancel(): void;
  result: Promise<T>;
};

export type ImportResult = {
  aborted: boolean;
};

export {};
declare global {
  interface Window {
    METABASE_PRELOAD_WEBPACK_ENTRY: string;
    metabaseEvents: EventEmitter;
    i18n: i18n;
    i18nMissingKeys: Record<string, unknown>;
    onPostgresqlStatusUpdate(status: ServiceStatus): void;
    onMetabaseStatusUpdate(status: ServiceStatus): void;
    getServicesStatus: (name: ServiceName) => ServiceStatus;
    loadTables(signal: AbortSignal): Promise<ImportedTable[]>;
    removeTable(tableName: string, signal: AbortSignal): Promise<void>;
    readCSV(fileName: string, signal: AbortSignal): Promise<LoadResponse>;
    importCSV(
      fileName: string,
      parseOptions: ParseOptions,
      tableName: string,
      columns: TableColumn[],
      aidColumns: string[],
      signal: AbortSignal,
    ): Promise<ImportResult>;
    onOpenDocs: (page: PageId) => void;
    setMainWindowTitle: (title: string) => void;
    checkForUpdates: () => Promise<string | null>;
    showMessage: (message: string) => void;
  }
}
