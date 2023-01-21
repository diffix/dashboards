import { ChildProcessWithoutNullStreams, execFile, ExecFileException, execFileSync, spawn } from 'child_process';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { ServiceStatus } from '../../types';
import { appDataLocation, appResourcesLocation, isWin, postgresConfig } from '../config';
import { delay, forwardLogLines, getUsername, waitForServiceStatus } from '../service-utils';

const setupLog = log.create(postgresConfig.logId);
setupLog.transports.file.fileName = postgresConfig.logFileName;

const bin = makeExecWrappers();

function makeExecWrappers() {
  const asyncExecFile = util.promisify(execFile);
  const execWrapper = (path: string) => (args: string[]) => asyncExecFile(path, args);
  const spawnWrapper = (path: string) => (args: string[]) => spawn(path, args);

  const pgConfigPath = isWin ? path.join(appResourcesLocation, 'pgsql', 'bin', 'pg_config') : 'pg_config';
  const postgresBinPath = execFileSync(pgConfigPath, ['--bindir'], { timeout: 5000 }).toString().trim();

  const initPgDiffixScriptName = 'init.sql';

  return {
    paths: {
      socket: path.join(postgresConfig.dataDirectory, 'socket'),
      initPgDiffixScript: path.join(appResourcesLocation, 'scripts', initPgDiffixScriptName),
    },
    spawn: {
      pg_ctl: spawnWrapper(path.join(postgresBinPath, 'pg_ctl')),
    },
    exec: {
      initdb: execWrapper(path.join(postgresBinPath, 'initdb')),
      pg_ctl: execWrapper(path.join(postgresBinPath, 'pg_ctl')),
      psql: execWrapper(path.join(postgresBinPath, 'psql')),
      pg_isready: execWrapper(path.join(postgresBinPath, 'pg_isready')),
    },
  };
}
// ----------------------------------------------------------------
// Init & Startup
// ----------------------------------------------------------------

async function initdb() {
  setupLog.info('Initializing PostgreSQL local database...');
  const { dataDirectory } = postgresConfig;
  const initDb = await bin.exec.initdb(['-U', getUsername(), '-D', dataDirectory, '-E', 'UTF8']);

  forwardLogLines(setupLog.info, 'initdb:', initDb.stderr);
  forwardLogLines(setupLog.info, 'initdb:', initDb.stdout);
  isWin || fs.mkdirSync(bin.paths.socket, { recursive: true });
}

async function waitUntilReachable(): Promise<void> {
  const socketArgs = isWin ? [] : ['-h', `${bin.paths.socket}`];
  for (let i = 0; i < postgresConfig.connectAttempts; i++) {
    try {
      await bin.exec.pg_isready(
        ['-U', `${getUsername()}`, '-d', 'postgres', '-p', postgresConfig.port.toString()].concat(socketArgs),
      );
      return;
    } catch (err) {
      if ((err as ExecFileException).code === 3) {
        console.error('pg_isready failed to check if PostgreSQL is ready');
        throw err;
      }
    }

    await delay(postgresConfig.connectTimeout / postgresConfig.connectAttempts);
  }

  throw new Error('Could not connect to PostgreSQL.');
}

async function psqlDetectPgDiffix() {
  const socketArgs = isWin ? [] : ['-h', `${bin.paths.socket}`];
  const detectPgDiffix = await bin.exec.psql(
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
  if (result === '1') {
    return true;
  } else if (result === '') {
    return false;
  } else {
    throw new Error(`Unexpected result when detecting pg_diffix: ${result}`);
  }
}

async function psqlRunInitSQL() {
  const socketArgs = isWin ? [] : ['-h', `${bin.paths.socket}`];
  const psql = await bin.exec.psql(
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
      bin.paths.initPgDiffixScript,
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

  const escape = (str: string) => `"${str}"`;

  const socketArgs = isWin ? [] : ['-k', escape(bin.paths.socket)];
  const postgresArgs = ['-p', postgresConfig.port.toString()].concat(socketArgs).join(' ');

  const postgresql = bin.spawn.pg_ctl(['-D', postgresConfig.dataDirectory, '-o', postgresArgs, 'start']);
  postgresql.stdout.setEncoding('utf-8');
  postgresql.stderr.setEncoding('utf-8');
  return postgresql;
}

// ----------------------------------------------------------------
// Shutdown & Cleanup
// ----------------------------------------------------------------

function gracefulShutdown() {
  // On Windows, if we let the OS handle shutdown, it will not be graceful, and next start
  // is in recovery mode.
  // On Linux, `postgresql?.kill()` works fine, but the common `pg_ctl` is just as good.
  bin.exec.pg_ctl(['-D', postgresConfig.dataDirectory, 'stop', '-m', 'fast']);
}

function forcefulShutdown() {
  bin.exec.pg_ctl(['-D', postgresConfig.dataDirectory, 'stop', '-m', 'immediate']);
}

export async function shutdownPostgres(): Promise<void> {
  console.info('Shutting down PostgreSQL...');
  gracefulShutdown();

  return waitForPostgresqlStatus(ServiceStatus.Stopped).catch(() => {
    console.error('PostgreSQL graceful shutdown failed! Stopping process forcefully...');
    forcefulShutdown();

    return waitForPostgresqlStatus(ServiceStatus.Stopped);
  });
}

export async function cleanAppData(): Promise<void> {
  console.info(`Cleaning the application data folder ${appDataLocation}...`);
  await shutdownPostgres();
  fs.rmSync(appDataLocation, { recursive: true });
}

// ----------------------------------------------------------------
// Status
// ----------------------------------------------------------------

let postgresqlStatus = ServiceStatus.Starting;

export function getPostgresqlStatus(): ServiceStatus {
  return postgresqlStatus;
}

export function setPostgresqlStatus(status: ServiceStatus): void {
  postgresqlStatus = status;
}

export function waitForPostgresqlStatus(status: ServiceStatus): Promise<void> {
  return waitForServiceStatus(status, 'PostgreSQL', getPostgresqlStatus);
}
