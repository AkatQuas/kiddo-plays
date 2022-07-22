import * as i18n from "../../../core/i18n/i18n.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as Input from "../../../ui/components/input/input.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import adornerSettingsPaneStyles from "./adornerSettingsPane.css.js";
const UIStrings = {
  settingsTitle: "Show badges",
  closeButton: "Close"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/components/AdornerSettingsPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const { render, html } = LitHtml;
export class AdornerSettingUpdatedEvent extends Event {
  static eventName = "adornersettingupdated";
  data;
  constructor(adornerName, isEnabledNow, newSettings) {
    super(AdornerSettingUpdatedEvent.eventName, {});
    this.data = { adornerName, isEnabledNow, newSettings };
  }
}
export class AdornerSettingsPane extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-adorner-settings-pane`;
  #shadow = this.attachShadow({ mode: "open" });
  #settings = /* @__PURE__ */ new Map();
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [Input.checkboxStyles, adornerSettingsPaneStyles];
  }
  set data(data) {
    this.#settings = new Map(data.settings.entries());
    this.#render();
  }
  show() {
    this.classList.remove("hidden");
    const settingsPane = this.#shadow.querySelector(".adorner-settings-pane");
    if (settingsPane) {
      settingsPane.focus();
    }
  }
  hide() {
    this.classList.add("hidden");
  }
  #onChange(ev) {
    const inputEl = ev.target;
    const adorner = inputEl.dataset.adorner;
    if (adorner === void 0) {
      return;
    }
    const isEnabledNow = inputEl.checked;
    this.#settings.set(adorner, isEnabledNow);
    this.dispatchEvent(new AdornerSettingUpdatedEvent(adorner, isEnabledNow, this.#settings));
    this.#render();
  }
  #render() {
    const settingTemplates = [];
    for (const [adorner, isEnabled] of this.#settings) {
      settingTemplates.push(html`
        <label class="setting" title=${adorner}>
          <input
            class="adorner-status"
            type="checkbox" name=${adorner}
            .checked=${isEnabled}
            data-adorner=${adorner}>
          <span class="adorner-name">${adorner}</span>
        </label>
      `);
    }
    render(html`
      <div class="adorner-settings-pane" tabindex="-1">
        <div class="settings-title">${i18nString(UIStrings.settingsTitle)}</div>
        <div class="setting-list" @change=${this.#onChange}>
          ${settingTemplates}
        </div>
        <button class="close" @click=${this.hide} aria-label=${i18nString(UIStrings.closeButton)}></button>
      </div>
    `, this.#shadow, {
      host: this
    });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-adorner-settings-pane", AdornerSettingsPane);
//# sourceMappingURL=AdornerSettingsPane.js.map
