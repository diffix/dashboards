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
const vswherePath = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
const vcvarsPath = '\\VC\\Auxiliary\\Build\\vcvars64.bat';

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

    childProcess.execSync(`"${vsPath + vcvarsPath}" && msbuild -p:Configuration=Release`, {
      cwd: 'pg_diffix',
      env: { PGROOT: '..\\' + pgroot },
    });

    console.log('Installing pg_diffix...');
    childProcess.execSync('install.bat Release', { cwd: 'pg_diffix', env: { PGROOT: '..\\' + pgroot } });
  } catch (error) {
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.log('Build finished!');
})();
