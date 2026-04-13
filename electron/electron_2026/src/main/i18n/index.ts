import { app } from 'electron/main'
import i18n from 'i18next'
import Backend from 'i18next-fs-backend'
import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'
import { mainLogger } from 'lib/electron-app/factory/logger'
import { settingsStore } from '../store'

import { getWindowManager } from 'main/windows/manager'
import path from 'node:path'

const LOCALE_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'locales')
  : path.join(__dirname, '../../../src/shared/locales')

/**
 * Initialize i18n for MAIN process
 */
export async function initMainI18n() {
  if (i18n.isInitialized) return i18n

  const savedLang = settingsStore.get(
    'language',
    app.getSystemLocale().split('-')[0] as 'en'
  )

  await i18n.use(Backend).init({
    lng: savedLang,
    fallbackLng: 'en',
    preload: ['en', 'zh'],
    ns: ['common', 'error', 'menu'],
    defaultNS: 'common',
    backend: {
      loadPath: path.join(LOCALE_PATH, '{{lng}}/{{ns}}.json'),
    },
    debug: false,
  })

  mainLogger.info(`[Main i18n] Initialized: ${savedLang}`)
  registerI18nHandlers()
  return i18n
}

/**
 * Change language and persist
 */
export async function changeMainLanguage(lng: string) {
  await i18n.changeLanguage(lng)
  settingsStore.set('language', lng)
  mainLogger.info(`[Main i18n] Language changed to: ${lng}`)
  return lng
}

export const getCurrentLanguage = () => i18n.language

export const registerI18nHandlers = () => {
  registerMainHandle('i18n.get-language', getCurrentLanguage)

  // IPC: Change language (syncs all processes)
  registerMainHandle('i18n.set-language', async (_, lng) => {
    await changeMainLanguage(lng)

    getWindowManager().broadcast('i18n.language-changed', lng)
    return lng
  })
}
