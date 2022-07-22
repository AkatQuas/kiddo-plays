export var FilterType = /* @__PURE__ */ ((FilterType2) => {
  FilterType2["Domain"] = "domain";
  FilterType2["HasResponseHeader"] = "has-response-header";
  FilterType2["ResponseHeaderValueSetCookie"] = "response-header-set-cookie";
  FilterType2["Is"] = "is";
  FilterType2["LargerThan"] = "larger-than";
  FilterType2["Method"] = "method";
  FilterType2["MimeType"] = "mime-type";
  FilterType2["MixedContent"] = "mixed-content";
  FilterType2["Priority"] = "priority";
  FilterType2["Scheme"] = "scheme";
  FilterType2["SetCookieDomain"] = "set-cookie-domain";
  FilterType2["SetCookieName"] = "set-cookie-name";
  FilterType2["SetCookieValue"] = "set-cookie-value";
  FilterType2["ResourceType"] = "resource-type";
  FilterType2["CookieDomain"] = "cookie-domain";
  FilterType2["CookieName"] = "cookie-name";
  FilterType2["CookiePath"] = "cookie-path";
  FilterType2["CookieValue"] = "cookie-value";
  FilterType2["StatusCode"] = "status-code";
  FilterType2["Url"] = "url";
  return FilterType2;
})(FilterType || {});
export var IsFilterType = /* @__PURE__ */ ((IsFilterType2) => {
  IsFilterType2["Running"] = "running";
  IsFilterType2["FromCache"] = "from-cache";
  IsFilterType2["ServiceWorkerIntercepted"] = "service-worker-intercepted";
  IsFilterType2["ServiceWorkerInitiated"] = "service-worker-initiated";
  return IsFilterType2;
})(IsFilterType || {});
export var MixedContentFilterValues = /* @__PURE__ */ ((MixedContentFilterValues2) => {
  MixedContentFilterValues2["All"] = "all";
  MixedContentFilterValues2["Displayed"] = "displayed";
  MixedContentFilterValues2["Blocked"] = "blocked";
  MixedContentFilterValues2["BlockOverridden"] = "block-overridden";
  return MixedContentFilterValues2;
})(MixedContentFilterValues || {});
export class UIRequestFilter {
  filters;
  constructor(filters) {
    this.filters = filters;
  }
  static filters(filters) {
    return new UIRequestFilter(filters);
  }
}
//# sourceMappingURL=UIFilter.js.map
