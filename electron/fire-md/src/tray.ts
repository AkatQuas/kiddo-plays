import {
  app,
  clipboard,
  globalShortcut,
  Menu,
  MenuItemConstructorOptions,
  nativeTheme,
  Notification,
  Tray,
} from 'electron';
import { join } from 'path';
import { CLIPPING_TABLE, DB } from './database';

function getIconPath(name: string) {
  return join(__dirname, 'assets', name);
}
function getIconName(): string {
  if (process.platform === 'win32') {
    return 'icon-light@2x.ico';
  }
  if (nativeTheme.shouldUseDarkColors) {
    return 'icon-light.png';
  }
  return 'icon-dark.png';
}

const clippings: Array<any> = [];

function addClipping() {
  const clipping = clipboard.readText();
  if (clippings.includes(clipping)) {
    new Notification({ title: 'Clipping Added', body: 'Already exist' }).show();
    return clipping;
  }
  clippings.unshift(clipping);
  /* add to database */
  DB(CLIPPING_TABLE)
    .insert({
      value: clipping,
      created_at: new Date(),
    })
    .catch(console.error);

  /* minimize length */
  clippings.length = Math.min(10, clippings.length);
  updateTrayMenu();
  new Notification({ title: 'Clipping Added', body: 'New clipping' }).show();
  return clipping;
}

function createClippingItem(
  clipping: string,
  index: number
): MenuItemConstructorOptions {
  return {
    label: clipping.length > 20 ? clipping.slice(0, 20) + '...' : clipping,
    accelerator: `CommandOrControl+${index}`,
    click() {
      clipboard.writeText(clipping);
    },
  };
}

let tray: Tray = null;

export function getTray(): Tray {
  return tray;
}

export async function initializeTray(): Promise<Tray> {
  if (tray === null) {
    tray = new Tray(getIconPath(getIconName()));
    if (process.platform === 'win32') {
      tray.on('click', () => {
        tray.popUpContextMenu();
      });
    }

    tray.setToolTip('ClipMaster');
    tray.setPressedImage(getIconPath('icon-light.png'));
    registerGlobalShortcuts();
    await DB(CLIPPING_TABLE)
      .select()
      .then((clips) => {
        for (let i = 0, l = Math.min(clips.length, 10); i < l; i++) {
          clippings.push(clips[i].value);
        }
      })
      .catch(console.error);
  }
  return tray;
}
function registerGlobalShortcuts() {
  const activation = globalShortcut.register(
    'Option+CommandOrControl+C',
    () => {
      tray.popUpContextMenu();
    }
  );
  if (!activation) {
    console.error('Global activation shortcut failed to register');
  }
  const newClipping = globalShortcut.register(
    'Shift+Option+CommandOrControl+C',
    () => {
      addClipping();
    }
  );
  if (!newClipping) {
    console.error('Global new clipping shortcut failed to register');
  }
}

export function updateTrayMenu() {
  if (!tray) {
    console.warn('Tray not initialized');
    return;
  }
  const menu = Menu.buildFromTemplate([
    {
      label: 'Create New Clipping',
      accelerator: 'Shift+CommandOrControl+C',
      click() {
        return addClipping();
      },
    },
    { type: 'separator' },
    ...clippings.map(createClippingItem),
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CommandOrControl+Q',
      click() {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  /**
   * Sets the title displayed next to the tray icon
   */
  tray.setTitle(`${clippings.length}`);
}
