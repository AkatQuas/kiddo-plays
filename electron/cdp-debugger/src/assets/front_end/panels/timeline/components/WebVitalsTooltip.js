import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import webVitalsTooltipStyles from "./WebVitalsTooltip.css.js";
export class WebVitalsTooltip extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-timeline-webvitals-tooltip`;
  #shadow = this.attachShadow({ mode: "open" });
  #content = null;
  set data(data) {
    this.#content = data.content;
    this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [webVitalsTooltipStyles];
    this.#render();
  }
  #render() {
    LitHtml.render(LitHtml.html`<div class="tooltip">
        ${this.#content}
      </div>
    `, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-timeline-webvitals-tooltip", WebVitalsTooltip);
//# sourceMappingURL=WebVitalsTooltip.js.map
