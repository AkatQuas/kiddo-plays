import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import * as UI from "../../ui/legacy/legacy.js";
import lockIconStyles from "./lockIcon.css.js";
import mainViewStyles from "./mainView.css.js";
import originViewStyles from "./originView.css.js";
import sidebarStyles from "./sidebar.css.js";
import { Events, SecurityModel, SecurityStyleExplanation, SummaryMessages } from "./SecurityModel.js";
const UIStrings = {
  overview: "Overview",
  mainOrigin: "Main origin",
  nonsecureOrigins: "Non-secure origins",
  secureOrigins: "Secure origins",
  unknownCanceled: "Unknown / canceled",
  reloadToViewDetails: "Reload to view details",
  mainOriginSecure: "Main origin (secure)",
  mainOriginNonsecure: "Main origin (non-secure)",
  securityOverview: "Security overview",
  secure: "Secure",
  info: "Info",
  notSecure: "Not secure",
  viewCertificate: "View certificate",
  notSecureBroken: "Not secure (broken)",
  thisPageIsDangerousFlaggedBy: "This page is dangerous (flagged by Google Safe Browsing).",
  flaggedByGoogleSafeBrowsing: "Flagged by Google Safe Browsing",
  toCheckThisPagesStatusVisit: "To check this page's status, visit g.co/safebrowsingstatus.",
  thisIsAnErrorPage: "This is an error page.",
  thisPageIsInsecureUnencrypted: "This page is insecure (unencrypted HTTP).",
  thisPageHasANonhttpsSecureOrigin: "This page has a non-HTTPS secure origin.",
  thisPageIsSuspicious: "This page is suspicious",
  chromeHasDeterminedThatThisSiteS: "Chrome has determined that this site could be fake or fraudulent.",
  ifYouBelieveThisIsShownIn: "If you believe this is shown in error please visit https://g.co/chrome/lookalike-warnings.",
  possibleSpoofingUrl: "Possible spoofing URL",
  thisSitesHostnameLooksSimilarToP: "This site's hostname looks similar to {PH1}. Attackers sometimes mimic sites by making small, hard-to-see changes to the domain name.",
  ifYouBelieveThisIsShownInErrorSafety: "If you believe this is shown in error please visit https://g.co/chrome/lookalike-warnings.",
  thisPageIsSuspiciousFlaggedBy: "This page is suspicious (flagged by Chrome).",
  certificate: "Certificate",
  insecureSha: "insecure (SHA-1)",
  theCertificateChainForThisSite: "The certificate chain for this site contains a certificate signed using SHA-1.",
  subjectAlternativeNameMissing: "`Subject Alternative Name` missing",
  theCertificateForThisSiteDoesNot: "The certificate for this site does not contain a `Subject Alternative Name` extension containing a domain name or IP address.",
  missing: "missing",
  thisSiteIsMissingAValidTrusted: "This site is missing a valid, trusted certificate ({PH1}).",
  validAndTrusted: "valid and trusted",
  theConnectionToThisSiteIsUsingA: "The connection to this site is using a valid, trusted server certificate issued by {PH1}.",
  publickeypinningBypassed: "Public-Key-Pinning bypassed",
  publickeypinningWasBypassedByA: "Public-Key-Pinning was bypassed by a local root certificate.",
  certificateExpiresSoon: "Certificate expires soon",
  theCertificateForThisSiteExpires: "The certificate for this site expires in less than 48 hours and needs to be renewed.",
  connection: "Connection",
  secureConnectionSettings: "secure connection settings",
  theConnectionToThisSiteIs: "The connection to this site is encrypted and authenticated using {PH1}, {PH2}, and {PH3}.",
  sIsObsoleteEnableTlsOrLater: "{PH1} is obsolete. Enable TLS 1.2 or later.",
  rsaKeyExchangeIsObsoleteEnableAn: "RSA key exchange is obsolete. Enable an ECDHE-based cipher suite.",
  sIsObsoleteEnableAnAesgcmbased: "{PH1} is obsolete. Enable an AES-GCM-based cipher suite.",
  theServerSignatureUsesShaWhichIs: "The server signature uses SHA-1, which is obsolete. Enable a SHA-2 signature algorithm instead. (Note this is different from the signature in the certificate.)",
  obsoleteConnectionSettings: "obsolete connection settings",
  resources: "Resources",
  activeMixedContent: "active mixed content",
  youHaveRecentlyAllowedNonsecure: "You have recently allowed non-secure content (such as scripts or iframes) to run on this site.",
  mixedContent: "mixed content",
  thisPageIncludesHttpResources: "This page includes HTTP resources.",
  nonsecureForm: "non-secure form",
  thisPageIncludesAFormWithA: 'This page includes a form with a non-secure "action" attribute.',
  activeContentWithCertificate: "active content with certificate errors",
  youHaveRecentlyAllowedContent: "You have recently allowed content loaded with certificate errors (such as scripts or iframes) to run on this site.",
  contentWithCertificateErrors: "content with certificate errors",
  thisPageIncludesResourcesThat: "This page includes resources that were loaded with certificate errors.",
  allServedSecurely: "all served securely",
  allResourcesOnThisPageAreServed: "All resources on this page are served securely.",
  blockedMixedContent: "Blocked mixed content",
  yourPageRequestedNonsecure: "Your page requested non-secure resources that were blocked.",
  reloadThePageToRecordRequestsFor: "Reload the page to record requests for HTTP resources.",
  viewDRequestsInNetworkPanel: "{n, plural, =1 {View # request in Network Panel} other {View # requests in Network Panel}}",
  origin: "Origin",
  viewRequestsInNetworkPanel: "View requests in Network Panel",
  protocol: "Protocol",
  keyExchange: "Key exchange",
  keyExchangeGroup: "Key exchange group",
  cipher: "Cipher",
  certificateTransparency: "Certificate Transparency",
  subject: "Subject",
  validFrom: "Valid from",
  validUntil: "Valid until",
  issuer: "Issuer",
  openFullCertificateDetails: "Open full certificate details",
  sct: "SCT",
  logName: "Log name",
  logId: "Log ID",
  validationStatus: "Validation status",
  source: "Source",
  issuedAt: "Issued at",
  hashAlgorithm: "Hash algorithm",
  signatureAlgorithm: "Signature algorithm",
  signatureData: "Signature data",
  showFullDetails: "Show full details",
  hideFullDetails: "Hide full details",
  thisRequestCompliesWithChromes: "This request complies with `Chrome`'s Certificate Transparency policy.",
  thisRequestDoesNotComplyWith: "This request does not comply with `Chrome`'s Certificate Transparency policy.",
  thisResponseWasLoadedFromCache: "This response was loaded from cache. Some security details might be missing.",
  theSecurityDetailsAboveAreFrom: "The security details above are from the first inspected response.",
  thisOriginIsANonhttpsSecure: "This origin is a non-HTTPS secure origin.",
  yourConnectionToThisOriginIsNot: "Your connection to this origin is not secure.",
  noSecurityInformation: "No security information",
  noSecurityDetailsAreAvailableFor: "No security details are available for this origin.",
  na: "(n/a)",
  showLess: "Show less",
  showMoreSTotal: "Show more ({PH1} total)"
};
const str_ = i18n.i18n.registerUIStrings("panels/security/SecurityPanel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let securityPanelInstance;
export class SecurityPanel extends UI.Panel.PanelWithSidebar {
  mainView;
  sidebarMainViewElement;
  sidebarTree;
  lastResponseReceivedForLoaderId;
  origins;
  filterRequestCounts;
  visibleView;
  eventListeners;
  securityModel;
  constructor() {
    super("security");
    this.mainView = new SecurityMainView(this);
    const title = document.createElement("span");
    title.classList.add("title");
    title.textContent = i18nString(UIStrings.overview);
    this.sidebarMainViewElement = new SecurityPanelSidebarTreeElement(title, this.setVisibleView.bind(this, this.mainView), "security-main-view-sidebar-tree-item", "lock-icon");
    this.sidebarMainViewElement.tooltip = title.textContent;
    this.sidebarTree = new SecurityPanelSidebarTree(this.sidebarMainViewElement, this.showOrigin.bind(this));
    this.panelSidebarElement().appendChild(this.sidebarTree.element);
    this.lastResponseReceivedForLoaderId = /* @__PURE__ */ new Map();
    this.origins = /* @__PURE__ */ new Map();
    this.filterRequestCounts = /* @__PURE__ */ new Map();
    SDK.TargetManager.TargetManager.instance().observeModels(SecurityModel, this);
    this.visibleView = null;
    this.eventListeners = [];
    this.securityModel = null;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!securityPanelInstance || forceNew) {
      securityPanelInstance = new SecurityPanel();
    }
    return securityPanelInstance;
  }
  static createCertificateViewerButtonForOrigin(text, origin) {
    const certificateButton = UI.UIUtils.createTextButton(text, async (e) => {
      e.consume();
      const names = await SDK.NetworkManager.MultitargetNetworkManager.instance().getCertificate(origin);
      if (names.length > 0) {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.showCertificateViewer(names);
      }
    }, "origin-button");
    UI.ARIAUtils.markAsButton(certificateButton);
    return certificateButton;
  }
  static createCertificateViewerButtonForCert(text, names) {
    const certificateButton = UI.UIUtils.createTextButton(text, (e) => {
      e.consume();
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.showCertificateViewer(names);
    }, "origin-button");
    UI.ARIAUtils.markAsButton(certificateButton);
    return certificateButton;
  }
  static createHighlightedUrl(url, securityState) {
    const schemeSeparator = "://";
    const index = url.indexOf(schemeSeparator);
    if (index === -1) {
      const text = document.createElement("span");
      text.textContent = url;
      return text;
    }
    const highlightedUrl = document.createElement("span");
    const scheme = url.substr(0, index);
    const content = url.substr(index + schemeSeparator.length);
    highlightedUrl.createChild("span", "url-scheme-" + securityState).textContent = scheme;
    highlightedUrl.createChild("span", "url-scheme-separator").textContent = schemeSeparator;
    highlightedUrl.createChild("span").textContent = content;
    return highlightedUrl;
  }
  updateVisibleSecurityState(visibleSecurityState) {
    this.sidebarMainViewElement.setSecurityState(visibleSecurityState.securityState);
    this.mainView.updateVisibleSecurityState(visibleSecurityState);
  }
  onVisibleSecurityStateChanged({ data }) {
    this.updateVisibleSecurityState(data);
  }
  selectAndSwitchToMainView() {
    this.sidebarMainViewElement.select(true);
  }
  showOrigin(origin) {
    const originState = this.origins.get(origin);
    if (!originState) {
      return;
    }
    if (!originState.originView) {
      originState.originView = new SecurityOriginView(this, origin, originState);
    }
    this.setVisibleView(originState.originView);
  }
  wasShown() {
    super.wasShown();
    if (!this.visibleView) {
      this.selectAndSwitchToMainView();
    }
  }
  focus() {
    this.sidebarTree.focus();
  }
  setVisibleView(view) {
    if (this.visibleView === view) {
      return;
    }
    if (this.visibleView) {
      this.visibleView.detach();
    }
    this.visibleView = view;
    if (view) {
      this.splitWidget().setMainWidget(view);
    }
  }
  onResponseReceived(event) {
    const request = event.data.request;
    if (request.resourceType() === Common.ResourceType.resourceTypes.Document && request.loaderId) {
      this.lastResponseReceivedForLoaderId.set(request.loaderId, request);
    }
  }
  processRequest(request) {
    const origin = Common.ParsedURL.ParsedURL.extractOrigin(request.url());
    if (!origin) {
      return;
    }
    let securityState = request.securityState();
    if (request.mixedContentType === Protocol.Security.MixedContentType.Blockable || request.mixedContentType === Protocol.Security.MixedContentType.OptionallyBlockable) {
      securityState = Protocol.Security.SecurityState.Insecure;
    }
    const originState = this.origins.get(origin);
    if (originState) {
      const oldSecurityState = originState.securityState;
      originState.securityState = this.securityStateMin(oldSecurityState, securityState);
      if (oldSecurityState !== originState.securityState) {
        const securityDetails = request.securityDetails();
        if (securityDetails) {
          originState.securityDetails = securityDetails;
        }
        this.sidebarTree.updateOrigin(origin, securityState);
        if (originState.originView) {
          originState.originView.setSecurityState(securityState);
        }
      }
    } else {
      const newOriginState = {
        securityState,
        securityDetails: request.securityDetails(),
        loadedFromCache: request.cached(),
        originView: void 0
      };
      this.origins.set(origin, newOriginState);
      this.sidebarTree.addOrigin(origin, securityState);
    }
  }
  onRequestFinished(event) {
    const request = event.data;
    this.updateFilterRequestCounts(request);
    this.processRequest(request);
  }
  updateFilterRequestCounts(request) {
    if (request.mixedContentType === Protocol.Security.MixedContentType.None) {
      return;
    }
    let filterKey = NetworkForward.UIFilter.MixedContentFilterValues.All;
    if (request.wasBlocked()) {
      filterKey = NetworkForward.UIFilter.MixedContentFilterValues.Blocked;
    } else if (request.mixedContentType === Protocol.Security.MixedContentType.Blockable) {
      filterKey = NetworkForward.UIFilter.MixedContentFilterValues.BlockOverridden;
    } else if (request.mixedContentType === Protocol.Security.MixedContentType.OptionallyBlockable) {
      filterKey = NetworkForward.UIFilter.MixedContentFilterValues.Displayed;
    }
    const currentCount = this.filterRequestCounts.get(filterKey);
    if (!currentCount) {
      this.filterRequestCounts.set(filterKey, 1);
    } else {
      this.filterRequestCounts.set(filterKey, currentCount + 1);
    }
    this.mainView.refreshExplanations();
  }
  filterRequestCount(filterKey) {
    return this.filterRequestCounts.get(filterKey) || 0;
  }
  securityStateMin(stateA, stateB) {
    return SecurityModel.SecurityStateComparator(stateA, stateB) < 0 ? stateA : stateB;
  }
  modelAdded(securityModel) {
    if (this.securityModel) {
      return;
    }
    this.securityModel = securityModel;
    const resourceTreeModel = securityModel.resourceTreeModel();
    const networkManager = securityModel.networkManager();
    this.eventListeners = [
      securityModel.addEventListener(Events.VisibleSecurityStateChanged, this.onVisibleSecurityStateChanged, this),
      resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.MainFrameNavigated, this.onMainFrameNavigated, this),
      resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.InterstitialShown, this.onInterstitialShown, this),
      resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.InterstitialHidden, this.onInterstitialHidden, this),
      networkManager.addEventListener(SDK.NetworkManager.Events.ResponseReceived, this.onResponseReceived, this),
      networkManager.addEventListener(SDK.NetworkManager.Events.RequestFinished, this.onRequestFinished, this)
    ];
    if (resourceTreeModel.isInterstitialShowing) {
      this.onInterstitialShown();
    }
  }
  modelRemoved(securityModel) {
    if (this.securityModel !== securityModel) {
      return;
    }
    this.securityModel = null;
    Common.EventTarget.removeEventListeners(this.eventListeners);
  }
  onMainFrameNavigated(event) {
    const frame = event.data;
    const request = this.lastResponseReceivedForLoaderId.get(frame.loaderId);
    this.selectAndSwitchToMainView();
    this.sidebarTree.clearOrigins();
    this.origins.clear();
    this.lastResponseReceivedForLoaderId.clear();
    this.filterRequestCounts.clear();
    this.mainView.refreshExplanations();
    const origin = Common.ParsedURL.ParsedURL.extractOrigin(request ? request.url() : frame.url);
    this.sidebarTree.setMainOrigin(origin);
    if (request) {
      this.processRequest(request);
    }
  }
  onInterstitialShown() {
    this.selectAndSwitchToMainView();
    this.sidebarTree.toggleOriginsList(true);
  }
  onInterstitialHidden() {
    this.sidebarTree.toggleOriginsList(false);
  }
}
export class SecurityPanelSidebarTree extends UI.TreeOutline.TreeOutlineInShadow {
  showOriginInPanel;
  mainOrigin;
  originGroupTitles;
  originGroups;
  elementsByOrigin;
  constructor(mainViewElement, showOriginInPanel) {
    super();
    this.appendChild(mainViewElement);
    this.registerCSSFiles([lockIconStyles, sidebarStyles]);
    this.showOriginInPanel = showOriginInPanel;
    this.mainOrigin = null;
    this.originGroupTitles = /* @__PURE__ */ new Map([
      [OriginGroup.MainOrigin, i18nString(UIStrings.mainOrigin)],
      [OriginGroup.NonSecure, i18nString(UIStrings.nonsecureOrigins)],
      [OriginGroup.Secure, i18nString(UIStrings.secureOrigins)],
      [OriginGroup.Unknown, i18nString(UIStrings.unknownCanceled)]
    ]);
    this.originGroups = /* @__PURE__ */ new Map();
    for (const group of Object.values(OriginGroup)) {
      const element = this.createOriginGroupElement(this.originGroupTitles.get(group));
      this.originGroups.set(group, element);
      this.appendChild(element);
    }
    this.clearOriginGroups();
    const mainViewReloadMessage = new UI.TreeOutline.TreeElement(i18nString(UIStrings.reloadToViewDetails));
    mainViewReloadMessage.selectable = false;
    mainViewReloadMessage.listItemElement.classList.add("security-main-view-reload-message");
    const treeElement = this.originGroups.get(OriginGroup.MainOrigin);
    treeElement.appendChild(mainViewReloadMessage);
    this.elementsByOrigin = /* @__PURE__ */ new Map();
  }
  originGroupTitle(originGroup) {
    return this.originGroupTitles.get(originGroup);
  }
  originGroupElement(originGroup) {
    return this.originGroups.get(originGroup);
  }
  createOriginGroupElement(originGroupTitle) {
    const originGroup = new UI.TreeOutline.TreeElement(originGroupTitle, true);
    originGroup.selectable = false;
    originGroup.setCollapsible(false);
    originGroup.expand();
    originGroup.listItemElement.classList.add("security-sidebar-origins");
    UI.ARIAUtils.setAccessibleName(originGroup.childrenListElement, originGroupTitle);
    return originGroup;
  }
  toggleOriginsList(hidden) {
    for (const element of this.originGroups.values()) {
      element.hidden = hidden;
    }
  }
  addOrigin(origin, securityState) {
    const originElement = new SecurityPanelSidebarTreeElement(SecurityPanel.createHighlightedUrl(origin, securityState), this.showOriginInPanel.bind(this, origin), "security-sidebar-tree-item", "security-property");
    originElement.tooltip = origin;
    this.elementsByOrigin.set(origin, originElement);
    this.updateOrigin(origin, securityState);
  }
  setMainOrigin(origin) {
    this.mainOrigin = origin;
  }
  updateOrigin(origin, securityState) {
    const originElement = this.elementsByOrigin.get(origin);
    originElement.setSecurityState(securityState);
    let newParent;
    if (origin === this.mainOrigin) {
      newParent = this.originGroups.get(OriginGroup.MainOrigin);
      if (securityState === Protocol.Security.SecurityState.Secure) {
        newParent.title = i18nString(UIStrings.mainOriginSecure);
      } else {
        newParent.title = i18nString(UIStrings.mainOriginNonsecure);
      }
      UI.ARIAUtils.setAccessibleName(newParent.childrenListElement, newParent.title);
    } else {
      switch (securityState) {
        case Protocol.Security.SecurityState.Secure:
          newParent = this.originGroupElement(OriginGroup.Secure);
          break;
        case Protocol.Security.SecurityState.Unknown:
          newParent = this.originGroupElement(OriginGroup.Unknown);
          break;
        default:
          newParent = this.originGroupElement(OriginGroup.NonSecure);
          break;
      }
    }
    const oldParent = originElement.parent;
    if (oldParent !== newParent) {
      if (oldParent) {
        oldParent.removeChild(originElement);
        if (oldParent.childCount() === 0) {
          oldParent.hidden = true;
        }
      }
      newParent.appendChild(originElement);
      newParent.hidden = false;
    }
  }
  clearOriginGroups() {
    for (const originGroup of this.originGroups.values()) {
      originGroup.removeChildren();
      originGroup.hidden = true;
    }
    const mainOrigin = this.originGroupElement(OriginGroup.MainOrigin);
    mainOrigin.title = this.originGroupTitle(OriginGroup.MainOrigin);
    mainOrigin.hidden = false;
  }
  clearOrigins() {
    this.clearOriginGroups();
    this.elementsByOrigin.clear();
  }
  wasShown() {
  }
}
export var OriginGroup = /* @__PURE__ */ ((OriginGroup2) => {
  OriginGroup2["MainOrigin"] = "MainOrigin";
  OriginGroup2["NonSecure"] = "NonSecure";
  OriginGroup2["Secure"] = "Secure";
  OriginGroup2["Unknown"] = "Unknown";
  return OriginGroup2;
})(OriginGroup || {});
export class SecurityPanelSidebarTreeElement extends UI.TreeOutline.TreeElement {
  selectCallback;
  cssPrefix;
  iconElement;
  securityStateInternal;
  constructor(textElement, selectCallback, className, cssPrefix) {
    super("", false);
    this.selectCallback = selectCallback;
    this.cssPrefix = cssPrefix;
    this.listItemElement.classList.add(className);
    this.iconElement = this.listItemElement.createChild("div", "icon");
    this.iconElement.classList.add(this.cssPrefix);
    this.listItemElement.appendChild(textElement);
    this.securityStateInternal = null;
    this.setSecurityState(Protocol.Security.SecurityState.Unknown);
  }
  setSecurityState(newSecurityState) {
    if (this.securityStateInternal) {
      this.iconElement.classList.remove(this.cssPrefix + "-" + this.securityStateInternal);
    }
    this.securityStateInternal = newSecurityState;
    this.iconElement.classList.add(this.cssPrefix + "-" + newSecurityState);
  }
  securityState() {
    return this.securityStateInternal;
  }
  onselect() {
    this.selectCallback();
    return true;
  }
}
export class SecurityMainView extends UI.Widget.VBox {
  panel;
  summarySection;
  securityExplanationsMain;
  securityExplanationsExtra;
  lockSpectrum;
  summaryText;
  explanations;
  securityState;
  constructor(panel) {
    super(true);
    this.setMinimumSize(200, 100);
    this.contentElement.classList.add("security-main-view");
    this.panel = panel;
    this.summarySection = this.contentElement.createChild("div", "security-summary");
    this.securityExplanationsMain = this.contentElement.createChild("div", "security-explanation-list security-explanations-main");
    this.securityExplanationsExtra = this.contentElement.createChild("div", "security-explanation-list security-explanations-extra");
    const summaryDiv = this.summarySection.createChild("div", "security-summary-section-title");
    summaryDiv.textContent = i18nString(UIStrings.securityOverview);
    UI.ARIAUtils.markAsHeading(summaryDiv, 1);
    const lockSpectrum = this.summarySection.createChild("div", "lock-spectrum");
    this.lockSpectrum = /* @__PURE__ */ new Map([
      [Protocol.Security.SecurityState.Secure, lockSpectrum.createChild("div", "lock-icon lock-icon-secure")],
      [Protocol.Security.SecurityState.Neutral, lockSpectrum.createChild("div", "lock-icon lock-icon-neutral")],
      [Protocol.Security.SecurityState.Insecure, lockSpectrum.createChild("div", "lock-icon lock-icon-insecure")]
    ]);
    UI.Tooltip.Tooltip.install(this.getLockSpectrumDiv(Protocol.Security.SecurityState.Secure), i18nString(UIStrings.secure));
    UI.Tooltip.Tooltip.install(this.getLockSpectrumDiv(Protocol.Security.SecurityState.Neutral), i18nString(UIStrings.info));
    UI.Tooltip.Tooltip.install(this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure), i18nString(UIStrings.notSecure));
    this.summarySection.createChild("div", "triangle-pointer-container").createChild("div", "triangle-pointer-wrapper").createChild("div", "triangle-pointer");
    this.summaryText = this.summarySection.createChild("div", "security-summary-text");
    UI.ARIAUtils.markAsHeading(this.summaryText, 2);
    this.explanations = null;
    this.securityState = null;
  }
  getLockSpectrumDiv(securityState) {
    const element = this.lockSpectrum.get(securityState);
    if (!element) {
      throw new Error(`Invalid argument: ${securityState}`);
    }
    return element;
  }
  addExplanation(parent, explanation) {
    const explanationSection = parent.createChild("div", "security-explanation");
    explanationSection.classList.add("security-explanation-" + explanation.securityState);
    explanationSection.createChild("div", "security-property").classList.add("security-property-" + explanation.securityState);
    const text = explanationSection.createChild("div", "security-explanation-text");
    const explanationHeader = text.createChild("div", "security-explanation-title");
    if (explanation.title) {
      explanationHeader.createChild("span").textContent = explanation.title + " - ";
      explanationHeader.createChild("span", "security-explanation-title-" + explanation.securityState).textContent = explanation.summary;
    } else {
      explanationHeader.textContent = explanation.summary;
    }
    text.createChild("div").textContent = explanation.description;
    if (explanation.certificate.length) {
      text.appendChild(SecurityPanel.createCertificateViewerButtonForCert(i18nString(UIStrings.viewCertificate), explanation.certificate));
    }
    if (explanation.recommendations && explanation.recommendations.length) {
      const recommendationList = text.createChild("ul", "security-explanation-recommendations");
      for (const recommendation of explanation.recommendations) {
        recommendationList.createChild("li").textContent = recommendation;
      }
    }
    return text;
  }
  updateVisibleSecurityState(visibleSecurityState) {
    this.summarySection.classList.remove("security-summary-" + this.securityState);
    this.securityState = visibleSecurityState.securityState;
    this.summarySection.classList.add("security-summary-" + this.securityState);
    if (this.securityState === Protocol.Security.SecurityState.Insecure) {
      this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure).classList.add("lock-icon-insecure");
      this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure).classList.remove("lock-icon-insecure-broken");
      UI.Tooltip.Tooltip.install(this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure), i18nString(UIStrings.notSecure));
    } else if (this.securityState === Protocol.Security.SecurityState.InsecureBroken) {
      this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure).classList.add("lock-icon-insecure-broken");
      this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure).classList.remove("lock-icon-insecure");
      UI.Tooltip.Tooltip.install(this.getLockSpectrumDiv(Protocol.Security.SecurityState.Insecure), i18nString(UIStrings.notSecureBroken));
    }
    const { summary, explanations } = this.getSecuritySummaryAndExplanations(visibleSecurityState);
    this.summaryText.textContent = summary || SummaryMessages[this.securityState]();
    this.explanations = this.orderExplanations(explanations);
    this.refreshExplanations();
  }
  getSecuritySummaryAndExplanations(visibleSecurityState) {
    const { securityState, securityStateIssueIds } = visibleSecurityState;
    let summary;
    const explanations = [];
    summary = this.explainSafetyTipSecurity(visibleSecurityState, summary, explanations);
    if (securityStateIssueIds.includes("malicious-content")) {
      summary = i18nString(UIStrings.thisPageIsDangerousFlaggedBy);
      explanations.unshift(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, void 0, i18nString(UIStrings.flaggedByGoogleSafeBrowsing), i18nString(UIStrings.toCheckThisPagesStatusVisit)));
    } else if (securityStateIssueIds.includes("is-error-page") && (visibleSecurityState.certificateSecurityState === null || visibleSecurityState.certificateSecurityState.certificateNetworkError === null)) {
      summary = i18nString(UIStrings.thisIsAnErrorPage);
      return { summary, explanations };
    } else if (securityState === Protocol.Security.SecurityState.InsecureBroken && securityStateIssueIds.includes("scheme-is-not-cryptographic")) {
      summary = summary || i18nString(UIStrings.thisPageIsInsecureUnencrypted);
    }
    if (securityStateIssueIds.includes("scheme-is-not-cryptographic")) {
      if (securityState === Protocol.Security.SecurityState.Neutral && !securityStateIssueIds.includes("insecure-origin")) {
        summary = i18nString(UIStrings.thisPageHasANonhttpsSecureOrigin);
      }
      return { summary, explanations };
    }
    this.explainCertificateSecurity(visibleSecurityState, explanations);
    this.explainConnectionSecurity(visibleSecurityState, explanations);
    this.explainContentSecurity(visibleSecurityState, explanations);
    return { summary, explanations };
  }
  explainSafetyTipSecurity(visibleSecurityState, summary, explanations) {
    const { securityStateIssueIds, safetyTipInfo } = visibleSecurityState;
    const currentExplanations = [];
    if (securityStateIssueIds.includes("bad_reputation")) {
      const formatedDescription = `${i18nString(UIStrings.chromeHasDeterminedThatThisSiteS)}

${i18nString(UIStrings.ifYouBelieveThisIsShownIn)}`;
      currentExplanations.push({
        summary: i18nString(UIStrings.thisPageIsSuspicious),
        description: formatedDescription
      });
    } else if (securityStateIssueIds.includes("lookalike") && safetyTipInfo && safetyTipInfo.safeUrl) {
      const hostname = new URL(safetyTipInfo.safeUrl).hostname;
      const hostnamePlaceholder = { PH1: hostname };
      const formatedDescriptionSafety = `${i18nString(UIStrings.thisSitesHostnameLooksSimilarToP, hostnamePlaceholder)}

${i18nString(UIStrings.ifYouBelieveThisIsShownInErrorSafety)}`;
      currentExplanations.push({ summary: i18nString(UIStrings.possibleSpoofingUrl), description: formatedDescriptionSafety });
    }
    if (currentExplanations.length > 0) {
      summary = summary || i18nString(UIStrings.thisPageIsSuspiciousFlaggedBy);
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, void 0, currentExplanations[0].summary, currentExplanations[0].description));
    }
    return summary;
  }
  explainCertificateSecurity(visibleSecurityState, explanations) {
    const { certificateSecurityState, securityStateIssueIds } = visibleSecurityState;
    const title = i18nString(UIStrings.certificate);
    if (certificateSecurityState && certificateSecurityState.certificateHasSha1Signature) {
      const explanationSummary = i18nString(UIStrings.insecureSha);
      const description = i18nString(UIStrings.theCertificateChainForThisSite);
      if (certificateSecurityState.certificateHasWeakSignature) {
        explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, title, explanationSummary, description, certificateSecurityState.certificate, Protocol.Security.MixedContentType.None));
      } else {
        explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Neutral, title, explanationSummary, description, certificateSecurityState.certificate, Protocol.Security.MixedContentType.None));
      }
    }
    if (certificateSecurityState && securityStateIssueIds.includes("cert-missing-subject-alt-name")) {
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, title, i18nString(UIStrings.subjectAlternativeNameMissing), i18nString(UIStrings.theCertificateForThisSiteDoesNot), certificateSecurityState.certificate, Protocol.Security.MixedContentType.None));
    }
    if (certificateSecurityState && certificateSecurityState.certificateNetworkError !== null) {
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, title, i18nString(UIStrings.missing), i18nString(UIStrings.thisSiteIsMissingAValidTrusted, { PH1: certificateSecurityState.certificateNetworkError }), certificateSecurityState.certificate, Protocol.Security.MixedContentType.None));
    } else if (certificateSecurityState && !certificateSecurityState.certificateHasSha1Signature) {
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Secure, title, i18nString(UIStrings.validAndTrusted), i18nString(UIStrings.theConnectionToThisSiteIsUsingA, { PH1: certificateSecurityState.issuer }), certificateSecurityState.certificate, Protocol.Security.MixedContentType.None));
    }
    if (securityStateIssueIds.includes("pkp-bypassed")) {
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Info, title, i18nString(UIStrings.publickeypinningBypassed), i18nString(UIStrings.publickeypinningWasBypassedByA)));
    }
    if (certificateSecurityState && certificateSecurityState.isCertificateExpiringSoon()) {
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Info, void 0, i18nString(UIStrings.certificateExpiresSoon), i18nString(UIStrings.theCertificateForThisSiteExpires)));
    }
  }
  explainConnectionSecurity(visibleSecurityState, explanations) {
    const certificateSecurityState = visibleSecurityState.certificateSecurityState;
    if (!certificateSecurityState) {
      return;
    }
    const title = i18nString(UIStrings.connection);
    if (certificateSecurityState.modernSSL) {
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Secure, title, i18nString(UIStrings.secureConnectionSettings), i18nString(UIStrings.theConnectionToThisSiteIs, {
        PH1: certificateSecurityState.protocol,
        PH2: certificateSecurityState.getKeyExchangeName(),
        PH3: certificateSecurityState.getCipherFullName()
      })));
      return;
    }
    const recommendations = [];
    if (certificateSecurityState.obsoleteSslProtocol) {
      recommendations.push(i18nString(UIStrings.sIsObsoleteEnableTlsOrLater, { PH1: certificateSecurityState.protocol }));
    }
    if (certificateSecurityState.obsoleteSslKeyExchange) {
      recommendations.push(i18nString(UIStrings.rsaKeyExchangeIsObsoleteEnableAn));
    }
    if (certificateSecurityState.obsoleteSslCipher) {
      recommendations.push(i18nString(UIStrings.sIsObsoleteEnableAnAesgcmbased, { PH1: certificateSecurityState.cipher }));
    }
    if (certificateSecurityState.obsoleteSslSignature) {
      recommendations.push(i18nString(UIStrings.theServerSignatureUsesShaWhichIs));
    }
    explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Info, title, i18nString(UIStrings.obsoleteConnectionSettings), i18nString(UIStrings.theConnectionToThisSiteIs, {
      PH1: certificateSecurityState.protocol,
      PH2: certificateSecurityState.getKeyExchangeName(),
      PH3: certificateSecurityState.getCipherFullName()
    }), void 0, void 0, recommendations));
  }
  explainContentSecurity(visibleSecurityState, explanations) {
    let addSecureExplanation = true;
    const title = i18nString(UIStrings.resources);
    const securityStateIssueIds = visibleSecurityState.securityStateIssueIds;
    if (securityStateIssueIds.includes("ran-mixed-content")) {
      addSecureExplanation = false;
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, title, i18nString(UIStrings.activeMixedContent), i18nString(UIStrings.youHaveRecentlyAllowedNonsecure), [], Protocol.Security.MixedContentType.Blockable));
    }
    if (securityStateIssueIds.includes("displayed-mixed-content")) {
      addSecureExplanation = false;
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Neutral, title, i18nString(UIStrings.mixedContent), i18nString(UIStrings.thisPageIncludesHttpResources), [], Protocol.Security.MixedContentType.OptionallyBlockable));
    }
    if (securityStateIssueIds.includes("contained-mixed-form")) {
      addSecureExplanation = false;
      explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Neutral, title, i18nString(UIStrings.nonsecureForm), i18nString(UIStrings.thisPageIncludesAFormWithA)));
    }
    if (visibleSecurityState.certificateSecurityState === null || visibleSecurityState.certificateSecurityState.certificateNetworkError === null) {
      if (securityStateIssueIds.includes("ran-content-with-cert-error")) {
        addSecureExplanation = false;
        explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Insecure, title, i18nString(UIStrings.activeContentWithCertificate), i18nString(UIStrings.youHaveRecentlyAllowedContent)));
      }
      if (securityStateIssueIds.includes("displayed-content-with-cert-errors")) {
        addSecureExplanation = false;
        explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Neutral, title, i18nString(UIStrings.contentWithCertificateErrors), i18nString(UIStrings.thisPageIncludesResourcesThat)));
      }
    }
    if (addSecureExplanation) {
      if (!securityStateIssueIds.includes("scheme-is-not-cryptographic")) {
        explanations.push(new SecurityStyleExplanation(Protocol.Security.SecurityState.Secure, title, i18nString(UIStrings.allServedSecurely), i18nString(UIStrings.allResourcesOnThisPageAreServed)));
      }
    }
  }
  orderExplanations(explanations) {
    if (explanations.length === 0) {
      return explanations;
    }
    const securityStateOrder = [
      Protocol.Security.SecurityState.Insecure,
      Protocol.Security.SecurityState.Neutral,
      Protocol.Security.SecurityState.Secure,
      Protocol.Security.SecurityState.Info
    ];
    const orderedExplanations = [];
    for (const securityState of securityStateOrder) {
      orderedExplanations.push(...explanations.filter((explanation) => explanation.securityState === securityState));
    }
    return orderedExplanations;
  }
  refreshExplanations() {
    this.securityExplanationsMain.removeChildren();
    this.securityExplanationsExtra.removeChildren();
    if (!this.explanations) {
      return;
    }
    for (const explanation of this.explanations) {
      if (explanation.securityState === Protocol.Security.SecurityState.Info) {
        this.addExplanation(this.securityExplanationsExtra, explanation);
      } else {
        switch (explanation.mixedContentType) {
          case Protocol.Security.MixedContentType.Blockable:
            this.addMixedContentExplanation(this.securityExplanationsMain, explanation, NetworkForward.UIFilter.MixedContentFilterValues.BlockOverridden);
            break;
          case Protocol.Security.MixedContentType.OptionallyBlockable:
            this.addMixedContentExplanation(this.securityExplanationsMain, explanation, NetworkForward.UIFilter.MixedContentFilterValues.Displayed);
            break;
          default:
            this.addExplanation(this.securityExplanationsMain, explanation);
            break;
        }
      }
    }
    if (this.panel.filterRequestCount(NetworkForward.UIFilter.MixedContentFilterValues.Blocked) > 0) {
      const explanation = {
        securityState: Protocol.Security.SecurityState.Info,
        summary: i18nString(UIStrings.blockedMixedContent),
        description: i18nString(UIStrings.yourPageRequestedNonsecure),
        mixedContentType: Protocol.Security.MixedContentType.Blockable,
        certificate: [],
        title: ""
      };
      this.addMixedContentExplanation(this.securityExplanationsMain, explanation, NetworkForward.UIFilter.MixedContentFilterValues.Blocked);
    }
  }
  addMixedContentExplanation(parent, explanation, filterKey) {
    const element = this.addExplanation(parent, explanation);
    const filterRequestCount = this.panel.filterRequestCount(filterKey);
    if (!filterRequestCount) {
      const refreshPrompt = element.createChild("div", "security-mixed-content");
      refreshPrompt.textContent = i18nString(UIStrings.reloadThePageToRecordRequestsFor);
      return;
    }
    const requestsAnchor = element.createChild("div", "security-mixed-content devtools-link");
    UI.ARIAUtils.markAsLink(requestsAnchor);
    requestsAnchor.tabIndex = 0;
    requestsAnchor.textContent = i18nString(UIStrings.viewDRequestsInNetworkPanel, { n: filterRequestCount });
    requestsAnchor.addEventListener("click", this.showNetworkFilter.bind(this, filterKey));
    requestsAnchor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.showNetworkFilter(filterKey, event);
      }
    });
  }
  showNetworkFilter(filterKey, e) {
    e.consume();
    void Common.Revealer.reveal(NetworkForward.UIFilter.UIRequestFilter.filters([{ filterType: NetworkForward.UIFilter.FilterType.MixedContent, filterValue: filterKey }]));
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([lockIconStyles, mainViewStyles]);
  }
}
export class SecurityOriginView extends UI.Widget.VBox {
  panel;
  originLockIcon;
  constructor(panel, origin, originState) {
    super();
    this.panel = panel;
    this.setMinimumSize(200, 100);
    this.element.classList.add("security-origin-view");
    const titleSection = this.element.createChild("div", "title-section");
    const titleDiv = titleSection.createChild("div", "title-section-header");
    titleDiv.textContent = i18nString(UIStrings.origin);
    UI.ARIAUtils.markAsHeading(titleDiv, 1);
    const originDisplay = titleSection.createChild("div", "origin-display");
    this.originLockIcon = originDisplay.createChild("span", "security-property");
    this.originLockIcon.classList.add("security-property-" + originState.securityState);
    originDisplay.appendChild(SecurityPanel.createHighlightedUrl(origin, originState.securityState));
    const originNetworkDiv = titleSection.createChild("div", "view-network-button");
    const originNetworkButton = UI.UIUtils.createTextButton(i18nString(UIStrings.viewRequestsInNetworkPanel), (event) => {
      event.consume();
      const parsedURL = new Common.ParsedURL.ParsedURL(origin);
      void Common.Revealer.reveal(NetworkForward.UIFilter.UIRequestFilter.filters([
        { filterType: NetworkForward.UIFilter.FilterType.Domain, filterValue: parsedURL.host },
        { filterType: NetworkForward.UIFilter.FilterType.Scheme, filterValue: parsedURL.scheme }
      ]));
    });
    originNetworkDiv.appendChild(originNetworkButton);
    UI.ARIAUtils.markAsLink(originNetworkButton);
    if (originState.securityDetails) {
      const connectionSection = this.element.createChild("div", "origin-view-section");
      const connectionDiv = connectionSection.createChild("div", "origin-view-section-title");
      connectionDiv.textContent = i18nString(UIStrings.connection);
      UI.ARIAUtils.markAsHeading(connectionDiv, 2);
      let table = new SecurityDetailsTable();
      connectionSection.appendChild(table.element());
      table.addRow(i18nString(UIStrings.protocol), originState.securityDetails.protocol);
      if (originState.securityDetails.keyExchange) {
        table.addRow(i18nString(UIStrings.keyExchange), originState.securityDetails.keyExchange);
      }
      if (originState.securityDetails.keyExchangeGroup) {
        table.addRow(i18nString(UIStrings.keyExchangeGroup), originState.securityDetails.keyExchangeGroup);
      }
      table.addRow(i18nString(UIStrings.cipher), originState.securityDetails.cipher + (originState.securityDetails.mac ? " with " + originState.securityDetails.mac : ""));
      const certificateSection = this.element.createChild("div", "origin-view-section");
      const certificateDiv = certificateSection.createChild("div", "origin-view-section-title");
      certificateDiv.textContent = i18nString(UIStrings.certificate);
      UI.ARIAUtils.markAsHeading(certificateDiv, 2);
      const sctListLength = originState.securityDetails.signedCertificateTimestampList.length;
      const ctCompliance = originState.securityDetails.certificateTransparencyCompliance;
      let sctSection;
      if (sctListLength || ctCompliance !== Protocol.Network.CertificateTransparencyCompliance.Unknown) {
        sctSection = this.element.createChild("div", "origin-view-section");
        const sctDiv = sctSection.createChild("div", "origin-view-section-title");
        sctDiv.textContent = i18nString(UIStrings.certificateTransparency);
        UI.ARIAUtils.markAsHeading(sctDiv, 2);
      }
      const sanDiv = this.createSanDiv(originState.securityDetails.sanList);
      const validFromString = new Date(1e3 * originState.securityDetails.validFrom).toUTCString();
      const validUntilString = new Date(1e3 * originState.securityDetails.validTo).toUTCString();
      table = new SecurityDetailsTable();
      certificateSection.appendChild(table.element());
      table.addRow(i18nString(UIStrings.subject), originState.securityDetails.subjectName);
      table.addRow(i18n.i18n.lockedString("SAN"), sanDiv);
      table.addRow(i18nString(UIStrings.validFrom), validFromString);
      table.addRow(i18nString(UIStrings.validUntil), validUntilString);
      table.addRow(i18nString(UIStrings.issuer), originState.securityDetails.issuer);
      table.addRow("", SecurityPanel.createCertificateViewerButtonForOrigin(i18nString(UIStrings.openFullCertificateDetails), origin));
      if (!sctSection) {
        return;
      }
      const sctSummaryTable = new SecurityDetailsTable();
      sctSummaryTable.element().classList.add("sct-summary");
      sctSection.appendChild(sctSummaryTable.element());
      for (let i = 0; i < sctListLength; i++) {
        const sct = originState.securityDetails.signedCertificateTimestampList[i];
        sctSummaryTable.addRow(i18nString(UIStrings.sct), sct.logDescription + " (" + sct.origin + ", " + sct.status + ")");
      }
      const sctTableWrapper = sctSection.createChild("div", "sct-details");
      sctTableWrapper.classList.add("hidden");
      for (let i = 0; i < sctListLength; i++) {
        const sctTable = new SecurityDetailsTable();
        sctTableWrapper.appendChild(sctTable.element());
        const sct = originState.securityDetails.signedCertificateTimestampList[i];
        sctTable.addRow(i18nString(UIStrings.logName), sct.logDescription);
        sctTable.addRow(i18nString(UIStrings.logId), sct.logId.replace(/(.{2})/g, "$1 "));
        sctTable.addRow(i18nString(UIStrings.validationStatus), sct.status);
        sctTable.addRow(i18nString(UIStrings.source), sct.origin);
        sctTable.addRow(i18nString(UIStrings.issuedAt), new Date(sct.timestamp).toUTCString());
        sctTable.addRow(i18nString(UIStrings.hashAlgorithm), sct.hashAlgorithm);
        sctTable.addRow(i18nString(UIStrings.signatureAlgorithm), sct.signatureAlgorithm);
        sctTable.addRow(i18nString(UIStrings.signatureData), sct.signatureData.replace(/(.{2})/g, "$1 "));
      }
      if (sctListLength) {
        let toggleSctDetailsDisplay = function() {
          let buttonText;
          const isDetailsShown = !sctTableWrapper.classList.contains("hidden");
          if (isDetailsShown) {
            buttonText = i18nString(UIStrings.showFullDetails);
          } else {
            buttonText = i18nString(UIStrings.hideFullDetails);
          }
          toggleSctsDetailsLink.textContent = buttonText;
          UI.ARIAUtils.setAccessibleName(toggleSctsDetailsLink, buttonText);
          UI.ARIAUtils.setExpanded(toggleSctsDetailsLink, !isDetailsShown);
          sctSummaryTable.element().classList.toggle("hidden");
          sctTableWrapper.classList.toggle("hidden");
        };
        const toggleSctsDetailsLink = UI.UIUtils.createTextButton(i18nString(UIStrings.showFullDetails), toggleSctDetailsDisplay, "details-toggle");
        sctSection.appendChild(toggleSctsDetailsLink);
      }
      switch (ctCompliance) {
        case Protocol.Network.CertificateTransparencyCompliance.Compliant:
          sctSection.createChild("div", "origin-view-section-notes").textContent = i18nString(UIStrings.thisRequestCompliesWithChromes);
          break;
        case Protocol.Network.CertificateTransparencyCompliance.NotCompliant:
          sctSection.createChild("div", "origin-view-section-notes").textContent = i18nString(UIStrings.thisRequestDoesNotComplyWith);
          break;
        case Protocol.Network.CertificateTransparencyCompliance.Unknown:
          break;
      }
      const noteSection = this.element.createChild("div", "origin-view-section origin-view-notes");
      if (originState.loadedFromCache) {
        noteSection.createChild("div").textContent = i18nString(UIStrings.thisResponseWasLoadedFromCache);
      }
      noteSection.createChild("div").textContent = i18nString(UIStrings.theSecurityDetailsAboveAreFrom);
    } else if (originState.securityState === Protocol.Security.SecurityState.Secure) {
      const secureSection = this.element.createChild("div", "origin-view-section");
      const secureDiv = secureSection.createChild("div", "origin-view-section-title");
      secureDiv.textContent = i18nString(UIStrings.secure);
      UI.ARIAUtils.markAsHeading(secureDiv, 2);
      secureSection.createChild("div").textContent = i18nString(UIStrings.thisOriginIsANonhttpsSecure);
    } else if (originState.securityState !== Protocol.Security.SecurityState.Unknown) {
      const notSecureSection = this.element.createChild("div", "origin-view-section");
      const notSecureDiv = notSecureSection.createChild("div", "origin-view-section-title");
      notSecureDiv.textContent = i18nString(UIStrings.notSecure);
      UI.ARIAUtils.markAsHeading(notSecureDiv, 2);
      notSecureSection.createChild("div").textContent = i18nString(UIStrings.yourConnectionToThisOriginIsNot);
    } else {
      const noInfoSection = this.element.createChild("div", "origin-view-section");
      const noInfoDiv = noInfoSection.createChild("div", "origin-view-section-title");
      noInfoDiv.textContent = i18nString(UIStrings.noSecurityInformation);
      UI.ARIAUtils.markAsHeading(noInfoDiv, 2);
      noInfoSection.createChild("div").textContent = i18nString(UIStrings.noSecurityDetailsAreAvailableFor);
    }
  }
  createSanDiv(sanList) {
    const sanDiv = document.createElement("div");
    if (sanList.length === 0) {
      sanDiv.textContent = i18nString(UIStrings.na);
      sanDiv.classList.add("empty-san");
    } else {
      const truncatedNumToShow = 2;
      const listIsTruncated = sanList.length > truncatedNumToShow + 1;
      for (let i = 0; i < sanList.length; i++) {
        const span = sanDiv.createChild("span", "san-entry");
        span.textContent = sanList[i];
        if (listIsTruncated && i >= truncatedNumToShow) {
          span.classList.add("truncated-entry");
        }
      }
      if (listIsTruncated) {
        let toggleSANTruncation = function() {
          const isTruncated = sanDiv.classList.contains("truncated-san");
          let buttonText;
          if (isTruncated) {
            sanDiv.classList.remove("truncated-san");
            buttonText = i18nString(UIStrings.showLess);
          } else {
            sanDiv.classList.add("truncated-san");
            buttonText = i18nString(UIStrings.showMoreSTotal, { PH1: sanList.length });
          }
          truncatedSANToggle.textContent = buttonText;
          UI.ARIAUtils.setAccessibleName(truncatedSANToggle, buttonText);
          UI.ARIAUtils.setExpanded(truncatedSANToggle, isTruncated);
        };
        const truncatedSANToggle = UI.UIUtils.createTextButton(i18nString(UIStrings.showMoreSTotal, { PH1: sanList.length }), toggleSANTruncation);
        sanDiv.appendChild(truncatedSANToggle);
        toggleSANTruncation();
      }
    }
    return sanDiv;
  }
  setSecurityState(newSecurityState) {
    for (const className of Array.prototype.slice.call(this.originLockIcon.classList)) {
      if (className.startsWith("security-property-")) {
        this.originLockIcon.classList.remove(className);
      }
    }
    this.originLockIcon.classList.add("security-property-" + newSecurityState);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([originViewStyles, lockIconStyles]);
  }
}
export class SecurityDetailsTable {
  elementInternal;
  constructor() {
    this.elementInternal = document.createElement("table");
    this.elementInternal.classList.add("details-table");
  }
  element() {
    return this.elementInternal;
  }
  addRow(key, value) {
    const row = this.elementInternal.createChild("div", "details-table-row");
    row.createChild("div").textContent = key;
    const valueDiv = row.createChild("div");
    if (typeof value === "string") {
      valueDiv.textContent = value;
    } else {
      valueDiv.appendChild(value);
    }
  }
}
//# sourceMappingURL=SecurityPanel.js.map
