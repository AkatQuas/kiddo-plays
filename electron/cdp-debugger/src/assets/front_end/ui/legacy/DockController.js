import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import { ToolbarButton } from "./Toolbar.js";
const UIStrings = {
  close: "Close",
  dockToRight: "Dock to right",
  dockToBottom: "Dock to bottom",
  dockToLeft: "Dock to left",
  undockIntoSeparateWindow: "Undock into separate window"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/DockController.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let dockControllerInstance;
export class DockController extends Common.ObjectWrapper.ObjectWrapper {
  canDockInternal;
  closeButton;
  currentDockStateSetting;
  lastDockStateSetting;
  dockSideInternal = void 0;
  titles;
  savedFocus;
  constructor(canDock) {
    super();
    this.canDockInternal = canDock;
    this.closeButton = new ToolbarButton(i18nString(UIStrings.close), "largeicon-delete");
    this.closeButton.element.classList.add("close-devtools");
    this.closeButton.addEventListener(ToolbarButton.Events.Click, Host.InspectorFrontendHost.InspectorFrontendHostInstance.closeWindow.bind(Host.InspectorFrontendHost.InspectorFrontendHostInstance));
    this.currentDockStateSetting = Common.Settings.Settings.instance().moduleSetting("currentDockState");
    this.lastDockStateSetting = Common.Settings.Settings.instance().createSetting("lastDockState", DockState.BOTTOM);
    if (!canDock) {
      this.dockSideInternal = DockState.UNDOCKED;
      this.closeButton.setVisible(false);
      return;
    }
    this.currentDockStateSetting.addChangeListener(this.dockSideChanged, this);
    if (states.indexOf(this.currentDockStateSetting.get()) === -1) {
      this.currentDockStateSetting.set(DockState.RIGHT);
    }
    if (states.indexOf(this.lastDockStateSetting.get()) === -1) {
      this.currentDockStateSetting.set(DockState.BOTTOM);
    }
  }
  static instance(opts = { forceNew: null, canDock: false }) {
    const { forceNew, canDock } = opts;
    if (!dockControllerInstance || forceNew) {
      dockControllerInstance = new DockController(canDock);
    }
    return dockControllerInstance;
  }
  initialize() {
    if (!this.canDockInternal) {
      return;
    }
    this.titles = [
      i18nString(UIStrings.dockToRight),
      i18nString(UIStrings.dockToBottom),
      i18nString(UIStrings.dockToLeft),
      i18nString(UIStrings.undockIntoSeparateWindow)
    ];
    this.dockSideChanged();
  }
  dockSideChanged() {
    this.setDockSide(this.currentDockStateSetting.get());
  }
  dockSide() {
    return this.dockSideInternal;
  }
  canDock() {
    return this.canDockInternal;
  }
  isVertical() {
    return this.dockSideInternal === DockState.RIGHT || this.dockSideInternal === DockState.LEFT;
  }
  setDockSide(dockSide) {
    if (states.indexOf(dockSide) === -1) {
      dockSide = states[0];
    }
    if (this.dockSideInternal === dockSide) {
      return;
    }
    if (this.dockSideInternal !== void 0) {
      document.body.classList.remove(this.dockSideInternal);
    }
    document.body.classList.add(dockSide);
    if (this.dockSideInternal) {
      this.lastDockStateSetting.set(this.dockSideInternal);
    }
    this.savedFocus = Platform.DOMUtilities.deepActiveElement(document);
    const eventData = { from: this.dockSideInternal, to: dockSide };
    this.dispatchEventToListeners(Events.BeforeDockSideChanged, eventData);
    console.timeStamp("DockController.setIsDocked");
    this.dockSideInternal = dockSide;
    this.currentDockStateSetting.set(dockSide);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.setIsDocked(dockSide !== DockState.UNDOCKED, this.setIsDockedResponse.bind(this, eventData));
    this.closeButton.setVisible(this.dockSideInternal !== DockState.UNDOCKED);
    this.dispatchEventToListeners(Events.DockSideChanged, eventData);
  }
  setIsDockedResponse(eventData) {
    this.dispatchEventToListeners(Events.AfterDockSideChanged, eventData);
    if (this.savedFocus) {
      this.savedFocus.focus();
      this.savedFocus = null;
    }
  }
  toggleDockSide() {
    if (this.lastDockStateSetting.get() === this.currentDockStateSetting.get()) {
      const index = states.indexOf(this.currentDockStateSetting.get()) || 0;
      this.lastDockStateSetting.set(states[(index + 1) % states.length]);
    }
    this.setDockSide(this.lastDockStateSetting.get());
  }
}
export var DockState = /* @__PURE__ */ ((DockState2) => {
  DockState2["BOTTOM"] = "bottom";
  DockState2["RIGHT"] = "right";
  DockState2["LEFT"] = "left";
  DockState2["UNDOCKED"] = "undocked";
  return DockState2;
})(DockState || {});
const states = ["right" /* RIGHT */, "bottom" /* BOTTOM */, "left" /* LEFT */, "undocked" /* UNDOCKED */];
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["BeforeDockSideChanged"] = "BeforeDockSideChanged";
  Events2["DockSideChanged"] = "DockSideChanged";
  Events2["AfterDockSideChanged"] = "AfterDockSideChanged";
  return Events2;
})(Events || {});
let toggleDockActionDelegateInstance;
export class ToggleDockActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!toggleDockActionDelegateInstance || forceNew) {
      toggleDockActionDelegateInstance = new ToggleDockActionDelegate();
    }
    return toggleDockActionDelegateInstance;
  }
  handleAction(_context, _actionId) {
    DockController.instance().toggleDockSide();
    return true;
  }
}
let closeButtonProviderInstance;
export class CloseButtonProvider {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!closeButtonProviderInstance || forceNew) {
      closeButtonProviderInstance = new CloseButtonProvider();
    }
    return closeButtonProviderInstance;
  }
  item() {
    return DockController.instance().closeButton;
  }
}
//# sourceMappingURL=DockController.js.map
