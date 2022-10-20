import { ServiceStatus } from './types';
import { app } from 'electron';
import { ChildProcess, execFile, PromiseWithChild } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import { waitForServiceStatus } from './servicesUtils';

const asyncExecFile = util.promisify(execFile);

const resourcesLocation = path.join(app.getAppPath(), app.isPackaged ? '..' : '.');

const isWin = process.platform === 'win32';

const metabasePath = isWin
  ? path.join(resourcesLocation, 'metabase', 'metabase')
  : path.join(resourcesLocation, 'metabase', 'bin', 'metabase');

let metabaseStatus = ServiceStatus.Starting;

export function startMetabase(): PromiseWithChild<{ stdout: string; stderr: string }> {
  console.info('Starting Metabase...');

  const metabasePluginsDir = path.join(os.homedir(), '.diffix_dashboards', 'metabase', 'plugins');
  fs.mkdirSync(metabasePluginsDir, { recursive: true });

  return asyncExecFile(metabasePath, [], {
    env: {
      MB_DB_TYPE: 'postgres',
      MB_DB_DBNAME: 'metabaseappdb',
      MB_DB_PORT: '20432',
      MB_DB_USER: 'diffix_admin',
      MB_DB_PASS: 'diffix_admin',
      MB_DB_HOST: 'localhost',
      MB_JETTY_PORT: '23000',
      MB_CHECK_FOR_UPDATES: 'false',
      MB_PASSWORD_COMPLEXITY: 'weak',
      MB_PASSWORD_LENGTH: '0',
      MB_PLUGINS_DIR: metabasePluginsDir,
      MB_SEND_EMAIL_ON_FIRST_LOGIN_FROM_NEW_DEVICE: 'false',
      MB_SEND_NEW_SSO_USER_ADMIN_EMAIL: 'false',
    },
  });
}

export async function shutdownMetabase(metabase?: ChildProcess): Promise<void> {
  if (isWin) {
    // This isn't graceful, but for packaged executables, the process isn't brought down.
    asyncExecFile('taskkill', ['/pid', `${metabase?.pid}`, '/f', '/t']);
  } else {
    console.info('Shutting down Metabase...');
    metabase?.kill();
  }
  return waitForMetabaseStatus(ServiceStatus.Stopped);
}

export function getMetabaseStatus(): ServiceStatus {
  return metabaseStatus;
}

export function setMetabaseStatus(status: ServiceStatus): void {
  metabaseStatus = status;
}

export function waitForMetabaseStatus(status: ServiceStatus): Promise<void> {
  return waitForServiceStatus(status, 'Metabase', getMetabaseStatus);
}
