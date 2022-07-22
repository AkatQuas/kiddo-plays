import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Logs from "../../models/logs/logs.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import requestInitiatorViewStyles from "./requestInitiatorView.css.js";
import requestInitiatorViewTreeStyles from "./requestInitiatorViewTree.css.js";
const UIStrings = {
  thisRequestHasNoInitiatorData: "This request has no initiator data.",
  requestCallStack: "Request call stack",
  requestInitiatorChain: "Request initiator chain"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/RequestInitiatorView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RequestInitiatorView extends UI.Widget.VBox {
  linkifier;
  request;
  emptyWidget;
  hasShown;
  constructor(request) {
    super();
    this.element.classList.add("request-initiator-view");
    this.linkifier = new Components.Linkifier.Linkifier();
    this.request = request;
    this.emptyWidget = new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.thisRequestHasNoInitiatorData));
    this.emptyWidget.show(this.element);
    this.hasShown = false;
  }
  static createStackTracePreview(request, linkifier, focusableLink) {
    const initiator = request.initiator();
    if (!initiator || !initiator.stack) {
      return null;
    }
    const networkManager = SDK.NetworkManager.NetworkManager.forRequest(request);
    const target = networkManager ? networkManager.target() : null;
    const stackTrace = Components.JSPresentationUtils.buildStackTracePreviewContents(target, linkifier, { stackTrace: initiator.stack, tabStops: focusableLink });
    return stackTrace;
  }
  createTree() {
    const treeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    treeOutline.registerCSSFiles([requestInitiatorViewTreeStyles]);
    treeOutline.contentElement.classList.add("request-initiator-view-tree");
    return treeOutline;
  }
  buildRequestChainTree(initiatorGraph, title, tree) {
    const root = new UI.TreeOutline.TreeElement(title);
    tree.appendChild(root);
    if (root.titleElement instanceof HTMLElement) {
      root.titleElement.classList.add("request-initiator-view-section-title");
    }
    const initiators = initiatorGraph.initiators;
    let parent = root;
    for (const request of Array.from(initiators).reverse()) {
      const treeElement = new UI.TreeOutline.TreeElement(request.url());
      parent.appendChild(treeElement);
      parent.expand();
      parent = treeElement;
    }
    root.expand();
    parent.select();
    const titleElement = parent.titleElement;
    if (titleElement instanceof HTMLElement) {
      titleElement.style.fontWeight = "bold";
    }
    const initiated = initiatorGraph.initiated;
    this.depthFirstSearchTreeBuilder(initiated, parent, this.request);
    return root;
  }
  depthFirstSearchTreeBuilder(initiated, parentElement, parentRequest) {
    const visited = /* @__PURE__ */ new Set();
    visited.add(this.request);
    for (const request of initiated.keys()) {
      if (initiated.get(request) === parentRequest) {
        const treeElement = new UI.TreeOutline.TreeElement(request.url());
        parentElement.appendChild(treeElement);
        parentElement.expand();
        if (!visited.has(request)) {
          visited.add(request);
          this.depthFirstSearchTreeBuilder(initiated, treeElement, request);
        }
      }
    }
  }
  buildStackTraceSection(content, title, tree) {
    const root = new UI.TreeOutline.TreeElement(title);
    tree.appendChild(root);
    if (root.titleElement instanceof HTMLElement) {
      root.titleElement.classList.add("request-initiator-view-section-title");
    }
    const contentElement = new UI.TreeOutline.TreeElement(content, false);
    contentElement.selectable = false;
    root.appendChild(contentElement);
    root.expand();
  }
  wasShown() {
    if (this.hasShown) {
      return;
    }
    this.registerCSSFiles([requestInitiatorViewStyles]);
    let initiatorDataPresent = false;
    const containerTree = this.createTree();
    const stackTracePreview = RequestInitiatorView.createStackTracePreview(this.request, this.linkifier, true);
    if (stackTracePreview) {
      initiatorDataPresent = true;
      this.buildStackTraceSection(stackTracePreview.element, i18nString(UIStrings.requestCallStack), containerTree);
    }
    const initiatorGraph = Logs.NetworkLog.NetworkLog.instance().initiatorGraphForRequest(this.request);
    if (initiatorGraph.initiators.size > 1 || initiatorGraph.initiated.size > 1) {
      initiatorDataPresent = true;
      this.buildRequestChainTree(initiatorGraph, i18nString(UIStrings.requestInitiatorChain), containerTree);
    }
    const firstChild = containerTree.firstChild();
    if (firstChild) {
      firstChild.select(true);
    }
    if (initiatorDataPresent) {
      this.element.appendChild(containerTree.element);
      this.emptyWidget.hideWidget();
    }
    this.hasShown = true;
  }
}
//# sourceMappingURL=RequestInitiatorView.js.map
