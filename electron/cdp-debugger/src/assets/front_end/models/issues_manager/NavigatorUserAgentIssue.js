import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { isCausedByThirdParty } from "./CookieIssue.js";
const UIStrings = {
  userAgentReduction: "User-Agent String Reduction"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/NavigatorUserAgentIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var IssueCode = /* @__PURE__ */ ((IssueCode2) => {
  IssueCode2["NavigatorUserAgentIssue"] = "DeprecationIssue::NavigatorUserAgentIssue";
  return IssueCode2;
})(IssueCode || {});
export class NavigatorUserAgentIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    super("DeprecationIssue::NavigatorUserAgentIssue" /* NavigatorUserAgentIssue */, issuesModel);
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
      file: "deprecationNavigatorUserAgent.md",
      links: [{
        link: "https://blog.chromium.org/2021/09/user-agent-reduction-origin-trial-and-dates.html",
        linkTitle: i18nString(UIStrings.userAgentReduction)
      }]
    };
  }
  sources() {
    if (this.#issueDetails.location) {
      return [this.#issueDetails.location];
    }
    return [];
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails);
  }
  getKind() {
    return IssueKind.Improvement;
  }
  isCausedByThirdParty() {
    const topFrame = SDK.FrameManager.FrameManager.instance().getTopFrame();
    return isCausedByThirdParty(topFrame, this.#issueDetails.url);
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const details = inspectorIssue.details.navigatorUserAgentIssueDetails;
    if (!details) {
      console.warn("NavigatorUserAgent issue without details received.");
      return [];
    }
    return [new NavigatorUserAgentIssue(details, issuesModel)];
  }
}
//# sourceMappingURL=NavigatorUserAgentIssue.js.map
