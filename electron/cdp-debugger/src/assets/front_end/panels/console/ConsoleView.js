import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Logs from "../../models/logs/logs.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as CodeHighlighter from "../../ui/components/code_highlighter/code_highlighter.js";
import * as IssueCounter from "../../ui/components/issue_counter/issue_counter.js";
import objectValueStyles from "../../ui/legacy/components/object_ui/objectValue.css.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ConsoleContextSelector } from "./ConsoleContextSelector.js";
import consoleViewStyles from "./consoleView.css.js";
import { ConsoleFilter, FilterType } from "./ConsoleFilter.js";
import { ConsolePinPane } from "./ConsolePinPane.js";
import { ConsolePrompt, Events as ConsolePromptEvents } from "./ConsolePrompt.js";
import { ConsoleSidebar, Events } from "./ConsoleSidebar.js";
import {
  ConsoleCommand,
  ConsoleCommandResult,
  ConsoleGroupViewMessage,
  ConsoleTableMessageView,
  ConsoleViewMessage,
  getMessageForElement,
  MaxLengthForLinks
} from "./ConsoleViewMessage.js";
import { ConsoleViewport } from "./ConsoleViewport.js";
const UIStrings = {
  issuesWithColon: "{n, plural, =0 {No Issues} =1 {# Issue:} other {# Issues:}}",
  issueToolbarTooltipGeneral: "Some problems no longer generate console messages, but are surfaced in the issues tab.",
  issueToolbarClickToView: "Click to view {issueEnumeration}",
  issueToolbarClickToGoToTheIssuesTab: "Click to go to the issues tab",
  findStringInLogs: "Find string in logs",
  consoleSettings: "Console settings",
  groupSimilarMessagesInConsole: "Group similar messages in console",
  showCorsErrorsInConsole: "Show `CORS` errors in console",
  showConsoleSidebar: "Show console sidebar",
  hideConsoleSidebar: "Hide console sidebar",
  consoleSidebarShown: "Console sidebar shown",
  consoleSidebarHidden: "Console sidebar hidden",
  doNotClearLogOnPageReload: "Do not clear log on page reload / navigation",
  preserveLog: "Preserve log",
  hideNetwork: "Hide network",
  onlyShowMessagesFromTheCurrentContext: "Only show messages from the current context (`top`, `iframe`, `worker`, extension)",
  selectedContextOnly: "Selected context only",
  logXMLHttpRequests: "Log XMLHttpRequests",
  eagerlyEvaluateTextInThePrompt: "Eagerly evaluate text in the prompt",
  autocompleteFromHistory: "Autocomplete from history",
  treatEvaluationAsUserActivation: "Treat evaluation as user activation",
  sHidden: "{n, plural, =1 {# hidden} other {# hidden}}",
  consoleCleared: "Console cleared",
  hideMessagesFromS: "Hide messages from {PH1}",
  saveAs: "Save as...",
  copyVisibleStyledSelection: "Copy visible styled selection",
  replayXhr: "Replay XHR",
  writingFile: "Writing file\u2026",
  searching: "Searching\u2026",
  filter: "Filter",
  egEventdCdnUrlacom: "e.g. `/eventd/ -cdn url:a.com`",
  verbose: "Verbose",
  info: "Info",
  warnings: "Warnings",
  errors: "Errors",
  logLevels: "Log levels",
  overriddenByFilterSidebar: "Overridden by filter sidebar",
  customLevels: "Custom levels",
  sOnly: "{PH1} only",
  allLevels: "All levels",
  defaultLevels: "Default levels",
  hideAll: "Hide all",
  logLevelS: "Log level: {PH1}",
  default: "Default",
  filteredMessagesInConsole: "{PH1} messages in console"
};
const str_ = i18n.i18n.registerUIStrings("panels/console/ConsoleView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let consoleViewInstance;
export class ConsoleView extends UI.Widget.VBox {
  searchableViewInternal;
  sidebar;
  isSidebarOpen;
  filter;
  consoleToolbarContainer;
  splitWidget;
  contentsElement;
  visibleViewMessages;
  hiddenByFilterCount;
  shouldBeHiddenCache;
  lastShownHiddenByFilterCount;
  currentMatchRangeIndex;
  searchRegex;
  groupableMessages;
  groupableMessageTitle;
  shortcuts;
  regexMatchRanges;
  consoleContextSelector;
  filterStatusText;
  showSettingsPaneSetting;
  showSettingsPaneButton;
  progressToolbarItem;
  groupSimilarSetting;
  showCorsErrorsSetting;
  timestampsSetting;
  consoleHistoryAutocompleteSetting;
  pinPane;
  viewport;
  messagesElement;
  messagesCountElement;
  viewportThrottler;
  pendingBatchResize;
  onMessageResizedBound;
  promptElement;
  linkifier;
  consoleMessages;
  consoleGroupStarts;
  consoleHistorySetting;
  prompt;
  immediatelyFilterMessagesForTest;
  maybeDirtyWhileMuted;
  scheduledRefreshPromiseForTest;
  needsFullUpdate;
  buildHiddenCacheTimeout;
  searchShouldJumpBackwards;
  searchProgressIndicator;
  innerSearchTimeoutId;
  muteViewportUpdates;
  waitForScrollTimeout;
  issueCounter;
  pendingSidebarMessages = [];
  userHasOpenedSidebarAtLeastOnce = false;
  issueToolbarThrottle;
  requestResolver = new Logs.RequestResolver.RequestResolver();
  issueResolver = new IssuesManager.IssueResolver.IssueResolver();
  constructor() {
    super();
    this.setMinimumSize(0, 35);
    this.searchableViewInternal = new UI.SearchableView.SearchableView(this, null);
    this.searchableViewInternal.element.classList.add("console-searchable-view");
    this.searchableViewInternal.setPlaceholder(i18nString(UIStrings.findStringInLogs));
    this.searchableViewInternal.setMinimalSearchQuerySize(0);
    this.sidebar = new ConsoleSidebar();
    this.sidebar.addEventListener(Events.FilterSelected, this.onFilterChanged.bind(this));
    this.isSidebarOpen = false;
    this.filter = new ConsoleViewFilter(this.onFilterChanged.bind(this));
    this.consoleToolbarContainer = this.element.createChild("div", "console-toolbar-container");
    this.splitWidget = new UI.SplitWidget.SplitWidget(true, false, "console.sidebar.width", 100);
    this.splitWidget.setMainWidget(this.searchableViewInternal);
    this.splitWidget.setSidebarWidget(this.sidebar);
    this.splitWidget.show(this.element);
    this.splitWidget.hideSidebar();
    this.splitWidget.enableShowModeSaving();
    this.isSidebarOpen = this.splitWidget.showMode() === UI.SplitWidget.ShowMode.Both;
    this.filter.setLevelMenuOverridden(this.isSidebarOpen);
    this.splitWidget.addEventListener(UI.SplitWidget.Events.ShowModeChanged, (event) => {
      this.isSidebarOpen = event.data === UI.SplitWidget.ShowMode.Both;
      if (this.isSidebarOpen) {
        if (!this.userHasOpenedSidebarAtLeastOnce) {
          Host.userMetrics.actionTaken(Host.UserMetrics.Action.ConsoleSidebarOpened);
          this.userHasOpenedSidebarAtLeastOnce = true;
        }
        this.pendingSidebarMessages.forEach((message) => {
          this.sidebar.onMessageAdded(message);
        });
        this.pendingSidebarMessages = [];
      }
      this.filter.setLevelMenuOverridden(this.isSidebarOpen);
      this.onFilterChanged();
    });
    this.contentsElement = this.searchableViewInternal.element;
    this.element.classList.add("console-view");
    this.visibleViewMessages = [];
    this.hiddenByFilterCount = 0;
    this.shouldBeHiddenCache = /* @__PURE__ */ new Set();
    this.groupableMessages = /* @__PURE__ */ new Map();
    this.groupableMessageTitle = /* @__PURE__ */ new Map();
    this.shortcuts = /* @__PURE__ */ new Map();
    this.regexMatchRanges = [];
    this.consoleContextSelector = new ConsoleContextSelector();
    this.filterStatusText = new UI.Toolbar.ToolbarText();
    this.filterStatusText.element.classList.add("dimmed");
    this.showSettingsPaneSetting = Common.Settings.Settings.instance().createSetting("consoleShowSettingsToolbar", false);
    this.showSettingsPaneButton = new UI.Toolbar.ToolbarSettingToggle(this.showSettingsPaneSetting, "largeicon-settings-gear", i18nString(UIStrings.consoleSettings));
    this.progressToolbarItem = new UI.Toolbar.ToolbarItem(document.createElement("div"));
    this.groupSimilarSetting = Common.Settings.Settings.instance().moduleSetting("consoleGroupSimilar");
    this.groupSimilarSetting.addChangeListener(() => this.updateMessageList());
    this.showCorsErrorsSetting = Common.Settings.Settings.instance().moduleSetting("consoleShowsCorsErrors");
    this.showCorsErrorsSetting.addChangeListener(() => {
      Host.userMetrics.showCorsErrorsSettingChanged(this.showCorsErrorsSetting.get());
      this.updateMessageList();
    });
    const toolbar = new UI.Toolbar.Toolbar("console-main-toolbar", this.consoleToolbarContainer);
    toolbar.makeWrappable(true);
    const rightToolbar = new UI.Toolbar.Toolbar("", this.consoleToolbarContainer);
    toolbar.appendToolbarItem(this.splitWidget.createShowHideSidebarButton(i18nString(UIStrings.showConsoleSidebar), i18nString(UIStrings.hideConsoleSidebar), i18nString(UIStrings.consoleSidebarShown), i18nString(UIStrings.consoleSidebarHidden)));
    toolbar.appendToolbarItem(UI.Toolbar.Toolbar.createActionButton(UI.ActionRegistry.ActionRegistry.instance().action("console.clear")));
    toolbar.appendSeparator();
    toolbar.appendToolbarItem(this.consoleContextSelector.toolbarItem());
    toolbar.appendSeparator();
    const liveExpressionButton = UI.Toolbar.Toolbar.createActionButton(UI.ActionRegistry.ActionRegistry.instance().action("console.create-pin"));
    toolbar.appendToolbarItem(liveExpressionButton);
    toolbar.appendSeparator();
    toolbar.appendToolbarItem(this.filter.textFilterUI);
    toolbar.appendToolbarItem(this.filter.levelMenuButton);
    toolbar.appendToolbarItem(this.progressToolbarItem);
    toolbar.appendSeparator();
    this.issueCounter = new IssueCounter.IssueCounter.IssueCounter();
    this.issueCounter.id = "console-issues-counter";
    const issuesToolbarItem = new UI.Toolbar.ToolbarItem(this.issueCounter);
    this.issueCounter.data = {
      clickHandler: () => {
        Host.userMetrics.issuesPanelOpenedFrom(Host.UserMetrics.IssueOpener.StatusBarIssuesCounter);
        void UI.ViewManager.ViewManager.instance().showView("issues-pane");
      },
      issuesManager: IssuesManager.IssuesManager.IssuesManager.instance(),
      accessibleName: i18nString(UIStrings.issueToolbarTooltipGeneral),
      displayMode: IssueCounter.IssueCounter.DisplayMode.OmitEmpty
    };
    toolbar.appendToolbarItem(issuesToolbarItem);
    rightToolbar.appendSeparator();
    rightToolbar.appendToolbarItem(this.filterStatusText);
    rightToolbar.appendToolbarItem(this.showSettingsPaneButton);
    const monitoringXHREnabledSetting = Common.Settings.Settings.instance().moduleSetting("monitoringXHREnabled");
    this.timestampsSetting = Common.Settings.Settings.instance().moduleSetting("consoleTimestampsEnabled");
    this.consoleHistoryAutocompleteSetting = Common.Settings.Settings.instance().moduleSetting("consoleHistoryAutocomplete");
    const settingsPane = new UI.Widget.HBox();
    settingsPane.show(this.contentsElement);
    settingsPane.element.classList.add("console-settings-pane");
    UI.ARIAUtils.setAccessibleName(settingsPane.element, i18nString(UIStrings.consoleSettings));
    UI.ARIAUtils.markAsGroup(settingsPane.element);
    const settingsToolbarLeft = new UI.Toolbar.Toolbar("", settingsPane.element);
    settingsToolbarLeft.makeVertical();
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarLeft, this.filter.hideNetworkMessagesSetting, this.filter.hideNetworkMessagesSetting.title(), i18nString(UIStrings.hideNetwork));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarLeft, "preserveConsoleLog", i18nString(UIStrings.doNotClearLogOnPageReload), i18nString(UIStrings.preserveLog));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarLeft, this.filter.filterByExecutionContextSetting, i18nString(UIStrings.onlyShowMessagesFromTheCurrentContext), i18nString(UIStrings.selectedContextOnly));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarLeft, this.groupSimilarSetting, i18nString(UIStrings.groupSimilarMessagesInConsole));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarLeft, this.showCorsErrorsSetting, i18nString(UIStrings.showCorsErrorsInConsole));
    const settingsToolbarRight = new UI.Toolbar.Toolbar("", settingsPane.element);
    settingsToolbarRight.makeVertical();
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarRight, monitoringXHREnabledSetting, i18nString(UIStrings.logXMLHttpRequests));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarRight, "consoleEagerEval", i18nString(UIStrings.eagerlyEvaluateTextInThePrompt));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarRight, this.consoleHistoryAutocompleteSetting, i18nString(UIStrings.autocompleteFromHistory));
    ConsoleView.appendSettingsCheckboxToToolbar(settingsToolbarRight, "consoleUserActivationEval", i18nString(UIStrings.treatEvaluationAsUserActivation));
    if (!this.showSettingsPaneSetting.get()) {
      settingsPane.element.classList.add("hidden");
    }
    this.showSettingsPaneSetting.addChangeListener(() => settingsPane.element.classList.toggle("hidden", !this.showSettingsPaneSetting.get()));
    this.pinPane = new ConsolePinPane(liveExpressionButton, () => this.prompt.focus());
    this.pinPane.element.classList.add("console-view-pinpane");
    this.pinPane.show(this.contentsElement);
    this.viewport = new ConsoleViewport(this);
    this.viewport.setStickToBottom(true);
    this.viewport.contentElement().classList.add("console-group", "console-group-messages");
    this.contentsElement.appendChild(this.viewport.element);
    this.messagesElement = this.viewport.element;
    this.messagesElement.id = "console-messages";
    this.messagesElement.classList.add("monospace");
    this.messagesElement.addEventListener("click", this.messagesClicked.bind(this), false);
    this.messagesElement.addEventListener("paste", this.messagesPasted.bind(this), true);
    this.messagesElement.addEventListener("clipboard-paste", this.messagesPasted.bind(this), true);
    this.messagesCountElement = this.consoleToolbarContainer.createChild("div", "message-count");
    UI.ARIAUtils.markAsPoliteLiveRegion(this.messagesCountElement, false);
    this.viewportThrottler = new Common.Throttler.Throttler(50);
    this.pendingBatchResize = false;
    this.onMessageResizedBound = (e) => {
      void this.onMessageResized(e);
    };
    this.promptElement = this.messagesElement.createChild("div", "source-code");
    this.promptElement.id = "console-prompt";
    const selectAllFixer = this.messagesElement.createChild("div", "console-view-fix-select-all");
    selectAllFixer.textContent = ".";
    UI.ARIAUtils.markAsHidden(selectAllFixer);
    this.registerShortcuts();
    this.messagesElement.addEventListener("contextmenu", this.handleContextMenuEvent.bind(this), false);
    const throttler = new Common.Throttler.Throttler(100);
    const refilterMessages = () => throttler.schedule(async () => this.onFilterChanged());
    this.linkifier = new Components.Linkifier.Linkifier(MaxLengthForLinks, void 0, refilterMessages);
    this.consoleMessages = [];
    this.consoleGroupStarts = [];
    this.consoleHistorySetting = Common.Settings.Settings.instance().createLocalSetting("consoleHistory", []);
    this.prompt = new ConsolePrompt();
    this.prompt.show(this.promptElement);
    this.prompt.element.addEventListener("keydown", this.promptKeyDown.bind(this), true);
    this.prompt.addEventListener(ConsolePromptEvents.TextChanged, this.promptTextChanged, this);
    this.messagesElement.addEventListener("keydown", this.messagesKeyDown.bind(this), false);
    this.prompt.element.addEventListener("focusin", () => {
      if (this.isScrolledToBottom()) {
        this.viewport.setStickToBottom(true);
      }
    });
    this.consoleHistoryAutocompleteSetting.addChangeListener(this.consoleHistoryAutocompleteChanged, this);
    const historyData = this.consoleHistorySetting.get();
    this.prompt.history().setHistoryData(historyData);
    this.consoleHistoryAutocompleteChanged();
    this.updateFilterStatus();
    this.timestampsSetting.addChangeListener(this.consoleTimestampsSettingChanged, this);
    this.registerWithMessageSink();
    UI.Context.Context.instance().addFlavorChangeListener(SDK.RuntimeModel.ExecutionContext, this.executionContextChanged, this);
    this.messagesElement.addEventListener("mousedown", (event) => this.updateStickToBottomOnPointerDown(event.button === 2), false);
    this.messagesElement.addEventListener("mouseup", this.updateStickToBottomOnPointerUp.bind(this), false);
    this.messagesElement.addEventListener("mouseleave", this.updateStickToBottomOnPointerUp.bind(this), false);
    this.messagesElement.addEventListener("wheel", this.updateStickToBottomOnWheel.bind(this), false);
    this.messagesElement.addEventListener("touchstart", this.updateStickToBottomOnPointerDown.bind(this, false), false);
    this.messagesElement.addEventListener("touchend", this.updateStickToBottomOnPointerUp.bind(this), false);
    this.messagesElement.addEventListener("touchcancel", this.updateStickToBottomOnPointerUp.bind(this), false);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.ConsoleCleared, this.consoleCleared, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.MessageAdded, this.onConsoleMessageAdded, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.MessageUpdated, this.onConsoleMessageUpdated, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.CommandEvaluated, this.commandEvaluated, this);
    SDK.ConsoleModel.ConsoleModel.instance().messages().forEach(this.addConsoleMessage, this);
    const issuesManager = IssuesManager.IssuesManager.IssuesManager.instance();
    this.issueToolbarThrottle = new Common.Throttler.Throttler(100);
    issuesManager.addEventListener(IssuesManager.IssuesManager.Events.IssuesCountUpdated, () => this.issueToolbarThrottle.schedule(async () => this.updateIssuesToolbarItem()), this);
  }
  static appendSettingsCheckboxToToolbar(toolbar, settingOrSetingName, title, alternateTitle) {
    let setting;
    if (typeof settingOrSetingName === "string") {
      setting = Common.Settings.Settings.instance().moduleSetting(settingOrSetingName);
    } else {
      setting = settingOrSetingName;
    }
    const checkbox = new UI.Toolbar.ToolbarSettingCheckbox(setting, title, alternateTitle);
    toolbar.appendToolbarItem(checkbox);
    return checkbox;
  }
  static instance() {
    if (!consoleViewInstance) {
      consoleViewInstance = new ConsoleView();
    }
    return consoleViewInstance;
  }
  static clearConsole() {
    SDK.ConsoleModel.ConsoleModel.instance().requestClearMessages();
  }
  onFilterChanged() {
    this.filter.currentFilter.levelsMask = this.isSidebarOpen ? ConsoleFilter.allLevelsFilterValue() : this.filter.messageLevelFiltersSetting.get();
    this.cancelBuildHiddenCache();
    if (this.immediatelyFilterMessagesForTest) {
      for (const viewMessage of this.consoleMessages) {
        this.computeShouldMessageBeVisible(viewMessage);
      }
      this.updateMessageList();
      return;
    }
    this.buildHiddenCache(0, this.consoleMessages.slice());
  }
  setImmediatelyFilterMessagesForTest() {
    this.immediatelyFilterMessagesForTest = true;
  }
  searchableView() {
    return this.searchableViewInternal;
  }
  clearHistory() {
    this.consoleHistorySetting.set([]);
    this.prompt.history().setHistoryData([]);
  }
  consoleHistoryAutocompleteChanged() {
    this.prompt.setAddCompletionsFromHistory(this.consoleHistoryAutocompleteSetting.get());
  }
  itemCount() {
    return this.visibleViewMessages.length;
  }
  itemElement(index) {
    return this.visibleViewMessages[index];
  }
  fastHeight(index) {
    return this.visibleViewMessages[index].fastHeight();
  }
  minimumRowHeight() {
    return 16;
  }
  registerWithMessageSink() {
    Common.Console.Console.instance().messages().forEach(this.addSinkMessage, this);
    Common.Console.Console.instance().addEventListener(Common.Console.Events.MessageAdded, ({ data: message }) => {
      this.addSinkMessage(message);
    }, this);
  }
  addSinkMessage(message) {
    let level = Protocol.Log.LogEntryLevel.Verbose;
    switch (message.level) {
      case Common.Console.MessageLevel.Info:
        level = Protocol.Log.LogEntryLevel.Info;
        break;
      case Common.Console.MessageLevel.Error:
        level = Protocol.Log.LogEntryLevel.Error;
        break;
      case Common.Console.MessageLevel.Warning:
        level = Protocol.Log.LogEntryLevel.Warning;
        break;
    }
    const consoleMessage = new SDK.ConsoleModel.ConsoleMessage(null, Protocol.Log.LogEntrySource.Other, level, message.text, { type: SDK.ConsoleModel.FrontendMessageType.System, timestamp: message.timestamp });
    this.addConsoleMessage(consoleMessage);
  }
  consoleTimestampsSettingChanged() {
    this.updateMessageList();
    this.consoleMessages.forEach((viewMessage) => viewMessage.updateTimestamp());
    this.groupableMessageTitle.forEach((viewMessage) => viewMessage.updateTimestamp());
  }
  executionContextChanged() {
    this.prompt.clearAutocomplete();
  }
  willHide() {
    this.hidePromptSuggestBox();
  }
  wasShown() {
    super.wasShown();
    this.updateIssuesToolbarItem();
    this.viewport.refresh();
    this.registerCSSFiles([consoleViewStyles, objectValueStyles, CodeHighlighter.Style.default]);
  }
  focus() {
    if (this.viewport.hasVirtualSelection()) {
      this.viewport.contentElement().focus();
    } else {
      this.focusPrompt();
    }
  }
  focusPrompt() {
    if (!this.prompt.hasFocus()) {
      const oldStickToBottom = this.viewport.stickToBottom();
      const oldScrollTop = this.viewport.element.scrollTop;
      this.prompt.focus();
      this.viewport.setStickToBottom(oldStickToBottom);
      this.viewport.element.scrollTop = oldScrollTop;
    }
  }
  restoreScrollPositions() {
    if (this.viewport.stickToBottom()) {
      this.immediatelyScrollToBottom();
    } else {
      super.restoreScrollPositions();
    }
  }
  onResize() {
    this.scheduleViewportRefresh();
    this.hidePromptSuggestBox();
    if (this.viewport.stickToBottom()) {
      this.immediatelyScrollToBottom();
    }
    for (let i = 0; i < this.visibleViewMessages.length; ++i) {
      this.visibleViewMessages[i].onResize();
    }
  }
  hidePromptSuggestBox() {
    this.prompt.clearAutocomplete();
  }
  async invalidateViewport() {
    this.updateIssuesToolbarItem();
    if (this.muteViewportUpdates) {
      this.maybeDirtyWhileMuted = true;
      return;
    }
    if (this.needsFullUpdate) {
      this.updateMessageList();
      delete this.needsFullUpdate;
    } else {
      this.viewport.invalidate();
    }
    return;
  }
  updateIssuesToolbarItem() {
    const manager = IssuesManager.IssuesManager.IssuesManager.instance();
    const issueEnumeration = IssueCounter.IssueCounter.getIssueCountsEnumeration(manager);
    const issuesTitleGotoIssues = manager.numberOfIssues() === 0 ? i18nString(UIStrings.issueToolbarClickToGoToTheIssuesTab) : i18nString(UIStrings.issueToolbarClickToView, { issueEnumeration });
    const issuesTitleGeneral = i18nString(UIStrings.issueToolbarTooltipGeneral);
    const issuesTitle = `${issuesTitleGeneral} ${issuesTitleGotoIssues}`;
    UI.Tooltip.Tooltip.install(this.issueCounter, issuesTitle);
    this.issueCounter.data = {
      ...this.issueCounter.data,
      leadingText: i18nString(UIStrings.issuesWithColon, { n: manager.numberOfIssues() }),
      accessibleName: issuesTitle
    };
  }
  scheduleViewportRefresh() {
    if (this.muteViewportUpdates) {
      this.maybeDirtyWhileMuted = true;
      this.scheduleViewportRefreshForTest(true);
      return;
    }
    this.scheduleViewportRefreshForTest(false);
    this.scheduledRefreshPromiseForTest = this.viewportThrottler.schedule(this.invalidateViewport.bind(this));
  }
  getScheduledRefreshPromiseForTest() {
    return this.scheduledRefreshPromiseForTest;
  }
  scheduleViewportRefreshForTest(_muted) {
  }
  immediatelyScrollToBottom() {
    this.viewport.setStickToBottom(true);
    this.promptElement.scrollIntoView(true);
  }
  updateFilterStatus() {
    if (this.hiddenByFilterCount === this.lastShownHiddenByFilterCount) {
      return;
    }
    this.filterStatusText.setText(i18nString(UIStrings.sHidden, { n: this.hiddenByFilterCount }));
    this.filterStatusText.setVisible(Boolean(this.hiddenByFilterCount));
    this.lastShownHiddenByFilterCount = this.hiddenByFilterCount;
  }
  onConsoleMessageAdded(event) {
    const message = event.data;
    this.addConsoleMessage(message);
  }
  addConsoleMessage(message) {
    const viewMessage = this.createViewMessage(message);
    consoleMessageToViewMessage.set(message, viewMessage);
    if (message.type === SDK.ConsoleModel.FrontendMessageType.Command || message.type === SDK.ConsoleModel.FrontendMessageType.Result) {
      const lastMessage = this.consoleMessages[this.consoleMessages.length - 1];
      const newTimestamp = lastMessage && messagesSortedBySymbol.get(lastMessage) || 0;
      messagesSortedBySymbol.set(viewMessage, newTimestamp);
    } else {
      messagesSortedBySymbol.set(viewMessage, viewMessage.consoleMessage().timestamp);
    }
    let insertAt;
    if (!this.consoleMessages.length || timeComparator(viewMessage, this.consoleMessages[this.consoleMessages.length - 1]) > 0) {
      insertAt = this.consoleMessages.length;
    } else {
      insertAt = Platform.ArrayUtilities.upperBound(this.consoleMessages, viewMessage, timeComparator);
    }
    const insertedInMiddle = insertAt < this.consoleMessages.length;
    this.consoleMessages.splice(insertAt, 0, viewMessage);
    if (message.type !== SDK.ConsoleModel.FrontendMessageType.Command && message.type !== SDK.ConsoleModel.FrontendMessageType.Result) {
      const consoleGroupStartIndex = Platform.ArrayUtilities.upperBound(this.consoleGroupStarts, viewMessage, timeComparator) - 1;
      if (consoleGroupStartIndex >= 0) {
        const currentGroup = this.consoleGroupStarts[consoleGroupStartIndex];
        addToGroup(viewMessage, currentGroup);
      }
      if (message.isGroupStartMessage()) {
        insertAt = Platform.ArrayUtilities.upperBound(this.consoleGroupStarts, viewMessage, timeComparator);
        this.consoleGroupStarts.splice(insertAt, 0, viewMessage);
      }
    }
    this.filter.onMessageAdded(message);
    if (this.isSidebarOpen) {
      this.sidebar.onMessageAdded(viewMessage);
    } else {
      this.pendingSidebarMessages.push(viewMessage);
    }
    let shouldGoIntoGroup = false;
    const shouldGroupSimilar = this.groupSimilarSetting.get();
    if (message.isGroupable()) {
      const groupKey = viewMessage.groupKey();
      shouldGoIntoGroup = shouldGroupSimilar && this.groupableMessages.has(groupKey);
      let list = this.groupableMessages.get(groupKey);
      if (!list) {
        list = [];
        this.groupableMessages.set(groupKey, list);
      }
      list.push(viewMessage);
    }
    this.computeShouldMessageBeVisible(viewMessage);
    if (!shouldGoIntoGroup && !insertedInMiddle) {
      this.appendMessageToEnd(viewMessage, !shouldGroupSimilar);
      this.updateFilterStatus();
      this.searchableViewInternal.updateSearchMatchesCount(this.regexMatchRanges.length);
    } else {
      this.needsFullUpdate = true;
    }
    this.scheduleViewportRefresh();
    this.consoleMessageAddedForTest(viewMessage);
    function addToGroup(viewMessage2, currentGroup) {
      const currentEnd = currentGroup.groupEnd();
      if (currentEnd !== null) {
        if (timeComparator(viewMessage2, currentEnd) > 0) {
          const parent = currentGroup.consoleGroup();
          if (parent === null) {
            return;
          }
          addToGroup(viewMessage2, parent);
          return;
        }
      }
      if (viewMessage2.consoleMessage().type === Protocol.Runtime.ConsoleAPICalledEventType.EndGroup) {
        currentGroup.setGroupEnd(viewMessage2);
      } else {
        viewMessage2.setConsoleGroup(currentGroup);
      }
    }
    function timeComparator(viewMessage1, viewMessage2) {
      return (messagesSortedBySymbol.get(viewMessage1) || 0) - (messagesSortedBySymbol.get(viewMessage2) || 0);
    }
  }
  onConsoleMessageUpdated(event) {
    const message = event.data;
    const viewMessage = consoleMessageToViewMessage.get(message);
    if (viewMessage) {
      viewMessage.updateMessageElement();
      this.computeShouldMessageBeVisible(viewMessage);
      this.updateMessageList();
    }
  }
  consoleMessageAddedForTest(_viewMessage) {
  }
  shouldMessageBeVisible(viewMessage) {
    return !this.shouldBeHiddenCache.has(viewMessage);
  }
  computeShouldMessageBeVisible(viewMessage) {
    if (this.filter.shouldBeVisible(viewMessage) && (!this.isSidebarOpen || this.sidebar.shouldBeVisible(viewMessage))) {
      this.shouldBeHiddenCache.delete(viewMessage);
    } else {
      this.shouldBeHiddenCache.add(viewMessage);
    }
  }
  appendMessageToEnd(viewMessage, preventCollapse) {
    if (viewMessage.consoleMessage().category === Protocol.Log.LogEntryCategory.Cors && !this.showCorsErrorsSetting.get()) {
      return;
    }
    const lastMessage = this.visibleViewMessages[this.visibleViewMessages.length - 1];
    if (viewMessage.consoleMessage().type === Protocol.Runtime.ConsoleAPICalledEventType.EndGroup) {
      if (lastMessage) {
        const group = lastMessage.consoleGroup();
        if (group && !group.messagesHidden()) {
          lastMessage.incrementCloseGroupDecorationCount();
        }
      }
      return;
    }
    if (!this.shouldMessageBeVisible(viewMessage)) {
      this.hiddenByFilterCount++;
      return;
    }
    if (!preventCollapse && this.tryToCollapseMessages(viewMessage, this.visibleViewMessages[this.visibleViewMessages.length - 1])) {
      return;
    }
    const currentGroup = viewMessage.consoleGroup();
    if (!currentGroup || !currentGroup.messagesHidden()) {
      const originatingMessage = viewMessage.consoleMessage().originatingMessage();
      if (lastMessage && originatingMessage && lastMessage.consoleMessage() === originatingMessage) {
        viewMessage.toMessageElement().classList.add("console-adjacent-user-command-result");
      }
      showGroup(currentGroup, this.visibleViewMessages);
      this.visibleViewMessages.push(viewMessage);
      this.searchMessage(this.visibleViewMessages.length - 1);
    }
    this.messageAppendedForTests();
    function showGroup(currentGroup2, visibleViewMessages) {
      if (currentGroup2 === null) {
        return;
      }
      if (visibleViewMessages.includes(currentGroup2)) {
        return;
      }
      const parentGroup = currentGroup2.consoleGroup();
      if (parentGroup) {
        showGroup(parentGroup, visibleViewMessages);
      }
      visibleViewMessages.push(currentGroup2);
    }
  }
  messageAppendedForTests() {
  }
  createViewMessage(message) {
    switch (message.type) {
      case SDK.ConsoleModel.FrontendMessageType.Command:
        return new ConsoleCommand(message, this.linkifier, this.requestResolver, this.issueResolver, this.onMessageResizedBound);
      case SDK.ConsoleModel.FrontendMessageType.Result:
        return new ConsoleCommandResult(message, this.linkifier, this.requestResolver, this.issueResolver, this.onMessageResizedBound);
      case Protocol.Runtime.ConsoleAPICalledEventType.StartGroupCollapsed:
      case Protocol.Runtime.ConsoleAPICalledEventType.StartGroup:
        return new ConsoleGroupViewMessage(message, this.linkifier, this.requestResolver, this.issueResolver, this.updateMessageList.bind(this), this.onMessageResizedBound);
      case Protocol.Runtime.ConsoleAPICalledEventType.Table:
        return new ConsoleTableMessageView(message, this.linkifier, this.requestResolver, this.issueResolver, this.onMessageResizedBound);
      default:
        return new ConsoleViewMessage(message, this.linkifier, this.requestResolver, this.issueResolver, this.onMessageResizedBound);
    }
  }
  async onMessageResized(event) {
    const treeElement = event.data;
    if (this.pendingBatchResize || !treeElement.treeOutline) {
      return;
    }
    this.pendingBatchResize = true;
    await Promise.resolve();
    const treeOutlineElement = treeElement.treeOutline.element;
    this.viewport.setStickToBottom(this.isScrolledToBottom());
    if (treeOutlineElement.offsetHeight <= this.messagesElement.offsetHeight) {
      treeOutlineElement.scrollIntoViewIfNeeded();
    }
    this.pendingBatchResize = false;
  }
  consoleCleared() {
    const hadFocus = this.viewport.element.hasFocus();
    this.cancelBuildHiddenCache();
    this.currentMatchRangeIndex = -1;
    this.consoleMessages = [];
    this.groupableMessages.clear();
    this.groupableMessageTitle.clear();
    this.sidebar.clear();
    this.updateMessageList();
    this.hidePromptSuggestBox();
    this.viewport.setStickToBottom(true);
    this.linkifier.reset();
    this.filter.clear();
    this.requestResolver.clear();
    this.consoleGroupStarts = [];
    if (hadFocus) {
      this.prompt.focus();
    }
    UI.ARIAUtils.alert(i18nString(UIStrings.consoleCleared));
  }
  handleContextMenuEvent(event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    const eventTarget = event.target;
    if (eventTarget.isSelfOrDescendant(this.promptElement)) {
      void contextMenu.show();
      return;
    }
    const sourceElement = eventTarget.enclosingNodeOrSelfWithClass("console-message-wrapper");
    const consoleViewMessage = sourceElement && getMessageForElement(sourceElement);
    const consoleMessage = consoleViewMessage ? consoleViewMessage.consoleMessage() : null;
    if (consoleMessage && consoleMessage.url) {
      const menuTitle = i18nString(UIStrings.hideMessagesFromS, { PH1: new Common.ParsedURL.ParsedURL(consoleMessage.url).displayName });
      contextMenu.headerSection().appendItem(menuTitle, this.filter.addMessageURLFilter.bind(this.filter, consoleMessage.url));
    }
    contextMenu.defaultSection().appendAction("console.clear");
    contextMenu.defaultSection().appendAction("console.clear.history");
    contextMenu.saveSection().appendItem(i18nString(UIStrings.saveAs), this.saveConsole.bind(this));
    if (this.element.hasSelection()) {
      contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyVisibleStyledSelection), this.viewport.copyWithStyles.bind(this.viewport));
    }
    if (consoleMessage) {
      const request = Logs.NetworkLog.NetworkLog.requestForConsoleMessage(consoleMessage);
      if (request && SDK.NetworkManager.NetworkManager.canReplayRequest(request)) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.replayXhr), SDK.NetworkManager.NetworkManager.replayRequest.bind(null, request));
      }
    }
    void contextMenu.show();
  }
  async saveConsole() {
    const url = SDK.TargetManager.TargetManager.instance().mainTarget().inspectedURL();
    const parsedURL = Common.ParsedURL.ParsedURL.fromString(url);
    const filename = Platform.StringUtilities.sprintf("%s-%d.log", parsedURL ? parsedURL.host : "console", Date.now());
    const stream = new Bindings.FileUtils.FileOutputStream();
    const progressIndicator = new UI.ProgressIndicator.ProgressIndicator();
    progressIndicator.setTitle(i18nString(UIStrings.writingFile));
    progressIndicator.setTotalWork(this.itemCount());
    const chunkSize = 350;
    if (!await stream.open(filename)) {
      return;
    }
    this.progressToolbarItem.element.appendChild(progressIndicator.element);
    let messageIndex = 0;
    while (messageIndex < this.itemCount() && !progressIndicator.isCanceled()) {
      const messageContents = [];
      let i;
      for (i = 0; i < chunkSize && i + messageIndex < this.itemCount(); ++i) {
        const message = this.itemElement(messageIndex + i);
        messageContents.push(message.toExportString());
      }
      messageIndex += i;
      await stream.write(messageContents.join("\n") + "\n");
      progressIndicator.setWorked(messageIndex);
    }
    void stream.close();
    progressIndicator.done();
  }
  tryToCollapseMessages(viewMessage, lastMessage) {
    const timestampsShown = this.timestampsSetting.get();
    if (!timestampsShown && lastMessage && !viewMessage.consoleMessage().isGroupMessage() && viewMessage.consoleMessage().type !== SDK.ConsoleModel.FrontendMessageType.Command && viewMessage.consoleMessage().type !== SDK.ConsoleModel.FrontendMessageType.Result && viewMessage.consoleMessage().isEqual(lastMessage.consoleMessage())) {
      lastMessage.incrementRepeatCount();
      if (viewMessage.isLastInSimilarGroup()) {
        lastMessage.setInSimilarGroup(true, true);
      }
      return true;
    }
    return false;
  }
  buildHiddenCache(startIndex, viewMessages) {
    const startTime = Date.now();
    let i;
    for (i = startIndex; i < viewMessages.length; ++i) {
      this.computeShouldMessageBeVisible(viewMessages[i]);
      if (i % 10 === 0 && Date.now() - startTime > 12) {
        break;
      }
    }
    if (i === viewMessages.length) {
      this.updateMessageList();
      return;
    }
    this.buildHiddenCacheTimeout = this.element.window().requestAnimationFrame(this.buildHiddenCache.bind(this, i + 1, viewMessages));
  }
  cancelBuildHiddenCache() {
    this.shouldBeHiddenCache.clear();
    if (this.buildHiddenCacheTimeout) {
      this.element.window().cancelAnimationFrame(this.buildHiddenCacheTimeout);
      delete this.buildHiddenCacheTimeout;
    }
  }
  updateMessageList() {
    this.regexMatchRanges = [];
    this.hiddenByFilterCount = 0;
    for (const visibleViewMessage of this.visibleViewMessages) {
      visibleViewMessage.resetCloseGroupDecorationCount();
      visibleViewMessage.resetIncrementRepeatCount();
    }
    this.visibleViewMessages = [];
    if (this.groupSimilarSetting.get()) {
      this.addGroupableMessagesToEnd();
    } else {
      for (const consoleMessage of this.consoleMessages) {
        consoleMessage.setInSimilarGroup(false);
        if (consoleMessage.consoleMessage().isGroupable()) {
          consoleMessage.clearConsoleGroup();
        }
        this.appendMessageToEnd(consoleMessage, true);
      }
    }
    this.updateFilterStatus();
    this.searchableViewInternal.updateSearchMatchesCount(this.regexMatchRanges.length);
    this.viewport.invalidate();
    this.messagesCountElement.setAttribute("aria-label", i18nString(UIStrings.filteredMessagesInConsole, { PH1: this.visibleViewMessages.length }));
  }
  addGroupableMessagesToEnd() {
    const alreadyAdded = /* @__PURE__ */ new Set();
    const processedGroupKeys = /* @__PURE__ */ new Set();
    for (const viewMessage of this.consoleMessages) {
      const message = viewMessage.consoleMessage();
      if (alreadyAdded.has(message)) {
        continue;
      }
      if (!message.isGroupable()) {
        this.appendMessageToEnd(viewMessage);
        alreadyAdded.add(message);
        continue;
      }
      const key = viewMessage.groupKey();
      const viewMessagesInGroup = this.groupableMessages.get(key);
      if (!viewMessagesInGroup || viewMessagesInGroup.length < 5) {
        viewMessage.setInSimilarGroup(false);
        this.appendMessageToEnd(viewMessage);
        alreadyAdded.add(message);
        continue;
      }
      if (processedGroupKeys.has(key)) {
        continue;
      }
      if (!viewMessagesInGroup.find((x) => this.shouldMessageBeVisible(x))) {
        Platform.SetUtilities.addAll(alreadyAdded, viewMessagesInGroup);
        processedGroupKeys.add(key);
        continue;
      }
      let startGroupViewMessage = this.groupableMessageTitle.get(key);
      if (!startGroupViewMessage) {
        const startGroupMessage = new SDK.ConsoleModel.ConsoleMessage(null, message.source, message.level, viewMessage.groupTitle(), { type: Protocol.Runtime.ConsoleAPICalledEventType.StartGroupCollapsed });
        startGroupViewMessage = this.createViewMessage(startGroupMessage);
        this.groupableMessageTitle.set(key, startGroupViewMessage);
      }
      startGroupViewMessage.setRepeatCount(viewMessagesInGroup.length);
      this.appendMessageToEnd(startGroupViewMessage);
      for (const viewMessageInGroup of viewMessagesInGroup) {
        viewMessageInGroup.setInSimilarGroup(true, viewMessagesInGroup[viewMessagesInGroup.length - 1] === viewMessageInGroup);
        viewMessageInGroup.setConsoleGroup(startGroupViewMessage);
        this.appendMessageToEnd(viewMessageInGroup, true);
        alreadyAdded.add(viewMessageInGroup.consoleMessage());
      }
      const endGroupMessage = new SDK.ConsoleModel.ConsoleMessage(null, message.source, message.level, message.messageText, { type: Protocol.Runtime.ConsoleAPICalledEventType.EndGroup });
      this.appendMessageToEnd(this.createViewMessage(endGroupMessage));
    }
  }
  messagesClicked(event) {
    const target = event.target;
    if (!this.messagesElement.hasSelection()) {
      const clickedOutsideMessageList = target === this.messagesElement || this.prompt.belowEditorElement().isSelfOrAncestor(target);
      if (clickedOutsideMessageList) {
        this.prompt.moveCaretToEndOfPrompt();
        this.focusPrompt();
      }
    }
  }
  messagesKeyDown(event) {
    const keyEvent = event;
    const hasActionModifier = keyEvent.ctrlKey || keyEvent.altKey || keyEvent.metaKey;
    if (hasActionModifier || keyEvent.key.length !== 1 || UI.UIUtils.isEditing() || this.messagesElement.hasSelection()) {
      return;
    }
    this.prompt.moveCaretToEndOfPrompt();
    this.focusPrompt();
  }
  messagesPasted(_event) {
    if (UI.UIUtils.isEditing()) {
      return;
    }
    this.prompt.focus();
  }
  registerShortcuts() {
    this.shortcuts.set(UI.KeyboardShortcut.KeyboardShortcut.makeKey("u", UI.KeyboardShortcut.Modifiers.Ctrl), this.clearPromptBackwards.bind(this));
  }
  clearPromptBackwards() {
    this.prompt.clear();
  }
  promptKeyDown(event) {
    const keyboardEvent = event;
    if (keyboardEvent.key === "PageUp") {
      this.updateStickToBottomOnWheel();
      return;
    }
    const shortcut = UI.KeyboardShortcut.KeyboardShortcut.makeKeyFromEvent(keyboardEvent);
    const handler = this.shortcuts.get(shortcut);
    if (handler) {
      handler();
      keyboardEvent.preventDefault();
    }
  }
  printResult(result, originatingConsoleMessage, exceptionDetails) {
    if (!result) {
      return;
    }
    const level = Boolean(exceptionDetails) ? Protocol.Log.LogEntryLevel.Error : Protocol.Log.LogEntryLevel.Info;
    let message;
    if (!exceptionDetails) {
      message = new SDK.ConsoleModel.ConsoleMessage(result.runtimeModel(), Protocol.Log.LogEntrySource.Javascript, level, "", { type: SDK.ConsoleModel.FrontendMessageType.Result, parameters: [result] });
    } else {
      message = SDK.ConsoleModel.ConsoleMessage.fromException(result.runtimeModel(), exceptionDetails, SDK.ConsoleModel.FrontendMessageType.Result, void 0, void 0);
    }
    message.setOriginatingMessage(originatingConsoleMessage);
    SDK.ConsoleModel.ConsoleModel.instance().addMessage(message);
  }
  commandEvaluated(event) {
    const { data } = event;
    this.prompt.history().pushHistoryItem(data.commandMessage.messageText);
    this.consoleHistorySetting.set(this.prompt.history().historyData().slice(-persistedHistorySize));
    this.printResult(data.result, data.commandMessage, data.exceptionDetails);
  }
  elementsToRestoreScrollPositionsFor() {
    return [this.messagesElement];
  }
  searchCanceled() {
    this.cleanupAfterSearch();
    for (const message of this.visibleViewMessages) {
      message.setSearchRegex(null);
    }
    this.currentMatchRangeIndex = -1;
    this.regexMatchRanges = [];
    this.searchRegex = null;
    this.viewport.refresh();
  }
  performSearch(searchConfig, shouldJump, jumpBackwards) {
    this.searchCanceled();
    this.searchableViewInternal.updateSearchMatchesCount(0);
    this.searchRegex = searchConfig.toSearchRegex(true).regex;
    this.regexMatchRanges = [];
    this.currentMatchRangeIndex = -1;
    if (shouldJump) {
      this.searchShouldJumpBackwards = Boolean(jumpBackwards);
    }
    this.searchProgressIndicator = new UI.ProgressIndicator.ProgressIndicator();
    this.searchProgressIndicator.setTitle(i18nString(UIStrings.searching));
    this.searchProgressIndicator.setTotalWork(this.visibleViewMessages.length);
    this.progressToolbarItem.element.appendChild(this.searchProgressIndicator.element);
    this.innerSearch(0);
  }
  cleanupAfterSearch() {
    delete this.searchShouldJumpBackwards;
    if (this.innerSearchTimeoutId) {
      clearTimeout(this.innerSearchTimeoutId);
      delete this.innerSearchTimeoutId;
    }
    if (this.searchProgressIndicator) {
      this.searchProgressIndicator.done();
      delete this.searchProgressIndicator;
    }
  }
  searchFinishedForTests() {
  }
  innerSearch(index) {
    delete this.innerSearchTimeoutId;
    if (this.searchProgressIndicator && this.searchProgressIndicator.isCanceled()) {
      this.cleanupAfterSearch();
      return;
    }
    const startTime = Date.now();
    for (; index < this.visibleViewMessages.length && Date.now() - startTime < 100; ++index) {
      this.searchMessage(index);
    }
    this.searchableViewInternal.updateSearchMatchesCount(this.regexMatchRanges.length);
    if (typeof this.searchShouldJumpBackwards !== "undefined" && this.regexMatchRanges.length) {
      this.jumpToMatch(this.searchShouldJumpBackwards ? -1 : 0);
      delete this.searchShouldJumpBackwards;
    }
    if (index === this.visibleViewMessages.length) {
      this.cleanupAfterSearch();
      window.setTimeout(this.searchFinishedForTests.bind(this), 0);
      return;
    }
    this.innerSearchTimeoutId = window.setTimeout(this.innerSearch.bind(this, index), 100);
    if (this.searchProgressIndicator) {
      this.searchProgressIndicator.setWorked(index);
    }
  }
  searchMessage(index) {
    const message = this.visibleViewMessages[index];
    message.setSearchRegex(this.searchRegex);
    for (let i = 0; i < message.searchCount(); ++i) {
      this.regexMatchRanges.push({ messageIndex: index, matchIndex: i });
    }
  }
  jumpToNextSearchResult() {
    this.jumpToMatch(this.currentMatchRangeIndex + 1);
  }
  jumpToPreviousSearchResult() {
    this.jumpToMatch(this.currentMatchRangeIndex - 1);
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return true;
  }
  jumpToMatch(index) {
    if (!this.regexMatchRanges.length) {
      return;
    }
    let matchRange;
    if (this.currentMatchRangeIndex >= 0) {
      matchRange = this.regexMatchRanges[this.currentMatchRangeIndex];
      const message2 = this.visibleViewMessages[matchRange.messageIndex];
      message2.searchHighlightNode(matchRange.matchIndex).classList.remove(UI.UIUtils.highlightedCurrentSearchResultClassName);
    }
    index = Platform.NumberUtilities.mod(index, this.regexMatchRanges.length);
    this.currentMatchRangeIndex = index;
    this.searchableViewInternal.updateCurrentMatchIndex(index);
    matchRange = this.regexMatchRanges[index];
    const message = this.visibleViewMessages[matchRange.messageIndex];
    const highlightNode = message.searchHighlightNode(matchRange.matchIndex);
    highlightNode.classList.add(UI.UIUtils.highlightedCurrentSearchResultClassName);
    this.viewport.scrollItemIntoView(matchRange.messageIndex);
    highlightNode.scrollIntoViewIfNeeded();
  }
  updateStickToBottomOnPointerDown(isRightClick) {
    this.muteViewportUpdates = !isRightClick;
    this.viewport.setStickToBottom(false);
    if (this.waitForScrollTimeout) {
      clearTimeout(this.waitForScrollTimeout);
      delete this.waitForScrollTimeout;
    }
  }
  updateStickToBottomOnPointerUp() {
    if (!this.muteViewportUpdates) {
      return;
    }
    this.waitForScrollTimeout = window.setTimeout(updateViewportState.bind(this), 200);
    function updateViewportState() {
      this.muteViewportUpdates = false;
      if (this.isShowing()) {
        this.viewport.setStickToBottom(this.isScrolledToBottom());
      }
      if (this.maybeDirtyWhileMuted) {
        this.scheduleViewportRefresh();
        delete this.maybeDirtyWhileMuted;
      }
      delete this.waitForScrollTimeout;
      this.updateViewportStickinessForTest();
    }
  }
  updateViewportStickinessForTest() {
  }
  updateStickToBottomOnWheel() {
    this.updateStickToBottomOnPointerDown();
    this.updateStickToBottomOnPointerUp();
  }
  promptTextChanged() {
    const oldStickToBottom = this.viewport.stickToBottom();
    const willStickToBottom = this.isScrolledToBottom();
    this.viewport.setStickToBottom(willStickToBottom);
    if (willStickToBottom && !oldStickToBottom) {
      this.scheduleViewportRefresh();
    }
    this.promptTextChangedForTest();
  }
  promptTextChangedForTest() {
  }
  isScrolledToBottom() {
    const distanceToPromptEditorBottom = this.messagesElement.scrollHeight - this.messagesElement.scrollTop - this.messagesElement.clientHeight - this.prompt.belowEditorElement().offsetHeight;
    return distanceToPromptEditorBottom <= 2;
  }
}
globalThis.Console = globalThis.Console || {};
globalThis.Console.ConsoleView = ConsoleView;
const persistedHistorySize = 300;
export class ConsoleViewFilter {
  filterChanged;
  messageLevelFiltersSetting;
  hideNetworkMessagesSetting;
  filterByExecutionContextSetting;
  suggestionBuilder;
  textFilterUI;
  textFilterSetting;
  filterParser;
  currentFilter;
  levelLabels;
  levelMenuButton;
  constructor(filterChangedCallback) {
    this.filterChanged = filterChangedCallback;
    this.messageLevelFiltersSetting = ConsoleViewFilter.levelFilterSetting();
    this.hideNetworkMessagesSetting = Common.Settings.Settings.instance().moduleSetting("hideNetworkMessages");
    this.filterByExecutionContextSetting = Common.Settings.Settings.instance().moduleSetting("selectedContextFilterEnabled");
    this.messageLevelFiltersSetting.addChangeListener(this.onFilterChanged.bind(this));
    this.hideNetworkMessagesSetting.addChangeListener(this.onFilterChanged.bind(this));
    this.filterByExecutionContextSetting.addChangeListener(this.onFilterChanged.bind(this));
    UI.Context.Context.instance().addFlavorChangeListener(SDK.RuntimeModel.ExecutionContext, this.onFilterChanged, this);
    const filterKeys = Object.values(FilterType);
    this.suggestionBuilder = new UI.FilterSuggestionBuilder.FilterSuggestionBuilder(filterKeys);
    this.textFilterUI = new UI.Toolbar.ToolbarInput(i18nString(UIStrings.filter), "", 1, 1, i18nString(UIStrings.egEventdCdnUrlacom), this.suggestionBuilder.completions.bind(this.suggestionBuilder), true);
    this.textFilterSetting = Common.Settings.Settings.instance().createSetting("console.textFilter", "");
    if (this.textFilterSetting.get()) {
      this.textFilterUI.setValue(this.textFilterSetting.get());
    }
    this.textFilterUI.addEventListener(UI.Toolbar.ToolbarInput.Event.TextChanged, () => {
      this.textFilterSetting.set(this.textFilterUI.value());
      this.onFilterChanged();
    });
    this.filterParser = new TextUtils.TextUtils.FilterParser(filterKeys);
    this.currentFilter = new ConsoleFilter("", [], null, this.messageLevelFiltersSetting.get());
    this.updateCurrentFilter();
    this.levelLabels = /* @__PURE__ */ new Map([
      [Protocol.Log.LogEntryLevel.Verbose, i18nString(UIStrings.verbose)],
      [Protocol.Log.LogEntryLevel.Info, i18nString(UIStrings.info)],
      [Protocol.Log.LogEntryLevel.Warning, i18nString(UIStrings.warnings)],
      [Protocol.Log.LogEntryLevel.Error, i18nString(UIStrings.errors)]
    ]);
    this.levelMenuButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.logLevels));
    this.levelMenuButton.turnIntoSelect();
    this.levelMenuButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.showLevelContextMenu.bind(this));
    UI.ARIAUtils.markAsMenuButton(this.levelMenuButton.element);
    this.updateLevelMenuButtonText();
    this.messageLevelFiltersSetting.addChangeListener(this.updateLevelMenuButtonText.bind(this));
  }
  onMessageAdded(message) {
    if (message.type === SDK.ConsoleModel.FrontendMessageType.Command || message.type === SDK.ConsoleModel.FrontendMessageType.Result || message.isGroupMessage()) {
      return;
    }
    if (message.context) {
      this.suggestionBuilder.addItem(FilterType.Context, message.context);
    }
    if (message.source) {
      this.suggestionBuilder.addItem(FilterType.Source, message.source);
    }
    if (message.url) {
      this.suggestionBuilder.addItem(FilterType.Url, message.url);
    }
  }
  setLevelMenuOverridden(overridden) {
    this.levelMenuButton.setEnabled(!overridden);
    if (overridden) {
      this.levelMenuButton.setTitle(i18nString(UIStrings.overriddenByFilterSidebar));
    } else {
      this.updateLevelMenuButtonText();
    }
  }
  static levelFilterSetting() {
    return Common.Settings.Settings.instance().createSetting("messageLevelFilters", ConsoleFilter.defaultLevelsFilterValue());
  }
  updateCurrentFilter() {
    const parsedFilters = this.filterParser.parse(this.textFilterUI.value());
    if (this.hideNetworkMessagesSetting.get()) {
      parsedFilters.push({ key: FilterType.Source, text: Protocol.Log.LogEntrySource.Network, negative: true, regex: void 0 });
    }
    this.currentFilter.executionContext = this.filterByExecutionContextSetting.get() ? UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext) : null;
    this.currentFilter.parsedFilters = parsedFilters;
    this.currentFilter.levelsMask = this.messageLevelFiltersSetting.get();
  }
  onFilterChanged() {
    this.updateCurrentFilter();
    this.filterChanged();
  }
  updateLevelMenuButtonText() {
    let isAll = true;
    let isDefault = true;
    const allValue = ConsoleFilter.allLevelsFilterValue();
    const defaultValue = ConsoleFilter.defaultLevelsFilterValue();
    let text = null;
    const levels = this.messageLevelFiltersSetting.get();
    const allLevels = {
      Verbose: Protocol.Log.LogEntryLevel.Verbose,
      Info: Protocol.Log.LogEntryLevel.Info,
      Warning: Protocol.Log.LogEntryLevel.Warning,
      Error: Protocol.Log.LogEntryLevel.Error
    };
    for (const name of Object.values(allLevels)) {
      isAll = isAll && levels[name] === allValue[name];
      isDefault = isDefault && levels[name] === defaultValue[name];
      if (levels[name]) {
        text = text ? i18nString(UIStrings.customLevels) : i18nString(UIStrings.sOnly, { PH1: String(this.levelLabels.get(name)) });
      }
    }
    if (isAll) {
      text = i18nString(UIStrings.allLevels);
    } else if (isDefault) {
      text = i18nString(UIStrings.defaultLevels);
    } else {
      text = text || i18nString(UIStrings.hideAll);
    }
    this.levelMenuButton.element.classList.toggle("warning", !isAll && !isDefault);
    this.levelMenuButton.setText(text);
    this.levelMenuButton.setTitle(i18nString(UIStrings.logLevelS, { PH1: text }));
  }
  showLevelContextMenu(event) {
    const mouseEvent = event.data;
    const setting = this.messageLevelFiltersSetting;
    const levels = setting.get();
    const contextMenu = new UI.ContextMenu.ContextMenu(mouseEvent, {
      useSoftMenu: true,
      x: this.levelMenuButton.element.totalOffsetLeft(),
      y: this.levelMenuButton.element.totalOffsetTop() + this.levelMenuButton.element.offsetHeight
    });
    contextMenu.headerSection().appendItem(i18nString(UIStrings.default), () => setting.set(ConsoleFilter.defaultLevelsFilterValue()));
    for (const [level, levelText] of this.levelLabels.entries()) {
      contextMenu.defaultSection().appendCheckboxItem(levelText, toggleShowLevel.bind(null, level), levels[level]);
    }
    void contextMenu.show();
    function toggleShowLevel(level) {
      levels[level] = !levels[level];
      setting.set(levels);
    }
  }
  addMessageURLFilter(url) {
    if (!url) {
      return;
    }
    const suffix = this.textFilterUI.value() ? ` ${this.textFilterUI.value()}` : "";
    this.textFilterUI.setValue(`-url:${url}${suffix}`);
    this.textFilterSetting.set(this.textFilterUI.value());
    this.onFilterChanged();
  }
  shouldBeVisible(viewMessage) {
    return this.currentFilter.shouldBeVisible(viewMessage);
  }
  clear() {
    this.suggestionBuilder.clear();
  }
  reset() {
    this.messageLevelFiltersSetting.set(ConsoleFilter.defaultLevelsFilterValue());
    this.filterByExecutionContextSetting.set(false);
    this.hideNetworkMessagesSetting.set(false);
    this.textFilterUI.setValue("");
    this.onFilterChanged();
  }
}
let actionDelegateInstance;
export class ActionDelegate {
  handleAction(_context, actionId) {
    switch (actionId) {
      case "console.show":
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
        Common.Console.Console.instance().show();
        ConsoleView.instance().focusPrompt();
        return true;
      case "console.clear":
        ConsoleView.clearConsole();
        return true;
      case "console.clear.history":
        ConsoleView.instance().clearHistory();
        return true;
      case "console.create-pin":
        ConsoleView.instance().pinPane.addPin("", true);
        return true;
    }
    return false;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!actionDelegateInstance || forceNew) {
      actionDelegateInstance = new ActionDelegate();
    }
    return actionDelegateInstance;
  }
}
const messagesSortedBySymbol = /* @__PURE__ */ new WeakMap();
const consoleMessageToViewMessage = /* @__PURE__ */ new WeakMap();
//# sourceMappingURL=ConsoleView.js.map
