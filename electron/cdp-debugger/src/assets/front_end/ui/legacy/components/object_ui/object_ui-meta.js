import * as SDK from "../../../../core/sdk/sdk.js";
import * as UI from "../../legacy.js";
let loadedObjectUIModule;
async function loadObjectUIModule() {
  if (!loadedObjectUIModule) {
    loadedObjectUIModule = await import("./object_ui.js");
  }
  return loadedObjectUIModule;
}
UI.UIUtils.registerRenderer({
  contextTypes() {
    return [SDK.RemoteObject.RemoteObject];
  },
  async loadRenderer() {
    const ObjectUI = await loadObjectUIModule();
    return ObjectUI.ObjectPropertiesSection.Renderer.instance();
  }
});
//# sourceMappingURL=object_ui-meta.js.map
