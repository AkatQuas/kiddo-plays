import * as SDK from "../../core/sdk/sdk.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Workspace from "../workspace/workspace.js";
import * as Protocol from "../../generated/protocol.js";
import { DebuggerWorkspaceBinding } from "./DebuggerWorkspaceBinding.js";
import { LiveLocationPool } from "./LiveLocation.js";
const debuggerModelToMessageHelperMap = /* @__PURE__ */ new WeakMap();
export class PresentationConsoleMessageManager {
  constructor() {
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.DebuggerModel.DebuggerModel, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.ConsoleCleared, this.consoleCleared, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.MessageAdded, (event) => this.consoleMessageAdded(event.data));
    SDK.ConsoleModel.ConsoleModel.instance().messages().forEach(this.consoleMessageAdded, this);
  }
  modelAdded(debuggerModel) {
    debuggerModelToMessageHelperMap.set(debuggerModel, new PresentationConsoleMessageHelper(debuggerModel));
  }
  modelRemoved(debuggerModel) {
    const helper = debuggerModelToMessageHelperMap.get(debuggerModel);
    if (helper) {
      helper.consoleCleared();
    }
  }
  consoleMessageAdded(message) {
    const runtimeModel = message.runtimeModel();
    if (!message.isErrorOrWarning() || !message.runtimeModel() || message.source === Protocol.Log.LogEntrySource.Violation || !runtimeModel) {
      return;
    }
    const helper = debuggerModelToMessageHelperMap.get(runtimeModel.debuggerModel());
    if (helper) {
      helper.consoleMessageAdded(message);
    }
  }
  consoleCleared() {
    for (const debuggerModel of SDK.TargetManager.TargetManager.instance().models(SDK.DebuggerModel.DebuggerModel)) {
      const helper = debuggerModelToMessageHelperMap.get(debuggerModel);
      if (helper) {
        helper.consoleCleared();
      }
    }
  }
}
export class PresentationConsoleMessageHelper {
  #debuggerModel;
  #pendingConsoleMessages;
  #presentationConsoleMessages;
  #locationPool;
  constructor(debuggerModel) {
    this.#debuggerModel = debuggerModel;
    this.#pendingConsoleMessages = /* @__PURE__ */ new Map();
    this.#presentationConsoleMessages = [];
    debuggerModel.addEventListener(SDK.DebuggerModel.Events.ParsedScriptSource, (event) => {
      queueMicrotask(() => {
        this.parsedScriptSource(event);
      });
    });
    debuggerModel.addEventListener(SDK.DebuggerModel.Events.GlobalObjectCleared, this.debuggerReset, this);
    this.#locationPool = new LiveLocationPool();
  }
  consoleMessageAdded(message) {
    const rawLocation = this.rawLocation(message);
    if (rawLocation) {
      this.addConsoleMessageToScript(message, rawLocation);
    } else {
      this.addPendingConsoleMessage(message);
    }
  }
  rawLocation(message) {
    if (message.scriptId) {
      return this.#debuggerModel.createRawLocationByScriptId(message.scriptId, message.line, message.column);
    }
    const callFrame = message.stackTrace && message.stackTrace.callFrames ? message.stackTrace.callFrames[0] : null;
    if (callFrame) {
      return this.#debuggerModel.createRawLocationByScriptId(callFrame.scriptId, callFrame.lineNumber, callFrame.columnNumber);
    }
    if (message.url) {
      return this.#debuggerModel.createRawLocationByURL(message.url, message.line, message.column);
    }
    return null;
  }
  addConsoleMessageToScript(message, rawLocation) {
    this.#presentationConsoleMessages.push(new PresentationConsoleMessage(message, rawLocation, this.#locationPool));
  }
  addPendingConsoleMessage(message) {
    if (!message.url) {
      return;
    }
    const pendingMessages = this.#pendingConsoleMessages.get(message.url);
    if (!pendingMessages) {
      this.#pendingConsoleMessages.set(message.url, [message]);
    } else {
      pendingMessages.push(message);
    }
  }
  parsedScriptSource(event) {
    const script = event.data;
    const messages = this.#pendingConsoleMessages.get(script.sourceURL);
    if (!messages) {
      return;
    }
    const pendingMessages = [];
    for (const message of messages) {
      const rawLocation = this.rawLocation(message);
      if (rawLocation && script.scriptId === rawLocation.scriptId) {
        this.addConsoleMessageToScript(message, rawLocation);
      } else {
        pendingMessages.push(message);
      }
    }
    if (pendingMessages.length) {
      this.#pendingConsoleMessages.set(script.sourceURL, pendingMessages);
    } else {
      this.#pendingConsoleMessages.delete(script.sourceURL);
    }
  }
  consoleCleared() {
    this.#pendingConsoleMessages = /* @__PURE__ */ new Map();
    this.debuggerReset();
  }
  debuggerReset() {
    for (const message of this.#presentationConsoleMessages) {
      message.dispose();
    }
    this.#presentationConsoleMessages = [];
    this.#locationPool.disposeAll();
  }
}
export class PresentationConsoleMessage extends Workspace.UISourceCode.Message {
  #uiSourceCode;
  constructor(message, rawLocation, locationPool) {
    const level = message.level === Protocol.Log.LogEntryLevel.Error ? Workspace.UISourceCode.Message.Level.Error : Workspace.UISourceCode.Message.Level.Warning;
    super(level, message.messageText);
    void DebuggerWorkspaceBinding.instance().createLiveLocation(rawLocation, this.updateLocation.bind(this), locationPool);
  }
  async updateLocation(liveLocation) {
    if (this.#uiSourceCode) {
      this.#uiSourceCode.removeMessage(this);
    }
    const uiLocation = await liveLocation.uiLocation();
    if (!uiLocation) {
      return;
    }
    this.range = TextUtils.TextRange.TextRange.createFromLocation(uiLocation.lineNumber, uiLocation.columnNumber || 0);
    this.#uiSourceCode = uiLocation.uiSourceCode;
    this.#uiSourceCode.addMessage(this);
  }
  dispose() {
    if (this.#uiSourceCode) {
      this.#uiSourceCode.removeMessage(this);
    }
  }
}
//# sourceMappingURL=PresentationConsoleMessageHelper.js.map
