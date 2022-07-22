import * as Protocol from "../../generated/protocol.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import * as Platform from "../platform/platform.js";
import { Attributes } from "./Cookie.js";
import { CookieParser } from "./CookieParser.js";
import { NetworkManager, Events as NetworkManagerEvents } from "./NetworkManager.js";
import { Type } from "./Target.js";
import { ServerTiming } from "./ServerTiming.js";
const UIStrings = {
  binary: "(binary)",
  secureOnly: 'This cookie was blocked because it had the "`Secure`" attribute and the connection was not secure.',
  notOnPath: "This cookie was blocked because its path was not an exact match for or a superdirectory of the request url's path.",
  domainMismatch: "This cookie was blocked because neither did the request URL's domain exactly match the cookie's domain, nor was the request URL's domain a subdomain of the cookie's Domain attribute value.",
  sameSiteStrict: 'This cookie was blocked because it had the "`SameSite=Strict`" attribute and the request was made from a different site. This includes top-level navigation requests initiated by other sites.',
  sameSiteLax: 'This cookie was blocked because it had the "`SameSite=Lax`" attribute and the request was made from a different site and was not initiated by a top-level navigation.',
  sameSiteUnspecifiedTreatedAsLax: 'This cookie didn\'t specify a "`SameSite`" attribute when it was stored and was defaulted to "SameSite=Lax," and was blocked because the request was made from a different site and was not initiated by a top-level navigation. The cookie had to have been set with "`SameSite=None`" to enable cross-site usage.',
  sameSiteNoneInsecure: 'This cookie was blocked because it had the "`SameSite=None`" attribute but was not marked "Secure". Cookies without SameSite restrictions must be marked "Secure" and sent over a secure connection.',
  userPreferences: "This cookie was blocked due to user preferences.",
  unknownError: "An unknown error was encountered when trying to send this cookie.",
  schemefulSameSiteStrict: 'This cookie was blocked because it had the "`SameSite=Strict`" attribute but the request was cross-site. This includes top-level navigation requests initiated by other sites. This request is considered cross-site because the URL has a different scheme than the current site.',
  schemefulSameSiteLax: 'This cookie was blocked because it had the "`SameSite=Lax`" attribute but the request was cross-site and was not initiated by a top-level navigation. This request is considered cross-site because the URL has a different scheme than the current site.',
  schemefulSameSiteUnspecifiedTreatedAsLax: 'This cookie didn\'t specify a "`SameSite`" attribute when it was stored, was defaulted to "`SameSite=Lax"`, and was blocked because the request was cross-site and was not initiated by a top-level navigation. This request is considered cross-site because the URL has a different scheme than the current site.',
  samePartyFromCrossPartyContext: "This cookie was blocked because it had the \"`SameParty`\" attribute but the request was cross-party. The request was considered cross-party because the domain of the resource's URL and the domains of the resource's enclosing frames/documents are neither owners nor members in the same First-Party Set.",
  nameValuePairExceedsMaxSize: "This cookie was blocked because it was too large. The combined size of the name and value must be less than or equal to 4096 characters.",
  thisSetcookieWasBlockedDueToUser: "This attempt to set a cookie via a `Set-Cookie` header was blocked due to user preferences.",
  thisSetcookieHadInvalidSyntax: "This `Set-Cookie` header had invalid syntax.",
  theSchemeOfThisConnectionIsNot: "The scheme of this connection is not allowed to store cookies.",
  anUnknownErrorWasEncounteredWhenTrying: "An unknown error was encountered when trying to store this cookie.",
  thisSetcookieWasBlockedBecauseItHadTheSamesiteStrictLax: 'This attempt to set a cookie via a `Set-Cookie` header was blocked because it had the "{PH1}" attribute but came from a cross-site response which was not the response to a top-level navigation. This response is considered cross-site because the URL has a different scheme than the current site.',
  thisSetcookieDidntSpecifyASamesite: 'This `Set-Cookie` header didn\'t specify a "`SameSite`" attribute, was defaulted to "`SameSite=Lax"`, and was blocked because it came from a cross-site response which was not the response to a top-level navigation. This response is considered cross-site because the URL has a different scheme than the current site.',
  thisSetcookieWasBlockedBecauseItHadTheSameparty: "This attempt to set a cookie via a `Set-Cookie` header was blocked because it had the \"`SameParty`\" attribute but the request was cross-party. The request was considered cross-party because the domain of the resource's URL and the domains of the resource's enclosing frames/documents are neither owners nor members in the same First-Party Set.",
  thisSetcookieWasBlockedBecauseItHadTheSamepartyAttribute: 'This attempt to set a cookie via a `Set-Cookie` header was blocked because it had the "`SameParty`" attribute but also had other conflicting attributes. Chrome requires cookies that use the "`SameParty`" attribute to also have the "Secure" attribute, and to not be restricted to "`SameSite=Strict`".',
  blockedReasonSecureOnly: 'This attempt to set a cookie via a `Set-Cookie` header was blocked because it had the "Secure" attribute but was not received over a secure connection.',
  blockedReasonSameSiteStrictLax: 'This attempt to set a cookie via a `Set-Cookie` header was blocked because it had the "{PH1}" attribute but came from a cross-site response which was not the response to a top-level navigation.',
  blockedReasonSameSiteUnspecifiedTreatedAsLax: 'This `Set-Cookie` header didn\'t specify a "`SameSite`" attribute and was defaulted to "`SameSite=Lax,`" and was blocked because it came from a cross-site response which was not the response to a top-level navigation. The `Set-Cookie` had to have been set with "`SameSite=None`" to enable cross-site usage.',
  blockedReasonSameSiteNoneInsecure: 'This attempt to set a cookie via a `Set-Cookie` header was blocked because it had the "`SameSite=None`" attribute but did not have the "Secure" attribute, which is required in order to use "`SameSite=None`".',
  blockedReasonOverwriteSecure: "This attempt to set a cookie via a `Set-Cookie` header was blocked because it was not sent over a secure connection and would have overwritten a cookie with the Secure attribute.",
  blockedReasonInvalidDomain: "This attempt to set a cookie via a `Set-Cookie` header was blocked because its Domain attribute was invalid with regards to the current host url.",
  blockedReasonInvalidPrefix: 'This attempt to set a cookie via a `Set-Cookie` header was blocked because it used the "`__Secure-`" or "`__Host-`" prefix in its name and broke the additional rules applied to cookies with these prefixes as defined in `https://tools.ietf.org/html/draft-west-cookie-prefixes-05`.',
  thisSetcookieWasBlockedBecauseTheNameValuePairExceedsMaxSize: "This attempt to set a cookie via a `Set-Cookie` header was blocked because the cookie was too large. The combined size of the name and value must be less than or equal to 4096 characters.",
  setcookieHeaderIsIgnoredIn: "Set-Cookie header is ignored in response from url: {PH1}. The combined size of the name and value must be less than or equal to 4096 characters."
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/NetworkRequest.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var MIME_TYPE = /* @__PURE__ */ ((MIME_TYPE2) => {
  MIME_TYPE2["HTML"] = "text/html";
  MIME_TYPE2["XML"] = "text/xml";
  MIME_TYPE2["PLAIN"] = "text/plain";
  MIME_TYPE2["XHTML"] = "application/xhtml+xml";
  MIME_TYPE2["SVG"] = "image/svg+xml";
  MIME_TYPE2["CSS"] = "text/css";
  MIME_TYPE2["XSL"] = "text/xsl";
  MIME_TYPE2["VTT"] = "text/vtt";
  MIME_TYPE2["PDF"] = "application/pdf";
  MIME_TYPE2["EVENTSTREAM"] = "text/event-stream";
  return MIME_TYPE2;
})(MIME_TYPE || {});
export class NetworkRequest extends Common.ObjectWrapper.ObjectWrapper {
  #requestIdInternal;
  #backendRequestIdInternal;
  #documentURLInternal;
  #frameIdInternal;
  #loaderIdInternal;
  #initiatorInternal;
  #redirectSourceInternal;
  #preflightRequestInternal;
  #preflightInitiatorRequestInternal;
  #isRedirectInternal;
  #redirectDestinationInternal;
  #issueTimeInternal;
  #startTimeInternal;
  #endTimeInternal;
  #blockedReasonInternal;
  #corsErrorStatusInternal;
  statusCode;
  statusText;
  requestMethod;
  requestTime;
  protocol;
  mixedContentType;
  #initialPriorityInternal;
  #currentPriority;
  #signedExchangeInfoInternal;
  #webBundleInfoInternal;
  #webBundleInnerRequestInfoInternal;
  #resourceTypeInternal;
  #contentDataInternal;
  #framesInternal;
  #eventSourceMessagesInternal;
  #responseHeaderValues;
  #responseHeadersTextInternal;
  #requestHeadersInternal;
  #requestHeaderValues;
  #remoteAddressInternal;
  #remoteAddressSpaceInternal;
  #referrerPolicyInternal;
  #securityStateInternal;
  #securityDetailsInternal;
  connectionId;
  connectionReused;
  hasNetworkData;
  #formParametersPromise;
  #requestFormDataPromise;
  #hasExtraRequestInfoInternal;
  #hasExtraResponseInfoInternal;
  #blockedRequestCookiesInternal;
  #includedRequestCookiesInternal;
  #blockedResponseCookiesInternal;
  localizedFailDescription;
  #urlInternal;
  #responseReceivedTimeInternal;
  #transferSizeInternal;
  #finishedInternal;
  #failedInternal;
  #canceledInternal;
  #preservedInternal;
  #mimeTypeInternal;
  #parsedURLInternal;
  #nameInternal;
  #pathInternal;
  #clientSecurityStateInternal;
  #trustTokenParamsInternal;
  #trustTokenOperationDoneEventInternal;
  #responseCacheStorageCacheName;
  #serviceWorkerResponseSourceInternal;
  #wallIssueTime;
  #responseRetrievalTime;
  #resourceSizeInternal;
  #fromMemoryCache;
  #fromDiskCache;
  #fromPrefetchCacheInternal;
  #fetchedViaServiceWorkerInternal;
  #timingInternal;
  #requestHeadersTextInternal;
  #responseHeadersInternal;
  #sortedResponseHeadersInternal;
  #responseCookiesInternal;
  #serverTimingsInternal;
  #queryStringInternal;
  #parsedQueryParameters;
  #contentDataProvider;
  #isSameSiteInternal;
  #wasIntercepted;
  constructor(requestId, backendRequestId, url, documentURL, frameId, loaderId, initiator) {
    super();
    this.#requestIdInternal = requestId;
    this.#backendRequestIdInternal = backendRequestId;
    this.setUrl(url);
    this.#documentURLInternal = documentURL;
    this.#frameIdInternal = frameId;
    this.#loaderIdInternal = loaderId;
    this.#initiatorInternal = initiator;
    this.#redirectSourceInternal = null;
    this.#preflightRequestInternal = null;
    this.#preflightInitiatorRequestInternal = null;
    this.#isRedirectInternal = false;
    this.#redirectDestinationInternal = null;
    this.#issueTimeInternal = -1;
    this.#startTimeInternal = -1;
    this.#endTimeInternal = -1;
    this.#blockedReasonInternal = void 0;
    this.#corsErrorStatusInternal = void 0;
    this.statusCode = 0;
    this.statusText = "";
    this.requestMethod = "";
    this.requestTime = 0;
    this.protocol = "";
    this.mixedContentType = Protocol.Security.MixedContentType.None;
    this.#initialPriorityInternal = null;
    this.#currentPriority = null;
    this.#signedExchangeInfoInternal = null;
    this.#webBundleInfoInternal = null;
    this.#webBundleInnerRequestInfoInternal = null;
    this.#resourceTypeInternal = Common.ResourceType.resourceTypes.Other;
    this.#contentDataInternal = null;
    this.#framesInternal = [];
    this.#eventSourceMessagesInternal = [];
    this.#responseHeaderValues = {};
    this.#responseHeadersTextInternal = "";
    this.#requestHeadersInternal = [];
    this.#requestHeaderValues = {};
    this.#remoteAddressInternal = "";
    this.#remoteAddressSpaceInternal = Protocol.Network.IPAddressSpace.Unknown;
    this.#referrerPolicyInternal = null;
    this.#securityStateInternal = Protocol.Security.SecurityState.Unknown;
    this.#securityDetailsInternal = null;
    this.connectionId = "0";
    this.connectionReused = false;
    this.hasNetworkData = false;
    this.#formParametersPromise = null;
    this.#requestFormDataPromise = Promise.resolve(null);
    this.#hasExtraRequestInfoInternal = false;
    this.#hasExtraResponseInfoInternal = false;
    this.#blockedRequestCookiesInternal = [];
    this.#includedRequestCookiesInternal = [];
    this.#blockedResponseCookiesInternal = [];
    this.localizedFailDescription = null;
    this.#isSameSiteInternal = null;
    this.#wasIntercepted = false;
  }
  static create(backendRequestId, url, documentURL, frameId, loaderId, initiator) {
    return new NetworkRequest(backendRequestId, backendRequestId, url, documentURL, frameId, loaderId, initiator);
  }
  static createForWebSocket(backendRequestId, requestURL, initiator) {
    return new NetworkRequest(backendRequestId, backendRequestId, requestURL, Platform.DevToolsPath.EmptyUrlString, null, null, initiator || null);
  }
  static createWithoutBackendRequest(requestId, url, documentURL, initiator) {
    return new NetworkRequest(requestId, void 0, url, documentURL, null, null, initiator);
  }
  identityCompare(other) {
    const thisId = this.requestId();
    const thatId = other.requestId();
    if (thisId > thatId) {
      return 1;
    }
    if (thisId < thatId) {
      return -1;
    }
    return 0;
  }
  requestId() {
    return this.#requestIdInternal;
  }
  backendRequestId() {
    return this.#backendRequestIdInternal;
  }
  url() {
    return this.#urlInternal;
  }
  isBlobRequest() {
    return this.#urlInternal.startsWith("blob:");
  }
  setUrl(x) {
    if (this.#urlInternal === x) {
      return;
    }
    this.#urlInternal = x;
    this.#parsedURLInternal = new Common.ParsedURL.ParsedURL(x);
    this.#queryStringInternal = void 0;
    this.#parsedQueryParameters = void 0;
    this.#nameInternal = void 0;
    this.#pathInternal = void 0;
  }
  get documentURL() {
    return this.#documentURLInternal;
  }
  get parsedURL() {
    return this.#parsedURLInternal;
  }
  get frameId() {
    return this.#frameIdInternal;
  }
  get loaderId() {
    return this.#loaderIdInternal;
  }
  setRemoteAddress(ip, port) {
    this.#remoteAddressInternal = ip + ":" + port;
    this.dispatchEventToListeners(Events.RemoteAddressChanged, this);
  }
  remoteAddress() {
    return this.#remoteAddressInternal;
  }
  remoteAddressSpace() {
    return this.#remoteAddressSpaceInternal;
  }
  getResponseCacheStorageCacheName() {
    return this.#responseCacheStorageCacheName;
  }
  setResponseCacheStorageCacheName(x) {
    this.#responseCacheStorageCacheName = x;
  }
  serviceWorkerResponseSource() {
    return this.#serviceWorkerResponseSourceInternal;
  }
  setServiceWorkerResponseSource(serviceWorkerResponseSource) {
    this.#serviceWorkerResponseSourceInternal = serviceWorkerResponseSource;
  }
  setReferrerPolicy(referrerPolicy) {
    this.#referrerPolicyInternal = referrerPolicy;
  }
  referrerPolicy() {
    return this.#referrerPolicyInternal;
  }
  securityState() {
    return this.#securityStateInternal;
  }
  setSecurityState(securityState) {
    this.#securityStateInternal = securityState;
  }
  securityDetails() {
    return this.#securityDetailsInternal;
  }
  securityOrigin() {
    return this.#parsedURLInternal.securityOrigin();
  }
  setSecurityDetails(securityDetails) {
    this.#securityDetailsInternal = securityDetails;
  }
  get startTime() {
    return this.#startTimeInternal || -1;
  }
  setIssueTime(monotonicTime, wallTime) {
    this.#issueTimeInternal = monotonicTime;
    this.#wallIssueTime = wallTime;
    this.#startTimeInternal = monotonicTime;
  }
  issueTime() {
    return this.#issueTimeInternal;
  }
  pseudoWallTime(monotonicTime) {
    return this.#wallIssueTime ? this.#wallIssueTime - this.#issueTimeInternal + monotonicTime : monotonicTime;
  }
  get responseReceivedTime() {
    return this.#responseReceivedTimeInternal || -1;
  }
  set responseReceivedTime(x) {
    this.#responseReceivedTimeInternal = x;
  }
  getResponseRetrievalTime() {
    return this.#responseRetrievalTime;
  }
  setResponseRetrievalTime(x) {
    this.#responseRetrievalTime = x;
  }
  get endTime() {
    return this.#endTimeInternal || -1;
  }
  set endTime(x) {
    if (this.timing && this.timing.requestTime) {
      this.#endTimeInternal = Math.max(x, this.responseReceivedTime);
    } else {
      this.#endTimeInternal = x;
      if (this.#responseReceivedTimeInternal > x) {
        this.#responseReceivedTimeInternal = x;
      }
    }
    this.dispatchEventToListeners(Events.TimingChanged, this);
  }
  get duration() {
    if (this.#endTimeInternal === -1 || this.#startTimeInternal === -1) {
      return -1;
    }
    return this.#endTimeInternal - this.#startTimeInternal;
  }
  get latency() {
    if (this.#responseReceivedTimeInternal === -1 || this.#startTimeInternal === -1) {
      return -1;
    }
    return this.#responseReceivedTimeInternal - this.#startTimeInternal;
  }
  get resourceSize() {
    return this.#resourceSizeInternal || 0;
  }
  set resourceSize(x) {
    this.#resourceSizeInternal = x;
  }
  get transferSize() {
    return this.#transferSizeInternal || 0;
  }
  increaseTransferSize(x) {
    this.#transferSizeInternal = (this.#transferSizeInternal || 0) + x;
  }
  setTransferSize(x) {
    this.#transferSizeInternal = x;
  }
  get finished() {
    return this.#finishedInternal;
  }
  set finished(x) {
    if (this.#finishedInternal === x) {
      return;
    }
    this.#finishedInternal = x;
    if (x) {
      this.dispatchEventToListeners(Events.FinishedLoading, this);
    }
  }
  get failed() {
    return this.#failedInternal;
  }
  set failed(x) {
    this.#failedInternal = x;
  }
  get canceled() {
    return this.#canceledInternal;
  }
  set canceled(x) {
    this.#canceledInternal = x;
  }
  get preserved() {
    return this.#preservedInternal;
  }
  set preserved(x) {
    this.#preservedInternal = x;
  }
  blockedReason() {
    return this.#blockedReasonInternal;
  }
  setBlockedReason(reason) {
    this.#blockedReasonInternal = reason;
  }
  corsErrorStatus() {
    return this.#corsErrorStatusInternal;
  }
  setCorsErrorStatus(corsErrorStatus) {
    this.#corsErrorStatusInternal = corsErrorStatus;
  }
  wasBlocked() {
    return Boolean(this.#blockedReasonInternal);
  }
  cached() {
    return (Boolean(this.#fromMemoryCache) || Boolean(this.#fromDiskCache)) && !this.#transferSizeInternal;
  }
  cachedInMemory() {
    return Boolean(this.#fromMemoryCache) && !this.#transferSizeInternal;
  }
  fromPrefetchCache() {
    return Boolean(this.#fromPrefetchCacheInternal);
  }
  setFromMemoryCache() {
    this.#fromMemoryCache = true;
    this.#timingInternal = void 0;
  }
  get fromDiskCache() {
    return this.#fromDiskCache;
  }
  setFromDiskCache() {
    this.#fromDiskCache = true;
  }
  setFromPrefetchCache() {
    this.#fromPrefetchCacheInternal = true;
  }
  get fetchedViaServiceWorker() {
    return Boolean(this.#fetchedViaServiceWorkerInternal);
  }
  set fetchedViaServiceWorker(x) {
    this.#fetchedViaServiceWorkerInternal = x;
  }
  initiatedByServiceWorker() {
    const networkManager = NetworkManager.forRequest(this);
    if (!networkManager) {
      return false;
    }
    return networkManager.target().type() === Type.ServiceWorker;
  }
  get timing() {
    return this.#timingInternal;
  }
  set timing(timingInfo) {
    if (!timingInfo || this.#fromMemoryCache) {
      return;
    }
    this.#startTimeInternal = timingInfo.requestTime;
    const headersReceivedTime = timingInfo.requestTime + timingInfo.receiveHeadersEnd / 1e3;
    if ((this.#responseReceivedTimeInternal || -1) < 0 || this.#responseReceivedTimeInternal > headersReceivedTime) {
      this.#responseReceivedTimeInternal = headersReceivedTime;
    }
    if (this.#startTimeInternal > this.#responseReceivedTimeInternal) {
      this.#responseReceivedTimeInternal = this.#startTimeInternal;
    }
    this.#timingInternal = timingInfo;
    this.dispatchEventToListeners(Events.TimingChanged, this);
  }
  setConnectTimingFromExtraInfo(connectTiming) {
    this.#startTimeInternal = connectTiming.requestTime;
    this.dispatchEventToListeners(Events.TimingChanged, this);
  }
  get mimeType() {
    return this.#mimeTypeInternal;
  }
  set mimeType(x) {
    this.#mimeTypeInternal = x;
  }
  get displayName() {
    return this.#parsedURLInternal.displayName;
  }
  name() {
    if (this.#nameInternal) {
      return this.#nameInternal;
    }
    this.parseNameAndPathFromURL();
    return this.#nameInternal;
  }
  path() {
    if (this.#pathInternal) {
      return this.#pathInternal;
    }
    this.parseNameAndPathFromURL();
    return this.#pathInternal;
  }
  parseNameAndPathFromURL() {
    if (this.#parsedURLInternal.isDataURL()) {
      this.#nameInternal = this.#parsedURLInternal.dataURLDisplayName();
      this.#pathInternal = "";
    } else if (this.#parsedURLInternal.isBlobURL()) {
      this.#nameInternal = this.#parsedURLInternal.url;
      this.#pathInternal = "";
    } else if (this.#parsedURLInternal.isAboutBlank()) {
      this.#nameInternal = this.#parsedURLInternal.url;
      this.#pathInternal = "";
    } else {
      this.#pathInternal = this.#parsedURLInternal.host + this.#parsedURLInternal.folderPathComponents;
      const networkManager = NetworkManager.forRequest(this);
      const inspectedURL = networkManager ? Common.ParsedURL.ParsedURL.fromString(networkManager.target().inspectedURL()) : null;
      this.#pathInternal = Platform.StringUtilities.trimURL(this.#pathInternal, inspectedURL ? inspectedURL.host : "");
      if (this.#parsedURLInternal.lastPathComponent || this.#parsedURLInternal.queryParams) {
        this.#nameInternal = this.#parsedURLInternal.lastPathComponent + (this.#parsedURLInternal.queryParams ? "?" + this.#parsedURLInternal.queryParams : "");
      } else if (this.#parsedURLInternal.folderPathComponents) {
        this.#nameInternal = this.#parsedURLInternal.folderPathComponents.substring(this.#parsedURLInternal.folderPathComponents.lastIndexOf("/") + 1) + "/";
        this.#pathInternal = this.#pathInternal.substring(0, this.#pathInternal.lastIndexOf("/"));
      } else {
        this.#nameInternal = this.#parsedURLInternal.host;
        this.#pathInternal = "";
      }
    }
  }
  get folder() {
    let path = this.#parsedURLInternal.path;
    const indexOfQuery = path.indexOf("?");
    if (indexOfQuery !== -1) {
      path = path.substring(0, indexOfQuery);
    }
    const lastSlashIndex = path.lastIndexOf("/");
    return lastSlashIndex !== -1 ? path.substring(0, lastSlashIndex) : "";
  }
  get pathname() {
    return this.#parsedURLInternal.path;
  }
  resourceType() {
    return this.#resourceTypeInternal;
  }
  setResourceType(resourceType) {
    this.#resourceTypeInternal = resourceType;
  }
  get domain() {
    return this.#parsedURLInternal.host;
  }
  get scheme() {
    return this.#parsedURLInternal.scheme;
  }
  redirectSource() {
    return this.#redirectSourceInternal;
  }
  setRedirectSource(originatingRequest) {
    this.#redirectSourceInternal = originatingRequest;
  }
  preflightRequest() {
    return this.#preflightRequestInternal;
  }
  setPreflightRequest(preflightRequest) {
    this.#preflightRequestInternal = preflightRequest;
  }
  preflightInitiatorRequest() {
    return this.#preflightInitiatorRequestInternal;
  }
  setPreflightInitiatorRequest(preflightInitiatorRequest) {
    this.#preflightInitiatorRequestInternal = preflightInitiatorRequest;
  }
  isPreflightRequest() {
    return this.#initiatorInternal !== null && this.#initiatorInternal !== void 0 && this.#initiatorInternal.type === Protocol.Network.InitiatorType.Preflight;
  }
  redirectDestination() {
    return this.#redirectDestinationInternal;
  }
  setRedirectDestination(redirectDestination) {
    this.#redirectDestinationInternal = redirectDestination;
  }
  requestHeaders() {
    return this.#requestHeadersInternal;
  }
  setRequestHeaders(headers) {
    this.#requestHeadersInternal = headers;
    this.dispatchEventToListeners(Events.RequestHeadersChanged);
  }
  requestHeadersText() {
    return this.#requestHeadersTextInternal;
  }
  setRequestHeadersText(text) {
    this.#requestHeadersTextInternal = text;
    this.dispatchEventToListeners(Events.RequestHeadersChanged);
  }
  requestHeaderValue(headerName) {
    if (this.#requestHeaderValues[headerName]) {
      return this.#requestHeaderValues[headerName];
    }
    this.#requestHeaderValues[headerName] = this.computeHeaderValue(this.requestHeaders(), headerName);
    return this.#requestHeaderValues[headerName];
  }
  requestFormData() {
    if (!this.#requestFormDataPromise) {
      this.#requestFormDataPromise = NetworkManager.requestPostData(this);
    }
    return this.#requestFormDataPromise;
  }
  setRequestFormData(hasData, data) {
    this.#requestFormDataPromise = hasData && data === null ? null : Promise.resolve(data);
    this.#formParametersPromise = null;
  }
  filteredProtocolName() {
    const protocol = this.protocol.toLowerCase();
    if (protocol === "h2") {
      return "http/2.0";
    }
    return protocol.replace(/^http\/2(\.0)?\+/, "http/2.0+");
  }
  requestHttpVersion() {
    const headersText = this.requestHeadersText();
    if (!headersText) {
      const version = this.requestHeaderValue("version") || this.requestHeaderValue(":version");
      if (version) {
        return version;
      }
      return this.filteredProtocolName();
    }
    const firstLine = headersText.split(/\r\n/)[0];
    const match = firstLine.match(/(HTTP\/\d+\.\d+)$/);
    return match ? match[1] : "HTTP/0.9";
  }
  get responseHeaders() {
    return this.#responseHeadersInternal || [];
  }
  set responseHeaders(x) {
    this.#responseHeadersInternal = x;
    this.#sortedResponseHeadersInternal = void 0;
    this.#serverTimingsInternal = void 0;
    this.#responseCookiesInternal = void 0;
    this.#responseHeaderValues = {};
    this.dispatchEventToListeners(Events.ResponseHeadersChanged);
  }
  get responseHeadersText() {
    return this.#responseHeadersTextInternal;
  }
  set responseHeadersText(x) {
    this.#responseHeadersTextInternal = x;
    this.dispatchEventToListeners(Events.ResponseHeadersChanged);
  }
  get sortedResponseHeaders() {
    if (this.#sortedResponseHeadersInternal !== void 0) {
      return this.#sortedResponseHeadersInternal;
    }
    this.#sortedResponseHeadersInternal = this.responseHeaders.slice();
    this.#sortedResponseHeadersInternal.sort(function(a, b) {
      return Platform.StringUtilities.compare(a.name.toLowerCase(), b.name.toLowerCase());
    });
    return this.#sortedResponseHeadersInternal;
  }
  responseHeaderValue(headerName) {
    if (headerName in this.#responseHeaderValues) {
      return this.#responseHeaderValues[headerName];
    }
    this.#responseHeaderValues[headerName] = this.computeHeaderValue(this.responseHeaders, headerName);
    return this.#responseHeaderValues[headerName];
  }
  wasIntercepted() {
    return this.#wasIntercepted;
  }
  setWasIntercepted(wasIntercepted) {
    this.#wasIntercepted = wasIntercepted;
  }
  get responseCookies() {
    if (!this.#responseCookiesInternal) {
      this.#responseCookiesInternal = CookieParser.parseSetCookie(this.responseHeaderValue("Set-Cookie"), this.domain) || [];
    }
    return this.#responseCookiesInternal;
  }
  responseLastModified() {
    return this.responseHeaderValue("last-modified");
  }
  allCookiesIncludingBlockedOnes() {
    return [
      ...this.includedRequestCookies(),
      ...this.responseCookies,
      ...this.blockedRequestCookies().map((blockedRequestCookie) => blockedRequestCookie.cookie),
      ...this.blockedResponseCookies().map((blockedResponseCookie) => blockedResponseCookie.cookie)
    ].filter((v) => Boolean(v));
  }
  get serverTimings() {
    if (typeof this.#serverTimingsInternal === "undefined") {
      this.#serverTimingsInternal = ServerTiming.parseHeaders(this.responseHeaders);
    }
    return this.#serverTimingsInternal;
  }
  queryString() {
    if (this.#queryStringInternal !== void 0) {
      return this.#queryStringInternal;
    }
    let queryString = null;
    const url = this.url();
    const questionMarkPosition = url.indexOf("?");
    if (questionMarkPosition !== -1) {
      queryString = url.substring(questionMarkPosition + 1);
      const hashSignPosition = queryString.indexOf("#");
      if (hashSignPosition !== -1) {
        queryString = queryString.substring(0, hashSignPosition);
      }
    }
    this.#queryStringInternal = queryString;
    return this.#queryStringInternal;
  }
  get queryParameters() {
    if (this.#parsedQueryParameters) {
      return this.#parsedQueryParameters;
    }
    const queryString = this.queryString();
    if (!queryString) {
      return null;
    }
    this.#parsedQueryParameters = this.parseParameters(queryString);
    return this.#parsedQueryParameters;
  }
  async parseFormParameters() {
    const requestContentType = this.requestContentType();
    if (!requestContentType) {
      return null;
    }
    if (requestContentType.match(/^application\/x-www-form-urlencoded\s*(;.*)?$/i)) {
      const formData2 = await this.requestFormData();
      if (!formData2) {
        return null;
      }
      return this.parseParameters(formData2);
    }
    const multipartDetails = requestContentType.match(/^multipart\/form-data\s*;\s*boundary\s*=\s*(\S+)\s*$/);
    if (!multipartDetails) {
      return null;
    }
    const boundary = multipartDetails[1];
    if (!boundary) {
      return null;
    }
    const formData = await this.requestFormData();
    if (!formData) {
      return null;
    }
    return this.parseMultipartFormDataParameters(formData, boundary);
  }
  formParameters() {
    if (!this.#formParametersPromise) {
      this.#formParametersPromise = this.parseFormParameters();
    }
    return this.#formParametersPromise;
  }
  responseHttpVersion() {
    const headersText = this.#responseHeadersTextInternal;
    if (!headersText) {
      const version = this.responseHeaderValue("version") || this.responseHeaderValue(":version");
      if (version) {
        return version;
      }
      return this.filteredProtocolName();
    }
    const firstLine = headersText.split(/\r\n/)[0];
    const match = firstLine.match(/^(HTTP\/\d+\.\d+)/);
    return match ? match[1] : "HTTP/0.9";
  }
  parseParameters(queryString) {
    function parseNameValue(pair) {
      const position = pair.indexOf("=");
      if (position === -1) {
        return { name: pair, value: "" };
      }
      return { name: pair.substring(0, position), value: pair.substring(position + 1) };
    }
    return queryString.split("&").map(parseNameValue);
  }
  parseMultipartFormDataParameters(data, boundary) {
    const sanitizedBoundary = Platform.StringUtilities.escapeForRegExp(boundary);
    const keyValuePattern = new RegExp('^\\r\\ncontent-disposition\\s*:\\s*form-data\\s*;\\s*name="([^"]*)"(?:\\s*;\\s*filename="([^"]*)")?(?:\\r\\ncontent-type\\s*:\\s*([^\\r\\n]*))?\\r\\n\\r\\n(.*)\\r\\n$', "is");
    const fields = data.split(new RegExp(`--${sanitizedBoundary}(?:--s*$)?`, "g"));
    return fields.reduce(parseMultipartField, []);
    function parseMultipartField(result, field) {
      const [match, name, filename, contentType, value] = field.match(keyValuePattern) || [];
      if (!match) {
        return result;
      }
      const processedValue = filename || contentType ? i18nString(UIStrings.binary) : value;
      result.push({ name, value: processedValue });
      return result;
    }
  }
  computeHeaderValue(headers, headerName) {
    headerName = headerName.toLowerCase();
    const values = [];
    for (let i = 0; i < headers.length; ++i) {
      if (headers[i].name.toLowerCase() === headerName) {
        values.push(headers[i].value);
      }
    }
    if (!values.length) {
      return void 0;
    }
    if (headerName === "set-cookie") {
      return values.join("\n");
    }
    return values.join(", ");
  }
  contentData() {
    if (this.#contentDataInternal) {
      return this.#contentDataInternal;
    }
    if (this.#contentDataProvider) {
      this.#contentDataInternal = this.#contentDataProvider();
    } else {
      this.#contentDataInternal = NetworkManager.requestContentData(this);
    }
    return this.#contentDataInternal;
  }
  setContentDataProvider(dataProvider) {
    console.assert(!this.#contentDataInternal, "contentData can only be set once.");
    this.#contentDataProvider = dataProvider;
  }
  contentURL() {
    return this.#urlInternal;
  }
  contentType() {
    return this.#resourceTypeInternal;
  }
  async contentEncoded() {
    return (await this.contentData()).encoded;
  }
  async requestContent() {
    const { content, error, encoded } = await this.contentData();
    return {
      content,
      error,
      isEncoded: encoded
    };
  }
  async searchInContent(query, caseSensitive, isRegex) {
    if (!this.#contentDataProvider) {
      return NetworkManager.searchInRequest(this, query, caseSensitive, isRegex);
    }
    const contentData = await this.contentData();
    let content = contentData.content;
    if (!content) {
      return [];
    }
    if (contentData.encoded) {
      content = window.atob(content);
    }
    return TextUtils.TextUtils.performSearchInContent(content, query, caseSensitive, isRegex);
  }
  isHttpFamily() {
    return Boolean(this.url().match(/^https?:/i));
  }
  requestContentType() {
    return this.requestHeaderValue("Content-Type");
  }
  hasErrorStatusCode() {
    return this.statusCode >= 400;
  }
  setInitialPriority(priority) {
    this.#initialPriorityInternal = priority;
  }
  initialPriority() {
    return this.#initialPriorityInternal;
  }
  setPriority(priority) {
    this.#currentPriority = priority;
  }
  priority() {
    return this.#currentPriority || this.#initialPriorityInternal || null;
  }
  setSignedExchangeInfo(info) {
    this.#signedExchangeInfoInternal = info;
  }
  signedExchangeInfo() {
    return this.#signedExchangeInfoInternal;
  }
  setWebBundleInfo(info) {
    this.#webBundleInfoInternal = info;
  }
  webBundleInfo() {
    return this.#webBundleInfoInternal;
  }
  setWebBundleInnerRequestInfo(info) {
    this.#webBundleInnerRequestInfoInternal = info;
  }
  webBundleInnerRequestInfo() {
    return this.#webBundleInnerRequestInfoInternal;
  }
  async populateImageSource(image) {
    const { content, encoded } = await this.contentData();
    let imageSrc = TextUtils.ContentProvider.contentAsDataURL(content, this.#mimeTypeInternal, encoded);
    if (imageSrc === null && !this.#failedInternal) {
      const cacheControl = this.responseHeaderValue("cache-control") || "";
      if (!cacheControl.includes("no-cache")) {
        imageSrc = this.#urlInternal;
      }
    }
    if (imageSrc !== null) {
      image.src = imageSrc;
    }
  }
  initiator() {
    return this.#initiatorInternal || null;
  }
  frames() {
    return this.#framesInternal;
  }
  addProtocolFrameError(errorMessage, time) {
    this.addFrame({ type: WebSocketFrameType.Error, text: errorMessage, time: this.pseudoWallTime(time), opCode: -1, mask: false });
  }
  addProtocolFrame(response, time, sent) {
    const type = sent ? WebSocketFrameType.Send : WebSocketFrameType.Receive;
    this.addFrame({
      type,
      text: response.payloadData,
      time: this.pseudoWallTime(time),
      opCode: response.opcode,
      mask: response.mask
    });
  }
  addFrame(frame) {
    this.#framesInternal.push(frame);
    this.dispatchEventToListeners(Events.WebsocketFrameAdded, frame);
  }
  eventSourceMessages() {
    return this.#eventSourceMessagesInternal;
  }
  addEventSourceMessage(time, eventName, eventId, data) {
    const message = { time: this.pseudoWallTime(time), eventName, eventId, data };
    this.#eventSourceMessagesInternal.push(message);
    this.dispatchEventToListeners(Events.EventSourceMessageAdded, message);
  }
  markAsRedirect(redirectCount) {
    this.#isRedirectInternal = true;
    this.#requestIdInternal = `${this.#backendRequestIdInternal}:redirected.${redirectCount}`;
  }
  isRedirect() {
    return this.#isRedirectInternal;
  }
  setRequestIdForTest(requestId) {
    this.#backendRequestIdInternal = requestId;
    this.#requestIdInternal = requestId;
  }
  charset() {
    const contentTypeHeader = this.responseHeaderValue("content-type");
    if (!contentTypeHeader) {
      return null;
    }
    const responseCharsets = contentTypeHeader.replace(/ /g, "").split(";").filter((parameter) => parameter.toLowerCase().startsWith("charset=")).map((parameter) => parameter.slice("charset=".length));
    if (responseCharsets.length) {
      return responseCharsets[0];
    }
    return null;
  }
  addExtraRequestInfo(extraRequestInfo) {
    this.#blockedRequestCookiesInternal = extraRequestInfo.blockedRequestCookies;
    this.#includedRequestCookiesInternal = extraRequestInfo.includedRequestCookies;
    this.setRequestHeaders(extraRequestInfo.requestHeaders);
    this.#hasExtraRequestInfoInternal = true;
    this.setRequestHeadersText("");
    this.#clientSecurityStateInternal = extraRequestInfo.clientSecurityState;
    this.setConnectTimingFromExtraInfo(extraRequestInfo.connectTiming);
  }
  hasExtraRequestInfo() {
    return this.#hasExtraRequestInfoInternal;
  }
  blockedRequestCookies() {
    return this.#blockedRequestCookiesInternal;
  }
  includedRequestCookies() {
    return this.#includedRequestCookiesInternal;
  }
  hasRequestCookies() {
    return this.#includedRequestCookiesInternal.length > 0 || this.#blockedRequestCookiesInternal.length > 0;
  }
  addExtraResponseInfo(extraResponseInfo) {
    this.#blockedResponseCookiesInternal = extraResponseInfo.blockedResponseCookies;
    this.responseHeaders = extraResponseInfo.responseHeaders;
    if (extraResponseInfo.responseHeadersText) {
      this.responseHeadersText = extraResponseInfo.responseHeadersText;
      if (!this.requestHeadersText()) {
        let requestHeadersText = `${this.requestMethod} ${this.parsedURL.path}`;
        if (this.parsedURL.queryParams) {
          requestHeadersText += `?${this.parsedURL.queryParams}`;
        }
        requestHeadersText += " HTTP/1.1\r\n";
        for (const { name, value } of this.requestHeaders()) {
          requestHeadersText += `${name}: ${value}\r
`;
        }
        this.setRequestHeadersText(requestHeadersText);
      }
    }
    this.#remoteAddressSpaceInternal = extraResponseInfo.resourceIPAddressSpace;
    if (extraResponseInfo.statusCode) {
      this.statusCode = extraResponseInfo.statusCode;
    }
    this.#hasExtraResponseInfoInternal = true;
    const networkManager = NetworkManager.forRequest(this);
    if (networkManager) {
      for (const blockedCookie of this.#blockedResponseCookiesInternal) {
        if (blockedCookie.blockedReasons.includes(Protocol.Network.SetCookieBlockedReason.NameValuePairExceedsMaxSize)) {
          const message = i18nString(UIStrings.setcookieHeaderIsIgnoredIn, { PH1: this.url() });
          networkManager.dispatchEventToListeners(NetworkManagerEvents.MessageGenerated, { message, requestId: this.#requestIdInternal, warning: true });
        }
      }
    }
  }
  hasExtraResponseInfo() {
    return this.#hasExtraResponseInfoInternal;
  }
  blockedResponseCookies() {
    return this.#blockedResponseCookiesInternal;
  }
  redirectSourceSignedExchangeInfoHasNoErrors() {
    return this.#redirectSourceInternal !== null && this.#redirectSourceInternal.#signedExchangeInfoInternal !== null && !this.#redirectSourceInternal.#signedExchangeInfoInternal.errors;
  }
  clientSecurityState() {
    return this.#clientSecurityStateInternal;
  }
  setTrustTokenParams(trustTokenParams) {
    this.#trustTokenParamsInternal = trustTokenParams;
  }
  trustTokenParams() {
    return this.#trustTokenParamsInternal;
  }
  setTrustTokenOperationDoneEvent(doneEvent) {
    this.#trustTokenOperationDoneEventInternal = doneEvent;
    this.dispatchEventToListeners(Events.TrustTokenResultAdded);
  }
  trustTokenOperationDoneEvent() {
    return this.#trustTokenOperationDoneEventInternal;
  }
  setIsSameSite(isSameSite) {
    this.#isSameSiteInternal = isSameSite;
  }
  isSameSite() {
    return this.#isSameSiteInternal;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["FinishedLoading"] = "FinishedLoading";
  Events2["TimingChanged"] = "TimingChanged";
  Events2["RemoteAddressChanged"] = "RemoteAddressChanged";
  Events2["RequestHeadersChanged"] = "RequestHeadersChanged";
  Events2["ResponseHeadersChanged"] = "ResponseHeadersChanged";
  Events2["WebsocketFrameAdded"] = "WebsocketFrameAdded";
  Events2["EventSourceMessageAdded"] = "EventSourceMessageAdded";
  Events2["TrustTokenResultAdded"] = "TrustTokenResultAdded";
  return Events2;
})(Events || {});
export var InitiatorType = /* @__PURE__ */ ((InitiatorType2) => {
  InitiatorType2["Other"] = "other";
  InitiatorType2["Parser"] = "parser";
  InitiatorType2["Redirect"] = "redirect";
  InitiatorType2["Script"] = "script";
  InitiatorType2["Preload"] = "preload";
  InitiatorType2["SignedExchange"] = "signedExchange";
  InitiatorType2["Preflight"] = "preflight";
  return InitiatorType2;
})(InitiatorType || {});
export var WebSocketFrameType = /* @__PURE__ */ ((WebSocketFrameType2) => {
  WebSocketFrameType2["Send"] = "send";
  WebSocketFrameType2["Receive"] = "receive";
  WebSocketFrameType2["Error"] = "error";
  return WebSocketFrameType2;
})(WebSocketFrameType || {});
export const cookieBlockedReasonToUiString = function(blockedReason) {
  switch (blockedReason) {
    case Protocol.Network.CookieBlockedReason.SecureOnly:
      return i18nString(UIStrings.secureOnly);
    case Protocol.Network.CookieBlockedReason.NotOnPath:
      return i18nString(UIStrings.notOnPath);
    case Protocol.Network.CookieBlockedReason.DomainMismatch:
      return i18nString(UIStrings.domainMismatch);
    case Protocol.Network.CookieBlockedReason.SameSiteStrict:
      return i18nString(UIStrings.sameSiteStrict);
    case Protocol.Network.CookieBlockedReason.SameSiteLax:
      return i18nString(UIStrings.sameSiteLax);
    case Protocol.Network.CookieBlockedReason.SameSiteUnspecifiedTreatedAsLax:
      return i18nString(UIStrings.sameSiteUnspecifiedTreatedAsLax);
    case Protocol.Network.CookieBlockedReason.SameSiteNoneInsecure:
      return i18nString(UIStrings.sameSiteNoneInsecure);
    case Protocol.Network.CookieBlockedReason.UserPreferences:
      return i18nString(UIStrings.userPreferences);
    case Protocol.Network.CookieBlockedReason.UnknownError:
      return i18nString(UIStrings.unknownError);
    case Protocol.Network.CookieBlockedReason.SchemefulSameSiteStrict:
      return i18nString(UIStrings.schemefulSameSiteStrict);
    case Protocol.Network.CookieBlockedReason.SchemefulSameSiteLax:
      return i18nString(UIStrings.schemefulSameSiteLax);
    case Protocol.Network.CookieBlockedReason.SchemefulSameSiteUnspecifiedTreatedAsLax:
      return i18nString(UIStrings.schemefulSameSiteUnspecifiedTreatedAsLax);
    case Protocol.Network.CookieBlockedReason.SamePartyFromCrossPartyContext:
      return i18nString(UIStrings.samePartyFromCrossPartyContext);
    case Protocol.Network.CookieBlockedReason.NameValuePairExceedsMaxSize:
      return i18nString(UIStrings.nameValuePairExceedsMaxSize);
  }
  return "";
};
export const setCookieBlockedReasonToUiString = function(blockedReason) {
  switch (blockedReason) {
    case Protocol.Network.SetCookieBlockedReason.SecureOnly:
      return i18nString(UIStrings.blockedReasonSecureOnly);
    case Protocol.Network.SetCookieBlockedReason.SameSiteStrict:
      return i18nString(UIStrings.blockedReasonSameSiteStrictLax, { PH1: "SameSite=Strict" });
    case Protocol.Network.SetCookieBlockedReason.SameSiteLax:
      return i18nString(UIStrings.blockedReasonSameSiteStrictLax, { PH1: "SameSite=Lax" });
    case Protocol.Network.SetCookieBlockedReason.SameSiteUnspecifiedTreatedAsLax:
      return i18nString(UIStrings.blockedReasonSameSiteUnspecifiedTreatedAsLax);
    case Protocol.Network.SetCookieBlockedReason.SameSiteNoneInsecure:
      return i18nString(UIStrings.blockedReasonSameSiteNoneInsecure);
    case Protocol.Network.SetCookieBlockedReason.UserPreferences:
      return i18nString(UIStrings.thisSetcookieWasBlockedDueToUser);
    case Protocol.Network.SetCookieBlockedReason.SyntaxError:
      return i18nString(UIStrings.thisSetcookieHadInvalidSyntax);
    case Protocol.Network.SetCookieBlockedReason.SchemeNotSupported:
      return i18nString(UIStrings.theSchemeOfThisConnectionIsNot);
    case Protocol.Network.SetCookieBlockedReason.OverwriteSecure:
      return i18nString(UIStrings.blockedReasonOverwriteSecure);
    case Protocol.Network.SetCookieBlockedReason.InvalidDomain:
      return i18nString(UIStrings.blockedReasonInvalidDomain);
    case Protocol.Network.SetCookieBlockedReason.InvalidPrefix:
      return i18nString(UIStrings.blockedReasonInvalidPrefix);
    case Protocol.Network.SetCookieBlockedReason.UnknownError:
      return i18nString(UIStrings.anUnknownErrorWasEncounteredWhenTrying);
    case Protocol.Network.SetCookieBlockedReason.SchemefulSameSiteStrict:
      return i18nString(UIStrings.thisSetcookieWasBlockedBecauseItHadTheSamesiteStrictLax, { PH1: "SameSite=Strict" });
    case Protocol.Network.SetCookieBlockedReason.SchemefulSameSiteLax:
      return i18nString(UIStrings.thisSetcookieWasBlockedBecauseItHadTheSamesiteStrictLax, { PH1: "SameSite=Lax" });
    case Protocol.Network.SetCookieBlockedReason.SchemefulSameSiteUnspecifiedTreatedAsLax:
      return i18nString(UIStrings.thisSetcookieDidntSpecifyASamesite);
    case Protocol.Network.SetCookieBlockedReason.SamePartyFromCrossPartyContext:
      return i18nString(UIStrings.thisSetcookieWasBlockedBecauseItHadTheSameparty);
    case Protocol.Network.SetCookieBlockedReason.SamePartyConflictsWithOtherAttributes:
      return i18nString(UIStrings.thisSetcookieWasBlockedBecauseItHadTheSamepartyAttribute);
    case Protocol.Network.SetCookieBlockedReason.NameValuePairExceedsMaxSize:
      return i18nString(UIStrings.thisSetcookieWasBlockedBecauseTheNameValuePairExceedsMaxSize);
  }
  return "";
};
export const cookieBlockedReasonToAttribute = function(blockedReason) {
  switch (blockedReason) {
    case Protocol.Network.CookieBlockedReason.SecureOnly:
      return Attributes.Secure;
    case Protocol.Network.CookieBlockedReason.NotOnPath:
      return Attributes.Path;
    case Protocol.Network.CookieBlockedReason.DomainMismatch:
      return Attributes.Domain;
    case Protocol.Network.CookieBlockedReason.SameSiteStrict:
    case Protocol.Network.CookieBlockedReason.SameSiteLax:
    case Protocol.Network.CookieBlockedReason.SameSiteUnspecifiedTreatedAsLax:
    case Protocol.Network.CookieBlockedReason.SameSiteNoneInsecure:
    case Protocol.Network.CookieBlockedReason.SchemefulSameSiteStrict:
    case Protocol.Network.CookieBlockedReason.SchemefulSameSiteLax:
    case Protocol.Network.CookieBlockedReason.SchemefulSameSiteUnspecifiedTreatedAsLax:
      return Attributes.SameSite;
    case Protocol.Network.CookieBlockedReason.SamePartyFromCrossPartyContext:
      return Attributes.SameParty;
    case Protocol.Network.CookieBlockedReason.NameValuePairExceedsMaxSize:
    case Protocol.Network.CookieBlockedReason.UserPreferences:
    case Protocol.Network.CookieBlockedReason.UnknownError:
      return null;
  }
  return null;
};
export const setCookieBlockedReasonToAttribute = function(blockedReason) {
  switch (blockedReason) {
    case Protocol.Network.SetCookieBlockedReason.SecureOnly:
    case Protocol.Network.SetCookieBlockedReason.OverwriteSecure:
      return Attributes.Secure;
    case Protocol.Network.SetCookieBlockedReason.SameSiteStrict:
    case Protocol.Network.SetCookieBlockedReason.SameSiteLax:
    case Protocol.Network.SetCookieBlockedReason.SameSiteUnspecifiedTreatedAsLax:
    case Protocol.Network.SetCookieBlockedReason.SameSiteNoneInsecure:
    case Protocol.Network.SetCookieBlockedReason.SchemefulSameSiteStrict:
    case Protocol.Network.SetCookieBlockedReason.SchemefulSameSiteLax:
    case Protocol.Network.SetCookieBlockedReason.SchemefulSameSiteUnspecifiedTreatedAsLax:
      return Attributes.SameSite;
    case Protocol.Network.SetCookieBlockedReason.InvalidDomain:
      return Attributes.Domain;
    case Protocol.Network.SetCookieBlockedReason.InvalidPrefix:
      return Attributes.Name;
    case Protocol.Network.SetCookieBlockedReason.SamePartyConflictsWithOtherAttributes:
    case Protocol.Network.SetCookieBlockedReason.SamePartyFromCrossPartyContext:
      return Attributes.SameParty;
    case Protocol.Network.SetCookieBlockedReason.NameValuePairExceedsMaxSize:
    case Protocol.Network.SetCookieBlockedReason.UserPreferences:
    case Protocol.Network.SetCookieBlockedReason.SyntaxError:
    case Protocol.Network.SetCookieBlockedReason.SchemeNotSupported:
    case Protocol.Network.SetCookieBlockedReason.UnknownError:
      return null;
  }
  return null;
};
//# sourceMappingURL=NetworkRequest.js.map
