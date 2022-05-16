const { BrowserWindow } = require('electron');
const path = require('path');

module.exports.createMainWindow = createMainWindow;

function createMainWindow(store) {
  const bw = new BrowserWindow({
    width: 355,
    height: 500,
    icon: './assets/icons/icon.png',
    resizable: false,
    show: false,
    closable: false,
    opacity: 0.9,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // equivalent
  // bw.loadURL(`file://${__dirname}/../app/index.html`);
  bw.loadFile(path.resolve(__dirname, '../app/index.html'));
  bw.webContents.on('dom-ready', () => {
    // initial value
    bw.webContents.send('settings:value', store.get('settings'));
  });
  return bw;
}
