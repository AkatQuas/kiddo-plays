import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ConsoleFilter, FilterType } from "./ConsoleFilter.js";
import consoleSidebarStyles from "./consoleSidebar.css.js";
const UIStrings = {
  other: "<other>",
  dUserMessages: "{n, plural, =0 {No user messages} =1 {# user message} other {# user messages}}",
  dMessages: "{n, plural, =0 {No messages} =1 {# message} other {# messages}}",
  dErrors: "{n, plural, =0 {No errors} =1 {# error} other {# errors}}",
  dWarnings: "{n, plural, =0 {No warnings} =1 {# warning} other {# warnings}}",
  dInfo: "{n, plural, =0 {No info} =1 {# info} other {# info}}",
  dVerbose: "{n, plural, =0 {No verbose} =1 {# verbose} other {# verbose}}"
};
const str_ = i18n.i18n.registerUIStrings("panels/console/ConsoleSidebar.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ConsoleSidebar extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
  tree;
  selectedTreeElement;
  treeElements;
  constructor() {
    super(true);
    this.setMinimumSize(125, 0);
    this.tree = new UI.TreeOutline.TreeOutlineInShadow();
    this.tree.addEventListener(UI.TreeOutline.Events.ElementSelected, this.selectionChanged.bind(this));
    this.contentElement.appendChild(this.tree.element);
    this.selectedTreeElement = null;
    this.treeElements = [];
    const selectedFilterSetting = Common.Settings.Settings.instance().createSetting("console.sidebarSelectedFilter", null);
    const consoleAPIParsedFilters = [{
      key: FilterType.Source,
      text: SDK.ConsoleModel.FrontendMessageSource.ConsoleAPI,
      negative: false,
      regex: void 0
    }];
    this.appendGroup(GroupName.All, [], ConsoleFilter.allLevelsFilterValue(), UI.Icon.Icon.create("mediumicon-list"), selectedFilterSetting);
    this.appendGroup(GroupName.ConsoleAPI, consoleAPIParsedFilters, ConsoleFilter.allLevelsFilterValue(), UI.Icon.Icon.create("mediumicon-account-circle"), selectedFilterSetting);
    this.appendGroup(GroupName.Error, [], ConsoleFilter.singleLevelMask(Protocol.Log.LogEntryLevel.Error), UI.Icon.Icon.create("mediumicon-error-circle"), selectedFilterSetting);
    this.appendGroup(GroupName.Warning, [], ConsoleFilter.singleLevelMask(Protocol.Log.LogEntryLevel.Warning), UI.Icon.Icon.create("mediumicon-warning-triangle"), selectedFilterSetting);
    this.appendGroup(GroupName.Info, [], ConsoleFilter.singleLevelMask(Protocol.Log.LogEntryLevel.Info), UI.Icon.Icon.create("mediumicon-info-circle"), selectedFilterSetting);
    this.appendGroup(GroupName.Verbose, [], ConsoleFilter.singleLevelMask(Protocol.Log.LogEntryLevel.Verbose), UI.Icon.Icon.create("mediumicon-bug"), selectedFilterSetting);
    const selectedTreeElementName = selectedFilterSetting.get();
    const defaultTreeElement = this.treeElements.find((x) => x.name() === selectedTreeElementName) || this.treeElements[0];
    defaultTreeElement.select();
  }
  appendGroup(name, parsedFilters, levelsMask, icon, selectedFilterSetting) {
    const filter = new ConsoleFilter(name, parsedFilters, null, levelsMask);
    const treeElement = new FilterTreeElement(filter, icon, selectedFilterSetting);
    this.tree.appendChild(treeElement);
    this.treeElements.push(treeElement);
  }
  clear() {
    for (const treeElement of this.treeElements) {
      treeElement.clear();
    }
  }
  onMessageAdded(viewMessage) {
    for (const treeElement of this.treeElements) {
      treeElement.onMessageAdded(viewMessage);
    }
  }
  shouldBeVisible(viewMessage) {
    if (this.selectedTreeElement instanceof ConsoleSidebarTreeElement) {
      return this.selectedTreeElement.filter().shouldBeVisible(viewMessage);
    }
    return true;
  }
  selectionChanged(event) {
    this.selectedTreeElement = event.data;
    this.dispatchEventToListeners(Events.FilterSelected);
  }
  wasShown() {
    super.wasShown();
    this.tree.registerCSSFiles([consoleSidebarStyles]);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["FilterSelected"] = "FilterSelected";
  return Events2;
})(Events || {});
class ConsoleSidebarTreeElement extends UI.TreeOutline.TreeElement {
  filterInternal;
  constructor(title, filter) {
    super(title);
    this.filterInternal = filter;
  }
  filter() {
    return this.filterInternal;
  }
}
export class URLGroupTreeElement extends ConsoleSidebarTreeElement {
  countElement;
  messageCount;
  constructor(filter) {
    super(filter.name, filter);
    this.countElement = this.listItemElement.createChild("span", "count");
    const leadingIcons = [UI.Icon.Icon.create("largeicon-navigator-file")];
    this.setLeadingIcons(leadingIcons);
    this.messageCount = 0;
  }
  incrementAndUpdateCounter() {
    this.messageCount++;
    this.countElement.textContent = `${this.messageCount}`;
  }
}
var GroupName = /* @__PURE__ */ ((GroupName2) => {
  GroupName2["ConsoleAPI"] = "user message";
  GroupName2["All"] = "message";
  GroupName2["Error"] = "error";
  GroupName2["Warning"] = "warning";
  GroupName2["Info"] = "info";
  GroupName2["Verbose"] = "verbose";
  return GroupName2;
})(GroupName || {});
const stringForFilterSidebarItemMap = /* @__PURE__ */ new Map([
  ["user message" /* ConsoleAPI */, UIStrings.dUserMessages],
  ["message" /* All */, UIStrings.dMessages],
  ["error" /* Error */, UIStrings.dErrors],
  ["warning" /* Warning */, UIStrings.dWarnings],
  ["info" /* Info */, UIStrings.dInfo],
  ["verbose" /* Verbose */, UIStrings.dVerbose]
]);
export class FilterTreeElement extends ConsoleSidebarTreeElement {
  selectedFilterSetting;
  urlTreeElements;
  messageCount;
  uiStringForFilterCount;
  constructor(filter, icon, selectedFilterSetting) {
    super(filter.name, filter);
    this.uiStringForFilterCount = stringForFilterSidebarItemMap.get(filter.name) || "";
    this.selectedFilterSetting = selectedFilterSetting;
    this.urlTreeElements = /* @__PURE__ */ new Map();
    this.setLeadingIcons([icon]);
    this.messageCount = 0;
    this.updateCounter();
  }
  clear() {
    this.urlTreeElements.clear();
    this.removeChildren();
    this.messageCount = 0;
    this.updateCounter();
  }
  name() {
    return this.filterInternal.name;
  }
  onselect(selectedByUser) {
    this.selectedFilterSetting.set(this.filterInternal.name);
    return super.onselect(selectedByUser);
  }
  updateCounter() {
    this.title = this.updateGroupTitle(this.messageCount);
    this.setExpandable(Boolean(this.childCount()));
  }
  updateGroupTitle(messageCount) {
    if (this.uiStringForFilterCount) {
      return i18nString(this.uiStringForFilterCount, { n: messageCount });
    }
    return "";
  }
  onMessageAdded(viewMessage) {
    const message = viewMessage.consoleMessage();
    const shouldIncrementCounter = message.type !== SDK.ConsoleModel.FrontendMessageType.Command && message.type !== SDK.ConsoleModel.FrontendMessageType.Result && !message.isGroupMessage();
    if (!this.filterInternal.shouldBeVisible(viewMessage) || !shouldIncrementCounter) {
      return;
    }
    const child = this.childElement(message.url);
    child.incrementAndUpdateCounter();
    this.messageCount++;
    this.updateCounter();
  }
  childElement(url) {
    const urlValue = url || null;
    let child = this.urlTreeElements.get(urlValue);
    if (child) {
      return child;
    }
    const filter = this.filterInternal.clone();
    const parsedURL = urlValue ? Common.ParsedURL.ParsedURL.fromString(urlValue) : null;
    if (urlValue) {
      filter.name = parsedURL ? parsedURL.displayName : urlValue;
    } else {
      filter.name = i18nString(UIStrings.other);
    }
    filter.parsedFilters.push({ key: FilterType.Url, text: urlValue, negative: false, regex: void 0 });
    child = new URLGroupTreeElement(filter);
    if (urlValue) {
      child.tooltip = urlValue;
    }
    this.urlTreeElements.set(urlValue, child);
    this.appendChild(child);
    return child;
  }
}
//# sourceMappingURL=ConsoleSidebar.js.map
