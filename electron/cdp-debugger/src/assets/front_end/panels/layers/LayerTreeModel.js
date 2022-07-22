import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
export class LayerTreeModel extends SDK.SDKModel.SDKModel {
  layerTreeAgent;
  paintProfilerModel;
  layerTreeInternal;
  throttler;
  enabled;
  lastPaintRectByLayerId;
  constructor(target) {
    super(target);
    this.layerTreeAgent = target.layerTreeAgent();
    target.registerLayerTreeDispatcher(new LayerTreeDispatcher(this));
    this.paintProfilerModel = target.model(SDK.PaintProfiler.PaintProfilerModel);
    const resourceTreeModel = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (resourceTreeModel) {
      resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.MainFrameNavigated, this.onMainFrameNavigated, this);
    }
    this.layerTreeInternal = null;
    this.throttler = new Common.Throttler.Throttler(20);
  }
  async disable() {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    await this.layerTreeAgent.invoke_disable();
  }
  enable() {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    void this.forceEnable();
  }
  async forceEnable() {
    this.lastPaintRectByLayerId = /* @__PURE__ */ new Map();
    if (!this.layerTreeInternal) {
      this.layerTreeInternal = new AgentLayerTree(this);
    }
    await this.layerTreeAgent.invoke_enable();
  }
  layerTree() {
    return this.layerTreeInternal;
  }
  async layerTreeChanged(layers) {
    if (!this.enabled) {
      return;
    }
    void this.throttler.schedule(this.innerSetLayers.bind(this, layers));
  }
  async innerSetLayers(layers) {
    const layerTree = this.layerTreeInternal;
    await layerTree.setLayers(layers);
    if (!this.lastPaintRectByLayerId) {
      this.lastPaintRectByLayerId = /* @__PURE__ */ new Map();
    }
    for (const layerId of this.lastPaintRectByLayerId.keys()) {
      const lastPaintRect = this.lastPaintRectByLayerId.get(layerId);
      const layer = layerTree.layerById(layerId);
      if (layer) {
        layer.setLastPaintRect(lastPaintRect);
      }
    }
    this.lastPaintRectByLayerId = /* @__PURE__ */ new Map();
    this.dispatchEventToListeners(Events.LayerTreeChanged);
  }
  layerPainted(layerId, clipRect) {
    if (!this.enabled) {
      return;
    }
    const layerTree = this.layerTreeInternal;
    const layer = layerTree.layerById(layerId);
    if (!layer) {
      if (!this.lastPaintRectByLayerId) {
        this.lastPaintRectByLayerId = /* @__PURE__ */ new Map();
      }
      this.lastPaintRectByLayerId.set(layerId, clipRect);
      return;
    }
    layer.didPaint(clipRect);
    this.dispatchEventToListeners(Events.LayerPainted, layer);
  }
  onMainFrameNavigated() {
    this.layerTreeInternal = null;
    if (this.enabled) {
      void this.forceEnable();
    }
  }
}
SDK.SDKModel.SDKModel.register(LayerTreeModel, { capabilities: SDK.Target.Capability.DOM, autostart: false });
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["LayerTreeChanged"] = "LayerTreeChanged";
  Events2["LayerPainted"] = "LayerPainted";
  return Events2;
})(Events || {});
export class AgentLayerTree extends SDK.LayerTreeBase.LayerTreeBase {
  layerTreeModel;
  constructor(layerTreeModel) {
    super(layerTreeModel.target());
    this.layerTreeModel = layerTreeModel;
  }
  async setLayers(payload) {
    if (!payload) {
      this.innerSetLayers(payload);
      return;
    }
    const idsToResolve = /* @__PURE__ */ new Set();
    for (let i = 0; i < payload.length; ++i) {
      const backendNodeId = payload[i].backendNodeId;
      if (!backendNodeId || this.backendNodeIdToNode().has(backendNodeId)) {
        continue;
      }
      idsToResolve.add(backendNodeId);
    }
    await this.resolveBackendNodeIds(idsToResolve);
    this.innerSetLayers(payload);
  }
  innerSetLayers(layers) {
    this.setRoot(null);
    this.setContentRoot(null);
    if (!layers) {
      return;
    }
    let root;
    const oldLayersById = this.layersById;
    this.layersById = /* @__PURE__ */ new Map();
    for (let i = 0; i < layers.length; ++i) {
      const layerId = layers[i].layerId;
      let layer = oldLayersById.get(layerId);
      if (layer) {
        layer.reset(layers[i]);
      } else {
        layer = new AgentLayer(this.layerTreeModel, layers[i]);
      }
      this.layersById.set(layerId, layer);
      const backendNodeId = layers[i].backendNodeId;
      if (backendNodeId) {
        layer.setNode(this.backendNodeIdToNode().get(backendNodeId) || null);
      }
      if (!this.contentRoot() && layer.drawsContent()) {
        this.setContentRoot(layer);
      }
      const parentId = layer.parentId();
      if (parentId) {
        const parent = this.layersById.get(parentId);
        if (!parent) {
          throw new Error(`Missing parent ${parentId} for layer ${layerId}`);
        }
        parent.addChild(layer);
      } else {
        if (root) {
          console.assert(false, "Multiple root layers");
        }
        root = layer;
      }
    }
    if (root) {
      this.setRoot(root);
      root.calculateQuad(new WebKitCSSMatrix());
    }
  }
}
export class AgentLayer {
  scrollRectsInternal;
  quadInternal;
  childrenInternal;
  image;
  parentInternal;
  layerPayload;
  layerTreeModel;
  nodeInternal;
  lastPaintRectInternal;
  paintCountInternal;
  stickyPositionConstraintInternal;
  constructor(layerTreeModel, layerPayload) {
    this.layerTreeModel = layerTreeModel;
    this.reset(layerPayload);
  }
  id() {
    return this.layerPayload.layerId;
  }
  parentId() {
    return this.layerPayload.parentLayerId || null;
  }
  parent() {
    return this.parentInternal;
  }
  isRoot() {
    return !this.parentId();
  }
  children() {
    return this.childrenInternal;
  }
  addChild(childParam) {
    const child = childParam;
    if (child.parentInternal) {
      console.assert(false, "Child already has a parent");
    }
    this.childrenInternal.push(child);
    child.parentInternal = this;
  }
  setNode(node) {
    this.nodeInternal = node;
  }
  node() {
    return this.nodeInternal || null;
  }
  nodeForSelfOrAncestor() {
    let layer = this;
    for (; layer; layer = layer.parentInternal) {
      if (layer.nodeInternal) {
        return layer.nodeInternal;
      }
    }
    return null;
  }
  offsetX() {
    return this.layerPayload.offsetX;
  }
  offsetY() {
    return this.layerPayload.offsetY;
  }
  width() {
    return this.layerPayload.width;
  }
  height() {
    return this.layerPayload.height;
  }
  transform() {
    return this.layerPayload.transform || null;
  }
  quad() {
    return this.quadInternal;
  }
  anchorPoint() {
    return [
      this.layerPayload.anchorX || 0,
      this.layerPayload.anchorY || 0,
      this.layerPayload.anchorZ || 0
    ];
  }
  invisible() {
    return this.layerPayload.invisible || false;
  }
  paintCount() {
    return this.paintCountInternal || this.layerPayload.paintCount;
  }
  lastPaintRect() {
    return this.lastPaintRectInternal || null;
  }
  setLastPaintRect(lastPaintRect) {
    this.lastPaintRectInternal = lastPaintRect;
  }
  scrollRects() {
    return this.scrollRectsInternal;
  }
  stickyPositionConstraint() {
    return this.stickyPositionConstraintInternal || null;
  }
  async requestCompositingReasonIds() {
    const reasons = await this.layerTreeModel.layerTreeAgent.invoke_compositingReasons({ layerId: this.id() });
    return reasons.compositingReasonIds || [];
  }
  drawsContent() {
    return this.layerPayload.drawsContent;
  }
  gpuMemoryUsage() {
    const bytesPerPixel = 4;
    return this.drawsContent() ? this.width() * this.height() * bytesPerPixel : 0;
  }
  snapshots() {
    const promise = this.layerTreeModel.paintProfilerModel.makeSnapshot(this.id()).then((snapshot) => {
      if (!snapshot) {
        return null;
      }
      return { rect: { x: 0, y: 0, width: this.width(), height: this.height() }, snapshot };
    });
    return [promise];
  }
  didPaint(rect) {
    this.lastPaintRectInternal = rect;
    this.paintCountInternal = this.paintCount() + 1;
    this.image = null;
  }
  reset(layerPayload) {
    this.nodeInternal = null;
    this.childrenInternal = [];
    this.parentInternal = null;
    this.paintCountInternal = 0;
    this.layerPayload = layerPayload;
    this.image = null;
    this.scrollRectsInternal = this.layerPayload.scrollRects || [];
    this.stickyPositionConstraintInternal = this.layerPayload.stickyPositionConstraint ? new SDK.LayerTreeBase.StickyPositionConstraint(this.layerTreeModel.layerTree(), this.layerPayload.stickyPositionConstraint) : null;
  }
  matrixFromArray(a) {
    function toFixed9(x) {
      return x.toFixed(9);
    }
    return new WebKitCSSMatrix("matrix3d(" + a.map(toFixed9).join(",") + ")");
  }
  calculateTransformToViewport(parentTransform) {
    const offsetMatrix = new WebKitCSSMatrix().translate(this.layerPayload.offsetX, this.layerPayload.offsetY);
    let matrix = offsetMatrix;
    if (this.layerPayload.transform) {
      const transformMatrix = this.matrixFromArray(this.layerPayload.transform);
      const anchorVector = new UI.Geometry.Vector(this.layerPayload.width * this.anchorPoint()[0], this.layerPayload.height * this.anchorPoint()[1], this.anchorPoint()[2]);
      const anchorPoint = UI.Geometry.multiplyVectorByMatrixAndNormalize(anchorVector, matrix);
      const anchorMatrix = new WebKitCSSMatrix().translate(-anchorPoint.x, -anchorPoint.y, -anchorPoint.z);
      matrix = anchorMatrix.inverse().multiply(transformMatrix.multiply(anchorMatrix.multiply(matrix)));
    }
    matrix = parentTransform.multiply(matrix);
    return matrix;
  }
  createVertexArrayForRect(width, height) {
    return [0, 0, 0, width, 0, 0, width, height, 0, 0, height, 0];
  }
  calculateQuad(parentTransform) {
    const matrix = this.calculateTransformToViewport(parentTransform);
    this.quadInternal = [];
    const vertices = this.createVertexArrayForRect(this.layerPayload.width, this.layerPayload.height);
    for (let i = 0; i < 4; ++i) {
      const point = UI.Geometry.multiplyVectorByMatrixAndNormalize(new UI.Geometry.Vector(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]), matrix);
      this.quadInternal.push(point.x, point.y);
    }
    function calculateQuadForLayer(layer) {
      layer.calculateQuad(matrix);
    }
    this.childrenInternal.forEach(calculateQuadForLayer);
  }
}
class LayerTreeDispatcher {
  layerTreeModel;
  constructor(layerTreeModel) {
    this.layerTreeModel = layerTreeModel;
  }
  layerTreeDidChange({ layers }) {
    void this.layerTreeModel.layerTreeChanged(layers || null);
  }
  layerPainted({ layerId, clip }) {
    this.layerTreeModel.layerPainted(layerId, clip);
  }
}
//# sourceMappingURL=LayerTreeModel.js.map
