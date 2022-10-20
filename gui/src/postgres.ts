import { ServiceStatus } from './types';
import { app } from 'electron';
import { ChildProcess, execFile, execFileSync, PromiseWithChild } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import { waitForServiceStatus } from './servicesUtils';

const asyncExecFile = util.promisify(execFile);

const resourcesLocation = path.join(app.getAppPath(), app.isPackaged ? '..' : '.');

const isWin = process.platform === 'win32';

const pgConfigPath = isWin ? path.join(resourcesLocation, 'pgsql', 'bin', 'pg_config') : 'pg_config';
const postgresBinPath = execFileSync(pgConfigPath, ['--bindir'], { timeout: 5000 }).toString().trim();
const postgresPath = path.join(postgresBinPath, 'postgres');
const psqlPath = path.join(postgresBinPath, 'psql');
const initdbPath = path.join(postgresBinPath, 'initdb');
const dataDirPath = path.join(os.homedir(), '.diffix_dashboards', 'postgres');
const socketPath = path.join(dataDirPath, 'socket');

const initPgDiffixScriptName = 'init.sql';
const initPgDiffixScriptPath = path.join(resourcesLocation, 'scripts', initPgDiffixScriptName);

const serverPort = '20432';

export let postgresqlStatus = ServiceStatus.Starting;

async function initdbPostgres() {
  console.info('Initializing PostgreSQL local database...');
  fs.mkdirSync(dataDirPath, { recursive: true });
  await asyncExecFile(initdbPath, ['-U', os.userInfo().username, '-D', dataDirPath, '-E', 'UTF8']);
  isWin || fs.mkdirSync(socketPath, { recursive: true });
}

export async function setupPostgres(): Promise<void> {
  if (!fs.existsSync(dataDirPath)) {
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
      `${os.userInfo().username}`,
      '-d',
      'postgres',
      '-p',
      serverPort,
      '-XtAc',
      "SELECT 1 FROM pg_database WHERE datname='diffix'",
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
        `${os.userInfo().username}`,
        '-d',
        'postgres',
        '-p',
        serverPort,
        '-f',
        initPgDiffixScriptPath,
      ].concat(socketArgs),
    );
  } else {
    throw `Unexpected result when detecting pg_diffix: ${detectPgDiffix.stdout.trim()}`;
  }
}

export function startPostgres(): PromiseWithChild<{ stdout: string; stderr: string }> {
  console.info('Starting PostgreSQL...');
  const socketArgs = isWin ? [] : ['-k', socketPath];

  return asyncExecFile(postgresPath, ['-p', serverPort, '-D', dataDirPath].concat(socketArgs));
}

export async function shutdownPostgres(postgresql?: ChildProcess): Promise<void> {
  console.info('Shutting down PostgreSQL...');
  if (isWin) {
    // If we let the OS handle shutdown, it will not be graceful, and next start is in recovery mode.
    asyncExecFile(path.join(postgresBinPath, 'pg_ctl'), ['-w', '-D', dataDirPath, 'stop']);
  } else {
    postgresql?.kill();
  }
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
