import * as ComponentHelpers from "../../../components/helpers/helpers.js";
import * as LitHtml from "../../../lit-html/lit-html.js";
import cssLengthStyles from "./cssLength.css.js";
import { LengthUnit, LENGTH_UNITS, parseText } from "./CSSLengthUtils.js";
import { ValueChangedEvent } from "./InlineEditorUtils.js";
const { render, html } = LitHtml;
export class DraggingFinishedEvent extends Event {
  static eventName = "draggingfinished";
  constructor() {
    super(DraggingFinishedEvent.eventName, {});
  }
}
const DefaultLength = {
  value: 0,
  unit: LengthUnit.PIXEL
};
export class CSSLength extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-css-length`;
  shadow = this.attachShadow({ mode: "open" });
  onDraggingValue = this.dragValue.bind(this);
  length = DefaultLength;
  isEditingSlot = false;
  isDraggingValue = false;
  currentMouseClientX = 0;
  #valueMousedownTime = 0;
  set data(data) {
    const parsedResult = parseText(data.lengthText);
    if (!parsedResult) {
      return;
    }
    this.length = parsedResult;
    this.render();
  }
  connectedCallback() {
    this.shadow.adoptedStyleSheets = [cssLengthStyles];
  }
  onUnitChange(event) {
    this.length.unit = event.target.value;
    this.dispatchEvent(new ValueChangedEvent(`${this.length.value}${this.length.unit}`));
    this.dispatchEvent(new DraggingFinishedEvent());
    this.render();
  }
  dragValue(event) {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() - this.#valueMousedownTime <= 300) {
      return;
    }
    this.isDraggingValue = true;
    let displacement = event.clientX - this.currentMouseClientX;
    this.currentMouseClientX = event.clientX;
    if (event.shiftKey) {
      displacement *= 10;
    }
    if (event.altKey) {
      displacement *= 0.1;
    }
    this.length.value = this.length.value + displacement;
    this.dispatchEvent(new ValueChangedEvent(`${this.length.value}${this.length.unit}`));
    this.render();
  }
  onValueMousedown(event) {
    if (event.button !== 0) {
      return;
    }
    this.#valueMousedownTime = Date.now();
    this.currentMouseClientX = event.clientX;
    const targetDocument = event.target instanceof Node && event.target.ownerDocument;
    if (targetDocument) {
      targetDocument.addEventListener("mousemove", this.onDraggingValue, { capture: true });
      targetDocument.addEventListener("mouseup", (event2) => {
        targetDocument.removeEventListener("mousemove", this.onDraggingValue, { capture: true });
        if (!this.isDraggingValue) {
          return;
        }
        event2.preventDefault();
        event2.stopPropagation();
        this.isDraggingValue = false;
        this.dispatchEvent(new DraggingFinishedEvent());
      }, { once: true, capture: true });
    }
  }
  onValueMouseup() {
    if (!this.isDraggingValue) {
      this.isEditingSlot = true;
      this.render();
    }
  }
  onUnitMouseup(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  render() {
    render(html`
      <div class="css-length">
        ${this.renderContent()}
      </div>
    `, this.shadow, {
      host: this
    });
  }
  renderContent() {
    if (this.isEditingSlot) {
      return html`<slot></slot>`;
    }
    const options = LENGTH_UNITS.map((unit) => {
      return html`
          <option value=${unit} .selected=${this.length.unit === unit}>${unit}</option>
        `;
    });
    return html`
        <span class="value"
          @mousedown=${this.onValueMousedown}
          @mouseup=${this.onValueMouseup}
        >${this.length.value}</span><span class="unit">${this.length.unit}</span><div class="unit-dropdown">
          <span class="icon"></span>
          <select @mouseup=${this.onUnitMouseup} @change=${this.onUnitChange}>
            ${options}
          </select>
        </div>
      `;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-css-length", CSSLength);
//# sourceMappingURL=CSSLength.js.map
