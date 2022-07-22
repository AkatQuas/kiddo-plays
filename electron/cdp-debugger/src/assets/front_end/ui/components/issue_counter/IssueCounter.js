import * as Common from "../../../core/common/common.js";
import * as i18n from "../../../core/i18n/i18n.js";
import * as IssuesManager from "../../../models/issues_manager/issues_manager.js";
import * as ComponentHelpers from "../../components/helpers/helpers.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import issueCounterStyles from "./issueCounter.css.js";
const UIStrings = {
  pageErrors: "{issueCount, plural, =1 {# page error} other {# page errors}}",
  breakingChanges: "{issueCount, plural, =1 {# breaking change} other {# breaking changes}}",
  possibleImprovements: "{issueCount, plural, =1 {# possible improvement} other {# possible improvements}}"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/issue_counter/IssueCounter.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export function getIssueKindIconData(issueKind) {
  switch (issueKind) {
    case IssuesManager.Issue.IssueKind.PageError:
      return { iconName: "issue-cross-icon", color: "var(--issue-color-red)", width: "16px", height: "16px" };
    case IssuesManager.Issue.IssueKind.BreakingChange:
      return { iconName: "issue-exclamation-icon", color: "var(--issue-color-yellow)", width: "16px", height: "16px" };
    case IssuesManager.Issue.IssueKind.Improvement:
      return { iconName: "issue-text-icon", color: "var(--issue-color-blue)", width: "16px", height: "16px" };
  }
}
function toIconGroup({ iconName, color, width, height }, sizeOverride) {
  if (sizeOverride) {
    return { iconName, iconColor: color, iconWidth: sizeOverride, iconHeight: sizeOverride };
  }
  return { iconName, iconColor: color, iconWidth: width, iconHeight: height };
}
export var DisplayMode = /* @__PURE__ */ ((DisplayMode2) => {
  DisplayMode2["OmitEmpty"] = "OmitEmpty";
  DisplayMode2["ShowAlways"] = "ShowAlways";
  DisplayMode2["OnlyMostImportant"] = "OnlyMostImportant";
  return DisplayMode2;
})(DisplayMode || {});
const listFormat = new Intl.ListFormat(navigator.language, { type: "unit", style: "short" });
export function getIssueCountsEnumeration(issuesManager, omitEmpty = true) {
  const counts = [
    issuesManager.numberOfIssues(IssuesManager.Issue.IssueKind.PageError),
    issuesManager.numberOfIssues(IssuesManager.Issue.IssueKind.BreakingChange),
    issuesManager.numberOfIssues(IssuesManager.Issue.IssueKind.Improvement)
  ];
  const phrases = [
    i18nString(UIStrings.pageErrors, { issueCount: counts[0] }),
    i18nString(UIStrings.breakingChanges, { issueCount: counts[1] }),
    i18nString(UIStrings.possibleImprovements, { issueCount: counts[2] })
  ];
  return listFormat.format(phrases.filter((_, i) => omitEmpty ? counts[i] > 0 : true));
}
export class IssueCounter extends HTMLElement {
  static litTagName = LitHtml.literal`issue-counter`;
  #shadow = this.attachShadow({ mode: "open" });
  #clickHandler = void 0;
  #tooltipCallback = void 0;
  #leadingText = "";
  #throttler;
  #counts = [0, 0, 0];
  #displayMode = "OmitEmpty" /* OmitEmpty */;
  #issuesManager = void 0;
  #accessibleName = void 0;
  #throttlerTimeout;
  #compact = false;
  scheduleUpdate() {
    if (this.#throttler) {
      void this.#throttler.schedule(async () => this.#render());
    } else {
      this.#render();
    }
  }
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [issueCounterStyles];
  }
  set data(data) {
    this.#clickHandler = data.clickHandler;
    this.#leadingText = data.leadingText ?? "";
    this.#tooltipCallback = data.tooltipCallback;
    this.#displayMode = data.displayMode ?? "OmitEmpty" /* OmitEmpty */;
    this.#accessibleName = data.accessibleName;
    this.#throttlerTimeout = data.throttlerTimeout;
    this.#compact = Boolean(data.compact);
    if (this.#issuesManager !== data.issuesManager) {
      this.#issuesManager?.removeEventListener(IssuesManager.IssuesManager.Events.IssuesCountUpdated, this.scheduleUpdate, this);
      this.#issuesManager = data.issuesManager;
      this.#issuesManager.addEventListener(IssuesManager.IssuesManager.Events.IssuesCountUpdated, this.scheduleUpdate, this);
    }
    if (data.throttlerTimeout !== 0) {
      this.#throttler = new Common.Throttler.Throttler(data.throttlerTimeout ?? 100);
    } else {
      this.#throttler = void 0;
    }
    this.scheduleUpdate();
  }
  get data() {
    return {
      clickHandler: this.#clickHandler,
      leadingText: this.#leadingText,
      tooltipCallback: this.#tooltipCallback,
      displayMode: this.#displayMode,
      accessibleName: this.#accessibleName,
      throttlerTimeout: this.#throttlerTimeout,
      compact: this.#compact,
      issuesManager: this.#issuesManager
    };
  }
  #render() {
    if (!this.#issuesManager) {
      return;
    }
    this.#counts = [
      this.#issuesManager.numberOfIssues(IssuesManager.Issue.IssueKind.PageError),
      this.#issuesManager.numberOfIssues(IssuesManager.Issue.IssueKind.BreakingChange),
      this.#issuesManager.numberOfIssues(IssuesManager.Issue.IssueKind.Improvement)
    ];
    const importance = [
      IssuesManager.Issue.IssueKind.PageError,
      IssuesManager.Issue.IssueKind.BreakingChange,
      IssuesManager.Issue.IssueKind.Improvement
    ];
    const mostImportant = importance[this.#counts.findIndex((x) => x > 0) ?? 2];
    const countToString = (kind, count) => {
      switch (this.#displayMode) {
        case "OmitEmpty" /* OmitEmpty */:
          return count > 0 ? `${count}` : void 0;
        case "ShowAlways" /* ShowAlways */:
          return `${count}`;
        case "OnlyMostImportant" /* OnlyMostImportant */:
          return kind === mostImportant ? `${count}` : void 0;
      }
    };
    const iconSize = "2ex";
    const data = {
      groups: [
        {
          ...toIconGroup(getIssueKindIconData(IssuesManager.Issue.IssueKind.PageError), iconSize),
          text: countToString(IssuesManager.Issue.IssueKind.PageError, this.#counts[0])
        },
        {
          ...toIconGroup(getIssueKindIconData(IssuesManager.Issue.IssueKind.BreakingChange), iconSize),
          text: countToString(IssuesManager.Issue.IssueKind.BreakingChange, this.#counts[1])
        },
        {
          ...toIconGroup(getIssueKindIconData(IssuesManager.Issue.IssueKind.Improvement), iconSize),
          text: countToString(IssuesManager.Issue.IssueKind.Improvement, this.#counts[2])
        }
      ],
      clickHandler: this.#clickHandler,
      leadingText: this.#leadingText,
      accessibleName: this.#accessibleName,
      compact: this.#compact
    };
    LitHtml.render(LitHtml.html`
        <icon-button .data=${data} .accessibleName=${this.#accessibleName}></icon-button>
        `, this.#shadow, { host: this });
    this.#tooltipCallback?.();
  }
}
ComponentHelpers.CustomElements.defineComponent("issue-counter", IssueCounter);
//# sourceMappingURL=IssueCounter.js.map
