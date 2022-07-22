import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Logs from "../../models/logs/logs.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ThemeSupport from "../../ui/legacy/theme_support/theme_support.js";
import * as Bindings from "../bindings/bindings.js";
import * as HAR from "../har/har.js";
import * as Workspace from "../workspace/workspace.js";
import { ExtensionButton, ExtensionPanel, ExtensionSidebarPane } from "./ExtensionPanel.js";
import { ExtensionTraceProvider } from "./ExtensionTraceProvider.js";
import { LanguageExtensionEndpoint } from "./LanguageExtensionEndpoint.js";
import { RecorderExtensionEndpoint } from "./RecorderExtensionEndpoint.js";
import { PrivateAPI } from "./ExtensionAPI.js";
import { RecorderPluginManager } from "./RecorderPluginManager.js";
const extensionOrigins = /* @__PURE__ */ new WeakMap();
const kAllowedOrigins = [
  "chrome://newtab",
  "chrome://new-tab-page"
].map((url) => new URL(url).origin);
let extensionServerInstance;
export class ExtensionServer extends Common.ObjectWrapper.ObjectWrapper {
  clientObjects;
  handlers;
  subscribers;
  subscriptionStartHandlers;
  subscriptionStopHandlers;
  extraHeaders;
  requests;
  requestIds;
  lastRequestId;
  registeredExtensions;
  status;
  sidebarPanesInternal;
  traceProvidersInternal;
  traceSessions;
  extensionsEnabled;
  inspectedTabId;
  extensionAPITestHook;
  themeChangeHandlers = /* @__PURE__ */ new Map();
  constructor() {
    super();
    this.clientObjects = /* @__PURE__ */ new Map();
    this.handlers = /* @__PURE__ */ new Map();
    this.subscribers = /* @__PURE__ */ new Map();
    this.subscriptionStartHandlers = /* @__PURE__ */ new Map();
    this.subscriptionStopHandlers = /* @__PURE__ */ new Map();
    this.extraHeaders = /* @__PURE__ */ new Map();
    this.requests = /* @__PURE__ */ new Map();
    this.requestIds = /* @__PURE__ */ new Map();
    this.lastRequestId = 0;
    this.registeredExtensions = /* @__PURE__ */ new Map();
    this.status = new ExtensionStatus();
    this.sidebarPanesInternal = [];
    this.traceProvidersInternal = [];
    this.traceSessions = /* @__PURE__ */ new Map();
    this.extensionsEnabled = true;
    this.registerHandler(PrivateAPI.Commands.AddRequestHeaders, this.onAddRequestHeaders.bind(this));
    this.registerHandler(PrivateAPI.Commands.AddTraceProvider, this.onAddTraceProvider.bind(this));
    this.registerHandler(PrivateAPI.Commands.ApplyStyleSheet, this.onApplyStyleSheet.bind(this));
    this.registerHandler(PrivateAPI.Commands.CompleteTraceSession, this.onCompleteTraceSession.bind(this));
    this.registerHandler(PrivateAPI.Commands.CreatePanel, this.onCreatePanel.bind(this));
    this.registerHandler(PrivateAPI.Commands.CreateSidebarPane, this.onCreateSidebarPane.bind(this));
    this.registerHandler(PrivateAPI.Commands.CreateToolbarButton, this.onCreateToolbarButton.bind(this));
    this.registerHandler(PrivateAPI.Commands.EvaluateOnInspectedPage, this.onEvaluateOnInspectedPage.bind(this));
    this.registerHandler(PrivateAPI.Commands.ForwardKeyboardEvent, this.onForwardKeyboardEvent.bind(this));
    this.registerHandler(PrivateAPI.Commands.GetHAR, this.onGetHAR.bind(this));
    this.registerHandler(PrivateAPI.Commands.GetPageResources, this.onGetPageResources.bind(this));
    this.registerHandler(PrivateAPI.Commands.GetRequestContent, this.onGetRequestContent.bind(this));
    this.registerHandler(PrivateAPI.Commands.GetResourceContent, this.onGetResourceContent.bind(this));
    this.registerHandler(PrivateAPI.Commands.Reload, this.onReload.bind(this));
    this.registerHandler(PrivateAPI.Commands.SetOpenResourceHandler, this.onSetOpenResourceHandler.bind(this));
    this.registerHandler(PrivateAPI.Commands.SetThemeChangeHandler, this.onSetThemeChangeHandler.bind(this));
    this.registerHandler(PrivateAPI.Commands.SetResourceContent, this.onSetResourceContent.bind(this));
    this.registerHandler(PrivateAPI.Commands.SetSidebarHeight, this.onSetSidebarHeight.bind(this));
    this.registerHandler(PrivateAPI.Commands.SetSidebarContent, this.onSetSidebarContent.bind(this));
    this.registerHandler(PrivateAPI.Commands.SetSidebarPage, this.onSetSidebarPage.bind(this));
    this.registerHandler(PrivateAPI.Commands.ShowPanel, this.onShowPanel.bind(this));
    this.registerHandler(PrivateAPI.Commands.Subscribe, this.onSubscribe.bind(this));
    this.registerHandler(PrivateAPI.Commands.OpenResource, this.onOpenResource.bind(this));
    this.registerHandler(PrivateAPI.Commands.Unsubscribe, this.onUnsubscribe.bind(this));
    this.registerHandler(PrivateAPI.Commands.UpdateButton, this.onUpdateButton.bind(this));
    this.registerHandler(PrivateAPI.Commands.RegisterLanguageExtensionPlugin, this.registerLanguageExtensionEndpoint.bind(this));
    this.registerHandler(PrivateAPI.Commands.RegisterRecorderExtensionPlugin, this.registerRecorderExtensionEndpoint.bind(this));
    window.addEventListener("message", this.onWindowMessage.bind(this), false);
    const existingTabId = window.DevToolsAPI && window.DevToolsAPI.getInspectedTabId && window.DevToolsAPI.getInspectedTabId();
    if (existingTabId) {
      this.setInspectedTabId({ data: existingTabId });
    }
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.SetInspectedTabId, this.setInspectedTabId, this);
    this.initExtensions();
    ThemeSupport.ThemeSupport.instance().addEventListener(ThemeSupport.ThemeChangeEvent.eventName, () => {
      const themeName = ThemeSupport.ThemeSupport.instance().themeName();
      for (const port of this.themeChangeHandlers.values()) {
        port.postMessage({ command: PrivateAPI.Events.ThemeChange, themeName });
      }
    });
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!extensionServerInstance || forceNew) {
      extensionServerInstance = new ExtensionServer();
    }
    return extensionServerInstance;
  }
  initializeExtensions() {
    if (this.inspectedTabId !== null) {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.setAddExtensionCallback(this.addExtension.bind(this));
    }
  }
  hasExtensions() {
    return Boolean(this.registeredExtensions.size);
  }
  notifySearchAction(panelId, action, searchString) {
    this.postNotification(PrivateAPI.Events.PanelSearch + panelId, action, searchString);
  }
  notifyViewShown(identifier, frameIndex) {
    this.postNotification(PrivateAPI.Events.ViewShown + identifier, frameIndex);
  }
  notifyViewHidden(identifier) {
    this.postNotification(PrivateAPI.Events.ViewHidden + identifier);
  }
  notifyButtonClicked(identifier) {
    this.postNotification(PrivateAPI.Events.ButtonClicked + identifier);
  }
  registerLanguageExtensionEndpoint(message, _shared_port) {
    if (message.command !== PrivateAPI.Commands.RegisterLanguageExtensionPlugin) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.Subscribe}`);
    }
    const { pluginManager } = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
    if (!pluginManager) {
      return this.status.E_FAILED("WebAssembly DWARF support needs to be enabled to use this extension");
    }
    const { pluginName, port, supportedScriptTypes: { language, symbol_types } } = message;
    const symbol_types_array = Array.isArray(symbol_types) && symbol_types.every((e) => typeof e === "string") ? symbol_types : [];
    const endpoint = new LanguageExtensionEndpoint(pluginName, { language, symbol_types: symbol_types_array }, port);
    pluginManager.addPlugin(endpoint);
    return this.status.OK();
  }
  registerRecorderExtensionEndpoint(message, _shared_port) {
    if (message.command !== PrivateAPI.Commands.RegisterRecorderExtensionPlugin) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.RegisterRecorderExtensionPlugin}`);
    }
    const { pluginName, mediaType, port } = message;
    RecorderPluginManager.instance().addPlugin(new RecorderExtensionEndpoint(pluginName, mediaType, port));
    return this.status.OK();
  }
  inspectedURLChanged(event) {
    if (!this.canInspectURL(event.data.inspectedURL())) {
      this.disableExtensions();
      return;
    }
    if (event.data !== SDK.TargetManager.TargetManager.instance().mainTarget()) {
      return;
    }
    this.requests = /* @__PURE__ */ new Map();
    const url = event.data.inspectedURL();
    this.postNotification(PrivateAPI.Events.InspectedURLChanged, url);
  }
  startTraceRecording(providerId, sessionId, session) {
    this.traceSessions.set(sessionId, session);
    this.postNotification("trace-recording-started-" + providerId, sessionId);
  }
  stopTraceRecording(providerId) {
    this.postNotification("trace-recording-stopped-" + providerId);
  }
  hasSubscribers(type) {
    return this.subscribers.has(type);
  }
  postNotification(type, ..._vararg) {
    if (!this.extensionsEnabled) {
      return;
    }
    const subscribers = this.subscribers.get(type);
    if (!subscribers) {
      return;
    }
    const message = { command: "notify-" + type, arguments: Array.prototype.slice.call(arguments, 1) };
    for (const subscriber of subscribers) {
      subscriber.postMessage(message);
    }
  }
  onSubscribe(message, port) {
    if (message.command !== PrivateAPI.Commands.Subscribe) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.Subscribe}`);
    }
    const subscribers = this.subscribers.get(message.type);
    if (subscribers) {
      subscribers.add(port);
    } else {
      this.subscribers.set(message.type, /* @__PURE__ */ new Set([port]));
      const handler = this.subscriptionStartHandlers.get(message.type);
      if (handler) {
        handler();
      }
    }
    return void 0;
  }
  onUnsubscribe(message, port) {
    if (message.command !== PrivateAPI.Commands.Unsubscribe) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.Unsubscribe}`);
    }
    const subscribers = this.subscribers.get(message.type);
    if (!subscribers) {
      return;
    }
    subscribers.delete(port);
    if (!subscribers.size) {
      this.subscribers.delete(message.type);
      const handler = this.subscriptionStopHandlers.get(message.type);
      if (handler) {
        handler();
      }
    }
    return void 0;
  }
  onAddRequestHeaders(message) {
    if (message.command !== PrivateAPI.Commands.AddRequestHeaders) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.AddRequestHeaders}`);
    }
    const id = message.extensionId;
    if (typeof id !== "string") {
      return this.status.E_BADARGTYPE("extensionId", typeof id, "string");
    }
    let extensionHeaders = this.extraHeaders.get(id);
    if (!extensionHeaders) {
      extensionHeaders = /* @__PURE__ */ new Map();
      this.extraHeaders.set(id, extensionHeaders);
    }
    for (const name in message.headers) {
      extensionHeaders.set(name, message.headers[name]);
    }
    const allHeaders = {};
    for (const headers of this.extraHeaders.values()) {
      for (const [name, value] of headers) {
        if (name !== "__proto__" && typeof value === "string") {
          allHeaders[name] = value;
        }
      }
    }
    SDK.NetworkManager.MultitargetNetworkManager.instance().setExtraHTTPHeaders(allHeaders);
    return void 0;
  }
  onApplyStyleSheet(message) {
    if (message.command !== PrivateAPI.Commands.ApplyStyleSheet) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.ApplyStyleSheet}`);
    }
    if (!Root.Runtime.experiments.isEnabled("applyCustomStylesheet")) {
      return;
    }
    const styleSheet = document.createElement("style");
    styleSheet.textContent = message.styleSheet;
    document.head.appendChild(styleSheet);
    ThemeSupport.ThemeSupport.instance().addCustomStylesheet(message.styleSheet);
    for (let node = document.body; node; node = node.traverseNextNode(document.body)) {
      if (node instanceof ShadowRoot) {
        ThemeSupport.ThemeSupport.instance().injectCustomStyleSheets(node);
      }
    }
    return void 0;
  }
  getExtensionOrigin(port) {
    const origin = extensionOrigins.get(port);
    if (!origin) {
      throw new Error("Received a message from an unregistered extension");
    }
    return origin;
  }
  onCreatePanel(message, port) {
    if (message.command !== PrivateAPI.Commands.CreatePanel) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.CreatePanel}`);
    }
    const id = message.id;
    if (this.clientObjects.has(id) || UI.InspectorView.InspectorView.instance().hasPanel(id)) {
      return this.status.E_EXISTS(id);
    }
    const page = this.expandResourcePath(this.getExtensionOrigin(port), message.page);
    let persistentId = this.getExtensionOrigin(port) + message.title;
    persistentId = persistentId.replace(/\s/g, "");
    const panelView = new ExtensionServerPanelView(persistentId, i18n.i18n.lockedString(message.title), new ExtensionPanel(this, persistentId, id, page));
    this.clientObjects.set(id, panelView);
    UI.InspectorView.InspectorView.instance().addPanel(panelView);
    return this.status.OK();
  }
  onShowPanel(message) {
    if (message.command !== PrivateAPI.Commands.ShowPanel) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.ShowPanel}`);
    }
    let panelViewId = message.id;
    const panelView = this.clientObjects.get(message.id);
    if (panelView && panelView instanceof ExtensionServerPanelView) {
      panelViewId = panelView.viewId();
    }
    void UI.InspectorView.InspectorView.instance().showPanel(panelViewId);
    return void 0;
  }
  onCreateToolbarButton(message, port) {
    if (message.command !== PrivateAPI.Commands.CreateToolbarButton) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.CreateToolbarButton}`);
    }
    const panelView = this.clientObjects.get(message.panel);
    if (!panelView || !(panelView instanceof ExtensionServerPanelView)) {
      return this.status.E_NOTFOUND(message.panel);
    }
    const button = new ExtensionButton(this, message.id, this.expandResourcePath(this.getExtensionOrigin(port), message.icon), message.tooltip, message.disabled);
    this.clientObjects.set(message.id, button);
    void panelView.widget().then(appendButton);
    function appendButton(panel) {
      panel.addToolbarItem(button.toolbarButton());
    }
    return this.status.OK();
  }
  onUpdateButton(message, port) {
    if (message.command !== PrivateAPI.Commands.UpdateButton) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.UpdateButton}`);
    }
    const button = this.clientObjects.get(message.id);
    if (!button || !(button instanceof ExtensionButton)) {
      return this.status.E_NOTFOUND(message.id);
    }
    button.update(message.icon && this.expandResourcePath(this.getExtensionOrigin(port), message.icon), message.tooltip, message.disabled);
    return this.status.OK();
  }
  onCompleteTraceSession(message) {
    if (message.command !== PrivateAPI.Commands.CompleteTraceSession) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.CompleteTraceSession}`);
    }
    const session = this.traceSessions.get(message.id);
    if (!session) {
      return this.status.E_NOTFOUND(message.id);
    }
    this.traceSessions.delete(message.id);
    session.complete(message.url, message.timeOffset);
    return void 0;
  }
  onCreateSidebarPane(message) {
    if (message.command !== PrivateAPI.Commands.CreateSidebarPane) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.CreateSidebarPane}`);
    }
    const id = message.id;
    const sidebar = new ExtensionSidebarPane(this, message.panel, i18n.i18n.lockedString(message.title), id);
    this.sidebarPanesInternal.push(sidebar);
    this.clientObjects.set(id, sidebar);
    this.dispatchEventToListeners(Events.SidebarPaneAdded, sidebar);
    return this.status.OK();
  }
  sidebarPanes() {
    return this.sidebarPanesInternal;
  }
  onSetSidebarHeight(message) {
    if (message.command !== PrivateAPI.Commands.SetSidebarHeight) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.SetSidebarHeight}`);
    }
    const sidebar = this.clientObjects.get(message.id);
    if (!sidebar || !(sidebar instanceof ExtensionSidebarPane)) {
      return this.status.E_NOTFOUND(message.id);
    }
    sidebar.setHeight(message.height);
    return this.status.OK();
  }
  onSetSidebarContent(message, port) {
    if (message.command !== PrivateAPI.Commands.SetSidebarContent) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.SetSidebarContent}`);
    }
    const { requestId, id, rootTitle, expression, evaluateOptions, evaluateOnPage } = message;
    const sidebar = this.clientObjects.get(id);
    if (!sidebar || !(sidebar instanceof ExtensionSidebarPane)) {
      return this.status.E_NOTFOUND(message.id);
    }
    function callback(error) {
      const result = error ? this.status.E_FAILED(error) : this.status.OK();
      this.dispatchCallback(requestId, port, result);
    }
    if (evaluateOnPage) {
      sidebar.setExpression(expression, rootTitle, evaluateOptions, this.getExtensionOrigin(port), callback.bind(this));
      return void 0;
    }
    sidebar.setObject(message.expression, message.rootTitle, callback.bind(this));
    return void 0;
  }
  onSetSidebarPage(message, port) {
    if (message.command !== PrivateAPI.Commands.SetSidebarPage) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.SetSidebarPage}`);
    }
    const sidebar = this.clientObjects.get(message.id);
    if (!sidebar || !(sidebar instanceof ExtensionSidebarPane)) {
      return this.status.E_NOTFOUND(message.id);
    }
    sidebar.setPage(this.expandResourcePath(this.getExtensionOrigin(port), message.page));
    return void 0;
  }
  onOpenResource(message) {
    if (message.command !== PrivateAPI.Commands.OpenResource) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.OpenResource}`);
    }
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(message.url);
    if (uiSourceCode) {
      void Common.Revealer.reveal(uiSourceCode.uiLocation(message.lineNumber, message.columnNumber));
      return this.status.OK();
    }
    const resource = Bindings.ResourceUtils.resourceForURL(message.url);
    if (resource) {
      void Common.Revealer.reveal(resource);
      return this.status.OK();
    }
    const request = Logs.NetworkLog.NetworkLog.instance().requestForURL(message.url);
    if (request) {
      void Common.Revealer.reveal(request);
      return this.status.OK();
    }
    return this.status.E_NOTFOUND(message.url);
  }
  onSetOpenResourceHandler(message, port) {
    if (message.command !== PrivateAPI.Commands.SetOpenResourceHandler) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.SetOpenResourceHandler}`);
    }
    const extension = this.registeredExtensions.get(this.getExtensionOrigin(port));
    if (!extension) {
      throw new Error("Received a message from an unregistered extension");
    }
    const { name } = extension;
    if (message.handlerPresent) {
      Components.Linkifier.Linkifier.registerLinkHandler(name, this.handleOpenURL.bind(this, port));
    } else {
      Components.Linkifier.Linkifier.unregisterLinkHandler(name);
    }
    return void 0;
  }
  onSetThemeChangeHandler(message, port) {
    if (message.command !== PrivateAPI.Commands.SetThemeChangeHandler) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.SetThemeChangeHandler}`);
    }
    const extensionOrigin = this.getExtensionOrigin(port);
    const extension = this.registeredExtensions.get(extensionOrigin);
    if (!extension) {
      throw new Error("Received a message from an unregistered extension");
    }
    if (message.handlerPresent) {
      this.themeChangeHandlers.set(extensionOrigin, port);
    } else {
      this.themeChangeHandlers.delete(extensionOrigin);
    }
    return void 0;
  }
  handleOpenURL(port, contentProvider, lineNumber) {
    port.postMessage({ command: "open-resource", resource: this.makeResource(contentProvider), lineNumber: lineNumber + 1 });
  }
  onReload(message) {
    if (message.command !== PrivateAPI.Commands.Reload) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.Reload}`);
    }
    const options = message.options || {};
    SDK.NetworkManager.MultitargetNetworkManager.instance().setUserAgentOverride(typeof options.userAgent === "string" ? options.userAgent : "", null);
    let injectedScript;
    if (options.injectedScript) {
      injectedScript = "(function(){" + options.injectedScript + "})()";
    }
    SDK.ResourceTreeModel.ResourceTreeModel.reloadAllPages(Boolean(options.ignoreCache), injectedScript);
    return this.status.OK();
  }
  onEvaluateOnInspectedPage(message, port) {
    if (message.command !== PrivateAPI.Commands.EvaluateOnInspectedPage) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.EvaluateOnInspectedPage}`);
    }
    const { requestId, expression, evaluateOptions } = message;
    function callback(error, object, wasThrown) {
      let result;
      if (error || !object) {
        result = this.status.E_PROTOCOLERROR(error?.toString());
      } else if (wasThrown) {
        result = { isException: true, value: object.description };
      } else {
        result = { value: object.value };
      }
      this.dispatchCallback(requestId, port, result);
    }
    return this.evaluate(expression, true, true, evaluateOptions, this.getExtensionOrigin(port), callback.bind(this));
  }
  async onGetHAR(message) {
    if (message.command !== PrivateAPI.Commands.GetHAR) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.GetHAR}`);
    }
    const requests = Logs.NetworkLog.NetworkLog.instance().requests();
    const harLog = await HAR.Log.Log.build(requests);
    for (let i = 0; i < harLog.entries.length; ++i) {
      harLog.entries[i]._requestId = this.requestId(requests[i]);
    }
    return harLog;
  }
  makeResource(contentProvider) {
    return { url: contentProvider.contentURL(), type: contentProvider.contentType().name() };
  }
  onGetPageResources() {
    const resources = /* @__PURE__ */ new Map();
    function pushResourceData(contentProvider) {
      if (!resources.has(contentProvider.contentURL())) {
        resources.set(contentProvider.contentURL(), this.makeResource(contentProvider));
      }
      return false;
    }
    let uiSourceCodes = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodesForProjectType(Workspace.Workspace.projectTypes.Network);
    uiSourceCodes = uiSourceCodes.concat(Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodesForProjectType(Workspace.Workspace.projectTypes.ContentScripts));
    uiSourceCodes.forEach(pushResourceData.bind(this));
    for (const resourceTreeModel of SDK.TargetManager.TargetManager.instance().models(SDK.ResourceTreeModel.ResourceTreeModel)) {
      resourceTreeModel.forAllResources(pushResourceData.bind(this));
    }
    return [...resources.values()];
  }
  async getResourceContent(contentProvider, message, port) {
    const { content } = await contentProvider.requestContent();
    const encoded = await contentProvider.contentEncoded();
    this.dispatchCallback(message.requestId, port, { encoding: encoded ? "base64" : "", content });
  }
  onGetRequestContent(message, port) {
    if (message.command !== PrivateAPI.Commands.GetRequestContent) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.GetRequestContent}`);
    }
    const request = this.requestById(message.id);
    if (!request) {
      return this.status.E_NOTFOUND(message.id);
    }
    void this.getResourceContent(request, message, port);
    return void 0;
  }
  onGetResourceContent(message, port) {
    if (message.command !== PrivateAPI.Commands.GetResourceContent) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.GetResourceContent}`);
    }
    const url = message.url;
    const contentProvider = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url) || Bindings.ResourceUtils.resourceForURL(url);
    if (!contentProvider) {
      return this.status.E_NOTFOUND(url);
    }
    void this.getResourceContent(contentProvider, message, port);
    return void 0;
  }
  onSetResourceContent(message, port) {
    if (message.command !== PrivateAPI.Commands.SetResourceContent) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.SetResourceContent}`);
    }
    const { url, requestId, content, commit } = message;
    function callbackWrapper(error) {
      const response = error ? this.status.E_FAILED(error) : this.status.OK();
      this.dispatchCallback(requestId, port, response);
    }
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url);
    if (!uiSourceCode || !uiSourceCode.contentType().isDocumentOrScriptOrStyleSheet()) {
      const resource = SDK.ResourceTreeModel.ResourceTreeModel.resourceForURL(url);
      if (!resource) {
        return this.status.E_NOTFOUND(url);
      }
      return this.status.E_NOTSUPPORTED("Resource is not editable");
    }
    uiSourceCode.setWorkingCopy(content);
    if (commit) {
      uiSourceCode.commitWorkingCopy();
    }
    callbackWrapper.call(this, null);
    return void 0;
  }
  requestId(request) {
    const requestId = this.requestIds.get(request);
    if (requestId === void 0) {
      const newId = ++this.lastRequestId;
      this.requestIds.set(request, newId);
      this.requests.set(newId, request);
      return newId;
    }
    return requestId;
  }
  requestById(id) {
    return this.requests.get(id);
  }
  onAddTraceProvider(message, port) {
    if (message.command !== PrivateAPI.Commands.AddTraceProvider) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.AddTraceProvider}`);
    }
    const provider = new ExtensionTraceProvider(this.getExtensionOrigin(port), message.id, message.categoryName, message.categoryTooltip);
    this.clientObjects.set(message.id, provider);
    this.traceProvidersInternal.push(provider);
    this.dispatchEventToListeners(Events.TraceProviderAdded, provider);
    return void 0;
  }
  traceProviders() {
    return this.traceProvidersInternal;
  }
  onForwardKeyboardEvent(message) {
    if (message.command !== PrivateAPI.Commands.ForwardKeyboardEvent) {
      return this.status.E_BADARG("command", `expected ${PrivateAPI.Commands.ForwardKeyboardEvent}`);
    }
    message.entries.forEach(handleEventEntry);
    function handleEventEntry(entry) {
      const event = new window.KeyboardEvent(entry.eventType, {
        key: entry.key,
        code: entry.code,
        keyCode: entry.keyCode,
        location: entry.location,
        ctrlKey: entry.ctrlKey,
        altKey: entry.altKey,
        shiftKey: entry.shiftKey,
        metaKey: entry.metaKey
      });
      event.__keyCode = keyCodeForEntry(entry);
      document.dispatchEvent(event);
    }
    function keyCodeForEntry(entry) {
      let keyCode = entry.keyCode;
      if (!keyCode) {
        if (entry.key === Platform.KeyboardUtilities.ESCAPE_KEY) {
          keyCode = 27;
        }
      }
      return keyCode || 0;
    }
    return void 0;
  }
  dispatchCallback(requestId, port, result) {
    if (requestId) {
      port.postMessage({ command: "callback", requestId, result });
    }
  }
  initExtensions() {
    this.registerAutosubscriptionHandler(PrivateAPI.Events.ResourceAdded, Workspace.Workspace.WorkspaceImpl.instance(), Workspace.Workspace.Events.UISourceCodeAdded, this.notifyResourceAdded);
    this.registerAutosubscriptionTargetManagerHandler(PrivateAPI.Events.NetworkRequestFinished, SDK.NetworkManager.NetworkManager, SDK.NetworkManager.Events.RequestFinished, this.notifyRequestFinished);
    function onElementsSubscriptionStarted() {
      UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, this.notifyElementsSelectionChanged, this);
    }
    function onElementsSubscriptionStopped() {
      UI.Context.Context.instance().removeFlavorChangeListener(SDK.DOMModel.DOMNode, this.notifyElementsSelectionChanged, this);
    }
    this.registerSubscriptionHandler(PrivateAPI.Events.PanelObjectSelected + "elements", onElementsSubscriptionStarted.bind(this), onElementsSubscriptionStopped.bind(this));
    this.registerResourceContentCommittedHandler(this.notifyUISourceCodeContentCommitted);
    SDK.TargetManager.TargetManager.instance().addEventListener(SDK.TargetManager.Events.InspectedURLChanged, this.inspectedURLChanged, this);
  }
  notifyResourceAdded(event) {
    const uiSourceCode = event.data;
    this.postNotification(PrivateAPI.Events.ResourceAdded, this.makeResource(uiSourceCode));
  }
  notifyUISourceCodeContentCommitted(event) {
    const { uiSourceCode, content } = event.data;
    this.postNotification(PrivateAPI.Events.ResourceContentCommitted, this.makeResource(uiSourceCode), content);
  }
  async notifyRequestFinished(event) {
    const request = event.data;
    const entry = await HAR.Log.Entry.build(request);
    this.postNotification(PrivateAPI.Events.NetworkRequestFinished, this.requestId(request), entry);
  }
  notifyElementsSelectionChanged() {
    this.postNotification(PrivateAPI.Events.PanelObjectSelected + "elements");
  }
  sourceSelectionChanged(url, range) {
    this.postNotification(PrivateAPI.Events.PanelObjectSelected + "sources", {
      startLine: range.startLine,
      startColumn: range.startColumn,
      endLine: range.endLine,
      endColumn: range.endColumn,
      url
    });
  }
  setInspectedTabId(event) {
    const oldId = this.inspectedTabId;
    this.inspectedTabId = event.data;
    if (oldId === null) {
      this.initializeExtensions();
    }
  }
  addExtensionForTest(extensionInfo, origin) {
    const name = extensionInfo.name || `Extension ${origin}`;
    this.registeredExtensions.set(origin, { name });
    return true;
  }
  addExtension(extensionInfo) {
    const startPage = extensionInfo.startPage;
    const inspectedURL = SDK.TargetManager.TargetManager.instance().mainTarget()?.inspectedURL() ?? "";
    if (inspectedURL !== "" && !this.canInspectURL(inspectedURL)) {
      this.disableExtensions();
    }
    if (!this.extensionsEnabled) {
      return;
    }
    try {
      const startPageURL = new URL(startPage);
      const extensionOrigin = startPageURL.origin;
      if (!this.registeredExtensions.get(extensionOrigin)) {
        const injectedAPI = self.buildExtensionAPIInjectedScript(extensionInfo, this.inspectedTabId, ThemeSupport.ThemeSupport.instance().themeName(), UI.ShortcutRegistry.ShortcutRegistry.instance().globalShortcutKeys(), ExtensionServer.instance().extensionAPITestHook);
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.setInjectedScriptForOrigin(extensionOrigin, injectedAPI);
        const name = extensionInfo.name || `Extension ${extensionOrigin}`;
        this.registeredExtensions.set(extensionOrigin, { name });
      }
      const iframe = document.createElement("iframe");
      iframe.src = startPage;
      iframe.dataset.devtoolsExtension = extensionInfo.name;
      iframe.style.display = "none";
      document.body.appendChild(iframe);
    } catch (e) {
      console.error("Failed to initialize extension " + startPage + ":" + e);
      return false;
    }
    return true;
  }
  registerExtension(origin, port) {
    if (!this.registeredExtensions.has(origin)) {
      if (origin !== window.location.origin) {
        console.error("Ignoring unauthorized client request from " + origin);
      }
      return;
    }
    extensionOrigins.set(port, origin);
    port.addEventListener("message", this.onmessage.bind(this), false);
    port.start();
  }
  onWindowMessage(event) {
    if (event.data === "registerExtension") {
      this.registerExtension(event.origin, event.ports[0]);
    }
  }
  async onmessage(event) {
    const message = event.data;
    let result;
    const handler = this.handlers.get(message.command);
    if (!handler) {
      result = this.status.E_NOTSUPPORTED(message.command);
    } else if (!this.extensionsEnabled) {
      result = this.status.E_FAILED("Permission denied");
    } else {
      result = await handler(message, event.target);
    }
    if (result && message.requestId) {
      this.dispatchCallback(message.requestId, event.target, result);
    }
  }
  registerHandler(command, callback) {
    console.assert(Boolean(command));
    this.handlers.set(command, callback);
  }
  registerSubscriptionHandler(eventTopic, onSubscribeFirst, onUnsubscribeLast) {
    this.subscriptionStartHandlers.set(eventTopic, onSubscribeFirst);
    this.subscriptionStopHandlers.set(eventTopic, onUnsubscribeLast);
  }
  registerAutosubscriptionHandler(eventTopic, eventTarget, frontendEventType, handler) {
    this.registerSubscriptionHandler(eventTopic, () => eventTarget.addEventListener(frontendEventType, handler, this), () => eventTarget.removeEventListener(frontendEventType, handler, this));
  }
  registerAutosubscriptionTargetManagerHandler(eventTopic, modelClass, frontendEventType, handler) {
    this.registerSubscriptionHandler(eventTopic, () => SDK.TargetManager.TargetManager.instance().addModelListener(modelClass, frontendEventType, handler, this), () => SDK.TargetManager.TargetManager.instance().removeModelListener(modelClass, frontendEventType, handler, this));
  }
  registerResourceContentCommittedHandler(handler) {
    function addFirstEventListener() {
      Workspace.Workspace.WorkspaceImpl.instance().addEventListener(Workspace.Workspace.Events.WorkingCopyCommittedByUser, handler, this);
      Workspace.Workspace.WorkspaceImpl.instance().setHasResourceContentTrackingExtensions(true);
    }
    function removeLastEventListener() {
      Workspace.Workspace.WorkspaceImpl.instance().setHasResourceContentTrackingExtensions(false);
      Workspace.Workspace.WorkspaceImpl.instance().removeEventListener(Workspace.Workspace.Events.WorkingCopyCommittedByUser, handler, this);
    }
    this.registerSubscriptionHandler(PrivateAPI.Events.ResourceContentCommitted, addFirstEventListener.bind(this), removeLastEventListener.bind(this));
  }
  expandResourcePath(extensionPath, resourcePath) {
    return extensionPath + "/" + Common.ParsedURL.normalizePath(resourcePath);
  }
  evaluate(expression, exposeCommandLineAPI, returnByValue, options, securityOrigin, callback) {
    let context;
    function resolveURLToFrame(url) {
      let found = null;
      function hasMatchingURL(frame2) {
        found = frame2.url === url ? frame2 : null;
        return found;
      }
      SDK.ResourceTreeModel.ResourceTreeModel.frames().some(hasMatchingURL);
      return found;
    }
    options = options || {};
    let frame;
    if (options.frameURL) {
      frame = resolveURLToFrame(options.frameURL);
    } else {
      const target = SDK.TargetManager.TargetManager.instance().mainTarget();
      const resourceTreeModel = target && target.model(SDK.ResourceTreeModel.ResourceTreeModel);
      frame = resourceTreeModel && resourceTreeModel.mainFrame;
    }
    if (!frame) {
      if (options.frameURL) {
        console.warn("evaluate: there is no frame with URL " + options.frameURL);
      } else {
        console.warn("evaluate: the main frame is not yet available");
      }
      return this.status.E_NOTFOUND(options.frameURL || "<top>");
    }
    if (!this.canInspectURL(frame.url)) {
      return this.status.E_FAILED("Permission denied");
    }
    let contextSecurityOrigin;
    if (options.useContentScriptContext) {
      contextSecurityOrigin = securityOrigin;
    } else if (options.scriptExecutionContext) {
      contextSecurityOrigin = options.scriptExecutionContext;
    }
    const runtimeModel = frame.resourceTreeModel().target().model(SDK.RuntimeModel.RuntimeModel);
    const executionContexts = runtimeModel ? runtimeModel.executionContexts() : [];
    if (contextSecurityOrigin) {
      for (let i = 0; i < executionContexts.length; ++i) {
        const executionContext = executionContexts[i];
        if (executionContext.frameId === frame.id && executionContext.origin === contextSecurityOrigin && !executionContext.isDefault) {
          context = executionContext;
        }
      }
      if (!context) {
        console.warn("The JavaScript context " + contextSecurityOrigin + " was not found in the frame " + frame.url);
        return this.status.E_NOTFOUND(contextSecurityOrigin);
      }
    } else {
      for (let i = 0; i < executionContexts.length; ++i) {
        const executionContext = executionContexts[i];
        if (executionContext.frameId === frame.id && executionContext.isDefault) {
          context = executionContext;
        }
      }
      if (!context) {
        return this.status.E_FAILED(frame.url + " has no execution context");
      }
    }
    if (!this.canInspectURL(context.origin)) {
      return this.status.E_FAILED("Permission denied");
    }
    void context.evaluate({
      expression,
      objectGroup: "extension",
      includeCommandLineAPI: exposeCommandLineAPI,
      silent: true,
      returnByValue,
      generatePreview: false
    }, false, false).then(onEvaluate);
    function onEvaluate(result) {
      if ("error" in result) {
        callback(result.error, null, false);
        return;
      }
      callback(null, result.object || null, Boolean(result.exceptionDetails));
    }
    return void 0;
  }
  canInspectURL(url) {
    let parsedURL;
    try {
      parsedURL = new URL(url);
    } catch (exception) {
      return false;
    }
    if (kAllowedOrigins.includes(parsedURL.origin)) {
      return true;
    }
    if (parsedURL.protocol === "chrome:" || parsedURL.protocol === "devtools:") {
      return false;
    }
    if (parsedURL.protocol.startsWith("http") && parsedURL.hostname === "chrome.google.com" && parsedURL.pathname.startsWith("/webstore")) {
      return false;
    }
    if ((window.DevToolsAPI && window.DevToolsAPI.getOriginsForbiddenForExtensions && window.DevToolsAPI.getOriginsForbiddenForExtensions() || []).includes(parsedURL.origin)) {
      return false;
    }
    return true;
  }
  disableExtensions() {
    this.extensionsEnabled = false;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["SidebarPaneAdded"] = "SidebarPaneAdded";
  Events2["TraceProviderAdded"] = "TraceProviderAdded";
  return Events2;
})(Events || {});
class ExtensionServerPanelView extends UI.View.SimpleView {
  name;
  panel;
  constructor(name, title, panel) {
    super(title);
    this.name = name;
    this.panel = panel;
  }
  viewId() {
    return this.name;
  }
  widget() {
    return Promise.resolve(this.panel);
  }
}
export class ExtensionStatus {
  OK;
  E_EXISTS;
  E_BADARG;
  E_BADARGTYPE;
  E_NOTFOUND;
  E_NOTSUPPORTED;
  E_PROTOCOLERROR;
  E_FAILED;
  constructor() {
    function makeStatus(code, description, ...details) {
      const status = { code, description, details };
      if (code !== "OK") {
        status.isError = true;
        console.error("Extension server error: " + Platform.StringUtilities.sprintf(description, ...details));
      }
      return status;
    }
    this.OK = makeStatus.bind(null, "OK", "OK");
    this.E_EXISTS = makeStatus.bind(null, "E_EXISTS", "Object already exists: %s");
    this.E_BADARG = makeStatus.bind(null, "E_BADARG", "Invalid argument %s: %s");
    this.E_BADARGTYPE = makeStatus.bind(null, "E_BADARGTYPE", "Invalid type for argument %s: got %s, expected %s");
    this.E_NOTFOUND = makeStatus.bind(null, "E_NOTFOUND", "Object not found: %s");
    this.E_NOTSUPPORTED = makeStatus.bind(null, "E_NOTSUPPORTED", "Object does not support requested operation: %s");
    this.E_PROTOCOLERROR = makeStatus.bind(null, "E_PROTOCOLERROR", "Inspector protocol error: %s");
    this.E_FAILED = makeStatus.bind(null, "E_FAILED", "Operation failed: %s");
  }
}
//# sourceMappingURL=ExtensionServer.js.map
