import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  profiler: "Profiler",
  showProfiler: "Show Profiler",
  startStopRecording: "Start/stop recording"
};
const str_ = i18n.i18n.registerUIStrings("panels/js_profiler/js_profiler-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedProfilerModule;
async function loadProfilerModule() {
  if (!loadedProfilerModule) {
    loadedProfilerModule = await import("../profiler/profiler.js");
  }
  return loadedProfilerModule;
}
function maybeRetrieveContextTypes(getClassCallBack) {
  if (loadedProfilerModule === void 0) {
    return [];
  }
  return getClassCallBack(loadedProfilerModule);
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "js_profiler",
  title: i18nLazyString(UIStrings.profiler),
  commandPrompt: i18nLazyString(UIStrings.showProfiler),
  order: 65,
  async loadView() {
    const Profiler = await loadProfilerModule();
    return Profiler.ProfilesPanel.JSProfilerPanel.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "profiler.js-toggle-recording",
  category: UI.ActionRegistration.ActionCategory.JAVASCRIPT_PROFILER,
  title: i18nLazyString(UIStrings.startStopRecording),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  contextTypes() {
    return maybeRetrieveContextTypes((Profiler) => [Profiler.ProfilesPanel.JSProfilerPanel]);
  },
  async loadActionDelegate() {
    const Profiler = await loadProfilerModule();
    return Profiler.ProfilesPanel.JSProfilerPanel.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+E"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+E"
    }
  ]
});
//# sourceMappingURL=js_profiler-meta.js.map
