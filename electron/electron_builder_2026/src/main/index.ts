import { app } from 'electron'
import { makeAppWithSingleInstanceLock } from 'lib/electron-app/factory/app/instance'
import { makeAppSetup } from 'lib/electron-app/factory/app/setup'
import {
  electronDebug,
  electronUnhandled,
  loadReactDevtools,
} from 'lib/electron-app/utils'
import { initMainI18n } from './i18n'
import { registerIpcHandlers } from './ipc'
import { getMenuManager } from './shell/menu'
import { getNetworkMonitor } from './shell/network'
import { getTrayManager } from './shell/tray'
import { getUpdater } from './updater'
import { getWindowManager } from './windows/manager'

electronDebug()
electronUnhandled()

makeAppWithSingleInstanceLock(async () => {
  await app.whenReady()
  await initMainI18n()

  // Check if there's a downloaded update and install silently
  await getUpdater().checkAndInstallDownloaded()

  const windowManager = getWindowManager()
  await makeAppSetup(windowManager)
  windowManager.createMainWindow()

  registerIpcHandlers()

  getMenuManager().update()
  getTrayManager().update()

  // Start network monitoring
  getNetworkMonitor().start()

  if (import.meta.env.DEV) {
    await loadReactDevtools()
  }
})

// AT "2026/03/31 23:51"
// TODO CONTINUE v(╯°□°)╯
// performance metrics
// tests
// module boundary
