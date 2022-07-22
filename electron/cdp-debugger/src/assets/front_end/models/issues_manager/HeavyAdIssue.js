import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
const UIStrings = {
  handlingHeavyAdInterventions: "Handling Heavy Ad Interventions"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/HeavyAdIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class HeavyAdIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    const umaCode = [Protocol.Audits.InspectorIssueCode.HeavyAdIssue, issueDetails.reason].join("::");
    super({ code: Protocol.Audits.InspectorIssueCode.HeavyAdIssue, umaCode }, issuesModel);
    this.#issueDetails = issueDetails;
  }
  details() {
    return this.#issueDetails;
  }
  primaryKey() {
    return `${Protocol.Audits.InspectorIssueCode.HeavyAdIssue}-${JSON.stringify(this.#issueDetails)}`;
  }
  getDescription() {
    return {
      file: "heavyAd.md",
      links: [
        {
          link: "https://developers.google.com/web/updates/2020/05/heavy-ad-interventions",
          linkTitle: i18nString(UIStrings.handlingHeavyAdInterventions)
        }
      ]
    };
  }
  getCategory() {
    return IssueCategory.HeavyAd;
  }
  getKind() {
    switch (this.#issueDetails.resolution) {
      case Protocol.Audits.HeavyAdResolutionStatus.HeavyAdBlocked:
        return IssueKind.PageError;
      case Protocol.Audits.HeavyAdResolutionStatus.HeavyAdWarning:
        return IssueKind.BreakingChange;
    }
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const heavyAdIssueDetails = inspectorIssue.details.heavyAdIssueDetails;
    if (!heavyAdIssueDetails) {
      console.warn("Heavy Ad issue without details received.");
      return [];
    }
    return [new HeavyAdIssue(heavyAdIssueDetails, issuesModel)];
  }
}
//# sourceMappingURL=HeavyAdIssue.js.map
