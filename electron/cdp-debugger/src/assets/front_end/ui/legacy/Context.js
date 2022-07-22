import * as Common from "../../core/common/common.js";
let contextInstance;
export class Context {
  flavorsInternal;
  eventDispatchers;
  constructor() {
    this.flavorsInternal = /* @__PURE__ */ new Map();
    this.eventDispatchers = /* @__PURE__ */ new Map();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!contextInstance || forceNew) {
      contextInstance = new Context();
    }
    return contextInstance;
  }
  setFlavor(flavorType, flavorValue) {
    const value = this.flavorsInternal.get(flavorType) || null;
    if (value === flavorValue) {
      return;
    }
    if (flavorValue) {
      this.flavorsInternal.set(flavorType, flavorValue);
    } else {
      this.flavorsInternal.delete(flavorType);
    }
    this.dispatchFlavorChange(flavorType, flavorValue);
  }
  dispatchFlavorChange(flavorType, flavorValue) {
    for (const extension of getRegisteredListeners()) {
      if (extension.contextTypes().includes(flavorType)) {
        void extension.loadListener().then((instance) => instance.flavorChanged(flavorValue));
      }
    }
    const dispatcher = this.eventDispatchers.get(flavorType);
    if (!dispatcher) {
      return;
    }
    dispatcher.dispatchEventToListeners(Events.FlavorChanged, flavorValue);
  }
  addFlavorChangeListener(flavorType, listener, thisObject) {
    let dispatcher = this.eventDispatchers.get(flavorType);
    if (!dispatcher) {
      dispatcher = new Common.ObjectWrapper.ObjectWrapper();
      this.eventDispatchers.set(flavorType, dispatcher);
    }
    dispatcher.addEventListener(Events.FlavorChanged, listener, thisObject);
  }
  removeFlavorChangeListener(flavorType, listener, thisObject) {
    const dispatcher = this.eventDispatchers.get(flavorType);
    if (!dispatcher) {
      return;
    }
    dispatcher.removeEventListener(Events.FlavorChanged, listener, thisObject);
    if (!dispatcher.hasEventListeners(Events.FlavorChanged)) {
      this.eventDispatchers.delete(flavorType);
    }
  }
  flavor(flavorType) {
    return this.flavorsInternal.get(flavorType) || null;
  }
  flavors() {
    return new Set(this.flavorsInternal.keys());
  }
}
var Events = /* @__PURE__ */ ((Events2) => {
  Events2["FlavorChanged"] = "FlavorChanged";
  return Events2;
})(Events || {});
const registeredListeners = [];
export function registerListener(registration) {
  registeredListeners.push(registration);
}
function getRegisteredListeners() {
  return registeredListeners;
}
//# sourceMappingURL=Context.js.map
