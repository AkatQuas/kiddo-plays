import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../../components/helpers/helpers.js";
import markdownViewStyles from "./markdownView.css.js";
import { MarkdownLink } from "./MarkdownLink.js";
import { MarkdownImage } from "./MarkdownImage.js";
const html = LitHtml.html;
const render = LitHtml.render;
export class MarkdownView extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-markdown-view`;
  #shadow = this.attachShadow({ mode: "open" });
  #tokenData = [];
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [markdownViewStyles];
  }
  set data(data) {
    this.#tokenData = data.tokens;
    this.#update();
  }
  #update() {
    this.#render();
  }
  #render() {
    render(html`
      <div class='message'>
        ${this.#tokenData.map(renderToken)}
      </div>
    `, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-markdown-view", MarkdownView);
const renderChildTokens = (token) => {
  return token.tokens.map(renderToken);
};
const unescape = (text) => {
  const escapeReplacements = /* @__PURE__ */ new Map([
    ["&amp;", "&"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&quot;", '"'],
    ["&#39;", "'"]
  ]);
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (matchedString) => {
    const replacement = escapeReplacements.get(matchedString);
    return replacement ? replacement : matchedString;
  });
};
const renderText = (token) => {
  if (token.tokens && token.tokens.length > 0) {
    return html`${renderChildTokens(token)}`;
  }
  return html`${unescape(token.text)}`;
};
const tokenRenderers = /* @__PURE__ */ new Map([
  ["paragraph", (token) => html`<p>${renderChildTokens(token)}`],
  ["list", (token) => html`<ul>${token.items.map(renderToken)}</ul>`],
  ["list_item", (token) => html`<li>${renderChildTokens(token)}`],
  ["text", renderText],
  ["codespan", (token) => html`<code>${unescape(token.text)}</code>`],
  ["space", () => html``],
  [
    "link",
    (token) => html`<${MarkdownLink.litTagName} .data=${{ key: token.href, title: token.text }}></${MarkdownLink.litTagName}>`
  ],
  [
    "image",
    (token) => html`<${MarkdownImage.litTagName} .data=${{ key: token.href, title: token.text }}></${MarkdownImage.litTagName}>`
  ]
]);
export const renderToken = (token) => {
  const renderFn = tokenRenderers.get(token.type);
  if (!renderFn) {
    throw new Error(`Markdown token type '${token.type}' not supported.`);
  }
  return renderFn(token);
};
//# sourceMappingURL=MarkdownView.js.map
