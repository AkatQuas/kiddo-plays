import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
const UIStrings = {
  anonymous: "<anonymous>"
};
const str_ = i18n.i18n.registerUIStrings("models/logs/NetworkLog.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let networkLogInstance;
export class NetworkLog extends Common.ObjectWrapper.ObjectWrapper {
  requestsInternal;
  sentNetworkRequests;
  receivedNetworkResponses;
  requestsSet;
  requestsMap;
  pageLoadForManager;
  isRecording;
  modelListeners;
  initiatorData;
  unresolvedPreflightRequests;
  constructor() {
    super();
    this.requestsInternal = [];
    this.sentNetworkRequests = [];
    this.receivedNetworkResponses = [];
    this.requestsSet = /* @__PURE__ */ new Set();
    this.requestsMap = /* @__PURE__ */ new Map();
    this.pageLoadForManager = /* @__PURE__ */ new Map();
    this.isRecording = true;
    this.modelListeners = /* @__PURE__ */ new WeakMap();
    this.initiatorData = /* @__PURE__ */ new WeakMap();
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.NetworkManager.NetworkManager, this);
    const recordLogSetting = Common.Settings.Settings.instance().moduleSetting("network_log.record-log");
    recordLogSetting.addChangeListener(() => {
      const preserveLogSetting = Common.Settings.Settings.instance().moduleSetting("network_log.preserve-log");
      if (!preserveLogSetting.get() && recordLogSetting.get()) {
        this.reset(true);
      }
      this.setIsRecording(recordLogSetting.get());
    }, this);
    this.unresolvedPreflightRequests = /* @__PURE__ */ new Map();
  }
  static instance() {
    if (!networkLogInstance) {
      networkLogInstance = new NetworkLog();
    }
    return networkLogInstance;
  }
  modelAdded(networkManager) {
    const eventListeners = [];
    eventListeners.push(networkManager.addEventListener(SDK.NetworkManager.Events.RequestStarted, this.onRequestStarted, this));
    eventListeners.push(networkManager.addEventListener(SDK.NetworkManager.Events.RequestUpdated, this.onRequestUpdated, this));
    eventListeners.push(networkManager.addEventListener(SDK.NetworkManager.Events.RequestRedirected, this.onRequestRedirect, this));
    eventListeners.push(networkManager.addEventListener(SDK.NetworkManager.Events.RequestFinished, this.onRequestUpdated, this));
    eventListeners.push(networkManager.addEventListener(SDK.NetworkManager.Events.MessageGenerated, this.networkMessageGenerated.bind(this, networkManager)));
    eventListeners.push(networkManager.addEventListener(SDK.NetworkManager.Events.ResponseReceived, this.onResponseReceived, this));
    const resourceTreeModel = networkManager.target().model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (resourceTreeModel) {
      eventListeners.push(resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.WillReloadPage, this.willReloadPage, this));
      eventListeners.push(resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.MainFrameNavigated, this.onMainFrameNavigated, this));
      eventListeners.push(resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.Load, this.onLoad, this));
      eventListeners.push(resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.DOMContentLoaded, this.onDOMContentLoaded.bind(this, resourceTreeModel)));
    }
    this.modelListeners.set(networkManager, eventListeners);
  }
  modelRemoved(networkManager) {
    this.removeNetworkManagerListeners(networkManager);
  }
  removeNetworkManagerListeners(networkManager) {
    Common.EventTarget.removeEventListeners(this.modelListeners.get(networkManager) || []);
  }
  setIsRecording(enabled) {
    if (this.isRecording === enabled) {
      return;
    }
    this.isRecording = enabled;
    if (enabled) {
      SDK.TargetManager.TargetManager.instance().observeModels(SDK.NetworkManager.NetworkManager, this);
    } else {
      SDK.TargetManager.TargetManager.instance().unobserveModels(SDK.NetworkManager.NetworkManager, this);
      SDK.TargetManager.TargetManager.instance().models(SDK.NetworkManager.NetworkManager).forEach(this.removeNetworkManagerListeners.bind(this));
    }
  }
  requestForURL(url) {
    return this.requestsInternal.find((request) => request.url() === url) || null;
  }
  originalRequestForURL(url) {
    return this.sentNetworkRequests.find((request) => request.url === url) || null;
  }
  originalResponseForURL(url) {
    return this.receivedNetworkResponses.find((response) => response.url === url) || null;
  }
  requests() {
    return this.requestsInternal;
  }
  requestByManagerAndId(networkManager, requestId) {
    for (let i = this.requestsInternal.length - 1; i >= 0; i--) {
      const request = this.requestsInternal[i];
      if (requestId === request.requestId() && networkManager === SDK.NetworkManager.NetworkManager.forRequest(request)) {
        return request;
      }
    }
    return null;
  }
  requestByManagerAndURL(networkManager, url) {
    for (const request of this.requestsInternal) {
      if (url === request.url() && networkManager === SDK.NetworkManager.NetworkManager.forRequest(request)) {
        return request;
      }
    }
    return null;
  }
  initializeInitiatorSymbolIfNeeded(request) {
    let initiatorInfo = this.initiatorData.get(request);
    if (initiatorInfo) {
      return initiatorInfo;
    }
    initiatorInfo = {
      info: null,
      chain: null,
      request: void 0
    };
    this.initiatorData.set(request, initiatorInfo);
    return initiatorInfo;
  }
  static initiatorInfoForRequest(request, existingInitiatorData) {
    const initiatorInfo = existingInitiatorData || {
      info: null,
      chain: null,
      request: void 0
    };
    let type = SDK.NetworkRequest.InitiatorType.Other;
    let url = Platform.DevToolsPath.EmptyUrlString;
    let lineNumber = -Infinity;
    let columnNumber = -Infinity;
    let scriptId = null;
    let initiatorStack = null;
    let initiatorRequest = null;
    const initiator = request.initiator();
    const redirectSource = request.redirectSource();
    if (redirectSource) {
      type = SDK.NetworkRequest.InitiatorType.Redirect;
      url = redirectSource.url();
    } else if (initiator) {
      if (initiator.type === Protocol.Network.InitiatorType.Parser) {
        type = SDK.NetworkRequest.InitiatorType.Parser;
        url = initiator.url ? initiator.url : url;
        lineNumber = typeof initiator.lineNumber === "number" ? initiator.lineNumber : lineNumber;
        columnNumber = typeof initiator.columnNumber === "number" ? initiator.columnNumber : columnNumber;
      } else if (initiator.type === Protocol.Network.InitiatorType.Script) {
        for (let stack = initiator.stack; stack; ) {
          const topFrame = stack.callFrames.length ? stack.callFrames[0] : null;
          if (!topFrame) {
            stack = stack.parent;
            continue;
          }
          type = SDK.NetworkRequest.InitiatorType.Script;
          url = topFrame.url || i18nString(UIStrings.anonymous);
          lineNumber = topFrame.lineNumber;
          columnNumber = topFrame.columnNumber;
          scriptId = topFrame.scriptId;
          break;
        }
        if (!initiator.stack && initiator.url) {
          type = SDK.NetworkRequest.InitiatorType.Script;
          url = initiator.url;
          lineNumber = initiator.lineNumber || 0;
        }
        if (initiator.stack && initiator.stack.callFrames && initiator.stack.callFrames.length) {
          initiatorStack = initiator.stack || null;
        }
      } else if (initiator.type === Protocol.Network.InitiatorType.Preload) {
        type = SDK.NetworkRequest.InitiatorType.Preload;
      } else if (initiator.type === Protocol.Network.InitiatorType.Preflight) {
        type = SDK.NetworkRequest.InitiatorType.Preflight;
        initiatorRequest = request.preflightInitiatorRequest();
      } else if (initiator.type === Protocol.Network.InitiatorType.SignedExchange) {
        type = SDK.NetworkRequest.InitiatorType.SignedExchange;
        url = initiator.url || Platform.DevToolsPath.EmptyUrlString;
      }
    }
    initiatorInfo.info = { type, url, lineNumber, columnNumber, scriptId, stack: initiatorStack, initiatorRequest };
    return initiatorInfo.info;
  }
  initiatorInfoForRequest(request) {
    const initiatorInfo = this.initializeInitiatorSymbolIfNeeded(request);
    if (initiatorInfo.info) {
      return initiatorInfo.info;
    }
    return NetworkLog.initiatorInfoForRequest(request, initiatorInfo);
  }
  initiatorGraphForRequest(request) {
    const initiated = /* @__PURE__ */ new Map();
    const networkManager = SDK.NetworkManager.NetworkManager.forRequest(request);
    for (const otherRequest of this.requestsInternal) {
      const otherRequestManager = SDK.NetworkManager.NetworkManager.forRequest(otherRequest);
      if (networkManager === otherRequestManager && this.initiatorChain(otherRequest).has(request)) {
        const initiatorRequest = this.initiatorRequest(otherRequest);
        if (initiatorRequest) {
          initiated.set(otherRequest, initiatorRequest);
        }
      }
    }
    return { initiators: this.initiatorChain(request), initiated };
  }
  initiatorChain(request) {
    const initiatorDataForRequest = this.initializeInitiatorSymbolIfNeeded(request);
    let initiatorChainCache = initiatorDataForRequest.chain;
    if (initiatorChainCache) {
      return initiatorChainCache;
    }
    initiatorChainCache = /* @__PURE__ */ new Set();
    let checkRequest = request;
    while (checkRequest) {
      const initiatorData = this.initializeInitiatorSymbolIfNeeded(checkRequest);
      if (initiatorData.chain) {
        Platform.SetUtilities.addAll(initiatorChainCache, initiatorData.chain);
        break;
      }
      if (initiatorChainCache.has(checkRequest)) {
        break;
      }
      initiatorChainCache.add(checkRequest);
      checkRequest = this.initiatorRequest(checkRequest);
    }
    initiatorDataForRequest.chain = initiatorChainCache;
    return initiatorChainCache;
  }
  initiatorRequest(request) {
    const initiatorData = this.initializeInitiatorSymbolIfNeeded(request);
    if (initiatorData.request !== void 0) {
      return initiatorData.request;
    }
    const url = this.initiatorInfoForRequest(request).url;
    const networkManager = SDK.NetworkManager.NetworkManager.forRequest(request);
    initiatorData.request = networkManager ? this.requestByManagerAndURL(networkManager, url) : null;
    return initiatorData.request;
  }
  willReloadPage() {
    if (!Common.Settings.Settings.instance().moduleSetting("network_log.preserve-log").get()) {
      this.reset(true);
    }
  }
  onMainFrameNavigated(event) {
    const mainFrame = event.data;
    const manager = mainFrame.resourceTreeModel().target().model(SDK.NetworkManager.NetworkManager);
    if (!manager || mainFrame.resourceTreeModel().target().parentTarget()) {
      return;
    }
    if (mainFrame.url !== mainFrame.unreachableUrl() && mainFrame.url.startsWith("chrome-error://")) {
      return;
    }
    const preserveLog = Common.Settings.Settings.instance().moduleSetting("network_log.preserve-log").get();
    const oldRequests = this.requestsInternal;
    const oldManagerRequests = this.requestsInternal.filter((request) => SDK.NetworkManager.NetworkManager.forRequest(request) === manager);
    const oldRequestsSet = this.requestsSet;
    this.requestsInternal = [];
    this.sentNetworkRequests = [];
    this.receivedNetworkResponses = [];
    this.requestsSet = /* @__PURE__ */ new Set();
    this.requestsMap.clear();
    this.unresolvedPreflightRequests.clear();
    this.dispatchEventToListeners(Events.Reset, { clearIfPreserved: !preserveLog });
    let currentPageLoad = null;
    const requestsToAdd = [];
    for (const request of oldManagerRequests) {
      if (request.loaderId !== mainFrame.loaderId) {
        continue;
      }
      if (!currentPageLoad) {
        currentPageLoad = new SDK.PageLoad.PageLoad(request);
        let redirectSource = request.redirectSource();
        while (redirectSource) {
          requestsToAdd.push(redirectSource);
          redirectSource = redirectSource.redirectSource();
        }
      }
      requestsToAdd.push(request);
    }
    const serviceWorkerRequestsToAdd = [];
    for (const swRequest of oldRequests) {
      if (!swRequest.initiatedByServiceWorker()) {
        continue;
      }
      const keepRequest = requestsToAdd.some((request) => request.url() === swRequest.url() && request.issueTime() <= swRequest.issueTime());
      if (keepRequest) {
        serviceWorkerRequestsToAdd.push(swRequest);
      }
    }
    requestsToAdd.push(...serviceWorkerRequestsToAdd);
    for (const request of requestsToAdd) {
      currentPageLoad?.bindRequest(request);
      oldRequestsSet.delete(request);
      this.addRequest(request);
    }
    if (preserveLog) {
      for (const request of oldRequestsSet) {
        this.addRequest(request);
        request.preserved = true;
      }
    }
    if (currentPageLoad) {
      this.pageLoadForManager.set(manager, currentPageLoad);
    }
  }
  addRequest(request) {
    this.requestsInternal.push(request);
    this.requestsSet.add(request);
    const requestList = this.requestsMap.get(request.requestId());
    if (!requestList) {
      this.requestsMap.set(request.requestId(), [request]);
    } else {
      requestList.push(request);
    }
    this.tryResolvePreflightRequests(request);
    this.dispatchEventToListeners(Events.RequestAdded, request);
  }
  tryResolvePreflightRequests(request) {
    if (request.isPreflightRequest()) {
      const initiator = request.initiator();
      if (initiator && initiator.requestId) {
        const [initiatorRequest] = this.requestsForId(initiator.requestId);
        if (initiatorRequest) {
          request.setPreflightInitiatorRequest(initiatorRequest);
          initiatorRequest.setPreflightRequest(request);
        } else {
          this.unresolvedPreflightRequests.set(initiator.requestId, request);
        }
      }
    } else {
      const preflightRequest = this.unresolvedPreflightRequests.get(request.requestId());
      if (preflightRequest) {
        this.unresolvedPreflightRequests.delete(request.requestId());
        request.setPreflightRequest(preflightRequest);
        preflightRequest.setPreflightInitiatorRequest(request);
        const data = this.initiatorData.get(preflightRequest);
        if (data) {
          data.info = null;
        }
        this.dispatchEventToListeners(Events.RequestUpdated, preflightRequest);
      }
    }
  }
  importRequests(requests) {
    this.reset(true);
    this.requestsInternal = [];
    this.sentNetworkRequests = [];
    this.receivedNetworkResponses = [];
    this.requestsSet.clear();
    this.requestsMap.clear();
    this.unresolvedPreflightRequests.clear();
    for (const request of requests) {
      this.addRequest(request);
    }
  }
  onRequestStarted(event) {
    const { request, originalRequest } = event.data;
    if (originalRequest) {
      this.sentNetworkRequests.push(originalRequest);
    }
    this.requestsSet.add(request);
    const manager = SDK.NetworkManager.NetworkManager.forRequest(request);
    const pageLoad = manager ? this.pageLoadForManager.get(manager) : null;
    if (pageLoad) {
      pageLoad.bindRequest(request);
    }
    this.addRequest(request);
  }
  onResponseReceived(event) {
    const response = event.data.response;
    this.receivedNetworkResponses.push(response);
  }
  onRequestUpdated(event) {
    const request = event.data;
    if (!this.requestsSet.has(request)) {
      return;
    }
    this.dispatchEventToListeners(Events.RequestUpdated, request);
  }
  onRequestRedirect(event) {
    this.initiatorData.delete(event.data);
  }
  onDOMContentLoaded(resourceTreeModel, event) {
    const networkManager = resourceTreeModel.target().model(SDK.NetworkManager.NetworkManager);
    const pageLoad = networkManager ? this.pageLoadForManager.get(networkManager) : null;
    if (pageLoad) {
      pageLoad.contentLoadTime = event.data;
    }
  }
  onLoad(event) {
    const networkManager = event.data.resourceTreeModel.target().model(SDK.NetworkManager.NetworkManager);
    const pageLoad = networkManager ? this.pageLoadForManager.get(networkManager) : null;
    if (pageLoad) {
      pageLoad.loadTime = event.data.loadTime;
    }
  }
  reset(clearIfPreserved) {
    this.requestsInternal = [];
    this.sentNetworkRequests = [];
    this.receivedNetworkResponses = [];
    this.requestsSet.clear();
    this.requestsMap.clear();
    this.unresolvedPreflightRequests.clear();
    const managers = new Set(SDK.TargetManager.TargetManager.instance().models(SDK.NetworkManager.NetworkManager));
    for (const manager of this.pageLoadForManager.keys()) {
      if (!managers.has(manager)) {
        this.pageLoadForManager.delete(manager);
      }
    }
    this.dispatchEventToListeners(Events.Reset, { clearIfPreserved });
  }
  networkMessageGenerated(networkManager, event) {
    const { message, warning, requestId } = event.data;
    const consoleMessage = new SDK.ConsoleModel.ConsoleMessage(networkManager.target().model(SDK.RuntimeModel.RuntimeModel), Protocol.Log.LogEntrySource.Network, warning ? Protocol.Log.LogEntryLevel.Warning : Protocol.Log.LogEntryLevel.Info, message);
    this.associateConsoleMessageWithRequest(consoleMessage, requestId);
    SDK.ConsoleModel.ConsoleModel.instance().addMessage(consoleMessage);
  }
  associateConsoleMessageWithRequest(consoleMessage, requestId) {
    const target = consoleMessage.target();
    const networkManager = target ? target.model(SDK.NetworkManager.NetworkManager) : null;
    if (!networkManager) {
      return;
    }
    const request = this.requestByManagerAndId(networkManager, requestId);
    if (!request) {
      return;
    }
    consoleMessageToRequest.set(consoleMessage, request);
    const initiator = request.initiator();
    if (initiator) {
      consoleMessage.stackTrace = initiator.stack || void 0;
      if (initiator.url) {
        consoleMessage.url = initiator.url;
        consoleMessage.line = initiator.lineNumber || 0;
      }
    }
  }
  static requestForConsoleMessage(consoleMessage) {
    return consoleMessageToRequest.get(consoleMessage) || null;
  }
  requestsForId(requestId) {
    return this.requestsMap.get(requestId) || [];
  }
}
const consoleMessageToRequest = /* @__PURE__ */ new WeakMap();
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["Reset"] = "Reset";
  Events2["RequestAdded"] = "RequestAdded";
  Events2["RequestUpdated"] = "RequestUpdated";
  return Events2;
})(Events || {});
//# sourceMappingURL=NetworkLog.js.map
