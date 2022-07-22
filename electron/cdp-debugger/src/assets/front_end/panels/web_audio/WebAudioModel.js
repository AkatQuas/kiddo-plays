import * as SDK from "../../core/sdk/sdk.js";
export class WebAudioModel extends SDK.SDKModel.SDKModel {
  enabled;
  agent;
  constructor(target) {
    super(target);
    this.enabled = false;
    this.agent = target.webAudioAgent();
    target.registerWebAudioDispatcher(this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.ResourceTreeModel.ResourceTreeModel, SDK.ResourceTreeModel.Events.FrameNavigated, this.flushContexts, this);
  }
  flushContexts() {
    this.dispatchEventToListeners(Events.ModelReset);
  }
  async suspendModel() {
    this.dispatchEventToListeners(Events.ModelSuspend);
    await this.agent.invoke_disable();
  }
  async resumeModel() {
    if (!this.enabled) {
      return Promise.resolve();
    }
    await this.agent.invoke_enable();
  }
  ensureEnabled() {
    if (this.enabled) {
      return;
    }
    void this.agent.invoke_enable();
    this.enabled = true;
  }
  contextCreated({ context }) {
    this.dispatchEventToListeners(Events.ContextCreated, context);
  }
  contextWillBeDestroyed({ contextId }) {
    this.dispatchEventToListeners(Events.ContextDestroyed, contextId);
  }
  contextChanged({ context }) {
    this.dispatchEventToListeners(Events.ContextChanged, context);
  }
  audioListenerCreated({ listener }) {
    this.dispatchEventToListeners(Events.AudioListenerCreated, listener);
  }
  audioListenerWillBeDestroyed({ listenerId, contextId }) {
    this.dispatchEventToListeners(Events.AudioListenerWillBeDestroyed, { listenerId, contextId });
  }
  audioNodeCreated({ node }) {
    this.dispatchEventToListeners(Events.AudioNodeCreated, node);
  }
  audioNodeWillBeDestroyed({ contextId, nodeId }) {
    this.dispatchEventToListeners(Events.AudioNodeWillBeDestroyed, { contextId, nodeId });
  }
  audioParamCreated({ param }) {
    this.dispatchEventToListeners(Events.AudioParamCreated, param);
  }
  audioParamWillBeDestroyed({ contextId, nodeId, paramId }) {
    this.dispatchEventToListeners(Events.AudioParamWillBeDestroyed, { contextId, nodeId, paramId });
  }
  nodesConnected({ contextId, sourceId, destinationId, sourceOutputIndex, destinationInputIndex }) {
    this.dispatchEventToListeners(Events.NodesConnected, { contextId, sourceId, destinationId, sourceOutputIndex, destinationInputIndex });
  }
  nodesDisconnected({ contextId, sourceId, destinationId, sourceOutputIndex, destinationInputIndex }) {
    this.dispatchEventToListeners(Events.NodesDisconnected, { contextId, sourceId, destinationId, sourceOutputIndex, destinationInputIndex });
  }
  nodeParamConnected({ contextId, sourceId, destinationId, sourceOutputIndex }) {
    this.dispatchEventToListeners(Events.NodeParamConnected, { contextId, sourceId, destinationId, sourceOutputIndex });
  }
  nodeParamDisconnected({ contextId, sourceId, destinationId, sourceOutputIndex }) {
    this.dispatchEventToListeners(Events.NodeParamDisconnected, { contextId, sourceId, destinationId, sourceOutputIndex });
  }
  async requestRealtimeData(contextId) {
    const realtimeResponse = await this.agent.invoke_getRealtimeData({ contextId });
    return realtimeResponse.realtimeData;
  }
}
SDK.SDKModel.SDKModel.register(WebAudioModel, { capabilities: SDK.Target.Capability.DOM, autostart: false });
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ContextCreated"] = "ContextCreated";
  Events2["ContextDestroyed"] = "ContextDestroyed";
  Events2["ContextChanged"] = "ContextChanged";
  Events2["ModelReset"] = "ModelReset";
  Events2["ModelSuspend"] = "ModelSuspend";
  Events2["AudioListenerCreated"] = "AudioListenerCreated";
  Events2["AudioListenerWillBeDestroyed"] = "AudioListenerWillBeDestroyed";
  Events2["AudioNodeCreated"] = "AudioNodeCreated";
  Events2["AudioNodeWillBeDestroyed"] = "AudioNodeWillBeDestroyed";
  Events2["AudioParamCreated"] = "AudioParamCreated";
  Events2["AudioParamWillBeDestroyed"] = "AudioParamWillBeDestroyed";
  Events2["NodesConnected"] = "NodesConnected";
  Events2["NodesDisconnected"] = "NodesDisconnected";
  Events2["NodeParamConnected"] = "NodeParamConnected";
  Events2["NodeParamDisconnected"] = "NodeParamDisconnected";
  return Events2;
})(Events || {});
//# sourceMappingURL=WebAudioModel.js.map
