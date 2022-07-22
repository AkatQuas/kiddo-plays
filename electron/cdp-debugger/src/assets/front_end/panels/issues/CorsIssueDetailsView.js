import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Protocol from "../../generated/protocol.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import { AffectedItem, AffectedResourcesView } from "./AffectedResourcesView.js";
const UIStrings = {
  nRequests: "{n, plural, =1 {# request} other {# requests}}",
  warning: "warning",
  blocked: "blocked",
  status: "Status",
  request: "Request",
  resourceAddressSpace: "Resource Address",
  initiatorAddressSpace: "Initiator Address",
  secure: "secure",
  insecure: "insecure",
  initiatorContext: "Initiator Context",
  preflightRequestIfProblematic: "Preflight Request (if problematic)",
  preflightRequest: "Preflight Request",
  header: "Header",
  problem: "Problem",
  invalidValue: "Invalid Value (if available)",
  problemMissingHeader: "Missing Header",
  problemMultipleValues: "Multiple Values",
  problemInvalidValue: "Invalid Value",
  preflightDisallowedRedirect: "Response to preflight was a redirect",
  preflightInvalidStatus: "HTTP status of preflight request didn't indicate success",
  allowedOrigin: "Allowed Origin (from header)",
  allowCredentialsValueFromHeader: "`Access-Control-Allow-Credentials` Header Value",
  disallowedRequestMethod: "Disallowed Request Method",
  disallowedRequestHeader: "Disallowed Request Header",
  sourceLocation: "Source Location",
  unsupportedScheme: "Unsupported Scheme",
  failedRequest: "Failed Request"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/CorsIssueDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class CorsIssueDetailsView extends AffectedResourcesView {
  constructor(parent, issue) {
    super(parent, issue);
    this.affectedResourcesCountElement.classList.add("cors-issue-affected-resource-label");
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
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nRequests, { n: count });
  }
  #appendDetails(issueCode, issues) {
    const header = document.createElement("tr");
    this.appendColumnTitle(header, i18nString(UIStrings.request));
    this.appendColumnTitle(header, i18nString(UIStrings.status));
    switch (issueCode) {
      case IssuesManager.CorsIssue.IssueCode.InvalidHeaderValues:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequestIfProblematic));
        this.appendColumnTitle(header, i18nString(UIStrings.header));
        this.appendColumnTitle(header, i18nString(UIStrings.problem));
        this.appendColumnTitle(header, i18nString(UIStrings.invalidValue));
        break;
      case IssuesManager.CorsIssue.IssueCode.WildcardOriginNotAllowed:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequestIfProblematic));
        break;
      case IssuesManager.CorsIssue.IssueCode.PreflightResponseInvalid:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequest));
        this.appendColumnTitle(header, i18nString(UIStrings.problem));
        break;
      case IssuesManager.CorsIssue.IssueCode.OriginMismatch:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequestIfProblematic));
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorContext));
        this.appendColumnTitle(header, i18nString(UIStrings.allowedOrigin));
        break;
      case IssuesManager.CorsIssue.IssueCode.AllowCredentialsRequired:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequestIfProblematic));
        this.appendColumnTitle(header, i18nString(UIStrings.allowCredentialsValueFromHeader));
        break;
      case IssuesManager.CorsIssue.IssueCode.InsecurePrivateNetwork:
        this.appendColumnTitle(header, i18nString(UIStrings.resourceAddressSpace));
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorAddressSpace));
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorContext));
        break;
      case IssuesManager.CorsIssue.IssueCode.PreflightAllowPrivateNetworkError:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequest));
        this.appendColumnTitle(header, i18nString(UIStrings.invalidValue));
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorAddressSpace));
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorContext));
        break;
      case IssuesManager.CorsIssue.IssueCode.MethodDisallowedByPreflightResponse:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequest));
        this.appendColumnTitle(header, i18nString(UIStrings.disallowedRequestMethod));
        break;
      case IssuesManager.CorsIssue.IssueCode.HeaderDisallowedByPreflightResponse:
        this.appendColumnTitle(header, i18nString(UIStrings.preflightRequest));
        this.appendColumnTitle(header, i18nString(UIStrings.disallowedRequestHeader));
        break;
      case IssuesManager.CorsIssue.IssueCode.RedirectContainsCredentials:
        break;
      case IssuesManager.CorsIssue.IssueCode.DisallowedByMode:
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorContext));
        this.appendColumnTitle(header, i18nString(UIStrings.sourceLocation));
        break;
      case IssuesManager.CorsIssue.IssueCode.CorsDisabledScheme:
        this.appendColumnTitle(header, i18nString(UIStrings.initiatorContext));
        this.appendColumnTitle(header, i18nString(UIStrings.sourceLocation));
        this.appendColumnTitle(header, i18nString(UIStrings.unsupportedScheme));
        break;
      case IssuesManager.CorsIssue.IssueCode.NoCorsRedirectModeNotFollow:
        this.appendColumnTitle(header, i18nString(UIStrings.sourceLocation));
        break;
      default:
        Platform.assertUnhandled(issueCode);
    }
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const issue of issues) {
      count++;
      this.#appendDetail(issueCode, issue);
    }
    this.updateAffectedResourceCount(count);
  }
  #appendSecureContextCell(element, isSecureContext) {
    if (isSecureContext === void 0) {
      this.appendIssueDetailCell(element, "");
      return;
    }
    this.appendIssueDetailCell(element, isSecureContext ? i18nString(UIStrings.secure) : i18nString(UIStrings.insecure));
  }
  static getHeaderFromError(corsError) {
    switch (corsError) {
      case Protocol.Network.CorsError.InvalidAllowHeadersPreflightResponse:
        return "Access-Control-Allow-Headers";
      case Protocol.Network.CorsError.InvalidAllowMethodsPreflightResponse:
      case Protocol.Network.CorsError.MethodDisallowedByPreflightResponse:
        return "Access-Control-Allow-Methods";
      case Protocol.Network.CorsError.PreflightMissingAllowOriginHeader:
      case Protocol.Network.CorsError.PreflightMultipleAllowOriginValues:
      case Protocol.Network.CorsError.PreflightInvalidAllowOriginValue:
      case Protocol.Network.CorsError.MissingAllowOriginHeader:
      case Protocol.Network.CorsError.MultipleAllowOriginValues:
      case Protocol.Network.CorsError.InvalidAllowOriginValue:
      case Protocol.Network.CorsError.WildcardOriginNotAllowed:
      case Protocol.Network.CorsError.PreflightWildcardOriginNotAllowed:
      case Protocol.Network.CorsError.AllowOriginMismatch:
      case Protocol.Network.CorsError.PreflightAllowOriginMismatch:
        return "Access-Control-Allow-Origin";
      case Protocol.Network.CorsError.InvalidAllowCredentials:
      case Protocol.Network.CorsError.PreflightInvalidAllowCredentials:
        return "Access-Control-Allow-Credentials";
      case Protocol.Network.CorsError.PreflightMissingAllowPrivateNetwork:
      case Protocol.Network.CorsError.PreflightInvalidAllowPrivateNetwork:
        return "Access-Control-Allow-Private-Network";
      case Protocol.Network.CorsError.RedirectContainsCredentials:
      case Protocol.Network.CorsError.PreflightDisallowedRedirect:
        return "Location";
      case Protocol.Network.CorsError.PreflightInvalidStatus:
        return "Status-Code";
    }
    return "";
  }
  static getProblemFromError(corsErrorStatus) {
    switch (corsErrorStatus.corsError) {
      case Protocol.Network.CorsError.InvalidAllowHeadersPreflightResponse:
      case Protocol.Network.CorsError.InvalidAllowMethodsPreflightResponse:
      case Protocol.Network.CorsError.PreflightInvalidAllowOriginValue:
      case Protocol.Network.CorsError.InvalidAllowOriginValue:
        return i18nString(UIStrings.problemInvalidValue);
      case Protocol.Network.CorsError.PreflightMultipleAllowOriginValues:
      case Protocol.Network.CorsError.MultipleAllowOriginValues:
        return i18nString(UIStrings.problemMultipleValues);
      case Protocol.Network.CorsError.MissingAllowOriginHeader:
      case Protocol.Network.CorsError.PreflightMissingAllowOriginHeader:
        return i18nString(UIStrings.problemMissingHeader);
      case Protocol.Network.CorsError.PreflightInvalidStatus:
        return i18nString(UIStrings.preflightInvalidStatus);
      case Protocol.Network.CorsError.PreflightDisallowedRedirect:
        return i18nString(UIStrings.preflightDisallowedRedirect);
      case Protocol.Network.CorsError.InvalidResponse:
        return i18nString(UIStrings.failedRequest);
    }
    throw new Error("Invalid Argument");
  }
  #appendDetail(issueCode, issue) {
    const element = document.createElement("tr");
    element.classList.add("affected-resource-directive");
    const details = issue.details();
    const corsErrorStatus = details.corsErrorStatus;
    const corsError = details.corsErrorStatus.corsError;
    const highlightHeader = {
      section: NetworkForward.UIRequestLocation.UIHeaderSection.Response,
      name: CorsIssueDetailsView.getHeaderFromError(corsError)
    };
    const opts = {
      additionalOnClickAction() {
        Host.userMetrics.issuesPanelResourceOpened(IssuesManager.Issue.IssueCategory.Cors, AffectedItem.Request);
      }
    };
    switch (issueCode) {
      case IssuesManager.CorsIssue.IssueCode.InvalidHeaderValues:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        if (corsError.includes("Preflight")) {
          element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader }));
        } else {
          this.appendIssueDetailCell(element, "");
        }
        this.appendIssueDetailCell(element, CorsIssueDetailsView.getHeaderFromError(corsError), "code-example");
        this.appendIssueDetailCell(element, CorsIssueDetailsView.getProblemFromError(details.corsErrorStatus));
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter, "code-example");
        break;
      case IssuesManager.CorsIssue.IssueCode.WildcardOriginNotAllowed:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        if (corsError.includes("Preflight")) {
          element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader }));
        } else {
          this.appendIssueDetailCell(element, "");
        }
        break;
      case IssuesManager.CorsIssue.IssueCode.PreflightResponseInvalid: {
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        const specialHighlightHeader = corsError === Protocol.Network.CorsError.PreflightInvalidStatus ? {
          section: NetworkForward.UIRequestLocation.UIHeaderSection.General,
          name: "Status-Code"
        } : highlightHeader;
        element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader: specialHighlightHeader }));
        this.appendIssueDetailCell(element, CorsIssueDetailsView.getProblemFromError(details.corsErrorStatus));
        break;
      }
      case IssuesManager.CorsIssue.IssueCode.OriginMismatch:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        if (corsError.includes("Preflight")) {
          element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader }));
        } else {
          this.appendIssueDetailCell(element, "");
        }
        this.appendIssueDetailCell(element, details.initiatorOrigin ?? "", "code-example");
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter, "code-example");
        break;
      case IssuesManager.CorsIssue.IssueCode.AllowCredentialsRequired:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        if (corsError.includes("Preflight")) {
          element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader }));
        } else {
          this.appendIssueDetailCell(element, "");
        }
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter, "code-example");
        break;
      case IssuesManager.CorsIssue.IssueCode.InsecurePrivateNetwork:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        this.appendIssueDetailCell(element, details.resourceIPAddressSpace ?? "");
        this.appendIssueDetailCell(element, details.clientSecurityState?.initiatorIPAddressSpace ?? "");
        this.#appendSecureContextCell(element, details.clientSecurityState?.initiatorIsSecureContext);
        break;
      case IssuesManager.CorsIssue.IssueCode.PreflightAllowPrivateNetworkError: {
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader }));
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter, "code-example");
        this.appendIssueDetailCell(element, details.clientSecurityState?.initiatorIPAddressSpace ?? "");
        this.#appendSecureContextCell(element, details.clientSecurityState?.initiatorIsSecureContext);
        break;
      }
      case IssuesManager.CorsIssue.IssueCode.MethodDisallowedByPreflightResponse:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        element.appendChild(this.createRequestCell(details.request, { ...opts, linkToPreflight: true, highlightHeader }));
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter, "code-example");
        break;
      case IssuesManager.CorsIssue.IssueCode.HeaderDisallowedByPreflightResponse:
        element.appendChild(this.createRequestCell(details.request, {
          ...opts,
          highlightHeader: {
            section: NetworkForward.UIRequestLocation.UIHeaderSection.Request,
            name: corsErrorStatus.failedParameter
          }
        }));
        this.#appendStatus(element, details.isWarning);
        element.appendChild(this.createRequestCell(details.request, {
          ...opts,
          linkToPreflight: true,
          highlightHeader: {
            section: NetworkForward.UIRequestLocation.UIHeaderSection.Response,
            name: "Access-Control-Allow-Headers"
          }
        }));
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter, "code-example");
        break;
      case IssuesManager.CorsIssue.IssueCode.RedirectContainsCredentials:
        element.appendChild(this.createRequestCell(details.request, {
          ...opts,
          highlightHeader: {
            section: NetworkForward.UIRequestLocation.UIHeaderSection.Response,
            name: CorsIssueDetailsView.getHeaderFromError(corsError)
          }
        }));
        this.#appendStatus(element, details.isWarning);
        break;
      case IssuesManager.CorsIssue.IssueCode.DisallowedByMode:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        this.appendIssueDetailCell(element, details.initiatorOrigin ?? "", "code-example");
        this.appendSourceLocation(element, details.location, issue.model()?.getTargetIfNotDisposed());
        break;
      case IssuesManager.CorsIssue.IssueCode.CorsDisabledScheme:
        element.appendChild(this.createRequestCell(details.request, {
          ...opts,
          highlightHeader: {
            section: NetworkForward.UIRequestLocation.UIHeaderSection.Response,
            name: CorsIssueDetailsView.getHeaderFromError(corsError)
          }
        }));
        this.#appendStatus(element, details.isWarning);
        this.appendIssueDetailCell(element, details.initiatorOrigin ?? "", "code-example");
        this.appendSourceLocation(element, details.location, issue.model()?.getTargetIfNotDisposed());
        this.appendIssueDetailCell(element, details.corsErrorStatus.failedParameter ?? "", "code-example");
        break;
      case IssuesManager.CorsIssue.IssueCode.NoCorsRedirectModeNotFollow:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        this.appendSourceLocation(element, details.location, issue.model()?.getTargetIfNotDisposed());
        break;
      default:
        element.appendChild(this.createRequestCell(details.request, opts));
        this.#appendStatus(element, details.isWarning);
        Platform.assertUnhandled(issueCode);
        break;
    }
    this.affectedResources.appendChild(element);
  }
  update() {
    this.clear();
    const issues = this.issue.getCorsIssues();
    if (issues.size > 0) {
      this.#appendDetails(issues.values().next().value.code(), issues);
    } else {
      this.updateAffectedResourceCount(0);
    }
  }
}
//# sourceMappingURL=CorsIssueDetailsView.js.map
