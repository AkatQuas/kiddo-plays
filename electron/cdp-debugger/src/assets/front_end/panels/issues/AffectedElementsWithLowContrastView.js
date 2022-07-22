import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import { AffectedElementsView } from "./AffectedElementsView.js";
export class AffectedElementsWithLowContrastView extends AffectedElementsView {
  #runningUpdatePromise = Promise.resolve();
  update() {
    this.#runningUpdatePromise = this.#runningUpdatePromise.then(this.#doUpdate.bind(this));
  }
  async #doUpdate() {
    this.clear();
    await this.#appendLowContrastElements(this.issue.getLowContrastIssues());
  }
  async #appendLowContrastElement(issue) {
    const row = document.createElement("tr");
    row.classList.add("affected-resource-low-contrast");
    const details = issue.details();
    const target = issue.model()?.target() || null;
    row.appendChild(await this.createElementCell({ nodeName: details.violatingNodeSelector, backendNodeId: details.violatingNodeId, target }, issue.getCategory()));
    this.appendIssueDetailCell(row, String(Platform.NumberUtilities.floor(details.contrastRatio, 2)));
    this.appendIssueDetailCell(row, String(details.thresholdAA));
    this.appendIssueDetailCell(row, String(details.thresholdAAA));
    this.appendIssueDetailCell(row, details.fontSize);
    this.appendIssueDetailCell(row, details.fontWeight);
    this.affectedResources.appendChild(row);
  }
  async #appendLowContrastElements(issues) {
    const header = document.createElement("tr");
    this.appendColumnTitle(header, i18nString(UIStrings.element));
    this.appendColumnTitle(header, i18nString(UIStrings.contrastRatio));
    this.appendColumnTitle(header, i18nString(UIStrings.minimumAA));
    this.appendColumnTitle(header, i18nString(UIStrings.minimumAAA));
    this.appendColumnTitle(header, i18nString(UIStrings.textSize));
    this.appendColumnTitle(header, i18nString(UIStrings.textWeight));
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const lowContrastIssue of issues) {
      count++;
      await this.#appendLowContrastElement(lowContrastIssue);
    }
    this.updateAffectedResourceCount(count);
  }
}
const UIStrings = {
  element: "Element",
  contrastRatio: "Contrast ratio",
  minimumAA: "Minimum AA ratio",
  minimumAAA: "Minimum AAA ratio",
  textSize: "Text size",
  textWeight: "Text weight"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/AffectedElementsWithLowContrastView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
//# sourceMappingURL=AffectedElementsWithLowContrastView.js.map
