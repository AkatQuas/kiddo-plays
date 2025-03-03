import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  focusDebuggee: "Focus debuggee",
  toggleDrawer: "Toggle drawer",
  nextPanel: "Next panel",
  previousPanel: "Previous panel",
  reloadDevtools: "Reload DevTools",
  restoreLastDockPosition: "Restore last dock position",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetZoomLevel: "Reset zoom level",
  searchInPanel: "Search in panel",
  cancelSearch: "Cancel search",
  findNextResult: "Find next result",
  findPreviousResult: "Find previous result",
  theme: "Theme:",
  switchToSystemPreferredColor: "Switch to system preferred color theme",
  systemPreference: "System preference",
  switchToLightTheme: "Switch to light theme",
  lightCapital: "Light",
  switchToDarkTheme: "Switch to dark theme",
  darkCapital: "Dark",
  darkLower: "dark",
  lightLower: "light",
  panelLayout: "Panel layout:",
  useHorizontalPanelLayout: "Use horizontal panel layout",
  horizontal: "horizontal",
  useVerticalPanelLayout: "Use vertical panel layout",
  vertical: "vertical",
  useAutomaticPanelLayout: "Use automatic panel layout",
  auto: "auto",
  colorFormat: "Color format:",
  setColorFormatAsAuthored: "Set color format as authored",
  asAuthored: "As authored",
  setColorFormatToHex: "Set color format to HEX",
  setColorFormatToRgb: "Set color format to RGB",
  setColorFormatToHsl: "Set color format to HSL",
  enableCtrlShortcutToSwitchPanels: "Enable Ctrl + 1-9 shortcut to switch panels",
  enableShortcutToSwitchPanels: "Enable \u2318 + 1-9 shortcut to switch panels",
  right: "Right",
  dockToRight: "Dock to right",
  bottom: "Bottom",
  dockToBottom: "Dock to bottom",
  left: "Left",
  dockToLeft: "Dock to left",
  undocked: "Undocked",
  undockIntoSeparateWindow: "Undock into separate window",
  devtoolsDefault: "DevTools (Default)",
  language: "Language:",
  browserLanguage: "Browser UI language",
  enableSync: "Enable settings sync"
};
const str_ = i18n.i18n.registerUIStrings("entrypoints/main/main-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedMainModule;
let loadedInspectorMainModule;
async function loadMainModule() {
  if (!loadedMainModule) {
    loadedMainModule = await import("./main.js");
  }
  return loadedMainModule;
}
async function loadInspectorMainModule() {
  if (!loadedInspectorMainModule) {
    loadedInspectorMainModule = await import("../inspector_main/inspector_main.js");
  }
  return loadedInspectorMainModule;
}
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DRAWER,
  actionId: "inspector_main.focus-debuggee",
  async loadActionDelegate() {
    const InspectorMain = await loadInspectorMainModule();
    return InspectorMain.InspectorMain.FocusDebuggeeActionDelegate.instance();
  },
  order: 100,
  title: i18nLazyString(UIStrings.focusDebuggee)
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DRAWER,
  actionId: "main.toggle-drawer",
  async loadActionDelegate() {
    return UI.InspectorView.ActionDelegate.instance();
  },
  order: 101,
  title: i18nLazyString(UIStrings.toggleDrawer),
  bindings: [
    {
      shortcut: "Esc"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.next-tab",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.nextPanel),
  async loadActionDelegate() {
    return UI.InspectorView.ActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+]"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+]"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.previous-tab",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.previousPanel),
  async loadActionDelegate() {
    return UI.InspectorView.ActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+["
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+["
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.debug-reload",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.reloadDevtools),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.ReloadActionDelegate.instance();
  },
  bindings: [
    {
      shortcut: "Alt+R"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.restoreLastDockPosition),
  actionId: "main.toggle-dock",
  async loadActionDelegate() {
    return UI.DockController.ToggleDockActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+D"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+D"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.zoom-in",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.zoomIn),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.ZoomActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Plus",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+Plus"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+NumpadPlus"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+NumpadPlus"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Plus",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+Plus"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+NumpadPlus"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+NumpadPlus"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.zoom-out",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.zoomOut),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.ZoomActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Minus",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+Minus"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+NumpadMinus"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+NumpadMinus"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Minus",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+Minus"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+NumpadMinus"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+NumpadMinus"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.zoom-reset",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.resetZoomLevel),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.ZoomActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+0"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Numpad0"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Numpad0"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+0"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.search-in-panel.find",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.searchInPanel),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.SearchActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "F3"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.search-in-panel.cancel",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.cancelSearch),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.SearchActionDelegate.instance();
  },
  order: 10,
  bindings: [
    {
      shortcut: "Esc"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.search-in-panel.find-next",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.findNextResult),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.SearchActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+G",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+G"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "F3",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "main.search-in-panel.find-previous",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.findPreviousResult),
  async loadActionDelegate() {
    const Main = await loadMainModule();
    return Main.MainImpl.SearchActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+G",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+G"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Shift+F3",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.APPEARANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.theme),
  settingName: "uiTheme",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "systemPreferred",
  reloadRequired: false,
  options: [
    {
      title: i18nLazyString(UIStrings.switchToSystemPreferredColor),
      text: i18nLazyString(UIStrings.systemPreference),
      value: "systemPreferred"
    },
    {
      title: i18nLazyString(UIStrings.switchToLightTheme),
      text: i18nLazyString(UIStrings.lightCapital),
      value: "default"
    },
    {
      title: i18nLazyString(UIStrings.switchToDarkTheme),
      text: i18nLazyString(UIStrings.darkCapital),
      value: "dark"
    }
  ],
  tags: [
    i18nLazyString(UIStrings.darkLower),
    i18nLazyString(UIStrings.lightLower)
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.APPEARANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.panelLayout),
  settingName: "sidebarPosition",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "auto",
  options: [
    {
      title: i18nLazyString(UIStrings.useHorizontalPanelLayout),
      text: i18nLazyString(UIStrings.horizontal),
      value: "bottom"
    },
    {
      title: i18nLazyString(UIStrings.useVerticalPanelLayout),
      text: i18nLazyString(UIStrings.vertical),
      value: "right"
    },
    {
      title: i18nLazyString(UIStrings.useAutomaticPanelLayout),
      text: i18nLazyString(UIStrings.auto),
      value: "auto"
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.APPEARANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.colorFormat),
  settingName: "colorFormat",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "original",
  options: [
    {
      title: i18nLazyString(UIStrings.setColorFormatAsAuthored),
      text: i18nLazyString(UIStrings.asAuthored),
      value: "original"
    },
    {
      title: i18nLazyString(UIStrings.setColorFormatToHex),
      text: "HEX: #dac0de",
      value: "hex",
      raw: true
    },
    {
      title: i18nLazyString(UIStrings.setColorFormatToRgb),
      text: "RGB: rgb(128 255 255)",
      value: "rgb",
      raw: true
    },
    {
      title: i18nLazyString(UIStrings.setColorFormatToHsl),
      text: "HSL: hsl(300deg 80% 90%)",
      value: "hsl",
      raw: true
    }
  ]
});
function filterLocalesForSettings() {
  return i18n.i18n.getAllSupportedDevToolsLocales().filter((locale) => locale !== "en-XL");
}
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.APPEARANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "language",
  settingType: Common.Settings.SettingType.ENUM,
  title: i18nLazyString(UIStrings.language),
  defaultValue: "en-US",
  options: [
    {
      value: "browserLanguage",
      title: i18nLazyString(UIStrings.browserLanguage),
      text: i18nLazyString(UIStrings.browserLanguage)
    },
    ...filterLocalesForSettings().map((locale) => createOptionForLocale(locale))
  ],
  reloadRequired: true
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.APPEARANCE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.enableCtrlShortcutToSwitchPanels),
  titleMac: i18nLazyString(UIStrings.enableShortcutToSwitchPanels),
  settingName: "shortcutPanelSwitch",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.GLOBAL,
  settingName: "currentDockState",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "right",
  options: [
    {
      value: "right",
      text: i18nLazyString(UIStrings.right),
      title: i18nLazyString(UIStrings.dockToRight)
    },
    {
      value: "bottom",
      text: i18nLazyString(UIStrings.bottom),
      title: i18nLazyString(UIStrings.dockToBottom)
    },
    {
      value: "left",
      text: i18nLazyString(UIStrings.left),
      title: i18nLazyString(UIStrings.dockToLeft)
    },
    {
      value: "undocked",
      text: i18nLazyString(UIStrings.undocked),
      title: i18nLazyString(UIStrings.undockIntoSeparateWindow)
    }
  ]
});
Common.Settings.registerSettingExtension({
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "activeKeybindSet",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "devToolsDefault",
  options: [
    {
      value: "devToolsDefault",
      title: i18nLazyString(UIStrings.devtoolsDefault),
      text: i18nLazyString(UIStrings.devtoolsDefault)
    },
    {
      value: "vsCode",
      title: i18n.i18n.lockedLazyString("Visual Studio Code"),
      text: i18n.i18n.lockedLazyString("Visual Studio Code")
    }
  ]
});
function createLazyLocalizedLocaleSettingText(localeString) {
  return () => i18n.i18n.getLocalizedLanguageRegion(localeString, i18n.DevToolsLocale.DevToolsLocale.instance());
}
function createOptionForLocale(localeString) {
  return {
    value: localeString,
    title: createLazyLocalizedLocaleSettingText(localeString),
    text: createLazyLocalizedLocaleSettingText(localeString)
  };
}
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SYNC,
  settingName: "sync_preferences",
  settingType: Common.Settings.SettingType.BOOLEAN,
  title: i18nLazyString(UIStrings.enableSync),
  defaultValue: false,
  reloadRequired: true,
  experiment: Root.Runtime.ExperimentName.SYNC_SETTINGS
});
Common.Settings.registerSettingExtension({
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "userShortcuts",
  settingType: Common.Settings.SettingType.ARRAY,
  defaultValue: []
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  category: UI.ViewManager.ViewLocationCategoryValues.DRAWER,
  async loadResolver() {
    return UI.InspectorView.InspectorView.instance();
  }
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.DRAWER_SIDEBAR,
  category: UI.ViewManager.ViewLocationCategoryValues.DRAWER_SIDEBAR,
  async loadResolver() {
    return UI.InspectorView.InspectorView.instance();
  }
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.PANEL,
  category: UI.ViewManager.ViewLocationCategoryValues.PANEL,
  async loadResolver() {
    return UI.InspectorView.InspectorView.instance();
  }
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
    return Components.Linkifier.ContentProviderContextMenuProvider.instance();
  },
  experiment: void 0
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      Node
    ];
  },
  async loadProvider() {
    return UI.XLink.ContextMenuProvider.instance();
  },
  experiment: void 0
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      Node
    ];
  },
  async loadProvider() {
    return Components.Linkifier.LinkContextMenuProvider.instance();
  },
  experiment: void 0
});
UI.Toolbar.registerToolbarItem({
  separator: true,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_LEFT,
  order: 100,
  showLabel: void 0,
  actionId: void 0,
  condition: void 0,
  loadItem: void 0
});
UI.Toolbar.registerToolbarItem({
  separator: true,
  order: 97,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_RIGHT,
  showLabel: void 0,
  actionId: void 0,
  condition: void 0,
  loadItem: void 0
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Main = await loadMainModule();
    return Main.MainImpl.SettingsButtonProvider.instance();
  },
  order: 98,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_RIGHT,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Main = await loadMainModule();
    return Main.MainImpl.MainMenuItem.instance();
  },
  order: 99,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_RIGHT,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    return UI.DockController.CloseButtonProvider.instance();
  },
  order: 100,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_RIGHT,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
Common.AppProvider.registerAppProvider({
  async loadAppProvider() {
    const Main = await loadMainModule();
    return Main.SimpleApp.SimpleAppProvider.instance();
  },
  order: 10,
  condition: void 0
});
//# sourceMappingURL=main-meta.js.map
