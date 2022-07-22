import * as i18n from "../../core/i18n/i18n.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Adorners from "../../ui/components/adorners/adorners.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  hiddenIssues: "Hidden issues",
  unhideAll: "Unhide all"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/HiddenIssuesRow.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class HiddenIssuesRow extends UI.TreeOutline.TreeElement {
  #numHiddenAggregatedIssues;
  constructor() {
    super(void 0, true);
    this.#numHiddenAggregatedIssues = document.createElement("span");
    this.toggleOnClick = true;
    this.listItemElement.classList.add("issue-category", "hidden-issues");
    this.childrenListElement.classList.add("hidden-issues-body");
    this.#appendHeader();
  }
  #appendHeader() {
    const unhideAllIssuesBtn = UI.UIUtils.createTextButton(i18nString(UIStrings.unhideAll), () => IssuesManager.IssuesManager.IssuesManager.instance().unhideAllIssues(), "unhide-all-issues-button");
    const countAdorner = new Adorners.Adorner.Adorner();
    countAdorner.data = {
      name: "countWrapper",
      content: this.#numHiddenAggregatedIssues
    };
    countAdorner.classList.add("aggregated-issues-count");
    this.#numHiddenAggregatedIssues.textContent = "0";
    const header = document.createElement("div");
    const title = document.createElement("div");
    header.classList.add("header");
    title.classList.add("title");
    title.textContent = i18nString(UIStrings.hiddenIssues);
    header.appendChild(countAdorner);
    header.appendChild(title);
    header.appendChild(unhideAllIssuesBtn);
    this.listItemElement.appendChild(header);
  }
  update(count) {
    this.#numHiddenAggregatedIssues.textContent = `${count}`;
  }
}
//# sourceMappingURL=HiddenIssuesRow.js.map
