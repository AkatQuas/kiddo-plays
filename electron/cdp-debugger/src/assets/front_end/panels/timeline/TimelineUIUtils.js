import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as TimelineModel from "../../models/timeline_model/timeline_model.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import invalidationsTreeStyles from "./invalidationsTree.css.js";
import imagePreviewStyles from "../../ui/legacy/components/utils/imagePreview.css.js";
import { CLSRect } from "./CLSLinkifier.js";
import { TimelinePanel, TimelineSelection } from "./TimelinePanel.js";
const UIStrings = {
  sAndS: "{PH1} and {PH2}",
  sAndSOther: "{PH1}, {PH2}, and 1 other",
  task: "Task",
  other: "Other",
  animation: "Animation",
  event: "Event",
  requestMainThreadFrame: "Request Main Thread Frame",
  frameStart: "Frame Start",
  frameStartMainThread: "Frame Start (main thread)",
  drawFrame: "Draw Frame",
  hitTest: "Hit Test",
  scheduleStyleRecalculation: "Schedule Style Recalculation",
  recalculateStyle: "Recalculate Style",
  invalidateLayout: "Invalidate Layout",
  layout: "Layout",
  paintSetup: "Paint Setup",
  paintImage: "Paint Image",
  prePaint: "Pre-Paint",
  updateLayer: "Update Layer",
  updateLayerTree: "Update Layer Tree",
  paint: "Paint",
  rasterizePaint: "Rasterize Paint",
  scroll: "Scroll",
  compositeLayers: "Composite Layers",
  computeIntersections: "Compute Intersections",
  parseHtml: "Parse HTML",
  parseStylesheet: "Parse Stylesheet",
  installTimer: "Install Timer",
  removeTimer: "Remove Timer",
  timerFired: "Timer Fired",
  xhrReadyStateChange: "`XHR` Ready State Change",
  xhrLoad: "`XHR` Load",
  compileScript: "Compile Script",
  cacheScript: "Cache Script Code",
  compileCode: "Compile Code",
  optimizeCode: "Optimize Code",
  evaluateScript: "Evaluate Script",
  compileModule: "Compile Module",
  cacheModule: "Cache Module Code",
  evaluateModule: "Evaluate Module",
  streamingCompileTask: "Streaming Compile Task",
  waitingForNetwork: "Waiting for Network",
  parseAndCompile: "Parse and Compile",
  streamingWasmResponse: "Streaming Wasm Response",
  compiledWasmModule: "Compiled Wasm Module",
  cachedWasmModule: "Cached Wasm Module",
  wasmModuleCacheHit: "Wasm Module Cache Hit",
  wasmModuleCacheInvalid: "Wasm Module Cache Invalid",
  frameStartedLoading: "Frame Started Loading",
  onloadEvent: "Onload Event",
  domcontentloadedEvent: "DOMContentLoaded Event",
  firstPaint: "First Paint",
  firstContentfulPaint: "First Contentful Paint",
  largestContentfulPaint: "Largest Contentful Paint",
  timestamp: "Timestamp",
  consoleTime: "Console Time",
  userTiming: "User Timing",
  willSendRequest: "Will Send Request",
  sendRequest: "Send Request",
  receiveResponse: "Receive Response",
  finishLoading: "Finish Loading",
  receiveData: "Receive Data",
  runMicrotasks: "Run Microtasks",
  functionCall: "Function Call",
  gcEvent: "GC Event",
  majorGc: "Major GC",
  minorGc: "Minor GC",
  jsFrame: "JS Frame",
  requestAnimationFrame: "Request Animation Frame",
  cancelAnimationFrame: "Cancel Animation Frame",
  animationFrameFired: "Animation Frame Fired",
  requestIdleCallback: "Request Idle Callback",
  cancelIdleCallback: "Cancel Idle Callback",
  fireIdleCallback: "Fire Idle Callback",
  createWebsocket: "Create WebSocket",
  sendWebsocketHandshake: "Send WebSocket Handshake",
  receiveWebsocketHandshake: "Receive WebSocket Handshake",
  destroyWebsocket: "Destroy WebSocket",
  embedderCallback: "Embedder Callback",
  imageDecode: "Image Decode",
  imageResize: "Image Resize",
  gpu: "GPU",
  inputLatency: "Input Latency",
  domGc: "DOM GC",
  encrypt: "Encrypt",
  encryptReply: "Encrypt Reply",
  decrypt: "Decrypt",
  decryptReply: "Decrypt Reply",
  digest: "Digest",
  digestReply: "Digest Reply",
  sign: "Sign",
  signReply: "Sign Reply",
  verify: "Verify",
  verifyReply: "Verify Reply",
  asyncTask: "Async Task",
  layoutShift: "Layout Shift",
  keyCharacter: "Key \u2014 Character",
  keyDown: "Key Down",
  keyUp: "Key Up",
  click: "Click",
  contextMenu: "Context Menu",
  mouseDown: "Mouse Down",
  mouseMove: "Mouse Move",
  mouseUp: "Mouse Up",
  mouseWheel: "Mouse Wheel",
  scrollBegin: "Scroll Begin",
  scrollEnd: "Scroll End",
  scrollUpdate: "Scroll Update",
  flingStart: "Fling Start",
  flingHalt: "Fling Halt",
  tap: "Tap",
  tapHalt: "Tap Halt",
  tapBegin: "Tap Begin",
  tapDown: "Tap Down",
  touchCancel: "Touch Cancel",
  touchEnd: "Touch End",
  touchMove: "Touch Move",
  touchStart: "Touch Start",
  pinchBegin: "Pinch Begin",
  pinchEnd: "Pinch End",
  pinchUpdate: "Pinch Update",
  compile: "Compile",
  parse: "Parse",
  sS: "{PH1}: {PH2}",
  response: "Response",
  fling: "Fling",
  drag: "Drag",
  uncategorized: "Uncategorized",
  sCollected: "{PH1} collected",
  sSs: "{PH1} [{PH2}\u2026{PH3}]",
  sSSquareBrackets: "{PH1} [{PH2}\u2026]",
  learnMore: "Learn more",
  compilationCacheStatus: "Compilation cache status",
  compilationCacheSize: "Compilation cache size",
  scriptLoadedFromCache: "script loaded from cache",
  failedToLoadScriptFromCache: "failed to load script from cache",
  scriptNotEligible: "script not eligible",
  totalTime: "Total Time",
  selfTime: "Self Time",
  collected: "Collected",
  function: "Function",
  timerId: "Timer ID",
  timeout: "Timeout",
  repeats: "Repeats",
  callbackId: "Callback ID",
  resource: "Resource",
  requestMethod: "Request Method",
  statusCode: "Status Code",
  mimeTypeCaps: "MIME Type",
  priority: "Priority",
  encodedData: "Encoded Data",
  sBytes: "{n, plural, =1 {# Byte} other {# Bytes}}",
  decodedBody: "Decoded Body",
  module: "Module",
  script: "Script",
  streamed: "Streamed",
  eagerCompile: "Compiling all functions eagerly",
  url: "Url",
  producedCacheSize: "Produced Cache Size",
  consumedCacheSize: "Consumed Cache Size",
  location: "Location",
  sSCurlyBrackets: "({PH1}, {PH2})",
  dimensions: "Dimensions",
  sSDimensions: "{PH1} \xD7 {PH2}",
  layerRoot: "Layer Root",
  ownerElement: "Owner Element",
  imageUrl: "Image URL",
  stylesheetUrl: "Stylesheet URL",
  elementsAffected: "Elements Affected",
  nodesThatNeedLayout: "Nodes That Need Layout",
  sOfS: "{PH1} of {PH2}",
  layoutRoot: "Layout root",
  message: "Message",
  websocketProtocol: "WebSocket Protocol",
  callbackFunction: "Callback Function",
  state: "State",
  range: "Range",
  allottedTime: "Allotted Time",
  invokedByTimeout: "Invoked by Timeout",
  type: "Type",
  size: "Size",
  details: "Details",
  cumulativeLayoutShifts: "Cumulative Layout Shifts",
  evolvedClsLink: "evolved",
  sCLSInformation: "{PH1} can result in poor user experiences. It has recently {PH2}.",
  warning: "Warning",
  score: "Score",
  cumulativeScore: "Cumulative Score",
  currentClusterScore: "Current Cluster Score",
  currentClusterId: "Current Cluster ID",
  hadRecentInput: "Had recent input",
  yes: "Yes",
  no: "No",
  movedFrom: "Moved from",
  movedTo: "Moved to",
  timeWaitingForMainThread: "Time Waiting for Main Thread",
  relatedNode: "Related Node",
  preview: "Preview",
  aggregatedTime: "Aggregated Time",
  networkRequest: "Network request",
  loadFromCache: "load from cache",
  networkTransfer: "network transfer",
  SSSResourceLoading: " ({PH1} {PH2} + {PH3} resource loading)",
  duration: "Duration",
  mimeType: "Mime Type",
  FromMemoryCache: " (from memory cache)",
  FromCache: " (from cache)",
  FromPush: " (from push)",
  FromServiceWorker: " (from `service worker`)",
  initiator: "Initiator",
  timerInstalled: "Timer Installed",
  animationFrameRequested: "Animation Frame Requested",
  idleCallbackRequested: "Idle Callback Requested",
  recalculationForced: "Recalculation Forced",
  firstLayoutInvalidation: "First Layout Invalidation",
  layoutForced: "Layout Forced",
  callStacks: "Call Stacks",
  stackTrace: "Stack Trace",
  invalidations: "Invalidations",
  pendingFor: "Pending for",
  reveal: "Reveal",
  firstInvalidated: "First Invalidated",
  styleInvalidations: "Style Invalidations",
  layoutInvalidations: "Layout Invalidations",
  otherInvalidations: "Other Invalidations",
  paintProfiler: "Paint Profiler",
  sAtS: "{PH1} at {PH2}",
  loading: "Loading",
  experience: "Experience",
  scripting: "Scripting",
  rendering: "Rendering",
  painting: "Painting",
  async: "Async",
  system: "System",
  idle: "Idle",
  sSelf: "{PH1} (self)",
  sChildren: "{PH1} (children)",
  timeSpentInRendering: "Time spent in rendering",
  frame: "Frame",
  cpuTime: "CPU time",
  layerTree: "Layer tree",
  show: "Show",
  sAtSParentheses: "{PH1} (at {PH2})",
  emptyPlaceholder: "{PH1}",
  jank: "jank",
  sLongFrameTimesAreAnIndicationOf: "{PH1}. Long frame times are an indication of {PH2}",
  forcedReflow: "Forced reflow",
  sIsALikelyPerformanceBottleneck: "{PH1} is a likely performance bottleneck.",
  idleCallbackExecutionExtended: "Idle callback execution extended beyond deadline by {PH1}",
  handlerTookS: "Handler took {PH1}",
  recurringHandlerTookS: "Recurring handler took {PH1}",
  longTask: "Long task",
  sTookS: "{PH1} took {PH2}.",
  notOptimized: "Not optimized",
  emptyPlaceholderColon: ": {PH1}",
  unknownCause: "Unknown cause",
  sForS: "{PH1} for {PH2}",
  sSDot: "{PH1}. {PH2}",
  unknown: "unknown",
  stackTraceColon: "Stack trace:",
  nodes: "Nodes:",
  node: "Node:",
  changedIdToSs: '(changed id to "{PH1}"{PH2})',
  changedClassToSs: '(changed class to "{PH1}"{PH2})',
  changedAttributeToSs: '(changed attribute to "{PH1}"{PH2})',
  changedPesudoToSs: '(changed pseudo to "{PH1}"{PH2})',
  changedSs: '(changed "{PH1}"{PH2})',
  sSAndSOthers: "{PH1}, {PH2}, and {PH3} others",
  UnknownNode: "[ unknown node ]"
};
const str_ = i18n.i18n.registerUIStrings("panels/timeline/TimelineUIUtils.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let eventStylesMap;
let inputEventToDisplayName;
let interactionPhaseStylesMap;
let categories;
let eventCategories;
let eventDispatchDesciptors;
let colorGenerator;
const requestPreviewElements = /* @__PURE__ */ new WeakMap();
export class TimelineUIUtils {
  static initEventStyles() {
    if (eventStylesMap) {
      return eventStylesMap;
    }
    const type = TimelineModel.TimelineModel.RecordType;
    const categories2 = TimelineUIUtils.categories();
    const rendering = categories2["rendering"];
    const scripting = categories2["scripting"];
    const loading = categories2["loading"];
    const experience = categories2["experience"];
    const painting = categories2["painting"];
    const other = categories2["other"];
    const idle = categories2["idle"];
    const eventStyles = {};
    eventStyles[type.Task] = new TimelineRecordStyle(i18nString(UIStrings.task), other);
    eventStyles[type.Program] = new TimelineRecordStyle(i18nString(UIStrings.other), other);
    eventStyles[type.Animation] = new TimelineRecordStyle(i18nString(UIStrings.animation), rendering);
    eventStyles[type.EventDispatch] = new TimelineRecordStyle(i18nString(UIStrings.event), scripting);
    eventStyles[type.RequestMainThreadFrame] = new TimelineRecordStyle(i18nString(UIStrings.requestMainThreadFrame), rendering, true);
    eventStyles[type.BeginFrame] = new TimelineRecordStyle(i18nString(UIStrings.frameStart), rendering, true);
    eventStyles[type.BeginMainThreadFrame] = new TimelineRecordStyle(i18nString(UIStrings.frameStartMainThread), rendering, true);
    eventStyles[type.DrawFrame] = new TimelineRecordStyle(i18nString(UIStrings.drawFrame), rendering, true);
    eventStyles[type.HitTest] = new TimelineRecordStyle(i18nString(UIStrings.hitTest), rendering);
    eventStyles[type.ScheduleStyleRecalculation] = new TimelineRecordStyle(i18nString(UIStrings.scheduleStyleRecalculation), rendering);
    eventStyles[type.RecalculateStyles] = new TimelineRecordStyle(i18nString(UIStrings.recalculateStyle), rendering);
    eventStyles[type.UpdateLayoutTree] = new TimelineRecordStyle(i18nString(UIStrings.recalculateStyle), rendering);
    eventStyles[type.InvalidateLayout] = new TimelineRecordStyle(i18nString(UIStrings.invalidateLayout), rendering, true);
    eventStyles[type.Layout] = new TimelineRecordStyle(i18nString(UIStrings.layout), rendering);
    eventStyles[type.PaintSetup] = new TimelineRecordStyle(i18nString(UIStrings.paintSetup), painting);
    eventStyles[type.PaintImage] = new TimelineRecordStyle(i18nString(UIStrings.paintImage), painting, true);
    eventStyles[type.UpdateLayer] = new TimelineRecordStyle(i18nString(UIStrings.updateLayer), painting, true);
    eventStyles[type.UpdateLayerTree] = new TimelineRecordStyle(i18nString(UIStrings.updateLayerTree), rendering);
    eventStyles[type.Paint] = new TimelineRecordStyle(i18nString(UIStrings.paint), painting);
    eventStyles[type.PrePaint] = new TimelineRecordStyle(i18nString(UIStrings.prePaint), rendering);
    eventStyles[type.RasterTask] = new TimelineRecordStyle(i18nString(UIStrings.rasterizePaint), painting);
    eventStyles[type.ScrollLayer] = new TimelineRecordStyle(i18nString(UIStrings.scroll), rendering);
    eventStyles[type.CompositeLayers] = new TimelineRecordStyle(i18nString(UIStrings.compositeLayers), painting);
    eventStyles[type.ComputeIntersections] = new TimelineRecordStyle(i18nString(UIStrings.computeIntersections), rendering);
    eventStyles[type.ParseHTML] = new TimelineRecordStyle(i18nString(UIStrings.parseHtml), loading);
    eventStyles[type.ParseAuthorStyleSheet] = new TimelineRecordStyle(i18nString(UIStrings.parseStylesheet), loading);
    eventStyles[type.TimerInstall] = new TimelineRecordStyle(i18nString(UIStrings.installTimer), scripting);
    eventStyles[type.TimerRemove] = new TimelineRecordStyle(i18nString(UIStrings.removeTimer), scripting);
    eventStyles[type.TimerFire] = new TimelineRecordStyle(i18nString(UIStrings.timerFired), scripting);
    eventStyles[type.XHRReadyStateChange] = new TimelineRecordStyle(i18nString(UIStrings.xhrReadyStateChange), scripting);
    eventStyles[type.XHRLoad] = new TimelineRecordStyle(i18nString(UIStrings.xhrLoad), scripting);
    eventStyles[type.CompileScript] = new TimelineRecordStyle(i18nString(UIStrings.compileScript), scripting);
    eventStyles[type.CacheScript] = new TimelineRecordStyle(i18nString(UIStrings.cacheScript), scripting);
    eventStyles[type.CompileCode] = new TimelineRecordStyle(i18nString(UIStrings.compileCode), scripting);
    eventStyles[type.OptimizeCode] = new TimelineRecordStyle(i18nString(UIStrings.optimizeCode), scripting);
    eventStyles[type.EvaluateScript] = new TimelineRecordStyle(i18nString(UIStrings.evaluateScript), scripting);
    eventStyles[type.CompileModule] = new TimelineRecordStyle(i18nString(UIStrings.compileModule), scripting);
    eventStyles[type.CacheModule] = new TimelineRecordStyle(i18nString(UIStrings.cacheModule), scripting);
    eventStyles[type.EvaluateModule] = new TimelineRecordStyle(i18nString(UIStrings.evaluateModule), scripting);
    eventStyles[type.StreamingCompileScript] = new TimelineRecordStyle(i18nString(UIStrings.streamingCompileTask), other);
    eventStyles[type.StreamingCompileScriptWaiting] = new TimelineRecordStyle(i18nString(UIStrings.waitingForNetwork), idle);
    eventStyles[type.StreamingCompileScriptParsing] = new TimelineRecordStyle(i18nString(UIStrings.parseAndCompile), scripting);
    eventStyles[type.WasmStreamFromResponseCallback] = new TimelineRecordStyle(i18nString(UIStrings.streamingWasmResponse), scripting);
    eventStyles[type.WasmCompiledModule] = new TimelineRecordStyle(i18nString(UIStrings.compiledWasmModule), scripting);
    eventStyles[type.WasmCachedModule] = new TimelineRecordStyle(i18nString(UIStrings.cachedWasmModule), scripting);
    eventStyles[type.WasmModuleCacheHit] = new TimelineRecordStyle(i18nString(UIStrings.wasmModuleCacheHit), scripting);
    eventStyles[type.WasmModuleCacheInvalid] = new TimelineRecordStyle(i18nString(UIStrings.wasmModuleCacheInvalid), scripting);
    eventStyles[type.FrameStartedLoading] = new TimelineRecordStyle(i18nString(UIStrings.frameStartedLoading), loading, true);
    eventStyles[type.MarkLoad] = new TimelineRecordStyle(i18nString(UIStrings.onloadEvent), scripting, true);
    eventStyles[type.MarkDOMContent] = new TimelineRecordStyle(i18nString(UIStrings.domcontentloadedEvent), scripting, true);
    eventStyles[type.MarkFirstPaint] = new TimelineRecordStyle(i18nString(UIStrings.firstPaint), painting, true);
    eventStyles[type.MarkFCP] = new TimelineRecordStyle(i18nString(UIStrings.firstContentfulPaint), rendering, true);
    eventStyles[type.MarkLCPCandidate] = new TimelineRecordStyle(i18nString(UIStrings.largestContentfulPaint), rendering, true);
    eventStyles[type.TimeStamp] = new TimelineRecordStyle(i18nString(UIStrings.timestamp), scripting);
    eventStyles[type.ConsoleTime] = new TimelineRecordStyle(i18nString(UIStrings.consoleTime), scripting);
    eventStyles[type.UserTiming] = new TimelineRecordStyle(i18nString(UIStrings.userTiming), scripting);
    eventStyles[type.ResourceWillSendRequest] = new TimelineRecordStyle(i18nString(UIStrings.willSendRequest), loading);
    eventStyles[type.ResourceSendRequest] = new TimelineRecordStyle(i18nString(UIStrings.sendRequest), loading);
    eventStyles[type.ResourceReceiveResponse] = new TimelineRecordStyle(i18nString(UIStrings.receiveResponse), loading);
    eventStyles[type.ResourceFinish] = new TimelineRecordStyle(i18nString(UIStrings.finishLoading), loading);
    eventStyles[type.ResourceReceivedData] = new TimelineRecordStyle(i18nString(UIStrings.receiveData), loading);
    eventStyles[type.RunMicrotasks] = new TimelineRecordStyle(i18nString(UIStrings.runMicrotasks), scripting);
    eventStyles[type.FunctionCall] = new TimelineRecordStyle(i18nString(UIStrings.functionCall), scripting);
    eventStyles[type.GCEvent] = new TimelineRecordStyle(i18nString(UIStrings.gcEvent), scripting);
    eventStyles[type.MajorGC] = new TimelineRecordStyle(i18nString(UIStrings.majorGc), scripting);
    eventStyles[type.MinorGC] = new TimelineRecordStyle(i18nString(UIStrings.minorGc), scripting);
    eventStyles[type.JSFrame] = new TimelineRecordStyle(i18nString(UIStrings.jsFrame), scripting);
    eventStyles[type.RequestAnimationFrame] = new TimelineRecordStyle(i18nString(UIStrings.requestAnimationFrame), scripting);
    eventStyles[type.CancelAnimationFrame] = new TimelineRecordStyle(i18nString(UIStrings.cancelAnimationFrame), scripting);
    eventStyles[type.FireAnimationFrame] = new TimelineRecordStyle(i18nString(UIStrings.animationFrameFired), scripting);
    eventStyles[type.RequestIdleCallback] = new TimelineRecordStyle(i18nString(UIStrings.requestIdleCallback), scripting);
    eventStyles[type.CancelIdleCallback] = new TimelineRecordStyle(i18nString(UIStrings.cancelIdleCallback), scripting);
    eventStyles[type.FireIdleCallback] = new TimelineRecordStyle(i18nString(UIStrings.fireIdleCallback), scripting);
    eventStyles[type.WebSocketCreate] = new TimelineRecordStyle(i18nString(UIStrings.createWebsocket), scripting);
    eventStyles[type.WebSocketSendHandshakeRequest] = new TimelineRecordStyle(i18nString(UIStrings.sendWebsocketHandshake), scripting);
    eventStyles[type.WebSocketReceiveHandshakeResponse] = new TimelineRecordStyle(i18nString(UIStrings.receiveWebsocketHandshake), scripting);
    eventStyles[type.WebSocketDestroy] = new TimelineRecordStyle(i18nString(UIStrings.destroyWebsocket), scripting);
    eventStyles[type.EmbedderCallback] = new TimelineRecordStyle(i18nString(UIStrings.embedderCallback), scripting);
    eventStyles[type.DecodeImage] = new TimelineRecordStyle(i18nString(UIStrings.imageDecode), painting);
    eventStyles[type.ResizeImage] = new TimelineRecordStyle(i18nString(UIStrings.imageResize), painting);
    eventStyles[type.GPUTask] = new TimelineRecordStyle(i18nString(UIStrings.gpu), categories2["gpu"]);
    eventStyles[type.LatencyInfo] = new TimelineRecordStyle(i18nString(UIStrings.inputLatency), scripting);
    eventStyles[type.GCCollectGarbage] = new TimelineRecordStyle(i18nString(UIStrings.domGc), scripting);
    eventStyles[type.CryptoDoEncrypt] = new TimelineRecordStyle(i18nString(UIStrings.encrypt), scripting);
    eventStyles[type.CryptoDoEncryptReply] = new TimelineRecordStyle(i18nString(UIStrings.encryptReply), scripting);
    eventStyles[type.CryptoDoDecrypt] = new TimelineRecordStyle(i18nString(UIStrings.decrypt), scripting);
    eventStyles[type.CryptoDoDecryptReply] = new TimelineRecordStyle(i18nString(UIStrings.decryptReply), scripting);
    eventStyles[type.CryptoDoDigest] = new TimelineRecordStyle(i18nString(UIStrings.digest), scripting);
    eventStyles[type.CryptoDoDigestReply] = new TimelineRecordStyle(i18nString(UIStrings.digestReply), scripting);
    eventStyles[type.CryptoDoSign] = new TimelineRecordStyle(i18nString(UIStrings.sign), scripting);
    eventStyles[type.CryptoDoSignReply] = new TimelineRecordStyle(i18nString(UIStrings.signReply), scripting);
    eventStyles[type.CryptoDoVerify] = new TimelineRecordStyle(i18nString(UIStrings.verify), scripting);
    eventStyles[type.CryptoDoVerifyReply] = new TimelineRecordStyle(i18nString(UIStrings.verifyReply), scripting);
    eventStyles[type.AsyncTask] = new TimelineRecordStyle(i18nString(UIStrings.asyncTask), categories2["async"]);
    eventStyles[type.LayoutShift] = new TimelineRecordStyle(i18nString(UIStrings.layoutShift), experience);
    eventStylesMap = eventStyles;
    return eventStyles;
  }
  static setEventStylesMap(eventStyles) {
    eventStylesMap = eventStyles;
  }
  static inputEventDisplayName(inputEventType) {
    if (!inputEventToDisplayName) {
      const inputEvent = TimelineModel.TimelineIRModel.InputEvents;
      inputEventToDisplayName = /* @__PURE__ */ new Map([
        [inputEvent.Char, i18nString(UIStrings.keyCharacter)],
        [inputEvent.KeyDown, i18nString(UIStrings.keyDown)],
        [inputEvent.KeyDownRaw, i18nString(UIStrings.keyDown)],
        [inputEvent.KeyUp, i18nString(UIStrings.keyUp)],
        [inputEvent.Click, i18nString(UIStrings.click)],
        [inputEvent.ContextMenu, i18nString(UIStrings.contextMenu)],
        [inputEvent.MouseDown, i18nString(UIStrings.mouseDown)],
        [inputEvent.MouseMove, i18nString(UIStrings.mouseMove)],
        [inputEvent.MouseUp, i18nString(UIStrings.mouseUp)],
        [inputEvent.MouseWheel, i18nString(UIStrings.mouseWheel)],
        [inputEvent.ScrollBegin, i18nString(UIStrings.scrollBegin)],
        [inputEvent.ScrollEnd, i18nString(UIStrings.scrollEnd)],
        [inputEvent.ScrollUpdate, i18nString(UIStrings.scrollUpdate)],
        [inputEvent.FlingStart, i18nString(UIStrings.flingStart)],
        [inputEvent.FlingCancel, i18nString(UIStrings.flingHalt)],
        [inputEvent.Tap, i18nString(UIStrings.tap)],
        [inputEvent.TapCancel, i18nString(UIStrings.tapHalt)],
        [inputEvent.ShowPress, i18nString(UIStrings.tapBegin)],
        [inputEvent.TapDown, i18nString(UIStrings.tapDown)],
        [inputEvent.TouchCancel, i18nString(UIStrings.touchCancel)],
        [inputEvent.TouchEnd, i18nString(UIStrings.touchEnd)],
        [inputEvent.TouchMove, i18nString(UIStrings.touchMove)],
        [inputEvent.TouchStart, i18nString(UIStrings.touchStart)],
        [inputEvent.PinchBegin, i18nString(UIStrings.pinchBegin)],
        [inputEvent.PinchEnd, i18nString(UIStrings.pinchEnd)],
        [inputEvent.PinchUpdate, i18nString(UIStrings.pinchUpdate)]
      ]);
    }
    return inputEventToDisplayName.get(inputEventType) || null;
  }
  static frameDisplayName(frame) {
    if (!TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.isNativeRuntimeFrame(frame)) {
      return UI.UIUtils.beautifyFunctionName(frame.functionName);
    }
    const nativeGroup = TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.nativeGroup(frame.functionName);
    const groups = TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.NativeGroups;
    switch (nativeGroup) {
      case groups.Compile:
        return i18nString(UIStrings.compile);
      case groups.Parse:
        return i18nString(UIStrings.parse);
    }
    return frame.functionName;
  }
  static testContentMatching(traceEvent, regExp) {
    const title = TimelineUIUtils.eventStyle(traceEvent).title;
    const tokens = [title];
    const url = TimelineModel.TimelineModel.TimelineData.forEvent(traceEvent).url;
    if (url) {
      tokens.push(url);
    }
    appendObjectProperties(traceEvent.args, 2);
    return regExp.test(tokens.join("|"));
    function appendObjectProperties(object, depth) {
      if (!depth) {
        return;
      }
      for (const key in object) {
        const value = object[key];
        const type = typeof value;
        if (type === "string") {
          tokens.push(value);
        } else if (type === "number") {
          tokens.push(String(value));
        } else if (type === "object") {
          appendObjectProperties(value, depth - 1);
        }
      }
    }
  }
  static eventURL(event) {
    const data = event.args["data"] || event.args["beginData"];
    const url = data && data.url;
    if (url) {
      return url;
    }
    const stackTrace = data && data["stackTrace"];
    const frame = stackTrace && stackTrace.length && stackTrace[0] || TimelineModel.TimelineModel.TimelineData.forEvent(event).topFrame();
    return frame && frame.url || null;
  }
  static eventStyle(event) {
    const eventStyles = TimelineUIUtils.initEventStyles();
    if (event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.Console) || event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming)) {
      return new TimelineRecordStyle(event.name, TimelineUIUtils.categories()["scripting"]);
    }
    if (event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.LatencyInfo)) {
      const prefix = "InputLatency::";
      const inputEventType = event.name.startsWith(prefix) ? event.name.substr(prefix.length) : event.name;
      const displayName = TimelineUIUtils.inputEventDisplayName(inputEventType);
      return new TimelineRecordStyle(displayName || inputEventType, TimelineUIUtils.categories()["scripting"]);
    }
    let result = eventStyles[event.name];
    if (!result) {
      result = new TimelineRecordStyle(event.name, TimelineUIUtils.categories()["other"], true);
      eventStyles[event.name] = result;
    }
    return result;
  }
  static eventColor(event) {
    if (event.name === TimelineModel.TimelineModel.RecordType.JSFrame) {
      const frame = event.args["data"];
      if (TimelineUIUtils.isUserFrame(frame)) {
        return TimelineUIUtils.colorForId(frame.url);
      }
    }
    const color = TimelineUIUtils.eventStyle(event).category.color;
    if (event.name === TimelineModel.TimelineModel.RecordType.StreamingCompileScriptWaiting) {
      const color2 = Common.Color.Color.parse(TimelineUIUtils.categories().scripting.color);
      if (!color2) {
        throw new Error("Unable to parse color from TimelineUIUtils.categories().scripting.color");
      }
      return color2.setAlpha(0.3).asString(null);
    }
    return color;
  }
  static eventColorByProduct(model, urlToColorCache, event) {
    const url = TimelineUIUtils.eventURL(event) || Platform.DevToolsPath.EmptyUrlString;
    let color = urlToColorCache.get(url);
    if (color) {
      return color;
    }
    const defaultColor = "#f2ecdc";
    const parsedURL = Common.ParsedURL.ParsedURL.fromString(url);
    if (!parsedURL) {
      return defaultColor;
    }
    const name = parsedURL.host;
    const rootFrames = model.rootFrames();
    if (rootFrames.some((pageFrame) => new Common.ParsedURL.ParsedURL(pageFrame.url).host === name)) {
      color = defaultColor;
    }
    if (!color) {
      color = defaultColor;
    }
    urlToColorCache.set(url, color);
    return color;
  }
  static eventTitle(event) {
    const recordType = TimelineModel.TimelineModel.RecordType;
    const eventData = event.args["data"];
    if (event.name === recordType.JSFrame) {
      return TimelineUIUtils.frameDisplayName(eventData);
    }
    const title = TimelineUIUtils.eventStyle(event).title;
    if (event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.Console)) {
      return title;
    }
    if (event.name === recordType.TimeStamp) {
      return i18nString(UIStrings.sS, { PH1: title, PH2: eventData["message"] });
    }
    if (event.name === recordType.Animation && eventData && eventData["name"]) {
      return i18nString(UIStrings.sS, { PH1: title, PH2: eventData["name"] });
    }
    if (event.name === recordType.EventDispatch && eventData && eventData["type"]) {
      return i18nString(UIStrings.sS, { PH1: title, PH2: eventData["type"] });
    }
    return title;
  }
  static interactionPhaseStyles() {
    let map = interactionPhaseStylesMap;
    if (!map) {
      map = /* @__PURE__ */ new Map([
        [TimelineModel.TimelineIRModel.Phases.Idle, { color: "white", label: "Idle" }],
        [
          TimelineModel.TimelineIRModel.Phases.Response,
          { color: "hsl(43, 83%, 64%)", label: i18nString(UIStrings.response) }
        ],
        [
          TimelineModel.TimelineIRModel.Phases.Scroll,
          { color: "hsl(256, 67%, 70%)", label: i18nString(UIStrings.scroll) }
        ],
        [TimelineModel.TimelineIRModel.Phases.Fling, { color: "hsl(256, 67%, 70%)", label: i18nString(UIStrings.fling) }],
        [TimelineModel.TimelineIRModel.Phases.Drag, { color: "hsl(256, 67%, 70%)", label: i18nString(UIStrings.drag) }],
        [
          TimelineModel.TimelineIRModel.Phases.Animation,
          { color: "hsl(256, 67%, 70%)", label: i18nString(UIStrings.animation) }
        ],
        [
          TimelineModel.TimelineIRModel.Phases.Uncategorized,
          { color: "hsl(0, 0%, 87%)", label: i18nString(UIStrings.uncategorized) }
        ]
      ]);
      interactionPhaseStylesMap = map;
    }
    return map;
  }
  static interactionPhaseColor(phase) {
    const interactionPhase = TimelineUIUtils.interactionPhaseStyles().get(phase);
    if (!interactionPhase) {
      throw new Error(`Unknown phase ${phase}`);
    }
    return interactionPhase.color;
  }
  static interactionPhaseLabel(phase) {
    const interactionPhase = TimelineUIUtils.interactionPhaseStyles().get(phase);
    if (!interactionPhase) {
      throw new Error(`Unknown phase ${phase}`);
    }
    return interactionPhase.label;
  }
  static isUserFrame(frame) {
    return frame.scriptId !== "0" && !(frame.url && frame.url.startsWith("native "));
  }
  static networkRequestCategory(request) {
    const categories2 = NetworkCategory;
    switch (request.mimeType) {
      case "text/html":
        return categories2.HTML;
      case "application/javascript":
      case "application/x-javascript":
      case "text/javascript":
        return categories2.Script;
      case "text/css":
        return categories2.Style;
      case "audio/ogg":
      case "image/gif":
      case "image/jpeg":
      case "image/png":
      case "image/svg+xml":
      case "image/webp":
      case "image/x-icon":
      case "font/opentype":
      case "font/woff2":
      case "application/font-woff":
        return categories2.Media;
      default:
        return categories2.Other;
    }
  }
  static networkCategoryColor(category) {
    const categories2 = NetworkCategory;
    switch (category) {
      case categories2.HTML:
        return "hsl(214, 67%, 66%)";
      case categories2.Script:
        return "hsl(43, 83%, 64%)";
      case categories2.Style:
        return "hsl(256, 67%, 70%)";
      case categories2.Media:
        return "hsl(109, 33%, 55%)";
      default:
        return "hsl(0, 0%, 70%)";
    }
  }
  static async buildDetailsTextForTraceEvent(event) {
    const recordType = TimelineModel.TimelineModel.RecordType;
    let detailsText;
    const eventData = event.args["data"];
    switch (event.name) {
      case recordType.GCEvent:
      case recordType.MajorGC:
      case recordType.MinorGC: {
        const delta = event.args["usedHeapSizeBefore"] - event.args["usedHeapSizeAfter"];
        detailsText = i18nString(UIStrings.sCollected, { PH1: Platform.NumberUtilities.bytesToString(delta) });
        break;
      }
      case recordType.FunctionCall:
        if (eventData && eventData["url"] && eventData["lineNumber"] !== void 0 && eventData["columnNumber"] !== void 0) {
          detailsText = eventData.url + ":" + (eventData.lineNumber + 1) + ":" + (eventData.columnNumber + 1);
        }
        break;
      case recordType.JSFrame:
        detailsText = TimelineUIUtils.frameDisplayName(eventData);
        break;
      case recordType.EventDispatch:
        detailsText = eventData ? eventData["type"] : null;
        break;
      case recordType.Paint: {
        const width = TimelineUIUtils.quadWidth(eventData.clip);
        const height = TimelineUIUtils.quadHeight(eventData.clip);
        if (width && height) {
          detailsText = i18nString(UIStrings.sSDimensions, { PH1: width, PH2: height });
        }
        break;
      }
      case recordType.ParseHTML: {
        const startLine = event.args["beginData"]["startLine"];
        const endLine = event.args["endData"] && event.args["endData"]["endLine"];
        const url = Bindings.ResourceUtils.displayNameForURL(event.args["beginData"]["url"]);
        if (endLine >= 0) {
          detailsText = i18nString(UIStrings.sSs, { PH1: url, PH2: startLine + 1, PH3: endLine + 1 });
        } else {
          detailsText = i18nString(UIStrings.sSSquareBrackets, { PH1: url, PH2: startLine + 1 });
        }
        break;
      }
      case recordType.CompileModule:
      case recordType.CacheModule:
        detailsText = Bindings.ResourceUtils.displayNameForURL(event.args["fileName"]);
        break;
      case recordType.CompileScript:
      case recordType.CacheScript:
      case recordType.EvaluateScript: {
        const url = eventData && eventData["url"];
        if (url) {
          detailsText = Bindings.ResourceUtils.displayNameForURL(url) + ":" + (eventData["lineNumber"] + 1);
        }
        break;
      }
      case recordType.WasmCompiledModule:
      case recordType.WasmModuleCacheHit: {
        const url = event.args["url"];
        if (url) {
          detailsText = Bindings.ResourceUtils.displayNameForURL(url);
        }
        break;
      }
      case recordType.StreamingCompileScript:
      case recordType.XHRReadyStateChange:
      case recordType.XHRLoad: {
        const url = eventData["url"];
        if (url) {
          detailsText = Bindings.ResourceUtils.displayNameForURL(url);
        }
        break;
      }
      case recordType.TimeStamp:
        detailsText = eventData["message"];
        break;
      case recordType.WebSocketCreate:
      case recordType.WebSocketSendHandshakeRequest:
      case recordType.WebSocketReceiveHandshakeResponse:
      case recordType.WebSocketDestroy:
      case recordType.ResourceWillSendRequest:
      case recordType.ResourceSendRequest:
      case recordType.ResourceReceivedData:
      case recordType.ResourceReceiveResponse:
      case recordType.ResourceFinish:
      case recordType.PaintImage:
      case recordType.DecodeImage:
      case recordType.ResizeImage:
      case recordType.DecodeLazyPixelRef: {
        const url = TimelineModel.TimelineModel.TimelineData.forEvent(event).url;
        if (url) {
          detailsText = Bindings.ResourceUtils.displayNameForURL(url);
        }
        break;
      }
      case recordType.EmbedderCallback:
        detailsText = eventData["callbackName"];
        break;
      case recordType.Animation:
        detailsText = eventData && eventData["name"];
        break;
      case recordType.AsyncTask:
        detailsText = eventData ? eventData["name"] : null;
        break;
      default:
        if (event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.Console)) {
          detailsText = null;
        } else {
          detailsText = await linkifyTopCallFrameAsText();
        }
        break;
    }
    return detailsText;
    async function linkifyTopCallFrameAsText() {
      const frame = TimelineModel.TimelineModel.TimelineData.forEvent(event).topFrame();
      if (!frame) {
        return null;
      }
      return frame.url + ":" + (frame.lineNumber + 1) + ":" + (frame.columnNumber + 1);
    }
  }
  static async buildDetailsNodeForTraceEvent(event, target, linkifier) {
    const recordType = TimelineModel.TimelineModel.RecordType;
    let details = null;
    let detailsText;
    const eventData = event.args["data"];
    switch (event.name) {
      case recordType.GCEvent:
      case recordType.MajorGC:
      case recordType.MinorGC:
      case recordType.EventDispatch:
      case recordType.Paint:
      case recordType.Animation:
      case recordType.EmbedderCallback:
      case recordType.ParseHTML:
      case recordType.WasmStreamFromResponseCallback:
      case recordType.WasmCompiledModule:
      case recordType.WasmModuleCacheHit:
      case recordType.WasmCachedModule:
      case recordType.WasmModuleCacheInvalid:
      case recordType.WebSocketCreate:
      case recordType.WebSocketSendHandshakeRequest:
      case recordType.WebSocketReceiveHandshakeResponse:
      case recordType.WebSocketDestroy: {
        detailsText = await TimelineUIUtils.buildDetailsTextForTraceEvent(event);
        break;
      }
      case recordType.PaintImage:
      case recordType.DecodeImage:
      case recordType.ResizeImage:
      case recordType.DecodeLazyPixelRef:
      case recordType.XHRReadyStateChange:
      case recordType.XHRLoad:
      case recordType.ResourceWillSendRequest:
      case recordType.ResourceSendRequest:
      case recordType.ResourceReceivedData:
      case recordType.ResourceReceiveResponse:
      case recordType.ResourceFinish: {
        const url = TimelineModel.TimelineModel.TimelineData.forEvent(event).url;
        if (url) {
          const options = {
            tabStop: true,
            showColumnNumber: false,
            inlineFrameIndex: 0
          };
          details = Components.Linkifier.Linkifier.linkifyURL(url, options);
        }
        break;
      }
      case recordType.FunctionCall:
      case recordType.JSFrame: {
        details = document.createElement("span");
        UI.UIUtils.createTextChild(details, TimelineUIUtils.frameDisplayName(eventData));
        const location = linkifyLocation(eventData["scriptId"], eventData["url"], eventData["lineNumber"], eventData["columnNumber"]);
        if (location) {
          UI.UIUtils.createTextChild(details, " @ ");
          details.appendChild(location);
        }
        break;
      }
      case recordType.CompileModule:
      case recordType.CacheModule: {
        details = linkifyLocation(null, event.args["fileName"], 0, 0);
        break;
      }
      case recordType.CompileScript:
      case recordType.CacheScript:
      case recordType.EvaluateScript: {
        const url = eventData["url"];
        if (url) {
          details = linkifyLocation(null, url, eventData["lineNumber"], 0);
        }
        break;
      }
      case recordType.StreamingCompileScript: {
        const url = eventData["url"];
        if (url) {
          details = linkifyLocation(null, url, 0, 0);
        }
        break;
      }
      default: {
        if (event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.Console)) {
          detailsText = null;
        } else {
          details = linkifyTopCallFrame();
        }
        break;
      }
    }
    if (!details && detailsText) {
      details = document.createTextNode(detailsText);
    }
    return details;
    function linkifyLocation(scriptId, url, lineNumber, columnNumber) {
      const options = { columnNumber, showColumnNumber: true, inlineFrameIndex: 0, className: "timeline-details", tabStop: true };
      return linkifier.linkifyScriptLocation(target, scriptId, url, lineNumber, options);
    }
    function linkifyTopCallFrame() {
      const frame = TimelineModel.TimelineModel.TimelineData.forEvent(event).topFrame();
      return frame ? linkifier.maybeLinkifyConsoleCallFrame(target, frame, { className: "timeline-details", tabStop: true, inlineFrameIndex: 0, showColumnNumber: true }) : null;
    }
  }
  static buildDetailsNodeForPerformanceEvent(event) {
    let link = "https://web.dev/user-centric-performance-metrics/";
    let name = "page performance metrics";
    const recordType = TimelineModel.TimelineModel.RecordType;
    switch (event.name) {
      case recordType.MarkLCPCandidate:
        link = "https://web.dev/lcp/";
        name = "largest contentful paint";
        break;
      case recordType.MarkFCP:
        link = "https://web.dev/first-contentful-paint/";
        name = "first contentful paint";
        break;
      default:
        break;
    }
    return UI.Fragment.html`<div>${UI.XLink.XLink.create(link, i18nString(UIStrings.learnMore))} about ${name}.</div>`;
  }
  static buildConsumeCacheDetails(eventData, contentHelper) {
    if ("consumedCacheSize" in eventData) {
      contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheStatus), i18nString(UIStrings.scriptLoadedFromCache));
      contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheSize), Platform.NumberUtilities.bytesToString(eventData["consumedCacheSize"]));
    } else if (eventData && "cacheRejected" in eventData && eventData["cacheRejected"]) {
      contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheStatus), i18nString(UIStrings.failedToLoadScriptFromCache));
    } else {
      contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheStatus), i18nString(UIStrings.scriptNotEligible));
    }
  }
  static async buildTraceEventDetails(event, model, linkifier, detailed) {
    const maybeTarget = model.targetByEvent(event);
    let relatedNodesMap = null;
    if (maybeTarget) {
      const target = maybeTarget;
      if (typeof event[previewElementSymbol] === "undefined") {
        let previewElement = null;
        const url2 = TimelineModel.TimelineModel.TimelineData.forEvent(event).url;
        if (url2) {
          previewElement = await Components.ImagePreview.ImagePreview.build(target, url2, false, {
            imageAltText: Components.ImagePreview.ImagePreview.defaultAltTextForImageURL(url2),
            precomputedFeatures: void 0
          });
        } else if (TimelineModel.TimelineModel.TimelineData.forEvent(event).picture) {
          previewElement = await TimelineUIUtils.buildPicturePreviewContent(event, target);
        }
        event[previewElementSymbol] = previewElement;
      }
      const nodeIdsToResolve = /* @__PURE__ */ new Set();
      const timelineData2 = TimelineModel.TimelineModel.TimelineData.forEvent(event);
      if (timelineData2.backendNodeIds) {
        for (let i = 0; i < timelineData2.backendNodeIds.length; ++i) {
          nodeIdsToResolve.add(timelineData2.backendNodeIds[i]);
        }
      }
      const invalidationTrackingEvents = TimelineModel.TimelineModel.InvalidationTracker.invalidationEventsFor(event);
      if (invalidationTrackingEvents) {
        TimelineUIUtils.collectInvalidationNodeIds(nodeIdsToResolve, invalidationTrackingEvents);
      }
      if (nodeIdsToResolve.size) {
        const domModel = target.model(SDK.DOMModel.DOMModel);
        if (domModel) {
          relatedNodesMap = await domModel.pushNodesByBackendIdsToFrontend(nodeIdsToResolve);
        }
      }
    }
    const recordTypes = TimelineModel.TimelineModel.RecordType;
    if (event.name === recordTypes.LayoutShift) {
      detailed = false;
    }
    let relatedNodeLabel;
    const contentHelper = new TimelineDetailsContentHelper(model.targetByEvent(event), linkifier);
    const color = model.isMarkerEvent(event) ? TimelineUIUtils.markerStyleForEvent(event).color : TimelineUIUtils.eventStyle(event).category.color;
    contentHelper.addSection(TimelineUIUtils.eventTitle(event), color);
    const eventData = event.args["data"];
    const timelineData = TimelineModel.TimelineModel.TimelineData.forEvent(event);
    const initiator = timelineData.initiator();
    let url = null;
    if (timelineData.warning) {
      contentHelper.appendWarningRow(event);
    }
    if (event.name === recordTypes.JSFrame && eventData["deoptReason"]) {
      contentHelper.appendWarningRow(event, TimelineModel.TimelineModel.TimelineModelImpl.WarningType.V8Deopt);
    }
    if (detailed && !Number.isNaN(event.duration || 0)) {
      contentHelper.appendTextRow(i18nString(UIStrings.totalTime), i18n.TimeUtilities.millisToString(event.duration || 0, true));
      contentHelper.appendTextRow(i18nString(UIStrings.selfTime), i18n.TimeUtilities.millisToString(event.selfTime, true));
    }
    if (model.isGenericTrace()) {
      for (const key in event.args) {
        try {
          contentHelper.appendTextRow(key, JSON.stringify(event.args[key]));
        } catch (e) {
          contentHelper.appendTextRow(key, `<${typeof event.args[key]}>`);
        }
      }
      return contentHelper.fragment;
    }
    switch (event.name) {
      case recordTypes.GCEvent:
      case recordTypes.MajorGC:
      case recordTypes.MinorGC: {
        const delta = event.args["usedHeapSizeBefore"] - event.args["usedHeapSizeAfter"];
        contentHelper.appendTextRow(i18nString(UIStrings.collected), Platform.NumberUtilities.bytesToString(delta));
        break;
      }
      case recordTypes.JSFrame:
      case recordTypes.FunctionCall: {
        const detailsNode = await TimelineUIUtils.buildDetailsNodeForTraceEvent(event, model.targetByEvent(event), linkifier);
        if (detailsNode) {
          contentHelper.appendElementRow(i18nString(UIStrings.function), detailsNode);
        }
        break;
      }
      case recordTypes.TimerFire:
      case recordTypes.TimerInstall:
      case recordTypes.TimerRemove: {
        contentHelper.appendTextRow(i18nString(UIStrings.timerId), eventData["timerId"]);
        if (event.name === recordTypes.TimerInstall) {
          contentHelper.appendTextRow(i18nString(UIStrings.timeout), i18n.TimeUtilities.millisToString(eventData["timeout"]));
          contentHelper.appendTextRow(i18nString(UIStrings.repeats), !eventData["singleShot"]);
        }
        break;
      }
      case recordTypes.FireAnimationFrame: {
        contentHelper.appendTextRow(i18nString(UIStrings.callbackId), eventData["id"]);
        break;
      }
      case recordTypes.ResourceWillSendRequest:
      case recordTypes.ResourceSendRequest:
      case recordTypes.ResourceReceiveResponse:
      case recordTypes.ResourceReceivedData:
      case recordTypes.ResourceFinish: {
        url = timelineData.url;
        if (url) {
          const options = {
            tabStop: true,
            showColumnNumber: false,
            inlineFrameIndex: 0
          };
          contentHelper.appendElementRow(i18nString(UIStrings.resource), Components.Linkifier.Linkifier.linkifyURL(url, options));
        }
        if (eventData["requestMethod"]) {
          contentHelper.appendTextRow(i18nString(UIStrings.requestMethod), eventData["requestMethod"]);
        }
        if (typeof eventData["statusCode"] === "number") {
          contentHelper.appendTextRow(i18nString(UIStrings.statusCode), eventData["statusCode"]);
        }
        if (eventData["mimeType"]) {
          contentHelper.appendTextRow(i18nString(UIStrings.mimeTypeCaps), eventData["mimeType"]);
        }
        if ("priority" in eventData) {
          const priority = PerfUI.NetworkPriorities.uiLabelForNetworkPriority(eventData["priority"]);
          contentHelper.appendTextRow(i18nString(UIStrings.priority), priority);
        }
        if (eventData["encodedDataLength"]) {
          contentHelper.appendTextRow(i18nString(UIStrings.encodedData), i18nString(UIStrings.sBytes, { n: eventData["encodedDataLength"] }));
        }
        if (eventData["decodedBodyLength"]) {
          contentHelper.appendTextRow(i18nString(UIStrings.decodedBody), i18nString(UIStrings.sBytes, { n: eventData["decodedBodyLength"] }));
        }
        break;
      }
      case recordTypes.CompileModule: {
        contentHelper.appendLocationRow(i18nString(UIStrings.module), event.args["fileName"], 0);
        break;
      }
      case recordTypes.CompileScript: {
        url = eventData && eventData["url"];
        if (url) {
          contentHelper.appendLocationRow(i18nString(UIStrings.script), url, eventData["lineNumber"], eventData["columnNumber"]);
        }
        const isEager = eventData["eager"] ?? false;
        if (isEager) {
          contentHelper.appendTextRow(i18nString(UIStrings.eagerCompile), true);
        }
        const isStreamed = eventData["streamed"];
        contentHelper.appendTextRow(i18nString(UIStrings.streamed), isStreamed + (isStreamed ? "" : `: ${eventData["notStreamedReason"]}`));
        TimelineUIUtils.buildConsumeCacheDetails(eventData, contentHelper);
        break;
      }
      case recordTypes.CacheModule: {
        url = eventData && eventData["url"];
        contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheSize), Platform.NumberUtilities.bytesToString(eventData["producedCacheSize"]));
        break;
      }
      case recordTypes.CacheScript: {
        url = eventData && eventData["url"];
        if (url) {
          contentHelper.appendLocationRow(i18nString(UIStrings.script), url, eventData["lineNumber"], eventData["columnNumber"]);
        }
        contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheSize), Platform.NumberUtilities.bytesToString(eventData["producedCacheSize"]));
        break;
      }
      case recordTypes.EvaluateScript: {
        url = eventData && eventData["url"];
        if (url) {
          contentHelper.appendLocationRow(i18nString(UIStrings.script), url, eventData["lineNumber"], eventData["columnNumber"]);
        }
        break;
      }
      case recordTypes.WasmStreamFromResponseCallback:
      case recordTypes.WasmCompiledModule:
      case recordTypes.WasmCachedModule:
      case recordTypes.WasmModuleCacheHit:
      case recordTypes.WasmModuleCacheInvalid: {
        if (eventData) {
          url = event.args["url"];
          if (url) {
            contentHelper.appendTextRow(i18nString(UIStrings.url), url);
          }
          const producedCachedSize = event.args["producedCachedSize"];
          if (producedCachedSize) {
            contentHelper.appendTextRow(i18nString(UIStrings.producedCacheSize), producedCachedSize);
          }
          const consumedCachedSize = event.args["consumedCachedSize"];
          if (consumedCachedSize) {
            contentHelper.appendTextRow(i18nString(UIStrings.consumedCacheSize), consumedCachedSize);
          }
        }
        break;
      }
      case recordTypes.Paint: {
        const clip = eventData["clip"];
        contentHelper.appendTextRow(i18nString(UIStrings.location), i18nString(UIStrings.sSCurlyBrackets, { PH1: clip[0], PH2: clip[1] }));
        const clipWidth = TimelineUIUtils.quadWidth(clip);
        const clipHeight = TimelineUIUtils.quadHeight(clip);
        contentHelper.appendTextRow(i18nString(UIStrings.dimensions), i18nString(UIStrings.sSDimensions, { PH1: clipWidth, PH2: clipHeight }));
      }
      case recordTypes.PaintSetup:
      case recordTypes.Rasterize:
      case recordTypes.ScrollLayer: {
        relatedNodeLabel = i18nString(UIStrings.layerRoot);
        break;
      }
      case recordTypes.PaintImage:
      case recordTypes.DecodeLazyPixelRef:
      case recordTypes.DecodeImage:
      case recordTypes.ResizeImage:
      case recordTypes.DrawLazyPixelRef: {
        relatedNodeLabel = i18nString(UIStrings.ownerElement);
        url = timelineData.url;
        if (url) {
          const options = {
            tabStop: true,
            showColumnNumber: false,
            inlineFrameIndex: 0
          };
          contentHelper.appendElementRow(i18nString(UIStrings.imageUrl), Components.Linkifier.Linkifier.linkifyURL(url, options));
        }
        break;
      }
      case recordTypes.ParseAuthorStyleSheet: {
        url = eventData["styleSheetUrl"];
        if (url) {
          const options = {
            tabStop: true,
            showColumnNumber: false,
            inlineFrameIndex: 0
          };
          contentHelper.appendElementRow(i18nString(UIStrings.stylesheetUrl), Components.Linkifier.Linkifier.linkifyURL(url, options));
        }
        break;
      }
      case recordTypes.UpdateLayoutTree:
      case recordTypes.RecalculateStyles: {
        contentHelper.appendTextRow(i18nString(UIStrings.elementsAffected), event.args["elementCount"]);
        break;
      }
      case recordTypes.Layout: {
        const beginData = event.args["beginData"];
        contentHelper.appendTextRow(i18nString(UIStrings.nodesThatNeedLayout), i18nString(UIStrings.sOfS, { PH1: beginData["dirtyObjects"], PH2: beginData["totalObjects"] }));
        relatedNodeLabel = i18nString(UIStrings.layoutRoot);
        break;
      }
      case recordTypes.ConsoleTime: {
        contentHelper.appendTextRow(i18nString(UIStrings.message), event.name);
        break;
      }
      case recordTypes.WebSocketCreate:
      case recordTypes.WebSocketSendHandshakeRequest:
      case recordTypes.WebSocketReceiveHandshakeResponse:
      case recordTypes.WebSocketDestroy: {
        const initiatorData = initiator ? initiator.args["data"] : eventData;
        if (typeof initiatorData["webSocketURL"] !== "undefined") {
          contentHelper.appendTextRow(i18n.i18n.lockedString("URL"), initiatorData["webSocketURL"]);
        }
        if (typeof initiatorData["webSocketProtocol"] !== "undefined") {
          contentHelper.appendTextRow(i18nString(UIStrings.websocketProtocol), initiatorData["webSocketProtocol"]);
        }
        if (typeof eventData["message"] !== "undefined") {
          contentHelper.appendTextRow(i18nString(UIStrings.message), eventData["message"]);
        }
        break;
      }
      case recordTypes.EmbedderCallback: {
        contentHelper.appendTextRow(i18nString(UIStrings.callbackFunction), eventData["callbackName"]);
        break;
      }
      case recordTypes.Animation: {
        if (event.phase === SDK.TracingModel.Phase.NestableAsyncInstant) {
          contentHelper.appendTextRow(i18nString(UIStrings.state), eventData["state"]);
        }
        break;
      }
      case recordTypes.ParseHTML: {
        const beginData = event.args["beginData"];
        const startLine = beginData["startLine"] - 1;
        const endLine = event.args["endData"] ? event.args["endData"]["endLine"] - 1 : void 0;
        url = beginData["url"];
        if (url) {
          contentHelper.appendLocationRange(i18nString(UIStrings.range), url, startLine, endLine);
        }
        break;
      }
      case recordTypes.FireIdleCallback: {
        contentHelper.appendTextRow(i18nString(UIStrings.allottedTime), i18n.TimeUtilities.millisToString(eventData["allottedMilliseconds"]));
        contentHelper.appendTextRow(i18nString(UIStrings.invokedByTimeout), eventData["timedOut"]);
      }
      case recordTypes.RequestIdleCallback:
      case recordTypes.CancelIdleCallback: {
        contentHelper.appendTextRow(i18nString(UIStrings.callbackId), eventData["id"]);
        break;
      }
      case recordTypes.EventDispatch: {
        contentHelper.appendTextRow(i18nString(UIStrings.type), eventData["type"]);
        break;
      }
      case recordTypes.MarkLCPCandidate: {
        contentHelper.appendTextRow(i18nString(UIStrings.type), String(eventData["type"]));
        contentHelper.appendTextRow(i18nString(UIStrings.size), String(eventData["size"]));
      }
      case recordTypes.MarkFirstPaint:
      case recordTypes.MarkFCP:
      case recordTypes.MarkLoad:
      case recordTypes.MarkDOMContent: {
        let eventTime = event.startTime - model.minimumRecordTime();
        const { navigationId } = event.args.data;
        if (navigationId) {
          const navStartTime = model.navStartTimes().get(navigationId);
          if (navStartTime) {
            eventTime = event.startTime - navStartTime.startTime;
          }
        }
        contentHelper.appendTextRow(i18nString(UIStrings.timestamp), i18n.TimeUtilities.preciseMillisToString(eventTime, 1));
        contentHelper.appendElementRow(i18nString(UIStrings.details), TimelineUIUtils.buildDetailsNodeForPerformanceEvent(event));
        break;
      }
      case recordTypes.LayoutShift: {
        const warning = document.createElement("span");
        const clsLink = UI.XLink.XLink.create("https://web.dev/cls/", i18nString(UIStrings.cumulativeLayoutShifts));
        const evolvedClsLink = UI.XLink.XLink.create("https://web.dev/evolving-cls/", i18nString(UIStrings.evolvedClsLink));
        warning.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.sCLSInformation, { PH1: clsLink, PH2: evolvedClsLink }));
        contentHelper.appendElementRow(i18nString(UIStrings.warning), warning, true);
        contentHelper.appendTextRow(i18nString(UIStrings.score), eventData["score"].toPrecision(4));
        contentHelper.appendTextRow(i18nString(UIStrings.cumulativeScore), eventData["cumulative_score"].toPrecision(4));
        if ("_current_cluster_id" in eventData) {
          contentHelper.appendTextRow(i18nString(UIStrings.currentClusterId), eventData["_current_cluster_id"]);
        }
        if ("_current_cluster_score" in eventData) {
          contentHelper.appendTextRow(i18nString(UIStrings.currentClusterScore), eventData["_current_cluster_score"].toPrecision(4));
        }
        contentHelper.appendTextRow(i18nString(UIStrings.hadRecentInput), eventData["had_recent_input"] ? i18nString(UIStrings.yes) : i18nString(UIStrings.no));
        for (const impactedNode of eventData["impacted_nodes"]) {
          const oldRect = new CLSRect(impactedNode["old_rect"]);
          const newRect = new CLSRect(impactedNode["new_rect"]);
          const linkedOldRect = await Common.Linkifier.Linkifier.linkify(oldRect);
          const linkedNewRect = await Common.Linkifier.Linkifier.linkify(newRect);
          contentHelper.appendElementRow(i18nString(UIStrings.movedFrom), linkedOldRect);
          contentHelper.appendElementRow(i18nString(UIStrings.movedTo), linkedNewRect);
        }
        break;
      }
      default: {
        const detailsNode = await TimelineUIUtils.buildDetailsNodeForTraceEvent(event, model.targetByEvent(event), linkifier);
        if (detailsNode) {
          contentHelper.appendElementRow(i18nString(UIStrings.details), detailsNode);
        }
        break;
      }
    }
    if (timelineData.timeWaitingForMainThread) {
      contentHelper.appendTextRow(i18nString(UIStrings.timeWaitingForMainThread), i18n.TimeUtilities.millisToString(timelineData.timeWaitingForMainThread, true));
    }
    for (let i = 0; i < timelineData.backendNodeIds.length; ++i) {
      const relatedNode = relatedNodesMap && relatedNodesMap.get(timelineData.backendNodeIds[i]);
      if (relatedNode) {
        const nodeSpan = await Common.Linkifier.Linkifier.linkify(relatedNode);
        contentHelper.appendElementRow(relatedNodeLabel || i18nString(UIStrings.relatedNode), nodeSpan);
      }
    }
    if (event[previewElementSymbol]) {
      contentHelper.addSection(i18nString(UIStrings.preview));
      contentHelper.appendElementRow("", event[previewElementSymbol]);
    }
    if (initiator || timelineData.stackTraceForSelfOrInitiator() || TimelineModel.TimelineModel.InvalidationTracker.invalidationEventsFor(event)) {
      TimelineUIUtils.generateCauses(event, model.targetByEvent(event), relatedNodesMap, contentHelper);
    }
    const stats = {};
    const showPieChart = detailed && TimelineUIUtils.aggregatedStatsForTraceEvent(stats, model, event);
    if (showPieChart) {
      contentHelper.addSection(i18nString(UIStrings.aggregatedTime));
      const pieChart = TimelineUIUtils.generatePieChart(stats, TimelineUIUtils.eventStyle(event).category, event.selfTime);
      contentHelper.appendElementRow("", pieChart);
    }
    return contentHelper.fragment;
  }
  static statsForTimeRange(events, startTime, endTime) {
    if (!events.length) {
      return { "idle": endTime - startTime };
    }
    buildRangeStatsCacheIfNeeded(events);
    const aggregatedStats = subtractStats(aggregatedStatsAtTime(endTime), aggregatedStatsAtTime(startTime));
    const aggregatedTotal = Object.values(aggregatedStats).reduce((a, b) => a + b, 0);
    aggregatedStats["idle"] = Math.max(0, endTime - startTime - aggregatedTotal);
    return aggregatedStats;
    function aggregatedStatsAtTime(time) {
      const stats = {};
      const cache = events[categoryBreakdownCacheSymbol];
      for (const category in cache) {
        const categoryCache = cache[category];
        const index = Platform.ArrayUtilities.upperBound(categoryCache.time, time, Platform.ArrayUtilities.DEFAULT_COMPARATOR);
        let value;
        if (index === 0) {
          value = 0;
        } else if (index === categoryCache.time.length) {
          value = categoryCache.value[categoryCache.value.length - 1];
        } else {
          const t0 = categoryCache.time[index - 1];
          const t1 = categoryCache.time[index];
          const v0 = categoryCache.value[index - 1];
          const v1 = categoryCache.value[index];
          value = v0 + (v1 - v0) * (time - t0) / (t1 - t0);
        }
        stats[category] = value;
      }
      return stats;
    }
    function subtractStats(a, b) {
      const result = Object.assign({}, a);
      for (const key in b) {
        result[key] -= b[key];
      }
      return result;
    }
    function buildRangeStatsCacheIfNeeded(events2) {
      if (events2[categoryBreakdownCacheSymbol]) {
        return;
      }
      const aggregatedStats2 = {};
      const categoryStack = [];
      let lastTime = 0;
      TimelineModel.TimelineModel.TimelineModelImpl.forEachEvent(events2, onStartEvent, onEndEvent, void 0, void 0, void 0, filterForStats());
      function filterForStats() {
        const visibleEventsFilter = TimelineUIUtils.visibleEventsFilter();
        return (event) => visibleEventsFilter.accept(event) || SDK.TracingModel.TracingModel.isTopLevelEvent(event);
      }
      function updateCategory(category, time) {
        let statsArrays = aggregatedStats2[category];
        if (!statsArrays) {
          statsArrays = { time: [], value: [] };
          aggregatedStats2[category] = statsArrays;
        }
        if (statsArrays.time.length && statsArrays.time[statsArrays.time.length - 1] === time || lastTime > time) {
          return;
        }
        const lastValue = statsArrays.value.length > 0 ? statsArrays.value[statsArrays.value.length - 1] : 0;
        statsArrays.value.push(lastValue + time - lastTime);
        statsArrays.time.push(time);
      }
      function categoryChange(from, to, time) {
        if (from) {
          updateCategory(from, time);
        }
        lastTime = time;
        if (to) {
          updateCategory(to, time);
        }
      }
      function onStartEvent(e) {
        const category = TimelineUIUtils.eventStyle(e).category.name;
        const parentCategory = categoryStack.length ? categoryStack[categoryStack.length - 1] : null;
        if (category !== parentCategory) {
          categoryChange(parentCategory || null, category, e.startTime);
        }
        categoryStack.push(category);
      }
      function onEndEvent(e) {
        const category = categoryStack.pop();
        const parentCategory = categoryStack.length ? categoryStack[categoryStack.length - 1] : null;
        if (category !== parentCategory) {
          categoryChange(category || null, parentCategory || null, e.endTime || 0);
        }
      }
      const obj = events2;
      obj[categoryBreakdownCacheSymbol] = aggregatedStats2;
    }
  }
  static async buildNetworkRequestDetails(request, model, linkifier) {
    const target = model.targetByEvent(request.children[0]);
    const contentHelper = new TimelineDetailsContentHelper(target, linkifier);
    const category = TimelineUIUtils.networkRequestCategory(request);
    const color = TimelineUIUtils.networkCategoryColor(category);
    contentHelper.addSection(i18nString(UIStrings.networkRequest), color);
    if (request.url) {
      const options = {
        tabStop: true,
        showColumnNumber: false,
        inlineFrameIndex: 0
      };
      contentHelper.appendElementRow(i18n.i18n.lockedString("URL"), Components.Linkifier.Linkifier.linkifyURL(request.url, options));
    }
    const fullDuration = request.endTime - (request.getStartTime() || -Infinity);
    if (isFinite(fullDuration)) {
      let textRow = i18n.TimeUtilities.millisToString(fullDuration, true);
      const networkDuration = (request.finishTime || request.getStartTime()) - request.getStartTime();
      const processingDuration = request.endTime - (request.finishTime || 0);
      if (isFinite(networkDuration) && isFinite(processingDuration)) {
        const networkDurationStr = i18n.TimeUtilities.millisToString(networkDuration, true);
        const processingDurationStr = i18n.TimeUtilities.millisToString(processingDuration, true);
        const cacheOrNetworkLabel = request.cached() ? i18nString(UIStrings.loadFromCache) : i18nString(UIStrings.networkTransfer);
        textRow += i18nString(UIStrings.SSSResourceLoading, { PH1: networkDurationStr, PH2: cacheOrNetworkLabel, PH3: processingDurationStr });
      }
      contentHelper.appendTextRow(i18nString(UIStrings.duration), textRow);
    }
    if (request.requestMethod) {
      contentHelper.appendTextRow(i18nString(UIStrings.requestMethod), request.requestMethod);
    }
    if (typeof request.priority === "string") {
      const priority = PerfUI.NetworkPriorities.uiLabelForNetworkPriority(request.priority);
      contentHelper.appendTextRow(i18nString(UIStrings.priority), priority);
    }
    if (request.mimeType) {
      contentHelper.appendTextRow(i18nString(UIStrings.mimeType), request.mimeType);
    }
    let lengthText = "";
    if (request.memoryCached()) {
      lengthText += i18nString(UIStrings.FromMemoryCache);
    } else if (request.cached()) {
      lengthText += i18nString(UIStrings.FromCache);
    } else if (request.timing && request.timing.pushStart) {
      lengthText += i18nString(UIStrings.FromPush);
    }
    if (request.fromServiceWorker) {
      lengthText += i18nString(UIStrings.FromServiceWorker);
    }
    if (request.encodedDataLength || !lengthText) {
      lengthText = `${Platform.NumberUtilities.bytesToString(request.encodedDataLength)}${lengthText}`;
    }
    contentHelper.appendTextRow(i18nString(UIStrings.encodedData), lengthText);
    if (request.decodedBodyLength) {
      contentHelper.appendTextRow(i18nString(UIStrings.decodedBody), Platform.NumberUtilities.bytesToString(request.decodedBodyLength));
    }
    const title = i18nString(UIStrings.initiator);
    const sendRequest = request.children[0];
    const topFrame = TimelineModel.TimelineModel.TimelineData.forEvent(sendRequest).topFrame();
    if (topFrame) {
      const link = linkifier.maybeLinkifyConsoleCallFrame(target, topFrame, { tabStop: true, inlineFrameIndex: 0, showColumnNumber: true });
      if (link) {
        contentHelper.appendElementRow(title, link);
      }
    } else {
      const initiator = TimelineModel.TimelineModel.TimelineData.forEvent(sendRequest).initiator();
      if (initiator) {
        const initiatorURL = TimelineModel.TimelineModel.TimelineData.forEvent(initiator).url;
        if (initiatorURL) {
          const link = linkifier.maybeLinkifyScriptLocation(target, null, initiatorURL, 0, { tabStop: true, inlineFrameIndex: 0 });
          if (link) {
            contentHelper.appendElementRow(title, link);
          }
        }
      }
    }
    if (!requestPreviewElements.get(request) && request.url && target) {
      const previewElement = await Components.ImagePreview.ImagePreview.build(target, request.url, false, {
        imageAltText: Components.ImagePreview.ImagePreview.defaultAltTextForImageURL(request.url),
        precomputedFeatures: void 0
      });
      requestPreviewElements.set(request, previewElement);
    }
    const requestPreviewElement = requestPreviewElements.get(request);
    if (requestPreviewElement) {
      contentHelper.appendElementRow(i18nString(UIStrings.preview), requestPreviewElement);
    }
    return contentHelper.fragment;
  }
  static stackTraceFromCallFrames(callFrames) {
    return { callFrames };
  }
  static generateCauses(event, target, relatedNodesMap, contentHelper) {
    const recordTypes = TimelineModel.TimelineModel.RecordType;
    let callSiteStackLabel;
    let stackLabel;
    switch (event.name) {
      case recordTypes.TimerFire:
        callSiteStackLabel = i18nString(UIStrings.timerInstalled);
        break;
      case recordTypes.FireAnimationFrame:
        callSiteStackLabel = i18nString(UIStrings.animationFrameRequested);
        break;
      case recordTypes.FireIdleCallback:
        callSiteStackLabel = i18nString(UIStrings.idleCallbackRequested);
        break;
      case recordTypes.UpdateLayoutTree:
      case recordTypes.RecalculateStyles:
        stackLabel = i18nString(UIStrings.recalculationForced);
        break;
      case recordTypes.Layout:
        callSiteStackLabel = i18nString(UIStrings.firstLayoutInvalidation);
        stackLabel = i18nString(UIStrings.layoutForced);
        break;
    }
    const timelineData = TimelineModel.TimelineModel.TimelineData.forEvent(event);
    if (timelineData.stackTrace && timelineData.stackTrace.length) {
      contentHelper.addSection(i18nString(UIStrings.callStacks));
      contentHelper.appendStackTrace(stackLabel || i18nString(UIStrings.stackTrace), TimelineUIUtils.stackTraceFromCallFrames(timelineData.stackTrace));
    }
    const initiator = TimelineModel.TimelineModel.TimelineData.forEvent(event).initiator();
    if (TimelineModel.TimelineModel.InvalidationTracker.invalidationEventsFor(event) && target) {
      contentHelper.addSection(i18nString(UIStrings.invalidations));
      TimelineUIUtils.generateInvalidations(event, target, relatedNodesMap, contentHelper);
    } else if (initiator) {
      const delay = event.startTime - initiator.startTime;
      contentHelper.appendTextRow(i18nString(UIStrings.pendingFor), i18n.TimeUtilities.preciseMillisToString(delay, 1));
      const link = document.createElement("span");
      link.classList.add("devtools-link");
      UI.ARIAUtils.markAsLink(link);
      link.tabIndex = 0;
      link.textContent = i18nString(UIStrings.reveal);
      link.addEventListener("click", () => {
        TimelinePanel.instance().select(TimelineSelection.fromTraceEvent(initiator));
      });
      link.addEventListener("keydown", (event2) => {
        if (event2.key === "Enter") {
          TimelinePanel.instance().select(TimelineSelection.fromTraceEvent(initiator));
          event2.consume(true);
        }
      });
      contentHelper.appendElementRow(i18nString(UIStrings.initiator), link);
      const initiatorStackTrace = TimelineModel.TimelineModel.TimelineData.forEvent(initiator).stackTrace;
      if (initiatorStackTrace) {
        contentHelper.appendStackTrace(callSiteStackLabel || i18nString(UIStrings.firstInvalidated), TimelineUIUtils.stackTraceFromCallFrames(initiatorStackTrace));
      }
    }
  }
  static generateInvalidations(event, target, relatedNodesMap, contentHelper) {
    const invalidationTrackingEvents = TimelineModel.TimelineModel.InvalidationTracker.invalidationEventsFor(event);
    if (!invalidationTrackingEvents) {
      return;
    }
    const invalidations = {};
    for (const invalidation of invalidationTrackingEvents) {
      if (!invalidations[invalidation.type]) {
        invalidations[invalidation.type] = [];
      }
      invalidations[invalidation.type].push(invalidation);
    }
    Object.keys(invalidations).forEach(function(type) {
      TimelineUIUtils.generateInvalidationsForType(type, target, invalidations[type], relatedNodesMap, contentHelper);
    });
  }
  static generateInvalidationsForType(type, target, invalidations, relatedNodesMap, contentHelper) {
    let title;
    switch (type) {
      case TimelineModel.TimelineModel.RecordType.StyleRecalcInvalidationTracking:
        title = i18nString(UIStrings.styleInvalidations);
        break;
      case TimelineModel.TimelineModel.RecordType.LayoutInvalidationTracking:
        title = i18nString(UIStrings.layoutInvalidations);
        break;
      default:
        title = i18nString(UIStrings.otherInvalidations);
        break;
    }
    const invalidationsTreeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    invalidationsTreeOutline.registerCSSFiles([invalidationsTreeStyles]);
    invalidationsTreeOutline.element.classList.add("invalidations-tree");
    const invalidationGroups = groupInvalidationsByCause(invalidations);
    invalidationGroups.forEach(function(group) {
      const groupElement = new InvalidationsGroupElement(target, relatedNodesMap, contentHelper, group);
      invalidationsTreeOutline.appendChild(groupElement);
    });
    contentHelper.appendElementRow(title, invalidationsTreeOutline.element, false, true);
    function groupInvalidationsByCause(invalidations2) {
      const causeToInvalidationMap = /* @__PURE__ */ new Map();
      for (let index = 0; index < invalidations2.length; index++) {
        const invalidation = invalidations2[index];
        let causeKey = "";
        if (invalidation.cause.reason) {
          causeKey += invalidation.cause.reason + ".";
        }
        if (invalidation.cause.stackTrace) {
          invalidation.cause.stackTrace.forEach(function(stackFrame) {
            causeKey += stackFrame["functionName"] + ".";
            causeKey += stackFrame["scriptId"] + ".";
            causeKey += stackFrame["url"] + ".";
            causeKey += stackFrame["lineNumber"] + ".";
            causeKey += stackFrame["columnNumber"] + ".";
          });
        }
        const causeToInvalidation = causeToInvalidationMap.get(causeKey);
        if (causeToInvalidation) {
          causeToInvalidation.push(invalidation);
        } else {
          causeToInvalidationMap.set(causeKey, [invalidation]);
        }
      }
      return [...causeToInvalidationMap.values()];
    }
  }
  static collectInvalidationNodeIds(nodeIds, invalidations) {
    Platform.SetUtilities.addAll(nodeIds, invalidations.map((invalidation) => invalidation.nodeId).filter((id) => id));
  }
  static aggregatedStatsForTraceEvent(total, model, event) {
    const events = model.inspectedTargetEvents();
    function eventComparator(startTime, e) {
      return startTime - e.startTime;
    }
    const index = Platform.ArrayUtilities.binaryIndexOf(events, event.startTime, eventComparator);
    if (index < 0) {
      return false;
    }
    let hasChildren = false;
    const endTime = event.endTime;
    if (endTime) {
      for (let i = index; i < events.length; i++) {
        const nextEvent = events[i];
        if (nextEvent.startTime >= endTime) {
          break;
        }
        if (!nextEvent.selfTime) {
          continue;
        }
        if (nextEvent.thread !== event.thread) {
          continue;
        }
        if (i > index) {
          hasChildren = true;
        }
        const categoryName = TimelineUIUtils.eventStyle(nextEvent).category.name;
        total[categoryName] = (total[categoryName] || 0) + nextEvent.selfTime;
      }
    }
    if (SDK.TracingModel.TracingModel.isAsyncPhase(event.phase)) {
      if (event.endTime) {
        let aggregatedTotal = 0;
        for (const categoryName in total) {
          aggregatedTotal += total[categoryName];
        }
        total["idle"] = Math.max(0, event.endTime - event.startTime - aggregatedTotal);
      }
      return false;
    }
    return hasChildren;
  }
  static async buildPicturePreviewContent(event, target) {
    const snapshotWithRect = await new TimelineModel.TimelineFrameModel.LayerPaintEvent(event, target).snapshotPromise();
    if (!snapshotWithRect) {
      return null;
    }
    const imageURLPromise = snapshotWithRect.snapshot.replay();
    snapshotWithRect.snapshot.release();
    const imageURL = await imageURLPromise;
    if (!imageURL) {
      return null;
    }
    const stylesContainer = document.createElement("div");
    const shadowRoot = stylesContainer.attachShadow({ mode: "open" });
    shadowRoot.adoptedStyleSheets = [imagePreviewStyles];
    const container = shadowRoot.createChild("div");
    container.classList.add("image-preview-container", "vbox", "link");
    const img = container.createChild("img");
    img.src = imageURL;
    img.alt = Components.ImagePreview.ImagePreview.defaultAltTextForImageURL(imageURL);
    const paintProfilerButton = container.createChild("a");
    paintProfilerButton.textContent = i18nString(UIStrings.paintProfiler);
    UI.ARIAUtils.markAsLink(container);
    container.tabIndex = 0;
    container.addEventListener("click", () => TimelinePanel.instance().select(TimelineSelection.fromTraceEvent(event)), false);
    container.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key === "Enter") {
        TimelinePanel.instance().select(TimelineSelection.fromTraceEvent(event));
        keyEvent.consume(true);
      }
    });
    return stylesContainer;
  }
  static createEventDivider(event, zeroTime) {
    const eventDivider = document.createElement("div");
    eventDivider.classList.add("resources-event-divider");
    const startTime = i18n.TimeUtilities.millisToString(event.startTime - zeroTime);
    UI.Tooltip.Tooltip.install(eventDivider, i18nString(UIStrings.sAtS, { PH1: TimelineUIUtils.eventTitle(event), PH2: startTime }));
    const style = TimelineUIUtils.markerStyleForEvent(event);
    if (style.tall) {
      eventDivider.style.backgroundColor = style.color;
    }
    return eventDivider;
  }
  static visibleTypes() {
    const eventStyles = TimelineUIUtils.initEventStyles();
    const result = [];
    for (const name in eventStyles) {
      if (!eventStyles[name].hidden) {
        result.push(name);
      }
    }
    return result;
  }
  static visibleEventsFilter() {
    return new TimelineModel.TimelineModelFilter.TimelineVisibleEventsFilter(TimelineUIUtils.visibleTypes());
  }
  static categories() {
    if (categories) {
      return categories;
    }
    categories = {
      loading: new TimelineCategory("loading", i18nString(UIStrings.loading), true, "hsl(214, 67%, 74%)", "hsl(214, 67%, 66%)"),
      experience: new TimelineCategory("experience", i18nString(UIStrings.experience), false, "hsl(5, 80%, 74%)", "hsl(5, 80%, 66%)"),
      scripting: new TimelineCategory("scripting", i18nString(UIStrings.scripting), true, "hsl(43, 83%, 72%)", "hsl(43, 83%, 64%) "),
      rendering: new TimelineCategory("rendering", i18nString(UIStrings.rendering), true, "hsl(256, 67%, 76%)", "hsl(256, 67%, 70%)"),
      painting: new TimelineCategory("painting", i18nString(UIStrings.painting), true, "hsl(109, 33%, 64%)", "hsl(109, 33%, 55%)"),
      gpu: new TimelineCategory("gpu", i18nString(UIStrings.gpu), false, "hsl(109, 33%, 64%)", "hsl(109, 33%, 55%)"),
      async: new TimelineCategory("async", i18nString(UIStrings.async), false, "hsl(0, 100%, 50%)", "hsl(0, 100%, 40%)"),
      other: new TimelineCategory("other", i18nString(UIStrings.system), false, "hsl(0, 0%, 87%)", "hsl(0, 0%, 79%)"),
      idle: new TimelineCategory("idle", i18nString(UIStrings.idle), false, "hsl(0, 0%, 98%)", "hsl(0, 0%, 98%)")
    };
    return categories;
  }
  static setCategories(cats) {
    categories = cats;
  }
  static getTimelineMainEventCategories() {
    if (eventCategories) {
      return eventCategories;
    }
    eventCategories = ["idle", "loading", "painting", "rendering", "scripting", "other"];
    return eventCategories;
  }
  static setTimelineMainEventCategories(categories2) {
    eventCategories = categories2;
  }
  static generatePieChart(aggregatedStats, selfCategory, selfTime) {
    let total = 0;
    for (const categoryName in aggregatedStats) {
      total += aggregatedStats[categoryName];
    }
    const element = document.createElement("div");
    element.classList.add("timeline-details-view-pie-chart-wrapper");
    element.classList.add("hbox");
    const pieChart = new PerfUI.PieChart.PieChart();
    const slices = [];
    function appendLegendRow(name, title, value, color) {
      if (!value) {
        return;
      }
      slices.push({ value, color, title });
    }
    if (selfCategory) {
      if (selfTime) {
        appendLegendRow(selfCategory.name, i18nString(UIStrings.sSelf, { PH1: selfCategory.title }), selfTime, selfCategory.color);
      }
      const categoryTime = aggregatedStats[selfCategory.name];
      const value = categoryTime - (selfTime || 0);
      if (value > 0) {
        appendLegendRow(selfCategory.name, i18nString(UIStrings.sChildren, { PH1: selfCategory.title }), value, selfCategory.childColor);
      }
    }
    for (const categoryName in TimelineUIUtils.categories()) {
      const category = TimelineUIUtils.categories()[categoryName];
      if (category === selfCategory) {
        continue;
      }
      appendLegendRow(category.name, category.title, aggregatedStats[category.name], category.childColor);
    }
    pieChart.data = {
      chartName: i18nString(UIStrings.timeSpentInRendering),
      size: 110,
      formatter: (value) => i18n.TimeUtilities.preciseMillisToString(value),
      showLegend: true,
      total,
      slices
    };
    const pieChartContainer = element.createChild("div", "vbox");
    pieChartContainer.appendChild(pieChart);
    return element;
  }
  static generateDetailsContentForFrame(frame, filmStripFrame) {
    const contentHelper = new TimelineDetailsContentHelper(null, null);
    contentHelper.addSection(i18nString(UIStrings.frame));
    const duration = TimelineUIUtils.frameDuration(frame);
    contentHelper.appendElementRow(i18nString(UIStrings.duration), duration, frame.hasWarnings());
    contentHelper.appendTextRow(i18nString(UIStrings.cpuTime), i18n.TimeUtilities.millisToString(frame.cpuTime, true));
    if (filmStripFrame) {
      const filmStripPreview = document.createElement("div");
      filmStripPreview.classList.add("timeline-filmstrip-preview");
      void filmStripFrame.imageDataPromise().then((data) => UI.UIUtils.loadImageFromData(data)).then((image) => image && filmStripPreview.appendChild(image));
      contentHelper.appendElementRow("", filmStripPreview);
      filmStripPreview.addEventListener("click", frameClicked.bind(null, filmStripFrame), false);
    }
    if (frame.layerTree) {
      contentHelper.appendElementRow(i18nString(UIStrings.layerTree), Components.Linkifier.Linkifier.linkifyRevealable(frame.layerTree, i18nString(UIStrings.show)));
    }
    function frameClicked(filmStripFrame2) {
      new PerfUI.FilmStripView.Dialog(filmStripFrame2, 0);
    }
    return contentHelper.fragment;
  }
  static frameDuration(frame) {
    const durationText = i18nString(UIStrings.sAtSParentheses, {
      PH1: i18n.TimeUtilities.millisToString(frame.endTime - frame.startTime, true),
      PH2: i18n.TimeUtilities.millisToString(frame.startTimeOffset, true)
    });
    if (!frame.hasWarnings()) {
      return i18n.i18n.getFormatLocalizedString(str_, UIStrings.emptyPlaceholder, { PH1: durationText });
    }
    const link = UI.XLink.XLink.create("https://developers.google.com/web/fundamentals/performance/rendering/", i18nString(UIStrings.jank));
    return i18n.i18n.getFormatLocalizedString(str_, UIStrings.sLongFrameTimesAreAnIndicationOf, { PH1: durationText, PH2: link });
  }
  static createFillStyle(context, width, height, color0, color1, color2) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, color0);
    gradient.addColorStop(0.25, color1);
    gradient.addColorStop(0.75, color1);
    gradient.addColorStop(1, color2);
    return gradient;
  }
  static quadWidth(quad) {
    return Math.round(Math.sqrt(Math.pow(quad[0] - quad[2], 2) + Math.pow(quad[1] - quad[3], 2)));
  }
  static quadHeight(quad) {
    return Math.round(Math.sqrt(Math.pow(quad[0] - quad[6], 2) + Math.pow(quad[1] - quad[7], 2)));
  }
  static eventDispatchDesciptors() {
    if (eventDispatchDesciptors) {
      return eventDispatchDesciptors;
    }
    const lightOrange = "hsl(40,100%,80%)";
    const orange = "hsl(40,100%,50%)";
    const green = "hsl(90,100%,40%)";
    const purple = "hsl(256,100%,75%)";
    eventDispatchDesciptors = [
      new EventDispatchTypeDescriptor(1, lightOrange, ["mousemove", "mouseenter", "mouseleave", "mouseout", "mouseover"]),
      new EventDispatchTypeDescriptor(1, lightOrange, ["pointerover", "pointerout", "pointerenter", "pointerleave", "pointermove"]),
      new EventDispatchTypeDescriptor(2, green, ["wheel"]),
      new EventDispatchTypeDescriptor(3, orange, ["click", "mousedown", "mouseup"]),
      new EventDispatchTypeDescriptor(3, orange, ["touchstart", "touchend", "touchmove", "touchcancel"]),
      new EventDispatchTypeDescriptor(3, orange, ["pointerdown", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture"]),
      new EventDispatchTypeDescriptor(3, purple, ["keydown", "keyup", "keypress"])
    ];
    return eventDispatchDesciptors;
  }
  static markerShortTitle(event) {
    const recordTypes = TimelineModel.TimelineModel.RecordType;
    switch (event.name) {
      case recordTypes.MarkDOMContent:
        return i18n.i18n.lockedString("DCL");
      case recordTypes.MarkLoad:
        return i18n.i18n.lockedString("L");
      case recordTypes.MarkFirstPaint:
        return i18n.i18n.lockedString("FP");
      case recordTypes.MarkFCP:
        return i18n.i18n.lockedString("FCP");
      case recordTypes.MarkLCPCandidate:
        return i18n.i18n.lockedString("LCP");
    }
    return null;
  }
  static markerStyleForEvent(event) {
    const tallMarkerDashStyle = [6, 4];
    const title = TimelineUIUtils.eventTitle(event);
    const recordTypes = TimelineModel.TimelineModel.RecordType;
    if (event.name !== recordTypes.NavigationStart && (event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.Console) || event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming))) {
      return {
        title,
        dashStyle: tallMarkerDashStyle,
        lineWidth: 0.5,
        color: event.hasCategory(TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming) ? "purple" : "orange",
        tall: false,
        lowPriority: false
      };
    }
    let tall = false;
    let color = "grey";
    switch (event.name) {
      case recordTypes.NavigationStart:
        color = "#FF9800";
        tall = true;
        break;
      case recordTypes.FrameStartedLoading:
        color = "green";
        tall = true;
        break;
      case recordTypes.MarkDOMContent:
        color = "#0867CB";
        tall = true;
        break;
      case recordTypes.MarkLoad:
        color = "#B31412";
        tall = true;
        break;
      case recordTypes.MarkFirstPaint:
        color = "#228847";
        tall = true;
        break;
      case recordTypes.MarkFCP:
        color = "#1A6937";
        tall = true;
        break;
      case recordTypes.MarkLCPCandidate:
        color = "#1A3422";
        tall = true;
        break;
      case recordTypes.TimeStamp:
        color = "orange";
        break;
    }
    return {
      title,
      dashStyle: tallMarkerDashStyle,
      lineWidth: 0.5,
      color,
      tall,
      lowPriority: false
    };
  }
  static markerStyleForFrame() {
    return {
      title: i18nString(UIStrings.frame),
      color: "rgba(100, 100, 100, 0.4)",
      lineWidth: 3,
      dashStyle: [3],
      tall: true,
      lowPriority: true
    };
  }
  static colorForId(id) {
    if (!colorGenerator) {
      colorGenerator = new Common.Color.Generator({ min: 30, max: 330, count: void 0 }, { min: 50, max: 80, count: 3 }, 85);
      colorGenerator.setColorForID("", "#f2ecdc");
    }
    return colorGenerator.colorForID(id);
  }
  static eventWarning(event, warningType) {
    const timelineData = TimelineModel.TimelineModel.TimelineData.forEvent(event);
    const warning = warningType || timelineData.warning;
    if (!warning) {
      return null;
    }
    const warnings = TimelineModel.TimelineModel.TimelineModelImpl.WarningType;
    const span = document.createElement("span");
    const eventData = event.args["data"];
    switch (warning) {
      case warnings.ForcedStyle:
      case warnings.ForcedLayout: {
        const forcedReflowLink = UI.XLink.XLink.create("https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing#avoid-forced-synchronous-layouts", i18nString(UIStrings.forcedReflow));
        span.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.sIsALikelyPerformanceBottleneck, { PH1: forcedReflowLink }));
        break;
      }
      case warnings.IdleDeadlineExceeded: {
        const exceededMs = i18n.TimeUtilities.millisToString((event.duration || 0) - eventData["allottedMilliseconds"], true);
        span.textContent = i18nString(UIStrings.idleCallbackExecutionExtended, { PH1: exceededMs });
        break;
      }
      case warnings.LongHandler: {
        span.textContent = i18nString(UIStrings.handlerTookS, { PH1: i18n.TimeUtilities.millisToString(event.duration || 0, true) });
        break;
      }
      case warnings.LongRecurringHandler: {
        span.textContent = i18nString(UIStrings.recurringHandlerTookS, { PH1: i18n.TimeUtilities.millisToString(event.duration || 0, true) });
        break;
      }
      case warnings.LongTask: {
        const longTaskLink = UI.XLink.XLink.create("https://web.dev/rail/#goals-and-guidelines", i18nString(UIStrings.longTask));
        span.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.sTookS, { PH1: longTaskLink, PH2: i18n.TimeUtilities.millisToString(event.duration || 0, true) }));
        break;
      }
      case warnings.V8Deopt: {
        span.appendChild(UI.XLink.XLink.create("https://github.com/GoogleChrome/devtools-docs/issues/53", i18nString(UIStrings.notOptimized)));
        UI.UIUtils.createTextChild(span, i18nString(UIStrings.emptyPlaceholderColon, { PH1: eventData["deoptReason"] }));
        break;
      }
      default: {
        console.assert(false, "Unhandled TimelineModel.WarningType");
      }
    }
    return span;
  }
  static displayNameForFrame(frame, trimAt) {
    const url = frame.url;
    if (!trimAt) {
      trimAt = 30;
    }
    return url.startsWith("about:") ? `"${Platform.StringUtilities.trimMiddle(frame.name, trimAt)}"` : frame.url.trimEnd(trimAt);
  }
}
export class TimelineRecordStyle {
  title;
  category;
  hidden;
  constructor(title, category, hidden = false) {
    this.title = title;
    this.category = category;
    this.hidden = hidden;
  }
}
export var NetworkCategory = /* @__PURE__ */ ((NetworkCategory2) => {
  NetworkCategory2["HTML"] = "HTML";
  NetworkCategory2["Script"] = "Script";
  NetworkCategory2["Style"] = "Style";
  NetworkCategory2["Media"] = "Media";
  NetworkCategory2["Other"] = "Other";
  return NetworkCategory2;
})(NetworkCategory || {});
export const aggregatedStatsKey = Symbol("aggregatedStats");
export class InvalidationsGroupElement extends UI.TreeOutline.TreeElement {
  toggleOnClick;
  relatedNodesMap;
  contentHelper;
  invalidations;
  constructor(target, relatedNodesMap, contentHelper, invalidations) {
    super("", true);
    this.listItemElement.classList.add("header");
    this.selectable = false;
    this.toggleOnClick = true;
    this.relatedNodesMap = relatedNodesMap;
    this.contentHelper = contentHelper;
    this.invalidations = invalidations;
    this.title = this.createTitle(target);
  }
  createTitle(target) {
    const first = this.invalidations[0];
    const reason = first.cause.reason || i18nString(UIStrings.unknownCause);
    const topFrame = first.cause.stackTrace && first.cause.stackTrace[0];
    const truncatedNodesElement = this.getTruncatedNodesElement(this.invalidations);
    if (truncatedNodesElement === null) {
      return i18n.i18n.getFormatLocalizedString(str_, UIStrings.emptyPlaceholder, { PH1: reason });
    }
    const title = i18n.i18n.getFormatLocalizedString(str_, UIStrings.sForS, { PH1: reason, PH2: truncatedNodesElement });
    if (topFrame && this.contentHelper.linkifier()) {
      const stack = document.createElement("span");
      stack.classList.add("monospace");
      const completeTitle = i18n.i18n.getFormatLocalizedString(str_, UIStrings.sSDot, { PH1: title, PH2: stack });
      stack.createChild("span").textContent = TimelineUIUtils.frameDisplayName(topFrame);
      const linkifier = this.contentHelper.linkifier();
      if (linkifier) {
        const link = linkifier.maybeLinkifyConsoleCallFrame(target, topFrame, { showColumnNumber: true, inlineFrameIndex: 0 });
        if (link) {
          if (!link.textContent || link.textContent === "\u200B") {
            link.textContent = i18nString(UIStrings.unknown);
          }
          stack.createChild("span").textContent = " @ ";
          stack.createChild("span").appendChild(link);
        }
      }
      return completeTitle;
    }
    return title;
  }
  async onpopulate() {
    const content = document.createElement("div");
    content.classList.add("content");
    const first = this.invalidations[0];
    if (first.cause.stackTrace) {
      const stack = content.createChild("div");
      UI.UIUtils.createTextChild(stack, i18nString(UIStrings.stackTraceColon));
      this.contentHelper.createChildStackTraceElement(stack, TimelineUIUtils.stackTraceFromCallFrames(first.cause.stackTrace));
    }
    UI.UIUtils.createTextChild(content, this.invalidations.length !== 1 ? i18nString(UIStrings.nodes) : i18nString(UIStrings.node));
    const nodeList = content.createChild("div", "node-list");
    let firstNode = true;
    for (let i = 0; i < this.invalidations.length; i++) {
      const invalidation = this.invalidations[i];
      const invalidationNode = this.createInvalidationNode(invalidation, true);
      if (invalidationNode) {
        if (!firstNode) {
          UI.UIUtils.createTextChild(nodeList, ", ");
        }
        firstNode = false;
        nodeList.appendChild(invalidationNode);
        const extraData = invalidation.extraData ? ", " + invalidation.extraData : "";
        if (invalidation.changedId) {
          UI.UIUtils.createTextChild(nodeList, i18nString(UIStrings.changedIdToSs, { PH1: invalidation.changedId, PH2: extraData }));
        } else if (invalidation.changedClass) {
          UI.UIUtils.createTextChild(nodeList, i18nString(UIStrings.changedClassToSs, { PH1: invalidation.changedClass, PH2: extraData }));
        } else if (invalidation.changedAttribute) {
          UI.UIUtils.createTextChild(nodeList, i18nString(UIStrings.changedAttributeToSs, { PH1: invalidation.changedAttribute, PH2: extraData }));
        } else if (invalidation.changedPseudo) {
          UI.UIUtils.createTextChild(nodeList, i18nString(UIStrings.changedPesudoToSs, { PH1: invalidation.changedPseudo, PH2: extraData }));
        } else if (invalidation.selectorPart) {
          UI.UIUtils.createTextChild(nodeList, i18nString(UIStrings.changedSs, { PH1: invalidation.selectorPart, extraData }));
        }
      }
    }
    const contentTreeElement = new UI.TreeOutline.TreeElement(content, false);
    contentTreeElement.selectable = false;
    this.appendChild(contentTreeElement);
  }
  getTruncatedNodesElement(invalidations) {
    const invalidationNodes = [];
    const invalidationNodeIdMap = {};
    for (let i = 0; i < invalidations.length; i++) {
      const invalidation = invalidations[i];
      const invalidationNode = this.createInvalidationNode(invalidation, false);
      invalidationNode.addEventListener("click", (evt) => evt.consume(), false);
      if (invalidationNode && invalidation.nodeId && !invalidationNodeIdMap[invalidation.nodeId]) {
        invalidationNodes.push(invalidationNode);
        invalidationNodeIdMap[invalidation.nodeId] = true;
      }
    }
    if (invalidationNodes.length === 1) {
      const node = invalidationNodes[0];
      if (node instanceof HTMLSpanElement) {
        return node;
      }
      return null;
    }
    if (invalidationNodes.length === 2) {
      return i18n.i18n.getFormatLocalizedString(str_, UIStrings.sAndS, { PH1: invalidationNodes[0], PH2: invalidationNodes[1] });
    }
    if (invalidationNodes.length === 3) {
      return i18n.i18n.getFormatLocalizedString(str_, UIStrings.sAndSOther, { PH1: invalidationNodes[0], PH2: invalidationNodes[1] });
    }
    if (invalidationNodes.length >= 4) {
      return i18n.i18n.getFormatLocalizedString(str_, UIStrings.sSAndSOthers, { PH1: invalidationNodes[0], PH2: invalidationNodes[1], PH3: String(invalidationNodes.length - 2) });
    }
    return null;
  }
  createInvalidationNode(invalidation, showUnknownNodes) {
    const node = invalidation.nodeId && this.relatedNodesMap ? this.relatedNodesMap.get(invalidation.nodeId) : null;
    if (node) {
      const nodeSpan = document.createElement("span");
      void Common.Linkifier.Linkifier.linkify(node).then((link) => nodeSpan.appendChild(link));
      return nodeSpan;
    }
    if (invalidation.nodeName) {
      const nodeSpan = document.createElement("span");
      nodeSpan.textContent = invalidation.nodeName;
      return nodeSpan;
    }
    if (showUnknownNodes) {
      const nodeSpan = document.createElement("span");
      return UI.UIUtils.createTextChild(nodeSpan, i18nString(UIStrings.UnknownNode));
    }
    throw new Error("Unable to create invalidation node");
  }
}
export const previewElementSymbol = Symbol("previewElement");
export class EventDispatchTypeDescriptor {
  priority;
  color;
  eventTypes;
  constructor(priority, color, eventTypes) {
    this.priority = priority;
    this.color = color;
    this.eventTypes = eventTypes;
  }
}
export class TimelineCategory {
  name;
  title;
  visible;
  childColor;
  color;
  hiddenInternal;
  constructor(name, title, visible, childColor, color) {
    this.name = name;
    this.title = title;
    this.visible = visible;
    this.childColor = childColor;
    this.color = color;
    this.hidden = false;
  }
  get hidden() {
    return Boolean(this.hiddenInternal);
  }
  set hidden(hidden) {
    this.hiddenInternal = hidden;
  }
}
export class TimelineDetailsContentHelper {
  fragment;
  linkifierInternal;
  target;
  element;
  tableElement;
  constructor(target, linkifier) {
    this.fragment = document.createDocumentFragment();
    this.linkifierInternal = linkifier;
    this.target = target;
    this.element = document.createElement("div");
    this.element.classList.add("timeline-details-view-block");
    this.tableElement = this.element.createChild("div", "vbox timeline-details-chip-body");
    this.fragment.appendChild(this.element);
  }
  addSection(title, swatchColor) {
    if (!this.tableElement.hasChildNodes()) {
      this.element.removeChildren();
    } else {
      this.element = document.createElement("div");
      this.element.classList.add("timeline-details-view-block");
      this.fragment.appendChild(this.element);
    }
    if (title) {
      const titleElement = this.element.createChild("div", "timeline-details-chip-title");
      if (swatchColor) {
        titleElement.createChild("div").style.backgroundColor = swatchColor;
      }
      UI.UIUtils.createTextChild(titleElement, title);
    }
    this.tableElement = this.element.createChild("div", "vbox timeline-details-chip-body");
    this.fragment.appendChild(this.element);
  }
  linkifier() {
    return this.linkifierInternal;
  }
  appendTextRow(title, value) {
    const rowElement = this.tableElement.createChild("div", "timeline-details-view-row");
    rowElement.createChild("div", "timeline-details-view-row-title").textContent = title;
    rowElement.createChild("div", "timeline-details-view-row-value").textContent = value.toString();
  }
  appendElementRow(title, content, isWarning, isStacked) {
    const rowElement = this.tableElement.createChild("div", "timeline-details-view-row");
    if (isWarning) {
      rowElement.classList.add("timeline-details-warning");
    }
    if (isStacked) {
      rowElement.classList.add("timeline-details-stack-values");
    }
    const titleElement = rowElement.createChild("div", "timeline-details-view-row-title");
    titleElement.textContent = title;
    const valueElement = rowElement.createChild("div", "timeline-details-view-row-value");
    if (content instanceof Node) {
      valueElement.appendChild(content);
    } else {
      UI.UIUtils.createTextChild(valueElement, content || "");
    }
  }
  appendLocationRow(title, url, startLine, startColumn) {
    if (!this.linkifierInternal || !this.target) {
      return;
    }
    const options = {
      tabStop: true,
      columnNumber: startColumn,
      showColumnNumber: true,
      inlineFrameIndex: 0
    };
    const link = this.linkifierInternal.maybeLinkifyScriptLocation(this.target, null, url, startLine, options);
    if (!link) {
      return;
    }
    this.appendElementRow(title, link);
  }
  appendLocationRange(title, url, startLine, endLine) {
    if (!this.linkifierInternal || !this.target) {
      return;
    }
    const locationContent = document.createElement("span");
    const link = this.linkifierInternal.maybeLinkifyScriptLocation(this.target, null, url, startLine, { tabStop: true, inlineFrameIndex: 0 });
    if (!link) {
      return;
    }
    locationContent.appendChild(link);
    UI.UIUtils.createTextChild(locationContent, Platform.StringUtilities.sprintf(" [%s\u2026%s]", startLine + 1, (endLine || 0) + 1 || ""));
    this.appendElementRow(title, locationContent);
  }
  appendStackTrace(title, stackTrace) {
    if (!this.linkifierInternal || !this.target) {
      return;
    }
    const rowElement = this.tableElement.createChild("div", "timeline-details-view-row");
    rowElement.createChild("div", "timeline-details-view-row-title").textContent = title;
    this.createChildStackTraceElement(rowElement, stackTrace);
  }
  createChildStackTraceElement(parentElement, stackTrace) {
    if (!this.linkifierInternal || !this.target) {
      return;
    }
    parentElement.classList.add("timeline-details-stack-values");
    const stackTraceElement = parentElement.createChild("div", "timeline-details-view-row-value timeline-details-view-row-stack-trace");
    const callFrameContents = Components.JSPresentationUtils.buildStackTracePreviewContents(this.target, this.linkifierInternal, { stackTrace, tabStops: true });
    stackTraceElement.appendChild(callFrameContents.element);
  }
  appendWarningRow(event, warningType) {
    const warning = TimelineUIUtils.eventWarning(event, warningType);
    if (warning) {
      this.appendElementRow(i18nString(UIStrings.warning), warning, true);
    }
  }
}
export const categoryBreakdownCacheSymbol = Symbol("categoryBreakdownCache");
export function assignLayoutShiftsToClusters(layoutShifts) {
  const gapTimeInMs = 1e3;
  const limitTimeInMs = 5e3;
  let firstTimestamp = Number.NEGATIVE_INFINITY;
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  let currentClusterId = 0;
  let currentClusterScore = 0;
  let currentCluster = /* @__PURE__ */ new Set();
  for (const event of layoutShifts) {
    if (event.args["data"]["had_recent_input"] || event.args["data"]["weighted_score_delta"] === void 0) {
      continue;
    }
    if (event.startTime - firstTimestamp > limitTimeInMs || event.startTime - previousTimestamp > gapTimeInMs) {
      firstTimestamp = event.startTime;
      for (const layoutShift of currentCluster) {
        layoutShift.args["data"]["_current_cluster_score"] = currentClusterScore;
        layoutShift.args["data"]["_current_cluster_id"] = currentClusterId;
      }
      currentClusterId += 1;
      currentClusterScore = 0;
      currentCluster = /* @__PURE__ */ new Set();
    }
    previousTimestamp = event.startTime;
    currentClusterScore += event.args["data"]["weighted_score_delta"];
    currentCluster.add(event);
  }
  for (const layoutShift of currentCluster) {
    layoutShift.args["data"]["_current_cluster_score"] = currentClusterScore;
    layoutShift.args["data"]["_current_cluster_id"] = currentClusterId;
  }
}
//# sourceMappingURL=TimelineUIUtils.js.map
