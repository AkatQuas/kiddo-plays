import { app } from 'electron';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { Courier } from './courier';
import { WindowManager } from './window-manager';

try {
  const courier = container.resolve(Courier);
  courier.listen();
  courier.schedule();

  const windowManager = container.resolve(WindowManager);
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More details at https://github.com/electron/electron/issues/15947
  app.on('ready', () =>
    setTimeout(() => {
      windowManager.openDashboard();
    }, 400)
  );

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    windowManager.openDashboard();
  });

  app.on('will-quit', () => {
    // do some release
  });
} catch (e) {
  // Catch Error
  // throw e;
}
