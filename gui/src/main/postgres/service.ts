import { ChildProcessWithoutNullStreams, execFile, ExecFileException, execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { ServiceStatus } from '../../types';
import { appDataLocation, appResourcesLocation, isWin, postgresConfig } from '../config';
import { delay, forwardLogLines, getUsername, waitForServiceStatus } from '../service-utils';
import log from 'electron-log';

const asyncExecFile = util.promisify(execFile);

const pgConfigPath = isWin ? path.join(appResourcesLocation, 'pgsql', 'bin', 'pg_config') : 'pg_config';
const postgresBinPath = execFileSync(pgConfigPath, ['--bindir'], { timeout: 5000 }).toString().trim();
const postgresPath = path.join(postgresBinPath, 'postgres');
const psqlPath = path.join(postgresBinPath, 'psql');
const initdbPath = path.join(postgresBinPath, 'initdb');
const pgIsReadyPath = path.join(postgresBinPath, 'pg_isready');
const socketPath = path.join(postgresConfig.dataDirectory, 'socket');

const initPgDiffixScriptName = 'init.sql';
const initPgDiffixScriptPath = path.join(appResourcesLocation, 'scripts', initPgDiffixScriptName);

let postgresqlStatus = ServiceStatus.Starting;

const setupLog = log.create(postgresConfig.logId);
setupLog.transports.file.fileName = postgresConfig.logFileName;

async function initdb() {
  setupLog.info('Initializing PostgreSQL local database...');
  const { dataDirectory } = postgresConfig;
  const initDb = await asyncExecFile(initdbPath, ['-U', getUsername(), '-D', dataDirectory, '-E', 'UTF8']);

  forwardLogLines(setupLog.info, 'initdb:', initDb.stderr);
  forwardLogLines(setupLog.info, 'initdb:', initDb.stdout);
  isWin || fs.mkdirSync(socketPath, { recursive: true });
}

async function waitUntilReachable(): Promise<void> {
  const socketArgs = isWin ? [] : ['-h', `${socketPath}`];
  for (let i = 0; i < postgresConfig.connectAttempts; i++) {
    try {
      await asyncExecFile(
        pgIsReadyPath,
        ['-U', `${getUsername()}`, '-d', 'postgres', '-p', postgresConfig.port.toString()].concat(socketArgs),
      );
      return;
    } catch (err) {
      if ((err as ExecFileException).code == 3) {
        console.error('pg_isready failed to check if PostgreSQL is ready');
        throw err;
      }
    }

    await delay(postgresConfig.connectTimeout / postgresConfig.connectAttempts);
  }

  throw new Error('Could not connect to PostgreSQL.');
}

async function psqlDetectPgDiffix() {
  const socketArgs = isWin ? [] : ['-h', `${socketPath}`];
  const detectPgDiffix = await asyncExecFile(
    psqlPath,
    [
      '-U',
      `${getUsername()}`,
      '-d',
      'postgres',
      '-p',
      postgresConfig.port.toString(),
      '-XtAc',
      `SELECT 1 FROM pg_database WHERE datname='${postgresConfig.tablesDatabase}'`,
    ].concat(socketArgs),
  );
  forwardLogLines(setupLog.info, 'psql:', detectPgDiffix.stderr);
  const result = detectPgDiffix.stdout.trim();
  if (result == '1') {
    return true;
  } else if (result == '') {
    return false;
  } else {
    throw new Error(`Unexpected result when detecting pg_diffix: ${result}`);
  }
}

async function psqlRunInitSQL() {
  const socketArgs = isWin ? [] : ['-h', `${socketPath}`];
  const psql = await asyncExecFile(
    psqlPath,
    [
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      `${getUsername()}`,
      '-d',
      'postgres',
      '-p',
      postgresConfig.port.toString(),
      '-f',
      initPgDiffixScriptPath,
    ].concat(socketArgs),
  );
  forwardLogLines(setupLog.info, 'psql:', psql.stderr);
  forwardLogLines(setupLog.info, 'psql:', psql.stdout);
}

export async function setupPostgres(): Promise<void> {
  if (!fs.existsSync(postgresConfig.dataDirectory)) {
    setupLog.info('Setting up local PostgreSQL data directory...');
    try {
      await initdb();
    } catch (err) {
      setupLog.error(err);
      await cleanAppData();
      throw err;
    }
  } else {
    console.info('PostgreSQL data directory found');
  }
}

export async function setupPgDiffix(): Promise<void> {
  console.info('Waiting until PostgreSQL is ready...');
  await waitUntilReachable();

  const hasPgDiffix = await psqlDetectPgDiffix();
  try {
    if (!hasPgDiffix) await psqlRunInitSQL();
  } catch (err) {
    setupLog.error(err);
    await cleanAppData();
    throw err;
  }
}

export function startPostgres(): ChildProcessWithoutNullStreams {
  console.info('Starting PostgreSQL...');
  const socketArgs = isWin ? [] : ['-k', socketPath];

  const postgresql = spawn(
    postgresPath,
    ['-p', postgresConfig.port.toString(), '-D', postgresConfig.dataDirectory].concat(socketArgs),
  );
  postgresql.stdout.setEncoding('utf-8');
  postgresql.stderr.setEncoding('utf-8');
  return postgresql;
}

export async function shutdownPostgres(): Promise<void> {
  console.info('Shutting down PostgreSQL...');
  // On Windows, if we let the OS handle shutdown, it will not be graceful, and next start
  // is in recovery mode.
  // On Linux, `postgresql?.kill()` works fine, but the common `pg_ctl` is just as good.
  asyncExecFile(path.join(postgresBinPath, 'pg_ctl'), ['-w', '-D', postgresConfig.dataDirectory, 'stop']);
  return waitForPostgresqlStatus(ServiceStatus.Stopped);
}

export function getPostgresqlStatus(): ServiceStatus {
  return postgresqlStatus;
}

export function setPostgresqlStatus(status: ServiceStatus): void {
  postgresqlStatus = status;
}

export function waitForPostgresqlStatus(status: ServiceStatus): Promise<void> {
  return waitForServiceStatus(status, 'PostgreSQL', getPostgresqlStatus);
}

export async function cleanAppData(): Promise<void> {
  console.info(`Cleaning the application data folder ${appDataLocation}...`);
  await shutdownPostgres();
  fs.rmSync(appDataLocation, { recursive: true });
}
