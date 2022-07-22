import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  issues: "Issues",
  showIssues: "Show Issues",
  cspViolations: "CSP Violations",
  showCspViolations: "Show CSP Violations"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/issues-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedIssuesModule;
async function loadIssuesModule() {
  if (!loadedIssuesModule) {
    loadedIssuesModule = await import("./issues.js");
  }
  return loadedIssuesModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "issues-pane",
  title: i18nLazyString(UIStrings.issues),
  commandPrompt: i18nLazyString(UIStrings.showIssues),
  order: 100,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const Issues = await loadIssuesModule();
    return Issues.IssuesPane.IssuesPane.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "csp-violations-pane",
  title: i18nLazyString(UIStrings.cspViolations),
  commandPrompt: i18nLazyString(UIStrings.showCspViolations),
  order: 100,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const Issues = await loadIssuesModule();
    return Issues.CSPViolationsView.CSPViolationsView.instance();
  },
  experiment: Root.Runtime.ExperimentName.CSP_VIOLATIONS_VIEW
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      IssuesManager.Issue.Issue
    ];
  },
  destination: Common.Revealer.RevealerDestination.ISSUES_VIEW,
  async loadRevealer() {
    const Issues = await loadIssuesModule();
    return Issues.IssueRevealer.IssueRevealer.instance();
  }
});
//# sourceMappingURL=issues-meta.js.map
