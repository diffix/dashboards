/* eslint-disable @typescript-eslint/no-explicit-any */

import { ipcRenderer } from 'electron';

ipcRenderer.on('dispatch', (_event, action) => {
  console.log('Dispatching action through IPC', action);
  setTimeout(() => {
    // Runs in next frame to ensure globals are initialized.
    const { store } = (window as any).Metabase;
    store.dispatch(action);
  }, 0);
});
