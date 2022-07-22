import * as i18n from "../i18n/i18n.js";
import * as Root from "../root/root.js";
const UIStrings = {
  elements: "Elements",
  appearance: "Appearance",
  sources: "Sources",
  network: "Network",
  performance: "Performance",
  console: "Console",
  persistence: "Persistence",
  debugger: "Debugger",
  global: "Global",
  rendering: "Rendering",
  grid: "Grid",
  mobile: "Mobile",
  memory: "Memory",
  extension: "Extension",
  adorner: "Adorner",
  sync: "Sync"
};
const str_ = i18n.i18n.registerUIStrings("core/common/SettingRegistration.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let registeredSettings = [];
const settingNameSet = /* @__PURE__ */ new Set();
export function registerSettingExtension(registration) {
  const settingName = registration.settingName;
  if (settingNameSet.has(settingName)) {
    throw new Error(`Duplicate setting name '${settingName}'`);
  }
  settingNameSet.add(settingName);
  registeredSettings.push(registration);
}
export function getRegisteredSettings() {
  return registeredSettings.filter((setting) => Root.Runtime.Runtime.isDescriptorEnabled({ experiment: setting.experiment, condition: setting.condition }));
}
export function registerSettingsForTest(settings, forceReset = false) {
  if (registeredSettings.length === 0 || forceReset) {
    registeredSettings = settings;
    settingNameSet.clear();
    for (const setting of settings) {
      const settingName = setting.settingName;
      if (settingNameSet.has(settingName)) {
        throw new Error(`Duplicate setting name '${settingName}'`);
      }
      settingNameSet.add(settingName);
    }
  }
}
export function resetSettings() {
  registeredSettings = [];
  settingNameSet.clear();
}
export function maybeRemoveSettingExtension(settingName) {
  const settingIndex = registeredSettings.findIndex((setting) => setting.settingName === settingName);
  if (settingIndex < 0 || !settingNameSet.delete(settingName)) {
    return false;
  }
  registeredSettings.splice(settingIndex, 1);
  return true;
}
export var SettingCategory = /* @__PURE__ */ ((SettingCategory2) => {
  SettingCategory2["NONE"] = "";
  SettingCategory2["ELEMENTS"] = "ELEMENTS";
  SettingCategory2["APPEARANCE"] = "APPEARANCE";
  SettingCategory2["SOURCES"] = "SOURCES";
  SettingCategory2["NETWORK"] = "NETWORK";
  SettingCategory2["PERFORMANCE"] = "PERFORMANCE";
  SettingCategory2["CONSOLE"] = "CONSOLE";
  SettingCategory2["PERSISTENCE"] = "PERSISTENCE";
  SettingCategory2["DEBUGGER"] = "DEBUGGER";
  SettingCategory2["GLOBAL"] = "GLOBAL";
  SettingCategory2["RENDERING"] = "RENDERING";
  SettingCategory2["GRID"] = "GRID";
  SettingCategory2["MOBILE"] = "MOBILE";
  SettingCategory2["EMULATION"] = "EMULATION";
  SettingCategory2["MEMORY"] = "MEMORY";
  SettingCategory2["EXTENSIONS"] = "EXTENSIONS";
  SettingCategory2["ADORNER"] = "ADORNER";
  SettingCategory2["SYNC"] = "SYNC";
  return SettingCategory2;
})(SettingCategory || {});
export function getLocalizedSettingsCategory(category) {
  switch (category) {
    case "ELEMENTS" /* ELEMENTS */:
      return i18nString(UIStrings.elements);
    case "APPEARANCE" /* APPEARANCE */:
      return i18nString(UIStrings.appearance);
    case "SOURCES" /* SOURCES */:
      return i18nString(UIStrings.sources);
    case "NETWORK" /* NETWORK */:
      return i18nString(UIStrings.network);
    case "PERFORMANCE" /* PERFORMANCE */:
      return i18nString(UIStrings.performance);
    case "CONSOLE" /* CONSOLE */:
      return i18nString(UIStrings.console);
    case "PERSISTENCE" /* PERSISTENCE */:
      return i18nString(UIStrings.persistence);
    case "DEBUGGER" /* DEBUGGER */:
      return i18nString(UIStrings.debugger);
    case "GLOBAL" /* GLOBAL */:
      return i18nString(UIStrings.global);
    case "RENDERING" /* RENDERING */:
      return i18nString(UIStrings.rendering);
    case "GRID" /* GRID */:
      return i18nString(UIStrings.grid);
    case "MOBILE" /* MOBILE */:
      return i18nString(UIStrings.mobile);
    case "EMULATION" /* EMULATION */:
      return i18nString(UIStrings.console);
    case "MEMORY" /* MEMORY */:
      return i18nString(UIStrings.memory);
    case "EXTENSIONS" /* EXTENSIONS */:
      return i18nString(UIStrings.extension);
    case "ADORNER" /* ADORNER */:
      return i18nString(UIStrings.adorner);
    case "" /* NONE */:
      return "";
    case "SYNC" /* SYNC */:
      return i18nString(UIStrings.sync);
  }
}
export var SettingType = /* @__PURE__ */ ((SettingType2) => {
  SettingType2["ARRAY"] = "array";
  SettingType2["REGEX"] = "regex";
  SettingType2["ENUM"] = "enum";
  SettingType2["BOOLEAN"] = "boolean";
  return SettingType2;
})(SettingType || {});
//# sourceMappingURL=SettingRegistration.js.map
