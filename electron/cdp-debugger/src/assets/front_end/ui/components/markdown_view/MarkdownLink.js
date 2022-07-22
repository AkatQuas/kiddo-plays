import "../../legacy/legacy.js";
import * as ComponentHelpers from "../../components/helpers/helpers.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import markdownLinkStyles from "./markdownLink.css.js";
import { getMarkdownLink } from "./MarkdownLinksMap.js";
export class MarkdownLink extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-markdown-link`;
  #shadow = this.attachShadow({ mode: "open" });
  #linkText = "";
  #linkUrl = "";
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [markdownLinkStyles];
  }
  set data(data) {
    const { key, title } = data;
    const markdownLink = getMarkdownLink(key);
    this.#linkText = title;
    this.#linkUrl = markdownLink;
    this.#render();
  }
  #render() {
    const output = LitHtml.html`
      <x-link class="devtools-link" href=${this.#linkUrl}>${this.#linkText}</x-link>
    `;
    LitHtml.render(output, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-markdown-link", MarkdownLink);
//# sourceMappingURL=MarkdownLink.js.map
