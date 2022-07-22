import * as Host from "../../../core/host/host.js";
import * as Platform from "../../../core/platform/platform.js";
import * as UI from "../../legacy/legacy.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import * as Coordinator from "../render_coordinator/render_coordinator.js";
import dataGridStyles from "./dataGrid.css.js";
import { BodyCellFocusedEvent, ColumnHeaderClickEvent, ContextMenuHeaderResetClickEvent } from "./DataGridEvents.js";
const coordinator = Coordinator.RenderCoordinator.RenderCoordinator.instance();
import { addColumnVisibilityCheckboxes, addSortableColumnItems } from "./DataGridContextMenuUtils.js";
import {
  calculateColumnWidthPercentageFromWeighting,
  calculateFirstFocusableCell,
  getCellTitleFromCellContent,
  getRowEntryForColumnId,
  handleArrowKeyNavigation,
  renderCellValue,
  SortDirection
} from "./DataGridUtils.js";
import * as i18n from "../../../core/i18n/i18n.js";
const UIStrings = {
  sortBy: "Sort By",
  resetColumns: "Reset Columns",
  headerOptions: "Header Options"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/data_grid/DataGrid.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
var UserScrollState = /* @__PURE__ */ ((UserScrollState2) => {
  UserScrollState2["NOT_SCROLLED"] = "NOT_SCROLLED";
  UserScrollState2["MANUAL_SCROLL_NOT_BOTTOM"] = "MANUAL_SCROLL_NOT_BOTTOM";
  UserScrollState2["SCROLLED_TO_BOTTOM"] = "SCROLLED_TO_BOTTOM";
  return UserScrollState2;
})(UserScrollState || {});
const KEYS_TREATED_AS_CLICKS = /* @__PURE__ */ new Set([" ", "Enter"]);
const ROW_HEIGHT_PIXELS = 18;
const PADDING_ROWS_COUNT = 10;
export class DataGrid extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-data-grid`;
  #shadow = this.attachShadow({ mode: "open" });
  #columns = [];
  #rows = [];
  #sortState = null;
  #isRendering = false;
  #userScrollState = "NOT_SCROLLED" /* NOT_SCROLLED */;
  #contextMenus = void 0;
  #label = void 0;
  #currentResize = null;
  #rowIndexMap = /* @__PURE__ */ new WeakMap();
  #resizeObserver = new ResizeObserver(() => {
    void this.#alignScrollHandlers();
  });
  #boundOnResizePointerMove = this.#onResizePointerMove.bind(this);
  #cellToFocusIfUserTabsIn = [0, 1];
  #cellUserHasFocused = null;
  #hasRenderedAtLeastOnce = false;
  #userHasFocusInDataGrid = false;
  #scheduleRender = false;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [dataGridStyles];
    ComponentHelpers.SetCSSProperty.set(this, "--table-row-height", `${ROW_HEIGHT_PIXELS}px`);
  }
  get data() {
    return {
      columns: this.#columns,
      rows: this.#rows,
      activeSort: this.#sortState,
      contextMenus: this.#contextMenus,
      label: this.#label
    };
  }
  set data(data) {
    this.#columns = data.columns;
    this.#rows = data.rows;
    this.#rows.forEach((row, index) => {
      this.#rowIndexMap.set(row, index);
    });
    this.#sortState = data.activeSort;
    this.#contextMenus = data.contextMenus;
    this.#label = data.label;
    if (!this.#hasRenderedAtLeastOnce) {
      this.#cellToFocusIfUserTabsIn = calculateFirstFocusableCell({ columns: this.#columns, rows: this.#rows });
    }
    if (this.#hasRenderedAtLeastOnce && this.#userHasCellFocused()) {
      const [selectedColIndex, selectedRowIndex] = this.#tabbableCell();
      const columnOutOfBounds = selectedColIndex > this.#columns.length;
      const rowOutOfBounds = selectedRowIndex > this.#rows.length;
      if (columnOutOfBounds || rowOutOfBounds) {
        this.#cellUserHasFocused = [
          columnOutOfBounds ? this.#columns.length : selectedColIndex,
          rowOutOfBounds ? this.#rows.length : selectedRowIndex
        ];
      }
    }
    void this.#render();
  }
  #shouldAutoScrollToBottom() {
    if (this.#userScrollState === "SCROLLED_TO_BOTTOM" /* SCROLLED_TO_BOTTOM */) {
      return true;
    }
    if (!this.#userHasFocusInDataGrid && this.#userScrollState !== "MANUAL_SCROLL_NOT_BOTTOM" /* MANUAL_SCROLL_NOT_BOTTOM */) {
      return true;
    }
    return false;
  }
  #scrollToBottomIfRequired() {
    if (this.#hasRenderedAtLeastOnce === false || !this.#shouldAutoScrollToBottom()) {
      return;
    }
    void coordinator.read(() => {
      const wrapper = this.#shadow.querySelector(".wrapping-container");
      if (!wrapper) {
        return;
      }
      const scrollHeight = wrapper.scrollHeight;
      void coordinator.scroll(() => {
        wrapper.scrollTo(0, scrollHeight);
      });
    });
  }
  #engageResizeObserver() {
    if (!this.#hasRenderedAtLeastOnce) {
      this.#resizeObserver.observe(this.#shadow.host);
    }
  }
  #userHasCellFocused() {
    return this.#cellUserHasFocused !== null;
  }
  #getTableElementForCellUserHasFocused() {
    if (!this.#cellUserHasFocused) {
      return null;
    }
    const [columnIndex, rowIndex] = this.#cellUserHasFocused;
    const cell = this.#shadow.querySelector(`[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`);
    return cell;
  }
  async #focusTableCellInDOM(cell) {
    await coordinator.write(() => {
      cell.focus();
    });
  }
  #focusCellIfRequired([newColumnIndex, newRowIndex]) {
    this.#userHasFocusInDataGrid = true;
    if (this.#cellUserHasFocused && this.#cellUserHasFocused[0] === newColumnIndex && this.#cellUserHasFocused[1] === newRowIndex) {
      return;
    }
    this.#cellUserHasFocused = [newColumnIndex, newRowIndex];
    void this.#render();
    const tableCell = this.#getTableElementForCellUserHasFocused();
    if (!tableCell) {
      return;
    }
    void this.#focusTableCellInDOM(tableCell);
  }
  #onTableKeyDown(event) {
    const key = event.key;
    if (!this.#cellUserHasFocused) {
      return;
    }
    if (KEYS_TREATED_AS_CLICKS.has(key)) {
      const [focusedColumnIndex, focusedRowIndex] = this.#cellUserHasFocused;
      const activeColumn = this.#columns[focusedColumnIndex];
      if (focusedRowIndex === 0 && activeColumn && activeColumn.sortable) {
        this.#onColumnHeaderClick(activeColumn, focusedColumnIndex);
      }
    }
    if (!Platform.KeyboardUtilities.keyIsArrowKey(key)) {
      return;
    }
    const nextFocusedCell = handleArrowKeyNavigation({
      key,
      currentFocusedCell: this.#cellUserHasFocused,
      columns: this.#columns,
      rows: this.#rows
    });
    event.preventDefault();
    this.#focusCellIfRequired(nextFocusedCell);
  }
  #onColumnHeaderClick(col, index) {
    this.dispatchEvent(new ColumnHeaderClickEvent(col, index));
  }
  #ariaSortForHeader(col) {
    if (col.sortable && (!this.#sortState || this.#sortState.columnId !== col.id)) {
      return "none";
    }
    if (this.#sortState && this.#sortState.columnId === col.id) {
      return this.#sortState.direction === SortDirection.ASC ? "ascending" : "descending";
    }
    return void 0;
  }
  #renderEmptyFillerRow(numberOfVisibleRows) {
    const emptyCells = this.#columns.map((col, colIndex) => {
      if (!col.visible) {
        return LitHtml.nothing;
      }
      const emptyCellClasses = LitHtml.Directives.classMap({
        firstVisibleColumn: colIndex === 0
      });
      return LitHtml.html`<td aria-hidden="true" class=${emptyCellClasses} data-filler-row-column-index=${colIndex}></td>`;
    });
    const emptyRowClasses = LitHtml.Directives.classMap({
      "filler-row": true,
      "padding-row": true,
      "empty-table": numberOfVisibleRows === 0
    });
    return LitHtml.html`<tr aria-hidden="true" class=${emptyRowClasses}>${emptyCells}</tr>`;
  }
  #cleanUpAfterResizeColumnComplete() {
    if (!this.#currentResize) {
      return;
    }
    this.#currentResize.documentForCursorChange.body.style.cursor = this.#currentResize.cursorToRestore;
    this.#currentResize = null;
    void this.#alignScrollHandlers();
  }
  #onResizePointerDown(event) {
    if (event.buttons !== 1 || Host.Platform.isMac() && event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const resizerElement = event.target;
    if (!resizerElement) {
      return;
    }
    const leftColumnIndex = resizerElement.dataset.columnIndex;
    if (!leftColumnIndex) {
      return;
    }
    const leftColumnIndexAsNumber = globalThis.parseInt(leftColumnIndex, 10);
    const rightColumnIndexAsNumber = this.#columns.findIndex((column, index) => {
      return index > leftColumnIndexAsNumber && column.visible === true;
    });
    const leftCell = this.#shadow.querySelector(`td[data-filler-row-column-index="${leftColumnIndexAsNumber}"]`);
    const rightCell = this.#shadow.querySelector(`td[data-filler-row-column-index="${rightColumnIndexAsNumber}"]`);
    if (!leftCell || !rightCell) {
      return;
    }
    const leftCellCol = this.#shadow.querySelector(`col[data-col-column-index="${leftColumnIndexAsNumber}"]`);
    const rightCellCol = this.#shadow.querySelector(`col[data-col-column-index="${rightColumnIndexAsNumber}"]`);
    if (!leftCellCol || !rightCellCol) {
      return;
    }
    const targetDocumentForCursorChange = event.target.ownerDocument;
    if (!targetDocumentForCursorChange) {
      return;
    }
    this.#currentResize = {
      leftCellCol,
      rightCellCol,
      leftCellColInitialPercentageWidth: globalThis.parseInt(leftCellCol.style.width, 10),
      rightCellColInitialPercentageWidth: globalThis.parseInt(rightCellCol.style.width, 10),
      initialLeftCellWidth: leftCell.clientWidth,
      initialRightCellWidth: rightCell.clientWidth,
      initialMouseX: event.x,
      documentForCursorChange: targetDocumentForCursorChange,
      cursorToRestore: resizerElement.style.cursor
    };
    targetDocumentForCursorChange.body.style.cursor = "col-resize";
    resizerElement.setPointerCapture(event.pointerId);
    resizerElement.addEventListener("pointermove", this.#boundOnResizePointerMove);
  }
  #onResizePointerMove(event) {
    event.preventDefault();
    if (!this.#currentResize) {
      return;
    }
    const MIN_CELL_WIDTH_PERCENTAGE = 10;
    const MAX_CELL_WIDTH_PERCENTAGE = this.#currentResize.leftCellColInitialPercentageWidth + this.#currentResize.rightCellColInitialPercentageWidth - MIN_CELL_WIDTH_PERCENTAGE;
    const deltaOfMouseMove = event.x - this.#currentResize.initialMouseX;
    const absoluteDelta = Math.abs(deltaOfMouseMove);
    const percentageDelta = absoluteDelta / (this.#currentResize.initialLeftCellWidth + this.#currentResize.initialRightCellWidth) * 100;
    let newLeftColumnPercentage;
    let newRightColumnPercentage;
    if (deltaOfMouseMove > 0) {
      newLeftColumnPercentage = Platform.NumberUtilities.clamp(this.#currentResize.leftCellColInitialPercentageWidth + percentageDelta, MIN_CELL_WIDTH_PERCENTAGE, MAX_CELL_WIDTH_PERCENTAGE);
      newRightColumnPercentage = Platform.NumberUtilities.clamp(this.#currentResize.rightCellColInitialPercentageWidth - percentageDelta, MIN_CELL_WIDTH_PERCENTAGE, MAX_CELL_WIDTH_PERCENTAGE);
    } else if (deltaOfMouseMove < 0) {
      newLeftColumnPercentage = Platform.NumberUtilities.clamp(this.#currentResize.leftCellColInitialPercentageWidth - percentageDelta, MIN_CELL_WIDTH_PERCENTAGE, MAX_CELL_WIDTH_PERCENTAGE);
      newRightColumnPercentage = Platform.NumberUtilities.clamp(this.#currentResize.rightCellColInitialPercentageWidth + percentageDelta, MIN_CELL_WIDTH_PERCENTAGE, MAX_CELL_WIDTH_PERCENTAGE);
    }
    if (!newLeftColumnPercentage || !newRightColumnPercentage) {
      return;
    }
    this.#currentResize.leftCellCol.style.width = newLeftColumnPercentage.toFixed(2) + "%";
    this.#currentResize.rightCellCol.style.width = newRightColumnPercentage.toFixed(2) + "%";
  }
  #onResizePointerUp(event) {
    event.preventDefault();
    const resizer = event.target;
    if (!resizer) {
      return;
    }
    resizer.releasePointerCapture(event.pointerId);
    resizer.removeEventListener("pointermove", this.#boundOnResizePointerMove);
    this.#cleanUpAfterResizeColumnComplete();
  }
  #renderResizeForCell(column, position) {
    const [columnIndex] = position;
    const lastVisibleColumnIndex = this.#getIndexOfLastVisibleColumn();
    if (columnIndex === lastVisibleColumnIndex || !column.visible) {
      return LitHtml.nothing;
    }
    return LitHtml.html`<span class="cell-resize-handle"
     @pointerdown=${this.#onResizePointerDown}
     @pointerup=${this.#onResizePointerUp}
     data-column-index=${columnIndex}
    ></span>`;
  }
  #getIndexOfLastVisibleColumn() {
    let index = this.#columns.length - 1;
    for (; index > -1; index--) {
      const col = this.#columns[index];
      if (col.visible) {
        break;
      }
    }
    return index;
  }
  #onHeaderContextMenu(event) {
    if (event.button !== 2) {
      return;
    }
    const menu = new UI.ContextMenu.ContextMenu(event);
    addColumnVisibilityCheckboxes(this, menu);
    const sortMenu = menu.defaultSection().appendSubMenuItem(i18nString(UIStrings.sortBy));
    addSortableColumnItems(this, sortMenu);
    menu.defaultSection().appendItem(i18nString(UIStrings.resetColumns), () => {
      this.dispatchEvent(new ContextMenuHeaderResetClickEvent());
    });
    if (this.#contextMenus && this.#contextMenus.headerRow) {
      this.#contextMenus.headerRow(menu, this.#columns);
    }
    void menu.show();
  }
  #onBodyRowContextMenu(event) {
    if (event.button !== 2) {
      return;
    }
    if (!event.target || !(event.target instanceof HTMLElement)) {
      return;
    }
    const rowIndexAttribute = event.target.dataset.rowIndex;
    if (!rowIndexAttribute) {
      return;
    }
    const rowIndex = parseInt(rowIndexAttribute, 10);
    const rowThatWasClicked = this.#rows[rowIndex - 1];
    const menu = new UI.ContextMenu.ContextMenu(event);
    const sortMenu = menu.defaultSection().appendSubMenuItem(i18nString(UIStrings.sortBy));
    addSortableColumnItems(this, sortMenu);
    const headerOptionsMenu = menu.defaultSection().appendSubMenuItem(i18nString(UIStrings.headerOptions));
    addColumnVisibilityCheckboxes(this, headerOptionsMenu);
    headerOptionsMenu.defaultSection().appendItem(i18nString(UIStrings.resetColumns), () => {
      this.dispatchEvent(new ContextMenuHeaderResetClickEvent());
    });
    if (this.#contextMenus && this.#contextMenus.bodyRow) {
      this.#contextMenus.bodyRow(menu, this.#columns, rowThatWasClicked);
    }
    void menu.show();
  }
  #onScroll(event) {
    const wrapper = event.target;
    if (!wrapper) {
      return;
    }
    const userIsAtBottom = Math.round(wrapper.scrollTop + wrapper.clientHeight) === Math.round(wrapper.scrollHeight);
    this.#userScrollState = userIsAtBottom ? "SCROLLED_TO_BOTTOM" /* SCROLLED_TO_BOTTOM */ : "MANUAL_SCROLL_NOT_BOTTOM" /* MANUAL_SCROLL_NOT_BOTTOM */;
    void this.#render();
  }
  #alignScrollHandlers() {
    return coordinator.read(() => {
      const columnHeaders = this.#shadow.querySelectorAll("th:not(.hidden)");
      const handlers = this.#shadow.querySelectorAll(".cell-resize-handle");
      const table = this.#shadow.querySelector("table");
      if (!table) {
        return;
      }
      columnHeaders.forEach(async (header, index) => {
        const columnWidth = header.clientWidth;
        const columnLeftOffset = header.offsetLeft;
        if (handlers[index]) {
          const handlerWidth = handlers[index].clientWidth;
          void coordinator.write(() => {
            handlers[index].style.left = `${columnLeftOffset + columnWidth - handlerWidth}px`;
          });
        }
      });
    });
  }
  #calculateTopAndBottomRowIndexes() {
    return coordinator.read(() => {
      const wrapper = this.#shadow.querySelector(".wrapping-container");
      let scrollTop = 0;
      let clientHeight = window.innerHeight;
      if (wrapper) {
        scrollTop = wrapper.scrollTop;
        clientHeight = wrapper.clientHeight;
      }
      const padding = ROW_HEIGHT_PIXELS * PADDING_ROWS_COUNT;
      let topVisibleRow = Math.floor((scrollTop - padding) / ROW_HEIGHT_PIXELS);
      let bottomVisibleRow = Math.ceil((scrollTop + clientHeight + padding) / ROW_HEIGHT_PIXELS);
      topVisibleRow = Math.max(0, topVisibleRow);
      bottomVisibleRow = Math.min(this.#rows.filter((r) => !r.hidden).length, bottomVisibleRow);
      return {
        topVisibleRow,
        bottomVisibleRow
      };
    });
  }
  #onFocusOut() {
    this.#userHasFocusInDataGrid = false;
  }
  #tabbableCell() {
    return this.#cellUserHasFocused || this.#cellToFocusIfUserTabsIn;
  }
  async #render() {
    if (this.#isRendering) {
      this.#scheduleRender = true;
      return;
    }
    this.#isRendering = true;
    const { topVisibleRow, bottomVisibleRow } = await this.#calculateTopAndBottomRowIndexes();
    const nonHiddenRows = this.#rows.filter((row) => !row.hidden);
    const renderableRows = nonHiddenRows.filter((_, idx) => idx >= topVisibleRow && idx <= bottomVisibleRow);
    const indexOfFirstVisibleColumn = this.#columns.findIndex((col) => col.visible);
    const anyColumnsSortable = this.#columns.some((col) => col.sortable === true);
    await coordinator.write(() => {
      LitHtml.render(LitHtml.html`
      ${this.#columns.map((col, columnIndex) => {
        return this.#renderResizeForCell(col, [columnIndex, 0]);
      })}
      <div class="wrapping-container" @scroll=${this.#onScroll} @focusout=${this.#onFocusOut}>
        <table
          aria-label=${LitHtml.Directives.ifDefined(this.#label)}
          aria-rowcount=${this.#rows.length}
          aria-colcount=${this.#columns.length}
          @keydown=${this.#onTableKeyDown}
        >
          <colgroup>
            ${this.#columns.map((col, colIndex) => {
        const width = calculateColumnWidthPercentageFromWeighting(this.#columns, col.id);
        const style = `width: ${width}%`;
        if (!col.visible) {
          return LitHtml.nothing;
        }
        return LitHtml.html`<col style=${style} data-col-column-index=${colIndex}>`;
      })}
          </colgroup>
          <thead>
            <tr @contextmenu=${this.#onHeaderContextMenu}>
              ${this.#columns.map((col, columnIndex) => {
        const thClasses = LitHtml.Directives.classMap({
          hidden: !col.visible,
          firstVisibleColumn: columnIndex === indexOfFirstVisibleColumn
        });
        const tabbableCell2 = this.#tabbableCell();
        const cellIsFocusableCell = anyColumnsSortable && columnIndex === tabbableCell2[0] && tabbableCell2[1] === 0;
        return LitHtml.html`<th class=${thClasses}
                  style=${LitHtml.Directives.ifDefined(col.styles ? LitHtml.Directives.styleMap(col.styles) : void 0)}
                  data-grid-header-cell=${col.id}
                  @focus=${() => {
          this.#focusCellIfRequired([columnIndex, 0]);
        }}
                  @click=${() => {
          this.#onColumnHeaderClick(col, columnIndex);
        }}
                  title=${col.title}
                  aria-sort=${LitHtml.Directives.ifDefined(this.#ariaSortForHeader(col))}
                  aria-colindex=${columnIndex + 1}
                  data-row-index='0'
                  data-col-index=${columnIndex}
                  tabindex=${LitHtml.Directives.ifDefined(anyColumnsSortable ? cellIsFocusableCell ? "0" : "-1" : void 0)}
                >${col.titleElement || col.title}</th>`;
      })}
            </tr>
          </thead>
          <tbody>
            <tr class="filler-row-top padding-row" style=${LitHtml.Directives.styleMap({
        height: `${topVisibleRow * ROW_HEIGHT_PIXELS}px`
      })} aria-hidden="true"></tr>
            ${LitHtml.Directives.repeat(renderableRows, (row) => this.#rowIndexMap.get(row), (row) => {
        const rowIndex = this.#rowIndexMap.get(row);
        if (rowIndex === void 0) {
          throw new Error("Trying to render a row that has no index in the rowIndexMap");
        }
        const tabbableCell2 = this.#tabbableCell();
        const tableRowIndex = rowIndex + 1;
        const rowIsSelected = this.#cellUserHasFocused ? tableRowIndex === this.#cellUserHasFocused[1] : false;
        const rowClasses = LitHtml.Directives.classMap({
          selected: rowIsSelected,
          hidden: row.hidden === true
        });
        return LitHtml.html`
                <tr
                  aria-rowindex=${rowIndex + 1}
                  class=${rowClasses}
                  style=${LitHtml.Directives.ifDefined(row.styles ? LitHtml.Directives.styleMap(row.styles) : void 0)}
                  @contextmenu=${this.#onBodyRowContextMenu}
                >${this.#columns.map((col, columnIndex) => {
          const cell = getRowEntryForColumnId(row, col.id);
          const cellClasses = LitHtml.Directives.classMap({
            hidden: !col.visible,
            firstVisibleColumn: columnIndex === indexOfFirstVisibleColumn
          });
          const cellIsFocusableCell = columnIndex === tabbableCell2[0] && tableRowIndex === tabbableCell2[1];
          const cellOutput = col.visible ? renderCellValue(cell) : null;
          return LitHtml.html`<td
                    class=${cellClasses}
                    style=${LitHtml.Directives.ifDefined(col.styles ? LitHtml.Directives.styleMap(col.styles) : void 0)}
                    tabindex=${cellIsFocusableCell ? "0" : "-1"}
                    aria-colindex=${columnIndex + 1}
                    title=${cell.title || getCellTitleFromCellContent(String(cell.value))}
                    data-row-index=${tableRowIndex}
                    data-col-index=${columnIndex}
                    data-grid-value-cell-for-column=${col.id}
                    @focus=${() => {
            this.#focusCellIfRequired([columnIndex, tableRowIndex]);
            this.dispatchEvent(new BodyCellFocusedEvent(cell, row));
          }}
                  >${cellOutput}</td>`;
        })}
              `;
      })}
            ${this.#renderEmptyFillerRow(renderableRows.length)}
            <tr class="filler-row-bottom padding-row" style=${LitHtml.Directives.styleMap({
        height: `${Math.max(0, nonHiddenRows.length - bottomVisibleRow) * ROW_HEIGHT_PIXELS}px`
      })} aria-hidden="true"></tr>
          </tbody>
        </table>
      </div>
      `, this.#shadow, {
        host: this
      });
    });
    const tabbableCell = this.#tabbableCell();
    const currentlyFocusedRowIndex = tabbableCell[1];
    const tabbableCellElement = this.#getTableElementForCellUserHasFocused();
    if (this.#userHasFocusInDataGrid && currentlyFocusedRowIndex > 0 && tabbableCellElement) {
      void this.#focusTableCellInDOM(tabbableCellElement);
    }
    this.#scrollToBottomIfRequired();
    this.#engageResizeObserver();
    if (this.#hasRenderedAtLeastOnce) {
      void this.#alignScrollHandlers();
    }
    this.#isRendering = false;
    this.#hasRenderedAtLeastOnce = true;
    if (this.#scheduleRender) {
      this.#scheduleRender = false;
      void this.#render();
    }
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-data-grid", DataGrid);
//# sourceMappingURL=DataGrid.js.map
