import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as WorkspaceDiff from "../../models/workspace_diff/workspace_diff.js";
import * as UI from "../../ui/legacy/legacy.js";
let loadedChangesModule;
const UIStrings = {
  changes: "Changes",
  showChanges: "Show Changes"
};
const str_ = i18n.i18n.registerUIStrings("panels/changes/changes-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
async function loadChangesModule() {
  if (!loadedChangesModule) {
    loadedChangesModule = await import("./changes.js");
  }
  return loadedChangesModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "changes.changes",
  title: i18nLazyString(UIStrings.changes),
  commandPrompt: i18nLazyString(UIStrings.showChanges),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const Changes = await loadChangesModule();
    return Changes.ChangesView.ChangesView.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      WorkspaceDiff.WorkspaceDiff.DiffUILocation
    ];
  },
  destination: Common.Revealer.RevealerDestination.CHANGES_DRAWER,
  async loadRevealer() {
    const Changes = await loadChangesModule();
    return Changes.ChangesView.DiffUILocationRevealer.instance();
  }
});
//# sourceMappingURL=changes-meta.js.map
