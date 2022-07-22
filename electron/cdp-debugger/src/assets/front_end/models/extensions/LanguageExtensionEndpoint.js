import * as Bindings from "../bindings/bindings.js";
import { ExtensionEndpoint } from "./ExtensionEndpoint.js";
import { PrivateAPI } from "./ExtensionAPI.js";
class LanguageExtensionEndpointImpl extends ExtensionEndpoint {
  plugin;
  constructor(plugin, port) {
    super(port);
    this.plugin = plugin;
  }
  handleEvent({ event }) {
    switch (event) {
      case PrivateAPI.LanguageExtensionPluginEvents.UnregisteredLanguageExtensionPlugin: {
        this.disconnect();
        const { pluginManager } = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
        if (pluginManager) {
          pluginManager.removePlugin(this.plugin);
        }
        break;
      }
    }
  }
}
export class LanguageExtensionEndpoint extends Bindings.DebuggerLanguagePlugins.DebuggerLanguagePlugin {
  supportedScriptTypes;
  endpoint;
  constructor(name, supportedScriptTypes, port) {
    super(name);
    this.supportedScriptTypes = supportedScriptTypes;
    this.endpoint = new LanguageExtensionEndpointImpl(this, port);
  }
  handleScript(script) {
    const language = script.scriptLanguage();
    return language !== null && script.debugSymbols !== null && language === this.supportedScriptTypes.language && this.supportedScriptTypes.symbol_types.includes(script.debugSymbols.type);
  }
  addRawModule(rawModuleId, symbolsURL, rawModule) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.AddRawModule, { rawModuleId, symbolsURL, rawModule });
  }
  removeRawModule(rawModuleId) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.RemoveRawModule, { rawModuleId });
  }
  sourceLocationToRawLocation(sourceLocation) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.SourceLocationToRawLocation, { sourceLocation });
  }
  rawLocationToSourceLocation(rawLocation) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.RawLocationToSourceLocation, { rawLocation });
  }
  getScopeInfo(type) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetScopeInfo, { type });
  }
  listVariablesInScope(rawLocation) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.ListVariablesInScope, { rawLocation });
  }
  getFunctionInfo(rawLocation) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetFunctionInfo, { rawLocation });
  }
  getInlinedFunctionRanges(rawLocation) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetInlinedFunctionRanges, { rawLocation });
  }
  getInlinedCalleesRanges(rawLocation) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetInlinedCalleesRanges, { rawLocation });
  }
  getTypeInfo(expression, context) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetTypeInfo, { expression, context });
  }
  getFormatter(expressionOrField, context) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetFormatter, { expressionOrField, context });
  }
  getInspectableAddress(field) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetInspectableAddress, { field });
  }
  async getMappedLines(rawModuleId, sourceFileURL) {
    return this.endpoint.sendRequest(PrivateAPI.LanguageExtensionPluginCommands.GetMappedLines, { rawModuleId, sourceFileURL });
  }
  dispose() {
  }
}
//# sourceMappingURL=LanguageExtensionEndpoint.js.map
