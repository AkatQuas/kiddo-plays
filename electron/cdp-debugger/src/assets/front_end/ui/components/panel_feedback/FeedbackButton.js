import * as Host from "../../../core/host/host.js";
import * as i18n from "../../../core/i18n/i18n.js";
import * as Platform from "../../../core/platform/platform.js";
import * as ComponentHelpers from "../../components/helpers/helpers.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as Buttons from "../buttons/buttons.js";
const UIStrings = {
  feedback: "Feedback"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/panel_feedback/FeedbackButton.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const feedbackIconUrl = new URL("../../../Images/feedback_button_icon.svg", import.meta.url).toString();
export class FeedbackButton extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-feedback-button`;
  #shadow = this.attachShadow({ mode: "open" });
  #boundRender = this.#render.bind(this);
  #props = {
    feedbackUrl: Platform.DevToolsPath.EmptyUrlString
  };
  set data(data) {
    this.#props = data;
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }
  #onFeedbackClick() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(this.#props.feedbackUrl);
  }
  #render() {
    if (!ComponentHelpers.ScheduledRender.isScheduledRender(this)) {
      throw new Error("FeedbackButton render was not scheduled");
    }
    LitHtml.render(LitHtml.html`
      <${Buttons.Button.Button.litTagName}
          @click=${this.#onFeedbackClick}
          .iconUrl=${feedbackIconUrl}
          .variant=${Buttons.Button.Variant.SECONDARY}
      >${i18nString(UIStrings.feedback)}</${Buttons.Button.Button.litTagName}>
      `, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-feedback-button", FeedbackButton);
//# sourceMappingURL=FeedbackButton.js.map
