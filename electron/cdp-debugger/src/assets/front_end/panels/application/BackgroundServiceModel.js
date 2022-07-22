import * as SDK from "../../core/sdk/sdk.js";
export class BackgroundServiceModel extends SDK.SDKModel.SDKModel {
  backgroundServiceAgent;
  events;
  constructor(target) {
    super(target);
    this.backgroundServiceAgent = target.backgroundServiceAgent();
    target.registerBackgroundServiceDispatcher(this);
    this.events = /* @__PURE__ */ new Map();
  }
  enable(service) {
    this.events.set(service, []);
    void this.backgroundServiceAgent.invoke_startObserving({ service });
  }
  setRecording(shouldRecord, service) {
    void this.backgroundServiceAgent.invoke_setRecording({ shouldRecord, service });
  }
  clearEvents(service) {
    this.events.set(service, []);
    void this.backgroundServiceAgent.invoke_clearEvents({ service });
  }
  getEvents(service) {
    return this.events.get(service) || [];
  }
  recordingStateChanged({ isRecording, service }) {
    this.dispatchEventToListeners(Events.RecordingStateChanged, { isRecording, serviceName: service });
  }
  backgroundServiceEventReceived({ backgroundServiceEvent }) {
    this.events.get(backgroundServiceEvent.service).push(backgroundServiceEvent);
    this.dispatchEventToListeners(Events.BackgroundServiceEventReceived, backgroundServiceEvent);
  }
}
SDK.SDKModel.SDKModel.register(BackgroundServiceModel, { capabilities: SDK.Target.Capability.Browser, autostart: false });
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["RecordingStateChanged"] = "RecordingStateChanged";
  Events2["BackgroundServiceEventReceived"] = "BackgroundServiceEventReceived";
  return Events2;
})(Events || {});
//# sourceMappingURL=BackgroundServiceModel.js.map
