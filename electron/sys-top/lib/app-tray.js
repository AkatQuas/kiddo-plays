const { app, Menu, Tray } = require('electron');

module.exports.createTray = createTray;

function createTray(icon, mainWindow) {
  const tray = new Tray(icon);
  tray.setToolTip('SysTop');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle Window',
      click: () => {
        if (mainWindow.isVisible() === true) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.exit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  return tray;
}
