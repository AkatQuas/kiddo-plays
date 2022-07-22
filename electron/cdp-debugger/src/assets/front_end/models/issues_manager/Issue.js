import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  improvements: "Improvements",
  pageErrors: "Page Errors",
  breakingChanges: "Breaking Changes",
  pageErrorIssue: "A page error issue: the page is not working correctly",
  breakingChangeIssue: "A breaking change issue: the page may stop working in an upcoming version of Chrome",
  improvementIssue: "An improvement issue: there is an opportunity to improve the page"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/Issue.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var IssueCategory = /* @__PURE__ */ ((IssueCategory2) => {
  IssueCategory2["CrossOriginEmbedderPolicy"] = "CrossOriginEmbedderPolicy";
  IssueCategory2["Generic"] = "Generic";
  IssueCategory2["MixedContent"] = "MixedContent";
  IssueCategory2["Cookie"] = "Cookie";
  IssueCategory2["HeavyAd"] = "HeavyAd";
  IssueCategory2["ContentSecurityPolicy"] = "ContentSecurityPolicy";
  IssueCategory2["TrustedWebActivity"] = "TrustedWebActivity";
  IssueCategory2["LowTextContrast"] = "LowTextContrast";
  IssueCategory2["Cors"] = "Cors";
  IssueCategory2["AttributionReporting"] = "AttributionReporting";
  IssueCategory2["QuirksMode"] = "QuirksMode";
  IssueCategory2["Other"] = "Other";
  return IssueCategory2;
})(IssueCategory || {});
export var IssueKind = /* @__PURE__ */ ((IssueKind2) => {
  IssueKind2["PageError"] = "PageError";
  IssueKind2["BreakingChange"] = "BreakingChange";
  IssueKind2["Improvement"] = "Improvement";
  return IssueKind2;
})(IssueKind || {});
export function getIssueKindName(issueKind) {
  switch (issueKind) {
    case "BreakingChange" /* BreakingChange */:
      return i18nString(UIStrings.breakingChanges);
    case "Improvement" /* Improvement */:
      return i18nString(UIStrings.improvements);
    case "PageError" /* PageError */:
      return i18nString(UIStrings.pageErrors);
  }
}
export function getIssueKindDescription(issueKind) {
  switch (issueKind) {
    case "PageError" /* PageError */:
      return i18nString(UIStrings.pageErrorIssue);
    case "BreakingChange" /* BreakingChange */:
      return i18nString(UIStrings.breakingChangeIssue);
    case "Improvement" /* Improvement */:
      return i18nString(UIStrings.improvementIssue);
  }
}
export function unionIssueKind(a, b) {
  if (a === "PageError" /* PageError */ || b === "PageError" /* PageError */) {
    return "PageError" /* PageError */;
  }
  if (a === "BreakingChange" /* BreakingChange */ || b === "BreakingChange" /* BreakingChange */) {
    return "BreakingChange" /* BreakingChange */;
  }
  return "Improvement" /* Improvement */;
}
export function getShowThirdPartyIssuesSetting() {
  return Common.Settings.Settings.instance().createSetting("showThirdPartyIssues", false);
}
export class Issue {
  #issueCode;
  #issuesModel;
  issueId = void 0;
  #hidden;
  constructor(code, issuesModel = null, issueId) {
    this.#issueCode = typeof code === "object" ? code.code : code;
    this.#issuesModel = issuesModel;
    this.issueId = issueId;
    Host.userMetrics.issueCreated(typeof code === "string" ? code : code.umaCode);
    this.#hidden = false;
  }
  code() {
    return this.#issueCode;
  }
  getBlockedByResponseDetails() {
    return [];
  }
  cookies() {
    return [];
  }
  rawCookieLines() {
    return [];
  }
  elements() {
    return [];
  }
  requests() {
    return [];
  }
  sources() {
    return [];
  }
  isAssociatedWithRequestId(requestId) {
    for (const request of this.requests()) {
      if (request.requestId === requestId) {
        return true;
      }
    }
    return false;
  }
  model() {
    return this.#issuesModel;
  }
  isCausedByThirdParty() {
    return false;
  }
  getIssueId() {
    return this.issueId;
  }
  isHidden() {
    return this.#hidden;
  }
  setHidden(hidden) {
    this.#hidden = hidden;
  }
}
export function toZeroBasedLocation(location) {
  if (!location) {
    return void 0;
  }
  return {
    url: location.url,
    scriptId: location.scriptId,
    lineNumber: location.lineNumber,
    columnNumber: location.columnNumber === 0 ? void 0 : location.columnNumber - 1
  };
}
//# sourceMappingURL=Issue.js.map
