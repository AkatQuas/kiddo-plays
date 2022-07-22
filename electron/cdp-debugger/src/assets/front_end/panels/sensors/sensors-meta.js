import * as Common from "../../core/common/common.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  sensors: "Sensors",
  geolocation: "geolocation",
  timezones: "timezones",
  locale: "locale",
  locales: "locales",
  accelerometer: "accelerometer",
  deviceOrientation: "device orientation",
  locations: "Locations",
  touch: "Touch",
  devicebased: "Device-based",
  forceEnabled: "Force enabled",
  emulateIdleDetectorState: "Emulate Idle Detector state",
  noIdleEmulation: "No idle emulation",
  userActiveScreenUnlocked: "User active, screen unlocked",
  userActiveScreenLocked: "User active, screen locked",
  userIdleScreenUnlocked: "User idle, screen unlocked",
  userIdleScreenLocked: "User idle, screen locked",
  showSensors: "Show Sensors",
  showLocations: "Show Locations"
};
const str_ = i18n.i18n.registerUIStrings("panels/sensors/sensors-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedSensorsModule;
async function loadEmulationModule() {
  if (!loadedSensorsModule) {
    loadedSensorsModule = await import("./sensors.js");
  }
  return loadedSensorsModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  commandPrompt: i18nLazyString(UIStrings.showSensors),
  title: i18nLazyString(UIStrings.sensors),
  id: "sensors",
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const Sensors = await loadEmulationModule();
    return Sensors.SensorsView.SensorsView.instance();
  },
  tags: [
    i18nLazyString(UIStrings.geolocation),
    i18nLazyString(UIStrings.timezones),
    i18nLazyString(UIStrings.locale),
    i18nLazyString(UIStrings.locales),
    i18nLazyString(UIStrings.accelerometer),
    i18nLazyString(UIStrings.deviceOrientation)
  ]
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.SETTINGS_VIEW,
  id: "emulation-locations",
  commandPrompt: i18nLazyString(UIStrings.showLocations),
  title: i18nLazyString(UIStrings.locations),
  order: 40,
  async loadView() {
    const Sensors = await loadEmulationModule();
    return Sensors.LocationsSettingsTab.LocationsSettingsTab.instance();
  },
  settings: [
    "emulation.locations"
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "emulation.show-sensors",
  category: UI.ActionRegistration.ActionCategory.SENSORS,
  async loadActionDelegate() {
    const Sensors = await loadEmulationModule();
    return Sensors.SensorsView.ShowActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.sensors)
});
Common.Settings.registerSettingExtension({
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "emulation.locations",
  settingType: Common.Settings.SettingType.ARRAY,
  defaultValue: [
    {
      title: "Berlin",
      lat: 52.520007,
      long: 13.404954,
      timezoneId: "Europe/Berlin",
      locale: "de-DE"
    },
    {
      title: "London",
      lat: 51.507351,
      long: -0.127758,
      timezoneId: "Europe/London",
      locale: "en-GB"
    },
    {
      title: "Moscow",
      lat: 55.755826,
      long: 37.6173,
      timezoneId: "Europe/Moscow",
      locale: "ru-RU"
    },
    {
      title: "Mountain View",
      lat: 37.386052,
      long: -122.083851,
      timezoneId: "America/Los_Angeles",
      locale: "en-US"
    },
    {
      title: "Mumbai",
      lat: 19.075984,
      long: 72.877656,
      timezoneId: "Asia/Kolkata",
      locale: "mr-IN"
    },
    {
      title: "San Francisco",
      lat: 37.774929,
      long: -122.419416,
      timezoneId: "America/Los_Angeles",
      locale: "en-US"
    },
    {
      title: "Shanghai",
      lat: 31.230416,
      long: 121.473701,
      timezoneId: "Asia/Shanghai",
      locale: "zh-Hans-CN"
    },
    {
      title: "S\xE3o Paulo",
      lat: -23.55052,
      long: -46.633309,
      timezoneId: "America/Sao_Paulo",
      locale: "pt-BR"
    },
    {
      title: "Tokyo",
      lat: 35.689487,
      long: 139.691706,
      timezoneId: "Asia/Tokyo",
      locale: "ja-JP"
    }
  ]
});
Common.Settings.registerSettingExtension({
  title: i18nLazyString(UIStrings.touch),
  reloadRequired: true,
  settingName: "emulation.touch",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "none",
  options: [
    {
      value: "none",
      title: i18nLazyString(UIStrings.devicebased),
      text: i18nLazyString(UIStrings.devicebased)
    },
    {
      value: "force",
      title: i18nLazyString(UIStrings.forceEnabled),
      text: i18nLazyString(UIStrings.forceEnabled)
    }
  ]
});
Common.Settings.registerSettingExtension({
  title: i18nLazyString(UIStrings.emulateIdleDetectorState),
  settingName: "emulation.idleDetection",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "none",
  options: [
    {
      value: "none",
      title: i18nLazyString(UIStrings.noIdleEmulation),
      text: i18nLazyString(UIStrings.noIdleEmulation)
    },
    {
      value: '{"isUserActive":true,"isScreenUnlocked":true}',
      title: i18nLazyString(UIStrings.userActiveScreenUnlocked),
      text: i18nLazyString(UIStrings.userActiveScreenUnlocked)
    },
    {
      value: '{"isUserActive":true,"isScreenUnlocked":false}',
      title: i18nLazyString(UIStrings.userActiveScreenLocked),
      text: i18nLazyString(UIStrings.userActiveScreenLocked)
    },
    {
      value: '{"isUserActive":false,"isScreenUnlocked":true}',
      title: i18nLazyString(UIStrings.userIdleScreenUnlocked),
      text: i18nLazyString(UIStrings.userIdleScreenUnlocked)
    },
    {
      value: '{"isUserActive":false,"isScreenUnlocked":false}',
      title: i18nLazyString(UIStrings.userIdleScreenLocked),
      text: i18nLazyString(UIStrings.userIdleScreenLocked)
    }
  ]
});
//# sourceMappingURL=sensors-meta.js.map
