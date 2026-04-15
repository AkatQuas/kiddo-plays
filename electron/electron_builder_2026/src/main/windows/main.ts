import { BrowserWindow } from 'electron'
import { createWindow } from 'lib/electron-app/factory/window/create'
import { waitFor } from 'shared/utils'
import { displayName } from '~/package.json'
import { settingsStore } from '../store'
import { getUpdater } from '../updater'

export const MainWindow = async () => {
  const window = createWindow({
    id: 'main',
    title: displayName,
    width: 700,
    height: 473,
    show: false,
    center: true,
    movable: true,
    resizable: true,
    alwaysOnTop: false,
    autoHideMenuBar: true,
  })
  // Auto-check for updates after window loads
  window.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      const autoCheck = settingsStore.get('autoCheckUpdate', true)
      if (autoCheck) {
        getUpdater().checkForUpdates()
      }
    }, 10_000)
  })

  if (import.meta.env.DEV) {
    window.webContents.once('devtools-opened', async () => {
      await waitFor(1000)
      window.webContents.reload()
    })
  }
  window.on('close', () => {
    // we only have one mainWindow
    // this might be redundant
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy()
    }
  })

  return window
}
