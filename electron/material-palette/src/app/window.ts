import { BrowserWindow } from 'electron';
import { ProductInfo } from '../typings';

export class WindowManager {
  private _win: BrowserWindow | undefined;

  constructor(private readonly productInfo: ProductInfo) {}

  showWindow() {
    if (!this._win) {
      this._createWindow();
    }

    this._win!.show();
  }

  hasWindow() {
    return this._win !== undefined;
  }

  setWindowPosition(x: number, y: number) {
    if (!this._win) {
      return;
    }

    this._win.setPosition(x, y);
  }

  private _createWindow() {
    const bw = new BrowserWindow({
      width: this.productInfo.width,
      height: this.productInfo.height,
      show: false,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    bw.on('blur', () => {
      bw.hide();
    });
    bw.on('close', () => {
      this._win = undefined;
    });
    bw.loadURL(this.productInfo.entry);
    this._win = bw;
  }
}
