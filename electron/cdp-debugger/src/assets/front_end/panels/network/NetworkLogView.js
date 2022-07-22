import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as HAR from "../../models/har/har.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Logs from "../../models/logs/logs.js";
import * as Persistence from "../../models/persistence/persistence.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import * as Sources from "../../panels/sources/sources.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ThemeSupport from "../../ui/legacy/theme_support/theme_support.js";
import networkLogViewStyles from "./networkLogView.css.js";
import { Events, NetworkGroupNode, NetworkRequestNode } from "./NetworkDataGridNode.js";
import { NetworkFrameGrouper } from "./NetworkFrameGrouper.js";
import { NetworkLogViewColumns } from "./NetworkLogViewColumns.js";
import {
  NetworkTimeBoundary,
  NetworkTransferDurationCalculator,
  NetworkTransferTimeCalculator
} from "./NetworkTimeCalculator.js";
const UIStrings = {
  invertFilter: "Invert",
  invertsFilter: "Inverts the search filter",
  hideDataUrls: "Hide data URLs",
  hidesDataAndBlobUrls: "Hides data: and blob: URLs",
  resourceTypesToInclude: "Resource types to include",
  hasBlockedCookies: "Has blocked cookies",
  onlyShowRequestsWithBlocked: "Only show requests with blocked response cookies",
  blockedRequests: "Blocked Requests",
  onlyShowBlockedRequests: "Only show blocked requests",
  thirdParty: "3rd-party requests",
  onlyShowThirdPartyRequests: "Shows only requests with origin different from page origin",
  dropHarFilesHere: "Drop HAR files here",
  recordingNetworkActivity: "Recording network activity\u2026",
  performARequestOrHitSToRecordThe: "Perform a request or hit {PH1} to record the reload.",
  recordToDisplayNetworkActivity: "Record network log ({PH1}) to display network activity.",
  learnMore: "Learn more",
  networkDataAvailable: "Network Data Available",
  sSRequests: "{PH1} / {PH2} requests",
  sSTransferred: "{PH1} / {PH2} transferred",
  sBSBTransferredOverNetwork: "{PH1} B / {PH2} B transferred over network",
  sSResources: "{PH1} / {PH2} resources",
  sBSBResourcesLoadedByThePage: "{PH1} B / {PH2} B resources loaded by the page",
  sRequests: "{PH1} requests",
  sTransferred: "{PH1} transferred",
  sBTransferredOverNetwork: "{PH1} B transferred over network",
  sResources: "{PH1} resources",
  sBResourcesLoadedByThePage: "{PH1} B resources loaded by the page",
  finishS: "Finish: {PH1}",
  domcontentloadedS: "DOMContentLoaded: {PH1}",
  loadS: "Load: {PH1}",
  copy: "Copy",
  copyRequestHeaders: "Copy request headers",
  copyResponseHeaders: "Copy response headers",
  copyResponse: "Copy response",
  copyStacktrace: "Copy stack trace",
  copyAsPowershell: "Copy as `PowerShell`",
  copyAsFetch: "Copy as `fetch`",
  copyAsNodejsFetch: "Copy as `Node.js` `fetch`",
  copyAsCurlCmd: "Copy as `cURL` (`cmd`)",
  copyAsCurlBash: "Copy as `cURL` (`bash`)",
  copyAllAsPowershell: "Copy all as `PowerShell`",
  copyAllAsFetch: "Copy all as `fetch`",
  copyAllAsNodejsFetch: "Copy all as `Node.js` `fetch`",
  copyAllAsCurlCmd: "Copy all as `cURL` (`cmd`)",
  copyAllAsCurlBash: "Copy all as `cURL` (`bash`)",
  copyAsCurl: "Copy as `cURL`",
  copyAllAsCurl: "Copy all as `cURL`",
  copyAllAsHar: "Copy all as `HAR`",
  saveAllAsHarWithContent: "Save all as `HAR` with content",
  clearBrowserCache: "Clear browser cache",
  clearBrowserCookies: "Clear browser cookies",
  blockRequestUrl: "Block request URL",
  unblockS: "Unblock {PH1}",
  blockRequestDomain: "Block request domain",
  replayXhr: "Replay XHR",
  areYouSureYouWantToClearBrowser: "Are you sure you want to clear browser cache?",
  areYouSureYouWantToClearBrowserCookies: "Are you sure you want to clear browser cookies?",
  createResponseHeaderOverride: "Create response header override"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/NetworkLogView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
var FetchStyle = /* @__PURE__ */ ((FetchStyle2) => {
  FetchStyle2[FetchStyle2["Browser"] = 0] = "Browser";
  FetchStyle2[FetchStyle2["NodeJs"] = 1] = "NodeJs";
  return FetchStyle2;
})(FetchStyle || {});
export class NetworkLogView extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
  networkInvertFilterSetting;
  networkHideDataURLSetting;
  networkShowIssuesOnlySetting;
  networkOnlyBlockedRequestsSetting;
  networkOnlyThirdPartySetting;
  networkResourceTypeFiltersSetting;
  rawRowHeight;
  progressBarContainer;
  networkLogLargeRowsSetting;
  rowHeightInternal;
  timeCalculatorInternal;
  durationCalculator;
  calculatorInternal;
  columns;
  staleRequests;
  mainRequestLoadTime;
  mainRequestDOMContentLoadedTime;
  filters;
  timeFilter;
  hoveredNodeInternal;
  recordingHint;
  refreshRequestId;
  highlightedNode;
  linkifierInternal;
  recording;
  needsRefresh;
  headerHeightInternal;
  groupLookups;
  activeGroupLookup;
  textFilterUI;
  invertFilterUI;
  dataURLFilterUI;
  resourceCategoryFilterUI;
  onlyIssuesFilterUI;
  onlyBlockedRequestsUI;
  onlyThirdPartyFilterUI;
  filterParser;
  suggestionBuilder;
  dataGrid;
  summaryToolbar;
  filterBar;
  textFilterSetting;
  constructor(filterBar, progressBarContainer, networkLogLargeRowsSetting) {
    super();
    this.setMinimumSize(50, 64);
    this.element.id = "network-container";
    this.element.classList.add("no-node-selected");
    this.networkInvertFilterSetting = Common.Settings.Settings.instance().createSetting("networkInvertFilter", false);
    this.networkHideDataURLSetting = Common.Settings.Settings.instance().createSetting("networkHideDataURL", false);
    this.networkShowIssuesOnlySetting = Common.Settings.Settings.instance().createSetting("networkShowIssuesOnly", false);
    this.networkOnlyBlockedRequestsSetting = Common.Settings.Settings.instance().createSetting("networkOnlyBlockedRequests", false);
    this.networkOnlyThirdPartySetting = Common.Settings.Settings.instance().createSetting("networkOnlyThirdPartySetting", false);
    this.networkResourceTypeFiltersSetting = Common.Settings.Settings.instance().createSetting("networkResourceTypeFilters", {});
    this.rawRowHeight = 0;
    this.progressBarContainer = progressBarContainer;
    this.networkLogLargeRowsSetting = networkLogLargeRowsSetting;
    this.networkLogLargeRowsSetting.addChangeListener(updateRowHeight.bind(this), this);
    function updateRowHeight() {
      this.rawRowHeight = Boolean(this.networkLogLargeRowsSetting.get()) ? 41 : 21;
      this.rowHeightInternal = this.computeRowHeight();
    }
    this.rawRowHeight = 0;
    this.rowHeightInternal = 0;
    updateRowHeight.call(this);
    this.timeCalculatorInternal = new NetworkTransferTimeCalculator();
    this.durationCalculator = new NetworkTransferDurationCalculator();
    this.calculatorInternal = this.timeCalculatorInternal;
    this.columns = new NetworkLogViewColumns(this, this.timeCalculatorInternal, this.durationCalculator, networkLogLargeRowsSetting);
    this.columns.show(this.element);
    this.staleRequests = /* @__PURE__ */ new Set();
    this.mainRequestLoadTime = -1;
    this.mainRequestDOMContentLoadedTime = -1;
    this.filters = [];
    this.timeFilter = null;
    this.hoveredNodeInternal = null;
    this.recordingHint = null;
    this.refreshRequestId = null;
    this.highlightedNode = null;
    this.linkifierInternal = new Components.Linkifier.Linkifier();
    this.recording = false;
    this.needsRefresh = false;
    this.headerHeightInternal = 0;
    this.groupLookups = /* @__PURE__ */ new Map();
    this.groupLookups.set("Frame", new NetworkFrameGrouper(this));
    this.activeGroupLookup = null;
    this.textFilterUI = new UI.FilterBar.TextFilterUI();
    this.textFilterUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged, this);
    filterBar.addFilter(this.textFilterUI);
    this.invertFilterUI = new UI.FilterBar.CheckboxFilterUI("invert-filter", i18nString(UIStrings.invertFilter), true, this.networkInvertFilterSetting);
    this.invertFilterUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged.bind(this), this);
    UI.Tooltip.Tooltip.install(this.invertFilterUI.element(), i18nString(UIStrings.invertsFilter));
    filterBar.addFilter(this.invertFilterUI);
    this.dataURLFilterUI = new UI.FilterBar.CheckboxFilterUI("hide-data-url", i18nString(UIStrings.hideDataUrls), true, this.networkHideDataURLSetting);
    this.dataURLFilterUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged.bind(this), this);
    UI.Tooltip.Tooltip.install(this.dataURLFilterUI.element(), i18nString(UIStrings.hidesDataAndBlobUrls));
    filterBar.addFilter(this.dataURLFilterUI);
    const filterItems = Object.values(Common.ResourceType.resourceCategories).map((category) => ({ name: category.title(), label: () => category.shortTitle(), title: category.title() }));
    this.resourceCategoryFilterUI = new UI.FilterBar.NamedBitSetFilterUI(filterItems, this.networkResourceTypeFiltersSetting);
    UI.ARIAUtils.setAccessibleName(this.resourceCategoryFilterUI.element(), i18nString(UIStrings.resourceTypesToInclude));
    this.resourceCategoryFilterUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged.bind(this), this);
    filterBar.addFilter(this.resourceCategoryFilterUI);
    this.onlyIssuesFilterUI = new UI.FilterBar.CheckboxFilterUI("only-show-issues", i18nString(UIStrings.hasBlockedCookies), true, this.networkShowIssuesOnlySetting);
    this.onlyIssuesFilterUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged.bind(this), this);
    UI.Tooltip.Tooltip.install(this.onlyIssuesFilterUI.element(), i18nString(UIStrings.onlyShowRequestsWithBlocked));
    filterBar.addFilter(this.onlyIssuesFilterUI);
    this.onlyBlockedRequestsUI = new UI.FilterBar.CheckboxFilterUI("only-show-blocked-requests", i18nString(UIStrings.blockedRequests), true, this.networkOnlyBlockedRequestsSetting);
    this.onlyBlockedRequestsUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged.bind(this), this);
    UI.Tooltip.Tooltip.install(this.onlyBlockedRequestsUI.element(), i18nString(UIStrings.onlyShowBlockedRequests));
    filterBar.addFilter(this.onlyBlockedRequestsUI);
    this.onlyThirdPartyFilterUI = new UI.FilterBar.CheckboxFilterUI("only-show-third-party", i18nString(UIStrings.thirdParty), true, this.networkOnlyThirdPartySetting);
    this.onlyThirdPartyFilterUI.addEventListener(UI.FilterBar.FilterUIEvents.FilterChanged, this.filterChanged.bind(this), this);
    UI.Tooltip.Tooltip.install(this.onlyThirdPartyFilterUI.element(), i18nString(UIStrings.onlyShowThirdPartyRequests));
    filterBar.addFilter(this.onlyThirdPartyFilterUI);
    this.filterParser = new TextUtils.TextUtils.FilterParser(searchKeys);
    this.suggestionBuilder = new UI.FilterSuggestionBuilder.FilterSuggestionBuilder(searchKeys, NetworkLogView.sortSearchValues);
    this.resetSuggestionBuilder();
    this.dataGrid = this.columns.dataGrid();
    this.setupDataGrid();
    this.columns.sortByCurrentColumn();
    filterBar.filterButton().addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.dataGrid.scheduleUpdate.bind(this.dataGrid, true));
    this.summaryToolbar = new UI.Toolbar.Toolbar("network-summary-bar", this.element);
    this.summaryToolbar.element.setAttribute("role", "status");
    new UI.DropTarget.DropTarget(this.element, [UI.DropTarget.Type.File], i18nString(UIStrings.dropHarFilesHere), this.handleDrop.bind(this));
    Common.Settings.Settings.instance().moduleSetting("networkColorCodeResourceTypes").addChangeListener(this.invalidateAllItems.bind(this, false), this);
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.NetworkManager.NetworkManager, this);
    Logs.NetworkLog.NetworkLog.instance().addEventListener(Logs.NetworkLog.Events.RequestAdded, this.onRequestUpdated, this);
    Logs.NetworkLog.NetworkLog.instance().addEventListener(Logs.NetworkLog.Events.RequestUpdated, this.onRequestUpdated, this);
    Logs.NetworkLog.NetworkLog.instance().addEventListener(Logs.NetworkLog.Events.Reset, this.reset, this);
    this.updateGroupByFrame();
    Common.Settings.Settings.instance().moduleSetting("network.group-by-frame").addChangeListener(() => this.updateGroupByFrame());
    this.filterBar = filterBar;
    this.textFilterSetting = Common.Settings.Settings.instance().createSetting("networkTextFilter", "");
    if (this.textFilterSetting.get()) {
      this.textFilterUI.setValue(this.textFilterSetting.get());
    }
  }
  updateGroupByFrame() {
    const value = Common.Settings.Settings.instance().moduleSetting("network.group-by-frame").get();
    this.setGrouping(value ? "Frame" : null);
  }
  static sortSearchValues(key, values) {
    if (key === NetworkForward.UIFilter.FilterType.Priority) {
      values.sort((a, b) => {
        const aPriority = PerfUI.NetworkPriorities.uiLabelToNetworkPriority(a);
        const bPriority = PerfUI.NetworkPriorities.uiLabelToNetworkPriority(b);
        return PerfUI.NetworkPriorities.networkPriorityWeight(aPriority) - PerfUI.NetworkPriorities.networkPriorityWeight(bPriority);
      });
    } else {
      values.sort();
    }
  }
  static negativeFilter(filter, request) {
    return !filter(request);
  }
  static requestPathFilter(regex, request) {
    if (!regex) {
      return false;
    }
    return regex.test(request.path() + "/" + request.name());
  }
  static subdomains(domain) {
    const result = [domain];
    let indexOfPeriod = domain.indexOf(".");
    while (indexOfPeriod !== -1) {
      result.push("*" + domain.substring(indexOfPeriod));
      indexOfPeriod = domain.indexOf(".", indexOfPeriod + 1);
    }
    return result;
  }
  static createRequestDomainFilter(value) {
    const escapedPattern = value.split("*").map(Platform.StringUtilities.escapeForRegExp).join(".*");
    return NetworkLogView.requestDomainFilter.bind(null, new RegExp("^" + escapedPattern + "$", "i"));
  }
  static requestDomainFilter(regex, request) {
    return regex.test(request.domain);
  }
  static runningRequestFilter(request) {
    return !request.finished;
  }
  static fromCacheRequestFilter(request) {
    return request.cached();
  }
  static interceptedByServiceWorkerFilter(request) {
    return request.fetchedViaServiceWorker;
  }
  static initiatedByServiceWorkerFilter(request) {
    return request.initiatedByServiceWorker();
  }
  static requestResponseHeaderFilter(value, request) {
    return request.responseHeaderValue(value) !== void 0;
  }
  static requestResponseHeaderSetCookieFilter(value, request) {
    return Boolean(request.responseHeaderValue("Set-Cookie")?.includes(value));
  }
  static requestMethodFilter(value, request) {
    return request.requestMethod === value;
  }
  static requestPriorityFilter(value, request) {
    return request.priority() === value;
  }
  static requestMimeTypeFilter(value, request) {
    return request.mimeType === value;
  }
  static requestMixedContentFilter(value, request) {
    if (value === NetworkForward.UIFilter.MixedContentFilterValues.Displayed) {
      return request.mixedContentType === Protocol.Security.MixedContentType.OptionallyBlockable;
    }
    if (value === NetworkForward.UIFilter.MixedContentFilterValues.Blocked) {
      return request.mixedContentType === Protocol.Security.MixedContentType.Blockable && request.wasBlocked();
    }
    if (value === NetworkForward.UIFilter.MixedContentFilterValues.BlockOverridden) {
      return request.mixedContentType === Protocol.Security.MixedContentType.Blockable && !request.wasBlocked();
    }
    if (value === NetworkForward.UIFilter.MixedContentFilterValues.All) {
      return request.mixedContentType !== Protocol.Security.MixedContentType.None;
    }
    return false;
  }
  static requestSchemeFilter(value, request) {
    return request.scheme === value;
  }
  static requestCookieDomainFilter(value, request) {
    return request.allCookiesIncludingBlockedOnes().some((cookie) => cookie.domain() === value);
  }
  static requestCookieNameFilter(value, request) {
    return request.allCookiesIncludingBlockedOnes().some((cookie) => cookie.name() === value);
  }
  static requestCookiePathFilter(value, request) {
    return request.allCookiesIncludingBlockedOnes().some((cookie) => cookie.path() === value);
  }
  static requestCookieValueFilter(value, request) {
    return request.allCookiesIncludingBlockedOnes().some((cookie) => cookie.value() === value);
  }
  static requestSetCookieDomainFilter(value, request) {
    return request.responseCookies.some((cookie) => cookie.domain() === value);
  }
  static requestSetCookieNameFilter(value, request) {
    return request.responseCookies.some((cookie) => cookie.name() === value);
  }
  static requestSetCookieValueFilter(value, request) {
    return request.responseCookies.some((cookie) => cookie.value() === value);
  }
  static requestSizeLargerThanFilter(value, request) {
    return request.transferSize >= value;
  }
  static statusCodeFilter(value, request) {
    return String(request.statusCode) === value;
  }
  static getHTTPRequestsFilter(request) {
    return request.parsedURL.isValid && request.scheme in HTTPSchemas;
  }
  static resourceTypeFilter(value, request) {
    return request.resourceType().name() === value;
  }
  static requestUrlFilter(value, request) {
    const regex = new RegExp(Platform.StringUtilities.escapeForRegExp(value), "i");
    return regex.test(request.url());
  }
  static requestTimeFilter(windowStart, windowEnd, request) {
    if (request.issueTime() > windowEnd) {
      return false;
    }
    if (request.endTime !== -1 && request.endTime < windowStart) {
      return false;
    }
    return true;
  }
  static copyRequestHeaders(request) {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(request.requestHeadersText());
  }
  static copyResponseHeaders(request) {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(request.responseHeadersText);
  }
  static async copyResponse(request) {
    const contentData = await request.contentData();
    let content = contentData.content || "";
    if (!request.contentType().isTextType()) {
      content = TextUtils.ContentProvider.contentAsDataURL(content, request.mimeType, contentData.encoded);
    } else if (contentData.encoded && content) {
      content = window.atob(content);
    }
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(content);
  }
  handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    if (!items.length) {
      return;
    }
    const file = items[0].getAsFile();
    if (file) {
      void this.onLoadFromFile(file);
    }
  }
  async onLoadFromFile(file) {
    const outputStream = new Common.StringOutputStream.StringOutputStream();
    const reader = new Bindings.FileUtils.ChunkedFileReader(file, 1e7);
    const success = await reader.read(outputStream);
    if (!success) {
      const error = reader.error();
      if (error) {
        this.harLoadFailed(error.message);
      }
      return;
    }
    let harRoot;
    try {
      harRoot = new HAR.HARFormat.HARRoot(JSON.parse(outputStream.data()));
    } catch (e) {
      this.harLoadFailed(e);
      return;
    }
    Logs.NetworkLog.NetworkLog.instance().importRequests(HAR.Importer.Importer.requestsFromHARLog(harRoot.log));
  }
  harLoadFailed(message) {
    Common.Console.Console.instance().error("Failed to load HAR file with following error: " + message);
  }
  setGrouping(groupKey) {
    if (this.activeGroupLookup) {
      this.activeGroupLookup.reset();
    }
    const groupLookup = groupKey ? this.groupLookups.get(groupKey) || null : null;
    this.activeGroupLookup = groupLookup;
    this.invalidateAllItems();
  }
  computeRowHeight() {
    return Math.round(this.rawRowHeight * window.devicePixelRatio) / window.devicePixelRatio;
  }
  nodeForRequest(request) {
    return networkRequestToNode.get(request) || null;
  }
  headerHeight() {
    return this.headerHeightInternal;
  }
  setRecording(recording) {
    this.recording = recording;
    this.updateSummaryBar();
  }
  modelAdded(networkManager) {
    if (networkManager.target().parentTarget()) {
      return;
    }
    const resourceTreeModel = networkManager.target().model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (resourceTreeModel) {
      resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.Load, this.loadEventFired, this);
      resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.DOMContentLoaded, this.domContentLoadedEventFired, this);
    }
  }
  modelRemoved(networkManager) {
    if (!networkManager.target().parentTarget()) {
      const resourceTreeModel = networkManager.target().model(SDK.ResourceTreeModel.ResourceTreeModel);
      if (resourceTreeModel) {
        resourceTreeModel.removeEventListener(SDK.ResourceTreeModel.Events.Load, this.loadEventFired, this);
        resourceTreeModel.removeEventListener(SDK.ResourceTreeModel.Events.DOMContentLoaded, this.domContentLoadedEventFired, this);
      }
    }
  }
  linkifier() {
    return this.linkifierInternal;
  }
  setWindow(start, end) {
    if (!start && !end) {
      this.timeFilter = null;
      this.timeCalculatorInternal.setWindow(null);
    } else {
      this.timeFilter = NetworkLogView.requestTimeFilter.bind(null, start, end);
      this.timeCalculatorInternal.setWindow(new NetworkTimeBoundary(start, end));
    }
    this.filterRequests();
  }
  resetFocus() {
    this.dataGrid.element.focus();
  }
  resetSuggestionBuilder() {
    this.suggestionBuilder.clear();
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Is, NetworkForward.UIFilter.IsFilterType.Running);
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Is, NetworkForward.UIFilter.IsFilterType.FromCache);
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Is, NetworkForward.UIFilter.IsFilterType.ServiceWorkerIntercepted);
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Is, NetworkForward.UIFilter.IsFilterType.ServiceWorkerInitiated);
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.LargerThan, "100");
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.LargerThan, "10k");
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.LargerThan, "1M");
    this.textFilterUI.setSuggestionProvider(this.suggestionBuilder.completions.bind(this.suggestionBuilder));
  }
  filterChanged() {
    this.removeAllNodeHighlights();
    this.parseFilterQuery(this.textFilterUI.value(), this.invertFilterUI.checked());
    this.filterRequests();
    this.textFilterSetting.set(this.textFilterUI.value());
  }
  async resetFilter() {
    this.textFilterUI.clear();
  }
  showRecordingHint() {
    this.hideRecordingHint();
    this.recordingHint = this.element.createChild("div", "network-status-pane fill");
    const hintText = this.recordingHint.createChild("div", "recording-hint");
    if (this.recording) {
      let reloadShortcutNode = null;
      const reloadShortcut = UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutsForAction("inspector_main.reload")[0];
      if (reloadShortcut) {
        reloadShortcutNode = this.recordingHint.createChild("b");
        reloadShortcutNode.textContent = reloadShortcut.title();
      }
      const recordingText = hintText.createChild("span");
      recordingText.textContent = i18nString(UIStrings.recordingNetworkActivity);
      if (reloadShortcutNode) {
        hintText.createChild("br");
        hintText.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.performARequestOrHitSToRecordThe, { PH1: reloadShortcutNode }));
      }
    } else {
      const recordNode = hintText.createChild("b");
      recordNode.textContent = UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutTitleForAction("network.toggle-recording") || "";
      hintText.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.recordToDisplayNetworkActivity, { PH1: recordNode }));
    }
    hintText.createChild("br");
    hintText.appendChild(UI.XLink.XLink.create("https://developer.chrome.com/docs/devtools/network/?utm_source=devtools&utm_campaign=2019Q1", i18nString(UIStrings.learnMore)));
    this.setHidden(true);
  }
  hideRecordingHint() {
    this.setHidden(false);
    if (this.recordingHint) {
      this.recordingHint.remove();
    }
    UI.ARIAUtils.alert(i18nString(UIStrings.networkDataAvailable));
    this.recordingHint = null;
  }
  setHidden(value) {
    this.columns.setHidden(value);
    UI.ARIAUtils.setHidden(this.summaryToolbar.element, value);
  }
  elementsToRestoreScrollPositionsFor() {
    if (!this.dataGrid) {
      return [];
    }
    return [this.dataGrid.scrollContainer];
  }
  columnExtensionResolved() {
    this.invalidateAllItems(true);
  }
  setupDataGrid() {
    this.dataGrid.setRowContextMenuCallback((contextMenu, node) => {
      const request = node.request();
      if (request) {
        this.handleContextMenuForRequest(contextMenu, request);
      }
    });
    this.dataGrid.setStickToBottom(true);
    this.dataGrid.setName("networkLog");
    this.dataGrid.setResizeMethod(DataGrid.DataGrid.ResizeMethod.Last);
    this.dataGrid.element.classList.add("network-log-grid");
    this.dataGrid.element.addEventListener("mousedown", this.dataGridMouseDown.bind(this), true);
    this.dataGrid.element.addEventListener("mousemove", this.dataGridMouseMove.bind(this), true);
    this.dataGrid.element.addEventListener("mouseleave", () => this.setHoveredNode(null), true);
    this.dataGrid.element.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" && this.dataGrid.selectedNode) {
        const initiatorLink = this.dataGrid.selectedNode.element().querySelector("span.devtools-link");
        if (initiatorLink) {
          initiatorLink.focus();
        }
      }
      if (isEnterOrSpaceKey(event)) {
        this.dispatchEventToListeners(Events.RequestActivated, { showPanel: true, takeFocus: true });
        event.consume(true);
      }
    });
    this.dataGrid.element.addEventListener("keyup", (event) => {
      if ((event.key === "r" || event.key === "R") && this.dataGrid.selectedNode) {
        const request = this.dataGrid.selectedNode.request();
        if (!request) {
          return;
        }
        if (SDK.NetworkManager.NetworkManager.canReplayRequest(request)) {
          SDK.NetworkManager.NetworkManager.replayRequest(request);
        }
      }
    });
    this.dataGrid.element.addEventListener("focus", this.onDataGridFocus.bind(this), true);
    this.dataGrid.element.addEventListener("blur", this.onDataGridBlur.bind(this), true);
    return this.dataGrid;
  }
  dataGridMouseMove(event) {
    const mouseEvent = event;
    const node = this.dataGrid.dataGridNodeFromNode(mouseEvent.target);
    const highlightInitiatorChain = mouseEvent.shiftKey;
    this.setHoveredNode(node, highlightInitiatorChain);
  }
  hoveredNode() {
    return this.hoveredNodeInternal;
  }
  setHoveredNode(node, highlightInitiatorChain) {
    if (this.hoveredNodeInternal) {
      this.hoveredNodeInternal.setHovered(false, false);
    }
    this.hoveredNodeInternal = node;
    if (this.hoveredNodeInternal) {
      this.hoveredNodeInternal.setHovered(true, Boolean(highlightInitiatorChain));
    }
  }
  dataGridMouseDown(event) {
    const mouseEvent = event;
    if (!this.dataGrid.selectedNode && mouseEvent.button) {
      mouseEvent.consume();
    }
  }
  updateSummaryBar() {
    this.hideRecordingHint();
    let transferSize = 0;
    let resourceSize = 0;
    let selectedNodeNumber = 0;
    let selectedTransferSize = 0;
    let selectedResourceSize = 0;
    let baseTime = -1;
    let maxTime = -1;
    let nodeCount = 0;
    for (const request of Logs.NetworkLog.NetworkLog.instance().requests()) {
      const node = networkRequestToNode.get(request);
      if (!node) {
        continue;
      }
      nodeCount++;
      const requestTransferSize = request.transferSize;
      transferSize += requestTransferSize;
      const requestResourceSize = request.resourceSize;
      resourceSize += requestResourceSize;
      if (!filteredNetworkRequests.has(node)) {
        selectedNodeNumber++;
        selectedTransferSize += requestTransferSize;
        selectedResourceSize += requestResourceSize;
      }
      const networkManager = SDK.NetworkManager.NetworkManager.forRequest(request);
      if (networkManager && request.url() === networkManager.target().inspectedURL() && request.resourceType() === Common.ResourceType.resourceTypes.Document && !networkManager.target().parentTarget()) {
        baseTime = request.startTime;
      }
      if (request.endTime > maxTime) {
        maxTime = request.endTime;
      }
    }
    if (!nodeCount) {
      this.showRecordingHint();
      return;
    }
    this.summaryToolbar.removeToolbarItems();
    const appendChunk = (chunk, title) => {
      const toolbarText = new UI.Toolbar.ToolbarText(chunk);
      toolbarText.setTitle(title ? title : chunk);
      this.summaryToolbar.appendToolbarItem(toolbarText);
      return toolbarText.element;
    };
    if (selectedNodeNumber !== nodeCount) {
      appendChunk(i18nString(UIStrings.sSRequests, { PH1: selectedNodeNumber, PH2: nodeCount }));
      this.summaryToolbar.appendSeparator();
      appendChunk(i18nString(UIStrings.sSTransferred, {
        PH1: Platform.NumberUtilities.bytesToString(selectedTransferSize),
        PH2: Platform.NumberUtilities.bytesToString(transferSize)
      }), i18nString(UIStrings.sBSBTransferredOverNetwork, { PH1: selectedTransferSize, PH2: transferSize }));
      this.summaryToolbar.appendSeparator();
      appendChunk(i18nString(UIStrings.sSResources, {
        PH1: Platform.NumberUtilities.bytesToString(selectedResourceSize),
        PH2: Platform.NumberUtilities.bytesToString(resourceSize)
      }), i18nString(UIStrings.sBSBResourcesLoadedByThePage, { PH1: selectedResourceSize, PH2: resourceSize }));
    } else {
      appendChunk(i18nString(UIStrings.sRequests, { PH1: nodeCount }));
      this.summaryToolbar.appendSeparator();
      appendChunk(i18nString(UIStrings.sTransferred, { PH1: Platform.NumberUtilities.bytesToString(transferSize) }), i18nString(UIStrings.sBTransferredOverNetwork, { PH1: transferSize }));
      this.summaryToolbar.appendSeparator();
      appendChunk(i18nString(UIStrings.sResources, { PH1: Platform.NumberUtilities.bytesToString(resourceSize) }), i18nString(UIStrings.sBResourcesLoadedByThePage, { PH1: resourceSize }));
    }
    if (baseTime !== -1 && maxTime !== -1) {
      this.summaryToolbar.appendSeparator();
      appendChunk(i18nString(UIStrings.finishS, { PH1: i18n.TimeUtilities.secondsToString(maxTime - baseTime) }));
      if (this.mainRequestDOMContentLoadedTime !== -1 && this.mainRequestDOMContentLoadedTime > baseTime) {
        this.summaryToolbar.appendSeparator();
        const domContentLoadedText = i18nString(UIStrings.domcontentloadedS, { PH1: i18n.TimeUtilities.secondsToString(this.mainRequestDOMContentLoadedTime - baseTime) });
        appendChunk(domContentLoadedText).style.color = NetworkLogView.getDCLEventColor();
      }
      if (this.mainRequestLoadTime !== -1) {
        this.summaryToolbar.appendSeparator();
        const loadText = i18nString(UIStrings.loadS, { PH1: i18n.TimeUtilities.secondsToString(this.mainRequestLoadTime - baseTime) });
        appendChunk(loadText).style.color = NetworkLogView.getLoadEventColor();
      }
    }
  }
  scheduleRefresh() {
    if (this.needsRefresh) {
      return;
    }
    this.needsRefresh = true;
    if (this.isShowing() && !this.refreshRequestId) {
      this.refreshRequestId = this.element.window().requestAnimationFrame(this.refresh.bind(this));
    }
  }
  addFilmStripFrames(times) {
    this.columns.addEventDividers(times, "network-frame-divider");
  }
  selectFilmStripFrame(time) {
    this.columns.selectFilmStripFrame(time);
  }
  clearFilmStripFrame() {
    this.columns.clearFilmStripFrame();
  }
  refreshIfNeeded() {
    if (this.needsRefresh) {
      this.refresh();
    }
  }
  invalidateAllItems(deferUpdate) {
    this.staleRequests = new Set(Logs.NetworkLog.NetworkLog.instance().requests());
    if (deferUpdate) {
      this.scheduleRefresh();
    } else {
      this.refresh();
    }
  }
  timeCalculator() {
    return this.timeCalculatorInternal;
  }
  calculator() {
    return this.calculatorInternal;
  }
  setCalculator(x) {
    if (!x || this.calculatorInternal === x) {
      return;
    }
    if (this.calculatorInternal !== x) {
      this.calculatorInternal = x;
      this.columns.setCalculator(this.calculatorInternal);
    }
    this.calculatorInternal.reset();
    if (this.calculatorInternal.startAtZero) {
      this.columns.hideEventDividers();
    } else {
      this.columns.showEventDividers();
    }
    this.invalidateAllItems();
  }
  loadEventFired(event) {
    if (!this.recording) {
      return;
    }
    const time = event.data.loadTime;
    if (time) {
      this.mainRequestLoadTime = time;
      this.columns.addEventDividers([time], "network-load-divider");
    }
  }
  domContentLoadedEventFired(event) {
    if (!this.recording) {
      return;
    }
    const { data } = event;
    if (data) {
      this.mainRequestDOMContentLoadedTime = data;
      this.columns.addEventDividers([data], "network-dcl-divider");
    }
  }
  wasShown() {
    this.refreshIfNeeded();
    this.registerCSSFiles([networkLogViewStyles]);
    this.columns.wasShown();
  }
  willHide() {
    this.columns.willHide();
  }
  onResize() {
    this.rowHeightInternal = this.computeRowHeight();
  }
  flatNodesList() {
    const rootNode = this.dataGrid.rootNode();
    return rootNode.flatChildren();
  }
  onDataGridFocus() {
    if (this.dataGrid.element.matches(":focus-visible")) {
      this.element.classList.add("grid-focused");
    }
    this.updateNodeBackground();
  }
  onDataGridBlur() {
    this.element.classList.remove("grid-focused");
    this.updateNodeBackground();
  }
  updateNodeBackground() {
    if (this.dataGrid.selectedNode) {
      this.dataGrid.selectedNode.updateBackgroundColor();
    }
  }
  updateNodeSelectedClass(isSelected) {
    if (isSelected) {
      this.element.classList.remove("no-node-selected");
    } else {
      this.element.classList.add("no-node-selected");
    }
  }
  stylesChanged() {
    this.columns.scheduleRefresh();
  }
  refresh() {
    this.needsRefresh = false;
    if (this.refreshRequestId) {
      this.element.window().cancelAnimationFrame(this.refreshRequestId);
      this.refreshRequestId = null;
    }
    this.removeAllNodeHighlights();
    this.timeCalculatorInternal.updateBoundariesForEventTime(this.mainRequestLoadTime);
    this.durationCalculator.updateBoundariesForEventTime(this.mainRequestLoadTime);
    this.timeCalculatorInternal.updateBoundariesForEventTime(this.mainRequestDOMContentLoadedTime);
    this.durationCalculator.updateBoundariesForEventTime(this.mainRequestDOMContentLoadedTime);
    const nodesToInsert = /* @__PURE__ */ new Map();
    const nodesToRefresh = [];
    const staleNodes = /* @__PURE__ */ new Set();
    while (this.staleRequests.size) {
      const request = this.staleRequests.values().next().value;
      this.staleRequests.delete(request);
      let node = networkRequestToNode.get(request);
      if (!node) {
        node = this.createNodeForRequest(request);
      }
      staleNodes.add(node);
    }
    for (const node of staleNodes) {
      const isFilteredOut = !this.applyFilter(node);
      if (isFilteredOut && node === this.hoveredNodeInternal) {
        this.setHoveredNode(null);
      }
      if (!isFilteredOut) {
        nodesToRefresh.push(node);
      }
      const request = node.request();
      this.timeCalculatorInternal.updateBoundaries(request);
      this.durationCalculator.updateBoundaries(request);
      const newParent = this.parentNodeForInsert(node);
      const wasAlreadyFiltered = filteredNetworkRequests.has(node);
      if (wasAlreadyFiltered === isFilteredOut && node.parent === newParent) {
        continue;
      }
      if (isFilteredOut) {
        filteredNetworkRequests.add(node);
      } else {
        filteredNetworkRequests.delete(node);
      }
      const removeFromParent = node.parent && (isFilteredOut || node.parent !== newParent);
      if (removeFromParent) {
        let parent = node.parent;
        if (!parent) {
          continue;
        }
        parent.removeChild(node);
        while (parent && !parent.hasChildren() && parent.dataGrid && parent.dataGrid.rootNode() !== parent) {
          const grandparent = parent.parent;
          grandparent.removeChild(parent);
          parent = grandparent;
        }
      }
      if (!newParent || isFilteredOut) {
        continue;
      }
      if (!newParent.dataGrid && !nodesToInsert.has(newParent)) {
        nodesToInsert.set(newParent, this.dataGrid.rootNode());
        nodesToRefresh.push(newParent);
      }
      nodesToInsert.set(node, newParent);
    }
    for (const node of nodesToInsert.keys()) {
      nodesToInsert.get(node).appendChild(node);
    }
    for (const node of nodesToRefresh) {
      node.refresh();
    }
    this.updateSummaryBar();
    if (nodesToInsert.size) {
      this.columns.sortByCurrentColumn();
    }
    this.dataGrid.updateInstantly();
    this.didRefreshForTest();
  }
  didRefreshForTest() {
  }
  parentNodeForInsert(node) {
    if (!this.activeGroupLookup) {
      return this.dataGrid.rootNode();
    }
    const groupNode = this.activeGroupLookup.groupNodeForRequest(node.request());
    if (!groupNode) {
      return this.dataGrid.rootNode();
    }
    return groupNode;
  }
  reset() {
    this.dispatchEventToListeners(Events.RequestActivated, { showPanel: false });
    this.setHoveredNode(null);
    this.columns.reset();
    this.timeFilter = null;
    this.calculatorInternal.reset();
    this.timeCalculatorInternal.setWindow(null);
    this.linkifierInternal.reset();
    if (this.activeGroupLookup) {
      this.activeGroupLookup.reset();
    }
    this.staleRequests.clear();
    this.resetSuggestionBuilder();
    this.mainRequestLoadTime = -1;
    this.mainRequestDOMContentLoadedTime = -1;
    this.dataGrid.rootNode().removeChildren();
    this.updateSummaryBar();
    this.dataGrid.setStickToBottom(true);
    this.scheduleRefresh();
  }
  setTextFilterValue(filterString) {
    this.textFilterUI.setValue(filterString);
    this.dataURLFilterUI.setChecked(false);
    this.onlyIssuesFilterUI.setChecked(false);
    this.onlyBlockedRequestsUI.setChecked(false);
    this.resourceCategoryFilterUI.reset();
  }
  createNodeForRequest(request) {
    const node = new NetworkRequestNode(this, request);
    networkRequestToNode.set(request, node);
    filteredNetworkRequests.add(node);
    for (let redirect = request.redirectSource(); redirect; redirect = redirect.redirectSource()) {
      this.refreshRequest(redirect);
    }
    return node;
  }
  onRequestUpdated(event) {
    const request = event.data;
    this.refreshRequest(request);
  }
  refreshRequest(request) {
    NetworkLogView.subdomains(request.domain).forEach(this.suggestionBuilder.addItem.bind(this.suggestionBuilder, NetworkForward.UIFilter.FilterType.Domain));
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Method, request.requestMethod);
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.MimeType, request.mimeType);
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Scheme, String(request.scheme));
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.StatusCode, String(request.statusCode));
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.ResourceType, request.resourceType().name());
    this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Url, request.securityOrigin());
    const priority = request.priority();
    if (priority) {
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.Priority, PerfUI.NetworkPriorities.uiLabelForNetworkPriority(priority));
    }
    if (request.mixedContentType !== Protocol.Security.MixedContentType.None) {
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.MixedContent, NetworkForward.UIFilter.MixedContentFilterValues.All);
    }
    if (request.mixedContentType === Protocol.Security.MixedContentType.OptionallyBlockable) {
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.MixedContent, NetworkForward.UIFilter.MixedContentFilterValues.Displayed);
    }
    if (request.mixedContentType === Protocol.Security.MixedContentType.Blockable) {
      const suggestion = request.wasBlocked() ? NetworkForward.UIFilter.MixedContentFilterValues.Blocked : NetworkForward.UIFilter.MixedContentFilterValues.BlockOverridden;
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.MixedContent, suggestion);
    }
    const responseHeaders = request.responseHeaders;
    for (const responseHeader of responseHeaders) {
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.HasResponseHeader, responseHeader.name);
      if (responseHeader.name === "Set-Cookie") {
        this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.ResponseHeaderValueSetCookie);
      }
    }
    for (const cookie of request.responseCookies) {
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.SetCookieDomain, cookie.domain());
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.SetCookieName, cookie.name());
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.SetCookieValue, cookie.value());
    }
    for (const cookie of request.allCookiesIncludingBlockedOnes()) {
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.CookieDomain, cookie.domain());
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.CookieName, cookie.name());
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.CookiePath, cookie.path());
      this.suggestionBuilder.addItem(NetworkForward.UIFilter.FilterType.CookieValue, cookie.value());
    }
    this.staleRequests.add(request);
    this.scheduleRefresh();
  }
  rowHeight() {
    return this.rowHeightInternal;
  }
  switchViewMode(gridMode) {
    this.columns.switchViewMode(gridMode);
  }
  handleContextMenuForRequest(contextMenu, request) {
    contextMenu.appendApplicableItems(request);
    let copyMenu = contextMenu.clipboardSection().appendSubMenuItem(i18nString(UIStrings.copy));
    const footerSection = copyMenu.footerSection();
    if (request) {
      copyMenu.defaultSection().appendItem(UI.UIUtils.copyLinkAddressLabel(), Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText.bind(Host.InspectorFrontendHost.InspectorFrontendHostInstance, request.contentURL()));
      if (request.requestHeadersText()) {
        copyMenu.defaultSection().appendItem(i18nString(UIStrings.copyRequestHeaders), NetworkLogView.copyRequestHeaders.bind(null, request));
      }
      if (request.responseHeadersText) {
        copyMenu.defaultSection().appendItem(i18nString(UIStrings.copyResponseHeaders), NetworkLogView.copyResponseHeaders.bind(null, request));
      }
      if (request.finished) {
        copyMenu.defaultSection().appendItem(i18nString(UIStrings.copyResponse), NetworkLogView.copyResponse.bind(null, request));
      }
      const initiator = request.initiator();
      if (initiator) {
        const stack = initiator.stack;
        if (stack) {
          const stackTraceText = computeStackTraceText(stack);
          if (stackTraceText !== "") {
            copyMenu.defaultSection().appendItem(i18nString(UIStrings.copyStacktrace), () => {
              Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(stackTraceText);
            });
          }
        }
      }
      const disableIfBlob = request.isBlobRequest();
      if (Host.Platform.isWin()) {
        footerSection.appendItem(i18nString(UIStrings.copyAsPowershell), this.copyPowerShellCommand.bind(this, request), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsFetch), this.copyFetchCall.bind(this, request, 0 /* Browser */), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsNodejsFetch), this.copyFetchCall.bind(this, request, 1 /* NodeJs */), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsCurlCmd), this.copyCurlCommand.bind(this, request, "win"), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsCurlBash), this.copyCurlCommand.bind(this, request, "unix"), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAllAsPowershell), this.copyAllPowerShellCommand.bind(this));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsFetch), this.copyAllFetchCall.bind(this, 0 /* Browser */));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsNodejsFetch), this.copyAllFetchCall.bind(this, 1 /* NodeJs */));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsCurlCmd), this.copyAllCurlCommand.bind(this, "win"));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsCurlBash), this.copyAllCurlCommand.bind(this, "unix"));
      } else {
        footerSection.appendItem(i18nString(UIStrings.copyAsPowershell), this.copyPowerShellCommand.bind(this, request), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsFetch), this.copyFetchCall.bind(this, request, 0 /* Browser */), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsNodejsFetch), this.copyFetchCall.bind(this, request, 1 /* NodeJs */), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAsCurl), this.copyCurlCommand.bind(this, request, "unix"), disableIfBlob);
        footerSection.appendItem(i18nString(UIStrings.copyAllAsPowershell), this.copyAllPowerShellCommand.bind(this));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsFetch), this.copyAllFetchCall.bind(this, 0 /* Browser */));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsNodejsFetch), this.copyAllFetchCall.bind(this, 1 /* NodeJs */));
        footerSection.appendItem(i18nString(UIStrings.copyAllAsCurl), this.copyAllCurlCommand.bind(this, "unix"));
      }
    } else {
      copyMenu = contextMenu.clipboardSection().appendSubMenuItem(i18nString(UIStrings.copy));
    }
    footerSection.appendItem(i18nString(UIStrings.copyAllAsHar), this.copyAll.bind(this));
    contextMenu.saveSection().appendItem(i18nString(UIStrings.saveAllAsHarWithContent), this.exportAll.bind(this));
    if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.HEADER_OVERRIDES)) {
      contextMenu.editSection().appendItem(i18nString(UIStrings.createResponseHeaderOverride), this.#handleCreateResponseHeaderOverrideClick.bind(this, request));
      contextMenu.editSection().appendSeparator();
    }
    contextMenu.editSection().appendItem(i18nString(UIStrings.clearBrowserCache), this.clearBrowserCache.bind(this));
    contextMenu.editSection().appendItem(i18nString(UIStrings.clearBrowserCookies), this.clearBrowserCookies.bind(this));
    if (request) {
      let addBlockedURL = function(url) {
        patterns.push({ enabled: true, url });
        manager.setBlockedPatterns(patterns);
        manager.setBlockingEnabled(true);
        void UI.ViewManager.ViewManager.instance().showView("network.blocked-urls");
      }, removeBlockedURL = function(url) {
        patterns = patterns.filter((pattern) => pattern.url !== url);
        manager.setBlockedPatterns(patterns);
        void UI.ViewManager.ViewManager.instance().showView("network.blocked-urls");
      };
      const maxBlockedURLLength = 20;
      const manager = SDK.NetworkManager.MultitargetNetworkManager.instance();
      let patterns = manager.blockedPatterns();
      const urlWithoutScheme = request.parsedURL.urlWithoutScheme();
      if (urlWithoutScheme && !patterns.find((pattern) => pattern.url === urlWithoutScheme)) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.blockRequestUrl), addBlockedURL.bind(null, urlWithoutScheme));
      } else if (urlWithoutScheme) {
        const croppedURL = Platform.StringUtilities.trimMiddle(urlWithoutScheme, maxBlockedURLLength);
        contextMenu.debugSection().appendItem(i18nString(UIStrings.unblockS, { PH1: croppedURL }), removeBlockedURL.bind(null, urlWithoutScheme));
      }
      const domain = request.parsedURL.domain();
      if (domain && !patterns.find((pattern) => pattern.url === domain)) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.blockRequestDomain), addBlockedURL.bind(null, domain));
      } else if (domain) {
        const croppedDomain = Platform.StringUtilities.trimMiddle(domain, maxBlockedURLLength);
        contextMenu.debugSection().appendItem(i18nString(UIStrings.unblockS, { PH1: croppedDomain }), removeBlockedURL.bind(null, domain));
      }
      if (SDK.NetworkManager.NetworkManager.canReplayRequest(request)) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.replayXhr), SDK.NetworkManager.NetworkManager.replayRequest.bind(null, request));
      }
    }
  }
  harRequests() {
    return Logs.NetworkLog.NetworkLog.instance().requests().filter(NetworkLogView.getHTTPRequestsFilter).filter((request) => {
      return request.finished || request.resourceType() === Common.ResourceType.resourceTypes.WebSocket && request.responseReceivedTime;
    });
  }
  async copyAll() {
    const harArchive = { log: await HAR.Log.Log.build(this.harRequests()) };
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(JSON.stringify(harArchive, null, 2));
  }
  async copyCurlCommand(request, platform) {
    const command = await this.generateCurlCommand(request, platform);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(command);
  }
  async copyAllCurlCommand(platform) {
    const commands = await this.generateAllCurlCommand(Logs.NetworkLog.NetworkLog.instance().requests(), platform);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(commands);
  }
  async copyFetchCall(request, style) {
    const command = await this.generateFetchCall(request, style);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(command);
  }
  async copyAllFetchCall(style) {
    const commands = await this.generateAllFetchCall(Logs.NetworkLog.NetworkLog.instance().requests(), style);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(commands);
  }
  async copyPowerShellCommand(request) {
    const command = await this.generatePowerShellCommand(request);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(command);
  }
  async copyAllPowerShellCommand() {
    const commands = await this.generateAllPowerShellCommand(Logs.NetworkLog.NetworkLog.instance().requests());
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(commands);
  }
  async exportAll() {
    const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!mainTarget) {
      return;
    }
    const url = mainTarget.inspectedURL();
    const parsedURL = Common.ParsedURL.ParsedURL.fromString(url);
    const filename = parsedURL ? parsedURL.host : "network-log";
    const stream = new Bindings.FileUtils.FileOutputStream();
    if (!await stream.open(Common.ParsedURL.ParsedURL.concatenate(filename, ".har"))) {
      return;
    }
    const progressIndicator = new UI.ProgressIndicator.ProgressIndicator();
    this.progressBarContainer.appendChild(progressIndicator.element);
    await HAR.Writer.Writer.write(stream, this.harRequests(), progressIndicator);
    progressIndicator.done();
    void stream.close();
  }
  async #handleCreateResponseHeaderOverrideClick(request) {
    if (Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance().project()) {
      await this.#revealHeaderOverrideEditor(request);
    } else {
      UI.InspectorView.InspectorView.instance().displaySelectOverrideFolderInfobar(async () => {
        await Sources.SourcesNavigator.OverridesNavigatorView.instance().setupNewWorkspace();
        await this.#revealHeaderOverrideEditor(request);
      });
    }
  }
  async #revealHeaderOverrideEditor(request) {
    const networkPersistanceManager = Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance();
    const uiSourceCode = await networkPersistanceManager.getOrCreateHeadersUISourceCodeFromUrl(request.url());
    if (uiSourceCode) {
      const sourcesPanel = Sources.SourcesPanel.SourcesPanel.instance();
      sourcesPanel.showUISourceCode(uiSourceCode);
      sourcesPanel.revealInNavigator(uiSourceCode);
    }
  }
  clearBrowserCache() {
    if (confirm(i18nString(UIStrings.areYouSureYouWantToClearBrowser))) {
      SDK.NetworkManager.MultitargetNetworkManager.instance().clearBrowserCache();
    }
  }
  clearBrowserCookies() {
    if (confirm(i18nString(UIStrings.areYouSureYouWantToClearBrowserCookies))) {
      SDK.NetworkManager.MultitargetNetworkManager.instance().clearBrowserCookies();
    }
  }
  removeAllHighlights() {
    this.removeAllNodeHighlights();
  }
  applyFilter(node) {
    const request = node.request();
    if (this.timeFilter && !this.timeFilter(request)) {
      return false;
    }
    const categoryName = request.resourceType().category().title();
    if (!this.resourceCategoryFilterUI.accept(categoryName)) {
      return false;
    }
    if (this.dataURLFilterUI.checked() && (request.parsedURL.isDataURL() || request.parsedURL.isBlobURL())) {
      return false;
    }
    if (this.onlyIssuesFilterUI.checked() && !IssuesManager.RelatedIssue.hasIssueOfCategory(request, IssuesManager.Issue.IssueCategory.Cookie)) {
      return false;
    }
    if (this.onlyBlockedRequestsUI.checked() && !request.wasBlocked() && !request.corsErrorStatus()) {
      return false;
    }
    if (this.onlyThirdPartyFilterUI.checked() && request.isSameSite()) {
      return false;
    }
    for (let i = 0; i < this.filters.length; ++i) {
      if (!this.filters[i](request)) {
        return false;
      }
    }
    return true;
  }
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
  parseFilterQuery(query, invert) {
    const descriptors = this.filterParser.parse(query);
    this.filters = descriptors.map((descriptor) => {
      const key = descriptor.key;
      const text = descriptor.text || "";
      const regex = descriptor.regex;
      let filter;
      if (key) {
        const defaultText = Platform.StringUtilities.escapeForRegExp(key + ":" + text);
        filter = this.createSpecialFilter(key, text) || NetworkLogView.requestPathFilter.bind(null, new RegExp(defaultText, "i"));
      } else if (descriptor.regex) {
        filter = NetworkLogView.requestPathFilter.bind(null, regex);
      } else if (this.isValidUrl(text)) {
        filter = NetworkLogView.requestUrlFilter.bind(null, text);
      } else {
        filter = NetworkLogView.requestPathFilter.bind(null, new RegExp(Platform.StringUtilities.escapeForRegExp(text), "i"));
      }
      if (descriptor.negative && !invert || !descriptor.negative && invert) {
        return NetworkLogView.negativeFilter.bind(null, filter);
      }
      return filter;
    });
  }
  createSpecialFilter(type, value) {
    switch (type) {
      case NetworkForward.UIFilter.FilterType.Domain:
        return NetworkLogView.createRequestDomainFilter(value);
      case NetworkForward.UIFilter.FilterType.HasResponseHeader:
        return NetworkLogView.requestResponseHeaderFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.ResponseHeaderValueSetCookie:
        return NetworkLogView.requestResponseHeaderSetCookieFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.Is:
        if (value.toLowerCase() === NetworkForward.UIFilter.IsFilterType.Running) {
          return NetworkLogView.runningRequestFilter;
        }
        if (value.toLowerCase() === NetworkForward.UIFilter.IsFilterType.FromCache) {
          return NetworkLogView.fromCacheRequestFilter;
        }
        if (value.toLowerCase() === NetworkForward.UIFilter.IsFilterType.ServiceWorkerIntercepted) {
          return NetworkLogView.interceptedByServiceWorkerFilter;
        }
        if (value.toLowerCase() === NetworkForward.UIFilter.IsFilterType.ServiceWorkerInitiated) {
          return NetworkLogView.initiatedByServiceWorkerFilter;
        }
        break;
      case NetworkForward.UIFilter.FilterType.LargerThan:
        return this.createSizeFilter(value.toLowerCase());
      case NetworkForward.UIFilter.FilterType.Method:
        return NetworkLogView.requestMethodFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.MimeType:
        return NetworkLogView.requestMimeTypeFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.MixedContent:
        return NetworkLogView.requestMixedContentFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.Scheme:
        return NetworkLogView.requestSchemeFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.SetCookieDomain:
        return NetworkLogView.requestSetCookieDomainFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.SetCookieName:
        return NetworkLogView.requestSetCookieNameFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.SetCookieValue:
        return NetworkLogView.requestSetCookieValueFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.CookieDomain:
        return NetworkLogView.requestCookieDomainFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.CookieName:
        return NetworkLogView.requestCookieNameFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.CookiePath:
        return NetworkLogView.requestCookiePathFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.CookieValue:
        return NetworkLogView.requestCookieValueFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.Priority:
        return NetworkLogView.requestPriorityFilter.bind(null, PerfUI.NetworkPriorities.uiLabelToNetworkPriority(value));
      case NetworkForward.UIFilter.FilterType.StatusCode:
        return NetworkLogView.statusCodeFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.ResourceType:
        return NetworkLogView.resourceTypeFilter.bind(null, value);
      case NetworkForward.UIFilter.FilterType.Url:
        return NetworkLogView.requestUrlFilter.bind(null, value);
    }
    return null;
  }
  createSizeFilter(value) {
    let multiplier = 1;
    if (value.endsWith("k")) {
      multiplier = 1e3;
      value = value.substring(0, value.length - 1);
    } else if (value.endsWith("m")) {
      multiplier = 1e3 * 1e3;
      value = value.substring(0, value.length - 1);
    }
    const quantity = Number(value);
    if (isNaN(quantity)) {
      return null;
    }
    return NetworkLogView.requestSizeLargerThanFilter.bind(null, quantity * multiplier);
  }
  filterRequests() {
    this.removeAllHighlights();
    this.invalidateAllItems();
  }
  reveal(request) {
    this.removeAllNodeHighlights();
    const node = networkRequestToNode.get(request);
    if (!node || !node.dataGrid) {
      return null;
    }
    if (node.parent && node.parent instanceof NetworkGroupNode) {
      node.parent.reveal();
      node.parent.expand();
    }
    node.reveal();
    return node;
  }
  revealAndHighlightRequest(request) {
    const node = this.reveal(request);
    if (node) {
      this.highlightNode(node);
    }
  }
  revealAndHighlightRequestWithId(requestId) {
    const request = Logs.NetworkLog.NetworkLog.instance().requestByManagerAndId(requestId.manager, requestId.requestId);
    if (request) {
      this.revealAndHighlightRequest(request);
    }
  }
  selectRequest(request, options) {
    const defaultOptions = { clearFilter: true };
    const { clearFilter } = options || defaultOptions;
    if (clearFilter) {
      this.setTextFilterValue("");
    }
    const node = this.reveal(request);
    if (node) {
      node.select();
    }
  }
  removeAllNodeHighlights() {
    if (this.highlightedNode) {
      this.highlightedNode.element().classList.remove("highlighted-row");
      this.highlightedNode = null;
    }
  }
  highlightNode(node) {
    UI.UIUtils.runCSSAnimationOnce(node.element(), "highlighted-row");
    this.highlightedNode = node;
  }
  filterOutBlobRequests(requests) {
    return requests.filter((request) => !request.isBlobRequest());
  }
  async generateFetchCall(request, style) {
    const ignoredHeaders = /* @__PURE__ */ new Set([
      "method",
      "path",
      "scheme",
      "version",
      "accept-charset",
      "accept-encoding",
      "access-control-request-headers",
      "access-control-request-method",
      "connection",
      "content-length",
      "cookie",
      "cookie2",
      "date",
      "dnt",
      "expect",
      "host",
      "keep-alive",
      "origin",
      "referer",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",
      "via",
      "user-agent"
    ]);
    const credentialHeaders = /* @__PURE__ */ new Set(["cookie", "authorization"]);
    const url = JSON.stringify(request.url());
    const requestHeaders = request.requestHeaders();
    const headerData = requestHeaders.reduce((result, header) => {
      const name = header.name;
      if (!ignoredHeaders.has(name.toLowerCase()) && !name.includes(":")) {
        result.append(name, header.value);
      }
      return result;
    }, new Headers());
    const headers = {};
    for (const headerArray of headerData) {
      headers[headerArray[0]] = headerArray[1];
    }
    const credentials = request.includedRequestCookies().length || requestHeaders.some(({ name }) => credentialHeaders.has(name.toLowerCase())) ? "include" : "omit";
    const referrerHeader = requestHeaders.find(({ name }) => name.toLowerCase() === "referer");
    const referrer = referrerHeader ? referrerHeader.value : void 0;
    const referrerPolicy = request.referrerPolicy() || void 0;
    const requestBody = await request.requestFormData();
    const fetchOptions = {
      headers: Object.keys(headers).length ? headers : void 0,
      referrer,
      referrerPolicy,
      body: requestBody,
      method: request.requestMethod,
      mode: "cors"
    };
    if (style === 1 /* NodeJs */) {
      const cookieHeader = requestHeaders.find((header) => header.name.toLowerCase() === "cookie");
      const extraHeaders = {};
      delete fetchOptions.mode;
      if (cookieHeader) {
        extraHeaders["cookie"] = cookieHeader.value;
      }
      if (referrer) {
        delete fetchOptions.referrer;
        extraHeaders["Referer"] = referrer;
      }
      if (referrer) {
        delete fetchOptions.referrerPolicy;
        extraHeaders["Referrer-Policy"] = referrerPolicy;
      }
      if (Object.keys(extraHeaders).length) {
        fetchOptions.headers = {
          ...headers,
          ...extraHeaders
        };
      }
    } else {
      fetchOptions.credentials = credentials;
    }
    const options = JSON.stringify(fetchOptions, null, 2);
    return `fetch(${url}, ${options});`;
  }
  async generateAllFetchCall(requests, style) {
    const nonBlobRequests = this.filterOutBlobRequests(requests);
    const commands = await Promise.all(nonBlobRequests.map((request) => this.generateFetchCall(request, style)));
    return commands.join(" ;\n");
  }
  async generateCurlCommand(request, platform) {
    let command = [];
    const ignoredHeaders = /* @__PURE__ */ new Set(["accept-encoding", "host", "method", "path", "scheme", "version"]);
    function escapeStringWin(str) {
      const encapsChars = /[\r\n]/.test(str) ? '^"' : '"';
      return encapsChars + str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[^a-zA-Z0-9\s_\-:=+~'\/.',?;()*`&]/g, "^$&").replace(/%(?=[a-zA-Z0-9_])/g, "%^").replace(/\r?\n/g, "^\n\n") + encapsChars;
    }
    function escapeStringPosix(str) {
      function escapeCharacter(x) {
        const code = x.charCodeAt(0);
        let hexString = code.toString(16);
        while (hexString.length < 4) {
          hexString = "0" + hexString;
        }
        return "\\u" + hexString;
      }
      if (/[\0-\x1F\x7F-\x9F!]|\'/.test(str)) {
        return "$'" + str.replace(/\\/g, "\\\\").replace(/\'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\0-\x1F\x7F-\x9F!]/g, escapeCharacter) + "'";
      }
      return "'" + str + "'";
    }
    const escapeString = platform === "win" ? escapeStringWin : escapeStringPosix;
    command.push(escapeString(request.url()).replace(/[[{}\]]/g, "\\$&"));
    let inferredMethod = "GET";
    const data = [];
    const formData = await request.requestFormData();
    if (formData) {
      data.push("--data-raw " + escapeString(formData));
      ignoredHeaders.add("content-length");
      inferredMethod = "POST";
    }
    if (request.requestMethod !== inferredMethod) {
      command.push("-X " + escapeString(request.requestMethod));
    }
    const requestHeaders = request.requestHeaders();
    for (let i = 0; i < requestHeaders.length; i++) {
      const header = requestHeaders[i];
      const name = header.name.replace(/^:/, "");
      if (ignoredHeaders.has(name.toLowerCase())) {
        continue;
      }
      command.push("-H " + escapeString(name + ": " + header.value));
    }
    command = command.concat(data);
    command.push("--compressed");
    if (request.securityState() === Protocol.Security.SecurityState.Insecure) {
      command.push("--insecure");
    }
    return "curl " + command.join(command.length >= 3 ? platform === "win" ? " ^\n  " : " \\\n  " : " ");
  }
  async generateAllCurlCommand(requests, platform) {
    const nonBlobRequests = this.filterOutBlobRequests(requests);
    const commands = await Promise.all(nonBlobRequests.map((request) => this.generateCurlCommand(request, platform)));
    if (platform === "win") {
      return commands.join(" &\r\n");
    }
    return commands.join(" ;\n");
  }
  async generatePowerShellCommand(request) {
    const command = [];
    const ignoredHeaders = /* @__PURE__ */ new Set([
      "host",
      "connection",
      "proxy-connection",
      "content-length",
      "expect",
      "range",
      "content-type",
      "user-agent",
      "cookie"
    ]);
    function escapeString(str) {
      return '"' + str.replace(/[`\$"]/g, "`$&").replace(/[^\x20-\x7E]/g, (char) => "$([char]" + char.charCodeAt(0) + ")") + '"';
    }
    function generatePowerShellSession(request2) {
      const requestHeaders2 = request2.requestHeaders();
      const props = [];
      const userAgentHeader = requestHeaders2.find(({ name }) => name.toLowerCase() === "user-agent");
      if (userAgentHeader) {
        props.push(`$session.UserAgent = ${escapeString(userAgentHeader.value)}`);
      }
      for (const cookie of request2.includedRequestCookies()) {
        const name = escapeString(cookie.name());
        const value = escapeString(cookie.value());
        const domain = escapeString(cookie.domain());
        props.push(`$session.Cookies.Add((New-Object System.Net.Cookie(${name}, ${value}, "/", ${domain})))`);
      }
      if (props.length) {
        return "$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession\n" + props.join("\n") + "\n";
      }
      return null;
    }
    command.push("-Uri " + escapeString(request.url()));
    if (request.requestMethod !== "GET") {
      command.push("-Method " + escapeString(request.requestMethod));
    }
    const session = generatePowerShellSession(request);
    if (session) {
      command.push("-WebSession $session");
    }
    const requestHeaders = request.requestHeaders();
    const headerNameValuePairs = [];
    for (const header of requestHeaders) {
      const name = header.name.replace(/^:/, "");
      if (ignoredHeaders.has(name.toLowerCase())) {
        continue;
      }
      headerNameValuePairs.push(escapeString(name) + "=" + escapeString(header.value));
    }
    if (headerNameValuePairs.length) {
      command.push("-Headers @{\n" + headerNameValuePairs.join("\n  ") + "\n}");
    }
    const contentTypeHeader = requestHeaders.find(({ name }) => name.toLowerCase() === "content-type");
    if (contentTypeHeader) {
      command.push("-ContentType " + escapeString(contentTypeHeader.value));
    }
    const formData = await request.requestFormData();
    if (formData) {
      const body = escapeString(formData);
      if (/[^\x20-\x7E]/.test(formData)) {
        command.push("-Body ([System.Text.Encoding]::UTF8.GetBytes(" + body + "))");
      } else {
        command.push("-Body " + body);
      }
    }
    const prelude = session || "";
    return prelude + "Invoke-WebRequest -UseBasicParsing " + command.join(command.length >= 3 ? " `\n" : " ");
  }
  async generateAllPowerShellCommand(requests) {
    const nonBlobRequests = this.filterOutBlobRequests(requests);
    const commands = await Promise.all(nonBlobRequests.map((request) => this.generatePowerShellCommand(request)));
    return commands.join(";\r\n");
  }
  static getDCLEventColor() {
    return ThemeSupport.ThemeSupport.instance().getComputedValue("--color-syntax-3");
  }
  static getLoadEventColor() {
    return ThemeSupport.ThemeSupport.instance().getComputedValue("--color-syntax-1");
  }
}
export function computeStackTraceText(stackTrace) {
  let stackTraceText = "";
  for (const frame of stackTrace.callFrames) {
    const functionName = UI.UIUtils.beautifyFunctionName(frame.functionName);
    stackTraceText += `${functionName} @ ${frame.url}:${frame.lineNumber + 1}
`;
  }
  if (stackTrace.parent) {
    stackTraceText += computeStackTraceText(stackTrace.parent);
  }
  return stackTraceText;
}
const filteredNetworkRequests = /* @__PURE__ */ new WeakSet();
const networkRequestToNode = /* @__PURE__ */ new WeakMap();
export function isRequestFilteredOut(request) {
  return filteredNetworkRequests.has(request);
}
export const HTTPSchemas = {
  "http": true,
  "https": true,
  "ws": true,
  "wss": true
};
const searchKeys = Object.values(NetworkForward.UIFilter.FilterType);
//# sourceMappingURL=NetworkLogView.js.map
