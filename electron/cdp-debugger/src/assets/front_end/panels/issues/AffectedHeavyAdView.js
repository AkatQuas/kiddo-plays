import * as i18n from "../../core/i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { AffectedResourcesView } from "./AffectedResourcesView.js";
const UIStrings = {
  nResources: "{n, plural, =1 {# resource} other {# resources}}",
  limitExceeded: "Limit exceeded",
  resolutionStatus: "Resolution Status",
  frameUrl: "Frame URL",
  removed: "Removed",
  warned: "Warned",
  cpuPeakLimit: "CPU peak limit",
  cpuTotalLimit: "CPU total limit",
  networkLimit: "Network limit"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/AffectedHeavyAdView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class AffectedHeavyAdView extends AffectedResourcesView {
  #appendAffectedHeavyAds(heavyAds) {
    const header = document.createElement("tr");
    this.appendColumnTitle(header, i18nString(UIStrings.limitExceeded));
    this.appendColumnTitle(header, i18nString(UIStrings.resolutionStatus));
    this.appendColumnTitle(header, i18nString(UIStrings.frameUrl));
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const heavyAd of heavyAds) {
      this.#appendAffectedHeavyAd(heavyAd.details());
      count++;
    }
    this.updateAffectedResourceCount(count);
  }
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nResources, { n: count });
  }
  #statusToString(status) {
    switch (status) {
      case Protocol.Audits.HeavyAdResolutionStatus.HeavyAdBlocked:
        return i18nString(UIStrings.removed);
      case Protocol.Audits.HeavyAdResolutionStatus.HeavyAdWarning:
        return i18nString(UIStrings.warned);
    }
    return "";
  }
  #limitToString(status) {
    switch (status) {
      case Protocol.Audits.HeavyAdReason.CpuPeakLimit:
        return i18nString(UIStrings.cpuPeakLimit);
      case Protocol.Audits.HeavyAdReason.CpuTotalLimit:
        return i18nString(UIStrings.cpuTotalLimit);
      case Protocol.Audits.HeavyAdReason.NetworkTotalLimit:
        return i18nString(UIStrings.networkLimit);
    }
    return "";
  }
  #appendAffectedHeavyAd(heavyAd) {
    const element = document.createElement("tr");
    element.classList.add("affected-resource-heavy-ad");
    const reason = document.createElement("td");
    reason.classList.add("affected-resource-heavy-ad-info");
    reason.textContent = this.#limitToString(heavyAd.reason);
    element.appendChild(reason);
    const status = document.createElement("td");
    status.classList.add("affected-resource-heavy-ad-info");
    status.textContent = this.#statusToString(heavyAd.resolution);
    element.appendChild(status);
    const frameId = heavyAd.frame.frameId;
    const frameUrl = this.createFrameCell(frameId, this.issue.getCategory());
    element.appendChild(frameUrl);
    this.affectedResources.appendChild(element);
  }
  update() {
    this.clear();
    this.#appendAffectedHeavyAds(this.issue.getHeavyAdIssues());
  }
}
//# sourceMappingURL=AffectedHeavyAdView.js.map
