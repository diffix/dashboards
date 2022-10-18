/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const https = require('https');
const childProcess = require('child_process');

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

  var file = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => get(url, file, resolve, reject));
}

const pgroot = 'pgsql';
const archivePath = 'postgresql.zip';
const vcvarsPath = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat';

(async () => {
  if (fs.existsSync(pgroot)) {
    console.log('Cleaning previous build...');
    fs.rmSync(pgroot, { recursive: true });
  }

  console.log('Downloading PostgreSQL...');
  await download('https://sbp.enterprisedb.com/getfile.jsp?fileid=1258169', archivePath);

  console.log('Unpacking PostgreSQL...');
  childProcess.execFileSync('tar.exe', ['-xf', archivePath]);

  console.log('Cleaning PostgreSQL...');
  fs.rmSync(archivePath);
  fs.rmSync(pgroot + '/pgAdmin 4', { recursive: true });
  fs.rmSync(pgroot + '/symbols', { recursive: true });

  console.log('Building pg_diffix...');
  if (!fs.existsSync(vcvarsPath)) {
    console.error("Couldn't find VS 2022 build tools!");
    process.exitCode = 1;
    return;
  }

  try {
    childProcess.execSync(`"${vcvarsPath}" && msbuild -p:Configuration=Release`, {
      cwd: 'pg_diffix',
      env: { PGROOT: '..\\' + pgroot },
    });
    childProcess.execSync('install.bat Release', { cwd: 'pg_diffix', env: { PGROOT: '..\\' + pgroot } });
  } catch (error) {
    console.log(error.stdout.toString());
    console.error(error.stderr.toString());
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log('Build finished!');
})();
