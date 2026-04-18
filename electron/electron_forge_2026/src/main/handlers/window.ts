import { BrowserWindow } from 'electron';
import { windowManager } from '../windows/manager';
import { registerMainHandle } from './register';

export const registerWindowHandlers = () => {
  registerMainHandle('window.minimize', () => {
    windowManager.minimize();
  });

  registerMainHandle('window.maximize', () => {
    windowManager.toggleMaximize();
  });

  registerMainHandle('window.close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.close();
    }
  });

  // Get window maximized state
  registerMainHandle('window.is-maximized', () => {
    return windowManager.isMaximized();
  });

  // Open a new window with given url, title, width, height
  registerMainHandle('window.open_external', (_event, options) => {
    windowManager.windowForExternal(options);
  });
};
