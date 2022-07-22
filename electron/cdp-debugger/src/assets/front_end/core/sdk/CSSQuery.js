import { CSSLocation } from "./CSSModel.js";
export class CSSQuery {
  text = "";
  range;
  styleSheetId;
  cssModel;
  constructor(cssModel) {
    this.cssModel = cssModel;
  }
  rebase(edit) {
    if (this.styleSheetId !== edit.styleSheetId || !this.range) {
      return;
    }
    if (edit.oldRange.equal(this.range)) {
      this.reinitialize(edit.payload);
    } else {
      this.range = this.range.rebaseAfterTextEdit(edit.oldRange, edit.newRange);
    }
  }
  equal(other) {
    if (!this.styleSheetId || !this.range || !other.range) {
      return false;
    }
    return this.styleSheetId === other.styleSheetId && this.range.equal(other.range);
  }
  lineNumberInSource() {
    if (!this.range) {
      return void 0;
    }
    return this.header()?.lineNumberInSource(this.range.startLine);
  }
  columnNumberInSource() {
    if (!this.range) {
      return void 0;
    }
    return this.header()?.columnNumberInSource(this.range.startLine, this.range.startColumn);
  }
  header() {
    return this.styleSheetId ? this.cssModel.styleSheetHeaderForId(this.styleSheetId) : null;
  }
  rawLocation() {
    const header = this.header();
    if (!header || this.lineNumberInSource() === void 0) {
      return null;
    }
    const lineNumber = Number(this.lineNumberInSource());
    return new CSSLocation(header, lineNumber, this.columnNumberInSource());
  }
}
//# sourceMappingURL=CSSQuery.js.map
