import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as ProtocolClient from "../../core/protocol_client/protocol_client.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as Extensions from "../../models/extensions/extensions.js";
import * as IssuesManager from "../../models/issues_manager/issues_manager.js";
import * as Logs from "../../models/logs/logs.js";
import * as Persistence from "../../models/persistence/persistence.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as Snippets from "../../panels/snippets/snippets.js";
import * as Timeline from "../../panels/timeline/timeline.js";
import * as IconButton from "../../ui/components/icon_button/icon_button.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ThemeSupport from "../../ui/legacy/theme_support/theme_support.js";
import { ExecutionContextSelector } from "./ExecutionContextSelector.js";
const UIStrings = {
  customizeAndControlDevtools: "Customize and control DevTools",
  dockSide: "Dock side",
  placementOfDevtoolsRelativeToThe: "Placement of DevTools relative to the page. ({PH1} to restore last position)",
  undockIntoSeparateWindow: "Undock into separate window",
  dockToBottom: "Dock to bottom",
  dockToRight: "Dock to right",
  dockToLeft: "Dock to left",
  focusDebuggee: "Focus debuggee",
  hideConsoleDrawer: "Hide console drawer",
  showConsoleDrawer: "Show console drawer",
  moreTools: "More tools",
  help: "Help"
};
const str_ = i18n.i18n.registerUIStrings("entrypoints/main/MainImpl.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class MainImpl {
  #lateInitDonePromise;
  #readyForTestPromise;
  #resolveReadyForTestPromise;
  constructor() {
    MainImpl.instanceForTest = this;
    this.#readyForTestPromise = new Promise((resolve) => {
      this.#resolveReadyForTestPromise = resolve;
    });
    void this.#loaded();
  }
  static time(label) {
    if (Host.InspectorFrontendHost.isUnderTest()) {
      return;
    }
    console.time(label);
  }
  static timeEnd(label) {
    if (Host.InspectorFrontendHost.isUnderTest()) {
      return;
    }
    console.timeEnd(label);
  }
  async #loaded() {
    console.timeStamp("Main._loaded");
    Root.Runtime.Runtime.setPlatform(Host.Platform.platform());
    const prefs = await new Promise((resolve) => {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.getPreferences(resolve);
    });
    console.timeStamp("Main._gotPreferences");
    this.#initializeGlobalsForLayoutTests();
    this.createSettings(prefs);
    await this.requestAndRegisterLocaleData();
    if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.SYNC_SETTINGS)) {
      Host.userMetrics.syncSetting(Common.Settings.Settings.instance().moduleSetting("sync_preferences").get());
    }
    void this.#createAppUI();
  }
  #initializeGlobalsForLayoutTests() {
    self.Common = self.Common || {};
    self.UI = self.UI || {};
    self.UI.panels = self.UI.panels || {};
    self.SDK = self.SDK || {};
    self.Bindings = self.Bindings || {};
    self.Persistence = self.Persistence || {};
    self.Workspace = self.Workspace || {};
    self.Extensions = self.Extensions || {};
    self.Host = self.Host || {};
    self.Host.userMetrics = self.Host.userMetrics || Host.userMetrics;
    self.Host.UserMetrics = self.Host.UserMetrics || Host.UserMetrics;
  }
  async requestAndRegisterLocaleData() {
    const settingLanguage = Common.Settings.Settings.instance().moduleSetting("language").get();
    const devToolsLocale = i18n.DevToolsLocale.DevToolsLocale.instance({
      create: true,
      data: {
        navigatorLanguage: navigator.language,
        settingLanguage,
        lookupClosestDevToolsLocale: i18n.i18n.lookupClosestSupportedDevToolsLocale
      }
    });
    Host.userMetrics.language(devToolsLocale.locale);
    if (devToolsLocale.locale !== "en-US") {
      await i18n.i18n.fetchAndRegisterLocaleData("en-US");
    }
    try {
      await i18n.i18n.fetchAndRegisterLocaleData(devToolsLocale.locale);
    } catch (error) {
      console.error(error);
      devToolsLocale.forceFallbackLocale();
    }
  }
  createSettings(prefs) {
    this.#initializeExperiments();
    let storagePrefix = "";
    if (Host.Platform.isCustomDevtoolsFrontend()) {
      storagePrefix = "__custom__";
    } else if (!Root.Runtime.Runtime.queryParam("can_dock") && Boolean(Root.Runtime.Runtime.queryParam("debugFrontend")) && !Host.InspectorFrontendHost.isUnderTest()) {
      storagePrefix = "__bundled__";
    }
    let localStorage;
    if (!Host.InspectorFrontendHost.isUnderTest() && window.localStorage) {
      const localbackingStore = {
        ...Common.Settings.NOOP_STORAGE,
        clear: () => window.localStorage.clear()
      };
      localStorage = new Common.Settings.SettingsStorage(window.localStorage, localbackingStore, storagePrefix);
    } else {
      localStorage = new Common.Settings.SettingsStorage({}, Common.Settings.NOOP_STORAGE, storagePrefix);
    }
    const hostUnsyncedStorage = {
      register: (name) => Host.InspectorFrontendHost.InspectorFrontendHostInstance.registerPreference(name, { synced: false }),
      set: Host.InspectorFrontendHost.InspectorFrontendHostInstance.setPreference,
      get: (name) => {
        return new Promise((resolve) => {
          Host.InspectorFrontendHost.InspectorFrontendHostInstance.getPreference(name, resolve);
        });
      },
      remove: Host.InspectorFrontendHost.InspectorFrontendHostInstance.removePreference,
      clear: Host.InspectorFrontendHost.InspectorFrontendHostInstance.clearPreferences
    };
    const hostSyncedStorage = {
      ...hostUnsyncedStorage,
      register: (name) => Host.InspectorFrontendHost.InspectorFrontendHostInstance.registerPreference(name, { synced: true })
    };
    const syncedStorage = new Common.Settings.SettingsStorage(prefs, hostSyncedStorage, storagePrefix);
    const globalStorage = new Common.Settings.SettingsStorage(prefs, hostUnsyncedStorage, storagePrefix);
    Common.Settings.Settings.instance({ forceNew: true, syncedStorage, globalStorage, localStorage });
    self.Common.settings = Common.Settings.Settings.instance();
    if (!Host.InspectorFrontendHost.isUnderTest()) {
      new Common.Settings.VersionController().updateVersion();
    }
  }
  #initializeExperiments() {
    Root.Runtime.experiments.register("applyCustomStylesheet", "Allow extensions to load custom stylesheets");
    Root.Runtime.experiments.register("captureNodeCreationStacks", "Capture node creation stacks");
    Root.Runtime.experiments.register("sourcesPrettyPrint", "Automatically pretty print in the Sources Panel");
    Root.Runtime.experiments.register("backgroundServices", "Background web platform feature events", true);
    Root.Runtime.experiments.register("backgroundServicesNotifications", "Background services section for Notifications");
    Root.Runtime.experiments.register("backgroundServicesPaymentHandler", "Background services section for Payment Handler");
    Root.Runtime.experiments.register("backgroundServicesPushMessaging", "Background services section for Push Messaging");
    Root.Runtime.experiments.register("ignoreListJSFramesOnTimeline", "Ignore List for JavaScript frames on Timeline", true);
    Root.Runtime.experiments.register("inputEventsOnTimelineOverview", "Input events on Timeline overview", true);
    Root.Runtime.experiments.register("liveHeapProfile", "Live heap profile", true);
    Root.Runtime.experiments.register("protocolMonitor", "Protocol Monitor", void 0, "https://developer.chrome.com/blog/new-in-devtools-92/#protocol-monitor");
    Root.Runtime.experiments.register("developerResourcesView", "Show developer resources view");
    Root.Runtime.experiments.register("cspViolationsView", "Show CSP Violations view", void 0, "https://developer.chrome.com/blog/new-in-devtools-89/#csp");
    Root.Runtime.experiments.register("recordCoverageWithPerformanceTracing", "Record coverage while performance tracing");
    Root.Runtime.experiments.register("samplingHeapProfilerTimeline", "Sampling heap profiler timeline", true);
    Root.Runtime.experiments.register("showOptionToExposeInternalsInHeapSnapshot", "Show option to expose internals in heap snapshots");
    Root.Runtime.experiments.register("sourceOrderViewer", "Source order viewer", void 0, "https://developer.chrome.com/blog/new-in-devtools-92/#source-order");
    Root.Runtime.experiments.register("webauthnPane", "WebAuthn Pane");
    Root.Runtime.experiments.register("keyboardShortcutEditor", "Enable keyboard shortcut editor", true, "https://developer.chrome.com/blog/new-in-devtools-88/#keyboard-shortcuts");
    Root.Runtime.experiments.register("bfcacheDisplayTree", "Show back/forward cache blocking reasons in the frame tree structure view");
    Root.Runtime.experiments.register("timelineEventInitiators", "Timeline: event initiators");
    Root.Runtime.experiments.register("timelineInvalidationTracking", "Timeline: invalidation tracking", true);
    Root.Runtime.experiments.register("timelineShowAllEvents", "Timeline: show all events", true);
    Root.Runtime.experiments.register("timelineV8RuntimeCallStats", "Timeline: V8 Runtime Call Stats on Timeline", true);
    Root.Runtime.experiments.register("timelineWebGL", "Timeline: WebGL-based flamechart");
    Root.Runtime.experiments.register("timelineReplayEvent", "Timeline: Replay input events", true);
    Root.Runtime.experiments.register("wasmDWARFDebugging", "WebAssembly Debugging: Enable DWARF support", void 0, "https://developer.chrome.com/blog/wasm-debugging-2020/");
    Root.Runtime.experiments.register("evaluateExpressionsWithSourceMaps", "Console: Resolve variable names in expressions using source maps", void 0);
    Root.Runtime.experiments.register("instrumentationBreakpoints", "Enable instrumentation breakpoints", true);
    Root.Runtime.experiments.register("dualScreenSupport", "Emulation: Support dual screen mode", void 0, "https://developer.chrome.com/blog/new-in-devtools-89#dual-screen");
    Root.Runtime.experiments.setEnabled("dualScreenSupport", true);
    Root.Runtime.experiments.register("APCA", "Enable new Advanced Perceptual Contrast Algorithm (APCA) replacing previous contrast ratio and AA/AAA guidelines", void 0, "https://developer.chrome.com/blog/new-in-devtools-89/#apca");
    Root.Runtime.experiments.register("fullAccessibilityTree", "Enable full accessibility tree view in the Elements panel", void 0, "https://developer.chrome.com/blog/new-in-devtools-90/#accesibility-tree");
    Root.Runtime.experiments.register("fontEditor", "Enable new Font Editor tool within the Styles Pane.", void 0, "https://developer.chrome.com/blog/new-in-devtools-89/#font");
    Root.Runtime.experiments.register("contrastIssues", "Enable automatic contrast issue reporting via the Issues panel", void 0, "https://developer.chrome.com/blog/new-in-devtools-90/#low-contrast");
    Root.Runtime.experiments.register("experimentalCookieFeatures", "Enable experimental cookie features");
    Root.Runtime.experiments.register("hideIssuesFeature", "Enable experimental hide issues menu", void 0, "https://developer.chrome.com/blog/new-in-devtools-94/#hide-issues");
    Root.Runtime.experiments.register("groupAndHideIssuesByKind", "Allow grouping and hiding of issues by IssueKind");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.SYNC_SETTINGS, "Sync DevTools settings with Chrome Sync");
    Root.Runtime.experiments.register("reportingApiDebugging", "Enable Reporting API panel in the Application panel");
    Root.Runtime.experiments.register("cssTypeComponentLength", "Enable CSS <length> authoring tool in the Styles pane (https://g.co/devtools/length-feedback)", void 0, "https://developer.chrome.com/blog/new-in-devtools-96/#length");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.PRECISE_CHANGES, "Display more precise changes in the Changes tab");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.STYLES_PANE_CSS_CHANGES, "Sync CSS changes in the Styles pane");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.HEADER_OVERRIDES, "Local overrides for response headers");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.CSS_AUTHORING_HINTS, "Enable CSS Authoring hints for inactive rules, deprecated properties, etc.");
    Root.Runtime.experiments.register("lighthousePanelFR", "Use Lighthouse panel with timespan and snapshot modes");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.CSS_LAYERS, "Tooling for CSS layers in the Styles pane");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.EYEDROPPER_COLOR_PICKER, "Enable color picking outside the browser window");
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.AUTHORED_DEPLOYED_GROUPING, "Group sources into Authored and Deployed trees");
    Root.Runtime.experiments.enableExperimentsByDefault([
      "sourceOrderViewer",
      "hideIssuesFeature",
      "cssTypeComponentLength",
      Root.Runtime.ExperimentName.PRECISE_CHANGES,
      "reportingApiDebugging",
      Root.Runtime.ExperimentName.SYNC_SETTINGS,
      Root.Runtime.ExperimentName.CSS_LAYERS,
      Root.Runtime.ExperimentName.EYEDROPPER_COLOR_PICKER,
      "lighthousePanelFR"
    ]);
    Root.Runtime.experiments.cleanUpStaleExperiments();
    const enabledExperiments = Root.Runtime.Runtime.queryParam("enabledExperiments");
    if (enabledExperiments) {
      Root.Runtime.experiments.setServerEnabledExperiments(enabledExperiments.split(";"));
    }
    Root.Runtime.experiments.enableExperimentsTransiently([
      "backgroundServices",
      "backgroundServicesNotifications",
      "backgroundServicesPushMessaging",
      "backgroundServicesPaymentHandler",
      "bfcacheDisplayTree",
      "webauthnPane",
      "developerResourcesView"
    ]);
    if (Host.InspectorFrontendHost.isUnderTest()) {
      const testParam = Root.Runtime.Runtime.queryParam("test");
      if (testParam && testParam.includes("live-line-level-heap-profile.js")) {
        Root.Runtime.experiments.enableForTest("liveHeapProfile");
      }
    }
    for (const experiment of Root.Runtime.experiments.enabledExperiments()) {
      Host.userMetrics.experimentEnabledAtLaunch(experiment.name);
    }
  }
  async #createAppUI() {
    MainImpl.time("Main._createAppUI");
    self.UI.viewManager = UI.ViewManager.ViewManager.instance();
    self.Persistence.isolatedFileSystemManager = Persistence.IsolatedFileSystemManager.IsolatedFileSystemManager.instance();
    const defaultThemeSetting = "systemPreferred";
    const themeSetting = Common.Settings.Settings.instance().createSetting("uiTheme", defaultThemeSetting);
    UI.UIUtils.initializeUIUtils(document);
    if (!ThemeSupport.ThemeSupport.hasInstance()) {
      ThemeSupport.ThemeSupport.instance({ forceNew: true, setting: themeSetting });
    }
    ThemeSupport.ThemeSupport.instance().applyTheme(document);
    const onThemeChange = () => {
      ThemeSupport.ThemeSupport.instance().applyTheme(document);
    };
    const darkThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    darkThemeMediaQuery.addEventListener("change", onThemeChange);
    themeSetting.addChangeListener(onThemeChange);
    UI.UIUtils.installComponentRootStyles(document.body);
    this.#addMainEventListeners(document);
    const canDock = Boolean(Root.Runtime.Runtime.queryParam("can_dock"));
    self.UI.zoomManager = UI.ZoomManager.ZoomManager.instance({ forceNew: true, win: window, frontendHost: Host.InspectorFrontendHost.InspectorFrontendHostInstance });
    self.UI.inspectorView = UI.InspectorView.InspectorView.instance();
    UI.ContextMenu.ContextMenu.initialize();
    UI.ContextMenu.ContextMenu.installHandler(document);
    Logs.NetworkLog.NetworkLog.instance();
    SDK.FrameManager.FrameManager.instance();
    Logs.LogManager.LogManager.instance();
    IssuesManager.IssuesManager.IssuesManager.instance({
      forceNew: true,
      ensureFirst: true,
      showThirdPartyIssuesSetting: IssuesManager.Issue.getShowThirdPartyIssuesSetting(),
      hideIssueSetting: IssuesManager.IssuesManager.getHideIssueByCodeSetting()
    });
    IssuesManager.ContrastCheckTrigger.ContrastCheckTrigger.instance();
    self.SDK.consoleModel = SDK.ConsoleModel.ConsoleModel.instance();
    self.UI.dockController = UI.DockController.DockController.instance({ forceNew: true, canDock });
    self.SDK.multitargetNetworkManager = SDK.NetworkManager.MultitargetNetworkManager.instance({ forceNew: true });
    self.SDK.domDebuggerManager = SDK.DOMDebuggerModel.DOMDebuggerManager.instance({ forceNew: true });
    SDK.TargetManager.TargetManager.instance().addEventListener(SDK.TargetManager.Events.SuspendStateChanged, this.#onSuspendStateChanged.bind(this));
    self.Workspace.fileManager = Workspace.FileManager.FileManager.instance({ forceNew: true });
    self.Workspace.workspace = Workspace.Workspace.WorkspaceImpl.instance();
    self.Bindings.networkProjectManager = Bindings.NetworkProject.NetworkProjectManager.instance();
    self.Bindings.resourceMapping = Bindings.ResourceMapping.ResourceMapping.instance({
      forceNew: true,
      targetManager: SDK.TargetManager.TargetManager.instance(),
      workspace: Workspace.Workspace.WorkspaceImpl.instance()
    });
    new Bindings.PresentationConsoleMessageHelper.PresentationConsoleMessageManager();
    self.Bindings.cssWorkspaceBinding = Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance({
      forceNew: true,
      targetManager: SDK.TargetManager.TargetManager.instance(),
      workspace: Workspace.Workspace.WorkspaceImpl.instance()
    });
    self.Bindings.debuggerWorkspaceBinding = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance({
      forceNew: true,
      targetManager: SDK.TargetManager.TargetManager.instance(),
      workspace: Workspace.Workspace.WorkspaceImpl.instance()
    });
    self.Bindings.breakpointManager = Bindings.BreakpointManager.BreakpointManager.instance({
      forceNew: true,
      workspace: Workspace.Workspace.WorkspaceImpl.instance(),
      targetManager: SDK.TargetManager.TargetManager.instance(),
      debuggerWorkspaceBinding: Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance()
    });
    self.Extensions.extensionServer = Extensions.ExtensionServer.ExtensionServer.instance({ forceNew: true });
    new Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding(Persistence.IsolatedFileSystemManager.IsolatedFileSystemManager.instance(), Workspace.Workspace.WorkspaceImpl.instance());
    Persistence.IsolatedFileSystemManager.IsolatedFileSystemManager.instance().addPlatformFileSystem("snippet://", new Snippets.ScriptSnippetFileSystem.SnippetFileSystem());
    self.Persistence.persistence = Persistence.Persistence.PersistenceImpl.instance({
      forceNew: true,
      workspace: Workspace.Workspace.WorkspaceImpl.instance(),
      breakpointManager: Bindings.BreakpointManager.BreakpointManager.instance()
    });
    self.Persistence.networkPersistenceManager = Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance({ forceNew: true, workspace: Workspace.Workspace.WorkspaceImpl.instance() });
    self.Host.Platform = Host.Platform;
    new ExecutionContextSelector(SDK.TargetManager.TargetManager.instance(), UI.Context.Context.instance());
    self.Bindings.ignoreListManager = Bindings.IgnoreListManager.IgnoreListManager.instance({
      forceNew: true,
      debuggerWorkspaceBinding: Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance()
    });
    new PauseListener();
    const actionRegistryInstance = UI.ActionRegistry.ActionRegistry.instance({ forceNew: true });
    self.UI.actionRegistry = actionRegistryInstance;
    self.UI.shortcutRegistry = UI.ShortcutRegistry.ShortcutRegistry.instance({ forceNew: true, actionRegistry: actionRegistryInstance });
    this.#registerMessageSinkListener();
    MainImpl.timeEnd("Main._createAppUI");
    const appProvider = Common.AppProvider.getRegisteredAppProviders()[0];
    if (!appProvider) {
      throw new Error("Unable to boot DevTools, as the appprovider is missing");
    }
    await this.#showAppUI(await appProvider.loadAppProvider());
  }
  async #showAppUI(appProvider) {
    MainImpl.time("Main._showAppUI");
    const app = appProvider.createApp();
    UI.DockController.DockController.instance().initialize();
    app.presentUI(document);
    const toggleSearchNodeAction = UI.ActionRegistry.ActionRegistry.instance().action("elements.toggle-element-search");
    if (toggleSearchNodeAction) {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.EnterInspectElementMode, () => {
        void toggleSearchNodeAction.execute();
      }, this);
    }
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.RevealSourceLine, this.#revealSourceLine, this);
    await UI.InspectorView.InspectorView.instance().createToolbars();
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.loadCompleted();
    const value = Root.Runtime.Runtime.queryParam("loadTimelineFromURL");
    if (value !== null) {
      Timeline.TimelinePanel.LoadTimelineHandler.instance().handleQueryParam(value);
    }
    UI.ARIAUtils.alertElementInstance();
    window.setTimeout(this.#initializeTarget.bind(this), 0);
    MainImpl.timeEnd("Main._showAppUI");
  }
  async #initializeTarget() {
    MainImpl.time("Main._initializeTarget");
    for (const runnableInstanceFunction of Common.Runnable.earlyInitializationRunnables()) {
      await runnableInstanceFunction().run();
    }
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.readyForTest();
    this.#resolveReadyForTestPromise();
    window.setTimeout(this.#lateInitialization.bind(this), 100);
    MainImpl.timeEnd("Main._initializeTarget");
  }
  #lateInitialization() {
    MainImpl.time("Main._lateInitialization");
    Extensions.ExtensionServer.ExtensionServer.instance().initializeExtensions();
    const promises = Common.Runnable.lateInitializationRunnables().map(async (lateInitializationLoader) => {
      const runnable = await lateInitializationLoader();
      return runnable.run();
    });
    if (Root.Runtime.experiments.isEnabled("liveHeapProfile")) {
      const setting = "memoryLiveHeapProfile";
      if (Common.Settings.Settings.instance().moduleSetting(setting).get()) {
        promises.push(PerfUI.LiveHeapProfile.LiveHeapProfile.instance().run());
      } else {
        const changeListener = async (event) => {
          if (!event.data) {
            return;
          }
          Common.Settings.Settings.instance().moduleSetting(setting).removeChangeListener(changeListener);
          void PerfUI.LiveHeapProfile.LiveHeapProfile.instance().run();
        };
        Common.Settings.Settings.instance().moduleSetting(setting).addChangeListener(changeListener);
      }
    }
    this.#lateInitDonePromise = Promise.all(promises).then(() => void 0);
    MainImpl.timeEnd("Main._lateInitialization");
  }
  lateInitDonePromiseForTest() {
    return this.#lateInitDonePromise;
  }
  readyForTest() {
    return this.#readyForTestPromise;
  }
  #registerMessageSinkListener() {
    Common.Console.Console.instance().addEventListener(Common.Console.Events.MessageAdded, messageAdded);
    function messageAdded({ data: message }) {
      if (message.show) {
        Common.Console.Console.instance().show();
      }
    }
  }
  #revealSourceLine(event) {
    const { url, lineNumber, columnNumber } = event.data;
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url);
    if (uiSourceCode) {
      void Common.Revealer.reveal(uiSourceCode.uiLocation(lineNumber, columnNumber));
      return;
    }
    function listener(event2) {
      const uiSourceCode2 = event2.data;
      if (uiSourceCode2.url() === url) {
        void Common.Revealer.reveal(uiSourceCode2.uiLocation(lineNumber, columnNumber));
        Workspace.Workspace.WorkspaceImpl.instance().removeEventListener(Workspace.Workspace.Events.UISourceCodeAdded, listener);
      }
    }
    Workspace.Workspace.WorkspaceImpl.instance().addEventListener(Workspace.Workspace.Events.UISourceCodeAdded, listener);
  }
  #postDocumentKeyDown(event) {
    if (!event.handled) {
      UI.ShortcutRegistry.ShortcutRegistry.instance().handleShortcut(event);
    }
  }
  #redispatchClipboardEvent(event) {
    const eventCopy = new CustomEvent("clipboard-" + event.type, { bubbles: true });
    eventCopy["original"] = event;
    const document2 = event.target && event.target.ownerDocument;
    const target = document2 ? Platform.DOMUtilities.deepActiveElement(document2) : null;
    if (target) {
      target.dispatchEvent(eventCopy);
    }
    if (eventCopy.handled) {
      event.preventDefault();
    }
  }
  #contextMenuEventFired(event) {
    if (event.handled || event.target.classList.contains("popup-glasspane")) {
      event.preventDefault();
    }
  }
  #addMainEventListeners(document2) {
    document2.addEventListener("keydown", this.#postDocumentKeyDown.bind(this), false);
    document2.addEventListener("beforecopy", this.#redispatchClipboardEvent.bind(this), true);
    document2.addEventListener("copy", this.#redispatchClipboardEvent.bind(this), false);
    document2.addEventListener("cut", this.#redispatchClipboardEvent.bind(this), false);
    document2.addEventListener("paste", this.#redispatchClipboardEvent.bind(this), false);
    document2.addEventListener("contextmenu", this.#contextMenuEventFired.bind(this), true);
  }
  #onSuspendStateChanged() {
    const suspended = SDK.TargetManager.TargetManager.instance().allTargetsSuspended();
    UI.InspectorView.InspectorView.instance().onSuspendStateChanged(suspended);
  }
  static instanceForTest = null;
}
globalThis.Main = globalThis.Main || {};
globalThis.Main.Main = MainImpl;
let zoomActionDelegateInstance;
export class ZoomActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!zoomActionDelegateInstance || forceNew) {
      zoomActionDelegateInstance = new ZoomActionDelegate();
    }
    return zoomActionDelegateInstance;
  }
  handleAction(context, actionId) {
    if (Host.InspectorFrontendHost.InspectorFrontendHostInstance.isHostedMode()) {
      return false;
    }
    switch (actionId) {
      case "main.zoom-in":
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.zoomIn();
        return true;
      case "main.zoom-out":
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.zoomOut();
        return true;
      case "main.zoom-reset":
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.resetZoom();
        return true;
    }
    return false;
  }
}
let searchActionDelegateInstance;
export class SearchActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!searchActionDelegateInstance || forceNew) {
      searchActionDelegateInstance = new SearchActionDelegate();
    }
    return searchActionDelegateInstance;
  }
  handleAction(context, actionId) {
    let searchableView = UI.SearchableView.SearchableView.fromElement(Platform.DOMUtilities.deepActiveElement(document));
    if (!searchableView) {
      const currentPanel = UI.InspectorView.InspectorView.instance().currentPanelDeprecated();
      if (currentPanel && currentPanel.searchableView) {
        searchableView = currentPanel.searchableView();
      }
      if (!searchableView) {
        return false;
      }
    }
    switch (actionId) {
      case "main.search-in-panel.find":
        return searchableView.handleFindShortcut();
      case "main.search-in-panel.cancel":
        return searchableView.handleCancelSearchShortcut();
      case "main.search-in-panel.find-next":
        return searchableView.handleFindNextShortcut();
      case "main.search-in-panel.find-previous":
        return searchableView.handleFindPreviousShortcut();
    }
    return false;
  }
}
let mainMenuItemInstance;
export class MainMenuItem {
  #itemInternal;
  constructor() {
    this.#itemInternal = new UI.Toolbar.ToolbarMenuButton(this.#handleContextMenu.bind(this), true);
    this.#itemInternal.element.classList.add("main-menu");
    this.#itemInternal.setTitle(i18nString(UIStrings.customizeAndControlDevtools));
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!mainMenuItemInstance || forceNew) {
      mainMenuItemInstance = new MainMenuItem();
    }
    return mainMenuItemInstance;
  }
  item() {
    return this.#itemInternal;
  }
  #handleContextMenu(contextMenu) {
    if (UI.DockController.DockController.instance().canDock()) {
      const dockItemElement = document.createElement("div");
      dockItemElement.classList.add("flex-centered");
      dockItemElement.classList.add("flex-auto");
      dockItemElement.tabIndex = -1;
      UI.ARIAUtils.setAccessibleName(dockItemElement, UIStrings.dockSide);
      const titleElement = dockItemElement.createChild("span", "dockside-title");
      titleElement.textContent = i18nString(UIStrings.dockSide);
      const toggleDockSideShorcuts = UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutsForAction("main.toggle-dock");
      UI.Tooltip.Tooltip.install(titleElement, i18nString(UIStrings.placementOfDevtoolsRelativeToThe, { PH1: toggleDockSideShorcuts[0].title() }));
      dockItemElement.appendChild(titleElement);
      const dockItemToolbar = new UI.Toolbar.Toolbar("", dockItemElement);
      dockItemToolbar.makeBlueOnHover();
      const undock = new UI.Toolbar.ToolbarToggle(i18nString(UIStrings.undockIntoSeparateWindow), "largeicon-undock");
      const bottom = new UI.Toolbar.ToolbarToggle(i18nString(UIStrings.dockToBottom), "largeicon-dock-to-bottom");
      const right = new UI.Toolbar.ToolbarToggle(i18nString(UIStrings.dockToRight), "largeicon-dock-to-right");
      const left = new UI.Toolbar.ToolbarToggle(i18nString(UIStrings.dockToLeft), "largeicon-dock-to-left");
      undock.addEventListener(UI.Toolbar.ToolbarButton.Events.MouseDown, (event) => event.data.consume());
      bottom.addEventListener(UI.Toolbar.ToolbarButton.Events.MouseDown, (event) => event.data.consume());
      right.addEventListener(UI.Toolbar.ToolbarButton.Events.MouseDown, (event) => event.data.consume());
      left.addEventListener(UI.Toolbar.ToolbarButton.Events.MouseDown, (event) => event.data.consume());
      undock.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, setDockSide.bind(null, UI.DockController.DockState.UNDOCKED));
      bottom.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, setDockSide.bind(null, UI.DockController.DockState.BOTTOM));
      right.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, setDockSide.bind(null, UI.DockController.DockState.RIGHT));
      left.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, setDockSide.bind(null, UI.DockController.DockState.LEFT));
      undock.setToggled(UI.DockController.DockController.instance().dockSide() === UI.DockController.DockState.UNDOCKED);
      bottom.setToggled(UI.DockController.DockController.instance().dockSide() === UI.DockController.DockState.BOTTOM);
      right.setToggled(UI.DockController.DockController.instance().dockSide() === UI.DockController.DockState.RIGHT);
      left.setToggled(UI.DockController.DockController.instance().dockSide() === UI.DockController.DockState.LEFT);
      dockItemToolbar.appendToolbarItem(undock);
      dockItemToolbar.appendToolbarItem(left);
      dockItemToolbar.appendToolbarItem(bottom);
      dockItemToolbar.appendToolbarItem(right);
      dockItemElement.addEventListener("keydown", (event) => {
        let dir = 0;
        if (event.key === "ArrowLeft") {
          dir = -1;
        } else if (event.key === "ArrowRight") {
          dir = 1;
        } else {
          return;
        }
        const buttons = [undock, left, bottom, right];
        let index = buttons.findIndex((button2) => button2.element.hasFocus());
        index = Platform.NumberUtilities.clamp(index + dir, 0, buttons.length - 1);
        buttons[index].element.focus();
        event.consume(true);
      });
      contextMenu.headerSection().appendCustomItem(dockItemElement);
    }
    const button = this.#itemInternal.element;
    function setDockSide(side) {
      void UI.DockController.DockController.instance().once(UI.DockController.Events.AfterDockSideChanged).then(() => {
        button.focus();
      });
      UI.DockController.DockController.instance().setDockSide(side);
      contextMenu.discard();
    }
    if (UI.DockController.DockController.instance().dockSide() === UI.DockController.DockState.UNDOCKED) {
      const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
      if (mainTarget && mainTarget.type() === SDK.Target.Type.Frame) {
        contextMenu.defaultSection().appendAction("inspector_main.focus-debuggee", i18nString(UIStrings.focusDebuggee));
      }
    }
    contextMenu.defaultSection().appendAction("main.toggle-drawer", UI.InspectorView.InspectorView.instance().drawerVisible() ? i18nString(UIStrings.hideConsoleDrawer) : i18nString(UIStrings.showConsoleDrawer));
    contextMenu.appendItemsAtLocation("mainMenu");
    const moreTools = contextMenu.defaultSection().appendSubMenuItem(i18nString(UIStrings.moreTools));
    const viewExtensions = UI.ViewManager.getRegisteredViewExtensions();
    viewExtensions.sort((extension1, extension2) => {
      const title1 = extension1.title();
      const title2 = extension2.title();
      return title1.localeCompare(title2);
    });
    for (const viewExtension of viewExtensions) {
      const location = viewExtension.location();
      const persistence = viewExtension.persistence();
      const title = viewExtension.title();
      const id = viewExtension.viewId();
      if (id === "issues-pane") {
        moreTools.defaultSection().appendItem(title, () => {
          Host.userMetrics.issuesPanelOpenedFrom(Host.UserMetrics.IssueOpener.HamburgerMenu);
          void UI.ViewManager.ViewManager.instance().showView("issues-pane", true);
        });
        continue;
      }
      if (persistence !== "closeable") {
        continue;
      }
      if (location !== "drawer-view" && location !== "panel") {
        continue;
      }
      if (viewExtension.isPreviewFeature()) {
        const previewIcon = new IconButton.Icon.Icon();
        previewIcon.data = { iconName: "ic_preview_feature", color: "var(--icon-color)", width: "14px", height: "14px" };
        moreTools.defaultSection().appendItem(title, () => {
          void UI.ViewManager.ViewManager.instance().showView(id, true, false);
        }, false, previewIcon);
        continue;
      }
      moreTools.defaultSection().appendItem(title, () => {
        void UI.ViewManager.ViewManager.instance().showView(id, true, false);
      });
    }
    const helpSubMenu = contextMenu.footerSection().appendSubMenuItem(i18nString(UIStrings.help));
    helpSubMenu.appendItemsAtLocation("mainMenuHelp");
  }
}
let settingsButtonProviderInstance;
export class SettingsButtonProvider {
  #settingsButton;
  constructor() {
    const settingsActionId = "settings.show";
    this.#settingsButton = UI.Toolbar.Toolbar.createActionButtonForId(settingsActionId, { showLabel: false, userActionCode: void 0 });
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!settingsButtonProviderInstance || forceNew) {
      settingsButtonProviderInstance = new SettingsButtonProvider();
    }
    return settingsButtonProviderInstance;
  }
  item() {
    return this.#settingsButton;
  }
}
export class PauseListener {
  constructor() {
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DebuggerModel.DebuggerModel, SDK.DebuggerModel.Events.DebuggerPaused, this.#debuggerPaused, this);
  }
  #debuggerPaused(event) {
    SDK.TargetManager.TargetManager.instance().removeModelListener(SDK.DebuggerModel.DebuggerModel, SDK.DebuggerModel.Events.DebuggerPaused, this.#debuggerPaused, this);
    const debuggerModel = event.data;
    const debuggerPausedDetails = debuggerModel.debuggerPausedDetails();
    UI.Context.Context.instance().setFlavor(SDK.Target.Target, debuggerModel.target());
    void Common.Revealer.reveal(debuggerPausedDetails);
  }
}
export function sendOverProtocol(method, params) {
  return new Promise((resolve, reject) => {
    const sendRawMessage = ProtocolClient.InspectorBackend.test.sendRawMessage;
    if (!sendRawMessage) {
      return reject("Unable to send message to test client");
    }
    sendRawMessage(method, params, (err, ...results) => {
      if (err) {
        return reject(err);
      }
      return resolve(results);
    });
  });
}
let reloadActionDelegateInstance;
export class ReloadActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!reloadActionDelegateInstance || forceNew) {
      reloadActionDelegateInstance = new ReloadActionDelegate();
    }
    return reloadActionDelegateInstance;
  }
  handleAction(context, actionId) {
    switch (actionId) {
      case "main.debug-reload":
        Components.Reload.reload();
        return true;
    }
    return false;
  }
}
//# sourceMappingURL=MainImpl.js.map
