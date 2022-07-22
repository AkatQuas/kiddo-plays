import { PrivateAPI } from "./ExtensionAPI.js";
import { ExtensionEndpoint } from "./ExtensionEndpoint.js";
import { RecorderPluginManager } from "./RecorderPluginManager.js";
export class RecorderExtensionEndpoint extends ExtensionEndpoint {
  name;
  mediaType;
  constructor(name, mediaType, port) {
    super(port);
    this.name = name;
    this.mediaType = mediaType;
  }
  getName() {
    return this.name;
  }
  getMediaType() {
    return this.mediaType;
  }
  handleEvent({ event }) {
    switch (event) {
      case PrivateAPI.RecorderExtensionPluginEvents.UnregisteredRecorderExtensionPlugin: {
        this.disconnect();
        RecorderPluginManager.instance().removePlugin(this);
        break;
      }
      default:
        throw new Error(`Unrecognized Recorder extension endpoint event: ${event}`);
    }
  }
  stringify(recording) {
    return this.sendRequest(PrivateAPI.RecorderExtensionPluginCommands.Stringify, { recording });
  }
  stringifyStep(step) {
    return this.sendRequest(PrivateAPI.RecorderExtensionPluginCommands.StringifyStep, { step });
  }
}
//# sourceMappingURL=RecorderExtensionEndpoint.js.map
