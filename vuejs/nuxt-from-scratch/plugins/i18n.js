import Vue from 'vue';
import VueI18n from 'vue-i18n';

Vue.use(VueI18n)
export default ( {app}, inject, store ) => {
    app.i18n = new VueI18n({
        // VueI18n options
        locale: store.state.locale,
        fallbackLocale: 'en',
        messages: {
            'en' : require('~/locales/en.json'),
            'cn': require('~/locales/cn.json')
        }
    })
    app.i18n.path = link => {
        if (app.i18n.locale === app.i18n.fallbackLocale) {
            return `/${link}`
        }
        return `/${app.i18n.locale}/${link}`
    }
}
