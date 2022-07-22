import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  application: "Application",
  showApplication: "Show Application",
  pwa: "pwa",
  clearSiteData: "Clear site data",
  clearSiteDataIncludingThirdparty: "Clear site data (including third-party cookies)",
  startRecordingEvents: "Start recording events",
  stopRecordingEvents: "Stop recording events"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/application-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedResourcesModule;
async function loadResourcesModule() {
  if (!loadedResourcesModule) {
    loadedResourcesModule = await import("./application.js");
  }
  return loadedResourcesModule;
}
function maybeRetrieveContextTypes(getClassCallBack) {
  if (loadedResourcesModule === void 0) {
    return [];
  }
  return getClassCallBack(loadedResourcesModule);
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "resources",
  title: i18nLazyString(UIStrings.application),
  commandPrompt: i18nLazyString(UIStrings.showApplication),
  order: 70,
  async loadView() {
    const Resources = await loadResourcesModule();
    return Resources.ResourcesPanel.ResourcesPanel.instance();
  },
  tags: [i18nLazyString(UIStrings.pwa)]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.RESOURCES,
  actionId: "resources.clear",
  title: i18nLazyString(UIStrings.clearSiteData),
  async loadActionDelegate() {
    const Resources = await loadResourcesModule();
    return Resources.StorageView.ActionDelegate.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.RESOURCES,
  actionId: "resources.clear-incl-third-party-cookies",
  title: i18nLazyString(UIStrings.clearSiteDataIncludingThirdparty),
  async loadActionDelegate() {
    const Resources = await loadResourcesModule();
    return Resources.StorageView.ActionDelegate.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "background-service.toggle-recording",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  contextTypes() {
    return maybeRetrieveContextTypes((Resources) => [Resources.BackgroundServiceView.BackgroundServiceView]);
  },
  async loadActionDelegate() {
    const Resources = await loadResourcesModule();
    return Resources.BackgroundServiceView.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.BACKGROUND_SERVICES,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.startRecordingEvents)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.stopRecordingEvents)
    }
  ],
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+E"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+E"
    }
  ]
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.Resource.Resource
    ];
  },
  destination: Common.Revealer.RevealerDestination.APPLICATION_PANEL,
  async loadRevealer() {
    const Resources = await loadResourcesModule();
    return Resources.ResourcesPanel.ResourceRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.ResourceTreeModel.ResourceTreeFrame
    ];
  },
  destination: Common.Revealer.RevealerDestination.APPLICATION_PANEL,
  async loadRevealer() {
    const Resources = await loadResourcesModule();
    return Resources.ResourcesPanel.FrameDetailsRevealer.instance();
  }
});
//# sourceMappingURL=application-meta.js.map
