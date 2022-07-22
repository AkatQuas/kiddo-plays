import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as Platform from "../platform/platform.js";
import * as ProtocolClient from "../protocol_client/protocol_client.js";
import { SDKModel } from "./SDKModel.js";
export class Target extends ProtocolClient.InspectorBackend.TargetBase {
  #targetManagerInternal;
  #nameInternal;
  #inspectedURLInternal;
  #inspectedURLName;
  #capabilitiesMask;
  #typeInternal;
  #parentTargetInternal;
  #idInternal;
  #modelByConstructor;
  #isSuspended;
  #targetInfoInternal;
  #creatingModels;
  constructor(targetManager, id, name, type, parentTarget, sessionId, suspended, connection, targetInfo) {
    const needsNodeJSPatching = type === Type.Node;
    super(needsNodeJSPatching, parentTarget, sessionId, connection);
    this.#targetManagerInternal = targetManager;
    this.#nameInternal = name;
    this.#inspectedURLInternal = Platform.DevToolsPath.EmptyUrlString;
    this.#inspectedURLName = "";
    this.#capabilitiesMask = 0;
    switch (type) {
      case Type.Frame:
        this.#capabilitiesMask = Capability.Browser | Capability.Storage | Capability.DOM | Capability.JS | Capability.Log | Capability.Network | Capability.Target | Capability.Tracing | Capability.Emulation | Capability.Input | Capability.Inspector | Capability.Audits | Capability.WebAuthn | Capability.IO | Capability.Media;
        if (!parentTarget) {
          this.#capabilitiesMask |= Capability.DeviceEmulation | Capability.ScreenCapture | Capability.Security | Capability.ServiceWorker;
        }
        break;
      case Type.ServiceWorker:
        this.#capabilitiesMask = Capability.JS | Capability.Log | Capability.Network | Capability.Target | Capability.Inspector | Capability.IO;
        if (!parentTarget) {
          this.#capabilitiesMask |= Capability.Browser;
        }
        break;
      case Type.SharedWorker:
        this.#capabilitiesMask = Capability.JS | Capability.Log | Capability.Network | Capability.Target | Capability.IO | Capability.Media | Capability.Inspector;
        break;
      case Type.Worker:
        this.#capabilitiesMask = Capability.JS | Capability.Log | Capability.Network | Capability.Target | Capability.IO | Capability.Media | Capability.Emulation;
        break;
      case Type.Node:
        this.#capabilitiesMask = Capability.JS;
        break;
      case Type.AuctionWorklet:
        this.#capabilitiesMask = Capability.JS | Capability.EventBreakpoints;
        break;
      case Type.Browser:
        this.#capabilitiesMask = Capability.Target | Capability.IO;
        break;
    }
    this.#typeInternal = type;
    this.#parentTargetInternal = parentTarget;
    this.#idInternal = id;
    this.#modelByConstructor = /* @__PURE__ */ new Map();
    this.#isSuspended = suspended;
    this.#targetInfoInternal = targetInfo;
  }
  createModels(required) {
    this.#creatingModels = true;
    const registeredModels = Array.from(SDKModel.registeredModels.entries());
    for (const [modelClass, info] of registeredModels) {
      if (info.early) {
        this.model(modelClass);
      }
    }
    for (const [modelClass, info] of registeredModels) {
      if (info.autostart || required.has(modelClass)) {
        this.model(modelClass);
      }
    }
    this.#creatingModels = false;
  }
  id() {
    return this.#idInternal;
  }
  name() {
    return this.#nameInternal || this.#inspectedURLName;
  }
  type() {
    return this.#typeInternal;
  }
  markAsNodeJSForTest() {
    super.markAsNodeJSForTest();
    this.#typeInternal = Type.Node;
  }
  targetManager() {
    return this.#targetManagerInternal;
  }
  hasAllCapabilities(capabilitiesMask) {
    return (this.#capabilitiesMask & capabilitiesMask) === capabilitiesMask;
  }
  decorateLabel(label) {
    return this.#typeInternal === Type.Worker || this.#typeInternal === Type.ServiceWorker ? "\u2699 " + label : label;
  }
  parentTarget() {
    return this.#parentTargetInternal;
  }
  dispose(reason) {
    super.dispose(reason);
    this.#targetManagerInternal.removeTarget(this);
    for (const model of this.#modelByConstructor.values()) {
      model.dispose();
    }
  }
  model(modelClass) {
    if (!this.#modelByConstructor.get(modelClass)) {
      const info = SDKModel.registeredModels.get(modelClass);
      if (info === void 0) {
        throw "Model class is not registered @" + new Error().stack;
      }
      if ((this.#capabilitiesMask & info.capabilities) === info.capabilities) {
        const model = new modelClass(this);
        this.#modelByConstructor.set(modelClass, model);
        if (!this.#creatingModels) {
          this.#targetManagerInternal.modelAdded(this, modelClass, model);
        }
      }
    }
    return this.#modelByConstructor.get(modelClass) || null;
  }
  models() {
    return this.#modelByConstructor;
  }
  inspectedURL() {
    return this.#inspectedURLInternal;
  }
  setInspectedURL(inspectedURL) {
    this.#inspectedURLInternal = inspectedURL;
    const parsedURL = Common.ParsedURL.ParsedURL.fromString(inspectedURL);
    this.#inspectedURLName = parsedURL ? parsedURL.lastPathComponentWithFragment() : "#" + this.#idInternal;
    if (!this.parentTarget()) {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.inspectedURLChanged(inspectedURL || Platform.DevToolsPath.EmptyUrlString);
    }
    this.#targetManagerInternal.onInspectedURLChange(this);
    if (!this.#nameInternal) {
      this.#targetManagerInternal.onNameChange(this);
    }
  }
  async suspend(reason) {
    if (this.#isSuspended) {
      return;
    }
    this.#isSuspended = true;
    await Promise.all(Array.from(this.models().values(), (m) => m.preSuspendModel(reason)));
    await Promise.all(Array.from(this.models().values(), (m) => m.suspendModel(reason)));
  }
  async resume() {
    if (!this.#isSuspended) {
      return;
    }
    this.#isSuspended = false;
    await Promise.all(Array.from(this.models().values(), (m) => m.resumeModel()));
    await Promise.all(Array.from(this.models().values(), (m) => m.postResumeModel()));
  }
  suspended() {
    return this.#isSuspended;
  }
  updateTargetInfo(targetInfo) {
    this.#targetInfoInternal = targetInfo;
  }
  targetInfo() {
    return this.#targetInfoInternal;
  }
}
export var Type = /* @__PURE__ */ ((Type2) => {
  Type2["Frame"] = "frame";
  Type2["ServiceWorker"] = "service-worker";
  Type2["Worker"] = "worker";
  Type2["SharedWorker"] = "shared-worker";
  Type2["Node"] = "node";
  Type2["Browser"] = "browser";
  Type2["AuctionWorklet"] = "auction-worklet";
  return Type2;
})(Type || {});
export var Capability = /* @__PURE__ */ ((Capability2) => {
  Capability2[Capability2["Browser"] = 1] = "Browser";
  Capability2[Capability2["DOM"] = 2] = "DOM";
  Capability2[Capability2["JS"] = 4] = "JS";
  Capability2[Capability2["Log"] = 8] = "Log";
  Capability2[Capability2["Network"] = 16] = "Network";
  Capability2[Capability2["Target"] = 32] = "Target";
  Capability2[Capability2["ScreenCapture"] = 64] = "ScreenCapture";
  Capability2[Capability2["Tracing"] = 128] = "Tracing";
  Capability2[Capability2["Emulation"] = 256] = "Emulation";
  Capability2[Capability2["Security"] = 512] = "Security";
  Capability2[Capability2["Input"] = 1024] = "Input";
  Capability2[Capability2["Inspector"] = 2048] = "Inspector";
  Capability2[Capability2["DeviceEmulation"] = 4096] = "DeviceEmulation";
  Capability2[Capability2["Storage"] = 8192] = "Storage";
  Capability2[Capability2["ServiceWorker"] = 16384] = "ServiceWorker";
  Capability2[Capability2["Audits"] = 32768] = "Audits";
  Capability2[Capability2["WebAuthn"] = 65536] = "WebAuthn";
  Capability2[Capability2["IO"] = 131072] = "IO";
  Capability2[Capability2["Media"] = 262144] = "Media";
  Capability2[Capability2["EventBreakpoints"] = 524288] = "EventBreakpoints";
  Capability2[Capability2["None"] = 0] = "None";
  return Capability2;
})(Capability || {});
//# sourceMappingURL=Target.js.map
