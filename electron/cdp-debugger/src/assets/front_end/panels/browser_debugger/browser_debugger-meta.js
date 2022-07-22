import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  showEventListenerBreakpoints: "Show Event Listener Breakpoints",
  eventListenerBreakpoints: "Event Listener Breakpoints",
  showCspViolationBreakpoints: "Show CSP Violation Breakpoints",
  cspViolationBreakpoints: "CSP Violation Breakpoints",
  showXhrfetchBreakpoints: "Show XHR/fetch Breakpoints",
  xhrfetchBreakpoints: "XHR/fetch Breakpoints",
  showDomBreakpoints: "Show DOM Breakpoints",
  domBreakpoints: "DOM Breakpoints",
  showGlobalListeners: "Show Global Listeners",
  globalListeners: "Global Listeners",
  page: "Page",
  showPage: "Show Page",
  overrides: "Overrides",
  showOverrides: "Show Overrides",
  contentScripts: "Content scripts",
  showContentScripts: "Show Content scripts"
};
const str_ = i18n.i18n.registerUIStrings("panels/browser_debugger/browser_debugger-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedBrowserDebuggerModule;
async function loadBrowserDebuggerModule() {
  if (!loadedBrowserDebuggerModule) {
    loadedBrowserDebuggerModule = await import("./browser_debugger.js");
  }
  return loadedBrowserDebuggerModule;
}
let loadedSourcesModule;
async function loadSourcesModule() {
  if (!loadedSourcesModule) {
    loadedSourcesModule = await import("../sources/sources.js");
  }
  return loadedSourcesModule;
}
UI.ViewManager.registerViewExtension({
  async loadView() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.EventListenerBreakpointsSidebarPane.EventListenerBreakpointsSidebarPane.instance();
  },
  id: "sources.eventListenerBreakpoints",
  location: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_BOTTOM,
  commandPrompt: i18nLazyString(UIStrings.showEventListenerBreakpoints),
  title: i18nLazyString(UIStrings.eventListenerBreakpoints),
  order: 9,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT
});
UI.ViewManager.registerViewExtension({
  async loadView() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.CSPViolationBreakpointsSidebarPane.CSPViolationBreakpointsSidebarPane.instance();
  },
  id: "sources.cspViolationBreakpoints",
  location: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_BOTTOM,
  commandPrompt: i18nLazyString(UIStrings.showCspViolationBreakpoints),
  title: i18nLazyString(UIStrings.cspViolationBreakpoints),
  order: 10,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT
});
UI.ViewManager.registerViewExtension({
  async loadView() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.XHRBreakpointsSidebarPane.XHRBreakpointsSidebarPane.instance();
  },
  id: "sources.xhrBreakpoints",
  location: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_BOTTOM,
  commandPrompt: i18nLazyString(UIStrings.showXhrfetchBreakpoints),
  title: i18nLazyString(UIStrings.xhrfetchBreakpoints),
  order: 5,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  hasToolbar: true
});
UI.ViewManager.registerViewExtension({
  async loadView() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.DOMBreakpointsSidebarPane.DOMBreakpointsSidebarPane.instance();
  },
  id: "sources.domBreakpoints",
  location: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_BOTTOM,
  commandPrompt: i18nLazyString(UIStrings.showDomBreakpoints),
  title: i18nLazyString(UIStrings.domBreakpoints),
  order: 7,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT
});
UI.ViewManager.registerViewExtension({
  async loadView() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.ObjectEventListenersSidebarPane.ObjectEventListenersSidebarPane.instance();
  },
  id: "sources.globalListeners",
  location: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_BOTTOM,
  commandPrompt: i18nLazyString(UIStrings.showGlobalListeners),
  title: i18nLazyString(UIStrings.globalListeners),
  order: 8,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  hasToolbar: true
});
UI.ViewManager.registerViewExtension({
  async loadView() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.DOMBreakpointsSidebarPane.DOMBreakpointsSidebarPane.instance();
  },
  id: "elements.domBreakpoints",
  location: UI.ViewManager.ViewLocationValues.ELEMENTS_SIDEBAR,
  commandPrompt: i18nLazyString(UIStrings.showDomBreakpoints),
  title: i18nLazyString(UIStrings.domBreakpoints),
  order: 6,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  id: "navigator-network",
  title: i18nLazyString(UIStrings.page),
  commandPrompt: i18nLazyString(UIStrings.showPage),
  order: 2,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.NetworkNavigatorView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  id: "navigator-overrides",
  title: i18nLazyString(UIStrings.overrides),
  commandPrompt: i18nLazyString(UIStrings.showOverrides),
  order: 4,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.OverridesNavigatorView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  id: "navigator-contentScripts",
  title: i18nLazyString(UIStrings.contentScripts),
  commandPrompt: i18nLazyString(UIStrings.showContentScripts),
  order: 5,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.ContentScriptsNavigatorView.instance();
  }
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      SDK.DOMModel.DOMNode
    ];
  },
  async loadProvider() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.DOMBreakpointsSidebarPane.ContextMenuProvider.instance();
  },
  experiment: void 0
});
UI.Context.registerListener({
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  async loadListener() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.XHRBreakpointsSidebarPane.XHRBreakpointsSidebarPane.instance();
  }
});
UI.Context.registerListener({
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  async loadListener() {
    const BrowserDebugger = await loadBrowserDebuggerModule();
    return BrowserDebugger.DOMBreakpointsSidebarPane.DOMBreakpointsSidebarPane.instance();
  }
});
//# sourceMappingURL=browser_debugger-meta.js.map
