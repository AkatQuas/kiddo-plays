import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import playerMessagesViewStyles from "./playerMessagesView.css.js";
const UIStrings = {
  default: "Default",
  custom: "Custom",
  all: "All",
  error: "Error",
  warning: "Warning",
  info: "Info",
  debug: "Debug",
  logLevel: "Log level:",
  filterLogMessages: "Filter log messages"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/PlayerMessagesView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
var MessageLevelBitfield = /* @__PURE__ */ ((MessageLevelBitfield2) => {
  MessageLevelBitfield2[MessageLevelBitfield2["Error"] = 1] = "Error";
  MessageLevelBitfield2[MessageLevelBitfield2["Warning"] = 2] = "Warning";
  MessageLevelBitfield2[MessageLevelBitfield2["Info"] = 4] = "Info";
  MessageLevelBitfield2[MessageLevelBitfield2["Debug"] = 8] = "Debug";
  MessageLevelBitfield2[MessageLevelBitfield2["Default"] = 7] = "Default";
  MessageLevelBitfield2[MessageLevelBitfield2["All"] = 15] = "All";
  MessageLevelBitfield2[MessageLevelBitfield2["Custom"] = 0] = "Custom";
  return MessageLevelBitfield2;
})(MessageLevelBitfield || {});
class MessageLevelSelector {
  items;
  view;
  itemMap;
  hiddenLevels;
  bitFieldValue;
  savedBitFieldValue;
  defaultTitleInternal;
  customTitle;
  allTitle;
  elementsForItems;
  constructor(items, view) {
    this.items = items;
    this.view = view;
    this.itemMap = /* @__PURE__ */ new Map();
    this.hiddenLevels = [];
    this.bitFieldValue = 7 /* Default */;
    this.savedBitFieldValue = 7 /* Default */;
    this.defaultTitleInternal = i18nString(UIStrings.default);
    this.customTitle = i18nString(UIStrings.custom);
    this.allTitle = i18nString(UIStrings.all);
    this.elementsForItems = /* @__PURE__ */ new WeakMap();
  }
  defaultTitle() {
    return this.defaultTitleInternal;
  }
  setDefault(dropdown) {
    dropdown.selectItem(this.items.at(0));
  }
  populate() {
    this.items.insert(this.items.length, {
      title: this.defaultTitleInternal,
      overwrite: true,
      stringValue: "",
      value: 7 /* Default */,
      selectable: void 0
    });
    this.items.insert(this.items.length, {
      title: this.allTitle,
      overwrite: true,
      stringValue: "",
      value: 15 /* All */,
      selectable: void 0
    });
    this.items.insert(this.items.length, {
      title: i18nString(UIStrings.error),
      overwrite: false,
      stringValue: "error",
      value: 1 /* Error */,
      selectable: void 0
    });
    this.items.insert(this.items.length, {
      title: i18nString(UIStrings.warning),
      overwrite: false,
      stringValue: "warning",
      value: 2 /* Warning */,
      selectable: void 0
    });
    this.items.insert(this.items.length, {
      title: i18nString(UIStrings.info),
      overwrite: false,
      stringValue: "info",
      value: 4 /* Info */,
      selectable: void 0
    });
    this.items.insert(this.items.length, {
      title: i18nString(UIStrings.debug),
      overwrite: false,
      stringValue: "debug",
      value: 8 /* Debug */,
      selectable: void 0
    });
  }
  updateCheckMarks() {
    this.hiddenLevels = [];
    for (const [key, item] of this.itemMap) {
      if (!item.overwrite) {
        const elementForItem = this.elementsForItems.get(item);
        if (elementForItem && elementForItem.firstChild) {
          elementForItem.firstChild.remove();
        }
        if (elementForItem && key & this.bitFieldValue) {
          UI.UIUtils.createTextChild(elementForItem.createChild("div"), "\u2713");
        } else {
          this.hiddenLevels.push(item.stringValue);
        }
      }
    }
  }
  titleFor(item) {
    if (item.overwrite) {
      this.bitFieldValue = item.value;
    } else {
      this.bitFieldValue ^= item.value;
    }
    if (this.bitFieldValue === 7 /* Default */) {
      return this.defaultTitleInternal;
    }
    if (this.bitFieldValue === 15 /* All */) {
      return this.allTitle;
    }
    const potentialMatch = this.itemMap.get(this.bitFieldValue);
    if (potentialMatch) {
      return potentialMatch.title;
    }
    return this.customTitle;
  }
  createElementForItem(item) {
    const element = document.createElement("div");
    const shadowRoot = UI.Utils.createShadowRootWithCoreStyles(element, { cssFile: [playerMessagesViewStyles], delegatesFocus: void 0 });
    const container = shadowRoot.createChild("div", "media-messages-level-dropdown-element");
    const checkBox = container.createChild("div", "media-messages-level-dropdown-checkbox");
    const text = container.createChild("span", "media-messages-level-dropdown-text");
    UI.UIUtils.createTextChild(text, item.title);
    this.elementsForItems.set(item, checkBox);
    this.itemMap.set(item.value, item);
    this.updateCheckMarks();
    this.view.regenerateMessageDisplayCss(this.hiddenLevels);
    return element;
  }
  isItemSelectable(_item) {
    return true;
  }
  itemSelected(_item) {
    this.updateCheckMarks();
    this.view.regenerateMessageDisplayCss(this.hiddenLevels);
  }
  highlightedItemChanged(_from, _to, _fromElement, _toElement) {
  }
}
export class PlayerMessagesView extends UI.Widget.VBox {
  headerPanel;
  bodyPanel;
  messageLevelSelector;
  constructor() {
    super();
    this.headerPanel = this.contentElement.createChild("div", "media-messages-header");
    this.bodyPanel = this.contentElement.createChild("div", "media-messages-body");
    this.buildToolbar();
  }
  buildToolbar() {
    const toolbar = new UI.Toolbar.Toolbar("media-messages-toolbar", this.headerPanel);
    toolbar.appendText(i18nString(UIStrings.logLevel));
    toolbar.appendToolbarItem(this.createDropdown());
    toolbar.appendSeparator();
    toolbar.appendToolbarItem(this.createFilterInput());
  }
  createDropdown() {
    const items = new UI.ListModel.ListModel();
    this.messageLevelSelector = new MessageLevelSelector(items, this);
    const dropDown = new UI.SoftDropDown.SoftDropDown(items, this.messageLevelSelector);
    dropDown.setRowHeight(18);
    this.messageLevelSelector.populate();
    this.messageLevelSelector.setDefault(dropDown);
    const dropDownItem = new UI.Toolbar.ToolbarItem(dropDown.element);
    dropDownItem.element.classList.add("toolbar-has-dropdown");
    dropDownItem.setEnabled(true);
    dropDownItem.setTitle(this.messageLevelSelector.defaultTitle());
    return dropDownItem;
  }
  createFilterInput() {
    const filterInput = new UI.Toolbar.ToolbarInput(i18nString(UIStrings.filterLogMessages));
    filterInput.addEventListener(UI.Toolbar.ToolbarInput.Event.TextChanged, (data) => {
      this.filterByString(data);
    }, this);
    return filterInput;
  }
  regenerateMessageDisplayCss(hiddenLevels) {
    const messages = this.bodyPanel.getElementsByClassName("media-messages-message-container");
    for (const message of messages) {
      if (this.matchesHiddenLevels(message, hiddenLevels)) {
        message.classList.add("media-messages-message-unselected");
      } else {
        message.classList.remove("media-messages-message-unselected");
      }
    }
  }
  matchesHiddenLevels(element, hiddenLevels) {
    for (const level of hiddenLevels) {
      if (element.classList.contains("media-message-" + level)) {
        return true;
      }
    }
    return false;
  }
  filterByString(userStringData) {
    const userString = userStringData.data;
    const messages = this.bodyPanel.getElementsByClassName("media-messages-message-container");
    for (const message of messages) {
      if (userString === "") {
        message.classList.remove("media-messages-message-filtered");
      } else if (message.textContent && message.textContent.includes(userString)) {
        message.classList.remove("media-messages-message-filtered");
      } else {
        message.classList.add("media-messages-message-filtered");
      }
    }
  }
  addMessage(message) {
    const container = this.bodyPanel.createChild("div", "media-messages-message-container media-message-" + message.level);
    UI.UIUtils.createTextChild(container, message.message);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([playerMessagesViewStyles]);
  }
}
//# sourceMappingURL=PlayerMessagesView.js.map
