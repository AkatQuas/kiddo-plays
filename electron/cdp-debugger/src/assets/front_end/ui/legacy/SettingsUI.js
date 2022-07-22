import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Settings from "../components/settings/settings.js";
import * as ARIAUtils from "./ARIAUtils.js";
import { InspectorView } from "./InspectorView.js";
import { Tooltip } from "./Tooltip.js";
import { CheckboxLabel } from "./UIUtils.js";
const UIStrings = {
  srequiresReload: "*Requires reload",
  oneOrMoreSettingsHaveChanged: "One or more settings have changed which requires a reload to take effect."
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/SettingsUI.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export const createSettingCheckbox = function(name, setting, omitParagraphElement, tooltip) {
  const label = CheckboxLabel.create(name);
  if (tooltip) {
    Tooltip.install(label, tooltip);
  }
  const input = label.checkboxElement;
  input.name = name;
  bindCheckbox(input, setting);
  if (omitParagraphElement) {
    return label;
  }
  const p = document.createElement("p");
  p.appendChild(label);
  return p;
};
const createSettingSelect = function(name, options, requiresReload, setting, subtitle) {
  const container = document.createElement("div");
  const settingSelectElement = container.createChild("p");
  settingSelectElement.classList.add("settings-select");
  const label = settingSelectElement.createChild("label");
  const select = settingSelectElement.createChild("select", "chrome-select");
  label.textContent = name;
  if (subtitle) {
    container.classList.add("chrome-select-label");
    label.createChild("p").textContent = subtitle;
  }
  ARIAUtils.bindLabelToControl(label, select);
  for (const option of options) {
    if (option.text && typeof option.value === "string") {
      select.add(new Option(option.text, option.value));
    }
  }
  let reloadWarning = null;
  if (requiresReload) {
    reloadWarning = container.createChild("span", "reload-warning hidden");
    reloadWarning.textContent = i18nString(UIStrings.srequiresReload);
    ARIAUtils.markAsAlert(reloadWarning);
  }
  setting.addChangeListener(settingChanged);
  settingChanged();
  select.addEventListener("change", selectChanged, false);
  return container;
  function settingChanged() {
    const newValue = setting.get();
    for (let i = 0; i < options.length; i++) {
      if (options[i].value === newValue) {
        select.selectedIndex = i;
      }
    }
    select.disabled = setting.disabled();
  }
  function selectChanged() {
    setting.set(options[select.selectedIndex].value);
    if (reloadWarning) {
      reloadWarning.classList.remove("hidden");
      InspectorView.instance().displayReloadRequiredWarning(i18nString(UIStrings.oneOrMoreSettingsHaveChanged));
    }
  }
};
export const bindCheckbox = function(inputElement, setting) {
  const input = inputElement;
  function settingChanged() {
    if (input.checked !== setting.get()) {
      input.checked = setting.get();
    }
  }
  setting.addChangeListener(settingChanged);
  settingChanged();
  function inputChanged() {
    if (setting.get() !== input.checked) {
      setting.set(input.checked);
    }
  }
  input.addEventListener("change", inputChanged, false);
};
export const createCustomSetting = function(name, element) {
  const p = document.createElement("p");
  p.classList.add("settings-select");
  const label = p.createChild("label");
  label.textContent = name;
  ARIAUtils.bindLabelToControl(label, element);
  p.appendChild(element);
  return p;
};
export const createControlForSetting = function(setting, subtitle) {
  const uiTitle = setting.title();
  switch (setting.type()) {
    case Common.Settings.SettingType.BOOLEAN: {
      const component = new Settings.SettingCheckbox.SettingCheckbox();
      component.data = { setting };
      return component;
    }
    case Common.Settings.SettingType.ENUM:
      if (Array.isArray(setting.options())) {
        return createSettingSelect(uiTitle, setting.options(), setting.reloadRequired(), setting, subtitle);
      }
      console.error("Enum setting defined without options");
      return null;
    default:
      console.error("Invalid setting type: " + setting.type());
      return null;
  }
};
//# sourceMappingURL=SettingsUI.js.map
