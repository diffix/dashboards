import { ipcRenderer } from 'electron';

ipcRenderer.on('dispatch', (_event, action) => {
  console.log('Dispatching action through IPC', action);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { store } = (window as any).Metabase;
  store.dispatch(action);
});
