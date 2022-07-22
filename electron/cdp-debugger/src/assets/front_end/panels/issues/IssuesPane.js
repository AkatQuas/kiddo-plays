import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as IssueCounter from "../../ui/components/issue_counter/issue_counter.js";
import * as UI from "../../ui/legacy/legacy.js";
import { HiddenIssuesRow } from "./HiddenIssuesRow.js";
import issuesPaneStyles from "./issuesPane.css.js";
import issuesTreeStyles from "./issuesTree.css.js";
import { Events as IssueAggregatorEvents, IssueAggregator } from "./IssueAggregator.js";
import { IssueView } from "./IssueView.js";
import { IssueKindView, getGroupIssuesByKindSetting, issueKindViewSortPriority } from "./IssueKindView.js";
const UIStrings = {
  crossOriginEmbedderPolicy: "Cross Origin Embedder Policy",
  mixedContent: "Mixed Content",
  samesiteCookie: "SameSite Cookie",
  heavyAds: "Heavy Ads",
  contentSecurityPolicy: "Content Security Policy",
  trustedWebActivity: "Trusted Web Activity",
  other: "Other",
  lowTextContrast: "Low Text Contrast",
  cors: "Cross Origin Resource Sharing",
  groupDisplayedIssuesUnder: "Group displayed issues under associated categories",
  groupByCategory: "Group by category",
  groupDisplayedIssuesUnderKind: "Group displayed issues as Page errors, Breaking changes and Improvements",
  groupByKind: "Group by kind",
  includeCookieIssuesCausedBy: "Include cookie Issues caused by third-party sites",
  includeThirdpartyCookieIssues: "Include third-party cookie issues",
  onlyThirdpartyCookieIssues: "Only third-party cookie issues detected so far",
  noIssuesDetectedSoFar: "No issues detected so far",
  attributionReporting: "Attribution Reporting `API`",
  quirksMode: "Quirks Mode",
  generic: "Generic"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/IssuesPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
class IssueCategoryView extends UI.TreeOutline.TreeElement {
  #category;
  constructor(category) {
    super();
    this.#category = category;
    this.toggleOnClick = true;
    this.listItemElement.classList.add("issue-category");
    this.childrenListElement.classList.add("issue-category-body");
  }
  getCategoryName() {
    switch (this.#category) {
      case IssuesManager.Issue.IssueCategory.CrossOriginEmbedderPolicy:
        return i18nString(UIStrings.crossOriginEmbedderPolicy);
      case IssuesManager.Issue.IssueCategory.MixedContent:
        return i18nString(UIStrings.mixedContent);
      case IssuesManager.Issue.IssueCategory.Cookie:
        return i18nString(UIStrings.samesiteCookie);
      case IssuesManager.Issue.IssueCategory.HeavyAd:
        return i18nString(UIStrings.heavyAds);
      case IssuesManager.Issue.IssueCategory.ContentSecurityPolicy:
        return i18nString(UIStrings.contentSecurityPolicy);
      case IssuesManager.Issue.IssueCategory.TrustedWebActivity:
        return i18nString(UIStrings.trustedWebActivity);
      case IssuesManager.Issue.IssueCategory.LowTextContrast:
        return i18nString(UIStrings.lowTextContrast);
      case IssuesManager.Issue.IssueCategory.Cors:
        return i18nString(UIStrings.cors);
      case IssuesManager.Issue.IssueCategory.AttributionReporting:
        return i18nString(UIStrings.attributionReporting);
      case IssuesManager.Issue.IssueCategory.QuirksMode:
        return i18nString(UIStrings.quirksMode);
      case IssuesManager.Issue.IssueCategory.Generic:
        return i18nString(UIStrings.generic);
      case IssuesManager.Issue.IssueCategory.Other:
        return i18nString(UIStrings.other);
    }
  }
  onattach() {
    this.#appendHeader();
  }
  #appendHeader() {
    const header = document.createElement("div");
    header.classList.add("header");
    const title = document.createElement("div");
    title.classList.add("title");
    title.textContent = this.getCategoryName();
    header.appendChild(title);
    this.listItemElement.appendChild(header);
  }
}
export function getGroupIssuesByCategorySetting() {
  return Common.Settings.Settings.instance().createSetting("groupIssuesByCategory", false);
}
let issuesPaneInstance;
export class IssuesPane extends UI.Widget.VBox {
  #categoryViews;
  #issueViews;
  #kindViews;
  #showThirdPartyCheckbox;
  #issuesTree;
  #hiddenIssuesRow;
  #noIssuesMessageDiv;
  #issuesManager;
  #aggregator;
  #issueViewUpdatePromise = Promise.resolve();
  constructor() {
    super(true);
    this.contentElement.classList.add("issues-pane");
    this.#categoryViews = /* @__PURE__ */ new Map();
    this.#kindViews = /* @__PURE__ */ new Map();
    this.#issueViews = /* @__PURE__ */ new Map();
    this.#showThirdPartyCheckbox = null;
    this.#createToolbars();
    this.#issuesTree = new UI.TreeOutline.TreeOutlineInShadow();
    this.#issuesTree.setShowSelectionOnKeyboardFocus(true);
    this.#issuesTree.contentElement.classList.add("issues");
    this.contentElement.appendChild(this.#issuesTree.element);
    this.#hiddenIssuesRow = new HiddenIssuesRow();
    this.#issuesTree.appendChild(this.#hiddenIssuesRow);
    this.#noIssuesMessageDiv = document.createElement("div");
    this.#noIssuesMessageDiv.classList.add("issues-pane-no-issues");
    this.contentElement.appendChild(this.#noIssuesMessageDiv);
    this.#issuesManager = IssuesManager.IssuesManager.IssuesManager.instance();
    this.#aggregator = new IssueAggregator(this.#issuesManager);
    this.#aggregator.addEventListener(IssueAggregatorEvents.AggregatedIssueUpdated, this.#issueUpdated, this);
    this.#aggregator.addEventListener(IssueAggregatorEvents.FullUpdateRequired, this.#onFullUpdate, this);
    this.#hiddenIssuesRow.hidden = this.#issuesManager.numberOfHiddenIssues() === 0;
    this.#onFullUpdate();
    this.#issuesManager.addEventListener(IssuesManager.IssuesManager.Events.IssuesCountUpdated, this.#updateCounts, this);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!issuesPaneInstance || forceNew) {
      issuesPaneInstance = new IssuesPane();
    }
    return issuesPaneInstance;
  }
  elementsToRestoreScrollPositionsFor() {
    return [this.#issuesTree.element];
  }
  #createToolbars() {
    const toolbarContainer = this.contentElement.createChild("div", "issues-toolbar-container");
    new UI.Toolbar.Toolbar("issues-toolbar-left", toolbarContainer);
    const rightToolbar = new UI.Toolbar.Toolbar("issues-toolbar-right", toolbarContainer);
    const groupByCategorySetting = getGroupIssuesByCategorySetting();
    const groupByCategoryCheckbox = new UI.Toolbar.ToolbarSettingCheckbox(groupByCategorySetting, i18nString(UIStrings.groupDisplayedIssuesUnder), i18nString(UIStrings.groupByCategory));
    groupByCategoryCheckbox.setVisible(false);
    rightToolbar.appendToolbarItem(groupByCategoryCheckbox);
    groupByCategorySetting.addChangeListener(() => {
      this.#fullUpdate(true);
    });
    const groupByKindSetting = getGroupIssuesByKindSetting();
    const groupByKindSettingCheckbox = new UI.Toolbar.ToolbarSettingCheckbox(groupByKindSetting, i18nString(UIStrings.groupDisplayedIssuesUnderKind), i18nString(UIStrings.groupByKind));
    rightToolbar.appendToolbarItem(groupByKindSettingCheckbox);
    groupByKindSetting.addChangeListener(() => {
      this.#fullUpdate(true);
    });
    groupByKindSettingCheckbox.setVisible(Root.Runtime.experiments.isEnabled("groupAndHideIssuesByKind"));
    const thirdPartySetting = IssuesManager.Issue.getShowThirdPartyIssuesSetting();
    this.#showThirdPartyCheckbox = new UI.Toolbar.ToolbarSettingCheckbox(thirdPartySetting, i18nString(UIStrings.includeCookieIssuesCausedBy), i18nString(UIStrings.includeThirdpartyCookieIssues));
    rightToolbar.appendToolbarItem(this.#showThirdPartyCheckbox);
    this.setDefaultFocusedElement(this.#showThirdPartyCheckbox.inputElement);
    rightToolbar.appendSeparator();
    const issueCounter = new IssueCounter.IssueCounter.IssueCounter();
    issueCounter.data = {
      tooltipCallback: () => {
        const issueEnumeration = IssueCounter.IssueCounter.getIssueCountsEnumeration(IssuesManager.IssuesManager.IssuesManager.instance(), false);
        issueCounter.title = issueEnumeration;
      },
      displayMode: IssueCounter.IssueCounter.DisplayMode.ShowAlways,
      issuesManager: IssuesManager.IssuesManager.IssuesManager.instance()
    };
    issueCounter.id = "console-issues-counter";
    const issuesToolbarItem = new UI.Toolbar.ToolbarItem(issueCounter);
    rightToolbar.appendToolbarItem(issuesToolbarItem);
    return { toolbarContainer };
  }
  #issueUpdated(event) {
    this.#scheduleIssueViewUpdate(event.data);
  }
  #scheduleIssueViewUpdate(issue) {
    this.#issueViewUpdatePromise = this.#issueViewUpdatePromise.then(() => this.#updateIssueView(issue));
  }
  async #updateIssueView(issue) {
    let issueView = this.#issueViews.get(issue.aggregationKey());
    if (!issueView) {
      const description = issue.getDescription();
      if (!description) {
        console.warn("Could not find description for issue code:", issue.code());
        return;
      }
      const markdownDescription = await IssuesManager.MarkdownIssueDescription.createIssueDescriptionFromMarkdown(description);
      issueView = new IssueView(issue, markdownDescription);
      this.#issueViews.set(issue.aggregationKey(), issueView);
      const parent = this.#getIssueViewParent(issue);
      this.appendIssueViewToParent(issueView, parent);
    } else {
      issueView.setIssue(issue);
      const newParent = this.#getIssueViewParent(issue);
      if (issueView.parent !== newParent && !(newParent instanceof UI.TreeOutline.TreeOutline && issueView.parent === newParent.rootElement())) {
        issueView.parent?.removeChild(issueView);
        this.appendIssueViewToParent(issueView, newParent);
      }
    }
    issueView.update();
    this.#updateCounts();
  }
  appendIssueViewToParent(issueView, parent) {
    parent.appendChild(issueView, (a, b) => {
      if (a instanceof HiddenIssuesRow) {
        return 1;
      }
      if (b instanceof HiddenIssuesRow) {
        return -1;
      }
      if (a instanceof IssueView && b instanceof IssueView) {
        return a.getIssueTitle().localeCompare(b.getIssueTitle());
      }
      console.error("The issues tree should only contain IssueView objects as direct children");
      return 0;
    });
  }
  #getIssueViewParent(issue) {
    const groupByKind = Root.Runtime.experiments.isEnabled("groupAndHideIssuesByKind");
    if (issue.isHidden()) {
      return this.#hiddenIssuesRow;
    }
    if (groupByKind && getGroupIssuesByKindSetting().get()) {
      const kind = issue.getKind();
      const view = this.#kindViews.get(kind);
      if (view) {
        return view;
      }
      const newView = new IssueKindView(kind);
      this.#issuesTree.appendChild(newView, (a, b) => {
        if (a instanceof IssueKindView && b instanceof IssueKindView) {
          return issueKindViewSortPriority(a, b);
        }
        return 0;
      });
      this.#kindViews.set(kind, newView);
      return newView;
    }
    if (getGroupIssuesByCategorySetting().get()) {
      const category = issue.getCategory();
      const view = this.#categoryViews.get(category);
      if (view) {
        return view;
      }
      const newView = new IssueCategoryView(category);
      this.#issuesTree.appendChild(newView, (a, b) => {
        if (a instanceof IssueCategoryView && b instanceof IssueCategoryView) {
          return a.getCategoryName().localeCompare(b.getCategoryName());
        }
        return 0;
      });
      this.#categoryViews.set(category, newView);
      return newView;
    }
    return this.#issuesTree;
  }
  #clearViews(views, preservedSet) {
    for (const [key, view] of Array.from(views.entries())) {
      if (preservedSet?.has(key)) {
        continue;
      }
      view.parent && view.parent.removeChild(view);
      views.delete(key);
    }
  }
  #onFullUpdate() {
    this.#fullUpdate(false);
  }
  #fullUpdate(force) {
    this.#clearViews(this.#categoryViews, force ? void 0 : this.#aggregator.aggregatedIssueCategories());
    this.#clearViews(this.#kindViews, force ? void 0 : this.#aggregator.aggregatedIssueKinds());
    this.#clearViews(this.#issueViews, force ? void 0 : this.#aggregator.aggregatedIssueCodes());
    if (this.#aggregator) {
      for (const issue of this.#aggregator.aggregatedIssues()) {
        this.#scheduleIssueViewUpdate(issue);
      }
    }
    this.#updateCounts();
  }
  #updateIssueKindViewsCount() {
    for (const view of this.#kindViews.values()) {
      const count = this.#issuesManager.numberOfIssues(view.getKind());
      view.update(count);
    }
  }
  #updateCounts() {
    const groupByKind = Root.Runtime.experiments.isEnabled("groupAndHideIssuesByKind");
    this.#showIssuesTreeOrNoIssuesDetectedMessage(this.#issuesManager.numberOfIssues(), this.#issuesManager.numberOfHiddenIssues());
    if (groupByKind && getGroupIssuesByKindSetting().get()) {
      this.#updateIssueKindViewsCount();
    }
  }
  #showIssuesTreeOrNoIssuesDetectedMessage(issuesCount, hiddenIssueCount) {
    if (issuesCount > 0 || hiddenIssueCount > 0) {
      this.#hiddenIssuesRow.hidden = hiddenIssueCount === 0;
      this.#hiddenIssuesRow.update(hiddenIssueCount);
      this.#issuesTree.element.hidden = false;
      this.#noIssuesMessageDiv.style.display = "none";
      const firstChild = this.#issuesTree.firstChild();
      if (firstChild) {
        firstChild.select(true);
        this.setDefaultFocusedElement(firstChild.listItemElement);
      }
    } else {
      this.#issuesTree.element.hidden = true;
      if (this.#showThirdPartyCheckbox) {
        this.setDefaultFocusedElement(this.#showThirdPartyCheckbox.inputElement);
      }
      const hasOnlyThirdPartyIssues = this.#issuesManager.numberOfAllStoredIssues() > 0;
      this.#noIssuesMessageDiv.textContent = hasOnlyThirdPartyIssues ? i18nString(UIStrings.onlyThirdpartyCookieIssues) : i18nString(UIStrings.noIssuesDetectedSoFar);
      this.#noIssuesMessageDiv.style.display = "flex";
    }
  }
  async reveal(issue) {
    await this.#issueViewUpdatePromise;
    const key = this.#aggregator.keyForIssue(issue);
    const issueView = this.#issueViews.get(key);
    const groupByKind = Root.Runtime.experiments.isEnabled("groupAndHideIssuesByKind");
    if (issueView) {
      if (issueView.isForHiddenIssue()) {
        this.#hiddenIssuesRow.expand();
        this.#hiddenIssuesRow.reveal();
      }
      if (groupByKind && getGroupIssuesByKindSetting().get() && !issueView.isForHiddenIssue()) {
        const kindView = this.#kindViews.get(issueView.getIssueKind());
        kindView?.expand();
        kindView?.reveal();
      }
      issueView.expand();
      issueView.reveal();
      issueView.select(false, true);
    }
  }
  wasShown() {
    super.wasShown();
    this.#issuesTree.registerCSSFiles([issuesTreeStyles]);
    this.registerCSSFiles([issuesPaneStyles]);
  }
}
//# sourceMappingURL=IssuesPane.js.map
