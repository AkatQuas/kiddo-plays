import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as TimelineModel from "../../models/timeline_model/timeline_model.js";
import { TimelineUIUtils } from "./TimelineUIUtils.js";
export class PerformanceModel extends Common.ObjectWrapper.ObjectWrapper {
  mainTargetInternal;
  tracingModelInternal;
  filtersInternal;
  timelineModelInternal;
  frameModelInternal;
  filmStripModelInternal;
  irModel;
  windowInternal;
  extensionTracingModels;
  recordStartTimeInternal;
  constructor() {
    super();
    this.mainTargetInternal = null;
    this.tracingModelInternal = null;
    this.filtersInternal = [];
    this.timelineModelInternal = new TimelineModel.TimelineModel.TimelineModelImpl();
    this.frameModelInternal = new TimelineModel.TimelineFrameModel.TimelineFrameModel((event) => TimelineUIUtils.eventStyle(event).category.name);
    this.filmStripModelInternal = null;
    this.irModel = new TimelineModel.TimelineIRModel.TimelineIRModel();
    this.windowInternal = { left: 0, right: Infinity };
    this.extensionTracingModels = [];
    this.recordStartTimeInternal = void 0;
  }
  setMainTarget(target) {
    this.mainTargetInternal = target;
  }
  mainTarget() {
    return this.mainTargetInternal;
  }
  setRecordStartTime(time) {
    this.recordStartTimeInternal = time;
  }
  recordStartTime() {
    return this.recordStartTimeInternal;
  }
  setFilters(filters) {
    this.filtersInternal = filters;
  }
  filters() {
    return this.filtersInternal;
  }
  isVisible(event) {
    return this.filtersInternal.every((f) => f.accept(event));
  }
  setTracingModel(model) {
    this.tracingModelInternal = model;
    this.timelineModelInternal.setEvents(model);
    let animationEvents = null;
    for (const track of this.timelineModelInternal.tracks()) {
      if (track.type === TimelineModel.TimelineModel.TrackType.Animation) {
        animationEvents = track.asyncEvents;
      }
    }
    if (animationEvents) {
      this.irModel.populate([], animationEvents || []);
    }
    const mainTracks = this.timelineModelInternal.tracks().filter((track) => track.type === TimelineModel.TimelineModel.TrackType.MainThread && track.forMainFrame && track.events.length);
    const threadData = mainTracks.map((track) => {
      const event = track.events[0];
      return { thread: event.thread, time: event.startTime };
    });
    this.frameModelInternal.addTraceEvents(this.mainTargetInternal, this.timelineModelInternal.inspectedTargetEvents(), threadData);
    for (const entry of this.extensionTracingModels) {
      entry.model.adjustTime(this.tracingModelInternal.minimumRecordTime() + entry.timeOffset / 1e3 - this.recordStartTimeInternal);
    }
    this.autoWindowTimes();
  }
  addExtensionEvents(title, model, timeOffset) {
    this.extensionTracingModels.push({ model, title, timeOffset });
    if (!this.tracingModelInternal) {
      return;
    }
    model.adjustTime(this.tracingModelInternal.minimumRecordTime() + timeOffset / 1e3 - this.recordStartTimeInternal);
    this.dispatchEventToListeners(Events.ExtensionDataAdded);
  }
  tracingModel() {
    if (!this.tracingModelInternal) {
      throw "call setTracingModel before accessing PerformanceModel";
    }
    return this.tracingModelInternal;
  }
  timelineModel() {
    return this.timelineModelInternal;
  }
  filmStripModel() {
    if (this.filmStripModelInternal) {
      return this.filmStripModelInternal;
    }
    if (!this.tracingModelInternal) {
      throw "call setTracingModel before accessing PerformanceModel";
    }
    this.filmStripModelInternal = new SDK.FilmStripModel.FilmStripModel(this.tracingModelInternal);
    return this.filmStripModelInternal;
  }
  frames() {
    return this.frameModelInternal.getFrames();
  }
  frameModel() {
    return this.frameModelInternal;
  }
  interactionRecords() {
    return this.irModel.interactionRecords();
  }
  extensionInfo() {
    return this.extensionTracingModels;
  }
  dispose() {
    if (this.tracingModelInternal) {
      this.tracingModelInternal.dispose();
    }
    for (const extensionEntry of this.extensionTracingModels) {
      extensionEntry.model.dispose();
    }
  }
  filmStripModelFrame(frame) {
    const screenshotTime = frame.idle ? frame.startTime : frame.endTime;
    const filmStripModel = this.filmStripModelInternal;
    const filmStripFrame = filmStripModel.frameByTimestamp(screenshotTime);
    return filmStripFrame && filmStripFrame.timestamp - frame.endTime < 10 ? filmStripFrame : null;
  }
  save(stream) {
    if (!this.tracingModelInternal) {
      throw "call setTracingModel before accessing PerformanceModel";
    }
    const backingStorage = this.tracingModelInternal.backingStorage();
    return backingStorage.writeToStream(stream);
  }
  setWindow(window, animate) {
    this.windowInternal = window;
    this.dispatchEventToListeners(Events.WindowChanged, { window, animate });
  }
  window() {
    return this.windowInternal;
  }
  autoWindowTimes() {
    const timelineModel = this.timelineModelInternal;
    let tasks = [];
    for (const track of timelineModel.tracks()) {
      if (track.type === TimelineModel.TimelineModel.TrackType.MainThread && track.forMainFrame) {
        tasks = track.tasks;
      }
    }
    if (!tasks.length) {
      this.setWindow({ left: timelineModel.minimumRecordTime(), right: timelineModel.maximumRecordTime() });
      return;
    }
    function findLowUtilizationRegion(startIndex, stopIndex) {
      const threshold = 0.1;
      let cutIndex = startIndex;
      let cutTime = (tasks[cutIndex].startTime + tasks[cutIndex].endTime) / 2;
      let usedTime = 0;
      const step = Math.sign(stopIndex - startIndex);
      for (let i = startIndex; i !== stopIndex; i += step) {
        const task = tasks[i];
        const taskTime = (task.startTime + task.endTime) / 2;
        const interval = Math.abs(cutTime - taskTime);
        if (usedTime < threshold * interval) {
          cutIndex = i;
          cutTime = taskTime;
          usedTime = 0;
        }
        usedTime += task.duration;
      }
      return cutIndex;
    }
    const rightIndex = findLowUtilizationRegion(tasks.length - 1, 0);
    const leftIndex = findLowUtilizationRegion(0, rightIndex);
    let leftTime = tasks[leftIndex].startTime;
    let rightTime = tasks[rightIndex].endTime;
    const span = rightTime - leftTime;
    const totalSpan = timelineModel.maximumRecordTime() - timelineModel.minimumRecordTime();
    if (span < totalSpan * 0.1) {
      leftTime = timelineModel.minimumRecordTime();
      rightTime = timelineModel.maximumRecordTime();
    } else {
      leftTime = Math.max(leftTime - 0.05 * span, timelineModel.minimumRecordTime());
      rightTime = Math.min(rightTime + 0.05 * span, timelineModel.maximumRecordTime());
    }
    this.setWindow({ left: leftTime, right: rightTime });
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ExtensionDataAdded"] = "ExtensionDataAdded";
  Events2["WindowChanged"] = "WindowChanged";
  return Events2;
})(Events || {});
//# sourceMappingURL=PerformanceModel.js.map
