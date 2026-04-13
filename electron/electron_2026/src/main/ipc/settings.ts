import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'
import type { PartialSettingsStore } from 'shared/types/store'
import { settingsStore } from '../store'
import { getWindowManager } from '../windows/manager'

export function registerSettingsHandlers() {
  registerMainHandle('settings.get', () => {
    return settingsStore.store
  })

  registerMainHandle(
    'settings.set',
    (_event, partialSettings: PartialSettingsStore) => {
      // Merge partial settings with existing
      const updated = { ...settingsStore.store, ...partialSettings }
      settingsStore.set(updated)

      // Broadcast full settings to all windows
      const windowManager = getWindowManager()
      windowManager.broadcast('settings.changed', updated)

      return updated
    }
  )
}
