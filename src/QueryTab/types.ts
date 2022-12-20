import { BooleanColumn, ColumnType, IntegerColumn, RealColumn, TextColumn, TimestampColumn } from '../types';

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
  | TimestampColumn
  | BooleanColumn;

export type TableReference = string;
export type ColumnReference = string;

export type Aggregate =
  | { key: number; type: 'count-rows' }
  | { key: number; type: 'count-entities' }
  | { key: number; type: 'count-column'; column: ColumnReference }
  | { key: number; type: 'count-distinct-column'; column: ColumnReference }
  | { key: number; type: 'sum'; column: ColumnReference }
  | { key: number; type: 'avg'; column: ColumnReference };

export type AggregateType = Aggregate['type'];

export type Filter = {
  column: ColumnReference;
  type: ColumnType;
  value: string | number | boolean | Date;
};

export type Query = {
  table: TableReference | null;
  columns: BucketColumn[];
  aggregates: Aggregate[];
  filters: Filter[];
};
