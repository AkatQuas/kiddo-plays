import * as ComponentHelpers from "../../components/helpers/helpers.js";
import * as IconButton from "../../components/icon_button/icon_button.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import markdownImageStyles from "./markdownImage.css.js";
import { getMarkdownImage } from "./MarkdownImagesMap.js";
export class MarkdownImage extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-markdown-image`;
  #shadow = this.attachShadow({ mode: "open" });
  #imageData;
  #imageTitle;
  constructor() {
    super();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [markdownImageStyles];
  }
  set data(data) {
    const { key, title } = data;
    const markdownImage = getMarkdownImage(key);
    this.#imageData = markdownImage;
    this.#imageTitle = title;
    this.#render();
  }
  #getIconComponent() {
    if (!this.#imageData) {
      return LitHtml.html``;
    }
    const { src, color, width = "100%", height = "100%" } = this.#imageData;
    return LitHtml.html`
      <${IconButton.Icon.Icon.litTagName} .data=${{ iconPath: src, color, width, height }}></${IconButton.Icon.Icon.litTagName}>
    `;
  }
  #getImageComponent() {
    if (!this.#imageData) {
      return LitHtml.html``;
    }
    const { src, width = "100%", height = "100%" } = this.#imageData;
    return LitHtml.html`
      <img class="markdown-image" src=${src} alt=${this.#imageTitle} width=${width} height=${height}/>
    `;
  }
  #render() {
    if (!this.#imageData) {
      return;
    }
    const { isIcon } = this.#imageData;
    const imageComponent = isIcon ? this.#getIconComponent() : this.#getImageComponent();
    LitHtml.render(imageComponent, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-markdown-image", MarkdownImage);
//# sourceMappingURL=MarkdownImage.js.map
