import * as Host from "../../core/host/host.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ThemeSupport from "../../ui/legacy/theme_support/theme_support.js";
import { DeviceModeWrapper } from "./DeviceModeWrapper.js";
import { Events, InspectedPagePlaceholder } from "./InspectedPagePlaceholder.js";
let appInstance;
export class AdvancedApp {
  rootSplitWidget;
  deviceModeView;
  inspectedPagePlaceholder;
  toolboxWindow;
  toolboxRootView;
  changingDockSide;
  constructor() {
    UI.DockController.DockController.instance().addEventListener(UI.DockController.Events.BeforeDockSideChanged, this.openToolboxWindow, this);
  }
  static instance() {
    if (!appInstance) {
      appInstance = new AdvancedApp();
    }
    return appInstance;
  }
  presentUI(document) {
    const rootView = new UI.RootView.RootView();
    this.rootSplitWidget = new UI.SplitWidget.SplitWidget(false, true, "InspectorView.splitViewState", 555, 300, true);
    this.rootSplitWidget.show(rootView.element);
    this.rootSplitWidget.setSidebarWidget(UI.InspectorView.InspectorView.instance());
    this.rootSplitWidget.setDefaultFocusedChild(UI.InspectorView.InspectorView.instance());
    UI.InspectorView.InspectorView.instance().setOwnerSplit(this.rootSplitWidget);
    this.inspectedPagePlaceholder = InspectedPagePlaceholder.instance();
    this.inspectedPagePlaceholder.addEventListener(Events.Update, this.onSetInspectedPageBounds.bind(this), this);
    this.deviceModeView = DeviceModeWrapper.instance({ inspectedPagePlaceholder: this.inspectedPagePlaceholder, forceNew: false });
    UI.DockController.DockController.instance().addEventListener(UI.DockController.Events.BeforeDockSideChanged, this.onBeforeDockSideChange, this);
    UI.DockController.DockController.instance().addEventListener(UI.DockController.Events.DockSideChanged, this.onDockSideChange, this);
    UI.DockController.DockController.instance().addEventListener(UI.DockController.Events.AfterDockSideChanged, this.onAfterDockSideChange, this);
    this.onDockSideChange();
    console.timeStamp("AdvancedApp.attachToBody");
    rootView.attachToDocument(document);
    rootView.focus();
    this.inspectedPagePlaceholder.update();
  }
  openToolboxWindow(event) {
    if (event.data.to !== UI.DockController.DockState.UNDOCKED) {
      return;
    }
    if (this.toolboxWindow) {
      return;
    }
    const url = window.location.href.replace("devtools_app.html", "device_mode_emulation_frame.html");
    this.toolboxWindow = window.open(url, void 0);
  }
  deviceModeEmulationFrameLoaded(toolboxDocument) {
    ThemeSupport.ThemeSupport.instance().applyTheme(toolboxDocument);
    ThemeSupport.ThemeSupport.instance().addEventListener(ThemeSupport.ThemeChangeEvent.eventName, () => {
      ThemeSupport.ThemeSupport.instance().applyTheme(toolboxDocument);
    });
    UI.UIUtils.initializeUIUtils(toolboxDocument);
    UI.UIUtils.installComponentRootStyles(toolboxDocument.body);
    UI.ContextMenu.ContextMenu.installHandler(toolboxDocument);
    this.toolboxRootView = new UI.RootView.RootView();
    this.toolboxRootView.attachToDocument(toolboxDocument);
    this.updateDeviceModeView();
  }
  updateDeviceModeView() {
    if (this.isDocked()) {
      this.rootSplitWidget.setMainWidget(this.deviceModeView);
    } else if (this.toolboxRootView) {
      this.deviceModeView.show(this.toolboxRootView.element);
    }
  }
  onBeforeDockSideChange(event) {
    if (event.data.to === UI.DockController.DockState.UNDOCKED && this.toolboxRootView) {
      this.rootSplitWidget.hideSidebar();
      this.inspectedPagePlaceholder.update();
    }
    this.changingDockSide = true;
  }
  onDockSideChange(event) {
    this.updateDeviceModeView();
    const toDockSide = event ? event.data.to : UI.DockController.DockController.instance().dockSide();
    if (toDockSide === void 0) {
      throw new Error("Got onDockSideChange event with unexpected undefined for dockSide()");
    }
    if (toDockSide === UI.DockController.DockState.UNDOCKED) {
      this.updateForUndocked();
    } else if (this.toolboxRootView && event && event.data.from === UI.DockController.DockState.UNDOCKED) {
      this.rootSplitWidget.hideSidebar();
    } else {
      this.updateForDocked(toDockSide);
    }
  }
  onAfterDockSideChange(event) {
    if (!this.changingDockSide) {
      return;
    }
    if (event.data.from && event.data.from === UI.DockController.DockState.UNDOCKED) {
      this.updateForDocked(event.data.to);
    }
    this.changingDockSide = false;
    this.inspectedPagePlaceholder.update();
  }
  updateForDocked(dockSide) {
    const resizerElement = this.rootSplitWidget.resizerElement();
    resizerElement.style.transform = dockSide === UI.DockController.DockState.RIGHT ? "translateX(2px)" : dockSide === UI.DockController.DockState.LEFT ? "translateX(-2px)" : "";
    this.rootSplitWidget.setVertical(dockSide === UI.DockController.DockState.RIGHT || dockSide === UI.DockController.DockState.LEFT);
    this.rootSplitWidget.setSecondIsSidebar(dockSide === UI.DockController.DockState.RIGHT || dockSide === UI.DockController.DockState.BOTTOM);
    this.rootSplitWidget.toggleResizer(this.rootSplitWidget.resizerElement(), true);
    this.rootSplitWidget.toggleResizer(UI.InspectorView.InspectorView.instance().topResizerElement(), dockSide === UI.DockController.DockState.BOTTOM);
    this.rootSplitWidget.showBoth();
  }
  updateForUndocked() {
    this.rootSplitWidget.toggleResizer(this.rootSplitWidget.resizerElement(), false);
    this.rootSplitWidget.toggleResizer(UI.InspectorView.InspectorView.instance().topResizerElement(), false);
    this.rootSplitWidget.hideMain();
  }
  isDocked() {
    return UI.DockController.DockController.instance().dockSide() !== UI.DockController.DockState.UNDOCKED;
  }
  onSetInspectedPageBounds(event) {
    if (this.changingDockSide) {
      return;
    }
    const window2 = this.inspectedPagePlaceholder.element.window();
    if (!window2.innerWidth || !window2.innerHeight) {
      return;
    }
    if (!this.inspectedPagePlaceholder.isShowing()) {
      return;
    }
    const bounds = event.data;
    console.timeStamp("AdvancedApp.setInspectedPageBounds");
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.setInspectedPageBounds(bounds);
  }
}
globalThis.Emulation = globalThis.Emulation || {};
globalThis.Emulation.AdvancedApp = AdvancedApp;
let advancedAppProviderInstance;
export class AdvancedAppProvider {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!advancedAppProviderInstance || forceNew) {
      advancedAppProviderInstance = new AdvancedAppProvider();
    }
    return advancedAppProviderInstance;
  }
  createApp() {
    return AdvancedApp.instance();
  }
}
//# sourceMappingURL=AdvancedApp.js.map
