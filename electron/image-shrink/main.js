//@ts-check
const {
  app,
  BrowserWindow,
  Menu,
  globalShortcut,
  ipcMain,
  shell,
} = require('electron');
const { compressImage, getOutputFolder } = require('./lib/compress-image');
const { isDev, isMac } = require('./lib/context');
const { createMenu } = require('./lib/menu');

let /**@type {import('electron').BrowserWindow}  */ mainWindow;

function createMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }
  const bw = new BrowserWindow({
    title: 'ImageShrink',
    width: 500,
    height: 600,
    icon: './assets/icons/icon_256x256.png',
    resizable: isDev,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // equivalent
  // bw.loadURL(`file://${__dirname}/app/index.html`);
  bw.loadFile('./app/index.html');
  mainWindow = bw;
  mainWindow.once('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('image:compress', async (_e, options) => {
  return await compressImage(options);
});

ipcMain.handle('image:output-folder', () => {
  return getOutputFolder();
});

ipcMain.on('image:show-output', (_e, imagePath) => {
  shell.showItemInFolder(imagePath);
});

app.on('ready', () => {
  createMainWindow();
  // @ts-ignore
  const mainMenu = Menu.buildFromTemplate(createMenu(app));
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
