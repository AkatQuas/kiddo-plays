import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
const UIStrings = {
  documentCompatibilityMode: "Document compatibility mode"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/QuirksModeIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class QuirksModeIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    const mode = issueDetails.isLimitedQuirksMode ? "LimitedQuirksMode" : "QuirksMode";
    const umaCode = [Protocol.Audits.InspectorIssueCode.QuirksModeIssue, mode].join("::");
    super({ code: Protocol.Audits.InspectorIssueCode.QuirksModeIssue, umaCode }, issuesModel);
    this.#issueDetails = issueDetails;
  }
  primaryKey() {
    return `${this.code()}-(${this.#issueDetails.documentNodeId})-(${this.#issueDetails.url})`;
  }
  getCategory() {
    return IssueCategory.QuirksMode;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    return {
      file: "CompatibilityModeQuirks.md",
      links: [
        {
          link: "https://web.dev/doctype/",
          linkTitle: i18nString(UIStrings.documentCompatibilityMode)
        }
      ]
    };
  }
  getKind() {
    return IssueKind.Improvement;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const quirksModeIssueDetails = inspectorIssue.details.quirksModeIssueDetails;
    if (!quirksModeIssueDetails) {
      console.warn("Quirks Mode issue without details received.");
      return [];
    }
    return [new QuirksModeIssue(quirksModeIssueDetails, issuesModel)];
  }
}
//# sourceMappingURL=QuirksModeIssue.js.map
