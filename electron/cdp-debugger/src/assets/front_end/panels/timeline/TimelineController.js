import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as Extensions from "../../models/extensions/extensions.js";
import * as TimelineModel from "../../models/timeline_model/timeline_model.js";
import { ExtensionTracingSession } from "./ExtensionTracingSession.js";
import { PerformanceModel } from "./PerformanceModel.js";
const UIStrings = {
  cpuProfileForATargetIsNot: "CPU profile for a target is not available.",
  tracingNotSupported: "Performance trace recording not supported for this type of target"
};
const str_ = i18n.i18n.registerUIStrings("panels/timeline/TimelineController.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TimelineController {
  target;
  tracingManager;
  performanceModel;
  client;
  tracingModel;
  extensionSessions;
  extensionTraceProviders;
  tracingCompleteCallback;
  profiling;
  cpuProfiles;
  constructor(target, client) {
    this.target = target;
    this.tracingManager = target.model(SDK.TracingManager.TracingManager);
    this.performanceModel = new PerformanceModel();
    this.performanceModel.setMainTarget(target);
    this.client = client;
    const backingStorage = new Bindings.TempFile.TempFileBackingStorage();
    this.tracingModel = new SDK.TracingModel.TracingModel(backingStorage);
    this.extensionSessions = [];
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.CPUProfilerModel.CPUProfilerModel, this);
  }
  dispose() {
    SDK.TargetManager.TargetManager.instance().unobserveModels(SDK.CPUProfilerModel.CPUProfilerModel, this);
  }
  mainTarget() {
    return this.target;
  }
  async startRecording(options, providers) {
    this.extensionTraceProviders = Extensions.ExtensionServer.ExtensionServer.instance().traceProviders().slice();
    function disabledByDefault(category) {
      return "disabled-by-default-" + category;
    }
    const categoriesArray = [
      Root.Runtime.experiments.isEnabled("timelineShowAllEvents") ? "*" : "-*",
      TimelineModel.TimelineModel.TimelineModelImpl.Category.Console,
      TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming,
      "devtools.timeline",
      disabledByDefault("devtools.timeline"),
      disabledByDefault("devtools.timeline.frame"),
      disabledByDefault("devtools.timeline.stack"),
      disabledByDefault("v8.compile"),
      disabledByDefault("v8.cpu_profiler.hires"),
      TimelineModel.TimelineModel.TimelineModelImpl.Category.LatencyInfo,
      TimelineModel.TimelineModel.TimelineModelImpl.Category.Loading,
      disabledByDefault("lighthouse"),
      "v8.execute",
      "v8"
    ];
    if (Root.Runtime.experiments.isEnabled("timelineV8RuntimeCallStats") && options.enableJSSampling) {
      categoriesArray.push(disabledByDefault("v8.runtime_stats_sampling"));
    }
    if (!Root.Runtime.Runtime.queryParam("timelineTracingJSProfileDisabled") && options.enableJSSampling) {
      categoriesArray.push(disabledByDefault("v8.cpu_profiler"));
    }
    if (Root.Runtime.experiments.isEnabled("timelineInvalidationTracking")) {
      categoriesArray.push(disabledByDefault("devtools.timeline.invalidationTracking"));
    }
    if (options.capturePictures) {
      categoriesArray.push(disabledByDefault("devtools.timeline.layers"), disabledByDefault("devtools.timeline.picture"), disabledByDefault("blink.graphics_context_annotations"));
    }
    if (options.captureFilmStrip) {
      categoriesArray.push(disabledByDefault("devtools.screenshot"));
    }
    this.extensionSessions = providers.map((provider) => new ExtensionTracingSession(provider, this.performanceModel));
    this.extensionSessions.forEach((session) => session.start());
    this.performanceModel.setRecordStartTime(Date.now());
    const response = await this.startRecordingWithCategories(categoriesArray.join(","), options.enableJSSampling);
    if (response.getError()) {
      await this.waitForTracingToStop(false);
      await SDK.TargetManager.TargetManager.instance().resumeAllTargets();
    }
    return response;
  }
  async stopRecording() {
    if (this.tracingManager) {
      this.tracingManager.stop();
    }
    this.client.loadingStarted();
    await this.waitForTracingToStop(true);
    this.allSourcesFinished();
    return this.performanceModel;
  }
  async waitForTracingToStop(awaitTracingCompleteCallback) {
    const tracingStoppedPromises = [];
    if (this.tracingManager && awaitTracingCompleteCallback) {
      tracingStoppedPromises.push(new Promise((resolve) => {
        this.tracingCompleteCallback = resolve;
      }));
    }
    tracingStoppedPromises.push(this.stopProfilingOnAllModels());
    const extensionCompletionPromises = this.extensionSessions.map((session) => session.stop());
    if (extensionCompletionPromises.length) {
      tracingStoppedPromises.push(Promise.race([Promise.all(extensionCompletionPromises), new Promise((r) => window.setTimeout(r, 5e3))]));
    }
    await Promise.all(tracingStoppedPromises);
  }
  modelAdded(cpuProfilerModel) {
    if (this.profiling) {
      void cpuProfilerModel.startRecording();
    }
  }
  modelRemoved(_cpuProfilerModel) {
  }
  async startProfilingOnAllModels() {
    this.profiling = true;
    const models = SDK.TargetManager.TargetManager.instance().models(SDK.CPUProfilerModel.CPUProfilerModel);
    await Promise.all(models.map((model) => model.startRecording()));
  }
  addCpuProfile(targetId, cpuProfile) {
    if (!cpuProfile) {
      Common.Console.Console.instance().warn(i18nString(UIStrings.cpuProfileForATargetIsNot));
      return;
    }
    if (!this.cpuProfiles) {
      this.cpuProfiles = /* @__PURE__ */ new Map();
    }
    this.cpuProfiles.set(targetId, cpuProfile);
  }
  async stopProfilingOnAllModels() {
    const models = this.profiling ? SDK.TargetManager.TargetManager.instance().models(SDK.CPUProfilerModel.CPUProfilerModel) : [];
    this.profiling = false;
    const promises = [];
    for (const model of models) {
      const targetId = model.target().id();
      const modelPromise = model.stopRecording().then(this.addCpuProfile.bind(this, targetId));
      promises.push(modelPromise);
    }
    await Promise.all(promises);
  }
  async startRecordingWithCategories(categories, enableJSSampling) {
    if (!this.tracingManager) {
      throw new Error(UIStrings.tracingNotSupported);
    }
    await SDK.TargetManager.TargetManager.instance().suspendAllTargets("performance-timeline");
    if (enableJSSampling && Root.Runtime.Runtime.queryParam("timelineTracingJSProfileDisabled")) {
      await this.startProfilingOnAllModels();
    }
    return this.tracingManager.start(this, categories, "");
  }
  traceEventsCollected(events) {
    this.tracingModel.addEvents(events);
  }
  tracingComplete() {
    if (!this.tracingCompleteCallback) {
      return;
    }
    this.tracingCompleteCallback(void 0);
    this.tracingCompleteCallback = null;
  }
  allSourcesFinished() {
    this.client.processingStarted();
    window.setTimeout(() => this.finalizeTrace(), 0);
  }
  async finalizeTrace() {
    this.injectCpuProfileEvents();
    await SDK.TargetManager.TargetManager.instance().resumeAllTargets();
    this.tracingModel.tracingComplete();
    this.client.loadingComplete(this.tracingModel);
  }
  injectCpuProfileEvent(pid, tid, cpuProfile) {
    if (!cpuProfile) {
      return;
    }
    const cpuProfileEvent = {
      cat: SDK.TracingModel.DevToolsMetadataEventCategory,
      ph: SDK.TracingModel.Phase.Instant,
      ts: this.tracingModel.maximumRecordTime() * 1e3,
      pid,
      tid,
      name: TimelineModel.TimelineModel.RecordType.CpuProfile,
      args: { data: { cpuProfile } }
    };
    this.tracingModel.addEvents([cpuProfileEvent]);
  }
  buildTargetToProcessIdMap() {
    const metadataEventTypes = TimelineModel.TimelineModel.TimelineModelImpl.DevToolsMetadataEvent;
    const metadataEvents = this.tracingModel.devToolsMetadataEvents();
    const browserMetaEvent = metadataEvents.find((e) => e.name === metadataEventTypes.TracingStartedInBrowser);
    if (!browserMetaEvent) {
      return null;
    }
    const pseudoPidToFrames = new Platform.MapUtilities.Multimap();
    const targetIdToPid = /* @__PURE__ */ new Map();
    const frames = browserMetaEvent.args.data.frames;
    for (const frameInfo of frames) {
      targetIdToPid.set(frameInfo.frame, frameInfo.processId);
    }
    for (const event of metadataEvents) {
      const data = event.args.data;
      switch (event.name) {
        case metadataEventTypes.FrameCommittedInBrowser:
          if (data.processId) {
            targetIdToPid.set(data.frame, data.processId);
          } else {
            pseudoPidToFrames.set(data.processPseudoId, data.frame);
          }
          break;
        case metadataEventTypes.ProcessReadyInBrowser:
          for (const frame of pseudoPidToFrames.get(data.processPseudoId) || []) {
            targetIdToPid.set(frame, data.processId);
          }
          break;
      }
    }
    const mainFrame = frames.find((frame) => !frame.parent);
    const mainRendererProcessId = mainFrame.processId;
    const mainProcess = this.tracingModel.getProcessById(mainRendererProcessId);
    if (mainProcess) {
      const target = SDK.TargetManager.TargetManager.instance().mainTarget();
      if (target) {
        targetIdToPid.set(target.id(), mainProcess.id());
      }
    }
    return targetIdToPid;
  }
  injectCpuProfileEvents() {
    if (!this.cpuProfiles) {
      return;
    }
    const metadataEventTypes = TimelineModel.TimelineModel.TimelineModelImpl.DevToolsMetadataEvent;
    const metadataEvents = this.tracingModel.devToolsMetadataEvents();
    const targetIdToPid = this.buildTargetToProcessIdMap();
    if (targetIdToPid) {
      for (const [id, profile] of this.cpuProfiles) {
        const pid = targetIdToPid.get(id);
        if (!pid) {
          continue;
        }
        const process = this.tracingModel.getProcessById(pid);
        const thread = process && process.threadByName(TimelineModel.TimelineModel.TimelineModelImpl.RendererMainThreadName);
        if (thread) {
          this.injectCpuProfileEvent(pid, thread.id(), profile);
        }
      }
    } else {
      const filteredEvents = metadataEvents.filter((event) => event.name === metadataEventTypes.TracingStartedInPage);
      const mainMetaEvent = filteredEvents[filteredEvents.length - 1];
      if (mainMetaEvent) {
        const pid = mainMetaEvent.thread.process().id();
        if (this.tracingManager) {
          const mainCpuProfile = this.cpuProfiles.get(this.tracingManager.target().id());
          this.injectCpuProfileEvent(pid, mainMetaEvent.thread.id(), mainCpuProfile);
        }
      } else {
        let tid = 0;
        for (const pair of this.cpuProfiles) {
          const target = SDK.TargetManager.TargetManager.instance().targetById(pair[0]);
          const name = target && target.name();
          this.tracingModel.addEvents(TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.buildTraceProfileFromCpuProfile(pair[1], ++tid, tid === 1, name));
        }
      }
    }
    const workerMetaEvents = metadataEvents.filter((event) => event.name === metadataEventTypes.TracingSessionIdForWorker);
    for (const metaEvent of workerMetaEvents) {
      const workerId = metaEvent.args["data"]["workerId"];
      const cpuProfile = this.cpuProfiles.get(workerId);
      this.injectCpuProfileEvent(metaEvent.thread.process().id(), metaEvent.args["data"]["workerThreadId"], cpuProfile);
    }
    this.cpuProfiles = null;
  }
  tracingBufferUsage(usage) {
    this.client.recordingProgress(usage);
  }
  eventsRetrievalProgress(progress) {
    this.client.loadingProgress(progress);
  }
}
//# sourceMappingURL=TimelineController.js.map
