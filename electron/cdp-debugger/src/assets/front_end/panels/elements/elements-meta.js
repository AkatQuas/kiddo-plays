import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  showElements: "Show Elements",
  elements: "Elements",
  showEventListeners: "Show Event Listeners",
  eventListeners: "Event Listeners",
  showProperties: "Show Properties",
  properties: "Properties",
  showStackTrace: "Show Stack Trace",
  stackTrace: "Stack Trace",
  showLayout: "Show Layout",
  layout: "Layout",
  hideElement: "Hide element",
  editAsHtml: "Edit as HTML",
  duplicateElement: "Duplicate element",
  undo: "Undo",
  redo: "Redo",
  captureAreaScreenshot: "Capture area screenshot",
  selectAnElementInThePageTo: "Select an element in the page to inspect it",
  wordWrap: "Word wrap",
  enableDomWordWrap: "Enable `DOM` word wrap",
  disableDomWordWrap: "Disable `DOM` word wrap",
  showHtmlComments: "Show `HTML` comments",
  hideHtmlComments: "Hide `HTML` comments",
  revealDomNodeOnHover: "Reveal `DOM` node on hover",
  showDetailedInspectTooltip: "Show detailed inspect tooltip",
  copyStyles: "Copy styles",
  showUserAgentShadowDOM: "Show user agent shadow `DOM`"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/elements-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedElementsModule;
async function loadElementsModule() {
  if (!loadedElementsModule) {
    loadedElementsModule = await import("./elements.js");
  }
  return loadedElementsModule;
}
function maybeRetrieveContextTypes(getClassCallBack) {
  if (loadedElementsModule === void 0) {
    return [];
  }
  return getClassCallBack(loadedElementsModule);
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "elements",
  commandPrompt: i18nLazyString(UIStrings.showElements),
  title: i18nLazyString(UIStrings.elements),
  order: 10,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  hasToolbar: false,
  async loadView() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsPanel.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.ELEMENTS_SIDEBAR,
  id: "elements.eventListeners",
  commandPrompt: i18nLazyString(UIStrings.showEventListeners),
  title: i18nLazyString(UIStrings.eventListeners),
  order: 5,
  hasToolbar: true,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Elements = await loadElementsModule();
    return Elements.EventListenersWidget.EventListenersWidget.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.ELEMENTS_SIDEBAR,
  id: "elements.domProperties",
  commandPrompt: i18nLazyString(UIStrings.showProperties),
  title: i18nLazyString(UIStrings.properties),
  order: 7,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Elements = await loadElementsModule();
    return Elements.PropertiesWidget.PropertiesWidget.instance();
  }
});
UI.ViewManager.registerViewExtension({
  experiment: Root.Runtime.ExperimentName.CAPTURE_NODE_CREATION_STACKS,
  location: UI.ViewManager.ViewLocationValues.ELEMENTS_SIDEBAR,
  id: "elements.domCreation",
  commandPrompt: i18nLazyString(UIStrings.showStackTrace),
  title: i18nLazyString(UIStrings.stackTrace),
  order: 10,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Elements = await loadElementsModule();
    return Elements.NodeStackTraceWidget.NodeStackTraceWidget.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.ELEMENTS_SIDEBAR,
  id: "elements.layout",
  commandPrompt: i18nLazyString(UIStrings.showLayout),
  title: i18nLazyString(UIStrings.layout),
  order: 4,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Elements = await loadElementsModule();
    return Elements.LayoutSidebarPane.LayoutSidebarPane.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.hide-element",
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  title: i18nLazyString(UIStrings.hideElement),
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Elements) => [Elements.ElementsPanel.ElementsPanel]);
  },
  bindings: [
    {
      shortcut: "H"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.edit-as-html",
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  title: i18nLazyString(UIStrings.editAsHtml),
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Elements) => [Elements.ElementsPanel.ElementsPanel]);
  },
  bindings: [
    {
      shortcut: "F2"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.duplicate-element",
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  title: i18nLazyString(UIStrings.duplicateElement),
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Elements) => [Elements.ElementsPanel.ElementsPanel]);
  },
  bindings: [
    {
      shortcut: "Shift+Alt+Down"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.copy-styles",
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  title: i18nLazyString(UIStrings.copyStyles),
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Elements) => [Elements.ElementsPanel.ElementsPanel]);
  },
  bindings: [
    {
      shortcut: "Ctrl+Alt+C",
      platform: UI.ActionRegistration.Platforms.WindowsLinux
    },
    {
      shortcut: "Meta+Alt+C",
      platform: UI.ActionRegistration.Platforms.Mac
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.undo",
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  title: i18nLazyString(UIStrings.undo),
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Elements) => [Elements.ElementsPanel.ElementsPanel]);
  },
  bindings: [
    {
      shortcut: "Ctrl+Z",
      platform: UI.ActionRegistration.Platforms.WindowsLinux
    },
    {
      shortcut: "Meta+Z",
      platform: UI.ActionRegistration.Platforms.Mac
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.redo",
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  title: i18nLazyString(UIStrings.redo),
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Elements) => [Elements.ElementsPanel.ElementsPanel]);
  },
  bindings: [
    {
      shortcut: "Ctrl+Y",
      platform: UI.ActionRegistration.Platforms.WindowsLinux
    },
    {
      shortcut: "Meta+Shift+Z",
      platform: UI.ActionRegistration.Platforms.Mac
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "elements.capture-area-screenshot",
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.InspectElementModeController.ToggleSearchActionDelegate.instance();
  },
  condition: Root.Runtime.ConditionName.CAN_DOCK,
  title: i18nLazyString(UIStrings.captureAreaScreenshot),
  category: UI.ActionRegistration.ActionCategory.SCREENSHOT
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.ELEMENTS,
  actionId: "elements.toggle-element-search",
  toggleable: true,
  async loadActionDelegate() {
    const Elements = await loadElementsModule();
    return Elements.InspectElementModeController.ToggleSearchActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.selectAnElementInThePageTo),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_NODE_SEARCH,
  bindings: [
    {
      shortcut: "Ctrl+Shift+C",
      platform: UI.ActionRegistration.Platforms.WindowsLinux
    },
    {
      shortcut: "Meta+Shift+C",
      platform: UI.ActionRegistration.Platforms.Mac
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ELEMENTS,
  storageType: Common.Settings.SettingStorageType.Synced,
  order: 1,
  title: i18nLazyString(UIStrings.showUserAgentShadowDOM),
  settingName: "showUAShadowDOM",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ELEMENTS,
  storageType: Common.Settings.SettingStorageType.Synced,
  order: 2,
  title: i18nLazyString(UIStrings.wordWrap),
  settingName: "domWordWrap",
  settingType: Common.Settings.SettingType.BOOLEAN,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableDomWordWrap)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableDomWordWrap)
    }
  ],
  defaultValue: true
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ELEMENTS,
  storageType: Common.Settings.SettingStorageType.Synced,
  order: 3,
  title: i18nLazyString(UIStrings.showHtmlComments),
  settingName: "showHTMLComments",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.showHtmlComments)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.hideHtmlComments)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ELEMENTS,
  storageType: Common.Settings.SettingStorageType.Synced,
  order: 4,
  title: i18nLazyString(UIStrings.revealDomNodeOnHover),
  settingName: "highlightNodeOnHoverInOverlay",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ELEMENTS,
  storageType: Common.Settings.SettingStorageType.Synced,
  order: 5,
  title: i18nLazyString(UIStrings.showDetailedInspectTooltip),
  settingName: "showDetailedInspectTooltip",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true
});
Common.Settings.registerSettingExtension({
  settingName: "showEventListenersForAncestors",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.ADORNER,
  storageType: Common.Settings.SettingStorageType.Synced,
  settingName: "adornerSettings",
  settingType: Common.Settings.SettingType.ARRAY,
  defaultValue: []
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      SDK.RemoteObject.RemoteObject,
      SDK.DOMModel.DOMNode,
      SDK.DOMModel.DeferredDOMNode
    ];
  },
  async loadProvider() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ContextMenuProvider.instance();
  },
  experiment: void 0
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.ELEMENTS_SIDEBAR,
  category: UI.ViewManager.ViewLocationCategoryValues.ELEMENTS,
  async loadResolver() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.ElementsPanel.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.DOMModel.DOMNode,
      SDK.DOMModel.DeferredDOMNode,
      SDK.RemoteObject.RemoteObject
    ];
  },
  destination: Common.Revealer.RevealerDestination.ELEMENTS_PANEL,
  async loadRevealer() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.DOMNodeRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.CSSProperty.CSSProperty
    ];
  },
  destination: Common.Revealer.RevealerDestination.STYLES_SIDEBAR,
  async loadRevealer() {
    const Elements = await loadElementsModule();
    return Elements.ElementsPanel.CSSPropertyRevealer.instance();
  }
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Elements = await loadElementsModule();
    return Elements.LayersWidget.ButtonProvider.instance();
  },
  order: 1,
  location: UI.Toolbar.ToolbarItemLocation.STYLES_SIDEBARPANE_TOOLBAR,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Elements = await loadElementsModule();
    return Elements.ElementStatePaneWidget.ButtonProvider.instance();
  },
  order: 2,
  location: UI.Toolbar.ToolbarItemLocation.STYLES_SIDEBARPANE_TOOLBAR,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Elements = await loadElementsModule();
    return Elements.ClassesPaneWidget.ButtonProvider.instance();
  },
  order: 3,
  location: UI.Toolbar.ToolbarItemLocation.STYLES_SIDEBARPANE_TOOLBAR,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
UI.Toolbar.registerToolbarItem({
  async loadItem() {
    const Elements = await loadElementsModule();
    return Elements.StylesSidebarPane.ButtonProvider.instance();
  },
  order: 100,
  location: UI.Toolbar.ToolbarItemLocation.STYLES_SIDEBARPANE_TOOLBAR,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  actionId: void 0
});
UI.Toolbar.registerToolbarItem({
  actionId: "elements.toggle-element-search",
  location: UI.Toolbar.ToolbarItemLocation.MAIN_TOOLBAR_LEFT,
  order: 0,
  showLabel: void 0,
  condition: void 0,
  separator: void 0,
  loadItem: void 0
});
UI.UIUtils.registerRenderer({
  contextTypes() {
    return [SDK.DOMModel.DOMNode, SDK.DOMModel.DeferredDOMNode];
  },
  async loadRenderer() {
    const Elements = await loadElementsModule();
    return Elements.ElementsTreeOutline.Renderer.instance();
  }
});
Common.Linkifier.registerLinkifier({
  contextTypes() {
    return [
      SDK.DOMModel.DOMNode,
      SDK.DOMModel.DeferredDOMNode
    ];
  },
  async loadLinkifier() {
    const Elements = await loadElementsModule();
    return Elements.DOMLinkifier.Linkifier.instance();
  }
});
//# sourceMappingURL=elements-meta.js.map
