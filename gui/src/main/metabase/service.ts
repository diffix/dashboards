import { ChildProcess, execFile, PromiseWithChild } from 'child_process';
import fs from 'fs';
import util from 'util';
import { ServiceStatus } from '../../types';
import { isWin, metabaseConfig, postgresConfig } from '../config';
import { waitForServiceStatus } from '../service-utils';

const asyncExecFile = util.promisify(execFile);

let metabaseStatus = ServiceStatus.Starting;

export function startMetabase(): PromiseWithChild<{ stdout: string; stderr: string }> {
  console.info('Starting Metabase...');

  fs.mkdirSync(metabaseConfig.pluginsDir, { recursive: true });

  return asyncExecFile(metabaseConfig.executablePath, [], {
    env: {
      MB_DB_TYPE: 'postgres',
      MB_DB_DBNAME: postgresConfig.metadataDatabase,
      MB_DB_PORT: postgresConfig.port.toString(),
      MB_DB_USER: postgresConfig.adminUser,
      MB_DB_PASS: postgresConfig.adminPassword,
      MB_DB_HOST: postgresConfig.hostname,
      MB_JETTY_HOST: metabaseConfig.hostname,
      MB_JETTY_PORT: metabaseConfig.port.toString(),
      MB_CHECK_FOR_UPDATES: 'false',
      MB_PASSWORD_COMPLEXITY: 'weak',
      MB_PASSWORD_LENGTH: '0',
      MB_PLUGINS_DIR: metabaseConfig.pluginsDir,
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
