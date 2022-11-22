import archiver from 'archiver';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, protocol, shell } from 'electron';
import fetch from 'electron-fetch';
import log from 'electron-log';
import Store from 'electron-store';
import fs from 'fs';
import i18n from 'i18next';
import i18nFsBackend from 'i18next-fs-backend';
import path from 'path';
import semver from 'semver';
import { i18nConfig } from './constants';
import { PageId } from './DocsTab';
import { appResourcesLocation, isMac } from './main/config';
import { sendToRenderer } from './main/ipc';
import { getAppLanguage } from './main/language';
import {
  buildSampleCardEncoded,
  getMetabaseStatus,
  initializeMetabase,
  setMetabaseStatus,
  shutdownMetabase,
  startMetabase,
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
import { importCSV, loadTables, readCSV, removeTable } from './main/tables';
import { ParseOptions, ServiceName, ServiceStatus, TableColumn } from './types';

const store = new Store();

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

  app.on('ready', () => {
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

function setupIPC() {
  ipcMain.on('cancel_task', (_event, taskId: string) => {
    console.info(`Cancelling task ${taskId}.`);
    const controller = activeTasks.get(taskId);
    if (controller) {
      controller.abort();
      activeTasks.delete(taskId);
    } else {
      console.info(`Task ${taskId} not found.`);
    }
  });

  ipcMain.handle('load_tables', (_event, taskId: string) => {
    console.info(`(${taskId}) Loading imported tables.`);
    return runTask(taskId, (_signal) => loadTables());
  });

  ipcMain.handle('remove_table', (_event, taskId: string, tableName: string) => {
    console.info(`(${taskId}) Removing imported table '${tableName}'.`);
    return runTask(taskId, (_signal) => removeTable(tableName));
  });

  ipcMain.handle('build_sample_card_encoded', (_event, taskId: string, tableName: string, aidColumns: string[]) => {
    console.info(`(${taskId}) Building sample card for '${tableName}'.`);
    return runTask(taskId, (_signal) => buildSampleCardEncoded(tableName, aidColumns));
  });

  ipcMain.handle('store_set', (_event, key, value) => {
    console.info('Storage store_set:', key, value);
    store.set(key, value);
  });
  ipcMain.handle('store_get', (_event, key, defaultValue?) => {
    console.info('Storage store_get:', key, store.get(key, defaultValue));
    return store.get(key, defaultValue);
  });
  ipcMain.handle('store_delete', (_event, key) => {
    console.info('Storage store_delete:', key);
    store.delete(key);
  });

  ipcMain.handle(
    'import_csv',
    (
      _event,
      taskId: string,
      fileName: string,
      parseOptions: ParseOptions,
      tableName: string,
      columns: TableColumn[],
      aidColumns: string[],
    ) => {
      console.info(`(${taskId}) copying CSV "${fileName}" to "${tableName}".`);
      return runTask(taskId, (signal) => importCSV(fileName, parseOptions, tableName, columns, aidColumns, signal));
    },
  );

  ipcMain.handle('read_csv', (_event, taskId: string, fileName: string) => {
    console.info(`(${taskId}) reading CSV ${fileName}.`);
    return runTask(taskId, (signal) => readCSV(fileName, signal));
  });

  ipcMain.handle('set_main_window_title', (_event, title: string) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow?.setTitle(title);
  });

  ipcMain.handle('check_for_updates', async (_event) => {
    const response = await fetch('https://api.github.com/repos/diffix/dashboards/releases/latest');

    // 404 here means there hasn't yet been a full release yet, just prereleases or drafts
    if (response.status === 404) return null;

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

  postgresql.stderr.on('data', (data: string) => {
    forwardLogLines(log.info, 'postgres:', data);
  });

  postgresql.on('close', (code) => {
    console.error(`PostgreSQL exited with code ${code}.`);
    updateServiceStatus(ServiceName.PostgreSQL, ServiceStatus.Stopped);
  });

  metabase = startMetabase();

  metabase.stdout.on('data', (data: string) => {
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
