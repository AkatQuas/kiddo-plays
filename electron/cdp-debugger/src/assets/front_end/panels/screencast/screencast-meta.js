import * as Common from "../../core/common/common.js";
import * as UI from "../../ui/legacy/legacy.js";
let loadedScreencastModule;
async function loadScreencastModule() {
  if (!loadedScreencastModule) {
    loadedScreencastModule = await import("./screencast.js");
  }
  return loadedScreencastModule;
}
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Screencast = await loadScreencastModule();
    return Screencast.ScreencastApp.ToolbarButtonProvider.instance();
  },
  order: 1,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_LEFT,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
Common.AppProvider.registerAppProvider({
  async loadAppProvider() {
    const Screencast = await loadScreencastModule();
    return Screencast.ScreencastApp.ScreencastAppProvider.instance();
  },
  order: 1,
  condition: void 0
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.MAIN_MENU,
  order: 10,
  actionId: "components.request-app-banner"
});
//# sourceMappingURL=screencast-meta.js.map
