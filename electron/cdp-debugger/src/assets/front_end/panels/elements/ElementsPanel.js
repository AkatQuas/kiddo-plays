import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Extensions from "../../models/extensions/extensions.js";
import elementsPanelStyles from "./elementsPanel.css.js";
import * as Buttons from "../../ui/components/buttons/buttons.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import { AccessibilityTreeView } from "./AccessibilityTreeView.js";
import * as ElementsComponents from "./components/components.js";
import { ComputedStyleWidget } from "./ComputedStyleWidget.js";
import { ElementsTreeElementHighlighter } from "./ElementsTreeElementHighlighter.js";
import { ElementsTreeOutline } from "./ElementsTreeOutline.js";
import { MetricsSidebarPane } from "./MetricsSidebarPane.js";
import { Events as StylesSidebarPaneEvents, StylesSidebarPane } from "./StylesSidebarPane.js";
const UIStrings = {
  findByStringSelectorOrXpath: "Find by string, selector, or `XPath`",
  switchToAccessibilityTreeView: "Switch to Accessibility Tree view",
  switchToDomTreeView: "Switch to DOM Tree view",
  frame: "Frame",
  showComputedStylesSidebar: "Show Computed Styles sidebar",
  hideComputedStylesSidebar: "Hide Computed Styles sidebar",
  computedStylesShown: "Computed Styles sidebar shown",
  computedStylesHidden: "Computed Styles sidebar hidden",
  computed: "Computed",
  styles: "Styles",
  revealInElementsPanel: "Reveal in Elements panel",
  nodeCannotBeFoundInTheCurrent: "Node cannot be found in the current page.",
  theRemoteObjectCouldNotBe: "The remote object could not be resolved to a valid node.",
  theDeferredDomNodeCouldNotBe: "The deferred `DOM` Node could not be resolved to a valid node.",
  elementStateS: "Element state: {PH1}",
  sidePanelToolbar: "Side panel toolbar",
  sidePanelContent: "Side panel content",
  domTreeExplorer: "DOM tree explorer"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/ElementsPanel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var SidebarPaneTabId = /* @__PURE__ */ ((SidebarPaneTabId2) => {
  SidebarPaneTabId2["Computed"] = "Computed";
  SidebarPaneTabId2["Styles"] = "Styles";
  return SidebarPaneTabId2;
})(SidebarPaneTabId || {});
const createAccessibilityTreeToggleButton = (isActive) => {
  const button = new Buttons.Button.Button();
  const title = isActive ? i18nString(UIStrings.switchToDomTreeView) : i18nString(UIStrings.switchToAccessibilityTreeView);
  button.data = {
    active: isActive,
    variant: Buttons.Button.Variant.TOOLBAR,
    iconUrl: new URL("../../Images/accessibility-icon.svg", import.meta.url).toString(),
    title
  };
  button.tabIndex = 0;
  button.classList.add("axtree-button");
  if (isActive) {
    button.classList.add("active");
  }
  return button;
};
let elementsPanelInstance;
export class ElementsPanel extends UI.Panel.Panel {
  splitWidget;
  searchableViewInternal;
  mainContainer;
  domTreeContainer;
  splitMode;
  accessibilityTreeView;
  breadcrumbs;
  stylesWidget;
  computedStyleWidget;
  metricsWidget;
  treeOutlines = /* @__PURE__ */ new Set();
  treeOutlineHeaders = /* @__PURE__ */ new Map();
  searchResults;
  currentSearchResultIndex;
  pendingNodeReveal;
  adornerManager;
  adornerSettingsPane;
  adornersByName;
  accessibilityTreeButton;
  domTreeButton;
  selectedNodeOnReset;
  hasNonDefaultSelectedNode;
  searchConfig;
  omitDefaultSelection;
  notFirstInspectElement;
  sidebarPaneView;
  stylesViewToReveal;
  cssStyleTrackerByCSSModel;
  constructor() {
    super("elements");
    this.splitWidget = new UI.SplitWidget.SplitWidget(true, true, "elementsPanelSplitViewState", 325, 325);
    this.splitWidget.addEventListener(UI.SplitWidget.Events.SidebarSizeChanged, this.updateTreeOutlineVisibleWidth.bind(this));
    this.splitWidget.show(this.element);
    this.searchableViewInternal = new UI.SearchableView.SearchableView(this, null);
    this.searchableViewInternal.setMinimumSize(25, 28);
    this.searchableViewInternal.setPlaceholder(i18nString(UIStrings.findByStringSelectorOrXpath));
    const stackElement = this.searchableViewInternal.element;
    this.mainContainer = document.createElement("div");
    this.domTreeContainer = document.createElement("div");
    const crumbsContainer = document.createElement("div");
    if (Root.Runtime.experiments.isEnabled("fullAccessibilityTree")) {
      this.initializeFullAccessibilityTreeView();
    }
    this.mainContainer.appendChild(this.domTreeContainer);
    stackElement.appendChild(this.mainContainer);
    stackElement.appendChild(crumbsContainer);
    UI.ARIAUtils.markAsMain(this.domTreeContainer);
    UI.ARIAUtils.setAccessibleName(this.domTreeContainer, i18nString(UIStrings.domTreeExplorer));
    this.splitWidget.setMainWidget(this.searchableViewInternal);
    this.splitMode = null;
    this.mainContainer.id = "main-content";
    this.domTreeContainer.id = "elements-content";
    if (Common.Settings.Settings.instance().moduleSetting("domWordWrap").get()) {
      this.domTreeContainer.classList.add("elements-wrap");
    }
    Common.Settings.Settings.instance().moduleSetting("domWordWrap").addChangeListener(this.domWordWrapSettingChanged.bind(this));
    crumbsContainer.id = "elements-crumbs";
    if (this.domTreeButton) {
      this.accessibilityTreeView = new AccessibilityTreeView(this.domTreeButton);
    }
    this.breadcrumbs = new ElementsComponents.ElementsBreadcrumbs.ElementsBreadcrumbs();
    this.breadcrumbs.addEventListener("breadcrumbsnodeselected", (event) => {
      this.crumbNodeSelected(event);
    });
    crumbsContainer.appendChild(this.breadcrumbs);
    this.stylesWidget = StylesSidebarPane.instance();
    this.computedStyleWidget = new ComputedStyleWidget();
    this.metricsWidget = new MetricsSidebarPane();
    Common.Settings.Settings.instance().moduleSetting("sidebarPosition").addChangeListener(this.updateSidebarPosition.bind(this));
    this.updateSidebarPosition();
    this.cssStyleTrackerByCSSModel = /* @__PURE__ */ new Map();
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.DOMModel.DOMModel, this);
    SDK.TargetManager.TargetManager.instance().addEventListener(SDK.TargetManager.Events.NameChanged, (event) => this.targetNameChanged(event.data));
    Common.Settings.Settings.instance().moduleSetting("showUAShadowDOM").addChangeListener(this.showUAShadowDOMChanged.bind(this));
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMModel.DOMModel, SDK.DOMModel.Events.DocumentUpdated, this.documentUpdatedEvent, this);
    Extensions.ExtensionServer.ExtensionServer.instance().addEventListener(Extensions.ExtensionServer.Events.SidebarPaneAdded, this.extensionSidebarPaneAdded, this);
    this.currentSearchResultIndex = -1;
    this.pendingNodeReveal = false;
    this.adornerManager = new ElementsComponents.AdornerManager.AdornerManager(Common.Settings.Settings.instance().moduleSetting("adornerSettings"));
    this.adornerSettingsPane = null;
    this.adornersByName = /* @__PURE__ */ new Map();
  }
  initializeFullAccessibilityTreeView() {
    this.accessibilityTreeButton = createAccessibilityTreeToggleButton(false);
    this.accessibilityTreeButton.addEventListener("click", this.showAccessibilityTree.bind(this));
    this.domTreeButton = createAccessibilityTreeToggleButton(true);
    this.domTreeButton.addEventListener("click", this.showDOMTree.bind(this));
    this.mainContainer.appendChild(this.accessibilityTreeButton);
  }
  showAccessibilityTree() {
    if (this.accessibilityTreeView) {
      this.splitWidget.setMainWidget(this.accessibilityTreeView);
    }
  }
  showDOMTree() {
    this.splitWidget.setMainWidget(this.searchableViewInternal);
    const selectedNode = this.selectedDOMNode();
    if (!selectedNode) {
      return;
    }
    const treeElement = this.treeElementForNode(selectedNode);
    if (!treeElement) {
      return;
    }
    treeElement.select();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!elementsPanelInstance || forceNew) {
      elementsPanelInstance = new ElementsPanel();
    }
    return elementsPanelInstance;
  }
  revealProperty(cssProperty) {
    if (!this.sidebarPaneView || !this.stylesViewToReveal) {
      return Promise.resolve();
    }
    return this.sidebarPaneView.showView(this.stylesViewToReveal).then(() => {
      this.stylesWidget.revealProperty(cssProperty);
    });
  }
  resolveLocation(_locationName) {
    return this.sidebarPaneView || null;
  }
  showToolbarPane(widget, toggle) {
    this.stylesWidget.showToolbarPane(widget, toggle);
  }
  modelAdded(domModel) {
    const parentModel = domModel.parentModel();
    let treeOutline = parentModel ? ElementsTreeOutline.forDOMModel(parentModel) : null;
    if (!treeOutline) {
      treeOutline = new ElementsTreeOutline(true, true);
      treeOutline.setWordWrap(Common.Settings.Settings.instance().moduleSetting("domWordWrap").get());
      treeOutline.addEventListener(ElementsTreeOutline.Events.SelectedNodeChanged, this.selectedNodeChanged, this);
      treeOutline.addEventListener(ElementsTreeOutline.Events.ElementsTreeUpdated, this.updateBreadcrumbIfNeeded, this);
      new ElementsTreeElementHighlighter(treeOutline);
      this.treeOutlines.add(treeOutline);
      if (domModel.target().parentTarget()) {
        const element = document.createElement("div");
        element.classList.add("elements-tree-header");
        this.treeOutlineHeaders.set(treeOutline, element);
        this.targetNameChanged(domModel.target());
      }
    }
    treeOutline.wireToDOMModel(domModel);
    this.setupStyleTracking(domModel.cssModel());
    if (this.isShowing()) {
      this.wasShown();
    }
  }
  modelRemoved(domModel) {
    const treeOutline = ElementsTreeOutline.forDOMModel(domModel);
    if (!treeOutline) {
      return;
    }
    treeOutline.unwireFromDOMModel(domModel);
    if (domModel.parentModel()) {
      return;
    }
    this.treeOutlines.delete(treeOutline);
    const header = this.treeOutlineHeaders.get(treeOutline);
    if (header) {
      header.remove();
    }
    this.treeOutlineHeaders.delete(treeOutline);
    treeOutline.element.remove();
    this.removeStyleTracking(domModel.cssModel());
  }
  targetNameChanged(target) {
    const domModel = target.model(SDK.DOMModel.DOMModel);
    if (!domModel) {
      return;
    }
    const treeOutline = ElementsTreeOutline.forDOMModel(domModel);
    if (!treeOutline) {
      return;
    }
    const header = this.treeOutlineHeaders.get(treeOutline);
    if (!header) {
      return;
    }
    header.removeChildren();
    header.createChild("div", "elements-tree-header-frame").textContent = i18nString(UIStrings.frame);
    header.appendChild(Components.Linkifier.Linkifier.linkifyURL(target.inspectedURL(), { text: target.name() }));
  }
  updateTreeOutlineVisibleWidth() {
    if (!this.treeOutlines.size) {
      return;
    }
    let width = this.splitWidget.element.offsetWidth;
    if (this.splitWidget.isVertical()) {
      width -= this.splitWidget.sidebarSize();
    }
    for (const treeOutline of this.treeOutlines) {
      treeOutline.setVisibleWidth(width);
    }
  }
  focus() {
    if (this.treeOutlines.size) {
      this.treeOutlines.values().next().value.focus();
    }
  }
  searchableView() {
    return this.searchableViewInternal;
  }
  wasShown() {
    super.wasShown();
    UI.Context.Context.instance().setFlavor(ElementsPanel, this);
    this.registerCSSFiles([elementsPanelStyles]);
    for (const treeOutline of this.treeOutlines) {
      if (treeOutline.element.parentElement !== this.domTreeContainer) {
        const header = this.treeOutlineHeaders.get(treeOutline);
        if (header) {
          this.domTreeContainer.appendChild(header);
        }
        this.domTreeContainer.appendChild(treeOutline.element);
      }
    }
    const domModels = SDK.TargetManager.TargetManager.instance().models(SDK.DOMModel.DOMModel);
    for (const domModel of domModels) {
      if (domModel.parentModel()) {
        continue;
      }
      const treeOutline = ElementsTreeOutline.forDOMModel(domModel);
      if (!treeOutline) {
        continue;
      }
      treeOutline.setVisible(true);
      if (!treeOutline.rootDOMNode) {
        if (domModel.existingDocument()) {
          treeOutline.rootDOMNode = domModel.existingDocument();
          this.documentUpdated(domModel);
        } else {
          void domModel.requestDocument();
        }
      }
    }
  }
  willHide() {
    SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
    for (const treeOutline of this.treeOutlines) {
      treeOutline.setVisible(false);
      this.domTreeContainer.removeChild(treeOutline.element);
      const header = this.treeOutlineHeaders.get(treeOutline);
      if (header) {
        this.domTreeContainer.removeChild(header);
      }
    }
    super.willHide();
    UI.Context.Context.instance().setFlavor(ElementsPanel, null);
  }
  onResize() {
    this.element.window().requestAnimationFrame(this.updateSidebarPosition.bind(this));
    this.updateTreeOutlineVisibleWidth();
  }
  selectedNodeChanged(event) {
    let selectedNode = event.data.node;
    if (selectedNode && (selectedNode.pseudoType() && !selectedNode.parentNode)) {
      selectedNode = null;
    }
    const { focus } = event.data;
    for (const treeOutline of this.treeOutlines) {
      if (!selectedNode || ElementsTreeOutline.forDOMModel(selectedNode.domModel()) !== treeOutline) {
        treeOutline.selectDOMNode(null);
      }
    }
    if (selectedNode) {
      const activeNode = ElementsComponents.Helper.legacyNodeToElementsComponentsNode(selectedNode);
      const crumbs = [activeNode];
      for (let current = selectedNode.parentNode; current; current = current.parentNode) {
        crumbs.push(ElementsComponents.Helper.legacyNodeToElementsComponentsNode(current));
      }
      this.breadcrumbs.data = {
        crumbs,
        selectedNode: ElementsComponents.Helper.legacyNodeToElementsComponentsNode(selectedNode)
      };
      if (this.accessibilityTreeView) {
        void this.accessibilityTreeView.selectedNodeChanged(selectedNode);
      }
    } else {
      this.breadcrumbs.data = { crumbs: [], selectedNode: null };
    }
    UI.Context.Context.instance().setFlavor(SDK.DOMModel.DOMNode, selectedNode);
    if (!selectedNode) {
      return;
    }
    void selectedNode.setAsInspectedNode();
    if (focus) {
      this.selectedNodeOnReset = selectedNode;
      this.hasNonDefaultSelectedNode = true;
    }
    const executionContexts = selectedNode.domModel().runtimeModel().executionContexts();
    const nodeFrameId = selectedNode.frameId();
    for (const context of executionContexts) {
      if (context.frameId === nodeFrameId) {
        UI.Context.Context.instance().setFlavor(SDK.RuntimeModel.ExecutionContext, context);
        break;
      }
    }
  }
  documentUpdatedEvent(event) {
    const domModel = event.data;
    this.documentUpdated(domModel);
    this.removeStyleTracking(domModel.cssModel());
    this.setupStyleTracking(domModel.cssModel());
  }
  documentUpdated(domModel) {
    this.searchableViewInternal.resetSearch();
    if (!domModel.existingDocument()) {
      if (this.isShowing()) {
        void domModel.requestDocument();
      }
      return;
    }
    this.hasNonDefaultSelectedNode = false;
    if (this.omitDefaultSelection) {
      return;
    }
    const savedSelectedNodeOnReset = this.selectedNodeOnReset;
    void restoreNode.call(this, domModel, this.selectedNodeOnReset || null);
    async function restoreNode(domModel2, staleNode) {
      const nodePath = staleNode ? staleNode.path() : null;
      const restoredNodeId = nodePath ? await domModel2.pushNodeByPathToFrontend(nodePath) : null;
      if (savedSelectedNodeOnReset !== this.selectedNodeOnReset) {
        return;
      }
      let node = restoredNodeId ? domModel2.nodeForId(restoredNodeId) : null;
      if (!node) {
        const inspectedDocument = domModel2.existingDocument();
        node = inspectedDocument ? inspectedDocument.body || inspectedDocument.documentElement : null;
      }
      if (node) {
        this.setDefaultSelectedNode(node);
        this.lastSelectedNodeSelectedForTest();
      }
    }
  }
  lastSelectedNodeSelectedForTest() {
  }
  setDefaultSelectedNode(node) {
    if (!node || this.hasNonDefaultSelectedNode || this.pendingNodeReveal) {
      return;
    }
    const treeOutline = ElementsTreeOutline.forDOMModel(node.domModel());
    if (!treeOutline) {
      return;
    }
    this.selectDOMNode(node);
    if (treeOutline.selectedTreeElement) {
      treeOutline.selectedTreeElement.expand();
    }
  }
  searchCanceled() {
    this.searchConfig = void 0;
    this.hideSearchHighlights();
    this.searchableViewInternal.updateSearchMatchesCount(0);
    this.currentSearchResultIndex = -1;
    delete this.searchResults;
    SDK.DOMModel.DOMModel.cancelSearch();
  }
  performSearch(searchConfig, shouldJump, jumpBackwards) {
    const query = searchConfig.query;
    const whitespaceTrimmedQuery = query.trim();
    if (!whitespaceTrimmedQuery.length) {
      return;
    }
    if (!this.searchConfig || this.searchConfig.query !== query) {
      this.searchCanceled();
    } else {
      this.hideSearchHighlights();
    }
    this.searchConfig = searchConfig;
    const showUAShadowDOM = Common.Settings.Settings.instance().moduleSetting("showUAShadowDOM").get();
    const domModels = SDK.TargetManager.TargetManager.instance().models(SDK.DOMModel.DOMModel);
    const promises = domModels.map((domModel) => domModel.performSearch(whitespaceTrimmedQuery, showUAShadowDOM));
    void Promise.all(promises).then((resultCounts) => {
      this.searchResults = [];
      for (let i = 0; i < resultCounts.length; ++i) {
        const resultCount = resultCounts[i];
        for (let j = 0; j < resultCount; ++j) {
          this.searchResults.push({ domModel: domModels[i], index: j, node: void 0 });
        }
      }
      this.searchableViewInternal.updateSearchMatchesCount(this.searchResults.length);
      if (!this.searchResults.length) {
        return;
      }
      if (this.currentSearchResultIndex >= this.searchResults.length) {
        this.currentSearchResultIndex = -1;
      }
      let index = this.currentSearchResultIndex;
      if (shouldJump) {
        if (this.currentSearchResultIndex === -1) {
          index = jumpBackwards ? -1 : 0;
        } else {
          index = jumpBackwards ? index - 1 : index + 1;
        }
        this.jumpToSearchResult(index);
      }
    });
  }
  domWordWrapSettingChanged(event) {
    this.domTreeContainer.classList.toggle("elements-wrap", event.data);
    for (const treeOutline of this.treeOutlines) {
      treeOutline.setWordWrap(event.data);
    }
  }
  switchToAndFocus(node) {
    this.searchableViewInternal.cancelSearch();
    void UI.ViewManager.ViewManager.instance().showView("elements").then(() => this.selectDOMNode(node, true));
  }
  jumpToSearchResult(index) {
    if (!this.searchResults) {
      return;
    }
    this.currentSearchResultIndex = (index + this.searchResults.length) % this.searchResults.length;
    this.highlightCurrentSearchResult();
  }
  jumpToNextSearchResult() {
    if (!this.searchResults || !this.searchConfig) {
      return;
    }
    this.performSearch(this.searchConfig, true);
  }
  jumpToPreviousSearchResult() {
    if (!this.searchResults || !this.searchConfig) {
      return;
    }
    this.performSearch(this.searchConfig, true, true);
  }
  supportsCaseSensitiveSearch() {
    return false;
  }
  supportsRegexSearch() {
    return false;
  }
  highlightCurrentSearchResult() {
    const index = this.currentSearchResultIndex;
    const searchResults = this.searchResults;
    if (!searchResults) {
      return;
    }
    const searchResult = searchResults[index];
    this.searchableViewInternal.updateCurrentMatchIndex(index);
    if (searchResult.node === null) {
      return;
    }
    if (typeof searchResult.node === "undefined") {
      void searchResult.domModel.searchResult(searchResult.index).then((node) => {
        searchResult.node = node;
        const highlightRequestValid = this.searchConfig && this.searchResults && this.currentSearchResultIndex !== -1;
        if (highlightRequestValid) {
          this.highlightCurrentSearchResult();
        }
      });
      return;
    }
    const treeElement = this.treeElementForNode(searchResult.node);
    void searchResult.node.scrollIntoView();
    if (treeElement) {
      this.searchConfig && treeElement.highlightSearchResults(this.searchConfig.query);
      treeElement.reveal();
      const matches = treeElement.listItemElement.getElementsByClassName(UI.UIUtils.highlightedSearchResultClassName);
      if (matches.length) {
        matches[0].scrollIntoViewIfNeeded(false);
      }
    }
  }
  hideSearchHighlights() {
    if (!this.searchResults || !this.searchResults.length || this.currentSearchResultIndex === -1) {
      return;
    }
    const searchResult = this.searchResults[this.currentSearchResultIndex];
    if (!searchResult.node) {
      return;
    }
    const treeElement = this.treeElementForNode(searchResult.node);
    if (treeElement) {
      treeElement.hideSearchHighlights();
    }
  }
  selectedDOMNode() {
    for (const treeOutline of this.treeOutlines) {
      if (treeOutline.selectedDOMNode()) {
        return treeOutline.selectedDOMNode();
      }
    }
    return null;
  }
  selectDOMNode(node, focus) {
    for (const treeOutline of this.treeOutlines) {
      const outline = ElementsTreeOutline.forDOMModel(node.domModel());
      if (outline === treeOutline) {
        treeOutline.selectDOMNode(node, focus);
      } else {
        treeOutline.selectDOMNode(null);
      }
    }
  }
  updateBreadcrumbIfNeeded(event) {
    const nodes = event.data;
    const selectedNode = this.selectedDOMNode();
    if (!selectedNode) {
      this.breadcrumbs.data = {
        crumbs: [],
        selectedNode: null
      };
      return;
    }
    const activeNode = ElementsComponents.Helper.legacyNodeToElementsComponentsNode(selectedNode);
    const existingCrumbs = [activeNode];
    for (let current = selectedNode.parentNode; current; current = current.parentNode) {
      existingCrumbs.push(ElementsComponents.Helper.legacyNodeToElementsComponentsNode(current));
    }
    const newNodes = nodes.map(ElementsComponents.Helper.legacyNodeToElementsComponentsNode);
    const nodesThatHaveChangedMap = /* @__PURE__ */ new Map();
    newNodes.forEach((crumb) => nodesThatHaveChangedMap.set(crumb.id, crumb));
    const newSetOfCrumbs = existingCrumbs.map((crumb) => {
      const replacement = nodesThatHaveChangedMap.get(crumb.id);
      return replacement || crumb;
    });
    this.breadcrumbs.data = {
      crumbs: newSetOfCrumbs,
      selectedNode: activeNode
    };
  }
  crumbNodeSelected(event) {
    this.selectDOMNode(event.legacyDomNode, true);
  }
  treeOutlineForNode(node) {
    if (!node) {
      return null;
    }
    return ElementsTreeOutline.forDOMModel(node.domModel());
  }
  treeElementForNode(node) {
    const treeOutline = this.treeOutlineForNode(node);
    if (!treeOutline) {
      return null;
    }
    return treeOutline.findTreeElement(node);
  }
  leaveUserAgentShadowDOM(node) {
    let userAgentShadowRoot;
    while ((userAgentShadowRoot = node.ancestorUserAgentShadowRoot()) && userAgentShadowRoot.parentNode) {
      node = userAgentShadowRoot.parentNode;
    }
    return node;
  }
  async revealAndSelectNode(nodeToReveal, focus, omitHighlight) {
    this.omitDefaultSelection = true;
    const node = Common.Settings.Settings.instance().moduleSetting("showUAShadowDOM").get() ? nodeToReveal : this.leaveUserAgentShadowDOM(nodeToReveal);
    if (!omitHighlight) {
      node.highlightForTwoSeconds();
    }
    if (this.accessibilityTreeView) {
      void this.accessibilityTreeView.revealAndSelectNode(nodeToReveal);
    }
    await UI.ViewManager.ViewManager.instance().showView("elements", false, !focus);
    this.selectDOMNode(node, focus);
    delete this.omitDefaultSelection;
    if (!this.notFirstInspectElement) {
      ElementsPanel.firstInspectElementNodeNameForTest = node.nodeName();
      ElementsPanel.firstInspectElementCompletedForTest();
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.inspectElementCompleted();
    }
    this.notFirstInspectElement = true;
  }
  showUAShadowDOMChanged() {
    for (const treeOutline of this.treeOutlines) {
      treeOutline.update();
    }
  }
  setupTextSelectionHack(stylePaneWrapperElement) {
    const uninstallHackBound = uninstallHack.bind(this);
    const uninstallHackOnMousemove = (event) => {
      if (event.buttons === 0) {
        uninstallHack.call(this);
      }
    };
    stylePaneWrapperElement.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      this.splitWidget.element.classList.add("disable-resizer-for-elements-hack");
      stylePaneWrapperElement.style.setProperty("height", `${stylePaneWrapperElement.offsetHeight}px`);
      const largeLength = 1e6;
      stylePaneWrapperElement.style.setProperty("left", `${-1 * largeLength}px`);
      stylePaneWrapperElement.style.setProperty("padding-left", `${largeLength}px`);
      stylePaneWrapperElement.style.setProperty("width", `calc(100% + ${largeLength}px)`);
      stylePaneWrapperElement.style.setProperty("position", "absolute");
      stylePaneWrapperElement.window().addEventListener("blur", uninstallHackBound);
      stylePaneWrapperElement.window().addEventListener("contextmenu", uninstallHackBound, true);
      stylePaneWrapperElement.window().addEventListener("dragstart", uninstallHackBound, true);
      stylePaneWrapperElement.window().addEventListener("mousemove", uninstallHackOnMousemove, true);
      stylePaneWrapperElement.window().addEventListener("mouseup", uninstallHackBound, true);
      stylePaneWrapperElement.window().addEventListener("visibilitychange", uninstallHackBound);
    }, true);
    function uninstallHack() {
      this.splitWidget.element.classList.remove("disable-resizer-for-elements-hack");
      stylePaneWrapperElement.style.removeProperty("left");
      stylePaneWrapperElement.style.removeProperty("padding-left");
      stylePaneWrapperElement.style.removeProperty("width");
      stylePaneWrapperElement.style.removeProperty("position");
      stylePaneWrapperElement.window().removeEventListener("blur", uninstallHackBound);
      stylePaneWrapperElement.window().removeEventListener("contextmenu", uninstallHackBound, true);
      stylePaneWrapperElement.window().removeEventListener("dragstart", uninstallHackBound, true);
      stylePaneWrapperElement.window().removeEventListener("mousemove", uninstallHackOnMousemove, true);
      stylePaneWrapperElement.window().removeEventListener("mouseup", uninstallHackBound, true);
      stylePaneWrapperElement.window().removeEventListener("visibilitychange", uninstallHackBound);
    }
  }
  initializeSidebarPanes(splitMode) {
    this.splitWidget.setVertical(splitMode === _splitMode.Vertical);
    this.showToolbarPane(null, null);
    const matchedStylePanesWrapper = new UI.Widget.VBox();
    matchedStylePanesWrapper.element.classList.add("style-panes-wrapper");
    this.stylesWidget.show(matchedStylePanesWrapper.element);
    this.setupTextSelectionHack(matchedStylePanesWrapper.element);
    const computedStylePanesWrapper = new UI.Widget.VBox();
    computedStylePanesWrapper.element.classList.add("style-panes-wrapper");
    this.computedStyleWidget.show(computedStylePanesWrapper.element);
    const stylesSplitWidget = new UI.SplitWidget.SplitWidget(true, true, "elements.styles.sidebar.width", 100);
    stylesSplitWidget.setMainWidget(matchedStylePanesWrapper);
    stylesSplitWidget.hideSidebar();
    stylesSplitWidget.enableShowModeSaving();
    stylesSplitWidget.addEventListener(UI.SplitWidget.Events.ShowModeChanged, () => {
      showMetricsWidgetInStylesPane();
    });
    this.stylesWidget.addEventListener(StylesSidebarPaneEvents.InitialUpdateCompleted, () => {
      this.stylesWidget.appendToolbarItem(stylesSplitWidget.createShowHideSidebarButton(i18nString(UIStrings.showComputedStylesSidebar), i18nString(UIStrings.hideComputedStylesSidebar), i18nString(UIStrings.computedStylesShown), i18nString(UIStrings.computedStylesHidden)));
    });
    const showMetricsWidgetInComputedPane = () => {
      this.metricsWidget.show(computedStylePanesWrapper.element, this.computedStyleWidget.element);
      this.metricsWidget.toggleVisibility(true);
      this.stylesWidget.removeEventListener(StylesSidebarPaneEvents.StylesUpdateCompleted, toggleMetricsWidget);
    };
    const showMetricsWidgetInStylesPane = () => {
      const showMergedComputedPane = stylesSplitWidget.showMode() === UI.SplitWidget.ShowMode.Both;
      if (showMergedComputedPane) {
        showMetricsWidgetInComputedPane();
      } else {
        this.metricsWidget.show(matchedStylePanesWrapper.element);
        if (!this.stylesWidget.hasMatchedStyles) {
          this.metricsWidget.toggleVisibility(false);
        }
        this.stylesWidget.addEventListener(StylesSidebarPaneEvents.StylesUpdateCompleted, toggleMetricsWidget);
      }
    };
    let skippedInitialTabSelectedEvent = false;
    const toggleMetricsWidget = (event) => {
      this.metricsWidget.toggleVisibility(event.data.hasMatchedStyles);
    };
    const tabSelected = (event) => {
      const { tabId } = event.data;
      if (tabId === "Computed" /* Computed */) {
        computedStylePanesWrapper.show(computedView.element);
        showMetricsWidgetInComputedPane();
      } else if (tabId === "Styles" /* Styles */) {
        stylesSplitWidget.setSidebarWidget(computedStylePanesWrapper);
        showMetricsWidgetInStylesPane();
      }
      if (skippedInitialTabSelectedEvent) {
        Host.userMetrics.sidebarPaneShown(tabId);
      } else {
        skippedInitialTabSelectedEvent = true;
      }
    };
    this.sidebarPaneView = UI.ViewManager.ViewManager.instance().createTabbedLocation(() => UI.ViewManager.ViewManager.instance().showView("elements"), "Styles-pane-sidebar", false, true);
    const tabbedPane = this.sidebarPaneView.tabbedPane();
    if (this.splitMode !== _splitMode.Vertical) {
      this.splitWidget.installResizer(tabbedPane.headerElement());
    }
    const headerElement = tabbedPane.headerElement();
    UI.ARIAUtils.markAsNavigation(headerElement);
    UI.ARIAUtils.setAccessibleName(headerElement, i18nString(UIStrings.sidePanelToolbar));
    const contentElement = tabbedPane.tabbedPaneContentElement();
    UI.ARIAUtils.markAsComplementary(contentElement);
    UI.ARIAUtils.setAccessibleName(contentElement, i18nString(UIStrings.sidePanelContent));
    const stylesView = new UI.View.SimpleView(i18nString(UIStrings.styles), void 0, "Styles" /* Styles */);
    this.sidebarPaneView.appendView(stylesView);
    stylesView.element.classList.add("flex-auto");
    stylesSplitWidget.show(stylesView.element);
    const computedView = new UI.View.SimpleView(i18nString(UIStrings.computed), void 0, "Computed" /* Computed */);
    computedView.element.classList.add("composite", "fill");
    tabbedPane.addEventListener(UI.TabbedPane.Events.TabSelected, tabSelected, this);
    this.sidebarPaneView.appendView(computedView);
    this.stylesViewToReveal = stylesView;
    this.sidebarPaneView.appendApplicableItems("elements-sidebar");
    const extensionSidebarPanes = Extensions.ExtensionServer.ExtensionServer.instance().sidebarPanes();
    for (let i = 0; i < extensionSidebarPanes.length; ++i) {
      this.addExtensionSidebarPane(extensionSidebarPanes[i]);
    }
    this.splitWidget.setSidebarWidget(this.sidebarPaneView.tabbedPane());
  }
  updateSidebarPosition() {
    if (this.sidebarPaneView && this.sidebarPaneView.tabbedPane().shouldHideOnDetach()) {
      return;
    }
    const position = Common.Settings.Settings.instance().moduleSetting("sidebarPosition").get();
    let splitMode = _splitMode.Horizontal;
    if (position === "right" || position === "auto" && UI.InspectorView.InspectorView.instance().element.offsetWidth > 680) {
      splitMode = _splitMode.Vertical;
    }
    if (!this.sidebarPaneView) {
      this.initializeSidebarPanes(splitMode);
      return;
    }
    if (splitMode === this.splitMode) {
      return;
    }
    this.splitMode = splitMode;
    const tabbedPane = this.sidebarPaneView.tabbedPane();
    this.splitWidget.uninstallResizer(tabbedPane.headerElement());
    this.splitWidget.setVertical(this.splitMode === _splitMode.Vertical);
    this.showToolbarPane(null, null);
    if (this.splitMode !== _splitMode.Vertical) {
      this.splitWidget.installResizer(tabbedPane.headerElement());
    }
  }
  extensionSidebarPaneAdded(event) {
    this.addExtensionSidebarPane(event.data);
  }
  addExtensionSidebarPane(pane) {
    if (this.sidebarPaneView && pane.panelName() === this.name) {
      this.sidebarPaneView.appendView(pane);
    }
  }
  getComputedStyleWidget() {
    return this.computedStyleWidget;
  }
  setupStyleTracking(cssModel) {
    const cssPropertyTracker = cssModel.createCSSPropertyTracker(TrackedCSSProperties);
    cssPropertyTracker.start();
    this.cssStyleTrackerByCSSModel.set(cssModel, cssPropertyTracker);
    cssPropertyTracker.addEventListener(SDK.CSSModel.CSSPropertyTrackerEvents.TrackedCSSPropertiesUpdated, this.trackedCSSPropertiesUpdated, this);
  }
  removeStyleTracking(cssModel) {
    const cssPropertyTracker = this.cssStyleTrackerByCSSModel.get(cssModel);
    if (!cssPropertyTracker) {
      return;
    }
    cssPropertyTracker.stop();
    this.cssStyleTrackerByCSSModel.delete(cssModel);
    cssPropertyTracker.removeEventListener(SDK.CSSModel.CSSPropertyTrackerEvents.TrackedCSSPropertiesUpdated, this.trackedCSSPropertiesUpdated, this);
  }
  trackedCSSPropertiesUpdated({ data: domNodes }) {
    for (const domNode of domNodes) {
      if (!domNode) {
        continue;
      }
      const treeElement = this.treeElementForNode(domNode);
      if (treeElement) {
        void treeElement.updateStyleAdorners();
      }
    }
  }
  showAdornerSettingsPane() {
    if (!this.adornerSettingsPane) {
      this.adornerSettingsPane = new ElementsComponents.AdornerSettingsPane.AdornerSettingsPane();
      this.adornerSettingsPane.addEventListener("adornersettingupdated", (event) => {
        const { adornerName, isEnabledNow, newSettings } = event.data;
        const adornersToUpdate = this.adornersByName.get(adornerName);
        if (adornersToUpdate) {
          for (const adorner of adornersToUpdate) {
            isEnabledNow ? adorner.show() : adorner.hide();
          }
        }
        this.adornerManager.updateSettings(newSettings);
      });
      this.searchableViewInternal.element.prepend(this.adornerSettingsPane);
    }
    const adornerSettings = this.adornerManager.getSettings();
    this.adornerSettingsPane.data = {
      settings: adornerSettings
    };
    this.adornerSettingsPane.show();
  }
  isAdornerEnabled(adornerText) {
    return this.adornerManager.isAdornerEnabled(adornerText);
  }
  registerAdorner(adorner) {
    let adornerSet = this.adornersByName.get(adorner.name);
    if (!adornerSet) {
      adornerSet = /* @__PURE__ */ new Set();
      this.adornersByName.set(adorner.name, adornerSet);
    }
    adornerSet.add(adorner);
    if (!this.isAdornerEnabled(adorner.name)) {
      adorner.hide();
    }
  }
  deregisterAdorner(adorner) {
    const adornerSet = this.adornersByName.get(adorner.name);
    if (!adornerSet) {
      return;
    }
    adornerSet.delete(adorner);
  }
  static firstInspectElementCompletedForTest = function() {
  };
  static firstInspectElementNodeNameForTest = "";
}
globalThis.Elements = globalThis.Elements || {};
globalThis.Elements.ElementsPanel = ElementsPanel;
export var _splitMode = /* @__PURE__ */ ((_splitMode2) => {
  _splitMode2["Vertical"] = "Vertical";
  _splitMode2["Horizontal"] = "Horizontal";
  return _splitMode2;
})(_splitMode || {});
const TrackedCSSProperties = [
  {
    name: "display",
    value: "grid"
  },
  {
    name: "display",
    value: "inline-grid"
  },
  {
    name: "display",
    value: "flex"
  },
  {
    name: "display",
    value: "inline-flex"
  },
  {
    name: "container-type",
    value: "inline-size"
  },
  {
    name: "container-type",
    value: "block-size"
  },
  {
    name: "container-type",
    value: "size"
  }
];
let contextMenuProviderInstance;
export class ContextMenuProvider {
  appendApplicableItems(event, contextMenu, object) {
    if (!(object instanceof SDK.RemoteObject.RemoteObject && object.isNode()) && !(object instanceof SDK.DOMModel.DOMNode) && !(object instanceof SDK.DOMModel.DeferredDOMNode)) {
      return;
    }
    if (ElementsPanel.instance().element.isAncestor(event.target)) {
      return;
    }
    const commandCallback = Common.Revealer.reveal.bind(Common.Revealer.Revealer, object);
    contextMenu.revealSection().appendItem(i18nString(UIStrings.revealInElementsPanel), commandCallback);
  }
  static instance() {
    if (!contextMenuProviderInstance) {
      contextMenuProviderInstance = new ContextMenuProvider();
    }
    return contextMenuProviderInstance;
  }
}
let dOMNodeRevealerInstance;
export class DOMNodeRevealer {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!dOMNodeRevealerInstance || forceNew) {
      dOMNodeRevealerInstance = new DOMNodeRevealer();
    }
    return dOMNodeRevealerInstance;
  }
  reveal(node, omitFocus) {
    const panel = ElementsPanel.instance();
    panel.pendingNodeReveal = true;
    return new Promise(revealPromise).catch((reason) => {
      let message;
      if (Platform.UserVisibleError.isUserVisibleError(reason)) {
        message = reason.message;
      } else {
        message = i18nString(UIStrings.nodeCannotBeFoundInTheCurrent);
      }
      Common.Console.Console.instance().warn(message);
      throw reason;
    });
    function revealPromise(resolve, reject) {
      if (node instanceof SDK.DOMModel.DOMNode) {
        onNodeResolved(node);
      } else if (node instanceof SDK.DOMModel.DeferredDOMNode) {
        node.resolve(checkDeferredDOMNodeThenReveal);
      } else if (node instanceof SDK.RemoteObject.RemoteObject) {
        const domModel = node.runtimeModel().target().model(SDK.DOMModel.DOMModel);
        if (domModel) {
          void domModel.pushObjectAsNodeToFrontend(node).then(checkRemoteObjectThenReveal);
        } else {
          const msg = i18nString(UIStrings.nodeCannotBeFoundInTheCurrent);
          reject(new Platform.UserVisibleError.UserVisibleError(msg));
        }
      } else {
        const msg = i18nString(UIStrings.theRemoteObjectCouldNotBe);
        reject(new Platform.UserVisibleError.UserVisibleError(msg));
        panel.pendingNodeReveal = false;
      }
      function onNodeResolved(resolvedNode) {
        panel.pendingNodeReveal = false;
        let currentNode = resolvedNode;
        while (currentNode.parentNode) {
          currentNode = currentNode.parentNode;
        }
        const isDetached = !(currentNode instanceof SDK.DOMModel.DOMDocument);
        const isDocument = node instanceof SDK.DOMModel.DOMDocument;
        if (!isDocument && isDetached) {
          const msg2 = i18nString(UIStrings.nodeCannotBeFoundInTheCurrent);
          reject(new Platform.UserVisibleError.UserVisibleError(msg2));
          return;
        }
        if (resolvedNode) {
          void panel.revealAndSelectNode(resolvedNode, !omitFocus).then(resolve);
          return;
        }
        const msg = i18nString(UIStrings.nodeCannotBeFoundInTheCurrent);
        reject(new Platform.UserVisibleError.UserVisibleError(msg));
      }
      function checkRemoteObjectThenReveal(resolvedNode) {
        if (!resolvedNode) {
          const msg = i18nString(UIStrings.theRemoteObjectCouldNotBe);
          reject(new Platform.UserVisibleError.UserVisibleError(msg));
          return;
        }
        onNodeResolved(resolvedNode);
      }
      function checkDeferredDOMNodeThenReveal(resolvedNode) {
        if (!resolvedNode) {
          const msg = i18nString(UIStrings.theDeferredDomNodeCouldNotBe);
          reject(new Platform.UserVisibleError.UserVisibleError(msg));
          return;
        }
        onNodeResolved(resolvedNode);
      }
    }
  }
}
let cSSPropertyRevealerInstance;
export class CSSPropertyRevealer {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!cSSPropertyRevealerInstance || forceNew) {
      cSSPropertyRevealerInstance = new CSSPropertyRevealer();
    }
    return cSSPropertyRevealerInstance;
  }
  reveal(property) {
    const panel = ElementsPanel.instance();
    return panel.revealProperty(property);
  }
}
let elementsActionDelegateInstance;
export class ElementsActionDelegate {
  handleAction(context, actionId) {
    const node = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode);
    if (!node) {
      return true;
    }
    const treeOutline = ElementsTreeOutline.forDOMModel(node.domModel());
    if (!treeOutline) {
      return true;
    }
    switch (actionId) {
      case "elements.hide-element":
        void treeOutline.toggleHideElement(node);
        return true;
      case "elements.edit-as-html":
        treeOutline.toggleEditAsHTML(node);
        return true;
      case "elements.duplicate-element":
        treeOutline.duplicateNode(node);
        return true;
      case "elements.copy-styles":
        void treeOutline.findTreeElement(node)?.copyStyles();
        return true;
      case "elements.undo":
        void SDK.DOMModel.DOMModelUndoStack.instance().undo();
        ElementsPanel.instance().stylesWidget.forceUpdate();
        return true;
      case "elements.redo":
        void SDK.DOMModel.DOMModelUndoStack.instance().redo();
        ElementsPanel.instance().stylesWidget.forceUpdate();
        return true;
    }
    return false;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!elementsActionDelegateInstance || forceNew) {
      elementsActionDelegateInstance = new ElementsActionDelegate();
    }
    return elementsActionDelegateInstance;
  }
}
let pseudoStateMarkerDecoratorInstance;
export class PseudoStateMarkerDecorator {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!pseudoStateMarkerDecoratorInstance || forceNew) {
      pseudoStateMarkerDecoratorInstance = new PseudoStateMarkerDecorator();
    }
    return pseudoStateMarkerDecoratorInstance;
  }
  decorate(node) {
    const pseudoState = node.domModel().cssModel().pseudoState(node);
    if (!pseudoState) {
      return null;
    }
    return { color: "orange", title: i18nString(UIStrings.elementStateS, { PH1: ":" + pseudoState.join(", :") }) };
  }
}
//# sourceMappingURL=ElementsPanel.js.map
