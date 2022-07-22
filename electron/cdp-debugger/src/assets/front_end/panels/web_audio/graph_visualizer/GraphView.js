import * as Common from "../../../core/common/common.js";
import * as Platform from "../../../core/platform/platform.js";
import { EdgeTypes, EdgeView, generateEdgePortIdsByData } from "./EdgeView.js";
import { NodeLabelGenerator, NodeView } from "./NodeView.js";
export class GraphView extends Common.ObjectWrapper.ObjectWrapper {
  contextId;
  nodes;
  edges;
  outboundEdgeMap;
  inboundEdgeMap;
  nodeLabelGenerator;
  paramIdToNodeIdMap;
  constructor(contextId) {
    super();
    this.contextId = contextId;
    this.nodes = /* @__PURE__ */ new Map();
    this.edges = /* @__PURE__ */ new Map();
    this.outboundEdgeMap = new Platform.MapUtilities.Multimap();
    this.inboundEdgeMap = new Platform.MapUtilities.Multimap();
    this.nodeLabelGenerator = new NodeLabelGenerator();
    this.paramIdToNodeIdMap = /* @__PURE__ */ new Map();
  }
  addNode(data) {
    const label = this.nodeLabelGenerator.generateLabel(data.nodeType);
    const node = new NodeView(data, label);
    this.nodes.set(data.nodeId, node);
    this.notifyShouldRedraw();
  }
  removeNode(nodeId) {
    this.outboundEdgeMap.get(nodeId).forEach((edgeId) => this.removeEdge(edgeId));
    this.inboundEdgeMap.get(nodeId).forEach((edgeId) => this.removeEdge(edgeId));
    this.nodes.delete(nodeId);
    this.notifyShouldRedraw();
  }
  addParam(data) {
    const node = this.getNodeById(data.nodeId);
    if (!node) {
      console.error("AudioNode should be added before AudioParam");
      return;
    }
    node.addParamPort(data.paramId, data.paramType);
    this.paramIdToNodeIdMap.set(data.paramId, data.nodeId);
    this.notifyShouldRedraw();
  }
  removeParam(paramId) {
    this.paramIdToNodeIdMap.delete(paramId);
  }
  addNodeToNodeConnection(edgeData) {
    const edge = new EdgeView(edgeData, EdgeTypes.NodeToNode);
    this.addEdge(edge);
  }
  removeNodeToNodeConnection(edgeData) {
    if (edgeData.destinationId) {
      const edgePortIds = generateEdgePortIdsByData(edgeData, EdgeTypes.NodeToNode);
      if (!edgePortIds) {
        throw new Error("Unable to generate edge port IDs");
      }
      const { edgeId } = edgePortIds;
      this.removeEdge(edgeId);
    } else {
      this.outboundEdgeMap.get(edgeData.sourceId).forEach((edgeId) => this.removeEdge(edgeId));
    }
  }
  addNodeToParamConnection(edgeData) {
    const edge = new EdgeView(edgeData, EdgeTypes.NodeToParam);
    this.addEdge(edge);
  }
  removeNodeToParamConnection(edgeData) {
    const edgePortIds = generateEdgePortIdsByData(edgeData, EdgeTypes.NodeToParam);
    if (!edgePortIds) {
      throw new Error("Unable to generate edge port IDs");
    }
    const { edgeId } = edgePortIds;
    this.removeEdge(edgeId);
  }
  getNodeById(nodeId) {
    return this.nodes.get(nodeId) || null;
  }
  getNodes() {
    return this.nodes;
  }
  getEdges() {
    return this.edges;
  }
  getNodeIdByParamId(paramId) {
    return this.paramIdToNodeIdMap.get(paramId) || null;
  }
  addEdge(edge) {
    const sourceId = edge.sourceId;
    if (this.outboundEdgeMap.hasValue(sourceId, edge.id)) {
      return;
    }
    this.edges.set(edge.id, edge);
    this.outboundEdgeMap.set(sourceId, edge.id);
    this.inboundEdgeMap.set(edge.destinationId, edge.id);
    this.notifyShouldRedraw();
  }
  removeEdge(edgeId) {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return;
    }
    this.outboundEdgeMap.delete(edge.sourceId, edgeId);
    this.inboundEdgeMap.delete(edge.destinationId, edgeId);
    this.edges.delete(edgeId);
    this.notifyShouldRedraw();
  }
  notifyShouldRedraw() {
    this.dispatchEventToListeners(Events.ShouldRedraw, this);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ShouldRedraw"] = "ShouldRedraw";
  return Events2;
})(Events || {});
//# sourceMappingURL=GraphView.js.map
