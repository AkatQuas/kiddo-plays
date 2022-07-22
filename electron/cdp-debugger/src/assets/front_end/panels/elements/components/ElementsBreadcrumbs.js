import * as i18n from "../../../core/i18n/i18n.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as Coordinator from "../../../ui/components/render_coordinator/render_coordinator.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import elementsBreadcrumbsStyles from "./elementsBreadcrumbs.css.js";
import { crumbsToRender } from "./ElementsBreadcrumbsUtils.js";
import * as NodeText from "../../../ui/components/node_text/node_text.js";
const UIStrings = {
  breadcrumbs: "DOM tree breadcrumbs"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/components/ElementsBreadcrumbs.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class NodeSelectedEvent extends Event {
  static eventName = "breadcrumbsnodeselected";
  legacyDomNode;
  constructor(node) {
    super(NodeSelectedEvent.eventName, {});
    this.legacyDomNode = node.legacyDomNode;
  }
}
const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();
export class ElementsBreadcrumbs extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-elements-breadcrumbs`;
  #shadow = this.attachShadow({ mode: "open" });
  #resizeObserver = new ResizeObserver(() => this.#checkForOverflowOnResize());
  #crumbsData = [];
  #selectedDOMNode = null;
  #overflowing = false;
  #userScrollPosition = "start";
  #isObservingResize = false;
  #userHasManuallyScrolled = false;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [elementsBreadcrumbsStyles];
  }
  set data(data) {
    this.#selectedDOMNode = data.selectedNode;
    this.#crumbsData = data.crumbs;
    this.#userHasManuallyScrolled = false;
    void this.#update();
  }
  disconnectedCallback() {
    this.#isObservingResize = false;
    this.#resizeObserver.disconnect();
  }
  #onCrumbClick(node) {
    return (event) => {
      event.preventDefault();
      this.dispatchEvent(new NodeSelectedEvent(node));
    };
  }
  async #checkForOverflowOnResize() {
    const wrappingElement = this.#shadow.querySelector(".crumbs");
    const crumbs = this.#shadow.querySelector(".crumbs-scroll-container");
    if (!wrappingElement || !crumbs) {
      return;
    }
    const totalContainingWidth = await coordinator.read(() => wrappingElement.clientWidth);
    const totalCrumbsWidth = await coordinator.read(() => crumbs.clientWidth);
    if (totalCrumbsWidth >= totalContainingWidth && this.#overflowing === false) {
      this.#overflowing = true;
      this.#userScrollPosition = "start";
      void this.#render();
    } else if (totalCrumbsWidth < totalContainingWidth && this.#overflowing === true) {
      this.#overflowing = false;
      this.#userScrollPosition = "start";
      void this.#render();
    }
  }
  async #update() {
    await this.#render();
    this.#engageResizeObserver();
    void this.#ensureSelectedNodeIsVisible();
  }
  #onCrumbMouseMove(node) {
    return () => node.highlightNode();
  }
  #onCrumbMouseLeave(node) {
    return () => node.clearHighlight();
  }
  #onCrumbFocus(node) {
    return () => node.highlightNode();
  }
  #onCrumbBlur(node) {
    return () => node.clearHighlight();
  }
  #engageResizeObserver() {
    if (!this.#resizeObserver || this.#isObservingResize === true) {
      return;
    }
    const crumbs = this.#shadow.querySelector(".crumbs");
    if (!crumbs) {
      return;
    }
    this.#resizeObserver.observe(crumbs);
    this.#isObservingResize = true;
  }
  async #checkForOverflow() {
    const crumbScrollContainer = this.#shadow.querySelector(".crumbs-scroll-container");
    const crumbWindow = this.#shadow.querySelector(".crumbs-window");
    if (!crumbScrollContainer || !crumbWindow) {
      return;
    }
    const crumbWindowWidth = await coordinator.read(() => {
      return crumbWindow.clientWidth;
    });
    const scrollContainerWidth = await coordinator.read(() => {
      return crumbScrollContainer.clientWidth;
    });
    const paddingAllowance = 20;
    const maxChildWidth = crumbWindowWidth - paddingAllowance;
    if (scrollContainerWidth < maxChildWidth) {
      if (this.#overflowing) {
        this.#overflowing = false;
        void this.#render();
      }
      return;
    }
    if (!this.#overflowing) {
      this.#overflowing = true;
      void this.#render();
    }
  }
  #onCrumbsWindowScroll(event) {
    if (!event.target) {
      return;
    }
    const scrollWindow = event.target;
    this.#updateScrollState(scrollWindow);
  }
  #updateScrollState(scrollWindow) {
    const maxScrollLeft = scrollWindow.scrollWidth - scrollWindow.clientWidth;
    const currentScroll = scrollWindow.scrollLeft;
    const scrollBeginningAndEndPadding = 10;
    if (currentScroll < scrollBeginningAndEndPadding) {
      this.#userScrollPosition = "start";
    } else if (currentScroll >= maxScrollLeft - scrollBeginningAndEndPadding) {
      this.#userScrollPosition = "end";
    } else {
      this.#userScrollPosition = "middle";
    }
    void this.#render();
  }
  #onOverflowClick(direction) {
    return () => {
      this.#userHasManuallyScrolled = true;
      const scrollWindow = this.#shadow.querySelector(".crumbs-window");
      if (!scrollWindow) {
        return;
      }
      const amountToScrollOnClick = scrollWindow.clientWidth / 2;
      const newScrollAmount = direction === "left" ? Math.max(Math.floor(scrollWindow.scrollLeft - amountToScrollOnClick), 0) : scrollWindow.scrollLeft + amountToScrollOnClick;
      scrollWindow.scrollTo({
        behavior: "smooth",
        left: newScrollAmount
      });
    };
  }
  #renderOverflowButton(direction, disabled) {
    const buttonStyles = LitHtml.Directives.classMap({
      overflow: true,
      [direction]: true,
      hidden: this.#overflowing === false
    });
    return LitHtml.html`
      <button
        class=${buttonStyles}
        @click=${this.#onOverflowClick(direction)}
        ?disabled=${disabled}
        aria-label="Scroll ${direction}"
      >&hellip;</button>
      `;
  }
  async #render() {
    const crumbs = crumbsToRender(this.#crumbsData, this.#selectedDOMNode);
    await coordinator.write("Breadcrumbs render", () => {
      LitHtml.render(LitHtml.html`
        <nav class="crumbs" aria-label=${i18nString(UIStrings.breadcrumbs)}>
          ${this.#renderOverflowButton("left", this.#userScrollPosition === "start")}

          <div class="crumbs-window" @scroll=${this.#onCrumbsWindowScroll}>
            <ul class="crumbs-scroll-container">
              ${crumbs.map((crumb) => {
        const crumbClasses = {
          crumb: true,
          selected: crumb.selected
        };
        return LitHtml.html`
                  <li class=${LitHtml.Directives.classMap(crumbClasses)}
                    data-node-id=${crumb.node.id}
                    data-crumb="true"
                  >
                    <a href="#"
                      draggable=false
                      class="crumb-link"
                      @click=${this.#onCrumbClick(crumb.node)}
                      @mousemove=${this.#onCrumbMouseMove(crumb.node)}
                      @mouseleave=${this.#onCrumbMouseLeave(crumb.node)}
                      @focus=${this.#onCrumbFocus(crumb.node)}
                      @blur=${this.#onCrumbBlur(crumb.node)}
                    ><${NodeText.NodeText.NodeText.litTagName} data-node-title=${crumb.title.main} .data=${{
          nodeTitle: crumb.title.main,
          nodeId: crumb.title.extras.id,
          nodeClasses: crumb.title.extras.classes
        }}></${NodeText.NodeText.NodeText.litTagName}></a>
                  </li>`;
      })}
            </ul>
          </div>
          ${this.#renderOverflowButton("right", this.#userScrollPosition === "end")}
        </nav>
      `, this.#shadow, { host: this });
    });
    void this.#checkForOverflow();
  }
  async #ensureSelectedNodeIsVisible() {
    if (!this.#selectedDOMNode || !this.#shadow || !this.#overflowing || this.#userHasManuallyScrolled) {
      return;
    }
    const activeCrumbId = this.#selectedDOMNode.id;
    const activeCrumb = this.#shadow.querySelector(`.crumb[data-node-id="${activeCrumbId}"]`);
    if (activeCrumb) {
      await coordinator.scroll(() => {
        activeCrumb.scrollIntoView({
          behavior: "smooth"
        });
      });
    }
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-elements-breadcrumbs", ElementsBreadcrumbs);
//# sourceMappingURL=ElementsBreadcrumbs.js.map
