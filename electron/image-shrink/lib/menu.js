// @ts-check

const { createAboutWindow } = require('./about-window');
const { isDev, isMac } = require('./context');

/**
 * https://www.electronjs.org/docs/latest/api/menu#examples
 * @param {import('electron').App} app
 * @returns {import('electron').MenuItemConstructorOptions[]}
 */
module.exports.createMenu = (app) => {
  const menu = [
    // custom menu About in the front when darwin
    isMac
      ? {
          label: app.name,
          submenu: [
            {
              label: 'About',
              click: createAboutWindow,
            },
          ],
        }
      : null,

    // the default app menu provided by electron
    { role: 'appMenu' },
    { role: 'fileMenu' },
    // add custom menu About at the end when non-darwin
    isMac
      ? null
      : {
          label: 'Help',
          submenu: [
            {
              label: 'About',
              click: createAboutWindow,
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
