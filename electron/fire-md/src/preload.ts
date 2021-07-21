// Preload (Isolated World)
import { contextBridge, ipcRenderer, shell } from 'electron';
import { basename } from 'path';
import {
  CREATE_NEW_WINDOW,
  OPEN_CONTEXT_MENU,
  OPEN_FILE,
  OPEN_FILE_CHANGED,
  OPEN_FILE_CONTENT,
  OPEN_FILE_DIALOG,
  OPEN_FILE_IN_DEFAULT,
  SAVE_FILE,
  SAVE_HTML,
  SHOW_FILE_IN_FOLDER,
  UPDATE_WINDOW_TITLE,
} from './constants';
import { sendUncaughtException } from './send-func';

contextBridge.exposeInMainWorld('electron', {
  sendUncaughtException,
  createNewWindow: () => ipcRenderer.send(CREATE_NEW_WINDOW),
  openFileDialog: () => ipcRenderer.send(OPEN_FILE_DIALOG),
  openFile: (filePath: string) => ipcRenderer.send(OPEN_FILE, filePath),
  onFileContent: (cb: any) => {
    ipcRenderer.on(OPEN_FILE_CONTENT, cb);
  },
  onFileChanged: (cb: any) => {
    ipcRenderer.on(OPEN_FILE_CHANGED, cb);
  },
  updateWindowTitle: (filePath: string, isEdited = false) => {
    let title = 'Fire MD';
    if (filePath) {
      title = `${basename(filePath)} - ${title}`;
    }
    if (isEdited) {
      title = `${title} (Edited)`;
    }
    ipcRenderer.send(UPDATE_WINDOW_TITLE, title, isEdited);
  },
  saveFile: (filePath: string, content: string) => {
    ipcRenderer.send(SAVE_FILE, filePath, content);
  },
  saveHTML: (content: string) => {
    ipcRenderer.send(SAVE_HTML, content);
  },
  /**
   * menu click event send SAVE_FILE to ipcRenderer, so we need callback
   */
  onSaveFile: (cb: any) => {
    ipcRenderer.on(SAVE_FILE, cb);
  },
  /**
   * menu click event send SAVE_HTML to ipcRenderer, so we need callback
   */
  onSaveHTML: (cb: any) => {
    ipcRenderer.on(SAVE_HTML, cb);
  },
  openContextMenu: (filePath: string) => {
    ipcRenderer.send(OPEN_CONTEXT_MENU, filePath);
  },
  showFileInFolder: (filePath: string) => {
    shell.showItemInFolder(filePath);
  },
  onShowFileInFolder: (cb: any) => {
    ipcRenderer.on(SHOW_FILE_IN_FOLDER, cb);
  },
  openInDefault: (filePath: string) => {
    shell.openPath(filePath);
  },
  onOpenInDefault: (cb: any) => {
    ipcRenderer.on(OPEN_FILE_IN_DEFAULT, cb);
  },
});
