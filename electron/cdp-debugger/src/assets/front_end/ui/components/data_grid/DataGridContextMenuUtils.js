import { ContextMenuColumnSortClickEvent } from "./DataGridEvents.js";
function toggleColumnVisibility(dataGrid, column) {
  const newVisibility = !column.visible;
  const newColumns = dataGrid.data.columns.map((col) => {
    if (col === column) {
      col.visible = newVisibility;
    }
    return col;
  });
  dataGrid.data = {
    ...dataGrid.data,
    columns: newColumns
  };
}
export function addColumnVisibilityCheckboxes(dataGrid, contextMenu) {
  const { columns } = dataGrid.data;
  for (const column of columns) {
    if (!column.hideable) {
      continue;
    }
    contextMenu.defaultSection().appendCheckboxItem(column.title, () => {
      toggleColumnVisibility(dataGrid, column);
    }, column.visible);
  }
}
export function addSortableColumnItems(dataGrid, contextMenu) {
  const sortableColumns = dataGrid.data.columns.filter((col) => col.sortable === true);
  if (sortableColumns.length > 0) {
    for (const column of sortableColumns) {
      contextMenu.defaultSection().appendItem(column.title, () => {
        dataGrid.dispatchEvent(new ContextMenuColumnSortClickEvent(column));
      });
    }
  }
}
//# sourceMappingURL=DataGridContextMenuUtils.js.map
