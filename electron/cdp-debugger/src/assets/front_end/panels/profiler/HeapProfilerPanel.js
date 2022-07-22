import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ProfilesPanel } from "./ProfilesPanel.js";
import { instance } from "./ProfileTypeRegistry.js";
const UIStrings = {
  revealInSummaryView: "Reveal in Summary view"
};
const str_ = i18n.i18n.registerUIStrings("panels/profiler/HeapProfilerPanel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let heapProfilerPanelInstance;
export class HeapProfilerPanel extends ProfilesPanel {
  constructor() {
    const registry = instance;
    const profileTypes = [registry.heapSnapshotProfileType, registry.trackingHeapSnapshotProfileType, registry.samplingHeapProfileType];
    super("heap_profiler", profileTypes, "profiler.heap-toggle-recording");
  }
  static instance() {
    if (!heapProfilerPanelInstance) {
      heapProfilerPanelInstance = new HeapProfilerPanel();
    }
    return heapProfilerPanelInstance;
  }
  appendApplicableItems(event, contextMenu, target) {
    if (!(target instanceof SDK.RemoteObject.RemoteObject)) {
      return;
    }
    if (!this.isShowing()) {
      return;
    }
    const object = target;
    if (!object.objectId) {
      return;
    }
    const objectId = object.objectId;
    const heapProfiles = instance.heapSnapshotProfileType.getProfiles();
    if (!heapProfiles.length) {
      return;
    }
    const heapProfilerModel = object.runtimeModel().heapProfilerModel();
    if (!heapProfilerModel) {
      return;
    }
    function revealInView(viewName) {
      void heapProfilerModel.snapshotObjectIdForObjectId(objectId).then((result) => {
        if (this.isShowing() && result) {
          this.showObject(result, viewName);
        }
      });
    }
    contextMenu.revealSection().appendItem(i18nString(UIStrings.revealInSummaryView), revealInView.bind(this, "Summary"));
  }
  handleAction(_context, _actionId) {
    const panel = UI.Context.Context.instance().flavor(HeapProfilerPanel);
    console.assert(Boolean(panel) && panel instanceof HeapProfilerPanel);
    if (panel) {
      panel.toggleRecord();
    }
    return true;
  }
  wasShown() {
    super.wasShown();
    UI.Context.Context.instance().setFlavor(HeapProfilerPanel, this);
    Host.userMetrics.panelLoaded("heap_profiler", "DevTools.Launch.HeapProfiler");
  }
  willHide() {
    UI.Context.Context.instance().setFlavor(HeapProfilerPanel, null);
  }
  showObject(snapshotObjectId, perspectiveName) {
    const registry = instance;
    const heapProfiles = registry.heapSnapshotProfileType.getProfiles();
    for (let i = 0; i < heapProfiles.length; i++) {
      const profile = heapProfiles[i];
      if (profile.maxJSObjectId >= parseInt(snapshotObjectId, 10)) {
        this.showProfile(profile);
        const view = this.viewForProfile(profile);
        void view.selectLiveObject(perspectiveName, snapshotObjectId);
        break;
      }
    }
  }
}
//# sourceMappingURL=HeapProfilerPanel.js.map
