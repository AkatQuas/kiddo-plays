import * as Coordinator from "../render_coordinator/render_coordinator.js";
const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();
const pendingRenders = /* @__PURE__ */ new WeakSet();
const activeRenders = /* @__PURE__ */ new WeakSet();
const subsequentRender = /* @__PURE__ */ new WeakMap();
const wrappedCallbacks = /* @__PURE__ */ new WeakMap();
export async function scheduleRender(component, callback) {
  if (activeRenders.has(component)) {
    subsequentRender.set(component, callback);
    return;
  }
  if (pendingRenders.has(component)) {
    return;
  }
  pendingRenders.add(component);
  let wrappedCallback = wrappedCallbacks.get(callback);
  if (!wrappedCallback) {
    wrappedCallback = async () => {
      pendingRenders.delete(component);
      activeRenders.add(component);
      await callback.call(component);
      activeRenders.delete(component);
    };
    wrappedCallbacks.set(callback, wrappedCallback);
  }
  await coordinator.write(wrappedCallback);
  if (subsequentRender.has(component)) {
    const newCallback = subsequentRender.get(component);
    subsequentRender.delete(component);
    if (!newCallback) {
      return;
    }
    void scheduleRender(component, newCallback);
  }
}
export function isScheduledRender(component) {
  return activeRenders.has(component);
}
//# sourceMappingURL=scheduled-render.js.map
