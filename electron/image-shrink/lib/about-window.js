const { BrowserWindow } = require('electron');
let /**@type {import('electron').BrowserWindow}  */ aboutWindow;

module.exports.createAboutWindow = createAboutWindow;

function createAboutWindow() {
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }
  const bw = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
  });

  bw.loadFile('./app/about.html');
  aboutWindow = bw;
  aboutWindow.once('closed', () => {
    aboutWindow = null;
  });
}
