import * as Common from "../../../core/common/common.js";
import * as i18n from "../../../core/i18n/i18n.js";
import { assertNotNullOrUndefined } from "../../../core/platform/platform.js";
import * as SDK from "../../../core/sdk/sdk.js";
import * as Buttons from "../../../ui/components/buttons/buttons.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as UI from "../../../ui/legacy/legacy.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import requestHeadersViewStyles from "./RequestHeadersView.css.js";
const RAW_HEADER_CUTOFF = 3e3;
const { render, html } = LitHtml;
const UIStrings = {
  fromMemoryCache: "(from memory cache)",
  fromServiceWorker: "(from `service worker`)",
  fromSignedexchange: "(from signed-exchange)",
  fromPrefetchCache: "(from prefetch cache)",
  fromDiskCache: "(from disk cache)",
  fromWebBundle: "(from Web Bundle)",
  general: "General",
  raw: "Raw",
  requestHeaders: "Request Headers",
  requestUrl: "Request URL",
  requestMethod: "Request Method",
  responseHeaders: "Response Headers",
  showMore: "Show more",
  statusCode: "Status Code",
  remoteAddress: "Remote Address",
  referrerPolicy: "Referrer Policy"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/components/RequestHeadersView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RequestHeadersView extends UI.Widget.VBox {
  #headersView = new RequestHeadersComponent();
  #request;
  constructor(request) {
    super();
    this.#request = request;
    this.contentElement.appendChild(this.#headersView);
  }
  wasShown() {
    this.#request.addEventListener(SDK.NetworkRequest.Events.RemoteAddressChanged, this.#refreshHeadersView, this);
    this.#request.addEventListener(SDK.NetworkRequest.Events.FinishedLoading, this.#refreshHeadersView, this);
    this.#refreshHeadersView();
  }
  willHide() {
    this.#request.removeEventListener(SDK.NetworkRequest.Events.RemoteAddressChanged, this.#refreshHeadersView, this);
    this.#request.removeEventListener(SDK.NetworkRequest.Events.FinishedLoading, this.#refreshHeadersView, this);
  }
  #refreshHeadersView() {
    this.#headersView.data = {
      request: this.#request
    };
  }
}
export class RequestHeadersComponent extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-request-headers`;
  #shadow = this.attachShadow({ mode: "open" });
  #request;
  #showResponseHeadersText = false;
  #showRequestHeadersText = false;
  #showResponseHeadersTextFull = false;
  #showRequestHeadersTextFull = false;
  set data(data) {
    this.#request = data.request;
    this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [requestHeadersViewStyles];
  }
  #render() {
    assertNotNullOrUndefined(this.#request);
    render(html`
      ${this.#renderGeneralSection()}
      ${this.#renderResponseHeaders()}
      ${this.#renderRequestHeaders()}
    `, this.#shadow, { host: this });
  }
  #renderResponseHeaders() {
    assertNotNullOrUndefined(this.#request);
    const toggleShowRaw = () => {
      this.#showResponseHeadersText = !this.#showResponseHeadersText;
      this.#render();
    };
    return html`
      <${Category.litTagName}
        @togglerawevent=${toggleShowRaw}
        .data=${{
      name: "responseHeaders",
      title: i18nString(UIStrings.responseHeaders),
      headerCount: this.#request.sortedResponseHeaders.length,
      checked: this.#request.responseHeadersText ? this.#showResponseHeadersText : void 0
    }}
        aria-label=${i18nString(UIStrings.responseHeaders)}
      >
        ${this.#showResponseHeadersText ? this.#renderRawHeaders(this.#request.responseHeadersText, true) : html`
          ${this.#request.sortedResponseHeaders.map((header) => html`
            <div class="row">
              <div class="header-name">${header.name}:</div>
              <div class="header-value">${header.value}</div>
            </div>
          `)}
        `}
      </${Category.litTagName}>
    `;
  }
  #renderRequestHeaders() {
    assertNotNullOrUndefined(this.#request);
    const toggleShowRaw = () => {
      this.#showRequestHeadersText = !this.#showRequestHeadersText;
      this.#render();
    };
    const requestHeadersText = this.#request.requestHeadersText();
    return html`
      <${Category.litTagName}
        @togglerawevent=${toggleShowRaw}
        .data=${{
      name: "requestHeaders",
      title: i18nString(UIStrings.requestHeaders),
      headerCount: this.#request.requestHeaders().length,
      checked: requestHeadersText ? this.#showRequestHeadersText : void 0
    }}
        aria-label=${i18nString(UIStrings.requestHeaders)}
      >
        ${this.#showRequestHeadersText && requestHeadersText ? this.#renderRawHeaders(requestHeadersText, false) : html`
          ${this.#request.requestHeaders().map((header) => html`
            <div class="row">
              <div class="header-name">${header.name}:</div>
              <div class="header-value">${header.value}</div>
            </div>
          `)}
        `}
      </${Category.litTagName}>
    `;
  }
  #renderRawHeaders(rawHeadersText, forResponseHeaders) {
    const trimmed = rawHeadersText.trim();
    const showFull = forResponseHeaders ? this.#showResponseHeadersTextFull : this.#showRequestHeadersTextFull;
    const isShortened = !showFull && trimmed.length > RAW_HEADER_CUTOFF;
    const showMore = () => {
      if (forResponseHeaders) {
        this.#showResponseHeadersTextFull = true;
      } else {
        this.#showRequestHeadersTextFull = true;
      }
      this.#render();
    };
    const onContextMenuOpen = (event) => {
      const showFull2 = forResponseHeaders ? this.#showResponseHeadersTextFull : this.#showRequestHeadersTextFull;
      if (!showFull2) {
        const contextMenu = new UI.ContextMenu.ContextMenu(event);
        const section = contextMenu.newSection();
        section.appendItem(i18nString(UIStrings.showMore), showMore);
        void contextMenu.show();
      }
    };
    const addContextMenuListener = (el) => {
      if (isShortened) {
        el.addEventListener("contextmenu", onContextMenuOpen);
      }
    };
    return html`
      <div class="row raw-headers-row" on-render=${ComponentHelpers.Directives.nodeRenderedCallback(addContextMenuListener)}>
        <div class="raw-headers">${isShortened ? trimmed.substring(0, RAW_HEADER_CUTOFF) : trimmed}</div>
        ${isShortened ? html`
          <${Buttons.Button.Button.litTagName}
            .size=${Buttons.Button.Size.SMALL}
            .variant=${Buttons.Button.Variant.SECONDARY}
            @click=${showMore}
          >${i18nString(UIStrings.showMore)}</${Buttons.Button.Button.litTagName}>
        ` : LitHtml.nothing}
      </div>
    `;
  }
  #renderGeneralSection() {
    assertNotNullOrUndefined(this.#request);
    let coloredCircleClassName = "red-circle";
    if (this.#request.statusCode < 300 || this.#request.statusCode === 304) {
      coloredCircleClassName = "green-circle";
    } else if (this.#request.statusCode < 400) {
      coloredCircleClassName = "yellow-circle";
    }
    let statusText = this.#request.statusCode + " " + this.#request.statusText;
    let statusTextHasComment = false;
    if (this.#request.cachedInMemory()) {
      statusText += " " + i18nString(UIStrings.fromMemoryCache);
      statusTextHasComment = true;
    } else if (this.#request.fetchedViaServiceWorker) {
      statusText += " " + i18nString(UIStrings.fromServiceWorker);
      statusTextHasComment = true;
    } else if (this.#request.redirectSourceSignedExchangeInfoHasNoErrors()) {
      statusText += " " + i18nString(UIStrings.fromSignedexchange);
      statusTextHasComment = true;
    } else if (this.#request.webBundleInnerRequestInfo()) {
      statusText += " " + i18nString(UIStrings.fromWebBundle);
      statusTextHasComment = true;
    } else if (this.#request.fromPrefetchCache()) {
      statusText += " " + i18nString(UIStrings.fromPrefetchCache);
      statusTextHasComment = true;
    } else if (this.#request.cached()) {
      statusText += " " + i18nString(UIStrings.fromDiskCache);
      statusTextHasComment = true;
    }
    return html`
      <${Category.litTagName}
        .data=${{ name: "general", title: i18nString(UIStrings.general) }}
        aria-label=${i18nString(UIStrings.general)}
      >
        <div class="row">
          <div class="header-name">${i18nString(UIStrings.requestUrl)}:</div>
          <div class="header-value">${this.#request.url()}</div>
        </div>
        ${this.#request.statusCode ? html`
          <div class="row">
            <div class="header-name">${i18nString(UIStrings.requestMethod)}:</div>
            <div class="header-value">${this.#request.requestMethod}</div>
          </div>
          <div class="row">
            <div class="header-name">${i18nString(UIStrings.statusCode)}:</div>
            <div class="header-value ${coloredCircleClassName} ${statusTextHasComment ? "status-with-comment" : ""}">${statusText}</div>
          </div>
        ` : ""}
        ${this.#request.remoteAddress() ? html`
          <div class="row">
            <div class="header-name">${i18nString(UIStrings.remoteAddress)}:</div>
            <div class="header-value">${this.#request.remoteAddress()}</div>
          </div>
        ` : ""}
        ${this.#request.referrerPolicy() ? html`
          <div class="row">
            <div class="header-name">${i18nString(UIStrings.referrerPolicy)}:</div>
            <div class="header-value">${this.#request.referrerPolicy()}</div>
          </div>
        ` : ""}
      </${Category.litTagName}>
    `;
  }
}
export class ToggleRawHeadersEvent extends Event {
  static eventName = "togglerawevent";
  constructor() {
    super(ToggleRawHeadersEvent.eventName, {});
  }
}
export class Category extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-request-headers-category`;
  #shadow = this.attachShadow({ mode: "open" });
  #expandedSetting;
  #title = Common.UIString.LocalizedEmptyString;
  #headerCount = void 0;
  #checked = void 0;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [requestHeadersViewStyles];
  }
  set data(data) {
    this.#title = data.title;
    this.#expandedSetting = Common.Settings.Settings.instance().createSetting("request-info-" + data.name + "-category-expanded", true);
    this.#headerCount = data.headerCount;
    this.#checked = data.checked;
    this.#render();
  }
  #onCheckboxToggle() {
    this.dispatchEvent(new ToggleRawHeadersEvent());
  }
  #render() {
    const isOpen = this.#expandedSetting ? this.#expandedSetting.get() : true;
    render(html`
      <details ?open=${isOpen} @toggle=${this.#onToggle}>
        <summary class="header" @keydown=${this.#onSummaryKeyDown}>
          ${this.#title}${this.#headerCount ? html`<span class="header-count"> (${this.#headerCount})</span>` : LitHtml.nothing}
          ${this.#checked !== void 0 ? html`
            <span class="raw-checkbox-container">
              <label>
                <input type="checkbox" .checked=${this.#checked} @change=${this.#onCheckboxToggle} />
                ${i18nString(UIStrings.raw)}
              </label>
            </span>
          ` : LitHtml.nothing}
        </summary>
        <slot></slot>
      </details>
    `, this.#shadow, { host: this });
  }
  #onSummaryKeyDown(event) {
    if (!event.target) {
      return;
    }
    const summaryElement = event.target;
    const detailsElement = summaryElement.parentElement;
    if (!detailsElement) {
      throw new Error("<details> element is not found for a <summary> element");
    }
    switch (event.key) {
      case "ArrowLeft":
        detailsElement.open = false;
        break;
      case "ArrowRight":
        detailsElement.open = true;
        break;
    }
  }
  #onToggle(event) {
    this.#expandedSetting?.set(event.target.open);
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-request-headers", RequestHeadersComponent);
ComponentHelpers.CustomElements.defineComponent("devtools-request-headers-category", Category);
//# sourceMappingURL=RequestHeadersView.js.map
