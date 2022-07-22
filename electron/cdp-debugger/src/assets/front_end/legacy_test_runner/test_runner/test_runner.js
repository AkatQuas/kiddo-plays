import * as Platform from "../../core/platform/platform.js";
import * as TestRunner from "./TestRunner.js";
export {
  TestRunner
};
self.Platform = self.Platform || {};
self.Platform.StringUtilities = Platform.StringUtilities;
function _setupTestHelpers(target) {
  self.TestRunner.BrowserAgent = target.browserAgent();
  self.TestRunner.CSSAgent = target.cssAgent();
  self.TestRunner.DeviceOrientationAgent = target.deviceOrientationAgent();
  self.TestRunner.DOMAgent = target.domAgent();
  self.TestRunner.DOMDebuggerAgent = target.domdebuggerAgent();
  self.TestRunner.DebuggerAgent = target.debuggerAgent();
  self.TestRunner.EmulationAgent = target.emulationAgent();
  self.TestRunner.HeapProfilerAgent = target.heapProfilerAgent();
  self.TestRunner.InputAgent = target.inputAgent();
  self.TestRunner.InspectorAgent = target.inspectorAgent();
  self.TestRunner.NetworkAgent = target.networkAgent();
  self.TestRunner.OverlayAgent = target.overlayAgent();
  self.TestRunner.PageAgent = target.pageAgent();
  self.TestRunner.ProfilerAgent = target.profilerAgent();
  self.TestRunner.RuntimeAgent = target.runtimeAgent();
  self.TestRunner.TargetAgent = target.targetAgent();
  self.TestRunner.networkManager = target.model(SDK.NetworkManager);
  self.TestRunner.securityOriginManager = target.model(SDK.SecurityOriginManager);
  self.TestRunner.resourceTreeModel = target.model(SDK.ResourceTreeModel);
  self.TestRunner.debuggerModel = target.model(SDK.DebuggerModel);
  self.TestRunner.runtimeModel = target.model(SDK.RuntimeModel);
  self.TestRunner.domModel = target.model(SDK.DOMModel);
  self.TestRunner.domDebuggerModel = target.model(SDK.DOMDebuggerModel);
  self.TestRunner.cssModel = target.model(SDK.CSSModel);
  self.TestRunner.cpuProfilerModel = target.model(SDK.CPUProfilerModel);
  self.TestRunner.overlayModel = target.model(SDK.OverlayModel);
  self.TestRunner.serviceWorkerManager = target.model(SDK.ServiceWorkerManager);
  self.TestRunner.tracingManager = target.model(SDK.TracingManager);
  self.TestRunner.mainTarget = target;
}
export async function _executeTestScript() {
  const testScriptURL = Root.Runtime.queryParam("test");
  if (TestRunner.isDebugTest()) {
    TestRunner.setInnerResult(console.log);
    TestRunner.setInnerCompleteTest(() => console.log("Test completed"));
    self.test = async function() {
      await import(testScriptURL);
    };
    return;
  }
  try {
    await import(testScriptURL);
  } catch (err) {
    TestRunner.addResult("TEST ENDED EARLY DUE TO UNCAUGHT ERROR:");
    TestRunner.addResult(err && err.stack || err);
    TestRunner.addResult("=== DO NOT COMMIT THIS INTO -expected.txt ===");
    TestRunner.completeTest();
  }
}
let _startedTest = false;
export class _TestObserver {
  targetAdded(target) {
    if (target.id() === "main") {
      _setupTestHelpers(target);
    }
    if (_startedTest) {
      return;
    }
    _startedTest = true;
    TestRunner.loadHTML(`
      <head>
        <base href="${TestRunner.url()}">
      </head>
      <body>
      </body>
    `).then(() => _executeTestScript());
  }
  targetRemoved(target) {
  }
}
SDK.targetManager.observeTargets(new _TestObserver());
//# sourceMappingURL=test_runner.js.map
