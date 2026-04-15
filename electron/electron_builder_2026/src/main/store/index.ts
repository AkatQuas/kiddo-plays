import type { SettingsStore, UserStore } from 'shared/types/store'
import { createLazySingletonStore } from './create-store'

export const settingsStore = createLazySingletonStore<SettingsStore>(
  'settings',
  {
    theme: 'dark',
    language: 'en',
    autoCheckUpdate: true,
    proxy: {
      enabled: false,
      url: '',
    },
  }
)
export const userStore = createLazySingletonStore<UserStore>(
  'user-data',
  undefined,
  true
)
