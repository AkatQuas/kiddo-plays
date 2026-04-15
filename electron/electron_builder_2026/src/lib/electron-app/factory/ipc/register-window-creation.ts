import { ipcMain } from 'electron'
import type { WindowManager } from 'lib/electron-app/factory/window/manager'
import type {
  BrowserWindowOrNull,
  WindowCreationByIPC,
} from 'shared/types/window'

/**
 * @deprecated use {@link WindowManager}
 */
export function registerWindowCreationByIPC({
  channel,
  callback,
  window: createWindow,
}: WindowCreationByIPC) {
  let window: BrowserWindowOrNull

  ipcMain.handle(channel, event => {
    if (!createWindow || window) return

    window = createWindow() as NonNullable<BrowserWindowOrNull>

    window.on('closed', () => {
      window = null
    })

    callback?.(window, event)
  })
}
