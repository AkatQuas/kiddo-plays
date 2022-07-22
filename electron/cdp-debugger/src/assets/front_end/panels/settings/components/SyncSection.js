import * as Common from "../../../core/common/common.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as i18n from "../../../core/i18n/i18n.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import * as Settings from "../../../ui/components/settings/settings.js";
import * as ChromeLink from "../../../ui/components/chrome_link/chrome_link.js";
import syncSectionStyles from "./syncSection.css.js";
const UIStrings = {
  syncDisabled: "To turn this setting on, you must enable Chrome sync.",
  preferencesSyncDisabled: "To turn this setting on, you must first enable settings sync in Chrome.",
  settings: "Go to Settings",
  signedIn: "Signed into Chrome as:"
};
const str_ = i18n.i18n.registerUIStrings("panels/settings/components/SyncSection.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SyncSection extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-sync-section`;
  #shadow = this.attachShadow({ mode: "open" });
  #syncInfo = { isSyncActive: false };
  #syncSetting;
  #boundRender = this.#render.bind(this);
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [syncSectionStyles];
  }
  set data(data) {
    this.#syncInfo = data.syncInfo;
    this.#syncSetting = data.syncSetting;
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }
  #render() {
    if (!this.#syncSetting) {
      throw new Error("SyncSection not properly initialized");
    }
    const checkboxDisabled = !this.#syncInfo.isSyncActive || !this.#syncInfo.arePreferencesSynced;
    LitHtml.render(LitHtml.html`
      <fieldset>
        <legend>${Common.Settings.getLocalizedSettingsCategory(Common.Settings.SettingCategory.SYNC)}</legend>
        ${renderAccountInfoOrWarning(this.#syncInfo)}
        <${Settings.SettingCheckbox.SettingCheckbox.litTagName} .data=${{ setting: this.#syncSetting, disabled: checkboxDisabled }}>
        </${Settings.SettingCheckbox.SettingCheckbox.litTagName}>
      </fieldset>
    `, this.#shadow, { host: this });
  }
}
function renderAccountInfoOrWarning(syncInfo) {
  if (!syncInfo.isSyncActive) {
    const link = "chrome://settings/syncSetup";
    return LitHtml.html`
      <span class="warning">
        ${i18nString(UIStrings.syncDisabled)}
        <${ChromeLink.ChromeLink.ChromeLink.litTagName} .href=${link}>${i18nString(UIStrings.settings)}</${ChromeLink.ChromeLink.ChromeLink.litTagName}>
      </span>`;
  }
  if (!syncInfo.arePreferencesSynced) {
    const link = "chrome://settings/syncSetup/advanced";
    return LitHtml.html`
      <span class="warning">
        ${i18nString(UIStrings.preferencesSyncDisabled)}
        <${ChromeLink.ChromeLink.ChromeLink.litTagName} .href=${link}>${i18nString(UIStrings.settings)}</${ChromeLink.ChromeLink.ChromeLink.litTagName}>
      </span>`;
  }
  return LitHtml.html`
    <div class="account-info">
      <img src="data:image/png;base64, ${syncInfo.accountImage}" alt="Account avatar" />
      <div class="account-email">
        <span>${i18nString(UIStrings.signedIn)}</span>
        <span>${syncInfo.accountEmail}</span>
      </div>
    </div>`;
}
ComponentHelpers.CustomElements.defineComponent("devtools-sync-section", SyncSection);
//# sourceMappingURL=SyncSection.js.map
