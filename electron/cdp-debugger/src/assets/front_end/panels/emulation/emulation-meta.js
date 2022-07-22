import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  toggleDeviceToolbar: "Toggle device toolbar",
  captureScreenshot: "Capture screenshot",
  captureFullSizeScreenshot: "Capture full size screenshot",
  captureNodeScreenshot: "Capture node screenshot",
  showMediaQueries: "Show media queries",
  device: "device",
  hideMediaQueries: "Hide media queries",
  showRulers: "Show rulers in the Device Mode toolbar",
  hideRulers: "Hide rulers in the Device Mode toolbar",
  showDeviceFrame: "Show device frame",
  hideDeviceFrame: "Hide device frame"
};
const str_ = i18n.i18n.registerUIStrings("panels/emulation/emulation-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedEmulationModule;
async function loadEmulationModule() {
  if (!loadedEmulationModule) {
    loadedEmulationModule = await import("./emulation.js");
  }
  return loadedEmulationModule;
}
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.MOBILE,
  actionId: "emulation.toggle-device-mode",
  toggleable: true,
  async loadActionDelegate() {
    const Emulation = await loadEmulationModule();
    return Emulation.DeviceModeWrapper.ActionDelegate.instance();
  },
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  title: i18nLazyString(UIStrings.toggleDeviceToolbar),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_PHONE,
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Shift+Ctrl+M"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Shift+Meta+M"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "emulation.capture-screenshot",
  category: UI.ActionRegistration.ActionCategory.SCREENSHOT,
  async loadActionDelegate() {
    const Emulation = await loadEmulationModule();
    return Emulation.DeviceModeWrapper.ActionDelegate.instance();
  },
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  title: i18nLazyString(UIStrings.captureScreenshot)
});
UI.ActionRegistration.registerActionExtension({
  actionId: "emulation.capture-full-height-screenshot",
  category: UI.ActionRegistration.ActionCategory.SCREENSHOT,
  async loadActionDelegate() {
    const Emulation = await loadEmulationModule();
    return Emulation.DeviceModeWrapper.ActionDelegate.instance();
  },
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  title: i18nLazyString(UIStrings.captureFullSizeScreenshot)
});
UI.ActionRegistration.registerActionExtension({
  actionId: "emulation.capture-node-screenshot",
  category: UI.ActionRegistration.ActionCategory.SCREENSHOT,
  async loadActionDelegate() {
    const Emulation = await loadEmulationModule();
    return Emulation.DeviceModeWrapper.ActionDelegate.instance();
  },
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  title: i18nLazyString(UIStrings.captureNodeScreenshot)
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.MOBILE,
  settingName: "showMediaQueryInspector",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showMediaQueries)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideMediaQueries)
    }
  ],
  tags: [i18nLazyString(UIStrings.device)]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.MOBILE,
  settingName: "emulation.showRulers",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showRulers)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideRulers)
    }
  ],
  tags: [i18nLazyString(UIStrings.device)]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.MOBILE,
  settingName: "emulation.showDeviceOutline",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showDeviceFrame)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideDeviceFrame)
    }
  ],
  tags: [i18nLazyString(UIStrings.device)]
});
UI.Toolbar.registerToolbarItem({
  actionId: "emulation.toggle-device-mode",
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_LEFT,
  order: 1,
  showLabel: void 0,
  loadItem: void 0,
  separator: void 0
});
Common.AppProvider.registerAppProvider({
  async loadAppProvider() {
    const Emulation = await loadEmulationModule();
    return Emulation.AdvancedApp.AdvancedAppProvider.instance();
  },
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  order: 0
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.DEVICE_MODE_MENU_SAVE,
  order: 12,
  actionId: "emulation.capture-screenshot"
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.DEVICE_MODE_MENU_SAVE,
  order: 13,
  actionId: "emulation.capture-full-height-screenshot"
});
//# sourceMappingURL=emulation-meta.js.map
