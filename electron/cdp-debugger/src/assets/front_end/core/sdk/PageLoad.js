export class PageLoad {
  id;
  url;
  startTime;
  loadTime;
  contentLoadTime;
  mainRequest;
  constructor(mainRequest) {
    this.id = ++PageLoad.lastIdentifier;
    this.url = mainRequest.url();
    this.startTime = mainRequest.startTime;
    this.mainRequest = mainRequest;
  }
  static forRequest(request) {
    return pageLoadForRequest.get(request) || null;
  }
  bindRequest(request) {
    pageLoadForRequest.set(request, this);
  }
  static lastIdentifier = 0;
}
const pageLoadForRequest = /* @__PURE__ */ new WeakMap();
//# sourceMappingURL=PageLoad.js.map
