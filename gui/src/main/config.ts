import { app } from 'electron';
import path from 'path';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';
import { productName } from '../../package.json';

export const isWin = process.platform === 'win32';
export const isMac = process.platform === 'darwin';

export const appDataLocation = isWin
  ? path.join(app.getPath('appData'), 'Local', productName, 'data')
  : path.join(app.getPath('appData'), productName, 'data');
export const appResourcesLocation = path.join(app.getAppPath(), app.isPackaged ? '..' : '.');

// Some of these need to be kept in sync with `init.sql`.
export const postgresConfig = {
  hostname: 'localhost',
  port: 20432,
  adminUser: 'diffix_admin',
  adminPassword: 'diffix_admin',
  trustedUser: 'diffix_trusted',
  trustedPassword: 'diffix_trusted',
  dataDirectory: path.join(appDataLocation, 'postgres'),
  tablesDatabase: 'diffix',
  metadataDatabase: 'metabaseappdb',
  logId: 'postgresql_setup_log',
  logFileName: 'postgresql_setup.log',
} as const;

export const metabaseConfig = {
  protocol: 'http:',
  hostname: 'localhost',
  port: METABASE_PORT,
  connectAttempts: 20,
  connectTimeout: 10_000,
  siteName: productName,
  adminEmail: 'admin@open-diffix.org',
  adminPassword: 'diffix',
  directDataSourceName: 'Direct Data',
  anonymizedDataSourceName: 'Anonymized Data',
  sessionName: METABASE_SESSION_NAME,
  executablePath: isWin
    ? path.join(appResourcesLocation, 'metabase', 'metabase')
    : path.join(appResourcesLocation, 'metabase', 'bin', 'metabase'),
  pluginsDir: path.join(appDataLocation, 'metabase', 'plugins'),
  logId: 'metabase_setup_log',
  logFileName: 'metabase_setup.log',
} as const;
