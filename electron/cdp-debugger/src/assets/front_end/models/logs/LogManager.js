import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import { NetworkLog } from "./NetworkLog.js";
const modelToEventListeners = /* @__PURE__ */ new WeakMap();
let instance = null;
export class LogManager {
  constructor() {
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.LogModel.LogModel, this);
  }
  static instance({ forceNew } = { forceNew: false }) {
    if (!instance || forceNew) {
      instance = new LogManager();
    }
    return instance;
  }
  modelAdded(logModel) {
    const eventListeners = [];
    eventListeners.push(logModel.addEventListener(SDK.LogModel.Events.EntryAdded, this.logEntryAdded, this));
    modelToEventListeners.set(logModel, eventListeners);
  }
  modelRemoved(logModel) {
    const eventListeners = modelToEventListeners.get(logModel);
    if (eventListeners) {
      Common.EventTarget.removeEventListeners(eventListeners);
    }
  }
  logEntryAdded(event) {
    const { logModel, entry } = event.data;
    const target = logModel.target();
    const details = {
      url: entry.url,
      line: entry.lineNumber,
      parameters: [entry.text, ...entry.args ?? []],
      stackTrace: entry.stackTrace,
      timestamp: entry.timestamp,
      workerId: entry.workerId,
      category: entry.category,
      affectedResources: entry.networkRequestId ? { requestId: entry.networkRequestId } : void 0
    };
    const consoleMessage = new SDK.ConsoleModel.ConsoleMessage(target.model(SDK.RuntimeModel.RuntimeModel), entry.source, entry.level, entry.text, details);
    if (entry.networkRequestId) {
      NetworkLog.instance().associateConsoleMessageWithRequest(consoleMessage, entry.networkRequestId);
    }
    if (consoleMessage.source === Protocol.Log.LogEntrySource.Worker) {
      const workerId = consoleMessage.workerId || "";
      if (SDK.TargetManager.TargetManager.instance().targetById(workerId)) {
        return;
      }
      window.setTimeout(() => {
        if (!SDK.TargetManager.TargetManager.instance().targetById(workerId)) {
          SDK.ConsoleModel.ConsoleModel.instance().addMessage(consoleMessage);
        }
      }, 1e3);
    } else {
      SDK.ConsoleModel.ConsoleModel.instance().addMessage(consoleMessage);
    }
  }
}
//# sourceMappingURL=LogManager.js.map
