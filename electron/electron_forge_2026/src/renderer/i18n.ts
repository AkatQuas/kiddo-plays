import i18next from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

export const initI18n = async () => {
  await i18next
    .use(initReactI18next)
    .use(
      resourcesToBackend((language: string, namespace: string, callback) => {
        return import(`../locales/${language}/${namespace}.json`)
          .then(({ default: resources }) => {
            callback(null, resources);
          })
          .catch((error) => {
            callback(error, null);
          });
      })
    )
    .init({
      lng: 'en',
      fallbackLng: 'en',
      preload: ['en', 'zh'],
      ns: ['common'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
    });

  return i18next;
};
