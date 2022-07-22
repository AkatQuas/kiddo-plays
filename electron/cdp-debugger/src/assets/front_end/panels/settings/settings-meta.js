import "./emulation/emulation-meta.js";
import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  shortcuts: "Shortcuts",
  preferences: "Preferences",
  experiments: "Experiments",
  ignoreList: "Ignore List",
  showShortcuts: "Show Shortcuts",
  showPreferences: "Show Preferences",
  showExperiments: "Show Experiments",
  showIgnoreList: "Show Ignore List",
  settings: "Settings",
  documentation: "Documentation"
};
const str_ = i18n.i18n.registerUIStrings("panels/settings/settings-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedSettingsModule;
async function loadSettingsModule() {
  if (!loadedSettingsModule) {
    loadedSettingsModule = await import("./settings.js");
  }
  return loadedSettingsModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "preferences",
  title: i18nLazyString(UIStrings.preferences),
  commandPrompt: i18nLazyString(UIStrings.showPreferences),
  order: 0,
  async loadView() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.GenericSettingsTab.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "experiments",
  title: i18nLazyString(UIStrings.experiments),
  commandPrompt: i18nLazyString(UIStrings.showExperiments),
  order: 3,
  experiment: Root.Runtime.ExperimentName.ALL,
  async loadView() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.ExperimentsSettingsTab.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "blackbox",
  title: i18nLazyString(UIStrings.ignoreList),
  commandPrompt: i18nLazyString(UIStrings.showIgnoreList),
  order: 4,
  async loadView() {
    const Settings = await loadSettingsModule();
    return Settings.FrameworkIgnoreListSettingsTab.FrameworkIgnoreListSettingsTab.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "keybinds",
  title: i18nLazyString(UIStrings.shortcuts),
  commandPrompt: i18nLazyString(UIStrings.showShortcuts),
  order: 100,
  async loadView() {
    const Settings = await loadSettingsModule();
    return Settings.KeybindsSettingsTab.KeybindsSettingsTab.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.SETTINGS,
  actionId: "settings.show",
  title: i18nLazyString(UIStrings.settings),
  async loadActionDelegate() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.ActionDelegate.instance();
  },
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_SETTINGS_GEAR,
  bindings: [
    {
      shortcut: "F1",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT
      ]
    },
    {
      shortcut: "Shift+?"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+,",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+,",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.SETTINGS,
  actionId: "settings.documentation",
  title: i18nLazyString(UIStrings.documentation),
  async loadActionDelegate() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.ActionDelegate.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.SETTINGS,
  actionId: "settings.shortcuts",
  title: i18nLazyString(UIStrings.shortcuts),
  async loadActionDelegate() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.ActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+K Ctrl+S",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+K Meta+S",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  category: UI.ViewManager.ViewLocationCategoryValues.SETTINGS,
  async loadResolver() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.SettingsScreen.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      Common.Settings.Setting
    ];
  },
  async loadRevealer() {
    const Settings = await loadSettingsModule();
    return Settings.SettingsScreen.Revealer.instance();
  },
  destination: void 0
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.MAIN_MENU_FOOTER,
  actionId: "settings.shortcuts",
  order: void 0
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.MAIN_MENU_HELP_DEFAULT,
  actionId: "settings.documentation",
  order: void 0
});
//# sourceMappingURL=settings-meta.js.map
