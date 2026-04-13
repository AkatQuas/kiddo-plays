import type { SettingsStore } from 'shared/types/store'
import { useAppStore } from '../stores/app'

/**
 * Register IPC event listeners from main process
 * Add new event handlers here as needed
 */
export function registerIpcListeners() {
  // Listen for settings changes from main process
  window.App.on('settings.changed', (settings: SettingsStore) => {
    useAppStore.getState().initFromSettings(settings)
  })
}
