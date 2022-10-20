import { app } from 'electron';
import os from 'os';
import path from 'path';
import { METABASE_PORT, METABASE_SESSION_NAME } from '../constants';

export const isWin = process.platform === 'win32';
export const isMac = process.platform === 'darwin';

export const appDataLocation = path.join(os.homedir(), '.diffix_dashboards');
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
} as const;

export const metabaseConfig = {
  protocol: 'http:',
  hostname: 'localhost',
  port: METABASE_PORT,
  connectAttempts: 20,
  connectTimeout: 10_000,
  siteName: 'Diffix Dashboards',
  adminEmail: 'admin@open-diffix.org',
  adminPassword: 'diffix',
  directDataSourceName: 'Direct  Data',
  anonymizedDataSourceName: 'Anonymized Data',
  sessionName: METABASE_SESSION_NAME,
  jarPath: isWin
    ? path.join(appResourcesLocation, 'metabase', 'metabase')
    : path.join(appResourcesLocation, 'metabase', 'bin', 'metabase'),
  pluginsDir: path.join(appDataLocation, 'metabase', 'plugins'),
} as const;
