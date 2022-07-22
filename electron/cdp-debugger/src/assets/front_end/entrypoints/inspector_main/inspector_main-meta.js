import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  rendering: "Rendering",
  showRendering: "Show Rendering",
  paint: "paint",
  layout: "layout",
  fps: "fps",
  cssMediaType: "CSS media type",
  cssMediaFeature: "CSS media feature",
  visionDeficiency: "vision deficiency",
  colorVisionDeficiency: "color vision deficiency",
  reloadPage: "Reload page",
  hardReloadPage: "Hard reload page",
  forceAdBlocking: "Force ad blocking on this site",
  blockAds: "Block ads on this site",
  showAds: "Show ads on this site, if allowed",
  autoOpenDevTools: "Auto-open DevTools for popups",
  doNotAutoOpen: "Do not auto-open DevTools for popups",
  disablePaused: "Disable paused state overlay",
  toggleCssPrefersColorSchemeMedia: "Toggle forces CSS prefers-color-scheme color"
};
const str_ = i18n.i18n.registerUIStrings("entrypoints/inspector_main/inspector_main-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedInspectorMainModule;
async function loadInspectorMainModule() {
  if (!loadedInspectorMainModule) {
    loadedInspectorMainModule = await import("./inspector_main.js");
  }
  return loadedInspectorMainModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "rendering",
  title: i18nLazyString(UIStrings.rendering),
  commandPrompt: i18nLazyString(UIStrings.showRendering),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 50,
  async loadView() {
    const InspectorMain = await loadInspectorMainModule();
    return InspectorMain.RenderingOptions.RenderingOptionsView.instance();
  },
  tags: [
    i18nLazyString(UIStrings.paint),
    i18nLazyString(UIStrings.layout),
    i18nLazyString(UIStrings.fps),
    i18nLazyString(UIStrings.cssMediaType),
    i18nLazyString(UIStrings.cssMediaFeature),
    i18nLazyString(UIStrings.visionDeficiency),
    i18nLazyString(UIStrings.colorVisionDeficiency)
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.NAVIGATION,
  actionId: "inspector_main.reload",
  async loadActionDelegate() {
    const InspectorMain = await loadInspectorMainModule();
    return InspectorMain.InspectorMain.ReloadActionDelegate.instance();
  },
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_REFRESH,
  title: i18nLazyString(UIStrings.reloadPage),
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+R"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "F5"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+R"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.NAVIGATION,
  actionId: "inspector_main.hard-reload",
  async loadActionDelegate() {
    const InspectorMain = await loadInspectorMainModule();
    return InspectorMain.InspectorMain.ReloadActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.hardReloadPage),
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Shift+Ctrl+R"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Shift+F5"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+F5"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+F5"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Shift+Meta+R"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "rendering.toggle-prefers-color-scheme",
  category: UI.ActionRegistration.ActionCategory.RENDERING,
  title: i18nLazyString(UIStrings.toggleCssPrefersColorSchemeMedia),
  async loadActionDelegate() {
    const InspectorMain = await loadInspectorMainModule();
    return InspectorMain.RenderingOptions.ReloadActionDelegate.instance();
  }
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  title: i18nLazyString(UIStrings.forceAdBlocking),
  settingName: "network.adBlockingEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  storageType: Common.Settings.SettingStorageType.Session,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.blockAds)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.showAds)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.GLOBAL,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.autoOpenDevTools),
  settingName: "autoAttachToCreatedPages",
  settingType: Common.Settings.SettingType.BOOLEAN,
  order: 2,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.autoOpenDevTools)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotAutoOpen)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.APPEARANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.disablePaused),
  settingName: "disablePausedStateOverlay",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const InspectorMain = await loadInspectorMainModule();
    return InspectorMain.InspectorMain.NodeIndicator.instance();
  },
  order: 2,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_LEFT,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
//# sourceMappingURL=inspector_main-meta.js.map
