import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from 'electron';
import {
  OPEN_FILE_IN_DEFAULT,
  SAVE_FILE,
  SAVE_HTML,
  SHOW_FILE_IN_FOLDER,
} from './constants';
import { createWindow } from './index';
import { getFileFromUserCaution, getFileFromUserDirectly } from './utils';

export function updateApplicationMenu() {
  const hasOneOrMoreWindows = BrowserWindow.getAllWindows().length > 0;
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const hasFilePath = !!(
    focusedWindow && focusedWindow.getRepresentedFilename()
  );

  const template: Array<MenuItemConstructorOptions> = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CommandOrControl+N',
          click() {
            createWindow();
          },
        },
        {
          label: 'Open File',
          accelerator: 'CommandOrControl+O',
          async click(_, focusedWindow) {
            if (focusedWindow) {
              return getFileFromUserDirectly(focusedWindow);
            }

            const newWindow = createWindow();
            newWindow.once('show', () => {
              getFileFromUserDirectly(newWindow);
            });
          },
        },
        {
          enabled: hasOneOrMoreWindows,
          label: 'Save File',
          accelerator: 'CommandOrControl+S',
          click(_, focusedWindow) {
            if (!focusedWindow) {
              return dialog.showErrorBox(
                'Cannot Save Or Export',
                'There is no currently active document to save or export.'
              );
            }
            focusedWindow.webContents.send(SAVE_FILE);
          },
        },
        {
          enabled: hasOneOrMoreWindows,
          label: 'Export HTML',
          accelerator: 'Shift+CommandOrControl+S',
          click(_, focusedWindow) {
            if (!focusedWindow) {
              return dialog.showErrorBox(
                'Cannot Save Or Export',
                'There is no currently active document to save or export.'
              );
            }
            focusedWindow.webContents.send(SAVE_HTML);
          },
        },
        {
          type: 'separator',
        },
        {
          enabled: hasFilePath,
          label: 'Show File',
          click(_, focusedWindow) {
            if (!focusedWindow) {
              return dialog.showErrorBox(
                'Cannot Show File Location',
                'There is currently no active document'
              );
            }
            focusedWindow.webContents.send(SHOW_FILE_IN_FOLDER);
          },
        },
        {
          enabled: hasFilePath,
          label: 'Open in Default Editor',
          click(_, focusedWindow) {
            if (!focusedWindow) {
              return dialog.showErrorBox(
                'Cannot Show File Location',
                'There is currently no active document'
              );
            }
            focusedWindow.webContents.send(OPEN_FILE_IN_DEFAULT);
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CommandOrControl+Z',
          role: 'undo',
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CommandOrControl+Z',
          role: 'redo',
        },
        {
          type: 'separator',
        },
        {
          label: 'Cut',
          accelerator: 'CommandOrControl+X',
          role: 'cut',
        },
        {
          label: 'Copy',
          accelerator: 'CommandOrControl+C',
          role: 'copy',
        },
        {
          label: 'Paste',
          accelerator: 'CommandOrControl+V',
          role: 'paste',
        },
        {
          label: 'Select All',
          accelerator: 'CommandOrControl+A',
          role: 'selectAll',
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CommandOrControl+M',
          role: 'minimize',
        },
        {
          label: 'Close',
          accelerator: 'CommandOrControl+W',
          role: 'close',
        },
      ],
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Visit Website',
          click(_, focusedWindow) {
            const url = 'https://cn.bing.com';
            dialog
              .showMessageBox(focusedWindow, {
                type: 'warning',
                title: 'Not working',
                message: `Open "${url}" in system default browser`,
                buttons: ['Please', 'Cancel'],
                defaultId: 0,
                cancelId: 1,
              })
              .then(({ response }) => {
                if (response === 0) {
                  shell.openExternal(url);
                }
              });
          },
        },
        {
          label: 'Toggel Developer Tools',
          click(item, focusedWindow) {
            console.log(`xedlog item ->`, item);
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          },
        },
      ],
    },
  ];
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'Fire MD',
      submenu: [
        {
          label: 'About Fire MD',
          role: 'about',
        },
        {
          type: 'separator',
        },
        {
          label: 'Services',
          role: 'services',
          submenu: [],
        },
        {
          type: 'separator',
        },
        { label: 'Hide Fire MD', accelerator: 'Command+H', role: 'hide' },
        {
          label: 'Hide Others',
          accelerator: 'Command+Alt+H',
          role: 'hideOthers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        {
          type: 'separator',
        },
        {
          label: 'Quit Fire MD',
          accelerator: 'Command+Q',
          /**
           * there's no default role for quitting the app,
           * so we add a click method
           */
          click() {
            app.quit();
          },
        },
      ],
    });
    const windowMenu = template.find((item) => item.label === 'Window');
    if (windowMenu) {
      windowMenu.role = 'window';
      (windowMenu.submenu as MenuItemConstructorOptions[]).push(
        {
          type: 'separator',
        },
        {
          label: 'Bring All to Front',
          role: 'front',
        }
      );
    }
  }
  return Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function createMarkwonContextMenu(filePath: string) {
  return Menu.buildFromTemplate([
    {
      label: 'Open File',
      click(_, focusedWindow) {
        if (!focusedWindow) {
          return;
        }
        getFileFromUserCaution(focusedWindow);
      },
    },
    {
      enabled: !!filePath,
      label: 'Show File in Folder',
      click(_, focusedWindow) {
        if (!focusedWindow) {
          return;
        }
        focusedWindow.webContents.send(SHOW_FILE_IN_FOLDER);
      },
    },
    {
      enabled: !!filePath,
      label: 'Open in Default Editor',
      click(_, focusedWindow) {
        if (!focusedWindow) {
          return;
        }
        focusedWindow.webContents.send(OPEN_FILE_IN_DEFAULT);
      },
    },

    { type: 'separator' },
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
    { label: 'SelectAll', role: 'selectAll' },
  ]);
}
