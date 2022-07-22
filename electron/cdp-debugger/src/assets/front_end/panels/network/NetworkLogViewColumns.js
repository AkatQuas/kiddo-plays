import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ThemeSupport from "../../ui/legacy/theme_support/theme_support.js";
import { NetworkRequestNode } from "./NetworkDataGridNode.js";
import { NetworkManageCustomHeadersView } from "./NetworkManageCustomHeadersView.js";
import { NetworkWaterfallColumn } from "./NetworkWaterfallColumn.js";
import { RequestInitiatorView } from "./RequestInitiatorView.js";
const UIStrings = {
  networkLog: "Network Log",
  waterfall: "Waterfall",
  responseHeaders: "Response Headers",
  manageHeaderColumns: "Manage Header Columns\u2026",
  startTime: "Start Time",
  responseTime: "Response Time",
  endTime: "End Time",
  totalDuration: "Total Duration",
  latency: "Latency",
  name: "Name",
  path: "Path",
  url: "Url",
  method: "Method",
  status: "Status",
  text: "Text",
  protocol: "Protocol",
  scheme: "Scheme",
  domain: "Domain",
  remoteAddress: "Remote Address",
  type: "Type",
  initiator: "Initiator",
  initiatorAddressSpace: "Initiator Address Space",
  cookies: "Cookies",
  setCookies: "Set Cookies",
  size: "Size",
  content: "Content",
  time: "Time",
  priority: "Priority",
  connectionId: "Connection ID",
  remoteAddressSpace: "Remote Address Space"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/NetworkLogViewColumns.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class NetworkLogViewColumns {
  networkLogView;
  persistantSettings;
  networkLogLargeRowsSetting;
  eventDividers;
  eventDividersShown;
  gridMode;
  columns;
  waterfallRequestsAreStale;
  waterfallScrollerWidthIsStale;
  popupLinkifier;
  calculatorsMap;
  lastWheelTime;
  dataGridInternal;
  splitWidget;
  waterfallColumn;
  activeScroller;
  dataGridScroller;
  waterfallScroller;
  waterfallScrollerContent;
  waterfallHeaderElement;
  waterfallColumnSortIcon;
  activeWaterfallSortId;
  popoverHelper;
  hasScrollerTouchStarted;
  scrollerTouchStartPos;
  constructor(networkLogView, timeCalculator, durationCalculator, networkLogLargeRowsSetting) {
    this.networkLogView = networkLogView;
    this.persistantSettings = Common.Settings.Settings.instance().createSetting("networkLogColumns", {});
    this.networkLogLargeRowsSetting = networkLogLargeRowsSetting;
    this.networkLogLargeRowsSetting.addChangeListener(this.updateRowsSize, this);
    this.eventDividers = /* @__PURE__ */ new Map();
    this.eventDividersShown = false;
    this.gridMode = true;
    this.columns = [];
    this.waterfallRequestsAreStale = false;
    this.waterfallScrollerWidthIsStale = true;
    this.popupLinkifier = new Components.Linkifier.Linkifier();
    this.calculatorsMap = /* @__PURE__ */ new Map();
    this.calculatorsMap.set(_calculatorTypes.Time, timeCalculator);
    this.calculatorsMap.set(_calculatorTypes.Duration, durationCalculator);
    this.lastWheelTime = 0;
    this.setupDataGrid();
    this.setupWaterfall();
    ThemeSupport.ThemeSupport.instance().addEventListener(ThemeSupport.ThemeChangeEvent.eventName, () => {
      this.scheduleRefresh();
    });
  }
  static convertToDataGridDescriptor(columnConfig) {
    const title = columnConfig.title instanceof Function ? columnConfig.title() : columnConfig.title;
    return {
      id: columnConfig.id,
      title,
      sortable: columnConfig.sortable,
      align: columnConfig.align,
      nonSelectable: columnConfig.nonSelectable,
      weight: columnConfig.weight,
      allowInSortByEvenWhenHidden: columnConfig.allowInSortByEvenWhenHidden
    };
  }
  wasShown() {
    this.updateRowsSize();
  }
  willHide() {
    if (this.popoverHelper) {
      this.popoverHelper.hidePopover();
    }
  }
  reset() {
    if (this.popoverHelper) {
      this.popoverHelper.hidePopover();
    }
    this.eventDividers.clear();
  }
  setupDataGrid() {
    const defaultColumns = _defaultColumns;
    const defaultColumnConfig = _defaultColumnConfig;
    this.columns = [];
    for (const currentConfigColumn of defaultColumns) {
      const descriptor = Object.assign({}, defaultColumnConfig, currentConfigColumn);
      const columnConfig = descriptor;
      columnConfig.id = columnConfig.id;
      if (columnConfig.subtitle) {
        const title = columnConfig.title instanceof Function ? columnConfig.title() : columnConfig.title;
        const subtitle = columnConfig.subtitle instanceof Function ? columnConfig.subtitle() : columnConfig.subtitle;
        columnConfig.titleDOMFragment = this.makeHeaderFragment(title, subtitle);
      }
      this.columns.push(columnConfig);
    }
    this.loadCustomColumnsAndSettings();
    this.popoverHelper = new UI.PopoverHelper.PopoverHelper(this.networkLogView.element, this.getPopoverRequest.bind(this));
    this.popoverHelper.setHasPadding(true);
    this.popoverHelper.setTimeout(300, 300);
    this.dataGridInternal = new DataGrid.SortableDataGrid.SortableDataGrid({
      displayName: i18nString(UIStrings.networkLog),
      columns: this.columns.map(NetworkLogViewColumns.convertToDataGridDescriptor),
      editCallback: void 0,
      deleteCallback: void 0,
      refreshCallback: void 0
    });
    this.dataGridInternal.element.addEventListener("mousedown", (event) => {
      if (!this.dataGridInternal.selectedNode && event.button) {
        event.consume();
      }
    }, true);
    this.dataGridScroller = this.dataGridInternal.scrollContainer;
    this.updateColumns();
    this.dataGridInternal.addEventListener(DataGrid.DataGrid.Events.SortingChanged, this.sortHandler, this);
    this.dataGridInternal.setHeaderContextMenuCallback(this.innerHeaderContextMenu.bind(this));
    this.activeWaterfallSortId = WaterfallSortIds.StartTime;
    this.dataGridInternal.markColumnAsSortedBy(_initialSortColumn, DataGrid.DataGrid.Order.Ascending);
    this.splitWidget = new UI.SplitWidget.SplitWidget(true, true, "networkPanelSplitViewWaterfall", 200);
    const widget = this.dataGridInternal.asWidget();
    widget.setMinimumSize(150, 0);
    this.splitWidget.setMainWidget(widget);
  }
  setupWaterfall() {
    this.waterfallColumn = new NetworkWaterfallColumn(this.networkLogView.calculator());
    this.waterfallColumn.element.addEventListener("contextmenu", handleContextMenu.bind(this));
    this.waterfallColumn.element.addEventListener("wheel", this.onMouseWheel.bind(this, false), { passive: true });
    this.waterfallColumn.element.addEventListener("touchstart", this.onTouchStart.bind(this));
    this.waterfallColumn.element.addEventListener("touchmove", this.onTouchMove.bind(this));
    this.waterfallColumn.element.addEventListener("touchend", this.onTouchEnd.bind(this));
    this.dataGridScroller.addEventListener("wheel", this.onMouseWheel.bind(this, true), true);
    this.dataGridScroller.addEventListener("touchstart", this.onTouchStart.bind(this));
    this.dataGridScroller.addEventListener("touchmove", this.onTouchMove.bind(this));
    this.dataGridScroller.addEventListener("touchend", this.onTouchEnd.bind(this));
    this.waterfallScroller = this.waterfallColumn.contentElement.createChild("div", "network-waterfall-v-scroll");
    this.waterfallScrollerContent = this.waterfallScroller.createChild("div", "network-waterfall-v-scroll-content");
    this.dataGridInternal.addEventListener(DataGrid.DataGrid.Events.PaddingChanged, () => {
      this.waterfallScrollerWidthIsStale = true;
      this.syncScrollers();
    });
    this.dataGridInternal.addEventListener(DataGrid.ViewportDataGrid.Events.ViewportCalculated, this.redrawWaterfallColumn.bind(this));
    this.createWaterfallHeader();
    this.waterfallColumn.contentElement.classList.add("network-waterfall-view");
    this.waterfallColumn.setMinimumSize(100, 0);
    this.splitWidget.setSidebarWidget(this.waterfallColumn);
    this.switchViewMode(false);
    function handleContextMenu(ev) {
      const event = ev;
      const node = this.waterfallColumn.getNodeFromPoint(event.offsetX, event.offsetY);
      if (!node) {
        return;
      }
      const request = node.request();
      if (!request) {
        return;
      }
      const contextMenu = new UI.ContextMenu.ContextMenu(event);
      this.networkLogView.handleContextMenuForRequest(contextMenu, request);
      void contextMenu.show();
    }
  }
  onMouseWheel(shouldConsume, ev) {
    if (shouldConsume) {
      ev.consume(true);
    }
    const event = ev;
    const hasRecentWheel = Date.now() - this.lastWheelTime < 80;
    this.activeScroller.scrollBy({ top: event.deltaY, behavior: hasRecentWheel ? "auto" : "smooth" });
    this.syncScrollers();
    this.lastWheelTime = Date.now();
  }
  onTouchStart(ev) {
    const event = ev;
    this.hasScrollerTouchStarted = true;
    this.scrollerTouchStartPos = event.changedTouches[0].pageY;
  }
  onTouchMove(ev) {
    if (!this.hasScrollerTouchStarted) {
      return;
    }
    const event = ev;
    const currentPos = event.changedTouches[0].pageY;
    const delta = this.scrollerTouchStartPos - currentPos;
    this.activeScroller.scrollBy({ top: delta, behavior: "auto" });
    this.syncScrollers();
    this.scrollerTouchStartPos = currentPos;
  }
  onTouchEnd() {
    this.hasScrollerTouchStarted = false;
  }
  syncScrollers() {
    if (!this.waterfallColumn.isShowing()) {
      return;
    }
    this.waterfallScrollerContent.style.height = this.dataGridScroller.scrollHeight + "px";
    this.updateScrollerWidthIfNeeded();
    this.dataGridScroller.scrollTop = this.waterfallScroller.scrollTop;
  }
  updateScrollerWidthIfNeeded() {
    if (this.waterfallScrollerWidthIsStale) {
      this.waterfallScrollerWidthIsStale = false;
      this.waterfallColumn.setRightPadding(this.waterfallScroller.offsetWidth - this.waterfallScrollerContent.offsetWidth);
    }
  }
  redrawWaterfallColumn() {
    if (!this.waterfallRequestsAreStale) {
      this.updateScrollerWidthIfNeeded();
      this.waterfallColumn.update(this.activeScroller.scrollTop, this.eventDividersShown ? this.eventDividers : void 0);
      return;
    }
    this.syncScrollers();
    const nodes = this.networkLogView.flatNodesList();
    this.waterfallColumn.update(this.activeScroller.scrollTop, this.eventDividers, nodes);
  }
  createWaterfallHeader() {
    this.waterfallHeaderElement = this.waterfallColumn.contentElement.createChild("div", "network-waterfall-header");
    this.waterfallHeaderElement.addEventListener("click", waterfallHeaderClicked.bind(this));
    this.waterfallHeaderElement.addEventListener("contextmenu", (event) => this.innerHeaderContextMenu(new UI.ContextMenu.ContextMenu(event)));
    const innerElement = this.waterfallHeaderElement.createChild("div");
    innerElement.textContent = i18nString(UIStrings.waterfall);
    this.waterfallColumnSortIcon = UI.Icon.Icon.create("", "sort-order-icon");
    this.waterfallHeaderElement.createChild("div", "sort-order-icon-container").appendChild(this.waterfallColumnSortIcon);
    function waterfallHeaderClicked() {
      const sortOrders = DataGrid.DataGrid.Order;
      const wasSortedByWaterfall = this.dataGridInternal.sortColumnId() === "waterfall";
      const wasSortedAscending = this.dataGridInternal.isSortOrderAscending();
      const sortOrder = wasSortedByWaterfall && wasSortedAscending ? sortOrders.Descending : sortOrders.Ascending;
      this.dataGridInternal.markColumnAsSortedBy("waterfall", sortOrder);
      this.sortHandler();
    }
  }
  setCalculator(x) {
    this.waterfallColumn.setCalculator(x);
  }
  scheduleRefresh() {
    this.waterfallColumn.scheduleDraw();
  }
  updateRowsSize() {
    const largeRows = Boolean(this.networkLogLargeRowsSetting.get());
    this.dataGridInternal.element.classList.toggle("small", !largeRows);
    this.dataGridInternal.scheduleUpdate();
    this.waterfallScrollerWidthIsStale = true;
    this.waterfallColumn.setRowHeight(largeRows ? 41 : 21);
    this.waterfallScroller.classList.toggle("small", !largeRows);
    this.waterfallHeaderElement.classList.toggle("small", !largeRows);
    window.requestAnimationFrame(() => {
      this.waterfallColumn.setHeaderHeight(this.waterfallScroller.offsetTop);
      this.waterfallColumn.scheduleDraw();
    });
  }
  show(element) {
    this.splitWidget.show(element);
  }
  setHidden(value) {
    UI.ARIAUtils.setHidden(this.splitWidget.element, value);
  }
  dataGrid() {
    return this.dataGridInternal;
  }
  sortByCurrentColumn() {
    this.sortHandler();
  }
  sortHandler() {
    const columnId = this.dataGridInternal.sortColumnId();
    this.networkLogView.removeAllNodeHighlights();
    this.waterfallRequestsAreStale = true;
    if (columnId === "waterfall") {
      if (this.dataGridInternal.sortOrder() === DataGrid.DataGrid.Order.Ascending) {
        this.waterfallColumnSortIcon.setIconType("smallicon-triangle-up");
      } else {
        this.waterfallColumnSortIcon.setIconType("smallicon-triangle-down");
      }
      const sortFunction = NetworkRequestNode.RequestPropertyComparator.bind(null, this.activeWaterfallSortId);
      this.dataGridInternal.sortNodes(sortFunction, !this.dataGridInternal.isSortOrderAscending());
      this.dataGridSortedForTest();
      return;
    }
    this.waterfallColumnSortIcon.setIconType("");
    const columnConfig = this.columns.find((columnConfig2) => columnConfig2.id === columnId);
    if (!columnConfig || !columnConfig.sortingFunction) {
      return;
    }
    const sortingFunction = columnConfig.sortingFunction;
    if (!sortingFunction) {
      return;
    }
    this.dataGridInternal.sortNodes(sortingFunction, !this.dataGridInternal.isSortOrderAscending());
    this.dataGridSortedForTest();
  }
  dataGridSortedForTest() {
  }
  updateColumns() {
    if (!this.dataGridInternal) {
      return;
    }
    const visibleColumns = /* @__PURE__ */ new Set();
    if (this.gridMode) {
      for (const columnConfig of this.columns) {
        if (columnConfig.visible) {
          visibleColumns.add(columnConfig.id);
        }
      }
    } else {
      const visibleColumn = this.columns.find((c) => c.hideableGroup === "path" && c.visible);
      if (visibleColumn) {
        visibleColumns.add(visibleColumn.id);
      } else {
        visibleColumns.add("name");
      }
    }
    this.dataGridInternal.setColumnsVisiblity(visibleColumns);
  }
  switchViewMode(gridMode) {
    if (this.gridMode === gridMode) {
      return;
    }
    this.gridMode = gridMode;
    if (gridMode) {
      this.splitWidget.showBoth();
      this.activeScroller = this.waterfallScroller;
      this.waterfallScroller.scrollTop = this.dataGridScroller.scrollTop;
      this.dataGridInternal.setScrollContainer(this.waterfallScroller);
    } else {
      this.networkLogView.removeAllNodeHighlights();
      this.splitWidget.hideSidebar();
      this.activeScroller = this.dataGridScroller;
      this.dataGridInternal.setScrollContainer(this.dataGridScroller);
    }
    this.networkLogView.element.classList.toggle("brief-mode", !gridMode);
    this.updateColumns();
    this.updateRowsSize();
  }
  toggleColumnVisibility(columnConfig) {
    this.loadCustomColumnsAndSettings();
    columnConfig.visible = !columnConfig.visible;
    this.saveColumnsSettings();
    this.updateColumns();
  }
  saveColumnsSettings() {
    const saveableSettings = {};
    for (const columnConfig of this.columns) {
      saveableSettings[columnConfig.id] = { visible: columnConfig.visible, title: columnConfig.title };
    }
    this.persistantSettings.set(saveableSettings);
  }
  loadCustomColumnsAndSettings() {
    const savedSettings = this.persistantSettings.get();
    const columnIds = Object.keys(savedSettings);
    for (const columnId of columnIds) {
      const setting = savedSettings[columnId];
      let columnConfig = this.columns.find((columnConfig2) => columnConfig2.id === columnId);
      if (!columnConfig) {
        columnConfig = this.addCustomHeader(setting.title, columnId) || void 0;
      }
      if (columnConfig && columnConfig.hideable && typeof setting.visible === "boolean") {
        columnConfig.visible = Boolean(setting.visible);
      }
      if (columnConfig && typeof setting.title === "string") {
        columnConfig.title = setting.title;
      }
    }
  }
  makeHeaderFragment(title, subtitle) {
    const fragment = document.createDocumentFragment();
    UI.UIUtils.createTextChild(fragment, title);
    const subtitleDiv = fragment.createChild("div", "network-header-subtitle");
    UI.UIUtils.createTextChild(subtitleDiv, subtitle);
    return fragment;
  }
  innerHeaderContextMenu(contextMenu) {
    const columnConfigs = this.columns.filter((columnConfig) => columnConfig.hideable);
    const nonResponseHeaders = columnConfigs.filter((columnConfig) => !columnConfig.isResponseHeader);
    const hideableGroups = /* @__PURE__ */ new Map();
    const nonResponseHeadersWithoutGroup = [];
    for (const columnConfig of nonResponseHeaders) {
      if (!columnConfig.hideableGroup) {
        nonResponseHeadersWithoutGroup.push(columnConfig);
      } else {
        const name = columnConfig.hideableGroup;
        let hideableGroup = hideableGroups.get(name);
        if (!hideableGroup) {
          hideableGroup = [];
          hideableGroups.set(name, hideableGroup);
        }
        hideableGroup.push(columnConfig);
      }
    }
    for (const group of hideableGroups.values()) {
      const visibleColumns = group.filter((columnConfig) => columnConfig.visible);
      for (const columnConfig of group) {
        const isDisabled = visibleColumns.length === 1 && visibleColumns[0] === columnConfig;
        const title = columnConfig.title instanceof Function ? columnConfig.title() : columnConfig.title;
        contextMenu.headerSection().appendCheckboxItem(title, this.toggleColumnVisibility.bind(this, columnConfig), columnConfig.visible, isDisabled);
      }
      contextMenu.headerSection().appendSeparator();
    }
    for (const columnConfig of nonResponseHeadersWithoutGroup) {
      const title = columnConfig.title instanceof Function ? columnConfig.title() : columnConfig.title;
      contextMenu.headerSection().appendCheckboxItem(title, this.toggleColumnVisibility.bind(this, columnConfig), columnConfig.visible);
    }
    const responseSubMenu = contextMenu.footerSection().appendSubMenuItem(i18nString(UIStrings.responseHeaders));
    const responseHeaders = columnConfigs.filter((columnConfig) => columnConfig.isResponseHeader);
    for (const columnConfig of responseHeaders) {
      const title = columnConfig.title instanceof Function ? columnConfig.title() : columnConfig.title;
      responseSubMenu.defaultSection().appendCheckboxItem(title, this.toggleColumnVisibility.bind(this, columnConfig), columnConfig.visible);
    }
    responseSubMenu.footerSection().appendItem(i18nString(UIStrings.manageHeaderColumns), this.manageCustomHeaderDialog.bind(this));
    const waterfallSortIds = WaterfallSortIds;
    const waterfallSubMenu = contextMenu.footerSection().appendSubMenuItem(i18nString(UIStrings.waterfall));
    waterfallSubMenu.defaultSection().appendCheckboxItem(i18nString(UIStrings.startTime), setWaterfallMode.bind(this, waterfallSortIds.StartTime), this.activeWaterfallSortId === waterfallSortIds.StartTime);
    waterfallSubMenu.defaultSection().appendCheckboxItem(i18nString(UIStrings.responseTime), setWaterfallMode.bind(this, waterfallSortIds.ResponseTime), this.activeWaterfallSortId === waterfallSortIds.ResponseTime);
    waterfallSubMenu.defaultSection().appendCheckboxItem(i18nString(UIStrings.endTime), setWaterfallMode.bind(this, waterfallSortIds.EndTime), this.activeWaterfallSortId === waterfallSortIds.EndTime);
    waterfallSubMenu.defaultSection().appendCheckboxItem(i18nString(UIStrings.totalDuration), setWaterfallMode.bind(this, waterfallSortIds.Duration), this.activeWaterfallSortId === waterfallSortIds.Duration);
    waterfallSubMenu.defaultSection().appendCheckboxItem(i18nString(UIStrings.latency), setWaterfallMode.bind(this, waterfallSortIds.Latency), this.activeWaterfallSortId === waterfallSortIds.Latency);
    function setWaterfallMode(sortId) {
      let calculator = this.calculatorsMap.get(_calculatorTypes.Time);
      const waterfallSortIds2 = WaterfallSortIds;
      if (sortId === waterfallSortIds2.Duration || sortId === waterfallSortIds2.Latency) {
        calculator = this.calculatorsMap.get(_calculatorTypes.Duration);
      }
      this.networkLogView.setCalculator(calculator);
      this.activeWaterfallSortId = sortId;
      this.dataGridInternal.markColumnAsSortedBy("waterfall", DataGrid.DataGrid.Order.Ascending);
      this.sortHandler();
    }
  }
  manageCustomHeaderDialog() {
    const customHeaders = [];
    for (const columnConfig of this.columns) {
      const title = columnConfig.title instanceof Function ? columnConfig.title() : columnConfig.title;
      if (columnConfig.isResponseHeader) {
        customHeaders.push({ title, editable: columnConfig.isCustomHeader });
      }
    }
    const manageCustomHeaders = new NetworkManageCustomHeadersView(customHeaders, (headerTitle) => Boolean(this.addCustomHeader(headerTitle)), this.changeCustomHeader.bind(this), this.removeCustomHeader.bind(this));
    const dialog = new UI.Dialog.Dialog();
    manageCustomHeaders.show(dialog.contentElement);
    dialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MeasureContent);
    dialog.show(this.networkLogView.element);
  }
  removeCustomHeader(headerId) {
    headerId = headerId.toLowerCase();
    const index = this.columns.findIndex((columnConfig) => columnConfig.id === headerId);
    if (index === -1) {
      return false;
    }
    this.columns.splice(index, 1);
    this.dataGridInternal.removeColumn(headerId);
    this.saveColumnsSettings();
    this.updateColumns();
    return true;
  }
  addCustomHeader(headerTitle, headerId, index) {
    if (!headerId) {
      headerId = headerTitle.toLowerCase();
    }
    if (index === void 0) {
      index = this.columns.length - 1;
    }
    const currentColumnConfig = this.columns.find((columnConfig2) => columnConfig2.id === headerId);
    if (currentColumnConfig) {
      return null;
    }
    const columnConfigBase = Object.assign({}, _defaultColumnConfig, {
      id: headerId,
      title: headerTitle,
      isResponseHeader: true,
      isCustomHeader: true,
      visible: true,
      sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, headerId)
    });
    const columnConfig = columnConfigBase;
    this.columns.splice(index, 0, columnConfig);
    if (this.dataGridInternal) {
      this.dataGridInternal.addColumn(NetworkLogViewColumns.convertToDataGridDescriptor(columnConfig), index);
    }
    this.saveColumnsSettings();
    this.updateColumns();
    return columnConfig;
  }
  changeCustomHeader(oldHeaderId, newHeaderTitle, newHeaderId) {
    if (!newHeaderId) {
      newHeaderId = newHeaderTitle.toLowerCase();
    }
    oldHeaderId = oldHeaderId.toLowerCase();
    const oldIndex = this.columns.findIndex((columnConfig) => columnConfig.id === oldHeaderId);
    const oldColumnConfig = this.columns[oldIndex];
    const currentColumnConfig = this.columns.find((columnConfig) => columnConfig.id === newHeaderId);
    if (!oldColumnConfig || currentColumnConfig && oldHeaderId !== newHeaderId) {
      return false;
    }
    this.removeCustomHeader(oldHeaderId);
    this.addCustomHeader(newHeaderTitle, newHeaderId, oldIndex);
    return true;
  }
  getPopoverRequest(event) {
    if (!this.gridMode) {
      return null;
    }
    const hoveredNode = this.networkLogView.hoveredNode();
    if (!hoveredNode || !event.target) {
      return null;
    }
    const anchor = event.target.enclosingNodeOrSelfWithClass("network-script-initiated");
    if (!anchor) {
      return null;
    }
    const request = hoveredNode.request();
    if (!request) {
      return null;
    }
    return {
      box: anchor.boxInWindow(),
      show: async (popover) => {
        this.popupLinkifier.setLiveLocationUpdateCallback(() => {
          popover.setSizeBehavior(UI.GlassPane.SizeBehavior.MeasureContent);
        });
        const content = RequestInitiatorView.createStackTracePreview(request, this.popupLinkifier, false);
        if (!content) {
          return false;
        }
        popover.contentElement.appendChild(content.element);
        return true;
      },
      hide: this.popupLinkifier.reset.bind(this.popupLinkifier)
    };
  }
  addEventDividers(times, className) {
    let color = "transparent";
    switch (className) {
      case "network-dcl-divider":
        color = "#0867CB";
        break;
      case "network-load-divider":
        color = "#B31412";
        break;
      default:
        return;
    }
    const currentTimes = this.eventDividers.get(color) || [];
    this.eventDividers.set(color, currentTimes.concat(times));
    this.networkLogView.scheduleRefresh();
  }
  hideEventDividers() {
    this.eventDividersShown = true;
    this.redrawWaterfallColumn();
  }
  showEventDividers() {
    this.eventDividersShown = false;
    this.redrawWaterfallColumn();
  }
  selectFilmStripFrame(time) {
    this.eventDividers.set(_filmStripDividerColor, [time]);
    this.redrawWaterfallColumn();
  }
  clearFilmStripFrame() {
    this.eventDividers.delete(_filmStripDividerColor);
    this.redrawWaterfallColumn();
  }
}
export const _initialSortColumn = "waterfall";
export var _calculatorTypes = /* @__PURE__ */ ((_calculatorTypes2) => {
  _calculatorTypes2["Duration"] = "Duration";
  _calculatorTypes2["Time"] = "Time";
  return _calculatorTypes2;
})(_calculatorTypes || {});
export const _defaultColumnConfig = {
  subtitle: null,
  visible: false,
  weight: 6,
  sortable: true,
  hideable: true,
  hideableGroup: null,
  nonSelectable: false,
  isResponseHeader: false,
  isCustomHeader: false,
  allowInSortByEvenWhenHidden: false
};
const _temporaryDefaultColumns = [
  {
    id: "name",
    title: i18nLazyString(UIStrings.name),
    subtitle: i18nLazyString(UIStrings.path),
    visible: true,
    weight: 20,
    hideable: true,
    hideableGroup: "path",
    sortingFunction: NetworkRequestNode.NameComparator
  },
  {
    id: "path",
    title: i18nLazyString(UIStrings.path),
    hideable: true,
    hideableGroup: "path",
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "pathname")
  },
  {
    id: "url",
    title: i18nLazyString(UIStrings.url),
    hideable: true,
    hideableGroup: "path",
    sortingFunction: NetworkRequestNode.RequestURLComparator
  },
  {
    id: "method",
    title: i18nLazyString(UIStrings.method),
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "requestMethod")
  },
  {
    id: "status",
    title: i18nLazyString(UIStrings.status),
    visible: true,
    subtitle: i18nLazyString(UIStrings.text),
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "statusCode")
  },
  {
    id: "protocol",
    title: i18nLazyString(UIStrings.protocol),
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "protocol")
  },
  {
    id: "scheme",
    title: i18nLazyString(UIStrings.scheme),
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "scheme")
  },
  {
    id: "domain",
    title: i18nLazyString(UIStrings.domain),
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "domain")
  },
  {
    id: "remoteaddress",
    title: i18nLazyString(UIStrings.remoteAddress),
    weight: 10,
    align: DataGrid.DataGrid.Align.Right,
    sortingFunction: NetworkRequestNode.RemoteAddressComparator
  },
  {
    id: "remoteaddress-space",
    title: i18nLazyString(UIStrings.remoteAddressSpace),
    visible: false,
    weight: 10,
    sortingFunction: NetworkRequestNode.RemoteAddressSpaceComparator
  },
  {
    id: "type",
    title: i18nLazyString(UIStrings.type),
    visible: true,
    sortingFunction: NetworkRequestNode.TypeComparator
  },
  {
    id: "initiator",
    title: i18nLazyString(UIStrings.initiator),
    visible: true,
    weight: 10,
    sortingFunction: NetworkRequestNode.InitiatorComparator
  },
  {
    id: "initiator-address-space",
    title: i18nLazyString(UIStrings.initiatorAddressSpace),
    visible: false,
    weight: 10,
    sortingFunction: NetworkRequestNode.InitiatorAddressSpaceComparator
  },
  {
    id: "cookies",
    title: i18nLazyString(UIStrings.cookies),
    align: DataGrid.DataGrid.Align.Right,
    sortingFunction: NetworkRequestNode.RequestCookiesCountComparator
  },
  {
    id: "setcookies",
    title: i18nLazyString(UIStrings.setCookies),
    align: DataGrid.DataGrid.Align.Right,
    sortingFunction: NetworkRequestNode.ResponseCookiesCountComparator
  },
  {
    id: "size",
    title: i18nLazyString(UIStrings.size),
    visible: true,
    subtitle: i18nLazyString(UIStrings.content),
    align: DataGrid.DataGrid.Align.Right,
    sortingFunction: NetworkRequestNode.SizeComparator
  },
  {
    id: "time",
    title: i18nLazyString(UIStrings.time),
    visible: true,
    subtitle: i18nLazyString(UIStrings.latency),
    align: DataGrid.DataGrid.Align.Right,
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "duration")
  },
  { id: "priority", title: i18nLazyString(UIStrings.priority), sortingFunction: NetworkRequestNode.PriorityComparator },
  {
    id: "connectionid",
    title: i18nLazyString(UIStrings.connectionId),
    sortingFunction: NetworkRequestNode.RequestPropertyComparator.bind(null, "connectionId")
  },
  {
    id: "cache-control",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Cache-Control"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "cache-control")
  },
  {
    id: "connection",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Connection"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "connection")
  },
  {
    id: "content-encoding",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Content-Encoding"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "content-encoding")
  },
  {
    id: "content-length",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Content-Length"),
    align: DataGrid.DataGrid.Align.Right,
    sortingFunction: NetworkRequestNode.ResponseHeaderNumberComparator.bind(null, "content-length")
  },
  {
    id: "etag",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("ETag"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "etag")
  },
  {
    id: "keep-alive",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Keep-Alive"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "keep-alive")
  },
  {
    id: "last-modified",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Last-Modified"),
    sortingFunction: NetworkRequestNode.ResponseHeaderDateComparator.bind(null, "last-modified")
  },
  {
    id: "server",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Server"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "server")
  },
  {
    id: "vary",
    isResponseHeader: true,
    title: i18n.i18n.lockedLazyString("Vary"),
    sortingFunction: NetworkRequestNode.ResponseHeaderStringComparator.bind(null, "vary")
  },
  {
    id: "waterfall",
    title: i18nLazyString(UIStrings.waterfall),
    visible: false,
    hideable: false,
    allowInSortByEvenWhenHidden: true
  }
];
const _defaultColumns = _temporaryDefaultColumns;
export const _filmStripDividerColor = "#fccc49";
export var WaterfallSortIds = /* @__PURE__ */ ((WaterfallSortIds2) => {
  WaterfallSortIds2["StartTime"] = "startTime";
  WaterfallSortIds2["ResponseTime"] = "responseReceivedTime";
  WaterfallSortIds2["EndTime"] = "endTime";
  WaterfallSortIds2["Duration"] = "duration";
  WaterfallSortIds2["Latency"] = "latency";
  return WaterfallSortIds2;
})(WaterfallSortIds || {});
//# sourceMappingURL=NetworkLogViewColumns.js.map
