import * as Common from "../../../core/common/common.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as i18n from "../../../core/i18n/i18n.js";
import * as ComponentHelpers from "../../components/helpers/helpers.js";
import * as IconButton from "../icon_button/icon_button.js";
import surveyLinkStyles from "./surveyLink.css.js";
const UIStrings = {
  openingSurvey: "Opening survey \u2026",
  thankYouForYourFeedback: "Thank you for your feedback",
  anErrorOccurredWithTheSurvey: "An error occurred with the survey"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/survey_link/SurveyLink.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
var State = /* @__PURE__ */ ((State2) => {
  State2["Checking"] = "Checking";
  State2["ShowLink"] = "ShowLink";
  State2["Sending"] = "Sending";
  State2["SurveyShown"] = "SurveyShown";
  State2["Failed"] = "Failed";
  State2["DontShowLink"] = "DontShowLink";
  return State2;
})(State || {});
export class SurveyLink extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-survey-link`;
  #shadow = this.attachShadow({ mode: "open" });
  #trigger = "";
  #promptText = Common.UIString.LocalizedEmptyString;
  #canShowSurvey = () => {
  };
  #showSurvey = () => {
  };
  #state = "Checking" /* Checking */;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [surveyLinkStyles];
  }
  set data(data) {
    this.#trigger = data.trigger;
    this.#promptText = data.promptText;
    this.#canShowSurvey = data.canShowSurvey;
    this.#showSurvey = data.showSurvey;
    this.#checkSurvey();
  }
  #checkSurvey() {
    this.#state = "Checking" /* Checking */;
    this.#canShowSurvey(this.#trigger, ({ canShowSurvey }) => {
      if (!canShowSurvey) {
        this.#state = "DontShowLink" /* DontShowLink */;
      } else {
        this.#state = "ShowLink" /* ShowLink */;
      }
      this.#render();
    });
  }
  #sendSurvey() {
    this.#state = "Sending" /* Sending */;
    this.#render();
    this.#showSurvey(this.#trigger, ({ surveyShown }) => {
      if (!surveyShown) {
        this.#state = "Failed" /* Failed */;
      } else {
        this.#state = "SurveyShown" /* SurveyShown */;
      }
      this.#render();
    });
  }
  #render() {
    if (this.#state === "Checking" /* Checking */ || this.#state === "DontShowLink" /* DontShowLink */) {
      return;
    }
    let linkText = this.#promptText;
    if (this.#state === "Sending" /* Sending */) {
      linkText = i18nString(UIStrings.openingSurvey);
    } else if (this.#state === "SurveyShown" /* SurveyShown */) {
      linkText = i18nString(UIStrings.thankYouForYourFeedback);
    } else if (this.#state === "Failed" /* Failed */) {
      linkText = i18nString(UIStrings.anErrorOccurredWithTheSurvey);
    }
    let linkState = "";
    if (this.#state === "Sending" /* Sending */) {
      linkState = "pending-link";
    } else if (this.#state === "Failed" /* Failed */ || this.#state === "SurveyShown" /* SurveyShown */) {
      linkState = "disabled-link";
    }
    const ariaDisabled = this.#state !== "ShowLink" /* ShowLink */;
    const output = LitHtml.html`
      <button class="link ${linkState}" tabindex=${ariaDisabled ? "-1" : "0"} .disabled=${ariaDisabled} aria-disabled=${ariaDisabled} @click=${this.#sendSurvey}>
        <${IconButton.Icon.Icon.litTagName} class="link-icon" .data=${{ iconName: "feedback_button_icon", color: "var(--color-link)", width: "var(--issue-link-icon-size, 16px)", height: "var(--issue-link-icon-size, 16px)" }}></${IconButton.Icon.Icon.litTagName}><!--
      -->${linkText}
      </button>
    `;
    LitHtml.render(output, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-survey-link", SurveyLink);
//# sourceMappingURL=SurveyLink.js.map
