import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as NetworkForward from "../../panels/network/forward/forward.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  showNetwork: "Show Network",
  network: "Network",
  showNetworkRequestBlocking: "Show Network request blocking",
  networkRequestBlocking: "Network request blocking",
  showNetworkConditions: "Show Network conditions",
  networkConditions: "Network conditions",
  diskCache: "disk cache",
  networkThrottling: "network throttling",
  showSearch: "Show Search",
  search: "Search",
  recordNetworkLog: "Record network log",
  stopRecordingNetworkLog: "Stop recording network log",
  hideRequestDetails: "Hide request details",
  colorcodeResourceTypes: "Color-code resource types",
  colorCode: "color code",
  resourceType: "resource type",
  colorCodeByResourceType: "Color code by resource type",
  useDefaultColors: "Use default colors",
  groupNetworkLogByFrame: "Group network log by frame",
  netWork: "network",
  frame: "frame",
  group: "group",
  groupNetworkLogItemsByFrame: "Group network log items by frame",
  dontGroupNetworkLogItemsByFrame: "Don't group network log items by frame"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/network-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedNetworkModule;
async function loadNetworkModule() {
  if (!loadedNetworkModule) {
    loadedNetworkModule = await import("./network.js");
  }
  return loadedNetworkModule;
}
function maybeRetrieveContextTypes(getClassCallBack) {
  if (loadedNetworkModule === void 0) {
    return [];
  }
  return getClassCallBack(loadedNetworkModule);
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "network",
  commandPrompt: i18nLazyString(UIStrings.showNetwork),
  title: i18nLazyString(UIStrings.network),
  order: 40,
  async loadView() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.NetworkPanel.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "network.blocked-urls",
  commandPrompt: i18nLazyString(UIStrings.showNetworkRequestBlocking),
  title: i18nLazyString(UIStrings.networkRequestBlocking),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 60,
  async loadView() {
    const Network = await loadNetworkModule();
    return Network.BlockedURLsPane.BlockedURLsPane.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "network.config",
  commandPrompt: i18nLazyString(UIStrings.showNetworkConditions),
  title: i18nLazyString(UIStrings.networkConditions),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 40,
  tags: [
    i18nLazyString(UIStrings.diskCache),
    i18nLazyString(UIStrings.networkThrottling),
    i18n.i18n.lockedLazyString("useragent"),
    i18n.i18n.lockedLazyString("user agent"),
    i18n.i18n.lockedLazyString("user-agent")
  ],
  async loadView() {
    const Network = await loadNetworkModule();
    return Network.NetworkConfigView.NetworkConfigView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NETWORK_SIDEBAR,
  id: "network.search-network-tab",
  commandPrompt: i18nLazyString(UIStrings.showSearch),
  title: i18nLazyString(UIStrings.search),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.SearchNetworkView.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network.toggle-recording",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  contextTypes() {
    return maybeRetrieveContextTypes((Network) => [Network.NetworkPanel.NetworkPanel]);
  },
  async loadActionDelegate() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.ActionDelegate.instance();
  },
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.recordNetworkLog)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.stopRecordingNetworkLog)
    }
  ],
  bindings: [
    {
      shortcut: "Ctrl+E",
      platform: UI.ActionRegistration.Platforms.WindowsLinux
    },
    {
      shortcut: "Meta+E",
      platform: UI.ActionRegistration.Platforms.Mac
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network.hide-request-details",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  title: i18nLazyString(UIStrings.hideRequestDetails),
  contextTypes() {
    return maybeRetrieveContextTypes((Network) => [Network.NetworkPanel.NetworkPanel]);
  },
  async loadActionDelegate() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.ActionDelegate.instance();
  },
  bindings: [
    {
      shortcut: "Esc"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "network.search",
  category: UI.ActionRegistration.ActionCategory.NETWORK,
  title: i18nLazyString(UIStrings.search),
  contextTypes() {
    return maybeRetrieveContextTypes((Network) => [Network.NetworkPanel.NetworkPanel]);
  },
  async loadActionDelegate() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.ActionDelegate.instance();
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.colorcodeResourceTypes),
  settingName: "networkColorCodeResourceTypes",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  tags: [
    i18nLazyString(UIStrings.colorCode),
    i18nLazyString(UIStrings.resourceType)
  ],
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.colorCodeByResourceType)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.useDefaultColors)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.NETWORK,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.groupNetworkLogByFrame),
  settingName: "network.group-by-frame",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  tags: [
    i18nLazyString(UIStrings.netWork),
    i18nLazyString(UIStrings.frame),
    i18nLazyString(UIStrings.group)
  ],
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.groupNetworkLogItemsByFrame)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.dontGroupNetworkLogItemsByFrame)
    }
  ]
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.NETWORK_SIDEBAR,
  category: UI.ViewManager.ViewLocationCategoryValues.NETWORK,
  async loadResolver() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.NetworkPanel.instance();
  }
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      SDK.NetworkRequest.NetworkRequest,
      SDK.Resource.Resource,
      Workspace.UISourceCode.UISourceCode
    ];
  },
  async loadProvider() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.ContextMenuProvider.instance();
  },
  experiment: void 0
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.NetworkRequest.NetworkRequest
    ];
  },
  destination: Common.Revealer.RevealerDestination.NETWORK_PANEL,
  async loadRevealer() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.RequestRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [NetworkForward.UIRequestLocation.UIRequestLocation];
  },
  async loadRevealer() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.RequestLocationRevealer.instance();
  },
  destination: void 0
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [NetworkForward.NetworkRequestId.NetworkRequestId];
  },
  destination: Common.Revealer.RevealerDestination.NETWORK_PANEL,
  async loadRevealer() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.RequestIdRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      NetworkForward.UIFilter.UIRequestFilter
    ];
  },
  destination: Common.Revealer.RevealerDestination.NETWORK_PANEL,
  async loadRevealer() {
    const Network = await loadNetworkModule();
    return Network.NetworkPanel.NetworkLogWithFilterRevealer.instance();
  }
});
//# sourceMappingURL=network-meta.js.map
