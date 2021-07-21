import { app, BrowserWindow, dialog } from 'electron';
import { Stats, unwatchFile, watchFile } from 'fs';
import { readFile } from 'fs/promises';
import { updateApplicationMenu } from './application-menu';
import { OPEN_FILE_CONTENT } from './constants';

export type OpenFileWatcher = Map<
  BrowserWindow,
  [string, (curr: Stats, prev: Stats) => void]
>;

const openedFiles: OpenFileWatcher = new Map();

export async function getFileFromUserDirectly(targetWindow: BrowserWindow) {
  const filePath = await getFileFromUser(targetWindow);
  openFileForWindow(targetWindow, filePath);
}

export async function getFileFromUserCaution(targetWindow: BrowserWindow) {
  const filePath = await getFileFromUser(targetWindow);

  if (targetWindow.isDocumentEdited()) {
    const { response } = await dialog.showMessageBox(targetWindow, {
      title: 'Overwirte Current Unsaved Changes?',
      message:
        'Opening a new file in this window will overwrite unsaved changes. Open file anyway?',
      buttons: ['Yes Please', 'Leave it'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 1) {
      return;
    }
  }
  openFileForWindow(targetWindow, filePath);
}

export async function getFileFromUser(
  targetWindow: BrowserWindow
): Promise<string> {
  const { filePaths } = await dialog.showOpenDialog(targetWindow, {
    properties: ['openFile'],
    filters: [
      {
        extensions: ['md', 'markdown'],
        name: 'Markdown Files',
      },
      {
        extensions: ['txt'],
        name: 'Text Files',
      },
    ],
  });
  if (!filePaths) {
    return null;
  }
  // console.log(`open files ->`, filePaths);
  return filePaths[0];
}

export async function openFileForWindow(win: BrowserWindow, filePath: string) {
  const content = await getContentFromFile(filePath);
  app.addRecentDocument(filePath);
  win.setRepresentedFilename(filePath);
  win.webContents.send(OPEN_FILE_CONTENT, filePath, content);
  startWatchingFile(win, filePath);
  updateApplicationMenu();
}

async function getContentFromFile(file: string) {
  return readFile(file).then((b) => b.toString());
}

export function getFocusedWindowPosition(): { x?: number; y?: number } {
  let x, y;
  const currentWindow = BrowserWindow.getFocusedWindow();
  if (currentWindow) {
    const position = currentWindow.getPosition();
    x = position[0] + 20;
    y = position[1] + 20;
  }
  return { x, y };
}

export const startWatchingFile = (
  targetWindow: BrowserWindow,
  filePath: string
) => {
  stopWatchingFile(targetWindow);
  const watcher = (curr: Stats, prev: Stats) => {
    if (curr.mtime !== prev.mtime) {
      dialog
        .showMessageBox(targetWindow, {
          type: 'warning',
          title: 'Overwrite Current Unsaved changes',
          message: 'The file has changed. Reload the file?',
          buttons: ['Yes overwrite', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            openFileForWindow(targetWindow, filePath);
          }
        });
    }
  };
  watchFile(filePath, watcher);
  openedFiles.set(targetWindow, [filePath, watcher]);
};

export const stopWatchingFile = (targetWindow: BrowserWindow) => {
  if (openedFiles.has(targetWindow)) {
    const watcher = openedFiles.get(targetWindow);
    unwatchFile(watcher[0], watcher[1]);
    openedFiles.delete(targetWindow);
  }
};
