import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Persistence from "../../models/persistence/persistence.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import * as ClientVariations from "../../third_party/chromium/client-variations/client-variations.js";
import objectPropertiesSectionStyles from "../../ui/legacy/components/object_ui/objectPropertiesSection.css.js";
import objectValueStyles from "../../ui/legacy/components/object_ui/objectValue.css.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Sources from "../sources/sources.js";
import requestHeadersTreeStyles from "./requestHeadersTree.css.js";
import requestHeadersViewStyles from "./requestHeadersView.css.js";
const UIStrings = {
  general: "General",
  copyValue: "Copy value",
  learnMoreInTheIssuesTab: "Learn more in the issues tab",
  learnMore: "Learn more",
  requestUrl: "Request URL",
  showMore: "Show more",
  viewParsed: "View parsed",
  viewSource: "View source",
  requestHeaders: "Request Headers",
  responseHeaders: "Response Headers",
  statusCode: "Status Code",
  requestMethod: "Request Method",
  fromMemoryCache: "(from memory cache)",
  fromServiceWorker: "(from `service worker`)",
  fromSignedexchange: "(from signed-exchange)",
  fromPrefetchCache: "(from prefetch cache)",
  fromDiskCache: "(from disk cache)",
  fromWebBundle: "(from Web Bundle)",
  provisionalHeadersAreShownS: "Provisional headers are shown. Disable cache to see full headers.",
  onlyProvisionalHeadersAre: "Only provisional headers are available because this request was not sent over the network and instead was served from a local cache, which doesn\u2019t store the original request headers. Disable cache to see full request headers.",
  provisionalHeadersAreShown: "Provisional headers are shown",
  activeClientExperimentVariation: "Active `client experiment variation IDs`.",
  activeClientExperimentVariationIds: "Active `client experiment variation IDs` that trigger server-side behavior.",
  decoded: "Decoded:",
  remoteAddress: "Remote Address",
  referrerPolicy: "Referrer Policy",
  toEmbedThisFrameInYourDocument: "To embed this frame in your document, the response needs to enable the cross-origin embedder policy by specifying the following response header:",
  toUseThisResourceFromADifferent: "To use this resource from a different origin, the server needs to specify a cross-origin resource policy in the response headers:",
  chooseThisOptionIfTheResourceAnd: "Choose this option if the resource and the document are served from the same site.",
  onlyChooseThisOptionIfAn: "Only choose this option if an arbitrary website including this resource does not impose a security risk.",
  thisDocumentWasBlockedFrom: "This document was blocked from loading in an `iframe` with a `sandbox` attribute because this document specified a cross-origin opener policy.",
  toUseThisResourceFromADifferentSite: "To use this resource from a different site, the server may relax the cross-origin resource policy response header:",
  toUseThisResourceFromADifferentOrigin: "To use this resource from a different origin, the server may relax the cross-origin resource policy response header:",
  recordedAttribution: "Recorded attribution with `trigger-data`: {PH1}",
  headerOverrides: "Header overrides"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/RequestHeadersView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class RequestHeadersView extends UI.Widget.VBox {
  request;
  showRequestHeadersText;
  showResponseHeadersText;
  highlightedElement;
  root;
  urlItem;
  requestMethodItem;
  statusCodeItem;
  remoteAddressItem;
  referrerPolicyItem;
  responseHeadersCategory;
  requestHeadersCategory;
  #workspace = Workspace.Workspace.WorkspaceImpl.instance();
  constructor(request) {
    super();
    this.element.classList.add("request-headers-view");
    this.request = request;
    this.showRequestHeadersText = false;
    this.showResponseHeadersText = false;
    this.highlightedElement = null;
    const root = new UI.TreeOutline.TreeOutlineInShadow();
    root.registerCSSFiles([objectValueStyles, objectPropertiesSectionStyles, requestHeadersTreeStyles]);
    root.element.classList.add("request-headers-tree");
    root.makeDense();
    root.setUseLightSelectionColor(true);
    this.element.appendChild(root.element);
    const generalCategory = new Category(root, "general", i18nString(UIStrings.general));
    generalCategory.hidden = false;
    this.root = generalCategory;
    this.setDefaultFocusedElement(this.root.listItemElement);
    this.urlItem = generalCategory.createLeaf();
    this.requestMethodItem = generalCategory.createLeaf();
    headerNames.set(this.requestMethodItem, "Request-Method");
    this.statusCodeItem = generalCategory.createLeaf();
    headerNames.set(this.statusCodeItem, "Status-Code");
    this.remoteAddressItem = generalCategory.createLeaf();
    this.remoteAddressItem.hidden = true;
    this.referrerPolicyItem = generalCategory.createLeaf();
    this.referrerPolicyItem.hidden = true;
    this.responseHeadersCategory = new Category(root, "responseHeaders", "");
    this.requestHeadersCategory = new Category(root, "requestHeaders", "");
  }
  wasShown() {
    this.clearHighlight();
    this.registerCSSFiles([requestHeadersViewStyles]);
    this.request.addEventListener(SDK.NetworkRequest.Events.RemoteAddressChanged, this.refreshRemoteAddress, this);
    this.request.addEventListener(SDK.NetworkRequest.Events.RequestHeadersChanged, this.refreshRequestHeaders, this);
    this.request.addEventListener(SDK.NetworkRequest.Events.ResponseHeadersChanged, this.refreshResponseHeaders, this);
    this.request.addEventListener(SDK.NetworkRequest.Events.FinishedLoading, this.refreshHTTPInformation, this);
    this.#workspace.addEventListener(Workspace.Workspace.Events.UISourceCodeAdded, this.#uiSourceCodeAddedOrRemoved, this);
    this.#workspace.addEventListener(Workspace.Workspace.Events.UISourceCodeRemoved, this.#uiSourceCodeAddedOrRemoved, this);
    this.refreshURL();
    this.refreshRequestHeaders();
    this.refreshResponseHeaders();
    this.refreshHTTPInformation();
    this.refreshRemoteAddress();
    this.refreshReferrerPolicy();
    this.root.select(true, false);
  }
  willHide() {
    this.request.removeEventListener(SDK.NetworkRequest.Events.RemoteAddressChanged, this.refreshRemoteAddress, this);
    this.request.removeEventListener(SDK.NetworkRequest.Events.RequestHeadersChanged, this.refreshRequestHeaders, this);
    this.request.removeEventListener(SDK.NetworkRequest.Events.ResponseHeadersChanged, this.refreshResponseHeaders, this);
    this.request.removeEventListener(SDK.NetworkRequest.Events.FinishedLoading, this.refreshHTTPInformation, this);
    this.#workspace.removeEventListener(Workspace.Workspace.Events.UISourceCodeAdded, this.#uiSourceCodeAddedOrRemoved, this);
    this.#workspace.removeEventListener(Workspace.Workspace.Events.UISourceCodeRemoved, this.#uiSourceCodeAddedOrRemoved, this);
  }
  addEntryContextMenuHandler(treeElement, value) {
    treeElement.listItemElement.addEventListener("contextmenu", (event) => {
      event.consume(true);
      const contextMenu = new UI.ContextMenu.ContextMenu(event);
      const decodedValue = decodeURIComponent(value);
      const copyDecodedValueHandler = () => {
        Host.userMetrics.actionTaken(Host.UserMetrics.Action.NetworkPanelCopyValue);
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(decodedValue);
      };
      contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyValue), copyDecodedValueHandler);
      void contextMenu.show();
    });
  }
  formatHeader(name, value) {
    const fragment = document.createDocumentFragment();
    fragment.createChild("div", "header-name").textContent = name + ": ";
    fragment.createChild("span", "header-separator");
    fragment.createChild("div", "header-value source-code").textContent = value;
    return fragment;
  }
  formatHeaderObject(header) {
    const fragment = document.createDocumentFragment();
    if (header.headerNotSet) {
      fragment.createChild("div", "header-badge header-badge-error header-badge-text").textContent = "not-set";
    }
    if (header.name.toLowerCase() === "location" && this.request.canceled) {
      const url = new URL(header.value?.toString() || "", this.request.parsedURL.securityOrigin());
      const triggerData = getTriggerDataFromAttributionRedirect(url);
      if (triggerData) {
        fragment.createChild("div", "header-badge header-badge-success header-badge-text").textContent = "Attribution Reporting API";
        header.details = {
          explanation: () => i18nString(UIStrings.recordedAttribution, { PH1: triggerData }),
          examples: [],
          link: null
        };
      }
    }
    const colon = header.value ? ": " : "";
    fragment.createChild("div", "header-name").textContent = header.name + colon;
    fragment.createChild("span", "header-separator");
    if (header.value) {
      if (header.headerValueIncorrect) {
        fragment.createChild("div", "header-value source-code header-warning").textContent = header.value.toString();
      } else {
        fragment.createChild("div", "header-value source-code").textContent = header.value.toString();
      }
    }
    if (header.details) {
      const detailsNode = fragment.createChild("div", "header-details");
      const callToAction = detailsNode.createChild("div", "call-to-action");
      const callToActionBody = callToAction.createChild("div", "call-to-action-body");
      callToActionBody.createChild("div", "explanation").textContent = header.details.explanation();
      for (const example of header.details.examples) {
        const exampleNode = callToActionBody.createChild("div", "example");
        exampleNode.createChild("code").textContent = example.codeSnippet;
        if (example.comment) {
          exampleNode.createChild("span", "comment").textContent = example.comment();
        }
      }
      if (IssuesManager.RelatedIssue.hasIssueOfCategory(this.request, IssuesManager.Issue.IssueCategory.CrossOriginEmbedderPolicy)) {
        const link = document.createElement("div");
        link.classList.add("devtools-link");
        link.onclick = () => {
          Host.userMetrics.issuesPanelOpenedFrom(Host.UserMetrics.IssueOpener.LearnMoreLinkCOEP);
          void IssuesManager.RelatedIssue.reveal(this.request, IssuesManager.Issue.IssueCategory.CrossOriginEmbedderPolicy);
        };
        const text = document.createElement("span");
        text.classList.add("devtools-link");
        text.textContent = i18nString(UIStrings.learnMoreInTheIssuesTab);
        link.appendChild(text);
        link.prepend(UI.Icon.Icon.create("largeicon-breaking-change", "icon"));
        callToActionBody.appendChild(link);
      } else if (header.details.link) {
        const link = UI.XLink.XLink.create(header.details.link.url, i18nString(UIStrings.learnMore), "link");
        link.prepend(UI.Icon.Icon.create("largeicon-link"));
        callToActionBody.appendChild(link);
      }
    }
    return fragment;
  }
  refreshURL() {
    const requestURL = this.request.url();
    this.urlItem.title = this.formatHeader(i18nString(UIStrings.requestUrl), requestURL);
    this.addEntryContextMenuHandler(this.urlItem, requestURL);
  }
  populateTreeElementWithSourceText(treeElement, sourceText) {
    const max_len = 3e3;
    const text = (sourceText || "").trim();
    const trim = text.length > max_len;
    const sourceTextElement = document.createElement("span");
    sourceTextElement.classList.add("header-value");
    sourceTextElement.classList.add("source-code");
    sourceTextElement.textContent = trim ? text.substr(0, max_len) : text;
    const sourceTreeElement = new UI.TreeOutline.TreeElement(sourceTextElement);
    treeElement.removeChildren();
    treeElement.appendChild(sourceTreeElement);
    if (!trim) {
      return;
    }
    const showMoreButton = document.createElement("button");
    showMoreButton.classList.add("request-headers-show-more-button");
    showMoreButton.textContent = i18nString(UIStrings.showMore);
    function showMore() {
      showMoreButton.remove();
      sourceTextElement.textContent = text;
      sourceTreeElement.listItemElement.removeEventListener("contextmenu", onContextMenuShowMore);
    }
    showMoreButton.addEventListener("click", showMore);
    function onContextMenuShowMore(event) {
      const contextMenu = new UI.ContextMenu.ContextMenu(event);
      const section = contextMenu.newSection();
      section.appendItem(i18nString(UIStrings.showMore), showMore);
      void contextMenu.show();
    }
    sourceTreeElement.listItemElement.addEventListener("contextmenu", onContextMenuShowMore);
    sourceTextElement.appendChild(showMoreButton);
  }
  refreshRequestHeaders() {
    const treeElement = this.requestHeadersCategory;
    const headers = this.request.requestHeaders().slice();
    headers.sort(function(a, b) {
      return Platform.StringUtilities.compare(a.name.toLowerCase(), b.name.toLowerCase());
    });
    const headersText = this.request.requestHeadersText();
    if (this.showRequestHeadersText && headersText) {
      this.refreshHeadersText(i18nString(UIStrings.requestHeaders), headers.length, headersText, treeElement);
    } else {
      this.refreshHeaders(i18nString(UIStrings.requestHeaders), headers, treeElement, false, headersText === void 0);
    }
    if (headersText) {
      const toggleButton = this.createHeadersToggleButton(this.showRequestHeadersText);
      toggleButton.addEventListener("click", this.toggleRequestHeadersText.bind(this), false);
      treeElement.listItemElement.querySelector(".headers-title-left")?.appendChild(toggleButton);
    }
  }
  refreshResponseHeaders() {
    const treeElement = this.responseHeadersCategory;
    const headers = this.request.sortedResponseHeaders.slice();
    const headersText = this.request.responseHeadersText;
    if (this.showResponseHeadersText) {
      this.refreshHeadersText(i18nString(UIStrings.responseHeaders), headers.length, headersText, treeElement);
    } else {
      const headersWithIssues = [];
      if (this.request.wasBlocked()) {
        const headerWithIssues = BlockedReasonDetails.get(this.request.blockedReason());
        if (headerWithIssues) {
          headersWithIssues.push(headerWithIssues);
        }
      }
      const overrideable = Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.HEADER_OVERRIDES);
      this.refreshHeaders(i18nString(UIStrings.responseHeaders), mergeHeadersWithIssues(headers, headersWithIssues), treeElement, overrideable, false, this.request.blockedResponseCookies());
    }
    if (headersText) {
      const toggleButton = this.createHeadersToggleButton(this.showResponseHeadersText);
      toggleButton.addEventListener("click", this.toggleResponseHeadersText.bind(this), false);
      treeElement.listItemElement.querySelector(".headers-title-left")?.appendChild(toggleButton);
    }
    function mergeHeadersWithIssues(headers2, headersWithIssues) {
      let i = 0, j = 0;
      const result = [];
      while (i < headers2.length || j < headersWithIssues.length) {
        if (i < headers2.length && (j >= headersWithIssues.length || headers2[i].name < headersWithIssues[j].name)) {
          result.push({ ...headers2[i++], headerNotSet: false });
        } else if (j < headersWithIssues.length && (i >= headers2.length || headers2[i].name > headersWithIssues[j].name)) {
          result.push({ ...headersWithIssues[j++], headerNotSet: true });
        } else if (i < headers2.length && j < headersWithIssues.length && headers2[i].name === headersWithIssues[j].name) {
          result.push({ ...headersWithIssues[j++], ...headers2[i++], headerNotSet: false });
        }
      }
      return result;
    }
  }
  refreshHTTPInformation() {
    const requestMethodElement = this.requestMethodItem;
    requestMethodElement.hidden = !this.request.statusCode;
    const statusCodeElement = this.statusCodeItem;
    statusCodeElement.hidden = !this.request.statusCode;
    if (this.request.statusCode) {
      const statusCodeFragment = document.createDocumentFragment();
      statusCodeFragment.createChild("div", "header-name").textContent = i18nString(UIStrings.statusCode) + ": ";
      statusCodeFragment.createChild("span", "header-separator");
      const statusCodeImage = statusCodeFragment.createChild("span", "resource-status-image", "dt-icon-label");
      UI.Tooltip.Tooltip.install(statusCodeImage, this.request.statusCode + " " + this.request.statusText);
      if (this.request.statusCode < 300 || this.request.statusCode === 304) {
        statusCodeImage.type = "smallicon-green-ball";
      } else if (this.request.statusCode < 400) {
        statusCodeImage.type = "smallicon-orange-ball";
      } else {
        statusCodeImage.type = "smallicon-red-ball";
      }
      requestMethodElement.title = this.formatHeader(i18nString(UIStrings.requestMethod), this.request.requestMethod);
      const statusTextElement = statusCodeFragment.createChild("div", "header-value source-code");
      let statusText = this.request.statusCode + " " + this.request.statusText;
      if (this.request.cachedInMemory()) {
        statusText += " " + i18nString(UIStrings.fromMemoryCache);
        statusTextElement.classList.add("status-from-cache");
      } else if (this.request.fetchedViaServiceWorker) {
        statusText += " " + i18nString(UIStrings.fromServiceWorker);
        statusTextElement.classList.add("status-from-cache");
      } else if (this.request.redirectSourceSignedExchangeInfoHasNoErrors()) {
        statusText += " " + i18nString(UIStrings.fromSignedexchange);
        statusTextElement.classList.add("status-from-cache");
      } else if (this.request.webBundleInnerRequestInfo()) {
        statusText += " " + i18nString(UIStrings.fromWebBundle);
        statusTextElement.classList.add("status-from-cache");
      } else if (this.request.fromPrefetchCache()) {
        statusText += " " + i18nString(UIStrings.fromPrefetchCache);
        statusTextElement.classList.add("status-from-cache");
      } else if (this.request.cached()) {
        statusText += " " + i18nString(UIStrings.fromDiskCache);
        statusTextElement.classList.add("status-from-cache");
      }
      statusTextElement.textContent = statusText;
      statusCodeElement.title = statusCodeFragment;
    }
  }
  refreshHeadersTitle(title, headersTreeElement, headersLength, overrideable) {
    headersTreeElement.listItemElement.removeChildren();
    headersTreeElement.listItemElement.createChild("div", "selection fill");
    const container = headersTreeElement.listItemElement.createChild("div", "headers-title");
    const leftElement = container.createChild("div", "headers-title-left");
    UI.UIUtils.createTextChild(leftElement, title);
    const headerCount = `\xA0(${headersLength})`;
    leftElement.createChild("span", "header-count").textContent = headerCount;
    if (overrideable && this.#workspace.uiSourceCodeForURL(this.#getHeaderOverridesFileUrl())) {
      const overridesSetting = Common.Settings.Settings.instance().moduleSetting("persistenceNetworkOverridesEnabled");
      const icon = overridesSetting.get() ? UI.Icon.Icon.create("mediumicon-file-sync", "purple-dot") : UI.Icon.Icon.create("mediumicon-file");
      const button = container.createChild("button", "link devtools-link headers-link");
      button.appendChild(icon);
      button.addEventListener("click", this.#revealHeadersFile.bind(this));
      const span = document.createElement("span");
      span.textContent = i18nString(UIStrings.headerOverrides);
      button.appendChild(span);
    }
  }
  #getHeaderOverridesFileUrl() {
    const fileUrl = Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance().fileUrlFromNetworkUrl(this.request.url(), true);
    return fileUrl.substring(0, fileUrl.lastIndexOf("/")) + "/" + Persistence.NetworkPersistenceManager.HEADERS_FILENAME;
  }
  #revealHeadersFile(event) {
    event.stopPropagation();
    const uiSourceCode = this.#workspace.uiSourceCodeForURL(this.#getHeaderOverridesFileUrl());
    if (!uiSourceCode) {
      return;
    }
    Sources.SourcesPanel.SourcesPanel.instance().showUISourceCode(uiSourceCode);
  }
  #uiSourceCodeAddedOrRemoved(event) {
    if (this.#getHeaderOverridesFileUrl() === event.data.url()) {
      this.refreshResponseHeaders();
    }
  }
  refreshHeaders(title, headers, headersTreeElement, overrideable, provisionalHeaders, blockedResponseCookies) {
    headersTreeElement.removeChildren();
    const length = headers.length;
    this.refreshHeadersTitle(title, headersTreeElement, length, overrideable);
    if (provisionalHeaders) {
      let cautionText;
      let cautionTitle = "";
      if (this.request.cachedInMemory() || this.request.cached()) {
        cautionText = i18nString(UIStrings.provisionalHeadersAreShownS);
        cautionTitle = i18nString(UIStrings.onlyProvisionalHeadersAre);
      } else {
        cautionText = i18nString(UIStrings.provisionalHeadersAreShown);
      }
      const cautionElement = document.createElement("div");
      cautionElement.classList.add("request-headers-caution");
      UI.Tooltip.Tooltip.install(cautionElement, cautionTitle);
      cautionElement.createChild("span", "", "dt-icon-label").type = "smallicon-warning";
      cautionElement.createChild("div", "caution").textContent = cautionText;
      const cautionTreeElement = new UI.TreeOutline.TreeElement(cautionElement);
      cautionElement.createChild("div", "learn-more").appendChild(UI.XLink.XLink.create("https://developer.chrome.com/docs/devtools/network/reference/#provisional-headers", i18nString(UIStrings.learnMore)));
      headersTreeElement.appendChild(cautionTreeElement);
    }
    const blockedCookieLineToReasons = /* @__PURE__ */ new Map();
    if (blockedResponseCookies) {
      blockedResponseCookies.forEach((blockedCookie) => {
        blockedCookieLineToReasons.set(blockedCookie.cookieLine, blockedCookie.blockedReasons);
      });
    }
    headersTreeElement.hidden = !length && !provisionalHeaders;
    for (const header of headers) {
      const headerTreeElement = new UI.TreeOutline.TreeElement(this.formatHeaderObject(header));
      headerNames.set(headerTreeElement, header.name);
      const headerId = header.name.toLowerCase();
      if (headerId === "set-cookie") {
        const matchingBlockedReasons = blockedCookieLineToReasons.get(header.value);
        if (matchingBlockedReasons) {
          const icon = UI.Icon.Icon.create("smallicon-warning", "");
          headerTreeElement.listItemElement.appendChild(icon);
          let titleText = "";
          for (const blockedReason of matchingBlockedReasons) {
            if (titleText) {
              titleText += "\n";
            }
            titleText += SDK.NetworkRequest.setCookieBlockedReasonToUiString(blockedReason);
          }
          UI.Tooltip.Tooltip.install(icon, titleText);
        }
      }
      this.addEntryContextMenuHandler(headerTreeElement, header.value);
      headersTreeElement.appendChild(headerTreeElement);
      if (headerId === "x-client-data") {
        const data = ClientVariations.parseClientVariations(header.value);
        const output = ClientVariations.formatClientVariations(data, i18nString(UIStrings.activeClientExperimentVariation), i18nString(UIStrings.activeClientExperimentVariationIds));
        const wrapper = document.createElement("div");
        wrapper.classList.add("x-client-data-details");
        UI.UIUtils.createTextChild(wrapper, i18nString(UIStrings.decoded));
        const div = wrapper.createChild("div");
        div.classList.add("source-code");
        div.textContent = output;
        headerTreeElement.listItemElement.appendChild(wrapper);
      }
    }
  }
  refreshHeadersText(title, count, headersText, headersTreeElement) {
    this.populateTreeElementWithSourceText(headersTreeElement, headersText);
    this.refreshHeadersTitle(title, headersTreeElement, count, false);
  }
  refreshRemoteAddress() {
    const remoteAddress = this.request.remoteAddress();
    const treeElement = this.remoteAddressItem;
    treeElement.hidden = !remoteAddress;
    if (remoteAddress) {
      treeElement.title = this.formatHeader(i18nString(UIStrings.remoteAddress), remoteAddress);
    }
  }
  refreshReferrerPolicy() {
    const referrerPolicy = this.request.referrerPolicy();
    const treeElement = this.referrerPolicyItem;
    treeElement.hidden = !referrerPolicy;
    if (referrerPolicy) {
      treeElement.title = this.formatHeader(i18nString(UIStrings.referrerPolicy), referrerPolicy);
    }
  }
  toggleRequestHeadersText(event) {
    this.showRequestHeadersText = !this.showRequestHeadersText;
    this.refreshRequestHeaders();
    event.consume();
  }
  toggleResponseHeadersText(event) {
    this.showResponseHeadersText = !this.showResponseHeadersText;
    this.refreshResponseHeaders();
    event.consume();
  }
  createToggleButton(title) {
    const button = document.createElement("span");
    button.classList.add("header-toggle");
    button.textContent = title;
    return button;
  }
  createHeadersToggleButton(isHeadersTextShown) {
    const toggleTitle = isHeadersTextShown ? i18nString(UIStrings.viewParsed) : i18nString(UIStrings.viewSource);
    return this.createToggleButton(toggleTitle);
  }
  clearHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.listItemElement.classList.remove("header-highlight");
    }
    this.highlightedElement = null;
  }
  revealAndHighlight(category, name) {
    this.clearHighlight();
    if (!category) {
      return;
    }
    if (name) {
      for (const element of category.children()) {
        if (headerNames.get(element)?.toUpperCase() !== name.toUpperCase()) {
          continue;
        }
        this.highlightedElement = element;
        element.reveal();
        element.listItemElement.classList.add("header-highlight");
        return;
      }
    }
    if (category.childCount() > 0) {
      category.childAt(0)?.reveal();
    }
  }
  getCategoryForSection(section) {
    switch (section) {
      case NetworkForward.UIRequestLocation.UIHeaderSection.General:
        return this.root;
      case NetworkForward.UIRequestLocation.UIHeaderSection.Request:
        return this.requestHeadersCategory;
      case NetworkForward.UIRequestLocation.UIHeaderSection.Response:
        return this.responseHeadersCategory;
    }
  }
  revealHeader(section, header) {
    this.revealAndHighlight(this.getCategoryForSection(section), header);
  }
}
const headerNames = /* @__PURE__ */ new WeakMap();
export class Category extends UI.TreeOutline.TreeElement {
  toggleOnClick;
  expandedSetting;
  expanded;
  constructor(root, name, title) {
    super(title || "", true);
    this.toggleOnClick = true;
    this.hidden = true;
    this.expandedSetting = Common.Settings.Settings.instance().createSetting("request-info-" + name + "-category-expanded", true);
    this.expanded = this.expandedSetting.get();
    root.appendChild(this);
  }
  createLeaf() {
    const leaf = new UI.TreeOutline.TreeElement();
    this.appendChild(leaf);
    return leaf;
  }
  onexpand() {
    this.expandedSetting.set(true);
  }
  oncollapse() {
    this.expandedSetting.set(false);
  }
}
function getTriggerDataFromAttributionRedirect(url) {
  if (url.pathname === "/.well-known/attribution-reporting/trigger-attribution" && url.searchParams.has("trigger-data")) {
    return url.searchParams.get("trigger-data");
  }
  return null;
}
const BlockedReasonDetails = /* @__PURE__ */ new Map([
  [
    Protocol.Network.BlockedReason.CoepFrameResourceNeedsCoepHeader,
    {
      name: "cross-origin-embedder-policy",
      value: null,
      headerValueIncorrect: null,
      details: {
        explanation: i18nLazyString(UIStrings.toEmbedThisFrameInYourDocument),
        examples: [{ codeSnippet: "Cross-Origin-Embedder-Policy: require-corp", comment: void 0 }],
        link: { url: "https://web.dev/coop-coep/" }
      },
      headerNotSet: null
    }
  ],
  [
    Protocol.Network.BlockedReason.CorpNotSameOriginAfterDefaultedToSameOriginByCoep,
    {
      name: "cross-origin-resource-policy",
      value: null,
      headerValueIncorrect: null,
      details: {
        explanation: i18nLazyString(UIStrings.toUseThisResourceFromADifferent),
        examples: [
          {
            codeSnippet: "Cross-Origin-Resource-Policy: same-site",
            comment: i18nLazyString(UIStrings.chooseThisOptionIfTheResourceAnd)
          },
          {
            codeSnippet: "Cross-Origin-Resource-Policy: cross-origin",
            comment: i18nLazyString(UIStrings.onlyChooseThisOptionIfAn)
          }
        ],
        link: { url: "https://web.dev/coop-coep/" }
      },
      headerNotSet: null
    }
  ],
  [
    Protocol.Network.BlockedReason.CoopSandboxedIframeCannotNavigateToCoopPage,
    {
      name: "cross-origin-opener-policy",
      value: null,
      headerValueIncorrect: false,
      details: {
        explanation: i18nLazyString(UIStrings.thisDocumentWasBlockedFrom),
        examples: [],
        link: { url: "https://web.dev/coop-coep/" }
      },
      headerNotSet: null
    }
  ],
  [
    Protocol.Network.BlockedReason.CorpNotSameSite,
    {
      name: "cross-origin-resource-policy",
      value: null,
      headerValueIncorrect: true,
      details: {
        explanation: i18nLazyString(UIStrings.toUseThisResourceFromADifferentSite),
        examples: [
          {
            codeSnippet: "Cross-Origin-Resource-Policy: cross-origin",
            comment: i18nLazyString(UIStrings.onlyChooseThisOptionIfAn)
          }
        ],
        link: null
      },
      headerNotSet: null
    }
  ],
  [
    Protocol.Network.BlockedReason.CorpNotSameOrigin,
    {
      name: "cross-origin-resource-policy",
      value: null,
      headerValueIncorrect: true,
      details: {
        explanation: i18nLazyString(UIStrings.toUseThisResourceFromADifferentOrigin),
        examples: [
          {
            codeSnippet: "Cross-Origin-Resource-Policy: same-site",
            comment: i18nLazyString(UIStrings.chooseThisOptionIfTheResourceAnd)
          },
          {
            codeSnippet: "Cross-Origin-Resource-Policy: cross-origin",
            comment: i18nLazyString(UIStrings.onlyChooseThisOptionIfAn)
          }
        ],
        link: null
      },
      headerNotSet: null
    }
  ]
]);
//# sourceMappingURL=RequestHeadersView.js.map
