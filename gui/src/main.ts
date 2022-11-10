import archiver from 'archiver';
import { ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, protocol, shell } from 'electron';
import fetch from 'electron-fetch';
import log from 'electron-log';
import i18n from 'i18next';
import i18nFsBackend from 'i18next-fs-backend';
import * as csv from 'csv-string';
import stream from 'stream';
import readline from 'readline';
import events from 'events';
import pg from 'pg';
import pgCopyStreams from 'pg-copy-streams';
import semver from 'semver';
import { i18nConfig, PREVIEW_ROWS_COUNT, ROW_INDEX_COLUMN } from './constants';
import { PageId } from './DocsTab';
import { appResourcesLocation, isMac, postgresConfig } from './main/config';
import { getAppLanguage } from './main/language';
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
import { forwardLogLines } from './main/service-utils';
import { ImportedTable, ServiceName, ServiceStatus, TableColumn } from './types';

const finished = util.promisify(stream.finished);

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
  sendToRenderer('open_docs', page);
}

function openURL(url: string) {
  shell.openExternal(url);
}

async function exportLogs() {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Zip archive', extensions: ['zip'] }],
  });

  if (!result.filePath) return;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = fs.createWriteStream(result.filePath);

  const t = i18n.getFixedT(null, null, 'App::Menu::Actions');
  output.on('close', () => sendToRenderer('show_message', t('Logs exported successfully')));
  archive.on('error', (error) => dialog.showErrorBox(t('Failed to export logs'), error.message));

  archive.pipe(output);

  archive.directory(app.getPath('logs'), false);

  archive.finalize();
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
      label: t('Actions::&Actions'),
      submenu: [
        {
          label: t('Actions::Export Logs'),
          click: exportLogs,
        },
        {
          label: t('Actions::Language'),
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
      label: t('Help::&Help'),
      submenu: [
        {
          label: t('Help::Documentation'),
          click: () => openDocs('operation'),
        },
        {
          label: t('Help::Changelog'),
          click: () => openDocs('changelog'),
        },
        {
          label: t('Help::License'),
          click: () => openDocs('license'),
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

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  mainWindow?.webContents.send(channel, ...args);
}

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
      await shutdownMetabase(metabase).finally(() => shutdownPostgres());
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
    sendToRenderer('language_changed', lng);
  });
}

async function syncTables(): Promise<void> {
  await syncMetabaseSchema();
  sendToRenderer('metabase_event', 'refresh');
}

function setupIPC() {
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

  ipcMain.handle('load_tables', async (_event, taskId: string) => {
    const client = new pg.Client(connectionConfig);
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
          'SELECT tablename, objname FROM pg_catalog.pg_tables, diffix.show_labels() ' +
            "WHERE objname ~ ('public\\.\\\"?' || tablename || '\\\"?\\..*') AND" +
            `      tableowner='${adminUser}' AND ` +
            "      label='aid';",
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
    const client = new pg.Client(connectionConfig);
    await client.connect();
    return runTask(taskId, async (_signal) => {
      console.info(`(${taskId}) Removing imported table.`);

      try {
        await client.query(`DROP TABLE public."${tableName}";`);
        await syncTables();
      } finally {
        client.end();
      }
    });
  });

  function parseCsvSeparatorLine(line: string) {
    const regex = /^"?sep=(.)"?$/i;
    const matches = line.match(regex);
    return matches && (matches[1] as ReturnType<typeof csv.detect>);
  }

  async function* csvFileRows(signal: AbortSignal, fileName: string) {
    const fileStream = stream.addAbortSignal(signal, fs.createReadStream(fileName));
    const lineReader = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let separator = null;

    for await (const line of lineReader) {
      if (line.length === 0) continue;

      if (!separator) {
        // If we got a separator line, extract separator value and skip it.
        separator = parseCsvSeparatorLine(line);
        if (separator) continue;

        // Auto-detect separator from headers line.
        separator = csv.detect(line);
      }

      yield csv.fetch(line, separator);
    }

    lineReader.close();
    fileStream.close();
  }

  async function copyRowsFromCsvFile(client: pg.Client, signal: AbortSignal, fileName: string, tableName: string) {
    const pgStream = stream.addAbortSignal(
      signal,
      client.query(pgCopyStreams.from(`COPY "${tableName}" FROM STDIN (DELIMITER ',', FORMAT CSV, HEADER true)`)),
    );

    for await (const row of csvFileRows(signal, fileName)) {
      if (!pgStream.write(csv.stringify(row))) await events.once(pgStream, 'drain'); // Handle backpressure
    }

    pgStream.end();
    await finished(pgStream);
  }

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
      const client = new pg.Client(connectionConfig);
      await client.connect();
      return runTask(taskId, async (signal) => {
        console.info(`(${taskId}) copying CSV "${fileName}" to "${tableName}".`);

        const columnsSQL = columns.map((column) => `"${column.name}" ${column.type}`).join(', ');
        console.info(`Table schema: ${columnsSQL}.`);

        try {
          await client.query(`BEGIN`);
          // TODO: should we worry about (accidental) SQL-injection here?
          await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
          await client.query(`CREATE TABLE "${tableName}" (${columnsSQL})`);
          await copyRowsFromCsvFile(client, signal, fileName, tableName);
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
          await syncTables();
        } catch (err) {
          await client.query(`ROLLBACK`);
          if ((err as Error)?.name === 'AbortError') {
            return { aborted: true };
          } else {
            throw err;
          }
        } finally {
          client.end();
        }
        return { aborted: false };
      });
    },
  );

  ipcMain.handle('read_csv', (_event, taskId: string, fileName: string) =>
    runTask(taskId, async (signal) => {
      console.info(`(${taskId}) reading CSV ${fileName}.`);

      let headers: string[] | null = null;
      const rows: string[][] = [];

      for await (const row of csvFileRows(signal, fileName)) {
        if (rows.length === PREVIEW_ROWS_COUNT) break;

        if (headers === null) headers = row;
        else rows.push(row);
      }

      if (headers === null) throw 'CSV parsing error: input file is empty!';

      return { headers, rows };
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

  sendToRenderer('update_service_status', name, status);
}

let postgresql: ChildProcessWithoutNullStreams | null = null;
let metabase: ChildProcessWithoutNullStreams | null = null;

async function startServices() {
  await setupPostgres();
  postgresql = startPostgres();

  postgresql.stderr.on('data', async (data: string) => {
    forwardLogLines(log.info, 'postgres:', data);
  });

  postgresql.on('close', (code) => {
    console.error(`PostgreSQL exited with code ${code}.`);
    updateServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Stopped);
  });

  metabase = startMetabase();

  metabase.stdout.on('data', async (data: string) => {
    forwardLogLines(log.info, 'metabase:', data);
  });
  metabase.stderr.on('data', (data: string) => {
    forwardLogLines(log.warn, 'metabase:', data);
  });

  metabase.on('close', (code) => {
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

// Handle creating/removing shortcuts on Windows when installing/uninstalling and single application instance.
if (require('electron-squirrel-startup') || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  setupLog();
  setupApp();
  setupI18n();
  setupIPC();
  startServices();
}
