import * as i18n from "../../../core/i18n/i18n.js";
import * as Common from "../../../core/common/common.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import * as IssuesManager from "../../../models/issues_manager/issues_manager.js";
import * as Coordinator from "../../../ui/components/render_coordinator/render_coordinator.js";
import IssueLinkIconStyles from "./issueLinkIcon.css.js";
import { getIssueKindIconData } from "./IssueCounter.js";
const UIStrings = {
  clickToShowIssue: "Click to show issue in the issues tab",
  clickToShowIssueWithTitle: "Click to open the issue tab and show issue: {title}",
  issueUnavailable: "Issue unavailable at this time"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/issue_counter/IssueLinkIcon.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export const extractShortPath = (path) => {
  return (/[^/]+$/.exec(path) || /[^/]+\/$/.exec(path) || [""])[0];
};
const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();
export class IssueLinkIcon extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-issue-link-icon`;
  #shadow = this.attachShadow({ mode: "open" });
  #issue;
  #issueTitle = null;
  #issueTitlePromise = Promise.resolve(void 0);
  #issueId;
  #issueResolver;
  #additionalOnClickAction;
  #reveal = Common.Revealer.reveal;
  #issueResolvedPromise = Promise.resolve(void 0);
  set data(data) {
    this.#issue = data.issue;
    this.#issueId = data.issueId;
    if (!this.#issue && !this.#issueId) {
      throw new Error("Either `issue` or `issueId` must be provided");
    }
    this.#issueResolver = data.issueResolver;
    this.#additionalOnClickAction = data.additionalOnClickAction;
    if (data.revealOverride) {
      this.#reveal = data.revealOverride;
    }
    if (!this.#issue && this.#issueId) {
      this.#issueResolvedPromise = this.#resolveIssue(this.#issueId);
      this.#issueTitlePromise = this.#issueResolvedPromise.then(() => this.#fetchIssueTitle());
    } else {
      this.#issueTitlePromise = this.#fetchIssueTitle();
    }
    void this.#render();
  }
  async #fetchIssueTitle() {
    const description = this.#issue?.getDescription();
    if (!description) {
      return;
    }
    const title = await IssuesManager.MarkdownIssueDescription.getIssueTitleFromMarkdownDescription(description);
    if (title) {
      this.#issueTitle = title;
    }
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [IssueLinkIconStyles];
  }
  #resolveIssue(issueId) {
    if (!this.#issueResolver) {
      throw new Error("An `IssueResolver` must be provided if an `issueId` is provided.");
    }
    return this.#issueResolver.waitFor(issueId).then((issue) => {
      this.#issue = issue;
    }).catch(() => {
      this.#issue = null;
    });
  }
  get data() {
    return {
      issue: this.#issue,
      issueId: this.#issueId,
      issueResolver: this.#issueResolver,
      additionalOnClickAction: this.#additionalOnClickAction,
      revealOverride: this.#reveal !== Common.Revealer.reveal ? this.#reveal : void 0
    };
  }
  iconData() {
    if (this.#issue) {
      return getIssueKindIconData(this.#issue.getKind());
    }
    return { iconName: "issue-questionmark-icon", color: "var(--color-text-secondary)", width: "16px", height: "16px" };
  }
  handleClick(event) {
    if (event.button !== 0) {
      return;
    }
    if (this.#issue) {
      void this.#reveal(this.#issue);
    }
    this.#additionalOnClickAction?.();
  }
  #getTooltip() {
    if (this.#issueTitle) {
      return i18nString(UIStrings.clickToShowIssueWithTitle, { title: this.#issueTitle });
    }
    if (this.#issue) {
      return i18nString(UIStrings.clickToShowIssue);
    }
    return i18nString(UIStrings.issueUnavailable);
  }
  #render() {
    return coordinator.write(() => {
      LitHtml.render(LitHtml.html`
        ${LitHtml.Directives.until(this.#issueTitlePromise.then(() => this.#renderComponent()), this.#issueResolvedPromise.then(() => this.#renderComponent()), this.#renderComponent())}
      `, this.#shadow, { host: this });
    });
  }
  #renderComponent() {
    return LitHtml.html`
      <span class=${LitHtml.Directives.classMap({ "link": Boolean(this.#issue) })}
            tabindex="0"
            @click=${this.handleClick}>
        <${IconButton.Icon.Icon.litTagName} .data=${this.iconData()}
          title=${this.#getTooltip()}></${IconButton.Icon.Icon.litTagName}>
      </span>`;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-issue-link-icon", IssueLinkIcon);
//# sourceMappingURL=IssueLinkIcon.js.map
