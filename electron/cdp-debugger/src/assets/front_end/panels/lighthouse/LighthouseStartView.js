import lighthouseStartViewStyles from "./lighthouseStartView.css.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { Events, Presets, RuntimeSettings } from "./LighthouseController.js";
import { RadioSetting } from "./RadioSetting.js";
const UIStrings = {
  learnMore: "Learn more",
  device: "Device",
  categories: "Categories",
  communityPluginsBeta: "Community Plugins (beta)",
  generateReport: "Generate report",
  identifyAndFixCommonProblemsThat: "Identify and fix common problems that affect your site's performance, accessibility, and user experience."
};
const str_ = i18n.i18n.registerUIStrings("panels/lighthouse/LighthouseStartView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class StartView extends UI.Widget.Widget {
  controller;
  settingsToolbarInternal;
  startButton;
  helpText;
  warningText;
  checkboxes = [];
  shouldConfirm;
  constructor(controller) {
    super();
    this.controller = controller;
    this.settingsToolbarInternal = new UI.Toolbar.Toolbar("");
    this.render();
  }
  settingsToolbar() {
    return this.settingsToolbarInternal;
  }
  populateRuntimeSettingAsRadio(settingName, label, parentElement) {
    const runtimeSetting = RuntimeSettings.find((item) => item.setting.name === settingName);
    if (!runtimeSetting || !runtimeSetting.options) {
      throw new Error(`${settingName} is not a setting with options`);
    }
    const labelEl = document.createElement("div");
    labelEl.classList.add("lighthouse-form-section-label");
    labelEl.textContent = label;
    if (runtimeSetting.learnMore) {
      const link = UI.XLink.XLink.create(runtimeSetting.learnMore, i18nString(UIStrings.learnMore), "lighthouse-learn-more");
      labelEl.append(link);
    }
    parentElement.appendChild(labelEl);
    const control = new RadioSetting(runtimeSetting.options, runtimeSetting.setting, runtimeSetting.description());
    parentElement.appendChild(control.element);
    UI.ARIAUtils.setAccessibleName(control.element, label);
  }
  populateRuntimeSettingAsToolbarCheckbox(settingName, toolbar) {
    const runtimeSetting = RuntimeSettings.find((item) => item.setting.name === settingName);
    if (!runtimeSetting || !runtimeSetting.title) {
      throw new Error(`${settingName} is not a setting with a title`);
    }
    runtimeSetting.setting.setTitle(runtimeSetting.title());
    const control = new UI.Toolbar.ToolbarSettingCheckbox(runtimeSetting.setting, runtimeSetting.description());
    toolbar.appendToolbarItem(control);
    if (runtimeSetting.learnMore) {
      const link = UI.XLink.XLink.create(runtimeSetting.learnMore, i18nString(UIStrings.learnMore), "lighthouse-learn-more");
      link.style.padding = "5px";
      control.element.appendChild(link);
    }
  }
  populateRuntimeSettingAsToolbarDropdown(settingName, toolbar) {
    const runtimeSetting = RuntimeSettings.find((item) => item.setting.name === settingName);
    if (!runtimeSetting || !runtimeSetting.title) {
      throw new Error(`${settingName} is not a setting with a title`);
    }
    const options = runtimeSetting.options?.map((option) => ({ label: option.label(), value: option.value })) || [];
    runtimeSetting.setting.setTitle(runtimeSetting.title());
    const control = new UI.Toolbar.ToolbarSettingComboBox(options, runtimeSetting.setting, runtimeSetting.title());
    control.setTitle(runtimeSetting.description());
    toolbar.appendToolbarItem(control);
    if (runtimeSetting.learnMore) {
      const link = UI.XLink.XLink.create(runtimeSetting.learnMore, i18nString(UIStrings.learnMore), "lighthouse-learn-more");
      link.style.padding = "5px";
      control.element.appendChild(link);
    }
  }
  populateFormControls(fragment, mode) {
    const deviceTypeFormElements = fragment.$("device-type-form-elements");
    this.populateRuntimeSettingAsRadio("lighthouse.device_type", i18nString(UIStrings.device), deviceTypeFormElements);
    const categoryFormElements = fragment.$("categories-form-elements");
    const pluginFormElements = fragment.$("plugins-form-elements");
    this.checkboxes = [];
    for (const preset of Presets) {
      const formElements = preset.plugin ? pluginFormElements : categoryFormElements;
      preset.setting.setTitle(preset.title());
      const checkbox = new UI.Toolbar.ToolbarSettingCheckbox(preset.setting, preset.description());
      const row = formElements.createChild("div", "vbox lighthouse-launcher-row");
      row.appendChild(checkbox.element);
      this.checkboxes.push({ preset, checkbox });
      if (mode && !preset.supportedModes.includes(mode)) {
        checkbox.setEnabled(false);
        checkbox.setIndeterminate(true);
      }
    }
    UI.ARIAUtils.markAsGroup(categoryFormElements);
    UI.ARIAUtils.setAccessibleName(categoryFormElements, i18nString(UIStrings.categories));
    UI.ARIAUtils.markAsGroup(pluginFormElements);
    UI.ARIAUtils.setAccessibleName(pluginFormElements, i18nString(UIStrings.communityPluginsBeta));
  }
  render() {
    this.populateRuntimeSettingAsToolbarCheckbox("lighthouse.legacy_navigation", this.settingsToolbarInternal);
    this.populateRuntimeSettingAsToolbarCheckbox("lighthouse.clear_storage", this.settingsToolbarInternal);
    this.populateRuntimeSettingAsToolbarDropdown("lighthouse.throttling", this.settingsToolbarInternal);
    this.startButton = UI.UIUtils.createTextButton(i18nString(UIStrings.generateReport), () => this.controller.dispatchEventToListeners(Events.RequestLighthouseStart, this.startButton.matches(":focus-visible")), "", true);
    this.setDefaultFocusedElement(this.startButton);
    const auditsDescription = i18nString(UIStrings.identifyAndFixCommonProblemsThat);
    const fragment = UI.Fragment.Fragment.build`
  <div class="vbox lighthouse-start-view">
  <header>
  <div class="lighthouse-logo"></div>
  <div class="lighthouse-start-button-container hbox">
  ${this.startButton}
  </div>
  <div $="help-text" class="lighthouse-help-text hidden"></div>
  <div class="lighthouse-start-view-text">
  <span>${auditsDescription}</span>
  ${UI.XLink.XLink.create("https://developers.google.com/web/tools/lighthouse/", i18nString(UIStrings.learnMore))}
  </div>
  <div $="warning-text" class="lighthouse-warning-text hidden"></div>
  </header>
  <form>
  <div class="lighthouse-form-categories">
  <div class="lighthouse-form-section">
  <div class="lighthouse-form-section-label">
  ${i18nString(UIStrings.categories)}
  </div>
  <div class="lighthouse-form-elements" $="categories-form-elements"></div>
  </div>
  <div class="lighthouse-form-section">
  <div class="lighthouse-form-section-label">
  <div class="lighthouse-icon-label">${i18nString(UIStrings.communityPluginsBeta)}</div>
  </div>
  <div class="lighthouse-form-elements" $="plugins-form-elements"></div>
  </div>
  </div>
  <div class="lighthouse-form-section">
  <div class="lighthouse-form-elements" $="device-type-form-elements"></div>
  </div>
  </form>
  </div>
  `;
    this.helpText = fragment.$("help-text");
    this.warningText = fragment.$("warning-text");
    this.populateFormControls(fragment);
    this.contentElement.appendChild(fragment.element());
    this.contentElement.style.overflow = "auto";
  }
  refresh() {
  }
  onResize() {
    const useNarrowLayout = this.contentElement.offsetWidth < 560;
    const startViewEl = this.contentElement.querySelector(".lighthouse-start-view");
    if (!startViewEl) {
      return;
    }
    startViewEl.classList.toggle("hbox", !useNarrowLayout);
    startViewEl.classList.toggle("vbox", useNarrowLayout);
  }
  focusStartButton() {
    this.startButton.focus();
  }
  setStartButtonEnabled(isEnabled) {
    if (this.helpText) {
      this.helpText.classList.toggle("hidden", isEnabled);
    }
    if (this.startButton) {
      this.startButton.disabled = !isEnabled;
    }
  }
  setUnauditableExplanation(text) {
    if (this.helpText) {
      this.helpText.textContent = text;
    }
  }
  setWarningText(text) {
    if (this.warningText) {
      this.warningText.textContent = text;
      this.warningText.classList.toggle("hidden", !text);
      this.shouldConfirm = Boolean(text);
    }
  }
  wasShown() {
    super.wasShown();
    this.controller.recomputePageAuditability();
    this.registerCSSFiles([lighthouseStartViewStyles]);
  }
}
//# sourceMappingURL=LighthouseStartView.js.map
