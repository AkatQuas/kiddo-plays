export const markdownLinks = /* @__PURE__ */ new Map([
  ["issuesContrastWCAG21AA", "https://www.w3.org/TR/WCAG21/#contrast-minimum"],
  ["issuesContrastWCAG21AAA", "https://www.w3.org/TR/WCAG21/#contrast-enhanced"],
  ["issuesContrastSuggestColor", "https://developers.google.com/web/updates/2020/08/devtools#accessible-color"],
  ["issuesCSPSetStrict", "https://web.dev/strict-csp"],
  [
    "issuesCSPWhyStrictOverAllowlist",
    "https://web.dev/strict-csp/#why-a-strict-csp-is-recommended-over-allowlist-csps"
  ],
  [
    "issueCorsPreflightRequest",
    "https://web.dev/cross-origin-resource-sharing/#preflight-requests-for-complex-http-calls"
  ],
  ["issueQuirksModeDoctype", "https://web.dev/doctype/"],
  ["sameSiteAndSameOrigin", "https://web.dev/same-site-same-origin/"],
  ["https://xhr.spec.whatwg.org/", "https://xhr.spec.whatwg.org/"],
  ["https://goo.gle/chrome-insecure-origins", "https://goo.gle/chrome-insecure-origins"],
  ["https://webrtc.org/web-apis/chrome/unified-plan/", "https://webrtc.org/web-apis/chrome/unified-plan/"],
  [
    "https://developer.chrome.com/blog/enabling-shared-array-buffer/",
    "https://developer.chrome.com/blog/enabling-shared-array-buffer/"
  ],
  ["https://developer.chrome.com/docs/extensions/mv3/", "https://developer.chrome.com/docs/extensions/mv3/"],
  [
    "https://developer.chrome.com/blog/immutable-document-domain/",
    "https://developer.chrome.com/blog/immutable-document-domain/"
  ]
]);
export const getMarkdownLink = (key) => {
  if (/^https:\/\/www.chromestatus.com\/feature\/\d+$/.test(key)) {
    return key;
  }
  const link = markdownLinks.get(key);
  if (!link) {
    throw new Error(`Markdown link with key '${key}' is not available, please check MarkdownLinksMap.ts`);
  }
  return link;
};
//# sourceMappingURL=MarkdownLinksMap.js.map
