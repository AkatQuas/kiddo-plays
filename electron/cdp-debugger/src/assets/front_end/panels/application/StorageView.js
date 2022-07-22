import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import * as UI from "../../ui/legacy/legacy.js";
import { DatabaseModel } from "./DatabaseModel.js";
import { DOMStorageModel } from "./DOMStorageModel.js";
import { IndexedDBModel } from "./IndexedDBModel.js";
import storageViewStyles from "./storageView.css.js";
const UIStrings = {
  storageQuotaUsed: "{PH1} used out of {PH2} storage quota",
  storageQuotaUsedWithBytes: "{PH1} bytes used out of {PH2} bytes storage quota",
  storageWithCustomMarker: "{PH1} (custom)",
  storageTitle: "Storage",
  usage: "Usage",
  mb: "MB",
  learnMore: "Learn more",
  clearSiteData: "Clear site data",
  application: "Application",
  unregisterServiceWorker: "Unregister service workers",
  localAndSessionStorage: "Local and session storage",
  indexDB: "IndexedDB",
  webSql: "Web SQL",
  cookies: "Cookies",
  cache: "Cache",
  cacheStorage: "Cache storage",
  includingThirdPartyCookies: "including third-party cookies",
  sFailedToLoad: "{PH1} (failed to load)",
  internalError: "Internal error",
  pleaseEnterANumber: "Please enter a number",
  numberMustBeNonNegative: "Number must be non-negative",
  clearing: "Clearing...",
  storageQuotaIsLimitedIn: "Storage quota is limited in Incognito mode",
  fileSystem: "File System",
  other: "Other",
  storageUsage: "Storage usage",
  serviceWorkers: "Service Workers",
  simulateCustomStorage: "Simulate custom storage quota"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/StorageView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class StorageView extends UI.ThrottledWidget.ThrottledWidget {
  pieColors;
  reportView;
  target;
  securityOrigin;
  storageKey;
  settings;
  includeThirdPartyCookiesSetting;
  quotaRow;
  quotaUsage;
  pieChart;
  previousOverrideFieldValue;
  quotaOverrideCheckbox;
  quotaOverrideControlRow;
  quotaOverrideEditor;
  quotaOverrideErrorMessage;
  clearButton;
  constructor() {
    super(true, 1e3);
    this.contentElement.classList.add("clear-storage-container");
    this.pieColors = /* @__PURE__ */ new Map([
      [Protocol.Storage.StorageType.Appcache, "rgb(110, 161, 226)"],
      [Protocol.Storage.StorageType.Cache_storage, "rgb(229, 113, 113)"],
      [Protocol.Storage.StorageType.Cookies, "rgb(239, 196, 87)"],
      [Protocol.Storage.StorageType.Indexeddb, "rgb(155, 127, 230)"],
      [Protocol.Storage.StorageType.Local_storage, "rgb(116, 178, 102)"],
      [Protocol.Storage.StorageType.Service_workers, "rgb(255, 167, 36)"],
      [Protocol.Storage.StorageType.Websql, "rgb(203, 220, 56)"]
    ]);
    this.reportView = new UI.ReportView.ReportView(i18nString(UIStrings.storageTitle));
    this.reportView.element.classList.add("clear-storage-header");
    this.reportView.show(this.contentElement);
    this.target = null;
    this.securityOrigin = null;
    this.storageKey = null;
    this.settings = /* @__PURE__ */ new Map();
    for (const type of AllStorageTypes) {
      this.settings.set(type, Common.Settings.Settings.instance().createSetting("clear-storage-" + type, true));
    }
    this.includeThirdPartyCookiesSetting = Common.Settings.Settings.instance().createSetting("clear-storage-include-third-party-cookies", false);
    const quota = this.reportView.appendSection(i18nString(UIStrings.usage));
    this.quotaRow = quota.appendSelectableRow();
    this.quotaRow.classList.add("quota-usage-row");
    const learnMoreRow = quota.appendRow();
    const learnMore = UI.XLink.XLink.create("https://developer.chrome.com/docs/devtools/progressive-web-apps#opaque-responses", i18nString(UIStrings.learnMore));
    learnMoreRow.appendChild(learnMore);
    this.quotaUsage = null;
    this.pieChart = new PerfUI.PieChart.PieChart();
    this.populatePieChart(0, []);
    const usageBreakdownRow = quota.appendRow();
    usageBreakdownRow.classList.add("usage-breakdown-row");
    usageBreakdownRow.appendChild(this.pieChart);
    this.previousOverrideFieldValue = "";
    const quotaOverrideCheckboxRow = quota.appendRow();
    this.quotaOverrideCheckbox = UI.UIUtils.CheckboxLabel.create(i18nString(UIStrings.simulateCustomStorage), false, "");
    quotaOverrideCheckboxRow.appendChild(this.quotaOverrideCheckbox);
    this.quotaOverrideCheckbox.checkboxElement.addEventListener("click", this.onClickCheckbox.bind(this), false);
    this.quotaOverrideControlRow = quota.appendRow();
    this.quotaOverrideEditor = this.quotaOverrideControlRow.createChild("input", "quota-override-notification-editor");
    this.quotaOverrideControlRow.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.mb)));
    this.quotaOverrideControlRow.classList.add("hidden");
    this.quotaOverrideEditor.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        void this.applyQuotaOverrideFromInputField();
        event.consume(true);
      }
    });
    this.quotaOverrideEditor.addEventListener("focusout", (event) => {
      void this.applyQuotaOverrideFromInputField();
      event.consume(true);
    });
    const errorMessageRow = quota.appendRow();
    this.quotaOverrideErrorMessage = errorMessageRow.createChild("div", "quota-override-error");
    const clearButtonSection = this.reportView.appendSection("", "clear-storage-button").appendRow();
    this.clearButton = UI.UIUtils.createTextButton(i18nString(UIStrings.clearSiteData), this.clear.bind(this));
    this.clearButton.id = "storage-view-clear-button";
    clearButtonSection.appendChild(this.clearButton);
    const includeThirdPartyCookiesCheckbox = UI.SettingsUI.createSettingCheckbox(i18nString(UIStrings.includingThirdPartyCookies), this.includeThirdPartyCookiesSetting, true);
    includeThirdPartyCookiesCheckbox.classList.add("include-third-party-cookies");
    clearButtonSection.appendChild(includeThirdPartyCookiesCheckbox);
    const application = this.reportView.appendSection(i18nString(UIStrings.application));
    this.appendItem(application, i18nString(UIStrings.unregisterServiceWorker), Protocol.Storage.StorageType.Service_workers);
    application.markFieldListAsGroup();
    const storage = this.reportView.appendSection(i18nString(UIStrings.storageTitle));
    this.appendItem(storage, i18nString(UIStrings.localAndSessionStorage), Protocol.Storage.StorageType.Local_storage);
    this.appendItem(storage, i18nString(UIStrings.indexDB), Protocol.Storage.StorageType.Indexeddb);
    this.appendItem(storage, i18nString(UIStrings.webSql), Protocol.Storage.StorageType.Websql);
    this.appendItem(storage, i18nString(UIStrings.cookies), Protocol.Storage.StorageType.Cookies);
    storage.markFieldListAsGroup();
    const caches = this.reportView.appendSection(i18nString(UIStrings.cache));
    this.appendItem(caches, i18nString(UIStrings.cacheStorage), Protocol.Storage.StorageType.Cache_storage);
    caches.markFieldListAsGroup();
    SDK.TargetManager.TargetManager.instance().observeTargets(this);
  }
  appendItem(section, title, settingName) {
    const row = section.appendRow();
    const setting = this.settings.get(settingName);
    if (setting) {
      row.appendChild(UI.SettingsUI.createSettingCheckbox(title, setting, true));
    }
  }
  targetAdded(target) {
    if (this.target) {
      return;
    }
    this.target = target;
    const securityOriginManager = target.model(SDK.SecurityOriginManager.SecurityOriginManager);
    this.updateOrigin(securityOriginManager.mainSecurityOrigin(), securityOriginManager.unreachableMainSecurityOrigin());
    securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.MainSecurityOriginChanged, this.originChanged, this);
    const storageKeyManager = target.model(SDK.StorageKeyManager.StorageKeyManager);
    this.updateStorageKey(storageKeyManager.mainStorageKey());
    storageKeyManager.addEventListener(SDK.StorageKeyManager.Events.MainStorageKeyChanged, this.storageKeyChanged, this);
  }
  targetRemoved(target) {
    if (this.target !== target) {
      return;
    }
    const securityOriginManager = target.model(SDK.SecurityOriginManager.SecurityOriginManager);
    securityOriginManager.removeEventListener(SDK.SecurityOriginManager.Events.MainSecurityOriginChanged, this.originChanged, this);
    const storageKeyManager = target.model(SDK.StorageKeyManager.StorageKeyManager);
    storageKeyManager.removeEventListener(SDK.StorageKeyManager.Events.MainStorageKeyChanged, this.storageKeyChanged, this);
  }
  originChanged(event) {
    const { mainSecurityOrigin, unreachableMainSecurityOrigin } = event.data;
    this.updateOrigin(mainSecurityOrigin, unreachableMainSecurityOrigin);
  }
  storageKeyChanged(event) {
    const { mainStorageKey } = event.data;
    this.updateStorageKey(mainStorageKey);
  }
  updateOrigin(mainOrigin, unreachableMainOrigin) {
    const oldOrigin = this.securityOrigin;
    if (unreachableMainOrigin) {
      this.securityOrigin = unreachableMainOrigin;
      this.reportView.setSubtitle(i18nString(UIStrings.sFailedToLoad, { PH1: unreachableMainOrigin }));
    } else {
      this.securityOrigin = mainOrigin;
      this.reportView.setSubtitle(mainOrigin);
    }
    if (oldOrigin !== this.securityOrigin) {
      this.quotaOverrideControlRow.classList.add("hidden");
      this.quotaOverrideCheckbox.checkboxElement.checked = false;
      this.quotaOverrideErrorMessage.textContent = "";
    }
    void this.doUpdate();
  }
  updateStorageKey(mainStorageKey) {
    const oldStorageKey = this.storageKey;
    this.storageKey = mainStorageKey;
    this.reportView.setSubtitle(mainStorageKey);
    if (oldStorageKey !== this.storageKey) {
      this.quotaOverrideControlRow.classList.add("hidden");
      this.quotaOverrideCheckbox.checkboxElement.checked = false;
      this.quotaOverrideErrorMessage.textContent = "";
    }
    void this.doUpdate();
  }
  async applyQuotaOverrideFromInputField() {
    if (!this.target || !this.securityOrigin) {
      this.quotaOverrideErrorMessage.textContent = i18nString(UIStrings.internalError);
      return;
    }
    this.quotaOverrideErrorMessage.textContent = "";
    const editorString = this.quotaOverrideEditor.value;
    if (editorString === "") {
      await this.clearQuotaForOrigin(this.target, this.securityOrigin);
      this.previousOverrideFieldValue = "";
      return;
    }
    const quota = parseFloat(editorString);
    if (!Number.isFinite(quota)) {
      this.quotaOverrideErrorMessage.textContent = i18nString(UIStrings.pleaseEnterANumber);
      return;
    }
    if (quota < 0) {
      this.quotaOverrideErrorMessage.textContent = i18nString(UIStrings.numberMustBeNonNegative);
      return;
    }
    const bytesPerMB = 1e3 * 1e3;
    const quotaInBytes = Math.round(quota * bytesPerMB);
    const quotaFieldValue = `${quotaInBytes / bytesPerMB}`;
    this.quotaOverrideEditor.value = quotaFieldValue;
    this.previousOverrideFieldValue = quotaFieldValue;
    await this.target.storageAgent().invoke_overrideQuotaForOrigin({ origin: this.securityOrigin, quotaSize: quotaInBytes });
  }
  async clearQuotaForOrigin(target, origin) {
    await target.storageAgent().invoke_overrideQuotaForOrigin({ origin });
  }
  async onClickCheckbox() {
    if (this.quotaOverrideControlRow.classList.contains("hidden")) {
      this.quotaOverrideControlRow.classList.remove("hidden");
      this.quotaOverrideCheckbox.checkboxElement.checked = true;
      this.quotaOverrideEditor.value = this.previousOverrideFieldValue;
      this.quotaOverrideEditor.focus();
    } else if (this.target && this.securityOrigin) {
      this.quotaOverrideControlRow.classList.add("hidden");
      this.quotaOverrideCheckbox.checkboxElement.checked = false;
      await this.clearQuotaForOrigin(this.target, this.securityOrigin);
      this.quotaOverrideErrorMessage.textContent = "";
    }
  }
  clear() {
    if (!this.securityOrigin) {
      return;
    }
    const selectedStorageTypes = [];
    for (const type of this.settings.keys()) {
      const setting = this.settings.get(type);
      if (setting && setting.get()) {
        selectedStorageTypes.push(type);
      }
    }
    if (this.target) {
      const includeThirdPartyCookies = this.includeThirdPartyCookiesSetting.get();
      if (this.securityOrigin) {
        StorageView.clear(this.target, this.securityOrigin, selectedStorageTypes, includeThirdPartyCookies);
      } else if (this.storageKey) {
        StorageView.clearByStorageKey(this.target, this.storageKey, selectedStorageTypes);
      }
    }
    this.clearButton.disabled = true;
    const label = this.clearButton.textContent;
    this.clearButton.textContent = i18nString(UIStrings.clearing);
    window.setTimeout(() => {
      this.clearButton.disabled = false;
      this.clearButton.textContent = label;
      this.clearButton.focus();
    }, 500);
  }
  static clear(target, securityOrigin, selectedStorageTypes, includeThirdPartyCookies) {
    void target.storageAgent().invoke_clearDataForOrigin({ origin: securityOrigin, storageTypes: selectedStorageTypes.join(",") });
    const set = new Set(selectedStorageTypes);
    const hasAll = set.has(Protocol.Storage.StorageType.All);
    if (set.has(Protocol.Storage.StorageType.Cookies) || hasAll) {
      const cookieModel = target.model(SDK.CookieModel.CookieModel);
      if (cookieModel) {
        void cookieModel.clear(void 0, includeThirdPartyCookies ? void 0 : securityOrigin);
      }
    }
    if (set.has(Protocol.Storage.StorageType.Indexeddb) || hasAll) {
      for (const target2 of SDK.TargetManager.TargetManager.instance().targets()) {
        const indexedDBModel = target2.model(IndexedDBModel);
        if (indexedDBModel) {
          indexedDBModel.clearForOrigin(securityOrigin);
        }
      }
    }
    if (set.has(Protocol.Storage.StorageType.Local_storage) || hasAll) {
      const storageModel = target.model(DOMStorageModel);
      if (storageModel) {
        storageModel.clearForOrigin(securityOrigin);
      }
    }
    if (set.has(Protocol.Storage.StorageType.Websql) || hasAll) {
      const databaseModel = target.model(DatabaseModel);
      if (databaseModel) {
        databaseModel.disable();
        databaseModel.enable();
      }
    }
    if (set.has(Protocol.Storage.StorageType.Cache_storage) || hasAll) {
      const target2 = SDK.TargetManager.TargetManager.instance().mainTarget();
      const model = target2 && target2.model(SDK.ServiceWorkerCacheModel.ServiceWorkerCacheModel);
      if (model) {
        model.clearForOrigin(securityOrigin);
      }
    }
  }
  static clearByStorageKey(target, storageKey, selectedStorageTypes) {
    const set = new Set(selectedStorageTypes);
    const hasAll = set.has(Protocol.Storage.StorageType.All);
    if (set.has(Protocol.Storage.StorageType.Local_storage) || hasAll) {
      const storageModel = target.model(DOMStorageModel);
      if (storageModel) {
        storageModel.clearForStorageKey(storageKey);
      }
    }
  }
  async doUpdate() {
    if (!this.securityOrigin || !this.target) {
      this.quotaRow.textContent = "";
      this.populatePieChart(0, []);
      return;
    }
    const securityOrigin = this.securityOrigin;
    const response = await this.target.storageAgent().invoke_getUsageAndQuota({ origin: securityOrigin });
    this.quotaRow.textContent = "";
    if (response.getError()) {
      this.populatePieChart(0, []);
      return;
    }
    const quotaOverridden = response.overrideActive;
    const quotaAsString = Platform.NumberUtilities.bytesToString(response.quota);
    const usageAsString = Platform.NumberUtilities.bytesToString(response.usage);
    const formattedQuotaAsString = i18nString(UIStrings.storageWithCustomMarker, { PH1: quotaAsString });
    const quota = quotaOverridden ? UI.Fragment.Fragment.build`<b>${formattedQuotaAsString}</b>`.element() : quotaAsString;
    const element = i18n.i18n.getFormatLocalizedString(str_, UIStrings.storageQuotaUsed, { PH1: usageAsString, PH2: quota });
    this.quotaRow.appendChild(element);
    UI.Tooltip.Tooltip.install(this.quotaRow, i18nString(UIStrings.storageQuotaUsedWithBytes, { PH1: response.usage.toLocaleString(), PH2: response.quota.toLocaleString() }));
    if (!response.overrideActive && response.quota < 125829120) {
      UI.Tooltip.Tooltip.install(this.quotaRow, i18nString(UIStrings.storageQuotaIsLimitedIn));
      this.quotaRow.appendChild(UI.Icon.Icon.create("smallicon-info"));
    }
    if (this.quotaUsage === null || this.quotaUsage !== response.usage) {
      this.quotaUsage = response.usage;
      const slices = [];
      for (const usageForType of response.usageBreakdown.sort((a, b) => b.usage - a.usage)) {
        const value = usageForType.usage;
        if (!value) {
          continue;
        }
        const title = this.getStorageTypeName(usageForType.storageType);
        const color = this.pieColors.get(usageForType.storageType) || "#ccc";
        slices.push({ value, color, title });
      }
      this.populatePieChart(response.usage, slices);
    }
    this.update();
  }
  populatePieChart(total, slices) {
    this.pieChart.data = {
      chartName: i18nString(UIStrings.storageUsage),
      size: 110,
      formatter: Platform.NumberUtilities.bytesToString,
      showLegend: true,
      total,
      slices
    };
  }
  getStorageTypeName(type) {
    switch (type) {
      case Protocol.Storage.StorageType.File_systems:
        return i18nString(UIStrings.fileSystem);
      case Protocol.Storage.StorageType.Websql:
        return i18nString(UIStrings.webSql);
      case Protocol.Storage.StorageType.Appcache:
        return i18nString(UIStrings.application);
      case Protocol.Storage.StorageType.Indexeddb:
        return i18nString(UIStrings.indexDB);
      case Protocol.Storage.StorageType.Cache_storage:
        return i18nString(UIStrings.cacheStorage);
      case Protocol.Storage.StorageType.Service_workers:
        return i18nString(UIStrings.serviceWorkers);
      default:
        return i18nString(UIStrings.other);
    }
  }
  wasShown() {
    super.wasShown();
    this.reportView.registerCSSFiles([storageViewStyles]);
    this.registerCSSFiles([storageViewStyles]);
  }
}
export const AllStorageTypes = [
  Protocol.Storage.StorageType.Appcache,
  Protocol.Storage.StorageType.Cache_storage,
  Protocol.Storage.StorageType.Cookies,
  Protocol.Storage.StorageType.Indexeddb,
  Protocol.Storage.StorageType.Local_storage,
  Protocol.Storage.StorageType.Service_workers,
  Protocol.Storage.StorageType.Websql
];
let actionDelegateInstance;
export class ActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!actionDelegateInstance || forceNew) {
      actionDelegateInstance = new ActionDelegate();
    }
    return actionDelegateInstance;
  }
  handleAction(context, actionId) {
    switch (actionId) {
      case "resources.clear":
        return this.handleClear(false);
      case "resources.clear-incl-third-party-cookies":
        return this.handleClear(true);
    }
    return false;
  }
  async clear(target, resourceTreeModel) {
    const storageKey = await resourceTreeModel.getMainStorageKey();
    if (storageKey) {
      StorageView.clearByStorageKey(target, storageKey, AllStorageTypes);
    }
  }
  handleClear(includeThirdPartyCookies) {
    const target = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!target) {
      return false;
    }
    const resourceTreeModel = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!resourceTreeModel) {
      return false;
    }
    const securityOrigin = resourceTreeModel.getMainSecurityOrigin();
    if (securityOrigin) {
      StorageView.clear(target, securityOrigin, AllStorageTypes, includeThirdPartyCookies);
      return true;
    }
    void this.clear(target, resourceTreeModel);
    return true;
  }
}
//# sourceMappingURL=StorageView.js.map
