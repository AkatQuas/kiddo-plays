import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as SourceMapScopes from "../../models/source_map_scopes/source_map_scopes.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as CodeMirror from "../../third_party/codemirror.next/codemirror.next.js";
import * as ObjectUI from "../../ui/legacy/components/object_ui/object_ui.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
import { AddSourceMapURLDialog } from "./AddSourceMapURLDialog.js";
import { BreakpointEditDialog, LogpointPrefix } from "./BreakpointEditDialog.js";
import { Plugin } from "./Plugin.js";
import { ScriptFormatterEditorAction } from "./ScriptFormatterEditorAction.js";
import { SourcesPanel } from "./SourcesPanel.js";
import { getRegisteredEditorActions } from "./SourcesView.js";
const UIStrings = {
  thisScriptIsOnTheDebuggersIgnore: "This script is on the debugger's ignore list",
  removeFromIgnoreList: "Remove from ignore list",
  configure: "Configure",
  sourceMapFoundButIgnoredForFile: "Source map found, but ignored for file on ignore list.",
  addBreakpoint: "Add breakpoint",
  addConditionalBreakpoint: "Add conditional breakpoint\u2026",
  addLogpoint: "Add logpoint\u2026",
  neverPauseHere: "Never pause here",
  removeBreakpoint: "{n, plural, =1 {Remove breakpoint} other {Remove all breakpoints in line}}",
  editBreakpoint: "Edit breakpoint\u2026",
  disableBreakpoint: "{n, plural, =1 {Disable breakpoint} other {Disable all breakpoints in line}}",
  enableBreakpoint: "{n, plural, =1 {Enable breakpoint} other {Enable all breakpoints in line}}",
  addSourceMap: "Add source map\u2026",
  sourceMapDetected: "Source map detected.",
  prettyprintThisMinifiedFile: "Pretty-print this minified file?",
  prettyprint: "Pretty-print",
  prettyprintingWillFormatThisFile: "Pretty-printing will format this file in a new tab where you can continue debugging. You can also pretty-print this file by clicking the {PH1} button on the bottom status bar.",
  associatedFilesAreAvailable: "Associated files are available via file tree or {PH1}.",
  associatedFilesShouldBeAdded: "Associated files should be added to the file tree. You can debug these resolved source files as regular JavaScript files.",
  theDebuggerWillSkipStepping: "The debugger will skip stepping through this script, and will not stop on exceptions.",
  debugFileNotFound: 'Failed to load debug file "{PH1}".',
  debugInfoNotFound: "Failed to load any debug info for {PH1}."
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/DebuggerPlugin.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const MAX_POSSIBLE_BREAKPOINT_LINE = 2500;
export class DebuggerPlugin extends Plugin {
  constructor(uiSourceCode, transformer) {
    super(uiSourceCode);
    this.transformer = transformer;
    this.scriptsPanel = SourcesPanel.instance();
    this.breakpointManager = Bindings.BreakpointManager.BreakpointManager.instance();
    this.popoverHelper = new UI.PopoverHelper.PopoverHelper(this.scriptsPanel.element, this.getPopoverRequest.bind(this));
    this.popoverHelper.setDisableOnClick(true);
    this.popoverHelper.setTimeout(250, 250);
    this.popoverHelper.setHasPadding(true);
    this.breakpointManager.addEventListener(Bindings.BreakpointManager.Events.BreakpointAdded, this.breakpointChange, this);
    this.breakpointManager.addEventListener(Bindings.BreakpointManager.Events.BreakpointRemoved, this.breakpointChange, this);
    this.uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.workingCopyChanged, this);
    this.uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this);
    this.scriptFileForDebuggerModel = /* @__PURE__ */ new Map();
    Common.Settings.Settings.instance().moduleSetting("skipStackFramesPattern").addChangeListener(this.showIgnoreListInfobarIfNeeded, this);
    Common.Settings.Settings.instance().moduleSetting("skipContentScripts").addChangeListener(this.showIgnoreListInfobarIfNeeded, this);
    UI.Context.Context.instance().addFlavorChangeListener(SDK.DebuggerModel.CallFrame, this.callFrameChanged, this);
    this.liveLocationPool = new Bindings.LiveLocation.LiveLocationPool();
    this.updateScriptFiles();
    this.muted = this.uiSourceCode.isDirty();
    this.initializedMuted = this.muted;
    this.ignoreListInfobar = null;
    this.showIgnoreListInfobarIfNeeded();
    for (const scriptFile of this.scriptFileForDebuggerModel.values()) {
      scriptFile.checkMapping();
    }
    if (!Root.Runtime.experiments.isEnabled("sourcesPrettyPrint")) {
      this.prettyPrintInfobar = null;
      void this.detectMinified();
    }
  }
  editor = void 0;
  executionLocation = null;
  controlDown = false;
  controlTimeout = void 0;
  sourceMapInfobar = null;
  scriptsPanel;
  breakpointManager;
  popoverHelper;
  scriptFileForDebuggerModel;
  breakpoints = [];
  continueToLocations = null;
  liveLocationPool;
  muted;
  initializedMuted;
  ignoreListInfobar;
  prettyPrintInfobar;
  refreshBreakpointsTimeout = void 0;
  activeBreakpointDialog = null;
  missingDebugInfoBar = null;
  editorExtension() {
    const handlers = this.shortcutHandlers();
    return [
      CodeMirror.EditorView.updateListener.of((update) => this.onEditorUpdate(update)),
      CodeMirror.EditorView.domEventHandlers({
        keydown: (event) => {
          if (this.onKeyDown(event)) {
            return true;
          }
          handlers(event);
          return event.defaultPrevented;
        },
        keyup: (event) => this.onKeyUp(event),
        mousemove: (event) => this.onMouseMove(event),
        mousedown: (event) => this.onMouseDown(event),
        focusout: (event) => this.onBlur(event),
        wheel: (event) => this.onWheel(event)
      }),
      CodeMirror.lineNumbers({
        domEventHandlers: {
          mousedown: (view, block, event) => this.handleGutterClick(view.state.doc.lineAt(block.from), event)
        }
      }),
      infobarState,
      breakpointMarkers,
      CodeMirror.Prec.highest(executionLine.field),
      CodeMirror.Prec.lowest(continueToMarkers.field),
      markIfContinueTo,
      valueDecorations.field,
      CodeMirror.Prec.lowest(evalExpression.field),
      theme,
      this.uiSourceCode.project().type() === Workspace.Workspace.projectTypes.Debugger ? CodeMirror.EditorView.editorAttributes.of({ class: "source-frame-debugger-script" }) : []
    ];
  }
  shortcutHandlers() {
    const selectionLine = (editor) => {
      return editor.state.doc.lineAt(editor.state.selection.main.head);
    };
    return UI.ShortcutRegistry.ShortcutRegistry.instance().getShortcutListener({
      "debugger.toggle-breakpoint": async () => {
        if (this.muted || !this.editor) {
          return false;
        }
        await this.toggleBreakpoint(selectionLine(this.editor), false);
        return true;
      },
      "debugger.toggle-breakpoint-enabled": async () => {
        if (this.muted || !this.editor) {
          return false;
        }
        await this.toggleBreakpoint(selectionLine(this.editor), true);
        return true;
      },
      "debugger.breakpoint-input-window": async () => {
        if (this.muted || !this.editor) {
          return false;
        }
        const line = selectionLine(this.editor);
        const breakpoint = this.breakpoints.find((b) => b.position >= line.from && b.position <= line.to)?.breakpoint || null;
        const isLogpoint = breakpoint ? breakpoint.condition().includes(LogpointPrefix) : false;
        this.editBreakpointCondition(line, breakpoint, null, isLogpoint);
        return true;
      }
    });
  }
  editorInitialized(editor) {
    this.editor = editor;
    computeNonBreakableLines(editor.state, this.uiSourceCode).then((linePositions) => {
      if (linePositions.length) {
        editor.dispatch({ effects: SourceFrame.SourceFrame.addNonBreakableLines.of(linePositions) });
      }
    }, console.error);
    if (this.missingDebugInfoBar) {
      this.attachInfobar(this.missingDebugInfoBar);
    }
    if (!this.muted) {
      void this.refreshBreakpoints();
    }
    void this.callFrameChanged();
  }
  static accepts(uiSourceCode) {
    return uiSourceCode.contentType().hasScripts();
  }
  showIgnoreListInfobarIfNeeded() {
    const uiSourceCode = this.uiSourceCode;
    if (!uiSourceCode.contentType().hasScripts()) {
      return;
    }
    const projectType = uiSourceCode.project().type();
    if (!Bindings.IgnoreListManager.IgnoreListManager.instance().isIgnoreListedUISourceCode(uiSourceCode)) {
      this.hideIgnoreListInfobar();
      return;
    }
    if (this.ignoreListInfobar) {
      this.ignoreListInfobar.dispose();
    }
    function unIgnoreList() {
      Bindings.IgnoreListManager.IgnoreListManager.instance().unIgnoreListUISourceCode(uiSourceCode);
      if (projectType === Workspace.Workspace.projectTypes.ContentScripts) {
        Bindings.IgnoreListManager.IgnoreListManager.instance().unIgnoreListContentScripts();
      }
    }
    const infobar = new UI.Infobar.Infobar(UI.Infobar.Type.Warning, i18nString(UIStrings.thisScriptIsOnTheDebuggersIgnore), [
      { text: i18nString(UIStrings.removeFromIgnoreList), highlight: false, delegate: unIgnoreList, dismiss: true },
      {
        text: i18nString(UIStrings.configure),
        highlight: false,
        delegate: UI.ViewManager.ViewManager.instance().showView.bind(UI.ViewManager.ViewManager.instance(), "blackbox"),
        dismiss: false
      }
    ]);
    this.ignoreListInfobar = infobar;
    infobar.setCloseCallback(() => this.removeInfobar(this.ignoreListInfobar));
    infobar.createDetailsRowMessage(i18nString(UIStrings.theDebuggerWillSkipStepping));
    const scriptFile = this.scriptFileForDebuggerModel.size ? this.scriptFileForDebuggerModel.values().next().value : null;
    if (scriptFile && scriptFile.hasSourceMapURL()) {
      infobar.createDetailsRowMessage(i18nString(UIStrings.sourceMapFoundButIgnoredForFile));
    }
    this.attachInfobar(this.ignoreListInfobar);
  }
  attachInfobar(bar) {
    if (this.editor) {
      this.editor.dispatch({ effects: addInfobar.of(bar) });
    }
  }
  removeInfobar(bar) {
    if (this.editor && bar) {
      this.editor.dispatch({ effects: removeInfobar.of(bar) });
    }
  }
  hideIgnoreListInfobar() {
    if (!this.ignoreListInfobar) {
      return;
    }
    this.ignoreListInfobar.dispose();
    this.ignoreListInfobar = null;
  }
  willHide() {
    this.popoverHelper.hidePopover();
  }
  populateLineGutterContextMenu(contextMenu, editorLineNumber) {
    const uiLocation = new Workspace.UISourceCode.UILocation(this.uiSourceCode, editorLineNumber, 0);
    this.scriptsPanel.appendUILocationItems(contextMenu, uiLocation);
    if (this.muted || !this.editor) {
      return;
    }
    const line = this.editor.state.doc.line(editorLineNumber + 1);
    const breakpoints = this.lineBreakpoints(line);
    const supportsConditionalBreakpoints = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().supportsConditionalBreakpoints(this.uiSourceCode);
    if (!breakpoints.length) {
      if (this.editor && SourceFrame.SourceFrame.isBreakableLine(this.editor.state, line)) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.addBreakpoint), this.createNewBreakpoint.bind(this, line, "", true));
        if (supportsConditionalBreakpoints) {
          contextMenu.debugSection().appendItem(i18nString(UIStrings.addConditionalBreakpoint), this.editBreakpointCondition.bind(this, line, null, null, false));
          contextMenu.debugSection().appendItem(i18nString(UIStrings.addLogpoint), this.editBreakpointCondition.bind(this, line, null, null, true));
          contextMenu.debugSection().appendItem(i18nString(UIStrings.neverPauseHere), this.createNewBreakpoint.bind(this, line, "false", true));
        }
      }
    } else {
      const removeTitle = i18nString(UIStrings.removeBreakpoint, { n: breakpoints.length });
      contextMenu.debugSection().appendItem(removeTitle, () => breakpoints.forEach((breakpoint) => void breakpoint.remove(false)));
      if (breakpoints.length === 1 && supportsConditionalBreakpoints) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.editBreakpoint), this.editBreakpointCondition.bind(this, line, breakpoints[0], null, false));
      }
      const hasEnabled = breakpoints.some((breakpoint) => breakpoint.enabled());
      if (hasEnabled) {
        const title = i18nString(UIStrings.disableBreakpoint, { n: breakpoints.length });
        contextMenu.debugSection().appendItem(title, () => breakpoints.forEach((breakpoint) => breakpoint.setEnabled(false)));
      }
      const hasDisabled = breakpoints.some((breakpoint) => !breakpoint.enabled());
      if (hasDisabled) {
        const title = i18nString(UIStrings.enableBreakpoint, { n: breakpoints.length });
        contextMenu.debugSection().appendItem(title, () => breakpoints.forEach((breakpoint) => breakpoint.setEnabled(true)));
      }
    }
  }
  populateTextAreaContextMenu(contextMenu) {
    function addSourceMapURL(scriptFile) {
      const dialog = new AddSourceMapURLDialog(addSourceMapURLDialogCallback.bind(null, scriptFile));
      dialog.show();
    }
    function addSourceMapURLDialogCallback(scriptFile, url) {
      if (!url) {
        return;
      }
      scriptFile.addSourceMapURL(url);
    }
    if (this.uiSourceCode.project().type() === Workspace.Workspace.projectTypes.Network && Common.Settings.Settings.instance().moduleSetting("jsSourceMapsEnabled").get() && !Bindings.IgnoreListManager.IgnoreListManager.instance().isIgnoreListedUISourceCode(this.uiSourceCode)) {
      if (this.scriptFileForDebuggerModel.size) {
        const scriptFile = this.scriptFileForDebuggerModel.values().next().value;
        const addSourceMapURLLabel = i18nString(UIStrings.addSourceMap);
        contextMenu.debugSection().appendItem(addSourceMapURLLabel, addSourceMapURL.bind(null, scriptFile));
      }
    }
  }
  workingCopyChanged() {
    if (!this.scriptFileForDebuggerModel.size) {
      this.setMuted(this.uiSourceCode.isDirty());
    }
  }
  workingCopyCommitted() {
    this.scriptsPanel.updateLastModificationTime();
    if (!this.scriptFileForDebuggerModel.size) {
      this.setMuted(false);
    }
  }
  didMergeToVM() {
    if (this.consistentScripts()) {
      this.setMuted(false);
    }
  }
  didDivergeFromVM() {
    this.setMuted(true);
  }
  setMuted(value) {
    if (this.initializedMuted) {
      return;
    }
    if (value !== this.muted) {
      this.muted = value;
      if (!value) {
        void this.restoreBreakpointsAfterEditing();
      } else if (this.editor) {
        this.editor.dispatch({ effects: muteBreakpoints.of(null) });
      }
    }
  }
  consistentScripts() {
    for (const scriptFile of this.scriptFileForDebuggerModel.values()) {
      if (scriptFile.hasDivergedFromVM() || scriptFile.isMergingToVM()) {
        return false;
      }
    }
    return true;
  }
  isVariableIdentifier(tokenType) {
    return tokenType === "VariableName" || tokenType === "VariableDefinition";
  }
  isIdentifier(tokenType) {
    return tokenType === "VariableName" || tokenType === "VariableDefinition" || tokenType === "PropertyName" || tokenType === "PropertyDefinition";
  }
  getPopoverRequest(event) {
    if (UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlEquivalentKey(event)) {
      return null;
    }
    const target = UI.Context.Context.instance().flavor(SDK.Target.Target);
    const debuggerModel = target ? target.model(SDK.DebuggerModel.DebuggerModel) : null;
    const { editor } = this;
    if (!debuggerModel || !debuggerModel.isPaused() || !editor) {
      return null;
    }
    const selectedCallFrame = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!selectedCallFrame) {
      return null;
    }
    let textPosition = editor.editor.posAtCoords(event);
    if (!textPosition) {
      return null;
    }
    const positionCoords = editor.editor.coordsAtPos(textPosition);
    if (!positionCoords || event.clientY < positionCoords.top || event.clientY > positionCoords.bottom || event.clientX < positionCoords.left - 30 || event.clientX > positionCoords.right + 30) {
      return null;
    }
    if (event.clientX < positionCoords.left && textPosition > editor.state.doc.lineAt(textPosition).from) {
      textPosition -= 1;
    }
    const textSelection = editor.state.selection.main;
    let highlightRange;
    if (!textSelection.empty) {
      if (textPosition < textSelection.from || textPosition > textSelection.to) {
        return null;
      }
      highlightRange = textSelection;
    } else if (this.uiSourceCode.mimeType() === "application/wasm") {
      const node = CodeMirror.syntaxTree(editor.state).resolveInner(textPosition, 1);
      if (node.name !== "Identifier") {
        return null;
      }
      const controlInstructions = ["block", "loop", "if", "else", "end", "br", "br_if", "br_table"];
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.name === "App") {
          const firstChild = parent.firstChild;
          const opName = firstChild?.name === "Keyword" && editor.state.sliceDoc(firstChild.from, firstChild.to);
          if (opName && controlInstructions.includes(opName)) {
            return null;
          }
        }
      }
      highlightRange = node;
    } else if (/^text\/(javascript|typescript|jsx)/.test(this.uiSourceCode.mimeType())) {
      let node = CodeMirror.syntaxTree(editor.state).resolveInner(textPosition, 1);
      if (node?.firstChild) {
        return null;
      }
      while (node && node.name !== "this" && node.name !== "VariableDefinition" && node.name !== "VariableName" && node.name !== "MemberExpression" && !(node.name === "PropertyName" && node.parent?.name === "PatternProperty" && node.nextSibling?.name !== ":") && !(node.name === "PropertyDefinition" && node.parent?.name === "Property" && node.nextSibling?.name !== ":")) {
        node = node.parent;
      }
      if (!node) {
        return null;
      }
      highlightRange = node;
    } else {
      const node = CodeMirror.syntaxTree(editor.state).resolveInner(textPosition, 1);
      if (node.to - node.from > 50 || /[^\w_\-$]/.test(editor.state.sliceDoc(node.from, node.to))) {
        return null;
      }
      highlightRange = node;
    }
    const highlightLine = editor.state.doc.lineAt(highlightRange.from);
    if (highlightRange.to > highlightLine.to) {
      return null;
    }
    const leftCorner = editor.editor.coordsAtPos(highlightRange.from);
    const rightCorner = editor.editor.coordsAtPos(highlightRange.to);
    if (!leftCorner || !rightCorner) {
      return null;
    }
    const box = new AnchorBox(leftCorner.left, leftCorner.top - 2, rightCorner.right - leftCorner.left, rightCorner.bottom - leftCorner.top);
    const evaluationText = editor.state.sliceDoc(highlightRange.from, highlightRange.to);
    let objectPopoverHelper = null;
    async function evaluate(uiSourceCode, evaluationText2) {
      const resolvedText = await SourceMapScopes.NamesResolver.resolveExpression(selectedCallFrame, evaluationText2, uiSourceCode, highlightLine.number - 1, highlightRange.from - highlightLine.from, highlightRange.to - highlightLine.from);
      return await selectedCallFrame.evaluate({
        expression: resolvedText || evaluationText2,
        objectGroup: "popover",
        includeCommandLineAPI: false,
        silent: true,
        returnByValue: false,
        generatePreview: false,
        throwOnSideEffect: void 0,
        timeout: void 0,
        disableBreaks: void 0,
        replMode: void 0,
        allowUnsafeEvalBlockedByCSP: void 0
      });
    }
    return {
      box,
      show: async (popover) => {
        const result = await evaluate(this.uiSourceCode, evaluationText);
        if (!result || "error" in result || !result.object || result.object.type === "object" && result.object.subtype === "error") {
          return false;
        }
        objectPopoverHelper = await ObjectUI.ObjectPopoverHelper.ObjectPopoverHelper.buildObjectPopover(result.object, popover);
        const potentiallyUpdatedCallFrame = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
        if (!objectPopoverHelper || selectedCallFrame !== potentiallyUpdatedCallFrame) {
          debuggerModel.runtimeModel().releaseObjectGroup("popover");
          if (objectPopoverHelper) {
            objectPopoverHelper.dispose();
          }
          return false;
        }
        const decoration = CodeMirror.Decoration.set(evalExpressionMark.range(highlightRange.from, highlightRange.to));
        editor.dispatch({ effects: evalExpression.update.of(decoration) });
        return true;
      },
      hide: () => {
        if (objectPopoverHelper) {
          objectPopoverHelper.dispose();
        }
        debuggerModel.runtimeModel().releaseObjectGroup("popover");
        editor.dispatch({ effects: evalExpression.update.of(CodeMirror.Decoration.none) });
      }
    };
  }
  onEditorUpdate(update) {
    if (!update.changes.empty) {
      for (const breakpointDesc of this.breakpoints) {
        breakpointDesc.position = update.changes.mapPos(breakpointDesc.position);
      }
    }
  }
  onWheel(event) {
    if (this.executionLocation && UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlEquivalentKey(event)) {
      event.preventDefault();
    }
  }
  onKeyDown(event) {
    const ctrlDown = UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlEquivalentKey(event);
    if (!ctrlDown) {
      this.setControlDown(false);
    }
    if (event.key === Platform.KeyboardUtilities.ESCAPE_KEY) {
      if (this.popoverHelper.isPopoverVisible()) {
        this.popoverHelper.hidePopover();
        event.consume();
        return true;
      }
    }
    if (ctrlDown && this.executionLocation) {
      this.setControlDown(true);
    }
    return false;
  }
  onMouseMove(event) {
    if (this.executionLocation && this.controlDown && UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlEquivalentKey(event)) {
      if (!this.continueToLocations) {
        void this.showContinueToLocations();
      }
    }
  }
  onMouseDown(event) {
    if (!this.executionLocation || !UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlEquivalentKey(event)) {
      return;
    }
    if (!this.continueToLocations || !this.editor) {
      return;
    }
    event.consume();
    const textPosition = this.editor.editor.posAtCoords(event);
    if (textPosition === null) {
      return;
    }
    for (const { from, to, click } of this.continueToLocations) {
      if (from <= textPosition && to >= textPosition) {
        click();
        break;
      }
    }
  }
  onBlur(_event) {
    this.setControlDown(false);
  }
  onKeyUp(_event) {
    this.setControlDown(false);
  }
  setControlDown(state) {
    if (state !== this.controlDown) {
      this.controlDown = state;
      clearTimeout(this.controlTimeout);
      this.controlTimeout = void 0;
      if (state && this.executionLocation) {
        this.controlTimeout = window.setTimeout(() => {
          if (this.executionLocation && this.controlDown) {
            void this.showContinueToLocations();
          }
        }, 150);
      } else {
        this.clearContinueToLocations();
      }
    }
  }
  editBreakpointCondition(line, breakpoint, location, preferLogpoint) {
    const editor = this.editor;
    const oldCondition = breakpoint ? breakpoint.condition() : "";
    const decorationElement = document.createElement("div");
    const compartment = new CodeMirror.Compartment();
    const dialog = new BreakpointEditDialog(line.number - 1, oldCondition, Boolean(preferLogpoint), async (result) => {
      this.activeBreakpointDialog = null;
      dialog.detach();
      editor.dispatch({ effects: compartment.reconfigure([]) });
      if (!result.committed) {
        return;
      }
      if (breakpoint) {
        breakpoint.setCondition(result.condition);
      } else if (location) {
        await this.setBreakpoint(location.lineNumber, location.columnNumber, result.condition, true);
      } else {
        await this.createNewBreakpoint(line, result.condition, true);
      }
    });
    editor.dispatch({
      effects: CodeMirror.StateEffect.appendConfig.of(compartment.of(CodeMirror.EditorView.decorations.of(CodeMirror.Decoration.set([CodeMirror.Decoration.widget({
        block: true,
        widget: new class extends CodeMirror.WidgetType {
          toDOM() {
            return decorationElement;
          }
        }(),
        side: 1
      }).range(line.from)]))))
    });
    dialog.markAsExternallyManaged();
    dialog.show(decorationElement);
    dialog.focusEditor();
    this.activeBreakpointDialog = dialog;
  }
  computeExecutionDecorations(editorState, lineNumber, columnNumber) {
    const { doc } = editorState;
    if (lineNumber >= doc.lines) {
      return CodeMirror.Decoration.none;
    }
    const line = doc.line(lineNumber + 1);
    const decorations = [executionLineDeco.range(line.from)];
    const position = Math.min(line.to, line.from + columnNumber);
    let syntaxNode = CodeMirror.syntaxTree(editorState).resolveInner(position, 1);
    if (syntaxNode.to === syntaxNode.from - 1 && /[(.]/.test(doc.sliceString(syntaxNode.from, syntaxNode.to))) {
      syntaxNode = syntaxNode.resolve(syntaxNode.to, 1);
    }
    const tokenEnd = Math.min(line.to, syntaxNode.to);
    if (tokenEnd > position) {
      decorations.push(executionTokenDeco.range(position, tokenEnd));
    }
    return CodeMirror.Decoration.set(decorations);
  }
  async updateValueDecorations() {
    if (!this.editor) {
      return;
    }
    const decorations = this.executionLocation ? await this.computeValueDecorations() : null;
    if (decorations || this.editor.state.field(valueDecorations.field).size) {
      this.editor.dispatch({ effects: valueDecorations.update.of(decorations || CodeMirror.Decoration.none) });
    }
  }
  async computeValueDecorations() {
    if (!this.editor) {
      return null;
    }
    if (!Common.Settings.Settings.instance().moduleSetting("inlineVariableValues").get()) {
      return null;
    }
    const executionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
    if (!executionContext) {
      return null;
    }
    const callFrame = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!callFrame) {
      return null;
    }
    const localScope = callFrame.localScope();
    if (!localScope || !callFrame.functionLocation()) {
      return null;
    }
    const { properties } = await SourceMapScopes.NamesResolver.resolveScopeInObject(localScope).getAllProperties(false, false);
    if (!properties || !properties.length || properties.length > 500) {
      return null;
    }
    const functionUILocationPromise = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(callFrame.functionLocation());
    const executionUILocationPromise = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(callFrame.location());
    const [functionUILocation, executionUILocation] = await Promise.all([functionUILocationPromise, executionUILocationPromise]);
    if (!functionUILocation || !executionUILocation || functionUILocation.uiSourceCode.url() !== this.uiSourceCode.url() || executionUILocation.uiSourceCode.url() !== this.uiSourceCode.url()) {
      return null;
    }
    const functionLocation = this.transformer.uiLocationToEditorLocation(functionUILocation.lineNumber, functionUILocation.columnNumber);
    const executionLocation = this.transformer.uiLocationToEditorLocation(executionUILocation.lineNumber, executionUILocation.columnNumber);
    if (functionLocation.lineNumber >= executionLocation.lineNumber || executionLocation.lineNumber - functionLocation.lineNumber > 500 || functionLocation.lineNumber < 0 || executionLocation.lineNumber >= this.editor.state.doc.lines) {
      return null;
    }
    const variableMap = new Map(properties.map((p) => [p.name, p.value]));
    const variablesByLine = this.getVariablesByLine(this.editor.state, variableMap, functionLocation, executionLocation);
    if (!variablesByLine) {
      return null;
    }
    const decorations = [];
    for (const [line, names] of variablesByLine) {
      const prevLine = variablesByLine.get(line - 1);
      let newNames = prevLine ? Array.from(names).filter((n) => !prevLine.has(n)) : Array.from(names);
      if (!newNames.length) {
        continue;
      }
      if (newNames.length > 10) {
        newNames = newNames.slice(0, 10);
      }
      const pairs = newNames.map((name) => [name, variableMap.get(name)]);
      decorations.push(CodeMirror.Decoration.widget({ widget: new ValueDecoration(pairs), side: 1 }).range(this.editor.state.doc.line(line + 1).to));
    }
    return CodeMirror.Decoration.set(decorations, true);
  }
  getVariablesByLine(editorState, variableMap, fromLoc, toLoc) {
    const fromLine = editorState.doc.line(fromLoc.lineNumber + 1);
    const fromPos = Math.min(fromLine.to, fromLine.from + fromLoc.columnNumber);
    const toPos = editorState.doc.line(toLoc.lineNumber + 1).from;
    const tree = CodeMirror.ensureSyntaxTree(editorState, toPos, 100);
    if (!tree) {
      return null;
    }
    const namesPerLine = /* @__PURE__ */ new Map();
    let curLine = fromLine;
    tree.iterate({
      from: fromPos,
      to: toPos,
      enter: (node) => {
        const varName = this.isVariableIdentifier(node.name) && editorState.sliceDoc(node.from, node.to);
        if (varName && variableMap.has(varName)) {
          if (node.from > curLine.to) {
            curLine = editorState.doc.lineAt(node.from);
          }
          let names = namesPerLine.get(curLine.number - 1);
          if (!names) {
            names = /* @__PURE__ */ new Set();
            namesPerLine.set(curLine.number - 1, names);
          }
          names.add(varName);
        }
      }
    });
    return namesPerLine;
  }
  async showContinueToLocations() {
    this.popoverHelper.hidePopover();
    const executionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
    if (!executionContext || !this.editor) {
      return;
    }
    const callFrame = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!callFrame) {
      return;
    }
    const start = callFrame.functionLocation() || callFrame.location();
    const debuggerModel = callFrame.debuggerModel;
    const { state } = this.editor;
    const locations = await debuggerModel.getPossibleBreakpoints(start, null, true);
    this.continueToLocations = [];
    let previousCallLine = -1;
    for (const location of locations.reverse()) {
      const editorLocation = this.transformer.uiLocationToEditorLocation(location.lineNumber, location.columnNumber);
      if (previousCallLine === editorLocation.lineNumber && location.type !== Protocol.Debugger.BreakLocationType.Call || editorLocation.lineNumber >= state.doc.lines) {
        continue;
      }
      const line = state.doc.line(editorLocation.lineNumber + 1);
      const position = Math.min(line.to, line.from + editorLocation.columnNumber);
      let syntaxNode = CodeMirror.syntaxTree(state).resolveInner(position, 1);
      if (syntaxNode.firstChild || syntaxNode.from < line.from || syntaxNode.to > line.to) {
        continue;
      }
      if (syntaxNode.name === ".") {
        const nextNode = syntaxNode.resolve(syntaxNode.to, 1);
        if (nextNode.firstChild || nextNode.from < line.from || nextNode.to > line.to) {
          continue;
        }
        syntaxNode = nextNode;
      }
      const syntaxType = syntaxNode.name;
      const validKeyword = syntaxType === "this" || syntaxType === "return" || syntaxType === "new" || syntaxType === "break" || syntaxType === "continue";
      if (!validKeyword && !this.isIdentifier(syntaxType)) {
        continue;
      }
      this.continueToLocations.push({ from: syntaxNode.from, to: syntaxNode.to, async: false, click: () => location.continueToLocation() });
      if (location.type === Protocol.Debugger.BreakLocationType.Call) {
        previousCallLine = editorLocation.lineNumber;
      }
      const identifierName = validKeyword ? "" : line.text.slice(syntaxNode.from - line.from, syntaxNode.to - line.from);
      let asyncCall = null;
      if (identifierName === "then" && syntaxNode.parent?.name === "MemberExpression") {
        asyncCall = syntaxNode.parent.parent;
      } else if (identifierName === "setTimeout" || identifierName === "setInterval" || identifierName === "postMessage") {
        asyncCall = syntaxNode.parent;
      }
      if (syntaxType === "new") {
        const callee = syntaxNode.parent?.getChild("Expression");
        if (callee && callee.name === "VariableName" && state.sliceDoc(callee.from, callee.to) === "Worker") {
          asyncCall = syntaxNode.parent;
        }
      }
      if (asyncCall && (asyncCall.name === "CallExpression" || asyncCall.name === "NewExpression") && location.type === Protocol.Debugger.BreakLocationType.Call) {
        const firstArg = asyncCall.getChild("ArgList")?.firstChild?.nextSibling;
        let highlightNode;
        if (firstArg?.name === "VariableName") {
          highlightNode = firstArg;
        } else if (firstArg?.name === "ArrowFunction" || firstArg?.name === "FunctionExpression") {
          highlightNode = firstArg.firstChild;
          if (highlightNode?.name === "async") {
            highlightNode = highlightNode.nextSibling;
          }
        }
        if (highlightNode) {
          const isCurrentPosition = this.executionLocation && location.lineNumber === this.executionLocation.lineNumber && location.columnNumber === this.executionLocation.columnNumber;
          this.continueToLocations.push({
            from: highlightNode.from,
            to: highlightNode.to,
            async: true,
            click: () => this.asyncStepIn(location, Boolean(isCurrentPosition))
          });
        }
      }
    }
    const decorations = CodeMirror.Decoration.set(this.continueToLocations.map((loc) => {
      return (loc.async ? asyncContinueToMark : continueToMark).range(loc.from, loc.to);
    }), true);
    this.editor.dispatch({ effects: continueToMarkers.update.of(decorations) });
  }
  clearContinueToLocations() {
    if (this.editor && this.editor.state.field(continueToMarkers.field).size) {
      this.editor.dispatch({ effects: continueToMarkers.update.of(CodeMirror.Decoration.none) });
    }
  }
  asyncStepIn(location, isCurrentPosition) {
    if (!isCurrentPosition) {
      location.continueToLocation(asyncStepIn);
    } else {
      asyncStepIn();
    }
    function asyncStepIn() {
      location.debuggerModel.scheduleStepIntoAsync();
    }
  }
  fetchBreakpoints() {
    if (!this.editor) {
      return [];
    }
    const { editor } = this;
    const breakpointLocations = this.breakpointManager.breakpointLocationsForUISourceCode(this.uiSourceCode);
    return breakpointLocations.map(({ uiLocation, breakpoint }) => {
      const editorLocation = this.transformer.uiLocationToEditorLocation(uiLocation.lineNumber, uiLocation.columnNumber);
      return {
        position: editor.toOffset(editorLocation),
        breakpoint
      };
    });
  }
  lineBreakpoints(line) {
    return this.breakpoints.filter((b) => b.position >= line.from && b.position <= line.to).map((b) => b.breakpoint);
  }
  async computeBreakpointDecoration(state, breakpoints) {
    const decorations = [];
    const gutterMarkers = [];
    const breakpointsByLine = /* @__PURE__ */ new Map();
    const inlineMarkersByLine = /* @__PURE__ */ new Map();
    const possibleBreakpointRequests = [];
    const inlineMarkerPositions = /* @__PURE__ */ new Set();
    const addInlineMarker = (linePos, columnNumber, breakpoint) => {
      let inlineMarkers = inlineMarkersByLine.get(linePos);
      if (!inlineMarkers) {
        inlineMarkers = [];
        inlineMarkersByLine.set(linePos, inlineMarkers);
      }
      inlineMarkers.push({ breakpoint, column: columnNumber });
    };
    for (const { position, breakpoint } of breakpoints) {
      const line = state.doc.lineAt(position);
      let forThisLine = breakpointsByLine.get(line.from);
      if (!forThisLine) {
        forThisLine = [];
        breakpointsByLine.set(line.from, forThisLine);
      }
      if (breakpoint.enabled() && forThisLine.every((b) => !b.enabled())) {
        const start = this.transformer.editorLocationToUILocation(line.number - 1, 0);
        const end = this.transformer.editorLocationToUILocation(line.number - 1, Math.min(line.length, MAX_POSSIBLE_BREAKPOINT_LINE));
        const range = new TextUtils.TextRange.TextRange(start.lineNumber, start.columnNumber || 0, end.lineNumber, end.columnNumber || 0);
        possibleBreakpointRequests.push(this.breakpointManager.possibleBreakpoints(this.uiSourceCode, range).then((locations) => addPossibleBreakpoints(line, locations)));
      }
      forThisLine.push(breakpoint);
      if (breakpoint.enabled()) {
        inlineMarkerPositions.add(position);
        addInlineMarker(line.from, position - line.from, breakpoint);
      }
    }
    for (const [lineStart, lineBreakpoints] of breakpointsByLine) {
      const main = lineBreakpoints.sort(mostSpecificBreakpoint)[0];
      let gutterClass = "cm-breakpoint";
      if (!main.enabled()) {
        gutterClass += " cm-breakpoint-disabled";
      }
      if (!main.bound()) {
        gutterClass += " cm-breakpoint-unbound";
      }
      if (main.condition().includes(LogpointPrefix)) {
        gutterClass += " cm-breakpoint-logpoint";
      } else if (main.condition()) {
        gutterClass += " cm-breakpoint-conditional";
      }
      gutterMarkers.push(new BreakpointGutterMarker(gutterClass).range(lineStart));
    }
    const addPossibleBreakpoints = (line, locations) => {
      for (const location of locations) {
        const editorLocation = this.transformer.uiLocationToEditorLocation(location.lineNumber, location.columnNumber);
        if (editorLocation.lineNumber !== line.number - 1) {
          continue;
        }
        const position = Math.min(line.to, line.from + editorLocation.columnNumber);
        if (!inlineMarkerPositions.has(position)) {
          addInlineMarker(line.from, editorLocation.columnNumber, null);
        }
      }
    };
    await Promise.all(possibleBreakpointRequests);
    for (const [linePos, inlineMarkers] of inlineMarkersByLine) {
      if (inlineMarkers.length > 1) {
        for (const { column, breakpoint } of inlineMarkers) {
          const marker = new BreakpointInlineMarker(breakpoint, this);
          decorations.push(CodeMirror.Decoration.widget({ widget: marker, side: -1 }).range(linePos + column));
        }
      }
    }
    return { content: CodeMirror.Decoration.set(decorations, true), gutter: CodeMirror.RangeSet.of(gutterMarkers, true) };
  }
  async restoreBreakpointsAfterEditing() {
    const { breakpoints } = this;
    const editor = this.editor;
    this.breakpoints = [];
    await Promise.all(breakpoints.map(async (description) => {
      const { breakpoint, position } = description;
      const condition = breakpoint.condition(), enabled = breakpoint.enabled();
      await breakpoint.remove(false);
      const editorLocation = editor.toLineColumn(position);
      const uiLocation = this.transformer.editorLocationToUILocation(editorLocation.lineNumber, editorLocation.columnNumber);
      await this.setBreakpoint(uiLocation.lineNumber, uiLocation.columnNumber, condition, enabled);
    }));
  }
  async refreshBreakpoints() {
    if (this.editor) {
      this.breakpoints = this.fetchBreakpoints();
      const forBreakpoints = this.breakpoints;
      const decorations = await this.computeBreakpointDecoration(this.editor.state, forBreakpoints);
      if (this.breakpoints === forBreakpoints && (decorations.gutter.size || this.editor.state.field(breakpointMarkers, false)?.gutter.size)) {
        this.editor.dispatch({ effects: setBreakpointDeco.of(decorations) });
      }
    }
  }
  breakpointChange(event) {
    const { uiLocation } = event.data;
    if (uiLocation.uiSourceCode !== this.uiSourceCode || this.muted) {
      return;
    }
    for (const scriptFile of this.scriptFileForDebuggerModel.values()) {
      if (scriptFile.isDivergingFromVM() || scriptFile.isMergingToVM()) {
        return;
      }
    }
    window.clearTimeout(this.refreshBreakpointsTimeout);
    this.refreshBreakpointsTimeout = window.setTimeout(() => this.refreshBreakpoints(), 50);
  }
  onInlineBreakpointMarkerClick(event, breakpoint) {
    event.consume(true);
    if (breakpoint) {
      if (event.shiftKey) {
        breakpoint.setEnabled(!breakpoint.enabled());
      } else {
        void breakpoint.remove(false);
      }
    } else if (this.editor) {
      const editorLocation = this.editor.editor.posAtDOM(event.target);
      const line = this.editor.state.doc.lineAt(editorLocation);
      const uiLocation = this.transformer.editorLocationToUILocation(line.number - 1, editorLocation - line.from);
      void this.setBreakpoint(uiLocation.lineNumber, uiLocation.columnNumber, "", true);
    }
  }
  onInlineBreakpointMarkerContextMenu(event, breakpoint) {
    event.consume(true);
    const editor = this.editor;
    const position = editor.editor.posAtDOM(event.target);
    const line = editor.state.doc.lineAt(position);
    if (!SourceFrame.SourceFrame.isBreakableLine(editor.state, line) || !Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().supportsConditionalBreakpoints(this.uiSourceCode)) {
      return;
    }
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    if (breakpoint) {
      contextMenu.debugSection().appendItem(i18nString(UIStrings.editBreakpoint), this.editBreakpointCondition.bind(this, line, breakpoint, null, false));
    } else {
      const uiLocation = this.transformer.editorLocationToUILocation(line.number - 1, position - line.from);
      contextMenu.debugSection().appendItem(i18nString(UIStrings.addConditionalBreakpoint), this.editBreakpointCondition.bind(this, line, null, uiLocation, false));
      contextMenu.debugSection().appendItem(i18nString(UIStrings.addLogpoint), this.editBreakpointCondition.bind(this, line, null, uiLocation, true));
      contextMenu.debugSection().appendItem(i18nString(UIStrings.neverPauseHere), this.setBreakpoint.bind(this, uiLocation.lineNumber, uiLocation.columnNumber, "false", true));
    }
    void contextMenu.show();
  }
  updateScriptFiles() {
    for (const debuggerModel of SDK.TargetManager.TargetManager.instance().models(SDK.DebuggerModel.DebuggerModel)) {
      const scriptFile = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().scriptFile(this.uiSourceCode, debuggerModel);
      if (scriptFile) {
        this.updateScriptFile(debuggerModel);
      }
    }
  }
  updateScriptFile(debuggerModel) {
    const oldScriptFile = this.scriptFileForDebuggerModel.get(debuggerModel);
    const newScriptFile = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().scriptFile(this.uiSourceCode, debuggerModel);
    this.scriptFileForDebuggerModel.delete(debuggerModel);
    if (oldScriptFile) {
      oldScriptFile.removeEventListener(Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidMergeToVM, this.didMergeToVM, this);
      oldScriptFile.removeEventListener(Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidDivergeFromVM, this.didDivergeFromVM, this);
      if (this.muted && !this.uiSourceCode.isDirty() && this.consistentScripts()) {
        this.setMuted(false);
      }
    }
    if (!newScriptFile) {
      return;
    }
    this.scriptFileForDebuggerModel.set(debuggerModel, newScriptFile);
    newScriptFile.addEventListener(Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidMergeToVM, this.didMergeToVM, this);
    newScriptFile.addEventListener(Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidDivergeFromVM, this.didDivergeFromVM, this);
    newScriptFile.checkMapping();
    if (newScriptFile.hasSourceMapURL()) {
      this.showSourceMapInfobar();
    }
    void newScriptFile.missingSymbolFiles().then((resources) => {
      if (resources) {
        const details = i18nString(UIStrings.debugInfoNotFound, { PH1: newScriptFile.uiSourceCode.url() });
        this.updateMissingDebugInfoInfobar({ resources, details });
      } else {
        this.updateMissingDebugInfoInfobar(null);
      }
    });
  }
  updateMissingDebugInfoInfobar(warning) {
    if (this.missingDebugInfoBar) {
      return;
    }
    if (warning === null) {
      this.removeInfobar(this.missingDebugInfoBar);
      this.missingDebugInfoBar = null;
      return;
    }
    this.missingDebugInfoBar = UI.Infobar.Infobar.create(UI.Infobar.Type.Error, warning.details, []);
    if (!this.missingDebugInfoBar) {
      return;
    }
    for (const resource of warning.resources) {
      const detailsRow = this.missingDebugInfoBar?.createDetailsRowMessage(i18nString(UIStrings.debugFileNotFound, { PH1: resource }));
      if (detailsRow) {
        detailsRow.classList.add("infobar-selectable");
      }
    }
    this.missingDebugInfoBar.setCloseCallback(() => {
      this.removeInfobar(this.missingDebugInfoBar);
      this.missingDebugInfoBar = null;
    });
    this.attachInfobar(this.missingDebugInfoBar);
  }
  showSourceMapInfobar() {
    if (this.sourceMapInfobar) {
      return;
    }
    this.sourceMapInfobar = UI.Infobar.Infobar.create(UI.Infobar.Type.Info, i18nString(UIStrings.sourceMapDetected), [], Common.Settings.Settings.instance().createSetting("sourceMapInfobarDisabled", false));
    if (!this.sourceMapInfobar) {
      return;
    }
    this.sourceMapInfobar.createDetailsRowMessage(i18nString(UIStrings.associatedFilesShouldBeAdded));
    this.sourceMapInfobar.createDetailsRowMessage(i18nString(UIStrings.associatedFilesAreAvailable, {
      PH1: String(UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutTitleForAction("quickOpen.show"))
    }));
    this.sourceMapInfobar.setCloseCallback(() => {
      this.removeInfobar(this.sourceMapInfobar);
      this.sourceMapInfobar = null;
    });
    this.attachInfobar(this.sourceMapInfobar);
  }
  async detectMinified() {
    const content = this.uiSourceCode.content();
    if (!content || !TextUtils.TextUtils.isMinified(content)) {
      return;
    }
    const editorActions = getRegisteredEditorActions();
    let formatterCallback = null;
    for (const editorAction of editorActions) {
      if (editorAction instanceof ScriptFormatterEditorAction) {
        if (!editorAction.isCurrentUISourceCodeFormattable()) {
          return;
        }
        formatterCallback = editorAction.toggleFormatScriptSource.bind(editorAction);
        break;
      }
    }
    this.prettyPrintInfobar = UI.Infobar.Infobar.create(UI.Infobar.Type.Info, i18nString(UIStrings.prettyprintThisMinifiedFile), [{ text: i18nString(UIStrings.prettyprint), delegate: formatterCallback, highlight: true, dismiss: true }], Common.Settings.Settings.instance().createSetting("prettyPrintInfobarDisabled", false));
    if (!this.prettyPrintInfobar) {
      return;
    }
    this.prettyPrintInfobar.setCloseCallback(() => {
      this.removeInfobar(this.prettyPrintInfobar);
      this.prettyPrintInfobar = null;
    });
    const toolbar = new UI.Toolbar.Toolbar("");
    const button = new UI.Toolbar.ToolbarButton("", "largeicon-pretty-print");
    toolbar.appendToolbarItem(button);
    toolbar.element.style.display = "inline";
    toolbar.element.style.verticalAlign = "middle";
    toolbar.element.style.marginBottom = "3px";
    toolbar.element.style.pointerEvents = "none";
    toolbar.element.tabIndex = -1;
    const element = this.prettyPrintInfobar.createDetailsRowMessage();
    element.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.prettyprintingWillFormatThisFile, { PH1: toolbar.element }));
    UI.ARIAUtils.markAsAlert(element);
    this.attachInfobar(this.prettyPrintInfobar);
  }
  handleGutterClick(line, event) {
    if (this.muted || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    void this.toggleBreakpoint(line, event.shiftKey);
    return true;
  }
  async toggleBreakpoint(line, onlyDisable) {
    if (this.muted) {
      return;
    }
    if (this.activeBreakpointDialog) {
      this.activeBreakpointDialog.finishEditing(false, "");
    }
    const breakpoints = this.lineBreakpoints(line);
    if (!breakpoints.length) {
      await this.createNewBreakpoint(line, "", true);
      return;
    }
    const hasDisabled = breakpoints.some((b) => !b.enabled());
    for (const breakpoint of breakpoints) {
      if (onlyDisable) {
        breakpoint.setEnabled(hasDisabled);
      } else {
        void breakpoint.remove(false);
      }
    }
  }
  async createNewBreakpoint(line, condition, enabled) {
    if (!this.editor || !SourceFrame.SourceFrame.isBreakableLine(this.editor.state, line)) {
      return;
    }
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.ScriptsBreakpointSet);
    const origin = this.transformer.editorLocationToUILocation(line.number - 1);
    await this.setBreakpoint(origin.lineNumber, origin.columnNumber, condition, enabled);
  }
  async setBreakpoint(lineNumber, columnNumber, condition, enabled) {
    Common.Settings.Settings.instance().moduleSetting("breakpointsActive").set(true);
    await this.breakpointManager.setBreakpoint(this.uiSourceCode, lineNumber, columnNumber, condition, enabled);
    this.breakpointWasSetForTest(lineNumber, columnNumber, condition, enabled);
  }
  breakpointWasSetForTest(_lineNumber, _columnNumber, _condition, _enabled) {
  }
  async callFrameChanged() {
    this.liveLocationPool.disposeAll();
    const callFrame = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!callFrame) {
      this.setExecutionLocation(null);
    } else {
      await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createCallFrameLiveLocation(callFrame.location(), async (liveLocation) => {
        const uiLocation = await liveLocation.uiLocation();
        if (uiLocation && uiLocation.uiSourceCode.url() === this.uiSourceCode.url()) {
          this.setExecutionLocation(uiLocation);
          this.updateMissingDebugInfoInfobar(callFrame.missingDebugInfoDetails);
        } else {
          this.setExecutionLocation(null);
        }
      }, this.liveLocationPool);
    }
  }
  setExecutionLocation(executionLocation) {
    if (this.executionLocation === executionLocation || !this.editor) {
      return;
    }
    this.executionLocation = executionLocation;
    if (executionLocation) {
      const editorLocation = this.transformer.uiLocationToEditorLocation(executionLocation.lineNumber, executionLocation.columnNumber);
      const decorations = this.computeExecutionDecorations(this.editor.state, editorLocation.lineNumber, editorLocation.columnNumber);
      this.editor.dispatch({ effects: executionLine.update.of(decorations) });
      void this.updateValueDecorations();
      if (this.controlDown) {
        void this.showContinueToLocations();
      }
    } else {
      this.editor.dispatch({
        effects: [
          executionLine.update.of(CodeMirror.Decoration.none),
          continueToMarkers.update.of(CodeMirror.Decoration.none),
          valueDecorations.update.of(CodeMirror.Decoration.none)
        ]
      });
    }
  }
  dispose() {
    this.hideIgnoreListInfobar();
    if (this.sourceMapInfobar) {
      this.sourceMapInfobar.dispose();
    }
    if (this.prettyPrintInfobar) {
      this.prettyPrintInfobar.dispose();
    }
    for (const script of this.scriptFileForDebuggerModel.values()) {
      script.removeEventListener(Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidMergeToVM, this.didMergeToVM, this);
      script.removeEventListener(Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidDivergeFromVM, this.didDivergeFromVM, this);
    }
    this.scriptFileForDebuggerModel.clear();
    this.popoverHelper.hidePopover();
    this.popoverHelper.dispose();
    this.breakpointManager.removeEventListener(Bindings.BreakpointManager.Events.BreakpointAdded, this.breakpointChange, this);
    this.breakpointManager.removeEventListener(Bindings.BreakpointManager.Events.BreakpointRemoved, this.breakpointChange, this);
    this.uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.workingCopyChanged, this);
    this.uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this);
    Common.Settings.Settings.instance().moduleSetting("skipStackFramesPattern").removeChangeListener(this.showIgnoreListInfobarIfNeeded, this);
    Common.Settings.Settings.instance().moduleSetting("skipContentScripts").removeChangeListener(this.showIgnoreListInfobarIfNeeded, this);
    super.dispose();
    UI.Context.Context.instance().removeFlavorChangeListener(SDK.DebuggerModel.CallFrame, this.callFrameChanged, this);
    this.liveLocationPool.disposeAll();
  }
}
const addInfobar = CodeMirror.StateEffect.define();
const removeInfobar = CodeMirror.StateEffect.define();
const infobarState = CodeMirror.StateField.define({
  create() {
    return [];
  },
  update(current, tr) {
    for (const effect of tr.effects) {
      if (effect.is(addInfobar)) {
        current = current.concat(effect.value);
      } else if (effect.is(removeInfobar)) {
        current = current.filter((b) => b !== effect.value);
      }
    }
    return current;
  },
  provide: (field) => CodeMirror.showPanel.computeN([field], (state) => state.field(field).map((bar) => () => ({ dom: bar.element })))
});
async function computeNonBreakableLines(state, sourceCode) {
  const linePositions = [];
  if (Bindings.CompilerScriptMapping.CompilerScriptMapping.uiSourceCodeOrigin(sourceCode).length) {
    for (let i = 0; i < state.doc.lines; i++) {
      const lineHasMapping = Bindings.CompilerScriptMapping.CompilerScriptMapping.uiLineHasMapping(sourceCode, i);
      if (!lineHasMapping) {
        linePositions.push(state.doc.line(i + 1).from);
      }
    }
  } else {
    const { pluginManager } = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
    if (!pluginManager) {
      return [];
    }
    const mappedLines = await pluginManager.getMappedLines(sourceCode);
    if (!mappedLines) {
      return [];
    }
    for (let i = 0; i < state.doc.lines; i++) {
      if (!mappedLines.has(i)) {
        linePositions.push(state.doc.line(i + 1).from);
      }
    }
  }
  return linePositions;
}
const setBreakpointDeco = CodeMirror.StateEffect.define();
const muteBreakpoints = CodeMirror.StateEffect.define();
function muteGutterMarkers(markers, doc) {
  const newMarkers = [];
  markers.between(0, doc.length, (from, _to, marker) => {
    let className = marker.elementClass;
    if (!/cm-breakpoint-disabled/.test(className)) {
      className += " cm-breakpoint-disabled";
    }
    newMarkers.push(new BreakpointGutterMarker(className).range(from));
  });
  return CodeMirror.RangeSet.of(newMarkers, false);
}
const breakpointMarkers = CodeMirror.StateField.define({
  create() {
    return { content: CodeMirror.RangeSet.empty, gutter: CodeMirror.RangeSet.empty };
  },
  update(deco, tr) {
    if (!tr.changes.empty) {
      deco = { content: deco.content.map(tr.changes), gutter: deco.gutter.map(tr.changes) };
    }
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointDeco)) {
        deco = effect.value;
      } else if (effect.is(muteBreakpoints)) {
        deco = { content: CodeMirror.RangeSet.empty, gutter: muteGutterMarkers(deco.gutter, tr.state.doc) };
      }
    }
    return deco;
  },
  provide: (field) => [
    CodeMirror.EditorView.decorations.from(field, (deco) => deco.content),
    CodeMirror.lineNumberMarkers.from(field, (deco) => deco.gutter)
  ]
});
class BreakpointInlineMarker extends CodeMirror.WidgetType {
  constructor(breakpoint, parent) {
    super();
    this.breakpoint = breakpoint;
    this.parent = parent;
    this.class = "cm-inlineBreakpoint";
    const condition = breakpoint ? breakpoint.condition() : "";
    if (condition.includes(LogpointPrefix)) {
      this.class += " cm-inlineBreakpoint-logpoint";
    } else if (condition) {
      this.class += " cm-inlineBreakpoint-conditional";
    }
    if (!breakpoint?.enabled()) {
      this.class += " cm-inlineBreakpoint-disabled";
    }
  }
  class;
  eq(other) {
    return other.class === this.class && other.breakpoint === this.breakpoint;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.class;
    span.addEventListener("click", (event) => {
      this.parent.onInlineBreakpointMarkerClick(event, this.breakpoint);
      event.consume();
    });
    span.addEventListener("contextmenu", (event) => {
      this.parent.onInlineBreakpointMarkerContextMenu(event, this.breakpoint);
      event.consume();
    });
    return span;
  }
  ignoreEvent() {
    return true;
  }
}
class BreakpointGutterMarker extends CodeMirror.GutterMarker {
  constructor(elementClass) {
    super();
    this.elementClass = elementClass;
  }
  eq(other) {
    return other.elementClass === this.elementClass;
  }
}
function mostSpecificBreakpoint(a, b) {
  if (a.enabled() !== b.enabled()) {
    return a.enabled() ? -1 : 1;
  }
  if (a.bound() !== b.bound()) {
    return a.bound() ? -1 : 1;
  }
  if (Boolean(a.condition()) !== Boolean(b.condition())) {
    return Boolean(a.condition()) ? -1 : 1;
  }
  return 0;
}
function defineStatefulDecoration() {
  const update = CodeMirror.StateEffect.define();
  const field = CodeMirror.StateField.define({
    create() {
      return CodeMirror.Decoration.none;
    },
    update(deco, tr) {
      return tr.effects.reduce((deco2, effect) => effect.is(update) ? effect.value : deco2, deco.map(tr.changes));
    },
    provide: (field2) => CodeMirror.EditorView.decorations.from(field2)
  });
  return { update, field };
}
const executionLineDeco = CodeMirror.Decoration.line({ attributes: { class: "cm-executionLine" } });
const executionTokenDeco = CodeMirror.Decoration.mark({ attributes: { class: "cm-executionToken" } });
const executionLine = defineStatefulDecoration();
const continueToMark = CodeMirror.Decoration.mark({ class: "cm-continueToLocation" });
const asyncContinueToMark = CodeMirror.Decoration.mark({ class: "cm-continueToLocation cm-continueToLocation-async" });
const continueToMarkers = defineStatefulDecoration();
const noMarkers = {}, hasContinueMarkers = {
  class: "cm-hasContinueMarkers"
};
const markIfContinueTo = CodeMirror.EditorView.contentAttributes.compute([continueToMarkers.field], (state) => {
  return state.field(continueToMarkers.field).size ? hasContinueMarkers : noMarkers;
});
class ValueDecoration extends CodeMirror.WidgetType {
  constructor(pairs) {
    super();
    this.pairs = pairs;
  }
  eq(other) {
    return this.pairs.length === other.pairs.length && this.pairs.every((p, i) => p[0] === other.pairs[i][0] && p[1] === other.pairs[i][1]);
  }
  toDOM() {
    const formatter = new ObjectUI.RemoteObjectPreviewFormatter.RemoteObjectPreviewFormatter();
    const widget = document.createElement("div");
    widget.classList.add("cm-variableValues");
    let first = true;
    for (const [name, value] of this.pairs) {
      if (first) {
        first = false;
      } else {
        UI.UIUtils.createTextChild(widget, ", ");
      }
      const nameValuePair = widget.createChild("span");
      UI.UIUtils.createTextChild(nameValuePair, name + " = ");
      const propertyCount = value.preview ? value.preview.properties.length : 0;
      const entryCount = value.preview && value.preview.entries ? value.preview.entries.length : 0;
      if (value.preview && propertyCount + entryCount < 10) {
        formatter.appendObjectPreview(nameValuePair, value.preview, false);
      } else {
        const propertyValue = ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.createPropertyValue(value, false, false);
        nameValuePair.appendChild(propertyValue.element);
      }
    }
    return widget;
  }
}
const valueDecorations = defineStatefulDecoration();
const evalExpressionMark = CodeMirror.Decoration.mark({ class: "cm-evaluatedExpression" });
const evalExpression = defineStatefulDecoration();
const theme = CodeMirror.EditorView.baseTheme({
  ".cm-lineNumbers .cm-gutterElement": {
    "&:hover, &.cm-breakpoint": {
      borderStyle: "solid",
      borderWidth: "1px 4px 1px 1px",
      marginRight: "-4px",
      paddingLeft: "8px",
      lineHeight: "calc(1.2em - 2px)",
      position: "relative"
    },
    "&:hover": {
      WebkitBorderImage: lineNumberArrow("#ebeced", "#ebeced")
    },
    "&.cm-breakpoint": {
      color: "#fff",
      WebkitBorderImage: lineNumberArrow("#4285f4", "#1a73e8")
    },
    "&.cm-breakpoint-conditional": {
      WebkitBorderImage: lineNumberArrow("#f29900", "#e37400"),
      "&::before": {
        content: '"?"',
        position: "absolute",
        top: 0,
        left: "1px"
      }
    },
    "&.cm-breakpoint-logpoint": {
      WebkitBorderImage: lineNumberArrow("#f439a0", "#d01884"),
      "&::before": {
        content: '"\u2025"',
        position: "absolute",
        top: "-3px",
        left: "1px"
      }
    }
  },
  "&dark .cm-lineNumbers .cm-gutterElement": {
    "&:hover": {
      WebkitBorderImage: lineNumberArrow("#3c4043", "#3c4043")
    },
    "&.cm-breakpoint": {
      WebkitBorderImage: lineNumberArrow("#5186EC", "#1a73e8")
    },
    "&.cm-breakpoint-conditional": {
      WebkitBorderImage: lineNumberArrow("#e9a33a", "#e37400")
    },
    "&.cm-breakpoint-logpoint": {
      WebkitBorderImage: lineNumberArrow("#E54D9B", "#d01884")
    }
  },
  ":host-context(.breakpoints-deactivated) & .cm-lineNumbers .cm-gutterElement.cm-breakpoint, .cm-lineNumbers .cm-gutterElement.cm-breakpoint-disabled": {
    color: "#1a73e8",
    WebkitBorderImage: lineNumberArrow("#d9e7fd", "#1a73e8"),
    "&.cm-breakpoint-conditional": {
      color: "#e37400",
      WebkitBorderImage: lineNumberArrow("#fcebcc", "#e37400")
    },
    "&.cm-breakpoint-logpoint": {
      color: "#d01884",
      WebkitBorderImage: lineNumberArrow("#fdd7ec", "#f439a0")
    }
  },
  ":host-context(.breakpoints-deactivated) &dark .cm-lineNumbers .cm-gutterElement.cm-breakpoint, &dark .cm-lineNumbers .cm-gutterElement.cm-breakpoint-disabled": {
    WebkitBorderImage: lineNumberArrow("#2a384e", "#1a73e8"),
    "&.cm-breakpoint-conditional": {
      WebkitBorderImage: lineNumberArrow("#4d3c1d", "#e37400")
    },
    "&.cm-breakpoint-logpoint": {
      WebkitBorderImage: lineNumberArrow("#4e283d", "#f439a0")
    }
  },
  ".cm-inlineBreakpoint": {
    cursor: "pointer",
    position: "relative",
    top: "1px",
    content: inlineBreakpointArrow("#4285F4", "#1A73E8"),
    height: "10px",
    "&.cm-inlineBreakpoint-conditional": {
      content: inlineConditionalBreakpointArrow("#F29900", "#E37400")
    },
    "&.cm-inlineBreakpoint-logpoint": {
      content: inlineLogpointArrow("#F439A0", "#D01884")
    }
  },
  "&dark .cm-inlineBreakpoint": {
    content: inlineBreakpointArrow("#5186EC", "#1A73E8"),
    "&.cm-inlineBreakpoint-conditional": {
      content: inlineConditionalBreakpointArrow("#e9a33a", "#E37400")
    },
    "&.cm-inlineBreakpoint-logpoint": {
      content: inlineLogpointArrow("#E54D9B", "#D01884")
    }
  },
  ":host-context(.breakpoints-deactivated) & .cm-inlineBreakpoint, .cm-inlineBreakpoint-disabled": {
    content: inlineBreakpointArrow("#4285F4", "#1A73E8", "0.2"),
    "&.cm-inlineBreakpoint-conditional": {
      content: inlineConditionalBreakpointArrow("#F9AB00", "#E37400", "0.2")
    },
    "&.cm-inlineBreakpoint-logpoint": {
      content: inlineLogpointArrow("#F439A0", "#D01884", "0.2")
    }
  },
  ".cm-executionLine": {
    backgroundColor: "var(--color-execution-line-background)",
    outline: "1px solid var(--color-execution-line-outline)",
    ".cm-hasContinueMarkers &": {
      backgroundColor: "transparent"
    },
    "&.cm-highlightedLine": {
      animation: "cm-fading-highlight-execution 2s 0s"
    }
  },
  ".cm-executionToken": {
    backgroundColor: "var(--color-execution-token-background)"
  },
  "@keyframes cm-fading-highlight-execution": {
    from: {
      backgroundColor: "var(--color-highlighted-line)"
    },
    to: {
      backgroundColor: "var(--color-execution-line-background)"
    }
  },
  ".cm-continueToLocation": {
    cursor: "pointer",
    backgroundColor: "var(--color-continue-to-location)",
    "&:hover": {
      backgroundColor: "var(--color-continue-to-location-hover)",
      border: "1px solid var(--color-continue-to-location-hover-border)",
      margin: "0 -1px"
    },
    "&.cm-continueToLocation-async": {
      backgroundColor: "var(--color-continue-to-location-async)",
      "&:hover": {
        backgroundColor: "var(--color-continue-to-location-async-hover)",
        border: "1px solid var(--color-continue-to-location-async-hover-border)",
        margin: "0 -1px"
      }
    }
  },
  ".cm-evaluatedExpression": {
    backgroundColor: "var(--color-evaluated-expression)",
    border: "1px solid var(--color-evaluated-expression-border)",
    margin: "0 -1px"
  },
  ".cm-variableValues": {
    display: "inline",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "1000px",
    opacity: "80%",
    backgroundColor: "var(--color-variable-values)",
    marginLeft: "10px",
    padding: "0 5px",
    userSelect: "text",
    ".cm-executionLine &": {
      backgroundColor: "transparent",
      opacity: "50%"
    }
  }
});
function lineNumberArrow(color, outline) {
  return `url('data:image/svg+xml,<svg height="11" width="26" xmlns="http://www.w3.org/2000/svg"><path d="M22.8.5l2.7 5-2.7 5H.5V.5z" fill="${encodeURIComponent(color)}" stroke="${encodeURIComponent(outline)}"/></svg>') 1 3 1 1`;
}
function inlineBreakpointArrow(color, outline, opacity = "1") {
  return `url('data:image/svg+xml,<svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 0.5H5.80139C6.29382 0.5 6.7549 0.741701 7.03503 1.14669L10.392 6L7.03503 10.8533C6.7549 11.2583 6.29382 11.5 5.80139 11.5H0.5V0.5Z" fill="${encodeURIComponent(color)}" stroke="${encodeURIComponent(outline)}" fill-opacity="${encodeURIComponent(opacity)}"/></svg>')`;
}
function inlineConditionalBreakpointArrow(color, outline, opacity = "1") {
  return `url('data:image/svg+xml,<svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 0.5H5.80139C6.29382 0.5 6.75489 0.741701 7.03503 1.14669L10.392 6L7.03503 10.8533C6.75489 11.2583 6.29382 11.5 5.80138 11.5H0.5V0.5Z" fill="${encodeURIComponent(color)}" fill-opacity="${encodeURIComponent(opacity)}" stroke="${encodeURIComponent(outline)}"/><path d="M3.51074 7.75635H4.68408V9H3.51074V7.75635ZM4.68408 7.23779H3.51074V6.56104C3.51074 6.271 3.55615 6.02344 3.64697 5.81836C3.73779 5.61328 3.90039 5.39648 4.13477 5.16797L4.53027 4.77686C4.71484 4.59814 4.83936 4.4502 4.90381 4.33301C4.97119 4.21582 5.00488 4.09424 5.00488 3.96826C5.00488 3.77197 4.9375 3.62402 4.80273 3.52441C4.66797 3.4248 4.46582 3.375 4.19629 3.375C3.9502 3.375 3.69238 3.42773 3.42285 3.5332C3.15625 3.63574 2.88232 3.78955 2.60107 3.99463V2.81689C2.88818 2.65283 3.17822 2.52979 3.47119 2.44775C3.76709 2.36279 4.06299 2.32031 4.35889 2.32031C4.95068 2.32031 5.41504 2.45801 5.75195 2.7334C6.08887 3.00879 6.25732 3.38818 6.25732 3.87158C6.25732 4.09424 6.20752 4.30225 6.10791 4.49561C6.0083 4.68604 5.8208 4.91602 5.54541 5.18555L5.15869 5.56348C4.95947 5.75684 4.83203 5.91504 4.77637 6.03809C4.7207 6.16113 4.69287 6.31201 4.69287 6.49072C4.69287 6.51709 4.69141 6.54785 4.68848 6.58301C4.68848 6.61816 4.68701 6.65625 4.68408 6.69727V7.23779Z" fill="white"/></svg>')`;
}
function inlineLogpointArrow(color, outline, opacity = "1") {
  return `url('data:image/svg+xml,<svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 0.5H5.80139C6.29382 0.5 6.7549 0.741701 7.03503 1.14669L10.392 6L7.03503 10.8533C6.7549 11.2583 6.29382 11.5 5.80139 11.5H0.5V0.5Z" fill="${encodeURIComponent(color)}" stroke="${encodeURIComponent(outline)}" fill-opacity="${encodeURIComponent(opacity)}"/><circle cx="3" cy="6" r="1" fill="white"/><circle cx="7" cy="6" r="1" fill="white"/></svg>')`;
}
//# sourceMappingURL=DebuggerPlugin.js.map
