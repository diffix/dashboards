/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const https = require('https');
const childProcess = require('child_process');
const path = require('path');

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
const metabaseDir = 'metabase';
const postgresqlArchivePath = 'postgresql.zip';
const metabaseJarPath = path.join(metabaseDir, 'metabase.jar');
const vswherePath = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
const vcvarsPath = '\\VC\\Auxiliary\\Build\\vcvars64.bat';

(async () => {
  if (fs.existsSync(pgroot)) {
    console.log('Cleaning previous build (PostgreSQL)...');
    fs.rmSync(pgroot, { recursive: true });
  }
  if (fs.existsSync(metabaseDir)) {
    console.log('Cleaning previous build (Metabase)...');
    fs.rmSync(metabaseDir, { recursive: true });
  }

  console.log('Downloading PostgreSQL...');
  await download('https://sbp.enterprisedb.com/getfile.jsp?fileid=1258169', postgresqlArchivePath);

  console.log('Downloading Metabase...');
  await download('https://downloads.metabase.com/v0.44.4/metabase.jar', metabaseJarPath);

  console.log('Unpacking PostgreSQL...');
  childProcess.execFileSync('tar.exe', ['-xf', postgresqlArchivePath]);

  console.log('Cleaning PostgreSQL...');
  fs.rmSync(postgresqlArchivePath);
  fs.rmSync(path.join(pgroot, 'pgAdmin 4'), { recursive: true });
  fs.rmSync(path.join(pgroot, 'symbols'), { recursive: true });

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

    childProcess.execSync(`"${path.join(vsPath, vcvarsPath)}" && msbuild -p:Configuration=Release`, {
      cwd: 'pg_diffix',
      env: { PGROOT: path.join('..', pgroot) },
    });

    console.log('Installing pg_diffix...');
    childProcess.execSync('install.bat Release', { cwd: 'pg_diffix', env: { PGROOT: path.join('..', pgroot) } });
  } catch (error) {
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log('Build finished!');
})();
