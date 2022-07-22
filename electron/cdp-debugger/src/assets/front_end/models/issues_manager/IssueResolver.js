import * as Common from "../../core/common/common.js";
import { IssuesManager, Events as IssueManagerEvents } from "./IssuesManager.js";
export class IssueResolver extends Common.ResolverBase.ResolverBase {
  #issuesListener = null;
  #issuesManager;
  constructor(issuesManager = IssuesManager.instance()) {
    super();
    this.#issuesManager = issuesManager;
  }
  getForId(id) {
    return this.#issuesManager.getIssueById(id) || null;
  }
  #onIssueAdded(event) {
    const { issue } = event.data;
    const id = issue.getIssueId();
    if (id) {
      this.onResolve(id, issue);
    }
  }
  startListening() {
    if (this.#issuesListener) {
      return;
    }
    this.#issuesListener = this.#issuesManager.addEventListener(IssueManagerEvents.IssueAdded, this.#onIssueAdded, this);
  }
  stopListening() {
    if (!this.#issuesListener) {
      return;
    }
    Common.EventTarget.removeEventListeners([this.#issuesListener]);
    this.#issuesListener = null;
  }
}
//# sourceMappingURL=IssueResolver.js.map
