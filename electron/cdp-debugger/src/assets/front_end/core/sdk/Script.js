import * as Protocol from "../../generated/protocol.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import { Location } from "./DebuggerModel.js";
import { ResourceTreeModel } from "./ResourceTreeModel.js";
const UIStrings = {
  scriptRemovedOrDeleted: "Script removed or deleted.",
  unableToFetchScriptSource: "Unable to fetch script source."
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/Script.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class Script {
  debuggerModel;
  scriptId;
  sourceURL;
  lineOffset;
  columnOffset;
  endLine;
  endColumn;
  executionContextId;
  hash;
  #isContentScriptInternal;
  #isLiveEditInternal;
  sourceMapURL;
  debugSymbols;
  hasSourceURL;
  contentLength;
  #originalContentProviderInternal;
  originStackTrace;
  #codeOffsetInternal;
  #language;
  #contentPromise;
  #embedderNameInternal;
  isModule;
  constructor(debuggerModel, scriptId, sourceURL, startLine, startColumn, endLine, endColumn, executionContextId, hash, isContentScript, isLiveEdit, sourceMapURL, hasSourceURL, length, isModule, originStackTrace, codeOffset, scriptLanguage, debugSymbols, embedderName) {
    this.debuggerModel = debuggerModel;
    this.scriptId = scriptId;
    this.sourceURL = sourceURL;
    this.lineOffset = startLine;
    this.columnOffset = startColumn;
    this.endLine = endLine;
    this.endColumn = endColumn;
    this.isModule = isModule;
    this.executionContextId = executionContextId;
    this.hash = hash;
    this.#isContentScriptInternal = isContentScript;
    this.#isLiveEditInternal = isLiveEdit;
    this.sourceMapURL = sourceMapURL;
    this.debugSymbols = debugSymbols;
    this.hasSourceURL = hasSourceURL;
    this.contentLength = length;
    this.#originalContentProviderInternal = null;
    this.originStackTrace = originStackTrace;
    this.#codeOffsetInternal = codeOffset;
    this.#language = scriptLanguage;
    this.#contentPromise = null;
    this.#embedderNameInternal = embedderName;
  }
  embedderName() {
    return this.#embedderNameInternal;
  }
  target() {
    return this.debuggerModel.target();
  }
  static trimSourceURLComment(source) {
    let sourceURLIndex = source.lastIndexOf("//# sourceURL=");
    if (sourceURLIndex === -1) {
      sourceURLIndex = source.lastIndexOf("//@ sourceURL=");
      if (sourceURLIndex === -1) {
        return source;
      }
    }
    const sourceURLLineIndex = source.lastIndexOf("\n", sourceURLIndex);
    if (sourceURLLineIndex === -1) {
      return source;
    }
    const sourceURLLine = source.substr(sourceURLLineIndex + 1);
    if (!sourceURLLine.match(sourceURLRegex)) {
      return source;
    }
    return source.substr(0, sourceURLLineIndex);
  }
  isContentScript() {
    return this.#isContentScriptInternal;
  }
  codeOffset() {
    return this.#codeOffsetInternal;
  }
  isJavaScript() {
    return this.#language === Protocol.Debugger.ScriptLanguage.JavaScript;
  }
  isWasm() {
    return this.#language === Protocol.Debugger.ScriptLanguage.WebAssembly;
  }
  scriptLanguage() {
    return this.#language;
  }
  executionContext() {
    return this.debuggerModel.runtimeModel().executionContext(this.executionContextId);
  }
  isLiveEdit() {
    return this.#isLiveEditInternal;
  }
  contentURL() {
    return this.sourceURL;
  }
  contentType() {
    return Common.ResourceType.resourceTypes.Script;
  }
  async contentEncoded() {
    return false;
  }
  requestContent() {
    if (!this.#contentPromise) {
      this.#contentPromise = this.originalContentProvider().requestContent();
    }
    return this.#contentPromise;
  }
  async getWasmBytecode() {
    const base64 = await this.debuggerModel.target().debuggerAgent().invoke_getWasmBytecode({ scriptId: this.scriptId });
    const response = await fetch(`data:application/wasm;base64,${base64.bytecode}`);
    return response.arrayBuffer();
  }
  originalContentProvider() {
    if (!this.#originalContentProviderInternal) {
      let lazyContentPromise;
      this.#originalContentProviderInternal = new TextUtils.StaticContentProvider.StaticContentProvider(this.contentURL(), this.contentType(), () => {
        if (!lazyContentPromise) {
          lazyContentPromise = (async () => {
            if (!this.scriptId) {
              return { content: null, error: i18nString(UIStrings.scriptRemovedOrDeleted), isEncoded: false };
            }
            try {
              const result = await this.debuggerModel.target().debuggerAgent().invoke_getScriptSource({ scriptId: this.scriptId });
              if (result.getError()) {
                throw new Error(result.getError());
              }
              const { scriptSource, bytecode } = result;
              if (bytecode) {
                return { content: bytecode, isEncoded: true };
              }
              let content = scriptSource || "";
              if (this.hasSourceURL && this.sourceURL.startsWith("snippet://")) {
                content = Script.trimSourceURLComment(content);
              }
              return { content, isEncoded: false };
            } catch (err) {
              return { content: null, error: i18nString(UIStrings.unableToFetchScriptSource), isEncoded: false };
            }
          })();
        }
        return lazyContentPromise;
      });
    }
    return this.#originalContentProviderInternal;
  }
  async searchInContent(query, caseSensitive, isRegex) {
    if (!this.scriptId) {
      return [];
    }
    const matches = await this.debuggerModel.target().debuggerAgent().invoke_searchInContent({ scriptId: this.scriptId, query, caseSensitive, isRegex });
    return (matches.result || []).map((match) => new TextUtils.ContentProvider.SearchMatch(match.lineNumber, match.lineContent));
  }
  appendSourceURLCommentIfNeeded(source) {
    if (!this.hasSourceURL) {
      return source;
    }
    return source + "\n //# sourceURL=" + this.sourceURL;
  }
  async editSource(newSource) {
    newSource = Script.trimSourceURLComment(newSource);
    newSource = this.appendSourceURLCommentIfNeeded(newSource);
    const { content: oldSource } = await this.requestContent();
    if (oldSource === newSource) {
      return { status: Protocol.Debugger.SetScriptSourceResponseStatus.Ok };
    }
    const response = await this.debuggerModel.target().debuggerAgent().invoke_setScriptSource({ scriptId: this.scriptId, scriptSource: newSource, allowTopFrameEditing: true });
    if (response.getError()) {
      throw new Error(`Script#editSource failed for script with id ${this.scriptId}: ${response.getError()}`);
    }
    if (!response.getError() && response.status === Protocol.Debugger.SetScriptSourceResponseStatus.Ok) {
      this.#contentPromise = Promise.resolve({ content: newSource, isEncoded: false });
    }
    return { status: response.status, exceptionDetails: response.exceptionDetails };
  }
  rawLocation(lineNumber, columnNumber) {
    if (this.containsLocation(lineNumber, columnNumber)) {
      return new Location(this.debuggerModel, this.scriptId, lineNumber, columnNumber);
    }
    return null;
  }
  toRelativeLocation(location) {
    console.assert(location.scriptId === this.scriptId, "`toRelativeLocation` must be used with location of the same script");
    const relativeLineNumber = location.lineNumber - this.lineOffset;
    const relativeColumnNumber = (location.columnNumber || 0) - (relativeLineNumber === 0 ? this.columnOffset : 0);
    return [relativeLineNumber, relativeColumnNumber];
  }
  isInlineScript() {
    const startsAtZero = !this.lineOffset && !this.columnOffset;
    return !this.isWasm() && Boolean(this.sourceURL) && !startsAtZero;
  }
  isAnonymousScript() {
    return !this.sourceURL;
  }
  async setBlackboxedRanges(positions) {
    const response = await this.debuggerModel.target().debuggerAgent().invoke_setBlackboxedRanges({ scriptId: this.scriptId, positions });
    return !response.getError();
  }
  containsLocation(lineNumber, columnNumber) {
    const afterStart = lineNumber === this.lineOffset && columnNumber >= this.columnOffset || lineNumber > this.lineOffset;
    const beforeEnd = lineNumber < this.endLine || lineNumber === this.endLine && columnNumber <= this.endColumn;
    return afterStart && beforeEnd;
  }
  get frameId() {
    if (typeof this[frameIdSymbol] !== "string") {
      this[frameIdSymbol] = frameIdForScript(this);
    }
    return this[frameIdSymbol];
  }
  createPageResourceLoadInitiator() {
    return { target: this.target(), frameId: this.frameId, initiatorUrl: this.embedderName() };
  }
}
const frameIdSymbol = Symbol("frameid");
function frameIdForScript(script) {
  const executionContext = script.executionContext();
  if (executionContext) {
    return executionContext.frameId || null;
  }
  const resourceTreeModel = script.debuggerModel.target().model(ResourceTreeModel);
  if (!resourceTreeModel || !resourceTreeModel.mainFrame) {
    return null;
  }
  return resourceTreeModel.mainFrame.id;
}
export const sourceURLRegex = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/;
//# sourceMappingURL=Script.js.map
