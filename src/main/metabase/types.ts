/*
 * API response types extracted from sample responses and metabase source.
 * Fields that we don't care about are commented out or marked as unknown.
 */

type ISO8601Time = string;

export type Table = {
  description: string;
  entity_type: string;
  schema: string;
  // db: unknown;
  show_in_getting_started: boolean;
  name: string;
  fields: Field[];
  // caveats: unknown;
  // segments: unknown[];
  dimension_options: Record<number, unknown>;
  updated_at: ISO8601Time;
  active: boolean;
  id: number;
  db_id: number;
  // visibility_type: unknown;
  // field_order: unknown;
  initial_sync_status: string;
  display_name: string;
  // metrics: unknown[];
  created_at: ISO8601Time;
  // points_of_interest: unknown;
};

export type TextFieldFingerprint = {
  'percent-json': number;
  'percent-url': number;
  'percent-email': number;
  'percent-state': number;
  'average-length': number;
};

export type NumberFieldFingerprint = {
  avg: number;
  max: number;
  min: number;
  q1: number;
  q3: number;
  sd: number;
};

export type DateTimeFieldFingerprint = {
  earliest: ISO8601Time;
  latest: ISO8601Time;
};

export interface FieldFingerprint {
  global: {
    'distinct-count'?: number;
    'nil%': number;
  };
  type?: {
    'type/Text'?: TextFieldFingerprint;
    'type/Number'?: NumberFieldFingerprint;
    'type/DateTime'?: DateTimeFieldFingerprint;
  };
}

export type Field = {
  description: string | null;
  database_type: string; // See https://github.com/metabase/metabase/blob/master/src/metabase/driver/postgres.clj#L504-L566
  semantic_type: string | null; // See https://github.com/metabase/metabase/blob/master/shared/src/metabase/types.cljc
  // coercion_strategy: unknown;
  name: string;
  fingerprint_version: number;
  // has_field_values: string;
  // settings: unknown;
  // caveats: unknown;
  // fk_target_field_id: unknown;
  // dimensions: unknown[];
  dimension_options: string[];
  updated_at: ISO8601Time;
  // custom_position: number;
  effective_type: string;
  active: boolean;
  // nfc_path: unknown;
  // parent_id: unknown;
  id: number;
  last_analyzed: ISO8601Time;
  position: number;
  visibility_type: 'details-only' | 'hidden' | 'normal' | 'retired';
  // default_dimension_option: unknown;
  // target: unknown;
  preview_display: boolean;
  display_name: string;
  database_position: number;
  fingerprint: FieldFingerprint;
  created_at: ISO8601Time;
  base_type: string;
  // points_of_interest: unknown;
};
