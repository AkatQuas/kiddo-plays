import i18n from 'i18next';

const startI18n = (files, lang) => i18n.init({
    lng: lang,
    fallbackLng: 'en',
    resources: files,
    ns: ['common'],
    defaultNS: 'common',
    debug: false
})

export default startI18n;