import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { StartView } from "./LighthouseStartView.js";
import { Events } from "./LighthouseController.js";
const UIStrings = {
  generateLighthouseReport: "Generate a Lighthouse report",
  mode: "Mode",
  categories: "Categories",
  plugins: "Plugins",
  analyzeNavigation: "Analyze page load",
  analyzeSnapshot: "Analyze page state",
  startTimespan: "Start timespan"
};
const str_ = i18n.i18n.registerUIStrings("panels/lighthouse/LighthouseStartViewFR.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class StartViewFR extends StartView {
  changeFormMode;
  render() {
    this.populateRuntimeSettingAsToolbarCheckbox("lighthouse.legacy_navigation", this.settingsToolbarInternal);
    this.populateRuntimeSettingAsToolbarCheckbox("lighthouse.clear_storage", this.settingsToolbarInternal);
    this.populateRuntimeSettingAsToolbarDropdown("lighthouse.throttling", this.settingsToolbarInternal);
    const { mode } = this.controller.getFlags();
    this.populateStartButton(mode);
    const fragment = UI.Fragment.Fragment.build`
<form class="lighthouse-start-view-fr">
  <header class="hbox">
    <div class="lighthouse-logo"></div>
    <div class="lighthouse-title">${i18nString(UIStrings.generateLighthouseReport)}</div>
    <div class="lighthouse-start-button-container" $="start-button-container">${this.startButton}</div>
  </header>
  <div $="help-text" class="lighthouse-help-text hidden"></div>
  <div class="lighthouse-options hbox">
    <div class="lighthouse-form-section">
      <div class="lighthouse-form-elements" $="mode-form-elements"></div>
    </div>
    <div class="lighthouse-form-section">
      <div class="lighthouse-form-elements" $="device-type-form-elements"></div>
    </div>
    <div class="lighthouse-form-categories">
      <div class="lighthouse-form-section">
        <div class="lighthouse-form-section-label">${i18nString(UIStrings.categories)}</div>
        <div class="lighthouse-form-elements" $="categories-form-elements"></div>
      </div>
      <div class="lighthouse-form-section">
        <div class="lighthouse-form-section-label">
          <div class="lighthouse-icon-label">${i18nString(UIStrings.plugins)}</div>
        </div>
        <div class="lighthouse-form-elements" $="plugins-form-elements"></div>
      </div>
    </div>
  </div>
  <div $="warning-text" class="lighthouse-warning-text hidden"></div>
</form>
    `;
    this.helpText = fragment.$("help-text");
    this.warningText = fragment.$("warning-text");
    const modeFormElements = fragment.$("mode-form-elements");
    this.populateRuntimeSettingAsRadio("lighthouse.mode", i18nString(UIStrings.mode), modeFormElements);
    this.populateFormControls(fragment, mode);
    this.contentElement.textContent = "";
    this.contentElement.append(fragment.element());
    this.refresh();
  }
  populateStartButton(mode) {
    let buttonLabel;
    let callback;
    if (mode === "timespan") {
      buttonLabel = i18nString(UIStrings.startTimespan);
      callback = () => {
        this.controller.dispatchEventToListeners(Events.RequestLighthouseTimespanStart, this.startButton.matches(":focus-visible"));
      };
    } else if (mode === "snapshot") {
      buttonLabel = i18nString(UIStrings.analyzeSnapshot);
      callback = () => {
        this.controller.dispatchEventToListeners(Events.RequestLighthouseStart, this.startButton.matches(":focus-visible"));
      };
    } else {
      buttonLabel = i18nString(UIStrings.analyzeNavigation);
      callback = () => {
        this.controller.dispatchEventToListeners(Events.RequestLighthouseStart, this.startButton.matches(":focus-visible"));
      };
    }
    const startButtonContainer = this.contentElement.querySelector(".lighthouse-start-button-container");
    if (startButtonContainer) {
      startButtonContainer.textContent = "";
      this.startButton = UI.UIUtils.createTextButton(buttonLabel, callback, "", true);
      startButtonContainer.append(this.startButton);
    }
  }
  refresh() {
    const { mode } = this.controller.getFlags();
    this.populateStartButton(mode);
    for (const { checkbox, preset } of this.checkboxes) {
      if (preset.supportedModes.includes(mode)) {
        checkbox.setEnabled(true);
        checkbox.setIndeterminate(false);
      } else {
        checkbox.setEnabled(false);
        checkbox.setIndeterminate(true);
      }
    }
    this.onResize();
  }
  onResize() {
    const useNarrowLayout = this.contentElement.offsetWidth < 500;
    const useWideLayout = this.contentElement.offsetWidth > 800;
    const headerEl = this.contentElement.querySelector(".lighthouse-start-view-fr header");
    const optionsEl = this.contentElement.querySelector(".lighthouse-options");
    if (headerEl) {
      headerEl.classList.toggle("hbox", !useNarrowLayout);
      headerEl.classList.toggle("vbox", useNarrowLayout);
    }
    if (optionsEl) {
      optionsEl.classList.toggle("wide", useWideLayout);
      optionsEl.classList.toggle("narrow", useNarrowLayout);
    }
  }
}
//# sourceMappingURL=LighthouseStartViewFR.js.map
