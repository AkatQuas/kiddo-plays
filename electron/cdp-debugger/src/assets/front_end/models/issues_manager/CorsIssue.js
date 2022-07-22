import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
const UIStrings = {
  corsPrivateNetworkAccess: "Private Network Access",
  CORS: "Cross-Origin Resource Sharing (`CORS`)"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/CorsIssue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var IssueCode = /* @__PURE__ */ ((IssueCode2) => {
  IssueCode2["InsecurePrivateNetwork"] = "CorsIssue::InsecurePrivateNetwork";
  IssueCode2["InvalidHeaderValues"] = "CorsIssue::InvalidHeaders";
  IssueCode2["WildcardOriginNotAllowed"] = "CorsIssue::WildcardOriginWithCredentials";
  IssueCode2["PreflightResponseInvalid"] = "CorsIssue::PreflightResponseInvalid";
  IssueCode2["OriginMismatch"] = "CorsIssue::OriginMismatch";
  IssueCode2["AllowCredentialsRequired"] = "CorsIssue::AllowCredentialsRequired";
  IssueCode2["MethodDisallowedByPreflightResponse"] = "CorsIssue::MethodDisallowedByPreflightResponse";
  IssueCode2["HeaderDisallowedByPreflightResponse"] = "CorsIssue::HeaderDisallowedByPreflightResponse";
  IssueCode2["RedirectContainsCredentials"] = "CorsIssue::RedirectContainsCredentials";
  IssueCode2["DisallowedByMode"] = "CorsIssue::DisallowedByMode";
  IssueCode2["CorsDisabledScheme"] = "CorsIssue::CorsDisabledScheme";
  IssueCode2["PreflightMissingAllowExternal"] = "CorsIssue::PreflightMissingAllowExternal";
  IssueCode2["PreflightInvalidAllowExternal"] = "CorsIssue::PreflightInvalidAllowExternal";
  IssueCode2["NoCorsRedirectModeNotFollow"] = "CorsIssue::NoCorsRedirectModeNotFollow";
  IssueCode2["InvalidPrivateNetworkAccess"] = "CorsIssue::InvalidPrivateNetworkAccess";
  IssueCode2["UnexpectedPrivateNetworkAccess"] = "CorsIssue::UnexpectedPrivateNetworkAccess";
  IssueCode2["PreflightAllowPrivateNetworkError"] = "CorsIssue::PreflightAllowPrivateNetworkError";
  return IssueCode2;
})(IssueCode || {});
function getIssueCode(details) {
  switch (details.corsErrorStatus.corsError) {
    case Protocol.Network.CorsError.InvalidAllowMethodsPreflightResponse:
    case Protocol.Network.CorsError.InvalidAllowHeadersPreflightResponse:
    case Protocol.Network.CorsError.PreflightMissingAllowOriginHeader:
    case Protocol.Network.CorsError.PreflightMultipleAllowOriginValues:
    case Protocol.Network.CorsError.PreflightInvalidAllowOriginValue:
    case Protocol.Network.CorsError.MissingAllowOriginHeader:
    case Protocol.Network.CorsError.MultipleAllowOriginValues:
    case Protocol.Network.CorsError.InvalidAllowOriginValue:
      return "CorsIssue::InvalidHeaders" /* InvalidHeaderValues */;
    case Protocol.Network.CorsError.PreflightWildcardOriginNotAllowed:
    case Protocol.Network.CorsError.WildcardOriginNotAllowed:
      return "CorsIssue::WildcardOriginWithCredentials" /* WildcardOriginNotAllowed */;
    case Protocol.Network.CorsError.PreflightInvalidStatus:
    case Protocol.Network.CorsError.PreflightDisallowedRedirect:
    case Protocol.Network.CorsError.InvalidResponse:
      return "CorsIssue::PreflightResponseInvalid" /* PreflightResponseInvalid */;
    case Protocol.Network.CorsError.AllowOriginMismatch:
    case Protocol.Network.CorsError.PreflightAllowOriginMismatch:
      return "CorsIssue::OriginMismatch" /* OriginMismatch */;
    case Protocol.Network.CorsError.InvalidAllowCredentials:
    case Protocol.Network.CorsError.PreflightInvalidAllowCredentials:
      return "CorsIssue::AllowCredentialsRequired" /* AllowCredentialsRequired */;
    case Protocol.Network.CorsError.MethodDisallowedByPreflightResponse:
      return "CorsIssue::MethodDisallowedByPreflightResponse" /* MethodDisallowedByPreflightResponse */;
    case Protocol.Network.CorsError.HeaderDisallowedByPreflightResponse:
      return "CorsIssue::HeaderDisallowedByPreflightResponse" /* HeaderDisallowedByPreflightResponse */;
    case Protocol.Network.CorsError.RedirectContainsCredentials:
      return "CorsIssue::RedirectContainsCredentials" /* RedirectContainsCredentials */;
    case Protocol.Network.CorsError.DisallowedByMode:
      return "CorsIssue::DisallowedByMode" /* DisallowedByMode */;
    case Protocol.Network.CorsError.CorsDisabledScheme:
      return "CorsIssue::CorsDisabledScheme" /* CorsDisabledScheme */;
    case Protocol.Network.CorsError.PreflightMissingAllowExternal:
      return "CorsIssue::PreflightMissingAllowExternal" /* PreflightMissingAllowExternal */;
    case Protocol.Network.CorsError.PreflightInvalidAllowExternal:
      return "CorsIssue::PreflightInvalidAllowExternal" /* PreflightInvalidAllowExternal */;
    case Protocol.Network.CorsError.InsecurePrivateNetwork:
      return "CorsIssue::InsecurePrivateNetwork" /* InsecurePrivateNetwork */;
    case Protocol.Network.CorsError.NoCorsRedirectModeNotFollow:
      return "CorsIssue::NoCorsRedirectModeNotFollow" /* NoCorsRedirectModeNotFollow */;
    case Protocol.Network.CorsError.InvalidPrivateNetworkAccess:
      return "CorsIssue::InvalidPrivateNetworkAccess" /* InvalidPrivateNetworkAccess */;
    case Protocol.Network.CorsError.UnexpectedPrivateNetworkAccess:
      return "CorsIssue::UnexpectedPrivateNetworkAccess" /* UnexpectedPrivateNetworkAccess */;
    case Protocol.Network.CorsError.PreflightMissingAllowPrivateNetwork:
    case Protocol.Network.CorsError.PreflightInvalidAllowPrivateNetwork:
      return "CorsIssue::PreflightAllowPrivateNetworkError" /* PreflightAllowPrivateNetworkError */;
  }
}
export class CorsIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel, issueId) {
    super(getIssueCode(issueDetails), issuesModel, issueId);
    this.#issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.Cors;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    switch (getIssueCode(this.#issueDetails)) {
      case "CorsIssue::InsecurePrivateNetwork" /* InsecurePrivateNetwork */:
        return {
          file: "corsInsecurePrivateNetwork.md",
          links: [{
            link: "https://developer.chrome.com/blog/private-network-access-update",
            linkTitle: i18nString(UIStrings.corsPrivateNetworkAccess)
          }]
        };
      case "CorsIssue::PreflightAllowPrivateNetworkError" /* PreflightAllowPrivateNetworkError */:
        return {
          file: "corsPreflightAllowPrivateNetworkError.md",
          links: [{
            link: "https://developer.chrome.com/blog/private-network-access-update",
            linkTitle: i18nString(UIStrings.corsPrivateNetworkAccess)
          }]
        };
      case "CorsIssue::InvalidHeaders" /* InvalidHeaderValues */:
        return {
          file: "corsInvalidHeaderValues.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::WildcardOriginWithCredentials" /* WildcardOriginNotAllowed */:
        return {
          file: "corsWildcardOriginNotAllowed.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::PreflightResponseInvalid" /* PreflightResponseInvalid */:
        return {
          file: "corsPreflightResponseInvalid.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::OriginMismatch" /* OriginMismatch */:
        return {
          file: "corsOriginMismatch.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::AllowCredentialsRequired" /* AllowCredentialsRequired */:
        return {
          file: "corsAllowCredentialsRequired.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::MethodDisallowedByPreflightResponse" /* MethodDisallowedByPreflightResponse */:
        return {
          file: "corsMethodDisallowedByPreflightResponse.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::HeaderDisallowedByPreflightResponse" /* HeaderDisallowedByPreflightResponse */:
        return {
          file: "corsHeaderDisallowedByPreflightResponse.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::RedirectContainsCredentials" /* RedirectContainsCredentials */:
        return {
          file: "corsRedirectContainsCredentials.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::DisallowedByMode" /* DisallowedByMode */:
        return {
          file: "corsDisallowedByMode.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::CorsDisabledScheme" /* CorsDisabledScheme */:
        return {
          file: "corsDisabledScheme.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::NoCorsRedirectModeNotFollow" /* NoCorsRedirectModeNotFollow */:
        return {
          file: "corsNoCorsRedirectModeNotFollow.md",
          links: [{
            link: "https://web.dev/cross-origin-resource-sharing",
            linkTitle: i18nString(UIStrings.CORS)
          }]
        };
      case "CorsIssue::PreflightMissingAllowExternal" /* PreflightMissingAllowExternal */:
      case "CorsIssue::PreflightInvalidAllowExternal" /* PreflightInvalidAllowExternal */:
      case "CorsIssue::InvalidPrivateNetworkAccess" /* InvalidPrivateNetworkAccess */:
      case "CorsIssue::UnexpectedPrivateNetworkAccess" /* UnexpectedPrivateNetworkAccess */:
        return null;
    }
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails);
  }
  getKind() {
    if (this.#issueDetails.isWarning && (this.#issueDetails.corsErrorStatus.corsError === Protocol.Network.CorsError.InsecurePrivateNetwork || this.#issueDetails.corsErrorStatus.corsError === Protocol.Network.CorsError.PreflightMissingAllowPrivateNetwork || this.#issueDetails.corsErrorStatus.corsError === Protocol.Network.CorsError.PreflightInvalidAllowPrivateNetwork)) {
      return IssueKind.BreakingChange;
    }
    return IssueKind.PageError;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const corsIssueDetails = inspectorIssue.details.corsIssueDetails;
    if (!corsIssueDetails) {
      console.warn("Cors issue without details received.");
      return [];
    }
    return [new CorsIssue(corsIssueDetails, issuesModel, inspectorIssue.issueId)];
  }
}
//# sourceMappingURL=CorsIssue.js.map
