import * as Common from "../../../../core/common/common.js";
import * as UI from "../../legacy.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import { Events as OverviewGridEvents, OverviewGrid } from "./OverviewGrid.js";
import timelineOverviewInfoStyles from "./timelineOverviewInfo.css.js";
export class TimelineOverviewPane extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
  overviewCalculator;
  overviewGrid;
  cursorArea;
  cursorElement;
  overviewControls;
  markers;
  overviewInfo;
  updateThrottler;
  cursorEnabled;
  cursorPosition;
  lastWidth;
  windowStartTime;
  windowEndTime;
  muteOnWindowChanged;
  constructor(prefix) {
    super();
    this.element.id = prefix + "-overview-pane";
    this.overviewCalculator = new TimelineOverviewCalculator();
    this.overviewGrid = new OverviewGrid(prefix, this.overviewCalculator);
    this.element.appendChild(this.overviewGrid.element);
    this.cursorArea = this.overviewGrid.element.createChild("div", "overview-grid-cursor-area");
    this.cursorElement = this.overviewGrid.element.createChild("div", "overview-grid-cursor-position");
    this.cursorArea.addEventListener("mousemove", this.onMouseMove.bind(this), true);
    this.cursorArea.addEventListener("mouseleave", this.hideCursor.bind(this), true);
    this.overviewGrid.setResizeEnabled(false);
    this.overviewGrid.addEventListener(OverviewGridEvents.WindowChangedWithPosition, this.onWindowChanged, this);
    this.overviewGrid.setClickHandler(this.onClick.bind(this));
    this.overviewControls = [];
    this.markers = /* @__PURE__ */ new Map();
    this.overviewInfo = new OverviewInfo(this.cursorElement);
    this.updateThrottler = new Common.Throttler.Throttler(100);
    this.cursorEnabled = false;
    this.cursorPosition = 0;
    this.lastWidth = 0;
    this.windowStartTime = 0;
    this.windowEndTime = Infinity;
    this.muteOnWindowChanged = false;
  }
  onMouseMove(event) {
    if (!this.cursorEnabled) {
      return;
    }
    const mouseEvent = event;
    const target = event.target;
    this.cursorPosition = mouseEvent.offsetX + target.offsetLeft;
    this.cursorElement.style.left = this.cursorPosition + "px";
    this.cursorElement.style.visibility = "visible";
    void this.overviewInfo.setContent(this.buildOverviewInfo());
  }
  async buildOverviewInfo() {
    const document = this.element.ownerDocument;
    const x = this.cursorPosition;
    const elements = await Promise.all(this.overviewControls.map((control) => control.overviewInfoPromise(x)));
    const fragment = document.createDocumentFragment();
    const nonNullElements = elements.filter((element) => element !== null);
    fragment.append(...nonNullElements);
    return fragment;
  }
  hideCursor() {
    this.cursorElement.style.visibility = "hidden";
    this.overviewInfo.hide();
  }
  wasShown() {
    this.update();
  }
  willHide() {
    this.overviewInfo.hide();
  }
  onResize() {
    const width = this.element.offsetWidth;
    if (width === this.lastWidth) {
      return;
    }
    this.lastWidth = width;
    this.scheduleUpdate();
  }
  setOverviewControls(overviewControls) {
    for (let i = 0; i < this.overviewControls.length; ++i) {
      this.overviewControls[i].dispose();
    }
    for (let i = 0; i < overviewControls.length; ++i) {
      overviewControls[i].setCalculator(this.overviewCalculator);
      overviewControls[i].show(this.overviewGrid.element);
    }
    this.overviewControls = overviewControls;
    this.update();
  }
  setBounds(minimumBoundary, maximumBoundary) {
    this.overviewCalculator.setBounds(minimumBoundary, maximumBoundary);
    this.overviewGrid.setResizeEnabled(true);
    this.cursorEnabled = true;
  }
  setNavStartTimes(navStartTimes) {
    this.overviewCalculator.setNavStartTimes(navStartTimes);
  }
  scheduleUpdate() {
    void this.updateThrottler.schedule(async () => {
      this.update();
    });
  }
  update() {
    if (!this.isShowing()) {
      return;
    }
    this.overviewCalculator.setDisplayWidth(this.overviewGrid.clientWidth());
    for (let i = 0; i < this.overviewControls.length; ++i) {
      this.overviewControls[i].update();
    }
    this.overviewGrid.updateDividers(this.overviewCalculator);
    this.updateMarkers();
    this.updateWindow();
  }
  setMarkers(markers) {
    this.markers = markers;
  }
  updateMarkers() {
    const filteredMarkers = /* @__PURE__ */ new Map();
    for (const time of this.markers.keys()) {
      const marker = this.markers.get(time);
      const position = Math.round(this.overviewCalculator.computePosition(time));
      if (filteredMarkers.has(position)) {
        continue;
      }
      filteredMarkers.set(position, marker);
      marker.style.left = position + "px";
    }
    this.overviewGrid.removeEventDividers();
    this.overviewGrid.addEventDividers([...filteredMarkers.values()]);
  }
  reset() {
    this.windowStartTime = 0;
    this.windowEndTime = Infinity;
    this.overviewCalculator.reset();
    this.overviewGrid.reset();
    this.overviewGrid.setResizeEnabled(false);
    this.cursorEnabled = false;
    this.hideCursor();
    this.markers = /* @__PURE__ */ new Map();
    for (const control of this.overviewControls) {
      control.reset();
    }
    this.overviewInfo.hide();
    this.scheduleUpdate();
  }
  onClick(event) {
    return this.overviewControls.some((control) => control.onClick(event));
  }
  onWindowChanged(event) {
    if (this.muteOnWindowChanged) {
      return;
    }
    if (!this.overviewControls.length) {
      return;
    }
    this.windowStartTime = event.data.rawStartValue;
    this.windowEndTime = event.data.rawEndValue;
    const windowTimes = { startTime: this.windowStartTime, endTime: this.windowEndTime };
    this.dispatchEventToListeners(Events.WindowChanged, windowTimes);
  }
  setWindowTimes(startTime, endTime) {
    if (startTime === this.windowStartTime && endTime === this.windowEndTime) {
      return;
    }
    this.windowStartTime = startTime;
    this.windowEndTime = endTime;
    this.updateWindow();
    this.dispatchEventToListeners(Events.WindowChanged, { startTime, endTime });
  }
  updateWindow() {
    if (!this.overviewControls.length) {
      return;
    }
    const absoluteMin = this.overviewCalculator.minimumBoundary();
    const timeSpan = this.overviewCalculator.maximumBoundary() - absoluteMin;
    const haveRecords = absoluteMin > 0;
    const left = haveRecords && this.windowStartTime ? Math.min((this.windowStartTime - absoluteMin) / timeSpan, 1) : 0;
    const right = haveRecords && this.windowEndTime < Infinity ? (this.windowEndTime - absoluteMin) / timeSpan : 1;
    this.muteOnWindowChanged = true;
    this.overviewGrid.setWindow(left, right);
    this.muteOnWindowChanged = false;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["WindowChanged"] = "WindowChanged";
  return Events2;
})(Events || {});
export class TimelineOverviewCalculator {
  minimumBoundaryInternal;
  maximumBoundaryInternal;
  workingArea;
  navStartTimes;
  constructor() {
    this.reset();
  }
  computePosition(time) {
    return (time - this.minimumBoundaryInternal) / this.boundarySpan() * this.workingArea;
  }
  positionToTime(position) {
    return position / this.workingArea * this.boundarySpan() + this.minimumBoundaryInternal;
  }
  setBounds(minimumBoundary, maximumBoundary) {
    this.minimumBoundaryInternal = minimumBoundary;
    this.maximumBoundaryInternal = maximumBoundary;
  }
  setNavStartTimes(navStartTimes) {
    this.navStartTimes = navStartTimes;
  }
  setDisplayWidth(clientWidth) {
    this.workingArea = clientWidth;
  }
  reset() {
    this.setBounds(0, 100);
  }
  formatValue(value, precision) {
    if (this.navStartTimes) {
      const navStartTimes = Array.from(this.navStartTimes.values());
      for (let i = navStartTimes.length - 1; i >= 0; i--) {
        if (value > navStartTimes[i].startTime) {
          value -= navStartTimes[i].startTime - this.zeroTime();
          break;
        }
      }
    }
    return i18n.TimeUtilities.preciseMillisToString(value - this.zeroTime(), precision);
  }
  maximumBoundary() {
    return this.maximumBoundaryInternal;
  }
  minimumBoundary() {
    return this.minimumBoundaryInternal;
  }
  zeroTime() {
    return this.minimumBoundaryInternal;
  }
  boundarySpan() {
    return this.maximumBoundaryInternal - this.minimumBoundaryInternal;
  }
}
export class TimelineOverviewBase extends UI.Widget.VBox {
  calculatorInternal;
  canvas;
  contextInternal;
  constructor() {
    super();
    this.calculatorInternal = null;
    this.canvas = this.element.createChild("canvas", "fill");
    this.contextInternal = this.canvas.getContext("2d");
  }
  width() {
    return this.canvas.width;
  }
  height() {
    return this.canvas.height;
  }
  context() {
    if (!this.contextInternal) {
      throw new Error("Unable to retrieve canvas context");
    }
    return this.contextInternal;
  }
  calculator() {
    return this.calculatorInternal;
  }
  update() {
    this.resetCanvas();
  }
  dispose() {
    this.detach();
  }
  reset() {
  }
  async overviewInfoPromise(_x) {
    return null;
  }
  setCalculator(calculator) {
    this.calculatorInternal = calculator;
  }
  onClick(_event) {
    return false;
  }
  resetCanvas() {
    if (this.element.clientWidth) {
      this.setCanvasSize(this.element.clientWidth, this.element.clientHeight);
    }
  }
  setCanvasSize(width, height) {
    this.canvas.width = width * window.devicePixelRatio;
    this.canvas.height = height * window.devicePixelRatio;
  }
}
export class OverviewInfo {
  anchorElement;
  glassPane;
  visible;
  element;
  constructor(anchor) {
    this.anchorElement = anchor;
    this.glassPane = new UI.GlassPane.GlassPane();
    this.glassPane.setPointerEventsBehavior(UI.GlassPane.PointerEventsBehavior.PierceContents);
    this.glassPane.setMarginBehavior(UI.GlassPane.MarginBehavior.Arrow);
    this.glassPane.setSizeBehavior(UI.GlassPane.SizeBehavior.MeasureContent);
    this.visible = false;
    this.element = UI.Utils.createShadowRootWithCoreStyles(this.glassPane.contentElement, {
      cssFile: [timelineOverviewInfoStyles],
      delegatesFocus: void 0
    }).createChild("div", "overview-info");
  }
  async setContent(contentPromise) {
    this.visible = true;
    const content = await contentPromise;
    if (!this.visible) {
      return;
    }
    this.element.removeChildren();
    this.element.appendChild(content);
    this.glassPane.setContentAnchorBox(this.anchorElement.boxInWindow());
    if (!this.glassPane.isShowing()) {
      this.glassPane.show(this.anchorElement.ownerDocument);
    }
  }
  hide() {
    this.visible = false;
    this.glassPane.hide();
  }
}
//# sourceMappingURL=TimelineOverviewPane.js.map
