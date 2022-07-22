import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import { SortDirection, getRowEntryForColumnId, getStringifiedCellValues } from "./DataGridUtils.js";
import { DataGrid } from "./DataGrid.js";
import dataGridControllerStyles from "./dataGridController.css.js";
export class DataGridController extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-data-grid-controller`;
  #shadow = this.attachShadow({ mode: "open" });
  #hasRenderedAtLeastOnce = false;
  #columns = [];
  #rows = [];
  #contextMenus = void 0;
  #label = void 0;
  #originalColumns = [];
  #originalRows = [];
  #sortState = null;
  #filters = [];
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [dataGridControllerStyles];
  }
  get data() {
    return {
      columns: this.#originalColumns,
      rows: this.#originalRows,
      filters: this.#filters,
      contextMenus: this.#contextMenus,
      label: this.#label
    };
  }
  set data(data) {
    this.#originalColumns = data.columns;
    this.#originalRows = data.rows;
    this.#contextMenus = data.contextMenus;
    this.#filters = data.filters || [];
    this.#contextMenus = data.contextMenus;
    this.#label = data.label;
    this.#columns = [...this.#originalColumns];
    this.#rows = this.#cloneAndFilterRows(data.rows, this.#filters);
    if (!this.#hasRenderedAtLeastOnce && data.initialSort) {
      this.#sortState = data.initialSort;
    }
    if (this.#sortState) {
      this.#sortRows(this.#sortState);
    }
    this.#render();
  }
  #testRowWithFilter(row, filter) {
    let rowMatchesFilter = false;
    const { key, text, negative, regex } = filter;
    let dataToTest;
    if (key) {
      dataToTest = getStringifiedCellValues([getRowEntryForColumnId(row, key)]);
    } else {
      dataToTest = getStringifiedCellValues(row.cells);
    }
    if (regex) {
      rowMatchesFilter = regex.test(dataToTest);
    } else if (text) {
      rowMatchesFilter = dataToTest.includes(text.toLowerCase());
    }
    return negative ? !rowMatchesFilter : rowMatchesFilter;
  }
  #cloneAndFilterRows(rows, filters) {
    if (filters.length === 0) {
      return [...rows];
    }
    return rows.map((row) => {
      let rowShouldBeVisible = true;
      for (const filter of filters) {
        const rowMatchesFilter = this.#testRowWithFilter(row, filter);
        if (!rowMatchesFilter) {
          rowShouldBeVisible = false;
          break;
        }
      }
      return {
        ...row,
        hidden: !rowShouldBeVisible
      };
    });
  }
  #sortRows(state) {
    const { columnId, direction } = state;
    this.#rows.sort((row1, row2) => {
      const cell1 = getRowEntryForColumnId(row1, columnId);
      const cell2 = getRowEntryForColumnId(row2, columnId);
      const value1 = typeof cell1.value === "number" ? cell1.value : String(cell1.value).toUpperCase();
      const value2 = typeof cell2.value === "number" ? cell2.value : String(cell2.value).toUpperCase();
      if (value1 < value2) {
        return direction === SortDirection.ASC ? -1 : 1;
      }
      if (value1 > value2) {
        return direction === SortDirection.ASC ? 1 : -1;
      }
      return 0;
    });
    this.#render();
  }
  #onColumnHeaderClick(event) {
    const { column } = event.data;
    if (column.sortable) {
      this.#applySortOnColumn(column);
    }
  }
  #applySortOnColumn(column) {
    if (this.#sortState && this.#sortState.columnId === column.id) {
      const { columnId, direction } = this.#sortState;
      if (direction === SortDirection.DESC) {
        this.#sortState = null;
      } else {
        this.#sortState = {
          columnId,
          direction: SortDirection.DESC
        };
      }
    } else {
      this.#sortState = {
        columnId: column.id,
        direction: SortDirection.ASC
      };
    }
    if (this.#sortState) {
      this.#sortRows(this.#sortState);
    } else {
      this.#rows = this.#cloneAndFilterRows(this.#originalRows, this.#filters);
      this.#render();
    }
  }
  #onContextMenuColumnSortClick(event) {
    this.#applySortOnColumn(event.data.column);
  }
  #onContextMenuHeaderResetClick() {
    this.#sortState = null;
    this.#rows = [...this.#originalRows];
    this.#render();
  }
  #render() {
    LitHtml.render(LitHtml.html`
      <${DataGrid.litTagName} .data=${{
      columns: this.#columns,
      rows: this.#rows,
      activeSort: this.#sortState,
      contextMenus: this.#contextMenus,
      label: this.#label
    }}
        @columnheaderclick=${this.#onColumnHeaderClick}
        @contextmenucolumnsortclick=${this.#onContextMenuColumnSortClick}
        @contextmenuheaderresetclick=${this.#onContextMenuHeaderResetClick}
     ></${DataGrid.litTagName}>
    `, this.#shadow, {
      host: this
    });
    this.#hasRenderedAtLeastOnce = true;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-data-grid-controller", DataGridController);
//# sourceMappingURL=DataGridController.js.map
