import * as SDK from "../../core/sdk/sdk.js";
import * as TreeOutline from "../../ui/components/tree_outline/tree_outline.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as AccessibilityTreeUtils from "./AccessibilityTreeUtils.js";
import { ElementsPanel } from "./ElementsPanel.js";
export class AccessibilityTreeView extends UI.Widget.VBox {
  accessibilityTreeComponent = new TreeOutline.TreeOutline.TreeOutline();
  toggleButton;
  inspectedDOMNode = null;
  root = null;
  constructor(toggleButton) {
    super();
    this.toggleButton = toggleButton;
    this.contentElement.appendChild(this.toggleButton);
    this.contentElement.appendChild(this.accessibilityTreeComponent);
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.AccessibilityModel.AccessibilityModel, this);
    this.accessibilityTreeComponent.addEventListener("itemselected", (event) => {
      const evt = event;
      const axNode = evt.data.node.treeNodeData;
      if (!axNode.isDOMNode()) {
        return;
      }
      const deferredNode = axNode.deferredDOMNode();
      if (deferredNode) {
        deferredNode.resolve((domNode) => {
          if (domNode) {
            this.inspectedDOMNode = domNode;
            void ElementsPanel.instance().revealAndSelectNode(domNode, true, false);
          }
        });
      }
    });
    this.accessibilityTreeComponent.addEventListener("itemmouseover", (event) => {
      const evt = event;
      evt.data.node.treeNodeData.highlightDOMNode();
    });
    this.accessibilityTreeComponent.addEventListener("itemmouseout", () => {
      SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
    });
  }
  async wasShown() {
    await this.refreshAccessibilityTree();
    if (this.inspectedDOMNode) {
      await this.loadSubTreeIntoAccessibilityModel(this.inspectedDOMNode);
    }
  }
  async refreshAccessibilityTree() {
    if (!this.root) {
      const frameId = SDK.FrameManager.FrameManager.instance().getTopFrame()?.id;
      if (!frameId) {
        throw Error("No top frame");
      }
      this.root = await AccessibilityTreeUtils.getRootNode(frameId);
      if (!this.root) {
        throw Error("No root");
      }
    }
    await this.renderTree();
    await this.accessibilityTreeComponent.expandRecursively(1);
  }
  async renderTree() {
    if (!this.root) {
      return;
    }
    const treeData = await AccessibilityTreeUtils.sdkNodeToAXTreeNodes(this.root);
    this.accessibilityTreeComponent.data = {
      defaultRenderer: AccessibilityTreeUtils.accessibilityNodeRenderer,
      tree: treeData,
      filter: (node) => {
        return node.ignored() || node.role()?.value === "generic" && !node.name()?.value ? TreeOutline.TreeOutline.FilterOption.FLATTEN : TreeOutline.TreeOutline.FilterOption.SHOW;
      }
    };
  }
  async loadSubTreeIntoAccessibilityModel(selectedNode) {
    const ancestors = await AccessibilityTreeUtils.getNodeAndAncestorsFromDOMNode(selectedNode);
    const inspectedAXNode = ancestors.find((node) => node.backendDOMNodeId() === selectedNode.backendNodeId());
    if (!inspectedAXNode) {
      return;
    }
    await this.accessibilityTreeComponent.expandNodeIds(ancestors.map((node) => node.getFrameId() + "#" + node.id()));
    await this.accessibilityTreeComponent.focusNodeId(AccessibilityTreeUtils.getNodeId(inspectedAXNode));
  }
  async revealAndSelectNode(inspectedNode) {
    if (inspectedNode === this.inspectedDOMNode) {
      return;
    }
    this.inspectedDOMNode = inspectedNode;
    if (this.isShowing()) {
      await this.loadSubTreeIntoAccessibilityModel(inspectedNode);
    }
  }
  async selectedNodeChanged(inspectedNode) {
    if (this.isShowing() || inspectedNode === this.inspectedDOMNode) {
      return;
    }
    if (inspectedNode.ownerDocument && (inspectedNode.nodeName() === "HTML" || inspectedNode.nodeName() === "BODY")) {
      this.inspectedDOMNode = inspectedNode.ownerDocument;
    } else {
      this.inspectedDOMNode = inspectedNode;
    }
  }
  treeUpdated({ data }) {
    if (!data.root) {
      void this.renderTree();
      return;
    }
    const topFrameId = SDK.FrameManager.FrameManager.instance().getTopFrame()?.id;
    if (data.root?.getFrameId() !== topFrameId) {
      void this.renderTree();
      return;
    }
    this.root = data.root;
    void this.accessibilityTreeComponent.collapseAllNodes();
    void this.refreshAccessibilityTree();
  }
  modelAdded(model) {
    model.addEventListener(SDK.AccessibilityModel.Events.TreeUpdated, this.treeUpdated, this);
  }
  modelRemoved(model) {
    model.removeEventListener(SDK.AccessibilityModel.Events.TreeUpdated, this.treeUpdated, this);
  }
}
//# sourceMappingURL=AccessibilityTreeView.js.map
