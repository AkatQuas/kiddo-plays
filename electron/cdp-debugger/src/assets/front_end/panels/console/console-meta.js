import * as Common from "../../core/common/common.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  console: "Console",
  showConsole: "Show Console",
  clearConsole: "Clear console",
  clearConsoleHistory: "Clear console history",
  createLiveExpression: "Create live expression",
  hideNetworkMessages: "Hide network messages",
  showNetworkMessages: "Show network messages",
  selectedContextOnly: "Selected context only",
  onlyShowMessagesFromTheCurrent: "Only show messages from the current context (`top`, `iframe`, `worker`, extension)",
  showMessagesFromAllContexts: "Show messages from all contexts",
  logXmlhttprequests: "Log XMLHttpRequests",
  showTimestamps: "Show timestamps",
  hideTimestamps: "Hide timestamps",
  autocompleteFromHistory: "Autocomplete from history",
  doNotAutocompleteFromHistory: "Do not autocomplete from history",
  groupSimilarMessagesInConsole: "Group similar messages in console",
  doNotGroupSimilarMessagesIn: "Do not group similar messages in console",
  showCorsErrorsInConsole: "Show `CORS` errors in console",
  doNotShowCorsErrorsIn: "Do not show `CORS` errors in console",
  eagerEvaluation: "Eager evaluation",
  eagerlyEvaluateConsolePromptText: "Eagerly evaluate console prompt text",
  doNotEagerlyEvaluateConsole: "Do not eagerly evaluate console prompt text",
  evaluateTriggersUserActivation: "Evaluate triggers user activation",
  treatEvaluationAsUserActivation: "Treat evaluation as user activation",
  doNotTreatEvaluationAsUser: "Do not treat evaluation as user activation"
};
const str_ = i18n.i18n.registerUIStrings("panels/console/console-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedConsoleModule;
async function loadConsoleModule() {
  if (!loadedConsoleModule) {
    loadedConsoleModule = await import("./console.js");
  }
  return loadedConsoleModule;
}
function maybeRetrieveContextTypes(getClassCallBack) {
  if (loadedConsoleModule === void 0) {
    return [];
  }
  return getClassCallBack(loadedConsoleModule);
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "console",
  title: i18nLazyString(UIStrings.console),
  commandPrompt: i18nLazyString(UIStrings.showConsole),
  order: 20,
  async loadView() {
    const Console = await loadConsoleModule();
    return Console.ConsolePanel.ConsolePanel.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "console-view",
  title: i18nLazyString(UIStrings.console),
  commandPrompt: i18nLazyString(UIStrings.showConsole),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  order: 0,
  async loadView() {
    const Console = await loadConsoleModule();
    return Console.ConsolePanel.WrapperView.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "console.show",
  category: UI.ActionRegistration.ActionCategory.CONSOLE,
  title: i18nLazyString(UIStrings.showConsole),
  async loadActionDelegate() {
    const Console = await loadConsoleModule();
    return Console.ConsoleView.ActionDelegate.instance();
  },
  bindings: [
    {
      shortcut: "Ctrl+`",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "console.clear",
  category: UI.ActionRegistration.ActionCategory.CONSOLE,
  title: i18nLazyString(UIStrings.clearConsole),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_CLEAR,
  async loadActionDelegate() {
    const Console = await loadConsoleModule();
    return Console.ConsoleView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Console) => [Console.ConsoleView.ConsoleView]);
  },
  bindings: [
    {
      shortcut: "Ctrl+L"
    },
    {
      shortcut: "Meta+K",
      platform: UI.ActionRegistration.Platforms.Mac
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "console.clear.history",
  category: UI.ActionRegistration.ActionCategory.CONSOLE,
  title: i18nLazyString(UIStrings.clearConsoleHistory),
  async loadActionDelegate() {
    const Console = await loadConsoleModule();
    return Console.ConsoleView.ActionDelegate.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "console.create-pin",
  category: UI.ActionRegistration.ActionCategory.CONSOLE,
  title: i18nLazyString(UIStrings.createLiveExpression),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_VISIBILITY,
  async loadActionDelegate() {
    const Console = await loadConsoleModule();
    return Console.ConsoleView.ActionDelegate.instance();
  }
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.hideNetworkMessages),
  settingName: "hideNetworkMessages",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.hideNetworkMessages)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.showNetworkMessages)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.selectedContextOnly),
  settingName: "selectedContextFilterEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.onlyShowMessagesFromTheCurrent)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.showMessagesFromAllContexts)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.logXmlhttprequests),
  settingName: "monitoringXHREnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showTimestamps),
  settingName: "consoleTimestampsEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showTimestamps)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideTimestamps)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  title: i18nLazyString(UIStrings.autocompleteFromHistory),
  settingName: "consoleHistoryAutocomplete",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.autocompleteFromHistory)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotAutocompleteFromHistory)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.groupSimilarMessagesInConsole),
  settingName: "consoleGroupSimilar",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.groupSimilarMessagesInConsole)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotGroupSimilarMessagesIn)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  title: i18nLazyString(UIStrings.showCorsErrorsInConsole),
  settingName: "consoleShowsCorsErrors",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showCorsErrorsInConsole)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotShowCorsErrorsIn)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.eagerEvaluation),
  settingName: "consoleEagerEval",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.eagerlyEvaluateConsolePromptText)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotEagerlyEvaluateConsole)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.evaluateTriggersUserActivation),
  settingName: "consoleUserActivationEval",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.treatEvaluationAsUserActivation)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotTreatEvaluationAsUser)
    }
  ]
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      Common.Console.Console
    ];
  },
  async loadRevealer() {
    const Console = await loadConsoleModule();
    return Console.ConsolePanel.ConsoleRevealer.instance();
  },
  destination: void 0
});
//# sourceMappingURL=console-meta.js.map
