import * as i18n from "../../../core/i18n/i18n.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import * as Input from "../input/input.js";
import { ValueType, valueTypeToLocalizedString } from "./ValueInterpreterDisplayUtils.js";
import valueInterpreterSettingsStyles from "./valueInterpreterSettings.css.js";
const { render, html } = LitHtml;
const UIStrings = {
  otherGroup: "Other"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/linear_memory_inspector/ValueInterpreterSettings.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
var ValueTypeGroup = /* @__PURE__ */ ((ValueTypeGroup2) => {
  ValueTypeGroup2["Integer"] = "Integer";
  ValueTypeGroup2["Float"] = "Floating point";
  ValueTypeGroup2["Other"] = "Other";
  return ValueTypeGroup2;
})(ValueTypeGroup || {});
const GROUP_TO_TYPES = /* @__PURE__ */ new Map([
  ["Integer" /* Integer */, [ValueType.Int8, ValueType.Int16, ValueType.Int32, ValueType.Int64]],
  ["Floating point" /* Float */, [ValueType.Float32, ValueType.Float64]],
  ["Other" /* Other */, [ValueType.Pointer32, ValueType.Pointer64]]
]);
function valueTypeGroupToLocalizedString(group) {
  if (group === "Other" /* Other */) {
    return i18nString(UIStrings.otherGroup);
  }
  return group;
}
export class TypeToggleEvent extends Event {
  static eventName = "typetoggle";
  data;
  constructor(type, checked) {
    super(TypeToggleEvent.eventName);
    this.data = { type, checked };
  }
}
export class ValueInterpreterSettings extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-linear-memory-inspector-interpreter-settings`;
  #shadow = this.attachShadow({ mode: "open" });
  #valueTypes = /* @__PURE__ */ new Set();
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [Input.checkboxStyles, valueInterpreterSettingsStyles];
  }
  set data(data) {
    this.#valueTypes = data.valueTypes;
    this.#render();
  }
  #render() {
    render(html`
      <div class="settings">
       ${[...GROUP_TO_TYPES.keys()].map((group) => {
      return html`
          <div class="value-types-selection">
            <span class="group">${valueTypeGroupToLocalizedString(group)}</span>
            ${this.#plotTypeSelections(group)}
          </div>
        `;
    })}
      </div>
      `, this.#shadow, { host: this });
  }
  #plotTypeSelections(group) {
    const types = GROUP_TO_TYPES.get(group);
    if (!types) {
      throw new Error(`Unknown group ${group}`);
    }
    return html`
      ${types.map((type) => {
      return html`
          <label class="type-label" title=${valueTypeToLocalizedString(type)}>
            <input data-input="true" type="checkbox" .checked=${this.#valueTypes.has(type)} @change=${(e) => this.#onTypeToggle(type, e)}>
            <span data-title="true">${valueTypeToLocalizedString(type)}</span>
          </label>
     `;
    })}`;
  }
  #onTypeToggle(type, event) {
    const checkbox = event.target;
    this.dispatchEvent(new TypeToggleEvent(type, checkbox.checked));
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-linear-memory-inspector-interpreter-settings", ValueInterpreterSettings);
//# sourceMappingURL=ValueInterpreterSettings.js.map
