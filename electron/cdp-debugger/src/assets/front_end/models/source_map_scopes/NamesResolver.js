import * as SDK from "../../core/sdk/sdk.js";
import * as Bindings from "../bindings/bindings.js";
import * as Formatter from "../formatter/formatter.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Protocol from "../../generated/protocol.js";
const scopeToCachedIdentifiersMap = /* @__PURE__ */ new WeakMap();
const cachedMapByCallFrame = /* @__PURE__ */ new WeakMap();
export class IdentifierPositions {
  name;
  positions;
  constructor(name, positions = []) {
    this.name = name;
    this.positions = positions;
  }
  addPosition(lineNumber, columnNumber) {
    this.positions.push({ lineNumber, columnNumber });
  }
}
const computeScopeTree = async function(functionScope) {
  const functionStartLocation = functionScope.startLocation();
  const functionEndLocation = functionScope.endLocation();
  if (!functionStartLocation || !functionEndLocation) {
    return null;
  }
  const script = functionStartLocation.script();
  if (!script || !script.sourceMapURL || script !== functionEndLocation.script()) {
    return null;
  }
  const { content } = await script.requestContent();
  if (!content) {
    return null;
  }
  const text = new TextUtils.Text.Text(content);
  const scopeRange = new TextUtils.TextRange.TextRange(functionStartLocation.lineNumber, functionStartLocation.columnNumber, functionEndLocation.lineNumber, functionEndLocation.columnNumber);
  const scopeText = text.extract(scopeRange);
  const scopeStart = text.toSourceRange(scopeRange).offset;
  let prefix = "class DummyClass extends DummyBase { constructor";
  let suffix = "}";
  let scopeTree = await Formatter.FormatterWorkerPool.formatterWorkerPool().javaScriptScopeTree(prefix + scopeText + suffix);
  if (!scopeTree) {
    prefix = "";
    suffix = "";
    scopeTree = await Formatter.FormatterWorkerPool.formatterWorkerPool().javaScriptScopeTree(prefix + scopeText + suffix);
  }
  if (!scopeTree) {
    return null;
  }
  return { scopeTree, text, slide: scopeStart - prefix.length };
};
export const scopeIdentifiers = async function(functionScope, scope) {
  if (!functionScope) {
    return null;
  }
  const startLocation = scope.startLocation();
  const endLocation = scope.endLocation();
  if (!startLocation || !endLocation) {
    return null;
  }
  const scopeTreeAndStart = await computeScopeTree(functionScope);
  if (!scopeTreeAndStart) {
    return null;
  }
  const { scopeTree, text, slide } = scopeTreeAndStart;
  const scopeOffsets = {
    start: text.offsetFromPosition(startLocation.lineNumber, startLocation.columnNumber) - slide,
    end: text.offsetFromPosition(endLocation.lineNumber, endLocation.columnNumber) - slide
  };
  if (!contains(scopeTree, scopeOffsets)) {
    return null;
  }
  let containingScope = scopeTree;
  const ancestorScopes = [];
  while (true) {
    let childFound = false;
    for (const child of containingScope.children) {
      if (contains(child, scopeOffsets)) {
        ancestorScopes.push(containingScope);
        containingScope = child;
        childFound = true;
        break;
      }
      if (!disjoint(scopeOffsets, child) && !contains(scopeOffsets, child)) {
        console.error("Wrong nesting of scopes");
        return null;
      }
    }
    if (!childFound) {
      break;
    }
  }
  const boundVariables = [];
  const cursor = new TextUtils.TextCursor.TextCursor(text.lineEndings());
  for (const variable of containingScope.variables) {
    if (variable.kind === Formatter.FormatterWorkerPool.DefinitionKind.Fixed && variable.offsets.length <= 1) {
      continue;
    }
    const identifier = new IdentifierPositions(variable.name);
    for (const offset of variable.offsets) {
      const start = offset + slide;
      cursor.resetTo(start);
      identifier.addPosition(cursor.lineNumber(), cursor.columnNumber());
    }
    boundVariables.push(identifier);
  }
  const freeVariables = [];
  for (const ancestor of ancestorScopes) {
    for (const ancestorVariable of ancestor.variables) {
      let identifier = null;
      for (const offset of ancestorVariable.offsets) {
        if (offset >= containingScope.start && offset < containingScope.end) {
          if (!identifier) {
            identifier = new IdentifierPositions(ancestorVariable.name);
          }
          const start = offset + slide;
          cursor.resetTo(start);
          identifier.addPosition(cursor.lineNumber(), cursor.columnNumber());
        }
      }
      if (identifier) {
        freeVariables.push(identifier);
      }
    }
  }
  return { boundVariables, freeVariables };
  function contains(scope2, candidate) {
    return scope2.start <= candidate.start && scope2.end >= candidate.end;
  }
  function disjoint(scope2, other) {
    return scope2.end <= other.start || other.end <= scope2.start;
  }
};
const identifierAndPunctuationRegExp = /^\s*([A-Za-z_$][A-Za-z_$0-9]*)\s*([.;,=]?)\s*$/;
var Punctuation = /* @__PURE__ */ ((Punctuation2) => {
  Punctuation2["None"] = "none";
  Punctuation2["Comma"] = "comma";
  Punctuation2["Dot"] = "dot";
  Punctuation2["Semicolon"] = "semicolon";
  Punctuation2["Equals"] = "equals";
  return Punctuation2;
})(Punctuation || {});
const resolveScope = async (scope) => {
  let cachedScopeMap = scopeToCachedIdentifiersMap.get(scope);
  const script = scope.callFrame().script;
  const sourceMap = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().sourceMapForScript(script);
  if (!cachedScopeMap || cachedScopeMap.sourceMap !== sourceMap) {
    const identifiersPromise = (async () => {
      const variableMapping = /* @__PURE__ */ new Map();
      let thisMapping = null;
      if (!sourceMap) {
        return { variableMapping, thisMapping };
      }
      const textCache = /* @__PURE__ */ new Map();
      const promises = [];
      const resolveEntry = (id, handler) => {
        for (const position of id.positions) {
          const entry = sourceMap.findEntry(position.lineNumber, position.columnNumber);
          if (entry && entry.name) {
            handler(entry.name);
            return;
          }
        }
        async function resolvePosition() {
          if (!sourceMap) {
            return;
          }
          for (const position of id.positions) {
            const sourceName = await resolveSourceName(script, sourceMap, id.name, position, textCache);
            if (sourceName) {
              handler(sourceName);
              return;
            }
          }
        }
        promises.push(resolvePosition());
      };
      const functionScope = findFunctionScope();
      const parsedVariables = await scopeIdentifiers(functionScope, scope);
      if (!parsedVariables) {
        return { variableMapping, thisMapping };
      }
      for (const id of parsedVariables.boundVariables) {
        resolveEntry(id, (sourceName) => {
          if (sourceName !== "this") {
            variableMapping.set(id.name, sourceName);
          }
        });
      }
      for (const id of parsedVariables.freeVariables) {
        resolveEntry(id, (sourceName) => {
          if (sourceName === "this") {
            thisMapping = id.name;
          }
        });
      }
      await Promise.all(promises).then(getScopeResolvedForTest());
      return { variableMapping, thisMapping };
    })();
    cachedScopeMap = { sourceMap, mappingPromise: identifiersPromise };
    scopeToCachedIdentifiersMap.set(scope, { sourceMap, mappingPromise: identifiersPromise });
  }
  return await cachedScopeMap.mappingPromise;
  async function resolveSourceName(script2, sourceMap2, name, position, textCache) {
    const ranges = sourceMap2.findEntryRanges(position.lineNumber, position.columnNumber);
    if (!ranges) {
      return null;
    }
    const uiSourceCode = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().uiSourceCodeForSourceMapSourceURL(script2.debuggerModel, ranges.sourceURL, script2.isContentScript());
    if (!uiSourceCode) {
      return null;
    }
    const compiledText = getTextFor((await script2.requestContent()).content);
    if (!compiledText) {
      return null;
    }
    const compiledToken = compiledText.extract(ranges.range);
    const parsedCompiledToken = extractIdentifier(compiledToken);
    if (!parsedCompiledToken) {
      return null;
    }
    const { name: compiledName, punctuation: compiledPunctuation } = parsedCompiledToken;
    if (compiledName !== name) {
      return null;
    }
    const sourceText = getTextFor((await uiSourceCode.requestContent()).content);
    if (!sourceText) {
      return null;
    }
    const sourceToken = sourceText.extract(ranges.sourceRange);
    const parsedSourceToken = extractIdentifier(sourceToken);
    if (!parsedSourceToken) {
      return null;
    }
    const { name: sourceName, punctuation: sourcePunctuation } = parsedSourceToken;
    if (compiledPunctuation === sourcePunctuation) {
      return sourceName;
    }
    if (compiledPunctuation === "comma" /* Comma */ && sourcePunctuation === "semicolon" /* Semicolon */) {
      return sourceName;
    }
    return null;
    function extractIdentifier(token) {
      const match = token.match(identifierAndPunctuationRegExp);
      if (!match) {
        return null;
      }
      const name2 = match[1];
      let punctuation = null;
      switch (match[2]) {
        case ".":
          punctuation = "dot" /* Dot */;
          break;
        case ",":
          punctuation = "comma" /* Comma */;
          break;
        case ";":
          punctuation = "semicolon" /* Semicolon */;
          break;
        case "=":
          punctuation = "equals" /* Equals */;
          break;
        case "":
          punctuation = "none" /* None */;
          break;
        default:
          console.error(`Name token parsing error: unexpected token "${match[2]}"`);
          return null;
      }
      return { name: name2, punctuation };
    }
    function getTextFor(content) {
      if (!content) {
        return null;
      }
      let text = textCache.get(content);
      if (!text) {
        text = new TextUtils.Text.Text(content);
        textCache.set(content, text);
      }
      return text;
    }
  }
  function findFunctionScope() {
    const scopeChain = scope.callFrame().scopeChain();
    let scopeIndex = 0;
    for (scopeIndex; scopeIndex < scopeChain.length; scopeIndex++) {
      if (scopeChain[scopeIndex] === scope) {
        break;
      }
    }
    for (scopeIndex; scopeIndex < scopeChain.length; scopeIndex++) {
      const kind = scopeChain[scopeIndex].type();
      if (kind === Protocol.Debugger.ScopeType.Local || kind === Protocol.Debugger.ScopeType.Closure) {
        break;
      }
    }
    return scopeIndex === scopeChain.length ? null : scopeChain[scopeIndex];
  }
};
export const resolveScopeChain = async function(callFrame) {
  if (!callFrame) {
    return null;
  }
  const { pluginManager } = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
  if (pluginManager) {
    const scopeChain = await pluginManager.resolveScopeChain(callFrame);
    if (scopeChain) {
      return scopeChain;
    }
  }
  return callFrame.scopeChain();
};
export const allVariablesInCallFrame = async (callFrame) => {
  const cachedMap = cachedMapByCallFrame.get(callFrame);
  if (cachedMap) {
    return cachedMap;
  }
  const scopeChain = callFrame.scopeChain();
  const nameMappings = await Promise.all(scopeChain.map(resolveScope));
  const reverseMapping = /* @__PURE__ */ new Map();
  for (const { variableMapping } of nameMappings) {
    for (const [compiledName, originalName] of variableMapping) {
      if (originalName && !reverseMapping.has(originalName)) {
        reverseMapping.set(originalName, compiledName);
      }
    }
  }
  cachedMapByCallFrame.set(callFrame, reverseMapping);
  return reverseMapping;
};
export const resolveExpression = async (callFrame, originalText, uiSourceCode, lineNumber, startColumnNumber, endColumnNumber) => {
  if (uiSourceCode.mimeType() === "application/wasm") {
    return `memories["${originalText}"] ?? locals["${originalText}"] ?? tables["${originalText}"] ?? functions["${originalText}"] ?? globals["${originalText}"]`;
  }
  if (!uiSourceCode.contentType().isFromSourceMap()) {
    return "";
  }
  const reverseMapping = await allVariablesInCallFrame(callFrame);
  if (reverseMapping.has(originalText)) {
    return reverseMapping.get(originalText);
  }
  const rawLocations = await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().uiLocationToRawLocations(uiSourceCode, lineNumber, startColumnNumber);
  const rawLocation = rawLocations.find((location) => location.debuggerModel === callFrame.debuggerModel);
  if (!rawLocation) {
    return "";
  }
  const script = rawLocation.script();
  if (!script) {
    return "";
  }
  const sourceMap = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().sourceMapForScript(script);
  if (!sourceMap) {
    return "";
  }
  const { content } = await script.requestContent();
  if (!content) {
    return "";
  }
  const text = new TextUtils.Text.Text(content);
  const textRange = sourceMap.reverseMapTextRange(uiSourceCode.url(), new TextUtils.TextRange.TextRange(lineNumber, startColumnNumber, lineNumber, endColumnNumber));
  if (!textRange) {
    return "";
  }
  const subjectText = text.extract(textRange);
  if (!subjectText) {
    return "";
  }
  return await Formatter.FormatterWorkerPool.formatterWorkerPool().evaluatableJavaScriptSubstring(subjectText);
};
export const resolveThisObject = async (callFrame) => {
  if (!callFrame) {
    return null;
  }
  const scopeChain = callFrame.scopeChain();
  if (scopeChain.length === 0) {
    return callFrame.thisObject();
  }
  const { thisMapping } = await resolveScope(scopeChain[0]);
  if (!thisMapping) {
    return callFrame.thisObject();
  }
  const result = await callFrame.evaluate({
    expression: thisMapping,
    objectGroup: "backtrace",
    includeCommandLineAPI: false,
    silent: true,
    returnByValue: false,
    generatePreview: true
  });
  if ("exceptionDetails" in result) {
    return !result.exceptionDetails && result.object ? result.object : callFrame.thisObject();
  }
  return null;
};
export const resolveScopeInObject = function(scope) {
  const startLocation = scope.startLocation();
  const endLocation = scope.endLocation();
  const startLocationScript = startLocation ? startLocation.script() : null;
  if (scope.type() === Protocol.Debugger.ScopeType.Global || !startLocationScript || !endLocation || !startLocationScript.sourceMapURL || startLocationScript !== endLocation.script()) {
    return scope.object();
  }
  return new RemoteObject(scope);
};
export class RemoteObject extends SDK.RemoteObject.RemoteObject {
  scope;
  object;
  constructor(scope) {
    super();
    this.scope = scope;
    this.object = scope.object();
  }
  customPreview() {
    return this.object.customPreview();
  }
  get objectId() {
    return this.object.objectId;
  }
  get type() {
    return this.object.type;
  }
  get subtype() {
    return this.object.subtype;
  }
  get value() {
    return this.object.value;
  }
  get description() {
    return this.object.description;
  }
  get hasChildren() {
    return this.object.hasChildren;
  }
  get preview() {
    return this.object.preview;
  }
  arrayLength() {
    return this.object.arrayLength();
  }
  getOwnProperties(generatePreview) {
    return this.object.getOwnProperties(generatePreview);
  }
  async getAllProperties(accessorPropertiesOnly, generatePreview) {
    const allProperties = await this.object.getAllProperties(accessorPropertiesOnly, generatePreview);
    const { variableMapping } = await resolveScope(this.scope);
    const properties = allProperties.properties;
    const internalProperties = allProperties.internalProperties;
    const newProperties = [];
    if (properties) {
      for (let i = 0; i < properties.length; ++i) {
        const property = properties[i];
        const name = variableMapping.get(property.name) || properties[i].name;
        if (!property.value) {
          continue;
        }
        newProperties.push(new SDK.RemoteObject.RemoteObjectProperty(name, property.value, property.enumerable, property.writable, property.isOwn, property.wasThrown, property.symbol, property.synthetic));
      }
    }
    return { properties: newProperties, internalProperties };
  }
  async setPropertyValue(argumentName, value) {
    const { variableMapping } = await resolveScope(this.scope);
    let name;
    if (typeof argumentName === "string") {
      name = argumentName;
    } else {
      name = argumentName.value;
    }
    let actualName = name;
    for (const compiledName of variableMapping.keys()) {
      if (variableMapping.get(compiledName) === name) {
        actualName = compiledName;
        break;
      }
    }
    return this.object.setPropertyValue(actualName, value);
  }
  async deleteProperty(name) {
    return this.object.deleteProperty(name);
  }
  callFunction(functionDeclaration, args) {
    return this.object.callFunction(functionDeclaration, args);
  }
  callFunctionJSON(functionDeclaration, args) {
    return this.object.callFunctionJSON(functionDeclaration, args);
  }
  release() {
    this.object.release();
  }
  debuggerModel() {
    return this.object.debuggerModel();
  }
  runtimeModel() {
    return this.object.runtimeModel();
  }
  isNode() {
    return this.object.isNode();
  }
}
let _scopeResolvedForTest = function() {
};
export const getScopeResolvedForTest = () => {
  return _scopeResolvedForTest;
};
export const setScopeResolvedForTest = (scope) => {
  _scopeResolvedForTest = scope;
};
//# sourceMappingURL=NamesResolver.js.map
