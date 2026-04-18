import { voidFn } from '@shared/misc.ts';
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { loadReactDevtools } from './extension/load.ts';
import { getSingleInstanceLock } from './factory/singleton.ts';
import { registerAppHandlers } from './handlers/app.ts';
import { registerAuthHandlers } from './handlers/auth.ts';
import { registerSettingsHandlers } from './handlers/settings.ts';
import { registerWindowHandlers } from './handlers/window.ts';
import { initI18nMain } from './i18n.ts';
import { userStore } from './stores/userStore.ts';
import { applySessionProxy } from './utils/session.ts';
import { windowManager } from './windows/index.ts';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

getSingleInstanceLock(async () => {
  const onActivate = async () => {
    if (userStore.get('userId', null)) {
      windowManager.show('main');
    } else {
      // Start with login window
      windowManager.show('login');
    }
  };

  const onReady = async () => {
    await initI18nMain();

    // Register IPC handlers
    registerAppHandlers();
    registerWindowHandlers();
    registerAuthHandlers();
    registerSettingsHandlers();

    // Apply saved proxy settings
    applySessionProxy().catch(voidFn);

    if (import.meta.env.DEV) {
      await loadReactDevtools();
    }

    await onActivate();
  };

  app.on('ready', onReady);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await onActivate();
    }
  });
});
