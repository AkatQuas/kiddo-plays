import * as Host from "../../../../core/host/host.js";
import * as ThemeSupport from "../../theme_support/theme_support.js";
import timelineGridStyles from "./timelineGrid.css.legacy.js";
const labelMap = /* @__PURE__ */ new Map();
export class TimelineGrid {
  element;
  dividersElementInternal;
  gridHeaderElement;
  eventDividersElement;
  dividersLabelBarElementInternal;
  constructor() {
    this.element = document.createElement("div");
    ThemeSupport.ThemeSupport.instance().appendStyle(this.element, timelineGridStyles);
    this.dividersElementInternal = this.element.createChild("div", "resources-dividers");
    this.gridHeaderElement = document.createElement("div");
    this.gridHeaderElement.classList.add("timeline-grid-header");
    this.eventDividersElement = this.gridHeaderElement.createChild("div", "resources-event-dividers");
    this.dividersLabelBarElementInternal = this.gridHeaderElement.createChild("div", "resources-dividers-label-bar");
    this.element.appendChild(this.gridHeaderElement);
  }
  static calculateGridOffsets(calculator, freeZoneAtLeft) {
    const minGridSlicePx = 64;
    const clientWidth = calculator.computePosition(calculator.maximumBoundary());
    let dividersCount = clientWidth / minGridSlicePx;
    let gridSliceTime = calculator.boundarySpan() / dividersCount;
    const pixelsPerTime = clientWidth / calculator.boundarySpan();
    const logGridSliceTime = Math.ceil(Math.log(gridSliceTime) / Math.LN10);
    gridSliceTime = Math.pow(10, logGridSliceTime);
    if (gridSliceTime * pixelsPerTime >= 5 * minGridSlicePx) {
      gridSliceTime = gridSliceTime / 5;
    }
    if (gridSliceTime * pixelsPerTime >= 2 * minGridSlicePx) {
      gridSliceTime = gridSliceTime / 2;
    }
    const firstDividerTime = Math.ceil((calculator.minimumBoundary() - calculator.zeroTime()) / gridSliceTime) * gridSliceTime + calculator.zeroTime();
    let lastDividerTime = calculator.maximumBoundary();
    lastDividerTime += minGridSlicePx / pixelsPerTime;
    dividersCount = Math.ceil((lastDividerTime - firstDividerTime) / gridSliceTime);
    if (!gridSliceTime) {
      dividersCount = 0;
    }
    const offsets = [];
    for (let i = 0; i < dividersCount; ++i) {
      const time = firstDividerTime + gridSliceTime * i;
      if (calculator.computePosition(time) < (freeZoneAtLeft || 0)) {
        continue;
      }
      offsets.push({ position: Math.floor(calculator.computePosition(time)), time });
    }
    return { offsets, precision: Math.max(0, -Math.floor(Math.log(gridSliceTime * 1.01) / Math.LN10)) };
  }
  static drawCanvasGrid(context, dividersData) {
    context.save();
    context.scale(window.devicePixelRatio, window.devicePixelRatio);
    const height = Math.floor(context.canvas.height / window.devicePixelRatio);
    context.strokeStyle = getComputedStyle(document.body).getPropertyValue("--divider-line");
    context.lineWidth = 1;
    context.translate(0.5, 0.5);
    context.beginPath();
    for (const offsetInfo of dividersData.offsets) {
      context.moveTo(offsetInfo.position, 0);
      context.lineTo(offsetInfo.position, height);
    }
    context.stroke();
    context.restore();
  }
  static drawCanvasHeaders(context, dividersData, formatTimeFunction, paddingTop, headerHeight, freeZoneAtLeft) {
    context.save();
    context.scale(window.devicePixelRatio, window.devicePixelRatio);
    const width = Math.ceil(context.canvas.width / window.devicePixelRatio);
    context.beginPath();
    context.fillStyle = ThemeSupport.ThemeSupport.instance().getComputedValue("--color-background-opacity-50");
    context.fillRect(0, 0, width, headerHeight);
    context.fillStyle = ThemeSupport.ThemeSupport.instance().getComputedValue("--color-text-primary");
    context.textBaseline = "hanging";
    context.font = "11px " + Host.Platform.fontFamily();
    const paddingRight = 4;
    for (const offsetInfo of dividersData.offsets) {
      const text = formatTimeFunction(offsetInfo.time);
      const textWidth = context.measureText(text).width;
      const textPosition = offsetInfo.position - textWidth - paddingRight;
      if (!freeZoneAtLeft || freeZoneAtLeft < textPosition) {
        context.fillText(text, textPosition, paddingTop);
      }
    }
    context.restore();
  }
  get dividersElement() {
    return this.dividersElementInternal;
  }
  get dividersLabelBarElement() {
    return this.dividersLabelBarElementInternal;
  }
  removeDividers() {
    this.dividersElementInternal.removeChildren();
    this.dividersLabelBarElementInternal.removeChildren();
  }
  updateDividers(calculator, freeZoneAtLeft) {
    const dividersData = TimelineGrid.calculateGridOffsets(calculator, freeZoneAtLeft);
    const dividerOffsets = dividersData.offsets;
    const precision = dividersData.precision;
    const dividersElementClientWidth = this.dividersElementInternal.clientWidth;
    let divider = this.dividersElementInternal.firstChild;
    let dividerLabelBar = this.dividersLabelBarElementInternal.firstChild;
    for (let i = 0; i < dividerOffsets.length; ++i) {
      if (!divider) {
        divider = document.createElement("div");
        divider.className = "resources-divider";
        this.dividersElementInternal.appendChild(divider);
        dividerLabelBar = document.createElement("div");
        dividerLabelBar.className = "resources-divider";
        const label = document.createElement("div");
        label.className = "resources-divider-label";
        labelMap.set(dividerLabelBar, label);
        dividerLabelBar.appendChild(label);
        this.dividersLabelBarElementInternal.appendChild(dividerLabelBar);
      }
      const time = dividerOffsets[i].time;
      const position = dividerOffsets[i].position;
      if (dividerLabelBar) {
        const label = labelMap.get(dividerLabelBar);
        if (label) {
          label.textContent = calculator.formatValue(time, precision);
        }
      }
      const percentLeft = 100 * position / dividersElementClientWidth;
      divider.style.left = percentLeft + "%";
      if (dividerLabelBar) {
        dividerLabelBar.style.left = percentLeft + "%";
      }
      divider = divider.nextSibling;
      if (dividerLabelBar) {
        dividerLabelBar = dividerLabelBar.nextSibling;
      }
    }
    while (divider) {
      const nextDivider = divider.nextSibling;
      this.dividersElementInternal.removeChild(divider);
      if (nextDivider) {
        divider = nextDivider;
      } else {
        break;
      }
    }
    while (dividerLabelBar) {
      const nextDivider = dividerLabelBar.nextSibling;
      this.dividersLabelBarElementInternal.removeChild(dividerLabelBar);
      if (nextDivider) {
        dividerLabelBar = nextDivider;
      } else {
        break;
      }
    }
    return true;
  }
  addEventDivider(divider) {
    this.eventDividersElement.appendChild(divider);
  }
  addEventDividers(dividers) {
    this.gridHeaderElement.removeChild(this.eventDividersElement);
    for (const divider of dividers) {
      this.eventDividersElement.appendChild(divider);
    }
    this.gridHeaderElement.appendChild(this.eventDividersElement);
  }
  removeEventDividers() {
    this.eventDividersElement.removeChildren();
  }
  hideEventDividers() {
    this.eventDividersElement.classList.add("hidden");
  }
  showEventDividers() {
    this.eventDividersElement.classList.remove("hidden");
  }
  hideDividers() {
    this.dividersElementInternal.classList.add("hidden");
  }
  showDividers() {
    this.dividersElementInternal.classList.remove("hidden");
  }
  setScrollTop(scrollTop) {
    this.dividersLabelBarElementInternal.style.top = scrollTop + "px";
    this.eventDividersElement.style.top = scrollTop + "px";
  }
}
//# sourceMappingURL=TimelineGrid.js.map
