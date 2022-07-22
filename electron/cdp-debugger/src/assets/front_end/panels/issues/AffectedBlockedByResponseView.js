import * as i18n from "../../core/i18n/i18n.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Host from "../../core/host/host.js";
import { AffectedResourcesView, AffectedItem } from "./AffectedResourcesView.js";
const UIStrings = {
  nRequests: "{n, plural, =1 {# request} other {# requests}}",
  requestC: "Request",
  parentFrame: "Parent Frame",
  blockedResource: "Blocked Resource"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/AffectedBlockedByResponseView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class AffectedBlockedByResponseView extends AffectedResourcesView {
  #appendDetails(details) {
    const header = document.createElement("tr");
    this.appendColumnTitle(header, i18nString(UIStrings.requestC));
    this.appendColumnTitle(header, i18nString(UIStrings.parentFrame));
    this.appendColumnTitle(header, i18nString(UIStrings.blockedResource));
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const detail of details) {
      this.#appendDetail(detail);
      count++;
    }
    this.updateAffectedResourceCount(count);
  }
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nRequests, { n: count });
  }
  #appendDetail(details) {
    const element = document.createElement("tr");
    element.classList.add("affected-resource-row");
    const requestCell = this.createRequestCell(details.request, {
      additionalOnClickAction() {
        Host.userMetrics.issuesPanelResourceOpened(IssuesManager.Issue.IssueCategory.CrossOriginEmbedderPolicy, AffectedItem.Request);
      }
    });
    element.appendChild(requestCell);
    if (details.parentFrame) {
      const frameUrl = this.createFrameCell(details.parentFrame.frameId, this.issue.getCategory());
      element.appendChild(frameUrl);
    } else {
      element.appendChild(document.createElement("td"));
    }
    if (details.blockedFrame) {
      const frameUrl = this.createFrameCell(details.blockedFrame.frameId, this.issue.getCategory());
      element.appendChild(frameUrl);
    } else {
      element.appendChild(document.createElement("td"));
    }
    this.affectedResources.appendChild(element);
  }
  update() {
    this.clear();
    this.#appendDetails(this.issue.getBlockedByResponseDetails());
  }
}
//# sourceMappingURL=AffectedBlockedByResponseView.js.map
