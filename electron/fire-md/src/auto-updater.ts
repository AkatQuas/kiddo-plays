import { app, autoUpdater, BrowserWindow, dialog } from 'electron';

const isDevelopment = app.getPath('exe').indexOf('electron') > -1;

const baseUrl = 'https://update.firemd.me';

const releaseFeed = `${baseUrl}/releases/${
  process.platform
}?currentVersion=${app.getVersion()}`;

if (isDevelopment) {
  console.info('[AutoUpdater]', 'In Development Mode, skipping');
} else {
  console.info('[AutoUpdater]', `Setting release feed to ${releaseFeed}`);
  autoUpdater.setFeedURL({
    url: releaseFeed,
  });
}

autoUpdater.addListener('update-available', () => {
  dialog
    .showMessageBox({
      type: 'question',
      buttons: ['Install & Relaunch', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: `${app.getName()} has new update!`,
      detail: 'An update hase been downloaded and can be installed now.',
    })
    .then(({ response }) => {
      if (response === 0) {
        setTimeout(() => {
          app.removeAllListeners('window-all-closed');
          BrowserWindow.getAllWindows().forEach((win) => win.close());
          autoUpdater.quitAndInstall();
        }, 0);
      }
    });
});
export { autoUpdater };
