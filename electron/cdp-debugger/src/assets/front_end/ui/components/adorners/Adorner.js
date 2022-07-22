import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import adornerStyles from "./adorner.css.js";
const { render, html } = LitHtml;
export class Adorner extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-adorner`;
  name = "";
  #shadow = this.attachShadow({ mode: "open" });
  #isToggle = false;
  #ariaLabelDefault;
  #ariaLabelActive;
  #content;
  set data(data) {
    this.name = data.name;
    data.content.slot = "content";
    this.#content?.remove();
    this.append(data.content);
    this.#content = data.content;
    this.#render();
  }
  connectedCallback() {
    if (!this.getAttribute("aria-label")) {
      this.setAttribute("aria-label", this.name);
    }
    this.#shadow.adoptedStyleSheets = [adornerStyles];
  }
  isActive() {
    return this.getAttribute("aria-pressed") === "true";
  }
  toggle(forceActiveState) {
    if (!this.#isToggle) {
      return;
    }
    const shouldBecomeActive = forceActiveState === void 0 ? !this.isActive() : forceActiveState;
    this.setAttribute("aria-pressed", Boolean(shouldBecomeActive).toString());
    this.setAttribute("aria-label", (shouldBecomeActive ? this.#ariaLabelActive : this.#ariaLabelDefault) || this.name);
  }
  show() {
    this.classList.remove("hidden");
  }
  hide() {
    this.classList.add("hidden");
  }
  addInteraction(action, options) {
    const { isToggle = false, shouldPropagateOnKeydown = false, ariaLabelDefault, ariaLabelActive } = options;
    this.#isToggle = isToggle;
    this.#ariaLabelDefault = ariaLabelDefault;
    this.#ariaLabelActive = ariaLabelActive;
    this.setAttribute("aria-label", ariaLabelDefault);
    if (isToggle) {
      this.addEventListener("click", () => {
        this.toggle();
      });
      this.toggle(false);
    }
    this.addEventListener("click", action);
    this.classList.add("clickable");
    this.setAttribute("role", "button");
    this.tabIndex = 0;
    this.addEventListener("keydown", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        this.click();
        if (!shouldPropagateOnKeydown) {
          event.stopPropagation();
        }
      }
    });
  }
  #render() {
    render(html`
      <slot name="content"></slot>
    `, this.#shadow, {
      host: this
    });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-adorner", Adorner);
//# sourceMappingURL=Adorner.js.map
