import * as i18n from "../../../core/i18n/i18n.js";
import * as UI from "../../legacy/legacy.js";
const UIStrings = {
  memoryInspector: "Memory Inspector",
  showMemoryInspector: "Show Memory Inspector"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/linear_memory_inspector/linear_memory_inspector-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedLinearMemoryInspectorModule;
async function loadLinearMemoryInspectorModule() {
  if (!loadedLinearMemoryInspectorModule) {
    loadedLinearMemoryInspectorModule = await import("./linear_memory_inspector.js");
  }
  return loadedLinearMemoryInspectorModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "linear-memory-inspector",
  title: i18nLazyString(UIStrings.memoryInspector),
  commandPrompt: i18nLazyString(UIStrings.showMemoryInspector),
  order: 100,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const LinearMemoryInspector = await loadLinearMemoryInspectorModule();
    return LinearMemoryInspector.LinearMemoryInspectorPane.Wrapper.instance();
  }
});
//# sourceMappingURL=linear_memory_inspector-meta.js.map
