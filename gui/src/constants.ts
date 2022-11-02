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
