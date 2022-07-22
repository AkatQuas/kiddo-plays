import { Capability } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
export class StorageKeyManager extends SDKModel {
  #mainStorageKeyInternal;
  #storageKeysInternal;
  constructor(target) {
    super(target);
    this.#mainStorageKeyInternal = "";
    this.#storageKeysInternal = /* @__PURE__ */ new Set();
  }
  updateStorageKeys(storageKeys) {
    const oldStorageKeys = this.#storageKeysInternal;
    this.#storageKeysInternal = storageKeys;
    for (const storageKey of oldStorageKeys) {
      if (!this.#storageKeysInternal.has(storageKey)) {
        this.dispatchEventToListeners(Events.StorageKeyRemoved, storageKey);
      }
    }
    for (const storageKey of this.#storageKeysInternal) {
      if (!oldStorageKeys.has(storageKey)) {
        this.dispatchEventToListeners(Events.StorageKeyAdded, storageKey);
      }
    }
  }
  storageKeys() {
    return [...this.#storageKeysInternal];
  }
  mainStorageKey() {
    return this.#mainStorageKeyInternal;
  }
  setMainStorageKey(storageKey) {
    this.#mainStorageKeyInternal = storageKey;
    this.dispatchEventToListeners(Events.MainStorageKeyChanged, {
      mainStorageKey: this.#mainStorageKeyInternal
    });
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["StorageKeyAdded"] = "StorageKeyAdded";
  Events2["StorageKeyRemoved"] = "StorageKeyRemoved";
  Events2["MainStorageKeyChanged"] = "MainStorageKeyChanged";
  return Events2;
})(Events || {});
SDKModel.register(StorageKeyManager, { capabilities: Capability.None, autostart: false });
//# sourceMappingURL=StorageKeyManager.js.map
