import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import { TimelineJSProfileProcessor } from "./TimelineJSProfile.js";
const UIStrings = {
  threadS: "Thread {PH1}",
  workerS: "`Worker` \u2014 {PH1}",
  dedicatedWorker: "Dedicated `Worker`",
  workerSS: "`Worker`: {PH1} \u2014 {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("models/timeline_model/TimelineModel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TimelineModelImpl {
  isGenericTraceInternal;
  tracksInternal;
  namedTracks;
  inspectedTargetEventsInternal;
  timeMarkerEventsInternal;
  sessionId;
  mainFrameNodeId;
  pageFrames;
  cpuProfilesInternal;
  workerIdByThread;
  requestsFromBrowser;
  mainFrame;
  minimumRecordTimeInternal;
  maximumRecordTimeInternal;
  totalBlockingTimeInternal;
  estimatedTotalBlockingTime;
  asyncEventTracker;
  invalidationTracker;
  layoutInvalidate;
  lastScheduleStyleRecalculation;
  paintImageEventByPixelRefId;
  lastPaintForLayer;
  lastRecalculateStylesEvent;
  currentScriptEvent;
  eventStack;
  browserFrameTracking;
  persistentIds;
  legacyCurrentPage;
  currentTaskLayoutAndRecalcEvents;
  tracingModelInternal;
  mainFrameLayerTreeId;
  constructor() {
    this.minimumRecordTimeInternal = 0;
    this.maximumRecordTimeInternal = 0;
    this.totalBlockingTimeInternal = 0;
    this.estimatedTotalBlockingTime = 0;
    this.reset();
    this.resetProcessingState();
    this.currentTaskLayoutAndRecalcEvents = [];
    this.tracingModelInternal = null;
  }
  static forEachEvent(events, onStartEvent, onEndEvent, onInstantEvent, startTime, endTime, filter) {
    startTime = startTime || 0;
    endTime = endTime || Infinity;
    const stack = [];
    const startEvent = TimelineModelImpl.topLevelEventEndingAfter(events, startTime);
    for (let i = startEvent; i < events.length; ++i) {
      const e = events[i];
      if ((e.endTime || e.startTime) < startTime) {
        continue;
      }
      if (e.startTime >= endTime) {
        break;
      }
      if (SDK.TracingModel.TracingModel.isAsyncPhase(e.phase) || SDK.TracingModel.TracingModel.isFlowPhase(e.phase)) {
        continue;
      }
      let last = stack[stack.length - 1];
      while (last && last.endTime !== void 0 && last.endTime <= e.startTime) {
        stack.pop();
        onEndEvent(last);
        last = stack[stack.length - 1];
      }
      if (filter && !filter(e)) {
        continue;
      }
      if (e.duration) {
        onStartEvent(e);
        stack.push(e);
      } else {
        onInstantEvent && onInstantEvent(e, stack[stack.length - 1] || null);
      }
    }
    while (stack.length) {
      const last = stack.pop();
      if (last) {
        onEndEvent(last);
      }
    }
  }
  static topLevelEventEndingAfter(events, time) {
    let index = Platform.ArrayUtilities.upperBound(events, time, (time2, event) => time2 - event.startTime) - 1;
    while (index > 0 && !SDK.TracingModel.TracingModel.isTopLevelEvent(events[index])) {
      index--;
    }
    return Math.max(index, 0);
  }
  isMarkerEvent(event) {
    switch (event.name) {
      case RecordType.TimeStamp:
        return true;
      case RecordType.MarkFirstPaint:
      case RecordType.MarkFCP:
        return Boolean(this.mainFrame) && event.args.frame === this.mainFrame.frameId && Boolean(event.args.data);
      case RecordType.MarkDOMContent:
      case RecordType.MarkLoad:
      case RecordType.MarkLCPCandidate:
      case RecordType.MarkLCPInvalidate:
        return Boolean(event.args["data"]["isOutermostMainFrame"] ?? event.args["data"]["isMainFrame"]);
      default:
        return false;
    }
  }
  isInteractiveTimeEvent(event) {
    return event.name === RecordType.InteractiveTime;
  }
  isLayoutShiftEvent(event) {
    return event.name === RecordType.LayoutShift;
  }
  isUserTimingEvent(event) {
    return event.categoriesString === TimelineModelImpl.Category.UserTiming;
  }
  isParseHTMLEvent(event) {
    return event.name === RecordType.ParseHTML;
  }
  isLCPCandidateEvent(event) {
    return event.name === RecordType.MarkLCPCandidate && Boolean(event.args["data"]["isOutermostMainFrame"] ?? event.args["data"]["isMainFrame"]);
  }
  isLCPInvalidateEvent(event) {
    return event.name === RecordType.MarkLCPInvalidate && Boolean(event.args["data"]["isOutermostMainFrame"] ?? event.args["data"]["isMainFrame"]);
  }
  isFCPEvent(event) {
    return event.name === RecordType.MarkFCP && Boolean(this.mainFrame) && event.args["frame"] === this.mainFrame.frameId;
  }
  isLongRunningTask(event) {
    return event.name === RecordType.Task && TimelineData.forEvent(event).warning === TimelineModelImpl.WarningType.LongTask;
  }
  isNavigationStartEvent(event) {
    return event.name === RecordType.NavigationStart;
  }
  isMainFrameNavigationStartEvent(event) {
    return this.isNavigationStartEvent(event) && (event.args["data"]["isOutermostMainFrame"] ?? event.args["data"]["isLoadingMainFrame"]) && event.args["data"]["documentLoaderURL"];
  }
  static globalEventId(event, field) {
    const data = event.args["data"] || event.args["beginData"];
    const id = data && data[field];
    if (!id) {
      return "";
    }
    return `${event.thread.process().id()}.${id}`;
  }
  static eventFrameId(event) {
    const data = event.args["data"] || event.args["beginData"];
    return data && data["frame"] || null;
  }
  cpuProfiles() {
    return this.cpuProfilesInternal;
  }
  totalBlockingTime() {
    if (this.totalBlockingTimeInternal === -1) {
      return { time: this.estimatedTotalBlockingTime, estimated: true };
    }
    return { time: this.totalBlockingTimeInternal, estimated: false };
  }
  targetByEvent(event) {
    const workerId = this.workerIdByThread.get(event.thread);
    const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    return workerId ? SDK.TargetManager.TargetManager.instance().targetById(workerId) : mainTarget;
  }
  navStartTimes() {
    if (!this.tracingModelInternal) {
      return /* @__PURE__ */ new Map();
    }
    return this.tracingModelInternal.navStartTimes();
  }
  setEvents(tracingModel) {
    this.reset();
    this.resetProcessingState();
    this.tracingModelInternal = tracingModel;
    this.minimumRecordTimeInternal = tracingModel.minimumRecordTime();
    this.maximumRecordTimeInternal = tracingModel.maximumRecordTime();
    const layoutShiftEvents = [];
    for (const process of tracingModel.sortedProcesses()) {
      if (process.name() !== "Renderer") {
        continue;
      }
      for (const thread of process.sortedThreads()) {
        const shifts = thread.removeEventsByName(RecordType.LayoutShift);
        layoutShiftEvents.push(...shifts);
      }
    }
    this.processSyncBrowserEvents(tracingModel);
    if (this.browserFrameTracking) {
      this.processThreadsForBrowserFrames(tracingModel);
    } else {
      const metadataEvents = this.processMetadataEvents(tracingModel);
      this.isGenericTraceInternal = !metadataEvents;
      if (metadataEvents) {
        this.processMetadataAndThreads(tracingModel, metadataEvents);
      } else {
        this.processGenericTrace(tracingModel);
      }
    }
    this.inspectedTargetEventsInternal.sort(SDK.TracingModel.Event.compareStartTime);
    this.processAsyncBrowserEvents(tracingModel);
    this.buildGPUEvents(tracingModel);
    this.buildLoadingEvents(tracingModel, layoutShiftEvents);
    this.resetProcessingState();
  }
  processGenericTrace(tracingModel) {
    let browserMainThread = SDK.TracingModel.TracingModel.browserMainThread(tracingModel);
    if (!browserMainThread && tracingModel.sortedProcesses().length) {
      browserMainThread = tracingModel.sortedProcesses()[0].sortedThreads()[0];
    }
    for (const process of tracingModel.sortedProcesses()) {
      for (const thread of process.sortedThreads()) {
        this.processThreadEvents(tracingModel, [{ from: 0, to: Infinity }], thread, thread === browserMainThread, false, true, null);
      }
    }
  }
  processMetadataAndThreads(tracingModel, metadataEvents) {
    let startTime = 0;
    for (let i = 0, length = metadataEvents.page.length; i < length; i++) {
      const metaEvent = metadataEvents.page[i];
      const process = metaEvent.thread.process();
      const endTime = i + 1 < length ? metadataEvents.page[i + 1].startTime : Infinity;
      if (startTime === endTime) {
        continue;
      }
      this.legacyCurrentPage = metaEvent.args["data"] && metaEvent.args["data"]["page"];
      for (const thread of process.sortedThreads()) {
        let workerUrl = null;
        if (thread.name() === TimelineModelImpl.WorkerThreadName || thread.name() === TimelineModelImpl.WorkerThreadNameLegacy) {
          const workerMetaEvent = metadataEvents.workers.find((e) => {
            if (e.args["data"]["workerThreadId"] !== thread.id()) {
              return false;
            }
            if (e.args["data"]["sessionId"] === this.sessionId) {
              return true;
            }
            const frameId = TimelineModelImpl.eventFrameId(e);
            return frameId ? Boolean(this.pageFrames.get(frameId)) : false;
          });
          if (!workerMetaEvent) {
            continue;
          }
          const workerId = workerMetaEvent.args["data"]["workerId"];
          if (workerId) {
            this.workerIdByThread.set(thread, workerId);
          }
          workerUrl = workerMetaEvent.args["data"]["url"] || Platform.DevToolsPath.EmptyUrlString;
        }
        this.processThreadEvents(tracingModel, [{ from: startTime, to: endTime }], thread, thread === metaEvent.thread, Boolean(workerUrl), true, workerUrl);
      }
      startTime = endTime;
    }
  }
  processThreadsForBrowserFrames(tracingModel) {
    const processData = /* @__PURE__ */ new Map();
    for (const frame of this.pageFrames.values()) {
      for (let i = 0; i < frame.processes.length; i++) {
        const pid = frame.processes[i].processId;
        let data = processData.get(pid);
        if (!data) {
          data = [];
          processData.set(pid, data);
        }
        const to = i === frame.processes.length - 1 ? frame.deletedTime || Infinity : frame.processes[i + 1].time;
        data.push({ from: frame.processes[i].time, to, main: !frame.parent, url: frame.processes[i].url });
      }
    }
    const allMetadataEvents = tracingModel.devToolsMetadataEvents();
    for (const process of tracingModel.sortedProcesses()) {
      const data = processData.get(process.id());
      if (!data) {
        continue;
      }
      data.sort((a, b) => a.from - b.from || a.to - b.to);
      const ranges = [];
      let lastUrl = null;
      let lastMainUrl = null;
      let hasMain = false;
      for (const item of data) {
        const last = ranges[ranges.length - 1];
        if (!last || item.from > last.to) {
          ranges.push({ from: item.from, to: item.to });
        } else {
          last.to = item.to;
        }
        if (item.main) {
          hasMain = true;
        }
        if (item.url) {
          if (item.main) {
            lastMainUrl = item.url;
          }
          lastUrl = item.url;
        }
      }
      for (const thread of process.sortedThreads()) {
        if (thread.name() === TimelineModelImpl.RendererMainThreadName) {
          this.processThreadEvents(tracingModel, ranges, thread, true, false, hasMain, hasMain ? lastMainUrl : lastUrl);
        } else if (thread.name() === TimelineModelImpl.WorkerThreadName || thread.name() === TimelineModelImpl.WorkerThreadNameLegacy) {
          const workerMetaEvent = allMetadataEvents.find((e) => {
            if (e.name !== TimelineModelImpl.DevToolsMetadataEvent.TracingSessionIdForWorker) {
              return false;
            }
            if (e.thread.process() !== process) {
              return false;
            }
            if (e.args["data"]["workerThreadId"] !== thread.id()) {
              return false;
            }
            const frameId = TimelineModelImpl.eventFrameId(e);
            return frameId ? Boolean(this.pageFrames.get(frameId)) : false;
          });
          if (!workerMetaEvent) {
            continue;
          }
          this.workerIdByThread.set(thread, workerMetaEvent.args["data"]["workerId"] || "");
          this.processThreadEvents(tracingModel, ranges, thread, false, true, false, workerMetaEvent.args["data"]["url"] || Platform.DevToolsPath.EmptyUrlString);
        } else {
          this.processThreadEvents(tracingModel, ranges, thread, false, false, false, null);
        }
      }
    }
  }
  processMetadataEvents(tracingModel) {
    const metadataEvents = tracingModel.devToolsMetadataEvents();
    const pageDevToolsMetadataEvents = [];
    const workersDevToolsMetadataEvents = [];
    for (const event of metadataEvents) {
      if (event.name === TimelineModelImpl.DevToolsMetadataEvent.TracingStartedInPage) {
        pageDevToolsMetadataEvents.push(event);
        if (event.args["data"] && event.args["data"]["persistentIds"]) {
          this.persistentIds = true;
        }
        const frames = event.args["data"] && event.args["data"]["frames"] || [];
        frames.forEach((payload) => this.addPageFrame(event, payload));
        this.mainFrame = this.rootFrames()[0];
      } else if (event.name === TimelineModelImpl.DevToolsMetadataEvent.TracingSessionIdForWorker) {
        workersDevToolsMetadataEvents.push(event);
      } else if (event.name === TimelineModelImpl.DevToolsMetadataEvent.TracingStartedInBrowser) {
        console.assert(!this.mainFrameNodeId, "Multiple sessions in trace");
        this.mainFrameNodeId = event.args["frameTreeNodeId"];
      }
    }
    if (!pageDevToolsMetadataEvents.length) {
      return null;
    }
    const sessionId = pageDevToolsMetadataEvents[0].args["sessionId"] || pageDevToolsMetadataEvents[0].args["data"]["sessionId"];
    this.sessionId = sessionId;
    const mismatchingIds = /* @__PURE__ */ new Set();
    function checkSessionId(event) {
      let args = event.args;
      if (args["data"]) {
        args = args["data"];
      }
      const id = args["sessionId"];
      if (id === sessionId) {
        return true;
      }
      mismatchingIds.add(id);
      return false;
    }
    const result = {
      page: pageDevToolsMetadataEvents.filter(checkSessionId).sort(SDK.TracingModel.Event.compareStartTime),
      workers: workersDevToolsMetadataEvents.sort(SDK.TracingModel.Event.compareStartTime)
    };
    if (mismatchingIds.size) {
      Common.Console.Console.instance().error("Timeline recording was started in more than one page simultaneously. Session id mismatch: " + this.sessionId + " and " + [...mismatchingIds] + ".");
    }
    return result;
  }
  processSyncBrowserEvents(tracingModel) {
    const browserMain = SDK.TracingModel.TracingModel.browserMainThread(tracingModel);
    if (browserMain) {
      browserMain.events().forEach(this.processBrowserEvent, this);
    }
  }
  processAsyncBrowserEvents(tracingModel) {
    const browserMain = SDK.TracingModel.TracingModel.browserMainThread(tracingModel);
    if (browserMain) {
      this.processAsyncEvents(browserMain, [{ from: 0, to: Infinity }]);
    }
  }
  buildGPUEvents(tracingModel) {
    const thread = tracingModel.getThreadByName("GPU Process", "CrGpuMain");
    if (!thread) {
      return;
    }
    const gpuEventName = RecordType.GPUTask;
    const track = this.ensureNamedTrack(TrackType.GPU);
    track.thread = thread;
    track.events = thread.events().filter((event) => event.name === gpuEventName);
  }
  buildLoadingEvents(tracingModel, events) {
    const thread = tracingModel.getThreadByName("Renderer", "CrRendererMain");
    if (!thread) {
      return;
    }
    const experienceCategory = "experience";
    const track = this.ensureNamedTrack(TrackType.Experience);
    track.thread = thread;
    track.events = events;
    for (const trackEvent of track.events) {
      trackEvent.categoriesString = experienceCategory;
      if (trackEvent.name === RecordType.LayoutShift) {
        const eventData = trackEvent.args["data"] || trackEvent.args["beginData"] || {};
        const timelineData = TimelineData.forEvent(trackEvent);
        if (eventData["impacted_nodes"]) {
          for (let i = 0; i < eventData["impacted_nodes"].length; ++i) {
            timelineData.backendNodeIds.push(eventData["impacted_nodes"][i]["node_id"]);
          }
        }
      }
    }
  }
  resetProcessingState() {
    this.asyncEventTracker = new TimelineAsyncEventTracker();
    this.invalidationTracker = new InvalidationTracker();
    this.layoutInvalidate = {};
    this.lastScheduleStyleRecalculation = {};
    this.paintImageEventByPixelRefId = {};
    this.lastPaintForLayer = {};
    this.lastRecalculateStylesEvent = null;
    this.currentScriptEvent = null;
    this.eventStack = [];
    this.browserFrameTracking = false;
    this.persistentIds = false;
    this.legacyCurrentPage = null;
  }
  extractCpuProfile(tracingModel, thread) {
    const events = thread.events();
    let cpuProfile;
    let target = null;
    let cpuProfileEvent = events[events.length - 1];
    if (cpuProfileEvent && cpuProfileEvent.name === RecordType.CpuProfile) {
      const eventData = cpuProfileEvent.args["data"];
      cpuProfile = eventData && eventData["cpuProfile"];
      target = this.targetByEvent(cpuProfileEvent);
    }
    if (!cpuProfile) {
      cpuProfileEvent = events.find((e) => e.name === RecordType.Profile);
      if (!cpuProfileEvent) {
        return null;
      }
      target = this.targetByEvent(cpuProfileEvent);
      const profileGroup = tracingModel.profileGroup(cpuProfileEvent);
      if (!profileGroup) {
        Common.Console.Console.instance().error("Invalid CPU profile format.");
        return null;
      }
      cpuProfile = {
        startTime: cpuProfileEvent.startTime * 1e3,
        endTime: 0,
        nodes: [],
        samples: [],
        timeDeltas: [],
        lines: []
      };
      for (const profileEvent of profileGroup.children) {
        const eventData = profileEvent.args["data"];
        if ("startTime" in eventData) {
          cpuProfile.startTime = profileEvent.startTime * 1e3;
        }
        if ("endTime" in eventData) {
          cpuProfile.endTime = profileEvent.startTime * 1e3;
        }
        const nodesAndSamples = eventData["cpuProfile"] || {};
        const samples = nodesAndSamples["samples"] || [];
        const lines = eventData["lines"] || Array(samples.length).fill(0);
        cpuProfile.nodes.push(...nodesAndSamples["nodes"] || []);
        cpuProfile.lines.push(...lines);
        if (cpuProfile.samples) {
          cpuProfile.samples.push(...samples);
        }
        if (cpuProfile.timeDeltas) {
          cpuProfile.timeDeltas.push(...eventData["timeDeltas"] || []);
        }
        if (cpuProfile.samples && cpuProfile.timeDeltas && cpuProfile.samples.length !== cpuProfile.timeDeltas.length) {
          Common.Console.Console.instance().error("Failed to parse CPU profile.");
          return null;
        }
      }
      if (!cpuProfile.endTime && cpuProfile.timeDeltas) {
        const timeDeltas = cpuProfile.timeDeltas;
        cpuProfile.endTime = timeDeltas.reduce((x, y) => x + y, cpuProfile.startTime);
      }
    }
    try {
      const profile = cpuProfile;
      const jsProfileModel = new SDK.CPUProfileDataModel.CPUProfileDataModel(profile, target);
      this.cpuProfilesInternal.push(jsProfileModel);
      return jsProfileModel;
    } catch (e) {
      Common.Console.Console.instance().error("Failed to parse CPU profile.");
    }
    return null;
  }
  injectJSFrameEvents(tracingModel, thread) {
    const jsProfileModel = this.extractCpuProfile(tracingModel, thread);
    let events = thread.events();
    const jsSamples = jsProfileModel ? TimelineJSProfileProcessor.generateTracingEventsFromCpuProfile(jsProfileModel, thread) : null;
    if (jsSamples && jsSamples.length) {
      events = Platform.ArrayUtilities.mergeOrdered(events, jsSamples, SDK.TracingModel.Event.orderedCompareStartTime);
    }
    if (jsSamples || events.some((e) => e.name === RecordType.JSSample)) {
      const jsFrameEvents = TimelineJSProfileProcessor.generateJSFrameEvents(events, {
        showAllEvents: Root.Runtime.experiments.isEnabled("timelineShowAllEvents"),
        showRuntimeCallStats: Root.Runtime.experiments.isEnabled("timelineV8RuntimeCallStats"),
        showNativeFunctions: Common.Settings.Settings.instance().moduleSetting("showNativeFunctionsInJSProfile").get()
      });
      if (jsFrameEvents && jsFrameEvents.length) {
        events = Platform.ArrayUtilities.mergeOrdered(jsFrameEvents, events, SDK.TracingModel.Event.orderedCompareStartTime);
      }
    }
    return events;
  }
  processThreadEvents(tracingModel, ranges, thread, isMainThread, isWorker, forMainFrame, url) {
    const track = new Track();
    track.name = thread.name() || i18nString(UIStrings.threadS, { PH1: thread.id() });
    track.type = TrackType.Other;
    track.thread = thread;
    if (isMainThread) {
      track.type = TrackType.MainThread;
      track.url = url || Platform.DevToolsPath.EmptyUrlString;
      track.forMainFrame = forMainFrame;
    } else if (isWorker) {
      track.type = TrackType.Worker;
      track.url = url || Platform.DevToolsPath.EmptyUrlString;
      track.name = track.url ? i18nString(UIStrings.workerS, { PH1: track.url }) : i18nString(UIStrings.dedicatedWorker);
    } else if (thread.name().startsWith("CompositorTileWorker")) {
      track.type = TrackType.Raster;
    }
    this.tracksInternal.push(track);
    const events = this.injectJSFrameEvents(tracingModel, thread);
    this.eventStack = [];
    const eventStack = this.eventStack;
    if (isWorker) {
      const cpuProfileEvent = events.find((event) => event.name === RecordType.Profile);
      if (cpuProfileEvent) {
        const target = this.targetByEvent(cpuProfileEvent);
        if (target) {
          track.name = i18nString(UIStrings.workerSS, { PH1: target.name(), PH2: track.url });
        }
      }
    }
    for (const range of ranges) {
      let i = Platform.ArrayUtilities.lowerBound(events, range.from, (time, event) => time - event.startTime);
      for (; i < events.length; i++) {
        const event = events[i];
        if (event.startTime >= range.to) {
          break;
        }
        if (this.isInteractiveTimeEvent(event) && this.totalBlockingTimeInternal === -1) {
          this.totalBlockingTimeInternal = event.args["args"]["total_blocking_time_ms"];
        }
        const isLongRunningTask = event.name === RecordType.Task && event.duration && event.duration > 50;
        if (isMainThread && isLongRunningTask && event.duration) {
          this.estimatedTotalBlockingTime += event.duration - 50;
        }
        let last = eventStack[eventStack.length - 1];
        while (last && last.endTime !== void 0 && last.endTime <= event.startTime) {
          eventStack.pop();
          last = eventStack[eventStack.length - 1];
        }
        if (!this.processEvent(event)) {
          continue;
        }
        if (!SDK.TracingModel.TracingModel.isAsyncPhase(event.phase) && event.duration) {
          if (eventStack.length) {
            const parent = eventStack[eventStack.length - 1];
            if (parent) {
              parent.selfTime -= event.duration;
              if (parent.selfTime < 0) {
                this.fixNegativeDuration(parent, event);
              }
            }
          }
          event.selfTime = event.duration;
          if (!eventStack.length) {
            track.tasks.push(event);
          }
          eventStack.push(event);
        }
        if (this.isMarkerEvent(event)) {
          this.timeMarkerEventsInternal.push(event);
        }
        track.events.push(event);
        this.inspectedTargetEventsInternal.push(event);
      }
    }
    this.processAsyncEvents(thread, ranges);
  }
  fixNegativeDuration(event, child) {
    const epsilon = 1e-3;
    if (event.selfTime < -epsilon) {
      console.error(`Children are longer than parent at ${event.startTime} (${(child.startTime - this.minimumRecordTime()).toFixed(3)} by ${(-event.selfTime).toFixed(3)}`);
    }
    event.selfTime = 0;
  }
  processAsyncEvents(thread, ranges) {
    const asyncEvents = thread.asyncEvents();
    const groups = /* @__PURE__ */ new Map();
    function group(type) {
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      return groups.get(type);
    }
    for (const range of ranges) {
      let i = Platform.ArrayUtilities.lowerBound(asyncEvents, range.from, function(time, asyncEvent) {
        return time - asyncEvent.startTime;
      });
      for (; i < asyncEvents.length; ++i) {
        const asyncEvent = asyncEvents[i];
        if (asyncEvent.startTime >= range.to) {
          break;
        }
        if (asyncEvent.hasCategory(TimelineModelImpl.Category.Console)) {
          group(TrackType.Console).push(asyncEvent);
          continue;
        }
        if (asyncEvent.hasCategory(TimelineModelImpl.Category.UserTiming)) {
          group(TrackType.Timings).push(asyncEvent);
          continue;
        }
        if (asyncEvent.name === RecordType.Animation) {
          group(TrackType.Animation).push(asyncEvent);
          continue;
        }
      }
    }
    for (const [type, events] of groups) {
      const track = this.ensureNamedTrack(type);
      track.thread = thread;
      track.asyncEvents = Platform.ArrayUtilities.mergeOrdered(track.asyncEvents, events, SDK.TracingModel.Event.compareStartTime);
    }
  }
  processEvent(event) {
    const eventStack = this.eventStack;
    if (!eventStack.length) {
      if (this.currentTaskLayoutAndRecalcEvents && this.currentTaskLayoutAndRecalcEvents.length) {
        const totalTime = this.currentTaskLayoutAndRecalcEvents.reduce((time, event2) => {
          return event2.duration === void 0 ? time : time + event2.duration;
        }, 0);
        if (totalTime > TimelineModelImpl.Thresholds.ForcedLayout) {
          for (const e of this.currentTaskLayoutAndRecalcEvents) {
            const timelineData2 = TimelineData.forEvent(e);
            timelineData2.warning = e.name === RecordType.Layout ? TimelineModelImpl.WarningType.ForcedLayout : TimelineModelImpl.WarningType.ForcedStyle;
          }
        }
      }
      this.currentTaskLayoutAndRecalcEvents = [];
    }
    if (this.currentScriptEvent) {
      if (this.currentScriptEvent.endTime !== void 0 && event.startTime > this.currentScriptEvent.endTime) {
        this.currentScriptEvent = null;
      }
    }
    const eventData = event.args["data"] || event.args["beginData"] || {};
    const timelineData = TimelineData.forEvent(event);
    if (eventData["stackTrace"]) {
      timelineData.stackTrace = eventData["stackTrace"].map((callFrameOrProfileNode) => {
        if (event.name !== RecordType.JSSample) {
          const frame = { ...callFrameOrProfileNode };
          --frame.lineNumber;
          --frame.columnNumber;
          return frame;
        }
        return callFrameOrProfileNode;
      });
    }
    let pageFrameId = TimelineModelImpl.eventFrameId(event);
    const last = eventStack[eventStack.length - 1];
    if (!pageFrameId && last) {
      pageFrameId = TimelineData.forEvent(last).frameId;
    }
    timelineData.frameId = pageFrameId || this.mainFrame && this.mainFrame.frameId || "";
    this.asyncEventTracker.processEvent(event);
    if (this.isMarkerEvent(event)) {
      this.ensureNamedTrack(TrackType.Timings);
    }
    switch (event.name) {
      case RecordType.ResourceSendRequest:
      case RecordType.WebSocketCreate: {
        timelineData.setInitiator(eventStack[eventStack.length - 1] || null);
        timelineData.url = eventData["url"];
        break;
      }
      case RecordType.ScheduleStyleRecalculation: {
        this.lastScheduleStyleRecalculation[eventData["frame"]] = event;
        break;
      }
      case RecordType.UpdateLayoutTree:
      case RecordType.RecalculateStyles: {
        this.invalidationTracker.didRecalcStyle(event);
        if (event.args["beginData"]) {
          timelineData.setInitiator(this.lastScheduleStyleRecalculation[event.args["beginData"]["frame"]]);
        }
        this.lastRecalculateStylesEvent = event;
        if (this.currentScriptEvent) {
          this.currentTaskLayoutAndRecalcEvents.push(event);
        }
        break;
      }
      case RecordType.ScheduleStyleInvalidationTracking:
      case RecordType.StyleRecalcInvalidationTracking:
      case RecordType.StyleInvalidatorInvalidationTracking:
      case RecordType.LayoutInvalidationTracking: {
        this.invalidationTracker.addInvalidation(new InvalidationTrackingEvent(event, timelineData));
        break;
      }
      case RecordType.InvalidateLayout: {
        let layoutInitator = event;
        const frameId = eventData["frame"];
        if (!this.layoutInvalidate[frameId] && this.lastRecalculateStylesEvent && this.lastRecalculateStylesEvent.endTime !== void 0 && this.lastRecalculateStylesEvent.endTime > event.startTime) {
          layoutInitator = TimelineData.forEvent(this.lastRecalculateStylesEvent).initiator();
        }
        this.layoutInvalidate[frameId] = layoutInitator;
        break;
      }
      case RecordType.Layout: {
        this.invalidationTracker.didLayout(event);
        const frameId = event.args["beginData"]["frame"];
        timelineData.setInitiator(this.layoutInvalidate[frameId]);
        if (event.args["endData"]) {
          if (event.args["endData"]["layoutRoots"]) {
            for (let i = 0; i < event.args["endData"]["layoutRoots"].length; ++i) {
              timelineData.backendNodeIds.push(event.args["endData"]["layoutRoots"][i]["nodeId"]);
            }
          } else {
            timelineData.backendNodeIds.push(event.args["endData"]["rootNode"]);
          }
        }
        this.layoutInvalidate[frameId] = null;
        if (this.currentScriptEvent) {
          this.currentTaskLayoutAndRecalcEvents.push(event);
        }
        break;
      }
      case RecordType.Task: {
        if (event.duration !== void 0 && event.duration > TimelineModelImpl.Thresholds.LongTask) {
          timelineData.warning = TimelineModelImpl.WarningType.LongTask;
        }
        break;
      }
      case RecordType.EventDispatch: {
        if (event.duration !== void 0 && event.duration > TimelineModelImpl.Thresholds.RecurringHandler) {
          timelineData.warning = TimelineModelImpl.WarningType.LongHandler;
        }
        break;
      }
      case RecordType.TimerFire:
      case RecordType.FireAnimationFrame: {
        if (event.duration !== void 0 && event.duration > TimelineModelImpl.Thresholds.RecurringHandler) {
          timelineData.warning = TimelineModelImpl.WarningType.LongRecurringHandler;
        }
        break;
      }
      case RecordType.FunctionCall: {
        if (typeof eventData["scriptName"] === "string") {
          eventData["url"] = eventData["scriptName"];
        }
        if (typeof eventData["scriptLine"] === "number") {
          eventData["lineNumber"] = eventData["scriptLine"];
        }
      }
      case RecordType.EvaluateScript:
      case RecordType.CompileScript:
      case RecordType.CacheScript: {
        if (typeof eventData["lineNumber"] === "number") {
          --eventData["lineNumber"];
        }
        if (typeof eventData["columnNumber"] === "number") {
          --eventData["columnNumber"];
        }
      }
      case RecordType.RunMicrotasks: {
        if (!this.currentScriptEvent) {
          this.currentScriptEvent = event;
        }
        break;
      }
      case RecordType.SetLayerTreeId: {
        if (this.sessionId && eventData["sessionId"] && this.sessionId === eventData["sessionId"]) {
          this.mainFrameLayerTreeId = eventData["layerTreeId"];
          break;
        }
        const frameId = TimelineModelImpl.eventFrameId(event);
        const pageFrame = frameId ? this.pageFrames.get(frameId) : null;
        if (!pageFrame || pageFrame.parent) {
          return false;
        }
        this.mainFrameLayerTreeId = eventData["layerTreeId"];
        break;
      }
      case RecordType.Paint: {
        this.invalidationTracker.didPaint = true;
        if ("nodeId" in eventData) {
          timelineData.backendNodeIds.push(eventData["nodeId"]);
        }
        if (!eventData["layerId"]) {
          break;
        }
        const layerId = eventData["layerId"];
        this.lastPaintForLayer[layerId] = event;
        break;
      }
      case RecordType.DisplayItemListSnapshot:
      case RecordType.PictureSnapshot: {
        const layerUpdateEvent = this.findAncestorEvent(RecordType.UpdateLayer);
        if (!layerUpdateEvent || layerUpdateEvent.args["layerTreeId"] !== this.mainFrameLayerTreeId) {
          break;
        }
        const paintEvent = this.lastPaintForLayer[layerUpdateEvent.args["layerId"]];
        if (paintEvent) {
          TimelineData.forEvent(paintEvent).picture = event;
        }
        break;
      }
      case RecordType.ScrollLayer: {
        timelineData.backendNodeIds.push(eventData["nodeId"]);
        break;
      }
      case RecordType.PaintImage: {
        timelineData.backendNodeIds.push(eventData["nodeId"]);
        timelineData.url = eventData["url"];
        break;
      }
      case RecordType.DecodeImage:
      case RecordType.ResizeImage: {
        let paintImageEvent = this.findAncestorEvent(RecordType.PaintImage);
        if (!paintImageEvent) {
          const decodeLazyPixelRefEvent = this.findAncestorEvent(RecordType.DecodeLazyPixelRef);
          paintImageEvent = decodeLazyPixelRefEvent && this.paintImageEventByPixelRefId[decodeLazyPixelRefEvent.args["LazyPixelRef"]];
        }
        if (!paintImageEvent) {
          break;
        }
        const paintImageData = TimelineData.forEvent(paintImageEvent);
        timelineData.backendNodeIds.push(paintImageData.backendNodeIds[0]);
        timelineData.url = paintImageData.url;
        break;
      }
      case RecordType.DrawLazyPixelRef: {
        const paintImageEvent = this.findAncestorEvent(RecordType.PaintImage);
        if (!paintImageEvent) {
          break;
        }
        this.paintImageEventByPixelRefId[event.args["LazyPixelRef"]] = paintImageEvent;
        const paintImageData = TimelineData.forEvent(paintImageEvent);
        timelineData.backendNodeIds.push(paintImageData.backendNodeIds[0]);
        timelineData.url = paintImageData.url;
        break;
      }
      case RecordType.FrameStartedLoading: {
        if (timelineData.frameId !== event.args["frame"]) {
          return false;
        }
        break;
      }
      case RecordType.MarkLCPCandidate: {
        timelineData.backendNodeIds.push(eventData["nodeId"]);
        break;
      }
      case RecordType.MarkDOMContent:
      case RecordType.MarkLoad: {
        const frameId = TimelineModelImpl.eventFrameId(event);
        if (!frameId || !this.pageFrames.has(frameId)) {
          return false;
        }
        break;
      }
      case RecordType.CommitLoad: {
        if (this.browserFrameTracking) {
          break;
        }
        const frameId = TimelineModelImpl.eventFrameId(event);
        const isOutermostMainFrame = Boolean(eventData["isOutermostMainFrame"] ?? eventData["isMainFrame"]);
        const pageFrame = frameId ? this.pageFrames.get(frameId) : null;
        if (pageFrame) {
          pageFrame.update(event.startTime, eventData);
        } else {
          if (!this.persistentIds) {
            if (eventData["page"] && eventData["page"] !== this.legacyCurrentPage) {
              return false;
            }
          } else if (isOutermostMainFrame) {
            return false;
          } else if (!this.addPageFrame(event, eventData)) {
            return false;
          }
        }
        if (isOutermostMainFrame && frameId) {
          const frame = this.pageFrames.get(frameId);
          if (frame) {
            this.mainFrame = frame;
          }
        }
        break;
      }
      case RecordType.FireIdleCallback: {
        if (event.duration !== void 0 && event.duration > eventData["allottedMilliseconds"] + TimelineModelImpl.Thresholds.IdleCallbackAddon) {
          timelineData.warning = TimelineModelImpl.WarningType.IdleDeadlineExceeded;
        }
        break;
      }
    }
    return true;
  }
  processBrowserEvent(event) {
    if (event.name === RecordType.ResourceWillSendRequest) {
      const requestId = event.args?.data?.requestId;
      if (typeof requestId === "string") {
        this.requestsFromBrowser.set(requestId, event);
      }
      return;
    }
    if (event.hasCategory(SDK.TracingModel.DevToolsMetadataEventCategory) && event.args["data"]) {
      const data = event.args["data"];
      if (event.name === TimelineModelImpl.DevToolsMetadataEvent.TracingStartedInBrowser) {
        if (!data["persistentIds"]) {
          return;
        }
        this.browserFrameTracking = true;
        this.mainFrameNodeId = data["frameTreeNodeId"];
        const frames = data["frames"] || [];
        frames.forEach((payload) => {
          const parent = payload["parent"] && this.pageFrames.get(payload["parent"]);
          if (payload["parent"] && !parent) {
            return;
          }
          let frame = this.pageFrames.get(payload["frame"]);
          if (!frame) {
            frame = new PageFrame(payload);
            this.pageFrames.set(frame.frameId, frame);
            if (parent) {
              parent.addChild(frame);
            } else {
              this.mainFrame = frame;
            }
          }
          frame.update(this.minimumRecordTimeInternal, payload);
        });
        return;
      }
      if (event.name === TimelineModelImpl.DevToolsMetadataEvent.FrameCommittedInBrowser && this.browserFrameTracking) {
        let frame = this.pageFrames.get(data["frame"]);
        if (!frame) {
          const parent = data["parent"] && this.pageFrames.get(data["parent"]);
          if (!parent) {
            return;
          }
          frame = new PageFrame(data);
          this.pageFrames.set(frame.frameId, frame);
          parent.addChild(frame);
        }
        frame.update(event.startTime, data);
        return;
      }
      if (event.name === TimelineModelImpl.DevToolsMetadataEvent.ProcessReadyInBrowser && this.browserFrameTracking) {
        const frame = this.pageFrames.get(data["frame"]);
        if (frame) {
          frame.processReady(data["processPseudoId"], data["processId"]);
        }
        return;
      }
      if (event.name === TimelineModelImpl.DevToolsMetadataEvent.FrameDeletedInBrowser && this.browserFrameTracking) {
        const frame = this.pageFrames.get(data["frame"]);
        if (frame) {
          frame.deletedTime = event.startTime;
        }
        return;
      }
    }
  }
  ensureNamedTrack(type) {
    let track = this.namedTracks.get(type);
    if (track) {
      return track;
    }
    track = new Track();
    track.type = type;
    this.tracksInternal.push(track);
    this.namedTracks.set(type, track);
    return track;
  }
  findAncestorEvent(name) {
    for (let i = this.eventStack.length - 1; i >= 0; --i) {
      const event = this.eventStack[i];
      if (event.name === name) {
        return event;
      }
    }
    return null;
  }
  addPageFrame(event, payload) {
    const parent = payload["parent"] && this.pageFrames.get(payload["parent"]);
    if (payload["parent"] && !parent) {
      return false;
    }
    const pageFrame = new PageFrame(payload);
    this.pageFrames.set(pageFrame.frameId, pageFrame);
    pageFrame.update(event.startTime, payload);
    if (parent) {
      parent.addChild(pageFrame);
    }
    return true;
  }
  reset() {
    this.isGenericTraceInternal = false;
    this.tracksInternal = [];
    this.namedTracks = /* @__PURE__ */ new Map();
    this.inspectedTargetEventsInternal = [];
    this.timeMarkerEventsInternal = [];
    this.sessionId = null;
    this.mainFrameNodeId = null;
    this.cpuProfilesInternal = [];
    this.workerIdByThread = /* @__PURE__ */ new WeakMap();
    this.pageFrames = /* @__PURE__ */ new Map();
    this.requestsFromBrowser = /* @__PURE__ */ new Map();
    this.minimumRecordTimeInternal = 0;
    this.maximumRecordTimeInternal = 0;
    this.totalBlockingTimeInternal = -1;
    this.estimatedTotalBlockingTime = 0;
  }
  isGenericTrace() {
    return this.isGenericTraceInternal;
  }
  tracingModel() {
    return this.tracingModelInternal;
  }
  minimumRecordTime() {
    return this.minimumRecordTimeInternal;
  }
  maximumRecordTime() {
    return this.maximumRecordTimeInternal;
  }
  inspectedTargetEvents() {
    return this.inspectedTargetEventsInternal;
  }
  tracks() {
    return this.tracksInternal;
  }
  isEmpty() {
    return this.minimumRecordTime() === 0 && this.maximumRecordTime() === 0;
  }
  timeMarkerEvents() {
    return this.timeMarkerEventsInternal;
  }
  rootFrames() {
    return Array.from(this.pageFrames.values()).filter((frame) => !frame.parent);
  }
  pageURL() {
    return this.mainFrame && this.mainFrame.url || Platform.DevToolsPath.EmptyUrlString;
  }
  pageFrameById(frameId) {
    return frameId ? this.pageFrames.get(frameId) || null : null;
  }
  networkRequests() {
    if (this.isGenericTrace()) {
      return [];
    }
    const requests = /* @__PURE__ */ new Map();
    const requestsList = [];
    const zeroStartRequestsList = [];
    const resourceTypes = /* @__PURE__ */ new Set([
      RecordType.ResourceWillSendRequest,
      RecordType.ResourceSendRequest,
      RecordType.ResourceReceiveResponse,
      RecordType.ResourceReceivedData,
      RecordType.ResourceFinish,
      RecordType.ResourceMarkAsCached
    ]);
    const events = this.inspectedTargetEvents();
    for (let i = 0; i < events.length; ++i) {
      const e = events[i];
      if (!resourceTypes.has(e.name)) {
        continue;
      }
      const id = TimelineModelImpl.globalEventId(e, "requestId");
      const requestId = e.args?.data?.requestId;
      if (e.name === RecordType.ResourceSendRequest && requestId && this.requestsFromBrowser.has(requestId)) {
        const event = this.requestsFromBrowser.get(requestId);
        if (event) {
          addRequest(event, id);
        }
      }
      addRequest(e, id);
    }
    function addRequest(e, id) {
      let request = requests.get(id);
      if (request) {
        request.addEvent(e);
      } else {
        request = new NetworkRequest(e);
        requests.set(id, request);
        if (request.startTime) {
          requestsList.push(request);
        } else {
          zeroStartRequestsList.push(request);
        }
      }
    }
    return zeroStartRequestsList.concat(requestsList);
  }
}
export var RecordType = /* @__PURE__ */ ((RecordType2) => {
  RecordType2["Task"] = "RunTask";
  RecordType2["Program"] = "Program";
  RecordType2["EventDispatch"] = "EventDispatch";
  RecordType2["GPUTask"] = "GPUTask";
  RecordType2["Animation"] = "Animation";
  RecordType2["RequestMainThreadFrame"] = "RequestMainThreadFrame";
  RecordType2["BeginFrame"] = "BeginFrame";
  RecordType2["NeedsBeginFrameChanged"] = "NeedsBeginFrameChanged";
  RecordType2["BeginMainThreadFrame"] = "BeginMainThreadFrame";
  RecordType2["ActivateLayerTree"] = "ActivateLayerTree";
  RecordType2["DrawFrame"] = "DrawFrame";
  RecordType2["DroppedFrame"] = "DroppedFrame";
  RecordType2["HitTest"] = "HitTest";
  RecordType2["ScheduleStyleRecalculation"] = "ScheduleStyleRecalculation";
  RecordType2["RecalculateStyles"] = "RecalculateStyles";
  RecordType2["UpdateLayoutTree"] = "UpdateLayoutTree";
  RecordType2["InvalidateLayout"] = "InvalidateLayout";
  RecordType2["Layout"] = "Layout";
  RecordType2["LayoutShift"] = "LayoutShift";
  RecordType2["UpdateLayer"] = "UpdateLayer";
  RecordType2["UpdateLayerTree"] = "UpdateLayerTree";
  RecordType2["PaintSetup"] = "PaintSetup";
  RecordType2["Paint"] = "Paint";
  RecordType2["PaintImage"] = "PaintImage";
  RecordType2["PrePaint"] = "PrePaint";
  RecordType2["Rasterize"] = "Rasterize";
  RecordType2["RasterTask"] = "RasterTask";
  RecordType2["ScrollLayer"] = "ScrollLayer";
  RecordType2["CompositeLayers"] = "CompositeLayers";
  RecordType2["ComputeIntersections"] = "IntersectionObserverController::computeIntersections";
  RecordType2["InteractiveTime"] = "InteractiveTime";
  RecordType2["ScheduleStyleInvalidationTracking"] = "ScheduleStyleInvalidationTracking";
  RecordType2["StyleRecalcInvalidationTracking"] = "StyleRecalcInvalidationTracking";
  RecordType2["StyleInvalidatorInvalidationTracking"] = "StyleInvalidatorInvalidationTracking";
  RecordType2["LayoutInvalidationTracking"] = "LayoutInvalidationTracking";
  RecordType2["ParseHTML"] = "ParseHTML";
  RecordType2["ParseAuthorStyleSheet"] = "ParseAuthorStyleSheet";
  RecordType2["TimerInstall"] = "TimerInstall";
  RecordType2["TimerRemove"] = "TimerRemove";
  RecordType2["TimerFire"] = "TimerFire";
  RecordType2["XHRReadyStateChange"] = "XHRReadyStateChange";
  RecordType2["XHRLoad"] = "XHRLoad";
  RecordType2["CompileScript"] = "v8.compile";
  RecordType2["CompileCode"] = "V8.CompileCode";
  RecordType2["OptimizeCode"] = "V8.OptimizeCode";
  RecordType2["EvaluateScript"] = "EvaluateScript";
  RecordType2["CacheScript"] = "v8.produceCache";
  RecordType2["CompileModule"] = "v8.compileModule";
  RecordType2["EvaluateModule"] = "v8.evaluateModule";
  RecordType2["CacheModule"] = "v8.produceModuleCache";
  RecordType2["WasmStreamFromResponseCallback"] = "v8.wasm.streamFromResponseCallback";
  RecordType2["WasmCompiledModule"] = "v8.wasm.compiledModule";
  RecordType2["WasmCachedModule"] = "v8.wasm.cachedModule";
  RecordType2["WasmModuleCacheHit"] = "v8.wasm.moduleCacheHit";
  RecordType2["WasmModuleCacheInvalid"] = "v8.wasm.moduleCacheInvalid";
  RecordType2["FrameStartedLoading"] = "FrameStartedLoading";
  RecordType2["CommitLoad"] = "CommitLoad";
  RecordType2["MarkLoad"] = "MarkLoad";
  RecordType2["MarkDOMContent"] = "MarkDOMContent";
  RecordType2["MarkFirstPaint"] = "firstPaint";
  RecordType2["MarkFCP"] = "firstContentfulPaint";
  RecordType2["MarkLCPCandidate"] = "largestContentfulPaint::Candidate";
  RecordType2["MarkLCPInvalidate"] = "largestContentfulPaint::Invalidate";
  RecordType2["NavigationStart"] = "navigationStart";
  RecordType2["TimeStamp"] = "TimeStamp";
  RecordType2["ConsoleTime"] = "ConsoleTime";
  RecordType2["UserTiming"] = "UserTiming";
  RecordType2["ResourceWillSendRequest"] = "ResourceWillSendRequest";
  RecordType2["ResourceSendRequest"] = "ResourceSendRequest";
  RecordType2["ResourceReceiveResponse"] = "ResourceReceiveResponse";
  RecordType2["ResourceReceivedData"] = "ResourceReceivedData";
  RecordType2["ResourceFinish"] = "ResourceFinish";
  RecordType2["ResourceMarkAsCached"] = "ResourceMarkAsCached";
  RecordType2["RunMicrotasks"] = "RunMicrotasks";
  RecordType2["FunctionCall"] = "FunctionCall";
  RecordType2["GCEvent"] = "GCEvent";
  RecordType2["MajorGC"] = "MajorGC";
  RecordType2["MinorGC"] = "MinorGC";
  RecordType2["JSFrame"] = "JSFrame";
  RecordType2["JSSample"] = "JSSample";
  RecordType2["V8Sample"] = "V8Sample";
  RecordType2["JitCodeAdded"] = "JitCodeAdded";
  RecordType2["JitCodeMoved"] = "JitCodeMoved";
  RecordType2["StreamingCompileScript"] = "v8.parseOnBackground";
  RecordType2["StreamingCompileScriptWaiting"] = "v8.parseOnBackgroundWaiting";
  RecordType2["StreamingCompileScriptParsing"] = "v8.parseOnBackgroundParsing";
  RecordType2["V8Execute"] = "V8.Execute";
  RecordType2["UpdateCounters"] = "UpdateCounters";
  RecordType2["RequestAnimationFrame"] = "RequestAnimationFrame";
  RecordType2["CancelAnimationFrame"] = "CancelAnimationFrame";
  RecordType2["FireAnimationFrame"] = "FireAnimationFrame";
  RecordType2["RequestIdleCallback"] = "RequestIdleCallback";
  RecordType2["CancelIdleCallback"] = "CancelIdleCallback";
  RecordType2["FireIdleCallback"] = "FireIdleCallback";
  RecordType2["WebSocketCreate"] = "WebSocketCreate";
  RecordType2["WebSocketSendHandshakeRequest"] = "WebSocketSendHandshakeRequest";
  RecordType2["WebSocketReceiveHandshakeResponse"] = "WebSocketReceiveHandshakeResponse";
  RecordType2["WebSocketDestroy"] = "WebSocketDestroy";
  RecordType2["EmbedderCallback"] = "EmbedderCallback";
  RecordType2["SetLayerTreeId"] = "SetLayerTreeId";
  RecordType2["TracingStartedInPage"] = "TracingStartedInPage";
  RecordType2["TracingSessionIdForWorker"] = "TracingSessionIdForWorker";
  RecordType2["DecodeImage"] = "Decode Image";
  RecordType2["ResizeImage"] = "Resize Image";
  RecordType2["DrawLazyPixelRef"] = "Draw LazyPixelRef";
  RecordType2["DecodeLazyPixelRef"] = "Decode LazyPixelRef";
  RecordType2["LazyPixelRef"] = "LazyPixelRef";
  RecordType2["LayerTreeHostImplSnapshot"] = "cc::LayerTreeHostImpl";
  RecordType2["PictureSnapshot"] = "cc::Picture";
  RecordType2["DisplayItemListSnapshot"] = "cc::DisplayItemList";
  RecordType2["LatencyInfo"] = "LatencyInfo";
  RecordType2["LatencyInfoFlow"] = "LatencyInfo.Flow";
  RecordType2["InputLatencyMouseMove"] = "InputLatency::MouseMove";
  RecordType2["InputLatencyMouseWheel"] = "InputLatency::MouseWheel";
  RecordType2["ImplSideFling"] = "InputHandlerProxy::HandleGestureFling::started";
  RecordType2["GCCollectGarbage"] = "BlinkGC.AtomicPhase";
  RecordType2["CryptoDoEncrypt"] = "DoEncrypt";
  RecordType2["CryptoDoEncryptReply"] = "DoEncryptReply";
  RecordType2["CryptoDoDecrypt"] = "DoDecrypt";
  RecordType2["CryptoDoDecryptReply"] = "DoDecryptReply";
  RecordType2["CryptoDoDigest"] = "DoDigest";
  RecordType2["CryptoDoDigestReply"] = "DoDigestReply";
  RecordType2["CryptoDoSign"] = "DoSign";
  RecordType2["CryptoDoSignReply"] = "DoSignReply";
  RecordType2["CryptoDoVerify"] = "DoVerify";
  RecordType2["CryptoDoVerifyReply"] = "DoVerifyReply";
  RecordType2["CpuProfile"] = "CpuProfile";
  RecordType2["Profile"] = "Profile";
  RecordType2["AsyncTask"] = "AsyncTask";
  return RecordType2;
})(RecordType || {});
((TimelineModelImpl2) => {
  TimelineModelImpl2.Category = {
    Console: "blink.console",
    UserTiming: "blink.user_timing",
    LatencyInfo: "latencyInfo",
    Loading: "loading"
  };
  let WarningType;
  ((WarningType2) => {
    WarningType2["LongTask"] = "LongTask";
    WarningType2["ForcedStyle"] = "ForcedStyle";
    WarningType2["ForcedLayout"] = "ForcedLayout";
    WarningType2["IdleDeadlineExceeded"] = "IdleDeadlineExceeded";
    WarningType2["LongHandler"] = "LongHandler";
    WarningType2["LongRecurringHandler"] = "LongRecurringHandler";
    WarningType2["V8Deopt"] = "V8Deopt";
  })(WarningType = TimelineModelImpl2.WarningType || (TimelineModelImpl2.WarningType = {}));
  TimelineModelImpl2.WorkerThreadName = "DedicatedWorker thread";
  TimelineModelImpl2.WorkerThreadNameLegacy = "DedicatedWorker Thread";
  TimelineModelImpl2.RendererMainThreadName = "CrRendererMain";
  TimelineModelImpl2.BrowserMainThreadName = "CrBrowserMain";
  TimelineModelImpl2.DevToolsMetadataEvent = {
    TracingStartedInBrowser: "TracingStartedInBrowser",
    TracingStartedInPage: "TracingStartedInPage",
    TracingSessionIdForWorker: "TracingSessionIdForWorker",
    FrameCommittedInBrowser: "FrameCommittedInBrowser",
    ProcessReadyInBrowser: "ProcessReadyInBrowser",
    FrameDeletedInBrowser: "FrameDeletedInBrowser"
  };
  TimelineModelImpl2.Thresholds = {
    LongTask: 50,
    Handler: 150,
    RecurringHandler: 50,
    ForcedLayout: 30,
    IdleCallbackAddon: 5
  };
})(TimelineModelImpl || (TimelineModelImpl = {}));
export class Track {
  name;
  type;
  forMainFrame;
  url;
  events;
  asyncEvents;
  tasks;
  syncEventsInternal;
  thread;
  constructor() {
    this.name = "";
    this.type = TrackType.Other;
    this.forMainFrame = false;
    this.url = Platform.DevToolsPath.EmptyUrlString;
    this.events = [];
    this.asyncEvents = [];
    this.tasks = [];
    this.syncEventsInternal = null;
    this.thread = null;
  }
  syncEvents() {
    if (this.events.length) {
      return this.events;
    }
    if (this.syncEventsInternal) {
      return this.syncEventsInternal;
    }
    const stack = [];
    function peekLastEndTime() {
      const last = stack[stack.length - 1];
      if (last !== void 0) {
        const endTime = last.endTime;
        if (endTime !== void 0) {
          return endTime;
        }
      }
      throw new Error("End time does not exist on event.");
    }
    this.syncEventsInternal = [];
    for (const event of this.asyncEvents) {
      const startTime = event.startTime;
      let endTime = event.endTime;
      if (endTime === void 0) {
        endTime = startTime;
      }
      while (stack.length && startTime >= peekLastEndTime()) {
        stack.pop();
      }
      if (stack.length && endTime > peekLastEndTime()) {
        this.syncEventsInternal = [];
        break;
      }
      const syncEvent = new SDK.TracingModel.Event(event.categoriesString, event.name, SDK.TracingModel.Phase.Complete, startTime, event.thread);
      syncEvent.setEndTime(endTime);
      syncEvent.addArgs(event.args);
      this.syncEventsInternal.push(syncEvent);
      stack.push(syncEvent);
    }
    return this.syncEventsInternal;
  }
}
export var TrackType = /* @__PURE__ */ ((TrackType2) => {
  TrackType2["MainThread"] = "MainThread";
  TrackType2["Worker"] = "Worker";
  TrackType2["Animation"] = "Animation";
  TrackType2["Timings"] = "Timings";
  TrackType2["Console"] = "Console";
  TrackType2["Raster"] = "Raster";
  TrackType2["GPU"] = "GPU";
  TrackType2["Experience"] = "Experience";
  TrackType2["Other"] = "Other";
  return TrackType2;
})(TrackType || {});
export class PageFrame {
  frameId;
  url;
  name;
  children;
  parent;
  processes;
  deletedTime;
  ownerNode;
  constructor(payload) {
    this.frameId = payload["frame"];
    this.url = payload["url"] || Platform.DevToolsPath.EmptyUrlString;
    this.name = payload["name"];
    this.children = [];
    this.parent = null;
    this.processes = [];
    this.deletedTime = null;
    this.ownerNode = null;
  }
  update(time, payload) {
    this.url = payload["url"] || "";
    this.name = payload["name"];
    if (payload["processId"]) {
      this.processes.push({ time, processId: payload["processId"], processPseudoId: "", url: payload["url"] || "" });
    } else {
      this.processes.push({ time, processId: -1, processPseudoId: payload["processPseudoId"], url: payload["url"] || "" });
    }
  }
  processReady(processPseudoId, processId) {
    for (const process of this.processes) {
      if (process.processPseudoId === processPseudoId) {
        process.processPseudoId = "";
        process.processId = processId;
      }
    }
  }
  addChild(child) {
    this.children.push(child);
    child.parent = this;
  }
}
export class NetworkRequest {
  startTime;
  endTime;
  encodedDataLength;
  decodedBodyLength;
  children;
  timing;
  mimeType;
  url;
  requestMethod;
  transferSize;
  maybeDiskCached;
  memoryCachedInternal;
  priority;
  finishTime;
  responseTime;
  fromServiceWorker;
  hasCachedResource;
  constructor(event) {
    const isInitial = event.name === "ResourceSendRequest" /* ResourceSendRequest */ || event.name === "ResourceWillSendRequest" /* ResourceWillSendRequest */;
    this.startTime = isInitial ? event.startTime : 0;
    this.endTime = Infinity;
    this.encodedDataLength = 0;
    this.decodedBodyLength = 0;
    this.children = [];
    this.transferSize = 0;
    this.maybeDiskCached = false;
    this.memoryCachedInternal = false;
    this.addEvent(event);
  }
  addEvent(event) {
    this.children.push(event);
    this.startTime = Math.min(this.startTime, event.startTime);
    const eventData = event.args["data"];
    if (eventData["mimeType"]) {
      this.mimeType = eventData["mimeType"];
    }
    if ("priority" in eventData) {
      this.priority = eventData["priority"];
    }
    if (event.name === "ResourceFinish" /* ResourceFinish */) {
      this.endTime = event.startTime;
    }
    if (eventData["finishTime"]) {
      this.finishTime = eventData["finishTime"] * 1e3;
    }
    if (!this.responseTime && (event.name === "ResourceReceiveResponse" /* ResourceReceiveResponse */ || event.name === "ResourceReceivedData" /* ResourceReceivedData */)) {
      this.responseTime = event.startTime;
    }
    const encodedDataLength = eventData["encodedDataLength"] || 0;
    if (event.name === "ResourceMarkAsCached" /* ResourceMarkAsCached */) {
      this.memoryCachedInternal = true;
    }
    if (event.name === "ResourceReceiveResponse" /* ResourceReceiveResponse */) {
      if (eventData["fromCache"]) {
        this.maybeDiskCached = true;
      }
      if (eventData["fromServiceWorker"]) {
        this.fromServiceWorker = true;
      }
      if (eventData["hasCachedResource"]) {
        this.hasCachedResource = true;
      }
      this.encodedDataLength = encodedDataLength;
    }
    if (event.name === "ResourceReceivedData" /* ResourceReceivedData */) {
      this.encodedDataLength += encodedDataLength;
    }
    if (event.name === "ResourceFinish" /* ResourceFinish */ && encodedDataLength) {
      this.encodedDataLength = encodedDataLength;
      this.transferSize = encodedDataLength;
    }
    const decodedBodyLength = eventData["decodedBodyLength"];
    if (event.name === "ResourceFinish" /* ResourceFinish */ && decodedBodyLength) {
      this.decodedBodyLength = decodedBodyLength;
    }
    if (!this.url) {
      this.url = eventData["url"];
    }
    if (!this.requestMethod) {
      this.requestMethod = eventData["requestMethod"];
    }
    if (!this.timing) {
      this.timing = eventData["timing"];
    }
    if (eventData["fromServiceWorker"]) {
      this.fromServiceWorker = true;
    }
  }
  cached() {
    return Boolean(this.memoryCachedInternal) || Boolean(this.maybeDiskCached) && !this.transferSize && !this.fromServiceWorker;
  }
  memoryCached() {
    return this.memoryCachedInternal;
  }
  getSendReceiveTiming() {
    if (this.cached() || !this.timing) {
      return { sendStartTime: this.startTime, headersEndTime: this.startTime };
    }
    const requestTime = this.timing.requestTime * 1e3;
    const sendStartTime = requestTime + this.timing.sendStart;
    const headersEndTime = requestTime + this.timing.receiveHeadersEnd;
    return { sendStartTime, headersEndTime };
  }
  getStartTime() {
    return Math.min(this.startTime, !this.cached() && this.timing && this.timing.requestTime * 1e3 || Infinity);
  }
  beginTime() {
    return Math.min(this.getStartTime(), !this.cached() && this.timing && this.timing.pushStart * 1e3 || Infinity);
  }
}
export class InvalidationTrackingEvent {
  type;
  startTime;
  tracingEvent;
  frame;
  nodeId;
  nodeName;
  invalidationSet;
  invalidatedSelectorId;
  changedId;
  changedClass;
  changedAttribute;
  changedPseudo;
  selectorPart;
  extraData;
  invalidationList;
  cause;
  linkedRecalcStyleEvent;
  linkedLayoutEvent;
  constructor(event, timelineData) {
    this.type = event.name;
    this.startTime = event.startTime;
    this.tracingEvent = event;
    const eventData = event.args["data"];
    this.frame = eventData["frame"];
    this.nodeId = eventData["nodeId"];
    this.nodeName = eventData["nodeName"];
    this.invalidationSet = eventData["invalidationSet"];
    this.invalidatedSelectorId = eventData["invalidatedSelectorId"];
    this.changedId = eventData["changedId"];
    this.changedClass = eventData["changedClass"];
    this.changedAttribute = eventData["changedAttribute"];
    this.changedPseudo = eventData["changedPseudo"];
    this.selectorPart = eventData["selectorPart"];
    this.extraData = eventData["extraData"];
    this.invalidationList = eventData["invalidationList"];
    this.cause = { reason: eventData["reason"], stackTrace: timelineData.stackTrace };
    this.linkedRecalcStyleEvent = false;
    this.linkedLayoutEvent = false;
    if (!this.cause.reason && this.cause.stackTrace && this.type === "LayoutInvalidationTracking" /* LayoutInvalidationTracking */) {
      this.cause.reason = "Layout forced";
    }
  }
}
export class InvalidationTracker {
  lastRecalcStyle;
  lastPaintWithLayer;
  didPaint;
  invalidations;
  invalidationsByNodeId;
  constructor() {
    this.lastRecalcStyle = null;
    this.lastPaintWithLayer = null;
    this.didPaint = false;
    this.initializePerFrameState();
    this.invalidations = {};
    this.invalidationsByNodeId = {};
  }
  static invalidationEventsFor(event) {
    return eventToInvalidation.get(event) || null;
  }
  addInvalidation(invalidation) {
    this.startNewFrameIfNeeded();
    if (!invalidation.nodeId) {
      console.error("Invalidation lacks node information.");
      console.error(invalidation);
      return;
    }
    if (invalidation.type === "StyleRecalcInvalidationTracking" /* StyleRecalcInvalidationTracking */ && invalidation.cause.reason === "StyleInvalidator") {
      return;
    }
    const styleRecalcInvalidation = invalidation.type === "ScheduleStyleInvalidationTracking" /* ScheduleStyleInvalidationTracking */ || invalidation.type === "StyleInvalidatorInvalidationTracking" /* StyleInvalidatorInvalidationTracking */ || invalidation.type === "StyleRecalcInvalidationTracking" /* StyleRecalcInvalidationTracking */;
    if (styleRecalcInvalidation) {
      const duringRecalcStyle = invalidation.startTime && this.lastRecalcStyle && this.lastRecalcStyle.endTime !== void 0 && invalidation.startTime >= this.lastRecalcStyle.startTime && invalidation.startTime <= this.lastRecalcStyle.endTime;
      if (duringRecalcStyle) {
        this.associateWithLastRecalcStyleEvent(invalidation);
      }
    }
    if (this.invalidations[invalidation.type]) {
      this.invalidations[invalidation.type].push(invalidation);
    } else {
      this.invalidations[invalidation.type] = [invalidation];
    }
    if (invalidation.nodeId) {
      if (this.invalidationsByNodeId[invalidation.nodeId]) {
        this.invalidationsByNodeId[invalidation.nodeId].push(invalidation);
      } else {
        this.invalidationsByNodeId[invalidation.nodeId] = [invalidation];
      }
    }
  }
  didRecalcStyle(recalcStyleEvent) {
    this.lastRecalcStyle = recalcStyleEvent;
    const types = [
      "ScheduleStyleInvalidationTracking" /* ScheduleStyleInvalidationTracking */,
      "StyleInvalidatorInvalidationTracking" /* StyleInvalidatorInvalidationTracking */,
      "StyleRecalcInvalidationTracking" /* StyleRecalcInvalidationTracking */
    ];
    for (const invalidation of this.invalidationsOfTypes(types)) {
      this.associateWithLastRecalcStyleEvent(invalidation);
    }
  }
  associateWithLastRecalcStyleEvent(invalidation) {
    if (invalidation.linkedRecalcStyleEvent) {
      return;
    }
    if (!this.lastRecalcStyle) {
      throw new Error("Last recalculate style event not set.");
    }
    const recalcStyleFrameId = this.lastRecalcStyle.args["beginData"]["frame"];
    if (invalidation.type === "StyleInvalidatorInvalidationTracking" /* StyleInvalidatorInvalidationTracking */) {
      this.addSyntheticStyleRecalcInvalidations(this.lastRecalcStyle, recalcStyleFrameId, invalidation);
    } else if (invalidation.type === "ScheduleStyleInvalidationTracking" /* ScheduleStyleInvalidationTracking */) {
    } else {
      this.addInvalidationToEvent(this.lastRecalcStyle, recalcStyleFrameId, invalidation);
    }
    invalidation.linkedRecalcStyleEvent = true;
  }
  addSyntheticStyleRecalcInvalidations(event, frameId, styleInvalidatorInvalidation) {
    if (!styleInvalidatorInvalidation.invalidationList) {
      this.addSyntheticStyleRecalcInvalidation(styleInvalidatorInvalidation.tracingEvent, styleInvalidatorInvalidation);
      return;
    }
    if (!styleInvalidatorInvalidation.nodeId) {
      console.error("Invalidation lacks node information.");
      console.error(styleInvalidatorInvalidation);
      return;
    }
    for (let i = 0; i < styleInvalidatorInvalidation.invalidationList.length; i++) {
      const setId = styleInvalidatorInvalidation.invalidationList[i]["id"];
      let lastScheduleStyleRecalculation;
      const nodeInvalidations = this.invalidationsByNodeId[styleInvalidatorInvalidation.nodeId] || [];
      for (let j = 0; j < nodeInvalidations.length; j++) {
        const invalidation = nodeInvalidations[j];
        if (invalidation.frame !== frameId || invalidation.invalidationSet !== setId || invalidation.type !== "ScheduleStyleInvalidationTracking" /* ScheduleStyleInvalidationTracking */) {
          continue;
        }
        lastScheduleStyleRecalculation = invalidation;
      }
      if (!lastScheduleStyleRecalculation) {
        continue;
      }
      this.addSyntheticStyleRecalcInvalidation(lastScheduleStyleRecalculation.tracingEvent, styleInvalidatorInvalidation);
    }
  }
  addSyntheticStyleRecalcInvalidation(baseEvent, styleInvalidatorInvalidation) {
    const timelineData = TimelineData.forEvent(baseEvent);
    const invalidation = new InvalidationTrackingEvent(baseEvent, timelineData);
    invalidation.type = "StyleRecalcInvalidationTracking" /* StyleRecalcInvalidationTracking */;
    if (styleInvalidatorInvalidation.cause.reason) {
      invalidation.cause.reason = styleInvalidatorInvalidation.cause.reason;
    }
    if (styleInvalidatorInvalidation.selectorPart) {
      invalidation.selectorPart = styleInvalidatorInvalidation.selectorPart;
    }
    if (!invalidation.linkedRecalcStyleEvent) {
      this.associateWithLastRecalcStyleEvent(invalidation);
    }
  }
  didLayout(layoutEvent) {
    const layoutFrameId = layoutEvent.args["beginData"]["frame"];
    for (const invalidation of this.invalidationsOfTypes(["LayoutInvalidationTracking" /* LayoutInvalidationTracking */])) {
      if (invalidation.linkedLayoutEvent) {
        continue;
      }
      this.addInvalidationToEvent(layoutEvent, layoutFrameId, invalidation);
      invalidation.linkedLayoutEvent = true;
    }
  }
  addInvalidationToEvent(event, eventFrameId, invalidation) {
    if (eventFrameId !== invalidation.frame) {
      return;
    }
    const invalidations = eventToInvalidation.get(event);
    if (!invalidations) {
      eventToInvalidation.set(event, [invalidation]);
    } else {
      invalidations.push(invalidation);
    }
  }
  invalidationsOfTypes(types) {
    const invalidations = this.invalidations;
    if (!types) {
      types = Object.keys(invalidations);
    }
    function* generator() {
      if (!types) {
        return;
      }
      for (let i = 0; i < types.length; ++i) {
        const invalidationList = invalidations[types[i]] || [];
        for (let j = 0; j < invalidationList.length; ++j) {
          yield invalidationList[j];
        }
      }
    }
    return generator();
  }
  startNewFrameIfNeeded() {
    if (!this.didPaint) {
      return;
    }
    this.initializePerFrameState();
  }
  initializePerFrameState() {
    this.invalidations = {};
    this.invalidationsByNodeId = {};
    this.lastRecalcStyle = null;
    this.lastPaintWithLayer = null;
    this.didPaint = false;
  }
}
export class TimelineAsyncEventTracker {
  initiatorByType;
  constructor() {
    TimelineAsyncEventTracker.initialize();
    this.initiatorByType = /* @__PURE__ */ new Map();
    if (TimelineAsyncEventTracker.asyncEvents) {
      for (const initiator of TimelineAsyncEventTracker.asyncEvents.keys()) {
        this.initiatorByType.set(initiator, /* @__PURE__ */ new Map());
      }
    }
  }
  static initialize() {
    if (TimelineAsyncEventTracker.asyncEvents) {
      return;
    }
    const events = /* @__PURE__ */ new Map();
    events.set("TimerInstall" /* TimerInstall */, { causes: ["TimerFire" /* TimerFire */], joinBy: "timerId" });
    events.set("ResourceSendRequest" /* ResourceSendRequest */, {
      causes: [
        "ResourceMarkAsCached" /* ResourceMarkAsCached */,
        "ResourceReceiveResponse" /* ResourceReceiveResponse */,
        "ResourceReceivedData" /* ResourceReceivedData */,
        "ResourceFinish" /* ResourceFinish */
      ],
      joinBy: "requestId"
    });
    events.set("RequestAnimationFrame" /* RequestAnimationFrame */, { causes: ["FireAnimationFrame" /* FireAnimationFrame */], joinBy: "id" });
    events.set("RequestIdleCallback" /* RequestIdleCallback */, { causes: ["FireIdleCallback" /* FireIdleCallback */], joinBy: "id" });
    events.set("WebSocketCreate" /* WebSocketCreate */, {
      causes: [
        "WebSocketSendHandshakeRequest" /* WebSocketSendHandshakeRequest */,
        "WebSocketReceiveHandshakeResponse" /* WebSocketReceiveHandshakeResponse */,
        "WebSocketDestroy" /* WebSocketDestroy */
      ],
      joinBy: "identifier"
    });
    TimelineAsyncEventTracker.asyncEvents = events;
    TimelineAsyncEventTracker.typeToInitiator = /* @__PURE__ */ new Map();
    for (const entry of events) {
      const types = entry[1].causes;
      for (const currentType of types) {
        TimelineAsyncEventTracker.typeToInitiator.set(currentType, entry[0]);
      }
    }
  }
  processEvent(event) {
    if (!TimelineAsyncEventTracker.typeToInitiator || !TimelineAsyncEventTracker.asyncEvents) {
      return;
    }
    let initiatorType = TimelineAsyncEventTracker.typeToInitiator.get(event.name);
    const isInitiator = !initiatorType;
    if (!initiatorType) {
      initiatorType = event.name;
    }
    const initiatorInfo = TimelineAsyncEventTracker.asyncEvents.get(initiatorType);
    if (!initiatorInfo) {
      return;
    }
    const id = TimelineModelImpl.globalEventId(event, initiatorInfo.joinBy);
    if (!id) {
      return;
    }
    const initiatorMap = this.initiatorByType.get(initiatorType);
    if (initiatorMap) {
      if (isInitiator) {
        initiatorMap.set(id, event);
        return;
      }
      const initiator = initiatorMap.get(id);
      const timelineData = TimelineData.forEvent(event);
      timelineData.setInitiator(initiator ? initiator : null);
      if (!timelineData.frameId && initiator) {
        timelineData.frameId = TimelineModelImpl.eventFrameId(initiator);
      }
    }
  }
  static asyncEvents = null;
  static typeToInitiator = null;
}
export class TimelineData {
  warning;
  previewElement;
  url;
  backendNodeIds;
  stackTrace;
  picture;
  initiatorInternal;
  frameId;
  timeWaitingForMainThread;
  constructor() {
    this.warning = null;
    this.previewElement = null;
    this.url = null;
    this.backendNodeIds = [];
    this.stackTrace = null;
    this.picture = null;
    this.initiatorInternal = null;
    this.frameId = null;
  }
  setInitiator(initiator) {
    this.initiatorInternal = initiator;
    if (!initiator || this.url) {
      return;
    }
    const initiatorURL = TimelineData.forEvent(initiator).url;
    if (initiatorURL) {
      this.url = initiatorURL;
    }
  }
  initiator() {
    return this.initiatorInternal;
  }
  topFrame() {
    const stackTrace = this.stackTraceForSelfOrInitiator();
    return stackTrace && stackTrace[0] || null;
  }
  stackTraceForSelfOrInitiator() {
    return this.stackTrace || this.initiatorInternal && TimelineData.forEvent(this.initiatorInternal).stackTrace;
  }
  static forEvent(event) {
    let data = eventToData.get(event);
    if (!data) {
      data = new TimelineData();
      eventToData.set(event, data);
    }
    return data;
  }
}
const eventToData = /* @__PURE__ */ new WeakMap();
const eventToInvalidation = /* @__PURE__ */ new WeakMap();
//# sourceMappingURL=TimelineModel.js.map
