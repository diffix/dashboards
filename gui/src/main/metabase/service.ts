import { ChildProcess, execFile, PromiseWithChild } from 'child_process';
import fs from 'fs';
import util from 'util';
import path from 'path';
import { ServiceStatus } from '../../types';
import { isWin, metabaseConfig, postgresConfig, appResourcesLocation } from '../config';
import { waitForServiceStatus } from '../service-utils';
import { addDataSources, hasUserSetup, logIn, setupMetabase, waitUntilReady } from './api';
import log from 'electron-log';
import { cleanAppData } from '../postgres';

const asyncExecFile = util.promisify(execFile);

let metabaseStatus = ServiceStatus.Starting;

const setupLog = log.create(metabaseConfig.logId);
setupLog.transports.file.fileName = metabaseConfig.logFileName;

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

function gracefulShutdown(process: ChildProcess) {
  if (isWin) {
    // We send a Ctrl-C event to the Metabase process in order to do a graceful shutdown,
    // since signals don't work on Windows.
    execFile(path.join(appResourcesLocation, 'metabase', 'SendCtrlC'), [`${process.pid}`]);
  } else {
    process.kill();
  }
}

function forcefulShutdown(process: ChildProcess) {
  if (isWin) {
    // Metabase creates multiple processes, all of which have to be killed.
    execFile('taskkill', ['/pid', `${process.pid}`, '/f', '/t']);
  } else {
    process.kill('SIGKILL');
  }
}

export async function shutdownMetabase(
  metabase: PromiseWithChild<{ stdout: string; stderr: string }> | null,
): Promise<void> {
  const child = metabase?.child;
  if (!child) return;

  // Metabase always terminates with a non-zero exit code, so ignore any future exceptions.
  metabase?.catch(() => null);

  console.info('Shutting down Metabase...');
  gracefulShutdown(metabase?.child);

  return waitForMetabaseStatus(ServiceStatus.Stopped).catch(() => {
    console.error('Metabase graceful shutdown failed! Stopping process forcefully...');
    forcefulShutdown(metabase?.child);

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
