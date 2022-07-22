import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import computedStyleTraceStyles from "./computedStyleTrace.css.js";
const { render, html } = LitHtml;
export class ComputedStyleTrace extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-computed-style-trace`;
  #shadow = this.attachShadow({ mode: "open" });
  #selector = "";
  #active = false;
  #onNavigateToSource = () => {
  };
  #ruleOriginNode;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [computedStyleTraceStyles];
  }
  set data(data) {
    this.#selector = data.selector;
    this.#active = data.active;
    this.#onNavigateToSource = data.onNavigateToSource;
    this.#ruleOriginNode = data.ruleOriginNode;
    this.#render();
  }
  #render() {
    render(html`
      <div class="computed-style-trace ${this.#active ? "active" : "inactive"}">
        <span class="goto" @click=${this.#onNavigateToSource}></span>
        <slot name="trace-value" @click=${this.#onNavigateToSource}></slot>
        <span class="trace-selector">${this.#selector}</span>
        <span class="trace-link">${this.#ruleOriginNode}</span>
      </div>
    `, this.#shadow, {
      host: this
    });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-computed-style-trace", ComputedStyleTrace);
//# sourceMappingURL=ComputedStyleTrace.js.map
