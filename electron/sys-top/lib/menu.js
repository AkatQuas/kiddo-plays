// @ts-check

const { isDev, isMac } = require('./context');

/**
 * https://www.electronjs.org/docs/latest/api/menu#examples
 * @param {import('electron').App} app
 * @param {import('electron').BrowserWindow} mainWindow
 * @returns {import('electron').MenuItemConstructorOptions[]}
 */
module.exports.createMenu = (app, mainWindow) => {
  const menu = [
    // custom menu About in the front when darwin
    isMac
      ? {
          label: app.name,
          submenu: [
            {
              label: 'About',
            },
          ],
        }
      : null,

    // the default app menu provided by electron
    { role: 'appMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Navigation',
          click: () => mainWindow.webContents.send('nav:toggle'),
        },
      ],
    },
    // add custom menu About at the end when non-darwin
    isMac
      ? null
      : {
          label: 'Help',
          submenu: [
            {
              label: 'About',
            },
          ],
        },
    isDev
      ? {
          label: 'Developer',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'separator' },
            { role: 'toggleDevTools' },
          ],
        }
      : null,
  ];

  // @ts-expect-error
  return menu.filter(Boolean);
};
