import { GraphView } from "./GraphView.js";
export class GraphManager {
  graphMapByContextId = /* @__PURE__ */ new Map();
  createContext(contextId) {
    const graph = new GraphView(contextId);
    this.graphMapByContextId.set(contextId, graph);
  }
  destroyContext(contextId) {
    if (!this.graphMapByContextId.has(contextId)) {
      return;
    }
    const graph = this.graphMapByContextId.get(contextId);
    if (!graph) {
      return;
    }
    this.graphMapByContextId.delete(contextId);
  }
  hasContext(contextId) {
    return this.graphMapByContextId.has(contextId);
  }
  clearGraphs() {
    this.graphMapByContextId.clear();
  }
  getGraph(contextId) {
    return this.graphMapByContextId.get(contextId) || null;
  }
}
//# sourceMappingURL=GraphManager.js.map
