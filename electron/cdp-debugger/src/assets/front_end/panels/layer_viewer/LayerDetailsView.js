import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import layerDetailsViewStyles from "./layerDetailsView.css.js";
import { ScrollRectSelection, Type } from "./LayerViewHost.js";
const UIStrings = {
  selectALayerToSeeItsDetails: "Select a layer to see its details",
  scrollRectangleDimensions: "{PH1} {PH2} \xD7 {PH3} (at {PH4}, {PH5})",
  unnamed: "<unnamed>",
  stickyAncenstorLayersS: "{PH1}: {PH2} ({PH3})",
  stickyBoxRectangleDimensions: "Sticky Box {PH1} \xD7 {PH2} (at {PH3}, {PH4})",
  containingBlocRectangleDimensions: "Containing Block {PH1} \xD7 {PH2} (at {PH3}, {PH4})",
  nearestLayerShiftingStickyBox: "Nearest Layer Shifting Sticky Box",
  nearestLayerShiftingContaining: "Nearest Layer Shifting Containing Block",
  updateRectangleDimensions: "{PH1} \xD7 {PH2} (at {PH3}, {PH4})",
  size: "Size",
  compositingReasons: "Compositing Reasons",
  memoryEstimate: "Memory estimate",
  paintCount: "Paint count",
  slowScrollRegions: "Slow scroll regions",
  stickyPositionConstraint: "Sticky position constraint",
  paintProfiler: "Paint Profiler",
  nonFastScrollable: "Non fast scrollable",
  touchEventHandler: "Touch event handler",
  wheelEventHandler: "Wheel event handler",
  repaintsOnScroll: "Repaints on scroll",
  mainThreadScrollingReason: "Main thread scrolling reason"
};
const str_ = i18n.i18n.registerUIStrings("panels/layer_viewer/LayerDetailsView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class LayerDetailsView extends Common.ObjectWrapper.eventMixin(UI.Widget.Widget) {
  layerViewHost;
  emptyWidget;
  layerSnapshotMap;
  tableElement;
  tbodyElement;
  sizeCell;
  compositingReasonsCell;
  memoryEstimateCell;
  paintCountCell;
  scrollRectsCell;
  stickyPositionConstraintCell;
  paintProfilerLink;
  selection;
  constructor(layerViewHost) {
    super(true);
    this.layerViewHost = layerViewHost;
    this.layerViewHost.registerView(this);
    this.emptyWidget = new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.selectALayerToSeeItsDetails));
    this.layerSnapshotMap = this.layerViewHost.getLayerSnapshotMap();
    this.buildContent();
    this.selection = null;
  }
  hoverObject(_selection) {
  }
  selectObject(selection) {
    this.selection = selection;
    if (this.isShowing()) {
      this.update();
    }
  }
  setLayerTree(_layerTree) {
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([layerDetailsViewStyles]);
    this.update();
  }
  onScrollRectClicked(index, event) {
    if (event.which !== 1) {
      return;
    }
    if (!this.selection) {
      return;
    }
    this.layerViewHost.selectObject(new ScrollRectSelection(this.selection.layer(), index));
  }
  invokeProfilerLink() {
    if (!this.selection) {
      return;
    }
    const snapshotSelection = this.selection.type() === Type.Snapshot ? this.selection : this.layerSnapshotMap.get(this.selection.layer());
    if (snapshotSelection) {
      this.dispatchEventToListeners(Events.PaintProfilerRequested, snapshotSelection);
    }
  }
  createScrollRectElement(scrollRect, index) {
    if (index) {
      UI.UIUtils.createTextChild(this.scrollRectsCell, ", ");
    }
    const element = this.scrollRectsCell.createChild("span", "scroll-rect");
    if (this.selection && this.selection.scrollRectIndex === index) {
      element.classList.add("active");
    }
    element.textContent = i18nString(UIStrings.scrollRectangleDimensions, {
      PH1: String(slowScrollRectNames.get(scrollRect.type)?.()),
      PH2: scrollRect.rect.width,
      PH3: scrollRect.rect.height,
      PH4: scrollRect.rect.x,
      PH5: scrollRect.rect.y
    });
    element.addEventListener("click", this.onScrollRectClicked.bind(this, index), false);
  }
  formatStickyAncestorLayer(title, layer) {
    if (!layer) {
      return "";
    }
    const node = layer.nodeForSelfOrAncestor();
    const name = node ? node.simpleSelector() : i18nString(UIStrings.unnamed);
    return i18nString(UIStrings.stickyAncenstorLayersS, { PH1: title, PH2: name, PH3: layer.id() });
  }
  createStickyAncestorChild(title, layer) {
    if (!layer) {
      return;
    }
    UI.UIUtils.createTextChild(this.stickyPositionConstraintCell, ", ");
    const child = this.stickyPositionConstraintCell.createChild("span");
    child.textContent = this.formatStickyAncestorLayer(title, layer);
  }
  populateStickyPositionConstraintCell(constraint) {
    this.stickyPositionConstraintCell.removeChildren();
    if (!constraint) {
      return;
    }
    const stickyBoxRect = constraint.stickyBoxRect();
    const stickyBoxRectElement = this.stickyPositionConstraintCell.createChild("span");
    stickyBoxRectElement.textContent = i18nString(UIStrings.stickyBoxRectangleDimensions, { PH1: stickyBoxRect.width, PH2: stickyBoxRect.height, PH3: stickyBoxRect.x, PH4: stickyBoxRect.y });
    UI.UIUtils.createTextChild(this.stickyPositionConstraintCell, ", ");
    const containingBlockRect = constraint.containingBlockRect();
    const containingBlockRectElement = this.stickyPositionConstraintCell.createChild("span");
    containingBlockRectElement.textContent = i18nString(UIStrings.containingBlocRectangleDimensions, {
      PH1: containingBlockRect.width,
      PH2: containingBlockRect.height,
      PH3: containingBlockRect.x,
      PH4: containingBlockRect.y
    });
    this.createStickyAncestorChild(i18nString(UIStrings.nearestLayerShiftingStickyBox), constraint.nearestLayerShiftingStickyBox());
    this.createStickyAncestorChild(i18nString(UIStrings.nearestLayerShiftingContaining), constraint.nearestLayerShiftingContainingBlock());
  }
  update() {
    const layer = this.selection && this.selection.layer();
    if (!layer) {
      this.tableElement.remove();
      this.paintProfilerLink.remove();
      this.emptyWidget.show(this.contentElement);
      return;
    }
    this.emptyWidget.detach();
    this.contentElement.appendChild(this.tableElement);
    this.contentElement.appendChild(this.paintProfilerLink);
    this.sizeCell.textContent = i18nString(UIStrings.updateRectangleDimensions, { PH1: layer.width(), PH2: layer.height(), PH3: layer.offsetX(), PH4: layer.offsetY() });
    if (this.paintCountCell.parentElement) {
      this.paintCountCell.parentElement.classList.toggle("hidden", !layer.paintCount());
    }
    this.paintCountCell.textContent = String(layer.paintCount());
    this.memoryEstimateCell.textContent = Platform.NumberUtilities.bytesToString(layer.gpuMemoryUsage());
    void layer.requestCompositingReasonIds().then(this.updateCompositingReasons.bind(this));
    this.scrollRectsCell.removeChildren();
    layer.scrollRects().forEach(this.createScrollRectElement.bind(this));
    this.populateStickyPositionConstraintCell(layer.stickyPositionConstraint());
    const snapshot = this.selection && this.selection.type() === Type.Snapshot ? this.selection.snapshot() : null;
    this.paintProfilerLink.classList.toggle("hidden", !(this.layerSnapshotMap.has(layer) || snapshot));
  }
  buildContent() {
    this.tableElement = this.contentElement.createChild("table");
    this.tbodyElement = this.tableElement.createChild("tbody");
    this.sizeCell = this.createRow(i18nString(UIStrings.size));
    this.compositingReasonsCell = this.createRow(i18nString(UIStrings.compositingReasons));
    this.memoryEstimateCell = this.createRow(i18nString(UIStrings.memoryEstimate));
    this.paintCountCell = this.createRow(i18nString(UIStrings.paintCount));
    this.scrollRectsCell = this.createRow(i18nString(UIStrings.slowScrollRegions));
    this.stickyPositionConstraintCell = this.createRow(i18nString(UIStrings.stickyPositionConstraint));
    this.paintProfilerLink = this.contentElement.createChild("span", "hidden devtools-link link-margin");
    UI.ARIAUtils.markAsLink(this.paintProfilerLink);
    this.paintProfilerLink.textContent = i18nString(UIStrings.paintProfiler);
    this.paintProfilerLink.tabIndex = 0;
    this.paintProfilerLink.addEventListener("click", (e) => {
      e.consume(true);
      this.invokeProfilerLink();
    });
    this.paintProfilerLink.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.consume();
        this.invokeProfilerLink();
      }
    });
  }
  createRow(title) {
    const tr = this.tbodyElement.createChild("tr");
    const titleCell = tr.createChild("td");
    titleCell.textContent = title;
    return tr.createChild("td");
  }
  updateCompositingReasons(compositingReasonIds) {
    if (!compositingReasonIds || !compositingReasonIds.length) {
      this.compositingReasonsCell.textContent = "n/a";
      return;
    }
    this.compositingReasonsCell.removeChildren();
    const list = this.compositingReasonsCell.createChild("ul");
    const compositingReasons = LayerDetailsView.getCompositingReasons(compositingReasonIds);
    for (const compositingReason of compositingReasons) {
      list.createChild("li").textContent = compositingReason;
    }
  }
  static getCompositingReasons(compositingReasonIds) {
    const compositingReasons = [];
    for (const compositingReasonId of compositingReasonIds) {
      const compositingReason = compositingReasonIdToReason.get(compositingReasonId);
      if (compositingReason) {
        compositingReasons.push(compositingReason);
      } else {
        console.error(`Compositing reason id '${compositingReasonId}' is not recognized.`);
      }
    }
    return compositingReasons;
  }
}
const compositingReasonIdToReason = /* @__PURE__ */ new Map([
  ["transform3D", "Has a 3D transform."],
  ["video", "Is an accelerated video."],
  [
    "canvas",
    "Is an accelerated canvas, or is a display list backed canvas that was promoted to a layer based on a performance heuristic."
  ],
  ["plugin", "Is an accelerated plugin."],
  ["iFrame", "Is an accelerated iFrame."],
  ["backfaceVisibilityHidden", "Has backface-visibility: hidden."],
  ["activeTransformAnimation", "Has an active accelerated transform animation or transition."],
  ["activeOpacityAnimation", "Has an active accelerated opacity animation or transition."],
  ["activeFilterAnimation", "Has an active accelerated filter animation or transition."],
  ["activeBackdropFilterAnimation", "Has an active accelerated backdrop filter animation or transition."],
  ["immersiveArOverlay", "Is DOM overlay for WebXR immersive-ar mode."],
  ["scrollDependentPosition", "Is fixed or sticky position."],
  ["overflowScrolling", "Is a scrollable overflow element."],
  ["overflowScrollingParent", "Scroll parent is not an ancestor."],
  ["outOfFlowClipping", "Has clipping ancestor."],
  ["videoOverlay", "Is overlay controls for video."],
  ["willChangeTransform", "Has a will-change: transform compositing hint."],
  ["willChangeOpacity", "Has a will-change: opacity compositing hint."],
  ["willChangeOther", "Has a will-change compositing hint other than transform and opacity."],
  ["backdropFilter", "Has a backdrop filter."],
  ["rootScroller", "Is the document.rootScroller."],
  ["assumedOverlap", "Might overlap other composited content."],
  ["overlap", "Overlaps other composited content."],
  ["negativeZIndexChildren", "Parent with composited negative z-index content."],
  ["squashingDisallowed", "Layer was separately composited because it could not be squashed."],
  [
    "opacityWithCompositedDescendants",
    "Has opacity that needs to be applied by the compositor because of composited descendants."
  ],
  [
    "maskWithCompositedDescendants",
    "Has a mask that needs to be known by the compositor because of composited descendants."
  ],
  [
    "reflectionWithCompositedDescendants",
    "Has a reflection that needs to be known by the compositor because of composited descendants."
  ],
  [
    "filterWithCompositedDescendants",
    "Has a filter effect that needs to be known by the compositor because of composited descendants."
  ],
  [
    "blendingWithCompositedDescendants",
    "Has a blending effect that needs to be known by the compositor because of composited descendants."
  ],
  [
    "clipsCompositingDescendants",
    "Has a clip that needs to be known by the compositor because of composited descendants."
  ],
  [
    "perspectiveWith3DDescendants",
    "Has a perspective transform that needs to be known by the compositor because of 3D descendants."
  ],
  [
    "preserve3DWith3DDescendants",
    "Has a preserves-3D property that needs to be known by the compositor because of 3D descendants."
  ],
  ["isolateCompositedDescendants", "Should isolate descendants to apply a blend effect."],
  ["positionFixedWithCompositedDescendants", "Is a position:fixed element with composited descendants."],
  ["root", "Is the root layer."],
  ["layerForHorizontalScrollbar", "Secondary layer, the horizontal scrollbar layer."],
  ["layerForVerticalScrollbar", "Secondary layer, the vertical scrollbar layer."],
  ["layerForOverflowControlsHost", "Secondary layer, the overflow controls host layer."],
  ["layerForScrollCorner", "Secondary layer, the scroll corner layer."],
  ["layerForScrollingContents", "Secondary layer, to house contents that can be scrolled."],
  ["layerForScrollingContainer", "Secondary layer, used to position the scrolling contents while scrolling."],
  ["layerForSquashingContents", "Secondary layer, home for a group of squashable content."],
  [
    "layerForSquashingContainer",
    "Secondary layer, no-op layer to place the squashing layer correctly in the composited layer tree."
  ],
  [
    "layerForForeground",
    "Secondary layer, to contain any normal flow and positive z-index contents on top of a negative z-index layer."
  ],
  ["layerForMask", "Secondary layer, to contain the mask contents."],
  ["layerForDecoration", "Layer painted on top of other layers as decoration."],
  ["layerForOther", "Layer for link highlight, frame overlay, etc."]
]);
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["PaintProfilerRequested"] = "PaintProfilerRequested";
  return Events2;
})(Events || {});
export const slowScrollRectNames = /* @__PURE__ */ new Map([
  [SDK.LayerTreeBase.Layer.ScrollRectType.NonFastScrollable, i18nLazyString(UIStrings.nonFastScrollable)],
  [SDK.LayerTreeBase.Layer.ScrollRectType.TouchEventHandler, i18nLazyString(UIStrings.touchEventHandler)],
  [SDK.LayerTreeBase.Layer.ScrollRectType.WheelEventHandler, i18nLazyString(UIStrings.wheelEventHandler)],
  [SDK.LayerTreeBase.Layer.ScrollRectType.RepaintsOnScroll, i18nLazyString(UIStrings.repaintsOnScroll)],
  [
    SDK.LayerTreeBase.Layer.ScrollRectType.MainThreadScrollingReason,
    i18nLazyString(UIStrings.mainThreadScrollingReason)
  ]
]);
//# sourceMappingURL=LayerDetailsView.js.map
