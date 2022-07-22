import * as i18n from "../../../../core/i18n/i18n.js";
import * as ComponentHelpers from "../../../components/helpers/helpers.js";
import * as LitHtml from "../../../lit-html/lit-html.js";
import cssVarSwatchStyles from "./cssVarSwatch.css.js";
const UIStrings = {
  sIsNotDefined: "{PH1} is not defined"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/inline_editor/CSSVarSwatch.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const { render, html, Directives } = LitHtml;
const VARIABLE_FUNCTION_REGEX = /(var\()(\s*--[^,)]+)(.*)/;
export class CSSVarSwatch extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-css-var-swatch`;
  shadow = this.attachShadow({ mode: "open" });
  text = "";
  computedValue = null;
  fromFallback = false;
  onLinkActivate = () => void 0;
  constructor() {
    super();
    this.tabIndex = -1;
    this.addEventListener("focus", () => {
      const link = this.shadow.querySelector('[role="link"]');
      if (link) {
        link.focus();
      }
    });
  }
  connectedCallback() {
    this.shadow.adoptedStyleSheets = [cssVarSwatchStyles];
  }
  set data(data) {
    this.text = data.text;
    this.computedValue = data.computedValue;
    this.fromFallback = data.fromFallback;
    this.onLinkActivate = (variableName, event) => {
      if (event instanceof MouseEvent && event.button !== 0) {
        return;
      }
      if (event instanceof KeyboardEvent && !isEnterOrSpaceKey(event)) {
        return;
      }
      data.onLinkActivate(variableName);
      event.consume(true);
    };
    this.render();
  }
  parseVariableFunctionParts() {
    const result = this.text.replace(/\s{2,}/g, " ").match(VARIABLE_FUNCTION_REGEX);
    if (!result) {
      return null;
    }
    return {
      pre: result[1],
      name: result[2],
      post: result[3]
    };
  }
  get variableName() {
    const match = this.text.match(/--[^,)]+/);
    if (match) {
      return match[0];
    }
    return "";
  }
  renderLink(variableName) {
    const isDefined = this.computedValue && !this.fromFallback;
    const classes = Directives.classMap({
      "css-var-link": true,
      "undefined": !isDefined
    });
    const title = isDefined ? this.computedValue : i18nString(UIStrings.sIsNotDefined, { PH1: variableName });
    const onActivate = isDefined ? this.onLinkActivate.bind(this, this.variableName.trim()) : null;
    return html`<span class=${classes} title=${title} @mousedown=${onActivate} @keydown=${onActivate} role="link" tabindex="-1">${variableName}</span>`;
  }
  render() {
    const functionParts = this.parseVariableFunctionParts();
    if (!functionParts) {
      render("", this.shadow, { host: this });
      return;
    }
    const link = this.renderLink(functionParts.name);
    render(html`<span title=${this.computedValue || ""}>${functionParts.pre}${link}${functionParts.post}</span>`, this.shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-css-var-swatch", CSSVarSwatch);
//# sourceMappingURL=CSSVarSwatch.js.map
