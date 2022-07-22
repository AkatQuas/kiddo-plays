import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as QuickOpen from "../../ui/legacy/components/quick_open/quick_open.js";
import * as UI from "../../ui/legacy/legacy.js";
import { SourcesView } from "./SourcesView.js";
const UIStrings = {
  noFileSelected: "No file selected.",
  noResultsFound: "No results found",
  typeANumberToGoToThatLine: "Type a number to go to that line.",
  currentPositionXsTypeAnOffset: "Current position: 0x{PH1}. Type an offset between 0x{PH2} and 0x{PH3} to navigate to.",
  currentLineSTypeALineNumber: "Current line: {PH1}. Type a line number between 1 and {PH2} to navigate to.",
  goToOffsetXs: "Go to offset 0x{PH1}.",
  goToLineSAndColumnS: "Go to line {PH1} and column {PH2}.",
  goToLineS: "Go to line {PH1}."
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/GoToLineQuickOpen.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let goToLineQuickOpenInstance;
export class GoToLineQuickOpen extends QuickOpen.FilteredListWidget.Provider {
  #goToLineStrings = [];
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!goToLineQuickOpenInstance || forceNew) {
      goToLineQuickOpenInstance = new GoToLineQuickOpen();
    }
    return goToLineQuickOpenInstance;
  }
  selectItem(_itemIndex, promptValue) {
    const uiSourceCode = this.currentUISourceCode();
    if (!uiSourceCode) {
      return;
    }
    const position = this.parsePosition(promptValue);
    if (!position) {
      return;
    }
    void Common.Revealer.reveal(uiSourceCode.uiLocation(position.line - 1, position.column - 1));
  }
  updateGoToLineStrings(query) {
    this.#goToLineStrings = [];
    if (!this.currentUISourceCode()) {
      return;
    }
    const position = this.parsePosition(query);
    const sourceFrame = this.currentSourceFrame();
    if (!position) {
      if (!sourceFrame) {
        this.#goToLineStrings.push(i18nString(UIStrings.typeANumberToGoToThatLine));
        return;
      }
      const editorState = sourceFrame.textEditor.state;
      const disassembly = sourceFrame.wasmDisassembly;
      const currentLineNumber = editorState.doc.lineAt(editorState.selection.main.head).number - 1;
      if (disassembly) {
        const lastBytecodeOffset = disassembly.lineNumberToBytecodeOffset(disassembly.lineNumbers - 1);
        const bytecodeOffsetDigits = lastBytecodeOffset.toString(16).length;
        const currentPosition = disassembly.lineNumberToBytecodeOffset(currentLineNumber);
        this.#goToLineStrings.push(i18nString(UIStrings.currentPositionXsTypeAnOffset, {
          PH1: currentPosition.toString(16).padStart(bytecodeOffsetDigits, "0"),
          PH2: "0".padStart(bytecodeOffsetDigits, "0"),
          PH3: lastBytecodeOffset.toString(16)
        }));
        return;
      }
      const linesCount = editorState.doc.lines;
      this.#goToLineStrings.push(i18nString(UIStrings.currentLineSTypeALineNumber, { PH1: currentLineNumber + 1, PH2: linesCount }));
      return;
    }
    if (sourceFrame && sourceFrame.wasmDisassembly) {
      this.#goToLineStrings.push(i18nString(UIStrings.goToOffsetXs, { PH1: (position.column - 1).toString(16) }));
      return;
    }
    if (position.column && position.column > 1) {
      this.#goToLineStrings.push(i18nString(UIStrings.goToLineSAndColumnS, { PH1: position.line, PH2: position.column }));
      return;
    }
    if (sourceFrame && position.line > sourceFrame.textEditor.state.doc.lines) {
      return;
    }
    this.#goToLineStrings.push(i18nString(UIStrings.goToLineS, { PH1: position.line }));
  }
  itemCount() {
    return this.#goToLineStrings.length;
  }
  renderItem(itemIndex, _query, titleElement, _subtitleElement) {
    UI.UIUtils.createTextChild(titleElement, this.#goToLineStrings[itemIndex]);
  }
  rewriteQuery(_query) {
    return "";
  }
  queryChanged(query) {
    this.updateGoToLineStrings(query);
  }
  notFoundText(_query) {
    if (!this.currentUISourceCode()) {
      return i18nString(UIStrings.noFileSelected);
    }
    return i18nString(UIStrings.noResultsFound);
  }
  parsePosition(query) {
    const sourceFrame = this.currentSourceFrame();
    if (sourceFrame && sourceFrame.wasmDisassembly) {
      const parts2 = query.match(/0x([0-9a-fA-F]+)/);
      if (!parts2 || !parts2[0] || parts2[0].length !== query.length) {
        return null;
      }
      const column2 = parseInt(parts2[0], 16) + 1;
      return { line: 0, column: column2 };
    }
    const parts = query.match(/([0-9]+)(\:[0-9]*)?/);
    if (!parts || !parts[0] || parts[0].length !== query.length) {
      return null;
    }
    const line = parseInt(parts[1], 10);
    let column = 0;
    if (parts[2]) {
      column = parseInt(parts[2].substring(1), 10);
    }
    return { line: Math.max(line | 0, 1), column: Math.max(column | 0, 1) };
  }
  currentUISourceCode() {
    const sourcesView = UI.Context.Context.instance().flavor(SourcesView);
    if (!sourcesView) {
      return null;
    }
    return sourcesView.currentUISourceCode();
  }
  currentSourceFrame() {
    const sourcesView = UI.Context.Context.instance().flavor(SourcesView);
    if (!sourcesView) {
      return null;
    }
    return sourcesView.currentSourceFrame();
  }
}
//# sourceMappingURL=GoToLineQuickOpen.js.map
