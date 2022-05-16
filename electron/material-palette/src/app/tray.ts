import { app, Menu, shell, Tray } from 'electron';
import { ProductInfo } from '../typings';
import { Application } from './app';

export class TrayManager {
  private _tray: Tray | undefined;
  constructor(
    private readonly productInfo: ProductInfo,
    private readonly app: Application
  ) {}

  start() {
    this._createTray();
  }

  getTrayBounds() {
    return this._tray!.getBounds();
  }

  private _createTray() {
    const tray = new Tray(this.productInfo.icon);
    tray.setToolTip(this.productInfo.name);

    tray.setContextMenu(this._createMenu());
    this._tray = tray;
  }

  private _createMenu() {
    return Menu.buildFromTemplate([
      {
        label: 'Palette',
        click: () => {
          this.app.showWindow();
        },
      },
      {
        label: 'Website',
        click: () => {
          shell.openExternal('https://github.com/');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);
  }
}
