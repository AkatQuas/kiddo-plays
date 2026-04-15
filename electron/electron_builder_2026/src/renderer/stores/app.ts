import type { SettingsStore } from 'shared/types/store'
import { create } from 'zustand'
import { syncRendererLanguage } from '../i18n'

interface AppState extends SettingsStore {
  setTheme: (theme: SettingsStore['theme']) => void
  setLanguage: (language: SettingsStore['language']) => void
  setAutoCheckUpdate: (
    autoCheckUpdate: SettingsStore['autoCheckUpdate']
  ) => void
  setProxy: (proxy: SettingsStore['proxy']) => void
  initFromSettings: (settings: SettingsStore) => void
}

export const useAppStore = create<AppState>((set, _get) => ({
  theme: 'light',
  language: 'en',
  autoCheckUpdate: true,
  proxy: { enabled: false, url: '' },

  setTheme: theme => {
    // Apply theme to document
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    set({ theme })
  },

  setLanguage: language => {
    syncRendererLanguage(language)
    set({ language })
  },

  setAutoCheckUpdate: autoCheckUpdate => {
    set({ autoCheckUpdate })
  },

  setProxy: proxy => {
    set({ proxy })
  },

  initFromSettings: settings => {
    const { theme, language, autoCheckUpdate, proxy } = settings
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    set({ theme, language, autoCheckUpdate, proxy })
  },
}))
