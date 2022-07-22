import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as ARIAUtils from "./ARIAUtils.js";
import { Icon } from "./Icon.js";
import { KeyboardShortcut, Modifiers } from "./KeyboardShortcut.js";
import { bindCheckbox } from "./SettingsUI.js";
import { Events, TextPrompt } from "./TextPrompt.js";
import { ToolbarSettingToggle } from "./Toolbar.js";
import { Tooltip } from "./Tooltip.js";
import { CheckboxLabel, createTextChild } from "./UIUtils.js";
import { HBox } from "./Widget.js";
import filterStyles from "./filter.css.legacy.js";
const UIStrings = {
  filter: "Filter",
  egSmalldUrlacomb: "e.g. `/small[d]+/ url:a.com/b`",
  sclickToSelectMultipleTypes: "{PH1}Click to select multiple types",
  allStrings: "All",
  clearFilter: "Clear input"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/FilterBar.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class FilterBar extends Common.ObjectWrapper.eventMixin(HBox) {
  enabled;
  stateSetting;
  filterButtonInternal;
  filters;
  alwaysShowFilters;
  showingWidget;
  constructor(name, visibleByDefault) {
    super();
    this.registerRequiredCSS(filterStyles);
    this.enabled = true;
    this.element.classList.add("filter-bar");
    this.stateSetting = Common.Settings.Settings.instance().createSetting("filterBar-" + name + "-toggled", Boolean(visibleByDefault));
    this.filterButtonInternal = new ToolbarSettingToggle(this.stateSetting, "largeicon-filter", i18nString(UIStrings.filter));
    this.filters = [];
    this.updateFilterBar();
    this.stateSetting.addChangeListener(this.updateFilterBar.bind(this));
  }
  filterButton() {
    return this.filterButtonInternal;
  }
  addFilter(filter) {
    this.filters.push(filter);
    this.element.appendChild(filter.element());
    filter.addEventListener(FilterUIEvents.FilterChanged, this.filterChanged, this);
    this.updateFilterButton();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    this.filterButtonInternal.setEnabled(enabled);
    this.updateFilterBar();
  }
  forceShowFilterBar() {
    this.alwaysShowFilters = true;
    this.updateFilterBar();
  }
  showOnce() {
    this.stateSetting.set(true);
  }
  filterChanged() {
    this.updateFilterButton();
    this.dispatchEventToListeners(FilterBarEvents.Changed);
  }
  wasShown() {
    super.wasShown();
    this.updateFilterBar();
  }
  updateFilterBar() {
    if (!this.parentWidget() || this.showingWidget) {
      return;
    }
    if (this.visible()) {
      this.showingWidget = true;
      this.showWidget();
      this.showingWidget = false;
    } else {
      this.hideWidget();
    }
  }
  focus() {
    for (let i = 0; i < this.filters.length; ++i) {
      if (this.filters[i] instanceof TextFilterUI) {
        const textFilterUI = this.filters[i];
        textFilterUI.focus();
        break;
      }
    }
  }
  updateFilterButton() {
    let isActive = false;
    for (const filter of this.filters) {
      isActive = isActive || filter.isActive();
    }
    this.filterButtonInternal.setDefaultWithRedColor(isActive);
    this.filterButtonInternal.setToggleWithRedColor(isActive);
  }
  clear() {
    this.element.removeChildren();
    this.filters = [];
    this.updateFilterButton();
  }
  setting() {
    return this.stateSetting;
  }
  visible() {
    return this.alwaysShowFilters || this.stateSetting.get() && this.enabled;
  }
}
export var FilterBarEvents = /* @__PURE__ */ ((FilterBarEvents2) => {
  FilterBarEvents2["Changed"] = "Changed";
  return FilterBarEvents2;
})(FilterBarEvents || {});
export var FilterUIEvents = /* @__PURE__ */ ((FilterUIEvents2) => {
  FilterUIEvents2["FilterChanged"] = "FilterChanged";
  return FilterUIEvents2;
})(FilterUIEvents || {});
export class TextFilterUI extends Common.ObjectWrapper.ObjectWrapper {
  filterElement;
  filterInputElement;
  prompt;
  proxyElement;
  suggestionProvider;
  constructor() {
    super();
    this.filterElement = document.createElement("div");
    this.filterElement.className = "filter-text-filter";
    const container = this.filterElement.createChild("div", "filter-input-container");
    this.filterInputElement = container.createChild("span", "filter-input-field");
    this.prompt = new TextPrompt();
    this.prompt.initialize(this.completions.bind(this), " ", true);
    this.proxyElement = this.prompt.attach(this.filterInputElement);
    Tooltip.install(this.proxyElement, i18nString(UIStrings.egSmalldUrlacomb));
    this.prompt.setPlaceholder(i18nString(UIStrings.filter));
    this.prompt.addEventListener(Events.TextChanged, this.valueChanged.bind(this));
    this.suggestionProvider = null;
    const clearButton = container.createChild("div", "filter-input-clear-button");
    Tooltip.install(clearButton, i18nString(UIStrings.clearFilter));
    clearButton.appendChild(Icon.create("mediumicon-gray-cross-active", "filter-cancel-button"));
    clearButton.addEventListener("click", () => {
      this.clear();
      this.focus();
    });
    this.updateEmptyStyles();
  }
  completions(expression, prefix, force) {
    if (this.suggestionProvider) {
      return this.suggestionProvider(expression, prefix, force);
    }
    return Promise.resolve([]);
  }
  isActive() {
    return Boolean(this.prompt.text());
  }
  element() {
    return this.filterElement;
  }
  value() {
    return this.prompt.textWithCurrentSuggestion();
  }
  setValue(value) {
    this.prompt.setText(value);
    this.valueChanged();
  }
  focus() {
    this.filterInputElement.focus();
  }
  setSuggestionProvider(suggestionProvider) {
    this.prompt.clearAutocomplete();
    this.suggestionProvider = suggestionProvider;
  }
  valueChanged() {
    this.dispatchEventToListeners("FilterChanged" /* FilterChanged */);
    this.updateEmptyStyles();
  }
  updateEmptyStyles() {
    this.filterElement.classList.toggle("filter-text-empty", !this.prompt.text());
  }
  clear() {
    this.setValue("");
  }
}
export class NamedBitSetFilterUI extends Common.ObjectWrapper.ObjectWrapper {
  filtersElement;
  typeFilterElementTypeNames;
  allowedTypes;
  typeFilterElements;
  setting;
  constructor(items, setting) {
    super();
    this.filtersElement = document.createElement("div");
    this.filtersElement.classList.add("filter-bitset-filter");
    ARIAUtils.markAsListBox(this.filtersElement);
    ARIAUtils.markAsMultiSelectable(this.filtersElement);
    Tooltip.install(this.filtersElement, i18nString(UIStrings.sclickToSelectMultipleTypes, {
      PH1: KeyboardShortcut.shortcutToString("", Modifiers.CtrlOrMeta)
    }));
    this.typeFilterElementTypeNames = /* @__PURE__ */ new WeakMap();
    this.allowedTypes = /* @__PURE__ */ new Set();
    this.typeFilterElements = [];
    this.addBit(NamedBitSetFilterUI.ALL_TYPES, i18nString(UIStrings.allStrings));
    this.typeFilterElements[0].tabIndex = 0;
    this.filtersElement.createChild("div", "filter-bitset-filter-divider");
    for (let i = 0; i < items.length; ++i) {
      this.addBit(items[i].name, items[i].label(), items[i].title);
    }
    if (setting) {
      this.setting = setting;
      setting.addChangeListener(this.settingChanged.bind(this));
      this.settingChanged();
    } else {
      this.toggleTypeFilter(NamedBitSetFilterUI.ALL_TYPES, false);
    }
  }
  reset() {
    this.toggleTypeFilter(NamedBitSetFilterUI.ALL_TYPES, false);
  }
  isActive() {
    return !this.allowedTypes.has(NamedBitSetFilterUI.ALL_TYPES);
  }
  element() {
    return this.filtersElement;
  }
  accept(typeName) {
    return this.allowedTypes.has(NamedBitSetFilterUI.ALL_TYPES) || this.allowedTypes.has(typeName);
  }
  settingChanged() {
    const allowedTypesFromSetting = this.setting.get();
    this.allowedTypes = /* @__PURE__ */ new Set();
    for (const element of this.typeFilterElements) {
      const typeName = this.typeFilterElementTypeNames.get(element);
      if (typeName && allowedTypesFromSetting[typeName]) {
        this.allowedTypes.add(typeName);
      }
    }
    this.update();
  }
  update() {
    if (this.allowedTypes.size === 0 || this.allowedTypes.has(NamedBitSetFilterUI.ALL_TYPES)) {
      this.allowedTypes = /* @__PURE__ */ new Set();
      this.allowedTypes.add(NamedBitSetFilterUI.ALL_TYPES);
    }
    for (const element of this.typeFilterElements) {
      const typeName = this.typeFilterElementTypeNames.get(element);
      const active = this.allowedTypes.has(typeName || "");
      element.classList.toggle("selected", active);
      ARIAUtils.setSelected(element, active);
    }
    this.dispatchEventToListeners("FilterChanged" /* FilterChanged */);
  }
  addBit(name, label, title) {
    const typeFilterElement = this.filtersElement.createChild("span", name);
    typeFilterElement.tabIndex = -1;
    this.typeFilterElementTypeNames.set(typeFilterElement, name);
    createTextChild(typeFilterElement, label);
    ARIAUtils.markAsOption(typeFilterElement);
    if (title) {
      typeFilterElement.title = title;
    }
    typeFilterElement.addEventListener("click", this.onTypeFilterClicked.bind(this), false);
    typeFilterElement.addEventListener("keydown", this.onTypeFilterKeydown.bind(this), false);
    this.typeFilterElements.push(typeFilterElement);
  }
  onTypeFilterClicked(event) {
    const e = event;
    let toggle;
    if (Host.Platform.isMac()) {
      toggle = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
    } else {
      toggle = e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
    }
    if (e.target) {
      const element = e.target;
      const typeName = this.typeFilterElementTypeNames.get(element);
      this.toggleTypeFilter(typeName, toggle);
    }
  }
  onTypeFilterKeydown(ev) {
    const event = ev;
    const element = event.target;
    if (!element) {
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      if (this.keyFocusNextBit(element, true)) {
        event.consume(true);
      }
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      if (this.keyFocusNextBit(element, false)) {
        event.consume(true);
      }
    } else if (isEnterOrSpaceKey(event)) {
      this.onTypeFilterClicked(event);
    }
  }
  keyFocusNextBit(target, selectPrevious) {
    const index = this.typeFilterElements.indexOf(target);
    if (index === -1) {
      return false;
    }
    const nextIndex = selectPrevious ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= this.typeFilterElements.length) {
      return false;
    }
    const nextElement = this.typeFilterElements[nextIndex];
    nextElement.tabIndex = 0;
    target.tabIndex = -1;
    nextElement.focus();
    return true;
  }
  toggleTypeFilter(typeName, allowMultiSelect) {
    if (allowMultiSelect && typeName !== NamedBitSetFilterUI.ALL_TYPES) {
      this.allowedTypes.delete(NamedBitSetFilterUI.ALL_TYPES);
    } else {
      this.allowedTypes = /* @__PURE__ */ new Set();
    }
    if (this.allowedTypes.has(typeName)) {
      this.allowedTypes.delete(typeName);
    } else {
      this.allowedTypes.add(typeName);
    }
    if (this.setting) {
      const updatedSetting = {};
      for (const type of this.allowedTypes) {
        updatedSetting[type] = true;
      }
      this.setting.set(updatedSetting);
    } else {
      this.update();
    }
  }
  static ALL_TYPES = "all";
}
export class CheckboxFilterUI extends Common.ObjectWrapper.ObjectWrapper {
  filterElement;
  activeWhenChecked;
  label;
  checkboxElement;
  constructor(className, title, activeWhenChecked, setting) {
    super();
    this.filterElement = document.createElement("div");
    this.filterElement.classList.add("filter-checkbox-filter");
    this.activeWhenChecked = Boolean(activeWhenChecked);
    this.label = CheckboxLabel.create(title);
    this.filterElement.appendChild(this.label);
    this.checkboxElement = this.label.checkboxElement;
    if (setting) {
      bindCheckbox(this.checkboxElement, setting);
    } else {
      this.checkboxElement.checked = true;
    }
    this.checkboxElement.addEventListener("change", this.fireUpdated.bind(this), false);
  }
  isActive() {
    return this.activeWhenChecked === this.checkboxElement.checked;
  }
  checked() {
    return this.checkboxElement.checked;
  }
  setChecked(checked) {
    this.checkboxElement.checked = checked;
  }
  element() {
    return this.filterElement;
  }
  labelElement() {
    return this.label;
  }
  fireUpdated() {
    this.dispatchEventToListeners("FilterChanged" /* FilterChanged */);
  }
  setColor(backgroundColor, borderColor) {
    this.label.backgroundColor = backgroundColor;
    this.label.borderColor = borderColor;
  }
}
//# sourceMappingURL=FilterBar.js.map
