import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as TimelineModel from "../../models/timeline_model/timeline_model.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import { EventsTimelineTreeView } from "./EventsTimelineTreeView.js";
import { Events } from "./PerformanceModel.js";
import { TimelineLayersView } from "./TimelineLayersView.js";
import { TimelinePaintProfilerView } from "./TimelinePaintProfilerView.js";
import { TimelineSelection } from "./TimelinePanel.js";
import { BottomUpTimelineTreeView, CallTreeTimelineTreeView } from "./TimelineTreeView.js";
import { TimelineDetailsContentHelper, TimelineUIUtils } from "./TimelineUIUtils.js";
const UIStrings = {
  summary: "Summary",
  bottomup: "Bottom-Up",
  callTree: "Call Tree",
  eventLog: "Event Log",
  estimated: "estimated",
  totalBlockingTimeSmss: "Total blocking time: {PH1}ms{PH2}",
  learnMore: "Learn more",
  layers: "Layers",
  paintProfiler: "Paint Profiler",
  rangeSS: "Range:  {PH1} \u2013 {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("panels/timeline/TimelineDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TimelineDetailsView extends UI.Widget.VBox {
  detailsLinkifier;
  tabbedPane;
  defaultDetailsWidget;
  defaultDetailsContentElement;
  rangeDetailViews;
  additionalMetricsToolbar;
  model;
  track;
  lazyPaintProfilerView;
  lazyLayersView;
  preferredTabId;
  selection;
  constructor(delegate) {
    super();
    this.element.classList.add("timeline-details");
    this.detailsLinkifier = new Components.Linkifier.Linkifier();
    this.tabbedPane = new UI.TabbedPane.TabbedPane();
    this.tabbedPane.show(this.element);
    this.defaultDetailsWidget = new UI.Widget.VBox();
    this.defaultDetailsWidget.element.classList.add("timeline-details-view");
    this.defaultDetailsContentElement = this.defaultDetailsWidget.element.createChild("div", "timeline-details-view-body vbox");
    this.appendTab(Tab.Details, i18nString(UIStrings.summary), this.defaultDetailsWidget);
    this.setPreferredTab(Tab.Details);
    this.rangeDetailViews = /* @__PURE__ */ new Map();
    const bottomUpView = new BottomUpTimelineTreeView();
    this.appendTab(Tab.BottomUp, i18nString(UIStrings.bottomup), bottomUpView);
    this.rangeDetailViews.set(Tab.BottomUp, bottomUpView);
    const callTreeView = new CallTreeTimelineTreeView();
    this.appendTab(Tab.CallTree, i18nString(UIStrings.callTree), callTreeView);
    this.rangeDetailViews.set(Tab.CallTree, callTreeView);
    const eventsView = new EventsTimelineTreeView(delegate);
    this.appendTab(Tab.EventLog, i18nString(UIStrings.eventLog), eventsView);
    this.rangeDetailViews.set(Tab.EventLog, eventsView);
    this.additionalMetricsToolbar = new UI.Toolbar.Toolbar("timeline-additional-metrics");
    this.element.appendChild(this.additionalMetricsToolbar.element);
    this.tabbedPane.addEventListener(UI.TabbedPane.Events.TabSelected, this.tabSelected, this);
  }
  setModel(model, track) {
    if (this.model !== model) {
      if (this.model) {
        this.model.removeEventListener(Events.WindowChanged, this.onWindowChanged, this);
      }
      this.model = model;
      if (this.model) {
        this.model.addEventListener(Events.WindowChanged, this.onWindowChanged, this);
      }
    }
    this.track = track;
    this.tabbedPane.closeTabs([Tab.PaintProfiler, Tab.LayerViewer], false);
    for (const view of this.rangeDetailViews.values()) {
      view.setModel(model, track);
    }
    this.lazyPaintProfilerView = null;
    this.lazyLayersView = null;
    this.setSelection(null);
    this.additionalMetricsToolbar.removeToolbarItems();
    if (model && model.timelineModel()) {
      const { estimated, time } = model.timelineModel().totalBlockingTime();
      const isEstimate = estimated ? ` (${i18nString(UIStrings.estimated)})` : "";
      const message = i18nString(UIStrings.totalBlockingTimeSmss, { PH1: time.toFixed(2), PH2: isEstimate });
      const warning = document.createElement("span");
      const clsLink = UI.XLink.XLink.create("https://web.dev/tbt/", i18nString(UIStrings.learnMore));
      clsLink.style.marginRight = "2px";
      warning.appendChild(clsLink);
      this.additionalMetricsToolbar.appendText(message);
      this.additionalMetricsToolbar.appendToolbarItem(new UI.Toolbar.ToolbarItem(warning));
    }
  }
  setContent(node) {
    const allTabs = this.tabbedPane.otherTabs(Tab.Details);
    for (let i = 0; i < allTabs.length; ++i) {
      if (!this.rangeDetailViews.has(allTabs[i])) {
        this.tabbedPane.closeTab(allTabs[i]);
      }
    }
    this.defaultDetailsContentElement.removeChildren();
    this.defaultDetailsContentElement.appendChild(node);
  }
  updateContents() {
    const view = this.rangeDetailViews.get(this.tabbedPane.selectedTabId || "");
    if (view) {
      const window = this.model.window();
      view.updateContents(this.selection || TimelineSelection.fromRange(window.left, window.right));
    }
  }
  appendTab(id, tabTitle, view, isCloseable) {
    this.tabbedPane.appendTab(id, tabTitle, view, void 0, void 0, isCloseable);
    if (this.preferredTabId !== this.tabbedPane.selectedTabId) {
      this.tabbedPane.selectTab(id);
    }
  }
  headerElement() {
    return this.tabbedPane.headerElement();
  }
  setPreferredTab(tabId) {
    this.preferredTabId = tabId;
  }
  onWindowChanged() {
    if (!this.selection) {
      this.updateContentsFromWindow();
    }
  }
  updateContentsFromWindow() {
    if (!this.model) {
      this.setContent(UI.Fragment.html`<div/>`);
      return;
    }
    const window = this.model.window();
    this.updateSelectedRangeStats(window.left, window.right);
    this.updateContents();
  }
  setSelection(selection) {
    this.detailsLinkifier.reset();
    this.selection = selection;
    if (!this.selection) {
      this.updateContentsFromWindow();
      return;
    }
    switch (this.selection.type()) {
      case TimelineSelection.Type.TraceEvent: {
        const event = this.selection.object();
        void TimelineUIUtils.buildTraceEventDetails(event, this.model.timelineModel(), this.detailsLinkifier, true).then((fragment) => this.appendDetailsTabsForTraceEventAndShowDetails(event, fragment));
        break;
      }
      case TimelineSelection.Type.Frame: {
        const frame = this.selection.object();
        const filmStripFrame = this.model.filmStripModelFrame(frame);
        this.setContent(TimelineUIUtils.generateDetailsContentForFrame(frame, filmStripFrame));
        if (frame.layerTree) {
          const layersView = this.layersView();
          layersView.showLayerTree(frame.layerTree);
          if (!this.tabbedPane.hasTab(Tab.LayerViewer)) {
            this.appendTab(Tab.LayerViewer, i18nString(UIStrings.layers), layersView);
          }
        }
        break;
      }
      case TimelineSelection.Type.NetworkRequest: {
        const request = this.selection.object();
        void TimelineUIUtils.buildNetworkRequestDetails(request, this.model.timelineModel(), this.detailsLinkifier).then(this.setContent.bind(this));
        break;
      }
      case TimelineSelection.Type.Range: {
        this.updateSelectedRangeStats(this.selection.startTime(), this.selection.endTime());
        break;
      }
    }
    this.updateContents();
  }
  tabSelected(event) {
    if (!event.data.isUserGesture) {
      return;
    }
    this.setPreferredTab(event.data.tabId);
    this.updateContents();
  }
  layersView() {
    if (this.lazyLayersView) {
      return this.lazyLayersView;
    }
    this.lazyLayersView = new TimelineLayersView(this.model.timelineModel(), this.showSnapshotInPaintProfiler.bind(this));
    return this.lazyLayersView;
  }
  paintProfilerView() {
    if (this.lazyPaintProfilerView) {
      return this.lazyPaintProfilerView;
    }
    this.lazyPaintProfilerView = new TimelinePaintProfilerView(this.model.frameModel());
    return this.lazyPaintProfilerView;
  }
  showSnapshotInPaintProfiler(snapshot) {
    const paintProfilerView = this.paintProfilerView();
    paintProfilerView.setSnapshot(snapshot);
    if (!this.tabbedPane.hasTab(Tab.PaintProfiler)) {
      this.appendTab(Tab.PaintProfiler, i18nString(UIStrings.paintProfiler), paintProfilerView, true);
    }
    this.tabbedPane.selectTab(Tab.PaintProfiler, true);
  }
  appendDetailsTabsForTraceEventAndShowDetails(event, content) {
    this.setContent(content);
    if (event.name === TimelineModel.TimelineModel.RecordType.Paint || event.name === TimelineModel.TimelineModel.RecordType.RasterTask) {
      this.showEventInPaintProfiler(event);
    }
  }
  showEventInPaintProfiler(event) {
    const paintProfilerModel = SDK.TargetManager.TargetManager.instance().models(SDK.PaintProfiler.PaintProfilerModel)[0];
    if (!paintProfilerModel) {
      return;
    }
    const paintProfilerView = this.paintProfilerView();
    const hasProfileData = paintProfilerView.setEvent(paintProfilerModel, event);
    if (!hasProfileData) {
      return;
    }
    if (this.tabbedPane.hasTab(Tab.PaintProfiler)) {
      return;
    }
    this.appendTab(Tab.PaintProfiler, i18nString(UIStrings.paintProfiler), paintProfilerView);
  }
  updateSelectedRangeStats(startTime, endTime) {
    if (!this.model || !this.track) {
      return;
    }
    const aggregatedStats = TimelineUIUtils.statsForTimeRange(this.track.syncEvents(), startTime, endTime);
    const startOffset = startTime - this.model.timelineModel().minimumRecordTime();
    const endOffset = endTime - this.model.timelineModel().minimumRecordTime();
    const contentHelper = new TimelineDetailsContentHelper(null, null);
    contentHelper.addSection(i18nString(UIStrings.rangeSS, { PH1: i18n.TimeUtilities.millisToString(startOffset), PH2: i18n.TimeUtilities.millisToString(endOffset) }));
    const pieChart = TimelineUIUtils.generatePieChart(aggregatedStats);
    contentHelper.appendElementRow("", pieChart);
    this.setContent(contentHelper.fragment);
  }
}
export var Tab = /* @__PURE__ */ ((Tab2) => {
  Tab2["Details"] = "Details";
  Tab2["EventLog"] = "EventLog";
  Tab2["CallTree"] = "CallTree";
  Tab2["BottomUp"] = "BottomUp";
  Tab2["PaintProfiler"] = "PaintProfiler";
  Tab2["LayerViewer"] = "LayerViewer";
  return Tab2;
})(Tab || {});
//# sourceMappingURL=TimelineDetailsView.js.map
