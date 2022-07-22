import * as I18n from "../../third_party/i18n/i18n.js";
import * as Platform from "../platform/platform.js";
import * as Root from "../root/root.js";
import { DevToolsLocale } from "./DevToolsLocale.js";
const i18nInstance = new I18n.I18n.I18n();
const BUNDLED_LOCALES = /* @__PURE__ */ new Set(["en-US", "en-XL", "zh"]);
export function lookupClosestSupportedDevToolsLocale(locale) {
  return i18nInstance.lookupClosestSupportedLocale(locale);
}
export function getAllSupportedDevToolsLocales() {
  return [...i18nInstance.supportedLocales];
}
function getLocaleFetchUrl(locale) {
  const remoteBase = Root.Runtime.getRemoteBase();
  if (remoteBase && remoteBase.base && !BUNDLED_LOCALES.has(locale)) {
    return `${remoteBase.base}core/i18n/locales/${locale}.json`;
  }
  return new URL(`../../core/i18n/locales/${locale}.json`, import.meta.url).toString();
}
export async function fetchAndRegisterLocaleData(locale) {
  const localeDataTextPromise = fetch(getLocaleFetchUrl(locale)).then((result) => result.json());
  const timeoutPromise = new Promise((resolve, reject) => window.setTimeout(() => reject(new Error("timed out fetching locale")), 5e3));
  const localeData = await Promise.race([timeoutPromise, localeDataTextPromise]);
  i18nInstance.registerLocaleData(locale, localeData);
}
export function getLazilyComputedLocalizedString(registeredStrings, id, values = {}) {
  return () => getLocalizedString(registeredStrings, id, values);
}
export function getLocalizedString(registeredStrings, id, values = {}) {
  return registeredStrings.getLocalizedStringSetFor(DevToolsLocale.instance().locale).getLocalizedString(id, values);
}
export function registerUIStrings(path, stringStructure) {
  return i18nInstance.registerFileStrings(path, stringStructure);
}
export function getFormatLocalizedString(registeredStrings, stringId, placeholders) {
  const formatter = registeredStrings.getLocalizedStringSetFor(DevToolsLocale.instance().locale).getMessageFormatterFor(stringId);
  const element = document.createElement("span");
  for (const icuElement of formatter.getAst()) {
    if (icuElement.type === 1) {
      const placeholderValue = placeholders[icuElement.value];
      if (placeholderValue) {
        element.append(placeholderValue);
      }
    } else if ("value" in icuElement) {
      element.append(String(icuElement.value));
    }
  }
  return element;
}
export function serializeUIString(string, values = {}) {
  const serializedMessage = { string, values };
  return JSON.stringify(serializedMessage);
}
export function deserializeUIString(serializedMessage) {
  if (!serializedMessage) {
    return { string: "", values: {} };
  }
  return JSON.parse(serializedMessage);
}
export function lockedString(str) {
  return str;
}
export function lockedLazyString(str) {
  return () => str;
}
export function getLocalizedLanguageRegion(localeString, devtoolsLocale) {
  const locale = new Intl.Locale(localeString);
  Platform.DCHECK(() => locale.language !== void 0);
  Platform.DCHECK(() => locale.baseName !== void 0);
  const localLanguage = locale.language || "en";
  const localBaseName = locale.baseName || "en-US";
  const devtoolsLoc = new Intl.Locale(devtoolsLocale.locale);
  const targetLanguage = localLanguage === devtoolsLoc.language ? "en" : localBaseName;
  const languageInCurrentLocale = new Intl.DisplayNames([devtoolsLocale.locale], { type: "language" }).of(localLanguage);
  const languageInTargetLocale = new Intl.DisplayNames([targetLanguage], { type: "language" }).of(localLanguage);
  let wrappedRegionInCurrentLocale = "";
  let wrappedRegionInTargetLocale = "";
  if (locale.region) {
    const regionInCurrentLocale = new Intl.DisplayNames([devtoolsLocale.locale], { type: "region", style: "short" }).of(locale.region);
    const regionInTargetLocale = new Intl.DisplayNames([targetLanguage], { type: "region", style: "short" }).of(locale.region);
    wrappedRegionInCurrentLocale = ` (${regionInCurrentLocale})`;
    wrappedRegionInTargetLocale = ` (${regionInTargetLocale})`;
  }
  return `${languageInCurrentLocale}${wrappedRegionInCurrentLocale} - ${languageInTargetLocale}${wrappedRegionInTargetLocale}`;
}
//# sourceMappingURL=i18nImpl.js.map
