import * as Common from "../common/common.js";
import { Events as ResourceTreeModelEvents, ResourceTreeModel } from "./ResourceTreeModel.js";
import { TargetManager } from "./TargetManager.js";
let frameManagerInstance = null;
export class FrameManager extends Common.ObjectWrapper.ObjectWrapper {
  #eventListeners;
  #frames;
  #framesForTarget;
  #topFrame;
  #transferringFramesDataCache;
  #awaitedFrames = /* @__PURE__ */ new Map();
  constructor() {
    super();
    this.#eventListeners = /* @__PURE__ */ new WeakMap();
    TargetManager.instance().observeModels(ResourceTreeModel, this);
    this.#frames = /* @__PURE__ */ new Map();
    this.#framesForTarget = /* @__PURE__ */ new Map();
    this.#topFrame = null;
    this.#transferringFramesDataCache = /* @__PURE__ */ new Map();
  }
  static instance({ forceNew } = { forceNew: false }) {
    if (!frameManagerInstance || forceNew) {
      frameManagerInstance = new FrameManager();
    }
    return frameManagerInstance;
  }
  modelAdded(resourceTreeModel) {
    const addListener = resourceTreeModel.addEventListener(ResourceTreeModelEvents.FrameAdded, this.frameAdded, this);
    const detachListener = resourceTreeModel.addEventListener(ResourceTreeModelEvents.FrameDetached, this.frameDetached, this);
    const navigatedListener = resourceTreeModel.addEventListener(ResourceTreeModelEvents.FrameNavigated, this.frameNavigated, this);
    const resourceAddedListener = resourceTreeModel.addEventListener(ResourceTreeModelEvents.ResourceAdded, this.resourceAdded, this);
    this.#eventListeners.set(resourceTreeModel, [addListener, detachListener, navigatedListener, resourceAddedListener]);
    this.#framesForTarget.set(resourceTreeModel.target().id(), /* @__PURE__ */ new Set());
  }
  modelRemoved(resourceTreeModel) {
    const listeners = this.#eventListeners.get(resourceTreeModel);
    if (listeners) {
      Common.EventTarget.removeEventListeners(listeners);
    }
    const frameSet = this.#framesForTarget.get(resourceTreeModel.target().id());
    if (frameSet) {
      for (const frameId of frameSet) {
        this.decreaseOrRemoveFrame(frameId);
      }
    }
    this.#framesForTarget.delete(resourceTreeModel.target().id());
  }
  frameAdded(event) {
    const frame = event.data;
    const frameData = this.#frames.get(frame.id);
    if (frameData) {
      frame.setCreationStackTrace(frameData.frame.getCreationStackTraceData());
      frame.setAdScriptId(frameData.frame.getAdScriptId());
      frame.setDebuggerId(frameData.frame.getDebuggerId());
      this.#frames.set(frame.id, { frame, count: frameData.count + 1 });
    } else {
      const cachedFrameAttributes = this.#transferringFramesDataCache.get(frame.id);
      if (cachedFrameAttributes?.creationStackTrace && cachedFrameAttributes?.creationStackTraceTarget) {
        frame.setCreationStackTrace({
          creationStackTrace: cachedFrameAttributes.creationStackTrace,
          creationStackTraceTarget: cachedFrameAttributes.creationStackTraceTarget
        });
      }
      if (cachedFrameAttributes?.adScriptId) {
        frame.setAdScriptId(cachedFrameAttributes.adScriptId);
      }
      if (cachedFrameAttributes?.debuggerId) {
        frame.setDebuggerId(cachedFrameAttributes.debuggerId);
      }
      this.#frames.set(frame.id, { frame, count: 1 });
      this.#transferringFramesDataCache.delete(frame.id);
    }
    this.resetTopFrame();
    const frameSet = this.#framesForTarget.get(frame.resourceTreeModel().target().id());
    if (frameSet) {
      frameSet.add(frame.id);
    }
    this.dispatchEventToListeners(Events.FrameAddedToTarget, { frame });
    this.resolveAwaitedFrame(frame);
  }
  frameDetached(event) {
    const { frame, isSwap } = event.data;
    this.decreaseOrRemoveFrame(frame.id);
    if (isSwap && !this.#frames.get(frame.id)) {
      const traceData = frame.getCreationStackTraceData();
      const adScriptId = frame.getAdScriptId();
      const debuggerId = frame.getDebuggerId();
      const cachedFrameAttributes = {
        ...traceData.creationStackTrace && { creationStackTrace: traceData.creationStackTrace },
        ...traceData.creationStackTrace && { creationStackTraceTarget: traceData.creationStackTraceTarget },
        ...adScriptId && { adScriptId },
        ...debuggerId && { debuggerId }
      };
      this.#transferringFramesDataCache.set(frame.id, cachedFrameAttributes);
    }
    const frameSet = this.#framesForTarget.get(frame.resourceTreeModel().target().id());
    if (frameSet) {
      frameSet.delete(frame.id);
    }
  }
  frameNavigated(event) {
    const frame = event.data;
    this.dispatchEventToListeners(Events.FrameNavigated, { frame });
    if (frame.isTopFrame()) {
      this.dispatchEventToListeners(Events.TopFrameNavigated, { frame });
    }
  }
  resourceAdded(event) {
    this.dispatchEventToListeners(Events.ResourceAdded, { resource: event.data });
  }
  decreaseOrRemoveFrame(frameId) {
    const frameData = this.#frames.get(frameId);
    if (frameData) {
      if (frameData.count === 1) {
        this.#frames.delete(frameId);
        this.resetTopFrame();
        this.dispatchEventToListeners(Events.FrameRemoved, { frameId });
      } else {
        frameData.count--;
      }
    }
  }
  resetTopFrame() {
    const topFrames = this.getAllFrames().filter((frame) => frame.isTopFrame());
    this.#topFrame = topFrames.length > 0 ? topFrames[0] : null;
  }
  getFrame(frameId) {
    const frameData = this.#frames.get(frameId);
    if (frameData) {
      return frameData.frame;
    }
    return null;
  }
  getAllFrames() {
    return Array.from(this.#frames.values(), (frameData) => frameData.frame);
  }
  getTopFrame() {
    return this.#topFrame;
  }
  async getOrWaitForFrame(frameId, notInTarget) {
    const frame = this.getFrame(frameId);
    if (frame && (!notInTarget || notInTarget !== frame.resourceTreeModel().target())) {
      return frame;
    }
    return new Promise((resolve) => {
      const waiting = this.#awaitedFrames.get(frameId);
      if (waiting) {
        waiting.push({ notInTarget, resolve });
      } else {
        this.#awaitedFrames.set(frameId, [{ notInTarget, resolve }]);
      }
    });
  }
  resolveAwaitedFrame(frame) {
    const waiting = this.#awaitedFrames.get(frame.id);
    if (!waiting) {
      return;
    }
    const newWaiting = waiting.filter(({ notInTarget, resolve }) => {
      if (!notInTarget || notInTarget !== frame.resourceTreeModel().target()) {
        resolve(frame);
        return false;
      }
      return true;
    });
    if (newWaiting.length > 0) {
      this.#awaitedFrames.set(frame.id, newWaiting);
    } else {
      this.#awaitedFrames.delete(frame.id);
    }
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["FrameAddedToTarget"] = "FrameAddedToTarget";
  Events2["FrameNavigated"] = "FrameNavigated";
  Events2["FrameRemoved"] = "FrameRemoved";
  Events2["ResourceAdded"] = "ResourceAdded";
  Events2["TopFrameNavigated"] = "TopFrameNavigated";
  return Events2;
})(Events || {});
//# sourceMappingURL=FrameManager.js.map
