var ACTION = /* @__PURE__ */ ((ACTION2) => {
  ACTION2["READ"] = "read";
  ACTION2["WRITE"] = "write";
  return ACTION2;
})(ACTION || {});
export class RenderCoordinatorQueueEmptyEvent extends Event {
  static eventName = "renderqueueempty";
  constructor() {
    super(RenderCoordinatorQueueEmptyEvent.eventName);
  }
}
export class RenderCoordinatorNewFrameEvent extends Event {
  static eventName = "newframe";
  constructor() {
    super(RenderCoordinatorNewFrameEvent.eventName);
  }
}
let renderCoordinatorInstance;
const UNNAMED_READ = "Unnamed read";
const UNNAMED_WRITE = "Unnamed write";
const UNNAMED_SCROLL = "Unnamed scroll";
const DEADLOCK_TIMEOUT = 1500;
globalThis.__getRenderCoordinatorPendingFrames = function() {
  return RenderCoordinator.pendingFramesCount();
};
export class RenderCoordinator extends EventTarget {
  static instance({ forceNew = false } = {}) {
    if (!renderCoordinatorInstance || forceNew) {
      renderCoordinatorInstance = new RenderCoordinator();
    }
    return renderCoordinatorInstance;
  }
  static pendingFramesCount() {
    if (!renderCoordinatorInstance) {
      throw new Error("No render coordinator instance found.");
    }
    return renderCoordinatorInstance.pendingFramesCount();
  }
  observe = false;
  recordStorageLimit = 100;
  observeOnlyNamed = true;
  #logInternal = [];
  #pendingWorkFrames = [];
  #resolvers = /* @__PURE__ */ new WeakMap();
  #rejectors = /* @__PURE__ */ new WeakMap();
  #labels = /* @__PURE__ */ new WeakMap();
  #scheduledWorkId = 0;
  pendingFramesCount() {
    return this.#pendingWorkFrames.length;
  }
  done() {
    if (this.#pendingWorkFrames.length === 0) {
      this.#logIfEnabled("[Queue empty]");
      return Promise.resolve();
    }
    return new Promise((resolve) => this.addEventListener("renderqueueempty", () => resolve(), { once: true }));
  }
  async read(labelOrCallback, callback) {
    if (typeof labelOrCallback === "string") {
      if (!callback) {
        throw new Error("Read called with label but no callback");
      }
      return this.#enqueueHandler(callback, "read" /* READ */, labelOrCallback);
    }
    return this.#enqueueHandler(labelOrCallback, "read" /* READ */, UNNAMED_READ);
  }
  async write(labelOrCallback, callback) {
    if (typeof labelOrCallback === "string") {
      if (!callback) {
        throw new Error("Write called with label but no callback");
      }
      return this.#enqueueHandler(callback, "write" /* WRITE */, labelOrCallback);
    }
    return this.#enqueueHandler(labelOrCallback, "write" /* WRITE */, UNNAMED_WRITE);
  }
  takeRecords() {
    const logs = [...this.#logInternal];
    this.#logInternal.length = 0;
    return logs;
  }
  async scroll(labelOrCallback, callback) {
    if (typeof labelOrCallback === "string") {
      if (!callback) {
        throw new Error("Scroll called with label but no callback");
      }
      return this.#enqueueHandler(callback, "read" /* READ */, labelOrCallback);
    }
    return this.#enqueueHandler(labelOrCallback, "read" /* READ */, UNNAMED_SCROLL);
  }
  #enqueueHandler(callback, action, label = "") {
    this.#labels.set(callback, `${action === "read" /* READ */ ? "[Read]" : "[Write]"}: ${label}`);
    if (this.#pendingWorkFrames.length === 0) {
      this.#pendingWorkFrames.push({
        readers: [],
        writers: []
      });
    }
    const frame = this.#pendingWorkFrames[0];
    if (!frame) {
      throw new Error("No frame available");
    }
    switch (action) {
      case "read" /* READ */:
        frame.readers.push(callback);
        break;
      case "write" /* WRITE */:
        frame.writers.push(callback);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    const resolverPromise = new Promise((resolve, reject) => {
      this.#resolvers.set(callback, resolve);
      this.#rejectors.set(callback, reject);
    });
    this.#scheduleWork();
    return resolverPromise;
  }
  async #handleWork(handler) {
    const resolver = this.#resolvers.get(handler);
    this.#resolvers.delete(handler);
    this.#rejectors.delete(handler);
    const data = await handler.call(void 0);
    if (!resolver) {
      throw new Error("Unable to locate resolver");
    }
    resolver.call(void 0, data);
  }
  #scheduleWork() {
    const hasScheduledWork = this.#scheduledWorkId !== 0;
    if (hasScheduledWork) {
      return;
    }
    this.#scheduledWorkId = requestAnimationFrame(async () => {
      const hasPendingFrames = this.#pendingWorkFrames.length > 0;
      if (!hasPendingFrames) {
        this.dispatchEvent(new RenderCoordinatorQueueEmptyEvent());
        window.dispatchEvent(new RenderCoordinatorQueueEmptyEvent());
        this.#logIfEnabled("[Queue empty]");
        this.#scheduledWorkId = 0;
        return;
      }
      this.dispatchEvent(new RenderCoordinatorNewFrameEvent());
      this.#logIfEnabled("[New frame]");
      const frame = this.#pendingWorkFrames.shift();
      if (!frame) {
        return;
      }
      const readers = [];
      for (const reader of frame.readers) {
        this.#logIfEnabled(this.#labels.get(reader));
        readers.push(this.#handleWork(reader));
      }
      try {
        await Promise.race([
          Promise.all(readers),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error(`Readers took over ${DEADLOCK_TIMEOUT}ms. Possible deadlock?`)), DEADLOCK_TIMEOUT);
          })
        ]);
      } catch (err) {
        this.#rejectAll(frame.readers, err);
      }
      const writers = [];
      for (const writer of frame.writers) {
        this.#logIfEnabled(this.#labels.get(writer));
        writers.push(this.#handleWork(writer));
      }
      try {
        await Promise.race([
          Promise.all(writers),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error(`Writers took over ${DEADLOCK_TIMEOUT}ms. Possible deadlock?`)), DEADLOCK_TIMEOUT);
          })
        ]);
      } catch (err) {
        this.#rejectAll(frame.writers, err);
      }
      this.#scheduledWorkId = 0;
      this.#scheduleWork();
    });
  }
  #rejectAll(handlers, error) {
    for (const handler of handlers) {
      const rejector = this.#rejectors.get(handler);
      if (!rejector) {
        continue;
      }
      rejector.call(void 0, error);
      this.#resolvers.delete(handler);
      this.#rejectors.delete(handler);
    }
  }
  #logIfEnabled(value) {
    if (!this.observe || !value) {
      return;
    }
    const hasNoName = value.endsWith(UNNAMED_READ) || value.endsWith(UNNAMED_WRITE) || value.endsWith(UNNAMED_SCROLL);
    if (hasNoName && this.observeOnlyNamed) {
      return;
    }
    this.#logInternal.push({ time: performance.now(), value });
    while (this.#logInternal.length > this.recordStorageLimit) {
      this.#logInternal.shift();
    }
  }
}
//# sourceMappingURL=RenderCoordinator.js.map
