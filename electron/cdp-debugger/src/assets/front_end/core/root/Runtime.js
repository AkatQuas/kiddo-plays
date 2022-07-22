import * as Platform from "../platform/platform.js";
const queryParamsObject = new URLSearchParams(location.search);
let runtimePlatform = "";
let runtimeInstance;
export function getRemoteBase(location2 = self.location.toString()) {
  const url = new URL(location2);
  const remoteBase = url.searchParams.get("remoteBase");
  if (!remoteBase) {
    return null;
  }
  const version = /\/serve_file\/(@[0-9a-zA-Z]+)\/?$/.exec(remoteBase);
  if (!version) {
    return null;
  }
  return { base: `${url.origin}/remote/serve_file/${version[1]}/`, version: version[1] };
}
export class Runtime {
  constructor() {
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!runtimeInstance || forceNew) {
      runtimeInstance = new Runtime();
    }
    return runtimeInstance;
  }
  static removeInstance() {
    runtimeInstance = void 0;
  }
  static queryParam(name) {
    return queryParamsObject.get(name);
  }
  static setQueryParamForTesting(name, value) {
    queryParamsObject.set(name, value);
  }
  static experimentsSetting() {
    try {
      return JSON.parse(self.localStorage && self.localStorage["experiments"] ? self.localStorage["experiments"] : "{}");
    } catch (e) {
      console.error("Failed to parse localStorage['experiments']");
      return {};
    }
  }
  static setPlatform(platform) {
    runtimePlatform = platform;
  }
  static platform() {
    return runtimePlatform;
  }
  static isDescriptorEnabled(descriptor) {
    const activatorExperiment = descriptor["experiment"];
    if (activatorExperiment === "*") {
      return true;
    }
    if (activatorExperiment && activatorExperiment.startsWith("!") && experiments.isEnabled(activatorExperiment.substring(1))) {
      return false;
    }
    if (activatorExperiment && !activatorExperiment.startsWith("!") && !experiments.isEnabled(activatorExperiment)) {
      return false;
    }
    const condition = descriptor["condition"];
    if (condition && !condition.startsWith("!") && !Runtime.queryParam(condition)) {
      return false;
    }
    if (condition && condition.startsWith("!") && Runtime.queryParam(condition.substring(1))) {
      return false;
    }
    return true;
  }
  loadLegacyModule(modulePath) {
    return import(`../../${modulePath}`);
  }
}
export class ExperimentsSupport {
  #experiments;
  #experimentNames;
  #enabledTransiently;
  #enabledByDefault;
  #serverEnabled;
  constructor() {
    this.#experiments = [];
    this.#experimentNames = /* @__PURE__ */ new Set();
    this.#enabledTransiently = /* @__PURE__ */ new Set();
    this.#enabledByDefault = /* @__PURE__ */ new Set();
    this.#serverEnabled = /* @__PURE__ */ new Set();
  }
  allConfigurableExperiments() {
    const result = [];
    for (const experiment of this.#experiments) {
      if (!this.#enabledTransiently.has(experiment.name)) {
        result.push(experiment);
      }
    }
    return result;
  }
  enabledExperiments() {
    return this.#experiments.filter((experiment) => experiment.isEnabled());
  }
  setExperimentsSetting(value) {
    if (!self.localStorage) {
      return;
    }
    self.localStorage["experiments"] = JSON.stringify(value);
  }
  register(experimentName, experimentTitle, unstable, docLink) {
    Platform.DCHECK(() => !this.#experimentNames.has(experimentName), "Duplicate registration of experiment " + experimentName);
    this.#experimentNames.add(experimentName);
    this.#experiments.push(new Experiment(this, experimentName, experimentTitle, Boolean(unstable), docLink ?? Platform.DevToolsPath.EmptyUrlString));
  }
  isEnabled(experimentName) {
    this.checkExperiment(experimentName);
    if (Runtime.experimentsSetting()[experimentName] === false) {
      return false;
    }
    if (this.#enabledTransiently.has(experimentName) || this.#enabledByDefault.has(experimentName)) {
      return true;
    }
    if (this.#serverEnabled.has(experimentName)) {
      return true;
    }
    return Boolean(Runtime.experimentsSetting()[experimentName]);
  }
  setEnabled(experimentName, enabled) {
    this.checkExperiment(experimentName);
    const experimentsSetting = Runtime.experimentsSetting();
    experimentsSetting[experimentName] = enabled;
    this.setExperimentsSetting(experimentsSetting);
  }
  enableExperimentsTransiently(experimentNames) {
    for (const experimentName of experimentNames) {
      this.checkExperiment(experimentName);
      this.#enabledTransiently.add(experimentName);
    }
  }
  enableExperimentsByDefault(experimentNames) {
    for (const experimentName of experimentNames) {
      this.checkExperiment(experimentName);
      this.#enabledByDefault.add(experimentName);
    }
  }
  setServerEnabledExperiments(experimentNames) {
    for (const experiment of experimentNames) {
      this.checkExperiment(experiment);
      this.#serverEnabled.add(experiment);
    }
  }
  enableForTest(experimentName) {
    this.checkExperiment(experimentName);
    this.#enabledTransiently.add(experimentName);
  }
  disableForTest(experimentName) {
    this.checkExperiment(experimentName);
    this.#enabledTransiently.delete(experimentName);
  }
  clearForTest() {
    this.#experiments = [];
    this.#experimentNames.clear();
    this.#enabledTransiently.clear();
    this.#enabledByDefault.clear();
    this.#serverEnabled.clear();
  }
  cleanUpStaleExperiments() {
    const experimentsSetting = Runtime.experimentsSetting();
    const cleanedUpExperimentSetting = {};
    for (const { name: experimentName } of this.#experiments) {
      if (experimentsSetting.hasOwnProperty(experimentName)) {
        const isEnabled = experimentsSetting[experimentName];
        if (isEnabled || this.#enabledByDefault.has(experimentName)) {
          cleanedUpExperimentSetting[experimentName] = isEnabled;
        }
      }
    }
    this.setExperimentsSetting(cleanedUpExperimentSetting);
  }
  checkExperiment(experimentName) {
    Platform.DCHECK(() => this.#experimentNames.has(experimentName), "Unknown experiment " + experimentName);
  }
}
export class Experiment {
  name;
  title;
  unstable;
  docLink;
  #experiments;
  constructor(experiments2, name, title, unstable, docLink) {
    this.name = name;
    this.title = title;
    this.unstable = unstable;
    this.docLink = docLink;
    this.#experiments = experiments2;
  }
  isEnabled() {
    return this.#experiments.isEnabled(this.name);
  }
  setEnabled(enabled) {
    this.#experiments.setEnabled(this.name, enabled);
  }
}
export const experiments = new ExperimentsSupport();
export var ExperimentName = /* @__PURE__ */ ((ExperimentName2) => {
  ExperimentName2["CAPTURE_NODE_CREATION_STACKS"] = "captureNodeCreationStacks";
  ExperimentName2["CSS_OVERVIEW"] = "cssOverview";
  ExperimentName2["LIVE_HEAP_PROFILE"] = "liveHeapProfile";
  ExperimentName2["DEVELOPER_RESOURCES_VIEW"] = "developerResourcesView";
  ExperimentName2["TIMELINE_REPLAY_EVENT"] = "timelineReplayEvent";
  ExperimentName2["CSP_VIOLATIONS_VIEW"] = "cspViolationsView";
  ExperimentName2["WASM_DWARF_DEBUGGING"] = "wasmDWARFDebugging";
  ExperimentName2["ALL"] = "*";
  ExperimentName2["PROTOCOL_MONITOR"] = "protocolMonitor";
  ExperimentName2["WEBAUTHN_PANE"] = "webauthnPane";
  ExperimentName2["SYNC_SETTINGS"] = "syncSettings";
  ExperimentName2["FULL_ACCESSIBILITY_TREE"] = "fullAccessibilityTree";
  ExperimentName2["PRECISE_CHANGES"] = "preciseChanges";
  ExperimentName2["STYLES_PANE_CSS_CHANGES"] = "stylesPaneCSSChanges";
  ExperimentName2["HEADER_OVERRIDES"] = "headerOverrides";
  ExperimentName2["CSS_LAYERS"] = "cssLayers";
  ExperimentName2["EYEDROPPER_COLOR_PICKER"] = "eyedropperColorPicker";
  ExperimentName2["INSTRUMENTATION_BREAKPOINTS"] = "instrumentationBreakpoints";
  ExperimentName2["CSS_AUTHORING_HINTS"] = "cssAuthoringHints";
  ExperimentName2["AUTHORED_DEPLOYED_GROUPING"] = "authoredDeployedGrouping";
  return ExperimentName2;
})(ExperimentName || {});
export var ConditionName = /* @__PURE__ */ ((ConditionName2) => {
  ConditionName2["CAN_DOCK"] = "can_dock";
  ConditionName2["NOT_SOURCES_HIDE_ADD_FOLDER"] = "!sources.hide_add_folder";
  return ConditionName2;
})(ConditionName || {});
//# sourceMappingURL=Runtime.js.map
