import * as Platform from "../../../core/platform/platform.js";
import * as DataGridRenderers from "./DataGridRenderers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
export function getStringifiedCellValues(cells) {
  return JSON.stringify(cells.map((cell) => {
    if (cell.value instanceof IconButton.Icon.Icon) {
      return null;
    }
    return cell.value;
  })).toLowerCase();
}
export var SortDirection = /* @__PURE__ */ ((SortDirection2) => {
  SortDirection2["ASC"] = "ASC";
  SortDirection2["DESC"] = "DESC";
  return SortDirection2;
})(SortDirection || {});
export function getRowEntryForColumnId(row, id) {
  const rowEntry = row.cells.find((r) => r.columnId === id);
  if (rowEntry === void 0) {
    throw new Error(`Found a row that was missing an entry for column ${id}.`);
  }
  return rowEntry;
}
export function renderCellValue(cell) {
  if (cell.renderer) {
    return cell.renderer(cell.value);
  }
  return DataGridRenderers.primitiveRenderer(cell.value);
}
export function calculateColumnWidthPercentageFromWeighting(allColumns, columnId) {
  const totalWeights = allColumns.filter((c) => c.visible).reduce((sumOfWeights, col) => sumOfWeights + col.widthWeighting, 0);
  const matchingColumn = allColumns.find((c) => c.id === columnId);
  if (!matchingColumn) {
    throw new Error(`Could not find column with ID ${columnId}`);
  }
  if (matchingColumn.widthWeighting < 1) {
    throw new Error(`Error with column ${columnId}: width weightings must be >= 1.`);
  }
  if (!matchingColumn.visible) {
    return 0;
  }
  return Math.round(matchingColumn.widthWeighting / totalWeights * 100);
}
export function handleArrowKeyNavigation(options) {
  const { key, currentFocusedCell, columns, rows } = options;
  const [selectedColIndex, selectedRowIndex] = currentFocusedCell;
  switch (key) {
    case Platform.KeyboardUtilities.ArrowKey.LEFT: {
      const firstVisibleColumnIndex = columns.findIndex((c) => c.visible);
      if (selectedColIndex === firstVisibleColumnIndex) {
        return [selectedColIndex, selectedRowIndex];
      }
      let nextColIndex = selectedColIndex;
      for (let i = nextColIndex - 1; i >= 0; i--) {
        const col = columns[i];
        if (col.visible) {
          nextColIndex = i;
          break;
        }
      }
      return [nextColIndex, selectedRowIndex];
    }
    case Platform.KeyboardUtilities.ArrowKey.RIGHT: {
      let nextColIndex = selectedColIndex;
      for (let i = nextColIndex + 1; i < columns.length; i++) {
        const col = columns[i];
        if (col.visible) {
          nextColIndex = i;
          break;
        }
      }
      return [nextColIndex, selectedRowIndex];
    }
    case Platform.KeyboardUtilities.ArrowKey.UP: {
      const columnsSortable = columns.some((col) => col.sortable === true);
      const minRowIndex = columnsSortable ? 0 : 1;
      if (selectedRowIndex === minRowIndex) {
        return [selectedColIndex, selectedRowIndex];
      }
      let rowIndexToMoveTo = selectedRowIndex;
      for (let i = selectedRowIndex - 1; i >= minRowIndex; i--) {
        if (i === 0) {
          rowIndexToMoveTo = 0;
          break;
        }
        const matchingRow = rows[i - 1];
        if (!matchingRow.hidden) {
          rowIndexToMoveTo = i;
          break;
        }
      }
      return [selectedColIndex, rowIndexToMoveTo];
    }
    case Platform.KeyboardUtilities.ArrowKey.DOWN: {
      if (selectedRowIndex === 0) {
        const firstVisibleBodyRowIndex = rows.findIndex((row) => !row.hidden);
        if (firstVisibleBodyRowIndex > -1) {
          return [selectedColIndex, firstVisibleBodyRowIndex + 1];
        }
        return [selectedColIndex, selectedRowIndex];
      }
      let rowIndexToMoveTo = selectedRowIndex;
      for (let i = rowIndexToMoveTo + 1; i < rows.length + 1; i++) {
        const matchingRow = rows[i - 1];
        if (!matchingRow.hidden) {
          rowIndexToMoveTo = i;
          break;
        }
      }
      return [selectedColIndex, rowIndexToMoveTo];
    }
    default:
      return Platform.assertNever(key, `Unknown arrow key: ${key}`);
  }
}
export const calculateFirstFocusableCell = (options) => {
  const { columns, rows } = options;
  const someColumnsSortable = columns.some((col) => col.sortable === true);
  const focusableRowIndex = someColumnsSortable ? 0 : rows.findIndex((row) => !row.hidden) + 1;
  const focusableColIndex = columns.findIndex((col) => col.visible);
  return [focusableColIndex, focusableRowIndex];
};
export const getCellTitleFromCellContent = (text) => text.length < 25 ? text : text.substr(0, 20) + "\u2026";
//# sourceMappingURL=DataGridUtils.js.map
