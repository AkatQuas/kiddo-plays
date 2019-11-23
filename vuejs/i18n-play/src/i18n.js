import Vue from 'vue'
import VueI18n from 'vue-i18n'
import messages from './locales.message'

Vue.use(VueI18n);

const dateTimeFormats = {
  'en': {
    short: {
      year: 'numeric', month: 'short', day: 'numeric'
    },
    long: {
      year: 'numeric', month: 'short', day: 'numeric',
      weekday: 'short', hour: 'numeric', minute: 'numeric'
    }
  },
  'cn': {
    short: {
      year: 'numeric', month: 'short', day: 'numeric'
    },
    long: {
      year: 'numeric', month: 'short', day: 'numeric',
      weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: true
    }
  }
}
const numberFormats = {
  'en': {
    currency: {
      style: 'currency', currency: 'USD'
    }
  },
  'cn': {
    currency: {
      style: 'currency', currency: 'RMB', currencyDisplay: 'symbol'
    }
  }

}
export default new VueI18n({
  fallbackLocale: 'en',
  locale: 'cn', // set locale
  messages, // set locale messages
  numberFormats,
  dateTimeFormats
})