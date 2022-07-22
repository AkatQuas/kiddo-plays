import * as i18n from "../i18n/i18n.js";
const UIStrings = {
  elementsPanel: "Elements panel",
  stylesSidebar: "styles sidebar",
  changesDrawer: "Changes drawer",
  issuesView: "Issues view",
  networkPanel: "Network panel",
  applicationPanel: "Application panel",
  sourcesPanel: "Sources panel"
};
const str_ = i18n.i18n.registerUIStrings("core/common/Revealer.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class Revealer {
}
export let reveal = async function(revealable, omitFocus) {
  if (!revealable) {
    return Promise.reject(new Error("Can't reveal " + revealable));
  }
  const revealers = await Promise.all(getApplicableRegisteredRevealers(revealable).map((registration) => registration.loadRevealer()));
  return reveal2(revealers);
  function reveal2(revealers2) {
    const promises = [];
    for (let i = 0; i < revealers2.length; ++i) {
      promises.push(revealers2[i].reveal(revealable, omitFocus));
    }
    return Promise.race(promises);
  }
};
export function setRevealForTest(newReveal) {
  reveal = newReveal;
}
export const revealDestination = function(revealable) {
  const extension = revealable ? getApplicableRegisteredRevealers(revealable)[0] : registeredRevealers[0];
  if (!extension) {
    return null;
  }
  return extension.destination?.() || null;
};
const registeredRevealers = [];
export function registerRevealer(registration) {
  registeredRevealers.push(registration);
}
function getApplicableRegisteredRevealers(revealable) {
  return registeredRevealers.filter(isRevealerApplicableToContextTypes);
  function isRevealerApplicableToContextTypes(revealerRegistration) {
    if (!revealerRegistration.contextTypes) {
      return true;
    }
    for (const contextType of revealerRegistration.contextTypes()) {
      if (revealable instanceof contextType) {
        return true;
      }
    }
    return false;
  }
}
export const RevealerDestination = {
  ELEMENTS_PANEL: i18nLazyString(UIStrings.elementsPanel),
  STYLES_SIDEBAR: i18nLazyString(UIStrings.stylesSidebar),
  CHANGES_DRAWER: i18nLazyString(UIStrings.changesDrawer),
  ISSUES_VIEW: i18nLazyString(UIStrings.issuesView),
  NETWORK_PANEL: i18nLazyString(UIStrings.networkPanel),
  APPLICATION_PANEL: i18nLazyString(UIStrings.applicationPanel),
  SOURCES_PANEL: i18nLazyString(UIStrings.sourcesPanel)
};
//# sourceMappingURL=Revealer.js.map
