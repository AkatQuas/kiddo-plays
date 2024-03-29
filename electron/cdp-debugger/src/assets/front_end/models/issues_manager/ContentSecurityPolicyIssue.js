import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  contentSecurityPolicySource: "Content Security Policy - Source Allowlists",
  contentSecurityPolicyInlineCode: "Content Security Policy - Inline Code",
  contentSecurityPolicyEval: "Content Security Policy - Eval",
  trustedTypesFixViolations: "Trusted Types - Fix violations",
  trustedTypesPolicyViolation: "Trusted Types - Policy violation"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/ContentSecurityPolicyIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class ContentSecurityPolicyIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel, issueId) {
    const issueCode = [
      Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
      issueDetails.contentSecurityPolicyViolationType
    ].join("::");
    super(issueCode, issuesModel, issueId);
    this.#issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.ContentSecurityPolicy;
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails, [
      "blockedURL",
      "contentSecurityPolicyViolationType",
      "violatedDirective",
      "isReportOnly",
      "sourceCodeLocation",
      "url",
      "lineNumber",
      "columnNumber",
      "violatingNodeId"
    ]);
  }
  getDescription() {
    const description = issueDescriptions.get(this.#issueDetails.contentSecurityPolicyViolationType);
    if (!description) {
      return null;
    }
    return resolveLazyDescription(description);
  }
  details() {
    return this.#issueDetails;
  }
  getKind() {
    if (this.#issueDetails.isReportOnly) {
      return IssueKind.Improvement;
    }
    return IssueKind.PageError;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const cspDetails = inspectorIssue.details.contentSecurityPolicyIssueDetails;
    if (!cspDetails) {
      console.warn("Content security policy issue without details received.");
      return [];
    }
    return [new ContentSecurityPolicyIssue(cspDetails, issuesModel, inspectorIssue.issueId)];
  }
}
const cspURLViolation = {
  file: "cspURLViolation.md",
  links: [{
    link: "https://developers.google.com/web/fundamentals/security/csp#source_allowlists",
    linkTitle: i18nLazyString(UIStrings.contentSecurityPolicySource)
  }]
};
const cspInlineViolation = {
  file: "cspInlineViolation.md",
  links: [{
    link: "https://developers.google.com/web/fundamentals/security/csp#inline_code_is_considered_harmful",
    linkTitle: i18nLazyString(UIStrings.contentSecurityPolicyInlineCode)
  }]
};
const cspEvalViolation = {
  file: "cspEvalViolation.md",
  links: [{
    link: "https://developers.google.com/web/fundamentals/security/csp#eval_too",
    linkTitle: i18nLazyString(UIStrings.contentSecurityPolicyEval)
  }]
};
const cspTrustedTypesSinkViolation = {
  file: "cspTrustedTypesSinkViolation.md",
  links: [{
    link: "https://web.dev/trusted-types/#fix-the-violations",
    linkTitle: i18nLazyString(UIStrings.trustedTypesFixViolations)
  }]
};
const cspTrustedTypesPolicyViolation = {
  file: "cspTrustedTypesPolicyViolation.md",
  links: [{ link: "https://web.dev/trusted-types/", linkTitle: i18nLazyString(UIStrings.trustedTypesPolicyViolation) }]
};
export const urlViolationCode = [
  Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
  Protocol.Audits.ContentSecurityPolicyViolationType.KURLViolation
].join("::");
export const inlineViolationCode = [
  Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
  Protocol.Audits.ContentSecurityPolicyViolationType.KInlineViolation
].join("::");
export const evalViolationCode = [
  Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
  Protocol.Audits.ContentSecurityPolicyViolationType.KEvalViolation
].join("::");
export const trustedTypesSinkViolationCode = [
  Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
  Protocol.Audits.ContentSecurityPolicyViolationType.KTrustedTypesSinkViolation
].join("::");
export const trustedTypesPolicyViolationCode = [
  Protocol.Audits.InspectorIssueCode.ContentSecurityPolicyIssue,
  Protocol.Audits.ContentSecurityPolicyViolationType.KTrustedTypesPolicyViolation
].join("::");
const issueDescriptions = /* @__PURE__ */ new Map([
  [Protocol.Audits.ContentSecurityPolicyViolationType.KURLViolation, cspURLViolation],
  [Protocol.Audits.ContentSecurityPolicyViolationType.KInlineViolation, cspInlineViolation],
  [Protocol.Audits.ContentSecurityPolicyViolationType.KEvalViolation, cspEvalViolation],
  [Protocol.Audits.ContentSecurityPolicyViolationType.KTrustedTypesSinkViolation, cspTrustedTypesSinkViolation],
  [Protocol.Audits.ContentSecurityPolicyViolationType.KTrustedTypesPolicyViolation, cspTrustedTypesPolicyViolation]
]);
//# sourceMappingURL=ContentSecurityPolicyIssue.js.map
