import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  layers: "Layers",
  showLayers: "Show Layers"
};
const str_ = i18n.i18n.registerUIStrings("panels/layers/layers-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedLayersModule;
async function loadLayersModule() {
  if (!loadedLayersModule) {
    loadedLayersModule = await import("./layers.js");
  }
  return loadedLayersModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "layers",
  title: i18nLazyString(UIStrings.layers),
  commandPrompt: i18nLazyString(UIStrings.showLayers),
  order: 100,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const Layers = await loadLayersModule();
    return Layers.LayersPanel.LayersPanel.instance();
  }
});
//# sourceMappingURL=layers-meta.js.map
