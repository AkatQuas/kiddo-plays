import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as Platform from "../platform/platform.js";
import { CSSFontFace } from "./CSSFontFace.js";
import { CSSMatchedStyles } from "./CSSMatchedStyles.js";
import { CSSMedia } from "./CSSMedia.js";
import { CSSStyleRule } from "./CSSRule.js";
import { CSSStyleDeclaration, Type } from "./CSSStyleDeclaration.js";
import { CSSStyleSheetHeader } from "./CSSStyleSheetHeader.js";
import { DOMModel } from "./DOMModel.js";
import { Events as ResourceTreeModelEvents, ResourceTreeModel } from "./ResourceTreeModel.js";
import { Capability } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
import { SourceMapManager } from "./SourceMapManager.js";
export class CSSModel extends SDKModel {
  agent;
  #domModel;
  #fontFaces;
  #originalStyleSheetText;
  #resourceTreeModel;
  #sourceMapManager;
  #styleLoader;
  #stylePollingThrottler;
  #styleSheetIdsForURL;
  #styleSheetIdToHeader;
  #cachedMatchedCascadeNode;
  #cachedMatchedCascadePromise;
  #cssPropertyTracker;
  #isCSSPropertyTrackingEnabled;
  #isEnabled;
  #isRuleUsageTrackingEnabled;
  #isTrackingRequestPending;
  constructor(target) {
    super(target);
    this.#isEnabled = false;
    this.#cachedMatchedCascadeNode = null;
    this.#cachedMatchedCascadePromise = null;
    this.#domModel = target.model(DOMModel);
    this.#sourceMapManager = new SourceMapManager(target);
    this.agent = target.cssAgent();
    this.#styleLoader = new ComputedStyleLoader(this);
    this.#resourceTreeModel = target.model(ResourceTreeModel);
    if (this.#resourceTreeModel) {
      this.#resourceTreeModel.addEventListener(ResourceTreeModelEvents.MainFrameNavigated, this.onMainFrameNavigated, this);
    }
    target.registerCSSDispatcher(new CSSDispatcher(this));
    if (!target.suspended()) {
      void this.enable();
    }
    this.#styleSheetIdToHeader = /* @__PURE__ */ new Map();
    this.#styleSheetIdsForURL = /* @__PURE__ */ new Map();
    this.#originalStyleSheetText = /* @__PURE__ */ new Map();
    this.#isRuleUsageTrackingEnabled = false;
    this.#fontFaces = /* @__PURE__ */ new Map();
    this.#cssPropertyTracker = null;
    this.#isCSSPropertyTrackingEnabled = false;
    this.#isTrackingRequestPending = false;
    this.#stylePollingThrottler = new Common.Throttler.Throttler(StylePollingInterval);
    this.#sourceMapManager.setEnabled(Common.Settings.Settings.instance().moduleSetting("cssSourceMapsEnabled").get());
    Common.Settings.Settings.instance().moduleSetting("cssSourceMapsEnabled").addChangeListener((event) => this.#sourceMapManager.setEnabled(event.data));
  }
  headersForSourceURL(sourceURL) {
    const headers = [];
    for (const headerId of this.getStyleSheetIdsForURL(sourceURL)) {
      const header = this.styleSheetHeaderForId(headerId);
      if (header) {
        headers.push(header);
      }
    }
    return headers;
  }
  createRawLocationsByURL(sourceURL, lineNumber, columnNumber = 0) {
    const headers = this.headersForSourceURL(sourceURL);
    headers.sort(stylesheetComparator);
    const endIndex = Platform.ArrayUtilities.upperBound(headers, void 0, (_, header) => lineNumber - header.startLine || columnNumber - header.startColumn);
    if (!endIndex) {
      return [];
    }
    const locations = [];
    const last = headers[endIndex - 1];
    for (let index = endIndex - 1; index >= 0 && headers[index].startLine === last.startLine && headers[index].startColumn === last.startColumn; --index) {
      if (headers[index].containsLocation(lineNumber, columnNumber)) {
        locations.push(new CSSLocation(headers[index], lineNumber, columnNumber));
      }
    }
    return locations;
    function stylesheetComparator(a, b) {
      return a.startLine - b.startLine || a.startColumn - b.startColumn || a.id.localeCompare(b.id);
    }
  }
  sourceMapManager() {
    return this.#sourceMapManager;
  }
  static readableLayerName(text) {
    return text || "<anonymous>";
  }
  static trimSourceURL(text) {
    let sourceURLIndex = text.lastIndexOf("/*# sourceURL=");
    if (sourceURLIndex === -1) {
      sourceURLIndex = text.lastIndexOf("/*@ sourceURL=");
      if (sourceURLIndex === -1) {
        return text;
      }
    }
    const sourceURLLineIndex = text.lastIndexOf("\n", sourceURLIndex);
    if (sourceURLLineIndex === -1) {
      return text;
    }
    const sourceURLLine = text.substr(sourceURLLineIndex + 1).split("\n", 1)[0];
    const sourceURLRegex = /[\040\t]*\/\*[#@] sourceURL=[\040\t]*([^\s]*)[\040\t]*\*\/[\040\t]*$/;
    if (sourceURLLine.search(sourceURLRegex) === -1) {
      return text;
    }
    return text.substr(0, sourceURLLineIndex) + text.substr(sourceURLLineIndex + sourceURLLine.length + 1);
  }
  domModel() {
    return this.#domModel;
  }
  async setStyleText(styleSheetId, range, text, majorChange) {
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { styles } = await this.agent.invoke_setStyleTexts({ edits: [{ styleSheetId, range: range.serializeToObject(), text }] });
      if (!styles || styles.length !== 1) {
        return false;
      }
      this.#domModel.markUndoableState(!majorChange);
      const edit = new Edit(styleSheetId, range, text, styles[0]);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return true;
    } catch (e) {
      return false;
    }
  }
  async setSelectorText(styleSheetId, range, text) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.StyleRuleEdited);
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { selectorList } = await this.agent.invoke_setRuleSelector({ styleSheetId, range, selector: text });
      if (!selectorList) {
        return false;
      }
      this.#domModel.markUndoableState();
      const edit = new Edit(styleSheetId, range, text, selectorList);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return true;
    } catch (e) {
      return false;
    }
  }
  async setKeyframeKey(styleSheetId, range, text) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.StyleRuleEdited);
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { keyText } = await this.agent.invoke_setKeyframeKey({ styleSheetId, range, keyText: text });
      if (!keyText) {
        return false;
      }
      this.#domModel.markUndoableState();
      const edit = new Edit(styleSheetId, range, text, keyText);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return true;
    } catch (e) {
      return false;
    }
  }
  startCoverage() {
    this.#isRuleUsageTrackingEnabled = true;
    return this.agent.invoke_startRuleUsageTracking();
  }
  async takeCoverageDelta() {
    const r = await this.agent.invoke_takeCoverageDelta();
    const timestamp = r && r.timestamp || 0;
    const coverage = r && r.coverage || [];
    return { timestamp, coverage };
  }
  setLocalFontsEnabled(enabled) {
    return this.agent.invoke_setLocalFontsEnabled({
      enabled
    });
  }
  async stopCoverage() {
    this.#isRuleUsageTrackingEnabled = false;
    await this.agent.invoke_stopRuleUsageTracking();
  }
  async getMediaQueries() {
    const { medias } = await this.agent.invoke_getMediaQueries();
    return medias ? CSSMedia.parseMediaArrayPayload(this, medias) : [];
  }
  async getRootLayer(nodeId) {
    const { rootLayer } = await this.agent.invoke_getLayersForNode({ nodeId });
    return rootLayer;
  }
  isEnabled() {
    return this.#isEnabled;
  }
  async enable() {
    await this.agent.invoke_enable();
    this.#isEnabled = true;
    if (this.#isRuleUsageTrackingEnabled) {
      await this.startCoverage();
    }
    this.dispatchEventToListeners(Events.ModelWasEnabled);
  }
  async getMatchedStyles(nodeId) {
    const response = await this.agent.invoke_getMatchedStylesForNode({ nodeId });
    if (response.getError()) {
      return null;
    }
    const node = this.#domModel.nodeForId(nodeId);
    if (!node) {
      return null;
    }
    return new CSSMatchedStyles(this, node, response.inlineStyle || null, response.attributesStyle || null, response.matchedCSSRules || [], response.pseudoElements || [], response.inherited || [], response.inheritedPseudoElements || [], response.cssKeyframesRules || []);
  }
  async getClassNames(styleSheetId) {
    const { classNames } = await this.agent.invoke_collectClassNames({ styleSheetId });
    return classNames || [];
  }
  getComputedStyle(nodeId) {
    return this.#styleLoader.computedStylePromise(nodeId);
  }
  async getBackgroundColors(nodeId) {
    const response = await this.agent.invoke_getBackgroundColors({ nodeId });
    if (response.getError()) {
      return null;
    }
    return {
      backgroundColors: response.backgroundColors || null,
      computedFontSize: response.computedFontSize || "",
      computedFontWeight: response.computedFontWeight || ""
    };
  }
  async getPlatformFonts(nodeId) {
    const { fonts } = await this.agent.invoke_getPlatformFontsForNode({ nodeId });
    return fonts;
  }
  allStyleSheets() {
    const values = [...this.#styleSheetIdToHeader.values()];
    function styleSheetComparator(a, b) {
      if (a.sourceURL < b.sourceURL) {
        return -1;
      }
      if (a.sourceURL > b.sourceURL) {
        return 1;
      }
      return a.startLine - b.startLine || a.startColumn - b.startColumn;
    }
    values.sort(styleSheetComparator);
    return values;
  }
  async getInlineStyles(nodeId) {
    const response = await this.agent.invoke_getInlineStylesForNode({ nodeId });
    if (response.getError() || !response.inlineStyle) {
      return null;
    }
    const inlineStyle = new CSSStyleDeclaration(this, null, response.inlineStyle, Type.Inline);
    const attributesStyle = response.attributesStyle ? new CSSStyleDeclaration(this, null, response.attributesStyle, Type.Attributes) : null;
    return new InlineStyleResult(inlineStyle, attributesStyle);
  }
  forcePseudoState(node, pseudoClass, enable) {
    const forcedPseudoClasses = node.marker(PseudoStateMarker) || [];
    const hasPseudoClass = forcedPseudoClasses.includes(pseudoClass);
    if (enable) {
      if (hasPseudoClass) {
        return false;
      }
      forcedPseudoClasses.push(pseudoClass);
      node.setMarker(PseudoStateMarker, forcedPseudoClasses);
    } else {
      if (!hasPseudoClass) {
        return false;
      }
      Platform.ArrayUtilities.removeElement(forcedPseudoClasses, pseudoClass);
      if (forcedPseudoClasses.length) {
        node.setMarker(PseudoStateMarker, forcedPseudoClasses);
      } else {
        node.setMarker(PseudoStateMarker, null);
      }
    }
    if (node.id === void 0) {
      return false;
    }
    void this.agent.invoke_forcePseudoState({ nodeId: node.id, forcedPseudoClasses });
    this.dispatchEventToListeners(Events.PseudoStateForced, { node, pseudoClass, enable });
    return true;
  }
  pseudoState(node) {
    return node.marker(PseudoStateMarker) || [];
  }
  async setMediaText(styleSheetId, range, newMediaText) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.StyleRuleEdited);
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { media } = await this.agent.invoke_setMediaText({ styleSheetId, range, text: newMediaText });
      if (!media) {
        return false;
      }
      this.#domModel.markUndoableState();
      const edit = new Edit(styleSheetId, range, newMediaText, media);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return true;
    } catch (e) {
      return false;
    }
  }
  async setContainerQueryText(styleSheetId, range, newContainerQueryText) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.StyleRuleEdited);
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { containerQuery } = await this.agent.invoke_setContainerQueryText({ styleSheetId, range, text: newContainerQueryText });
      if (!containerQuery) {
        return false;
      }
      this.#domModel.markUndoableState();
      const edit = new Edit(styleSheetId, range, newContainerQueryText, containerQuery);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return true;
    } catch (e) {
      return false;
    }
  }
  async setSupportsText(styleSheetId, range, newSupportsText) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.StyleRuleEdited);
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { supports } = await this.agent.invoke_setSupportsText({ styleSheetId, range, text: newSupportsText });
      if (!supports) {
        return false;
      }
      this.#domModel.markUndoableState();
      const edit = new Edit(styleSheetId, range, newSupportsText, supports);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return true;
    } catch (e) {
      return false;
    }
  }
  async addRule(styleSheetId, ruleText, ruleLocation) {
    try {
      await this.ensureOriginalStyleSheetText(styleSheetId);
      const { rule } = await this.agent.invoke_addRule({ styleSheetId, ruleText, location: ruleLocation });
      if (!rule) {
        return null;
      }
      this.#domModel.markUndoableState();
      const edit = new Edit(styleSheetId, ruleLocation, ruleText, rule);
      this.fireStyleSheetChanged(styleSheetId, edit);
      return new CSSStyleRule(this, rule);
    } catch (e) {
      return null;
    }
  }
  async requestViaInspectorStylesheet(node) {
    const frameId = node.frameId() || (this.#resourceTreeModel && this.#resourceTreeModel.mainFrame ? this.#resourceTreeModel.mainFrame.id : null);
    const headers = [...this.#styleSheetIdToHeader.values()];
    const styleSheetHeader = headers.find((header) => header.frameId === frameId && header.isViaInspector());
    if (styleSheetHeader) {
      return styleSheetHeader;
    }
    if (!frameId) {
      return null;
    }
    try {
      const { styleSheetId } = await this.agent.invoke_createStyleSheet({ frameId });
      if (!styleSheetId) {
        return null;
      }
      return this.#styleSheetIdToHeader.get(styleSheetId) || null;
    } catch (e) {
      return null;
    }
  }
  mediaQueryResultChanged() {
    this.dispatchEventToListeners(Events.MediaQueryResultChanged);
  }
  fontsUpdated(fontFace) {
    if (fontFace) {
      this.#fontFaces.set(fontFace.src, new CSSFontFace(fontFace));
    }
    this.dispatchEventToListeners(Events.FontsUpdated);
  }
  fontFaces() {
    return [...this.#fontFaces.values()];
  }
  fontFaceForSource(src) {
    return this.#fontFaces.get(src);
  }
  styleSheetHeaderForId(id) {
    return this.#styleSheetIdToHeader.get(id) || null;
  }
  styleSheetHeaders() {
    return [...this.#styleSheetIdToHeader.values()];
  }
  fireStyleSheetChanged(styleSheetId, edit) {
    this.dispatchEventToListeners(Events.StyleSheetChanged, { styleSheetId, edit });
  }
  ensureOriginalStyleSheetText(styleSheetId) {
    const header = this.styleSheetHeaderForId(styleSheetId);
    if (!header) {
      return Promise.resolve(null);
    }
    let promise = this.#originalStyleSheetText.get(header);
    if (!promise) {
      promise = this.getStyleSheetText(header.id);
      this.#originalStyleSheetText.set(header, promise);
      this.originalContentRequestedForTest(header);
    }
    return promise;
  }
  originalContentRequestedForTest(_header) {
  }
  originalStyleSheetText(header) {
    return this.ensureOriginalStyleSheetText(header.id);
  }
  getAllStyleSheetHeaders() {
    return this.#styleSheetIdToHeader.values();
  }
  styleSheetAdded(header) {
    console.assert(!this.#styleSheetIdToHeader.get(header.styleSheetId));
    const styleSheetHeader = new CSSStyleSheetHeader(this, header);
    this.#styleSheetIdToHeader.set(header.styleSheetId, styleSheetHeader);
    const url = styleSheetHeader.resourceURL();
    let frameIdToStyleSheetIds = this.#styleSheetIdsForURL.get(url);
    if (!frameIdToStyleSheetIds) {
      frameIdToStyleSheetIds = /* @__PURE__ */ new Map();
      this.#styleSheetIdsForURL.set(url, frameIdToStyleSheetIds);
    }
    if (frameIdToStyleSheetIds) {
      let styleSheetIds = frameIdToStyleSheetIds.get(styleSheetHeader.frameId);
      if (!styleSheetIds) {
        styleSheetIds = /* @__PURE__ */ new Set();
        frameIdToStyleSheetIds.set(styleSheetHeader.frameId, styleSheetIds);
      }
      styleSheetIds.add(styleSheetHeader.id);
    }
    this.#sourceMapManager.attachSourceMap(styleSheetHeader, styleSheetHeader.sourceURL, styleSheetHeader.sourceMapURL);
    this.dispatchEventToListeners(Events.StyleSheetAdded, styleSheetHeader);
  }
  styleSheetRemoved(id) {
    const header = this.#styleSheetIdToHeader.get(id);
    console.assert(Boolean(header));
    if (!header) {
      return;
    }
    this.#styleSheetIdToHeader.delete(id);
    const url = header.resourceURL();
    const frameIdToStyleSheetIds = this.#styleSheetIdsForURL.get(url);
    console.assert(Boolean(frameIdToStyleSheetIds), "No frameId to styleSheetId map is available for given style sheet URL.");
    if (frameIdToStyleSheetIds) {
      const stylesheetIds = frameIdToStyleSheetIds.get(header.frameId);
      if (stylesheetIds) {
        stylesheetIds.delete(id);
        if (!stylesheetIds.size) {
          frameIdToStyleSheetIds.delete(header.frameId);
          if (!frameIdToStyleSheetIds.size) {
            this.#styleSheetIdsForURL.delete(url);
          }
        }
      }
    }
    this.#originalStyleSheetText.delete(header);
    this.#sourceMapManager.detachSourceMap(header);
    this.dispatchEventToListeners(Events.StyleSheetRemoved, header);
  }
  getStyleSheetIdsForURL(url) {
    const frameIdToStyleSheetIds = this.#styleSheetIdsForURL.get(url);
    if (!frameIdToStyleSheetIds) {
      return [];
    }
    const result = [];
    for (const styleSheetIds of frameIdToStyleSheetIds.values()) {
      result.push(...styleSheetIds);
    }
    return result;
  }
  async setStyleSheetText(styleSheetId, newText, majorChange) {
    const header = this.#styleSheetIdToHeader.get(styleSheetId);
    if (!header) {
      return "Unknown stylesheet in CSS.setStyleSheetText";
    }
    newText = CSSModel.trimSourceURL(newText);
    if (header.hasSourceURL) {
      newText += "\n/*# sourceURL=" + header.sourceURL + " */";
    }
    await this.ensureOriginalStyleSheetText(styleSheetId);
    const response = await this.agent.invoke_setStyleSheetText({ styleSheetId: header.id, text: newText });
    const sourceMapURL = response.sourceMapURL;
    this.#sourceMapManager.detachSourceMap(header);
    header.setSourceMapURL(sourceMapURL);
    this.#sourceMapManager.attachSourceMap(header, header.sourceURL, header.sourceMapURL);
    if (sourceMapURL === null) {
      return "Error in CSS.setStyleSheetText";
    }
    this.#domModel.markUndoableState(!majorChange);
    this.fireStyleSheetChanged(styleSheetId);
    return null;
  }
  async getStyleSheetText(styleSheetId) {
    try {
      const { text } = await this.agent.invoke_getStyleSheetText({ styleSheetId });
      return text && CSSModel.trimSourceURL(text);
    } catch (e) {
      return null;
    }
  }
  async onMainFrameNavigated(event) {
    if (event.data.backForwardCacheDetails.restoredFromCache) {
      await this.suspendModel();
      await this.resumeModel();
    } else {
      this.resetStyleSheets();
      this.resetFontFaces();
    }
  }
  resetStyleSheets() {
    const headers = [...this.#styleSheetIdToHeader.values()];
    this.#styleSheetIdsForURL.clear();
    this.#styleSheetIdToHeader.clear();
    for (const header of headers) {
      this.#sourceMapManager.detachSourceMap(header);
      this.dispatchEventToListeners(Events.StyleSheetRemoved, header);
    }
  }
  resetFontFaces() {
    this.#fontFaces.clear();
  }
  async suspendModel() {
    this.#isEnabled = false;
    await this.agent.invoke_disable();
    this.resetStyleSheets();
    this.resetFontFaces();
  }
  async resumeModel() {
    return this.enable();
  }
  setEffectivePropertyValueForNode(nodeId, propertyName, value) {
    void this.agent.invoke_setEffectivePropertyValueForNode({ nodeId, propertyName, value });
  }
  cachedMatchedCascadeForNode(node) {
    if (this.#cachedMatchedCascadeNode !== node) {
      this.discardCachedMatchedCascade();
    }
    this.#cachedMatchedCascadeNode = node;
    if (!this.#cachedMatchedCascadePromise) {
      if (node.id) {
        this.#cachedMatchedCascadePromise = this.getMatchedStyles(node.id);
      } else {
        return Promise.resolve(null);
      }
    }
    return this.#cachedMatchedCascadePromise;
  }
  discardCachedMatchedCascade() {
    this.#cachedMatchedCascadeNode = null;
    this.#cachedMatchedCascadePromise = null;
  }
  createCSSPropertyTracker(propertiesToTrack) {
    const cssPropertyTracker = new CSSPropertyTracker(this, propertiesToTrack);
    return cssPropertyTracker;
  }
  enableCSSPropertyTracker(cssPropertyTracker) {
    const propertiesToTrack = cssPropertyTracker.getTrackedProperties();
    if (propertiesToTrack.length === 0) {
      return;
    }
    void this.agent.invoke_trackComputedStyleUpdates({ propertiesToTrack });
    this.#isCSSPropertyTrackingEnabled = true;
    this.#cssPropertyTracker = cssPropertyTracker;
    void this.pollComputedStyleUpdates();
  }
  disableCSSPropertyTracker() {
    this.#isCSSPropertyTrackingEnabled = false;
    this.#cssPropertyTracker = null;
    void this.agent.invoke_trackComputedStyleUpdates({ propertiesToTrack: [] });
  }
  async pollComputedStyleUpdates() {
    if (this.#isTrackingRequestPending) {
      return;
    }
    if (this.#isCSSPropertyTrackingEnabled) {
      this.#isTrackingRequestPending = true;
      const result = await this.agent.invoke_takeComputedStyleUpdates();
      this.#isTrackingRequestPending = false;
      if (result.getError() || !result.nodeIds || !this.#isCSSPropertyTrackingEnabled) {
        return;
      }
      if (this.#cssPropertyTracker) {
        this.#cssPropertyTracker.dispatchEventToListeners(CSSPropertyTrackerEvents.TrackedCSSPropertiesUpdated, result.nodeIds.map((nodeId) => this.#domModel.nodeForId(nodeId)));
      }
    }
    if (this.#isCSSPropertyTrackingEnabled) {
      void this.#stylePollingThrottler.schedule(this.pollComputedStyleUpdates.bind(this));
    }
  }
  dispose() {
    this.disableCSSPropertyTracker();
    super.dispose();
    this.#sourceMapManager.dispose();
  }
  getAgent() {
    return this.agent;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["FontsUpdated"] = "FontsUpdated";
  Events2["MediaQueryResultChanged"] = "MediaQueryResultChanged";
  Events2["ModelWasEnabled"] = "ModelWasEnabled";
  Events2["PseudoStateForced"] = "PseudoStateForced";
  Events2["StyleSheetAdded"] = "StyleSheetAdded";
  Events2["StyleSheetChanged"] = "StyleSheetChanged";
  Events2["StyleSheetRemoved"] = "StyleSheetRemoved";
  return Events2;
})(Events || {});
const PseudoStateMarker = "pseudo-state-marker";
export class Edit {
  styleSheetId;
  oldRange;
  newRange;
  newText;
  payload;
  constructor(styleSheetId, oldRange, newText, payload) {
    this.styleSheetId = styleSheetId;
    this.oldRange = oldRange;
    this.newRange = TextUtils.TextRange.TextRange.fromEdit(oldRange, newText);
    this.newText = newText;
    this.payload = payload;
  }
}
export class CSSLocation {
  #cssModelInternal;
  styleSheetId;
  url;
  lineNumber;
  columnNumber;
  constructor(header, lineNumber, columnNumber) {
    this.#cssModelInternal = header.cssModel();
    this.styleSheetId = header.id;
    this.url = header.resourceURL();
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber || 0;
  }
  cssModel() {
    return this.#cssModelInternal;
  }
  header() {
    return this.#cssModelInternal.styleSheetHeaderForId(this.styleSheetId);
  }
}
class CSSDispatcher {
  #cssModel;
  constructor(cssModel) {
    this.#cssModel = cssModel;
  }
  mediaQueryResultChanged() {
    this.#cssModel.mediaQueryResultChanged();
  }
  fontsUpdated({ font }) {
    this.#cssModel.fontsUpdated(font);
  }
  styleSheetChanged({ styleSheetId }) {
    this.#cssModel.fireStyleSheetChanged(styleSheetId);
  }
  styleSheetAdded({ header }) {
    this.#cssModel.styleSheetAdded(header);
  }
  styleSheetRemoved({ styleSheetId }) {
    this.#cssModel.styleSheetRemoved(styleSheetId);
  }
}
class ComputedStyleLoader {
  #cssModel;
  #nodeIdToPromise;
  constructor(cssModel) {
    this.#cssModel = cssModel;
    this.#nodeIdToPromise = /* @__PURE__ */ new Map();
  }
  computedStylePromise(nodeId) {
    let promise = this.#nodeIdToPromise.get(nodeId);
    if (promise) {
      return promise;
    }
    promise = this.#cssModel.getAgent().invoke_getComputedStyleForNode({ nodeId }).then(({ computedStyle }) => {
      this.#nodeIdToPromise.delete(nodeId);
      if (!computedStyle || !computedStyle.length) {
        return null;
      }
      const result = /* @__PURE__ */ new Map();
      for (const property of computedStyle) {
        result.set(property.name, property.value);
      }
      return result;
    });
    this.#nodeIdToPromise.set(nodeId, promise);
    return promise;
  }
}
export class InlineStyleResult {
  inlineStyle;
  attributesStyle;
  constructor(inlineStyle, attributesStyle) {
    this.inlineStyle = inlineStyle;
    this.attributesStyle = attributesStyle;
  }
}
export class CSSPropertyTracker extends Common.ObjectWrapper.ObjectWrapper {
  #cssModel;
  #properties;
  constructor(cssModel, propertiesToTrack) {
    super();
    this.#cssModel = cssModel;
    this.#properties = propertiesToTrack;
  }
  start() {
    this.#cssModel.enableCSSPropertyTracker(this);
  }
  stop() {
    this.#cssModel.disableCSSPropertyTracker();
  }
  getTrackedProperties() {
    return this.#properties;
  }
}
const StylePollingInterval = 1e3;
export var CSSPropertyTrackerEvents = /* @__PURE__ */ ((CSSPropertyTrackerEvents2) => {
  CSSPropertyTrackerEvents2["TrackedCSSPropertiesUpdated"] = "TrackedCSSPropertiesUpdated";
  return CSSPropertyTrackerEvents2;
})(CSSPropertyTrackerEvents || {});
SDKModel.register(CSSModel, { capabilities: Capability.DOM, autostart: true });
//# sourceMappingURL=CSSModel.js.map
