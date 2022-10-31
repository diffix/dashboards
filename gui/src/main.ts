import { PromiseWithChild } from 'child_process';
import { parse } from 'csv-parse';
import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, protocol, session, shell } from 'electron';
import fetch from 'electron-fetch';
import fs from 'fs';
import i18n from 'i18next';
import i18nFsBackend from 'i18next-fs-backend';
import path from 'path';
import { Client } from 'pg';
import { from } from 'pg-copy-streams';
import semver from 'semver';
import stream from 'stream';
import { i18nConfig, ROW_INDEX_COLUMN } from './constants';
import { PageId } from './Docs';
import { appResourcesLocation, isMac, postgresConfig } from './main/config';
import {
  getMetabaseStatus,
  initializeMetabase,
  setMetabaseStatus,
  shutdownMetabase,
  startMetabase,
  syncMetabaseSchema,
} from './main/metabase';
import {
  getPostgresqlStatus,
  setPostgresqlStatus,
  setupPgDiffix,
  setupPostgres,
  shutdownPostgres,
  startPostgres,
} from './main/postgres';
import { ImportedTable, ServiceName, ServiceStatus, TableColumn } from './types';
import log from 'electron-log';
import { forwardLogLines } from './main/service-utils';
import { getAppLanguage } from './main/language';

const connectionConfig = {
  database: postgresConfig.tablesDatabase,
  port: postgresConfig.port,
  user: postgresConfig.adminUser,
  password: postgresConfig.adminPassword,
  connectionTimeoutMillis: 1000,
};

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const METABASE_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Localization

i18n.use(i18nFsBackend).init({
  ...i18nConfig,
  backend: {
    loadPath: path.join(appResourcesLocation, 'assets', 'locales', '{{lng}}/{{ns}}.json'),
    addPath: path.join(appResourcesLocation, 'assets', 'locales', '{{lng}}/{{ns}}.missing.json'),
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
          click: () => openURL('https://github.com/diffix/dashboards/discussions'),
        },
        {
          label: t('Help::Search Issues'),
          click: () => openURL('https://github.com/diffix/dashboards/issues'),
        },
        {
          label: t('Help::Latest Releases'),
          click: () => openURL('https://github.com/diffix/dashboards/releases'),
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
    callback(path.join(appResourcesLocation, 'docs', i18n.language, url));
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy':
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* 127.0.0.1:* google.com *.google.com",
      },
    });
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
      additionalArguments: [`--language=${i18n.language}`, `--metabasePreloadEntry=${METABASE_PRELOAD_WEBPACK_ENTRY}`],
      webviewTag: true,
    },
    icon: path.join(appResourcesLocation, 'assets', 'icon.png'),
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

function setupLog() {
  // Makes `electron-log` handle all `console.xyz` logging invocations.
  Object.assign(console, log.functions);
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

  app.on('ready', async () => {
    i18n.changeLanguage(getAppLanguage());
    setupMenu();
    registerProtocols();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (!isMac) {
      app.quit();
    }
  });

  app.on('will-quit', async (event) => {
    try {
      event.preventDefault();
      await Promise.all([shutdownPostgres(), shutdownMetabase(metabase?.child)]);
    } catch (e) {
      console.error(e);
    } finally {
      process.exit(0);
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
  ipcMain.handle('load_tables', async (_event, taskId: string) => {
    const client = new Client(connectionConfig);
    await client.connect();
    return runTask(taskId, async (_signal) => {
      console.info(`(${taskId}) Loading imported tables.`);

      const { adminUser } = postgresConfig;
      try {
        const ret: ImportedTable[] = [];
        const allTables = await client.query(
          `SELECT tablename FROM pg_catalog.pg_tables WHERE tableowner='${adminUser}';`,
        );
        allTables.rows.forEach((row) => ret.push({ key: row.tablename, name: row.tablename, aidColumns: [] }));

        const aids = await client.query(
          `SELECT tablename, objname FROM pg_catalog.pg_tables, diffix.show_labels() ` +
            `WHERE objname LIKE ('public."' || tablename || '".%') AND tableowner='${adminUser}' AND label='aid';`,
        );
        aids.rows.forEach((row) =>
          ret.find(({ name }) => name == row.tablename)?.aidColumns.push(row.objname.split('.').at(-1)),
        );

        return ret;
      } finally {
        client.end();
      }
    });
  });

  ipcMain.handle('remove_table', async (_event, taskId: string, tableName: string) => {
    const client = new Client(connectionConfig);
    await client.connect();
    return runTask(taskId, async (_signal) => {
      console.info(`(${taskId}) Removing imported table.`);

      try {
        await client.query(`DROP TABLE public."${tableName}";`);
        await syncMetabaseSchema();
      } finally {
        client.end();
      }
    });
  });

  ipcMain.handle(
    'import_csv',
    async (
      _event,
      taskId: string,
      fileName: string,
      tableName: string,
      columns: TableColumn[],
      aidColumns: string[],
    ) => {
      const client = new Client(connectionConfig);
      await client.connect();
      return runTask(taskId, async (signal) => {
        console.info(`(${taskId}) copying CSV ${fileName}.`);

        const columnsSQL = columns.map((column) => `${column.name} ${column.type}`).join(',');

        try {
          await client.query(`BEGIN`);
          // TODO: should we worry about (accidental) SQL-injection here?
          await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
          await client.query(`CREATE TABLE "${tableName}" (${columnsSQL})`);
          await copyFromFile(client, signal, fileName, tableName);
          if (aidColumns.length > 0) {
            if (aidColumns.includes(ROW_INDEX_COLUMN)) {
              await client.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${ROW_INDEX_COLUMN}" SERIAL`);
            }
            const aidColumnsSQL = aidColumns.map((aidColumn) => `'"${aidColumn}"'`).join(', ');
            await client.query(`CALL diffix.mark_personal('"${tableName}"', ${aidColumnsSQL});`);
          } else {
            await client.query(`CALL diffix.mark_public('"${tableName}"');`);
          }
          await client.query(`GRANT SELECT ON "${tableName}" TO "${postgresConfig.trustedUser}"`);
          await client.query(`COMMIT`);
          await syncMetabaseSchema();
        } catch (err) {
          await client.query(`ROLLBACK`);
          throw err;
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
    const response = await fetch('https://api.github.com/repos/diffix/dashboards/releases/latest');

    // 404 here means there hasn't yet been a full release yet, just prerelases or drafts
    if (response.status == 404) return null;

    const data = await response.json();
    const newestTagName = data['tag_name'];
    const newestSemVer = semver.coerce(newestTagName);
    const currentSemVer = semver.coerce(app.getVersion());

    return newestSemVer && currentSemVer && semver.gt(newestSemVer, currentSemVer) ? newestTagName : null;
  });

  ipcMain.on('get_service_status', (event, name: ServiceName) => {
    switch (name) {
      case ServiceName.PostgreSQL:
        event.returnValue = getPostgresqlStatus();
        break;

      case ServiceName.Metabase:
        event.returnValue = getMetabaseStatus();
        break;
    }
  });
}

function updateServiceStatus(name: ServiceName, status: ServiceStatus) {
  // Remember service status for later interogations.
  switch (name) {
    case ServiceName.PostgreSQL:
      setPostgresqlStatus(status);
      break;

    case ServiceName.Metabase:
      setMetabaseStatus(status);
      break;
  }

  const mainWindow = BrowserWindow.getAllWindows()[0];
  mainWindow?.webContents.send('update_service_status', name, status);
}

let postgresql: PromiseWithChild<{ stdout: string; stderr: string }> | null = null;
let metabase: PromiseWithChild<{ stdout: string; stderr: string }> | null = null;

async function startServices() {
  await setupPostgres();
  postgresql = startPostgres();

  postgresql.child.stderr?.on('data', async (data: string) => {
    forwardLogLines(log.info, 'postgres:', data);
  });

  postgresql.child.on('close', (code) => {
    console.error(`PostgreSQL exited with code ${code}.`);
    updateServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Stopped);
  });

  metabase = startMetabase();

  metabase.child.stdout?.on('data', async (data: string) => {
    forwardLogLines(log.info, 'metabase:', data);
  });
  metabase.child.stderr?.on('data', (data: string) => {
    forwardLogLines(log.warn, 'metabase:', data);
  });

  metabase.child.on('close', (code) => {
    console.error(`Metabase exited with code ${code}.`);
    updateServiceStatus(ServiceName.Metabase, ServiceStatus.Stopped);
  });

  try {
    await setupPgDiffix();
    console.info('PostgreSQL and pg_diffix started.');
    updateServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Running);
  } catch (err) {
    console.info('pg_diffix initialization failed.');
    console.error(err);
    updateServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Stopped);
  }

  try {
    await initializeMetabase();
    console.info('Metabase started.');
    updateServiceStatus(ServiceName.Metabase, ServiceStatus.Running);
  } catch (err) {
    console.info('Metabase initialization failed.');
    console.error(err);
    updateServiceStatus(ServiceName.Metabase, ServiceStatus.Stopped);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  setupLog();
  setupApp();
  setupI18n();
  setupIPC();
  startServices();
}
