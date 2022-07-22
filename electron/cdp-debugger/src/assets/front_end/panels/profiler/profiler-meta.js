import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
let loadedProfilerModule;
const UIStrings = {
  memory: "Memory",
  liveHeapProfile: "Live Heap Profile",
  startRecordingHeapAllocations: "Start recording heap allocations",
  stopRecordingHeapAllocations: "Stop recording heap allocations",
  startRecordingHeapAllocationsAndReload: "Start recording heap allocations and reload the page",
  startStopRecording: "Start/stop recording",
  showNativeFunctions: "Show native functions in JS Profile",
  showMemory: "Show Memory",
  showLiveHeapProfile: "Show Live Heap Profile"
};
const str_ = i18n.i18n.registerUIStrings("panels/profiler/profiler-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
async function loadProfilerModule() {
  if (!loadedProfilerModule) {
    loadedProfilerModule = await import("./profiler.js");
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
  id: "heap_profiler",
  commandPrompt: i18nLazyString(UIStrings.showMemory),
  title: i18nLazyString(UIStrings.memory),
  order: 60,
  async loadView() {
    const Profiler = await loadProfilerModule();
    return Profiler.HeapProfilerPanel.HeapProfilerPanel.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "live_heap_profile",
  commandPrompt: i18nLazyString(UIStrings.showLiveHeapProfile),
  title: i18nLazyString(UIStrings.liveHeapProfile),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const Profiler = await loadProfilerModule();
    return Profiler.LiveHeapProfileView.LiveHeapProfileView.instance();
  },
  experiment: Root.Runtime.ExperimentName.LIVE_HEAP_PROFILE
});
UI.ActionRegistration.registerActionExtension({
  actionId: "live-heap-profile.toggle-recording",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  async loadActionDelegate() {
    const Profiler = await loadProfilerModule();
    return Profiler.LiveHeapProfileView.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.MEMORY,
  experiment: Root.Runtime.ExperimentName.LIVE_HEAP_PROFILE,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.startRecordingHeapAllocations)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.stopRecordingHeapAllocations)
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "live-heap-profile.start-with-reload",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_REFRESH,
  async loadActionDelegate() {
    const Profiler = await loadProfilerModule();
    return Profiler.LiveHeapProfileView.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.MEMORY,
  experiment: Root.Runtime.ExperimentName.LIVE_HEAP_PROFILE,
  title: i18nLazyString(UIStrings.startRecordingHeapAllocationsAndReload)
});
UI.ActionRegistration.registerActionExtension({
  actionId: "profiler.heap-toggle-recording",
  category: UI.ActionRegistration.ActionCategory.MEMORY,
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  title: i18nLazyString(UIStrings.startStopRecording),
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  contextTypes() {
    return maybeRetrieveContextTypes((Profiler) => [Profiler.HeapProfilerPanel.HeapProfilerPanel]);
  },
  async loadActionDelegate() {
    const Profiler = await loadProfilerModule();
    return Profiler.HeapProfilerPanel.HeapProfilerPanel.instance();
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
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.PERFORMANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showNativeFunctions),
  settingName: "showNativeFunctionsInJSProfile",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      SDK.RemoteObject.RemoteObject
    ];
  },
  async loadProvider() {
    const Profiler = await loadProfilerModule();
    return Profiler.HeapProfilerPanel.HeapProfilerPanel.instance();
  },
  experiment: void 0
});
//# sourceMappingURL=profiler-meta.js.map
