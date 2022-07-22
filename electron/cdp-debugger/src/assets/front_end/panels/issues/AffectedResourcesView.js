import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Logs from "../../models/logs/logs.js";
import * as IconButton from "../../ui/components/icon_button/icon_button.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as RequestLinkIcon from "../../ui/components/request_link_icon/request_link_icon.js";
const UIStrings = {
  unknown: "unknown",
  clickToRevealTheFramesDomNodeIn: "Click to reveal the frame's DOM node in the Elements panel",
  unavailable: "unavailable"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/AffectedResourcesView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var AffectedItem = /* @__PURE__ */ ((AffectedItem2) => {
  AffectedItem2["Cookie"] = "Cookie";
  AffectedItem2["Directive"] = "Directive";
  AffectedItem2["Element"] = "Element";
  AffectedItem2["LearnMore"] = "LearnMore";
  AffectedItem2["Request"] = "Request";
  AffectedItem2["Source"] = "Source";
  return AffectedItem2;
})(AffectedItem || {});
export const extractShortPath = (path) => {
  return (/[^/]+$/.exec(path) || /[^/]+\/$/.exec(path) || [""])[0];
};
export class AffectedResourcesView extends UI.TreeOutline.TreeElement {
  #parentView;
  issue;
  affectedResourcesCountElement;
  affectedResources;
  #affectedResourcesCount;
  #frameListeners;
  #unresolvedFrameIds;
  requestResolver;
  constructor(parent, issue) {
    super();
    this.#parentView = parent;
    this.issue = issue;
    this.toggleOnClick = true;
    this.affectedResourcesCountElement = this.createAffectedResourcesCounter();
    this.affectedResources = this.createAffectedResources();
    this.#affectedResourcesCount = 0;
    this.requestResolver = new Logs.RequestResolver.RequestResolver();
    this.#frameListeners = [];
    this.#unresolvedFrameIds = /* @__PURE__ */ new Set();
  }
  setIssue(issue) {
    this.issue = issue;
  }
  createAffectedResourcesCounter() {
    const counterLabel = document.createElement("div");
    counterLabel.classList.add("affected-resource-label");
    this.listItemElement.appendChild(counterLabel);
    return counterLabel;
  }
  createAffectedResources() {
    const body = new UI.TreeOutline.TreeElement();
    const affectedResources = document.createElement("table");
    affectedResources.classList.add("affected-resource-list");
    body.listItemElement.appendChild(affectedResources);
    this.appendChild(body);
    return affectedResources;
  }
  updateAffectedResourceCount(count) {
    this.#affectedResourcesCount = count;
    this.affectedResourcesCountElement.textContent = this.getResourceNameWithCount(count);
    this.hidden = this.#affectedResourcesCount === 0;
    this.#parentView.updateAffectedResourceVisibility();
  }
  isEmpty() {
    return this.#affectedResourcesCount === 0;
  }
  clear() {
    this.affectedResources.textContent = "";
    this.requestResolver.clear();
  }
  expandIfOneResource() {
    if (this.#affectedResourcesCount === 1) {
      this.expand();
    }
  }
  #resolveFrameId(frameId) {
    const frame = SDK.FrameManager.FrameManager.instance().getFrame(frameId);
    if (!frame || !frame.url) {
      this.#unresolvedFrameIds.add(frameId);
      if (!this.#frameListeners.length) {
        const addListener = SDK.FrameManager.FrameManager.instance().addEventListener(SDK.FrameManager.Events.FrameAddedToTarget, this.#onFrameChanged, this);
        const navigateListener = SDK.FrameManager.FrameManager.instance().addEventListener(SDK.FrameManager.Events.FrameNavigated, this.#onFrameChanged, this);
        this.#frameListeners = [addListener, navigateListener];
      }
    }
    return frame;
  }
  #onFrameChanged(event) {
    const frame = event.data.frame;
    if (!frame.url) {
      return;
    }
    const frameWasUnresolved = this.#unresolvedFrameIds.delete(frame.id);
    if (this.#unresolvedFrameIds.size === 0 && this.#frameListeners.length) {
      Common.EventTarget.removeEventListeners(this.#frameListeners);
      this.#frameListeners = [];
    }
    if (frameWasUnresolved) {
      this.update();
    }
  }
  createFrameCell(frameId, issueCategory) {
    const frame = this.#resolveFrameId(frameId);
    const url = frame && (frame.unreachableUrl() || frame.url) || i18nString(UIStrings.unknown);
    const frameCell = document.createElement("td");
    frameCell.classList.add("affected-resource-cell");
    if (frame) {
      const icon = new IconButton.Icon.Icon();
      icon.data = { iconName: "elements_panel_icon", color: "var(--color-link)", width: "16px", height: "16px" };
      icon.classList.add("link", "elements-panel");
      icon.onclick = async () => {
        Host.userMetrics.issuesPanelResourceOpened(issueCategory, "Element" /* Element */);
        const frame2 = SDK.FrameManager.FrameManager.instance().getFrame(frameId);
        if (frame2) {
          const ownerNode = await frame2.getOwnerDOMNodeOrDocument();
          if (ownerNode) {
            void Common.Revealer.reveal(ownerNode);
          }
        }
      };
      icon.title = i18nString(UIStrings.clickToRevealTheFramesDomNodeIn);
      frameCell.appendChild(icon);
    }
    frameCell.appendChild(document.createTextNode(url));
    frameCell.onmouseenter = () => {
      const frame2 = SDK.FrameManager.FrameManager.instance().getFrame(frameId);
      if (frame2) {
        void frame2.highlight();
      }
    };
    frameCell.onmouseleave = () => SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
    return frameCell;
  }
  createRequestCell(affectedRequest, options = {}) {
    const requestCell = document.createElement("td");
    requestCell.classList.add("affected-resource-cell");
    const requestLinkIcon = new RequestLinkIcon.RequestLinkIcon.RequestLinkIcon();
    requestLinkIcon.data = { ...options, affectedRequest, requestResolver: this.requestResolver, displayURL: true };
    requestCell.appendChild(requestLinkIcon);
    return requestCell;
  }
  async createElementCell({ backendNodeId, nodeName, target }, issueCategory) {
    if (!target) {
      const cellElement2 = document.createElement("td");
      cellElement2.textContent = nodeName || i18nString(UIStrings.unavailable);
      return cellElement2;
    }
    function sendTelemetry() {
      Host.userMetrics.issuesPanelResourceOpened(issueCategory, "Element" /* Element */);
    }
    const deferredDOMNode = new SDK.DOMModel.DeferredDOMNode(target, backendNodeId);
    const anchorElement = await Common.Linkifier.Linkifier.linkify(deferredDOMNode);
    anchorElement.textContent = nodeName;
    anchorElement.addEventListener("click", () => sendTelemetry());
    anchorElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        sendTelemetry();
      }
    });
    const cellElement = document.createElement("td");
    cellElement.classList.add("affected-resource-element", "devtools-link");
    cellElement.appendChild(anchorElement);
    return cellElement;
  }
  appendSourceLocation(element, sourceLocation, target) {
    const sourceCodeLocation = document.createElement("td");
    sourceCodeLocation.classList.add("affected-source-location");
    if (sourceLocation) {
      const maxLengthForDisplayedURLs = 40;
      const linkifier = new Components.Linkifier.Linkifier(maxLengthForDisplayedURLs);
      const sourceAnchor = linkifier.linkifyScriptLocation(target || null, sourceLocation.scriptId || null, sourceLocation.url, sourceLocation.lineNumber, { columnNumber: sourceLocation.columnNumber, inlineFrameIndex: 0 });
      sourceCodeLocation.appendChild(sourceAnchor);
    }
    element.appendChild(sourceCodeLocation);
  }
  appendColumnTitle(header, title, additionalClass = null) {
    const info = document.createElement("td");
    info.classList.add("affected-resource-header");
    if (additionalClass) {
      info.classList.add(additionalClass);
    }
    info.textContent = title;
    header.appendChild(info);
  }
  createIssueDetailCell(textContent, additionalClass = null) {
    const cell = document.createElement("td");
    cell.textContent = textContent;
    if (additionalClass) {
      cell.classList.add(additionalClass);
    }
    return cell;
  }
  appendIssueDetailCell(element, textContent, additionalClass = null) {
    const cell = this.createIssueDetailCell(textContent, additionalClass);
    element.appendChild(cell);
    return cell;
  }
}
//# sourceMappingURL=AffectedResourcesView.js.map
