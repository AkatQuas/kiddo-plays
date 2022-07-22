import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as IconButton from "../../ui/components/icon_button/icon_button.js";
import * as IssueCounter from "../../ui/components/issue_counter/issue_counter.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  sErrors: "{n, plural, =1 {# error} other {# errors}}",
  sWarnings: "{n, plural, =1 {# warning} other {# warnings}}",
  openConsoleToViewS: "Open Console to view {PH1}",
  openIssuesToView: "{n, plural, =1 {Open Issues to view # issue:} other {Open Issues to view # issues:}}"
};
const str_ = i18n.i18n.registerUIStrings("panels/console_counters/WarningErrorCounter.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let warningErrorCounterInstance;
export class WarningErrorCounter {
  toolbarItem;
  consoleCounter;
  issueCounter;
  throttler;
  updatingForTest;
  constructor() {
    WarningErrorCounter.instanceForTest = this;
    const countersWrapper = document.createElement("div");
    this.toolbarItem = new UI.Toolbar.ToolbarItemWithCompactLayout(countersWrapper);
    this.toolbarItem.setVisible(false);
    this.toolbarItem.addEventListener(UI.Toolbar.ToolbarItemWithCompactLayoutEvents.CompactLayoutUpdated, this.onSetCompactLayout, this);
    this.consoleCounter = new IconButton.IconButton.IconButton();
    countersWrapper.appendChild(this.consoleCounter);
    this.consoleCounter.data = {
      clickHandler: Common.Console.Console.instance().show.bind(Common.Console.Console.instance()),
      groups: [{ iconName: "error_icon" }, { iconName: "warning_icon" }]
    };
    const issuesManager = IssuesManager.IssuesManager.IssuesManager.instance();
    this.issueCounter = new IssueCounter.IssueCounter.IssueCounter();
    countersWrapper.appendChild(this.issueCounter);
    this.issueCounter.data = {
      clickHandler: () => {
        Host.userMetrics.issuesPanelOpenedFrom(Host.UserMetrics.IssueOpener.StatusBarIssuesCounter);
        void UI.ViewManager.ViewManager.instance().showView("issues-pane");
      },
      issuesManager,
      displayMode: IssueCounter.IssueCounter.DisplayMode.OnlyMostImportant
    };
    this.throttler = new Common.Throttler.Throttler(100);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.ConsoleCleared, this.update, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.MessageAdded, this.update, this);
    SDK.ConsoleModel.ConsoleModel.instance().addEventListener(SDK.ConsoleModel.Events.MessageUpdated, this.update, this);
    issuesManager.addEventListener(IssuesManager.IssuesManager.Events.IssuesCountUpdated, this.update, this);
    this.update();
  }
  onSetCompactLayout(event) {
    this.setCompactLayout(event.data);
  }
  setCompactLayout(enable) {
    this.consoleCounter.data = { ...this.consoleCounter.data, compact: enable };
    this.issueCounter.data = { ...this.issueCounter.data, compact: enable };
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!warningErrorCounterInstance || forceNew) {
      warningErrorCounterInstance = new WarningErrorCounter();
    }
    return warningErrorCounterInstance;
  }
  updatedForTest() {
  }
  update() {
    this.updatingForTest = true;
    void this.throttler.schedule(this.updateThrottled.bind(this));
  }
  get titlesForTesting() {
    const button = this.consoleCounter.shadowRoot?.querySelector("button");
    return button ? button.getAttribute("aria-label") : null;
  }
  async updateThrottled() {
    const errors = SDK.ConsoleModel.ConsoleModel.instance().errors();
    const warnings = SDK.ConsoleModel.ConsoleModel.instance().warnings();
    const issuesManager = IssuesManager.IssuesManager.IssuesManager.instance();
    const issues = issuesManager.numberOfIssues();
    const countToText = (c) => c === 0 ? void 0 : `${c}`;
    const errorCountTitle = i18nString(UIStrings.sErrors, { n: errors });
    const warningCountTitle = i18nString(UIStrings.sWarnings, { n: warnings });
    const newConsoleTexts = [countToText(errors), countToText(warnings)];
    let consoleSummary = "";
    if (errors && warnings) {
      consoleSummary = `${errorCountTitle}, ${warningCountTitle}`;
    } else if (errors) {
      consoleSummary = errorCountTitle;
    } else if (warnings) {
      consoleSummary = warningCountTitle;
    }
    const consoleTitle = i18nString(UIStrings.openConsoleToViewS, { PH1: consoleSummary });
    const previousData = this.consoleCounter.data;
    this.consoleCounter.data = {
      ...previousData,
      groups: previousData.groups.map((g, i) => ({ ...g, text: newConsoleTexts[i] })),
      accessibleName: consoleTitle
    };
    UI.Tooltip.Tooltip.install(this.consoleCounter, consoleTitle);
    this.consoleCounter.classList.toggle("hidden", !(errors || warnings));
    const issueEnumeration = IssueCounter.IssueCounter.getIssueCountsEnumeration(issuesManager);
    const issuesTitleLead = i18nString(UIStrings.openIssuesToView, { n: issues });
    const issuesTitle = `${issuesTitleLead} ${issueEnumeration}`;
    UI.Tooltip.Tooltip.install(this.issueCounter, issuesTitle);
    this.issueCounter.data = {
      ...this.issueCounter.data,
      accessibleName: issuesTitle
    };
    this.issueCounter.classList.toggle("hidden", !issues);
    this.toolbarItem.setVisible(Boolean(errors || warnings || issues));
    UI.InspectorView.InspectorView.instance().toolbarItemResized();
    this.updatingForTest = false;
    this.updatedForTest();
    return;
  }
  item() {
    return this.toolbarItem;
  }
  static instanceForTest = null;
}
//# sourceMappingURL=WarningErrorCounter.js.map
