import * as i18n from "../../../../core/i18n/i18n.js";
import * as UI from "../../legacy.js";
const UIStrings = {
  openFile: "Open file",
  runCommand: "Run command"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/quick_open/quick_open-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedQuickOpenModule;
async function loadQuickOpenModule() {
  if (!loadedQuickOpenModule) {
    loadedQuickOpenModule = await import("./quick_open.js");
  }
  return loadedQuickOpenModule;
}
UI.ActionRegistration.registerActionExtension({
  actionId: "commandMenu.show",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.runCommand),
  async loadActionDelegate() {
    const QuickOpen = await loadQuickOpenModule();
    return QuickOpen.CommandMenu.ShowActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+P",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+P",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      shortcut: "F1",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "quickOpen.show",
  category: UI.ActionRegistration.ActionCategory.GLOBAL,
  title: i18nLazyString(UIStrings.openFile),
  async loadActionDelegate() {
    const QuickOpen = await loadQuickOpenModule();
    return QuickOpen.QuickOpen.ShowActionDelegate.instance();
  },
  order: 100,
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+P",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+O",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+P",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+O",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.MAIN_MENU_DEFAULT,
  actionId: "commandMenu.show",
  order: void 0
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.MAIN_MENU_DEFAULT,
  actionId: "quickOpen.show",
  order: void 0
});
//# sourceMappingURL=quick_open-meta.js.map
