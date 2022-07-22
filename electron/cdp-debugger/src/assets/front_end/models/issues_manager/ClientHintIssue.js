import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  clientHintsInfrastructure: "Client Hints Infrastructure"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/ClientHintIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class ClientHintIssue extends Issue {
  issueDetails;
  constructor(issueDetails, issuesModel) {
    super({
      code: Protocol.Audits.InspectorIssueCode.ClientHintIssue,
      umaCode: [Protocol.Audits.InspectorIssueCode.ClientHintIssue, issueDetails.clientHintIssueReason].join("::")
    }, issuesModel);
    this.issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.Other;
  }
  details() {
    return this.issueDetails;
  }
  getDescription() {
    const description = issueDescriptions.get(this.issueDetails.clientHintIssueReason);
    if (!description) {
      return null;
    }
    return resolveLazyDescription(description);
  }
  sources() {
    return [this.issueDetails.sourceCodeLocation];
  }
  primaryKey() {
    return JSON.stringify(this.issueDetails);
  }
  getKind() {
    return IssueKind.BreakingChange;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const details = inspectorIssue.details.clientHintIssueDetails;
    if (!details) {
      console.warn("Client Hint issue without details received.");
      return [];
    }
    return [new ClientHintIssue(details, issuesModel)];
  }
}
const issueDescriptions = /* @__PURE__ */ new Map([
  [
    Protocol.Audits.ClientHintIssueReason.MetaTagAllowListInvalidOrigin,
    {
      file: "clientHintMetaTagAllowListInvalidOrigin.md",
      links: [{
        link: "https://wicg.github.io/client-hints-infrastructure/",
        linkTitle: i18nLazyString(UIStrings.clientHintsInfrastructure)
      }]
    }
  ],
  [
    Protocol.Audits.ClientHintIssueReason.MetaTagModifiedHTML,
    {
      file: "clientHintMetaTagModifiedHTML.md",
      links: [{
        link: "https://wicg.github.io/client-hints-infrastructure/",
        linkTitle: i18nLazyString(UIStrings.clientHintsInfrastructure)
      }]
    }
  ]
]);
//# sourceMappingURL=ClientHintIssue.js.map
