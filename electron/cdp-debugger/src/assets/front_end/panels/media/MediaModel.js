import * as SDK from "../../core/sdk/sdk.js";
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["PlayerPropertiesChanged"] = "PlayerPropertiesChanged";
  Events2["PlayerEventsAdded"] = "PlayerEventsAdded";
  Events2["PlayerMessagesLogged"] = "PlayerMessagesLogged";
  Events2["PlayerErrorsRaised"] = "PlayerErrorsRaised";
  Events2["PlayersCreated"] = "PlayersCreated";
  return Events2;
})(Events || {});
export class MediaModel extends SDK.SDKModel.SDKModel {
  enabled;
  agent;
  constructor(target) {
    super(target);
    this.enabled = false;
    this.agent = target.mediaAgent();
    target.registerMediaDispatcher(this);
  }
  async resumeModel() {
    if (!this.enabled) {
      return Promise.resolve();
    }
    await this.agent.invoke_enable();
  }
  ensureEnabled() {
    void this.agent.invoke_enable();
    this.enabled = true;
  }
  playerPropertiesChanged(event) {
    this.dispatchEventToListeners("PlayerPropertiesChanged" /* PlayerPropertiesChanged */, event);
  }
  playerEventsAdded(event) {
    this.dispatchEventToListeners("PlayerEventsAdded" /* PlayerEventsAdded */, event);
  }
  playerMessagesLogged(event) {
    this.dispatchEventToListeners("PlayerMessagesLogged" /* PlayerMessagesLogged */, event);
  }
  playerErrorsRaised(event) {
    this.dispatchEventToListeners("PlayerErrorsRaised" /* PlayerErrorsRaised */, event);
  }
  playersCreated({ players }) {
    this.dispatchEventToListeners("PlayersCreated" /* PlayersCreated */, players);
  }
}
SDK.SDKModel.SDKModel.register(MediaModel, { capabilities: SDK.Target.Capability.Media, autostart: false });
//# sourceMappingURL=MediaModel.js.map
