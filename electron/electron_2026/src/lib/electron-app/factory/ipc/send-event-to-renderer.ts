import { BrowserWindow } from 'electron'
import type { EventArgs, EventChannel } from 'shared/types/ipc'
import { windowLogger } from '../logger'
import type { WindowManager } from '../window/manager'

/**
 * @deprecated Use {@link WindowManager.send} or WindowManager.broadcast() instead.
 *
 * Example:
 *   import { getWindowManager } from 'main/windows/manager'
 *   const windowManager = getWindowManager()
 *   windowManager.send('main', 'channel-name', data)
 *   windowManager.broadcast('channel-name', data)
 */
export const sendToRenderer = <C extends EventChannel>(
  win: BrowserWindow | null,
  channel: C,
  ...data: EventArgs<C>
): void => {
  try {
    win?.webContents.send(channel, ...data)
  } catch (error) {
    windowLogger.warn(`[send to renderer failed] got %o, error %o`, win, error)
  }
}

/**
 * @deprecated Use {@link WindowManager.send} or {@link WindowManager.broadcast} instead.
 */
export const sendToFocusedWindow = <C extends EventChannel>(
  channel: C,
  ...data: EventArgs<C>
) => {
  const win = BrowserWindow.getFocusedWindow()
  sendToRenderer(win, channel, ...data)
}

/**
 * @deprecated Use {@link WindowManager.broadcast} instead.
 */
export const broadcastToRenderer = <C extends EventChannel>(
  channel: C,
  ...data: EventArgs<C>
): void => {
  const windows = require('electron').BrowserWindow.getAllWindows()
  for (const win of windows) {
    sendToRenderer(win, channel, ...data)
  }
}
