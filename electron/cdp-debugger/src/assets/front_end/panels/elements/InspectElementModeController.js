import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ElementsPanel } from "./ElementsPanel.js";
let inspectElementModeController;
export class InspectElementModeController {
  toggleSearchAction;
  mode;
  showDetailedInspectTooltipSetting;
  constructor() {
    this.toggleSearchAction = UI.ActionRegistry.ActionRegistry.instance().action("elements.toggle-element-search");
    this.mode = Protocol.Overlay.InspectMode.None;
    SDK.TargetManager.TargetManager.instance().addEventListener(SDK.TargetManager.Events.SuspendStateChanged, this.suspendStateChanged, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.OverlayModel.OverlayModel, SDK.OverlayModel.Events.ExitedInspectMode, () => this.setMode(Protocol.Overlay.InspectMode.None));
    SDK.OverlayModel.OverlayModel.setInspectNodeHandler(this.inspectNode.bind(this));
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.OverlayModel.OverlayModel, this);
    this.showDetailedInspectTooltipSetting = Common.Settings.Settings.instance().moduleSetting("showDetailedInspectTooltip");
    this.showDetailedInspectTooltipSetting.addChangeListener(this.showDetailedInspectTooltipChanged.bind(this));
    document.addEventListener("keydown", (event) => {
      if (event.keyCode !== UI.KeyboardShortcut.Keys.Esc.code) {
        return;
      }
      if (!this.isInInspectElementMode()) {
        return;
      }
      this.setMode(Protocol.Overlay.InspectMode.None);
      event.consume(true);
    }, true);
  }
  static instance({ forceNew } = { forceNew: false }) {
    if (!inspectElementModeController || forceNew) {
      inspectElementModeController = new InspectElementModeController();
    }
    return inspectElementModeController;
  }
  modelAdded(overlayModel) {
    if (this.mode === Protocol.Overlay.InspectMode.None) {
      return;
    }
    void overlayModel.setInspectMode(this.mode, this.showDetailedInspectTooltipSetting.get());
  }
  modelRemoved(_overlayModel) {
  }
  isInInspectElementMode() {
    return this.mode !== Protocol.Overlay.InspectMode.None;
  }
  toggleInspectMode() {
    let mode;
    if (this.isInInspectElementMode()) {
      mode = Protocol.Overlay.InspectMode.None;
    } else {
      mode = Common.Settings.Settings.instance().moduleSetting("showUAShadowDOM").get() ? Protocol.Overlay.InspectMode.SearchForUAShadowDOM : Protocol.Overlay.InspectMode.SearchForNode;
    }
    this.setMode(mode);
  }
  captureScreenshotMode() {
    this.setMode(Protocol.Overlay.InspectMode.CaptureAreaScreenshot);
  }
  setMode(mode) {
    if (SDK.TargetManager.TargetManager.instance().allTargetsSuspended()) {
      return;
    }
    this.mode = mode;
    for (const overlayModel of SDK.TargetManager.TargetManager.instance().models(SDK.OverlayModel.OverlayModel)) {
      void overlayModel.setInspectMode(mode, this.showDetailedInspectTooltipSetting.get());
    }
    if (this.toggleSearchAction) {
      this.toggleSearchAction.setToggled(this.isInInspectElementMode());
    }
  }
  suspendStateChanged() {
    if (!SDK.TargetManager.TargetManager.instance().allTargetsSuspended()) {
      return;
    }
    this.mode = Protocol.Overlay.InspectMode.None;
    if (this.toggleSearchAction) {
      this.toggleSearchAction.setToggled(false);
    }
  }
  inspectNode(node) {
    void ElementsPanel.instance().revealAndSelectNode(node, true, true);
  }
  showDetailedInspectTooltipChanged() {
    this.setMode(this.mode);
  }
}
let toggleSearchActionDelegateInstance;
export class ToggleSearchActionDelegate {
  handleAction(context, actionId) {
    if (Root.Runtime.Runtime.queryParam("isSharedWorker")) {
      return false;
    }
    inspectElementModeController = InspectElementModeController.instance();
    if (!inspectElementModeController) {
      return false;
    }
    if (actionId === "elements.toggle-element-search") {
      inspectElementModeController.toggleInspectMode();
    } else if (actionId === "elements.capture-area-screenshot") {
      inspectElementModeController.captureScreenshotMode();
    }
    return true;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!toggleSearchActionDelegateInstance || forceNew) {
      toggleSearchActionDelegateInstance = new ToggleSearchActionDelegate();
    }
    return toggleSearchActionDelegateInstance;
  }
}
//# sourceMappingURL=InspectElementModeController.js.map
