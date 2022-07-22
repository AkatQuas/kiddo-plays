import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
const UIStrings = {
  canOnlyAuditHttphttpsPagesAnd: "Can only audit HTTP/HTTPS pages and `Chrome` extensions. Navigate to a different page to start an audit.",
  thereMayBeStoredDataAffectingSingular: "There may be stored data affecting loading performance in this location: {PH1}. Audit this page in an incognito window to prevent those resources from affecting your scores.",
  thereMayBeStoredDataAffectingLoadingPlural: "There may be stored data affecting loading performance in these locations: {PH1}. Audit this page in an incognito window to prevent those resources from affecting your scores.",
  multipleTabsAreBeingControlledBy: "Multiple tabs are being controlled by the same `service worker`. Close your other tabs on the same origin to audit this page.",
  atLeastOneCategoryMustBeSelected: "At least one category must be selected.",
  localStorage: "Local Storage",
  indexeddb: "IndexedDB",
  webSql: "Web SQL",
  performance: "Performance",
  howLongDoesThisAppTakeToShow: "How long does this app take to show content and become usable",
  progressiveWebApp: "Progressive Web App",
  doesThisPageMeetTheStandardOfA: "Does this page meet the standard of a Progressive Web App",
  bestPractices: "Best practices",
  doesThisPageFollowBestPractices: "Does this page follow best practices for modern web development",
  accessibility: "Accessibility",
  isThisPageUsableByPeopleWith: "Is this page usable by people with disabilities or impairments",
  seo: "SEO",
  isThisPageOptimizedForSearch: "Is this page optimized for search engine results ranking",
  publisherAds: "Publisher Ads",
  isThisPageOptimizedForAdSpeedAnd: "Is this page optimized for ad speed and quality",
  applyMobileEmulation: "Apply mobile emulation",
  applyMobileEmulationDuring: "Apply mobile emulation during auditing",
  lighthouseMode: "Lighthouse mode",
  runLighthouseInMode: "Run Lighthouse in navigation, timespan, or snapshot mode",
  navigation: "Navigation (Default)",
  navigationTooltip: "Navigation mode analyzes a page load, exactly like the original Lighthouse reports.",
  timespan: "Timespan",
  timespanTooltip: "Timespan mode analyzes an arbitrary period of time, typically containing user interactions.",
  snapshot: "Snapshot",
  snapshotTooltip: "Snapshot mode analyzes the page in a particular state, typically after user interactions.",
  mobile: "Mobile",
  desktop: "Desktop",
  throttlingMethod: "Throttling method",
  simulatedThrottling: "Simulated throttling (default)",
  devtoolsThrottling: "DevTools throttling (advanced)",
  simulateASlowerPageLoadBasedOn: "Simulated throttling simulates a slower page load based on data from an initial unthrottled load. DevTools throttling actually slows down the page.",
  clearStorage: "Clear storage",
  legacyNavigation: "Legacy navigation",
  useLegacyNavigation: "Analyze the page using classic Lighthouse when in navigation mode.",
  resetStorageLocalstorage: "Reset storage (`cache`, `service workers`, etc) before auditing. (Good for performance & `PWA` testing)",
  javaScriptDisabled: "JavaScript is disabled. You need to enable JavaScript to audit this page. Open the Command Menu and run the Enable JavaScript command to enable JavaScript."
};
const str_ = i18n.i18n.registerUIStrings("panels/lighthouse/LighthouseController.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class LighthouseController extends Common.ObjectWrapper.ObjectWrapper {
  manager;
  serviceWorkerListeners;
  inspectedURL;
  constructor(protocolService) {
    super();
    protocolService.registerStatusCallback((message) => this.dispatchEventToListeners(Events.AuditProgressChanged, { message }));
    for (const preset of Presets) {
      preset.setting.addChangeListener(this.recomputePageAuditability.bind(this));
    }
    for (const runtimeSetting of RuntimeSettings) {
      runtimeSetting.setting.addChangeListener(this.recomputePageAuditability.bind(this));
    }
    const javaScriptDisabledSetting = Common.Settings.Settings.instance().moduleSetting("javaScriptDisabled");
    javaScriptDisabledSetting.addChangeListener(this.recomputePageAuditability.bind(this));
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.ServiceWorkerManager.ServiceWorkerManager, this);
    SDK.TargetManager.TargetManager.instance().addEventListener(SDK.TargetManager.Events.InspectedURLChanged, this.recomputePageAuditability, this);
  }
  modelAdded(serviceWorkerManager) {
    if (this.manager) {
      return;
    }
    this.manager = serviceWorkerManager;
    this.serviceWorkerListeners = [
      this.manager.addEventListener(SDK.ServiceWorkerManager.Events.RegistrationUpdated, this.recomputePageAuditability, this),
      this.manager.addEventListener(SDK.ServiceWorkerManager.Events.RegistrationDeleted, this.recomputePageAuditability, this)
    ];
    this.recomputePageAuditability();
  }
  modelRemoved(serviceWorkerManager) {
    if (this.manager !== serviceWorkerManager) {
      return;
    }
    if (this.serviceWorkerListeners) {
      Common.EventTarget.removeEventListeners(this.serviceWorkerListeners);
    }
    this.manager = null;
    this.recomputePageAuditability();
  }
  hasActiveServiceWorker() {
    if (!this.manager) {
      return false;
    }
    const mainTarget = this.manager.target();
    if (!mainTarget) {
      return false;
    }
    const inspectedURL = Common.ParsedURL.ParsedURL.fromString(mainTarget.inspectedURL());
    const inspectedOrigin = inspectedURL && inspectedURL.securityOrigin();
    for (const registration of this.manager.registrations().values()) {
      if (registration.securityOrigin !== inspectedOrigin) {
        continue;
      }
      for (const version of registration.versions.values()) {
        if (version.controlledClients.length > 1) {
          return true;
        }
      }
    }
    return false;
  }
  hasAtLeastOneCategory() {
    return Presets.some((preset) => preset.setting.get());
  }
  unauditablePageMessage() {
    if (!this.manager) {
      return null;
    }
    const mainTarget = this.manager.target();
    const inspectedURL = mainTarget && mainTarget.inspectedURL();
    if (inspectedURL && !/^(http|chrome-extension)/.test(inspectedURL)) {
      return i18nString(UIStrings.canOnlyAuditHttphttpsPagesAnd);
    }
    return null;
  }
  javaScriptDisabled() {
    return Common.Settings.Settings.instance().moduleSetting("javaScriptDisabled").get();
  }
  async hasImportantResourcesNotCleared() {
    const clearStorageSetting = RuntimeSettings.find((runtimeSetting) => runtimeSetting.setting.name === "lighthouse.clear_storage");
    if (clearStorageSetting && !clearStorageSetting.setting.get()) {
      return "";
    }
    if (!this.manager) {
      return "";
    }
    const mainTarget = this.manager.target();
    const origin = mainTarget.inspectedURL();
    if (!origin) {
      return "";
    }
    const usageData = await mainTarget.storageAgent().invoke_getUsageAndQuota({ origin });
    const locations = usageData.usageBreakdown.filter((usage) => usage.usage).map((usage) => STORAGE_TYPE_NAMES.get(usage.storageType)).map((i18nStringFn) => i18nStringFn ? i18nStringFn() : void 0).filter(Boolean);
    if (locations.length === 1) {
      return i18nString(UIStrings.thereMayBeStoredDataAffectingSingular, { PH1: String(locations[0]) });
    }
    if (locations.length > 1) {
      return i18nString(UIStrings.thereMayBeStoredDataAffectingLoadingPlural, { PH1: locations.join(", ") });
    }
    return "";
  }
  async evaluateInspectedURL() {
    if (!this.manager) {
      return Platform.DevToolsPath.EmptyUrlString;
    }
    const mainTarget = this.manager.target();
    const inspectedURL = mainTarget.inspectedURL();
    const resourceTreeModel = mainTarget.model(SDK.ResourceTreeModel.ResourceTreeModel);
    const navHistory = resourceTreeModel && await resourceTreeModel.navigationHistory();
    if (!resourceTreeModel || !navHistory) {
      return inspectedURL;
    }
    const { currentIndex, entries } = navHistory;
    const navigationEntry = entries[currentIndex];
    return navigationEntry.url;
  }
  getFlags() {
    const flags = {
      internalDisableDeviceScreenEmulation: true
    };
    for (const runtimeSetting of RuntimeSettings) {
      runtimeSetting.setFlags(flags, runtimeSetting.setting.get());
    }
    return flags;
  }
  getCategoryIDs() {
    const categoryIDs = [];
    for (const preset of Presets) {
      if (preset.setting.get()) {
        categoryIDs.push(preset.configID);
      }
    }
    return categoryIDs;
  }
  async getInspectedURL(options) {
    if (options && options.force || !this.inspectedURL) {
      this.inspectedURL = await this.evaluateInspectedURL();
    }
    return this.inspectedURL;
  }
  recomputePageAuditability() {
    const hasActiveServiceWorker = this.hasActiveServiceWorker();
    const hasAtLeastOneCategory = this.hasAtLeastOneCategory();
    const unauditablePageMessage = this.unauditablePageMessage();
    const javaScriptDisabled = this.javaScriptDisabled();
    let helpText = "";
    if (hasActiveServiceWorker) {
      helpText = i18nString(UIStrings.multipleTabsAreBeingControlledBy);
    } else if (!hasAtLeastOneCategory) {
      helpText = i18nString(UIStrings.atLeastOneCategoryMustBeSelected);
    } else if (unauditablePageMessage) {
      helpText = unauditablePageMessage;
    } else if (javaScriptDisabled) {
      helpText = i18nString(UIStrings.javaScriptDisabled);
    }
    this.dispatchEventToListeners(Events.PageAuditabilityChanged, { helpText });
    void this.hasImportantResourcesNotCleared().then((warning) => {
      if (this.getFlags().mode !== "navigation") {
        warning = "";
      }
      this.dispatchEventToListeners(Events.PageWarningsChanged, { warning });
    });
  }
}
const STORAGE_TYPE_NAMES = /* @__PURE__ */ new Map([
  [Protocol.Storage.StorageType.Local_storage, i18nLazyString(UIStrings.localStorage)],
  [Protocol.Storage.StorageType.Indexeddb, i18nLazyString(UIStrings.indexeddb)],
  [Protocol.Storage.StorageType.Websql, i18nLazyString(UIStrings.webSql)]
]);
export const Presets = [
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.cat_perf", true, Common.Settings.SettingStorageType.Synced),
    configID: "performance",
    title: i18nLazyString(UIStrings.performance),
    description: i18nLazyString(UIStrings.howLongDoesThisAppTakeToShow),
    plugin: false,
    supportedModes: ["navigation", "timespan", "snapshot"]
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.cat_a11y", true, Common.Settings.SettingStorageType.Synced),
    configID: "accessibility",
    title: i18nLazyString(UIStrings.accessibility),
    description: i18nLazyString(UIStrings.isThisPageUsableByPeopleWith),
    plugin: false,
    supportedModes: ["navigation", "snapshot"]
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.cat_best_practices", true, Common.Settings.SettingStorageType.Synced),
    configID: "best-practices",
    title: i18nLazyString(UIStrings.bestPractices),
    description: i18nLazyString(UIStrings.doesThisPageFollowBestPractices),
    plugin: false,
    supportedModes: ["navigation", "timespan", "snapshot"]
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.cat_seo", true, Common.Settings.SettingStorageType.Synced),
    configID: "seo",
    title: i18nLazyString(UIStrings.seo),
    description: i18nLazyString(UIStrings.isThisPageOptimizedForSearch),
    plugin: false,
    supportedModes: ["navigation", "snapshot"]
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.cat_pwa", true, Common.Settings.SettingStorageType.Synced),
    configID: "pwa",
    title: i18nLazyString(UIStrings.progressiveWebApp),
    description: i18nLazyString(UIStrings.doesThisPageMeetTheStandardOfA),
    plugin: false,
    supportedModes: ["navigation"]
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.cat_pubads", false, Common.Settings.SettingStorageType.Synced),
    plugin: true,
    configID: "lighthouse-plugin-publisher-ads",
    title: i18nLazyString(UIStrings.publisherAds),
    description: i18nLazyString(UIStrings.isThisPageOptimizedForAdSpeedAnd),
    supportedModes: ["navigation"]
  }
];
export const RuntimeSettings = [
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.device_type", "mobile", Common.Settings.SettingStorageType.Synced),
    title: i18nLazyString(UIStrings.applyMobileEmulation),
    description: i18nLazyString(UIStrings.applyMobileEmulationDuring),
    setFlags: (flags, value) => {
      flags.emulatedFormFactor = value;
    },
    options: [
      { label: i18nLazyString(UIStrings.mobile), value: "mobile" },
      { label: i18nLazyString(UIStrings.desktop), value: "desktop" }
    ],
    learnMore: void 0
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.mode", "navigation", Common.Settings.SettingStorageType.Synced),
    title: i18nLazyString(UIStrings.lighthouseMode),
    description: i18nLazyString(UIStrings.runLighthouseInMode),
    setFlags: (flags, value) => {
      flags.mode = value;
    },
    options: [
      {
        label: i18nLazyString(UIStrings.navigation),
        tooltip: i18nLazyString(UIStrings.navigationTooltip),
        value: "navigation"
      },
      {
        label: i18nLazyString(UIStrings.timespan),
        tooltip: i18nLazyString(UIStrings.timespanTooltip),
        value: "timespan"
      },
      {
        label: i18nLazyString(UIStrings.snapshot),
        tooltip: i18nLazyString(UIStrings.snapshotTooltip),
        value: "snapshot"
      }
    ],
    learnMore: "https://github.com/GoogleChrome/lighthouse/blob/HEAD/docs/user-flows.md"
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.throttling", "simulate", Common.Settings.SettingStorageType.Synced),
    title: i18nLazyString(UIStrings.throttlingMethod),
    learnMore: "https://github.com/GoogleChrome/lighthouse/blob/master/docs/throttling.md#devtools-lighthouse-panel-throttling",
    description: i18nLazyString(UIStrings.simulateASlowerPageLoadBasedOn),
    setFlags: (flags, value) => {
      if (typeof value === "string") {
        flags.throttlingMethod = value;
      } else {
        flags.throttlingMethod = value ? "simulate" : "devtools";
      }
    },
    options: [
      { label: i18nLazyString(UIStrings.simulatedThrottling), value: "simulate" },
      { label: i18nLazyString(UIStrings.devtoolsThrottling), value: "devtools" }
    ]
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.clear_storage", true, Common.Settings.SettingStorageType.Synced),
    title: i18nLazyString(UIStrings.clearStorage),
    description: i18nLazyString(UIStrings.resetStorageLocalstorage),
    setFlags: (flags, value) => {
      flags.disableStorageReset = !value;
    },
    options: void 0,
    learnMore: void 0
  },
  {
    setting: Common.Settings.Settings.instance().createSetting("lighthouse.legacy_navigation", true, Common.Settings.SettingStorageType.Synced),
    title: i18nLazyString(UIStrings.legacyNavigation),
    description: i18nLazyString(UIStrings.useLegacyNavigation),
    setFlags: (flags, value) => {
      flags.legacyNavigation = value;
    },
    options: void 0,
    learnMore: void 0
  }
];
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["PageAuditabilityChanged"] = "PageAuditabilityChanged";
  Events2["PageWarningsChanged"] = "PageWarningsChanged";
  Events2["AuditProgressChanged"] = "AuditProgressChanged";
  Events2["RequestLighthouseTimespanStart"] = "RequestLighthouseTimespanStart";
  Events2["RequestLighthouseTimespanEnd"] = "RequestLighthouseTimespanEnd";
  Events2["RequestLighthouseStart"] = "RequestLighthouseStart";
  Events2["RequestLighthouseCancel"] = "RequestLighthouseCancel";
  return Events2;
})(Events || {});
//# sourceMappingURL=LighthouseController.js.map
