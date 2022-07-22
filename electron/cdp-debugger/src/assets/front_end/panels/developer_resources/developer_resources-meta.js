import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  developerResources: "Developer Resources",
  showDeveloperResources: "Show Developer Resources"
};
const str_ = i18n.i18n.registerUIStrings("panels/developer_resources/developer_resources-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedDeveloperResourcesModule;
async function loadDeveloperResourcesModule() {
  if (!loadedDeveloperResourcesModule) {
    loadedDeveloperResourcesModule = await import("./developer_resources.js");
  }
  return loadedDeveloperResourcesModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "resource-loading-pane",
  title: i18nLazyString(UIStrings.developerResources),
  commandPrompt: i18nLazyString(UIStrings.showDeveloperResources),
  order: 100,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  experiment: Root.Runtime.ExperimentName.DEVELOPER_RESOURCES_VIEW,
  async loadView() {
    const DeveloperResources = await loadDeveloperResourcesModule();
    return DeveloperResources.DeveloperResourcesView.DeveloperResourcesView.instance();
  }
});
//# sourceMappingURL=developer_resources-meta.js.map
