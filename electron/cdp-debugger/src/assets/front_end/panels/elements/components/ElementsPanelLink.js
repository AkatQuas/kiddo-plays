import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import elementsPanelLinkStyles from "./elementsPanelLink.css.js";
export class ElementsPanelLink extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-elements-panel-link`;
  #shadow = this.attachShadow({ mode: "open" });
  #onElementRevealIconClick = () => {
  };
  #onElementRevealIconMouseEnter = () => {
  };
  #onElementRevealIconMouseLeave = () => {
  };
  set data(data) {
    this.#onElementRevealIconClick = data.onElementRevealIconClick;
    this.#onElementRevealIconMouseEnter = data.onElementRevealIconMouseEnter;
    this.#onElementRevealIconMouseLeave = data.onElementRevealIconMouseLeave;
    this.#update();
  }
  #update() {
    this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [elementsPanelLinkStyles];
  }
  #render() {
    LitHtml.render(LitHtml.html`
      <span
        class="element-reveal-icon"
        @click=${this.#onElementRevealIconClick}
        @mouseenter=${this.#onElementRevealIconMouseEnter}
        @mouseleave=${this.#onElementRevealIconMouseLeave}></span>
      `, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-elements-panel-link", ElementsPanelLink);
//# sourceMappingURL=ElementsPanelLink.js.map
