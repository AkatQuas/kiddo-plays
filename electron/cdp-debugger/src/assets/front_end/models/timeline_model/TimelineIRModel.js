import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  twoFlingsAtTheSameTimeSVsS: "Two flings at the same time? {PH1} vs {PH2}",
  twoTouchesAtTheSameTimeSVsS: "Two touches at the same time? {PH1} vs {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("models/timeline_model/TimelineIRModel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const eventToPhase = /* @__PURE__ */ new WeakMap();
export class TimelineIRModel {
  segments;
  drags;
  cssAnimations;
  responses;
  scrolls;
  constructor() {
    this.reset();
  }
  static phaseForEvent(event) {
    return eventToPhase.get(event);
  }
  populate(inputLatencies, animations) {
    this.reset();
    if (!inputLatencies) {
      return;
    }
    this.processInputLatencies(inputLatencies);
    if (animations) {
      this.processAnimations(animations);
    }
    const range = new Common.SegmentedRange.SegmentedRange();
    range.appendRange(this.drags);
    range.appendRange(this.cssAnimations);
    range.appendRange(this.scrolls);
    range.appendRange(this.responses);
    this.segments = range.segments();
  }
  processInputLatencies(events) {
    const eventTypes = InputEvents;
    const phases = Phases;
    const thresholdsMs = TimelineIRModel._mergeThresholdsMs;
    let scrollStart;
    let flingStart;
    let touchStart;
    let firstTouchMove;
    let mouseWheel;
    let mouseDown;
    let mouseMove;
    for (let i = 0; i < events.length; ++i) {
      const event = events[i];
      if (i > 0 && events[i].startTime < events[i - 1].startTime) {
        console.assert(false, "Unordered input events");
      }
      const type = this.inputEventType(event.name);
      switch (type) {
        case eventTypes.ScrollBegin:
          this.scrolls.append(this.segmentForEvent(event, phases.Scroll));
          scrollStart = event;
          break;
        case eventTypes.ScrollEnd:
          if (scrollStart) {
            this.scrolls.append(this.segmentForEventRange(scrollStart, event, phases.Scroll));
          } else {
            this.scrolls.append(this.segmentForEvent(event, phases.Scroll));
          }
          scrollStart = null;
          break;
        case eventTypes.ScrollUpdate:
          touchStart = null;
          this.scrolls.append(this.segmentForEvent(event, phases.Scroll));
          break;
        case eventTypes.FlingStart:
          if (flingStart) {
            Common.Console.Console.instance().error(i18nString(UIStrings.twoFlingsAtTheSameTimeSVsS, { PH1: flingStart.startTime, PH2: event.startTime }));
            break;
          }
          flingStart = event;
          break;
        case eventTypes.FlingCancel:
          if (!flingStart) {
            break;
          }
          this.scrolls.append(this.segmentForEventRange(flingStart, event, phases.Fling));
          flingStart = null;
          break;
        case eventTypes.ImplSideFling:
          this.scrolls.append(this.segmentForEvent(event, phases.Fling));
          break;
        case eventTypes.ShowPress:
        case eventTypes.Tap:
        case eventTypes.KeyDown:
        case eventTypes.KeyDownRaw:
        case eventTypes.KeyUp:
        case eventTypes.Char:
        case eventTypes.Click:
        case eventTypes.ContextMenu:
          this.responses.append(this.segmentForEvent(event, phases.Response));
          break;
        case eventTypes.TouchStart:
          if (touchStart) {
            Common.Console.Console.instance().error(i18nString(UIStrings.twoTouchesAtTheSameTimeSVsS, { PH1: touchStart.startTime, PH2: event.startTime }));
            break;
          }
          touchStart = event;
          this.setPhaseForEvent(event, phases.Response);
          firstTouchMove = null;
          break;
        case eventTypes.TouchCancel:
          touchStart = null;
          break;
        case eventTypes.TouchMove:
          if (firstTouchMove) {
            this.drags.append(this.segmentForEvent(event, phases.Drag));
          } else if (touchStart) {
            firstTouchMove = event;
            this.responses.append(this.segmentForEventRange(touchStart, event, phases.Response));
          }
          break;
        case eventTypes.TouchEnd:
          touchStart = null;
          break;
        case eventTypes.MouseDown:
          mouseDown = event;
          mouseMove = null;
          break;
        case eventTypes.MouseMove:
          if (mouseDown && !mouseMove && mouseDown.startTime + thresholdsMs.mouse > event.startTime) {
            this.responses.append(this.segmentForEvent(mouseDown, phases.Response));
            this.responses.append(this.segmentForEvent(event, phases.Response));
          } else if (mouseDown) {
            this.drags.append(this.segmentForEvent(event, phases.Drag));
          }
          mouseMove = event;
          break;
        case eventTypes.MouseUp:
          this.responses.append(this.segmentForEvent(event, phases.Response));
          mouseDown = null;
          break;
        case eventTypes.MouseWheel:
          if (mouseWheel && canMerge(thresholdsMs.mouse, mouseWheel, event)) {
            this.scrolls.append(this.segmentForEventRange(mouseWheel, event, phases.Scroll));
          } else {
            this.scrolls.append(this.segmentForEvent(event, phases.Scroll));
          }
          mouseWheel = event;
          break;
      }
    }
    function canMerge(threshold, first, second) {
      if (first.endTime === void 0) {
        return false;
      }
      return first.endTime < second.startTime && second.startTime < first.endTime + threshold;
    }
  }
  processAnimations(events) {
    for (let i = 0; i < events.length; ++i) {
      this.cssAnimations.append(this.segmentForEvent(events[i], Phases.Animation));
    }
  }
  segmentForEvent(event, phase) {
    this.setPhaseForEvent(event, phase);
    return new Common.SegmentedRange.Segment(event.startTime, event.endTime !== void 0 ? event.endTime : Number.MAX_SAFE_INTEGER, phase);
  }
  segmentForEventRange(startEvent, endEvent, phase) {
    this.setPhaseForEvent(startEvent, phase);
    this.setPhaseForEvent(endEvent, phase);
    return new Common.SegmentedRange.Segment(startEvent.startTime, startEvent.endTime !== void 0 ? startEvent.endTime : Number.MAX_SAFE_INTEGER, phase);
  }
  setPhaseForEvent(asyncEvent, phase) {
    eventToPhase.set(asyncEvent.steps[0], phase);
  }
  interactionRecords() {
    return this.segments;
  }
  reset() {
    const thresholdsMs = TimelineIRModel._mergeThresholdsMs;
    this.segments = [];
    this.drags = new Common.SegmentedRange.SegmentedRange(merge.bind(null, thresholdsMs.mouse));
    this.cssAnimations = new Common.SegmentedRange.SegmentedRange(merge.bind(null, thresholdsMs.animation));
    this.responses = new Common.SegmentedRange.SegmentedRange(merge.bind(null, 0));
    this.scrolls = new Common.SegmentedRange.SegmentedRange(merge.bind(null, thresholdsMs.animation));
    function merge(threshold, first, second) {
      return first.end + threshold >= second.begin && first.data === second.data ? first : null;
    }
  }
  inputEventType(eventName) {
    const prefix = "InputLatency::";
    if (!eventName.startsWith(prefix)) {
      const inputEventName = eventName;
      if (inputEventName === InputEvents.ImplSideFling) {
        return inputEventName;
      }
      console.error("Unrecognized input latency event: " + eventName);
      return null;
    }
    return eventName.substr(prefix.length);
  }
}
export var Phases = /* @__PURE__ */ ((Phases2) => {
  Phases2["Idle"] = "Idle";
  Phases2["Response"] = "Response";
  Phases2["Scroll"] = "Scroll";
  Phases2["Fling"] = "Fling";
  Phases2["Drag"] = "Drag";
  Phases2["Animation"] = "Animation";
  Phases2["Uncategorized"] = "Uncategorized";
  return Phases2;
})(Phases || {});
export var InputEvents = /* @__PURE__ */ ((InputEvents2) => {
  InputEvents2["Char"] = "Char";
  InputEvents2["Click"] = "GestureClick";
  InputEvents2["ContextMenu"] = "ContextMenu";
  InputEvents2["FlingCancel"] = "GestureFlingCancel";
  InputEvents2["FlingStart"] = "GestureFlingStart";
  InputEvents2["ImplSideFling"] = "InputHandlerProxy::HandleGestureFling::started";
  InputEvents2["KeyDown"] = "KeyDown";
  InputEvents2["KeyDownRaw"] = "RawKeyDown";
  InputEvents2["KeyUp"] = "KeyUp";
  InputEvents2["LatencyScrollUpdate"] = "ScrollUpdate";
  InputEvents2["MouseDown"] = "MouseDown";
  InputEvents2["MouseMove"] = "MouseMove";
  InputEvents2["MouseUp"] = "MouseUp";
  InputEvents2["MouseWheel"] = "MouseWheel";
  InputEvents2["PinchBegin"] = "GesturePinchBegin";
  InputEvents2["PinchEnd"] = "GesturePinchEnd";
  InputEvents2["PinchUpdate"] = "GesturePinchUpdate";
  InputEvents2["ScrollBegin"] = "GestureScrollBegin";
  InputEvents2["ScrollEnd"] = "GestureScrollEnd";
  InputEvents2["ScrollUpdate"] = "GestureScrollUpdate";
  InputEvents2["ScrollUpdateRenderer"] = "ScrollUpdate";
  InputEvents2["ShowPress"] = "GestureShowPress";
  InputEvents2["Tap"] = "GestureTap";
  InputEvents2["TapCancel"] = "GestureTapCancel";
  InputEvents2["TapDown"] = "GestureTapDown";
  InputEvents2["TouchCancel"] = "TouchCancel";
  InputEvents2["TouchEnd"] = "TouchEnd";
  InputEvents2["TouchMove"] = "TouchMove";
  InputEvents2["TouchStart"] = "TouchStart";
  return InputEvents2;
})(InputEvents || {});
((TimelineIRModel2) => {
  TimelineIRModel2._mergeThresholdsMs = {
    animation: 1,
    mouse: 40
  };
  TimelineIRModel2._eventIRPhase = Symbol("eventIRPhase");
})(TimelineIRModel || (TimelineIRModel = {}));
//# sourceMappingURL=TimelineIRModel.js.map
