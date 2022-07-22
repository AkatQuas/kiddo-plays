import * as i18n from "../../../core/i18n/i18n.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import * as IconButton from "../icon_button/icon_button.js";
import linearMemoryNavigatorStyles from "./linearMemoryNavigator.css.js";
const UIStrings = {
  enterAddress: "Enter address",
  goBackInAddressHistory: "Go back in address history",
  goForwardInAddressHistory: "Go forward in address history",
  previousPage: "Previous page",
  nextPage: "Next page",
  refresh: "Refresh"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/linear_memory_inspector/LinearMemoryNavigator.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const { render, html } = LitHtml;
export var Navigation = /* @__PURE__ */ ((Navigation2) => {
  Navigation2["Backward"] = "Backward";
  Navigation2["Forward"] = "Forward";
  return Navigation2;
})(Navigation || {});
export class AddressInputChangedEvent extends Event {
  static eventName = "addressinputchanged";
  data;
  constructor(address, mode) {
    super(AddressInputChangedEvent.eventName);
    this.data = { address, mode };
  }
}
export class PageNavigationEvent extends Event {
  static eventName = "pagenavigation";
  data;
  constructor(navigation) {
    super(PageNavigationEvent.eventName, {});
    this.data = navigation;
  }
}
export class HistoryNavigationEvent extends Event {
  static eventName = "historynavigation";
  data;
  constructor(navigation) {
    super(HistoryNavigationEvent.eventName, {});
    this.data = navigation;
  }
}
export class RefreshRequestedEvent extends Event {
  static eventName = "refreshrequested";
  constructor() {
    super(RefreshRequestedEvent.eventName, {});
  }
}
export var Mode = /* @__PURE__ */ ((Mode2) => {
  Mode2["Edit"] = "Edit";
  Mode2["Submitted"] = "Submitted";
  Mode2["InvalidSubmit"] = "InvalidSubmit";
  return Mode2;
})(Mode || {});
export class LinearMemoryNavigator extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-linear-memory-inspector-navigator`;
  #shadow = this.attachShadow({ mode: "open" });
  #address = "0";
  #error = void 0;
  #valid = true;
  #canGoBackInHistory = false;
  #canGoForwardInHistory = false;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [linearMemoryNavigatorStyles];
  }
  set data(data) {
    this.#address = data.address;
    this.#error = data.error;
    this.#valid = data.valid;
    this.#canGoBackInHistory = data.canGoBackInHistory;
    this.#canGoForwardInHistory = data.canGoForwardInHistory;
    this.#render();
    const addressInput = this.#shadow.querySelector(".address-input");
    if (addressInput) {
      if (data.mode === "Submitted" /* Submitted */) {
        addressInput.blur();
      } else if (data.mode === "InvalidSubmit" /* InvalidSubmit */) {
        addressInput.select();
      }
    }
  }
  #render() {
    const result = html`
      <div class="navigator">
        <div class="navigator-item">
          ${this.#createButton({
      icon: "ic_undo_16x16_icon",
      title: i18nString(UIStrings.goBackInAddressHistory),
      event: new HistoryNavigationEvent("Backward" /* Backward */),
      enabled: this.#canGoBackInHistory
    })}
          ${this.#createButton({
      icon: "ic_redo_16x16_icon",
      title: i18nString(UIStrings.goForwardInAddressHistory),
      event: new HistoryNavigationEvent("Forward" /* Forward */),
      enabled: this.#canGoForwardInHistory
    })}
        </div>
        <div class="navigator-item">
          ${this.#createButton({
      icon: "ic_page_prev_16x16_icon",
      title: i18nString(UIStrings.previousPage),
      event: new PageNavigationEvent("Backward" /* Backward */),
      enabled: true
    })}
          ${this.#createAddressInput()}
          ${this.#createButton({
      icon: "ic_page_next_16x16_icon",
      title: i18nString(UIStrings.nextPage),
      event: new PageNavigationEvent("Forward" /* Forward */),
      enabled: true
    })}
        </div>
        ${this.#createButton({
      icon: "refresh_12x12_icon",
      title: i18nString(UIStrings.refresh),
      event: new RefreshRequestedEvent(),
      enabled: true
    })}
      </div>
      `;
    render(result, this.#shadow, { host: this });
  }
  #createAddressInput() {
    const classMap = {
      "address-input": true,
      invalid: !this.#valid
    };
    return html`
      <input class=${LitHtml.Directives.classMap(classMap)} data-input="true" .value=${this.#address}
        title=${this.#valid ? i18nString(UIStrings.enterAddress) : this.#error} @change=${this.#onAddressChange.bind(this, "Submitted" /* Submitted */)} @input=${this.#onAddressChange.bind(this, "Edit" /* Edit */)}/>`;
  }
  #onAddressChange(mode, event) {
    const addressInput = event.target;
    this.dispatchEvent(new AddressInputChangedEvent(addressInput.value, mode));
  }
  #createButton(data) {
    const iconColor = data.enabled ? "var(--color-text-secondary)" : "var(--color-background-highlight)";
    return html`
      <button class="navigator-button" ?disabled=${!data.enabled}
        data-button=${data.event.type} title=${data.title}
        @click=${this.dispatchEvent.bind(this, data.event)}>
        <${IconButton.Icon.Icon.litTagName} .data=${{ iconName: data.icon, color: iconColor, width: "14px" }}>
        </${IconButton.Icon.Icon.litTagName}>
      </button>`;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-linear-memory-inspector-navigator", LinearMemoryNavigator);
//# sourceMappingURL=LinearMemoryNavigator.js.map
