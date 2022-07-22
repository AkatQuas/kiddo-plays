import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
let lastId = 1;
export class ProtocolService {
  targetInfo;
  parallelConnection;
  lighthouseWorkerPromise;
  lighthouseMessageUpdateCallback;
  async attach() {
    await SDK.TargetManager.TargetManager.instance().suspendAllTargets();
    const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!mainTarget) {
      throw new Error("Unable to find main target required for Lighthouse");
    }
    const childTargetManager = mainTarget.model(SDK.ChildTargetManager.ChildTargetManager);
    if (!childTargetManager) {
      throw new Error("Unable to find child target manager required for Lighthouse");
    }
    const resourceTreeModel = mainTarget.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!resourceTreeModel) {
      throw new Error("Unable to find resource tree model required for Lighthouse");
    }
    const mainFrame = resourceTreeModel.mainFrame;
    if (!mainFrame) {
      throw new Error("Unable to find main frame required for Lighthouse");
    }
    const { connection, sessionId } = await childTargetManager.createParallelConnection((message) => {
      if (typeof message === "string") {
        message = JSON.parse(message);
      }
      this.dispatchProtocolMessage(message);
    });
    this.parallelConnection = connection;
    this.targetInfo = {
      mainTargetId: await childTargetManager.getParentTargetId(),
      mainFrameId: mainFrame.id,
      mainSessionId: sessionId
    };
  }
  getLocales() {
    return [i18n.DevToolsLocale.DevToolsLocale.instance().locale];
  }
  async startTimespan(currentLighthouseRun) {
    const { inspectedURL, categoryIDs, flags } = currentLighthouseRun;
    if (!this.targetInfo) {
      throw new Error("Unable to get target info required for Lighthouse");
    }
    await this.sendWithResponse("startTimespan", {
      url: inspectedURL,
      categoryIDs,
      flags,
      locales: this.getLocales(),
      target: this.targetInfo
    });
  }
  async collectLighthouseResults(currentLighthouseRun) {
    const { inspectedURL, categoryIDs, flags } = currentLighthouseRun;
    if (!this.targetInfo) {
      throw new Error("Unable to get target info required for Lighthouse");
    }
    let mode = flags.mode;
    if (mode === "timespan") {
      mode = "endTimespan";
    }
    return this.sendWithResponse(mode, {
      url: inspectedURL,
      categoryIDs,
      flags,
      locales: this.getLocales(),
      target: this.targetInfo
    });
  }
  async detach() {
    const oldLighthouseWorker = this.lighthouseWorkerPromise;
    const oldParallelConnection = this.parallelConnection;
    this.lighthouseWorkerPromise = void 0;
    this.parallelConnection = void 0;
    if (oldLighthouseWorker) {
      (await oldLighthouseWorker).terminate();
    }
    if (oldParallelConnection) {
      await oldParallelConnection.disconnect();
    }
    await SDK.TargetManager.TargetManager.instance().resumeAllTargets();
  }
  registerStatusCallback(callback) {
    this.lighthouseMessageUpdateCallback = callback;
  }
  dispatchProtocolMessage(message) {
    const protocolMessage = message;
    if (protocolMessage.sessionId || protocolMessage.method && protocolMessage.method.startsWith("Target")) {
      void this.send("dispatchProtocolMessage", { message: JSON.stringify(message) });
    }
  }
  initWorker() {
    this.lighthouseWorkerPromise = new Promise((resolve) => {
      const workerUrl = new URL("../../entrypoints/lighthouse_worker/lighthouse_worker.js", import.meta.url);
      const remoteBaseSearchParam = new URL(self.location.href).searchParams.get("remoteBase");
      if (remoteBaseSearchParam) {
        workerUrl.searchParams.set("remoteBase", remoteBaseSearchParam);
      }
      const worker = new Worker(workerUrl, { type: "module" });
      worker.addEventListener("message", (event) => {
        if (event.data === "workerReady") {
          resolve(worker);
          return;
        }
        this.onWorkerMessage(event);
      });
    });
    return this.lighthouseWorkerPromise;
  }
  async ensureWorkerExists() {
    let worker;
    if (!this.lighthouseWorkerPromise) {
      worker = await this.initWorker();
    } else {
      worker = await this.lighthouseWorkerPromise;
    }
    return worker;
  }
  onWorkerMessage(event) {
    const lighthouseMessage = JSON.parse(event.data);
    if (lighthouseMessage.action === "statusUpdate") {
      if (this.lighthouseMessageUpdateCallback && lighthouseMessage.args && "message" in lighthouseMessage.args) {
        this.lighthouseMessageUpdateCallback(lighthouseMessage.args.message);
      }
    } else if (lighthouseMessage.action === "sendProtocolMessage") {
      if (lighthouseMessage.args && "message" in lighthouseMessage.args) {
        this.sendProtocolMessage(lighthouseMessage.args.message);
      }
    }
  }
  sendProtocolMessage(message) {
    if (this.parallelConnection) {
      this.parallelConnection.sendRawMessage(message);
    }
  }
  async send(action, args = {}) {
    const worker = await this.ensureWorkerExists();
    const messageId = lastId++;
    worker.postMessage(JSON.stringify({ id: messageId, action, args: { ...args, id: messageId } }));
  }
  async sendWithResponse(action, args = {}) {
    const worker = await this.ensureWorkerExists();
    const messageId = lastId++;
    const messageResult = new Promise((resolve) => {
      const workerListener = (event) => {
        const lighthouseMessage = JSON.parse(event.data);
        if (lighthouseMessage.id === messageId) {
          worker.removeEventListener("message", workerListener);
          resolve(lighthouseMessage.result);
        }
      };
      worker.addEventListener("message", workerListener);
    });
    worker.postMessage(JSON.stringify({ id: messageId, action, args: { ...args, id: messageId } }));
    return messageResult;
  }
}
//# sourceMappingURL=LighthouseProtocolService.js.map
