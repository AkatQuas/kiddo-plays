import { app, ipcMain } from 'electron';
import is from 'electron-is';
import { productInfo } from '../shared/product';
import { Application } from './app';

if (!is.production()) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

const application = new Application(productInfo);

app.on('ready', () => {
  application.start();
});

app.on('window-all-closed', () => {
  if (!is.macOS()) {
    app.quit();
  }
});

ipcMain.on('app:quit', () => {
  app.quit();
});
