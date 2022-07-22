import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
export class OverviewController extends Common.ObjectWrapper.ObjectWrapper {
  currentUrl;
  constructor() {
    super();
    this.currentUrl = SDK.TargetManager.TargetManager.instance().inspectedURL();
    SDK.TargetManager.TargetManager.instance().addEventListener(SDK.TargetManager.Events.InspectedURLChanged, this.#checkUrlAndResetIfChanged, this);
  }
  #checkUrlAndResetIfChanged() {
    if (this.currentUrl === SDK.TargetManager.TargetManager.instance().inspectedURL()) {
      return;
    }
    this.currentUrl = SDK.TargetManager.TargetManager.instance().inspectedURL();
    this.dispatchEventToListeners(Events.Reset);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["RequestOverviewStart"] = "RequestOverviewStart";
  Events2["RequestNodeHighlight"] = "RequestNodeHighlight";
  Events2["PopulateNodes"] = "PopulateNodes";
  Events2["RequestOverviewCancel"] = "RequestOverviewCancel";
  Events2["OverviewCompleted"] = "OverviewCompleted";
  Events2["Reset"] = "Reset";
  return Events2;
})(Events || {});
//# sourceMappingURL=CSSOverviewController.js.map
