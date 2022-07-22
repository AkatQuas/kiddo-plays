import * as ComponentHelpers from "../../../components/helpers/helpers.js";
import * as LitHtml from "../../../lit-html/lit-html.js";
import cssAngleSwatchStyles from "./cssAngleSwatch.css.js";
import { AngleUnit, get2DTranslationsForAngle } from "./CSSAngleUtils.js";
const { render, html } = LitHtml;
const styleMap = LitHtml.Directives.styleMap;
const swatchWidth = 11;
export class CSSAngleSwatch extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-css-angle-swatch`;
  shadow = this.attachShadow({ mode: "open" });
  angle = {
    value: 0,
    unit: AngleUnit.Rad
  };
  connectedCallback() {
    this.shadow.adoptedStyleSheets = [cssAngleSwatchStyles];
  }
  set data(data) {
    this.angle = data.angle;
    this.render();
  }
  render() {
    const { translateX, translateY } = get2DTranslationsForAngle(this.angle, swatchWidth / 4);
    const miniHandStyle = {
      transform: `translate(${translateX}px, ${translateY}px) rotate(${this.angle.value}${this.angle.unit})`
    };
    render(html`
      <div class="swatch">
        <span class="mini-hand" style=${styleMap(miniHandStyle)}></span>
      </div>
    `, this.shadow, {
      host: this
    });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-css-angle-swatch", CSSAngleSwatch);
//# sourceMappingURL=CSSAngleSwatch.js.map
