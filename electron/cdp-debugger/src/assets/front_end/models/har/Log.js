import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
export class Log {
  static pseudoWallTime(request, monotonicTime) {
    return new Date(request.pseudoWallTime(monotonicTime) * 1e3);
  }
  static async build(requests) {
    const log = new Log();
    const entryPromises = [];
    for (const request of requests) {
      entryPromises.push(Entry.build(request));
    }
    const entries = await Promise.all(entryPromises);
    return { version: "1.2", creator: log.creator(), pages: log.buildPages(requests), entries };
  }
  creator() {
    const webKitVersion = /AppleWebKit\/([^ ]+)/.exec(window.navigator.userAgent);
    return { name: "WebInspector", version: webKitVersion ? webKitVersion[1] : "n/a" };
  }
  buildPages(requests) {
    const seenIdentifiers = /* @__PURE__ */ new Set();
    const pages = [];
    for (let i = 0; i < requests.length; ++i) {
      const request = requests[i];
      const page = SDK.PageLoad.PageLoad.forRequest(request);
      if (!page || seenIdentifiers.has(page.id)) {
        continue;
      }
      seenIdentifiers.add(page.id);
      pages.push(this.convertPage(page, request));
    }
    return pages;
  }
  convertPage(page, request) {
    return {
      startedDateTime: Log.pseudoWallTime(request, page.startTime).toJSON(),
      id: "page_" + page.id,
      title: page.url,
      pageTimings: {
        onContentLoad: this.pageEventTime(page, page.contentLoadTime),
        onLoad: this.pageEventTime(page, page.loadTime)
      }
    };
  }
  pageEventTime(page, time) {
    const startTime = page.startTime;
    if (time === -1 || startTime === -1) {
      return -1;
    }
    return Entry.toMilliseconds(time - startTime);
  }
}
export class Entry {
  request;
  constructor(request) {
    this.request = request;
  }
  static toMilliseconds(time) {
    return time === -1 ? -1 : time * 1e3;
  }
  static async build(request) {
    const harEntry = new Entry(request);
    let ipAddress = harEntry.request.remoteAddress();
    const portPositionInString = ipAddress.lastIndexOf(":");
    if (portPositionInString !== -1) {
      ipAddress = ipAddress.substr(0, portPositionInString);
    }
    const timings = harEntry.buildTimings();
    let time = 0;
    for (const t of [timings.blocked, timings.dns, timings.connect, timings.send, timings.wait, timings.receive]) {
      time += Math.max(t, 0);
    }
    const initiator = harEntry.request.initiator();
    let exportedInitiator = null;
    if (initiator) {
      exportedInitiator = {
        type: initiator.type
      };
      if (initiator.url !== void 0) {
        exportedInitiator.url = initiator.url;
      }
      if (initiator.lineNumber !== void 0) {
        exportedInitiator.lineNumber = initiator.lineNumber;
      }
      if (initiator.stack) {
        exportedInitiator.stack = initiator.stack;
      }
    }
    const entry = {
      _fromCache: void 0,
      _initiator: exportedInitiator,
      _priority: harEntry.request.priority(),
      _resourceType: harEntry.request.resourceType().name(),
      _webSocketMessages: void 0,
      cache: {},
      connection: void 0,
      pageref: void 0,
      request: await harEntry.buildRequest(),
      response: harEntry.buildResponse(),
      serverIPAddress: ipAddress.replace(/\[\]/g, ""),
      startedDateTime: Log.pseudoWallTime(harEntry.request, harEntry.request.issueTime()).toJSON(),
      time,
      timings
    };
    if (harEntry.request.cached()) {
      entry._fromCache = harEntry.request.cachedInMemory() ? "memory" : "disk";
    } else {
      delete entry._fromCache;
    }
    if (harEntry.request.connectionId !== "0") {
      entry.connection = harEntry.request.connectionId;
    } else {
      delete entry.connection;
    }
    const page = SDK.PageLoad.PageLoad.forRequest(harEntry.request);
    if (page) {
      entry.pageref = "page_" + page.id;
    } else {
      delete entry.pageref;
    }
    if (harEntry.request.resourceType() === Common.ResourceType.resourceTypes.WebSocket) {
      const messages = [];
      for (const message of harEntry.request.frames()) {
        messages.push({ type: message.type, time: message.time, opcode: message.opCode, data: message.text });
      }
      entry._webSocketMessages = messages;
    } else {
      delete entry._webSocketMessages;
    }
    return entry;
  }
  async buildRequest() {
    const headersText = this.request.requestHeadersText();
    const res = {
      method: this.request.requestMethod,
      url: this.buildRequestURL(this.request.url()),
      httpVersion: this.request.requestHttpVersion(),
      headers: this.request.requestHeaders(),
      queryString: this.buildParameters(this.request.queryParameters || []),
      cookies: this.buildCookies(this.request.includedRequestCookies()),
      headersSize: headersText ? headersText.length : -1,
      bodySize: await this.requestBodySize(),
      postData: void 0
    };
    const postData = await this.buildPostData();
    if (postData) {
      res.postData = postData;
    } else {
      delete res.postData;
    }
    return res;
  }
  buildResponse() {
    const headersText = this.request.responseHeadersText;
    return {
      status: this.request.statusCode,
      statusText: this.request.statusText,
      httpVersion: this.request.responseHttpVersion(),
      headers: this.request.responseHeaders,
      cookies: this.buildCookies(this.request.responseCookies),
      content: this.buildContent(),
      redirectURL: this.request.responseHeaderValue("Location") || "",
      headersSize: headersText ? headersText.length : -1,
      bodySize: this.responseBodySize,
      _transferSize: this.request.transferSize,
      _error: this.request.localizedFailDescription
    };
  }
  buildContent() {
    const content = {
      size: this.request.resourceSize,
      mimeType: this.request.mimeType || "x-unknown",
      compression: void 0
    };
    const compression = this.responseCompression;
    if (typeof compression === "number") {
      content.compression = compression;
    } else {
      delete content.compression;
    }
    return content;
  }
  buildTimings() {
    const timing = this.request.timing;
    const issueTime = this.request.issueTime();
    const startTime = this.request.startTime;
    const result = {
      blocked: -1,
      dns: -1,
      ssl: -1,
      connect: -1,
      send: 0,
      wait: 0,
      receive: 0,
      _blocked_queueing: -1,
      _blocked_proxy: void 0
    };
    const queuedTime = issueTime < startTime ? startTime - issueTime : -1;
    result.blocked = Entry.toMilliseconds(queuedTime);
    result._blocked_queueing = Entry.toMilliseconds(queuedTime);
    let highestTime = 0;
    if (timing) {
      const blockedStart = leastNonNegative([timing.dnsStart, timing.connectStart, timing.sendStart]);
      if (blockedStart !== Infinity) {
        result.blocked += blockedStart;
      }
      if (timing.proxyEnd !== -1) {
        result._blocked_proxy = timing.proxyEnd - timing.proxyStart;
      }
      if (result._blocked_proxy && result._blocked_proxy > result.blocked) {
        result.blocked = result._blocked_proxy;
      }
      const dnsStart = timing.dnsEnd >= 0 ? blockedStart : 0;
      const dnsEnd = timing.dnsEnd >= 0 ? timing.dnsEnd : -1;
      result.dns = dnsEnd - dnsStart;
      const sslStart = timing.sslEnd > 0 ? timing.sslStart : 0;
      const sslEnd = timing.sslEnd > 0 ? timing.sslEnd : -1;
      result.ssl = sslEnd - sslStart;
      const connectStart = timing.connectEnd >= 0 ? leastNonNegative([dnsEnd, blockedStart]) : 0;
      const connectEnd = timing.connectEnd >= 0 ? timing.connectEnd : -1;
      result.connect = connectEnd - connectStart;
      const sendStart = timing.sendEnd >= 0 ? Math.max(connectEnd, dnsEnd, blockedStart) : 0;
      const sendEnd = timing.sendEnd >= 0 ? timing.sendEnd : 0;
      result.send = sendEnd - sendStart;
      if (result.send < 0) {
        result.send = 0;
      }
      highestTime = Math.max(sendEnd, connectEnd, sslEnd, dnsEnd, blockedStart, 0);
    } else if (this.request.responseReceivedTime === -1) {
      result.blocked = Entry.toMilliseconds(this.request.endTime - issueTime);
      return result;
    }
    const requestTime = timing ? timing.requestTime : startTime;
    const waitStart = highestTime;
    const waitEnd = Entry.toMilliseconds(this.request.responseReceivedTime - requestTime);
    result.wait = waitEnd - waitStart;
    const receiveStart = waitEnd;
    const receiveEnd = Entry.toMilliseconds(this.request.endTime - requestTime);
    result.receive = Math.max(receiveEnd - receiveStart, 0);
    return result;
    function leastNonNegative(values) {
      return values.reduce((best, value) => value >= 0 && value < best ? value : best, Infinity);
    }
  }
  async buildPostData() {
    const postData = await this.request.requestFormData();
    if (!postData) {
      return null;
    }
    const res = { mimeType: this.request.requestContentType() || "", text: postData, params: void 0 };
    const formParameters = await this.request.formParameters();
    if (formParameters) {
      res.params = this.buildParameters(formParameters);
    } else {
      delete res.params;
    }
    return res;
  }
  buildParameters(parameters) {
    return parameters.slice();
  }
  buildRequestURL(url) {
    return Common.ParsedURL.ParsedURL.split(url, "#", 2)[0];
  }
  buildCookies(cookies) {
    return cookies.map(this.buildCookie.bind(this));
  }
  buildCookie(cookie) {
    const c = {
      name: cookie.name(),
      value: cookie.value(),
      path: cookie.path(),
      domain: cookie.domain(),
      expires: cookie.expiresDate(Log.pseudoWallTime(this.request, this.request.startTime)),
      httpOnly: cookie.httpOnly(),
      secure: cookie.secure(),
      sameSite: void 0
    };
    if (cookie.sameSite()) {
      c.sameSite = cookie.sameSite();
    } else {
      delete c.sameSite;
    }
    return c;
  }
  async requestBodySize() {
    const postData = await this.request.requestFormData();
    if (!postData) {
      return 0;
    }
    return new TextEncoder().encode(postData).length;
  }
  get responseBodySize() {
    if (this.request.cached() || this.request.statusCode === 304) {
      return 0;
    }
    if (!this.request.responseHeadersText) {
      return -1;
    }
    return this.request.transferSize - this.request.responseHeadersText.length;
  }
  get responseCompression() {
    if (this.request.cached() || this.request.statusCode === 304 || this.request.statusCode === 206) {
      return;
    }
    if (!this.request.responseHeadersText) {
      return;
    }
    return this.request.resourceSize - this.responseBodySize;
  }
}
//# sourceMappingURL=Log.js.map
