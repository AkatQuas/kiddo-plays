import { app } from 'electron'
import { PLATFORM } from 'shared/constants'
import { makeAppId } from 'shared/utils'
import { ignoreConsoleWarnings } from '../../utils'
import type { WindowManager } from '../window/manager'

ignoreConsoleWarnings(['Manifest version 2 is deprecated'])

/**
 * Initialize the app with a pre-configured WindowManager.
 * The WindowManager should already have factories configured via configure().
 *
 * @param windowManager
 * @returns
 */
export async function makeAppSetup(
  windowManager: WindowManager
): Promise<WindowManager> {
  app.on('activate', async () => {
    windowManager.restoreOrCreate()
  })

  app.on('web-contents-created', (_, contents) =>
    contents.on(
      'will-navigate',
      (event, _) => !import.meta.env.DEV && event.preventDefault()
    )
  )

  app.on('window-all-closed', () => !PLATFORM.IS_MAC && app.quit())

  return windowManager
}

PLATFORM.IS_LINUX && app.disableHardwareAcceleration()

PLATFORM.IS_WINDOWS &&
  app.setAppUserModelId(import.meta.env.DEV ? process.execPath : makeAppId())

app.commandLine.appendSwitch('force-color-profile', 'srgb')
