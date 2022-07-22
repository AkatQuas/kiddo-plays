import { DOMModel } from "./DOMModel.js";
export var Layer;
((Layer2) => {
  let ScrollRectType;
  ((ScrollRectType2) => {
    ScrollRectType2["NonFastScrollable"] = "NonFastScrollable";
    ScrollRectType2["TouchEventHandler"] = "TouchEventHandler";
    ScrollRectType2["WheelEventHandler"] = "WheelEventHandler";
    ScrollRectType2["RepaintsOnScroll"] = "RepaintsOnScroll";
    ScrollRectType2["MainThreadScrollingReason"] = "MainThreadScrollingReason";
  })(ScrollRectType = Layer2.ScrollRectType || (Layer2.ScrollRectType = {}));
})(Layer || (Layer = {}));
export class StickyPositionConstraint {
  #stickyBoxRectInternal;
  #containingBlockRectInternal;
  #nearestLayerShiftingStickyBoxInternal;
  #nearestLayerShiftingContainingBlockInternal;
  constructor(layerTree, constraint) {
    this.#stickyBoxRectInternal = constraint.stickyBoxRect;
    this.#containingBlockRectInternal = constraint.containingBlockRect;
    this.#nearestLayerShiftingStickyBoxInternal = null;
    if (layerTree && constraint.nearestLayerShiftingStickyBox) {
      this.#nearestLayerShiftingStickyBoxInternal = layerTree.layerById(constraint.nearestLayerShiftingStickyBox);
    }
    this.#nearestLayerShiftingContainingBlockInternal = null;
    if (layerTree && constraint.nearestLayerShiftingContainingBlock) {
      this.#nearestLayerShiftingContainingBlockInternal = layerTree.layerById(constraint.nearestLayerShiftingContainingBlock);
    }
  }
  stickyBoxRect() {
    return this.#stickyBoxRectInternal;
  }
  containingBlockRect() {
    return this.#containingBlockRectInternal;
  }
  nearestLayerShiftingStickyBox() {
    return this.#nearestLayerShiftingStickyBoxInternal;
  }
  nearestLayerShiftingContainingBlock() {
    return this.#nearestLayerShiftingContainingBlockInternal;
  }
}
export class LayerTreeBase {
  #targetInternal;
  #domModel;
  layersById;
  #rootInternal;
  #contentRootInternal;
  #backendNodeIdToNodeInternal;
  #viewportSizeInternal;
  constructor(target) {
    this.#targetInternal = target;
    this.#domModel = target ? target.model(DOMModel) : null;
    this.layersById = /* @__PURE__ */ new Map();
    this.#rootInternal = null;
    this.#contentRootInternal = null;
    this.#backendNodeIdToNodeInternal = /* @__PURE__ */ new Map();
  }
  target() {
    return this.#targetInternal;
  }
  root() {
    return this.#rootInternal;
  }
  setRoot(root) {
    this.#rootInternal = root;
  }
  contentRoot() {
    return this.#contentRootInternal;
  }
  setContentRoot(contentRoot) {
    this.#contentRootInternal = contentRoot;
  }
  forEachLayer(callback, root) {
    if (!root) {
      root = this.root();
      if (!root) {
        return false;
      }
    }
    return callback(root) || root.children().some(this.forEachLayer.bind(this, callback));
  }
  layerById(id) {
    return this.layersById.get(id) || null;
  }
  async resolveBackendNodeIds(requestedNodeIds) {
    if (!requestedNodeIds.size || !this.#domModel) {
      return;
    }
    const nodesMap = await this.#domModel.pushNodesByBackendIdsToFrontend(requestedNodeIds);
    if (!nodesMap) {
      return;
    }
    for (const nodeId of nodesMap.keys()) {
      this.#backendNodeIdToNodeInternal.set(nodeId, nodesMap.get(nodeId) || null);
    }
  }
  backendNodeIdToNode() {
    return this.#backendNodeIdToNodeInternal;
  }
  setViewportSize(viewportSize) {
    this.#viewportSizeInternal = viewportSize;
  }
  viewportSize() {
    return this.#viewportSizeInternal;
  }
  nodeForId(id) {
    return this.#domModel ? this.#domModel.nodeForId(id) : null;
  }
}
//# sourceMappingURL=LayerTreeBase.js.map
