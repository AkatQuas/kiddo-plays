import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { IsolateSelector } from "./IsolateSelector.js";
import profileLauncherViewStyles from "./profileLauncherView.css.js";
const UIStrings = {
  selectJavascriptVmInstance: "Select JavaScript VM instance",
  load: "Load",
  takeSnapshot: "Take snapshot",
  stop: "Stop",
  start: "Start",
  selectProfilingType: "Select profiling type"
};
const str_ = i18n.i18n.registerUIStrings("panels/profiler/ProfileLauncherView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ProfileLauncherView extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
  panel;
  contentElementInternal;
  selectedProfileTypeSetting;
  profileTypeHeaderElement;
  profileTypeSelectorForm;
  controlButton;
  loadButton;
  recordButtonEnabled;
  typeIdToOptionElementAndProfileType;
  isProfiling;
  isInstantProfile;
  isEnabled;
  constructor(profilesPanel) {
    super();
    this.panel = profilesPanel;
    this.element.classList.add("profile-launcher-view");
    this.contentElementInternal = this.element.createChild("div", "profile-launcher-view-content vbox");
    const profileTypeSelectorElement = this.contentElementInternal.createChild("div", "vbox");
    this.selectedProfileTypeSetting = Common.Settings.Settings.instance().createSetting("selectedProfileType", "CPU");
    this.profileTypeHeaderElement = profileTypeSelectorElement.createChild("h1");
    this.profileTypeSelectorForm = profileTypeSelectorElement.createChild("form");
    UI.ARIAUtils.markAsRadioGroup(this.profileTypeSelectorForm);
    const isolateSelectorElement = this.contentElementInternal.createChild("div", "vbox profile-isolate-selector-block");
    isolateSelectorElement.createChild("h1").textContent = i18nString(UIStrings.selectJavascriptVmInstance);
    const isolateSelector = new IsolateSelector();
    const isolateSelectorElementChild = isolateSelectorElement.createChild("div", "vbox profile-launcher-target-list");
    isolateSelectorElementChild.classList.add("profile-launcher-target-list-container");
    isolateSelector.show(isolateSelectorElementChild);
    isolateSelectorElement.appendChild(isolateSelector.totalMemoryElement());
    const buttonsDiv = this.contentElementInternal.createChild("div", "hbox profile-launcher-buttons");
    this.controlButton = UI.UIUtils.createTextButton("", this.controlButtonClicked.bind(this), "", true);
    this.loadButton = UI.UIUtils.createTextButton(i18nString(UIStrings.load), this.loadButtonClicked.bind(this), "");
    buttonsDiv.appendChild(this.controlButton);
    buttonsDiv.appendChild(this.loadButton);
    this.recordButtonEnabled = true;
    this.typeIdToOptionElementAndProfileType = /* @__PURE__ */ new Map();
  }
  loadButtonClicked() {
    this.panel.showLoadFromFileDialog();
  }
  updateControls() {
    if (this.isEnabled && this.recordButtonEnabled) {
      this.controlButton.removeAttribute("disabled");
    } else {
      this.controlButton.setAttribute("disabled", "");
    }
    UI.Tooltip.Tooltip.install(this.controlButton, this.recordButtonEnabled ? "" : UI.UIUtils.anotherProfilerActiveLabel());
    if (this.isInstantProfile) {
      this.controlButton.classList.remove("running");
      this.controlButton.classList.add("primary-button");
      this.controlButton.textContent = i18nString(UIStrings.takeSnapshot);
    } else if (this.isProfiling) {
      this.controlButton.classList.add("running");
      this.controlButton.classList.remove("primary-button");
      this.controlButton.textContent = i18nString(UIStrings.stop);
    } else {
      this.controlButton.classList.remove("running");
      this.controlButton.classList.add("primary-button");
      this.controlButton.textContent = i18nString(UIStrings.start);
    }
    for (const { optionElement } of this.typeIdToOptionElementAndProfileType.values()) {
      optionElement.disabled = Boolean(this.isProfiling);
    }
  }
  profileStarted() {
    this.isProfiling = true;
    this.updateControls();
  }
  profileFinished() {
    this.isProfiling = false;
    this.updateControls();
  }
  updateProfileType(profileType, recordButtonEnabled) {
    this.isInstantProfile = profileType.isInstantProfile();
    this.recordButtonEnabled = recordButtonEnabled;
    this.isEnabled = profileType.isEnabled();
    this.updateControls();
  }
  addProfileType(profileType) {
    const labelElement = UI.UIUtils.createRadioLabel("profile-type", profileType.name);
    this.profileTypeSelectorForm.appendChild(labelElement);
    const optionElement = labelElement.radioElement;
    this.typeIdToOptionElementAndProfileType.set(profileType.id, { optionElement, profileType });
    optionElement.addEventListener("change", this.profileTypeChanged.bind(this, profileType), false);
    const descriptionElement = this.profileTypeSelectorForm.createChild("p");
    descriptionElement.textContent = profileType.description;
    UI.ARIAUtils.setDescription(optionElement, profileType.description);
    const customContent = profileType.customContent();
    if (customContent) {
      this.profileTypeSelectorForm.createChild("p").appendChild(customContent);
      profileType.setCustomContentEnabled(false);
    }
    const headerText = this.typeIdToOptionElementAndProfileType.size > 1 ? i18nString(UIStrings.selectProfilingType) : profileType.name;
    this.profileTypeHeaderElement.textContent = headerText;
    UI.ARIAUtils.setAccessibleName(this.profileTypeSelectorForm, headerText);
  }
  restoreSelectedProfileType() {
    let typeId = this.selectedProfileTypeSetting.get();
    if (!this.typeIdToOptionElementAndProfileType.has(typeId)) {
      typeId = this.typeIdToOptionElementAndProfileType.keys().next().value;
      this.selectedProfileTypeSetting.set(typeId);
    }
    const optionElementAndProfileType = this.typeIdToOptionElementAndProfileType.get(typeId);
    optionElementAndProfileType.optionElement.checked = true;
    const type = optionElementAndProfileType.profileType;
    for (const [id, { profileType }] of this.typeIdToOptionElementAndProfileType) {
      const enabled = id === typeId;
      profileType.setCustomContentEnabled(enabled);
    }
    this.dispatchEventToListeners(Events.ProfileTypeSelected, type);
  }
  controlButtonClicked() {
    this.panel.toggleRecord();
  }
  profileTypeChanged(profileType) {
    const typeId = this.selectedProfileTypeSetting.get();
    const type = this.typeIdToOptionElementAndProfileType.get(typeId).profileType;
    type.setCustomContentEnabled(false);
    profileType.setCustomContentEnabled(true);
    this.dispatchEventToListeners(Events.ProfileTypeSelected, profileType);
    this.isInstantProfile = profileType.isInstantProfile();
    this.isEnabled = profileType.isEnabled();
    this.updateControls();
    this.selectedProfileTypeSetting.set(profileType.id);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([profileLauncherViewStyles]);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ProfileTypeSelected"] = "ProfileTypeSelected";
  return Events2;
})(Events || {});
//# sourceMappingURL=ProfileLauncherView.js.map
