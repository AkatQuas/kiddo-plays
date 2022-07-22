import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as ObjectUI from "../../ui/legacy/components/object_ui/object_ui.js";
import * as QuickOpen from "../../ui/legacy/components/quick_open/quick_open.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  showSources: "Show Sources",
  sources: "Sources",
  showFilesystem: "Show Filesystem",
  filesystem: "Filesystem",
  showSnippets: "Show Snippets",
  snippets: "Snippets",
  showSearch: "Show Search",
  search: "Search",
  showQuickSource: "Show Quick source",
  quickSource: "Quick source",
  showThreads: "Show Threads",
  threads: "Threads",
  showScope: "Show Scope",
  scope: "Scope",
  showWatch: "Show Watch",
  watch: "Watch",
  showBreakpoints: "Show Breakpoints",
  breakpoints: "Breakpoints",
  pauseScriptExecution: "Pause script execution",
  resumeScriptExecution: "Resume script execution",
  stepOverNextFunctionCall: "Step over next function call",
  stepIntoNextFunctionCall: "Step into next function call",
  step: "Step",
  stepOutOfCurrentFunction: "Step out of current function",
  runSnippet: "Run snippet",
  deactivateBreakpoints: "Deactivate breakpoints",
  activateBreakpoints: "Activate breakpoints",
  addSelectedTextToWatches: "Add selected text to watches",
  evaluateSelectedTextInConsole: "Evaluate selected text in console",
  switchFile: "Switch file",
  rename: "Rename",
  closeAll: "Close All",
  jumpToPreviousEditingLocation: "Jump to previous editing location",
  jumpToNextEditingLocation: "Jump to next editing location",
  closeTheActiveTab: "Close the active tab",
  goToLine: "Go to line",
  goToAFunctionDeclarationruleSet: "Go to a function declaration/rule set",
  toggleBreakpoint: "Toggle breakpoint",
  toggleBreakpointEnabled: "Toggle breakpoint enabled",
  toggleBreakpointInputWindow: "Toggle breakpoint input window",
  save: "Save",
  saveAll: "Save all",
  createNewSnippet: "Create new snippet",
  addFolderToWorkspace: "Add folder to workspace",
  previousCallFrame: "Previous call frame",
  nextCallFrame: "Next call frame",
  incrementCssUnitBy: "Increment CSS unit by {PH1}",
  decrementCssUnitBy: "Decrement CSS unit by {PH1}",
  searchInAnonymousAndContent: "Search in anonymous and content scripts",
  doNotSearchInAnonymousAndContent: "Do not search in anonymous and content scripts",
  automaticallyRevealFilesIn: "Automatically reveal files in sidebar",
  doNotAutomaticallyRevealFilesIn: "Do not automatically reveal files in sidebar",
  enableJavascriptSourceMaps: "Enable JavaScript source maps",
  disableJavascriptSourceMaps: "Disable JavaScript source maps",
  enableTabMovesFocus: "Enable tab moves focus",
  disableTabMovesFocus: "Disable tab moves focus",
  detectIndentation: "Detect indentation",
  doNotDetectIndentation: "Do not detect indentation",
  autocompletion: "Autocompletion",
  enableAutocompletion: "Enable autocompletion",
  disableAutocompletion: "Disable autocompletion",
  bracketMatching: "Bracket matching",
  enableBracketMatching: "Enable bracket matching",
  disableBracketMatching: "Disable bracket matching",
  codeFolding: "Code folding",
  enableCodeFolding: "Enable code folding",
  disableCodeFolding: "Disable code folding",
  showWhitespaceCharacters: "Show whitespace characters:",
  doNotShowWhitespaceCharacters: "Do not show whitespace characters",
  none: "None",
  showAllWhitespaceCharacters: "Show all whitespace characters",
  all: "All",
  showTrailingWhitespaceCharacters: "Show trailing whitespace characters",
  trailing: "Trailing",
  displayVariableValuesInlineWhile: "Display variable values inline while debugging",
  doNotDisplayVariableValuesInline: "Do not display variable values inline while debugging",
  enableCssSourceMaps: "Enable CSS source maps",
  disableCssSourceMaps: "Disable CSS source maps",
  allowScrollingPastEndOfFile: "Allow scrolling past end of file",
  disallowScrollingPastEndOfFile: "Disallow scrolling past end of file",
  goTo: "Go to",
  line: "Line",
  symbol: "Symbol",
  open: "Open",
  file: "File",
  disableAutoFocusOnDebuggerPaused: "Do not focus Sources panel when triggering a breakpoint",
  enableAutoFocusOnDebuggerPaused: "Focus Sources panel when triggering a breakpoint",
  toggleNavigatorSidebar: "Toggle navigator sidebar",
  toggleDebuggerSidebar: "Toggle debugger sidebar"
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/sources-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedSourcesModule;
async function loadSourcesModule() {
  if (!loadedSourcesModule) {
    loadedSourcesModule = await import("./sources.js");
  }
  return loadedSourcesModule;
}
function maybeRetrieveContextTypes(getClassCallBack) {
  if (loadedSourcesModule === void 0) {
    return [];
  }
  return getClassCallBack(loadedSourcesModule);
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "sources",
  commandPrompt: i18nLazyString(UIStrings.showSources),
  title: i18nLazyString(UIStrings.sources),
  order: 30,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.SourcesPanel.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  id: "navigator-files",
  commandPrompt: i18nLazyString(UIStrings.showFilesystem),
  title: i18nLazyString(UIStrings.filesystem),
  order: 3,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.FilesNavigatorView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  id: "navigator-snippets",
  commandPrompt: i18nLazyString(UIStrings.showSnippets),
  title: i18nLazyString(UIStrings.snippets),
  order: 6,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.SnippetsNavigatorView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "sources.search-sources-tab",
  commandPrompt: i18nLazyString(UIStrings.showSearch),
  title: i18nLazyString(UIStrings.search),
  order: 7,
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SearchSourcesView.SearchSourcesView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "sources.quick",
  commandPrompt: i18nLazyString(UIStrings.showQuickSource),
  title: i18nLazyString(UIStrings.quickSource),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 1e3,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.WrapperView.instance();
  }
});
UI.ViewManager.registerViewExtension({
  id: "sources.threads",
  commandPrompt: i18nLazyString(UIStrings.showThreads),
  title: i18nLazyString(UIStrings.threads),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  condition: Root.Runtime.ConditionName.NOT_SOURCES_HIDE_ADD_FOLDER,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.ThreadsSidebarPane.ThreadsSidebarPane.instance();
  }
});
UI.ViewManager.registerViewExtension({
  id: "sources.scopeChain",
  commandPrompt: i18nLazyString(UIStrings.showScope),
  title: i18nLazyString(UIStrings.scope),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.ScopeChainSidebarPane.ScopeChainSidebarPane.instance();
  }
});
UI.ViewManager.registerViewExtension({
  id: "sources.watch",
  commandPrompt: i18nLazyString(UIStrings.showWatch),
  title: i18nLazyString(UIStrings.watch),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.WatchExpressionsSidebarPane.WatchExpressionsSidebarPane.instance();
  },
  hasToolbar: true
});
UI.ViewManager.registerViewExtension({
  id: "sources.jsBreakpoints",
  commandPrompt: i18nLazyString(UIStrings.showBreakpoints),
  title: i18nLazyString(UIStrings.breakpoints),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const Sources = await loadSourcesModule();
    return Sources.JavaScriptBreakpointsSidebarPane.JavaScriptBreakpointsSidebarPane.instance();
  }
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.toggle-pause",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_PAUSE,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_RESUME,
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.RevealingActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView, UI.ShortcutRegistry.ForwardedShortcut]);
  },
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.pauseScriptExecution)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.resumeScriptExecution)
    }
  ],
  bindings: [
    {
      shortcut: "F8",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+\\"
    },
    {
      shortcut: "F5",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      shortcut: "Shift+F5",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+\\"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.step-over",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.stepOverNextFunctionCall),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_STEP_OVER,
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  bindings: [
    {
      shortcut: "F10",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+'"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+'"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.step-into",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.stepIntoNextFunctionCall),
  iconClass: UI.ActionRegistration.IconClass.LARGE_ICON_STEP_INTO,
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  bindings: [
    {
      shortcut: "F11",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+;"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+;"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.step",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.step),
  iconClass: UI.ActionRegistration.IconClass.LARGE_ICON_STEP,
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  bindings: [
    {
      shortcut: "F9",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.step-out",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.stepOutOfCurrentFunction),
  iconClass: UI.ActionRegistration.IconClass.LARGE_ICON_STEP_OUT,
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  bindings: [
    {
      shortcut: "Shift+F11",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Shift+Ctrl+;"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Shift+Meta+;"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "debugger.run-snippet",
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.runSnippet),
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_PLAY,
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Enter"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Enter"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.toggle-breakpoints-active",
  iconClass: UI.ActionRegistration.IconClass.LARGE_ICON_DEACTIVATE_BREAKPOINTS,
  toggleable: true,
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.deactivateBreakpoints)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.activateBreakpoints)
    }
  ],
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+F8"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+F8"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.add-to-watch",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.WatchExpressionsSidebarPane.WatchExpressionsSidebarPane.instance();
  },
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  title: i18nLazyString(UIStrings.addSelectedTextToWatches),
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.UISourceCodeFrame.UISourceCodeFrame]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+A"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+A"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "debugger.evaluate-selection",
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.evaluateSelectedTextInConsole),
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.UISourceCodeFrame.UISourceCodeFrame]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+E"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+E"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.switch-file",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.switchFile),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.SwitchFileActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      shortcut: "Alt+O"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.rename",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.rename),
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "F2"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Enter"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  actionId: "sources.close-all",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.closeAll)
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.jump-to-previous-location",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.jumpToPreviousEditingLocation),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      shortcut: "Alt+Minus"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.jump-to-next-location",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.jumpToNextEditingLocation),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      shortcut: "Alt+Plus"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.close-editor-tab",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.closeTheActiveTab),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      shortcut: "Alt+w"
    },
    {
      shortcut: "Ctrl+W",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Windows,
      shortcut: "Ctrl+F4",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.go-to-line",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.goToLine),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      shortcut: "Ctrl+g",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.go-to-member",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.goToAFunctionDeclarationruleSet),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+o",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+o",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+T",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+T",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      shortcut: "F12",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "debugger.toggle-breakpoint",
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  title: i18nLazyString(UIStrings.toggleBreakpoint),
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+b"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+b"
    },
    {
      shortcut: "F9",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "debugger.toggle-breakpoint-enabled",
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  title: i18nLazyString(UIStrings.toggleBreakpointEnabled),
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+b"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+b"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "debugger.breakpoint-input-window",
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  title: i18nLazyString(UIStrings.toggleBreakpointInputWindow),
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Alt+b"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Alt+b"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.save",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.save),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+s",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+s",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.save-all",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.saveAll),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesView.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+s"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Alt+s"
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+K S",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Alt+S",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  actionId: "sources.create-snippet",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesNavigator.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.createNewSnippet)
});
if (!Host.InspectorFrontendHost.InspectorFrontendHostInstance.isHostedMode()) {
  UI.ActionRegistration.registerActionExtension({
    category: UI.ActionRegistration.ActionCategory.SOURCES,
    actionId: "sources.add-folder-to-workspace",
    async loadActionDelegate() {
      const Sources = await loadSourcesModule();
      return Sources.SourcesNavigator.ActionDelegate.instance();
    },
    iconClass: UI.ActionRegistration.IconClass.LARGE_ICON_ADD,
    title: i18nLazyString(UIStrings.addFolderToWorkspace),
    condition: Root.Runtime.ConditionName.NOT_SOURCES_HIDE_ADD_FOLDER
  });
}
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.previous-call-frame",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.CallStackSidebarPane.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.previousCallFrame),
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  bindings: [
    {
      shortcut: "Ctrl+,"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  category: UI.ActionRegistration.ActionCategory.DEBUGGER,
  actionId: "debugger.next-call-frame",
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.CallStackSidebarPane.ActionDelegate.instance();
  },
  title: i18nLazyString(UIStrings.nextCallFrame),
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  bindings: [
    {
      shortcut: "Ctrl+."
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.search",
  title: i18nLazyString(UIStrings.search),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SearchSourcesView.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Alt+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.DEVTOOLS_DEFAULT,
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+J",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+F",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+J",
      keybindSets: [
        UI.ActionRegistration.KeybindSet.VS_CODE
      ]
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.increment-css",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.incrementCssUnitBy, { PH1: 1 }),
  bindings: [
    {
      shortcut: "Alt+Up"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.increment-css-by-ten",
  title: i18nLazyString(UIStrings.incrementCssUnitBy, { PH1: 10 }),
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  bindings: [
    {
      shortcut: "Alt+PageUp"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.decrement-css",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.decrementCssUnitBy, { PH1: 1 }),
  bindings: [
    {
      shortcut: "Alt+Down"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.decrement-css-by-ten",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.decrementCssUnitBy, { PH1: 10 }),
  bindings: [
    {
      shortcut: "Alt+PageDown"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.toggle-navigator-sidebar",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.toggleNavigatorSidebar),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+y"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+y"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "sources.toggle-debugger-sidebar",
  category: UI.ActionRegistration.ActionCategory.SOURCES,
  title: i18nLazyString(UIStrings.toggleDebuggerSidebar),
  async loadActionDelegate() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.ActionDelegate.instance();
  },
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.SourcesView.SourcesView]);
  },
  bindings: [
    {
      platform: UI.ActionRegistration.Platforms.WindowsLinux,
      shortcut: "Ctrl+Shift+h"
    },
    {
      platform: UI.ActionRegistration.Platforms.Mac,
      shortcut: "Meta+Shift+h"
    }
  ]
});
Common.Settings.registerSettingExtension({
  settingName: "navigatorGroupByFolder",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true
});
Common.Settings.registerSettingExtension({
  settingName: "navigatorGroupByAuthored",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.searchInAnonymousAndContent),
  settingName: "searchInAnonymousAndContentScripts",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.searchInAnonymousAndContent)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotSearchInAnonymousAndContent)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.automaticallyRevealFilesIn),
  settingName: "autoRevealInNavigator",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.automaticallyRevealFilesIn)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotAutomaticallyRevealFilesIn)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.enableJavascriptSourceMaps),
  settingName: "jsSourceMapsEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableJavascriptSourceMaps)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableJavascriptSourceMaps)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.enableTabMovesFocus),
  settingName: "textEditorTabMovesFocus",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableTabMovesFocus)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableTabMovesFocus)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.detectIndentation),
  settingName: "textEditorAutoDetectIndent",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.detectIndentation)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotDetectIndentation)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.autocompletion),
  settingName: "textEditorAutocompletion",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableAutocompletion)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableAutocompletion)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  title: i18nLazyString(UIStrings.bracketMatching),
  settingName: "textEditorBracketMatching",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableBracketMatching)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableBracketMatching)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.codeFolding),
  settingName: "textEditorCodeFolding",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableCodeFolding)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableCodeFolding)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.showWhitespaceCharacters),
  settingName: "showWhitespacesInEditor",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "original",
  options: [
    {
      title: i18nLazyString(UIStrings.doNotShowWhitespaceCharacters),
      text: i18nLazyString(UIStrings.none),
      value: "none"
    },
    {
      title: i18nLazyString(UIStrings.showAllWhitespaceCharacters),
      text: i18nLazyString(UIStrings.all),
      value: "all"
    },
    {
      title: i18nLazyString(UIStrings.showTrailingWhitespaceCharacters),
      text: i18nLazyString(UIStrings.trailing),
      value: "trailing"
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.displayVariableValuesInlineWhile),
  settingName: "inlineVariableValues",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.displayVariableValuesInlineWhile)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.doNotDisplayVariableValuesInline)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.enableAutoFocusOnDebuggerPaused),
  settingName: "autoFocusOnDebuggerPausedEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableAutoFocusOnDebuggerPaused)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableAutoFocusOnDebuggerPaused)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.enableCssSourceMaps),
  settingName: "cssSourceMapsEnabled",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.enableCssSourceMaps)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disableCssSourceMaps)
    }
  ]
});
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.allowScrollingPastEndOfFile),
  settingName: "allowScrollPastEof",
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: true,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.allowScrollingPastEndOfFile)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.disallowScrollingPastEndOfFile)
    }
  ]
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.NAVIGATOR_VIEW,
  category: UI.ViewManager.ViewLocationCategoryValues.SOURCES,
  async loadResolver() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.SourcesPanel.instance();
  }
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_TOP,
  category: UI.ViewManager.ViewLocationCategoryValues.SOURCES,
  async loadResolver() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.SourcesPanel.instance();
  }
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_BOTTOM,
  category: UI.ViewManager.ViewLocationCategoryValues.SOURCES,
  async loadResolver() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.SourcesPanel.instance();
  }
});
UI.ViewManager.registerLocationResolver({
  name: UI.ViewManager.ViewLocationValues.SOURCES_SIDEBAR_TABS,
  category: UI.ViewManager.ViewLocationCategoryValues.SOURCES,
  async loadResolver() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.SourcesPanel.instance();
  }
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return [
      Workspace.UISourceCode.UISourceCode,
      Workspace.UISourceCode.UILocation,
      SDK.RemoteObject.RemoteObject,
      SDK.NetworkRequest.NetworkRequest,
      ...maybeRetrieveContextTypes((Sources) => [Sources.UISourceCodeFrame.UISourceCodeFrame])
    ];
  },
  async loadProvider() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.SourcesPanel.instance();
  },
  experiment: void 0
});
UI.ContextMenu.registerProvider({
  async loadProvider() {
    const Sources = await loadSourcesModule();
    return Sources.WatchExpressionsSidebarPane.WatchExpressionsSidebarPane.instance();
  },
  contextTypes() {
    return [
      ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement
    ];
  },
  experiment: void 0
});
UI.ContextMenu.registerProvider({
  contextTypes() {
    return maybeRetrieveContextTypes((Sources) => [Sources.UISourceCodeFrame.UISourceCodeFrame]);
  },
  async loadProvider() {
    const Sources = await loadSourcesModule();
    return Sources.WatchExpressionsSidebarPane.WatchExpressionsSidebarPane.instance();
  },
  experiment: void 0
});
UI.ContextMenu.registerProvider({
  async loadProvider() {
    const Sources = await loadSourcesModule();
    return Sources.ScopeChainSidebarPane.OpenLinearMemoryInspector.instance();
  },
  experiment: void 0,
  contextTypes() {
    return [
      ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement
    ];
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      Workspace.UISourceCode.UILocation
    ];
  },
  destination: Common.Revealer.RevealerDestination.SOURCES_PANEL,
  async loadRevealer() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.UILocationRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.DebuggerModel.Location
    ];
  },
  destination: Common.Revealer.RevealerDestination.SOURCES_PANEL,
  async loadRevealer() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.DebuggerLocationRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      Workspace.UISourceCode.UISourceCode
    ];
  },
  destination: Common.Revealer.RevealerDestination.SOURCES_PANEL,
  async loadRevealer() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.UISourceCodeRevealer.instance();
  }
});
Common.Revealer.registerRevealer({
  contextTypes() {
    return [
      SDK.DebuggerModel.DebuggerPausedDetails
    ];
  },
  destination: Common.Revealer.RevealerDestination.SOURCES_PANEL,
  async loadRevealer() {
    const Sources = await loadSourcesModule();
    return Sources.SourcesPanel.DebuggerPausedDetailsRevealer.instance();
  }
});
UI.Toolbar.registerToolbarItem({
  actionId: "sources.add-folder-to-workspace",
  location: UI.Toolbar.ToolbarItemLocation.FILES_NAVIGATION_TOOLBAR,
  showLabel: true,
  condition: Root.Runtime.ConditionName.NOT_SOURCES_HIDE_ADD_FOLDER,
  loadItem: void 0,
  order: void 0,
  separator: void 0
});
UI.Context.registerListener({
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  async loadListener() {
    const Sources = await loadSourcesModule();
    return Sources.JavaScriptBreakpointsSidebarPane.JavaScriptBreakpointsSidebarPane.instance();
  }
});
UI.Context.registerListener({
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  async loadListener() {
    const Sources = await loadSourcesModule();
    return Sources.JavaScriptBreakpointsSidebarPane.JavaScriptBreakpointsSidebarPane.instance();
  }
});
UI.Context.registerListener({
  contextTypes() {
    return [SDK.DebuggerModel.DebuggerPausedDetails];
  },
  async loadListener() {
    const Sources = await loadSourcesModule();
    return Sources.CallStackSidebarPane.CallStackSidebarPane.instance();
  }
});
UI.Context.registerListener({
  contextTypes() {
    return [SDK.DebuggerModel.CallFrame];
  },
  async loadListener() {
    const Sources = await loadSourcesModule();
    return Sources.ScopeChainSidebarPane.ScopeChainSidebarPane.instance();
  }
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.NAVIGATOR_MENU_DEFAULT,
  actionId: "quickOpen.show",
  order: void 0
});
UI.ContextMenu.registerItem({
  location: UI.ContextMenu.ItemLocation.MAIN_MENU_DEFAULT,
  actionId: "sources.search",
  order: void 0
});
QuickOpen.FilteredListWidget.registerProvider({
  prefix: "@",
  iconName: "ic_command_go_to_symbol",
  async provider() {
    const Sources = await loadSourcesModule();
    return Sources.OutlineQuickOpen.OutlineQuickOpen.instance();
  },
  titlePrefix: i18nLazyString(UIStrings.goTo),
  titleSuggestion: i18nLazyString(UIStrings.symbol)
});
QuickOpen.FilteredListWidget.registerProvider({
  prefix: ":",
  iconName: "ic_command_go_to_line",
  async provider() {
    const Sources = await loadSourcesModule();
    return Sources.GoToLineQuickOpen.GoToLineQuickOpen.instance();
  },
  titlePrefix: i18nLazyString(UIStrings.goTo),
  titleSuggestion: i18nLazyString(UIStrings.line)
});
QuickOpen.FilteredListWidget.registerProvider({
  prefix: "",
  iconName: "ic_command_open_file",
  async provider() {
    const Sources = await loadSourcesModule();
    return Sources.OpenFileQuickOpen.OpenFileQuickOpen.instance();
  },
  titlePrefix: i18nLazyString(UIStrings.open),
  titleSuggestion: i18nLazyString(UIStrings.file)
});
//# sourceMappingURL=sources-meta.js.map
