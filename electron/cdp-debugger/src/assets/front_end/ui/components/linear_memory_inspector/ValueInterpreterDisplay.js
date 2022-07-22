import * as i18n from "../../../core/i18n/i18n.js";
import inspectorCommonStyles from "../../legacy/inspectorCommon.css.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import * as IconButton from "../icon_button/icon_button.js";
import valueInterpreterDisplayStyles from "./valueInterpreterDisplay.css.js";
import {
  Endianness,
  format,
  getDefaultValueTypeMapping,
  getPointerAddress,
  isNumber,
  isPointer,
  isValidMode,
  VALUE_TYPE_MODE_LIST,
  ValueType,
  ValueTypeMode
} from "./ValueInterpreterDisplayUtils.js";
const UIStrings = {
  unsignedValue: "`Unsigned` value",
  changeValueTypeMode: "Change mode",
  signedValue: "`Signed` value",
  jumpToPointer: "Jump to address",
  addressOutOfRange: "Address out of memory range"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/linear_memory_inspector/ValueInterpreterDisplay.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const { render, html } = LitHtml;
const SORTED_VALUE_TYPES = Array.from(getDefaultValueTypeMapping().keys());
export class ValueTypeModeChangedEvent extends Event {
  static eventName = "valuetypemodechanged";
  data;
  constructor(type, mode) {
    super(ValueTypeModeChangedEvent.eventName, {
      composed: true
    });
    this.data = { type, mode };
  }
}
export class JumpToPointerAddressEvent extends Event {
  static eventName = "jumptopointeraddress";
  data;
  constructor(address) {
    super(JumpToPointerAddressEvent.eventName, {
      composed: true
    });
    this.data = address;
  }
}
export class ValueInterpreterDisplay extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-linear-memory-inspector-interpreter-display`;
  #shadow = this.attachShadow({ mode: "open" });
  #endianness = Endianness.Little;
  #buffer = new ArrayBuffer(0);
  #valueTypes = /* @__PURE__ */ new Set();
  #valueTypeModeConfig = getDefaultValueTypeMapping();
  #memoryLength = 0;
  constructor() {
    super();
    this.#shadow.adoptedStyleSheets = [
      inspectorCommonStyles
    ];
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [valueInterpreterDisplayStyles];
  }
  set data(data) {
    this.#buffer = data.buffer;
    this.#endianness = data.endianness;
    this.#valueTypes = data.valueTypes;
    this.#memoryLength = data.memoryLength;
    if (data.valueTypeModes) {
      data.valueTypeModes.forEach((mode, valueType) => {
        if (isValidMode(valueType, mode)) {
          this.#valueTypeModeConfig.set(valueType, mode);
        }
      });
    }
    this.#render();
  }
  #render() {
    render(html`
      <div class="value-types">
        ${SORTED_VALUE_TYPES.map((type) => this.#valueTypes.has(type) ? this.#showValue(type) : "")}
      </div>
    `, this.#shadow, { host: this });
  }
  #showValue(type) {
    if (isNumber(type)) {
      return this.#renderNumberValues(type);
    }
    if (isPointer(type)) {
      return this.#renderPointerValue(type);
    }
    throw new Error(`No known way to format ${type}`);
  }
  #renderPointerValue(type) {
    const unsignedValue = this.#parse({ type, signed: false });
    const address = getPointerAddress(type, this.#buffer, this.#endianness);
    const jumpDisabled = Number.isNaN(address) || BigInt(address) >= BigInt(this.#memoryLength);
    const buttonTitle = jumpDisabled ? i18nString(UIStrings.addressOutOfRange) : i18nString(UIStrings.jumpToPointer);
    const iconColor = jumpDisabled ? "var(--color-text-secondary)" : "var(--color-primary)";
    return html`
      <span class="value-type-cell-no-mode value-type-cell selectable-text">${i18n.i18n.lockedString(type)}</span>
      <div class="value-type-cell">
        <div class="value-type-value-with-link" data-value="true">
        <span class="selectable-text">${unsignedValue}</span>
          ${html`
              <button class="jump-to-button" data-jump="true" title=${buttonTitle} ?disabled=${jumpDisabled}
                @click=${this.#onJumpToAddressClicked.bind(this, Number(address))}>
                <${IconButton.Icon.Icon.litTagName} .data=${{ iconName: "link_icon", color: iconColor, width: "14px" }}>
                </${IconButton.Icon.Icon.litTagName}>
              </button>`}
        </div>
      </div>
    `;
  }
  #onJumpToAddressClicked(address) {
    this.dispatchEvent(new JumpToPointerAddressEvent(address));
  }
  #renderNumberValues(type) {
    return html`
      <span class="value-type-cell selectable-text">${i18n.i18n.lockedString(type)}</span>
      <div>
        <select title=${i18nString(UIStrings.changeValueTypeMode)}
          data-mode-settings="true"
          class="chrome-select"
          style="border: none; background-color: transparent; cursor: pointer; color: var(--color-text-secondary);"
          @change=${this.#onValueTypeModeChange.bind(this, type)}>
            ${VALUE_TYPE_MODE_LIST.filter((x) => isValidMode(type, x)).map((mode) => {
      return html`
                <option value=${mode} .selected=${this.#valueTypeModeConfig.get(type) === mode}>${i18n.i18n.lockedString(mode)}
                </option>`;
    })}
        </select>
      </div>
      ${this.#renderSignedAndUnsigned(type)}
    `;
  }
  #renderSignedAndUnsigned(type) {
    const unsignedValue = this.#parse({ type, signed: false });
    const signedValue = this.#parse({ type, signed: true });
    const mode = this.#valueTypeModeConfig.get(type);
    const showSignedAndUnsigned = signedValue !== unsignedValue && mode !== ValueTypeMode.Hexadecimal && mode !== ValueTypeMode.Octal;
    const unsignedRendered = html`<span class="value-type-cell selectable-text"  title=${i18nString(UIStrings.unsignedValue)} data-value="true">${unsignedValue}</span>`;
    if (!showSignedAndUnsigned) {
      return unsignedRendered;
    }
    const showInMultipleLines = type === ValueType.Int32 || type === ValueType.Int64;
    const signedRendered = html`<span class="selectable-text" data-value="true" title=${i18nString(UIStrings.signedValue)}>${signedValue}</span>`;
    if (showInMultipleLines) {
      return html`
        <div class="value-type-cell">
          ${unsignedRendered}
          ${signedRendered}
        </div>
        `;
    }
    return html`
      <div class="value-type-cell" style="flex-direction: row;">
        ${unsignedRendered}
        <span class="signed-divider"></span>
        ${signedRendered}
      </div>
    `;
  }
  #onValueTypeModeChange(type, event) {
    event.preventDefault();
    const select = event.target;
    const mode = select.value;
    this.dispatchEvent(new ValueTypeModeChangedEvent(type, mode));
  }
  #parse(data) {
    const mode = this.#valueTypeModeConfig.get(data.type);
    return format({ buffer: this.#buffer, type: data.type, endianness: this.#endianness, signed: data.signed || false, mode });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-linear-memory-inspector-interpreter-display", ValueInterpreterDisplay);
//# sourceMappingURL=ValueInterpreterDisplay.js.map
