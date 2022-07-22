import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import inspectorCommonStyles from "../../../ui/legacy/inspectorCommon.css.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import cssQueryStyles from "./cssQuery.css.js";
const { render, html } = LitHtml;
export class CSSQuery extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-css-query`;
  #shadow = this.attachShadow({ mode: "open" });
  #queryPrefix = "";
  #queryName;
  #queryText = "";
  #onQueryTextClick;
  set data(data) {
    this.#queryPrefix = data.queryPrefix;
    this.#queryName = data.queryName;
    this.#queryText = data.queryText;
    this.#onQueryTextClick = data.onQueryTextClick;
    this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [
      cssQueryStyles,
      inspectorCommonStyles
    ];
  }
  #render() {
    const queryClasses = LitHtml.Directives.classMap({
      query: true,
      editable: Boolean(this.#onQueryTextClick)
    });
    const queryText = html`
      <span class="query-text" @click=${this.#onQueryTextClick}>${this.#queryText}</span>
    `;
    render(html`
      <div class=${queryClasses}>
        ${this.#queryPrefix ? html`<span>${this.#queryPrefix + " "}</span>` : LitHtml.nothing}${this.#queryName ? html`<span>${this.#queryName + " "}</span>` : LitHtml.nothing}${queryText}
      </div>
    `, this.#shadow, {
      host: this
    });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-css-query", CSSQuery);
//# sourceMappingURL=CSSQuery.js.map
