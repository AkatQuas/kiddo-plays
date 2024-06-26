import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../workspace/workspace.js";
import { ContentProviderBasedProject } from "./ContentProviderBasedProject.js";
import { NetworkProject } from "./NetworkProject.js";
import { metadataForURL } from "./ResourceUtils.js";
const uiSourceCodeToStyleMap = /* @__PURE__ */ new WeakMap();
export class StylesSourceMapping {
  #cssModel;
  #project;
  #styleFiles;
  #eventListeners;
  constructor(cssModel, workspace) {
    this.#cssModel = cssModel;
    const target = this.#cssModel.target();
    this.#project = new ContentProviderBasedProject(workspace, "css:" + target.id(), Workspace.Workspace.projectTypes.Network, "", false);
    NetworkProject.setTargetForProject(this.#project, target);
    this.#styleFiles = /* @__PURE__ */ new Map();
    this.#eventListeners = [
      this.#cssModel.addEventListener(SDK.CSSModel.Events.StyleSheetAdded, this.styleSheetAdded, this),
      this.#cssModel.addEventListener(SDK.CSSModel.Events.StyleSheetRemoved, this.styleSheetRemoved, this),
      this.#cssModel.addEventListener(SDK.CSSModel.Events.StyleSheetChanged, this.styleSheetChanged, this)
    ];
  }
  rawLocationToUILocation(rawLocation) {
    const header = rawLocation.header();
    if (!header || !this.acceptsHeader(header)) {
      return null;
    }
    const styleFile = this.#styleFiles.get(header.resourceURL());
    if (!styleFile) {
      return null;
    }
    let lineNumber = rawLocation.lineNumber;
    let columnNumber = rawLocation.columnNumber;
    if (header.isInline && header.hasSourceURL) {
      lineNumber -= header.lineNumberInSource(0);
      const headerColumnNumber = header.columnNumberInSource(lineNumber, 0);
      if (typeof headerColumnNumber === "undefined") {
        columnNumber = headerColumnNumber;
      } else {
        columnNumber -= headerColumnNumber;
      }
    }
    return styleFile.getUiSourceCode().uiLocation(lineNumber, columnNumber);
  }
  uiLocationToRawLocations(uiLocation) {
    const styleFile = uiSourceCodeToStyleMap.get(uiLocation.uiSourceCode);
    if (!styleFile) {
      return [];
    }
    const rawLocations = [];
    for (const header of styleFile.getHeaders()) {
      let lineNumber = uiLocation.lineNumber;
      let columnNumber = uiLocation.columnNumber;
      if (header.isInline && header.hasSourceURL) {
        columnNumber = header.columnNumberInSource(lineNumber, uiLocation.columnNumber || 0);
        lineNumber = header.lineNumberInSource(lineNumber);
      }
      rawLocations.push(new SDK.CSSModel.CSSLocation(header, lineNumber, columnNumber));
    }
    return rawLocations;
  }
  acceptsHeader(header) {
    if (header.isConstructedByNew()) {
      return false;
    }
    if (header.isInline && !header.hasSourceURL && header.origin !== "inspector") {
      return false;
    }
    if (!header.resourceURL()) {
      return false;
    }
    return true;
  }
  styleSheetAdded(event) {
    const header = event.data;
    if (!this.acceptsHeader(header)) {
      return;
    }
    const url = header.resourceURL();
    let styleFile = this.#styleFiles.get(url);
    if (!styleFile) {
      styleFile = new StyleFile(this.#cssModel, this.#project, header);
      this.#styleFiles.set(url, styleFile);
    } else {
      styleFile.addHeader(header);
    }
  }
  styleSheetRemoved(event) {
    const header = event.data;
    if (!this.acceptsHeader(header)) {
      return;
    }
    const url = header.resourceURL();
    const styleFile = this.#styleFiles.get(url);
    if (styleFile) {
      if (styleFile.getHeaders().size === 1) {
        styleFile.dispose();
        this.#styleFiles.delete(url);
      } else {
        styleFile.removeHeader(header);
      }
    }
  }
  styleSheetChanged(event) {
    const header = this.#cssModel.styleSheetHeaderForId(event.data.styleSheetId);
    if (!header || !this.acceptsHeader(header)) {
      return;
    }
    const styleFile = this.#styleFiles.get(header.resourceURL());
    if (styleFile) {
      styleFile.styleSheetChanged(header);
    }
  }
  dispose() {
    for (const styleFile of this.#styleFiles.values()) {
      styleFile.dispose();
    }
    this.#styleFiles.clear();
    Common.EventTarget.removeEventListeners(this.#eventListeners);
    this.#project.removeProject();
  }
}
export class StyleFile {
  #cssModel;
  #project;
  headers;
  uiSourceCode;
  #eventListeners;
  #throttler;
  #terminated;
  #isAddingRevision;
  #isUpdatingHeaders;
  constructor(cssModel, project, header) {
    this.#cssModel = cssModel;
    this.#project = project;
    this.headers = /* @__PURE__ */ new Set([header]);
    const target = cssModel.target();
    const url = header.resourceURL();
    const metadata = metadataForURL(target, header.frameId, url);
    this.uiSourceCode = this.#project.createUISourceCode(url, header.contentType());
    uiSourceCodeToStyleMap.set(this.uiSourceCode, this);
    NetworkProject.setInitialFrameAttribution(this.uiSourceCode, header.frameId);
    this.#project.addUISourceCodeWithProvider(this.uiSourceCode, this, metadata, "text/css");
    this.#eventListeners = [
      this.uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.workingCopyChanged, this),
      this.uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this)
    ];
    this.#throttler = new Common.Throttler.Throttler(StyleFile.updateTimeout);
    this.#terminated = false;
  }
  addHeader(header) {
    this.headers.add(header);
    NetworkProject.addFrameAttribution(this.uiSourceCode, header.frameId);
  }
  removeHeader(header) {
    this.headers.delete(header);
    NetworkProject.removeFrameAttribution(this.uiSourceCode, header.frameId);
  }
  styleSheetChanged(header) {
    console.assert(this.headers.has(header));
    if (this.#isUpdatingHeaders || !this.headers.has(header)) {
      return;
    }
    const mirrorContentBound = this.mirrorContent.bind(this, header, true);
    void this.#throttler.schedule(mirrorContentBound, false);
  }
  workingCopyCommitted() {
    if (this.#isAddingRevision) {
      return;
    }
    const mirrorContentBound = this.mirrorContent.bind(this, this.uiSourceCode, true);
    void this.#throttler.schedule(mirrorContentBound, true);
  }
  workingCopyChanged() {
    if (this.#isAddingRevision) {
      return;
    }
    const mirrorContentBound = this.mirrorContent.bind(this, this.uiSourceCode, false);
    void this.#throttler.schedule(mirrorContentBound, false);
  }
  async mirrorContent(fromProvider, majorChange) {
    if (this.#terminated) {
      this.styleFileSyncedForTest();
      return;
    }
    let newContent = null;
    if (fromProvider === this.uiSourceCode) {
      newContent = this.uiSourceCode.workingCopy();
    } else {
      const deferredContent = await fromProvider.requestContent();
      newContent = deferredContent.content;
    }
    if (newContent === null || this.#terminated) {
      this.styleFileSyncedForTest();
      return;
    }
    if (fromProvider !== this.uiSourceCode) {
      this.#isAddingRevision = true;
      this.uiSourceCode.addRevision(newContent);
      this.#isAddingRevision = false;
    }
    this.#isUpdatingHeaders = true;
    const promises = [];
    for (const header of this.headers) {
      if (header === fromProvider) {
        continue;
      }
      promises.push(this.#cssModel.setStyleSheetText(header.id, newContent, majorChange));
    }
    await Promise.all(promises);
    this.#isUpdatingHeaders = false;
    this.styleFileSyncedForTest();
  }
  styleFileSyncedForTest() {
  }
  dispose() {
    if (this.#terminated) {
      return;
    }
    this.#terminated = true;
    this.#project.removeFile(this.uiSourceCode.url());
    Common.EventTarget.removeEventListeners(this.#eventListeners);
  }
  contentURL() {
    console.assert(this.headers.size > 0);
    return this.headers.values().next().value.originalContentProvider().contentURL();
  }
  contentType() {
    console.assert(this.headers.size > 0);
    return this.headers.values().next().value.originalContentProvider().contentType();
  }
  contentEncoded() {
    console.assert(this.headers.size > 0);
    return this.headers.values().next().value.originalContentProvider().contentEncoded();
  }
  requestContent() {
    console.assert(this.headers.size > 0);
    return this.headers.values().next().value.originalContentProvider().requestContent();
  }
  searchInContent(query, caseSensitive, isRegex) {
    console.assert(this.headers.size > 0);
    return this.headers.values().next().value.originalContentProvider().searchInContent(query, caseSensitive, isRegex);
  }
  static updateTimeout = 200;
  getHeaders() {
    return this.headers;
  }
  getUiSourceCode() {
    return this.uiSourceCode;
  }
}
//# sourceMappingURL=StylesSourceMapping.js.map
