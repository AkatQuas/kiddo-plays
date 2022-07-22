import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ThemeSupport from "../../ui/legacy/theme_support/theme_support.js";
import { Bounds, formatMillisecondsToSeconds } from "./TickingFlameChartHelpers.js";
const defaultFont = "11px " + Host.Platform.fontFamily();
const defaultColor = ThemeSupport.ThemeSupport.instance().getComputedValue("--color-text-primary");
const DefaultStyle = {
  height: 20,
  padding: 2,
  collapsible: false,
  font: defaultFont,
  color: defaultColor,
  backgroundColor: "rgba(100 0 0 / 10%)",
  nestingLevel: 0,
  itemsHeight: 20,
  shareHeaderLine: false,
  useFirstLineForOverview: false,
  useDecoratorsForOverview: false
};
export const HotColorScheme = ["#ffba08", "#faa307", "#f48c06", "#e85d04", "#dc2f02", "#d00000", "#9d0208"];
export const ColdColorScheme = ["#7400b8", "#6930c3", "#5e60ce", "#5390d9", "#4ea8de", "#48bfe3", "#56cfe1", "#64dfdf"];
function calculateFontColor(backgroundColor) {
  const parsedColor = Common.Color.Color.parse(backgroundColor);
  if (parsedColor && parsedColor.hsla()[2] < 0.5) {
    return "#eee";
  }
  return "#444";
}
export class Event {
  timelineData;
  setLive;
  setComplete;
  updateMaxTime;
  selfIndex;
  liveInternal;
  title;
  colorInternal;
  fontColorInternal;
  hoverData;
  constructor(timelineData, eventHandlers, eventProperties = { color: void 0, duration: void 0, hoverData: {}, level: 0, name: "", startTime: 0 }) {
    this.timelineData = timelineData;
    this.setLive = eventHandlers.setLive;
    this.setComplete = eventHandlers.setComplete;
    this.updateMaxTime = eventHandlers.updateMaxTime;
    this.selfIndex = this.timelineData.entryLevels.length;
    this.liveInternal = false;
    const duration = eventProperties["duration"] === void 0 ? 0 : eventProperties["duration"];
    this.timelineData.entryLevels.push(eventProperties["level"] || 0);
    this.timelineData.entryStartTimes.push(eventProperties["startTime"] || 0);
    this.timelineData.entryTotalTimes.push(duration);
    if (duration === -1) {
      this.endTime = -1;
    }
    this.title = eventProperties["name"] || "";
    this.colorInternal = eventProperties["color"] || HotColorScheme[0];
    this.fontColorInternal = calculateFontColor(this.colorInternal);
    this.hoverData = eventProperties["hoverData"] || {};
  }
  decorate(htmlElement) {
    htmlElement.createChild("span").textContent = `Name: ${this.title}`;
    htmlElement.createChild("br");
    const startTimeReadable = formatMillisecondsToSeconds(this.startTime, 2);
    if (this.liveInternal) {
      htmlElement.createChild("span").textContent = `Duration: ${startTimeReadable} - LIVE!`;
    } else if (!isNaN(this.duration)) {
      const durationReadable = formatMillisecondsToSeconds(this.duration + this.startTime, 2);
      htmlElement.createChild("span").textContent = `Duration: ${startTimeReadable} - ${durationReadable}`;
    } else {
      htmlElement.createChild("span").textContent = `Time: ${startTimeReadable}`;
    }
  }
  set endTime(time) {
    if (time === -1) {
      this.timelineData.entryTotalTimes[this.selfIndex] = this.setLive(this.selfIndex);
      this.liveInternal = true;
    } else {
      this.liveInternal = false;
      const duration = time - this.timelineData.entryStartTimes[this.selfIndex];
      this.timelineData.entryTotalTimes[this.selfIndex] = duration;
      this.setComplete(this.selfIndex);
      this.updateMaxTime(time);
    }
  }
  get id() {
    return this.selfIndex;
  }
  set level(level) {
    this.timelineData.entryLevels[this.selfIndex] = level;
  }
  set color(color) {
    this.colorInternal = color;
    this.fontColorInternal = calculateFontColor(this.colorInternal);
  }
  get color() {
    return this.colorInternal;
  }
  get fontColor() {
    return this.fontColorInternal;
  }
  get startTime() {
    return this.timelineData.entryStartTimes[this.selfIndex];
  }
  get duration() {
    return this.timelineData.entryTotalTimes[this.selfIndex];
  }
  get live() {
    return this.liveInternal;
  }
}
export class TickingFlameChart extends UI.Widget.VBox {
  intervalTimer;
  lastTimestamp;
  canTickInternal;
  ticking;
  isShown;
  bounds;
  dataProvider;
  delegate;
  chartGroupExpansionSetting;
  chart;
  stoppedPermanently;
  constructor() {
    super();
    this.intervalTimer = 0;
    this.lastTimestamp = 0;
    this.canTickInternal = true;
    this.ticking = false;
    this.isShown = false;
    this.bounds = new Bounds(0, 1e3, 3e4, 1e3);
    this.dataProvider = new TickingFlameChartDataProvider(this.bounds, this.updateMaxTime.bind(this));
    this.delegate = new TickingFlameChartDelegate();
    this.chartGroupExpansionSetting = Common.Settings.Settings.instance().createSetting("mediaFlameChartGroupExpansion", {});
    this.chart = new PerfUI.FlameChart.FlameChart(this.dataProvider, this.delegate, this.chartGroupExpansionSetting);
    this.chart.disableRangeSelection();
    this.chart.bindCanvasEvent("wheel", (e) => {
      this.onScroll(e);
    });
    this.chart.show(this.contentElement);
  }
  addMarker(properties) {
    properties["duration"] = NaN;
    this.startEvent(properties);
  }
  startEvent(properties) {
    if (properties["duration"] === void 0) {
      properties["duration"] = -1;
    }
    const time = properties["startTime"] || 0;
    const event = this.dataProvider.startEvent(properties);
    this.updateMaxTime(time);
    return event;
  }
  addGroup(name, depth) {
    this.dataProvider.addGroup(name, depth);
  }
  updateMaxTime(time) {
    if (this.bounds.pushMaxAtLeastTo(time)) {
      this.updateRender();
    }
  }
  onScroll(e) {
    const scrollTickCount = Math.round(e.deltaY / 50);
    const scrollPositionRatio = e.offsetX / e.srcElement.clientWidth;
    if (scrollTickCount > 0) {
      this.bounds.zoomOut(scrollTickCount, scrollPositionRatio);
    } else {
      this.bounds.zoomIn(-scrollTickCount, scrollPositionRatio);
    }
    this.updateRender();
  }
  willHide() {
    this.isShown = false;
    if (this.ticking) {
      this.stop();
    }
  }
  wasShown() {
    this.isShown = true;
    if (this.canTickInternal && !this.ticking) {
      this.start();
    }
  }
  set canTick(allowed) {
    this.canTickInternal = allowed;
    if (this.ticking && !allowed) {
      this.stop();
    }
    if (!this.ticking && this.isShown && allowed) {
      this.start();
    }
  }
  start() {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = Date.now();
    }
    if (this.intervalTimer !== 0 || this.stoppedPermanently) {
      return;
    }
    this.intervalTimer = window.setInterval(this.updateRender.bind(this), 16);
    this.ticking = true;
  }
  stop(permanently = false) {
    window.clearInterval(this.intervalTimer);
    this.intervalTimer = 0;
    if (permanently) {
      this.stoppedPermanently = true;
    }
    this.ticking = false;
  }
  updateRender() {
    if (this.ticking) {
      const currentTimestamp = Date.now();
      const duration = currentTimestamp - this.lastTimestamp;
      this.lastTimestamp = currentTimestamp;
      this.bounds.addMax(duration);
    }
    this.dataProvider.updateMaxTime(this.bounds);
    this.chart.setWindowTimes(this.bounds.low, this.bounds.high, true);
    this.chart.scheduleUpdate();
  }
}
class TickingFlameChartDelegate {
  constructor() {
  }
  windowChanged(_windowStartTime, _windowEndTime, _animate) {
  }
  updateRangeSelection(_startTime, _endTime) {
  }
  updateSelectedGroup(_flameChart, _group) {
  }
}
class TickingFlameChartDataProvider {
  updateMaxTimeHandle;
  bounds;
  liveEvents;
  eventMap;
  timelineDataInternal;
  maxLevel;
  constructor(initialBounds, updateMaxTime) {
    this.updateMaxTimeHandle = updateMaxTime;
    this.bounds = initialBounds;
    this.liveEvents = /* @__PURE__ */ new Set();
    this.eventMap = /* @__PURE__ */ new Map();
    this.timelineDataInternal = new PerfUI.FlameChart.TimelineData([], [], [], []);
    this.maxLevel = 0;
  }
  addGroup(name, depth) {
    if (this.timelineDataInternal.groups) {
      this.timelineDataInternal.groups.push({
        name,
        startLevel: this.maxLevel,
        expanded: true,
        selectable: false,
        style: DefaultStyle,
        track: null
      });
    }
    this.maxLevel += depth;
  }
  startEvent(properties) {
    properties["level"] = properties["level"] || 0;
    if (properties["level"] > this.maxLevel) {
      throw `level ${properties["level"]} is above the maximum allowed of ${this.maxLevel}`;
    }
    const event = new Event(this.timelineDataInternal, {
      setLive: this.setLive.bind(this),
      setComplete: this.setComplete.bind(this),
      updateMaxTime: this.updateMaxTimeHandle
    }, properties);
    this.eventMap.set(event.id, event);
    return event;
  }
  setLive(index) {
    this.liveEvents.add(index);
    return this.bounds.max;
  }
  setComplete(index) {
    this.liveEvents.delete(index);
  }
  updateMaxTime(bounds) {
    this.bounds = bounds;
    for (const eventID of this.liveEvents.entries()) {
      this.eventMap.get(eventID[0]).endTime = -1;
    }
  }
  maxStackDepth() {
    return this.maxLevel + 1;
  }
  timelineData() {
    return this.timelineDataInternal;
  }
  minimumBoundary() {
    return this.bounds.low;
  }
  totalTime() {
    return this.bounds.high;
  }
  entryColor(index) {
    return this.eventMap.get(index).color;
  }
  textColor(index) {
    return this.eventMap.get(index).fontColor;
  }
  entryTitle(index) {
    return this.eventMap.get(index).title;
  }
  entryFont(_index) {
    return defaultFont;
  }
  decorateEntry(_index, _context, _text, _barX, _barY, _barWidth, _barHeight, _unclippedBarX, _timeToPixelRatio) {
    return false;
  }
  forceDecoration(_index) {
    return false;
  }
  prepareHighlightedEntryInfo(index) {
    const element = document.createElement("div");
    this.eventMap.get(index).decorate(element);
    return element;
  }
  formatValue(value, _precision) {
    value += Math.round(this.bounds.low);
    if (this.bounds.range < 2800) {
      return formatMillisecondsToSeconds(value, 2);
    }
    if (this.bounds.range < 3e4) {
      return formatMillisecondsToSeconds(value, 1);
    }
    return formatMillisecondsToSeconds(value, 0);
  }
  canJumpToEntry(_entryIndex) {
    return false;
  }
  navStartTimes() {
    return /* @__PURE__ */ new Map();
  }
}
//# sourceMappingURL=TickingFlameChart.js.map
