import { DEFAULT_LOCALE, LOCALES } from "./locales.js";
import { RegisteredFileStrings } from "./localized-string-set.js";
export class I18n {
  constructor(supportedLocales = LOCALES, defaultLocale = DEFAULT_LOCALE) {
    this.defaultLocale = defaultLocale;
    this.supportedLocales = new Set(supportedLocales);
  }
  supportedLocales;
  localeData = /* @__PURE__ */ new Map();
  registerLocaleData(locale, messages) {
    this.localeData.set(locale, messages);
  }
  registerFileStrings(filename, stringStructure) {
    return new RegisteredFileStrings(filename, stringStructure, this.localeData);
  }
  lookupClosestSupportedLocale(locale) {
    const canonicalLocale = Intl.getCanonicalLocales(locale)[0];
    const localeParts = canonicalLocale.split("-");
    while (localeParts.length) {
      const candidate = localeParts.join("-");
      if (this.supportedLocales.has(candidate)) {
        return candidate;
      }
      localeParts.pop();
    }
    return this.defaultLocale;
  }
}
//# sourceMappingURL=i18n-impl.js.map
