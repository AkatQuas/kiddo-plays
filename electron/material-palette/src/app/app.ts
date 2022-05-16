import { screen } from 'electron';
import { ProductInfo } from '../typings';
import { TrayManager } from './tray';
import { WindowManager } from './window';

export class Application {
  private _wm: WindowManager;
  private _tm: TrayManager;
  constructor(private readonly productInfo: ProductInfo) {
    this._wm = new WindowManager(productInfo);
    this._tm = new TrayManager(productInfo, this);
  }

  start() {
    this._tm.start();
  }
  showWindow() {
    this._wm.showWindow();
    this._moveWindow();
  }

  private _moveWindow() {
    if (!this._wm.hasWindow()) {
      return;
    }
    // Determine orientation.
    let orientation = 'top-right';
    let x = 0;
    let y = 0;

    const screenSize = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint()
    ).bounds;

    const trayBounds = this._tm.getTrayBounds();

    // Orientation is either not on top or OS is windows.
    if (process.platform === 'win32') {
      if (trayBounds.y > screenSize.height / 2) {
        orientation =
          trayBounds.x > screenSize.width / 2 ? 'bottom-right' : 'bottom-left';
      } else {
        orientation =
          trayBounds.x > screenSize.width / 2 ? 'top-right' : 'top-left';
      }
    } else if (process.platform === 'darwin') {
      orientation = 'top';
    }

    switch (orientation) {
      case 'top':
        x = Math.floor(
          trayBounds.x - this.productInfo.width / 2 + trayBounds.width / 2
        );
        y = trayBounds.y + trayBounds.height;
        break;
      case 'top-right':
        x = screenSize.width - this.productInfo.width;
        break;
      case 'bottom-left':
        y = screenSize.height - this.productInfo.height;
        break;
      case 'bottom-right':
        y = screenSize.height - this.productInfo.height;
        x = screenSize.width - this.productInfo.width;
        break;
      case 'top-left':
      default:
        x = 0;
        y = 0;
    }

    // Normalize any out of bounds
    // maxX accounts for multi-screen setups where x is the coordinate across multiple screens.
    const maxX = screenSize.width + screenSize.x;
    x = x > maxX ? maxX - this.productInfo.width : x < 0 ? 0 : x;
    y =
      y > screenSize.height
        ? screenSize.height - this.productInfo.height
        : y < 0
        ? 0
        : y;
    this._wm.setWindowPosition(x, y);
  }
}
