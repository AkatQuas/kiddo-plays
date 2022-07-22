export var UIHeaderSection = /* @__PURE__ */ ((UIHeaderSection2) => {
  UIHeaderSection2["General"] = "General";
  UIHeaderSection2["Request"] = "Request";
  UIHeaderSection2["Response"] = "Response";
  return UIHeaderSection2;
})(UIHeaderSection || {});
export var UIRequestTabs = /* @__PURE__ */ ((UIRequestTabs2) => {
  UIRequestTabs2["Cookies"] = "cookies";
  UIRequestTabs2["EventSource"] = "eventSource";
  UIRequestTabs2["Headers"] = "headers";
  UIRequestTabs2["HeadersComponent"] = "headersComponent";
  UIRequestTabs2["Payload"] = "payload";
  UIRequestTabs2["Initiator"] = "initiator";
  UIRequestTabs2["Preview"] = "preview";
  UIRequestTabs2["Response"] = "response";
  UIRequestTabs2["Timing"] = "timing";
  UIRequestTabs2["TrustTokens"] = "trustTokens";
  UIRequestTabs2["WsFrames"] = "webSocketFrames";
  return UIRequestTabs2;
})(UIRequestTabs || {});
export class UIRequestLocation {
  request;
  header;
  searchMatch;
  isUrlMatch;
  tab;
  filterOptions;
  constructor(request, header, searchMatch, urlMatch, tab, filterOptions) {
    this.request = request;
    this.header = header;
    this.searchMatch = searchMatch;
    this.isUrlMatch = urlMatch;
    this.tab = tab;
    this.filterOptions = filterOptions;
  }
  static requestHeaderMatch(request, header) {
    return new UIRequestLocation(request, { section: "Request" /* Request */, header }, null, false, void 0, void 0);
  }
  static responseHeaderMatch(request, header) {
    return new UIRequestLocation(request, { section: "Response" /* Response */, header }, null, false, void 0, void 0);
  }
  static bodyMatch(request, searchMatch) {
    return new UIRequestLocation(request, null, searchMatch, false, void 0, void 0);
  }
  static urlMatch(request) {
    return new UIRequestLocation(request, null, null, true, void 0, void 0);
  }
  static header(request, section, name) {
    return new UIRequestLocation(request, { section, header: { name, value: "" } }, null, false, void 0, void 0);
  }
  static tab(request, tab, filterOptions) {
    return new UIRequestLocation(request, null, null, false, tab, filterOptions);
  }
}
//# sourceMappingURL=UIRequestLocation.js.map
