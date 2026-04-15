import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next' // if you use React

/**
 * Sync language from main process
 */
export function syncRendererLanguage(lng: string) {
  i18n.changeLanguage(lng)
}

export const rt = (key: string): string => i18n.t(key)

/**
 * Initialize i18n for RENDERER + WebView
 * @param initialLanguage - Language to initialize with (from settings)
 */
export async function initRendererI18n(initialLanguage = 'en') {
  if (i18n.isInitialized) return

  await i18n
    .use(initReactI18next) // remove if not React
    .use(
      resourcesToBackend((language: string, namespace: string, callback) => {
        return import(`../../shared/locales/${language}/${namespace}.json`)
          .then(({ default: resources }) => {
            callback(null, resources)
          })
          .catch(error => {
            callback(error, null)
          })
      })
    )
    .init({
      lng: initialLanguage,
      fallbackLng: 'en',
      ns: ['common', 'error', 'login', 'menu', 'settings'],
      defaultNS: 'common',
      react: { useSuspense: false },
    })
  window.App.on('i18n.language-changed', lng => {
    syncRendererLanguage(lng)
  })
}
