import * as Common from "../../../../core/common/common.js";
import * as Host from "../../../../core/host/host.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import * as Platform from "../../../../core/platform/platform.js";
import * as SDK from "../../../../core/sdk/sdk.js";
import * as Bindings from "../../../../models/bindings/bindings.js";
import * as TextUtils from "../../../../models/text_utils/text_utils.js";
import * as Workspace from "../../../../models/workspace/workspace.js";
import * as UI from "../../legacy.js";
const UIStrings = {
  unknown: "(unknown)",
  auto: "auto",
  revealInS: "Reveal in {PH1}",
  reveal: "Reveal",
  openUsingS: "Open using {PH1}",
  linkHandling: "Link handling:"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/utils/Linkifier.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const instances = /* @__PURE__ */ new Set();
let decorator = null;
const anchorsByUISourceCode = /* @__PURE__ */ new WeakMap();
const infoByAnchor = /* @__PURE__ */ new WeakMap();
const textByAnchor = /* @__PURE__ */ new WeakMap();
const linkHandlers = /* @__PURE__ */ new Map();
let linkHandlerSettingInstance;
export class Linkifier {
  maxLength;
  anchorsByTarget;
  locationPoolByTarget;
  onLiveLocationUpdate;
  useLinkDecorator;
  constructor(maxLengthForDisplayedURLs, useLinkDecorator, onLiveLocationUpdate = () => {
  }) {
    this.maxLength = maxLengthForDisplayedURLs || UI.UIUtils.MaxLengthForDisplayedURLs;
    this.anchorsByTarget = /* @__PURE__ */ new Map();
    this.locationPoolByTarget = /* @__PURE__ */ new Map();
    this.onLiveLocationUpdate = onLiveLocationUpdate;
    this.useLinkDecorator = Boolean(useLinkDecorator);
    instances.add(this);
    SDK.TargetManager.TargetManager.instance().observeTargets(this);
  }
  static setLinkDecorator(linkDecorator) {
    console.assert(!decorator, "Cannot re-register link decorator.");
    decorator = linkDecorator;
    linkDecorator.addEventListener(LinkDecorator.Events.LinkIconChanged, onLinkIconChanged);
    for (const linkifier of instances) {
      linkifier.updateAllAnchorDecorations();
    }
    function onLinkIconChanged(event) {
      const uiSourceCode = event.data;
      const links = anchorsByUISourceCode.get(uiSourceCode) || [];
      for (const link of links) {
        Linkifier.updateLinkDecorations(link);
      }
    }
  }
  updateAllAnchorDecorations() {
    for (const anchors of this.anchorsByTarget.values()) {
      for (const anchor of anchors) {
        Linkifier.updateLinkDecorations(anchor);
      }
    }
  }
  static bindUILocation(anchor, uiLocation) {
    const linkInfo = Linkifier.linkInfo(anchor);
    if (!linkInfo) {
      return;
    }
    linkInfo.uiLocation = uiLocation;
    if (!uiLocation) {
      return;
    }
    const uiSourceCode = uiLocation.uiSourceCode;
    let sourceCodeAnchors = anchorsByUISourceCode.get(uiSourceCode);
    if (!sourceCodeAnchors) {
      sourceCodeAnchors = /* @__PURE__ */ new Set();
      anchorsByUISourceCode.set(uiSourceCode, sourceCodeAnchors);
    }
    sourceCodeAnchors.add(anchor);
  }
  static unbindUILocation(anchor) {
    const info = Linkifier.linkInfo(anchor);
    if (!info || !info.uiLocation) {
      return;
    }
    const uiSourceCode = info.uiLocation.uiSourceCode;
    info.uiLocation = null;
    const sourceCodeAnchors = anchorsByUISourceCode.get(uiSourceCode);
    if (sourceCodeAnchors) {
      sourceCodeAnchors.delete(anchor);
    }
  }
  targetAdded(target) {
    this.anchorsByTarget.set(target, []);
    this.locationPoolByTarget.set(target, new Bindings.LiveLocation.LiveLocationPool());
  }
  targetRemoved(target) {
    const locationPool = this.locationPoolByTarget.get(target);
    this.locationPoolByTarget.delete(target);
    if (!locationPool) {
      return;
    }
    locationPool.disposeAll();
    const anchors = this.anchorsByTarget.get(target);
    if (!anchors) {
      return;
    }
    this.anchorsByTarget.delete(target);
    for (const anchor of anchors) {
      const info = Linkifier.linkInfo(anchor);
      if (!info) {
        continue;
      }
      info.liveLocation = null;
      Linkifier.unbindUILocation(anchor);
      const fallback = info.fallback;
      if (fallback) {
        anchor.replaceWith(fallback);
      }
    }
  }
  maybeLinkifyScriptLocation(target, scriptId, sourceURL, lineNumber, options) {
    let fallbackAnchor = null;
    const linkifyURLOptions = {
      lineNumber,
      maxLength: this.maxLength,
      columnNumber: options?.columnNumber,
      showColumnNumber: Boolean(options?.showColumnNumber),
      className: options?.className,
      tabStop: options?.tabStop,
      inlineFrameIndex: options?.inlineFrameIndex ?? 0
    };
    const { columnNumber, className = "" } = linkifyURLOptions;
    if (sourceURL) {
      fallbackAnchor = Linkifier.linkifyURL(sourceURL, linkifyURLOptions);
    }
    if (!target || target.isDisposed()) {
      return fallbackAnchor;
    }
    const debuggerModel = target.model(SDK.DebuggerModel.DebuggerModel);
    if (!debuggerModel) {
      return fallbackAnchor;
    }
    const rawLocation = scriptId ? debuggerModel.createRawLocationByScriptId(scriptId, lineNumber || 0, columnNumber, linkifyURLOptions.inlineFrameIndex) : debuggerModel.createRawLocationByURL(sourceURL, lineNumber || 0, columnNumber, linkifyURLOptions.inlineFrameIndex);
    if (!rawLocation) {
      return fallbackAnchor;
    }
    const createLinkOptions = {
      tabStop: options?.tabStop
    };
    const { link, linkInfo } = Linkifier.createLink(fallbackAnchor && fallbackAnchor.textContent ? fallbackAnchor.textContent : "\u200B", className, createLinkOptions);
    linkInfo.enableDecorator = this.useLinkDecorator;
    linkInfo.fallback = fallbackAnchor;
    const pool = this.locationPoolByTarget.get(rawLocation.debuggerModel.target());
    if (!pool) {
      return fallbackAnchor;
    }
    const linkDisplayOptions = { showColumnNumber: linkifyURLOptions.showColumnNumber };
    const currentOnLiveLocationUpdate = this.onLiveLocationUpdate;
    void Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createLiveLocation(rawLocation, this.updateAnchor.bind(this, link, linkDisplayOptions), pool).then((liveLocation) => {
      if (liveLocation) {
        linkInfo.liveLocation = liveLocation;
        currentOnLiveLocationUpdate();
      }
    });
    const anchors = this.anchorsByTarget.get(rawLocation.debuggerModel.target());
    anchors.push(link);
    return link;
  }
  linkifyScriptLocation(target, scriptId, sourceURL, lineNumber, options) {
    const scriptLink = this.maybeLinkifyScriptLocation(target, scriptId, sourceURL, lineNumber, options);
    const linkifyURLOptions = {
      lineNumber,
      maxLength: this.maxLength,
      className: options?.className,
      columnNumber: options?.columnNumber,
      showColumnNumber: Boolean(options?.showColumnNumber),
      inlineFrameIndex: options?.inlineFrameIndex ?? 0,
      tabStop: options?.tabStop
    };
    return scriptLink || Linkifier.linkifyURL(sourceURL, linkifyURLOptions);
  }
  linkifyRawLocation(rawLocation, fallbackUrl, className) {
    return this.linkifyScriptLocation(rawLocation.debuggerModel.target(), rawLocation.scriptId, fallbackUrl, rawLocation.lineNumber, {
      columnNumber: rawLocation.columnNumber,
      className,
      inlineFrameIndex: rawLocation.inlineFrameIndex
    });
  }
  maybeLinkifyConsoleCallFrame(target, callFrame, options) {
    const linkifyOptions = {
      columnNumber: callFrame.columnNumber,
      showColumnNumber: Boolean(options?.showColumnNumber),
      inlineFrameIndex: options?.inlineFrameIndex ?? 0,
      tabStop: options?.tabStop,
      className: options?.className
    };
    return this.maybeLinkifyScriptLocation(target, callFrame.scriptId, callFrame.url, callFrame.lineNumber, linkifyOptions);
  }
  linkifyStackTraceTopFrame(target, stackTrace, className) {
    console.assert(stackTrace.callFrames.length > 0);
    const { url, lineNumber, columnNumber } = stackTrace.callFrames[0];
    const fallbackAnchor = Linkifier.linkifyURL(url, {
      className,
      lineNumber,
      columnNumber,
      showColumnNumber: false,
      inlineFrameIndex: 0,
      maxLength: this.maxLength,
      preventClick: true
    });
    const pool = this.locationPoolByTarget.get(target);
    if (!pool) {
      console.assert(target.isDisposed());
      return fallbackAnchor;
    }
    console.assert(!target.isDisposed());
    const debuggerModel = target.model(SDK.DebuggerModel.DebuggerModel);
    const { link, linkInfo } = Linkifier.createLink("\u200B", className ?? "");
    linkInfo.enableDecorator = this.useLinkDecorator;
    linkInfo.fallback = fallbackAnchor;
    const linkDisplayOptions = { showColumnNumber: false };
    const currentOnLiveLocationUpdate = this.onLiveLocationUpdate;
    void Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createStackTraceTopFrameLiveLocation(debuggerModel.createRawLocationsByStackTrace(stackTrace), this.updateAnchor.bind(this, link, linkDisplayOptions), pool).then((liveLocation) => {
      linkInfo.liveLocation = liveLocation;
      currentOnLiveLocationUpdate();
    });
    const anchors = this.anchorsByTarget.get(target);
    anchors.push(link);
    return link;
  }
  linkifyCSSLocation(rawLocation, classes) {
    const createLinkOptions = {
      tabStop: true
    };
    const { link, linkInfo } = Linkifier.createLink("\u200B", classes || "", createLinkOptions);
    linkInfo.enableDecorator = this.useLinkDecorator;
    const pool = this.locationPoolByTarget.get(rawLocation.cssModel().target());
    if (!pool) {
      return link;
    }
    const linkDisplayOptions = { showColumnNumber: false };
    const currentOnLiveLocationUpdate = this.onLiveLocationUpdate;
    void Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance().createLiveLocation(rawLocation, this.updateAnchor.bind(this, link, linkDisplayOptions), pool).then((liveLocation) => {
      linkInfo.liveLocation = liveLocation;
      currentOnLiveLocationUpdate();
    });
    const anchors = this.anchorsByTarget.get(rawLocation.cssModel().target());
    anchors.push(link);
    return link;
  }
  reset() {
    for (const target of [...this.anchorsByTarget.keys()]) {
      this.targetRemoved(target);
      this.targetAdded(target);
    }
  }
  dispose() {
    for (const target of [...this.anchorsByTarget.keys()]) {
      this.targetRemoved(target);
    }
    SDK.TargetManager.TargetManager.instance().unobserveTargets(this);
    instances.delete(this);
  }
  async updateAnchor(anchor, options, liveLocation) {
    Linkifier.unbindUILocation(anchor);
    const uiLocation = await liveLocation.uiLocation();
    if (!uiLocation) {
      if (liveLocation instanceof Bindings.CSSWorkspaceBinding.LiveLocation) {
        const header = liveLocation.header();
        if (header && header.ownerNode) {
          anchor.addEventListener("click", (event) => {
            event.consume(true);
            void Common.Revealer.reveal(header.ownerNode || null);
          }, false);
          Linkifier.setTrimmedText(anchor, "<style>");
        }
      }
      return;
    }
    Linkifier.bindUILocation(anchor, uiLocation);
    const text = uiLocation.linkText(true, options.showColumnNumber);
    Linkifier.setTrimmedText(anchor, text, this.maxLength);
    let titleText = uiLocation.uiSourceCode.url();
    if (uiLocation.uiSourceCode.mimeType() === "application/wasm") {
      if (typeof uiLocation.columnNumber === "number") {
        titleText += `:0x${uiLocation.columnNumber.toString(16)}`;
      }
    } else {
      titleText += ":" + (uiLocation.lineNumber + 1);
      if (options.showColumnNumber && typeof uiLocation.columnNumber === "number") {
        titleText += ":" + (uiLocation.columnNumber + 1);
      }
    }
    UI.Tooltip.Tooltip.install(anchor, titleText);
    anchor.classList.toggle("ignore-list-link", await liveLocation.isIgnoreListed());
    Linkifier.updateLinkDecorations(anchor);
  }
  setLiveLocationUpdateCallback(callback) {
    this.onLiveLocationUpdate = callback;
  }
  static updateLinkDecorations(anchor) {
    const info = Linkifier.linkInfo(anchor);
    if (!info || !info.enableDecorator) {
      return;
    }
    if (!decorator || !info.uiLocation) {
      return;
    }
    if (info.icon && info.icon.parentElement) {
      anchor.removeChild(info.icon);
    }
    const icon = decorator.linkIcon(info.uiLocation.uiSourceCode);
    if (icon) {
      icon.style.setProperty("margin-right", "2px");
      anchor.insertBefore(icon, anchor.firstChild);
    }
    info.icon = icon;
  }
  static linkifyURL(url, options) {
    options = options || {
      showColumnNumber: false,
      inlineFrameIndex: 0
    };
    const text = options.text;
    const className = options.className || "";
    const lineNumber = options.lineNumber;
    const columnNumber = options.columnNumber;
    const showColumnNumber = options.showColumnNumber;
    const preventClick = options.preventClick;
    const maxLength = options.maxLength || UI.UIUtils.MaxLengthForDisplayedURLs;
    const bypassURLTrimming = options.bypassURLTrimming;
    if (!url || url.trim().toLowerCase().startsWith("javascript:")) {
      const element = document.createElement("span");
      if (className) {
        element.className = className;
      }
      element.textContent = text || url || i18nString(UIStrings.unknown);
      return element;
    }
    let linkText = text || Bindings.ResourceUtils.displayNameForURL(url);
    if (typeof lineNumber === "number" && !text) {
      linkText += ":" + (lineNumber + 1);
      if (showColumnNumber && typeof columnNumber === "number") {
        linkText += ":" + (columnNumber + 1);
      }
    }
    const title = linkText !== url ? url : "";
    const linkOptions = { maxLength, title, href: url, preventClick, tabStop: options.tabStop, bypassURLTrimming };
    const { link, linkInfo } = Linkifier.createLink(linkText, className, linkOptions);
    if (lineNumber) {
      linkInfo.lineNumber = lineNumber;
    }
    if (columnNumber) {
      linkInfo.columnNumber = columnNumber;
    }
    return link;
  }
  static linkifyRevealable(revealable, text, fallbackHref, title, className) {
    const createLinkOptions = {
      maxLength: UI.UIUtils.MaxLengthForDisplayedURLs,
      href: fallbackHref,
      title
    };
    const { link, linkInfo } = Linkifier.createLink(text, className || "", createLinkOptions);
    linkInfo.revealable = revealable;
    return link;
  }
  static createLink(text, className, options = {}) {
    const { maxLength, title, href, preventClick, tabStop, bypassURLTrimming } = options;
    const link = document.createElement("span");
    if (className) {
      link.className = className;
    }
    link.classList.add("devtools-link");
    if (title) {
      UI.Tooltip.Tooltip.install(link, title);
    }
    if (href) {
      link.href = href;
    }
    if (text instanceof HTMLElement) {
      link.appendChild(text);
    } else {
      if (bypassURLTrimming) {
        link.classList.add("devtools-link-styled-trim");
        Linkifier.appendTextWithoutHashes(link, text);
      } else {
        Linkifier.setTrimmedText(link, text, maxLength);
      }
    }
    const linkInfo = {
      icon: null,
      enableDecorator: false,
      uiLocation: null,
      liveLocation: null,
      url: href || null,
      lineNumber: null,
      columnNumber: null,
      inlineFrameIndex: 0,
      revealable: null,
      fallback: null
    };
    infoByAnchor.set(link, linkInfo);
    if (!preventClick) {
      link.addEventListener("click", (event) => {
        if (Linkifier.handleClick(event)) {
          event.consume(true);
        }
      }, false);
      link.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && Linkifier.handleClick(event)) {
          event.consume(true);
        }
      }, false);
    } else {
      link.classList.add("devtools-link-prevent-click");
    }
    UI.ARIAUtils.markAsLink(link);
    link.tabIndex = tabStop ? 0 : -1;
    return { link, linkInfo };
  }
  static setTrimmedText(link, text, maxLength) {
    link.removeChildren();
    if (maxLength && text.length > maxLength) {
      const middleSplit = splitMiddle(text, maxLength);
      Linkifier.appendTextWithoutHashes(link, middleSplit[0]);
      Linkifier.appendHiddenText(link, middleSplit[1]);
      Linkifier.appendTextWithoutHashes(link, middleSplit[2]);
    } else {
      Linkifier.appendTextWithoutHashes(link, text);
    }
    function splitMiddle(string, maxLength2) {
      let leftIndex = Math.floor(maxLength2 / 2);
      let rightIndex = string.length - Math.ceil(maxLength2 / 2) + 1;
      const codePointAtRightIndex = string.codePointAt(rightIndex - 1);
      if (typeof codePointAtRightIndex !== "undefined" && codePointAtRightIndex >= 65536) {
        rightIndex++;
        leftIndex++;
      }
      const codePointAtLeftIndex = string.codePointAt(leftIndex - 1);
      if (typeof codePointAtLeftIndex !== "undefined" && leftIndex > 0 && codePointAtLeftIndex >= 65536) {
        leftIndex--;
      }
      return [string.substring(0, leftIndex), string.substring(leftIndex, rightIndex), string.substring(rightIndex)];
    }
  }
  static appendTextWithoutHashes(link, string) {
    const hashSplit = TextUtils.TextUtils.Utils.splitStringByRegexes(string, [/[a-f0-9]{20,}/g]);
    for (const match of hashSplit) {
      if (match.regexIndex === -1) {
        UI.UIUtils.createTextChild(link, match.value);
      } else {
        UI.UIUtils.createTextChild(link, match.value.substring(0, 7));
        Linkifier.appendHiddenText(link, match.value.substring(7));
      }
    }
  }
  static appendHiddenText(link, string) {
    const ellipsisNode = UI.UIUtils.createTextChild(link.createChild("span", "devtools-link-ellipsis"), "\u2026");
    textByAnchor.set(ellipsisNode, string);
  }
  static untruncatedNodeText(node) {
    return textByAnchor.get(node) || node.textContent || "";
  }
  static linkInfo(link) {
    return link ? infoByAnchor.get(link) || null : null;
  }
  static handleClick(event) {
    const link = event.currentTarget;
    if (UI.UIUtils.isBeingEdited(event.target) || link.hasSelection()) {
      return false;
    }
    const linkInfo = Linkifier.linkInfo(link);
    if (!linkInfo) {
      return false;
    }
    return Linkifier.invokeFirstAction(linkInfo);
  }
  static handleClickFromNewComponentLand(linkInfo) {
    Linkifier.invokeFirstAction(linkInfo);
  }
  static invokeFirstAction(linkInfo) {
    const actions = Linkifier.linkActions(linkInfo);
    if (actions.length) {
      void actions[0].handler.call(null);
      return true;
    }
    return false;
  }
  static linkHandlerSetting() {
    if (!linkHandlerSettingInstance) {
      linkHandlerSettingInstance = Common.Settings.Settings.instance().createSetting("openLinkHandler", i18nString(UIStrings.auto));
    }
    return linkHandlerSettingInstance;
  }
  static registerLinkHandler(title, handler) {
    linkHandlers.set(title, handler);
    LinkHandlerSettingUI.instance().update();
  }
  static unregisterLinkHandler(title) {
    linkHandlers.delete(title);
    LinkHandlerSettingUI.instance().update();
  }
  static uiLocation(link) {
    const info = Linkifier.linkInfo(link);
    return info ? info.uiLocation : null;
  }
  static linkActions(info) {
    const result = [];
    if (!info) {
      return result;
    }
    let url = Platform.DevToolsPath.EmptyUrlString;
    let uiLocation = null;
    if (info.uiLocation) {
      uiLocation = info.uiLocation;
      url = uiLocation.uiSourceCode.contentURL();
    } else if (info.url) {
      url = info.url;
      const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url) || Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(Common.ParsedURL.ParsedURL.urlWithoutHash(url));
      uiLocation = uiSourceCode ? uiSourceCode.uiLocation(info.lineNumber || 0, info.columnNumber || 0) : null;
    }
    const resource = url ? Bindings.ResourceUtils.resourceForURL(url) : null;
    const contentProvider = uiLocation ? uiLocation.uiSourceCode : resource;
    const revealable = info.revealable || uiLocation || resource;
    if (revealable) {
      const destination = Common.Revealer.revealDestination(revealable);
      result.push({
        section: "reveal",
        title: destination ? i18nString(UIStrings.revealInS, { PH1: destination }) : i18nString(UIStrings.reveal),
        handler: () => Common.Revealer.reveal(revealable)
      });
    }
    if (contentProvider) {
      const lineNumber = uiLocation ? uiLocation.lineNumber : info.lineNumber || 0;
      for (const title of linkHandlers.keys()) {
        const handler = linkHandlers.get(title);
        if (!handler) {
          continue;
        }
        const action = {
          section: "reveal",
          title: i18nString(UIStrings.openUsingS, { PH1: title }),
          handler: handler.bind(null, contentProvider, lineNumber)
        };
        if (title === Linkifier.linkHandlerSetting().get()) {
          result.unshift(action);
        } else {
          result.push(action);
        }
      }
    }
    if (resource || info.url) {
      result.push({
        section: "reveal",
        title: UI.UIUtils.openLinkExternallyLabel(),
        handler: () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(url)
      });
      result.push({
        section: "clipboard",
        title: UI.UIUtils.copyLinkAddressLabel(),
        handler: () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(url)
      });
    }
    if (uiLocation && uiLocation.uiSourceCode) {
      const contentProvider2 = uiLocation.uiSourceCode;
      result.push({
        section: "clipboard",
        title: UI.UIUtils.copyFileNameLabel(),
        handler: () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(contentProvider2.displayName())
      });
    }
    return result;
  }
}
export var LinkDecorator;
((LinkDecorator2) => {
  let Events;
  ((Events2) => {
    Events2["LinkIconChanged"] = "LinkIconChanged";
  })(Events = LinkDecorator2.Events || (LinkDecorator2.Events = {}));
})(LinkDecorator || (LinkDecorator = {}));
let linkContextMenuProviderInstance;
export class LinkContextMenuProvider {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!linkContextMenuProviderInstance || forceNew) {
      linkContextMenuProviderInstance = new LinkContextMenuProvider();
    }
    return linkContextMenuProviderInstance;
  }
  appendApplicableItems(event, contextMenu, target) {
    let targetNode = target;
    while (targetNode && !infoByAnchor.get(targetNode)) {
      targetNode = targetNode.parentNodeOrShadowHost();
    }
    const link = targetNode;
    const linkInfo = Linkifier.linkInfo(link);
    if (!linkInfo) {
      return;
    }
    const actions = Linkifier.linkActions(linkInfo);
    for (const action of actions) {
      contextMenu.section(action.section).appendItem(action.title, action.handler);
    }
  }
}
let linkHandlerSettingUIInstance;
export class LinkHandlerSettingUI {
  element;
  constructor() {
    this.element = document.createElement("select");
    this.element.classList.add("chrome-select");
    this.element.addEventListener("change", this.onChange.bind(this), false);
    this.update();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!linkHandlerSettingUIInstance || forceNew) {
      linkHandlerSettingUIInstance = new LinkHandlerSettingUI();
    }
    return linkHandlerSettingUIInstance;
  }
  update() {
    this.element.removeChildren();
    const names = [...linkHandlers.keys()];
    names.unshift(i18nString(UIStrings.auto));
    for (const name of names) {
      const option = document.createElement("option");
      option.textContent = name;
      option.selected = name === Linkifier.linkHandlerSetting().get();
      this.element.appendChild(option);
    }
    this.element.disabled = names.length <= 1;
  }
  onChange(event) {
    if (!event.target) {
      return;
    }
    const value = event.target.value;
    Linkifier.linkHandlerSetting().set(value);
  }
  settingElement() {
    return UI.SettingsUI.createCustomSetting(i18nString(UIStrings.linkHandling), this.element);
  }
}
let listeningToNewEvents = false;
function listenForNewComponentLinkifierEvents() {
  if (listeningToNewEvents) {
    return;
  }
  listeningToNewEvents = true;
  window.addEventListener("linkifieractivated", function(event) {
    const unknownEvent = event;
    const eventWithData = unknownEvent;
    Linkifier.handleClickFromNewComponentLand(eventWithData.data);
  });
}
listenForNewComponentLinkifierEvents();
let contentProviderContextMenuProviderInstance;
export class ContentProviderContextMenuProvider {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!contentProviderContextMenuProviderInstance || forceNew) {
      contentProviderContextMenuProviderInstance = new ContentProviderContextMenuProvider();
    }
    return contentProviderContextMenuProviderInstance;
  }
  appendApplicableItems(event, contextMenu, target) {
    const contentProvider = target;
    const contentUrl = contentProvider.contentURL();
    if (!contentUrl) {
      return;
    }
    contextMenu.revealSection().appendItem(UI.UIUtils.openLinkExternallyLabel(), () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(contentUrl.endsWith(":formatted") ? Common.ParsedURL.ParsedURL.slice(contentUrl, 0, contentUrl.lastIndexOf(":")) : contentUrl));
    for (const title of linkHandlers.keys()) {
      const handler = linkHandlers.get(title);
      if (!handler) {
        continue;
      }
      contextMenu.revealSection().appendItem(i18nString(UIStrings.openUsingS, { PH1: title }), handler.bind(null, contentProvider, 0));
    }
    if (contentProvider instanceof SDK.NetworkRequest.NetworkRequest) {
      return;
    }
    contextMenu.clipboardSection().appendItem(UI.UIUtils.copyLinkAddressLabel(), () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(contentUrl));
    contextMenu.clipboardSection().appendItem(UI.UIUtils.copyFileNameLabel(), () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(contentProvider.displayName()));
  }
}
//# sourceMappingURL=Linkifier.js.map
