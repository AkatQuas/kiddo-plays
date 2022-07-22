import * as UI from "../../ui/legacy/legacy.js";
let loadedConsoleCountersModule;
async function loadConsoleCountersModule() {
  if (!loadedConsoleCountersModule) {
    loadedConsoleCountersModule = await import("./console_counters.js");
  }
  return loadedConsoleCountersModule;
}
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const ConsoleCounters = await loadConsoleCountersModule();
    return ConsoleCounters.WarningErrorCounter.WarningErrorCounter.instance();
  },
  order: 1,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_RIGHT,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
//# sourceMappingURL=console_counters-meta.js.map
