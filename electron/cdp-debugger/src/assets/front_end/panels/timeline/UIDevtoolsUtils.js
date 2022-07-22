import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import { TimelineCategory, TimelineRecordStyle } from "./TimelineUIUtils.js";
const UIStrings = {
  frameStart: "Frame Start",
  drawFrame: "Draw Frame",
  layout: "Layout",
  rasterizing: "Rasterizing",
  drawing: "Drawing",
  painting: "Painting",
  system: "System",
  idle: "Idle"
};
const str_ = i18n.i18n.registerUIStrings("panels/timeline/UIDevtoolsUtils.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let _eventStylesMap = null;
let _categories = null;
export class UIDevtoolsUtils {
  static isUiDevTools() {
    return Root.Runtime.Runtime.queryParam("uiDevTools") === "true";
  }
  static categorizeEvents() {
    if (_eventStylesMap) {
      return _eventStylesMap;
    }
    const type = RecordType;
    const categories = UIDevtoolsUtils.categories();
    const drawing = categories["drawing"];
    const rasterizing = categories["rasterizing"];
    const layout = categories["layout"];
    const painting = categories["painting"];
    const other = categories["other"];
    const eventStyles = {};
    eventStyles[type.ViewPaint] = new TimelineRecordStyle("View::Paint", painting);
    eventStyles[type.ViewOnPaint] = new TimelineRecordStyle("View::OnPaint", painting);
    eventStyles[type.ViewPaintChildren] = new TimelineRecordStyle("View::PaintChildren", painting);
    eventStyles[type.ViewOnPaintBackground] = new TimelineRecordStyle("View::OnPaintBackground", painting);
    eventStyles[type.ViewOnPaintBorder] = new TimelineRecordStyle("View::OnPaintBorder", painting);
    eventStyles[type.LayerPaintContentsToDisplayList] = new TimelineRecordStyle("Layer::PaintContentsToDisplayList", painting);
    eventStyles[type.ViewLayout] = new TimelineRecordStyle("View::Layout", layout);
    eventStyles[type.ViewLayoutBoundsChanged] = new TimelineRecordStyle("View::Layout(bounds_changed)", layout);
    eventStyles[type.RasterTask] = new TimelineRecordStyle("RasterTask", rasterizing);
    eventStyles[type.RasterizerTaskImplRunOnWorkerThread] = new TimelineRecordStyle("RasterizerTaskImpl::RunOnWorkerThread", rasterizing);
    eventStyles[type.DirectRendererDrawFrame] = new TimelineRecordStyle("DirectRenderer::DrawFrame", drawing);
    eventStyles[type.BeginFrame] = new TimelineRecordStyle(i18nString(UIStrings.frameStart), drawing, true);
    eventStyles[type.DrawFrame] = new TimelineRecordStyle(i18nString(UIStrings.drawFrame), drawing, true);
    eventStyles[type.NeedsBeginFrameChanged] = new TimelineRecordStyle("NeedsBeginFrameChanged", drawing, true);
    eventStyles[type.ThreadControllerImplRunTask] = new TimelineRecordStyle("ThreadControllerImpl::RunTask", other);
    _eventStylesMap = eventStyles;
    return eventStyles;
  }
  static categories() {
    if (_categories) {
      return _categories;
    }
    _categories = {
      layout: new TimelineCategory("layout", i18nString(UIStrings.layout), true, "hsl(214, 67%, 74%)", "hsl(214, 67%, 66%)"),
      rasterizing: new TimelineCategory("rasterizing", i18nString(UIStrings.rasterizing), true, "hsl(43, 83%, 72%)", "hsl(43, 83%, 64%) "),
      drawing: new TimelineCategory("drawing", i18nString(UIStrings.drawing), true, "hsl(256, 67%, 76%)", "hsl(256, 67%, 70%)"),
      painting: new TimelineCategory("painting", i18nString(UIStrings.painting), true, "hsl(109, 33%, 64%)", "hsl(109, 33%, 55%)"),
      other: new TimelineCategory("other", i18nString(UIStrings.system), false, "hsl(0, 0%, 87%)", "hsl(0, 0%, 79%)"),
      idle: new TimelineCategory("idle", i18nString(UIStrings.idle), false, "hsl(0, 0%, 98%)", "hsl(0, 0%, 98%)")
    };
    return _categories;
  }
  static getMainCategoriesList() {
    return ["idle", "drawing", "painting", "rasterizing", "layout", "other"];
  }
}
export var RecordType = /* @__PURE__ */ ((RecordType2) => {
  RecordType2["ViewPaint"] = "View::Paint";
  RecordType2["ViewOnPaint"] = "View::OnPaint";
  RecordType2["ViewPaintChildren"] = "View::PaintChildren";
  RecordType2["ViewOnPaintBackground"] = "View::OnPaintBackground";
  RecordType2["ViewOnPaintBorder"] = "View::OnPaintBorder";
  RecordType2["ViewLayout"] = "View::Layout";
  RecordType2["ViewLayoutBoundsChanged"] = "View::Layout(bounds_changed)";
  RecordType2["LayerPaintContentsToDisplayList"] = "Layer::PaintContentsToDisplayList";
  RecordType2["DirectRendererDrawFrame"] = "DirectRenderer::DrawFrame";
  RecordType2["RasterTask"] = "RasterTask";
  RecordType2["RasterizerTaskImplRunOnWorkerThread"] = "RasterizerTaskImpl::RunOnWorkerThread";
  RecordType2["BeginFrame"] = "BeginFrame";
  RecordType2["DrawFrame"] = "DrawFrame";
  RecordType2["NeedsBeginFrameChanged"] = "NeedsBeginFrameChanged";
  RecordType2["ThreadControllerImplRunTask"] = "ThreadControllerImpl::RunTask";
  return RecordType2;
})(RecordType || {});
//# sourceMappingURL=UIDevtoolsUtils.js.map
