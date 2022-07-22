import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as NetworkComponents from "./components/components.js";
import { EventSourceMessagesView } from "./EventSourceMessagesView.js";
import { RequestCookiesView } from "./RequestCookiesView.js";
import { RequestHeadersView } from "./RequestHeadersView.js";
import { RequestPayloadView } from "./RequestPayloadView.js";
import { RequestInitiatorView } from "./RequestInitiatorView.js";
import { RequestPreviewView } from "./RequestPreviewView.js";
import { RequestResponseView } from "./RequestResponseView.js";
import { RequestTimingView } from "./RequestTimingView.js";
import { ResourceWebSocketFrameView } from "./ResourceWebSocketFrameView.js";
const UIStrings = {
  headers: "Headers",
  payload: "Payload",
  messages: "Messages",
  websocketMessages: "WebSocket messages",
  eventstream: "EventStream",
  preview: "Preview",
  responsePreview: "Response preview",
  signedexchangeError: "SignedExchange error",
  response: "Response",
  rawResponseData: "Raw response data",
  initiator: "Initiator",
  requestInitiatorCallStack: "Request initiator call stack",
  timing: "Timing",
  requestAndResponseTimeline: "Request and response timeline",
  trustTokens: "Trust Tokens",
  trustTokenOperationDetails: "Trust Token operation details",
  cookies: "Cookies",
  requestAndResponseCookies: "Request and response cookies"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/NetworkItemView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class NetworkItemView extends UI.TabbedPane.TabbedPane {
  requestInternal;
  resourceViewTabSetting;
  headersView;
  headersViewComponent;
  payloadView;
  responseView;
  cookiesView;
  initialTab;
  constructor(request, calculator, initialTab) {
    super();
    this.requestInternal = request;
    this.element.classList.add("network-item-view");
    this.resourceViewTabSetting = Common.Settings.Settings.instance().createSetting("resourceViewTab", NetworkForward.UIRequestLocation.UIRequestTabs.Headers);
    this.headersView = new RequestHeadersView(request);
    this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Headers, i18nString(UIStrings.headers), this.headersView, i18nString(UIStrings.headers));
    this.headersViewComponent = new NetworkComponents.RequestHeadersView.RequestHeadersView(request);
    if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.HEADER_OVERRIDES)) {
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.HeadersComponent, i18nString(UIStrings.headers), this.headersViewComponent, i18nString(UIStrings.headers));
    }
    this.payloadView = null;
    void this.maybeAppendPayloadPanel();
    this.addEventListener(UI.TabbedPane.Events.TabSelected, this.tabSelected, this);
    if (request.resourceType() === Common.ResourceType.resourceTypes.WebSocket) {
      const frameView = new ResourceWebSocketFrameView(request);
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.WsFrames, i18nString(UIStrings.messages), frameView, i18nString(UIStrings.websocketMessages));
    } else if (request.mimeType === SDK.NetworkRequest.MIME_TYPE.EVENTSTREAM) {
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.EventSource, i18nString(UIStrings.eventstream), new EventSourceMessagesView(request));
    } else {
      this.responseView = new RequestResponseView(request);
      const previewView = new RequestPreviewView(request);
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Preview, i18nString(UIStrings.preview), previewView, i18nString(UIStrings.responsePreview));
      const signedExchangeInfo = request.signedExchangeInfo();
      if (signedExchangeInfo && signedExchangeInfo.errors && signedExchangeInfo.errors.length) {
        const icon = UI.Icon.Icon.create("smallicon-error");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.signedexchangeError));
        this.setTabIcon(NetworkForward.UIRequestLocation.UIRequestTabs.Preview, icon);
      }
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Response, i18nString(UIStrings.response), this.responseView, i18nString(UIStrings.rawResponseData));
    }
    this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Initiator, i18nString(UIStrings.initiator), new RequestInitiatorView(request), i18nString(UIStrings.requestInitiatorCallStack));
    this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Timing, i18nString(UIStrings.timing), new RequestTimingView(request, calculator), i18nString(UIStrings.requestAndResponseTimeline));
    if (request.trustTokenParams()) {
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.TrustTokens, i18nString(UIStrings.trustTokens), new NetworkComponents.RequestTrustTokensView.RequestTrustTokensView(request), i18nString(UIStrings.trustTokenOperationDetails));
    }
    this.cookiesView = null;
    this.initialTab = initialTab || this.resourceViewTabSetting.get();
    this.setAutoSelectFirstItemOnShow(false);
  }
  wasShown() {
    super.wasShown();
    this.requestInternal.addEventListener(SDK.NetworkRequest.Events.RequestHeadersChanged, this.requestHeadersChanged, this);
    this.requestInternal.addEventListener(SDK.NetworkRequest.Events.ResponseHeadersChanged, this.maybeAppendCookiesPanel, this);
    this.requestInternal.addEventListener(SDK.NetworkRequest.Events.TrustTokenResultAdded, this.maybeShowErrorIconInTrustTokenTabHeader, this);
    this.maybeAppendCookiesPanel();
    this.maybeShowErrorIconInTrustTokenTabHeader();
    if (this.initialTab) {
      this.selectTabInternal(this.initialTab);
      this.initialTab = void 0;
    }
  }
  willHide() {
    this.requestInternal.removeEventListener(SDK.NetworkRequest.Events.RequestHeadersChanged, this.requestHeadersChanged, this);
    this.requestInternal.removeEventListener(SDK.NetworkRequest.Events.ResponseHeadersChanged, this.maybeAppendCookiesPanel, this);
    this.requestInternal.removeEventListener(SDK.NetworkRequest.Events.TrustTokenResultAdded, this.maybeShowErrorIconInTrustTokenTabHeader, this);
  }
  async requestHeadersChanged() {
    this.maybeAppendCookiesPanel();
    void this.maybeAppendPayloadPanel();
  }
  maybeAppendCookiesPanel() {
    const cookiesPresent = this.requestInternal.hasRequestCookies() || this.requestInternal.responseCookies.length > 0;
    console.assert(cookiesPresent || !this.cookiesView, "Cookies were introduced in headers and then removed!");
    if (cookiesPresent && !this.cookiesView) {
      this.cookiesView = new RequestCookiesView(this.requestInternal);
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Cookies, i18nString(UIStrings.cookies), this.cookiesView, i18nString(UIStrings.requestAndResponseCookies));
    }
  }
  async maybeAppendPayloadPanel() {
    if (this.hasTab("payload")) {
      return;
    }
    if (this.requestInternal.queryParameters || await this.requestInternal.requestFormData()) {
      this.payloadView = new RequestPayloadView(this.requestInternal);
      this.appendTab(NetworkForward.UIRequestLocation.UIRequestTabs.Payload, i18nString(UIStrings.payload), this.payloadView, i18nString(UIStrings.payload), void 0, void 0, void 0, 1);
    }
  }
  maybeShowErrorIconInTrustTokenTabHeader() {
    const trustTokenResult = this.requestInternal.trustTokenOperationDoneEvent();
    if (trustTokenResult && !NetworkComponents.RequestTrustTokensView.statusConsideredSuccess(trustTokenResult.status)) {
      this.setTabIcon(NetworkForward.UIRequestLocation.UIRequestTabs.TrustTokens, UI.Icon.Icon.create("smallicon-error"));
    }
  }
  selectTabInternal(tabId) {
    if (!this.selectTab(tabId)) {
      window.setTimeout(() => {
        if (!this.selectTab(tabId)) {
          this.selectTab("headers");
        }
      }, 0);
    }
  }
  tabSelected(event) {
    if (!event.data.isUserGesture) {
      return;
    }
    this.resourceViewTabSetting.set(event.data.tabId);
  }
  request() {
    return this.requestInternal;
  }
  async revealResponseBody(line) {
    this.selectTabInternal(NetworkForward.UIRequestLocation.UIRequestTabs.Response);
    if (this.responseView && typeof line === "number") {
      await this.responseView.revealLine(line);
    }
  }
  revealHeader(section, header) {
    this.selectTabInternal(NetworkForward.UIRequestLocation.UIRequestTabs.Headers);
    this.headersView.revealHeader(section, header);
  }
}
//# sourceMappingURL=NetworkItemView.js.map
