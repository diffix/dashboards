/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const https = require('https');
const childProcess = require('child_process');
const path = require('path');
const url = require('url');

async function download(url, dest) {
  function get(url, file, resolve, reject) {
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return get(response.headers.location, file, resolve, reject);
        }
        response.on('data', (fragments) => file.write(fragments));
        response.on('end', () => file.close(() => resolve()));
      })
      .on('error', (error) => fs.rm(dest, () => reject(error)));
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  var file = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => get(url, file, resolve, reject));
}

const pgroot = 'pgsql';
const openJdkDir = 'openjdk';
const openJdkArchivePath = 'openjdk.zip';
const jpackagePath = path.join(openJdkDir, 'bin', 'jpackage');
const metabaseDir = 'metabase';
const metabaseJarDir = 'metabase_jar';
const postgresqlArchivePath = 'postgresql.zip';
const metabaseJarPath = path.join(metabaseJarDir, 'metabase.jar');
const vswherePath = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
const vcvarsPath = '\\VC\\Auxiliary\\Build\\vcvars64.bat';

const openJdkVersion = 'jdk-17.0.4.1+1';
const postgresqlUrl = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1258169';
// `openJdkVersion` and filename must be matched manually here.
const openJdkUrl = new url.URL(
  path.posix.join(
    'adoptium/temurin17-binaries/releases/download',
    openJdkVersion,
    'OpenJDK17U-jdk_x64_windows_hotspot_17.0.4.1_1.zip',
  ),
  'https://github.com',
).href;
const metabaseUrl = 'https://downloads.metabase.com/v0.44.4/metabase.jar';

(async () => {
  if (fs.existsSync(pgroot)) {
    console.log('Cleaning previous build (PostgreSQL)...');
    fs.rmSync(pgroot, { recursive: true });
  }
  if (fs.existsSync(openJdkDir)) {
    console.log('Cleaning previous build (OpenJDK)...');
    fs.rmSync(openJdkDir, { recursive: true });
  }
  if (fs.existsSync(metabaseDir)) {
    console.log('Cleaning previous build (Metabase)...');
    fs.rmSync(metabaseDir, { recursive: true });
  }

  console.log('Downloading PostgreSQL...');
  await download(postgresqlUrl, postgresqlArchivePath);

  console.log('Downloading OpenJDK...');
  await download(openJdkUrl, openJdkArchivePath);

  console.log('Downloading Metabase...');
  await download(metabaseUrl, metabaseJarPath);

  console.log('Unpacking PostgreSQL...');
  childProcess.execFileSync('tar.exe', ['-xf', postgresqlArchivePath]);

  console.log('Unpacking OpenJDK...');
  childProcess.execFileSync('tar.exe', ['-xf', openJdkArchivePath]);
  fs.renameSync(openJdkVersion, openJdkDir);

  console.log('Cleaning PostgreSQL...');
  fs.rmSync(postgresqlArchivePath);
  fs.rmSync(path.join(pgroot, 'pgAdmin 4'), { recursive: true });
  fs.rmSync(path.join(pgroot, 'symbols'), { recursive: true });

  console.log('Cleaning OpenJDK zip...');
  fs.rmSync(openJdkArchivePath);

  console.log('Building pg_diffix...');
  if (!fs.existsSync(vswherePath)) {
    console.error('Could not find any instance of Visual Studio!');
    process.exitCode = 1;
    return;
  }

  try {
    const vsPath = childProcess
      .execFileSync(vswherePath, ['-latest', '-property', 'installationPath'])
      .toString()
      .trim();
    console.log('Using VS build tools from: ' + vsPath);

    childProcess.execSync(
      `"${path.join(vsPath, vcvarsPath)}" && SET "PGROOT=..\\${pgroot}" && msbuild -p:Configuration=Release`,
      { cwd: 'pg_diffix' },
    );

    console.log('Installing pg_diffix...');
    childProcess.execSync(`SET "PGROOT=..\\${pgroot}" && install.bat Release`, { cwd: 'pg_diffix' });

    console.log('Bundling Metabase...');
    childProcess.execSync(`${jpackagePath} --type app-image -i ${metabaseJarDir} -n metabase --main-jar metabase.jar`);
  } catch (error) {
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log('Cleaning Metabase temporary jar...');
  fs.rmSync(metabaseJarDir, { recursive: true });

  console.log('Cleaning OpenJDK...');
  fs.rmSync(openJdkDir, { recursive: true });

  console.log('Build finished!');
})();
