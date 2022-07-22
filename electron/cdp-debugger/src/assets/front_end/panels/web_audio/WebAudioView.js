import webAudioStyles from "./webAudio.css.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as GraphVisualizer from "./graph_visualizer/graph_visualizer.js";
import { ContextDetailBuilder, ContextSummaryBuilder } from "./AudioContextContentBuilder.js";
import { AudioContextSelector, Events as SelectorEvents } from "./AudioContextSelector.js";
import { Events as ModelEvents, WebAudioModel } from "./WebAudioModel.js";
const UIStrings = {
  openAPageThatUsesWebAudioApiTo: "Open a page that uses Web Audio API to start monitoring."
};
const str_ = i18n.i18n.registerUIStrings("panels/web_audio/WebAudioView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let webAudioViewInstance;
export class WebAudioView extends UI.ThrottledWidget.ThrottledWidget {
  contextSelector;
  contentContainer;
  detailViewContainer;
  graphManager;
  landingPage;
  summaryBarContainer;
  constructor() {
    super(true, 1e3);
    this.element.classList.add("web-audio-drawer");
    const toolbarContainer = this.contentElement.createChild("div", "web-audio-toolbar-container vbox");
    this.contextSelector = new AudioContextSelector();
    const toolbar = new UI.Toolbar.Toolbar("web-audio-toolbar", toolbarContainer);
    toolbar.appendToolbarItem(UI.Toolbar.Toolbar.createActionButtonForId("components.collect-garbage"));
    toolbar.appendSeparator();
    toolbar.appendToolbarItem(this.contextSelector.toolbarItem());
    this.contentContainer = this.contentElement.createChild("div", "web-audio-content-container vbox flex-auto");
    this.detailViewContainer = this.contentContainer.createChild("div", "web-audio-details-container vbox flex-auto");
    this.graphManager = new GraphVisualizer.GraphManager.GraphManager();
    this.landingPage = new UI.Widget.VBox();
    this.landingPage.contentElement.classList.add("web-audio-landing-page", "fill");
    this.landingPage.contentElement.appendChild(UI.Fragment.html`
  <div>
  <p>${i18nString(UIStrings.openAPageThatUsesWebAudioApiTo)}</p>
  </div>
  `);
    this.landingPage.show(this.detailViewContainer);
    this.summaryBarContainer = this.contentContainer.createChild("div", "web-audio-summary-container");
    this.contextSelector.addEventListener(SelectorEvents.ContextSelected, (event) => {
      const context = event.data;
      if (context) {
        this.updateDetailView(context);
      }
      void this.doUpdate();
    });
    SDK.TargetManager.TargetManager.instance().observeModels(WebAudioModel, this);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!webAudioViewInstance || forceNew) {
      webAudioViewInstance = new WebAudioView();
    }
    return webAudioViewInstance;
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([webAudioStyles]);
    for (const model of SDK.TargetManager.TargetManager.instance().models(WebAudioModel)) {
      this.addEventListeners(model);
    }
  }
  willHide() {
    for (const model of SDK.TargetManager.TargetManager.instance().models(WebAudioModel)) {
      this.removeEventListeners(model);
    }
  }
  modelAdded(webAudioModel) {
    if (this.isShowing()) {
      this.addEventListeners(webAudioModel);
    }
  }
  modelRemoved(webAudioModel) {
    this.removeEventListeners(webAudioModel);
  }
  async doUpdate() {
    await this.pollRealtimeData();
    this.update();
  }
  addEventListeners(webAudioModel) {
    webAudioModel.ensureEnabled();
    webAudioModel.addEventListener(ModelEvents.ContextCreated, this.contextCreated, this);
    webAudioModel.addEventListener(ModelEvents.ContextDestroyed, this.contextDestroyed, this);
    webAudioModel.addEventListener(ModelEvents.ContextChanged, this.contextChanged, this);
    webAudioModel.addEventListener(ModelEvents.ModelReset, this.reset, this);
    webAudioModel.addEventListener(ModelEvents.ModelSuspend, this.suspendModel, this);
    webAudioModel.addEventListener(ModelEvents.AudioListenerCreated, this.audioListenerCreated, this);
    webAudioModel.addEventListener(ModelEvents.AudioListenerWillBeDestroyed, this.audioListenerWillBeDestroyed, this);
    webAudioModel.addEventListener(ModelEvents.AudioNodeCreated, this.audioNodeCreated, this);
    webAudioModel.addEventListener(ModelEvents.AudioNodeWillBeDestroyed, this.audioNodeWillBeDestroyed, this);
    webAudioModel.addEventListener(ModelEvents.AudioParamCreated, this.audioParamCreated, this);
    webAudioModel.addEventListener(ModelEvents.AudioParamWillBeDestroyed, this.audioParamWillBeDestroyed, this);
    webAudioModel.addEventListener(ModelEvents.NodesConnected, this.nodesConnected, this);
    webAudioModel.addEventListener(ModelEvents.NodesDisconnected, this.nodesDisconnected, this);
    webAudioModel.addEventListener(ModelEvents.NodeParamConnected, this.nodeParamConnected, this);
    webAudioModel.addEventListener(ModelEvents.NodeParamDisconnected, this.nodeParamDisconnected, this);
  }
  removeEventListeners(webAudioModel) {
    webAudioModel.removeEventListener(ModelEvents.ContextCreated, this.contextCreated, this);
    webAudioModel.removeEventListener(ModelEvents.ContextDestroyed, this.contextDestroyed, this);
    webAudioModel.removeEventListener(ModelEvents.ContextChanged, this.contextChanged, this);
    webAudioModel.removeEventListener(ModelEvents.ModelReset, this.reset, this);
    webAudioModel.removeEventListener(ModelEvents.ModelSuspend, this.suspendModel, this);
    webAudioModel.removeEventListener(ModelEvents.AudioListenerCreated, this.audioListenerCreated, this);
    webAudioModel.removeEventListener(ModelEvents.AudioListenerWillBeDestroyed, this.audioListenerWillBeDestroyed, this);
    webAudioModel.removeEventListener(ModelEvents.AudioNodeCreated, this.audioNodeCreated, this);
    webAudioModel.removeEventListener(ModelEvents.AudioNodeWillBeDestroyed, this.audioNodeWillBeDestroyed, this);
    webAudioModel.removeEventListener(ModelEvents.AudioParamCreated, this.audioParamCreated, this);
    webAudioModel.removeEventListener(ModelEvents.AudioParamWillBeDestroyed, this.audioParamWillBeDestroyed, this);
    webAudioModel.removeEventListener(ModelEvents.NodesConnected, this.nodesConnected, this);
    webAudioModel.removeEventListener(ModelEvents.NodesDisconnected, this.nodesDisconnected, this);
    webAudioModel.removeEventListener(ModelEvents.NodeParamConnected, this.nodeParamConnected, this);
    webAudioModel.removeEventListener(ModelEvents.NodeParamDisconnected, this.nodeParamDisconnected, this);
  }
  contextCreated(event) {
    const context = event.data;
    this.graphManager.createContext(context.contextId);
    this.contextSelector.contextCreated(event);
  }
  contextDestroyed(event) {
    const contextId = event.data;
    this.graphManager.destroyContext(contextId);
    this.contextSelector.contextDestroyed(event);
  }
  contextChanged(event) {
    const context = event.data;
    if (!this.graphManager.hasContext(context.contextId)) {
      return;
    }
    this.contextSelector.contextChanged(event);
  }
  reset() {
    if (this.landingPage.isShowing()) {
      this.landingPage.detach();
    }
    this.contextSelector.reset();
    this.detailViewContainer.removeChildren();
    this.landingPage.show(this.detailViewContainer);
    this.graphManager.clearGraphs();
  }
  suspendModel() {
    this.graphManager.clearGraphs();
  }
  audioListenerCreated(event) {
    const listener = event.data;
    const graph = this.graphManager.getGraph(listener.contextId);
    if (!graph) {
      return;
    }
    graph.addNode({
      nodeId: listener.listenerId,
      nodeType: "Listener",
      numberOfInputs: 0,
      numberOfOutputs: 0
    });
  }
  audioListenerWillBeDestroyed(event) {
    const { contextId, listenerId } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    graph.removeNode(listenerId);
  }
  audioNodeCreated(event) {
    const node = event.data;
    const graph = this.graphManager.getGraph(node.contextId);
    if (!graph) {
      return;
    }
    graph.addNode({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      numberOfInputs: node.numberOfInputs,
      numberOfOutputs: node.numberOfOutputs
    });
  }
  audioNodeWillBeDestroyed(event) {
    const { contextId, nodeId } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    graph.removeNode(nodeId);
  }
  audioParamCreated(event) {
    const param = event.data;
    const graph = this.graphManager.getGraph(param.contextId);
    if (!graph) {
      return;
    }
    graph.addParam({
      paramId: param.paramId,
      paramType: param.paramType,
      nodeId: param.nodeId
    });
  }
  audioParamWillBeDestroyed(event) {
    const { contextId, paramId } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    graph.removeParam(paramId);
  }
  nodesConnected(event) {
    const { contextId, sourceId, destinationId, sourceOutputIndex, destinationInputIndex } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    graph.addNodeToNodeConnection({
      sourceId,
      destinationId,
      sourceOutputIndex,
      destinationInputIndex
    });
  }
  nodesDisconnected(event) {
    const { contextId, sourceId, destinationId, sourceOutputIndex, destinationInputIndex } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    graph.removeNodeToNodeConnection({
      sourceId,
      destinationId,
      sourceOutputIndex,
      destinationInputIndex
    });
  }
  nodeParamConnected(event) {
    const { contextId, sourceId, destinationId, sourceOutputIndex } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    const nodeId = graph.getNodeIdByParamId(destinationId);
    if (!nodeId) {
      return;
    }
    graph.addNodeToParamConnection({
      sourceId,
      destinationId: nodeId,
      sourceOutputIndex,
      destinationParamId: destinationId
    });
  }
  nodeParamDisconnected(event) {
    const { contextId, sourceId, destinationId, sourceOutputIndex } = event.data;
    const graph = this.graphManager.getGraph(contextId);
    if (!graph) {
      return;
    }
    const nodeId = graph.getNodeIdByParamId(destinationId);
    if (!nodeId) {
      return;
    }
    graph.removeNodeToParamConnection({
      sourceId,
      destinationId: nodeId,
      sourceOutputIndex,
      destinationParamId: destinationId
    });
  }
  updateDetailView(context) {
    if (this.landingPage.isShowing()) {
      this.landingPage.detach();
    }
    const detailBuilder = new ContextDetailBuilder(context);
    this.detailViewContainer.removeChildren();
    this.detailViewContainer.appendChild(detailBuilder.getFragment());
  }
  updateSummaryBar(contextId, contextRealtimeData) {
    const summaryBuilder = new ContextSummaryBuilder(contextId, contextRealtimeData);
    this.summaryBarContainer.removeChildren();
    this.summaryBarContainer.appendChild(summaryBuilder.getFragment());
  }
  clearSummaryBar() {
    this.summaryBarContainer.removeChildren();
  }
  async pollRealtimeData() {
    const context = this.contextSelector.selectedContext();
    if (!context) {
      this.clearSummaryBar();
      return;
    }
    for (const model of SDK.TargetManager.TargetManager.instance().models(WebAudioModel)) {
      if (context.contextType === "realtime") {
        if (!this.graphManager.hasContext(context.contextId)) {
          continue;
        }
        const realtimeData = await model.requestRealtimeData(context.contextId);
        if (realtimeData) {
          this.updateSummaryBar(context.contextId, realtimeData);
        }
      } else {
        this.clearSummaryBar();
      }
    }
  }
}
//# sourceMappingURL=WebAudioView.js.map
