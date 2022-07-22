import { Capability } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
export class SecurityOriginManager extends SDKModel {
  #mainSecurityOriginInternal;
  #unreachableMainSecurityOriginInternal;
  #securityOriginsInternal;
  constructor(target) {
    super(target);
    this.#mainSecurityOriginInternal = "";
    this.#unreachableMainSecurityOriginInternal = "";
    this.#securityOriginsInternal = /* @__PURE__ */ new Set();
  }
  updateSecurityOrigins(securityOrigins) {
    const oldOrigins = this.#securityOriginsInternal;
    this.#securityOriginsInternal = securityOrigins;
    for (const origin of oldOrigins) {
      if (!this.#securityOriginsInternal.has(origin)) {
        this.dispatchEventToListeners(Events.SecurityOriginRemoved, origin);
      }
    }
    for (const origin of this.#securityOriginsInternal) {
      if (!oldOrigins.has(origin)) {
        this.dispatchEventToListeners(Events.SecurityOriginAdded, origin);
      }
    }
  }
  securityOrigins() {
    return [...this.#securityOriginsInternal];
  }
  mainSecurityOrigin() {
    return this.#mainSecurityOriginInternal;
  }
  unreachableMainSecurityOrigin() {
    return this.#unreachableMainSecurityOriginInternal;
  }
  setMainSecurityOrigin(securityOrigin, unreachableSecurityOrigin) {
    this.#mainSecurityOriginInternal = securityOrigin;
    this.#unreachableMainSecurityOriginInternal = unreachableSecurityOrigin || null;
    this.dispatchEventToListeners(Events.MainSecurityOriginChanged, {
      mainSecurityOrigin: this.#mainSecurityOriginInternal,
      unreachableMainSecurityOrigin: this.#unreachableMainSecurityOriginInternal
    });
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["SecurityOriginAdded"] = "SecurityOriginAdded";
  Events2["SecurityOriginRemoved"] = "SecurityOriginRemoved";
  Events2["MainSecurityOriginChanged"] = "MainSecurityOriginChanged";
  return Events2;
})(Events || {});
SDKModel.register(SecurityOriginManager, { capabilities: Capability.None, autostart: false });
//# sourceMappingURL=SecurityOriginManager.js.map
