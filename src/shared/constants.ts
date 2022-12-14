export const i18nConfig = {
  debug: process.env.NODE_ENV === 'development',
  saveMissing: process.env.NODE_ENV === 'development',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  keySeparator: '::',
  ns: 'translation',
  nsSeparator: ':::',
  supportedLngs: ['en', 'de'],
} as const;

export const ROW_INDEX_COLUMN = 'DiffixRowIndex';

export const METABASE_SESSION_NAME = 'metabase';

export const METABASE_PORT = 20433;

export const PREVIEW_ROWS_COUNT = 1000;

export const TOAST_DURATION = 5; // in seconds

// Source: `SELECT word FROM pg_get_keywords() WHERE catdesc = 'reserved';`.
export const postgresReservedKeywords = [
  'all',
  'analyse',
  'analyze',
  'and',
  'any',
  'array',
  'as',
  'asc',
  'asymmetric',
  'both',
  'case',
  'cast',
  'check',
  'collate',
  'column',
  'constraint',
  'create',
  'current_catalog',
  'current_date',
  'current_role',
  'current_time',
  'current_timestamp',
  'current_user',
  'default',
  'deferrable',
  'desc',
  'distinct',
  'do',
  'else',
  'end',
  'except',
  'false',
  'fetch',
  'for',
  'foreign',
  'from',
  'grant',
  'group',
  'having',
  'in',
  'initially',
  'intersect',
  'into',
  'lateral',
  'leading',
  'limit',
  'localtime',
  'localtimestamp',
  'not',
  'null',
  'offset',
  'on',
  'only',
  'or',
  'order',
  'placing',
  'primary',
  'references',
  'returning',
  'select',
  'session_user',
  'some',
  'symmetric',
  'table',
  'then',
  'to',
  'trailing',
  'true',
  'union',
  'unique',
  'user',
  'using',
  'variadic',
  'when',
  'where',
  'window',
  'with',
];

// Storage keys

export const SHOW_METABASE_HINT_KEY = 'hints.tableList.showMetabase';
