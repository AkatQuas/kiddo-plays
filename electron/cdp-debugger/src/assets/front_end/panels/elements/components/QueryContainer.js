import * as SDK from "../../../core/sdk/sdk.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as NodeText from "../../../ui/components/node_text/node_text.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import queryContainerStyles from "./queryContainer.css.js";
const { render, html } = LitHtml;
const { PhysicalAxis, QueryAxis } = SDK.CSSContainerQuery;
export class QueriedSizeRequestedEvent extends Event {
  static eventName = "queriedsizerequested";
  constructor() {
    super(QueriedSizeRequestedEvent.eventName, {});
  }
}
export class QueryContainer extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-query-container`;
  #shadow = this.attachShadow({ mode: "open" });
  #queryName;
  #container;
  #onContainerLinkClick;
  #isContainerLinkHovered = false;
  #queriedSizeDetails;
  set data(data) {
    this.#queryName = data.queryName;
    this.#container = data.container;
    this.#onContainerLinkClick = data.onContainerLinkClick;
    this.#render();
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [queryContainerStyles];
  }
  updateContainerQueriedSizeDetails(details) {
    this.#queriedSizeDetails = details;
    this.#render();
  }
  async #onContainerLinkMouseEnter() {
    this.#container?.highlightNode("container-outline");
    this.#isContainerLinkHovered = true;
    this.dispatchEvent(new QueriedSizeRequestedEvent());
  }
  #onContainerLinkMouseLeave() {
    this.#container?.clearHighlight();
    this.#isContainerLinkHovered = false;
    this.#render();
  }
  #render() {
    if (!this.#container) {
      return;
    }
    let idToDisplay, classesToDisplay;
    if (!this.#queryName) {
      idToDisplay = this.#container.getAttribute("id");
      classesToDisplay = this.#container.getAttribute("class")?.split(/\s+/).filter(Boolean);
    }
    const nodeTitle = this.#queryName || this.#container.nodeNameNicelyCased;
    render(html`
      →
      <a href="#"
        draggable=false
        class="container-link"
        @click=${this.#onContainerLinkClick}
        @mouseenter=${this.#onContainerLinkMouseEnter}
        @mouseleave=${this.#onContainerLinkMouseLeave}
      ><${NodeText.NodeText.NodeText.litTagName}
          data-node-title=${nodeTitle}
          .data=${{
      nodeTitle,
      nodeId: idToDisplay,
      nodeClasses: classesToDisplay
    }}></${NodeText.NodeText.NodeText.litTagName}></a>
      ${this.#isContainerLinkHovered ? this.#renderQueriedSizeDetails() : LitHtml.nothing}
    `, this.#shadow, {
      host: this
    });
  }
  #renderQueriedSizeDetails() {
    if (!this.#queriedSizeDetails || this.#queriedSizeDetails.queryAxis === QueryAxis.None) {
      return LitHtml.nothing;
    }
    const areBothAxesQueried = this.#queriedSizeDetails.queryAxis === QueryAxis.Both;
    const axisIconClasses = LitHtml.Directives.classMap({
      "axis-icon": true,
      "hidden": areBothAxesQueried,
      "vertical": this.#queriedSizeDetails.physicalAxis === PhysicalAxis.Vertical
    });
    return html`
      <span class="queried-size-details">
        (${this.#queriedSizeDetails.queryAxis}<${IconButton.Icon.Icon.litTagName}
          class=${axisIconClasses} .data=${{
      iconName: "ic_dimension_single",
      color: "var(--color-text-primary)"
    }}></${IconButton.Icon.Icon.litTagName}>)
        ${areBothAxesQueried && this.#queriedSizeDetails.width ? "width:" : LitHtml.nothing}
        ${this.#queriedSizeDetails.width || LitHtml.nothing}
        ${areBothAxesQueried && this.#queriedSizeDetails.height ? "height:" : LitHtml.nothing}
        ${this.#queriedSizeDetails.height || LitHtml.nothing}
      </span>
    `;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-query-container", QueryContainer);
//# sourceMappingURL=QueryContainer.js.map
