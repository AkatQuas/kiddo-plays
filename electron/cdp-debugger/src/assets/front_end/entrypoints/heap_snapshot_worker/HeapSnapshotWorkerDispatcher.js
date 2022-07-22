export class HeapSnapshotWorkerDispatcher {
  #objects;
  #global;
  #postMessage;
  constructor(globalObject, postMessage) {
    this.#objects = [];
    this.#global = globalObject;
    this.#postMessage = postMessage;
  }
  #findFunction(name) {
    const path = name.split(".");
    let result = this.#global;
    for (let i = 0; i < path.length; ++i) {
      result = result[path[i]];
    }
    return result;
  }
  sendEvent(name, data) {
    this.#postMessage({ eventName: name, data });
  }
  dispatchMessage({ data }) {
    const response = { callId: data.callId, result: null, error: void 0, errorCallStack: void 0, errorMethodName: void 0 };
    try {
      switch (data.disposition) {
        case "create": {
          const constructorFunction = this.#findFunction(data.methodName);
          this.#objects[data.objectId] = new constructorFunction(this);
          break;
        }
        case "dispose": {
          delete this.#objects[data.objectId];
          break;
        }
        case "getter": {
          const object = this.#objects[data.objectId];
          const result = object[data.methodName];
          response.result = result;
          break;
        }
        case "factory": {
          const object = this.#objects[data.objectId];
          const result = object[data.methodName].apply(object, data.methodArguments);
          if (result) {
            this.#objects[data.newObjectId] = result;
          }
          response.result = Boolean(result);
          break;
        }
        case "method": {
          const object = this.#objects[data.objectId];
          response.result = object[data.methodName].apply(object, data.methodArguments);
          break;
        }
        case "evaluateForTest": {
          try {
            response.result = self.eval(data.source);
          } catch (error) {
            response.result = error.toString();
          }
          break;
        }
      }
    } catch (error) {
      response.error = error.toString();
      response.errorCallStack = error.stack;
      if (data.methodName) {
        response.errorMethodName = data.methodName;
      }
    }
    this.#postMessage(response);
  }
}
//# sourceMappingURL=HeapSnapshotWorkerDispatcher.js.map
