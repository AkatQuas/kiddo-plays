export class WorkerWrapper {
  #workerPromise;
  #disposed;
  constructor(workerLocation) {
    this.#workerPromise = new Promise((fulfill) => {
      const worker = new Worker(workerLocation, { type: "module" });
      worker.onmessage = (event) => {
        console.assert(event.data === "workerReady");
        worker.onmessage = null;
        fulfill(worker);
      };
    });
  }
  static fromURL(url) {
    return new WorkerWrapper(url);
  }
  postMessage(message) {
    void this.#workerPromise.then((worker) => {
      if (!this.#disposed) {
        worker.postMessage(message);
      }
    });
  }
  dispose() {
    this.#disposed = true;
    void this.#workerPromise.then((worker) => worker.terminate());
  }
  terminate() {
    this.dispose();
  }
  set onmessage(listener) {
    void this.#workerPromise.then((worker) => {
      worker.onmessage = listener;
    });
  }
  set onerror(listener) {
    void this.#workerPromise.then((worker) => {
      worker.onerror = listener;
    });
  }
}
//# sourceMappingURL=Worker.js.map
