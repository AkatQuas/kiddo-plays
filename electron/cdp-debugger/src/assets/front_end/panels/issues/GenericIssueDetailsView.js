import * as i18n from "../../core/i18n/i18n.js";
import { AffectedResourcesView } from "./AffectedResourcesView.js";
const UIStrings = {
  nResources: "{n, plural, =1 {# resource} other {# resources}}",
  frameId: "Frame"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/GenericIssueDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class GenericIssueDetailsView extends AffectedResourcesView {
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nResources, { n: count });
  }
  #appendDetails(genericIssues) {
    const header = document.createElement("tr");
    const sampleIssueDetails = genericIssues.values().next().value.details();
    if (sampleIssueDetails.frameId) {
      this.appendColumnTitle(header, i18nString(UIStrings.frameId));
    }
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const genericIssue of genericIssues) {
      count++;
      this.#appendDetail(genericIssue);
    }
    this.updateAffectedResourceCount(count);
  }
  #appendDetail(genericIssue) {
    const element = document.createElement("tr");
    element.classList.add("affected-resource-directive");
    const details = genericIssue.details();
    if (details.frameId) {
      element.appendChild(this.createFrameCell(details.frameId, genericIssue.getCategory()));
    }
    this.affectedResources.appendChild(element);
  }
  update() {
    this.clear();
    const issues = this.issue.getGenericIssues();
    if (issues.size > 0) {
      this.#appendDetails(issues);
    } else {
      this.updateAffectedResourceCount(0);
    }
  }
}
//# sourceMappingURL=GenericIssueDetailsView.js.map
