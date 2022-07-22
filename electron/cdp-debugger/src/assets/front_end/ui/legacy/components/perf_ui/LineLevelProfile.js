import * as SDK from "../../../../core/sdk/sdk.js";
import * as Bindings from "../../../../models/bindings/bindings.js";
import * as Workspace from "../../../../models/workspace/workspace.js";
import * as SourceFrame from "../source_frame/source_frame.js";
let performanceInstance;
export class Performance {
  helper;
  constructor() {
    this.helper = new Helper(SourceFrame.SourceFrame.DecoratorType.PERFORMANCE);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!performanceInstance || forceNew) {
      performanceInstance = new Performance();
    }
    return performanceInstance;
  }
  reset() {
    this.helper.reset();
  }
  appendLegacyCPUProfile(profile) {
    const target = profile.target();
    const nodesToGo = [profile.profileHead];
    const sampleDuration = (profile.profileEndTime - profile.profileStartTime) / profile.totalHitCount;
    while (nodesToGo.length) {
      const nodes = nodesToGo.pop().children;
      for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i];
        nodesToGo.push(node);
        if (!node.url || !node.positionTicks) {
          continue;
        }
        for (let j = 0; j < node.positionTicks.length; ++j) {
          const lineInfo = node.positionTicks[j];
          const line = lineInfo.line;
          const time = lineInfo.ticks * sampleDuration;
          this.helper.addLineData(target, node.url, line, time);
        }
      }
    }
  }
  appendCPUProfile(profile) {
    if (!profile.lines) {
      this.appendLegacyCPUProfile(profile);
      this.helper.scheduleUpdate();
      return;
    }
    const target = profile.target();
    if (!profile.samples) {
      return;
    }
    for (let i = 1; i < profile.samples.length; ++i) {
      const line = profile.lines[i];
      if (!line) {
        continue;
      }
      const node = profile.nodeByIndex(i);
      if (!node) {
        continue;
      }
      const scriptIdOrUrl = Number(node.scriptId) || node.url;
      if (!scriptIdOrUrl) {
        continue;
      }
      const time = profile.timestamps[i] - profile.timestamps[i - 1];
      this.helper.addLineData(target, scriptIdOrUrl, line, time);
    }
    this.helper.scheduleUpdate();
  }
}
let memoryInstance;
export class Memory {
  helper;
  constructor() {
    this.helper = new Helper(SourceFrame.SourceFrame.DecoratorType.MEMORY);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!memoryInstance || forceNew) {
      memoryInstance = new Memory();
    }
    return memoryInstance;
  }
  reset() {
    this.helper.reset();
  }
  appendHeapProfile(profile, target) {
    const helper = this.helper;
    processNode(profile.head);
    helper.scheduleUpdate();
    function processNode(node) {
      node.children.forEach(processNode);
      if (!node.selfSize) {
        return;
      }
      const script = Number(node.callFrame.scriptId) || node.callFrame.url;
      if (!script) {
        return;
      }
      const line = node.callFrame.lineNumber + 1;
      helper.addLineData(target, script, line, node.selfSize);
    }
  }
}
export class Helper {
  type;
  locationPool;
  updateTimer;
  lineData;
  constructor(type) {
    this.type = type;
    this.locationPool = new Bindings.LiveLocation.LiveLocationPool();
    this.updateTimer = null;
    this.reset();
  }
  reset() {
    this.lineData = /* @__PURE__ */ new Map();
    this.scheduleUpdate();
  }
  addLineData(target, scriptIdOrUrl, line, data) {
    let targetData = this.lineData.get(target);
    if (!targetData) {
      targetData = /* @__PURE__ */ new Map();
      this.lineData.set(target, targetData);
    }
    let scriptData = targetData.get(scriptIdOrUrl);
    if (!scriptData) {
      scriptData = /* @__PURE__ */ new Map();
      targetData.set(scriptIdOrUrl, scriptData);
    }
    scriptData.set(line, (scriptData.get(line) || 0) + data);
  }
  scheduleUpdate() {
    if (this.updateTimer) {
      return;
    }
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = null;
      void this.doUpdate();
    }, 0);
  }
  async doUpdate() {
    this.locationPool.disposeAll();
    const decorationsBySource = /* @__PURE__ */ new Map();
    const pending = [];
    for (const [target, scriptToLineMap] of this.lineData) {
      const debuggerModel = target ? target.model(SDK.DebuggerModel.DebuggerModel) : null;
      for (const [scriptIdOrUrl, lineToDataMap] of scriptToLineMap) {
        const workspace = Workspace.Workspace.WorkspaceImpl.instance();
        if (debuggerModel) {
          const workspaceBinding = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
          for (const lineToData of lineToDataMap) {
            const line = lineToData[0] - 1;
            const data = lineToData[1];
            const rawLocation = typeof scriptIdOrUrl === "string" ? debuggerModel.createRawLocationByURL(scriptIdOrUrl, line, 0) : debuggerModel.createRawLocationByScriptId(String(scriptIdOrUrl), line, 0);
            if (rawLocation) {
              pending.push(workspaceBinding.rawLocationToUILocation(rawLocation).then((uiLocation) => {
                if (uiLocation) {
                  let lineMap = decorationsBySource.get(uiLocation.uiSourceCode);
                  if (!lineMap) {
                    lineMap = /* @__PURE__ */ new Map();
                    decorationsBySource.set(uiLocation.uiSourceCode, lineMap);
                  }
                  lineMap.set(uiLocation.lineNumber + 1, data);
                }
              }));
            }
          }
        } else if (typeof scriptIdOrUrl === "string") {
          const uiSourceCode = workspace.uiSourceCodeForURL(scriptIdOrUrl);
          if (uiSourceCode) {
            decorationsBySource.set(uiSourceCode, lineToDataMap);
          }
        }
      }
      await Promise.all(pending);
      for (const [uiSourceCode, lineMap] of decorationsBySource) {
        uiSourceCode.setDecorationData(this.type, lineMap);
      }
    }
    for (const uiSourceCode of Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodes()) {
      if (!decorationsBySource.has(uiSourceCode)) {
        uiSourceCode.setDecorationData(this.type, void 0);
      }
    }
  }
}
//# sourceMappingURL=LineLevelProfile.js.map
