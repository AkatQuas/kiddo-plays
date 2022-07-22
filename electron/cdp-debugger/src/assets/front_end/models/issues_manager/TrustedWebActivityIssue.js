import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  changesToQualityCriteriaForPwas: "Changes to quality criteria for PWAs using Trusted Web Activity"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/TrustedWebActivityIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class TrustedWebActivityIssue extends Issue {
  #issueDetails;
  constructor(issueDetails) {
    const issueCode = [Protocol.Audits.InspectorIssueCode.TrustedWebActivityIssue, issueDetails.violationType].join("::");
    super(issueCode);
    this.#issueDetails = issueDetails;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    const description = issueDescriptions.get(this.#issueDetails.violationType);
    if (!description) {
      return null;
    }
    return resolveLazyDescription(description);
  }
  getCategory() {
    return IssueCategory.TrustedWebActivity;
  }
  primaryKey() {
    return `${Protocol.Audits.InspectorIssueCode.TrustedWebActivityIssue}-${JSON.stringify(this.#issueDetails)}`;
  }
  getKind() {
    return IssueKind.PageError;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const twaQualityEnforcementDetails = inspectorIssue.details.twaQualityEnforcementDetails;
    if (!twaQualityEnforcementDetails) {
      console.warn("TWA Quality Enforcement issue without details received.");
      return [];
    }
    return [new TrustedWebActivityIssue(twaQualityEnforcementDetails)];
  }
}
const twaDigitalAssetLinksFailed = {
  file: "TwaDigitalAssetLinksFailed.md",
  links: [{
    link: "https://blog.chromium.org/2020/06/changes-to-quality-criteria-for-pwas.html",
    linkTitle: i18nLazyString(UIStrings.changesToQualityCriteriaForPwas)
  }]
};
const twaHttpError = {
  file: "TwaHttpError.md",
  links: [{
    link: "https://blog.chromium.org/2020/06/changes-to-quality-criteria-for-pwas.html",
    linkTitle: i18nLazyString(UIStrings.changesToQualityCriteriaForPwas)
  }]
};
const twaPageUnavailableOffline = {
  file: "TwaPageUnavailableOffline.md",
  links: [{
    link: "https://blog.chromium.org/2020/06/changes-to-quality-criteria-for-pwas.html",
    linkTitle: i18nLazyString(UIStrings.changesToQualityCriteriaForPwas)
  }]
};
export const httpViolationCode = [
  Protocol.Audits.InspectorIssueCode.TrustedWebActivityIssue,
  Protocol.Audits.TwaQualityEnforcementViolationType.KHttpError
].join("::");
export const offlineViolationCode = [
  Protocol.Audits.InspectorIssueCode.TrustedWebActivityIssue,
  Protocol.Audits.TwaQualityEnforcementViolationType.KUnavailableOffline
].join("::");
export const assetlinkViolationCode = [
  Protocol.Audits.InspectorIssueCode.TrustedWebActivityIssue,
  Protocol.Audits.TwaQualityEnforcementViolationType.KDigitalAssetLinks
].join("::");
const issueDescriptions = /* @__PURE__ */ new Map([
  [Protocol.Audits.TwaQualityEnforcementViolationType.KHttpError, twaHttpError],
  [Protocol.Audits.TwaQualityEnforcementViolationType.KUnavailableOffline, twaPageUnavailableOffline],
  [Protocol.Audits.TwaQualityEnforcementViolationType.KDigitalAssetLinks, twaDigitalAssetLinksFailed]
]);
//# sourceMappingURL=TrustedWebActivityIssue.js.map
