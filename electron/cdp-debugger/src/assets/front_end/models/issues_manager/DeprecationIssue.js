import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Issue, IssueCategory, IssueKind } from "./Issue.js";
import { resolveLazyDescription } from "./MarkdownIssueDescription.js";
const UIStrings = {
  feature: "Check the feature status page for more details.",
  milestone: "This change will go into effect with milestone {milestone}.",
  title: "Deprecated Feature Used",
  authorizationCoveredByWildcard: "Authorization will not be covered by the wildcard symbol (*) in CORS `Access-Control-Allow-Headers` handling.",
  canRequestURLHTTPContainingNewline: "Resource requests whose URLs contained both removed whitespace `\\(n|r|t)` characters and less-than characters (`<`) are blocked. Please remove newlines and encode less-than characters from places like element attribute values in order to load these resources.",
  chromeLoadTimesConnectionInfo: "`chrome.loadTimes()` is deprecated, instead use standardized API: Navigation Timing 2.",
  chromeLoadTimesFirstPaintAfterLoadTime: "`chrome.loadTimes()` is deprecated, instead use standardized API: Paint Timing.",
  chromeLoadTimesWasAlternateProtocolAvailable: "`chrome.loadTimes()` is deprecated, instead use standardized API: `nextHopProtocol` in Navigation Timing 2.",
  cookieWithTruncatingChar: "Cookies containing a `\\(0|r|n)` character will be rejected instead of truncated.",
  crossOriginAccessBasedOnDocumentDomain: "Relaxing the same-origin policy by setting `document.domain` is deprecated, and will be disabled by default. This deprecation warning is for a cross-origin access that was enabled by setting `document.domain`.",
  crossOriginWindowApi: "Triggering {PH1} from cross origin iframes has been deprecated and will be removed in the future.",
  cssSelectorInternalMediaControlsOverlayCastButton: "The `disableRemotePlayback` attribute should be used in order to disable the default Cast integration instead of using `-internal-media-controls-overlay-cast-button` selector.",
  deprecationExample: "This is an example of a translated deprecation issue message.",
  documentDomainSettingWithoutOriginAgentClusterHeader: "Relaxing the same-origin policy by setting `document.domain` is deprecated, and will be disabled by default. To continue using this feature, please opt-out of origin-keyed agent clusters by sending an `Origin-Agent-Cluster: ?0` header along with the HTTP response for the document and frames. See https://developer.chrome.com/blog/immutable-document-domain/ for more details.",
  eventPath: "`Event.path` is deprecated and will be removed. Please use `Event.composedPath()` instead.",
  geolocationInsecureOrigin: "`getCurrentPosition()` and `watchPosition()` no longer work on insecure origins. To use this feature, you should consider switching your application to a secure origin, such as HTTPS. See https://goo.gle/chrome-insecure-origins for more details.",
  geolocationInsecureOriginDeprecatedNotRemoved: "`getCurrentPosition()` and `watchPosition()` are deprecated on insecure origins. To use this feature, you should consider switching your application to a secure origin, such as HTTPS. See https://goo.gle/chrome-insecure-origins for more details.",
  getUserMediaInsecureOrigin: "`getUserMedia()` no longer works on insecure origins. To use this feature, you should consider switching your application to a secure origin, such as HTTPS. See https://goo.gle/chrome-insecure-origins for more details.",
  hostCandidateAttributeGetter: "`RTCPeerConnectionIceErrorEvent.hostCandidate` is deprecated. Please use `RTCPeerConnectionIceErrorEvent.address` or `RTCPeerConnectionIceErrorEvent.port` instead.",
  identityInCanMakePaymentEvent: "The merchant origin and arbitrary data from the `canmakepayment` service worker event are deprecated and will be removed: `topOrigin`, `paymentRequestOrigin`, `methodData`, `modifiers`.",
  insecurePrivateNetworkSubresourceRequest: "The website requested a subresource from a network that it could only access because of its users' privileged network position. These requests expose non-public devices and servers to the internet, increasing the risk of a cross-site request forgery (CSRF) attack, and/or information leakage. To mitigate these risks, Chrome deprecates requests to non-public subresources when initiated from non-secure contexts, and will start blocking them.",
  legacyConstraintGoogIPv6: "IPv6 is enabled-by-default and the ability to disable it using `googIPv6` is targeted to be removed in M108, after which it will be ignored. Please stop using this legacy constraint.",
  localCSSFileExtensionRejected: "CSS cannot be loaded from `file:` URLs unless they end in a `.css` file extension.",
  mediaSourceAbortRemove: "Using `SourceBuffer.abort()` to abort `remove()`'s asynchronous range removal is deprecated due to specification change. Support will be removed in the future. You should listen to the `updateend` event instead. `abort()` is intended to only abort an asynchronous media append or reset parser state.",
  mediaSourceDurationTruncatingBuffered: "Setting `MediaSource.duration` below the highest presentation timestamp of any buffered coded frames is deprecated due to specification change. Support for implicit removal of truncated buffered media will be removed in the future. You should instead perform explicit `remove(newDuration, oldDuration)` on all `sourceBuffers`, where `newDuration < oldDuration`.",
  noSysexWebMIDIWithoutPermission: "Web MIDI will ask a permission to use even if the sysex is not specified in the `MIDIOptions`.",
  notificationInsecureOrigin: "The Notification API may no longer be used from insecure origins. You should consider switching your application to a secure origin, such as HTTPS. See https://goo.gle/chrome-insecure-origins for more details.",
  notificationPermissionRequestedIframe: "Permission for the Notification API may no longer be requested from a cross-origin iframe. You should consider requesting permission from a top-level frame or opening a new window instead.",
  obsoleteWebRtcCipherSuite: "Your partner is negotiating an obsolete (D)TLS version. Please check with your partner to have this fixed.",
  openWebDatabaseInsecureContext: "WebSQL in non-secure contexts is deprecated and will be removed in M107. Please use Web Storage or Indexed Database.",
  pictureSourceSrc: "`<source src>` with a `<picture>` parent is invalid and therefore ignored. Please use `<source srcset>` instead.",
  vendorSpecificApi: "{PH1} is vendor-specific. Please use the standard {PH2} instead.",
  prefixedStorageInfo: "`window.webkitStorageInfo` is deprecated. Please use standardized `navigator.storage` instead.",
  deprecatedWithReplacement: "{PH1} is deprecated. Please use {PH2} instead.",
  requestedSubresourceWithEmbeddedCredentials: "Subresource requests whose URLs contain embedded credentials (e.g. `https://user:pass@host/`) are blocked.",
  rtcConstraintEnableDtlsSrtpFalse: "The constraint `DtlsSrtpKeyAgreement` is removed. You have specified a `false` value for this constraint, which is interpreted as an attempt to use the removed `SDES key negotiation` method. This functionality is removed; use a service that supports `DTLS key negotiation` instead.",
  rtcConstraintEnableDtlsSrtpTrue: "The constraint `DtlsSrtpKeyAgreement` is removed. You have specified a `true` value for this constraint, which had no effect, but you can remove this constraint for tidiness.",
  rtcPeerConnectionComplexPlanBSdpUsingDefaultSdpSemantics: "`Complex Plan B SDP` detected. This dialect of the `Session Description Protocol` is no longer supported. Please use `Unified Plan SDP` instead.",
  rtcPeerConnectionSdpSemanticsPlanB: "`Plan B SDP semantics`, which is used when constructing an `RTCPeerConnection` with `{sdpSemantics:'plan-b'}`, is a legacy non-standard version of the `Session Description Protocol` that has been permanently deleted from the Web Platform. It is still available when building with `IS_FUCHSIA`, but we intend to delete it as soon as possible. Stop depending on it. See https://crbug.com/1302249 for status.",
  rtcpMuxPolicyNegotiate: "The `rtcpMuxPolicy` option is deprecated and will be removed.",
  sharedArrayBufferConstructedWithoutIsolation: "`SharedArrayBuffer` will require cross-origin isolation. See https://developer.chrome.com/blog/enabling-shared-array-buffer/ for more details.",
  textToSpeech_DisallowedByAutoplay: "`speechSynthesis.speak()` without user activation is deprecated and will be removed.",
  v8SharedArrayBufferConstructedInExtensionWithoutIsolation: "Extensions should opt into cross-origin isolation to continue using `SharedArrayBuffer`. See https://developer.chrome.com/docs/extensions/mv3/cross-origin-isolation/.",
  xhrJSONEncodingDetection: "UTF-16 is not supported by response json in `XMLHttpRequest`",
  xmlHttpRequestSynchronousInNonWorkerOutsideBeforeUnload: "Synchronous `XMLHttpRequest` on the main thread is deprecated because of its detrimental effects to the end user\u2019s experience. For more help, check https://xhr.spec.whatwg.org/.",
  xrSupportsSession: "`supportsSession()` is deprecated. Please use `isSessionSupported()` and check the resolved boolean value instead."
};
const str_ = i18n.i18n.registerUIStrings("models/issues_manager/DeprecationIssue.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class DeprecationIssue extends Issue {
  #issueDetails;
  constructor(issueDetails, issuesModel) {
    const issueCode = [
      Protocol.Audits.InspectorIssueCode.DeprecationIssue,
      issueDetails.type
    ].join("::");
    super({ code: issueCode, umaCode: "DeprecationIssue" }, issuesModel);
    this.#issueDetails = issueDetails;
  }
  getCategory() {
    return IssueCategory.Other;
  }
  details() {
    return this.#issueDetails;
  }
  getDescription() {
    let messageFunction = () => "";
    let feature = 0;
    let milestone = 0;
    switch (this.#issueDetails.type) {
      case Protocol.Audits.DeprecationIssueType.AuthorizationCoveredByWildcard:
        messageFunction = i18nLazyString(UIStrings.authorizationCoveredByWildcard);
        milestone = 97;
        break;
      case Protocol.Audits.DeprecationIssueType.CanRequestURLHTTPContainingNewline:
        messageFunction = i18nLazyString(UIStrings.canRequestURLHTTPContainingNewline);
        feature = 5735596811091968;
        break;
      case Protocol.Audits.DeprecationIssueType.ChromeLoadTimesConnectionInfo:
        messageFunction = i18nLazyString(UIStrings.chromeLoadTimesConnectionInfo);
        feature = 5637885046816768;
        break;
      case Protocol.Audits.DeprecationIssueType.ChromeLoadTimesFirstPaintAfterLoadTime:
        messageFunction = i18nLazyString(UIStrings.chromeLoadTimesFirstPaintAfterLoadTime);
        feature = 5637885046816768;
        break;
      case Protocol.Audits.DeprecationIssueType.ChromeLoadTimesWasAlternateProtocolAvailable:
        messageFunction = i18nLazyString(UIStrings.chromeLoadTimesWasAlternateProtocolAvailable);
        feature = 5637885046816768;
        break;
      case Protocol.Audits.DeprecationIssueType.CookieWithTruncatingChar:
        messageFunction = i18nLazyString(UIStrings.cookieWithTruncatingChar);
        milestone = 103;
        break;
      case Protocol.Audits.DeprecationIssueType.CrossOriginAccessBasedOnDocumentDomain:
        messageFunction = i18nLazyString(UIStrings.crossOriginAccessBasedOnDocumentDomain);
        milestone = 106;
        break;
      case Protocol.Audits.DeprecationIssueType.CrossOriginWindowAlert:
        messageFunction = i18nLazyString(UIStrings.crossOriginWindowApi, { PH1: "window.alert" });
        break;
      case Protocol.Audits.DeprecationIssueType.CrossOriginWindowConfirm:
        messageFunction = i18nLazyString(UIStrings.crossOriginWindowApi, { PH1: "window.confirm" });
        break;
      case Protocol.Audits.DeprecationIssueType.CSSSelectorInternalMediaControlsOverlayCastButton:
        messageFunction = i18nLazyString(UIStrings.cssSelectorInternalMediaControlsOverlayCastButton);
        feature = 5714245488476160;
        break;
      case Protocol.Audits.DeprecationIssueType.DeprecationExample:
        messageFunction = i18nLazyString(UIStrings.deprecationExample);
        feature = 5684289032159232;
        milestone = 100;
        break;
      case Protocol.Audits.DeprecationIssueType.DocumentDomainSettingWithoutOriginAgentClusterHeader:
        messageFunction = i18nLazyString(UIStrings.documentDomainSettingWithoutOriginAgentClusterHeader);
        milestone = 106;
        break;
      case Protocol.Audits.DeprecationIssueType.EventPath:
        messageFunction = i18nLazyString(UIStrings.eventPath);
        feature = 5726124632965120;
        milestone = 109;
        break;
      case Protocol.Audits.DeprecationIssueType.GeolocationInsecureOrigin:
        messageFunction = i18nLazyString(UIStrings.geolocationInsecureOrigin);
        break;
      case Protocol.Audits.DeprecationIssueType.GeolocationInsecureOriginDeprecatedNotRemoved:
        messageFunction = i18nLazyString(UIStrings.geolocationInsecureOriginDeprecatedNotRemoved);
        break;
      case Protocol.Audits.DeprecationIssueType.GetUserMediaInsecureOrigin:
        messageFunction = i18nLazyString(UIStrings.getUserMediaInsecureOrigin);
        break;
      case Protocol.Audits.DeprecationIssueType.HostCandidateAttributeGetter:
        messageFunction = i18nLazyString(UIStrings.hostCandidateAttributeGetter);
        break;
      case Protocol.Audits.DeprecationIssueType.IdentityInCanMakePaymentEvent:
        messageFunction = i18nLazyString(UIStrings.identityInCanMakePaymentEvent);
        feature = 5190978431352832;
        break;
      case Protocol.Audits.DeprecationIssueType.InsecurePrivateNetworkSubresourceRequest:
        messageFunction = i18nLazyString(UIStrings.insecurePrivateNetworkSubresourceRequest);
        feature = 5436853517811712;
        milestone = 92;
        break;
      case Protocol.Audits.DeprecationIssueType.LegacyConstraintGoogIPv6:
        messageFunction = i18nLazyString(UIStrings.legacyConstraintGoogIPv6);
        milestone = 103;
        break;
      case Protocol.Audits.DeprecationIssueType.LocalCSSFileExtensionRejected:
        messageFunction = i18nLazyString(UIStrings.localCSSFileExtensionRejected);
        milestone = 64;
        break;
      case Protocol.Audits.DeprecationIssueType.MediaSourceAbortRemove:
        messageFunction = i18nLazyString(UIStrings.mediaSourceAbortRemove);
        feature = 6107495151960064;
        break;
      case Protocol.Audits.DeprecationIssueType.MediaSourceDurationTruncatingBuffered:
        messageFunction = i18nLazyString(UIStrings.mediaSourceDurationTruncatingBuffered);
        feature = 6107495151960064;
        break;
      case Protocol.Audits.DeprecationIssueType.NoSysexWebMIDIWithoutPermission:
        messageFunction = i18nLazyString(UIStrings.noSysexWebMIDIWithoutPermission);
        feature = 5138066234671104;
        milestone = 82;
        break;
      case Protocol.Audits.DeprecationIssueType.NotificationInsecureOrigin:
        messageFunction = i18nLazyString(UIStrings.notificationInsecureOrigin);
        break;
      case Protocol.Audits.DeprecationIssueType.NotificationPermissionRequestedIframe:
        messageFunction = i18nLazyString(UIStrings.notificationPermissionRequestedIframe);
        feature = 6451284559265792;
        break;
      case Protocol.Audits.DeprecationIssueType.ObsoleteWebRtcCipherSuite:
        messageFunction = i18nLazyString(UIStrings.obsoleteWebRtcCipherSuite);
        milestone = 81;
        break;
      case Protocol.Audits.DeprecationIssueType.OpenWebDatabaseInsecureContext:
        messageFunction = i18nLazyString(UIStrings.openWebDatabaseInsecureContext);
        feature = 5175124599767040;
        milestone = 105;
        break;
      case Protocol.Audits.DeprecationIssueType.PictureSourceSrc:
        messageFunction = i18nLazyString(UIStrings.pictureSourceSrc);
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedCancelAnimationFrame:
        messageFunction = i18nLazyString(UIStrings.vendorSpecificApi, { PH1: "webkitCancelAnimationFrame", PH2: "cancelAnimationFrame" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedRequestAnimationFrame:
        messageFunction = i18nLazyString(UIStrings.vendorSpecificApi, { PH1: "webkitRequestAnimationFrame", PH2: "requestAnimationFrame" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedStorageInfo:
        messageFunction = i18nLazyString(UIStrings.prefixedStorageInfo);
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedVideoDisplayingFullscreen:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "HTMLVideoElement.webkitDisplayingFullscreen", PH2: "Document.fullscreenElement" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedVideoEnterFullScreen:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "HTMLVideoElement.webkitEnterFullScreen()", PH2: "Element.requestFullscreen()" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedVideoEnterFullscreen:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "HTMLVideoElement.webkitEnterFullscreen()", PH2: "Element.requestFullscreen()" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedVideoExitFullScreen:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "HTMLVideoElement.webkitExitFullScreen()", PH2: "Document.exitFullscreen()" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedVideoExitFullscreen:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "HTMLVideoElement.webkitExitFullscreen()", PH2: "Document.exitFullscreen()" });
        break;
      case Protocol.Audits.DeprecationIssueType.PrefixedVideoSupportsFullscreen:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "HTMLVideoElement.webkitSupportsFullscreen", PH2: "Document.fullscreenEnabled" });
        break;
      case Protocol.Audits.DeprecationIssueType.RangeExpand:
        messageFunction = i18nLazyString(UIStrings.deprecatedWithReplacement, { PH1: "Range.expand()", PH2: "Selection.modify()" });
        break;
      case Protocol.Audits.DeprecationIssueType.RequestedSubresourceWithEmbeddedCredentials:
        messageFunction = i18nLazyString(UIStrings.requestedSubresourceWithEmbeddedCredentials);
        feature = 5669008342777856;
        break;
      case Protocol.Audits.DeprecationIssueType.RTCConstraintEnableDtlsSrtpFalse:
        messageFunction = i18nLazyString(UIStrings.rtcConstraintEnableDtlsSrtpFalse);
        milestone = 97;
        break;
      case Protocol.Audits.DeprecationIssueType.RTCConstraintEnableDtlsSrtpTrue:
        messageFunction = i18nLazyString(UIStrings.rtcConstraintEnableDtlsSrtpTrue);
        milestone = 97;
        break;
      case Protocol.Audits.DeprecationIssueType.RTCPeerConnectionComplexPlanBSdpUsingDefaultSdpSemantics:
        messageFunction = i18nLazyString(UIStrings.rtcPeerConnectionComplexPlanBSdpUsingDefaultSdpSemantics);
        milestone = 72;
        break;
      case Protocol.Audits.DeprecationIssueType.RTCPeerConnectionSdpSemanticsPlanB:
        messageFunction = i18nLazyString(UIStrings.rtcPeerConnectionSdpSemanticsPlanB);
        feature = 5823036655665152;
        milestone = 93;
        break;
      case Protocol.Audits.DeprecationIssueType.RtcpMuxPolicyNegotiate:
        messageFunction = i18nLazyString(UIStrings.rtcpMuxPolicyNegotiate);
        feature = 5654810086866944;
        milestone = 62;
        break;
      case Protocol.Audits.DeprecationIssueType.SharedArrayBufferConstructedWithoutIsolation:
        messageFunction = i18nLazyString(UIStrings.sharedArrayBufferConstructedWithoutIsolation);
        milestone = 106;
        break;
      case Protocol.Audits.DeprecationIssueType.TextToSpeech_DisallowedByAutoplay:
        messageFunction = i18nLazyString(UIStrings.textToSpeech_DisallowedByAutoplay);
        feature = 5687444770914304;
        milestone = 71;
        break;
      case Protocol.Audits.DeprecationIssueType.V8SharedArrayBufferConstructedInExtensionWithoutIsolation:
        messageFunction = i18nLazyString(UIStrings.v8SharedArrayBufferConstructedInExtensionWithoutIsolation);
        milestone = 96;
        break;
      case Protocol.Audits.DeprecationIssueType.XHRJSONEncodingDetection:
        messageFunction = i18nLazyString(UIStrings.xhrJSONEncodingDetection);
        milestone = 93;
        break;
      case Protocol.Audits.DeprecationIssueType.XMLHttpRequestSynchronousInNonWorkerOutsideBeforeUnload:
        messageFunction = i18nLazyString(UIStrings.xmlHttpRequestSynchronousInNonWorkerOutsideBeforeUnload);
        break;
      case Protocol.Audits.DeprecationIssueType.XRSupportsSession:
        messageFunction = i18nLazyString(UIStrings.xrSupportsSession);
        milestone = 80;
        break;
    }
    const links = [];
    if (feature !== 0) {
      links.push({
        link: `https://chromestatus.com/feature/${feature}`,
        linkTitle: i18nLazyString(UIStrings.feature)
      });
    }
    if (milestone !== 0) {
      links.push({
        link: "https://chromiumdash.appspot.com/schedule",
        linkTitle: i18nLazyString(UIStrings.milestone, { milestone })
      });
    }
    return resolveLazyDescription({
      file: "deprecation.md",
      substitutions: /* @__PURE__ */ new Map([
        ["PLACEHOLDER_title", i18nLazyString(UIStrings.title)],
        ["PLACEHOLDER_message", messageFunction]
      ]),
      links
    });
  }
  sources() {
    if (this.#issueDetails.sourceCodeLocation) {
      return [this.#issueDetails.sourceCodeLocation];
    }
    return [];
  }
  primaryKey() {
    return JSON.stringify(this.#issueDetails);
  }
  getKind() {
    return IssueKind.BreakingChange;
  }
  static fromInspectorIssue(issuesModel, inspectorIssue) {
    const details = inspectorIssue.details.deprecationIssueDetails;
    if (!details) {
      console.warn("Deprecation issue without details received.");
      return [];
    }
    return [new DeprecationIssue(details, issuesModel)];
  }
}
//# sourceMappingURL=DeprecationIssue.js.map
