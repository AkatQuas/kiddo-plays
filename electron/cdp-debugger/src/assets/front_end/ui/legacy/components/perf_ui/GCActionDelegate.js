import * as SDK from "../../../../core/sdk/sdk.js";
let gCActionDelegateInstance;
export class GCActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!gCActionDelegateInstance || forceNew) {
      gCActionDelegateInstance = new GCActionDelegate();
    }
    return gCActionDelegateInstance;
  }
  handleAction(_context, _actionId) {
    for (const heapProfilerModel of SDK.TargetManager.TargetManager.instance().models(SDK.HeapProfilerModel.HeapProfilerModel)) {
      void heapProfilerModel.collectGarbage();
    }
    return true;
  }
}
//# sourceMappingURL=GCActionDelegate.js.map
