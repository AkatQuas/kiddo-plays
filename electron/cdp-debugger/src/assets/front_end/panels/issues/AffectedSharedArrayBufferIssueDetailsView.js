import * as i18n from "../../core/i18n/i18n.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Protocol from "../../generated/protocol.js";
import { AffectedResourcesView } from "./AffectedResourcesView.js";
const UIStrings = {
  nViolations: "{n, plural, =1 {# violation} other {# violations}}",
  warning: "warning",
  blocked: "blocked",
  instantiation: "Instantiation",
  aSharedarraybufferWas: "A `SharedArrayBuffer` was instantiated in a context that is not cross-origin isolated",
  transfer: "Transfer",
  sharedarraybufferWasTransferedTo: "`SharedArrayBuffer` was transfered to a context that is not cross-origin isolated",
  sourceLocation: "Source Location",
  trigger: "Trigger",
  status: "Status"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/AffectedSharedArrayBufferIssueDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class AffectedSharedArrayBufferIssueDetailsView extends AffectedResourcesView {
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nViolations, { n: count });
  }
  #appendStatus(element, isWarning) {
    const status = document.createElement("td");
    if (isWarning) {
      status.classList.add("affected-resource-report-only-status");
      status.textContent = i18nString(UIStrings.warning);
    } else {
      status.classList.add("affected-resource-blocked-status");
      status.textContent = i18nString(UIStrings.blocked);
    }
    element.appendChild(status);
  }
  #appendType(element, type) {
    const status = document.createElement("td");
    switch (type) {
      case Protocol.Audits.SharedArrayBufferIssueType.CreationIssue:
        status.textContent = i18nString(UIStrings.instantiation);
        status.title = i18nString(UIStrings.aSharedarraybufferWas);
        break;
      case Protocol.Audits.SharedArrayBufferIssueType.TransferIssue:
        status.textContent = i18nString(UIStrings.transfer);
        status.title = i18nString(UIStrings.sharedarraybufferWasTransferedTo);
        break;
    }
    element.appendChild(status);
  }
  #appendDetails(sabIssues) {
    const header = document.createElement("tr");
    this.appendColumnTitle(header, i18nString(UIStrings.sourceLocation));
    this.appendColumnTitle(header, i18nString(UIStrings.trigger));
    this.appendColumnTitle(header, i18nString(UIStrings.status));
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const sabIssue of sabIssues) {
      count++;
      this.#appendDetail(sabIssue);
    }
    this.updateAffectedResourceCount(count);
  }
  #appendDetail(sabIssue) {
    const element = document.createElement("tr");
    element.classList.add("affected-resource-directive");
    const sabIssueDetails = sabIssue.details();
    const location = IssuesManager.Issue.toZeroBasedLocation(sabIssueDetails.sourceCodeLocation);
    this.appendSourceLocation(element, location, sabIssue.model()?.getTargetIfNotDisposed());
    this.#appendType(element, sabIssueDetails.type);
    this.#appendStatus(element, sabIssueDetails.isWarning);
    this.affectedResources.appendChild(element);
  }
  update() {
    this.clear();
    this.#appendDetails(this.issue.getSharedArrayBufferIssues());
  }
}
//# sourceMappingURL=AffectedSharedArrayBufferIssueDetailsView.js.map
