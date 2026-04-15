import { BrowserWindow } from 'electron'
import { join } from 'node:path'

import type { WindowProps } from 'shared/types/window'

import { registerRoute } from 'lib/electron-router-dom'

/**
 * Brand symbol for type-level enforcement (not used at runtime)
 */
const _WindowBrand = Symbol('createWindow')

/**
 * Branded BrowserWindow type - only `createWindow()` can produce this.
 * This is a compile-time type only, used to enforce using createWindow().
 */
export type CreatedBrowserWindow = BrowserWindow & { [_WindowBrand]: true }

/**
 * Create a new BrowserWindow with proper route registration.
 * This is the only way to create windows for the app.
 *
 * Auto invoke `window.destroy` when `closed` event trigger.
 *
 * @returns BrowserWindow cast to CreatedBrowserWindow for type enforcement
 */
export function createWindow({
  id,
  ...props
}: WindowProps): CreatedBrowserWindow {
  const options = Object.assign(
    {
      show: false,
      center: true,
      movable: true,
      resizable: false,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
      },
    },
    props
  )
  const window = new BrowserWindow(options)

  /* https://electron-router-dom.daltonmenezes.com/en/docs/api/main/register-route */
  registerRoute({
    id: id,
    browserWindow: window,
    htmlFile: join(__dirname, '../renderer/index.html'),
  })

  window.webContents.on('did-finish-load', () => {
    window.show()
  })

  window.on('closed', window.destroy)

  // Cast to branded type - Symbol is compile-time only
  return window as CreatedBrowserWindow
}
