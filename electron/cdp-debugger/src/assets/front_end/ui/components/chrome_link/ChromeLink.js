import * as SDK from "../../../core/sdk/sdk.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import chromeLinkStyles from "./chromeLink.css.js";
export class ChromeLink extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-chrome-link`;
  #shadow = this.attachShadow({ mode: "open" });
  #boundRender = this.#render.bind(this);
  #href = "";
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [chromeLinkStyles];
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }
  set href(href) {
    if (!href.startsWith("chrome://")) {
      throw new Error("ChromeLink href needs to start with 'chrome://'");
    }
    this.#href = href;
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }
  openSettingsTab(event) {
    if (event.type === "click" || event.type === "keydown" && self.isEnterOrSpaceKey(event)) {
      const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
      mainTarget && mainTarget.targetAgent().invoke_createTarget({ url: this.#href });
      event.consume(true);
    }
  }
  #render() {
    LitHtml.render(LitHtml.html`
        <a href=${this.#href} class="link" target="_blank"
          @click=${this.openSettingsTab}
          @keydown=${this.openSettingsTab}><slot></slot></a>
      `, this.#shadow, { host: this });
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-chrome-link", ChromeLink);
//# sourceMappingURL=ChromeLink.js.map
