import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import paintProfilerStyles from "./paintProfiler.css.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  profiling: "Profiling\u2026",
  shapes: "Shapes",
  bitmap: "Bitmap",
  text: "Text",
  misc: "Misc",
  profilingResults: "Profiling results",
  commandLog: "Command Log"
};
const str_ = i18n.i18n.registerUIStrings("panels/layer_viewer/PaintProfilerView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let categories = null;
let logItemCategoriesMap = null;
export class PaintProfilerView extends Common.ObjectWrapper.eventMixin(UI.Widget.HBox) {
  canvasContainer;
  progressBanner;
  pieChart;
  showImageCallback;
  canvas;
  context;
  selectionWindowInternal;
  innerBarWidth;
  minBarHeight;
  barPaddingWidth;
  outerBarWidth;
  pendingScale;
  scale;
  samplesPerBar;
  log;
  snapshot;
  logCategories;
  profiles;
  updateImageTimer;
  constructor(showImageCallback) {
    super(true);
    this.contentElement.classList.add("paint-profiler-overview");
    this.canvasContainer = this.contentElement.createChild("div", "paint-profiler-canvas-container");
    this.progressBanner = this.contentElement.createChild("div", "full-widget-dimmed-banner hidden");
    this.progressBanner.textContent = i18nString(UIStrings.profiling);
    this.pieChart = new PerfUI.PieChart.PieChart();
    this.populatePieChart(0, []);
    this.pieChart.classList.add("paint-profiler-pie-chart");
    this.contentElement.appendChild(this.pieChart);
    this.showImageCallback = showImageCallback;
    this.canvas = this.canvasContainer.createChild("canvas", "fill");
    this.context = this.canvas.getContext("2d");
    this.selectionWindowInternal = new PerfUI.OverviewGrid.Window(this.canvasContainer);
    this.selectionWindowInternal.addEventListener(PerfUI.OverviewGrid.Events.WindowChanged, this.onWindowChanged, this);
    this.innerBarWidth = 4 * window.devicePixelRatio;
    this.minBarHeight = window.devicePixelRatio;
    this.barPaddingWidth = 2 * window.devicePixelRatio;
    this.outerBarWidth = this.innerBarWidth + this.barPaddingWidth;
    this.pendingScale = 1;
    this.scale = this.pendingScale;
    this.samplesPerBar = 0;
    this.log = [];
    this.reset();
  }
  static categories() {
    if (!categories) {
      categories = {
        shapes: new PaintProfilerCategory("shapes", i18nString(UIStrings.shapes), "rgb(255, 161, 129)"),
        bitmap: new PaintProfilerCategory("bitmap", i18nString(UIStrings.bitmap), "rgb(136, 196, 255)"),
        text: new PaintProfilerCategory("text", i18nString(UIStrings.text), "rgb(180, 255, 137)"),
        misc: new PaintProfilerCategory("misc", i18nString(UIStrings.misc), "rgb(206, 160, 255)")
      };
    }
    return categories;
  }
  static initLogItemCategories() {
    if (!logItemCategoriesMap) {
      const categories2 = PaintProfilerView.categories();
      const logItemCategories = {};
      logItemCategories["Clear"] = categories2["misc"];
      logItemCategories["DrawPaint"] = categories2["misc"];
      logItemCategories["DrawData"] = categories2["misc"];
      logItemCategories["SetMatrix"] = categories2["misc"];
      logItemCategories["PushCull"] = categories2["misc"];
      logItemCategories["PopCull"] = categories2["misc"];
      logItemCategories["Translate"] = categories2["misc"];
      logItemCategories["Scale"] = categories2["misc"];
      logItemCategories["Concat"] = categories2["misc"];
      logItemCategories["Restore"] = categories2["misc"];
      logItemCategories["SaveLayer"] = categories2["misc"];
      logItemCategories["Save"] = categories2["misc"];
      logItemCategories["BeginCommentGroup"] = categories2["misc"];
      logItemCategories["AddComment"] = categories2["misc"];
      logItemCategories["EndCommentGroup"] = categories2["misc"];
      logItemCategories["ClipRect"] = categories2["misc"];
      logItemCategories["ClipRRect"] = categories2["misc"];
      logItemCategories["ClipPath"] = categories2["misc"];
      logItemCategories["ClipRegion"] = categories2["misc"];
      logItemCategories["DrawPoints"] = categories2["shapes"];
      logItemCategories["DrawRect"] = categories2["shapes"];
      logItemCategories["DrawOval"] = categories2["shapes"];
      logItemCategories["DrawRRect"] = categories2["shapes"];
      logItemCategories["DrawPath"] = categories2["shapes"];
      logItemCategories["DrawVertices"] = categories2["shapes"];
      logItemCategories["DrawDRRect"] = categories2["shapes"];
      logItemCategories["DrawBitmap"] = categories2["bitmap"];
      logItemCategories["DrawBitmapRectToRect"] = categories2["bitmap"];
      logItemCategories["DrawBitmapMatrix"] = categories2["bitmap"];
      logItemCategories["DrawBitmapNine"] = categories2["bitmap"];
      logItemCategories["DrawSprite"] = categories2["bitmap"];
      logItemCategories["DrawPicture"] = categories2["bitmap"];
      logItemCategories["DrawText"] = categories2["text"];
      logItemCategories["DrawPosText"] = categories2["text"];
      logItemCategories["DrawPosTextH"] = categories2["text"];
      logItemCategories["DrawTextOnPath"] = categories2["text"];
      logItemCategoriesMap = logItemCategories;
    }
    return logItemCategoriesMap;
  }
  static categoryForLogItem(logItem) {
    const method = Platform.StringUtilities.toTitleCase(logItem.method);
    const logItemCategories = PaintProfilerView.initLogItemCategories();
    let result = logItemCategories[method];
    if (!result) {
      result = PaintProfilerView.categories()["misc"];
      logItemCategories[method] = result;
    }
    return result;
  }
  onResize() {
    this.update();
  }
  async setSnapshotAndLog(snapshot, log, clipRect) {
    this.reset();
    this.snapshot = snapshot;
    if (this.snapshot) {
      this.snapshot.addReference();
    }
    this.log = log;
    this.logCategories = this.log.map(PaintProfilerView.categoryForLogItem);
    if (!snapshot) {
      this.update();
      this.populatePieChart(0, []);
      this.selectionWindowInternal.setEnabled(false);
      return;
    }
    this.selectionWindowInternal.setEnabled(true);
    this.progressBanner.classList.remove("hidden");
    this.updateImage();
    const profiles = await snapshot.profile(clipRect);
    this.progressBanner.classList.add("hidden");
    this.profiles = profiles;
    this.update();
    this.updatePieChart();
  }
  setScale(scale) {
    const needsUpdate = scale > this.scale;
    const predictiveGrowthFactor = 2;
    this.pendingScale = Math.min(1, scale * predictiveGrowthFactor);
    if (needsUpdate && this.snapshot) {
      this.updateImage();
    }
  }
  update() {
    this.canvas.width = this.canvasContainer.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvasContainer.clientHeight * window.devicePixelRatio;
    this.samplesPerBar = 0;
    if (!this.profiles || !this.profiles.length || !this.logCategories) {
      return;
    }
    const maxBars = Math.floor((this.canvas.width - 2 * this.barPaddingWidth) / this.outerBarWidth);
    const sampleCount = this.log.length;
    this.samplesPerBar = Math.ceil(sampleCount / maxBars);
    let maxBarTime = 0;
    const barTimes = [];
    const barHeightByCategory = [];
    let heightByCategory = {};
    for (let i = 0, lastBarIndex = 0, lastBarTime = 0; i < sampleCount; ) {
      let categoryName = this.logCategories[i] && this.logCategories[i].name || "misc";
      const sampleIndex = this.log[i].commandIndex;
      for (let row = 0; row < this.profiles.length; row++) {
        const sample = this.profiles[row][sampleIndex];
        lastBarTime += sample;
        heightByCategory[categoryName] = (heightByCategory[categoryName] || 0) + sample;
      }
      ++i;
      if (i - lastBarIndex === this.samplesPerBar || i === sampleCount) {
        const factor = this.profiles.length * (i - lastBarIndex);
        lastBarTime /= factor;
        for (categoryName in heightByCategory) {
          heightByCategory[categoryName] /= factor;
        }
        barTimes.push(lastBarTime);
        barHeightByCategory.push(heightByCategory);
        if (lastBarTime > maxBarTime) {
          maxBarTime = lastBarTime;
        }
        lastBarTime = 0;
        heightByCategory = {};
        lastBarIndex = i;
      }
    }
    const paddingHeight = 4 * window.devicePixelRatio;
    const scale = (this.canvas.height - paddingHeight - this.minBarHeight) / maxBarTime;
    for (let i = 0; i < barTimes.length; ++i) {
      for (const categoryName in barHeightByCategory[i]) {
        barHeightByCategory[i][categoryName] *= (barTimes[i] * scale + this.minBarHeight) / barTimes[i];
      }
      this.renderBar(i, barHeightByCategory[i]);
    }
  }
  renderBar(index, heightByCategory) {
    const categories2 = PaintProfilerView.categories();
    let currentHeight = 0;
    const x = this.barPaddingWidth + index * this.outerBarWidth;
    for (const categoryName in categories2) {
      if (!heightByCategory[categoryName]) {
        continue;
      }
      currentHeight += heightByCategory[categoryName];
      const y = this.canvas.height - currentHeight;
      this.context.fillStyle = categories2[categoryName].color;
      this.context.fillRect(x, y, this.innerBarWidth, heightByCategory[categoryName]);
    }
  }
  onWindowChanged() {
    this.dispatchEventToListeners(Events.WindowChanged);
    this.updatePieChart();
    if (this.updateImageTimer) {
      return;
    }
    this.updateImageTimer = window.setTimeout(this.updateImage.bind(this), 100);
  }
  updatePieChart() {
    const { total, slices } = this.calculatePieChart();
    this.populatePieChart(total, slices);
  }
  calculatePieChart() {
    const window2 = this.selectionWindow();
    if (!this.profiles || !this.profiles.length || !window2) {
      return { total: 0, slices: [] };
    }
    let totalTime = 0;
    const timeByCategory = {};
    for (let i = window2.left; i < window2.right; ++i) {
      const logEntry = this.log[i];
      const category = PaintProfilerView.categoryForLogItem(logEntry);
      timeByCategory[category.color] = timeByCategory[category.color] || 0;
      for (let j = 0; j < this.profiles.length; ++j) {
        const time = this.profiles[j][logEntry.commandIndex];
        totalTime += time;
        timeByCategory[category.color] += time;
      }
    }
    const slices = [];
    for (const color in timeByCategory) {
      slices.push({ value: timeByCategory[color] / this.profiles.length, color, title: "" });
    }
    return { total: totalTime / this.profiles.length, slices };
  }
  populatePieChart(total, slices) {
    this.pieChart.data = {
      chartName: i18nString(UIStrings.profilingResults),
      size: 55,
      formatter: this.formatPieChartTime.bind(this),
      showLegend: false,
      total,
      slices
    };
  }
  formatPieChartTime(value) {
    return i18n.TimeUtilities.millisToString(value * 1e3, true);
  }
  selectionWindow() {
    if (!this.log) {
      return null;
    }
    const screenLeft = (this.selectionWindowInternal.windowLeft || 0) * this.canvas.width;
    const screenRight = (this.selectionWindowInternal.windowRight || 0) * this.canvas.width;
    const barLeft = Math.floor(screenLeft / this.outerBarWidth);
    const barRight = Math.floor((screenRight + this.innerBarWidth - this.barPaddingWidth / 2) / this.outerBarWidth);
    const stepLeft = Platform.NumberUtilities.clamp(barLeft * this.samplesPerBar, 0, this.log.length - 1);
    const stepRight = Platform.NumberUtilities.clamp(barRight * this.samplesPerBar, 0, this.log.length);
    return { left: stepLeft, right: stepRight };
  }
  updateImage() {
    delete this.updateImageTimer;
    let left;
    let right;
    const window2 = this.selectionWindow();
    if (this.profiles && this.profiles.length && window2) {
      left = this.log[window2.left].commandIndex;
      right = this.log[window2.right - 1].commandIndex;
    }
    const scale = this.pendingScale;
    if (!this.snapshot) {
      return;
    }
    void this.snapshot.replay(scale, left, right).then((image) => {
      if (!image) {
        return;
      }
      this.scale = scale;
      this.showImageCallback(image);
    });
  }
  reset() {
    if (this.snapshot) {
      this.snapshot.release();
    }
    this.snapshot = null;
    this.profiles = null;
    this.selectionWindowInternal.reset();
    this.selectionWindowInternal.setEnabled(false);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([paintProfilerStyles]);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["WindowChanged"] = "WindowChanged";
  return Events2;
})(Events || {});
export class PaintProfilerCommandLogView extends UI.ThrottledWidget.ThrottledWidget {
  treeOutline;
  log;
  treeItemCache;
  selectionWindow;
  constructor() {
    super();
    this.setMinimumSize(100, 25);
    this.element.classList.add("overflow-auto");
    this.treeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    UI.ARIAUtils.setAccessibleName(this.treeOutline.contentElement, i18nString(UIStrings.commandLog));
    this.element.appendChild(this.treeOutline.element);
    this.setDefaultFocusedElement(this.treeOutline.contentElement);
    this.log = [];
    this.treeItemCache = /* @__PURE__ */ new Map();
  }
  setCommandLog(log) {
    this.log = log;
    this.updateWindow({ left: 0, right: this.log.length });
  }
  appendLogItem(logItem) {
    let treeElement = this.treeItemCache.get(logItem);
    if (!treeElement) {
      treeElement = new LogTreeElement(this, logItem);
      this.treeItemCache.set(logItem, treeElement);
    } else if (treeElement.parent) {
      return;
    }
    this.treeOutline.appendChild(treeElement);
  }
  updateWindow(selectionWindow) {
    this.selectionWindow = selectionWindow;
    this.update();
  }
  doUpdate() {
    if (!this.selectionWindow || !this.log.length) {
      this.treeOutline.removeChildren();
      return Promise.resolve();
    }
    const root = this.treeOutline.rootElement();
    for (; ; ) {
      const child = root.firstChild();
      if (!child || child.logItem.commandIndex >= this.selectionWindow.left) {
        break;
      }
      root.removeChildAtIndex(0);
    }
    for (; ; ) {
      const child = root.lastChild();
      if (!child || child.logItem.commandIndex < this.selectionWindow.right) {
        break;
      }
      root.removeChildAtIndex(root.children().length - 1);
    }
    for (let i = this.selectionWindow.left, right = this.selectionWindow.right; i < right; ++i) {
      this.appendLogItem(this.log[i]);
    }
    return Promise.resolve();
  }
}
export class LogTreeElement extends UI.TreeOutline.TreeElement {
  logItem;
  ownerView;
  filled;
  constructor(ownerView, logItem) {
    super("", Boolean(logItem.params));
    this.logItem = logItem;
    this.ownerView = ownerView;
    this.filled = false;
  }
  onattach() {
    this.update();
  }
  async onpopulate() {
    for (const param in this.logItem.params) {
      LogPropertyTreeElement.appendLogPropertyItem(this, param, this.logItem.params[param]);
    }
  }
  paramToString(param, name) {
    if (typeof param !== "object") {
      return typeof param === "string" && param.length > 100 ? name : JSON.stringify(param);
    }
    let str = "";
    let keyCount = 0;
    for (const key in param) {
      if (++keyCount > 4 || typeof param[key] === "object" || typeof param[key] === "string" && param[key].length > 100) {
        return name;
      }
      if (str) {
        str += ", ";
      }
      str += param[key];
    }
    return str;
  }
  paramsToString(params) {
    let str = "";
    for (const key in params) {
      if (str) {
        str += ", ";
      }
      str += this.paramToString(params[key], key);
    }
    return str;
  }
  update() {
    const title = document.createDocumentFragment();
    UI.UIUtils.createTextChild(title, this.logItem.method + "(" + this.paramsToString(this.logItem.params) + ")");
    this.title = title;
  }
}
export class LogPropertyTreeElement extends UI.TreeOutline.TreeElement {
  property;
  constructor(property) {
    super();
    this.property = property;
  }
  static appendLogPropertyItem(element, name, value) {
    const treeElement = new LogPropertyTreeElement({ name, value });
    element.appendChild(treeElement);
    if (value && typeof value === "object") {
      for (const property in value) {
        LogPropertyTreeElement.appendLogPropertyItem(treeElement, property, value[property]);
      }
    }
  }
  onattach() {
    const title = document.createDocumentFragment();
    const nameElement = title.createChild("span", "name");
    nameElement.textContent = this.property.name;
    const separatorElement = title.createChild("span", "separator");
    separatorElement.textContent = ": ";
    if (this.property.value === null || typeof this.property.value !== "object") {
      const valueElement = title.createChild("span", "value");
      valueElement.textContent = JSON.stringify(this.property.value);
      valueElement.classList.add("cm-js-" + (this.property.value === null ? "null" : typeof this.property.value));
    }
    this.title = title;
  }
}
export class PaintProfilerCategory {
  name;
  title;
  color;
  constructor(name, title, color) {
    this.name = name;
    this.title = title;
    this.color = color;
  }
}
//# sourceMappingURL=PaintProfilerView.js.map
