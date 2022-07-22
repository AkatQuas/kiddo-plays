import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../workspace/workspace.js";
import * as Protocol from "../../generated/protocol.js";
import { BreakpointManager } from "./BreakpointManager.js";
import { ContentProviderBasedProject } from "./ContentProviderBasedProject.js";
import { NetworkProject } from "./NetworkProject.js";
import { metadataForURL } from "./ResourceUtils.js";
const UIStrings = {
  liveEditFailed: "`LiveEdit` failed: {PH1}",
  liveEditCompileFailed: "`LiveEdit` compile failed: {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("models/bindings/ResourceScriptMapping.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ResourceScriptMapping {
  debuggerModel;
  #workspace;
  debuggerWorkspaceBinding;
  #uiSourceCodeToScriptFile;
  #projects;
  #acceptedScripts;
  #eventListeners;
  constructor(debuggerModel, workspace, debuggerWorkspaceBinding) {
    this.debuggerModel = debuggerModel;
    this.#workspace = workspace;
    this.debuggerWorkspaceBinding = debuggerWorkspaceBinding;
    this.#uiSourceCodeToScriptFile = /* @__PURE__ */ new Map();
    this.#projects = /* @__PURE__ */ new Map();
    this.#acceptedScripts = /* @__PURE__ */ new Set();
    const runtimeModel = debuggerModel.runtimeModel();
    this.#eventListeners = [
      this.debuggerModel.addEventListener(SDK.DebuggerModel.Events.ParsedScriptSource, (event) => {
        void this.parsedScriptSource(event);
      }, this),
      this.debuggerModel.addEventListener(SDK.DebuggerModel.Events.GlobalObjectCleared, this.globalObjectCleared, this),
      runtimeModel.addEventListener(SDK.RuntimeModel.Events.ExecutionContextDestroyed, this.executionContextDestroyed, this)
    ];
  }
  project(script) {
    const prefix = script.isContentScript() ? "js:extensions:" : "js::";
    const projectId = prefix + this.debuggerModel.target().id() + ":" + script.frameId;
    let project = this.#projects.get(projectId);
    if (!project) {
      const projectType = script.isContentScript() ? Workspace.Workspace.projectTypes.ContentScripts : Workspace.Workspace.projectTypes.Network;
      project = new ContentProviderBasedProject(this.#workspace, projectId, projectType, "", false);
      NetworkProject.setTargetForProject(project, this.debuggerModel.target());
      this.#projects.set(projectId, project);
    }
    return project;
  }
  rawLocationToUILocation(rawLocation) {
    const script = rawLocation.script();
    if (!script) {
      return null;
    }
    const project = this.project(script);
    const uiSourceCode = project.uiSourceCodeForURL(script.sourceURL);
    if (!uiSourceCode) {
      return null;
    }
    const scriptFile = this.#uiSourceCodeToScriptFile.get(uiSourceCode);
    if (!scriptFile) {
      return null;
    }
    if (scriptFile.hasDivergedFromVM() && !scriptFile.isMergingToVM() || scriptFile.isDivergingFromVM()) {
      return null;
    }
    if (!scriptFile.hasScripts([script])) {
      return null;
    }
    const { lineNumber, columnNumber = 0 } = rawLocation;
    return uiSourceCode.uiLocation(lineNumber, columnNumber);
  }
  uiLocationToRawLocations(uiSourceCode, lineNumber, columnNumber) {
    const scriptFile = this.#uiSourceCodeToScriptFile.get(uiSourceCode);
    if (!scriptFile) {
      return [];
    }
    const { script } = scriptFile;
    if (!script) {
      return [];
    }
    return [this.debuggerModel.createRawLocation(script, lineNumber, columnNumber)];
  }
  acceptsScript(script) {
    if (!script.sourceURL || script.isLiveEdit() || script.isInlineScript() && !script.hasSourceURL) {
      return false;
    }
    if (script.isContentScript() && !script.hasSourceURL) {
      const parsedURL = new Common.ParsedURL.ParsedURL(script.sourceURL);
      if (!parsedURL.isValid) {
        return false;
      }
    }
    return true;
  }
  async parsedScriptSource(event) {
    const script = event.data;
    if (!this.acceptsScript(script)) {
      return;
    }
    this.#acceptedScripts.add(script);
    const originalContentProvider = script.originalContentProvider();
    const url = script.sourceURL;
    const project = this.project(script);
    const oldUISourceCode = project.uiSourceCodeForURL(url);
    if (oldUISourceCode) {
      const scriptFile2 = this.#uiSourceCodeToScriptFile.get(oldUISourceCode);
      if (scriptFile2 && scriptFile2.script) {
        await this.removeScript(scriptFile2.script);
      }
    }
    const uiSourceCode = project.createUISourceCode(url, originalContentProvider.contentType());
    NetworkProject.setInitialFrameAttribution(uiSourceCode, script.frameId);
    const metadata = metadataForURL(this.debuggerModel.target(), script.frameId, url);
    const scriptFile = new ResourceScriptFile(this, uiSourceCode, [script]);
    this.#uiSourceCodeToScriptFile.set(uiSourceCode, scriptFile);
    const mimeType = script.isWasm() ? "application/wasm" : "text/javascript";
    project.addUISourceCodeWithProvider(uiSourceCode, originalContentProvider, metadata, mimeType);
    await this.debuggerWorkspaceBinding.updateLocations(script);
  }
  scriptFile(uiSourceCode) {
    return this.#uiSourceCodeToScriptFile.get(uiSourceCode) || null;
  }
  async removeScript(script) {
    if (!this.#acceptedScripts.has(script)) {
      return;
    }
    this.#acceptedScripts.delete(script);
    const project = this.project(script);
    const uiSourceCode = project.uiSourceCodeForURL(script.sourceURL);
    const scriptFile = this.#uiSourceCodeToScriptFile.get(uiSourceCode);
    if (scriptFile) {
      scriptFile.dispose();
    }
    this.#uiSourceCodeToScriptFile.delete(uiSourceCode);
    project.removeFile(script.sourceURL);
    await this.debuggerWorkspaceBinding.updateLocations(script);
  }
  executionContextDestroyed(event) {
    const executionContext = event.data;
    const scripts = this.debuggerModel.scriptsForExecutionContext(executionContext);
    for (const script of scripts) {
      void this.removeScript(script);
    }
  }
  globalObjectCleared() {
    const scripts = Array.from(this.#acceptedScripts);
    for (const script of scripts) {
      void this.removeScript(script);
    }
  }
  resetForTest() {
    const scripts = Array.from(this.#acceptedScripts);
    for (const script of scripts) {
      void this.removeScript(script);
    }
  }
  dispose() {
    Common.EventTarget.removeEventListeners(this.#eventListeners);
    const scripts = Array.from(this.#acceptedScripts);
    for (const script of scripts) {
      void this.removeScript(script);
    }
    for (const project of this.#projects.values()) {
      project.removeProject();
    }
    this.#projects.clear();
  }
}
export class ResourceScriptFile extends Common.ObjectWrapper.ObjectWrapper {
  #resourceScriptMapping;
  #uiSourceCodeInternal;
  scriptInternal;
  #scriptSource;
  #isDivergingFromVMInternal;
  #hasDivergedFromVMInternal;
  #isMergingToVMInternal;
  constructor(resourceScriptMapping, uiSourceCode, scripts) {
    super();
    console.assert(scripts.length > 0);
    this.#resourceScriptMapping = resourceScriptMapping;
    this.#uiSourceCodeInternal = uiSourceCode;
    if (this.#uiSourceCodeInternal.contentType().isScript()) {
      this.scriptInternal = scripts[scripts.length - 1];
    }
    this.#uiSourceCodeInternal.addEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.workingCopyChanged, this);
    this.#uiSourceCodeInternal.addEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this);
  }
  hasScripts(scripts) {
    return Boolean(this.scriptInternal) && this.scriptInternal === scripts[0];
  }
  isDiverged() {
    if (this.#uiSourceCodeInternal.isDirty()) {
      return true;
    }
    if (!this.scriptInternal) {
      return false;
    }
    if (typeof this.#scriptSource === "undefined" || this.#scriptSource === null) {
      return false;
    }
    const workingCopy = this.#uiSourceCodeInternal.workingCopy();
    if (!workingCopy) {
      return false;
    }
    if (!workingCopy.startsWith(this.#scriptSource.trimEnd())) {
      return true;
    }
    const suffix = this.#uiSourceCodeInternal.workingCopy().substr(this.#scriptSource.length);
    return Boolean(suffix.length) && !suffix.match(SDK.Script.sourceURLRegex);
  }
  workingCopyChanged() {
    void this.update();
  }
  workingCopyCommitted() {
    if (this.#uiSourceCodeInternal.project().canSetFileContent()) {
      return;
    }
    if (!this.scriptInternal) {
      return;
    }
    const breakpoints = BreakpointManager.instance().breakpointLocationsForUISourceCode(this.#uiSourceCodeInternal).map((breakpointLocation) => breakpointLocation.breakpoint);
    const source = this.#uiSourceCodeInternal.workingCopy();
    void this.scriptInternal.editSource(source).then(({ status, exceptionDetails }) => {
      void this.scriptSourceWasSet(source, breakpoints, status, exceptionDetails);
    });
  }
  async scriptSourceWasSet(source, breakpoints, status, exceptionDetails) {
    if (status === Protocol.Debugger.SetScriptSourceResponseStatus.Ok) {
      this.#scriptSource = source;
    }
    await this.update();
    if (status === Protocol.Debugger.SetScriptSourceResponseStatus.Ok) {
      await Promise.all(breakpoints.map((breakpoint) => breakpoint.refreshInDebugger()));
      return;
    }
    if (!exceptionDetails) {
      Common.Console.Console.instance().addMessage(i18nString(UIStrings.liveEditFailed, { PH1: getErrorText(status) }), Common.Console.MessageLevel.Warning);
      return;
    }
    const messageText = i18nString(UIStrings.liveEditCompileFailed, { PH1: exceptionDetails.text });
    this.#uiSourceCodeInternal.addLineMessage(Workspace.UISourceCode.Message.Level.Error, messageText, exceptionDetails.lineNumber, exceptionDetails.columnNumber);
    function getErrorText(status2) {
      switch (status2) {
        case Protocol.Debugger.SetScriptSourceResponseStatus.BlockedByActiveFunction:
          return "Functions that are on the stack (currently being executed) can not be edited";
        case Protocol.Debugger.SetScriptSourceResponseStatus.BlockedByActiveGenerator:
          return "Async functions/generators that are active can not be edited";
        case Protocol.Debugger.SetScriptSourceResponseStatus.CompileError:
        case Protocol.Debugger.SetScriptSourceResponseStatus.Ok:
          throw new Error("Compile errors and Ok status must not be reported on the console");
      }
    }
  }
  async update() {
    if (this.isDiverged() && !this.#hasDivergedFromVMInternal) {
      await this.divergeFromVM();
    } else if (!this.isDiverged() && this.#hasDivergedFromVMInternal) {
      await this.mergeToVM();
    }
  }
  async divergeFromVM() {
    if (this.scriptInternal) {
      this.#isDivergingFromVMInternal = true;
      await this.#resourceScriptMapping.debuggerWorkspaceBinding.updateLocations(this.scriptInternal);
      this.#isDivergingFromVMInternal = void 0;
      this.#hasDivergedFromVMInternal = true;
      this.dispatchEventToListeners(ResourceScriptFile.Events.DidDivergeFromVM);
    }
  }
  async mergeToVM() {
    if (this.scriptInternal) {
      this.#hasDivergedFromVMInternal = void 0;
      this.#isMergingToVMInternal = true;
      await this.#resourceScriptMapping.debuggerWorkspaceBinding.updateLocations(this.scriptInternal);
      this.#isMergingToVMInternal = void 0;
      this.dispatchEventToListeners(ResourceScriptFile.Events.DidMergeToVM);
    }
  }
  hasDivergedFromVM() {
    return Boolean(this.#hasDivergedFromVMInternal);
  }
  isDivergingFromVM() {
    return Boolean(this.#isDivergingFromVMInternal);
  }
  isMergingToVM() {
    return Boolean(this.#isMergingToVMInternal);
  }
  checkMapping() {
    if (!this.scriptInternal || typeof this.#scriptSource !== "undefined") {
      this.mappingCheckedForTest();
      return;
    }
    void this.scriptInternal.requestContent().then((deferredContent) => {
      this.#scriptSource = deferredContent.content;
      void this.update().then(() => this.mappingCheckedForTest());
    });
  }
  mappingCheckedForTest() {
  }
  dispose() {
    this.#uiSourceCodeInternal.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.workingCopyChanged, this);
    this.#uiSourceCodeInternal.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this);
  }
  addSourceMapURL(sourceMapURL) {
    if (!this.scriptInternal) {
      return;
    }
    this.scriptInternal.debuggerModel.setSourceMapURL(this.scriptInternal, sourceMapURL);
  }
  hasSourceMapURL() {
    return this.scriptInternal !== void 0 && Boolean(this.scriptInternal.sourceMapURL);
  }
  async missingSymbolFiles() {
    if (!this.scriptInternal) {
      return null;
    }
    const { pluginManager } = this.#resourceScriptMapping.debuggerWorkspaceBinding;
    if (!pluginManager) {
      return null;
    }
    const sources = await pluginManager.getSourcesForScript(this.scriptInternal);
    return sources && "missingSymbolFiles" in sources ? sources.missingSymbolFiles : null;
  }
  get script() {
    return this.scriptInternal || null;
  }
  get uiSourceCode() {
    return this.#uiSourceCodeInternal;
  }
}
((ResourceScriptFile2) => {
  let Events;
  ((Events2) => {
    Events2["DidMergeToVM"] = "DidMergeToVM";
    Events2["DidDivergeFromVM"] = "DidDivergeFromVM";
  })(Events = ResourceScriptFile2.Events || (ResourceScriptFile2.Events = {}));
})(ResourceScriptFile || (ResourceScriptFile = {}));
//# sourceMappingURL=ResourceScriptMapping.js.map
