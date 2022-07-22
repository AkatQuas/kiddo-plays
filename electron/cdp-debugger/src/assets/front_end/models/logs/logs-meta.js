import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  preserveLog: "Preserve log",
  preserve: "preserve",
  clear: "clear",
  reset: "reset",
  preserveLogOnPageReload: "Preserve log on page reload / navigation",
  doNotPreserveLogOnPageReload: "Do not preserve log on page reload / navigation",
  recordNetworkLog: "Record network log"
};
const str_ = i18n.i18n.registerUIStrings("models/logs/logs-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  title: i18nLazyString(UIStrings.preserveLog),
  settingName: "network_log.preserve-log",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  tags: [
    i18nLazyString(UIStrings.preserve),
    i18nLazyString(UIStrings.clear),
    i18nLazyString(UIStrings.reset)
  ],
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.preserveLogOnPageReload)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotPreserveLogOnPageReload)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  title: i18nLazyString(UIStrings.recordNetworkLog),
  settingName: "network_log.record-log",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  storageType: Common.Settings.SettingStorageType.Session
});
//# sourceMappingURL=logs-meta.js.map
