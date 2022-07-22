import * as Common from "../../../../core/common/common.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import * as Root from "../../../../core/root/root.js";
import * as UI from "../../legacy.js";
const UIStrings = {
  flamechartMouseWheelAction: "Flamechart mouse wheel action:",
  scroll: "Scroll",
  zoom: "Zoom",
  liveMemoryAllocationAnnotations: "Live memory allocation annotations",
  showLiveMemoryAllocation: "Show live memory allocation annotations",
  hideLiveMemoryAllocation: "Hide live memory allocation annotations",
  collectGarbage: "Collect garbage"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/perf_ui/perf_ui-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedPerfUIModule;
async function loadPerfUIModule() {
  if (!loadedPerfUIModule) {
    loadedPerfUIModule = await import("./perf_ui.js");
  }
  return loadedPerfUIModule;
}
UI.ActionRegistration.registerActionExtension({
  actionId: "components.collect-garbage",
  category: UI.ActionRegistration.ActionCategory.PERFORMANCE,
  title: i18nLazyString(UIStrings.collectGarbage),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_TRASH_BIN,
  async loadActionDelegate() {
    const PerfUI = await loadPerfUIModule();
    return PerfUI.GCActionDelegate.GCActionDelegate.instance();
  }
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.PERFORMANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.flamechartMouseWheelAction),
  settingName: "flamechartMouseWheelAction",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "zoom",
  options: [
    {
      title: i18nLazyString(UIStrings.scroll),
      text: i18nLazyString(UIStrings.scroll),
      value: "scroll"
    },
    {
      title: i18nLazyString(UIStrings.zoom),
      text: i18nLazyString(UIStrings.zoom),
      value: "zoom"
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.MEMORY,
  experiment: Root.Runtime.ExperimentName.LIVE_HEAP_PROFILE,
  title: i18nLazyString(UIStrings.liveMemoryAllocationAnnotations),
  settingName: "memoryLiveHeapProfile",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showLiveMemoryAllocation)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideLiveMemoryAllocation)
    }
  ]
});
//# sourceMappingURL=perf_ui-meta.js.map
