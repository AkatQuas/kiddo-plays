import * as Common from "../../core/common/common.js";
import * as SDK from "../../core/sdk/sdk.js";
export async function frameworkEventListeners(object) {
  const domDebuggerModel = object.runtimeModel().target().model(SDK.DOMDebuggerModel.DOMDebuggerModel);
  if (!domDebuggerModel) {
    return { eventListeners: [], internalHandlers: null };
  }
  const listenersResult = { internalHandlers: null, eventListeners: [] };
  return object.callFunction(frameworkEventListenersImpl, void 0).then(assertCallFunctionResult).then(getOwnProperties).then(createEventListeners).then(returnResult).catch((error) => {
    console.error(error);
    return listenersResult;
  });
  function getOwnProperties(object2) {
    return object2.getOwnProperties(false);
  }
  async function createEventListeners(result) {
    if (!result.properties) {
      throw new Error("Object properties is empty");
    }
    const promises = [];
    for (const property of result.properties) {
      if (property.name === "eventListeners" && property.value) {
        promises.push(convertToEventListeners(property.value).then(storeEventListeners));
      }
      if (property.name === "internalHandlers" && property.value) {
        promises.push(convertToInternalHandlers(property.value).then(storeInternalHandlers));
      }
      if (property.name === "errorString" && property.value) {
        printErrorString(property.value);
      }
    }
    await Promise.all(promises);
  }
  function convertToEventListeners(pageEventListenersObject) {
    return SDK.RemoteObject.RemoteArray.objectAsArray(pageEventListenersObject).map(toEventListener).then(filterOutEmptyObjects);
    function toEventListener(listenerObject) {
      let type;
      let useCapture;
      let passive;
      let once;
      let handler = null;
      let originalHandler = null;
      let location = null;
      let removeFunctionObject = null;
      const promises = [];
      promises.push(listenerObject.callFunctionJSON(truncatePageEventListener, void 0).then(storeTruncatedListener));
      function truncatePageEventListener() {
        return { type: this.type, useCapture: this.useCapture, passive: this.passive, once: this.once };
      }
      function storeTruncatedListener(truncatedListener) {
        if (truncatedListener.type !== void 0) {
          type = truncatedListener.type;
        }
        if (truncatedListener.useCapture !== void 0) {
          useCapture = truncatedListener.useCapture;
        }
        if (truncatedListener.passive !== void 0) {
          passive = truncatedListener.passive;
        }
        if (truncatedListener.once !== void 0) {
          once = truncatedListener.once;
        }
      }
      promises.push(listenerObject.callFunction(handlerFunction).then(assertCallFunctionResult).then(storeOriginalHandler).then(toTargetFunction).then(storeFunctionWithDetails));
      function handlerFunction() {
        return this.handler || null;
      }
      function storeOriginalHandler(functionObject) {
        originalHandler = functionObject;
        return originalHandler;
      }
      function storeFunctionWithDetails(functionObject) {
        handler = functionObject;
        return functionObject.debuggerModel().functionDetailsPromise(functionObject).then(storeFunctionDetails);
      }
      function storeFunctionDetails(functionDetails) {
        location = functionDetails ? functionDetails.location : null;
      }
      promises.push(listenerObject.callFunction(getRemoveFunction).then(assertCallFunctionResult).then(storeRemoveFunction));
      function getRemoveFunction() {
        return this.remove || null;
      }
      function storeRemoveFunction(functionObject) {
        if (functionObject.type !== "function") {
          return;
        }
        removeFunctionObject = functionObject;
      }
      return Promise.all(promises).then(createEventListener).catch((error) => {
        console.error(error);
        return null;
      });
      function createEventListener() {
        if (!location) {
          throw new Error("Empty event listener's location");
        }
        return new SDK.DOMDebuggerModel.EventListener(domDebuggerModel, object, type, useCapture, passive, once, handler, originalHandler, location, removeFunctionObject, SDK.DOMDebuggerModel.EventListener.Origin.FrameworkUser);
      }
    }
  }
  function convertToInternalHandlers(pageInternalHandlersObject) {
    return SDK.RemoteObject.RemoteArray.objectAsArray(pageInternalHandlersObject).map(toTargetFunction).then(SDK.RemoteObject.RemoteArray.createFromRemoteObjects.bind(null));
  }
  function toTargetFunction(functionObject) {
    return SDK.RemoteObject.RemoteFunction.objectAsFunction(functionObject).targetFunction();
  }
  function storeEventListeners(eventListeners) {
    listenersResult.eventListeners = eventListeners;
  }
  function storeInternalHandlers(internalHandlers) {
    listenersResult.internalHandlers = internalHandlers;
  }
  function printErrorString(errorString) {
    Common.Console.Console.instance().error(String(errorString.value));
  }
  function returnResult() {
    return listenersResult;
  }
  function assertCallFunctionResult(result) {
    if (result.wasThrown || !result.object) {
      throw new Error("Exception in callFunction or empty result");
    }
    return result.object;
  }
  function filterOutEmptyObjects(objects) {
    return objects.filter(filterOutEmpty);
    function filterOutEmpty(object2) {
      return Boolean(object2);
    }
  }
  function frameworkEventListenersImpl() {
    const errorLines = [];
    let eventListeners = [];
    let internalHandlers = [];
    let fetchers = [jQueryFetcher];
    try {
      if (self.devtoolsFrameworkEventListeners && isArrayLike(self.devtoolsFrameworkEventListeners)) {
        fetchers = fetchers.concat(self.devtoolsFrameworkEventListeners);
      }
    } catch (e) {
      errorLines.push("devtoolsFrameworkEventListeners call produced error: " + toString(e));
    }
    for (let i = 0; i < fetchers.length; ++i) {
      try {
        const fetcherResult = fetchers[i](this);
        if (fetcherResult.eventListeners && isArrayLike(fetcherResult.eventListeners)) {
          const fetcherResultEventListeners = fetcherResult.eventListeners;
          const nonEmptyEventListeners = fetcherResultEventListeners.map((eventListener) => {
            return checkEventListener(eventListener);
          }).filter(nonEmptyObject);
          eventListeners = eventListeners.concat(nonEmptyEventListeners);
        }
        if (fetcherResult.internalHandlers && isArrayLike(fetcherResult.internalHandlers)) {
          const fetcherResultInternalHandlers = fetcherResult.internalHandlers;
          const nonEmptyInternalHandlers = fetcherResultInternalHandlers.map((handler) => {
            return checkInternalHandler(handler);
          }).filter(nonEmptyObject);
          internalHandlers = internalHandlers.concat(nonEmptyInternalHandlers);
        }
      } catch (e) {
        errorLines.push("fetcher call produced error: " + toString(e));
      }
    }
    const result = {
      eventListeners,
      internalHandlers: internalHandlers.length ? internalHandlers : void 0,
      errorString: void 0
    };
    if (!result.internalHandlers) {
      delete result.internalHandlers;
    }
    if (errorLines.length) {
      let errorString = "Framework Event Listeners API Errors:\n	" + errorLines.join("\n	");
      errorString = errorString.substr(0, errorString.length - 1);
      result.errorString = errorString;
    }
    if (result.errorString === "" || result.errorString === void 0) {
      delete result.errorString;
    }
    return result;
    function isArrayLike(obj) {
      if (!obj || typeof obj !== "object") {
        return false;
      }
      try {
        if (typeof obj.splice === "function") {
          const len = obj.length;
          return typeof len === "number" && (len >>> 0 === len && (len > 0 || 1 / len > 0));
        }
      } catch (e) {
      }
      return false;
    }
    function checkEventListener(eventListener) {
      try {
        let errorString = "";
        if (!eventListener) {
          errorString += "empty event listener, ";
        } else {
          const type = eventListener.type;
          if (!type || typeof type !== "string") {
            errorString += "event listener's type isn't string or empty, ";
          }
          const useCapture = eventListener.useCapture;
          if (typeof useCapture !== "boolean") {
            errorString += "event listener's useCapture isn't boolean or undefined, ";
          }
          const passive = eventListener.passive;
          if (typeof passive !== "boolean") {
            errorString += "event listener's passive isn't boolean or undefined, ";
          }
          const once = eventListener.once;
          if (typeof once !== "boolean") {
            errorString += "event listener's once isn't boolean or undefined, ";
          }
          const handler = eventListener.handler;
          if (!handler || typeof handler !== "function") {
            errorString += "event listener's handler isn't a function or empty, ";
          }
          const remove = eventListener.remove;
          if (remove && typeof remove !== "function") {
            errorString += "event listener's remove isn't a function, ";
          }
          if (!errorString) {
            return {
              type,
              useCapture,
              passive,
              once,
              handler,
              remove
            };
          }
        }
        errorLines.push(errorString.substr(0, errorString.length - 2));
        return null;
      } catch (error) {
        errorLines.push(toString(error));
        return null;
      }
    }
    function checkInternalHandler(handler) {
      if (handler && typeof handler === "function") {
        return handler;
      }
      errorLines.push("internal handler isn't a function or empty");
      return null;
    }
    function toString(obj) {
      try {
        return String(obj);
      } catch (e) {
        return "<error>";
      }
    }
    function nonEmptyObject(obj) {
      return Boolean(obj);
    }
    function jQueryFetcher(node) {
      if (!node || !(node instanceof Node)) {
        return { eventListeners: [] };
      }
      const jQuery = window["jQuery"];
      if (!jQuery || !jQuery.fn) {
        return { eventListeners: [] };
      }
      const jQueryFunction = jQuery;
      const data = jQuery._data || jQuery.data;
      const eventListeners2 = [];
      const internalHandlers2 = [];
      if (typeof data === "function") {
        const events = data(node, "events");
        for (const type in events) {
          for (const key in events[type]) {
            const frameworkListener = events[type][key];
            if (typeof frameworkListener === "object" || typeof frameworkListener === "function") {
              const listener = {
                handler: frameworkListener.handler || frameworkListener,
                useCapture: true,
                passive: false,
                once: false,
                type,
                remove: jQueryRemove.bind(node, frameworkListener.selector)
              };
              eventListeners2.push(listener);
            }
          }
        }
        const nodeData = data(node);
        if (nodeData && typeof nodeData.handle === "function") {
          internalHandlers2.push(nodeData.handle);
        }
      }
      const entry = jQueryFunction(node)[0];
      if (entry) {
        const entryEvents = entry["$events"];
        for (const type in entryEvents) {
          const events = entryEvents[type];
          for (const key in events) {
            if (typeof events[key] === "function") {
              const listener = { handler: events[key], useCapture: true, passive: false, once: false, type };
              eventListeners2.push(listener);
            }
          }
        }
        if (entry && entry["$handle"]) {
          internalHandlers2.push(entry["$handle"]);
        }
      }
      return { eventListeners: eventListeners2, internalHandlers: internalHandlers2 };
    }
    function jQueryRemove(selector, type, handler) {
      if (!this || !(this instanceof Node)) {
        return;
      }
      const node = this;
      const jQuery = window["jQuery"];
      if (!jQuery || !jQuery.fn) {
        return;
      }
      const jQueryFunction = jQuery;
      jQueryFunction(node).off(type, selector, handler);
    }
  }
}
//# sourceMappingURL=EventListenersUtils.js.map
