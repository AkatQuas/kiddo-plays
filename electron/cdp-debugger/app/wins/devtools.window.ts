import { BrowserWindow, screen } from 'electron';
import * as EventEmitter from 'events';
import { Environment } from '../environment';

export class DevtoolsWindow extends EventEmitter {
  private _win: BrowserWindow;

  constructor(
    private readonly env: Environment,
    private readonly page: CDPJSON
  ) {
    super();
    this._createWindow();
  }
  show() {
    const r = new URL(
      `assets/front_end/${this._inspectorFile()}`,
      this.env.assetsBase
    );
    r.searchParams.set(
      'ws',
      this.page.webSocketDebuggerUrl.replace(/ws+:\/\//, '')
    );
    r.searchParams.set('remoteFrontend', 'true');
    this._win.loadURL(r.toString());
  }
  private _inspectorFile() {
    return this.page.type === 'node' ? 'js_app.html' : 'inspector.html';
  }

  private _createWindow() {
    const electronScreen = screen;
    const { width, height } = electronScreen.getPrimaryDisplay().workAreaSize;
    const win = (this._win = new BrowserWindow({
      width: Math.ceil(width / 2),
      height: Math.ceil(height / 2),
      webPreferences: {
        nodeIntegration: false,
        allowRunningInsecureContent: false,
        contextIsolation: false,
      },
    }));
    win.on('closed', () => {
      this._win = null;
      this.emit('closed');
    });
  }
}
