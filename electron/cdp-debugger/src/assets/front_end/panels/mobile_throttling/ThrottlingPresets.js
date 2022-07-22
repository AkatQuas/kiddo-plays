import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
const UIStrings = {
  noThrottling: "No throttling",
  noInternetConnectivity: "No internet connectivity",
  lowendMobile: "Low-end mobile",
  slowGXCpuSlowdown: "Slow 3G & 6x CPU slowdown",
  midtierMobile: "Mid-tier mobile",
  fastGXCpuSlowdown: "Fast 3G & 4x CPU slowdown",
  custom: "Custom",
  checkNetworkAndPerformancePanels: "Check Network and Performance panels"
};
const str_ = i18n.i18n.registerUIStrings("panels/mobile_throttling/ThrottlingPresets.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ThrottlingPresets {
  static getNoThrottlingConditions() {
    const title = typeof SDK.NetworkManager.NoThrottlingConditions.title === "function" ? SDK.NetworkManager.NoThrottlingConditions.title() : SDK.NetworkManager.NoThrottlingConditions.title;
    return {
      title,
      description: i18nString(UIStrings.noThrottling),
      network: SDK.NetworkManager.NoThrottlingConditions,
      cpuThrottlingRate: SDK.CPUThrottlingManager.CPUThrottlingRates.NoThrottling
    };
  }
  static getOfflineConditions() {
    const title = typeof SDK.NetworkManager.OfflineConditions.title === "function" ? SDK.NetworkManager.OfflineConditions.title() : SDK.NetworkManager.OfflineConditions.title;
    return {
      title,
      description: i18nString(UIStrings.noInternetConnectivity),
      network: SDK.NetworkManager.OfflineConditions,
      cpuThrottlingRate: SDK.CPUThrottlingManager.CPUThrottlingRates.NoThrottling
    };
  }
  static getLowEndMobileConditions() {
    return {
      title: i18nString(UIStrings.lowendMobile),
      description: i18nString(UIStrings.slowGXCpuSlowdown),
      network: SDK.NetworkManager.Slow3GConditions,
      cpuThrottlingRate: SDK.CPUThrottlingManager.CPUThrottlingRates.LowEndMobile
    };
  }
  static getMidTierMobileConditions() {
    return {
      title: i18nString(UIStrings.midtierMobile),
      description: i18nString(UIStrings.fastGXCpuSlowdown),
      network: SDK.NetworkManager.Fast3GConditions,
      cpuThrottlingRate: SDK.CPUThrottlingManager.CPUThrottlingRates.MidTierMobile
    };
  }
  static getCustomConditions() {
    return {
      title: i18nString(UIStrings.custom),
      description: i18nString(UIStrings.checkNetworkAndPerformancePanels)
    };
  }
  static getMobilePresets() {
    return [
      ThrottlingPresets.getMidTierMobileConditions(),
      ThrottlingPresets.getLowEndMobileConditions(),
      ThrottlingPresets.getCustomConditions()
    ];
  }
  static getAdvancedMobilePresets() {
    return [
      ThrottlingPresets.getOfflineConditions()
    ];
  }
  static networkPresets = [
    SDK.NetworkManager.Fast3GConditions,
    SDK.NetworkManager.Slow3GConditions,
    SDK.NetworkManager.OfflineConditions
  ];
  static cpuThrottlingPresets = [
    SDK.CPUThrottlingManager.CPUThrottlingRates.NoThrottling,
    SDK.CPUThrottlingManager.CPUThrottlingRates.MidTierMobile,
    SDK.CPUThrottlingManager.CPUThrottlingRates.LowEndMobile
  ];
}
globalThis.MobileThrottling = globalThis.MobileThrottling || {};
globalThis.MobileThrottling.networkPresets = ThrottlingPresets.networkPresets;
//# sourceMappingURL=ThrottlingPresets.js.map
