import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueKind, IssueCategory } from "./Issue.js";
const UIStrings = {
  enablingSharedArrayBuffer: "Enabling `SharedArrayBuffer`"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/SharedArrayBufferIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SharedArrayBufferIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    const umaCode = [Protocol.Audits.InspectorIssueCode.SharedArrayBufferIssue, issueDetails.type].join("::");
    super({ code: Protocol.Audits.InspectorIssueCode.SharedArrayBufferIssue, umaCode }, issuesModel);
    this.#issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.Other;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    return {
      file: "sharedArrayBuffer.md",
      links: [{
        link: "https://developer.chrome.com/blog/enabling-shared-array-buffer/",
        linkTitle: i18nString(UIStrings.enablingSharedArrayBuffer)
      }]
    };
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails);
  }
  getKind() {
    if (this.#issueDetails.isWarning) {
      return IssueKind.BreakingChange;
    }
    return IssueKind.PageError;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const sabIssueDetails = inspectorIssue.details.sharedArrayBufferIssueDetails;
    if (!sabIssueDetails) {
      console.warn("SAB transfer issue without details received.");
      return [];
    }
    return [new SharedArrayBufferIssue(sabIssueDetails, issuesModel)];
  }
}
//# sourceMappingURL=SharedArrayBufferIssue.js.map
