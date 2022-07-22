import * as i18n from "../../../core/i18n/i18n.js";
import * as Common from "../../../core/common/common.js";
import * as NetworkForward from "../../../panels/network/forward/forward.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import * as Coordinator from "../../../ui/components/render_coordinator/render_coordinator.js";
import requestLinkIconStyles from "./requestLinkIcon.css.js";
const UIStrings = {
  clickToShowRequestInTheNetwork: "Click to open the network panel and show request for URL: {url}",
  requestUnavailableInTheNetwork: "Request unavailable in the network panel, try reloading the inspected page",
  shortenedURL: "Shortened URL"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/request_link_icon/RequestLinkIcon.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export const extractShortPath = (path) => {
  return (/[^/]+$/.exec(path) || /[^/]+\/$/.exec(path) || [""])[0];
};
const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();
export class RequestLinkIcon extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-request-link-icon`;
  #shadow = this.attachShadow({ mode: "open" });
  #linkToPreflight;
  #request;
  #highlightHeader;
  #requestResolver;
  #displayURL = false;
  #networkTab;
  #affectedRequest;
  #additionalOnClickAction;
  #reveal = Common.Revealer.reveal;
  #requestResolvedPromise = Promise.resolve(void 0);
  set data(data) {
    this.#linkToPreflight = data.linkToPreflight;
    this.#request = data.request;
    if (data.affectedRequest) {
      this.#affectedRequest = { ...data.affectedRequest };
    }
    this.#highlightHeader = data.highlightHeader;
    this.#networkTab = data.networkTab;
    this.#requestResolver = data.requestResolver;
    this.#displayURL = data.displayURL ?? false;
    this.#additionalOnClickAction = data.additionalOnClickAction;
    if (data.revealOverride) {
      this.#reveal = data.revealOverride;
    }
    if (!this.#request && data.affectedRequest) {
      this.#requestResolvedPromise = this.#resolveRequest(data.affectedRequest.requestId);
    }
    void this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [requestLinkIconStyles];
  }
  #resolveRequest(requestId) {
    if (!this.#requestResolver) {
      throw new Error("A `RequestResolver` must be provided if an `affectedRequest` is provided.");
    }
    return this.#requestResolver.waitFor(requestId).then((request) => {
      this.#request = request;
    }).catch(() => {
      this.#request = null;
    });
  }
  get data() {
    return {
      linkToPreflight: this.#linkToPreflight,
      request: this.#request,
      affectedRequest: this.#affectedRequest,
      highlightHeader: this.#highlightHeader,
      networkTab: this.#networkTab,
      requestResolver: this.#requestResolver,
      displayURL: this.#displayURL,
      additionalOnClickAction: this.#additionalOnClickAction,
      revealOverride: this.#reveal !== Common.Revealer.reveal ? this.#reveal : void 0
    };
  }
  #iconColor() {
    if (!this.#request) {
      return "--issue-color-yellow";
    }
    return "--color-link";
  }
  iconData() {
    return {
      iconName: "network_panel_icon",
      color: `var(${this.#iconColor()})`,
      width: "16px",
      height: "16px"
    };
  }
  handleClick(event) {
    if (event.button !== 0) {
      return;
    }
    const linkedRequest = this.#linkToPreflight ? this.#request?.preflightRequest() : this.#request;
    if (!linkedRequest) {
      return;
    }
    if (this.#highlightHeader) {
      const requestLocation = NetworkForward.UIRequestLocation.UIRequestLocation.header(linkedRequest, this.#highlightHeader.section, this.#highlightHeader.name);
      void this.#reveal(requestLocation);
    } else {
      const requestLocation = NetworkForward.UIRequestLocation.UIRequestLocation.tab(linkedRequest, this.#networkTab ?? NetworkForward.UIRequestLocation.UIRequestTabs.Headers);
      void this.#reveal(requestLocation);
    }
    this.#additionalOnClickAction?.();
  }
  #getTooltip() {
    if (this.#request) {
      return i18nString(UIStrings.clickToShowRequestInTheNetwork, { url: this.#request.url() });
    }
    return i18nString(UIStrings.requestUnavailableInTheNetwork);
  }
  #getUrlForDisplaying() {
    if (!this.#request) {
      return this.#affectedRequest?.url;
    }
    return this.#request.url();
  }
  #maybeRenderURL() {
    if (!this.#displayURL) {
      return LitHtml.nothing;
    }
    const url = this.#getUrlForDisplaying();
    if (!url) {
      return LitHtml.nothing;
    }
    const filename = extractShortPath(url);
    return LitHtml.html`<span aria-label=${i18nString(UIStrings.shortenedURL)} title=${url}>${filename}</span>`;
  }
  #render() {
    return coordinator.write(() => {
      LitHtml.render(LitHtml.html`
        ${LitHtml.Directives.until(this.#requestResolvedPromise.then(() => this.#renderComponent()), this.#renderComponent())}
      `, this.#shadow, { host: this });
    });
  }
  #renderComponent() {
    return LitHtml.html`
      <span class=${LitHtml.Directives.classMap({ "link": Boolean(this.#request) })}
            tabindex="0"
            @click=${this.handleClick}>
        <${IconButton.Icon.Icon.litTagName} .data=${this.iconData()}
          title=${this.#getTooltip()}></${IconButton.Icon.Icon.litTagName}>
        ${this.#maybeRenderURL()}
      </span>`;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-request-link-icon", RequestLinkIcon);
//# sourceMappingURL=RequestLinkIcon.js.map
