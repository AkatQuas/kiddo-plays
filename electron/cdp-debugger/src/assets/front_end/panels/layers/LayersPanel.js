import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as LayerViewer from "../layer_viewer/layer_viewer.js";
import { LayerPaintProfilerView } from "./LayerPaintProfilerView.js";
import { Events, LayerTreeModel } from "./LayerTreeModel.js";
const UIStrings = {
  details: "Details",
  profiler: "Profiler"
};
const str_ = i18n.i18n.registerUIStrings("panels/layers/LayersPanel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let layersPanelInstance;
export class LayersPanel extends UI.Panel.PanelWithSidebar {
  model;
  layerViewHost;
  layerTreeOutline;
  rightSplitWidget;
  layers3DView;
  tabbedPane;
  layerDetailsView;
  paintProfilerView;
  updateThrottler;
  layerBeingProfiled;
  constructor() {
    super("layers", 225);
    this.model = null;
    SDK.TargetManager.TargetManager.instance().observeTargets(this);
    this.layerViewHost = new LayerViewer.LayerViewHost.LayerViewHost();
    this.layerTreeOutline = new LayerViewer.LayerTreeOutline.LayerTreeOutline(this.layerViewHost);
    this.layerTreeOutline.addEventListener(LayerViewer.LayerTreeOutline.Events.PaintProfilerRequested, this.onPaintProfileRequested, this);
    this.panelSidebarElement().appendChild(this.layerTreeOutline.element);
    this.setDefaultFocusedElement(this.layerTreeOutline.element);
    this.rightSplitWidget = new UI.SplitWidget.SplitWidget(false, true, "layerDetailsSplitViewState");
    this.splitWidget().setMainWidget(this.rightSplitWidget);
    this.layers3DView = new LayerViewer.Layers3DView.Layers3DView(this.layerViewHost);
    this.rightSplitWidget.setMainWidget(this.layers3DView);
    this.layers3DView.addEventListener(LayerViewer.Layers3DView.Events.PaintProfilerRequested, this.onPaintProfileRequested, this);
    this.layers3DView.addEventListener(LayerViewer.Layers3DView.Events.ScaleChanged, this.onScaleChanged, this);
    this.tabbedPane = new UI.TabbedPane.TabbedPane();
    this.rightSplitWidget.setSidebarWidget(this.tabbedPane);
    this.layerDetailsView = new LayerViewer.LayerDetailsView.LayerDetailsView(this.layerViewHost);
    this.layerDetailsView.addEventListener(LayerViewer.LayerDetailsView.Events.PaintProfilerRequested, this.onPaintProfileRequested, this);
    this.tabbedPane.appendTab(DetailsViewTabs.Details, i18nString(UIStrings.details), this.layerDetailsView);
    this.paintProfilerView = new LayerPaintProfilerView(this.showImage.bind(this));
    this.tabbedPane.addEventListener(UI.TabbedPane.Events.TabClosed, this.onTabClosed, this);
    this.updateThrottler = new Common.Throttler.Throttler(100);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!layersPanelInstance || forceNew) {
      layersPanelInstance = new LayersPanel();
    }
    return layersPanelInstance;
  }
  focus() {
    this.layerTreeOutline.focus();
  }
  wasShown() {
    super.wasShown();
    if (this.model) {
      this.model.enable();
    }
  }
  willHide() {
    if (this.model) {
      void this.model.disable();
    }
    super.willHide();
  }
  targetAdded(target) {
    if (this.model) {
      return;
    }
    this.model = target.model(LayerTreeModel);
    if (!this.model) {
      return;
    }
    this.model.addEventListener(Events.LayerTreeChanged, this.onLayerTreeUpdated, this);
    this.model.addEventListener(Events.LayerPainted, this.onLayerPainted, this);
    if (this.isShowing()) {
      this.model.enable();
    }
  }
  targetRemoved(target) {
    if (!this.model || this.model.target() !== target) {
      return;
    }
    this.model.removeEventListener(Events.LayerTreeChanged, this.onLayerTreeUpdated, this);
    this.model.removeEventListener(Events.LayerPainted, this.onLayerPainted, this);
    void this.model.disable();
    this.model = null;
  }
  onLayerTreeUpdated() {
    void this.updateThrottler.schedule(this.update.bind(this));
  }
  update() {
    if (this.model) {
      this.layerViewHost.setLayerTree(this.model.layerTree());
      const resourceModel = this.model.target().model(SDK.ResourceTreeModel.ResourceTreeModel);
      if (resourceModel) {
        const mainFrame = resourceModel.mainFrame;
        if (mainFrame) {
          const url = mainFrame.url;
          this.element.setAttribute("test-current-url", url);
        }
      }
    }
    return Promise.resolve();
  }
  onLayerPainted({ data: layer }) {
    if (!this.model) {
      return;
    }
    const selection = this.layerViewHost.selection();
    if (selection && selection.layer() === layer) {
      this.layerDetailsView.update();
    }
    this.layers3DView.updateLayerSnapshot(layer);
  }
  onPaintProfileRequested({ data: selection }) {
    void this.layers3DView.snapshotForSelection(selection).then((snapshotWithRect) => {
      if (!snapshotWithRect) {
        return;
      }
      this.layerBeingProfiled = selection.layer();
      if (!this.tabbedPane.hasTab(DetailsViewTabs.Profiler)) {
        this.tabbedPane.appendTab(DetailsViewTabs.Profiler, i18nString(UIStrings.profiler), this.paintProfilerView, void 0, true, true);
      }
      this.tabbedPane.selectTab(DetailsViewTabs.Profiler);
      this.paintProfilerView.profile(snapshotWithRect.snapshot);
    });
  }
  onTabClosed(event) {
    if (event.data.tabId !== DetailsViewTabs.Profiler || !this.layerBeingProfiled) {
      return;
    }
    this.paintProfilerView.reset();
    this.layers3DView.showImageForLayer(this.layerBeingProfiled, void 0);
    this.layerBeingProfiled = null;
  }
  showImage(imageURL) {
    if (this.layerBeingProfiled) {
      this.layers3DView.showImageForLayer(this.layerBeingProfiled, imageURL);
    }
  }
  onScaleChanged(event) {
    this.paintProfilerView.setScale(event.data);
  }
}
export const DetailsViewTabs = {
  Details: "details",
  Profiler: "profiler"
};
//# sourceMappingURL=LayersPanel.js.map
