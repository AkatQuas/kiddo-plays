import * as i18n from "../../core/i18n/i18n.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
const UIStrings = {
  colorAndContrastAccessibility: "Color and contrast accessibility"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/LowTextContrastIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class LowTextContrastIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    super("LowTextContrastIssue", issuesModel);
    this.#issueDetails = issueDetails;
  }
  primaryKey() {
    return `${this.code()}-(${this.#issueDetails.violatingNodeId})`;
  }
  getCategory() {
    return IssueCategory.LowTextContrast;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    return {
      file: "LowTextContrast.md",
      links: [
        {
          link: "https://web.dev/color-and-contrast-accessibility/",
          linkTitle: i18nString(UIStrings.colorAndContrastAccessibility)
        }
      ]
    };
  }
  getKind() {
    return IssueKind.Improvement;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const lowTextContrastIssueDetails = inspectorIssue.details.lowTextContrastIssueDetails;
    if (!lowTextContrastIssueDetails) {
      console.warn("LowTextContrast issue without details received.");
      return [];
    }
    return [new LowTextContrastIssue(lowTextContrastIssueDetails, issuesModel)];
  }
}
//# sourceMappingURL=LowTextContrastIssue.js.map
