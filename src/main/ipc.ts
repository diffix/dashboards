import { BrowserWindow } from 'electron';

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  mainWindow?.webContents.send(channel, ...args);
}
