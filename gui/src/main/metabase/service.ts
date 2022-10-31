import { ChildProcessWithoutNullStreams, execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ServiceStatus } from '../../types';
import { isWin, metabaseConfig, postgresConfig, appResourcesLocation } from '../config';
import { waitForServiceStatus } from '../service-utils';
import { addDataSources, hasUserSetup, logIn, setupMetabase, waitUntilReady } from './api';
import log from 'electron-log';
import { cleanAppData } from '../postgres';

let metabaseStatus = ServiceStatus.Starting;

const setupLog = log.create(metabaseConfig.logId);
setupLog.transports.file.fileName = metabaseConfig.logFileName;

export function startMetabase(): ChildProcessWithoutNullStreams {
  console.info('Starting Metabase...');

  fs.mkdirSync(metabaseConfig.pluginsDir, { recursive: true });

  const metabase = spawn(metabaseConfig.executablePath, [], {
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
  metabase.stderr.setEncoding('utf-8');
  metabase.stdout.setEncoding('utf-8');
  return metabase;
}

function gracefulShutdown(process: ChildProcessWithoutNullStreams) {
  if (isWin) {
    // We send a Ctrl-C event to the Metabase process in order to do a graceful shutdown,
    // since signals don't work on Windows.
    execFile(path.join(appResourcesLocation, 'metabase', 'SendCtrlC'), [`${process.pid}`]);
  } else {
    process.kill();
  }
}

function forcefulShutdown(process: ChildProcessWithoutNullStreams) {
  if (isWin) {
    // Metabase creates multiple processes, all of which have to be killed.
    execFile('taskkill', ['/pid', `${process.pid}`, '/f', '/t']);
  } else {
    process.kill('SIGKILL');
  }
}

export async function shutdownMetabase(metabase: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!metabase) return;

  console.info('Shutting down Metabase...');
  gracefulShutdown(metabase);

  return waitForMetabaseStatus(ServiceStatus.Stopped).catch(() => {
    console.error('Metabase graceful shutdown failed! Stopping process forcefully...');
    forcefulShutdown(metabase);

    return waitForMetabaseStatus(ServiceStatus.Stopped);
  });
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

export async function initializeMetabase(): Promise<void> {
  console.info('Waiting until Metabase is ready...');
  await waitUntilReady();
  if (!(await hasUserSetup())) {
    try {
      setupLog.info('Setting Metabase up...');
      const setupResult = await setupMetabase();
      setupLog.info('Setup Metabase:', setupResult);
      setupLog.info('Adding data sources to Metabase...');
      const addDataSourcesResult = await addDataSources();
      setupLog.info('Add data sources to Metabase:', addDataSourcesResult);
    } catch (e) {
      setupLog.error(e);
      cleanAppData();
      throw e;
    }
  } else {
    await logIn();
  }
}
