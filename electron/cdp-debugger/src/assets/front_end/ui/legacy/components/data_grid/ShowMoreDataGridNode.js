import * as i18n from "../../../../core/i18n/i18n.js";
import { DataGridNode } from "./DataGrid.js";
const UIStrings = {
  showDBefore: "Show {PH1} before",
  showDAfter: "Show {PH1} after",
  showAllD: "Show all {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/data_grid/ShowMoreDataGridNode.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ShowMoreDataGridNode extends DataGridNode {
  callback;
  startPosition;
  endPosition;
  chunkSize;
  showNext;
  showAll;
  showLast;
  selectable;
  hasCells;
  constructor(callback, startPosition, endPosition, chunkSize) {
    super({ summaryRow: true }, false);
    this.callback = callback;
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.chunkSize = chunkSize;
    this.showNext = document.createElement("button");
    this.showNext.classList.add("text-button");
    this.showNext.type = "button";
    this.showNext.addEventListener("click", this.showNextChunk.bind(this), false);
    this.showNext.textContent = i18nString(UIStrings.showDBefore, { PH1: this.chunkSize });
    this.showAll = document.createElement("button");
    this.showAll.classList.add("text-button");
    this.showAll.type = "button";
    this.showAll.addEventListener("click", this.showAllInternal.bind(this), false);
    this.showLast = document.createElement("button");
    this.showLast.classList.add("text-button");
    this.showLast.type = "button";
    this.showLast.addEventListener("click", this.showLastChunk.bind(this), false);
    this.showLast.textContent = i18nString(UIStrings.showDAfter, { PH1: this.chunkSize });
    this.updateLabels();
    this.selectable = false;
  }
  showNextChunk() {
    void this.callback(this.startPosition, this.startPosition + this.chunkSize);
  }
  showAllInternal() {
    void this.callback(this.startPosition, this.endPosition);
  }
  showLastChunk() {
    void this.callback(this.endPosition - this.chunkSize, this.endPosition);
  }
  updateLabels() {
    const totalSize = this.endPosition - this.startPosition;
    if (totalSize > this.chunkSize) {
      this.showNext.classList.remove("hidden");
      this.showLast.classList.remove("hidden");
    } else {
      this.showNext.classList.add("hidden");
      this.showLast.classList.add("hidden");
    }
    this.showAll.textContent = i18nString(UIStrings.showAllD, { PH1: totalSize });
  }
  createCells(element) {
    this.hasCells = false;
    super.createCells(element);
  }
  createCell(columnIdentifier) {
    const cell = this.createTD(columnIdentifier);
    cell.classList.add("show-more");
    if (!this.hasCells) {
      this.hasCells = true;
      if (this.depth && this.dataGrid) {
        cell.style.setProperty("padding-left", this.depth * this.dataGrid.indentWidth + "px");
      }
      cell.appendChild(this.showNext);
      cell.appendChild(this.showAll);
      cell.appendChild(this.showLast);
    }
    return cell;
  }
  setStartPosition(from) {
    this.startPosition = from;
    this.updateLabels();
  }
  setEndPosition(to) {
    this.endPosition = to;
    this.updateLabels();
  }
  nodeSelfHeight() {
    return 40;
  }
  dispose() {
  }
}
//# sourceMappingURL=ShowMoreDataGridNode.js.map
