import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
export class IndexedDBModel extends SDK.SDKModel.SDKModel {
  securityOriginManager;
  indexedDBAgent;
  storageAgent;
  databasesInternal;
  databaseNamesBySecurityOrigin;
  originsUpdated;
  throttler;
  enabled;
  constructor(target) {
    super(target);
    target.registerStorageDispatcher(this);
    this.securityOriginManager = target.model(SDK.SecurityOriginManager.SecurityOriginManager);
    this.indexedDBAgent = target.indexedDBAgent();
    this.storageAgent = target.storageAgent();
    this.databasesInternal = /* @__PURE__ */ new Map();
    this.databaseNamesBySecurityOrigin = {};
    this.originsUpdated = /* @__PURE__ */ new Set();
    this.throttler = new Common.Throttler.Throttler(1e3);
  }
  static keyFromIDBKey(idbKey) {
    if (typeof idbKey === "undefined" || idbKey === null) {
      return void 0;
    }
    let key;
    switch (typeof idbKey) {
      case "number":
        key = {
          type: Protocol.IndexedDB.KeyType.Number,
          number: idbKey
        };
        break;
      case "string":
        key = {
          type: Protocol.IndexedDB.KeyType.String,
          string: idbKey
        };
        break;
      case "object":
        if (idbKey instanceof Date) {
          key = {
            type: Protocol.IndexedDB.KeyType.Date,
            date: idbKey.getTime()
          };
        } else if (Array.isArray(idbKey)) {
          const array = [];
          for (let i = 0; i < idbKey.length; ++i) {
            const nestedKey = IndexedDBModel.keyFromIDBKey(idbKey[i]);
            if (nestedKey) {
              array.push(nestedKey);
            }
          }
          key = {
            type: Protocol.IndexedDB.KeyType.Array,
            array
          };
        } else {
          return void 0;
        }
        break;
      default:
        return void 0;
    }
    return key;
  }
  static keyRangeFromIDBKeyRange(idbKeyRange) {
    return {
      lower: IndexedDBModel.keyFromIDBKey(idbKeyRange.lower),
      upper: IndexedDBModel.keyFromIDBKey(idbKeyRange.upper),
      lowerOpen: Boolean(idbKeyRange.lowerOpen),
      upperOpen: Boolean(idbKeyRange.upperOpen)
    };
  }
  static idbKeyPathFromKeyPath(keyPath) {
    let idbKeyPath;
    switch (keyPath.type) {
      case Protocol.IndexedDB.KeyPathType.Null:
        idbKeyPath = null;
        break;
      case Protocol.IndexedDB.KeyPathType.String:
        idbKeyPath = keyPath.string;
        break;
      case Protocol.IndexedDB.KeyPathType.Array:
        idbKeyPath = keyPath.array;
        break;
    }
    return idbKeyPath;
  }
  static keyPathStringFromIDBKeyPath(idbKeyPath) {
    if (typeof idbKeyPath === "string") {
      return '"' + idbKeyPath + '"';
    }
    if (idbKeyPath instanceof Array) {
      return '["' + idbKeyPath.join('", "') + '"]';
    }
    return null;
  }
  enable() {
    if (this.enabled) {
      return;
    }
    void this.indexedDBAgent.invoke_enable();
    if (this.securityOriginManager) {
      this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.SecurityOriginAdded, this.securityOriginAdded, this);
      this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.SecurityOriginRemoved, this.securityOriginRemoved, this);
      for (const securityOrigin of this.securityOriginManager.securityOrigins()) {
        this.addOrigin(securityOrigin);
      }
    }
    this.enabled = true;
  }
  clearForOrigin(origin) {
    if (!this.enabled || !this.databaseNamesBySecurityOrigin[origin]) {
      return;
    }
    this.removeOrigin(origin);
    this.addOrigin(origin);
  }
  async deleteDatabase(databaseId) {
    if (!this.enabled) {
      return;
    }
    await this.indexedDBAgent.invoke_deleteDatabase({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name });
    void this.loadDatabaseNames(databaseId.securityOrigin);
  }
  async refreshDatabaseNames() {
    for (const securityOrigin in this.databaseNamesBySecurityOrigin) {
      await this.loadDatabaseNames(securityOrigin);
    }
    this.dispatchEventToListeners(Events.DatabaseNamesRefreshed);
  }
  refreshDatabase(databaseId) {
    void this.loadDatabase(databaseId, true);
  }
  async clearObjectStore(databaseId, objectStoreName) {
    await this.indexedDBAgent.invoke_clearObjectStore({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name, objectStoreName });
  }
  async deleteEntries(databaseId, objectStoreName, idbKeyRange) {
    const keyRange = IndexedDBModel.keyRangeFromIDBKeyRange(idbKeyRange);
    await this.indexedDBAgent.invoke_deleteObjectStoreEntries({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name, objectStoreName, keyRange });
  }
  securityOriginAdded(event) {
    this.addOrigin(event.data);
  }
  securityOriginRemoved(event) {
    this.removeOrigin(event.data);
  }
  addOrigin(securityOrigin) {
    console.assert(!this.databaseNamesBySecurityOrigin[securityOrigin]);
    this.databaseNamesBySecurityOrigin[securityOrigin] = [];
    void this.loadDatabaseNames(securityOrigin);
    if (this.isValidSecurityOrigin(securityOrigin)) {
      void this.storageAgent.invoke_trackIndexedDBForOrigin({ origin: securityOrigin });
    }
  }
  removeOrigin(securityOrigin) {
    console.assert(Boolean(this.databaseNamesBySecurityOrigin[securityOrigin]));
    for (let i = 0; i < this.databaseNamesBySecurityOrigin[securityOrigin].length; ++i) {
      this.databaseRemoved(securityOrigin, this.databaseNamesBySecurityOrigin[securityOrigin][i]);
    }
    delete this.databaseNamesBySecurityOrigin[securityOrigin];
    if (this.isValidSecurityOrigin(securityOrigin)) {
      void this.storageAgent.invoke_untrackIndexedDBForOrigin({ origin: securityOrigin });
    }
  }
  isValidSecurityOrigin(securityOrigin) {
    const parsedURL = Common.ParsedURL.ParsedURL.fromString(securityOrigin);
    return parsedURL !== null && parsedURL.scheme.startsWith("http");
  }
  updateOriginDatabaseNames(securityOrigin, databaseNames) {
    const newDatabaseNames = new Set(databaseNames);
    const oldDatabaseNames = new Set(this.databaseNamesBySecurityOrigin[securityOrigin]);
    this.databaseNamesBySecurityOrigin[securityOrigin] = databaseNames;
    for (const databaseName of oldDatabaseNames) {
      if (!newDatabaseNames.has(databaseName)) {
        this.databaseRemoved(securityOrigin, databaseName);
      }
    }
    for (const databaseName of newDatabaseNames) {
      if (!oldDatabaseNames.has(databaseName)) {
        this.databaseAdded(securityOrigin, databaseName);
      }
    }
  }
  databases() {
    const result = [];
    for (const securityOrigin in this.databaseNamesBySecurityOrigin) {
      const databaseNames = this.databaseNamesBySecurityOrigin[securityOrigin];
      for (let i = 0; i < databaseNames.length; ++i) {
        result.push(new DatabaseId(securityOrigin, databaseNames[i]));
      }
    }
    return result;
  }
  databaseAdded(securityOrigin, databaseName) {
    const databaseId = new DatabaseId(securityOrigin, databaseName);
    this.dispatchEventToListeners(Events.DatabaseAdded, { model: this, databaseId });
  }
  databaseRemoved(securityOrigin, databaseName) {
    const databaseId = new DatabaseId(securityOrigin, databaseName);
    this.dispatchEventToListeners(Events.DatabaseRemoved, { model: this, databaseId });
  }
  async loadDatabaseNames(securityOrigin) {
    const { databaseNames } = await this.indexedDBAgent.invoke_requestDatabaseNames({ securityOrigin });
    if (!databaseNames) {
      return [];
    }
    if (!this.databaseNamesBySecurityOrigin[securityOrigin]) {
      return [];
    }
    this.updateOriginDatabaseNames(securityOrigin, databaseNames);
    return databaseNames;
  }
  async loadDatabase(databaseId, entriesUpdated) {
    const { databaseWithObjectStores } = await this.indexedDBAgent.invoke_requestDatabase({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name });
    if (!databaseWithObjectStores) {
      return;
    }
    if (!this.databaseNamesBySecurityOrigin[databaseId.securityOrigin]) {
      return;
    }
    const databaseModel = new Database(databaseId, databaseWithObjectStores.version);
    this.databasesInternal.set(databaseId, databaseModel);
    for (const objectStore of databaseWithObjectStores.objectStores) {
      const objectStoreIDBKeyPath = IndexedDBModel.idbKeyPathFromKeyPath(objectStore.keyPath);
      const objectStoreModel = new ObjectStore(objectStore.name, objectStoreIDBKeyPath, objectStore.autoIncrement);
      for (let j = 0; j < objectStore.indexes.length; ++j) {
        const index = objectStore.indexes[j];
        const indexIDBKeyPath = IndexedDBModel.idbKeyPathFromKeyPath(index.keyPath);
        const indexModel = new Index(index.name, indexIDBKeyPath, index.unique, index.multiEntry);
        objectStoreModel.indexes.set(indexModel.name, indexModel);
      }
      databaseModel.objectStores.set(objectStoreModel.name, objectStoreModel);
    }
    this.dispatchEventToListeners(Events.DatabaseLoaded, { model: this, database: databaseModel, entriesUpdated });
  }
  loadObjectStoreData(databaseId, objectStoreName, idbKeyRange, skipCount, pageSize, callback) {
    void this.requestData(databaseId, databaseId.name, objectStoreName, "", idbKeyRange, skipCount, pageSize, callback);
  }
  loadIndexData(databaseId, objectStoreName, indexName, idbKeyRange, skipCount, pageSize, callback) {
    void this.requestData(databaseId, databaseId.name, objectStoreName, indexName, idbKeyRange, skipCount, pageSize, callback);
  }
  async requestData(databaseId, databaseName, objectStoreName, indexName, idbKeyRange, skipCount, pageSize, callback) {
    const keyRange = idbKeyRange ? IndexedDBModel.keyRangeFromIDBKeyRange(idbKeyRange) : void 0;
    const response = await this.indexedDBAgent.invoke_requestData({
      securityOrigin: databaseId.securityOrigin,
      databaseName,
      objectStoreName,
      indexName,
      skipCount,
      pageSize,
      keyRange
    });
    if (response.getError()) {
      console.error("IndexedDBAgent error: " + response.getError());
      return;
    }
    const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
    if (!runtimeModel || !this.databaseNamesBySecurityOrigin[databaseId.securityOrigin]) {
      return;
    }
    const dataEntries = response.objectStoreDataEntries;
    const entries = [];
    for (const dataEntry of dataEntries) {
      const key = runtimeModel.createRemoteObject(dataEntry.key);
      const primaryKey = runtimeModel.createRemoteObject(dataEntry.primaryKey);
      const value = runtimeModel.createRemoteObject(dataEntry.value);
      entries.push(new Entry(key, primaryKey, value));
    }
    callback(entries, response.hasMore);
  }
  async getMetadata(databaseId, objectStore) {
    const databaseOrigin = databaseId.securityOrigin;
    const databaseName = databaseId.name;
    const objectStoreName = objectStore.name;
    const response = await this.indexedDBAgent.invoke_getMetadata({ securityOrigin: databaseOrigin, databaseName, objectStoreName });
    if (response.getError()) {
      console.error("IndexedDBAgent error: " + response.getError());
      return null;
    }
    return { entriesCount: response.entriesCount, keyGeneratorValue: response.keyGeneratorValue };
  }
  async refreshDatabaseList(securityOrigin) {
    const databaseNames = await this.loadDatabaseNames(securityOrigin);
    for (const databaseName of databaseNames) {
      void this.loadDatabase(new DatabaseId(securityOrigin, databaseName), false);
    }
  }
  indexedDBListUpdated({ origin: securityOrigin }) {
    this.originsUpdated.add(securityOrigin);
    void this.throttler.schedule(() => {
      const promises = Array.from(this.originsUpdated, (securityOrigin2) => {
        void this.refreshDatabaseList(securityOrigin2);
      });
      this.originsUpdated.clear();
      return Promise.all(promises);
    });
  }
  indexedDBContentUpdated({ origin: securityOrigin, databaseName, objectStoreName }) {
    const databaseId = new DatabaseId(securityOrigin, databaseName);
    this.dispatchEventToListeners(Events.IndexedDBContentUpdated, { databaseId, objectStoreName, model: this });
  }
  cacheStorageListUpdated(_event) {
  }
  cacheStorageContentUpdated(_event) {
  }
  interestGroupAccessed(_event) {
  }
}
SDK.SDKModel.SDKModel.register(IndexedDBModel, { capabilities: SDK.Target.Capability.Storage, autostart: false });
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["DatabaseAdded"] = "DatabaseAdded";
  Events2["DatabaseRemoved"] = "DatabaseRemoved";
  Events2["DatabaseLoaded"] = "DatabaseLoaded";
  Events2["DatabaseNamesRefreshed"] = "DatabaseNamesRefreshed";
  Events2["IndexedDBContentUpdated"] = "IndexedDBContentUpdated";
  return Events2;
})(Events || {});
export class Entry {
  key;
  primaryKey;
  value;
  constructor(key, primaryKey, value) {
    this.key = key;
    this.primaryKey = primaryKey;
    this.value = value;
  }
}
export class DatabaseId {
  securityOrigin;
  name;
  constructor(securityOrigin, name) {
    this.securityOrigin = securityOrigin;
    this.name = name;
  }
  equals(databaseId) {
    return this.name === databaseId.name && this.securityOrigin === databaseId.securityOrigin;
  }
}
export class Database {
  databaseId;
  version;
  objectStores;
  constructor(databaseId, version) {
    this.databaseId = databaseId;
    this.version = version;
    this.objectStores = /* @__PURE__ */ new Map();
  }
}
export class ObjectStore {
  name;
  keyPath;
  autoIncrement;
  indexes;
  constructor(name, keyPath, autoIncrement) {
    this.name = name;
    this.keyPath = keyPath;
    this.autoIncrement = autoIncrement;
    this.indexes = /* @__PURE__ */ new Map();
  }
  get keyPathString() {
    return IndexedDBModel.keyPathStringFromIDBKeyPath(this.keyPath);
  }
}
export class Index {
  name;
  keyPath;
  unique;
  multiEntry;
  constructor(name, keyPath, unique, multiEntry) {
    this.name = name;
    this.keyPath = keyPath;
    this.unique = unique;
    this.multiEntry = multiEntry;
  }
  get keyPathString() {
    return IndexedDBModel.keyPathStringFromIDBKeyPath(this.keyPath);
  }
}
//# sourceMappingURL=IndexedDBModel.js.map
