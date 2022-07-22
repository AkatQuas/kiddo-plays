import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import frameworkIgnoreListSettingsTabStyles from "./frameworkIgnoreListSettingsTab.css.js";
const UIStrings = {
  frameworkIgnoreList: "Framework Ignore List",
  debuggerWillSkipThroughThe: "Debugger will skip through the scripts and will not stop on exceptions thrown by them.",
  ignoreListContentScripts: "Add content scripts to ignore list",
  ignoreListContentScriptsExtension: "Add content scripts to ignore list (extension scripts in the page)",
  ignoreList: "Ignore List",
  disabled: "Disabled",
  noIgnoreListPatterns: "No ignore list patterns",
  addPattern: "Add pattern...",
  addFilenamePattern: "Add filename pattern",
  ignoreScriptsWhoseNamesMatchS: "Ignore scripts whose names match ''{PH1}''",
  pattern: "Pattern",
  behavior: "Behavior",
  patternCannotBeEmpty: "Pattern cannot be empty",
  patternAlreadyExists: "Pattern already exists",
  patternMustBeAValidRegular: "Pattern must be a valid regular expression"
};
const str_ = i18n.i18n.registerUIStrings("panels/settings/FrameworkIgnoreListSettingsTab.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let frameworkIgnoreListSettingsTabInstance;
export class FrameworkIgnoreListSettingsTab extends UI.Widget.VBox {
  ignoreListLabel;
  disabledLabel;
  list;
  setting;
  editor;
  constructor() {
    super(true);
    const header = this.contentElement.createChild("div", "header");
    header.textContent = i18nString(UIStrings.frameworkIgnoreList);
    UI.ARIAUtils.markAsHeading(header, 1);
    this.contentElement.createChild("div", "intro").textContent = i18nString(UIStrings.debuggerWillSkipThroughThe);
    const ignoreListContentScripts = this.contentElement.createChild("div", "ignore-list-content-scripts");
    ignoreListContentScripts.appendChild(UI.SettingsUI.createSettingCheckbox(i18nString(UIStrings.ignoreListContentScripts), Common.Settings.Settings.instance().moduleSetting("skipContentScripts"), true));
    UI.Tooltip.Tooltip.install(ignoreListContentScripts, i18nString(UIStrings.ignoreListContentScriptsExtension));
    this.ignoreListLabel = i18nString(UIStrings.ignoreList);
    this.disabledLabel = i18nString(UIStrings.disabled);
    this.list = new UI.ListWidget.ListWidget(this);
    this.list.element.classList.add("ignore-list");
    const placeholder = document.createElement("div");
    placeholder.classList.add("ignore-list-empty");
    placeholder.textContent = i18nString(UIStrings.noIgnoreListPatterns);
    this.list.setEmptyPlaceholder(placeholder);
    this.list.show(this.contentElement);
    const addPatternButton = UI.UIUtils.createTextButton(i18nString(UIStrings.addPattern), this.addButtonClicked.bind(this), "add-button");
    UI.ARIAUtils.setAccessibleName(addPatternButton, i18nString(UIStrings.addFilenamePattern));
    this.contentElement.appendChild(addPatternButton);
    this.setting = Common.Settings.Settings.instance().moduleSetting("skipStackFramesPattern");
    this.setting.addChangeListener(this.settingUpdated, this);
    this.setDefaultFocusedElement(addPatternButton);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!frameworkIgnoreListSettingsTabInstance || forceNew) {
      frameworkIgnoreListSettingsTabInstance = new FrameworkIgnoreListSettingsTab();
    }
    return frameworkIgnoreListSettingsTabInstance;
  }
  wasShown() {
    super.wasShown();
    this.list.registerCSSFiles([frameworkIgnoreListSettingsTabStyles]);
    this.registerCSSFiles([frameworkIgnoreListSettingsTabStyles]);
    this.settingUpdated();
  }
  settingUpdated() {
    this.list.clear();
    const patterns = this.setting.getAsArray();
    for (let i = 0; i < patterns.length; ++i) {
      this.list.appendItem(patterns[i], true);
    }
  }
  addButtonClicked() {
    this.list.addNewItem(this.setting.getAsArray().length, { pattern: "", disabled: false });
  }
  renderItem(item, _editable) {
    const element = document.createElement("div");
    element.classList.add("ignore-list-item");
    const pattern = element.createChild("div", "ignore-list-pattern");
    pattern.textContent = item.pattern;
    UI.Tooltip.Tooltip.install(pattern, i18nString(UIStrings.ignoreScriptsWhoseNamesMatchS, { PH1: item.pattern }));
    element.createChild("div", "ignore-list-separator");
    element.createChild("div", "ignore-list-behavior").textContent = item.disabled ? this.disabledLabel : this.ignoreListLabel;
    if (item.disabled) {
      element.classList.add("ignore-list-disabled");
    }
    return element;
  }
  removeItemRequested(item, index) {
    const patterns = this.setting.getAsArray();
    patterns.splice(index, 1);
    this.setting.setAsArray(patterns);
  }
  commitEdit(item, editor, isNew) {
    item.pattern = editor.control("pattern").value.trim();
    item.disabled = editor.control("behavior").value === this.disabledLabel;
    const list = this.setting.getAsArray();
    if (isNew) {
      list.push(item);
    }
    this.setting.setAsArray(list);
  }
  beginEdit(item) {
    const editor = this.createEditor();
    editor.control("pattern").value = item.pattern;
    editor.control("behavior").value = item.disabled ? this.disabledLabel : this.ignoreListLabel;
    return editor;
  }
  createEditor() {
    if (this.editor) {
      return this.editor;
    }
    const editor = new UI.ListWidget.Editor();
    this.editor = editor;
    const content = editor.contentElement();
    const titles = content.createChild("div", "ignore-list-edit-row");
    titles.createChild("div", "ignore-list-pattern").textContent = i18nString(UIStrings.pattern);
    titles.createChild("div", "ignore-list-separator ignore-list-separator-invisible");
    titles.createChild("div", "ignore-list-behavior").textContent = i18nString(UIStrings.behavior);
    const fields = content.createChild("div", "ignore-list-edit-row");
    const pattern = editor.createInput("pattern", "text", "/framework\\.js$", patternValidator.bind(this));
    UI.ARIAUtils.setAccessibleName(pattern, i18nString(UIStrings.pattern));
    fields.createChild("div", "ignore-list-pattern").appendChild(pattern);
    fields.createChild("div", "ignore-list-separator ignore-list-separator-invisible");
    const behavior = editor.createSelect("behavior", [this.ignoreListLabel, this.disabledLabel], behaviorValidator);
    UI.ARIAUtils.setAccessibleName(behavior, i18nString(UIStrings.behavior));
    fields.createChild("div", "ignore-list-behavior").appendChild(behavior);
    return editor;
    function patternValidator(item, index, input) {
      const pattern2 = input.value.trim();
      const patterns = this.setting.getAsArray();
      if (!pattern2.length) {
        return { valid: false, errorMessage: i18nString(UIStrings.patternCannotBeEmpty) };
      }
      for (let i = 0; i < patterns.length; ++i) {
        if (i !== index && patterns[i].pattern === pattern2) {
          return { valid: false, errorMessage: i18nString(UIStrings.patternAlreadyExists) };
        }
      }
      let regex;
      try {
        regex = new RegExp(pattern2);
      } catch (e) {
      }
      if (!regex) {
        return { valid: false, errorMessage: i18nString(UIStrings.patternMustBeAValidRegular) };
      }
      return { valid: true, errorMessage: void 0 };
    }
    function behaviorValidator(_item, _index, _input) {
      return { valid: true, errorMessage: void 0 };
    }
  }
}
//# sourceMappingURL=FrameworkIgnoreListSettingsTab.js.map
