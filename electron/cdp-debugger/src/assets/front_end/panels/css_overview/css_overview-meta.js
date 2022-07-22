import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  cssOverview: "CSS Overview",
  showCssOverview: "Show CSS Overview"
};
const str_ = i18n.i18n.registerUIStrings("panels/css_overview/css_overview-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedCSSOverviewModule;
async function loadCSSOverviewModule() {
  if (!loadedCSSOverviewModule) {
    loadedCSSOverviewModule = await import("./css_overview.js");
  }
  return loadedCSSOverviewModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "cssoverview",
  commandPrompt: i18nLazyString(UIStrings.showCssOverview),
  title: i18nLazyString(UIStrings.cssOverview),
  order: 95,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const CSSOverview = await loadCSSOverviewModule();
    return CSSOverview.CSSOverviewPanel.CSSOverviewPanel.instance();
  },
  isPreviewFeature: true
});
//# sourceMappingURL=css_overview-meta.js.map
