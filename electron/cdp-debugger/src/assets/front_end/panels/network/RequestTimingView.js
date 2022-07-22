import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Logs from "../../models/logs/logs.js";
import * as ObjectUI from "../../ui/legacy/components/object_ui/object_ui.js";
import * as UI from "../../ui/legacy/legacy.js";
import { Events } from "./NetworkTimeCalculator.js";
import networkingTimingTableStyles from "./networkTimingTable.css.js";
const UIStrings = {
  receivingPush: "Receiving `Push`",
  queueing: "Queueing",
  stalled: "Stalled",
  initialConnection: "Initial connection",
  dnsLookup: "DNS Lookup",
  proxyNegotiation: "Proxy negotiation",
  readingPush: "Reading `Push`",
  contentDownload: "Content Download",
  requestSent: "Request sent",
  requestToServiceworker: "Request to `ServiceWorker`",
  startup: "Startup",
  respondwith: "respondWith",
  ssl: "SSL",
  total: "Total",
  waitingTtfb: "Waiting for server response",
  label: "Label",
  waterfall: "Waterfall",
  duration: "Duration",
  queuedAtS: "Queued at {PH1}",
  startedAtS: "Started at {PH1}",
  serverPush: "Server Push",
  resourceScheduling: "Resource Scheduling",
  connectionStart: "Connection Start",
  requestresponse: "Request/Response",
  cautionRequestIsNotFinishedYet: "CAUTION: request is not finished yet!",
  explanation: "Explanation",
  serverTiming: "Server Timing",
  time: "TIME",
  theServerTimingApi: "the Server Timing API",
  duringDevelopmentYouCanUseSToAdd: "During development, you can use {PH1} to add insights into the server-side timing of this request.",
  durationC: "DURATION",
  originalRequest: "Original Request",
  responseReceived: "Response Received",
  unknown: "Unknown",
  sourceOfResponseS: "Source of response: {PH1}",
  cacheStorageCacheNameS: "Cache storage cache name: {PH1}",
  cacheStorageCacheNameUnknown: "Cache storage cache name: Unknown",
  retrievalTimeS: "Retrieval Time: {PH1}",
  serviceworkerCacheStorage: "`ServiceWorker` cache storage",
  fromHttpCache: "From HTTP cache",
  networkFetch: "Network fetch",
  fallbackCode: "Fallback code"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/RequestTimingView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RequestTimingView extends UI.Widget.VBox {
  request;
  calculator;
  lastMinimumBoundary;
  tableElement;
  constructor(request, calculator) {
    super();
    this.element.classList.add("resource-timing-view");
    this.request = request;
    this.calculator = calculator;
    this.lastMinimumBoundary = -1;
  }
  static timeRangeTitle(name) {
    switch (name) {
      case RequestTimeRangeNames.Push:
        return i18nString(UIStrings.receivingPush);
      case RequestTimeRangeNames.Queueing:
        return i18nString(UIStrings.queueing);
      case RequestTimeRangeNames.Blocking:
        return i18nString(UIStrings.stalled);
      case RequestTimeRangeNames.Connecting:
        return i18nString(UIStrings.initialConnection);
      case RequestTimeRangeNames.DNS:
        return i18nString(UIStrings.dnsLookup);
      case RequestTimeRangeNames.Proxy:
        return i18nString(UIStrings.proxyNegotiation);
      case RequestTimeRangeNames.ReceivingPush:
        return i18nString(UIStrings.readingPush);
      case RequestTimeRangeNames.Receiving:
        return i18nString(UIStrings.contentDownload);
      case RequestTimeRangeNames.Sending:
        return i18nString(UIStrings.requestSent);
      case RequestTimeRangeNames.ServiceWorker:
        return i18nString(UIStrings.requestToServiceworker);
      case RequestTimeRangeNames.ServiceWorkerPreparation:
        return i18nString(UIStrings.startup);
      case RequestTimeRangeNames.ServiceWorkerRespondWith:
        return i18nString(UIStrings.respondwith);
      case RequestTimeRangeNames.SSL:
        return i18nString(UIStrings.ssl);
      case RequestTimeRangeNames.Total:
        return i18nString(UIStrings.total);
      case RequestTimeRangeNames.Waiting:
        return i18nString(UIStrings.waitingTtfb);
      default:
        return name;
    }
  }
  static calculateRequestTimeRanges(request, navigationStart) {
    const result = [];
    function addRange(name, start, end) {
      if (start < Number.MAX_VALUE && start <= end) {
        result.push({ name, start, end });
      }
    }
    function firstPositive(numbers) {
      for (let i = 0; i < numbers.length; ++i) {
        if (numbers[i] > 0) {
          return numbers[i];
        }
      }
      return void 0;
    }
    function addOffsetRange(name, start, end) {
      if (start >= 0 && end >= 0) {
        addRange(name, startTime + start / 1e3, startTime + end / 1e3);
      }
    }
    const timing = request.timing;
    if (!timing) {
      const start = request.issueTime() !== -1 ? request.issueTime() : request.startTime !== -1 ? request.startTime : 0;
      const hasDifferentIssueAndStartTime = request.issueTime() !== -1 && request.startTime !== -1 && request.issueTime() !== request.startTime;
      const middle = request.responseReceivedTime === -1 ? hasDifferentIssueAndStartTime ? request.startTime : Number.MAX_VALUE : request.responseReceivedTime;
      const end = request.endTime === -1 ? Number.MAX_VALUE : request.endTime;
      addRange(RequestTimeRangeNames.Total, start, end);
      addRange(RequestTimeRangeNames.Blocking, start, middle);
      const state = request.responseReceivedTime === -1 ? RequestTimeRangeNames.Connecting : RequestTimeRangeNames.Receiving;
      addRange(state, middle, end);
      return result;
    }
    const issueTime = request.issueTime();
    const startTime = timing.requestTime;
    const endTime = firstPositive([request.endTime, request.responseReceivedTime]) || startTime;
    addRange(RequestTimeRangeNames.Total, issueTime < startTime ? issueTime : startTime, endTime);
    if (timing.pushStart) {
      const pushEnd = timing.pushEnd || endTime;
      if (pushEnd > navigationStart) {
        addRange(RequestTimeRangeNames.Push, Math.max(timing.pushStart, navigationStart), pushEnd);
      }
    }
    if (issueTime < startTime) {
      addRange(RequestTimeRangeNames.Queueing, issueTime, startTime);
    }
    const responseReceived = (request.responseReceivedTime - startTime) * 1e3;
    if (request.fetchedViaServiceWorker) {
      addOffsetRange(RequestTimeRangeNames.Blocking, 0, timing.workerStart);
      addOffsetRange(RequestTimeRangeNames.ServiceWorkerPreparation, timing.workerStart, timing.workerReady);
      addOffsetRange(RequestTimeRangeNames.ServiceWorkerRespondWith, timing.workerFetchStart, timing.workerRespondWithSettled);
      addOffsetRange(RequestTimeRangeNames.ServiceWorker, timing.workerReady, timing.sendEnd);
      addOffsetRange(RequestTimeRangeNames.Waiting, timing.sendEnd, responseReceived);
    } else if (!timing.pushStart) {
      const blockingEnd = firstPositive([timing.dnsStart, timing.connectStart, timing.sendStart, responseReceived]) || 0;
      addOffsetRange(RequestTimeRangeNames.Blocking, 0, blockingEnd);
      addOffsetRange(RequestTimeRangeNames.Proxy, timing.proxyStart, timing.proxyEnd);
      addOffsetRange(RequestTimeRangeNames.DNS, timing.dnsStart, timing.dnsEnd);
      addOffsetRange(RequestTimeRangeNames.Connecting, timing.connectStart, timing.connectEnd);
      addOffsetRange(RequestTimeRangeNames.SSL, timing.sslStart, timing.sslEnd);
      addOffsetRange(RequestTimeRangeNames.Sending, timing.sendStart, timing.sendEnd);
      addOffsetRange(RequestTimeRangeNames.Waiting, Math.max(timing.sendEnd, timing.connectEnd, timing.dnsEnd, timing.proxyEnd, blockingEnd), responseReceived);
    }
    if (request.endTime !== -1) {
      addRange(timing.pushStart ? RequestTimeRangeNames.ReceivingPush : RequestTimeRangeNames.Receiving, request.responseReceivedTime, endTime);
    }
    return result;
  }
  static createTimingTable(request, calculator) {
    const tableElement = document.createElement("table");
    tableElement.classList.add("network-timing-table");
    const colgroup = tableElement.createChild("colgroup");
    colgroup.createChild("col", "labels");
    colgroup.createChild("col", "bars");
    colgroup.createChild("col", "duration");
    const timeRanges = RequestTimingView.calculateRequestTimeRanges(request, calculator.minimumBoundary());
    const startTime = timeRanges.map((r) => r.start).reduce((a, b) => Math.min(a, b));
    const endTime = timeRanges.map((r) => r.end).reduce((a, b) => Math.max(a, b));
    const scale = 100 / (endTime - startTime);
    let connectionHeader;
    let serviceworkerHeader;
    let dataHeader;
    let queueingHeader;
    let totalDuration = 0;
    const startTimeHeader = tableElement.createChild("thead", "network-timing-start");
    const tableHeaderRow = startTimeHeader.createChild("tr");
    const activityHeaderCell = tableHeaderRow.createChild("th");
    activityHeaderCell.createChild("span", "network-timing-hidden-header").textContent = i18nString(UIStrings.label);
    activityHeaderCell.scope = "col";
    const waterfallHeaderCell = tableHeaderRow.createChild("th");
    waterfallHeaderCell.createChild("span", "network-timing-hidden-header").textContent = i18nString(UIStrings.waterfall);
    waterfallHeaderCell.scope = "col";
    const durationHeaderCell = tableHeaderRow.createChild("th");
    durationHeaderCell.createChild("span", "network-timing-hidden-header").textContent = i18nString(UIStrings.duration);
    durationHeaderCell.scope = "col";
    const queuedCell = startTimeHeader.createChild("tr").createChild("td");
    const startedCell = startTimeHeader.createChild("tr").createChild("td");
    queuedCell.colSpan = startedCell.colSpan = 3;
    UI.UIUtils.createTextChild(queuedCell, i18nString(UIStrings.queuedAtS, { PH1: calculator.formatValue(request.issueTime(), 2) }));
    UI.UIUtils.createTextChild(startedCell, i18nString(UIStrings.startedAtS, { PH1: calculator.formatValue(request.startTime, 2) }));
    let right;
    for (let i = 0; i < timeRanges.length; ++i) {
      const range = timeRanges[i];
      const rangeName = range.name;
      if (rangeName === RequestTimeRangeNames.Total) {
        totalDuration = range.end - range.start;
        continue;
      }
      if (rangeName === RequestTimeRangeNames.Push) {
        createHeader(i18nString(UIStrings.serverPush));
      } else if (rangeName === RequestTimeRangeNames.Queueing) {
        if (!queueingHeader) {
          queueingHeader = createHeader(i18nString(UIStrings.resourceScheduling));
        }
      } else if (ConnectionSetupRangeNames.has(rangeName)) {
        if (!connectionHeader) {
          connectionHeader = createHeader(i18nString(UIStrings.connectionStart));
        }
      } else if (ServiceWorkerRangeNames.has(rangeName)) {
        if (!serviceworkerHeader) {
          serviceworkerHeader = createHeader("Service Worker");
        }
      } else {
        if (!dataHeader) {
          dataHeader = createHeader(i18nString(UIStrings.requestresponse));
        }
      }
      const left = scale * (range.start - startTime);
      right = scale * (endTime - range.end);
      const duration = range.end - range.start;
      const tr = tableElement.createChild("tr");
      const timingBarTitleEement = tr.createChild("td");
      UI.UIUtils.createTextChild(timingBarTitleEement, RequestTimingView.timeRangeTitle(rangeName));
      const row = tr.createChild("td").createChild("div", "network-timing-row");
      const bar = row.createChild("span", "network-timing-bar " + rangeName);
      bar.style.left = left + "%";
      bar.style.right = right + "%";
      bar.textContent = "\u200B";
      UI.ARIAUtils.setAccessibleName(row, i18nString(UIStrings.startedAtS, { PH1: calculator.formatValue(range.start, 2) }));
      const label = tr.createChild("td").createChild("div", "network-timing-bar-title");
      label.textContent = i18n.TimeUtilities.secondsToString(duration, true);
      if (range.name === "serviceworker-respondwith") {
        timingBarTitleEement.classList.add("network-fetch-timing-bar-clickable");
        tableElement.createChild("tr", "network-fetch-timing-bar-details");
        timingBarTitleEement.setAttribute("tabindex", "0");
        timingBarTitleEement.setAttribute("role", "switch");
        UI.ARIAUtils.setChecked(timingBarTitleEement, false);
      }
    }
    if (!request.finished && !request.preserved) {
      const cell = tableElement.createChild("tr").createChild("td", "caution");
      cell.colSpan = 3;
      UI.UIUtils.createTextChild(cell, i18nString(UIStrings.cautionRequestIsNotFinishedYet));
    }
    const footer = tableElement.createChild("tr", "network-timing-footer");
    const note = footer.createChild("td");
    note.colSpan = 1;
    note.appendChild(UI.XLink.XLink.create("https://developer.chrome.com/docs/devtools/network/reference#timing-explanation", i18nString(UIStrings.explanation)));
    footer.createChild("td");
    UI.UIUtils.createTextChild(footer.createChild("td"), i18n.TimeUtilities.secondsToString(totalDuration, true));
    const serverTimings = request.serverTimings;
    const lastTimingRightEdge = right === void 0 ? 100 : right;
    const breakElement = tableElement.createChild("tr", "network-timing-table-header").createChild("td");
    breakElement.colSpan = 3;
    breakElement.createChild("hr", "break");
    const serverHeader = tableElement.createChild("tr", "network-timing-table-header");
    UI.UIUtils.createTextChild(serverHeader.createChild("td"), i18nString(UIStrings.serverTiming));
    serverHeader.createChild("td");
    UI.UIUtils.createTextChild(serverHeader.createChild("td"), i18nString(UIStrings.time));
    if (!serverTimings) {
      const informationRow = tableElement.createChild("tr");
      const information = informationRow.createChild("td");
      information.colSpan = 3;
      const link = UI.XLink.XLink.create("https://web.dev/custom-metrics/#server-timing-api", i18nString(UIStrings.theServerTimingApi));
      information.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.duringDevelopmentYouCanUseSToAdd, { PH1: link }));
      return tableElement;
    }
    serverTimings.filter((item) => item.metric.toLowerCase() !== "total").forEach((item) => addTiming(item, lastTimingRightEdge));
    serverTimings.filter((item) => item.metric.toLowerCase() === "total").forEach((item) => addTiming(item, lastTimingRightEdge));
    return tableElement;
    function addTiming(serverTiming, right2) {
      const colorGenerator = new Common.Color.Generator({ min: 0, max: 360, count: 36 }, { min: 50, max: 80, count: void 0 }, 80);
      const isTotal = serverTiming.metric.toLowerCase() === "total";
      const tr = tableElement.createChild("tr", isTotal ? "network-timing-footer" : "server-timing-row");
      const metric = tr.createChild("td", "network-timing-metric");
      const description = serverTiming.description || serverTiming.metric;
      UI.UIUtils.createTextChild(metric, description);
      UI.Tooltip.Tooltip.install(metric, description);
      const row = tr.createChild("td").createChild("div", "network-timing-row");
      if (serverTiming.value === null) {
        return;
      }
      const left = scale * (endTime - startTime - serverTiming.value / 1e3);
      if (left >= 0) {
        const bar = row.createChild("span", "network-timing-bar server-timing");
        bar.style.left = left + "%";
        bar.style.right = right2 + "%";
        bar.textContent = "\u200B";
        if (!isTotal) {
          bar.style.backgroundColor = colorGenerator.colorForID(serverTiming.metric);
        }
      }
      const label = tr.createChild("td").createChild("div", "network-timing-bar-title");
      label.textContent = i18n.TimeUtilities.millisToString(serverTiming.value, true);
    }
    function createHeader(title) {
      const dataHeader2 = tableElement.createChild("tr", "network-timing-table-header");
      const headerCell = dataHeader2.createChild("td");
      UI.UIUtils.createTextChild(headerCell, title);
      UI.ARIAUtils.markAsHeading(headerCell, 2);
      UI.UIUtils.createTextChild(dataHeader2.createChild("td"), "");
      UI.UIUtils.createTextChild(dataHeader2.createChild("td"), i18nString(UIStrings.durationC));
      return dataHeader2;
    }
  }
  constructFetchDetailsView() {
    if (!this.tableElement) {
      return;
    }
    const document2 = this.tableElement.ownerDocument;
    const fetchDetailsElement = document2.querySelector(".network-fetch-timing-bar-details");
    if (!fetchDetailsElement) {
      return;
    }
    fetchDetailsElement.classList.add("network-fetch-timing-bar-details-collapsed");
    self.onInvokeElement(this.tableElement, this.onToggleFetchDetails.bind(this, fetchDetailsElement));
    const detailsView = new UI.TreeOutline.TreeOutlineInShadow();
    fetchDetailsElement.appendChild(detailsView.element);
    const origRequest = Logs.NetworkLog.NetworkLog.instance().originalRequestForURL(this.request.url());
    if (origRequest) {
      const requestObject = SDK.RemoteObject.RemoteObject.fromLocalObject(origRequest);
      const requestTreeElement = new ObjectUI.ObjectPropertiesSection.RootElement(requestObject);
      requestTreeElement.title = i18nString(UIStrings.originalRequest);
      detailsView.appendChild(requestTreeElement);
    }
    const response = Logs.NetworkLog.NetworkLog.instance().originalResponseForURL(this.request.url());
    if (response) {
      const responseObject = SDK.RemoteObject.RemoteObject.fromLocalObject(response);
      const responseTreeElement = new ObjectUI.ObjectPropertiesSection.RootElement(responseObject);
      responseTreeElement.title = i18nString(UIStrings.responseReceived);
      detailsView.appendChild(responseTreeElement);
    }
    const serviceWorkerResponseSource = document2.createElement("div");
    serviceWorkerResponseSource.classList.add("network-fetch-details-treeitem");
    let swResponseSourceString = i18nString(UIStrings.unknown);
    const swResponseSource = this.request.serviceWorkerResponseSource();
    if (swResponseSource) {
      swResponseSourceString = this.getLocalizedResponseSourceForCode(swResponseSource);
    }
    serviceWorkerResponseSource.textContent = i18nString(UIStrings.sourceOfResponseS, { PH1: swResponseSourceString });
    const responseSourceTreeElement = new UI.TreeOutline.TreeElement(serviceWorkerResponseSource);
    detailsView.appendChild(responseSourceTreeElement);
    const cacheNameElement = document2.createElement("div");
    cacheNameElement.classList.add("network-fetch-details-treeitem");
    const responseCacheStorageName = this.request.getResponseCacheStorageCacheName();
    if (responseCacheStorageName) {
      cacheNameElement.textContent = i18nString(UIStrings.cacheStorageCacheNameS, { PH1: responseCacheStorageName });
    } else {
      cacheNameElement.textContent = i18nString(UIStrings.cacheStorageCacheNameUnknown);
    }
    const cacheNameTreeElement = new UI.TreeOutline.TreeElement(cacheNameElement);
    detailsView.appendChild(cacheNameTreeElement);
    const retrievalTime = this.request.getResponseRetrievalTime();
    if (retrievalTime) {
      const responseTimeElement = document2.createElement("div");
      responseTimeElement.classList.add("network-fetch-details-treeitem");
      responseTimeElement.textContent = i18nString(UIStrings.retrievalTimeS, { PH1: retrievalTime.toString() });
      const responseTimeTreeElement = new UI.TreeOutline.TreeElement(responseTimeElement);
      detailsView.appendChild(responseTimeTreeElement);
    }
  }
  getLocalizedResponseSourceForCode(swResponseSource) {
    switch (swResponseSource) {
      case Protocol.Network.ServiceWorkerResponseSource.CacheStorage:
        return i18nString(UIStrings.serviceworkerCacheStorage);
      case Protocol.Network.ServiceWorkerResponseSource.HttpCache:
        return i18nString(UIStrings.fromHttpCache);
      case Protocol.Network.ServiceWorkerResponseSource.Network:
        return i18nString(UIStrings.networkFetch);
      default:
        return i18nString(UIStrings.fallbackCode);
    }
  }
  onToggleFetchDetails(fetchDetailsElement, event) {
    if (!event.target) {
      return;
    }
    const target = event.target;
    if (target.classList.contains("network-fetch-timing-bar-clickable")) {
      if (fetchDetailsElement.classList.contains("network-fetch-timing-bar-details-collapsed")) {
        Host.userMetrics.actionTaken(Host.UserMetrics.Action.NetworkPanelServiceWorkerRespondWith);
      }
      const expanded = target.getAttribute("aria-checked") === "true";
      target.setAttribute("aria-checked", String(!expanded));
      fetchDetailsElement.classList.toggle("network-fetch-timing-bar-details-collapsed");
      fetchDetailsElement.classList.toggle("network-fetch-timing-bar-details-expanded");
    }
  }
  wasShown() {
    this.request.addEventListener(SDK.NetworkRequest.Events.TimingChanged, this.refresh, this);
    this.request.addEventListener(SDK.NetworkRequest.Events.FinishedLoading, this.refresh, this);
    this.calculator.addEventListener(Events.BoundariesChanged, this.boundaryChanged, this);
    this.registerCSSFiles([networkingTimingTableStyles]);
    this.refresh();
  }
  willHide() {
    this.request.removeEventListener(SDK.NetworkRequest.Events.TimingChanged, this.refresh, this);
    this.request.removeEventListener(SDK.NetworkRequest.Events.FinishedLoading, this.refresh, this);
    this.calculator.removeEventListener(Events.BoundariesChanged, this.boundaryChanged, this);
  }
  refresh() {
    if (this.tableElement) {
      this.tableElement.remove();
    }
    this.tableElement = RequestTimingView.createTimingTable(this.request, this.calculator);
    this.tableElement.classList.add("resource-timing-table");
    this.element.appendChild(this.tableElement);
    if (this.request.fetchedViaServiceWorker) {
      this.constructFetchDetailsView();
    }
  }
  boundaryChanged() {
    const minimumBoundary = this.calculator.minimumBoundary();
    if (minimumBoundary !== this.lastMinimumBoundary) {
      this.lastMinimumBoundary = minimumBoundary;
      this.refresh();
    }
  }
}
export var RequestTimeRangeNames = /* @__PURE__ */ ((RequestTimeRangeNames2) => {
  RequestTimeRangeNames2["Push"] = "push";
  RequestTimeRangeNames2["Queueing"] = "queueing";
  RequestTimeRangeNames2["Blocking"] = "blocking";
  RequestTimeRangeNames2["Connecting"] = "connecting";
  RequestTimeRangeNames2["DNS"] = "dns";
  RequestTimeRangeNames2["Proxy"] = "proxy";
  RequestTimeRangeNames2["Receiving"] = "receiving";
  RequestTimeRangeNames2["ReceivingPush"] = "receiving-push";
  RequestTimeRangeNames2["Sending"] = "sending";
  RequestTimeRangeNames2["ServiceWorker"] = "serviceworker";
  RequestTimeRangeNames2["ServiceWorkerPreparation"] = "serviceworker-preparation";
  RequestTimeRangeNames2["ServiceWorkerRespondWith"] = "serviceworker-respondwith";
  RequestTimeRangeNames2["SSL"] = "ssl";
  RequestTimeRangeNames2["Total"] = "total";
  RequestTimeRangeNames2["Waiting"] = "waiting";
  return RequestTimeRangeNames2;
})(RequestTimeRangeNames || {});
export const ServiceWorkerRangeNames = /* @__PURE__ */ new Set([
  "serviceworker" /* ServiceWorker */,
  "serviceworker-preparation" /* ServiceWorkerPreparation */,
  "serviceworker-respondwith" /* ServiceWorkerRespondWith */
]);
export const ConnectionSetupRangeNames = /* @__PURE__ */ new Set([
  "queueing" /* Queueing */,
  "blocking" /* Blocking */,
  "connecting" /* Connecting */,
  "dns" /* DNS */,
  "proxy" /* Proxy */,
  "ssl" /* SSL */
]);
//# sourceMappingURL=RequestTimingView.js.map
