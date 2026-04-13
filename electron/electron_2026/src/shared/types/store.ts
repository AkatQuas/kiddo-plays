export interface SettingsStore {
  language: 'en' | 'zh'
  theme: 'dark' | 'light'
  autoCheckUpdate: boolean
  proxy: {
    enabled: boolean
    url: string
  }
}

export type PartialSettingsStore = Partial<SettingsStore>

export interface UserStore {
  auth: {
    jwt: string
  }
}
