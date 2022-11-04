import { ipcRenderer } from 'electron';

ipcRenderer.on('dispatch', (_event, action) => {
  console.log('Dispatching action through IPC', action);
  const { store } = (window as any).Metabase;
  store.dispatch(action);
});
