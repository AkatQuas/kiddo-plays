import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
export class DOMStorage extends Common.ObjectWrapper.ObjectWrapper {
  model;
  securityOriginInternal;
  storageKeyInternal;
  isLocalStorageInternal;
  constructor(model, securityOrigin, storageKey, isLocalStorage) {
    super();
    this.model = model;
    this.securityOriginInternal = securityOrigin;
    this.storageKeyInternal = storageKey;
    this.isLocalStorageInternal = isLocalStorage;
  }
  static storageId(securityOrigin, isLocalStorage) {
    return { securityOrigin, isLocalStorage };
  }
  static storageIdWithSecurityOrigin(securityOrigin, isLocalStorage) {
    return { securityOrigin, isLocalStorage };
  }
  static storageIdWithStorageKey(storageKey, isLocalStorage) {
    return { storageKey, isLocalStorage };
  }
  get idWithSecurityOrigin() {
    let securityOrigin = "";
    if (this.securityOriginInternal) {
      securityOrigin = this.securityOriginInternal;
    }
    return DOMStorage.storageIdWithSecurityOrigin(securityOrigin, this.isLocalStorageInternal);
  }
  get idWithStorageKey() {
    let storageKey = "";
    if (this.storageKeyInternal) {
      storageKey = this.storageKeyInternal;
    }
    return DOMStorage.storageIdWithStorageKey(storageKey, this.isLocalStorageInternal);
  }
  get id() {
    if (this.securityOriginInternal) {
      return this.idWithSecurityOrigin;
    }
    return this.idWithStorageKey;
  }
  get securityOrigin() {
    return this.securityOriginInternal;
  }
  get storageKey() {
    return this.storageKeyInternal;
  }
  get isLocalStorage() {
    return this.isLocalStorageInternal;
  }
  getItems() {
    return this.model.agent.invoke_getDOMStorageItems({ storageId: this.id }).then(({ entries }) => entries);
  }
  setItem(key, value) {
    void this.model.agent.invoke_setDOMStorageItem({ storageId: this.id, key, value });
  }
  removeItem(key) {
    void this.model.agent.invoke_removeDOMStorageItem({ storageId: this.id, key });
  }
  clear() {
    void this.model.agent.invoke_clear({ storageId: this.id });
  }
}
((DOMStorage2) => {
  let Events2;
  ((Events3) => {
    Events3["DOMStorageItemsCleared"] = "DOMStorageItemsCleared";
    Events3["DOMStorageItemRemoved"] = "DOMStorageItemRemoved";
    Events3["DOMStorageItemAdded"] = "DOMStorageItemAdded";
    Events3["DOMStorageItemUpdated"] = "DOMStorageItemUpdated";
  })(Events2 = DOMStorage2.Events || (DOMStorage2.Events = {}));
})(DOMStorage || (DOMStorage = {}));
export class DOMStorageModel extends SDK.SDKModel.SDKModel {
  securityOriginManager;
  storageKeyManagerInternal;
  storagesInternal;
  agent;
  enabled;
  constructor(target) {
    super(target);
    this.securityOriginManager = target.model(SDK.SecurityOriginManager.SecurityOriginManager);
    this.storageKeyManagerInternal = target.model(SDK.StorageKeyManager.StorageKeyManager);
    this.storagesInternal = {};
    this.agent = target.domstorageAgent();
  }
  get storageKeyManagerForTest() {
    return this.storageKeyManagerInternal;
  }
  enable() {
    if (this.enabled) {
      return;
    }
    this.target().registerDOMStorageDispatcher(new DOMStorageDispatcher(this));
    if (this.securityOriginManager) {
      this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.SecurityOriginAdded, this.securityOriginAdded, this);
      this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.SecurityOriginRemoved, this.securityOriginRemoved, this);
      for (const securityOrigin of this.securityOriginManager.securityOrigins()) {
        this.addOrigin(securityOrigin);
      }
    }
    if (this.storageKeyManagerInternal) {
      this.storageKeyManagerInternal.addEventListener(SDK.StorageKeyManager.Events.StorageKeyAdded, this.storageKeyAdded, this);
      this.storageKeyManagerInternal.addEventListener(SDK.StorageKeyManager.Events.StorageKeyRemoved, this.storageKeyRemoved, this);
      for (const storageKey of this.storageKeyManagerInternal.storageKeys()) {
        this.addStorageKey(storageKey);
      }
    }
    void this.agent.invoke_enable();
    this.enabled = true;
  }
  clearForOrigin(origin) {
    if (!this.enabled) {
      return;
    }
    for (const isLocal of [true, false]) {
      const key = this.keyForSecurityOrigin(origin, isLocal);
      const storage = this.storagesInternal[key];
      if (!storage) {
        return;
      }
      storage.clear();
    }
    this.removeOrigin(origin);
    this.addOrigin(origin);
  }
  clearForStorageKey(storageKey) {
    if (!this.enabled) {
      return;
    }
    for (const isLocal of [true, false]) {
      const key = this.keyForStorageKey(storageKey, isLocal);
      const storage = this.storagesInternal[key];
      if (!storage) {
        return;
      }
      storage.clear();
    }
    this.removeStorageKey(storageKey);
    this.addStorageKey(storageKey);
  }
  securityOriginAdded(event) {
    this.addOrigin(event.data);
  }
  storageKeyAdded(event) {
    this.addStorageKey(event.data);
  }
  addOrigin(securityOrigin) {
    const parsed = new Common.ParsedURL.ParsedURL(securityOrigin);
    if (!parsed.isValid || parsed.scheme === "data" || parsed.scheme === "about" || parsed.scheme === "javascript") {
      return;
    }
    for (const isLocal of [true, false]) {
      const key = this.keyForSecurityOrigin(securityOrigin, isLocal);
      console.assert(!this.storagesInternal[key]);
      if (this.duplicateExists(key)) {
        continue;
      }
      const storage = new DOMStorage(this, securityOrigin, "", isLocal);
      this.storagesInternal[key] = storage;
      this.dispatchEventToListeners(Events.DOMStorageAdded, storage);
    }
  }
  addStorageKey(storageKey) {
    for (const isLocal of [true, false]) {
      const key = this.keyForStorageKey(storageKey, isLocal);
      console.assert(!this.storagesInternal[key]);
      if (this.duplicateExists(key)) {
        continue;
      }
      const storage = new DOMStorage(this, "", storageKey, isLocal);
      this.storagesInternal[key] = storage;
      this.dispatchEventToListeners(Events.DOMStorageAdded, storage);
    }
  }
  duplicateExists(key) {
    const parsedKey = JSON.parse(key);
    for (const storageInternal in this.storagesInternal) {
      const parsedStorageInternalKey = JSON.parse(storageInternal);
      if (parsedKey.isLocalStorage === parsedStorageInternalKey.isLocalStorage) {
        if (parsedKey.storageKey?.slice(0, -1) === parsedStorageInternalKey.securityOrigin || parsedKey.securityOrigin === parsedStorageInternalKey.storageKey?.slice(0, -1)) {
          return true;
        }
      }
    }
    return false;
  }
  securityOriginRemoved(event) {
    this.removeOrigin(event.data);
  }
  storageKeyRemoved(event) {
    this.removeStorageKey(event.data);
  }
  removeOrigin(securityOrigin) {
    for (const isLocal of [true, false]) {
      const key = this.keyForSecurityOrigin(securityOrigin, isLocal);
      const storage = this.storagesInternal[key];
      if (!storage) {
        continue;
      }
      delete this.storagesInternal[key];
      this.dispatchEventToListeners(Events.DOMStorageRemoved, storage);
    }
  }
  removeStorageKey(storageKey) {
    for (const isLocal of [true, false]) {
      const key = this.keyForStorageKey(storageKey, isLocal);
      const storage = this.storagesInternal[key];
      if (!storage) {
        continue;
      }
      delete this.storagesInternal[key];
      this.dispatchEventToListeners(Events.DOMStorageRemoved, storage);
    }
  }
  storageKey(securityOrigin, storageKey, isLocalStorage) {
    console.assert(Boolean(securityOrigin) || Boolean(storageKey));
    if (securityOrigin) {
      return JSON.stringify(DOMStorage.storageIdWithSecurityOrigin(securityOrigin, isLocalStorage));
    }
    if (storageKey) {
      return JSON.stringify(DOMStorage.storageIdWithStorageKey(storageKey, isLocalStorage));
    }
    throw new Error("Either securityOrigin or storageKey is required");
  }
  keyForSecurityOrigin(securityOrigin, isLocalStorage) {
    return this.storageKey(securityOrigin, "", isLocalStorage);
  }
  keyForStorageKey(storageKey, isLocalStorage) {
    return this.storageKey("", storageKey, isLocalStorage);
  }
  domStorageItemsCleared(storageId) {
    const domStorage = this.storageForId(storageId);
    if (!domStorage) {
      return;
    }
    domStorage.dispatchEventToListeners("DOMStorageItemsCleared" /* DOMStorageItemsCleared */);
  }
  domStorageItemRemoved(storageId, key) {
    const domStorage = this.storageForId(storageId);
    if (!domStorage) {
      return;
    }
    const eventData = { key };
    domStorage.dispatchEventToListeners("DOMStorageItemRemoved" /* DOMStorageItemRemoved */, eventData);
  }
  domStorageItemAdded(storageId, key, value) {
    const domStorage = this.storageForId(storageId);
    if (!domStorage) {
      return;
    }
    const eventData = { key, value };
    domStorage.dispatchEventToListeners("DOMStorageItemAdded" /* DOMStorageItemAdded */, eventData);
  }
  domStorageItemUpdated(storageId, key, oldValue, value) {
    const domStorage = this.storageForId(storageId);
    if (!domStorage) {
      return;
    }
    const eventData = { key, oldValue, value };
    domStorage.dispatchEventToListeners("DOMStorageItemUpdated" /* DOMStorageItemUpdated */, eventData);
  }
  storageForId(storageId) {
    return this.storagesInternal[this.storageKey(storageId.securityOrigin, storageId.storageKey, storageId.isLocalStorage)];
  }
  storages() {
    const result = [];
    for (const id in this.storagesInternal) {
      result.push(this.storagesInternal[id]);
    }
    return result;
  }
}
SDK.SDKModel.SDKModel.register(DOMStorageModel, { capabilities: SDK.Target.Capability.DOM, autostart: false });
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["DOMStorageAdded"] = "DOMStorageAdded";
  Events2["DOMStorageRemoved"] = "DOMStorageRemoved";
  return Events2;
})(Events || {});
export class DOMStorageDispatcher {
  model;
  constructor(model) {
    this.model = model;
  }
  domStorageItemsCleared({ storageId }) {
    this.model.domStorageItemsCleared(storageId);
  }
  domStorageItemRemoved({ storageId, key }) {
    this.model.domStorageItemRemoved(storageId, key);
  }
  domStorageItemAdded({ storageId, key, newValue }) {
    this.model.domStorageItemAdded(storageId, key, newValue);
  }
  domStorageItemUpdated({ storageId, key, oldValue, newValue }) {
    this.model.domStorageItemUpdated(storageId, key, oldValue, newValue);
  }
}
//# sourceMappingURL=DOMStorageModel.js.map
