import * as Common from "../../core/common/common.js";
import * as Platform from "../../core/platform/platform.js";
import * as ProtocolClientModule from "../../core/protocol_client/protocol_client.js";
import * as Root from "../../core/root/root.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as CodeHighlighter from "../../ui/components/code_highlighter/code_highlighter.js";
import * as UI from "../../ui/legacy/legacy.js";
self.Platform = self.Platform || {};
self.Platform.StringUtilities = Platform.StringUtilities;
self.Platform.MapUtilities = Platform.MapUtilities;
self.Platform.ArrayUtilities = Platform.ArrayUtilities;
self.Platform.DOMUtilities = Platform.DOMUtilities;
self.createPlainTextSearchRegex = Platform.StringUtilities.createPlainTextSearchRegex;
String.sprintf = Platform.StringUtilities.sprintf;
String.regexSpecialCharacters = Platform.StringUtilities.regexSpecialCharacters;
String.caseInsensetiveComparator = Platform.StringUtilities.caseInsensetiveComparator;
export function isDebugTest() {
  return !self.testRunner || Boolean(Root.Runtime.Runtime.queryParam("debugFrontend"));
}
export function _printDevToolsConsole() {
  if (isDebugTest()) {
    return;
  }
  console.log = (...args) => {
    addResult(`log: ${args}`);
  };
  console.error = (...args) => {
    addResult(`error: ${args}`);
  };
  console.info = (...args) => {
    addResult(`info: ${args}`);
  };
  console.assert = (assertionCondition, ...args) => {
    if (!assertionCondition) {
      addResult(`ASSERTION FAILURE: ${args.join(" ")}`);
    }
  };
}
self["onerror"] = (message, source, lineno, colno, error) => {
  addResult("TEST ENDED IN ERROR: " + error.stack);
  completeTest();
};
(() => {
  self.addEventListener("unhandledrejection", (event) => {
    addResult(`PROMISE FAILURE: ${event.reason.stack}`);
    completeTest();
  });
})();
_printDevToolsConsole();
let _results = [];
let _innerAddResult = (text) => {
  _results.push(String(text));
};
export function setInnerResult(updatedInnerResult) {
  _innerAddResult = updatedInnerResult;
}
export function addResult(text) {
  _innerAddResult(text);
}
let completed = false;
let _innerCompleteTest = () => {
  if (completed) {
    return;
  }
  completed = true;
  flushResults();
  self.testRunner.notifyDone();
};
export function setInnerCompleteTest(updatedInnerCompleteTest) {
  _innerCompleteTest = updatedInnerCompleteTest;
}
export function completeTest() {
  _innerCompleteTest();
}
self.TestRunner = self.TestRunner || {};
function flushResults() {
  Array.prototype.forEach.call(document.documentElement.childNodes, (x) => x.remove());
  const outputElement = document.createElement("div");
  if (outputElement.style) {
    outputElement.style.whiteSpace = "pre";
    outputElement.style.height = "10px";
    outputElement.style.overflow = "hidden";
  }
  document.documentElement.appendChild(outputElement);
  for (let i = 0; i < _results.length; i++) {
    outputElement.appendChild(document.createTextNode(_results[i]));
    outputElement.appendChild(document.createElement("br"));
  }
  _results = [];
}
export function addResults(textArray) {
  if (!textArray) {
    return;
  }
  for (let i = 0, size = textArray.length; i < size; ++i) {
    addResult(textArray[i]);
  }
}
export function runTests(tests) {
  nextTest();
  function nextTest() {
    const test = tests.shift();
    if (!test) {
      completeTest();
      return;
    }
    addResult("\ntest: " + test.name);
    let testPromise = test();
    if (!(testPromise instanceof Promise)) {
      testPromise = Promise.resolve();
    }
    testPromise.then(nextTest);
  }
}
export function addSniffer(receiver, methodName, override2, opt_sticky) {
  override2 = safeWrap(override2);
  const original = receiver[methodName];
  if (typeof original !== "function") {
    throw new Error("Cannot find method to override: " + methodName);
  }
  receiver[methodName] = function(var_args) {
    let result;
    try {
      result = original.apply(this, arguments);
    } finally {
      if (!opt_sticky) {
        receiver[methodName] = original;
      }
    }
    try {
      Array.prototype.push.call(arguments, result);
      override2.apply(this, arguments);
    } catch (e) {
      throw new Error("Exception in overriden method '" + methodName + "': " + e);
    }
    return result;
  };
}
export function addSnifferPromise(receiver, methodName) {
  return new Promise(function(resolve, reject) {
    const original = receiver[methodName];
    if (typeof original !== "function") {
      reject("Cannot find method to override: " + methodName);
      return;
    }
    receiver[methodName] = function(var_args) {
      let result;
      try {
        result = original.apply(this, arguments);
      } finally {
        receiver[methodName] = original;
      }
      try {
        Array.prototype.push.call(arguments, result);
        resolve.apply(this, arguments);
      } catch (e) {
        reject("Exception in overridden method '" + methodName + "': " + e);
        completeTest();
      }
      return result;
    };
  });
}
const mappingForLayoutTests = /* @__PURE__ */ new Map([
  ["panels/animation", "animation"],
  ["panels/browser_debugger", "browser_debugger"],
  ["panels/changes", "changes"],
  ["panels/console", "console"],
  ["panels/elements", "elements"],
  ["panels/emulation", "emulation"],
  ["panels/mobile_throttling", "mobile_throttling"],
  ["panels/network", "network"],
  ["panels/profiler", "profiler"],
  ["panels/application", "resources"],
  ["panels/search", "search"],
  ["panels/sources", "sources"],
  ["panels/snippets", "snippets"],
  ["panels/settings", "settings"],
  ["panels/timeline", "timeline"],
  ["panels/web_audio", "web_audio"],
  ["models/persistence", "persistence"],
  ["models/workspace_diff", "workspace_diff"],
  ["entrypoints/main", "main"],
  ["third_party/diff", "diff"],
  ["ui/legacy/components/inline_editor", "inline_editor"],
  ["ui/legacy/components/data_grid", "data_grid"],
  ["ui/legacy/components/perf_ui", "perf_ui"],
  ["ui/legacy/components/source_frame", "source_frame"],
  ["ui/legacy/components/color_picker", "color_picker"],
  ["ui/legacy/components/cookie_table", "cookie_table"],
  ["ui/legacy/components/quick_open", "quick_open"],
  ["ui/legacy/components/utils", "components"]
]);
export async function loadLegacyModule(module) {
  let containingFolder = module;
  for (const [remappedFolder, originalFolder] of mappingForLayoutTests.entries()) {
    if (originalFolder === module) {
      containingFolder = remappedFolder;
    }
  }
  await import(`../../${containingFolder}/${containingFolder.split("/").reverse()[0]}-legacy.js`);
}
export async function loadTestModule(module) {
  await import(`../${module}/${module}.js`);
}
export function showPanel(panel) {
  return UI.ViewManager.ViewManager.instance().showView(panel);
}
export function createKeyEvent(key, ctrlKey, altKey, shiftKey, metaKey) {
  return new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: Boolean(ctrlKey),
    altKey: Boolean(altKey),
    shiftKey: Boolean(shiftKey),
    metaKey: Boolean(metaKey)
  });
}
export function safeWrap(func, onexception) {
  function result() {
    if (!func) {
      return;
    }
    const wrapThis = this;
    try {
      return func.apply(wrapThis, arguments);
    } catch (e) {
      addResult("Exception while running: " + func + "\n" + (e.stack || e));
      if (onexception) {
        safeWrap(onexception)();
      } else {
        completeTest();
      }
    }
  }
  return result;
}
function safeAsyncWrap(func) {
  async function result() {
    if (!func) {
      return;
    }
    const wrapThis = this;
    try {
      return await func.apply(wrapThis, arguments);
    } catch (e) {
      addResult("Exception while running: " + func + "\n" + (e.stack || e));
      completeTest();
    }
  }
  return result;
}
export function textContentWithLineBreaks(node) {
  function padding(currentNode2) {
    let result = 0;
    while (currentNode2 && currentNode2 !== node) {
      if (currentNode2.nodeName === "OL" && !(currentNode2.classList && currentNode2.classList.contains("object-properties-section"))) {
        ++result;
      }
      currentNode2 = currentNode2.parentNode;
    }
    return Array(result * 4 + 1).join(" ");
  }
  let buffer = "";
  let currentNode = node;
  let ignoreFirst = false;
  while (currentNode.traverseNextNode(node)) {
    currentNode = currentNode.traverseNextNode(node);
    if (currentNode.nodeType === Node.TEXT_NODE) {
      buffer += currentNode.nodeValue;
    } else if (currentNode.nodeName === "LI" || currentNode.nodeName === "TR") {
      if (!ignoreFirst) {
        buffer += "\n" + padding(currentNode);
      } else {
        ignoreFirst = false;
      }
    } else if (currentNode.nodeName === "STYLE") {
      currentNode = currentNode.traverseNextNode(node);
      continue;
    } else if (currentNode.classList && currentNode.classList.contains("object-properties-section")) {
      ignoreFirst = true;
    }
  }
  return buffer;
}
export function textContentWithLineBreaksTrimmed(node) {
  return textContentWithLineBreaks(node).replace(/\s{3,}/g, " ");
}
export function textContentWithoutStyles(node) {
  let buffer = "";
  let currentNode = node;
  while (currentNode.traverseNextNode(node)) {
    currentNode = currentNode.traverseNextNode(node, currentNode.tagName === "DEVTOOLS-CSS-LENGTH");
    if (currentNode.nodeType === Node.TEXT_NODE) {
      buffer += currentNode.nodeValue;
    } else if (currentNode.nodeName === "STYLE") {
      currentNode = currentNode.traverseNextNode(node);
    }
  }
  return buffer;
}
export async function evaluateInPageRemoteObject(code) {
  const response = await _evaluateInPage(code);
  return TestRunner.runtimeModel.createRemoteObject(response.result);
}
export async function evaluateInPage(code, callback) {
  const response = await _evaluateInPage(code);
  safeWrap(callback)(response.result.value, response.exceptionDetails);
}
let _evaluateInPageCounter = 0;
export async function _evaluateInPage(code) {
  const lines = new Error().stack.split("at ");
  const testScriptURL = Root.Runtime.Runtime.queryParam("test");
  const functionLine = lines.reduce((acc, line) => line.includes(testScriptURL) ? line : acc, lines[lines.length - 2]);
  const components = functionLine.trim().split("/");
  const source = components[components.length - 1].slice(0, -1).split(":");
  const fileName = source[0];
  const sourceURL = `test://evaluations/${_evaluateInPageCounter++}/` + fileName;
  const lineOffset = parseInt(source[1], 10);
  code = "\n".repeat(lineOffset - 1) + code;
  if (code.indexOf("sourceURL=") === -1) {
    code += `//# sourceURL=${sourceURL}`;
  }
  const response = await TestRunner.RuntimeAgent.invoke_evaluate({ expression: code, objectGroup: "console" });
  const error = response[ProtocolClientModule.InspectorBackend.ProtocolError];
  if (error) {
    addResult("Error: " + error);
    completeTest();
    return;
  }
  return response;
}
export async function evaluateInPageAnonymously(code, userGesture) {
  const response = await TestRunner.RuntimeAgent.invoke_evaluate({ expression: code, objectGroup: "console", userGesture });
  if (!response[ProtocolClientModule.InspectorBackend.ProtocolError]) {
    return response.result.value;
  }
  addResult("Error: " + (response.exceptionDetails && response.exceptionDetails.text || "exception from evaluateInPageAnonymously."));
  completeTest();
}
export function evaluateInPagePromise(code) {
  return new Promise((success) => evaluateInPage(code, success));
}
export async function evaluateInPageAsync(code) {
  const response = await TestRunner.RuntimeAgent.invoke_evaluate({ expression: code, objectGroup: "console", includeCommandLineAPI: false, awaitPromise: true });
  const error = response[ProtocolClientModule.InspectorBackend.ProtocolError];
  if (!error && !response.exceptionDetails) {
    return response.result.value;
  }
  let errorMessage = "Error: ";
  if (error) {
    errorMessage += error;
  } else if (response.exceptionDetails) {
    errorMessage += response.exceptionDetails.text;
    if (response.exceptionDetails.exception) {
      errorMessage += " " + response.exceptionDetails.exception.description;
    }
  }
  addResult(errorMessage);
  completeTest();
}
export function callFunctionInPageAsync(name, args) {
  args = args || [];
  return evaluateInPageAsync(name + "(" + args.map((a) => JSON.stringify(a)).join(",") + ")");
}
export function evaluateInPageWithTimeout(code, userGesture) {
  evaluateInPageAnonymously("setTimeout(unescape('" + escape(code) + "'), 1)", userGesture);
}
export function evaluateFunctionInOverlay(func, callback) {
  const expression = 'internals.evaluateInInspectorOverlay("(" + ' + func + ' + ")()")';
  const mainContext = TestRunner.runtimeModel.executionContexts()[0];
  mainContext.evaluate({
    expression,
    objectGroup: "",
    includeCommandLineAPI: false,
    silent: false,
    returnByValue: true,
    generatePreview: false
  }, false, false).then((result) => void callback(result.object.value));
}
export function check(passCondition, failureText) {
  if (!passCondition) {
    addResult("FAIL: " + failureText);
  }
}
export function deprecatedRunAfterPendingDispatches(callback) {
  ProtocolClient.test.deprecatedRunAfterPendingDispatches(callback);
}
export function loadHTML(html) {
  if (!html.includes("<base")) {
    const doctypeRegex = /(<!DOCTYPE.*?>)/i;
    const baseTag = `<base href="${url()}">`;
    if (html.match(doctypeRegex)) {
      html = html.replace(doctypeRegex, "$1" + baseTag);
    } else {
      html = baseTag + html;
    }
  }
  html = html.replace(/'/g, "\\'").replace(/\n/g, "\\n");
  return evaluateInPageAnonymously(`document.write(\`${html}\`);document.close();`);
}
export function addScriptTag(path) {
  return evaluateInPageAsync(`
    (function(){
      let script = document.createElement('script');
      script.src = '${path}';
      document.head.append(script);
      return new Promise(f => script.onload = f);
    })();
  `);
}
export function addStylesheetTag(path) {
  return evaluateInPageAsync(`
    (function(){
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '${path}';
      link.onload = onload;
      document.head.append(link);
      let resolve;
      const promise = new Promise(r => resolve = r);
      function onload() {
        // TODO(chenwilliam): It shouldn't be necessary to force
        // style recalc here but some tests rely on it.
        window.getComputedStyle(document.body).color;
        resolve();
      }
      return promise;
    })();
  `);
}
export function addIframe(path, options = {}) {
  options.id = options.id || "";
  options.name = options.name || "";
  return evaluateInPageAsync(`
    (function(){
      const iframe = document.createElement('iframe');
      iframe.src = '${path}';
      iframe.id = '${options.id}';
      iframe.name = '${options.name}';
      document.body.appendChild(iframe);
      return new Promise(f => iframe.onload = f);
    })();
  `);
}
export async function deprecatedInitAsync(code) {
  await TestRunner.RuntimeAgent.invoke_evaluate({ expression: code, objectGroup: "console" });
}
export function markStep(title) {
  addResult("\nRunning: " + title);
}
export function startDumpingProtocolMessages() {
  ProtocolClient.test.dumpProtocol = self.testRunner.logToStderr.bind(self.testRunner);
}
export function addScriptForFrame(url2, content, frame) {
  content += "\n//# sourceURL=" + url2;
  const executionContext = TestRunner.runtimeModel.executionContexts().find((context) => context.frameId === frame.id);
  TestRunner.RuntimeAgent.evaluate(content, "console", false, false, executionContext.id);
}
export const formatters = {
  formatAsTypeName(value) {
    return "<" + typeof value + ">";
  },
  formatAsTypeNameOrNull(value) {
    if (value === null) {
      return "null";
    }
    return formatters.formatAsTypeName(value);
  },
  formatAsRecentTime(value) {
    if (typeof value !== "object" || !(value instanceof Date)) {
      return formatters.formatAsTypeName(value);
    }
    const delta = Date.now() - value;
    return 0 <= delta && delta < 30 * 60 * 1e3 ? "<plausible>" : value;
  },
  formatAsURL(value) {
    if (!value) {
      return value;
    }
    const lastIndex = value.lastIndexOf("devtools/");
    if (lastIndex < 0) {
      return value;
    }
    return ".../" + value.substr(lastIndex);
  },
  formatAsDescription(value) {
    if (!value) {
      return value;
    }
    return '"' + value.replace(/^function [gs]et /, "function ") + '"';
  }
};
export function addObject(object, customFormatters, prefix, firstLinePrefix) {
  prefix = prefix || "";
  firstLinePrefix = firstLinePrefix || prefix;
  addResult(firstLinePrefix + "{");
  const propertyNames = Object.keys(object);
  propertyNames.sort();
  for (let i = 0; i < propertyNames.length; ++i) {
    const prop = propertyNames[i];
    if (!object.hasOwnProperty(prop)) {
      continue;
    }
    const prefixWithName = "    " + prefix + prop + " : ";
    const propValue = object[prop];
    if (customFormatters && customFormatters[prop]) {
      const formatterName = customFormatters[prop];
      if (formatterName !== "skip") {
        const formatter = formatters[formatterName];
        addResult(prefixWithName + formatter(propValue));
      }
    } else {
      dump(propValue, customFormatters, "    " + prefix, prefixWithName);
    }
  }
  addResult(prefix + "}");
}
export function addArray(array, customFormatters, prefix, firstLinePrefix) {
  prefix = prefix || "";
  firstLinePrefix = firstLinePrefix || prefix;
  addResult(firstLinePrefix + "[");
  for (let i = 0; i < array.length; ++i) {
    dump(array[i], customFormatters, prefix + "    ");
  }
  addResult(prefix + "]");
}
export function dumpDeepInnerHTML(node) {
  function innerHTML(prefix, node2) {
    const openTag = [];
    if (node2.nodeType === Node.TEXT_NODE) {
      if (!node2.parentElement || node2.parentElement.nodeName !== "STYLE") {
        addResult(node2.nodeValue);
      }
      return;
    }
    openTag.push("<" + node2.nodeName);
    const attrs = node2.attributes;
    for (let i = 0; attrs && i < attrs.length; ++i) {
      openTag.push(attrs[i].name + "=" + attrs[i].value);
    }
    openTag.push(">");
    addResult(prefix + openTag.join(" "));
    for (let child = node2.firstChild; child; child = child.nextSibling) {
      innerHTML(prefix + "    ", child);
    }
    if (node2.shadowRoot) {
      innerHTML(prefix + "    ", node2.shadowRoot);
    }
    addResult(prefix + "</" + node2.nodeName + ">");
  }
  innerHTML("", node);
}
export function deepTextContent(node) {
  if (!node) {
    return "";
  }
  if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
    return !node.parentElement || node.parentElement.nodeName !== "STYLE" ? node.nodeValue : "";
  }
  let res = "";
  const children = node.childNodes;
  for (let i = 0; i < children.length; ++i) {
    res += deepTextContent(children[i]);
  }
  if (node.shadowRoot) {
    res += deepTextContent(node.shadowRoot);
  }
  return res;
}
export function dump(value, customFormatters, prefix, prefixWithName) {
  prefixWithName = prefixWithName || prefix;
  if (prefixWithName && prefixWithName.length > 80) {
    addResult(prefixWithName + "was skipped due to prefix length limit");
    return;
  }
  if (value === null) {
    addResult(prefixWithName + "null");
  } else if (value && value.constructor && value.constructor.name === "Array") {
    addArray(value, customFormatters, prefix, prefixWithName);
  } else if (typeof value === "object") {
    addObject(value, customFormatters, prefix, prefixWithName);
  } else if (typeof value === "string") {
    addResult(prefixWithName + '"' + value + '"');
  } else {
    addResult(prefixWithName + value);
  }
}
export function waitForEvent(eventName, obj, condition) {
  condition = condition || function() {
    return true;
  };
  return new Promise((resolve) => {
    obj.addEventListener(eventName, onEventFired);
    function onEventFired(event) {
      if (!condition(event.data)) {
        return;
      }
      obj.removeEventListener(eventName, onEventFired);
      resolve(event.data);
    }
  });
}
export function waitForTarget(filter) {
  filter = filter || ((target) => true);
  for (const target of self.SDK.targetManager.targets()) {
    if (filter(target)) {
      return Promise.resolve(target);
    }
  }
  return new Promise((fulfill) => {
    const observer = {
      targetAdded: function(target) {
        if (filter(target)) {
          self.SDK.targetManager.unobserveTargets(observer);
          fulfill(target);
        }
      },
      targetRemoved: function() {
      }
    };
    self.SDK.targetManager.observeTargets(observer);
  });
}
export function waitForTargetRemoved(targetToRemove) {
  return new Promise((fulfill) => {
    const observer = {
      targetRemoved: function(target) {
        if (target === targetToRemove) {
          self.SDK.targetManager.unobserveTargets(observer);
          fulfill(target);
        }
      },
      targetAdded: function() {
      }
    };
    self.SDK.targetManager.observeTargets(observer);
  });
}
export function waitForExecutionContext(runtimeModel) {
  if (runtimeModel.executionContexts().length) {
    return Promise.resolve(runtimeModel.executionContexts()[0]);
  }
  return runtimeModel.once(SDK.RuntimeModel.Events.ExecutionContextCreated);
}
export function waitForExecutionContextDestroyed(context) {
  const runtimeModel = context.runtimeModel;
  if (runtimeModel.executionContexts().indexOf(context) === -1) {
    return Promise.resolve();
  }
  return waitForEvent(SDK.RuntimeModel.Events.ExecutionContextDestroyed, runtimeModel, (destroyedContext) => destroyedContext === context);
}
export function assertGreaterOrEqual(a, b, message) {
  if (a < b) {
    addResult("FAILED: " + (message ? message + ": " : "") + a + " < " + b);
  }
}
let _pageLoadedCallback;
export function navigate(url2, callback) {
  _pageLoadedCallback = safeWrap(callback);
  TestRunner.resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.Load, _pageNavigated);
  evaluateInPageAnonymously("window.location.replace('" + url2 + "')");
}
export function navigatePromise(url2) {
  return new Promise((fulfill) => navigate(url2, fulfill));
}
export function _pageNavigated() {
  TestRunner.resourceTreeModel.removeEventListener(SDK.ResourceTreeModel.Events.Load, _pageNavigated);
  _handlePageLoaded();
}
export function hardReloadPage(callback) {
  _innerReloadPage(true, void 0, callback);
}
export function reloadPage(callback) {
  _innerReloadPage(false, void 0, callback);
}
export function reloadPageWithInjectedScript(injectedScript, callback) {
  _innerReloadPage(false, injectedScript, callback);
}
export function reloadPagePromise() {
  return new Promise((fulfill) => reloadPage(fulfill));
}
export function _innerReloadPage(hardReload, injectedScript, callback) {
  _pageLoadedCallback = safeWrap(callback);
  TestRunner.resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.Load, pageLoaded);
  TestRunner.resourceTreeModel.reloadPage(hardReload, injectedScript);
}
export function pageLoaded() {
  TestRunner.resourceTreeModel.removeEventListener(SDK.ResourceTreeModel.Events.Load, pageLoaded);
  addResult("Page reloaded.");
  _handlePageLoaded();
}
export async function _handlePageLoaded() {
  await waitForExecutionContext(TestRunner.runtimeModel);
  if (_pageLoadedCallback) {
    const callback = _pageLoadedCallback;
    _pageLoadedCallback = void 0;
    callback();
  }
}
export function waitForPageLoad(callback) {
  TestRunner.resourceTreeModel.addEventListener(SDK.ResourceTreeModel.Events.Load, onLoaded);
  function onLoaded() {
    TestRunner.resourceTreeModel.removeEventListener(SDK.ResourceTreeModel.Events.Load, onLoaded);
    callback();
  }
}
export function runWhenPageLoads(callback) {
  const oldCallback = _pageLoadedCallback;
  function chainedCallback() {
    if (oldCallback) {
      oldCallback();
    }
    callback();
  }
  _pageLoadedCallback = safeWrap(chainedCallback);
}
export function runTestSuite(testSuite) {
  const testSuiteTests = testSuite.slice();
  function runner() {
    if (!testSuiteTests.length) {
      completeTest();
      return;
    }
    const nextTest = testSuiteTests.shift();
    addResult("");
    addResult("Running: " + /function\s([^(]*)/.exec(nextTest)[1]);
    safeWrap(nextTest)(runner);
  }
  runner();
}
export async function runAsyncTestSuite(testSuite) {
  for (const nextTest of testSuite) {
    addResult("");
    addResult("Running: " + /function\s([^(]*)/.exec(nextTest)[1]);
    await safeAsyncWrap(nextTest)();
  }
  completeTest();
}
export function assertEquals(expected, found, message) {
  if (expected === found) {
    return;
  }
  let error;
  if (message) {
    error = "Failure (" + message + "):";
  } else {
    error = "Failure:";
  }
  throw new Error(error + " expected <" + expected + "> found <" + found + ">");
}
export function assertTrue(found, message) {
  assertEquals(true, Boolean(found), message);
}
export function override(receiver, methodName, override2, opt_sticky) {
  override2 = safeWrap(override2);
  const original = receiver[methodName];
  if (typeof original !== "function") {
    throw new Error("Cannot find method to override: " + methodName);
  }
  receiver[methodName] = function(var_args) {
    try {
      return override2.apply(this, arguments);
    } catch (e) {
      throw new Error("Exception in overriden method '" + methodName + "': " + e);
    } finally {
      if (!opt_sticky) {
        receiver[methodName] = original;
      }
    }
  };
  return original;
}
export function clearSpecificInfoFromStackFrames(text) {
  let buffer = text.replace(/\(file:\/\/\/(?:[^)]+\)|[\w\/:-]+)/g, "(...)");
  buffer = buffer.replace(/\(http:\/\/(?:[^)]+\)|[\w\/:-]+)/g, "(...)");
  buffer = buffer.replace(/\(test:\/\/(?:[^)]+\)|[\w\/:-]+)/g, "(...)");
  buffer = buffer.replace(/\(<anonymous>:[^)]+\)/g, "(...)");
  buffer = buffer.replace(/VM\d+/g, "VM");
  return buffer.replace(/\s*at[^()]+\(native\)/g, "");
}
export function hideInspectorView() {
  UI.InspectorView.InspectorView.instance().element.setAttribute("style", "display:none !important");
}
export function mainFrame() {
  return TestRunner.resourceTreeModel.mainFrame;
}
export class StringOutputStream {
  constructor(callback) {
    this.callback = callback;
    this.buffer = "";
  }
  async open(fileName) {
    return true;
  }
  async write(chunk) {
    this.buffer += chunk;
  }
  async close() {
    this.callback(this.buffer);
  }
}
export class MockSetting {
  constructor(value) {
    this.value = value;
  }
  get() {
    return this.value;
  }
  set(value) {
    this.value = value;
  }
}
export function waitForUISourceCode(urlSuffix, projectType) {
  function matches(uiSourceCode) {
    if (projectType && uiSourceCode.project().type() !== projectType) {
      return false;
    }
    if (!projectType && uiSourceCode.project().type() === Workspace.Workspace.projectTypes.Service) {
      return false;
    }
    if (urlSuffix && !uiSourceCode.url().endsWith(urlSuffix)) {
      return false;
    }
    return true;
  }
  for (const uiSourceCode of self.Workspace.workspace.uiSourceCodes()) {
    if (urlSuffix && matches(uiSourceCode)) {
      return Promise.resolve(uiSourceCode);
    }
  }
  return waitForEvent(Workspace.Workspace.Events.UISourceCodeAdded, self.Workspace.workspace, matches);
}
export function waitForUISourceCodeRemoved(callback) {
  self.Workspace.workspace.once(Workspace.Workspace.Events.UISourceCodeRemoved).then(callback);
}
export function url(url2 = "") {
  const testScriptURL = Root.Runtime.Runtime.queryParam("test");
  return new URL(url2, testScriptURL + "/../").href;
}
export function dumpSyntaxHighlight(str, mimeType) {
  const node = document.createElement("span");
  node.textContent = str;
  return CodeHighlighter.CodeHighlighter.highlightNode(node, mimeType).then(dumpSyntax);
  function dumpSyntax() {
    const node_parts = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      if (node.childNodes[i].getAttribute) {
        node_parts.push(node.childNodes[i].getAttribute("class"));
      } else {
        node_parts.push("*");
      }
    }
    addResult(str + ": " + node_parts.join(", "));
  }
}
const findIndexesOfSubString = function(inputString, searchString) {
  const matches = [];
  let i = inputString.indexOf(searchString);
  while (i !== -1) {
    matches.push(i);
    i = inputString.indexOf(searchString, i + searchString.length);
  }
  return matches;
};
export const findLineEndingIndexes = function(inputString) {
  const endings = findIndexesOfSubString(inputString, "\n");
  endings.push(inputString.length);
  return endings;
};
export async function dumpInspectedPageElementText(querySelector) {
  const value = await evaluateInPageAsync(`document.querySelector('${querySelector}').innerText`);
  addResult(value);
}
export async function waitForPendingLiveLocationUpdates() {
  await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().pendingLiveLocationChangesPromise();
  await Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance().pendingLiveLocationChangesPromise();
}
self.testRunner;
TestRunner.StringOutputStream = StringOutputStream;
TestRunner.MockSetting = MockSetting;
TestRunner.formatters = formatters;
TestRunner.completeTest = completeTest;
TestRunner.addResult = addResult;
TestRunner.addResults = addResults;
TestRunner.runTests = runTests;
TestRunner.addSniffer = addSniffer;
TestRunner.addSnifferPromise = addSnifferPromise;
TestRunner.showPanel = showPanel;
TestRunner.createKeyEvent = createKeyEvent;
TestRunner.safeWrap = safeWrap;
TestRunner.textContentWithLineBreaks = textContentWithLineBreaks;
TestRunner.textContentWithLineBreaksTrimmed = textContentWithLineBreaksTrimmed;
TestRunner.textContentWithoutStyles = textContentWithoutStyles;
TestRunner.evaluateInPagePromise = evaluateInPagePromise;
TestRunner.callFunctionInPageAsync = callFunctionInPageAsync;
TestRunner.evaluateInPageWithTimeout = evaluateInPageWithTimeout;
TestRunner.evaluateFunctionInOverlay = evaluateFunctionInOverlay;
TestRunner.check = check;
TestRunner.deprecatedRunAfterPendingDispatches = deprecatedRunAfterPendingDispatches;
TestRunner.loadHTML = loadHTML;
TestRunner.addScriptTag = addScriptTag;
TestRunner.addStylesheetTag = addStylesheetTag;
TestRunner.addIframe = addIframe;
TestRunner.markStep = markStep;
TestRunner.startDumpingProtocolMessages = startDumpingProtocolMessages;
TestRunner.addScriptForFrame = addScriptForFrame;
TestRunner.addObject = addObject;
TestRunner.addArray = addArray;
TestRunner.dumpDeepInnerHTML = dumpDeepInnerHTML;
TestRunner.deepTextContent = deepTextContent;
TestRunner.dump = dump;
TestRunner.waitForEvent = waitForEvent;
TestRunner.waitForTarget = waitForTarget;
TestRunner.waitForTargetRemoved = waitForTargetRemoved;
TestRunner.waitForExecutionContext = waitForExecutionContext;
TestRunner.waitForExecutionContextDestroyed = waitForExecutionContextDestroyed;
TestRunner.assertGreaterOrEqual = assertGreaterOrEqual;
TestRunner.navigate = navigate;
TestRunner.navigatePromise = navigatePromise;
TestRunner.hardReloadPage = hardReloadPage;
TestRunner.reloadPage = reloadPage;
TestRunner.reloadPageWithInjectedScript = reloadPageWithInjectedScript;
TestRunner.reloadPagePromise = reloadPagePromise;
TestRunner.pageLoaded = pageLoaded;
TestRunner.waitForPageLoad = waitForPageLoad;
TestRunner.runWhenPageLoads = runWhenPageLoads;
TestRunner.runTestSuite = runTestSuite;
TestRunner.assertEquals = assertEquals;
TestRunner.assertTrue = assertTrue;
TestRunner.override = override;
TestRunner.clearSpecificInfoFromStackFrames = clearSpecificInfoFromStackFrames;
TestRunner.hideInspectorView = hideInspectorView;
TestRunner.mainFrame = mainFrame;
TestRunner.waitForUISourceCode = waitForUISourceCode;
TestRunner.waitForUISourceCodeRemoved = waitForUISourceCodeRemoved;
TestRunner.url = url;
TestRunner.dumpSyntaxHighlight = dumpSyntaxHighlight;
TestRunner.loadLegacyModule = loadLegacyModule;
TestRunner.loadTestModule = loadTestModule;
TestRunner.evaluateInPageRemoteObject = evaluateInPageRemoteObject;
TestRunner.evaluateInPage = evaluateInPage;
TestRunner.evaluateInPageAnonymously = evaluateInPageAnonymously;
TestRunner.evaluateInPageAsync = evaluateInPageAsync;
TestRunner.deprecatedInitAsync = deprecatedInitAsync;
TestRunner.runAsyncTestSuite = runAsyncTestSuite;
TestRunner.dumpInspectedPageElementText = dumpInspectedPageElementText;
TestRunner.waitForPendingLiveLocationUpdates = waitForPendingLiveLocationUpdates;
TestRunner.findLineEndingIndexes = findLineEndingIndexes;
TestRunner.isScrolledToBottom = UI.UIUtils.isScrolledToBottom;
//# sourceMappingURL=TestRunner.js.map
