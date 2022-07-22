import * as i18n from "../../core/i18n/i18n.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
import eventDisplayTableStyles from "./eventDisplayTable.css.js";
const UIStrings = {
  timestamp: "Timestamp",
  eventName: "Event name",
  value: "Value",
  eventDisplay: "Event display"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/EventDisplayTable.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var MediaEventColumnKeys = /* @__PURE__ */ ((MediaEventColumnKeys2) => {
  MediaEventColumnKeys2["Timestamp"] = "displayTimestamp";
  MediaEventColumnKeys2["Event"] = "event";
  MediaEventColumnKeys2["Value"] = "value";
  return MediaEventColumnKeys2;
})(MediaEventColumnKeys || {});
export class EventNode extends DataGrid.DataGrid.DataGridNode {
  expandableElement;
  constructor(event) {
    super(event, false);
    this.expandableElement = null;
  }
  createCell(columnId) {
    const cell = this.createTD(columnId);
    const cellData = this.data[columnId];
    if (columnId === "value" /* Value */) {
      const enclosed = cell.createChild("div", "event-display-table-contents-json-wrapper");
      this.expandableElement = new SourceFrame.JSONView.JSONView(new SourceFrame.JSONView.ParsedJSON(cellData, "", ""), true);
      this.expandableElement.markAsRoot();
      this.expandableElement.show(enclosed);
    } else {
      cell.classList.add("event-display-table-basic-text-table-entry");
      UI.UIUtils.createTextChild(cell, cellData);
    }
    return cell;
  }
}
export class PlayerEventsView extends UI.Widget.VBox {
  dataGrid;
  firstEventTime;
  constructor() {
    super();
    this.contentElement.classList.add("event-display-table-contents-table-container");
    this.dataGrid = this.createDataGrid([
      {
        id: "displayTimestamp" /* Timestamp */,
        title: i18nString(UIStrings.timestamp),
        weight: 1,
        sortable: false
      },
      { id: "event" /* Event */, title: i18nString(UIStrings.eventName), weight: 2, sortable: false },
      {
        id: "value" /* Value */,
        title: i18nString(UIStrings.value),
        weight: 7,
        sortable: false
      }
    ]);
    this.firstEventTime = 0;
    this.dataGrid.setStriped(true);
    this.dataGrid.asWidget().show(this.contentElement);
  }
  createDataGrid(headers) {
    const gridColumnDescs = [];
    for (const headerDesc of headers) {
      gridColumnDescs.push(PlayerEventsView.convertToGridDescriptor(headerDesc));
    }
    const datagrid = new DataGrid.DataGrid.DataGridImpl({
      displayName: i18nString(UIStrings.eventDisplay),
      columns: gridColumnDescs,
      deleteCallback: void 0,
      editCallback: void 0,
      refreshCallback: void 0
    });
    datagrid.asWidget().contentElement.classList.add("no-border-top-datagrid");
    return datagrid;
  }
  onEvent(event) {
    if (this.firstEventTime === 0 && typeof event.timestamp === "number") {
      this.firstEventTime = event.timestamp;
    }
    event = this.subtractFirstEventTime(event);
    const stringified = event.value;
    try {
      const json = JSON.parse(stringified);
      event.event = json.event;
      delete json["event"];
      event.value = json;
      const node = new EventNode(event);
      const scroll = this.dataGrid.scrollContainer;
      const isAtBottom = scroll.scrollTop === scroll.scrollHeight - scroll.offsetHeight;
      this.dataGrid.rootNode().appendChild(node);
      if (isAtBottom) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    } catch (e) {
    }
  }
  subtractFirstEventTime(event) {
    if (typeof event.timestamp === "number") {
      event.displayTimestamp = (event.timestamp - this.firstEventTime).toFixed(3);
    }
    return event;
  }
  static convertToGridDescriptor(columnConfig) {
    return {
      id: columnConfig.id,
      title: columnConfig.title,
      sortable: columnConfig.sortable,
      weight: columnConfig.weight || 0,
      sort: DataGrid.DataGrid.Order.Ascending
    };
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([eventDisplayTableStyles]);
  }
}
//# sourceMappingURL=EventDisplayTable.js.map
