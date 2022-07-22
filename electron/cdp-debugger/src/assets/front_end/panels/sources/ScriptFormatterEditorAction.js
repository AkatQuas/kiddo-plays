import * as i18n from "../../core/i18n/i18n.js";
import * as FormatterModule from "../../models/formatter/formatter.js";
import * as Persistence from "../../models/persistence/persistence.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
import { Events, registerEditorAction } from "./SourcesView.js";
const UIStrings = {
  prettyPrintS: "Pretty print {PH1}",
  prettyPrint: "Pretty print"
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/ScriptFormatterEditorAction.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let scriptFormatterEditorActionInstance;
export class ScriptFormatterEditorAction {
  pathsToFormatOnLoad;
  sourcesView;
  button;
  constructor() {
    this.pathsToFormatOnLoad = /* @__PURE__ */ new Set();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!scriptFormatterEditorActionInstance || forceNew) {
      scriptFormatterEditorActionInstance = new ScriptFormatterEditorAction();
    }
    return scriptFormatterEditorActionInstance;
  }
  editorSelected(event) {
    const uiSourceCode = event.data;
    this.updateButton(uiSourceCode);
    if (this.isFormattableScript(uiSourceCode) && this.pathsToFormatOnLoad.has(uiSourceCode.url()) && !FormatterModule.SourceFormatter.SourceFormatter.instance().hasFormatted(uiSourceCode)) {
      void this.showFormatted(uiSourceCode);
    }
  }
  async editorClosed(event) {
    const { uiSourceCode, wasSelected } = event.data;
    if (wasSelected) {
      this.updateButton(null);
    }
    const original = await FormatterModule.SourceFormatter.SourceFormatter.instance().discardFormattedUISourceCode(uiSourceCode);
    if (original) {
      this.pathsToFormatOnLoad.delete(original.url());
    }
  }
  updateButton(uiSourceCode) {
    const isFormattable = this.isFormattableScript(uiSourceCode);
    this.button.element.classList.toggle("hidden", !isFormattable);
    if (uiSourceCode) {
      this.button.setTitle(i18nString(UIStrings.prettyPrintS, { PH1: uiSourceCode.name() }));
    }
  }
  getOrCreateButton(sourcesView) {
    if (this.button) {
      return this.button;
    }
    this.sourcesView = sourcesView;
    this.sourcesView.addEventListener(Events.EditorSelected, (event) => {
      this.editorSelected(event);
    });
    this.sourcesView.addEventListener(Events.EditorClosed, (event) => {
      void this.editorClosed(event);
    });
    this.button = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.prettyPrint), "largeicon-pretty-print");
    this.button.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.onFormatScriptButtonClicked, this);
    this.updateButton(sourcesView.currentUISourceCode());
    return this.button;
  }
  isFormattableScript(uiSourceCode) {
    if (!uiSourceCode) {
      return false;
    }
    if (uiSourceCode.project().canSetFileContent()) {
      return false;
    }
    if (uiSourceCode.project().type() === Workspace.Workspace.projectTypes.Formatter) {
      return false;
    }
    if (Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode)) {
      return false;
    }
    if (uiSourceCode.mimeType() === "application/wasm") {
      return false;
    }
    return uiSourceCode.contentType().hasScripts();
  }
  isCurrentUISourceCodeFormattable() {
    const uiSourceCode = this.sourcesView.currentUISourceCode();
    return this.isFormattableScript(uiSourceCode);
  }
  onFormatScriptButtonClicked() {
    this.toggleFormatScriptSource();
  }
  toggleFormatScriptSource() {
    const uiSourceCode = this.sourcesView.currentUISourceCode();
    if (!uiSourceCode || !this.isFormattableScript(uiSourceCode)) {
      return;
    }
    this.pathsToFormatOnLoad.add(uiSourceCode.url());
    void this.showFormatted(uiSourceCode);
  }
  async showFormatted(uiSourceCode) {
    const formatData = await FormatterModule.SourceFormatter.SourceFormatter.instance().format(uiSourceCode);
    if (uiSourceCode !== this.sourcesView.currentUISourceCode()) {
      return;
    }
    const sourceFrame = this.sourcesView.viewForFile(uiSourceCode);
    let start = [0, 0];
    if (sourceFrame instanceof SourceFrame.SourceFrame.SourceFrameImpl) {
      const selection = sourceFrame.textEditor.toLineColumn(sourceFrame.textEditor.state.selection.main.head);
      start = formatData.mapping.originalToFormatted(selection.lineNumber, selection.columnNumber);
    }
    this.sourcesView.showSourceLocation(formatData.formattedSourceCode, { lineNumber: start[0], columnNumber: start[1] });
  }
}
registerEditorAction(ScriptFormatterEditorAction.instance);
//# sourceMappingURL=ScriptFormatterEditorAction.js.map
