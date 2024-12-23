import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
export class InputModel extends SDK.SDKModel.SDKModel {
  inputAgent;
  eventDispatchTimer;
  dispatchEventDataList;
  finishCallback;
  dispatchingIndex;
  lastEventTime;
  replayPaused;
  constructor(target) {
    super(target);
    this.inputAgent = target.inputAgent();
    this.eventDispatchTimer = 0;
    this.dispatchEventDataList = [];
    this.finishCallback = null;
    this.reset();
  }
  reset() {
    this.lastEventTime = null;
    this.replayPaused = false;
    this.dispatchingIndex = 0;
    window.clearTimeout(this.eventDispatchTimer);
  }
  setEvents(tracingModel) {
    this.dispatchEventDataList = [];
    for (const process of tracingModel.sortedProcesses()) {
      for (const thread of process.sortedThreads()) {
        this.processThreadEvents(tracingModel, thread);
      }
    }
    function compareTimestamp(a, b) {
      return a.timestamp - b.timestamp;
    }
    this.dispatchEventDataList.sort(compareTimestamp);
  }
  startReplay(finishCallback) {
    this.reset();
    this.finishCallback = finishCallback;
    if (this.dispatchEventDataList.length) {
      this.dispatchNextEvent();
    } else {
      this.replayStopped();
    }
  }
  pause() {
    window.clearTimeout(this.eventDispatchTimer);
    if (this.dispatchingIndex >= this.dispatchEventDataList.length) {
      this.replayStopped();
    } else {
      this.replayPaused = true;
    }
  }
  resume() {
    this.replayPaused = false;
    if (this.dispatchingIndex < this.dispatchEventDataList.length) {
      this.dispatchNextEvent();
    }
  }
  processThreadEvents(_tracingModel, thread) {
    for (const event of thread.events()) {
      if (event.name === "EventDispatch" && this.isValidInputEvent(event.args.data)) {
        this.dispatchEventDataList.push(event.args.data);
      }
    }
  }
  isValidInputEvent(eventData) {
    return this.isMouseEvent(eventData) || this.isKeyboardEvent(eventData);
  }
  isMouseEvent(eventData) {
    if (!MOUSE_EVENT_TYPE_TO_REQUEST_TYPE.has(eventData.type)) {
      return false;
    }
    if (!("x" in eventData && "y" in eventData)) {
      return false;
    }
    return true;
  }
  isKeyboardEvent(eventData) {
    if (!KEYBOARD_EVENT_TYPE_TO_REQUEST_TYPE.has(eventData.type)) {
      return false;
    }
    if (!("code" in eventData && "key" in eventData)) {
      return false;
    }
    return true;
  }
  dispatchNextEvent() {
    const eventData = this.dispatchEventDataList[this.dispatchingIndex];
    this.lastEventTime = eventData.timestamp;
    if (MOUSE_EVENT_TYPE_TO_REQUEST_TYPE.has(eventData.type)) {
      void this.dispatchMouseEvent(eventData);
    } else if (KEYBOARD_EVENT_TYPE_TO_REQUEST_TYPE.has(eventData.type)) {
      void this.dispatchKeyEvent(eventData);
    }
    ++this.dispatchingIndex;
    if (this.dispatchingIndex < this.dispatchEventDataList.length) {
      const waitTime = (this.dispatchEventDataList[this.dispatchingIndex].timestamp - this.lastEventTime) / 1e3;
      this.eventDispatchTimer = window.setTimeout(this.dispatchNextEvent.bind(this), waitTime);
    } else {
      this.replayStopped();
    }
  }
  async dispatchMouseEvent(eventData) {
    const type = MOUSE_EVENT_TYPE_TO_REQUEST_TYPE.get(eventData.type);
    if (!type) {
      throw new Error(`Could not find mouse event type for eventData ${eventData.type}`);
    }
    const buttonActionName = BUTTONID_TO_ACTION_NAME.get(eventData.button);
    const params = {
      type,
      x: eventData.x,
      y: eventData.y,
      modifiers: eventData.modifiers,
      button: eventData.type === "mousedown" || eventData.type === "mouseup" ? buttonActionName : Protocol.Input.MouseButton.None,
      buttons: eventData.buttons,
      clickCount: eventData.clickCount,
      deltaX: eventData.deltaX,
      deltaY: eventData.deltaY
    };
    await this.inputAgent.invoke_dispatchMouseEvent(params);
  }
  async dispatchKeyEvent(eventData) {
    const type = KEYBOARD_EVENT_TYPE_TO_REQUEST_TYPE.get(eventData.type);
    if (!type) {
      throw new Error(`Could not find key event type for eventData ${eventData.type}`);
    }
    const text = eventData.type === "keypress" ? eventData.key[0] : void 0;
    const params = {
      type,
      modifiers: eventData.modifiers,
      text,
      unmodifiedText: text ? text.toLowerCase() : void 0,
      code: eventData.code,
      key: eventData.key
    };
    await this.inputAgent.invoke_dispatchKeyEvent(params);
  }
  replayStopped() {
    window.clearTimeout(this.eventDispatchTimer);
    this.reset();
    if (this.finishCallback) {
      this.finishCallback();
    }
  }
}
const MOUSE_EVENT_TYPE_TO_REQUEST_TYPE = /* @__PURE__ */ new Map([
  ["mousedown", Protocol.Input.DispatchMouseEventRequestType.MousePressed],
  ["mouseup", Protocol.Input.DispatchMouseEventRequestType.MouseReleased],
  ["mousemove", Protocol.Input.DispatchMouseEventRequestType.MouseMoved],
  ["wheel", Protocol.Input.DispatchMouseEventRequestType.MouseWheel]
]);
const KEYBOARD_EVENT_TYPE_TO_REQUEST_TYPE = /* @__PURE__ */ new Map([
  ["keydown", Protocol.Input.DispatchKeyEventRequestType.KeyDown],
  ["keyup", Protocol.Input.DispatchKeyEventRequestType.KeyUp],
  ["keypress", Protocol.Input.DispatchKeyEventRequestType.Char]
]);
const BUTTONID_TO_ACTION_NAME = /* @__PURE__ */ new Map([
  [0, Protocol.Input.MouseButton.Left],
  [1, Protocol.Input.MouseButton.Middle],
  [2, Protocol.Input.MouseButton.Right],
  [3, Protocol.Input.MouseButton.Back],
  [4, Protocol.Input.MouseButton.Forward]
]);
SDK.SDKModel.SDKModel.register(InputModel, { capabilities: SDK.Target.Capability.Input, autostart: false });
//# sourceMappingURL=InputModel.js.map
