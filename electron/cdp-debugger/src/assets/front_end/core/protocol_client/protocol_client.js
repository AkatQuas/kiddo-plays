import * as InspectorBackendCommands from "../../generated/InspectorBackendCommands.js";
import * as InspectorBackend from "./InspectorBackend.js";
import * as NodeURL from "./NodeURL.js";
export {
  InspectorBackend,
  NodeURL
};
self.Protocol = self.Protocol || {};
InspectorBackendCommands.registerCommands(InspectorBackend.inspectorBackend);
//# sourceMappingURL=protocol_client.js.map
