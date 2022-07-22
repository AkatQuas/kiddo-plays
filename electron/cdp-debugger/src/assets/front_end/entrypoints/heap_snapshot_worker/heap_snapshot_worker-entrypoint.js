import * as HeapSnapshotWorker from "./heap_snapshot_worker.js";
const ctxSelf = self;
const dispatcher = new HeapSnapshotWorker.HeapSnapshotWorkerDispatcher.HeapSnapshotWorkerDispatcher(ctxSelf, (message) => self.postMessage(message));
function installMessageEventListener(listener) {
  ctxSelf.addEventListener("message", listener, false);
}
installMessageEventListener(dispatcher.dispatchMessage.bind(dispatcher));
self.postMessage("workerReady");
//# sourceMappingURL=heap_snapshot_worker-entrypoint.js.map
