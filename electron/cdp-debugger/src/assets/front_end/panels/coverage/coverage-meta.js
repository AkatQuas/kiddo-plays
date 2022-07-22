import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  coverage: "Coverage",
  showCoverage: "Show Coverage",
  instrumentCoverage: "Instrument coverage",
  stopInstrumentingCoverageAndShow: "Stop instrumenting coverage and show results",
  startInstrumentingCoverageAnd: "Start instrumenting coverage and reload page"
};
const str_ = i18n.i18n.registerUIStrings("panels/coverage/coverage-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedCoverageModule;
async function loadCoverageModule() {
  if (!loadedCoverageModule) {
    loadedCoverageModule = await import("./coverage.js");
  }
  return loadedCoverageModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "coverage",
  title: i18nLazyString(UIStrings.coverage),
  commandPrompt: i18nLazyString(UIStrings.showCoverage),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const Coverage = await loadCoverageModule();
    return Coverage.CoverageView.CoverageView.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "coverage.toggle-recording",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  async loadActionDelegate() {
    const Coverage = await loadCoverageModule();
    return Coverage.CoverageView.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.PERFORMANCE,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.instrumentCoverage)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.stopInstrumentingCoverageAndShow)
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "coverage.start-with-reload",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_REFRESH,
  async loadActionDelegate() {
    const Coverage = await loadCoverageModule();
    return Coverage.CoverageView.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.PERFORMANCE,
  title: i18nLazyString(UIStrings.startInstrumentingCoverageAnd)
});
//# sourceMappingURL=coverage-meta.js.map
