import * as SnippetsModule from "./snippets.js";
self.Snippets = self.Snippets || {};
Snippets = Snippets || {};
Snippets.evaluateScriptSnippet = SnippetsModule.ScriptSnippetFileSystem.evaluateScriptSnippet;
Snippets.isSnippetsUISourceCode = SnippetsModule.ScriptSnippetFileSystem.isSnippetsUISourceCode;
Snippets.isSnippetsProject = SnippetsModule.ScriptSnippetFileSystem.isSnippetsProject;
Snippets.SnippetsQuickOpen = SnippetsModule.SnippetsQuickOpen.SnippetsQuickOpen;
Snippets.ScriptSnippetFileSystem = {};
Snippets.ScriptSnippetFileSystem.findSnippetsProject = SnippetsModule.ScriptSnippetFileSystem.findSnippetsProject;
//# sourceMappingURL=snippets-legacy.js.map
