import { BrowserWindow, screen } from 'electron';
import { URL } from 'node:url';
import { Environment } from '../environment';

export class DashboardWindow {
  private _win: BrowserWindow;
  constructor(private readonly env: Environment) {}

  show() {
    if (!this._win) {
      this._createWindow();
    }

    this._win.show();
  }

  private _createWindow() {
    const electronScreen = screen;
    const { width: sw, height: sh } =
      electronScreen.getPrimaryDisplay().workAreaSize;
    const width = 800;
    const height = 750;
    const win = (this._win = new BrowserWindow({
      x: Math.ceil((sw - width) / 2),
      y: Math.ceil((sh - height) / 2),
      title: 'Debugger',
      width,
      height,
      webPreferences: {
        nodeIntegration: true,
        // allowRunningInsecureContent: false,
        contextIsolation: false,
      },
    }));
    win.on('closed', () => {
      this._win = null;
    });

    if (this.env.serve) {
      require('electron-debug')();
      require('electron-reloader')(module);
    }

    const r = new URL('index.html', this.env.assetsBase);

    this._win.loadURL(r.toString());
  }
}
