import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  fedCm: "Federated Credential Management API"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/FederatedAuthRequestIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class FederatedAuthRequestIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    super({
      code: Protocol.Audits.InspectorIssueCode.FederatedAuthRequestIssue,
      umaCode: [
        Protocol.Audits.InspectorIssueCode.FederatedAuthRequestIssue,
        issueDetails.federatedAuthRequestIssueReason
      ].join("::")
    }, issuesModel);
    this.#issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.Other;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    const description = issueDescriptions.get(this.#issueDetails.federatedAuthRequestIssueReason);
    if (!description) {
      return null;
    }
    return resolveLazyDescription(description);
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails);
  }
  getKind() {
    return IssueKind.PageError;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const details = inspectorIssue.details.federatedAuthRequestIssueDetails;
    if (!details) {
      console.warn("Federated auth request issue without details received.");
      return [];
    }
    return [new FederatedAuthRequestIssue(details, issuesModel)];
  }
}
const issueDescriptions = /* @__PURE__ */ new Map([
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ApprovalDeclined,
    {
      file: "federatedAuthRequestApprovalDeclined.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.TooManyRequests,
    {
      file: "federatedAuthRequestTooManyRequests.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ManifestHttpNotFound,
    {
      file: "federatedAuthRequestManifestHttpNotFound.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ManifestNoResponse,
    {
      file: "federatedAuthRequestManifestNoResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ManifestInvalidResponse,
    {
      file: "federatedAuthRequestManifestInvalidResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ClientMetadataHttpNotFound,
    {
      file: "federatedAuthRequestClientMetadataHttpNotFound.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ClientMetadataNoResponse,
    {
      file: "federatedAuthRequestClientMetadataNoResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ClientMetadataInvalidResponse,
    {
      file: "federatedAuthRequestClientMetadataInvalidResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ErrorFetchingSignin,
    {
      file: "federatedAuthRequestErrorFetchingSignin.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.InvalidSigninResponse,
    {
      file: "federatedAuthRequestInvalidSigninResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.AccountsHttpNotFound,
    {
      file: "federatedAuthRequestAccountsHttpNotFound.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.AccountsNoResponse,
    {
      file: "federatedAuthRequestAccountsNoResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.AccountsInvalidResponse,
    {
      file: "federatedAuthRequestAccountsInvalidResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.IdTokenHttpNotFound,
    {
      file: "federatedAuthRequestIdTokenHttpNotFound.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.IdTokenNoResponse,
    {
      file: "federatedAuthRequestIdTokenNoResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.IdTokenInvalidResponse,
    {
      file: "federatedAuthRequestIdTokenInvalidResponse.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.IdTokenInvalidRequest,
    {
      file: "federatedAuthRequestIdTokenInvalidRequest.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.ErrorIdToken,
    {
      file: "federatedAuthRequestErrorIdToken.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ],
  [
    Protocol.Audits.FederatedAuthRequestIssueReason.Canceled,
    {
      file: "federatedAuthRequestCanceled.md",
      links: [{
        link: "https://fedidcg.github.io/FedCM/",
        linkTitle: i18nLazyString(UIStrings.fedCm)
      }]
    }
  ]
]);
//# sourceMappingURL=FederatedAuthRequestIssue.js.map
