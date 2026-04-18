import i18next from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

export const initI18nMain = async () => {
  await i18next
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
      debug: false,
      interpolation: {
        escapeValue: false,
      },
    });

  return i18next;
};

export const changeLanguage = async (lng: string) => {
  await i18next.changeLanguage(lng);
};
