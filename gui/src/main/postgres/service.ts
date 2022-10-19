import { execFile, execFileSync, PromiseWithChild } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { ServiceStatus } from '../../types';
import { appResourcesLocation, isWin, postgresConfig } from '../config';
import { getUsername, waitForServiceStatus } from '../service-utils';

const asyncExecFile = util.promisify(execFile);

const pgConfigPath = isWin ? path.join(appResourcesLocation, 'pgsql', 'bin', 'pg_config') : 'pg_config';
const postgresBinPath = execFileSync(pgConfigPath, ['--bindir'], { timeout: 5000 }).toString().trim();
const postgresPath = path.join(postgresBinPath, 'postgres');
const psqlPath = path.join(postgresBinPath, 'psql');
const initdbPath = path.join(postgresBinPath, 'initdb');
const socketPath = path.join(postgresConfig.dataDirectory, 'socket');

const initPgDiffixScriptName = 'init.sql';
const initPgDiffixScriptPath = path.join(appResourcesLocation, 'scripts', initPgDiffixScriptName);

let postgresqlStatus = ServiceStatus.Starting;

async function initdbPostgres() {
  console.info('Initializing PostgreSQL local database...');
  const { dataDirectory } = postgresConfig;
  fs.mkdirSync(dataDirectory, { recursive: true });
  await asyncExecFile(initdbPath, ['-U', getUsername(), '-D', dataDirectory, '-E', 'UTF8']);
  isWin || fs.mkdirSync(socketPath, { recursive: true });
}

export async function setupPostgres(): Promise<void> {
  if (!fs.existsSync(postgresConfig.dataDirectory)) {
    console.info('Setting up local PostgreSQL data directory...');
    await initdbPostgres();
  } else {
    console.info('PostgreSQL data directory found');
  }
}

export async function setupPgDiffix(): Promise<void> {
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

  if (detectPgDiffix.stdout.trim() == '1') {
    console.info('pg_diffix found');
  } else if (detectPgDiffix.stdout.trim() == '') {
    console.info('Setting up pg_diffix...');
    await asyncExecFile(
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
  } else {
    throw new Error(`Unexpected result when detecting pg_diffix: ${detectPgDiffix.stdout.trim()}`);
  }
}

export function startPostgres(): PromiseWithChild<{ stdout: string; stderr: string }> {
  console.info('Starting PostgreSQL...');
  const socketArgs = isWin ? [] : ['-k', socketPath];

  return asyncExecFile(
    postgresPath,
    ['-p', postgresConfig.port.toString(), '-D', postgresConfig.dataDirectory].concat(socketArgs),
  );
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
