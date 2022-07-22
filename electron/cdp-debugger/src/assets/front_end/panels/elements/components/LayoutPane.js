import * as Common from "../../../core/common/common.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as UI from "../../../ui/legacy/legacy.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import layoutPaneStyles from "../layoutPane.css.js";
import * as Input from "../../../ui/components/input/input.js";
import * as NodeText from "../../../ui/components/node_text/node_text.js";
import inspectorCommonStyles from "../../../ui/legacy/inspectorCommon.css.js";
import * as i18n from "../../../core/i18n/i18n.js";
const UIStrings = {
  chooseElementOverlayColor: "Choose the overlay color for this element",
  showElementInTheElementsPanel: "Show element in the Elements panel",
  grid: "Grid",
  overlayDisplaySettings: "Overlay display settings",
  gridOverlays: "Grid overlays",
  noGridLayoutsFoundOnThisPage: "No grid layouts found on this page",
  flexbox: "Flexbox",
  flexboxOverlays: "Flexbox overlays",
  noFlexboxLayoutsFoundOnThisPage: "No flexbox layouts found on this page",
  colorPickerOpened: "Color picker opened."
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/components/LayoutPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export {};
const { render, html } = LitHtml;
export class SettingChangedEvent extends Event {
  static eventName = "settingchanged";
  data;
  constructor(setting, value) {
    super(SettingChangedEvent.eventName, {});
    this.data = { setting, value };
  }
}
function isEnumSetting(setting) {
  return setting.type === Common.Settings.SettingType.ENUM;
}
function isBooleanSetting(setting) {
  return setting.type === Common.Settings.SettingType.BOOLEAN;
}
export class LayoutPane extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-layout-pane`;
  #shadow = this.attachShadow({ mode: "open" });
  #settings = [];
  #gridElements = [];
  #flexContainerElements = [];
  constructor() {
    super();
    this.#shadow.adoptedStyleSheets = [
      Input.checkboxStyles,
      layoutPaneStyles,
      inspectorCommonStyles
    ];
  }
  set data(data) {
    this.#settings = data.settings;
    this.#gridElements = data.gridElements;
    this.#flexContainerElements = data.flexContainerElements;
    this.#render();
  }
  #onSummaryKeyDown(event) {
    if (!event.target) {
      return;
    }
    const summaryElement = event.target;
    const detailsElement = summaryElement.parentElement;
    if (!detailsElement) {
      throw new Error("<details> element is not found for a <summary> element");
    }
    switch (event.key) {
      case "ArrowLeft":
        detailsElement.open = false;
        break;
      case "ArrowRight":
        detailsElement.open = true;
        break;
    }
  }
  #render() {
    render(html`
      <details open>
        <summary class="header" @keydown=${this.#onSummaryKeyDown}>
          ${i18nString(UIStrings.grid)}
        </summary>
        <div class="content-section">
          <h3 class="content-section-title">${i18nString(UIStrings.overlayDisplaySettings)}</h3>
          <div class="select-settings">
            ${this.#getEnumSettings().map((setting) => this.#renderEnumSetting(setting))}
          </div>
          <div class="checkbox-settings">
            ${this.#getBooleanSettings().map((setting) => this.#renderBooleanSetting(setting))}
          </div>
        </div>
        ${this.#gridElements ? html`<div class="content-section">
            <h3 class="content-section-title">
              ${this.#gridElements.length ? i18nString(UIStrings.gridOverlays) : i18nString(UIStrings.noGridLayoutsFoundOnThisPage)}
            </h3>
            ${this.#gridElements.length ? html`<div class="elements">
                ${this.#gridElements.map((element) => this.#renderElement(element))}
              </div>` : ""}
          </div>` : ""}
      </details>
      ${this.#flexContainerElements !== void 0 ? html`
        <details open>
          <summary class="header" @keydown=${this.#onSummaryKeyDown}>
            ${i18nString(UIStrings.flexbox)}
          </summary>
          ${this.#flexContainerElements ? html`<div class="content-section">
              <h3 class="content-section-title">
                ${this.#flexContainerElements.length ? i18nString(UIStrings.flexboxOverlays) : i18nString(UIStrings.noFlexboxLayoutsFoundOnThisPage)}
              </h3>
              ${this.#flexContainerElements.length ? html`<div class="elements">
                  ${this.#flexContainerElements.map((element) => this.#renderElement(element))}
                </div>` : ""}
            </div>` : ""}
        </details>
        ` : ""}
    `, this.#shadow, {
      host: this
    });
  }
  #getEnumSettings() {
    return this.#settings.filter(isEnumSetting);
  }
  #getBooleanSettings() {
    return this.#settings.filter(isBooleanSetting);
  }
  #onBooleanSettingChange(setting, event) {
    event.preventDefault();
    this.dispatchEvent(new SettingChangedEvent(setting.name, event.target.checked));
  }
  #onEnumSettingChange(setting, event) {
    event.preventDefault();
    this.dispatchEvent(new SettingChangedEvent(setting.name, event.target.value));
  }
  #onElementToggle(element, event) {
    event.preventDefault();
    element.toggle(event.target.checked);
  }
  #onElementClick(element, event) {
    event.preventDefault();
    element.reveal();
  }
  #onColorChange(element, event) {
    event.preventDefault();
    element.setColor(event.target.value);
    this.#render();
  }
  #onElementMouseEnter(element, event) {
    event.preventDefault();
    element.highlight();
  }
  #onElementMouseLeave(element, event) {
    event.preventDefault();
    element.hideHighlight();
  }
  #renderElement(element) {
    const onElementToggle = this.#onElementToggle.bind(this, element);
    const onElementClick = this.#onElementClick.bind(this, element);
    const onColorChange = this.#onColorChange.bind(this, element);
    const onMouseEnter = this.#onElementMouseEnter.bind(this, element);
    const onMouseLeave = this.#onElementMouseLeave.bind(this, element);
    const onColorLabelKeyUp = (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const target = event.target;
      const input = target.querySelector("input");
      input.click();
      UI.ARIAUtils.alert(i18nString(UIStrings.colorPickerOpened));
      event.preventDefault();
    };
    const onColorLabelKeyDown = (event) => {
      if (event.key === " ") {
        event.preventDefault();
      }
    };
    return html`<div class="element">
      <label data-element="true" class="checkbox-label">
        <input data-input="true" type="checkbox" .checked=${element.enabled} @change=${onElementToggle} />
        <span class="node-text-container" data-label="true" @mouseenter=${onMouseEnter} @mouseleave=${onMouseLeave}>
          <${NodeText.NodeText.NodeText.litTagName} .data=${{
      nodeId: element.domId,
      nodeTitle: element.name,
      nodeClasses: element.domClasses
    }}></${NodeText.NodeText.NodeText.litTagName}>
        </span>
      </label>
      <label @keyup=${onColorLabelKeyUp} @keydown=${onColorLabelKeyDown} tabindex="0" title=${i18nString(UIStrings.chooseElementOverlayColor)} class="color-picker-label" style="background: ${element.color};">
        <input @change=${onColorChange} @input=${onColorChange} tabindex="-1" class="color-picker" type="color" value=${element.color} />
      </label>
      <button tabindex="0" @click=${onElementClick} title=${i18nString(UIStrings.showElementInTheElementsPanel)} class="show-element"></button>
    </div>`;
  }
  #renderBooleanSetting(setting) {
    const onBooleanSettingChange = this.#onBooleanSettingChange.bind(this, setting);
    return html`<label data-boolean-setting="true" class="checkbox-label" title=${setting.title}>
      <input data-input="true" type="checkbox" .checked=${setting.value} @change=${onBooleanSettingChange} />
      <span data-label="true">${setting.title}</span>
    </label>`;
  }
  #renderEnumSetting(setting) {
    const onEnumSettingChange = this.#onEnumSettingChange.bind(this, setting);
    return html`<label data-enum-setting="true" class="select-label" title=${setting.title}>
      <select class="chrome-select" data-input="true" @change=${onEnumSettingChange}>
        ${setting.options.map((opt) => html`<option value=${opt.value} .selected=${setting.value === opt.value}>${opt.title}</option>`)}
      </select>
    </label>`;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-layout-pane", LayoutPane);
//# sourceMappingURL=LayoutPane.js.map
