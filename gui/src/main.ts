import { execFile } from 'child_process';
import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, protocol, shell } from 'electron';
import fetch from 'electron-fetch';
import fs from 'fs';
import i18n from 'i18next';
import i18nFsBackend from 'i18next-fs-backend';
import path from 'path';
import semver from 'semver';
import stream from 'stream';
import util from 'util';
import { PageId } from './Docs';
import { i18nConfig, rowIndexColumn } from './shared/config';
import { parse } from 'csv-parse';
import { ServiceName, ServiceStatus, TableColumn } from './types';
import { Client } from 'pg';
import { from } from 'pg-copy-streams';

const connectionConfig = {
  port: 10432,
  database: 'prop_test',
  user: 'prop_test',
  password: 'prop_test',
  connectionTimeoutMillis: 1000,
};

const asyncExecFile = util.promisify(execFile);

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const isMac = process.platform === 'darwin';
const resourcesLocation = path.join(app.getAppPath(), app.isPackaged ? '..' : '.');

// Localization

i18n.use(i18nFsBackend).init({
  ...i18nConfig,
  backend: {
    loadPath: path.join(resourcesLocation, 'assets', 'locales', '{{lng}}/{{ns}}.json'),
    addPath: path.join(resourcesLocation, 'assets', 'locales', '{{lng}}/{{ns}}.missing.json'),
    ident: 2,
  },
  debug: i18nConfig.debug && !app.isPackaged,
  initImmediate: false,
});

// App menu

function openDocs(page: PageId) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  mainWindow?.webContents.send('open_docs', page);
}

function openURL(url: string) {
  shell.openExternal(url);
}

function setupMenu() {
  const t = i18n.getFixedT(null, null, 'App::Menu');

  const macAppMenu: MenuItemConstructorOptions = {
    label: t(`AppMenu::${app.name}`),
    submenu: [
      { role: 'about', label: t(`AppMenu::About ${app.name}`) },
      { type: 'separator' },
      { role: 'services', label: t('AppMenu::Services') },
      { type: 'separator' },
      { role: 'hide', label: t(`AppMenu::Hide ${app.name}`) },
      { role: 'hideOthers', label: t('AppMenu::Hide Others') },
      { role: 'unhide', label: t('AppMenu::Show All') },
      { type: 'separator' },
      { role: 'quit', label: t(`AppMenu::Quit ${app.name}`) },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    {
      label: t('View::&View'),
      submenu: [
        { role: 'copy', label: t('View::Copy') },
        { role: 'selectAll', label: t('View::Select All') },
        { type: 'separator' },
        { role: 'resetZoom', label: t('View::Actual Size') },
        { role: 'zoomIn', label: t('View::Zoom In') },
        { role: 'zoomOut', label: t('View::Zoom Out') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('View::Toggle Full Screen') },
      ],
    },
    {
      label: t('Settings::&Settings'),
      submenu: [
        {
          label: t('Settings::Language'),
          submenu: [
            {
              label: 'English',
              type: 'radio',
              checked: i18n.language === 'en',
              click: () => i18n.changeLanguage('en'),
            },
            {
              label: 'Deutsch',
              type: 'radio',
              checked: i18n.language === 'de',
              click: () => i18n.changeLanguage('de'),
            },
          ],
        },
      ],
    },
    {
      label: t('Help::&Help'),
      submenu: [
        {
          label: t('Help::Documentation'),
          click: () => openDocs('anonymization'),
        },
        {
          label: t('Help::Changelog'),
          click: () => openDocs('changelog'),
        },
        { type: 'separator' },
        {
          label: t('Help::Learn More'),
          click: () => openURL('https://open-diffix.org'),
        },
        {
          label: t('Help::Community Discussions'),
          click: () => openURL('https://github.com/diffix/bi_diffix/discussions'),
        },
        {
          label: t('Help::Search Issues'),
          click: () => openURL('https://github.com/diffix/bi_diffix/issues'),
        },
        {
          label: t('Help::Latest Releases'),
          click: () => openURL('https://github.com/diffix/bi_diffix/releases'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Protocol for docs file serving (docs://)

protocol.registerSchemesAsPrivileged([{ scheme: 'docs', privileges: { bypassCSP: true } }]);

function registerProtocols() {
  protocol.registerFileProtocol('docs', (request, callback) => {
    const url = request.url.substring('docs://'.length);
    callback(path.join(resourcesLocation, 'docs', i18n.language, url));
  });
}

// Main window

const ALLOWED_DOMAINS = ['https://open-diffix.org', 'https://github.com', 'https://arxiv.org', 'mailto:'];

function createWindow() {
  const mainWindow = new BrowserWindow({
    height: 800,
    width: 1400,
    webPreferences: {
      contextIsolation: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      additionalArguments: [`--language=${i18n.language}`],
    },
    icon: path.join(resourcesLocation, 'assets', 'icon.png'),
  });

  mainWindow.on('page-title-updated', function (e) {
    e.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED_DOMAINS.some((domain) => url.startsWith(domain))) {
      shell.openExternal(url);
    } else {
      console.warn(`Blocked URL ${url} by setWindowOpenHandler.`);
    }

    return { action: 'deny' };
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// IPC

const activeTasks = new Map<string, AbortController>();

async function runTask<T>(taskId: string, runner: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (activeTasks.has(taskId)) throw new Error(`Duplicate task ID ${taskId}.`);

  const abortController = new AbortController();
  activeTasks.set(taskId, abortController);

  const startTimestamp = performance.now();
  try {
    return await runner(abortController.signal);
  } finally {
    const taskTime = Math.round(performance.now() - startTimestamp);
    console.debug(`Task ${taskId} took ${taskTime} ms.`);

    activeTasks.delete(taskId);
  }
}

function copyFromFile(client: Client, signal: AbortSignal, fileName: string, tableName: string) {
  return new Promise<void>((resolve, reject) => {
    const pgStream = stream.addAbortSignal(
      signal,
      client.query(from(`COPY "${tableName}" FROM STDIN (DELIMITER ',', FORMAT CSV, HEADER true)`)),
    );
    const fileStream = stream.addAbortSignal(signal, fs.createReadStream(fileName));
    fileStream.on('error', (err) => {
      reject(err);
    });
    pgStream.on('error', (err) => {
      reject(err);
    });
    pgStream.on('finish', (res) => {
      resolve(res);
    });
    fileStream.pipe(pgStream);
  });
}

function setupApp() {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', () => {
    // Feeding the locale to `changeLanguage` or extracting the language cause problems.
    if (['de', 'de-AT', 'de-CH', 'de-DE', 'de-LI', 'de-LU'].includes(app.getLocale())) {
      i18n.changeLanguage('de');
    }
    setupMenu();
    registerProtocols();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (!isMac) {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

function setupI18n() {
  i18n.on('languageChanged', (lng) => {
    setupMenu();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow?.webContents.send('language_changed', lng);
  });

  ipcMain.on('cancel_task', async (_event, taskId: string) => {
    console.info(`Cancelling task ${taskId}.`);
    const controller = activeTasks.get(taskId);
    if (controller) {
      controller.abort();
      activeTasks.delete(taskId);
    } else {
      console.info(`Task ${taskId} not found.`);
    }
  });
}

function setupIPC() {
  ipcMain.handle(
    'import_csv',
    async (_event, taskId: string, fileName: string, tableName: string, columns: TableColumn[], aidColumn: string) => {
      const client = new Client(connectionConfig);
      await client.connect();
      return runTask(taskId, async (signal) => {
        console.info(`(${taskId}) copying CSV ${fileName}.`);

        const columnsSQL = columns.map((column) => `${column.name} ${column.type}`).join(',');

        try {
          // TODO: should we worry about (accidental) SQL-injection here?
          await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
          await client.query(`CREATE TABLE "${tableName}" (${columnsSQL})`);
          await copyFromFile(client, signal, fileName, tableName);
          if (aidColumn == rowIndexColumn) {
            await client.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${aidColumn}" SERIAL`);
          }
          await client.query(`CALL diffix.mark_personal('"${tableName}"', '"${aidColumn}"');`);
        } finally {
          client.end();
        }
      });
    },
  );

  ipcMain.handle('read_csv', (_event, taskId: string, fileName: string) =>
    runTask(taskId, async (signal) => {
      console.info(`(${taskId}) reading CSV ${fileName}.`);

      const promise = () =>
        new Promise<string[][]>((resolve, reject) => {
          const records: string[][] = [];

          stream
            .addAbortSignal(signal, fs.createReadStream(fileName))
            .pipe(parse({ to_line: 1001 }))
            .on('data', function (record) {
              records.push(record);
            })
            .on('end', function () {
              resolve(records);
            })
            .on('error', function (err) {
              reject(err);
            });
        });

      const records = await promise();

      const columns = records[0].map((name: string) => ({ name: name, type: 'text' } as TableColumn));
      const rowsPreview = records.slice(1, 101);

      return { columns: columns, rows: rowsPreview };
    }),
  );

  ipcMain.handle('set_main_window_title', (_event, title: string) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow?.setTitle(title);
  });

  ipcMain.handle('check_for_updates', async (_event) => {
    const response = await fetch('https://api.github.com/repos/diffix/bi_diffix/releases/latest');

    // 404 here means there hasn't yet been a full release yet, just prerelases or drafts
    if (response.status == 404) return null;

    const data = await response.json();
    const newestTagName = data['tag_name'];
    const newestSemVer = semver.coerce(newestTagName);
    const currentSemVer = semver.coerce(app.getVersion());

    return newestSemVer && currentSemVer && semver.gt(newestSemVer, currentSemVer) ? newestTagName : null;
  });
}

let postgresql = null;
let metabase = null;

function setServiceStatus(name: ServiceName, status: ServiceStatus) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  mainWindow?.webContents.send('update_service_status', name, status);
}

async function startServices() {
  console.info('Starting PostgreSQL...');
  await new Promise((r) => setTimeout(r, 10000));
  postgresql = asyncExecFile('notepad.exe', null, { maxBuffer: 100 * 1024 * 1024 });
  console.info('PostgreSQL started.');
  setServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Running);
  postgresql.child.on('close', (code) => {
    console.error(`PostgreSQL exited with code ${code}.`);
    setServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Stopped);
  });

  console.info('Starting Metabase...');
  await new Promise((r) => setTimeout(r, 10000));
  metabase = asyncExecFile('notepad.exe', null, { maxBuffer: 100 * 1024 * 1024 });
  console.info('Metabase started.');
  setServiceStatus(ServiceName.Metabase, ServiceStatus.Running);
  metabase.child.on('close', (code) => {
    console.error(`Metabase exited with code ${code}.`);
    setServiceStatus(ServiceName.Metabase, ServiceStatus.Stopped);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  setupApp();
  setupI18n();
  setupIPC();
  startServices();
}
