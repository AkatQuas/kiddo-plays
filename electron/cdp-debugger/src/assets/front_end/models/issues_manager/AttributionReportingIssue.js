import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
export var IssueCode = /* @__PURE__ */ ((IssueCode2) => {
  IssueCode2["PermissionPolicyDisabled"] = "AttributionReportingIssue::PermissionPolicyDisabled";
  IssueCode2["AttributionSourceUntrustworthyFrameOrigin"] = "AttributionReportingIssue::AttributionSourceUntrustworthyFrameOrigin";
  IssueCode2["AttributionSourceUntrustworthyOrigin"] = "AttributionReportingIssue::AttributionSourceUntrustworthyOrigin";
  IssueCode2["AttributionUntrustworthyFrameOrigin"] = "AttributionReportingIssue::AttributionUntrustworthyFrameOrigin";
  IssueCode2["AttributionUntrustworthyOrigin"] = "AttributionReportingIssue::AttributionUntrustworthyOrigin";
  IssueCode2["InvalidHeader"] = "AttributionReportingIssue::InvalidHeader";
  return IssueCode2;
})(IssueCode || {});
function getIssueCode(details) {
  switch (details.violationType) {
    case Protocol.Audits.AttributionReportingIssueType.PermissionPolicyDisabled:
      return "AttributionReportingIssue::PermissionPolicyDisabled" /* PermissionPolicyDisabled */;
    case Protocol.Audits.AttributionReportingIssueType.AttributionSourceUntrustworthyOrigin:
      return details.frame !== void 0 ? "AttributionReportingIssue::AttributionSourceUntrustworthyFrameOrigin" /* AttributionSourceUntrustworthyFrameOrigin */ : "AttributionReportingIssue::AttributionSourceUntrustworthyOrigin" /* AttributionSourceUntrustworthyOrigin */;
    case Protocol.Audits.AttributionReportingIssueType.AttributionUntrustworthyOrigin:
      return details.frame !== void 0 ? "AttributionReportingIssue::AttributionUntrustworthyFrameOrigin" /* AttributionUntrustworthyFrameOrigin */ : "AttributionReportingIssue::AttributionUntrustworthyOrigin" /* AttributionUntrustworthyOrigin */;
    case Protocol.Audits.AttributionReportingIssueType.InvalidHeader:
      return "AttributionReportingIssue::InvalidHeader" /* InvalidHeader */;
  }
}
export class AttributionReportingIssue extends Issue {
  issueDetails;
  constructor(issueDetails, issuesModel) {
    super(getIssueCode(issueDetails), issuesModel);
    this.issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.AttributionReporting;
  }
  getDescription() {
    switch (this.code()) {
      case "AttributionReportingIssue::PermissionPolicyDisabled" /* PermissionPolicyDisabled */:
        return {
          file: "arPermissionPolicyDisabled.md",
          links: []
        };
      case "AttributionReportingIssue::AttributionSourceUntrustworthyFrameOrigin" /* AttributionSourceUntrustworthyFrameOrigin */:
        return {
          file: "arAttributionSourceUntrustworthyFrameOrigin.md",
          links: []
        };
      case "AttributionReportingIssue::AttributionSourceUntrustworthyOrigin" /* AttributionSourceUntrustworthyOrigin */:
        return {
          file: "arAttributionSourceUntrustworthyOrigin.md",
          links: [
            {
              link: "https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributiondestination-required",
              linkTitle: "attributiondestination attribute"
            },
            {
              link: "https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributionreportto",
              linkTitle: "attributionreportto attribute"
            }
          ]
        };
      case "AttributionReportingIssue::AttributionUntrustworthyFrameOrigin" /* AttributionUntrustworthyFrameOrigin */:
        return {
          file: "arAttributionUntrustworthyFrameOrigin.md",
          links: []
        };
      case "AttributionReportingIssue::AttributionUntrustworthyOrigin" /* AttributionUntrustworthyOrigin */:
        return {
          file: "arAttributionUntrustworthyOrigin.md",
          links: []
        };
      case "AttributionReportingIssue::InvalidHeader" /* InvalidHeader */:
        return {
          file: "arInvalidHeader.md",
          links: []
        };
    }
  }
  primaryKey() {
    return JSON.stringify(this.issueDetails);
  }
  getKind() {
    return IssueKind.PageError;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const { attributionReportingIssueDetails } = inspectorIssue.details;
    if (!attributionReportingIssueDetails) {
      console.warn("Attribution Reporting issue without details received.");
      return [];
    }
    return [new AttributionReportingIssue(attributionReportingIssueDetails, issuesModel)];
  }
}
//# sourceMappingURL=AttributionReportingIssue.js.map
