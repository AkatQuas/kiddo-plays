import { Capability } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
export class IssuesModel extends SDKModel {
  #disposed = false;
  #enabled = false;
  constructor(target) {
    super(target);
    void this.ensureEnabled();
  }
  async ensureEnabled() {
    if (this.#enabled) {
      return;
    }
    this.#enabled = true;
    this.target().registerAuditsDispatcher(this);
    const auditsAgent = this.target().auditsAgent();
    await auditsAgent.invoke_enable();
  }
  issueAdded(issueAddedEvent) {
    this.dispatchEventToListeners(Events.IssueAdded, { issuesModel: this, inspectorIssue: issueAddedEvent.issue });
  }
  dispose() {
    super.dispose();
    this.#disposed = true;
  }
  getTargetIfNotDisposed() {
    if (!this.#disposed) {
      return this.target();
    }
    return null;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["IssueAdded"] = "IssueAdded";
  return Events2;
})(Events || {});
SDKModel.register(IssuesModel, { capabilities: Capability.Audits, autostart: true });
//# sourceMappingURL=IssuesModel.js.map
