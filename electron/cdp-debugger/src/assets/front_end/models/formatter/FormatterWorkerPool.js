import * as Common from "../../core/common/common.js";
import * as FormatterActions from "../../entrypoints/formatter_worker/FormatterActions.js";
export { DefinitionKind } from "../../entrypoints/formatter_worker/FormatterActions.js";
const MAX_WORKERS = Math.min(2, navigator.hardwareConcurrency - 1);
let formatterWorkerPoolInstance;
export class FormatterWorkerPool {
  taskQueue;
  workerTasks;
  constructor() {
    this.taskQueue = [];
    this.workerTasks = /* @__PURE__ */ new Map();
  }
  static instance() {
    if (!formatterWorkerPoolInstance) {
      formatterWorkerPoolInstance = new FormatterWorkerPool();
    }
    return formatterWorkerPoolInstance;
  }
  createWorker() {
    const worker = Common.Worker.WorkerWrapper.fromURL(new URL("../../entrypoints/formatter_worker/formatter_worker-entrypoint.js", import.meta.url));
    worker.onmessage = this.onWorkerMessage.bind(this, worker);
    worker.onerror = this.onWorkerError.bind(this, worker);
    return worker;
  }
  processNextTask() {
    if (!this.taskQueue.length) {
      return;
    }
    let freeWorker = [...this.workerTasks.keys()].find((worker) => !this.workerTasks.get(worker));
    if (!freeWorker && this.workerTasks.size < MAX_WORKERS) {
      freeWorker = this.createWorker();
    }
    if (!freeWorker) {
      return;
    }
    const task = this.taskQueue.shift();
    if (task) {
      this.workerTasks.set(freeWorker, task);
      freeWorker.postMessage({ method: task.method, params: task.params });
    }
  }
  onWorkerMessage(worker, event) {
    const task = this.workerTasks.get(worker);
    if (!task) {
      return;
    }
    if (task.isChunked && event.data && !event.data["isLastChunk"]) {
      task.callback(event.data);
      return;
    }
    this.workerTasks.set(worker, null);
    this.processNextTask();
    task.callback(event.data ? event.data : null);
  }
  onWorkerError(worker, event) {
    console.error(event);
    const task = this.workerTasks.get(worker);
    worker.terminate();
    this.workerTasks.delete(worker);
    const newWorker = this.createWorker();
    this.workerTasks.set(newWorker, null);
    this.processNextTask();
    if (task) {
      task.callback(null);
    }
  }
  runChunkedTask(methodName, params, callback) {
    const task = new Task(methodName, params, onData, true);
    this.taskQueue.push(task);
    this.processNextTask();
    function onData(data) {
      if (!data) {
        callback(true, null);
        return;
      }
      const isLastChunk = "isLastChunk" in data && Boolean(data["isLastChunk"]);
      const chunk = "chunk" in data && data["chunk"];
      callback(isLastChunk, chunk);
    }
  }
  runTask(methodName, params) {
    return new Promise((resolve) => {
      const task = new Task(methodName, params, resolve, false);
      this.taskQueue.push(task);
      this.processNextTask();
    });
  }
  format(mimeType, content, indentString) {
    const parameters = { mimeType, content, indentString };
    return this.runTask(FormatterActions.FormatterActions.FORMAT, parameters);
  }
  javaScriptIdentifiers(content) {
    return this.runTask(FormatterActions.FormatterActions.JAVASCRIPT_IDENTIFIERS, { content }).then((ids) => ids || []);
  }
  javaScriptSubstitute(expression, mapping) {
    return this.runTask(FormatterActions.FormatterActions.JAVASCRIPT_SUBSTITUTE, { content: expression, mapping: Array.from(mapping.entries()) }).then((result) => result || "");
  }
  javaScriptScopeTree(expression) {
    return this.runTask(FormatterActions.FormatterActions.JAVASCRIPT_SCOPE_TREE, { content: expression }).then((result) => result || null);
  }
  evaluatableJavaScriptSubstring(content) {
    return this.runTask(FormatterActions.FormatterActions.EVALUATE_JAVASCRIPT_SUBSTRING, { content }).then((text) => text || "");
  }
  parseCSS(content, callback) {
    this.runChunkedTask(FormatterActions.FormatterActions.PARSE_CSS, { content }, onDataChunk);
    function onDataChunk(isLastChunk, data) {
      const rules = data || [];
      callback(isLastChunk, rules);
    }
  }
  outlineForMimetype(content, mimeType, callback) {
    switch (mimeType) {
      case "text/html":
        this.runChunkedTask(FormatterActions.FormatterActions.HTML_OUTLINE, { content }, callback);
        return true;
      case "text/javascript":
        this.runChunkedTask(FormatterActions.FormatterActions.JAVASCRIPT_OUTLINE, { content }, callback);
        return true;
      case "text/css":
        this.parseCSS(content, cssCallback);
        return true;
    }
    return false;
    function cssCallback(isLastChunk, rules) {
      callback(isLastChunk, rules.map((rule) => {
        const title = "selectorText" in rule ? rule.selectorText : rule.atRule;
        return { line: rule.lineNumber, subtitle: void 0, column: rule.columnNumber, title };
      }));
    }
  }
  argumentsList(content) {
    return this.runTask(FormatterActions.FormatterActions.ARGUMENTS_LIST, { content });
  }
}
class Task {
  method;
  params;
  callback;
  isChunked;
  constructor(method, params, callback, isChunked) {
    this.method = method;
    this.params = params;
    this.callback = callback;
    this.isChunked = isChunked;
  }
}
export function formatterWorkerPool() {
  return FormatterWorkerPool.instance();
}
//# sourceMappingURL=FormatterWorkerPool.js.map
