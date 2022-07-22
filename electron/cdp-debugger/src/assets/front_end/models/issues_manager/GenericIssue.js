import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  crossOriginPortalPostMessage: "Portals - Same-origin communication channels"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/GenericIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class GenericIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel, issueId) {
    const issueCode = [
      Protocol.Audits.InspectorIssueCode.GenericIssue,
      issueDetails.errorType
    ].join("::");
    super(issueCode, issuesModel, issueId);
    this.#issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.Generic;
  }
  primaryKey() {
    return `${this.code()}-(${this.#issueDetails.frameId})`;
  }
  getDescription() {
    const description = issueDescriptions.get(this.#issueDetails.errorType);
    if (!description) {
      return null;
    }
    return resolveLazyDescription(description);
  }
  details() {
    return this.#issueDetails;
  }
  getKind() {
    return IssueKind.Improvement;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const genericDetails = inspectorIssue.details.genericIssueDetails;
    if (!genericDetails) {
      console.warn("Generic issue without details received.");
      return [];
    }
    return [new GenericIssue(genericDetails, issuesModel, inspectorIssue.issueId)];
  }
}
export const genericCrossOriginPortalPostMessageError = {
  file: "genericCrossOriginPortalPostMessageError.md",
  links: [{
    link: "https://github.com/WICG/portals#same-origin-communication-channels",
    linkTitle: i18nLazyString(UIStrings.crossOriginPortalPostMessage)
  }]
};
export const genericCrossOriginPortalPostMessageCode = [
  Protocol.Audits.InspectorIssueCode.GenericIssue,
  Protocol.Audits.GenericIssueErrorType.CrossOriginPortalPostMessageError
].join("::");
const issueDescriptions = /* @__PURE__ */ new Map([
  [Protocol.Audits.GenericIssueErrorType.CrossOriginPortalPostMessageError, genericCrossOriginPortalPostMessageError]
]);
//# sourceMappingURL=GenericIssue.js.map
