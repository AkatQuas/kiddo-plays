import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import { ParallelConnection } from "./Connections.js";
import { Capability, Type } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
import { Events as TargetManagerEvents, TargetManager } from "./TargetManager.js";
export class ChildTargetManager extends SDKModel {
  #targetManager;
  #parentTarget;
  #targetAgent;
  #targetInfosInternal = /* @__PURE__ */ new Map();
  #childTargetsBySessionId = /* @__PURE__ */ new Map();
  #childTargetsById = /* @__PURE__ */ new Map();
  #parallelConnections = /* @__PURE__ */ new Map();
  #parentTargetId = null;
  constructor(parentTarget) {
    super(parentTarget);
    this.#targetManager = parentTarget.targetManager();
    this.#parentTarget = parentTarget;
    this.#targetAgent = parentTarget.targetAgent();
    parentTarget.registerTargetDispatcher(this);
    const browserTarget = this.#targetManager.browserTarget();
    if (browserTarget) {
      if (browserTarget !== parentTarget) {
        void browserTarget.targetAgent().invoke_autoAttachRelated({ targetId: parentTarget.id(), waitForDebuggerOnStart: true });
      }
    } else {
      void this.#targetAgent.invoke_setAutoAttach({ autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    }
    if (!parentTarget.parentTarget() && !Host.InspectorFrontendHost.isUnderTest()) {
      void this.#targetAgent.invoke_setDiscoverTargets({ discover: true });
      void this.#targetAgent.invoke_setRemoteLocations({ locations: [{ host: "localhost", port: 9229 }] });
    }
  }
  static install(attachCallback) {
    ChildTargetManager.attachCallback = attachCallback;
    SDKModel.register(ChildTargetManager, { capabilities: Capability.Target, autostart: true });
  }
  childTargets() {
    return Array.from(this.#childTargetsBySessionId.values());
  }
  async suspendModel() {
    await this.#targetAgent.invoke_setAutoAttach({ autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  }
  async resumeModel() {
    await this.#targetAgent.invoke_setAutoAttach({ autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  }
  dispose() {
    for (const sessionId of this.#childTargetsBySessionId.keys()) {
      this.detachedFromTarget({ sessionId, targetId: void 0 });
    }
  }
  targetCreated({ targetInfo }) {
    this.#targetInfosInternal.set(targetInfo.targetId, targetInfo);
    this.fireAvailableTargetsChanged();
    this.dispatchEventToListeners(Events.TargetCreated, targetInfo);
  }
  targetInfoChanged({ targetInfo }) {
    this.#targetInfosInternal.set(targetInfo.targetId, targetInfo);
    const target = this.#childTargetsById.get(targetInfo.targetId);
    if (target) {
      target.updateTargetInfo(targetInfo);
    }
    this.fireAvailableTargetsChanged();
    this.dispatchEventToListeners(Events.TargetInfoChanged, targetInfo);
  }
  targetDestroyed({ targetId }) {
    this.#targetInfosInternal.delete(targetId);
    this.fireAvailableTargetsChanged();
    this.dispatchEventToListeners(Events.TargetDestroyed, targetId);
  }
  targetCrashed({ targetId, status, errorCode }) {
  }
  fireAvailableTargetsChanged() {
    TargetManager.instance().dispatchEventToListeners(TargetManagerEvents.AvailableTargetsChanged, [...this.#targetInfosInternal.values()]);
  }
  async getParentTargetId() {
    if (!this.#parentTargetId) {
      this.#parentTargetId = (await this.#parentTarget.targetAgent().invoke_getTargetInfo({})).targetInfo.targetId;
    }
    return this.#parentTargetId;
  }
  async attachedToTarget({ sessionId, targetInfo, waitingForDebugger }) {
    if (this.#parentTargetId === targetInfo.targetId) {
      return;
    }
    let targetName = "";
    if (targetInfo.type === "worker" && targetInfo.title && targetInfo.title !== targetInfo.url) {
      targetName = targetInfo.title;
    } else if (targetInfo.type !== "iframe" && targetInfo.type !== "webview") {
      const parsedURL = Common.ParsedURL.ParsedURL.fromString(targetInfo.url);
      targetName = parsedURL ? parsedURL.lastPathComponentWithFragment() : "#" + ++ChildTargetManager.lastAnonymousTargetId;
    }
    let type = Type.Browser;
    if (targetInfo.type === "iframe" || targetInfo.type === "webview") {
      type = Type.Frame;
    } else if (targetInfo.type === "page") {
      type = Type.Frame;
    } else if (targetInfo.type === "worker") {
      type = Type.Worker;
    } else if (targetInfo.type === "shared_worker") {
      type = Type.SharedWorker;
    } else if (targetInfo.type === "service_worker") {
      type = Type.ServiceWorker;
    } else if (targetInfo.type === "auction_worklet") {
      type = Type.AuctionWorklet;
    }
    const target = this.#targetManager.createTarget(targetInfo.targetId, targetName, type, this.#parentTarget, sessionId, void 0, void 0, targetInfo);
    this.#childTargetsBySessionId.set(sessionId, target);
    this.#childTargetsById.set(target.id(), target);
    if (ChildTargetManager.attachCallback) {
      await ChildTargetManager.attachCallback({ target, waitingForDebugger });
    }
    void target.runtimeAgent().invoke_runIfWaitingForDebugger();
  }
  detachedFromTarget({ sessionId }) {
    if (this.#parallelConnections.has(sessionId)) {
      this.#parallelConnections.delete(sessionId);
    } else {
      const target = this.#childTargetsBySessionId.get(sessionId);
      if (target) {
        target.dispose("target terminated");
        this.#childTargetsBySessionId.delete(sessionId);
        this.#childTargetsById.delete(target.id());
      }
    }
  }
  receivedMessageFromTarget({}) {
  }
  async createParallelConnection(onMessage) {
    const targetId = await this.getParentTargetId();
    const { connection, sessionId } = await this.createParallelConnectionAndSessionForTarget(this.#parentTarget, targetId);
    connection.setOnMessage(onMessage);
    this.#parallelConnections.set(sessionId, connection);
    return { connection, sessionId };
  }
  async createParallelConnectionAndSessionForTarget(target, targetId) {
    const targetAgent = target.targetAgent();
    const targetRouter = target.router();
    const sessionId = (await targetAgent.invoke_attachToTarget({ targetId, flatten: true })).sessionId;
    const connection = new ParallelConnection(targetRouter.connection(), sessionId);
    targetRouter.registerSession(target, sessionId, connection);
    connection.setOnDisconnect(() => {
      targetRouter.unregisterSession(sessionId);
      void targetAgent.invoke_detachFromTarget({ sessionId });
    });
    return { connection, sessionId };
  }
  targetInfos() {
    return Array.from(this.#targetInfosInternal.values());
  }
  static lastAnonymousTargetId = 0;
  static attachCallback;
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["TargetCreated"] = "TargetCreated";
  Events2["TargetDestroyed"] = "TargetDestroyed";
  Events2["TargetInfoChanged"] = "TargetInfoChanged";
  return Events2;
})(Events || {});
//# sourceMappingURL=ChildTargetManager.js.map
