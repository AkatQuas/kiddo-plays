import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  security: "Security",
  showSecurity: "Show Security"
};
const str_ = i18n.i18n.registerUIStrings("panels/security/security-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedSecurityModule;
async function loadSecurityModule() {
  if (!loadedSecurityModule) {
    loadedSecurityModule = await import("./security.js");
  }
  return loadedSecurityModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "security",
  title: i18nLazyString(UIStrings.security),
  commandPrompt: i18nLazyString(UIStrings.showSecurity),
  order: 80,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const Security = await loadSecurityModule();
    return Security.SecurityPanel.SecurityPanel.instance();
  }
});
//# sourceMappingURL=security-meta.js.map
