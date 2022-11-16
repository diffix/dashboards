import { ipcRenderer } from 'electron';
import { EventEmitter } from 'events';
import i18n from 'i18next';
import { set } from 'lodash';
import { initReactI18next } from 'react-i18next';
import { i18nConfig } from './constants';

import de from '../assets/locales/de/translation.json';
import en from '../assets/locales/en/translation.json';
import { ParseOptions, ServiceName, TableColumn } from './types';

const args = window.process.argv;
let initialLanguage = 'en';
for (let i = args.length - 1; i >= 0; i--) {
  const arg = args[i];
  if (arg.startsWith('--language=')) {
    initialLanguage = arg.substring('--language='.length);
  } else if (arg.startsWith('--metabasePreloadEntry=')) {
    window.METABASE_PRELOAD_WEBPACK_ENTRY = arg.substring('--metabasePreloadEntry='.length);
  }
}

i18n.use(initReactI18next).init({
  ...i18nConfig,
  lng: initialLanguage,
  resources: { en: { [i18nConfig.ns]: en }, de: { [i18nConfig.ns]: de } },
});

window.i18n = i18n;
window.i18nMissingKeys = {};

i18n.on('missingKey', (lngs, namespace, key) => {
  const keyPath = key.split(i18nConfig.keySeparator);
  for (const lng of lngs) {
    set(window.i18nMissingKeys, [lng, namespace, ...keyPath], keyPath[keyPath.length - 1]);
  }
});

ipcRenderer.on('language_changed', (_event, language) => {
  i18n.changeLanguage(language);
});

let nextTaskId = 1;

async function newTask<T>(signal: AbortSignal, runner: (taskId: string) => Promise<T>): Promise<T> {
  if (signal.aborted) throw new Error('Operation is canceled.');

  const taskId = (nextTaskId++).toString();
  let taskDone = false;

  signal.addEventListener('abort', () => {
    if (!taskDone) {
      ipcRenderer.send('cancel_task', taskId);
    }
  });

  try {
    return await runner(taskId);
  } finally {
    taskDone = true;
  }
}

window.onPostgresqlStatusUpdate = (_status) => {};
window.onMetabaseStatusUpdate = (_status) => {};

ipcRenderer.on('update_service_status', (_event, name, status) => {
  switch (name) {
    case ServiceName.PostgreSQL:
      window.onPostgresqlStatusUpdate(status);
      break;
    case ServiceName.Metabase:
      window.onMetabaseStatusUpdate(status);
      break;
  }
});

window.getServicesStatus = (name: ServiceName) => ipcRenderer.sendSync('get_service_status', name);

window.loadTables = (signal: AbortSignal) =>
  newTask(signal, async (taskId) => {
    const result = await ipcRenderer.invoke('load_tables', taskId);
    return result;
  });

window.removeTable = (tableName: string, signal: AbortSignal) =>
  newTask(signal, async (taskId) => {
    const result = await ipcRenderer.invoke('remove_table', taskId, tableName);
    return result;
  });

window.storeSet = (key: string, value: unknown) => ipcRenderer.invoke('store_set', key, value);
window.storeGet = (key: string, defaultValue?: unknown) => ipcRenderer.invoke('store_get', key, defaultValue);
window.storeDelete = (key: string) => ipcRenderer.invoke('store_delete', key);

window.readCSV = (fileName: string, signal: AbortSignal) =>
  newTask(signal, (taskId) => {
    return ipcRenderer.invoke('read_csv', taskId, fileName);
  });

window.importCSV = (
  fileName: string,
  parseOptions: ParseOptions,
  tableName: string,
  columns: TableColumn[],
  aidColumns: string[],
  signal: AbortSignal,
) =>
  newTask(signal, (taskId) => {
    return ipcRenderer.invoke('import_csv', taskId, fileName, parseOptions, tableName, columns, aidColumns);
  });

window.setMainWindowTitle = (title: string) => {
  ipcRenderer.invoke('set_main_window_title', title);
};

window.checkForUpdates = () => {
  return ipcRenderer.invoke('check_for_updates');
};

window.onOpenDocs = (_page) => {};
ipcRenderer.on('open_docs', (_event, page) => {
  window.onOpenDocs(page);
});

window.metabaseEvents = new EventEmitter();
ipcRenderer.on('metabase_event', (_event, eventName, ...args) => {
  window.metabaseEvents.emit(eventName, ...args);
});

window.showMessage = (_message) => {};
ipcRenderer.on('show_message', (_event, message) => {
  window.showMessage(message);
});
