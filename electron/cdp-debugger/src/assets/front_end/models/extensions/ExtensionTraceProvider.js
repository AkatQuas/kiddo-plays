import { ExtensionServer } from "./ExtensionServer.js";
export class ExtensionTraceProvider {
  extensionOrigin;
  id;
  categoryName;
  categoryTooltip;
  constructor(extensionOrigin, id, categoryName, categoryTooltip) {
    this.extensionOrigin = extensionOrigin;
    this.id = id;
    this.categoryName = categoryName;
    this.categoryTooltip = categoryTooltip;
  }
  start(session) {
    const sessionId = String(++_lastSessionId);
    ExtensionServer.instance().startTraceRecording(this.id, sessionId, session);
  }
  stop() {
    ExtensionServer.instance().stopTraceRecording(this.id);
  }
  shortDisplayName() {
    return this.categoryName;
  }
  longDisplayName() {
    return this.categoryTooltip;
  }
  persistentIdentifier() {
    return `${this.extensionOrigin}/${this.categoryName}`;
  }
}
let _lastSessionId = 0;
//# sourceMappingURL=ExtensionTraceProvider.js.map
