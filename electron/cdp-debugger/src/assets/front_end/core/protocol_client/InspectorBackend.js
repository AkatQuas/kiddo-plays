import { NodeURL } from "./NodeURL.js";
export const DevToolsStubErrorCode = -32015;
const GenericError = -32e3;
const ConnectionClosedErrorCode = -32001;
export const splitQualifiedName = (string) => {
  const [domain, eventName] = string.split(".");
  return [domain, eventName];
};
export const qualifyName = (domain, name) => {
  return `${domain}.${name}`;
};
export class InspectorBackend {
  agentPrototypes = /* @__PURE__ */ new Map();
  #initialized = false;
  #eventParameterNamesForDomain = /* @__PURE__ */ new Map();
  getOrCreateEventParameterNamesForDomain(domain) {
    let map = this.#eventParameterNamesForDomain.get(domain);
    if (!map) {
      map = /* @__PURE__ */ new Map();
      this.#eventParameterNamesForDomain.set(domain, map);
    }
    return map;
  }
  getOrCreateEventParameterNamesForDomainForTesting(domain) {
    return this.getOrCreateEventParameterNamesForDomain(domain);
  }
  getEventParamterNames() {
    return this.#eventParameterNamesForDomain;
  }
  static reportProtocolError(error, messageObject) {
    console.error(error + ": " + JSON.stringify(messageObject));
  }
  static reportProtocolWarning(error, messageObject) {
    console.warn(error + ": " + JSON.stringify(messageObject));
  }
  isInitialized() {
    return this.#initialized;
  }
  agentPrototype(domain) {
    let prototype = this.agentPrototypes.get(domain);
    if (!prototype) {
      prototype = new _AgentPrototype(domain);
      this.agentPrototypes.set(domain, prototype);
    }
    return prototype;
  }
  registerCommand(method, parameters, replyArgs) {
    const [domain, command] = splitQualifiedName(method);
    this.agentPrototype(domain).registerCommand(command, parameters, replyArgs);
    this.#initialized = true;
  }
  registerEnum(type, values) {
    const [domain, name] = splitQualifiedName(type);
    if (!globalThis.Protocol[domain]) {
      globalThis.Protocol[domain] = {};
    }
    globalThis.Protocol[domain][name] = values;
    this.#initialized = true;
  }
  registerEvent(eventName, params) {
    const domain = eventName.split(".")[0];
    const eventParameterNames = this.getOrCreateEventParameterNamesForDomain(domain);
    eventParameterNames.set(eventName, params);
    this.#initialized = true;
  }
}
let connectionFactory;
export class Connection {
  onMessage;
  constructor() {
  }
  setOnMessage(_onMessage) {
  }
  setOnDisconnect(_onDisconnect) {
  }
  sendRawMessage(_message) {
  }
  disconnect() {
    throw new Error("not implemented");
  }
  static setFactory(factory) {
    connectionFactory = factory;
  }
  static getFactory() {
    return connectionFactory;
  }
}
export const test = {
  dumpProtocol: null,
  deprecatedRunAfterPendingDispatches: null,
  sendRawMessage: null,
  suppressRequestErrors: false,
  onMessageSent: null,
  onMessageReceived: null
};
const LongPollingMethods = /* @__PURE__ */ new Set(["CSS.takeComputedStyleUpdates"]);
export class SessionRouter {
  #connectionInternal;
  #lastMessageId;
  #pendingResponsesCount;
  #pendingLongPollingMessageIds;
  #sessions;
  #pendingScripts;
  constructor(connection) {
    this.#connectionInternal = connection;
    this.#lastMessageId = 1;
    this.#pendingResponsesCount = 0;
    this.#pendingLongPollingMessageIds = /* @__PURE__ */ new Set();
    this.#sessions = /* @__PURE__ */ new Map();
    this.#pendingScripts = [];
    test.deprecatedRunAfterPendingDispatches = this.deprecatedRunAfterPendingDispatches.bind(this);
    test.sendRawMessage = this.sendRawMessageForTesting.bind(this);
    this.#connectionInternal.setOnMessage(this.onMessage.bind(this));
    this.#connectionInternal.setOnDisconnect((reason) => {
      const session = this.#sessions.get("");
      if (session) {
        session.target.dispose(reason);
      }
    });
  }
  registerSession(target, sessionId, proxyConnection) {
    if (proxyConnection) {
      for (const session of this.#sessions.values()) {
        if (session.proxyConnection) {
          console.error("Multiple simultaneous proxy connections are currently unsupported");
          break;
        }
      }
    }
    this.#sessions.set(sessionId, { target, callbacks: /* @__PURE__ */ new Map(), proxyConnection });
  }
  unregisterSession(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) {
      return;
    }
    for (const callback of session.callbacks.values()) {
      SessionRouter.dispatchUnregisterSessionError(callback);
    }
    this.#sessions.delete(sessionId);
  }
  getTargetBySessionId(sessionId) {
    const session = this.#sessions.get(sessionId ? sessionId : "");
    if (!session) {
      return null;
    }
    return session.target;
  }
  nextMessageId() {
    return this.#lastMessageId++;
  }
  connection() {
    return this.#connectionInternal;
  }
  sendMessage(sessionId, domain, method, params, callback) {
    const messageId = this.nextMessageId();
    const messageObject = {
      id: messageId,
      method
    };
    if (params) {
      messageObject.params = params;
    }
    if (sessionId) {
      messageObject.sessionId = sessionId;
    }
    if (test.dumpProtocol) {
      test.dumpProtocol("frontend: " + JSON.stringify(messageObject));
    }
    if (test.onMessageSent) {
      const paramsObject = JSON.parse(JSON.stringify(params || {}));
      test.onMessageSent({ domain, method, params: paramsObject, id: messageId, sessionId }, this.getTargetBySessionId(sessionId));
    }
    ++this.#pendingResponsesCount;
    if (LongPollingMethods.has(method)) {
      this.#pendingLongPollingMessageIds.add(messageId);
    }
    const session = this.#sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.callbacks.set(messageId, { callback, method });
    this.#connectionInternal.sendRawMessage(JSON.stringify(messageObject));
  }
  sendRawMessageForTesting(method, params, callback) {
    const domain = method.split(".")[0];
    this.sendMessage("", domain, method, params, callback || (() => {
    }));
  }
  onMessage(message) {
    if (test.dumpProtocol) {
      test.dumpProtocol("backend: " + (typeof message === "string" ? message : JSON.stringify(message)));
    }
    if (test.onMessageReceived) {
      const messageObjectCopy = JSON.parse(typeof message === "string" ? message : JSON.stringify(message));
      test.onMessageReceived(messageObjectCopy, this.getTargetBySessionId(messageObjectCopy.sessionId));
    }
    const messageObject = typeof message === "string" ? JSON.parse(message) : message;
    let suppressUnknownMessageErrors = false;
    for (const session2 of this.#sessions.values()) {
      if (!session2.proxyConnection) {
        continue;
      }
      if (!session2.proxyConnection.onMessage) {
        InspectorBackend.reportProtocolError("Protocol Error: the session has a proxyConnection with no _onMessage", messageObject);
        continue;
      }
      session2.proxyConnection.onMessage(messageObject);
      suppressUnknownMessageErrors = true;
    }
    const sessionId = messageObject.sessionId || "";
    const session = this.#sessions.get(sessionId);
    if (!session) {
      if (!suppressUnknownMessageErrors) {
        InspectorBackend.reportProtocolError("Protocol Error: the message with wrong session id", messageObject);
      }
      return;
    }
    if (session.proxyConnection) {
      return;
    }
    if (session.target.getNeedsNodeJSPatching()) {
      NodeURL.patch(messageObject);
    }
    if (messageObject.id !== void 0) {
      const callback = session.callbacks.get(messageObject.id);
      session.callbacks.delete(messageObject.id);
      if (!callback) {
        if (messageObject.error?.code === ConnectionClosedErrorCode) {
          return;
        }
        if (!suppressUnknownMessageErrors) {
          InspectorBackend.reportProtocolError("Protocol Error: the message with wrong id", messageObject);
        }
        return;
      }
      callback.callback(messageObject.error || null, messageObject.result || null);
      --this.#pendingResponsesCount;
      this.#pendingLongPollingMessageIds.delete(messageObject.id);
      if (this.#pendingScripts.length && !this.hasOutstandingNonLongPollingRequests()) {
        this.deprecatedRunAfterPendingDispatches();
      }
    } else {
      if (messageObject.method === void 0) {
        InspectorBackend.reportProtocolError("Protocol Error: the message without method", messageObject);
        return;
      }
      const eventMessage = messageObject;
      session.target.dispatch(eventMessage);
    }
  }
  hasOutstandingNonLongPollingRequests() {
    return this.#pendingResponsesCount - this.#pendingLongPollingMessageIds.size > 0;
  }
  deprecatedRunAfterPendingDispatches(script) {
    if (script) {
      this.#pendingScripts.push(script);
    }
    window.setTimeout(() => {
      if (!this.hasOutstandingNonLongPollingRequests()) {
        this.executeAfterPendingDispatches();
      } else {
        this.deprecatedRunAfterPendingDispatches();
      }
    }, 0);
  }
  executeAfterPendingDispatches() {
    if (!this.hasOutstandingNonLongPollingRequests()) {
      const scripts = this.#pendingScripts;
      this.#pendingScripts = [];
      for (let id = 0; id < scripts.length; ++id) {
        scripts[id]();
      }
    }
  }
  static dispatchConnectionError(callback, method) {
    const error = {
      message: `Connection is closed, can't dispatch pending call to ${method}`,
      code: ConnectionClosedErrorCode,
      data: null
    };
    window.setTimeout(() => callback(error, null), 0);
  }
  static dispatchUnregisterSessionError({ callback, method }) {
    const error = {
      message: `Session is unregistering, can't dispatch pending call to ${method}`,
      code: ConnectionClosedErrorCode,
      data: null
    };
    window.setTimeout(() => callback(error, null), 0);
  }
}
export class TargetBase {
  needsNodeJSPatching;
  sessionId;
  routerInternal;
  #agents = /* @__PURE__ */ new Map();
  #dispatchers = /* @__PURE__ */ new Map();
  constructor(needsNodeJSPatching, parentTarget, sessionId, connection) {
    this.needsNodeJSPatching = needsNodeJSPatching;
    this.sessionId = sessionId;
    if (!parentTarget && connection || !parentTarget && sessionId || connection && sessionId) {
      throw new Error("Either connection or sessionId (but not both) must be supplied for a child target");
    }
    let router;
    if (sessionId && parentTarget && parentTarget.routerInternal) {
      router = parentTarget.routerInternal;
    } else if (connection) {
      router = new SessionRouter(connection);
    } else {
      router = new SessionRouter(connectionFactory());
    }
    this.routerInternal = router;
    router.registerSession(this, this.sessionId);
    for (const [domain, agentPrototype] of inspectorBackend.agentPrototypes) {
      const agent = Object.create(agentPrototype);
      agent.target = this;
      this.#agents.set(domain, agent);
    }
    for (const [domain, eventParameterNames] of inspectorBackend.getEventParamterNames().entries()) {
      this.#dispatchers.set(domain, new DispatcherManager(eventParameterNames));
    }
  }
  dispatch(eventMessage) {
    const [domainName, method] = splitQualifiedName(eventMessage.method);
    const dispatcher = this.#dispatchers.get(domainName);
    if (!dispatcher) {
      InspectorBackend.reportProtocolError(`Protocol Error: the message ${eventMessage.method} is for non-existing domain '${domainName}'`, eventMessage);
      return;
    }
    dispatcher.dispatch(method, eventMessage);
  }
  dispose(_reason) {
    if (!this.routerInternal) {
      return;
    }
    this.routerInternal.unregisterSession(this.sessionId);
    this.routerInternal = null;
  }
  isDisposed() {
    return !this.routerInternal;
  }
  markAsNodeJSForTest() {
    this.needsNodeJSPatching = true;
  }
  router() {
    return this.routerInternal;
  }
  getAgent(domain) {
    const agent = this.#agents.get(domain);
    if (!agent) {
      throw new Error("Accessing undefined agent");
    }
    return agent;
  }
  accessibilityAgent() {
    return this.getAgent("Accessibility");
  }
  animationAgent() {
    return this.getAgent("Animation");
  }
  auditsAgent() {
    return this.getAgent("Audits");
  }
  browserAgent() {
    return this.getAgent("Browser");
  }
  backgroundServiceAgent() {
    return this.getAgent("BackgroundService");
  }
  cacheStorageAgent() {
    return this.getAgent("CacheStorage");
  }
  cssAgent() {
    return this.getAgent("CSS");
  }
  databaseAgent() {
    return this.getAgent("Database");
  }
  debuggerAgent() {
    return this.getAgent("Debugger");
  }
  deviceOrientationAgent() {
    return this.getAgent("DeviceOrientation");
  }
  domAgent() {
    return this.getAgent("DOM");
  }
  domdebuggerAgent() {
    return this.getAgent("DOMDebugger");
  }
  domsnapshotAgent() {
    return this.getAgent("DOMSnapshot");
  }
  domstorageAgent() {
    return this.getAgent("DOMStorage");
  }
  emulationAgent() {
    return this.getAgent("Emulation");
  }
  eventBreakpointsAgent() {
    return this.getAgent("EventBreakpoints");
  }
  fetchAgent() {
    return this.getAgent("Fetch");
  }
  heapProfilerAgent() {
    return this.getAgent("HeapProfiler");
  }
  indexedDBAgent() {
    return this.getAgent("IndexedDB");
  }
  inputAgent() {
    return this.getAgent("Input");
  }
  ioAgent() {
    return this.getAgent("IO");
  }
  inspectorAgent() {
    return this.getAgent("Inspector");
  }
  layerTreeAgent() {
    return this.getAgent("LayerTree");
  }
  logAgent() {
    return this.getAgent("Log");
  }
  mediaAgent() {
    return this.getAgent("Media");
  }
  memoryAgent() {
    return this.getAgent("Memory");
  }
  networkAgent() {
    return this.getAgent("Network");
  }
  overlayAgent() {
    return this.getAgent("Overlay");
  }
  pageAgent() {
    return this.getAgent("Page");
  }
  profilerAgent() {
    return this.getAgent("Profiler");
  }
  performanceAgent() {
    return this.getAgent("Performance");
  }
  runtimeAgent() {
    return this.getAgent("Runtime");
  }
  securityAgent() {
    return this.getAgent("Security");
  }
  serviceWorkerAgent() {
    return this.getAgent("ServiceWorker");
  }
  storageAgent() {
    return this.getAgent("Storage");
  }
  targetAgent() {
    return this.getAgent("Target");
  }
  tracingAgent() {
    return this.getAgent("Tracing");
  }
  webAudioAgent() {
    return this.getAgent("WebAudio");
  }
  webAuthnAgent() {
    return this.getAgent("WebAuthn");
  }
  registerDispatcher(domain, dispatcher) {
    const manager = this.#dispatchers.get(domain);
    if (!manager) {
      return;
    }
    manager.addDomainDispatcher(dispatcher);
  }
  unregisterDispatcher(domain, dispatcher) {
    const manager = this.#dispatchers.get(domain);
    if (!manager) {
      return;
    }
    manager.removeDomainDispatcher(dispatcher);
  }
  registerAccessibilityDispatcher(dispatcher) {
    this.registerDispatcher("Accessibility", dispatcher);
  }
  registerAnimationDispatcher(dispatcher) {
    this.registerDispatcher("Animation", dispatcher);
  }
  registerAuditsDispatcher(dispatcher) {
    this.registerDispatcher("Audits", dispatcher);
  }
  registerCSSDispatcher(dispatcher) {
    this.registerDispatcher("CSS", dispatcher);
  }
  registerDatabaseDispatcher(dispatcher) {
    this.registerDispatcher("Database", dispatcher);
  }
  registerBackgroundServiceDispatcher(dispatcher) {
    this.registerDispatcher("BackgroundService", dispatcher);
  }
  registerDebuggerDispatcher(dispatcher) {
    this.registerDispatcher("Debugger", dispatcher);
  }
  unregisterDebuggerDispatcher(dispatcher) {
    this.unregisterDispatcher("Debugger", dispatcher);
  }
  registerDOMDispatcher(dispatcher) {
    this.registerDispatcher("DOM", dispatcher);
  }
  registerDOMStorageDispatcher(dispatcher) {
    this.registerDispatcher("DOMStorage", dispatcher);
  }
  registerFetchDispatcher(dispatcher) {
    this.registerDispatcher("Fetch", dispatcher);
  }
  registerHeapProfilerDispatcher(dispatcher) {
    this.registerDispatcher("HeapProfiler", dispatcher);
  }
  registerInspectorDispatcher(dispatcher) {
    this.registerDispatcher("Inspector", dispatcher);
  }
  registerLayerTreeDispatcher(dispatcher) {
    this.registerDispatcher("LayerTree", dispatcher);
  }
  registerLogDispatcher(dispatcher) {
    this.registerDispatcher("Log", dispatcher);
  }
  registerMediaDispatcher(dispatcher) {
    this.registerDispatcher("Media", dispatcher);
  }
  registerNetworkDispatcher(dispatcher) {
    this.registerDispatcher("Network", dispatcher);
  }
  registerOverlayDispatcher(dispatcher) {
    this.registerDispatcher("Overlay", dispatcher);
  }
  registerPageDispatcher(dispatcher) {
    this.registerDispatcher("Page", dispatcher);
  }
  registerProfilerDispatcher(dispatcher) {
    this.registerDispatcher("Profiler", dispatcher);
  }
  registerRuntimeDispatcher(dispatcher) {
    this.registerDispatcher("Runtime", dispatcher);
  }
  registerSecurityDispatcher(dispatcher) {
    this.registerDispatcher("Security", dispatcher);
  }
  registerServiceWorkerDispatcher(dispatcher) {
    this.registerDispatcher("ServiceWorker", dispatcher);
  }
  registerStorageDispatcher(dispatcher) {
    this.registerDispatcher("Storage", dispatcher);
  }
  registerTargetDispatcher(dispatcher) {
    this.registerDispatcher("Target", dispatcher);
  }
  registerTracingDispatcher(dispatcher) {
    this.registerDispatcher("Tracing", dispatcher);
  }
  registerWebAudioDispatcher(dispatcher) {
    this.registerDispatcher("WebAudio", dispatcher);
  }
  getNeedsNodeJSPatching() {
    return this.needsNodeJSPatching;
  }
}
class _AgentPrototype {
  replyArgs;
  domain;
  target;
  constructor(domain) {
    this.replyArgs = {};
    this.domain = domain;
  }
  registerCommand(methodName, parameters, replyArgs) {
    const domainAndMethod = qualifyName(this.domain, methodName);
    function sendMessagePromise(...args) {
      return _AgentPrototype.prototype.sendMessageToBackendPromise.call(this, domainAndMethod, parameters, args);
    }
    this[methodName] = sendMessagePromise;
    function invoke(request = {}) {
      return this.invoke(domainAndMethod, request);
    }
    this["invoke_" + methodName] = invoke;
    this.replyArgs[domainAndMethod] = replyArgs;
  }
  prepareParameters(method, parameters, args, errorCallback) {
    const params = {};
    let hasParams = false;
    for (const param of parameters) {
      const paramName = param.name;
      const typeName = param.type;
      const optionalFlag = param.optional;
      if (!args.length && !optionalFlag) {
        errorCallback(`Protocol Error: Invalid number of arguments for method '${method}' call. It must have the following arguments ${JSON.stringify(parameters)}'.`);
        return null;
      }
      const value = args.shift();
      if (optionalFlag && typeof value === "undefined") {
        continue;
      }
      if (typeof value !== typeName) {
        errorCallback(`Protocol Error: Invalid type of argument '${paramName}' for method '${method}' call. It must be '${typeName}' but it is '${typeof value}'.`);
        return null;
      }
      params[paramName] = value;
      hasParams = true;
    }
    if (args.length) {
      errorCallback(`Protocol Error: Extra ${args.length} arguments in a call to method '${method}'.`);
      return null;
    }
    return hasParams ? params : null;
  }
  sendMessageToBackendPromise(method, parameters, args) {
    let errorMessage;
    function onError(message) {
      console.error(message);
      errorMessage = message;
    }
    const params = this.prepareParameters(method, parameters, args, onError);
    if (errorMessage) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const callback = (error, result) => {
        if (error) {
          if (!test.suppressRequestErrors && error.code !== DevToolsStubErrorCode && error.code !== GenericError && error.code !== ConnectionClosedErrorCode) {
            console.error("Request " + method + " failed. " + JSON.stringify(error));
          }
          resolve(null);
          return;
        }
        const args2 = this.replyArgs[method];
        resolve(result && args2.length ? result[args2[0]] : void 0);
      };
      const router = this.target.router();
      if (!router) {
        SessionRouter.dispatchConnectionError(callback, method);
      } else {
        router.sendMessage(this.target.sessionId, this.domain, method, params, callback);
      }
    });
  }
  invoke(method, request) {
    return new Promise((fulfill) => {
      const callback = (error, result) => {
        if (error && !test.suppressRequestErrors && error.code !== DevToolsStubErrorCode && error.code !== GenericError && error.code !== ConnectionClosedErrorCode) {
          console.error("Request " + method + " failed. " + JSON.stringify(error));
        }
        const errorMessage = error?.message;
        fulfill({ ...result, getError: () => errorMessage });
      };
      const router = this.target.router();
      if (!router) {
        SessionRouter.dispatchConnectionError(callback, method);
      } else {
        router.sendMessage(this.target.sessionId, this.domain, method, request, callback);
      }
    });
  }
}
class DispatcherManager {
  #eventArgs;
  #dispatchers = [];
  constructor(eventArgs) {
    this.#eventArgs = eventArgs;
  }
  addDomainDispatcher(dispatcher) {
    this.#dispatchers.push(dispatcher);
  }
  removeDomainDispatcher(dispatcher) {
    const index = this.#dispatchers.indexOf(dispatcher);
    if (index === -1) {
      return;
    }
    this.#dispatchers.splice(index, 1);
  }
  dispatch(event, messageObject) {
    if (!this.#dispatchers.length) {
      return;
    }
    if (!this.#eventArgs.has(messageObject.method)) {
      InspectorBackend.reportProtocolWarning(`Protocol Warning: Attempted to dispatch an unspecified event '${messageObject.method}'`, messageObject);
      return;
    }
    const messageParams = { ...messageObject.params };
    for (let index = 0; index < this.#dispatchers.length; ++index) {
      const dispatcher = this.#dispatchers[index];
      if (event in dispatcher) {
        const f = dispatcher[event];
        f.call(dispatcher, messageParams);
      }
    }
  }
}
export const inspectorBackend = new InspectorBackend();
//# sourceMappingURL=InspectorBackend.js.map
