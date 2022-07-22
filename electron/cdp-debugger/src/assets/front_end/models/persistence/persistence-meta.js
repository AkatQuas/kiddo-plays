import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Workspace from "../workspace/workspace.js";
const UIStrings = {
  workspace: "Workspace",
  showWorkspace: "Show Workspace",
  enableLocalOverrides: "Enable Local Overrides",
  interception: "interception",
  override: "override",
  network: "network",
  rewrite: "rewrite",
  request: "request",
  enableOverrideNetworkRequests: "Enable override network requests",
  disableOverrideNetworkRequests: "Disable override network requests"
};
const str_ = i18n.i18n.registerUIStrings("models/persistence/persistence-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedPersistenceModule;
async function loadPersistenceModule() {
  if (!loadedPersistenceModule) {
    loadedPersistenceModule = await import("./persistence.js");
  }
  return loadedPersistenceModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "workspace",
  title: i18nLazyString(UIStrings.workspace),
  commandPrompt: i18nLazyString(UIStrings.showWorkspace),
  order: 1,
  async loadView() {
    const Persistence = await loadPersistenceModule();
    return Persistence.WorkspaceSettingsTab.WorkspaceSettingsTab.instance();
  }
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.PERSISTENCE,
  title: i18nLazyString(UIStrings.enableLocalOverrides),
  settingName: "persistenceNetworkOverridesEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  tags: [
    i18nLazyString(UIStrings.interception),
    i18nLazyString(UIStrings.override),
    i18nLazyString(UIStrings.network),
    i18nLazyString(UIStrings.rewrite),
    i18nLazyString(UIStrings.request)
  ],
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableOverrideNetworkRequests)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableOverrideNetworkRequests)
    }
  ]
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      Workspace.UISourceCode.UISourceCode,
      SDK.Resource.Resource,
      SDK.NetworkRequest.NetworkRequest
    ];
  },
  async loadProvider() {
    const Persistence = await loadPersistenceModule();
    return Persistence.PersistenceActions.ContextMenuProvider.instance();
  },
  experiment: void 0
});
//# sourceMappingURL=persistence-meta.js.map
