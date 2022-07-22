import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Workspace from "../workspace/workspace.js";
import { ContentProviderBasedProject } from "./ContentProviderBasedProject.js";
import { NetworkProject } from "./NetworkProject.js";
const UIStrings = {
  errorInDebuggerLanguagePlugin: "Error in debugger language plugin: {PH1}",
  loadingDebugSymbolsForVia: "[{PH1}] Loading debug symbols for {PH2} (via {PH3})...",
  loadingDebugSymbolsFor: "[{PH1}] Loading debug symbols for {PH2}...",
  loadedDebugSymbolsForButDidnt: "[{PH1}] Loaded debug symbols for {PH2}, but didn't find any source files",
  loadedDebugSymbolsForFound: "[{PH1}] Loaded debug symbols for {PH2}, found {PH3} source file(s)",
  failedToLoadDebugSymbolsFor: "[{PH1}] Failed to load debug symbols for {PH2} ({PH3})",
  failedToLoadDebugSymbolsForFunction: 'No debug information for function "{PH1}"',
  debugSymbolsIncomplete: "The debug information for function {PH1} is incomplete"
};
const str_ = i18n.i18n.registerUIStrings("models/bindings/DebuggerLanguagePlugins.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
class SourceType {
  typeInfo;
  members;
  typeMap;
  constructor(typeInfo, members, typeMap) {
    this.typeInfo = typeInfo;
    this.members = members;
    this.typeMap = typeMap;
  }
  static create(typeInfos) {
    if (typeInfos.length === 0) {
      return null;
    }
    const typeMap = /* @__PURE__ */ new Map();
    for (const typeInfo of typeInfos) {
      typeMap.set(typeInfo.typeId, new SourceType(typeInfo, [], typeMap));
    }
    for (const sourceType of typeMap.values()) {
      sourceType.members = sourceType.typeInfo.members.map(({ typeId }) => {
        const memberType = typeMap.get(typeId);
        if (!memberType) {
          throw new Error(`Incomplete type information for type ${typeInfos[0].typeNames[0] || "<anonymous>"}`);
        }
        return memberType;
      });
    }
    return typeMap.get(typeInfos[0].typeId) || null;
  }
}
function rawModuleIdForScript(script) {
  return `${script.sourceURL}@${script.hash}`;
}
function getRawLocation(callFrame) {
  const { script } = callFrame;
  return {
    rawModuleId: rawModuleIdForScript(script),
    codeOffset: callFrame.location().columnNumber - (script.codeOffset() || 0),
    inlineFrameIndex: callFrame.inlineFrameIndex
  };
}
async function resolveRemoteObject(callFrame, object) {
  if (typeof object.value !== "undefined") {
    return object.value;
  }
  const response = await callFrame.debuggerModel.target().runtimeAgent().invoke_callFunctionOn({ functionDeclaration: "function() { return this; }", objectId: object.objectId, returnByValue: true });
  const { result } = response;
  if (!result) {
    return void 0;
  }
  return result.value;
}
export class ValueNode extends SDK.RemoteObject.RemoteObjectImpl {
  inspectableAddress;
  callFrame;
  constructor(callFrame, objectId, type, subtype, value, inspectableAddress, unserializableValue, description, preview, customPreview, className) {
    super(callFrame.debuggerModel.runtimeModel(), objectId, type, subtype, value, unserializableValue, description, preview, customPreview, className);
    this.inspectableAddress = inspectableAddress;
    this.callFrame = callFrame;
  }
}
async function getValueTreeForExpression(callFrame, plugin, expression, evalOptions) {
  const location = getRawLocation(callFrame);
  let typeInfo;
  try {
    typeInfo = await plugin.getTypeInfo(expression, location);
  } catch (e) {
    FormattingError.throwLocal(callFrame, e.message);
  }
  if (!typeInfo) {
    return new SDK.RemoteObject.LocalJSONObject(void 0);
  }
  const { base, typeInfos } = typeInfo;
  const sourceType = SourceType.create(typeInfos);
  if (!sourceType) {
    return new SDK.RemoteObject.LocalJSONObject(void 0);
  }
  if (sourceType.typeInfo.hasValue && !sourceType.typeInfo.canExpand && base) {
    return formatSourceValue(callFrame, plugin, sourceType, base, [], evalOptions);
  }
  const address = await StaticallyTypedValueNode.getInspectableAddress(callFrame, plugin, base, [], evalOptions);
  return new StaticallyTypedValueNode(callFrame, plugin, sourceType, base, [], evalOptions, address);
}
async function formatSourceValue(callFrame, plugin, sourceType, base, field, evalOptions) {
  const location = getRawLocation(callFrame);
  let evalCode = await plugin.getFormatter({ base, field }, location);
  if (!evalCode) {
    evalCode = { js: "" };
  }
  const response = await callFrame.debuggerModel.target().debuggerAgent().invoke_evaluateOnCallFrame({
    callFrameId: callFrame.id,
    expression: evalCode.js,
    objectGroup: evalOptions.objectGroup,
    includeCommandLineAPI: evalOptions.includeCommandLineAPI,
    silent: evalOptions.silent,
    returnByValue: evalOptions.returnByValue,
    generatePreview: evalOptions.generatePreview,
    throwOnSideEffect: evalOptions.throwOnSideEffect,
    timeout: evalOptions.timeout
  });
  const error = response.getError();
  if (error) {
    throw new Error(error);
  }
  const { result, exceptionDetails } = response;
  if (exceptionDetails) {
    throw new FormattingError(callFrame.debuggerModel.runtimeModel().createRemoteObject(result), exceptionDetails);
  }
  const object = new FormattedValueNode(callFrame, sourceType, plugin, result, null, evalOptions, void 0);
  const unpackedResultObject = await unpackResultObject(object);
  const node = unpackedResultObject || object;
  if (typeof node.value === "undefined" && node.type !== "undefined") {
    node.description = sourceType.typeInfo.typeNames[0];
  }
  return node;
  async function unpackResultObject(object2) {
    const { tag, value, inspectableAddress, description } = await object2.findProperties("tag", "value", "inspectableAddress", "description");
    if (!tag || !value) {
      return null;
    }
    const { className, symbol } = await tag.findProperties("className", "symbol");
    if (!className || !symbol) {
      return null;
    }
    const resolvedClassName = className.value;
    if (typeof resolvedClassName !== "string" || typeof symbol.objectId === "undefined") {
      return null;
    }
    const descriptionText = description?.value;
    if (typeof descriptionText === "string") {
      value.description = descriptionText;
    }
    value.formatterTag = { symbol: symbol.objectId, className: resolvedClassName };
    value.inspectableAddress = inspectableAddress ? inspectableAddress.value : void 0;
    return value;
  }
}
class FormattedValueNode extends ValueNode {
  #plugin;
  #sourceType;
  formatterTag;
  #evalOptions;
  constructor(callFrame, sourceType, plugin, object, formatterTag, evalOptions, inspectableAddress) {
    super(callFrame, object.objectId, object.type, object.subtype, object.value, inspectableAddress, object.unserializableValue, object.description, object.preview, object.customPreview, object.className);
    this.#plugin = plugin;
    this.#sourceType = sourceType;
    this.formatterTag = formatterTag;
    this.#evalOptions = evalOptions;
  }
  async findProperties(...properties) {
    const result = {};
    for (const prop of (await this.getOwnProperties(false)).properties || []) {
      if (properties.indexOf(prop.name) >= 0) {
        if (prop.value) {
          result[prop.name] = prop.value;
        }
      }
    }
    return result;
  }
  async createRemoteObject(newObject) {
    const base = await this.getEvalBaseFromObject(newObject);
    if (!base) {
      return new FormattedValueNode(this.callFrame, this.#sourceType, this.#plugin, newObject, this.formatterTag, this.#evalOptions, void 0);
    }
    const newSourceType = this.#sourceType.typeMap.get(base.rootType.typeId);
    if (!newSourceType) {
      throw new Error("Unknown typeId in eval base");
    }
    if (base.rootType.hasValue && !base.rootType.canExpand && base) {
      return formatSourceValue(this.callFrame, this.#plugin, newSourceType, base, [], this.#evalOptions);
    }
    const address = await StaticallyTypedValueNode.getInspectableAddress(this.callFrame, this.#plugin, base, [], this.#evalOptions);
    return new StaticallyTypedValueNode(this.callFrame, this.#plugin, newSourceType, base, [], this.#evalOptions, address);
  }
  async getEvalBaseFromObject(object) {
    const { objectId } = object;
    if (!object || !this.formatterTag) {
      return null;
    }
    const { className, symbol } = this.formatterTag;
    if (className !== object.className) {
      return null;
    }
    const response = await this.debuggerModel().target().runtimeAgent().invoke_callFunctionOn({
      functionDeclaration: "function(sym) { return this[sym]; }",
      objectId,
      arguments: [{ objectId: symbol }]
    });
    const { result } = response;
    if (!result || result.type === "undefined") {
      return null;
    }
    const baseObject = new FormattedValueNode(this.callFrame, this.#sourceType, this.#plugin, result, null, this.#evalOptions, void 0);
    const { payload, rootType } = await baseObject.findProperties("payload", "rootType");
    if (typeof payload === "undefined" || typeof rootType === "undefined") {
      return null;
    }
    const value = await resolveRemoteObject(this.callFrame, payload);
    const { typeId } = await rootType.findProperties("typeId");
    if (typeof value === "undefined" || typeof typeId === "undefined") {
      return null;
    }
    const newSourceType = this.#sourceType.typeMap.get(typeId.value);
    if (!newSourceType) {
      return null;
    }
    return { payload: value, rootType: newSourceType.typeInfo };
  }
}
class FormattingError extends Error {
  exception;
  exceptionDetails;
  constructor(exception, exceptionDetails) {
    const { description } = exceptionDetails.exception || {};
    super(description || exceptionDetails.text);
    this.exception = exception;
    this.exceptionDetails = exceptionDetails;
  }
  static throwLocal(callFrame, message) {
    const exception = {
      type: Protocol.Runtime.RemoteObjectType.Object,
      subtype: Protocol.Runtime.RemoteObjectSubtype.Error,
      description: message
    };
    const exceptionDetails = { text: "Uncaught", exceptionId: -1, columnNumber: 0, lineNumber: 0, exception };
    const errorObject = callFrame.debuggerModel.runtimeModel().createRemoteObject(exception);
    throw new FormattingError(errorObject, exceptionDetails);
  }
}
class StaticallyTypedValueNode extends ValueNode {
  #variableType;
  #plugin;
  #sourceType;
  #base;
  #fieldChain;
  #evalOptions;
  constructor(callFrame, plugin, sourceType, base, fieldChain, evalOptions, inspectableAddress) {
    const typeName = sourceType.typeInfo.typeNames[0] || "<anonymous>";
    const variableType = "object";
    super(callFrame, void 0, variableType, void 0, null, inspectableAddress, void 0, typeName, void 0, void 0, typeName);
    this.#variableType = variableType;
    this.#plugin = plugin;
    this.#sourceType = sourceType;
    this.#base = base;
    this.#fieldChain = fieldChain;
    this.hasChildrenInternal = true;
    this.#evalOptions = evalOptions;
  }
  get type() {
    return this.#variableType;
  }
  async expandMember(sourceType, fieldInfo) {
    const fieldChain = this.#fieldChain.concat(fieldInfo);
    if (sourceType.typeInfo.hasValue && !sourceType.typeInfo.canExpand && this.#base) {
      return formatSourceValue(this.callFrame, this.#plugin, sourceType, this.#base, fieldChain, this.#evalOptions);
    }
    const address = this.inspectableAddress !== void 0 ? this.inspectableAddress + fieldInfo.offset : void 0;
    return new StaticallyTypedValueNode(this.callFrame, this.#plugin, sourceType, this.#base, fieldChain, this.#evalOptions, address);
  }
  static async getInspectableAddress(callFrame, plugin, base, field, evalOptions) {
    if (!base) {
      return void 0;
    }
    const addressCode = await plugin.getInspectableAddress({ base, field });
    if (!addressCode.js) {
      return void 0;
    }
    const response = await callFrame.debuggerModel.target().debuggerAgent().invoke_evaluateOnCallFrame({
      callFrameId: callFrame.id,
      expression: addressCode.js,
      objectGroup: evalOptions.objectGroup,
      includeCommandLineAPI: evalOptions.includeCommandLineAPI,
      silent: evalOptions.silent,
      returnByValue: true,
      generatePreview: evalOptions.generatePreview,
      throwOnSideEffect: evalOptions.throwOnSideEffect,
      timeout: evalOptions.timeout
    });
    const error = response.getError();
    if (error) {
      throw new Error(error);
    }
    const { result, exceptionDetails } = response;
    if (exceptionDetails) {
      throw new FormattingError(callFrame.debuggerModel.runtimeModel().createRemoteObject(result), exceptionDetails);
    }
    const address = result.value;
    if (!Number.isSafeInteger(address) || address < 0) {
      console.error(`Inspectable address is not a positive, safe integer: ${address}`);
      return void 0;
    }
    return address;
  }
  async doGetProperties(_ownProperties, accessorPropertiesOnly, _generatePreview) {
    const { typeInfo } = this.#sourceType;
    if (accessorPropertiesOnly || !typeInfo.canExpand) {
      return { properties: [], internalProperties: [] };
    }
    if (typeInfo.members.length > 0) {
      if (typeInfo.arraySize > 0) {
        const { typeId } = this.#sourceType.typeInfo.members[0];
        const properties = [];
        const elementTypeInfo = this.#sourceType.members[0];
        for (let i = 0; i < typeInfo.arraySize; ++i) {
          const name = `${i}`;
          const elementField = { name, typeId, offset: elementTypeInfo.typeInfo.size * i };
          properties.push(new SDK.RemoteObject.RemoteObjectProperty(name, await this.expandMember(elementTypeInfo, elementField), false, false, true, false));
        }
        return { properties, internalProperties: [] };
      }
      const members = Promise.all(this.#sourceType.members.map(async (memberTypeInfo, idx) => {
        const fieldInfo = this.#sourceType.typeInfo.members[idx];
        const propertyObject = await this.expandMember(memberTypeInfo, fieldInfo);
        const name = fieldInfo.name || "";
        return new SDK.RemoteObject.RemoteObjectProperty(name, propertyObject, false, false, true, false);
      }));
      return { properties: await members, internalProperties: [] };
    }
    return { properties: [], internalProperties: [] };
  }
}
class NamespaceObject extends SDK.RemoteObject.LocalJSONObject {
  constructor(value) {
    super(value);
  }
  get description() {
    return this.type;
  }
  get type() {
    return "namespace";
  }
}
class SourceScopeRemoteObject extends SDK.RemoteObject.RemoteObjectImpl {
  variables;
  #callFrame;
  #plugin;
  constructor(callFrame, plugin) {
    super(callFrame.debuggerModel.runtimeModel(), void 0, "object", void 0, null);
    this.variables = [];
    this.#callFrame = callFrame;
    this.#plugin = plugin;
  }
  async doGetProperties(ownProperties, accessorPropertiesOnly, _generatePreview) {
    if (accessorPropertiesOnly) {
      return { properties: [], internalProperties: [] };
    }
    const properties = [];
    const namespaces = {};
    function makeProperty(name, obj) {
      return new SDK.RemoteObject.RemoteObjectProperty(name, obj, false, false, true, false);
    }
    for (const variable of this.variables) {
      let sourceVar;
      try {
        sourceVar = await getValueTreeForExpression(this.#callFrame, this.#plugin, variable.name, {
          generatePreview: false,
          includeCommandLineAPI: true,
          objectGroup: "backtrace",
          returnByValue: false,
          silent: false
        });
      } catch (e) {
        console.warn(e);
        sourceVar = new SDK.RemoteObject.LocalJSONObject(void 0);
      }
      if (variable.nestedName && variable.nestedName.length > 1) {
        let parent = namespaces;
        for (let index = 0; index < variable.nestedName.length - 1; index++) {
          const nestedName = variable.nestedName[index];
          let child = parent[nestedName];
          if (!child) {
            child = new NamespaceObject({});
            parent[nestedName] = child;
          }
          parent = child.value;
        }
        const name = variable.nestedName[variable.nestedName.length - 1];
        parent[name] = sourceVar;
      } else {
        properties.push(makeProperty(variable.name, sourceVar));
      }
    }
    for (const namespace in namespaces) {
      properties.push(makeProperty(namespace, namespaces[namespace]));
    }
    return { properties, internalProperties: [] };
  }
}
export class SourceScope {
  #callFrameInternal;
  #typeInternal;
  #typeNameInternal;
  #iconInternal;
  #objectInternal;
  #startLocationInternal;
  #endLocationInternal;
  constructor(callFrame, type, typeName, icon, plugin) {
    this.#callFrameInternal = callFrame;
    this.#typeInternal = type;
    this.#typeNameInternal = typeName;
    this.#iconInternal = icon;
    this.#objectInternal = new SourceScopeRemoteObject(callFrame, plugin);
    this.#startLocationInternal = null;
    this.#endLocationInternal = null;
  }
  async getVariableValue(name) {
    for (let v = 0; v < this.#objectInternal.variables.length; ++v) {
      if (this.#objectInternal.variables[v].name !== name) {
        continue;
      }
      const properties = await this.#objectInternal.getAllProperties(false, false);
      if (!properties.properties) {
        continue;
      }
      const { value } = properties.properties[v];
      if (value) {
        return value;
      }
    }
    return null;
  }
  callFrame() {
    return this.#callFrameInternal;
  }
  type() {
    return this.#typeInternal;
  }
  typeName() {
    return this.#typeNameInternal;
  }
  name() {
    return void 0;
  }
  startLocation() {
    return this.#startLocationInternal;
  }
  endLocation() {
    return this.#endLocationInternal;
  }
  object() {
    return this.#objectInternal;
  }
  description() {
    return "";
  }
  icon() {
    return this.#iconInternal;
  }
}
export class DebuggerLanguagePluginManager {
  #workspace;
  #debuggerWorkspaceBinding;
  #plugins;
  #debuggerModelToData;
  #rawModuleHandles;
  constructor(targetManager, workspace, debuggerWorkspaceBinding) {
    this.#workspace = workspace;
    this.#debuggerWorkspaceBinding = debuggerWorkspaceBinding;
    this.#plugins = [];
    this.#debuggerModelToData = /* @__PURE__ */ new Map();
    targetManager.observeModels(SDK.DebuggerModel.DebuggerModel, this);
    this.#rawModuleHandles = /* @__PURE__ */ new Map();
  }
  async evaluateOnCallFrame(callFrame, options) {
    const { script } = callFrame;
    const { expression } = options;
    const { plugin } = await this.rawModuleIdAndPluginForScript(script);
    if (!plugin) {
      return null;
    }
    const location = getRawLocation(callFrame);
    const sourceLocations = await plugin.rawLocationToSourceLocation(location);
    if (sourceLocations.length === 0) {
      return null;
    }
    try {
      const object = await getValueTreeForExpression(callFrame, plugin, expression, options);
      return { object, exceptionDetails: void 0 };
    } catch (error) {
      if (error instanceof FormattingError) {
        const { exception: object, exceptionDetails } = error;
        return { object, exceptionDetails };
      }
      return { error: error.message };
    }
  }
  expandCallFrames(callFrames) {
    return Promise.all(callFrames.map(async (callFrame) => {
      const functionInfo = await this.getFunctionInfo(callFrame.script, callFrame.location());
      if (functionInfo) {
        if ("frames" in functionInfo && functionInfo.frames.length) {
          return functionInfo.frames.map(({ name }, index) => callFrame.createVirtualCallFrame(index, name));
        }
        if ("missingSymbolFiles" in functionInfo && functionInfo.missingSymbolFiles.length) {
          const resources = functionInfo.missingSymbolFiles;
          const details = i18nString(UIStrings.debugSymbolsIncomplete, { PH1: callFrame.functionName });
          callFrame.setMissingDebugInfoDetails({ details, resources });
        } else {
          callFrame.setMissingDebugInfoDetails({
            resources: [],
            details: i18nString(UIStrings.failedToLoadDebugSymbolsForFunction, { PH1: callFrame.functionName })
          });
        }
      }
      return callFrame;
    })).then((callFrames2) => callFrames2.flat());
  }
  modelAdded(debuggerModel) {
    this.#debuggerModelToData.set(debuggerModel, new ModelData(debuggerModel, this.#workspace));
    debuggerModel.addEventListener(SDK.DebuggerModel.Events.GlobalObjectCleared, this.globalObjectCleared, this);
    debuggerModel.addEventListener(SDK.DebuggerModel.Events.ParsedScriptSource, this.parsedScriptSource, this);
    debuggerModel.setEvaluateOnCallFrameCallback(this.evaluateOnCallFrame.bind(this));
    debuggerModel.setExpandCallFramesCallback(this.expandCallFrames.bind(this));
  }
  modelRemoved(debuggerModel) {
    debuggerModel.removeEventListener(SDK.DebuggerModel.Events.GlobalObjectCleared, this.globalObjectCleared, this);
    debuggerModel.removeEventListener(SDK.DebuggerModel.Events.ParsedScriptSource, this.parsedScriptSource, this);
    debuggerModel.setEvaluateOnCallFrameCallback(null);
    debuggerModel.setExpandCallFramesCallback(null);
    const modelData = this.#debuggerModelToData.get(debuggerModel);
    if (modelData) {
      modelData.dispose();
      this.#debuggerModelToData.delete(debuggerModel);
    }
    this.#rawModuleHandles.forEach((rawModuleHandle, rawModuleId) => {
      const scripts = rawModuleHandle.scripts.filter((script) => script.debuggerModel !== debuggerModel);
      if (scripts.length === 0) {
        rawModuleHandle.plugin.removeRawModule(rawModuleId).catch((error) => {
          Common.Console.Console.instance().error(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
        });
        this.#rawModuleHandles.delete(rawModuleId);
      } else {
        rawModuleHandle.scripts = scripts;
      }
    });
  }
  globalObjectCleared(event) {
    const debuggerModel = event.data;
    this.modelRemoved(debuggerModel);
    this.modelAdded(debuggerModel);
  }
  addPlugin(plugin) {
    this.#plugins.push(plugin);
    for (const debuggerModel of this.#debuggerModelToData.keys()) {
      for (const script of debuggerModel.scripts()) {
        if (this.hasPluginForScript(script)) {
          continue;
        }
        this.parsedScriptSource({ data: script });
      }
    }
  }
  removePlugin(plugin) {
    this.#plugins = this.#plugins.filter((p) => p !== plugin);
    const scripts = /* @__PURE__ */ new Set();
    this.#rawModuleHandles.forEach((rawModuleHandle, rawModuleId) => {
      if (rawModuleHandle.plugin !== plugin) {
        return;
      }
      rawModuleHandle.scripts.forEach((script) => scripts.add(script));
      this.#rawModuleHandles.delete(rawModuleId);
    });
    for (const script of scripts) {
      const modelData = this.#debuggerModelToData.get(script.debuggerModel);
      modelData.removeScript(script);
      this.parsedScriptSource({ data: script });
    }
  }
  hasPluginForScript(script) {
    const rawModuleId = rawModuleIdForScript(script);
    const rawModuleHandle = this.#rawModuleHandles.get(rawModuleId);
    return rawModuleHandle !== void 0 && rawModuleHandle.scripts.includes(script);
  }
  async rawModuleIdAndPluginForScript(script) {
    const rawModuleId = rawModuleIdForScript(script);
    const rawModuleHandle = this.#rawModuleHandles.get(rawModuleId);
    if (rawModuleHandle) {
      await rawModuleHandle.addRawModulePromise;
      if (rawModuleHandle === this.#rawModuleHandles.get(rawModuleId)) {
        return { rawModuleId, plugin: rawModuleHandle.plugin };
      }
    }
    return { rawModuleId, plugin: null };
  }
  uiSourceCodeForURL(debuggerModel, url) {
    const modelData = this.#debuggerModelToData.get(debuggerModel);
    if (modelData) {
      return modelData.getProject().uiSourceCodeForURL(url);
    }
    return null;
  }
  async rawLocationToUILocation(rawLocation) {
    const script = rawLocation.script();
    if (!script) {
      return null;
    }
    const { rawModuleId, plugin } = await this.rawModuleIdAndPluginForScript(script);
    if (!plugin) {
      return null;
    }
    const pluginLocation = {
      rawModuleId,
      codeOffset: rawLocation.columnNumber - (script.codeOffset() || 0),
      inlineFrameIndex: rawLocation.inlineFrameIndex
    };
    try {
      const sourceLocations = await plugin.rawLocationToSourceLocation(pluginLocation);
      for (const sourceLocation of sourceLocations) {
        const uiSourceCode = this.uiSourceCodeForURL(script.debuggerModel, sourceLocation.sourceFileURL);
        if (!uiSourceCode) {
          continue;
        }
        return uiSourceCode.uiLocation(sourceLocation.lineNumber, sourceLocation.columnNumber >= 0 ? sourceLocation.columnNumber : void 0);
      }
    } catch (error) {
      Common.Console.Console.instance().error(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
    }
    return null;
  }
  uiLocationToRawLocationRanges(uiSourceCode, lineNumber, columnNumber = -1) {
    const locationPromises = [];
    this.scriptsForUISourceCode(uiSourceCode).forEach((script) => {
      const rawModuleId = rawModuleIdForScript(script);
      const rawModuleHandle = this.#rawModuleHandles.get(rawModuleId);
      if (!rawModuleHandle) {
        return;
      }
      const { plugin } = rawModuleHandle;
      locationPromises.push(getLocations(rawModuleId, plugin, script));
    });
    if (locationPromises.length === 0) {
      return Promise.resolve(null);
    }
    return Promise.all(locationPromises).then((locations) => locations.flat()).catch((error) => {
      Common.Console.Console.instance().error(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
      return null;
    });
    async function getLocations(rawModuleId, plugin, script) {
      const pluginLocation = { rawModuleId, sourceFileURL: uiSourceCode.url(), lineNumber, columnNumber };
      const rawLocations = await plugin.sourceLocationToRawLocation(pluginLocation);
      if (!rawLocations) {
        return [];
      }
      return rawLocations.map((m) => ({
        start: new SDK.DebuggerModel.Location(script.debuggerModel, script.scriptId, 0, Number(m.startOffset) + (script.codeOffset() || 0)),
        end: new SDK.DebuggerModel.Location(script.debuggerModel, script.scriptId, 0, Number(m.endOffset) + (script.codeOffset() || 0))
      }));
    }
  }
  async uiLocationToRawLocations(uiSourceCode, lineNumber, columnNumber) {
    const locationRanges = await this.uiLocationToRawLocationRanges(uiSourceCode, lineNumber, columnNumber);
    if (!locationRanges) {
      return null;
    }
    return locationRanges.map(({ start }) => start);
  }
  scriptsForUISourceCode(uiSourceCode) {
    for (const modelData of this.#debuggerModelToData.values()) {
      const scripts = modelData.uiSourceCodeToScripts.get(uiSourceCode);
      if (scripts) {
        return scripts;
      }
    }
    return [];
  }
  parsedScriptSource(event) {
    const script = event.data;
    if (!script.sourceURL) {
      return;
    }
    for (const plugin of this.#plugins) {
      if (!plugin.handleScript(script)) {
        return;
      }
      const rawModuleId = rawModuleIdForScript(script);
      let rawModuleHandle = this.#rawModuleHandles.get(rawModuleId);
      if (!rawModuleHandle) {
        const sourceFileURLsPromise = (async () => {
          const console2 = Common.Console.Console.instance();
          const url = script.sourceURL;
          const symbolsUrl = script.debugSymbols && script.debugSymbols.externalURL || "";
          if (symbolsUrl) {
            console2.log(i18nString(UIStrings.loadingDebugSymbolsForVia, { PH1: plugin.name, PH2: url, PH3: symbolsUrl }));
          } else {
            console2.log(i18nString(UIStrings.loadingDebugSymbolsFor, { PH1: plugin.name, PH2: url }));
          }
          try {
            const code = !symbolsUrl && url.startsWith("wasm://") ? await script.getWasmBytecode() : void 0;
            const addModuleResult = await plugin.addRawModule(rawModuleId, symbolsUrl, { url, code });
            if (rawModuleHandle !== this.#rawModuleHandles.get(rawModuleId)) {
              return [];
            }
            if ("missingSymbolFiles" in addModuleResult) {
              return { missingSymbolFiles: addModuleResult.missingSymbolFiles };
            }
            const sourceFileURLs = addModuleResult;
            if (sourceFileURLs.length === 0) {
              console2.warn(i18nString(UIStrings.loadedDebugSymbolsForButDidnt, { PH1: plugin.name, PH2: url }));
            } else {
              console2.log(i18nString(UIStrings.loadedDebugSymbolsForFound, { PH1: plugin.name, PH2: url, PH3: sourceFileURLs.length }));
            }
            return sourceFileURLs;
          } catch (error) {
            console2.error(i18nString(UIStrings.failedToLoadDebugSymbolsFor, { PH1: plugin.name, PH2: url, PH3: error.message }));
            this.#rawModuleHandles.delete(rawModuleId);
            return [];
          }
        })();
        rawModuleHandle = { rawModuleId, plugin, scripts: [script], addRawModulePromise: sourceFileURLsPromise };
        this.#rawModuleHandles.set(rawModuleId, rawModuleHandle);
      } else {
        rawModuleHandle.scripts.push(script);
      }
      void rawModuleHandle.addRawModulePromise.then((sourceFileURLs) => {
        if (!("missingSymbolFiles" in sourceFileURLs)) {
          if (script.debuggerModel.scriptForId(script.scriptId) === script) {
            const modelData = this.#debuggerModelToData.get(script.debuggerModel);
            if (modelData) {
              modelData.addSourceFiles(script, sourceFileURLs);
              void this.#debuggerWorkspaceBinding.updateLocations(script);
            }
          }
        }
      });
      return;
    }
  }
  getSourcesForScript(script) {
    const rawModuleId = rawModuleIdForScript(script);
    const rawModuleHandle = this.#rawModuleHandles.get(rawModuleId);
    if (rawModuleHandle) {
      return rawModuleHandle.addRawModulePromise;
    }
    return Promise.resolve(void 0);
  }
  async resolveScopeChain(callFrame) {
    const script = callFrame.script;
    const { rawModuleId, plugin } = await this.rawModuleIdAndPluginForScript(script);
    if (!plugin) {
      return null;
    }
    const location = {
      rawModuleId,
      codeOffset: callFrame.location().columnNumber - (script.codeOffset() || 0),
      inlineFrameIndex: callFrame.inlineFrameIndex
    };
    try {
      const sourceMapping = await plugin.rawLocationToSourceLocation(location);
      if (sourceMapping.length === 0) {
        return null;
      }
      const scopes = /* @__PURE__ */ new Map();
      const variables = await plugin.listVariablesInScope(location);
      for (const variable of variables || []) {
        let scope = scopes.get(variable.scope);
        if (!scope) {
          const { type, typeName, icon } = await plugin.getScopeInfo(variable.scope);
          scope = new SourceScope(callFrame, type, typeName, icon, plugin);
          scopes.set(variable.scope, scope);
        }
        scope.object().variables.push(variable);
      }
      return Array.from(scopes.values());
    } catch (error) {
      Common.Console.Console.instance().error(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
      return null;
    }
  }
  async getFunctionInfo(script, location) {
    const { rawModuleId, plugin } = await this.rawModuleIdAndPluginForScript(script);
    if (!plugin) {
      return null;
    }
    const rawLocation = {
      rawModuleId,
      codeOffset: location.columnNumber - (script.codeOffset() || 0),
      inlineFrameIndex: 0
    };
    try {
      const functionInfo = await plugin.getFunctionInfo(rawLocation);
      return functionInfo;
    } catch (error) {
      Common.Console.Console.instance().warn(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
      return { frames: [] };
    }
  }
  async getInlinedFunctionRanges(rawLocation) {
    const script = rawLocation.script();
    if (!script) {
      return [];
    }
    const { rawModuleId, plugin } = await this.rawModuleIdAndPluginForScript(script);
    if (!plugin) {
      return [];
    }
    const pluginLocation = {
      rawModuleId,
      codeOffset: rawLocation.columnNumber - (script.codeOffset() || 0)
    };
    try {
      const locations = await plugin.getInlinedFunctionRanges(pluginLocation);
      return locations.map((m) => ({
        start: new SDK.DebuggerModel.Location(script.debuggerModel, script.scriptId, 0, Number(m.startOffset) + (script.codeOffset() || 0)),
        end: new SDK.DebuggerModel.Location(script.debuggerModel, script.scriptId, 0, Number(m.endOffset) + (script.codeOffset() || 0))
      }));
    } catch (error) {
      Common.Console.Console.instance().warn(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
      return [];
    }
  }
  async getInlinedCalleesRanges(rawLocation) {
    const script = rawLocation.script();
    if (!script) {
      return [];
    }
    const { rawModuleId, plugin } = await this.rawModuleIdAndPluginForScript(script);
    if (!plugin) {
      return [];
    }
    const pluginLocation = {
      rawModuleId,
      codeOffset: rawLocation.columnNumber - (script.codeOffset() || 0)
    };
    try {
      const locations = await plugin.getInlinedCalleesRanges(pluginLocation);
      return locations.map((m) => ({
        start: new SDK.DebuggerModel.Location(script.debuggerModel, script.scriptId, 0, Number(m.startOffset) + (script.codeOffset() || 0)),
        end: new SDK.DebuggerModel.Location(script.debuggerModel, script.scriptId, 0, Number(m.endOffset) + (script.codeOffset() || 0))
      }));
    } catch (error) {
      Common.Console.Console.instance().warn(i18nString(UIStrings.errorInDebuggerLanguagePlugin, { PH1: error.message }));
      return [];
    }
  }
  async getMappedLines(uiSourceCode) {
    const rawModuleIds = await Promise.all(this.scriptsForUISourceCode(uiSourceCode).map((s) => this.rawModuleIdAndPluginForScript(s)));
    let mappedLines;
    for (const { rawModuleId, plugin } of rawModuleIds) {
      if (!plugin) {
        continue;
      }
      const lines = await plugin.getMappedLines(rawModuleId, uiSourceCode.url());
      if (lines === void 0) {
        continue;
      }
      if (mappedLines === void 0) {
        mappedLines = new Set(lines);
      } else {
        lines.forEach((l) => mappedLines.add(l));
      }
    }
    return mappedLines;
  }
}
class ModelData {
  project;
  uiSourceCodeToScripts;
  constructor(debuggerModel, workspace) {
    this.project = new ContentProviderBasedProject(workspace, "language_plugins::" + debuggerModel.target().id(), Workspace.Workspace.projectTypes.Network, "", false);
    NetworkProject.setTargetForProject(this.project, debuggerModel.target());
    this.uiSourceCodeToScripts = /* @__PURE__ */ new Map();
  }
  addSourceFiles(script, urls) {
    const initiator = script.createPageResourceLoadInitiator();
    for (const url of urls) {
      let uiSourceCode = this.project.uiSourceCodeForURL(url);
      if (!uiSourceCode) {
        uiSourceCode = this.project.createUISourceCode(url, Common.ResourceType.resourceTypes.SourceMapScript);
        NetworkProject.setInitialFrameAttribution(uiSourceCode, script.frameId);
        this.uiSourceCodeToScripts.set(uiSourceCode, [script]);
        const contentProvider = new SDK.CompilerSourceMappingContentProvider.CompilerSourceMappingContentProvider(url, Common.ResourceType.resourceTypes.SourceMapScript, initiator);
        const mimeType = Common.ResourceType.ResourceType.mimeFromURL(url) || "text/javascript";
        this.project.addUISourceCodeWithProvider(uiSourceCode, contentProvider, null, mimeType);
      } else {
        const scripts = this.uiSourceCodeToScripts.get(uiSourceCode);
        if (!scripts.includes(script)) {
          scripts.push(script);
        }
      }
    }
  }
  removeScript(script) {
    this.uiSourceCodeToScripts.forEach((scripts, uiSourceCode) => {
      scripts = scripts.filter((s) => s !== script);
      if (scripts.length === 0) {
        this.uiSourceCodeToScripts.delete(uiSourceCode);
        this.project.removeUISourceCode(uiSourceCode.url());
      } else {
        this.uiSourceCodeToScripts.set(uiSourceCode, scripts);
      }
    });
  }
  dispose() {
    this.project.dispose();
  }
  getProject() {
    return this.project;
  }
}
export class DebuggerLanguagePlugin {
  name;
  constructor(name) {
    this.name = name;
  }
  handleScript(_script) {
    throw new Error("Not implemented yet");
  }
  dispose() {
  }
  async addRawModule(_rawModuleId, _symbolsURL, _rawModule) {
    throw new Error("Not implemented yet");
  }
  async sourceLocationToRawLocation(_sourceLocation) {
    throw new Error("Not implemented yet");
  }
  async rawLocationToSourceLocation(_rawLocation) {
    throw new Error("Not implemented yet");
  }
  async getScopeInfo(_type) {
    throw new Error("Not implemented yet");
  }
  async listVariablesInScope(_rawLocation) {
    throw new Error("Not implemented yet");
  }
  removeRawModule(_rawModuleId) {
    throw new Error("Not implemented yet");
  }
  getTypeInfo(_expression, _context) {
    throw new Error("Not implemented yet");
  }
  getFormatter(_expressionOrField, _context) {
    throw new Error("Not implemented yet");
  }
  getInspectableAddress(_field) {
    throw new Error("Not implemented yet");
  }
  async getFunctionInfo(_rawLocation) {
    throw new Error("Not implemented yet");
  }
  async getInlinedFunctionRanges(_rawLocation) {
    throw new Error("Not implemented yet");
  }
  async getInlinedCalleesRanges(_rawLocation) {
    throw new Error("Not implemented yet");
  }
  async getMappedLines(_rawModuleId, _sourceFileURL) {
    throw new Error("Not implemented yet");
  }
}
//# sourceMappingURL=DebuggerLanguagePlugins.js.map
