import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  throttling: "Throttling",
  showThrottling: "Show Throttling",
  goOffline: "Go offline",
  device: "device",
  throttlingTag: "throttling",
  enableSlowGThrottling: "Enable slow `3G` throttling",
  enableFastGThrottling: "Enable fast `3G` throttling",
  goOnline: "Go online"
};
const str_ = i18n.i18n.registerUIStrings("panels/mobile_throttling/mobile_throttling-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedMobileThrottlingModule;
async function loadMobileThrottlingModule() {
  if (!loadedMobileThrottlingModule) {
    loadedMobileThrottlingModule = await import("./mobile_throttling.js");
  }
  return loadedMobileThrottlingModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "throttling-conditions",
  title: i18nLazyString(UIStrings.throttling),
  commandPrompt: i18nLazyString(UIStrings.showThrottling),
  order: 35,
  async loadView() {
    const MobileThrottling = await loadMobileThrottlingModule();
    return MobileThrottling.ThrottlingSettingsTab.ThrottlingSettingsTab.instance();
  },
  settings: [
    "customNetworkConditions"
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network-conditions.network-offline",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  title: i18nLazyString(UIStrings.goOffline),
  async loadActionDelegate() {
    const MobileThrottling = await loadMobileThrottlingModule();
    return MobileThrottling.ThrottlingManager.ActionDelegate.instance();
  },
  tags: [
    i18nLazyString(UIStrings.device),
    i18nLazyString(UIStrings.throttlingTag)
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network-conditions.network-low-end-mobile",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  title: i18nLazyString(UIStrings.enableSlowGThrottling),
  async loadActionDelegate() {
    const MobileThrottling = await loadMobileThrottlingModule();
    return MobileThrottling.ThrottlingManager.ActionDelegate.instance();
  },
  tags: [
    i18nLazyString(UIStrings.device),
    i18nLazyString(UIStrings.throttlingTag)
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network-conditions.network-mid-tier-mobile",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  title: i18nLazyString(UIStrings.enableFastGThrottling),
  async loadActionDelegate() {
    const MobileThrottling = await loadMobileThrottlingModule();
    return MobileThrottling.ThrottlingManager.ActionDelegate.instance();
  },
  tags: [
    i18nLazyString(UIStrings.device),
    i18nLazyString(UIStrings.throttlingTag)
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network-conditions.network-online",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  title: i18nLazyString(UIStrings.goOnline),
  async loadActionDelegate() {
    const MobileThrottling = await loadMobileThrottlingModule();
    return MobileThrottling.ThrottlingManager.ActionDelegate.instance();
  },
  tags: [
    i18nLazyString(UIStrings.device),
    i18nLazyString(UIStrings.throttlingTag)
  ]
});
Common.Settings.registerSettingExtension({
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "customNetworkConditions",
  settingType: Common.Settings.SettingType.ARRAY,
  defaultValue: []
});
//# sourceMappingURL=mobile_throttling-meta.js.map
