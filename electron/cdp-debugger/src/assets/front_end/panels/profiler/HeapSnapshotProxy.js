import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  anErrorOccurredWhenACallToMethod: "An error occurred when a call to method ''{PH1}'' was requested"
};
const str_ = i18n.i18n.registerUIStrings("panels/profiler/HeapSnapshotProxy.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class HeapSnapshotWorkerProxy extends Common.ObjectWrapper.ObjectWrapper {
  eventHandler;
  nextObjectId;
  nextCallId;
  callbacks;
  previousCallbacks;
  worker;
  interval;
  constructor(eventHandler) {
    super();
    this.eventHandler = eventHandler;
    this.nextObjectId = 1;
    this.nextCallId = 1;
    this.callbacks = /* @__PURE__ */ new Map();
    this.previousCallbacks = /* @__PURE__ */ new Set();
    this.worker = Common.Worker.WorkerWrapper.fromURL(new URL("../../entrypoints/heap_snapshot_worker/heap_snapshot_worker-legacy.js", import.meta.url));
    this.worker.onmessage = this.messageReceived.bind(this);
  }
  createLoader(profileUid, snapshotReceivedCallback) {
    const objectId = this.nextObjectId++;
    const proxy = new HeapSnapshotLoaderProxy(this, objectId, profileUid, snapshotReceivedCallback);
    this.postMessage({
      callId: this.nextCallId++,
      disposition: "create",
      objectId,
      methodName: "HeapSnapshotWorker.HeapSnapshotLoader"
    });
    return proxy;
  }
  dispose() {
    this.worker.terminate();
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
  disposeObject(objectId) {
    this.postMessage({ callId: this.nextCallId++, disposition: "dispose", objectId });
  }
  evaluateForTest(script, callback) {
    const callId = this.nextCallId++;
    this.callbacks.set(callId, callback);
    this.postMessage({ callId, disposition: "evaluateForTest", source: script });
  }
  callFactoryMethod(callback, objectId, methodName, proxyConstructor) {
    const callId = this.nextCallId++;
    const methodArguments = Array.prototype.slice.call(arguments, 4);
    const newObjectId = this.nextObjectId++;
    if (callback) {
      this.callbacks.set(callId, (remoteResult) => {
        callback(remoteResult ? new proxyConstructor(this, newObjectId) : null);
      });
      this.postMessage({
        callId,
        disposition: "factory",
        objectId,
        methodName,
        methodArguments,
        newObjectId
      });
      return null;
    }
    this.postMessage({
      callId,
      disposition: "factory",
      objectId,
      methodName,
      methodArguments,
      newObjectId
    });
    return new proxyConstructor(this, newObjectId);
  }
  callMethod(callback, objectId, methodName) {
    const callId = this.nextCallId++;
    const methodArguments = Array.prototype.slice.call(arguments, 3);
    if (callback) {
      this.callbacks.set(callId, callback);
    }
    this.postMessage({
      callId,
      disposition: "method",
      objectId,
      methodName,
      methodArguments
    });
  }
  startCheckingForLongRunningCalls() {
    if (this.interval) {
      return;
    }
    this.checkLongRunningCalls();
    this.interval = window.setInterval(this.checkLongRunningCalls.bind(this), 300);
  }
  checkLongRunningCalls() {
    for (const callId of this.previousCallbacks) {
      if (!this.callbacks.has(callId)) {
        this.previousCallbacks.delete(callId);
      }
    }
    const hasLongRunningCalls = Boolean(this.previousCallbacks.size);
    this.dispatchEventToListeners(HeapSnapshotWorkerProxy.Events.Wait, hasLongRunningCalls);
    for (const callId of this.callbacks.keys()) {
      this.previousCallbacks.add(callId);
    }
  }
  messageReceived(event) {
    const data = event.data;
    if (data.eventName) {
      if (this.eventHandler) {
        this.eventHandler(data.eventName, data.data);
      }
      return;
    }
    if (data.error) {
      if (data.errorMethodName) {
        Common.Console.Console.instance().error(i18nString(UIStrings.anErrorOccurredWhenACallToMethod, { PH1: data.errorMethodName }));
      }
      Common.Console.Console.instance().error(data["errorCallStack"]);
      this.callbacks.delete(data.callId);
      return;
    }
    const callback = this.callbacks.get(data.callId);
    if (!callback) {
      return;
    }
    this.callbacks.delete(data.callId);
    callback(data.result);
  }
  postMessage(message) {
    this.worker.postMessage(message);
  }
}
((HeapSnapshotWorkerProxy2) => {
  let Events;
  ((Events2) => {
    Events2["Wait"] = "Wait";
  })(Events = HeapSnapshotWorkerProxy2.Events || (HeapSnapshotWorkerProxy2.Events = {}));
})(HeapSnapshotWorkerProxy || (HeapSnapshotWorkerProxy = {}));
export class HeapSnapshotProxyObject {
  worker;
  objectId;
  constructor(worker, objectId) {
    this.worker = worker;
    this.objectId = objectId;
  }
  callWorker(workerMethodName, args) {
    args.splice(1, 0, this.objectId);
    const worker = this.worker[workerMethodName];
    if (!worker) {
      throw new Error(`Could not find worker with name ${workerMethodName}.`);
    }
    return worker.apply(this.worker, args);
  }
  dispose() {
    this.worker.disposeObject(this.objectId);
  }
  disposeWorker() {
    this.worker.dispose();
  }
  callFactoryMethod(_callback, _methodName, _proxyConstructor, ..._var_args) {
    return this.callWorker("callFactoryMethod", Array.prototype.slice.call(arguments, 0));
  }
  callMethodPromise(_methodName, ..._var_args) {
    const args = Array.prototype.slice.call(arguments);
    return new Promise((resolve) => this.callWorker("callMethod", [resolve, ...args]));
  }
}
export class HeapSnapshotLoaderProxy extends HeapSnapshotProxyObject {
  profileUid;
  snapshotReceivedCallback;
  constructor(worker, objectId, profileUid, snapshotReceivedCallback) {
    super(worker, objectId);
    this.profileUid = profileUid;
    this.snapshotReceivedCallback = snapshotReceivedCallback;
  }
  async write(chunk) {
    await this.callMethodPromise("write", chunk);
  }
  async close() {
    await this.callMethodPromise("close");
    const snapshotProxy = await new Promise((resolve) => this.callFactoryMethod(resolve, "buildSnapshot", HeapSnapshotProxy));
    this.dispose();
    snapshotProxy.setProfileUid(this.profileUid);
    await snapshotProxy.updateStaticData();
    this.snapshotReceivedCallback(snapshotProxy);
  }
}
export class HeapSnapshotProxy extends HeapSnapshotProxyObject {
  staticData;
  profileUid;
  constructor(worker, objectId) {
    super(worker, objectId);
    this.staticData = null;
  }
  search(searchConfig, filter) {
    return this.callMethodPromise("search", searchConfig, filter);
  }
  aggregatesWithFilter(filter) {
    return this.callMethodPromise("aggregatesWithFilter", filter);
  }
  aggregatesForDiff() {
    return this.callMethodPromise("aggregatesForDiff");
  }
  calculateSnapshotDiff(baseSnapshotId, baseSnapshotAggregates) {
    return this.callMethodPromise("calculateSnapshotDiff", baseSnapshotId, baseSnapshotAggregates);
  }
  nodeClassName(snapshotObjectId) {
    return this.callMethodPromise("nodeClassName", snapshotObjectId);
  }
  createEdgesProvider(nodeIndex) {
    return this.callFactoryMethod(null, "createEdgesProvider", HeapSnapshotProviderProxy, nodeIndex);
  }
  createRetainingEdgesProvider(nodeIndex) {
    return this.callFactoryMethod(null, "createRetainingEdgesProvider", HeapSnapshotProviderProxy, nodeIndex);
  }
  createAddedNodesProvider(baseSnapshotId, className) {
    return this.callFactoryMethod(null, "createAddedNodesProvider", HeapSnapshotProviderProxy, baseSnapshotId, className);
  }
  createDeletedNodesProvider(nodeIndexes) {
    return this.callFactoryMethod(null, "createDeletedNodesProvider", HeapSnapshotProviderProxy, nodeIndexes);
  }
  createNodesProvider(filter) {
    return this.callFactoryMethod(null, "createNodesProvider", HeapSnapshotProviderProxy, filter);
  }
  createNodesProviderForClass(className, nodeFilter) {
    return this.callFactoryMethod(null, "createNodesProviderForClass", HeapSnapshotProviderProxy, className, nodeFilter);
  }
  allocationTracesTops() {
    return this.callMethodPromise("allocationTracesTops");
  }
  allocationNodeCallers(nodeId) {
    return this.callMethodPromise("allocationNodeCallers", nodeId);
  }
  allocationStack(nodeIndex) {
    return this.callMethodPromise("allocationStack", nodeIndex);
  }
  dispose() {
    throw new Error("Should never be called");
  }
  get nodeCount() {
    if (!this.staticData) {
      return 0;
    }
    return this.staticData.nodeCount;
  }
  get rootNodeIndex() {
    if (!this.staticData) {
      return 0;
    }
    return this.staticData.rootNodeIndex;
  }
  async updateStaticData() {
    this.staticData = await this.callMethodPromise("updateStaticData");
  }
  getStatistics() {
    return this.callMethodPromise("getStatistics");
  }
  getLocation(nodeIndex) {
    return this.callMethodPromise("getLocation", nodeIndex);
  }
  getSamples() {
    return this.callMethodPromise("getSamples");
  }
  get totalSize() {
    if (!this.staticData) {
      return 0;
    }
    return this.staticData.totalSize;
  }
  get uid() {
    return this.profileUid;
  }
  setProfileUid(profileUid) {
    this.profileUid = profileUid;
  }
  maxJSObjectId() {
    if (!this.staticData) {
      return 0;
    }
    return this.staticData.maxJSObjectId;
  }
}
export class HeapSnapshotProviderProxy extends HeapSnapshotProxyObject {
  constructor(worker, objectId) {
    super(worker, objectId);
  }
  nodePosition(snapshotObjectId) {
    return this.callMethodPromise("nodePosition", snapshotObjectId);
  }
  isEmpty() {
    return this.callMethodPromise("isEmpty");
  }
  serializeItemsRange(startPosition, endPosition) {
    return this.callMethodPromise("serializeItemsRange", startPosition, endPosition);
  }
  async sortAndRewind(comparator) {
    await this.callMethodPromise("sortAndRewind", comparator);
  }
}
//# sourceMappingURL=HeapSnapshotProxy.js.map
