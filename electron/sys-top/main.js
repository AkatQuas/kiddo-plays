//@ts-check
const {
  app,
  BrowserWindow,
  Menu,
  globalShortcut,
  ipcMain,
  nativeImage,
} = require('electron');
const path = require('path');
const { createTray } = require('./lib/app-tray');
const { isDev, isMac } = require('./lib/context');
const { createMainWindow } = require('./lib/main-window');
const { createMenu } = require('./lib/menu');
const { Store } = require('./lib/store');

const store = new Store({
  configName: 'user-settings',
  defaults: {
    settings: {
      cpuOverload: 80,
      alertFrequency: 5,
    },
  },
});

let /**@type {import('electron').BrowserWindow}  */ mainWindow;
let /**@type {import('electron').Tray}  */ tray;

function initMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }
  mainWindow = createMainWindow(store);
}

ipcMain.on('settings:update', (_, settings) => {
  store.set('settings', settings);
  if (mainWindow) {
    mainWindow.webContents.send('settings:value', store.get('settings'));
  }
});

app.on('ready', () => {
  initMainWindow();

  const icon = nativeImage.createFromPath(
    path.resolve(__dirname, './icons/tray_icon.png')
  );

  tray = createTray(icon, mainWindow);

  // @ts-ignore
  const mainMenu = Menu.buildFromTemplate(createMenu(app, mainWindow));
  Menu.setApplicationMenu(mainMenu);
  if (isDev) {
    globalShortcut.register(isMac ? 'Command+Alt+I' : 'Ctrl+Shift+I', () => {
      if (mainWindow) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }
});

app.on('window-all-closed', () => {
  if (isMac) {
    // skip
  } else {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
