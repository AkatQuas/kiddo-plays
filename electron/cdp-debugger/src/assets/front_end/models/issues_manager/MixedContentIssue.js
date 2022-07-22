import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
const UIStrings = {
  preventingMixedContent: "Preventing mixed content"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/MixedContentIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class MixedContentIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    super(Protocol.Audits.InspectorIssueCode.MixedContentIssue, issuesModel);
    this.#issueDetails = issueDetails;
  }
  requests() {
    if (this.#issueDetails.request) {
      return [this.#issueDetails.request];
    }
    return [];
  }
  getDetails() {
    return this.#issueDetails;
  }
  getCategory() {
    return IssueCategory.MixedContent;
  }
  getDescription() {
    return {
      file: "mixedContent.md",
      links: [{ link: "https://web.dev/what-is-mixed-content/", linkTitle: i18nString(UIStrings.preventingMixedContent) }]
    };
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails);
  }
  getKind() {
    switch (this.#issueDetails.resolutionStatus) {
      case Protocol.Audits.MixedContentResolutionStatus.MixedContentAutomaticallyUpgraded:
        return IssueKind.Improvement;
      case Protocol.Audits.MixedContentResolutionStatus.MixedContentBlocked:
        return IssueKind.PageError;
      case Protocol.Audits.MixedContentResolutionStatus.MixedContentWarning:
        return IssueKind.Improvement;
    }
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const mixedContentDetails = inspectorIssue.details.mixedContentIssueDetails;
    if (!mixedContentDetails) {
      console.warn("Mixed content issue without details received.");
      return [];
    }
    return [new MixedContentIssue(mixedContentDetails, issuesModel)];
  }
}
//# sourceMappingURL=MixedContentIssue.js.map
