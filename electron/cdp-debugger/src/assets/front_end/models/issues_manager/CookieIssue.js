import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  samesiteCookiesExplained: "SameSite cookies explained",
  howSchemefulSamesiteWorks: "How Schemeful Same-Site Works",
  aSecure: "a secure",
  anInsecure: "an insecure",
  firstPartySetsExplained: "`First-Party Sets` and the `SameParty` attribute"
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/CookieIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class CookieIssue extends Issue {
  #issueDetails;
  constructor(code, issueDetails, issuesModel) {
    super(code, issuesModel);
    this.#issueDetails = issueDetails;
  }
  #cookieId() {
    if (this.#issueDetails.cookie) {
      const { domain, path, name } = this.#issueDetails.cookie;
      const cookieId = `${domain};${path};${name}`;
      return cookieId;
    }
    return this.#issueDetails.rawCookieLine ?? "no-cookie-info";
  }
  primaryKey() {
    const requestId = this.#issueDetails.request ? this.#issueDetails.request.requestId : "no-request";
    return `${this.code()}-(${this.#cookieId()})-(${requestId})`;
  }
  static createIssuesFromCookieIssueDetails(cookieIssueDetails, issuesModel) {
    const issues = [];
    if (cookieIssueDetails.cookieExclusionReasons && cookieIssueDetails.cookieExclusionReasons.length > 0) {
      for (const exclusionReason of cookieIssueDetails.cookieExclusionReasons) {
        const code = CookieIssue.codeForCookieIssueDetails(exclusionReason, cookieIssueDetails.cookieWarningReasons, cookieIssueDetails.operation, cookieIssueDetails.cookieUrl);
        if (code) {
          issues.push(new CookieIssue(code, cookieIssueDetails, issuesModel));
        }
      }
      return issues;
    }
    if (cookieIssueDetails.cookieWarningReasons) {
      for (const warningReason of cookieIssueDetails.cookieWarningReasons) {
        const code = CookieIssue.codeForCookieIssueDetails(warningReason, [], cookieIssueDetails.operation, cookieIssueDetails.cookieUrl);
        if (code) {
          issues.push(new CookieIssue(code, cookieIssueDetails, issuesModel));
        }
      }
    }
    return issues;
  }
  static codeForCookieIssueDetails(reason, warningReasons, operation, cookieUrl) {
    const isURLSecure = cookieUrl && (cookieUrl.startsWith("https://") || cookieUrl.startsWith("wss://"));
    const secure = isURLSecure ? "Secure" : "Insecure";
    if (reason === Protocol.Audits.CookieExclusionReason.ExcludeSameSiteStrict || reason === Protocol.Audits.CookieExclusionReason.ExcludeSameSiteLax || reason === Protocol.Audits.CookieExclusionReason.ExcludeSameSiteUnspecifiedTreatedAsLax) {
      if (warningReasons && warningReasons.length > 0) {
        if (warningReasons.includes(Protocol.Audits.CookieWarningReason.WarnSameSiteStrictLaxDowngradeStrict)) {
          return [
            Protocol.Audits.InspectorIssueCode.CookieIssue,
            "ExcludeNavigationContextDowngrade",
            secure
          ].join("::");
        }
        if (warningReasons.includes(Protocol.Audits.CookieWarningReason.WarnSameSiteStrictCrossDowngradeStrict) || warningReasons.includes(Protocol.Audits.CookieWarningReason.WarnSameSiteStrictCrossDowngradeLax) || warningReasons.includes(Protocol.Audits.CookieWarningReason.WarnSameSiteLaxCrossDowngradeStrict) || warningReasons.includes(Protocol.Audits.CookieWarningReason.WarnSameSiteLaxCrossDowngradeLax)) {
          return [
            Protocol.Audits.InspectorIssueCode.CookieIssue,
            "ExcludeContextDowngrade",
            operation,
            secure
          ].join("::");
        }
      }
      if (reason === Protocol.Audits.CookieExclusionReason.ExcludeSameSiteUnspecifiedTreatedAsLax) {
        return [Protocol.Audits.InspectorIssueCode.CookieIssue, reason, operation].join("::");
      }
      return null;
    }
    if (reason === Protocol.Audits.CookieWarningReason.WarnSameSiteStrictLaxDowngradeStrict) {
      return [Protocol.Audits.InspectorIssueCode.CookieIssue, reason, secure].join("::");
    }
    if (reason === Protocol.Audits.CookieWarningReason.WarnSameSiteStrictCrossDowngradeStrict || reason === Protocol.Audits.CookieWarningReason.WarnSameSiteStrictCrossDowngradeLax || reason === Protocol.Audits.CookieWarningReason.WarnSameSiteLaxCrossDowngradeLax || reason === Protocol.Audits.CookieWarningReason.WarnSameSiteLaxCrossDowngradeStrict) {
      return [Protocol.Audits.InspectorIssueCode.CookieIssue, "WarnCrossDowngrade", operation, secure].join("::");
    }
    return [Protocol.Audits.InspectorIssueCode.CookieIssue, reason, operation].join("::");
  }
  cookies() {
    if (this.#issueDetails.cookie) {
      return [this.#issueDetails.cookie];
    }
    return [];
  }
  rawCookieLines() {
    if (this.#issueDetails.rawCookieLine) {
      return [this.#issueDetails.rawCookieLine];
    }
    return [];
  }
  requests() {
    if (this.#issueDetails.request) {
      return [this.#issueDetails.request];
    }
    return [];
  }
  getCategory() {
    return IssueCategory.Cookie;
  }
  getDescription() {
    const description = issueDescriptions.get(this.code());
    if (!description) {
      return null;
    }
    return resolveLazyDescription(description);
  }
  isCausedByThirdParty() {
    const topFrame = SDK.FrameManager.FrameManager.instance().getTopFrame();
    return isCausedByThirdParty(topFrame, this.#issueDetails.cookieUrl);
  }
  getKind() {
    if (this.#issueDetails.cookieExclusionReasons?.length > 0) {
      return IssueKind.PageError;
    }
    return IssueKind.BreakingChange;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const cookieIssueDetails = inspectorIssue.details.cookieIssueDetails;
    if (!cookieIssueDetails) {
      console.warn("Cookie issue without details received.");
      return [];
    }
    return CookieIssue.createIssuesFromCookieIssueDetails(cookieIssueDetails, issuesModel);
  }
}
export function isCausedByThirdParty(topFrame, cookieUrl) {
  if (!topFrame) {
    return true;
  }
  if (!cookieUrl || topFrame.domainAndRegistry() === "") {
    return false;
  }
  const parsedCookieUrl = Common.ParsedURL.ParsedURL.fromString(cookieUrl);
  if (!parsedCookieUrl) {
    return false;
  }
  return !isSubdomainOf(parsedCookieUrl.domain(), topFrame.domainAndRegistry());
}
function isSubdomainOf(subdomain, superdomain) {
  if (subdomain.length <= superdomain.length) {
    return subdomain === superdomain;
  }
  if (!subdomain.endsWith(superdomain)) {
    return false;
  }
  const subdomainWithoutSuperdomian = subdomain.substr(0, subdomain.length - superdomain.length);
  return subdomainWithoutSuperdomian.endsWith(".");
}
const sameSiteUnspecifiedErrorRead = {
  file: "SameSiteUnspecifiedTreatedAsLaxRead.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteUnspecifiedErrorSet = {
  file: "SameSiteUnspecifiedTreatedAsLaxSet.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteUnspecifiedWarnRead = {
  file: "SameSiteUnspecifiedLaxAllowUnsafeRead.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteUnspecifiedWarnSet = {
  file: "SameSiteUnspecifiedLaxAllowUnsafeSet.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteNoneInsecureErrorRead = {
  file: "SameSiteNoneInsecureErrorRead.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteNoneInsecureErrorSet = {
  file: "SameSiteNoneInsecureErrorSet.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteNoneInsecureWarnRead = {
  file: "SameSiteNoneInsecureWarnRead.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const sameSiteNoneInsecureWarnSet = {
  file: "SameSiteNoneInsecureWarnSet.md",
  links: [
    {
      link: "https://web.dev/samesite-cookies-explained/",
      linkTitle: i18nLazyString(UIStrings.samesiteCookiesExplained)
    }
  ]
};
const schemefulSameSiteArticles = [{ link: "https://web.dev/schemeful-samesite/", linkTitle: i18nLazyString(UIStrings.howSchemefulSamesiteWorks) }];
function schemefulSameSiteSubstitutions({ isDestinationSecure, isOriginSecure }) {
  return /* @__PURE__ */ new Map([
    ["PLACEHOLDER_destination", () => isDestinationSecure ? "a secure" : "an insecure"],
    ["PLACEHOLDER_origin", () => isOriginSecure ? "a secure" : "an insecure"]
  ]);
}
function sameSiteWarnStrictLaxDowngradeStrict(isSecure) {
  return {
    file: "SameSiteWarnStrictLaxDowngradeStrict.md",
    substitutions: schemefulSameSiteSubstitutions({ isDestinationSecure: isSecure, isOriginSecure: !isSecure }),
    links: schemefulSameSiteArticles
  };
}
function sameSiteExcludeNavigationContextDowngrade(isSecure) {
  return {
    file: "SameSiteExcludeNavigationContextDowngrade.md",
    substitutions: schemefulSameSiteSubstitutions({ isDestinationSecure: isSecure, isOriginSecure: !isSecure }),
    links: schemefulSameSiteArticles
  };
}
function sameSiteWarnCrossDowngradeRead(isSecure) {
  return {
    file: "SameSiteWarnCrossDowngradeRead.md",
    substitutions: schemefulSameSiteSubstitutions({ isDestinationSecure: isSecure, isOriginSecure: !isSecure }),
    links: schemefulSameSiteArticles
  };
}
function sameSiteExcludeContextDowngradeRead(isSecure) {
  return {
    file: "SameSiteExcludeContextDowngradeRead.md",
    substitutions: schemefulSameSiteSubstitutions({ isDestinationSecure: isSecure, isOriginSecure: !isSecure }),
    links: schemefulSameSiteArticles
  };
}
function sameSiteWarnCrossDowngradeSet(isSecure) {
  return {
    file: "SameSiteWarnCrossDowngradeSet.md",
    substitutions: schemefulSameSiteSubstitutions({ isDestinationSecure: !isSecure, isOriginSecure: isSecure }),
    links: schemefulSameSiteArticles
  };
}
function sameSiteExcludeContextDowngradeSet(isSecure) {
  return {
    file: "SameSiteExcludeContextDowngradeSet.md",
    substitutions: schemefulSameSiteSubstitutions({ isDestinationSecure: isSecure, isOriginSecure: !isSecure }),
    links: schemefulSameSiteArticles
  };
}
const sameSiteInvalidSameParty = {
  file: "SameSiteInvalidSameParty.md",
  links: [{
    link: "https://developer.chrome.com/blog/first-party-sets-sameparty/",
    linkTitle: i18nLazyString(UIStrings.firstPartySetsExplained)
  }]
};
const samePartyCrossPartyContextSet = {
  file: "SameSiteSamePartyCrossPartyContextSet.md",
  links: [{
    link: "https://developer.chrome.com/blog/first-party-sets-sameparty/",
    linkTitle: i18nLazyString(UIStrings.firstPartySetsExplained)
  }]
};
const attributeValueExceedsMaxSize = {
  file: "CookieAttributeValueExceedsMaxSize.md",
  links: []
};
const issueDescriptions = /* @__PURE__ */ new Map([
  ["CookieIssue::ExcludeSameSiteUnspecifiedTreatedAsLax::ReadCookie", sameSiteUnspecifiedErrorRead],
  ["CookieIssue::ExcludeSameSiteUnspecifiedTreatedAsLax::SetCookie", sameSiteUnspecifiedErrorSet],
  ["CookieIssue::WarnSameSiteUnspecifiedLaxAllowUnsafe::ReadCookie", sameSiteUnspecifiedWarnRead],
  ["CookieIssue::WarnSameSiteUnspecifiedLaxAllowUnsafe::SetCookie", sameSiteUnspecifiedWarnSet],
  ["CookieIssue::WarnSameSiteUnspecifiedCrossSiteContext::ReadCookie", sameSiteUnspecifiedWarnRead],
  ["CookieIssue::WarnSameSiteUnspecifiedCrossSiteContext::SetCookie", sameSiteUnspecifiedWarnSet],
  ["CookieIssue::ExcludeSameSiteNoneInsecure::ReadCookie", sameSiteNoneInsecureErrorRead],
  ["CookieIssue::ExcludeSameSiteNoneInsecure::SetCookie", sameSiteNoneInsecureErrorSet],
  ["CookieIssue::WarnSameSiteNoneInsecure::ReadCookie", sameSiteNoneInsecureWarnRead],
  ["CookieIssue::WarnSameSiteNoneInsecure::SetCookie", sameSiteNoneInsecureWarnSet],
  ["CookieIssue::WarnSameSiteStrictLaxDowngradeStrict::Secure", sameSiteWarnStrictLaxDowngradeStrict(true)],
  ["CookieIssue::WarnSameSiteStrictLaxDowngradeStrict::Insecure", sameSiteWarnStrictLaxDowngradeStrict(false)],
  ["CookieIssue::WarnCrossDowngrade::ReadCookie::Secure", sameSiteWarnCrossDowngradeRead(true)],
  ["CookieIssue::WarnCrossDowngrade::ReadCookie::Insecure", sameSiteWarnCrossDowngradeRead(false)],
  ["CookieIssue::WarnCrossDowngrade::SetCookie::Secure", sameSiteWarnCrossDowngradeSet(true)],
  ["CookieIssue::WarnCrossDowngrade::SetCookie::Insecure", sameSiteWarnCrossDowngradeSet(false)],
  ["CookieIssue::ExcludeNavigationContextDowngrade::Secure", sameSiteExcludeNavigationContextDowngrade(true)],
  [
    "CookieIssue::ExcludeNavigationContextDowngrade::Insecure",
    sameSiteExcludeNavigationContextDowngrade(false)
  ],
  ["CookieIssue::ExcludeContextDowngrade::ReadCookie::Secure", sameSiteExcludeContextDowngradeRead(true)],
  ["CookieIssue::ExcludeContextDowngrade::ReadCookie::Insecure", sameSiteExcludeContextDowngradeRead(false)],
  ["CookieIssue::ExcludeContextDowngrade::SetCookie::Secure", sameSiteExcludeContextDowngradeSet(true)],
  ["CookieIssue::ExcludeContextDowngrade::SetCookie::Insecure", sameSiteExcludeContextDowngradeSet(false)],
  ["CookieIssue::ExcludeInvalidSameParty::SetCookie", sameSiteInvalidSameParty],
  ["CookieIssue::ExcludeSamePartyCrossPartyContext::SetCookie", samePartyCrossPartyContextSet],
  ["CookieIssue::WarnAttributeValueExceedsMaxSize::ReadCookie", attributeValueExceedsMaxSize],
  ["CookieIssue::WarnAttributeValueExceedsMaxSize::SetCookie", attributeValueExceedsMaxSize]
]);
//# sourceMappingURL=CookieIssue.js.map
