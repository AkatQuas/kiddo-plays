import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as UI from "../../ui/legacy/legacy.js";
import audioContextSelectorStyles from "./audioContextSelector.css.js";
const UIStrings = {
  noRecordings: "(no recordings)",
  audioContextS: "Audio context: {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("panels/web_audio/AudioContextSelector.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class AudioContextSelector extends Common.ObjectWrapper.ObjectWrapper {
  placeholderText;
  items;
  dropDown;
  toolbarItemInternal;
  selectedContextInternal;
  constructor() {
    super();
    this.placeholderText = i18nString(UIStrings.noRecordings);
    this.items = new UI.ListModel.ListModel();
    this.dropDown = new UI.SoftDropDown.SoftDropDown(this.items, this);
    this.dropDown.setPlaceholderText(this.placeholderText);
    this.toolbarItemInternal = new UI.Toolbar.ToolbarItem(this.dropDown.element);
    this.toolbarItemInternal.setEnabled(false);
    this.toolbarItemInternal.setTitle(i18nString(UIStrings.audioContextS, { PH1: this.placeholderText }));
    this.items.addEventListener(UI.ListModel.Events.ItemsReplaced, this.onListItemReplaced, this);
    this.toolbarItemInternal.element.classList.add("toolbar-has-dropdown");
    this.selectedContextInternal = null;
  }
  onListItemReplaced() {
    const hasItems = Boolean(this.items.length);
    this.toolbarItemInternal.setEnabled(hasItems);
    if (!hasItems) {
      this.toolbarItemInternal.setTitle(i18nString(UIStrings.audioContextS, { PH1: this.placeholderText }));
    }
  }
  contextCreated({ data: context }) {
    this.items.insert(this.items.length, context);
    if (this.items.length === 1) {
      this.dropDown.selectItem(context);
    }
  }
  contextDestroyed({ data: contextId }) {
    const contextIndex = this.items.findIndex((context) => context.contextId === contextId);
    if (contextIndex > -1) {
      this.items.remove(contextIndex);
    }
  }
  contextChanged({ data: changedContext }) {
    const contextIndex = this.items.findIndex((context) => context.contextId === changedContext.contextId);
    if (contextIndex > -1) {
      this.items.replace(contextIndex, changedContext);
      if (this.selectedContextInternal && this.selectedContextInternal.contextId === changedContext.contextId) {
        this.dropDown.selectItem(changedContext);
      }
    }
  }
  createElementForItem(item) {
    const element = document.createElement("div");
    const shadowRoot = UI.Utils.createShadowRootWithCoreStyles(element, { cssFile: [audioContextSelectorStyles], delegatesFocus: void 0 });
    const title = shadowRoot.createChild("div", "title");
    UI.UIUtils.createTextChild(title, Platform.StringUtilities.trimEndWithMaxLength(this.titleFor(item), 100));
    return element;
  }
  selectedContext() {
    if (!this.selectedContextInternal) {
      return null;
    }
    return this.selectedContextInternal;
  }
  highlightedItemChanged(from, to, fromElement, toElement) {
    if (fromElement) {
      fromElement.classList.remove("highlighted");
    }
    if (toElement) {
      toElement.classList.add("highlighted");
    }
  }
  isItemSelectable(_item) {
    return true;
  }
  itemSelected(item) {
    if (!item) {
      return;
    }
    if (!this.selectedContextInternal || this.selectedContextInternal.contextId !== item.contextId) {
      this.selectedContextInternal = item;
      this.toolbarItemInternal.setTitle(i18nString(UIStrings.audioContextS, { PH1: this.titleFor(item) }));
    }
    this.dispatchEventToListeners(Events.ContextSelected, item);
  }
  reset() {
    this.items.replaceAll([]);
  }
  titleFor(context) {
    return `${context.contextType} (${context.contextId.substr(-6)})`;
  }
  toolbarItem() {
    return this.toolbarItemInternal;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ContextSelected"] = "ContextSelected";
  return Events2;
})(Events || {});
//# sourceMappingURL=AudioContextSelector.js.map
