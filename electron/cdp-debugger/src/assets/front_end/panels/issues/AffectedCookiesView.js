import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import { AffectedItem, AffectedResourcesView } from "./AffectedResourcesView.js";
const UIStrings = {
  nCookies: "{n, plural, =1 {# cookie} other {# cookies}}",
  name: "Name",
  domain: "Domain",
  path: "Path",
  nRawCookieLines: "{n, plural, =1 {1 Raw `Set-Cookie` header} other {# Raw `Set-Cookie` headers}}",
  filterSetCookieTitle: "Show network requests that include this `Set-Cookie` header in the network panel"
};
const str_ = i18n.i18n.registerUIStrings("panels/issues/AffectedCookiesView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class AffectedCookiesView extends AffectedResourcesView {
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nCookies, { n: count });
  }
  #appendAffectedCookies(cookies) {
    const header = document.createElement("tr");
    this.appendColumnTitle(header, i18nString(UIStrings.name));
    this.appendColumnTitle(header, i18nString(UIStrings.domain) + " & " + i18nString(UIStrings.path), "affected-resource-cookie-info-header");
    this.affectedResources.appendChild(header);
    let count = 0;
    for (const cookie of cookies) {
      count++;
      this.#appendAffectedCookie(cookie.cookie, cookie.hasRequest);
    }
    this.updateAffectedResourceCount(count);
  }
  #appendAffectedCookie(cookie, hasAssociatedRequest) {
    const element = document.createElement("tr");
    element.classList.add("affected-resource-cookie");
    const name = document.createElement("td");
    if (hasAssociatedRequest) {
      name.appendChild(UI.UIUtils.createTextButton(cookie.name, () => {
        Host.userMetrics.issuesPanelResourceOpened(this.issue.getCategory(), AffectedItem.Cookie);
        void Common.Revealer.reveal(NetworkForward.UIFilter.UIRequestFilter.filters([
          {
            filterType: NetworkForward.UIFilter.FilterType.CookieDomain,
            filterValue: cookie.domain
          },
          {
            filterType: NetworkForward.UIFilter.FilterType.CookieName,
            filterValue: cookie.name
          },
          {
            filterType: NetworkForward.UIFilter.FilterType.CookiePath,
            filterValue: cookie.path
          }
        ]));
      }, "link-style devtools-link"));
    } else {
      name.textContent = cookie.name;
    }
    element.appendChild(name);
    this.appendIssueDetailCell(element, `${cookie.domain}${cookie.path}`, "affected-resource-cookie-info");
    this.affectedResources.appendChild(element);
  }
  update() {
    this.clear();
    this.#appendAffectedCookies(this.issue.cookiesWithRequestIndicator());
  }
}
export class AffectedRawCookieLinesView extends AffectedResourcesView {
  getResourceNameWithCount(count) {
    return i18nString(UIStrings.nRawCookieLines, { n: count });
  }
  update() {
    this.clear();
    const cookieLinesWithRequestIndicator = this.issue.getRawCookieLines();
    let count = 0;
    for (const cookie of cookieLinesWithRequestIndicator) {
      const row = document.createElement("tr");
      row.classList.add("affected-resource-directive");
      if (cookie.hasRequest) {
        const cookieLine = document.createElement("td");
        const textButton = UI.UIUtils.createTextButton(cookie.rawCookieLine, () => {
          void Common.Revealer.reveal(NetworkForward.UIFilter.UIRequestFilter.filters([
            {
              filterType: NetworkForward.UIFilter.FilterType.ResponseHeaderValueSetCookie,
              filterValue: cookie.rawCookieLine
            }
          ]));
        }, "link-style devtools-link");
        textButton.title = i18nString(UIStrings.filterSetCookieTitle);
        cookieLine.appendChild(textButton);
        row.appendChild(cookieLine);
      } else {
        this.appendIssueDetailCell(row, cookie.rawCookieLine);
      }
      this.affectedResources.appendChild(row);
      count++;
    }
    this.updateAffectedResourceCount(count);
  }
}
//# sourceMappingURL=AffectedCookiesView.js.map
