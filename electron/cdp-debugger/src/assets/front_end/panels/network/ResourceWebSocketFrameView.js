import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
import { BinaryResourceView } from "./BinaryResourceView.js";
import webSocketFrameViewStyles from "./webSocketFrameView.css.js";
const UIStrings = {
  data: "Data",
  length: "Length",
  time: "Time",
  webSocketFrame: "Web Socket Frame",
  clearAll: "Clear All",
  filter: "Filter",
  selectMessageToBrowseItsContent: "Select message to browse its content.",
  copyMessageD: "Copy message...",
  copyMessage: "Copy message",
  clearAllL: "Clear all",
  sOpcodeSMask: "{PH1} (Opcode {PH2}, mask)",
  sOpcodeS: "{PH1} (Opcode {PH2})",
  continuationFrame: "Continuation Frame",
  textMessage: "Text Message",
  binaryMessage: "Binary Message",
  connectionCloseMessage: "Connection Close Message",
  pingMessage: "Ping Message",
  pongMessage: "Pong Message",
  all: "All",
  send: "Send",
  receive: "Receive",
  na: "N/A",
  enterRegex: "Enter regex, for example: (web)?socket"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/ResourceWebSocketFrameView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class ResourceWebSocketFrameView extends UI.Widget.VBox {
  request;
  splitWidget;
  dataGrid;
  timeComparator;
  mainToolbar;
  clearAllButton;
  filterTypeCombobox;
  filterType;
  filterTextInput;
  filterRegex;
  frameEmptyWidget;
  selectedNode;
  currentSelectedNode;
  messageFilterSetting = Common.Settings.Settings.instance().createSetting("networkWebSocketMessageFilter", "");
  constructor(request) {
    super();
    this.element.classList.add("websocket-frame-view");
    this.request = request;
    this.splitWidget = new UI.SplitWidget.SplitWidget(false, true, "resourceWebSocketFrameSplitViewState");
    this.splitWidget.show(this.element);
    const columns = [
      { id: "data", title: i18nString(UIStrings.data), sortable: false, weight: 88 },
      {
        id: "length",
        title: i18nString(UIStrings.length),
        sortable: false,
        align: DataGrid.DataGrid.Align.Right,
        weight: 5
      },
      { id: "time", title: i18nString(UIStrings.time), sortable: true, weight: 7 }
    ];
    this.dataGrid = new DataGrid.SortableDataGrid.SortableDataGrid({
      displayName: i18nString(UIStrings.webSocketFrame),
      columns,
      editCallback: void 0,
      deleteCallback: void 0,
      refreshCallback: void 0
    });
    this.dataGrid.setRowContextMenuCallback(onRowContextMenu.bind(this));
    this.dataGrid.setStickToBottom(true);
    this.dataGrid.setCellClass("websocket-frame-view-td");
    this.timeComparator = ResourceWebSocketFrameNodeTimeComparator;
    this.dataGrid.sortNodes(this.timeComparator, false);
    this.dataGrid.markColumnAsSortedBy("time", DataGrid.DataGrid.Order.Ascending);
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SortingChanged, this.sortItems, this);
    this.dataGrid.setName("ResourceWebSocketFrameView");
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, (event) => {
      void this.onFrameSelected(event);
    }, this);
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.DeselectedNode, this.onFrameDeselected, this);
    this.mainToolbar = new UI.Toolbar.Toolbar("");
    this.clearAllButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.clearAll), "largeicon-clear");
    this.clearAllButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.clearFrames, this);
    this.mainToolbar.appendToolbarItem(this.clearAllButton);
    this.filterTypeCombobox = new UI.Toolbar.ToolbarComboBox(this.updateFilterSetting.bind(this), i18nString(UIStrings.filter));
    for (const filterItem of _filterTypes) {
      const option = this.filterTypeCombobox.createOption(filterItem.label(), filterItem.name);
      this.filterTypeCombobox.addOption(option);
    }
    this.mainToolbar.appendToolbarItem(this.filterTypeCombobox);
    this.filterType = null;
    const placeholder = i18nString(UIStrings.enterRegex);
    this.filterTextInput = new UI.Toolbar.ToolbarInput(placeholder, "", 0.4);
    this.filterTextInput.addEventListener(UI.Toolbar.ToolbarInput.Event.TextChanged, this.updateFilterSetting, this);
    const filter = this.messageFilterSetting.get();
    if (filter) {
      this.filterTextInput.setValue(filter);
    }
    this.filterRegex = null;
    this.mainToolbar.appendToolbarItem(this.filterTextInput);
    const mainContainer = new UI.Widget.VBox();
    mainContainer.element.appendChild(this.mainToolbar.element);
    this.dataGrid.asWidget().show(mainContainer.element);
    mainContainer.setMinimumSize(0, 72);
    this.splitWidget.setMainWidget(mainContainer);
    this.frameEmptyWidget = new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.selectMessageToBrowseItsContent));
    this.splitWidget.setSidebarWidget(this.frameEmptyWidget);
    this.selectedNode = null;
    if (filter) {
      this.applyFilter(filter);
    }
    function onRowContextMenu(contextMenu, genericNode) {
      const node = genericNode;
      const binaryView = node.binaryView();
      if (binaryView) {
        binaryView.addCopyToContextMenu(contextMenu, i18nString(UIStrings.copyMessageD));
      } else {
        contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyMessage), Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText.bind(Host.InspectorFrontendHost.InspectorFrontendHostInstance, node.data.data));
      }
      contextMenu.footerSection().appendItem(i18nString(UIStrings.clearAllL), this.clearFrames.bind(this));
    }
  }
  static opCodeDescription(opCode, mask) {
    const localizedDescription = opCodeDescriptions[opCode] || (() => "");
    if (mask) {
      return i18nString(UIStrings.sOpcodeSMask, { PH1: localizedDescription(), PH2: opCode });
    }
    return i18nString(UIStrings.sOpcodeS, { PH1: localizedDescription(), PH2: opCode });
  }
  wasShown() {
    this.refresh();
    this.registerCSSFiles([webSocketFrameViewStyles]);
    this.request.addEventListener(SDK.NetworkRequest.Events.WebsocketFrameAdded, this.frameAdded, this);
  }
  willHide() {
    this.request.removeEventListener(SDK.NetworkRequest.Events.WebsocketFrameAdded, this.frameAdded, this);
  }
  frameAdded(event) {
    const frame = event.data;
    if (!this.frameFilter(frame)) {
      return;
    }
    this.dataGrid.insertChild(new ResourceWebSocketFrameNode(this.request.url(), frame));
  }
  frameFilter(frame) {
    if (this.filterType && frame.type !== this.filterType) {
      return false;
    }
    return !this.filterRegex || this.filterRegex.test(frame.text);
  }
  clearFrames() {
    _clearFrameOffsets.set(this.request, this.request.frames().length);
    this.refresh();
  }
  updateFilterSetting() {
    const text = this.filterTextInput.value();
    this.messageFilterSetting.set(text);
    this.applyFilter(text);
  }
  applyFilter(text) {
    const type = this.filterTypeCombobox.selectedOption().value;
    this.filterRegex = text ? new RegExp(text, "i") : null;
    this.filterType = type === "all" ? null : type;
    this.refresh();
  }
  async onFrameSelected(event) {
    this.currentSelectedNode = event.data;
    const content = this.currentSelectedNode.dataText();
    const binaryView = this.currentSelectedNode.binaryView();
    if (binaryView) {
      this.splitWidget.setSidebarWidget(binaryView);
      return;
    }
    const jsonView = await SourceFrame.JSONView.JSONView.createView(content);
    if (jsonView) {
      this.splitWidget.setSidebarWidget(jsonView);
      return;
    }
    this.splitWidget.setSidebarWidget(new SourceFrame.ResourceSourceFrame.ResourceSourceFrame(TextUtils.StaticContentProvider.StaticContentProvider.fromString(this.request.url(), Common.ResourceType.resourceTypes.WebSocket, content), ""));
  }
  onFrameDeselected() {
    this.currentSelectedNode = null;
    this.splitWidget.setSidebarWidget(this.frameEmptyWidget);
  }
  refresh() {
    this.dataGrid.rootNode().removeChildren();
    const url = this.request.url();
    let frames = this.request.frames();
    const offset = _clearFrameOffsets.get(this.request) || 0;
    frames = frames.slice(offset);
    frames = frames.filter(this.frameFilter.bind(this));
    frames.forEach((frame) => this.dataGrid.insertChild(new ResourceWebSocketFrameNode(url, frame)));
  }
  sortItems() {
    this.dataGrid.sortNodes(this.timeComparator, !this.dataGrid.isSortOrderAscending());
  }
}
export var OpCodes = /* @__PURE__ */ ((OpCodes2) => {
  OpCodes2[OpCodes2["ContinuationFrame"] = 0] = "ContinuationFrame";
  OpCodes2[OpCodes2["TextFrame"] = 1] = "TextFrame";
  OpCodes2[OpCodes2["BinaryFrame"] = 2] = "BinaryFrame";
  OpCodes2[OpCodes2["ConnectionCloseFrame"] = 8] = "ConnectionCloseFrame";
  OpCodes2[OpCodes2["PingFrame"] = 9] = "PingFrame";
  OpCodes2[OpCodes2["PongFrame"] = 10] = "PongFrame";
  return OpCodes2;
})(OpCodes || {});
export const opCodeDescriptions = function() {
  const opCodes = OpCodes;
  const map = [];
  map[opCodes.ContinuationFrame] = i18nLazyString(UIStrings.continuationFrame);
  map[opCodes.TextFrame] = i18nLazyString(UIStrings.textMessage);
  map[opCodes.BinaryFrame] = i18nLazyString(UIStrings.binaryMessage);
  map[opCodes.ConnectionCloseFrame] = i18nLazyString(UIStrings.connectionCloseMessage);
  map[opCodes.PingFrame] = i18nLazyString(UIStrings.pingMessage);
  map[opCodes.PongFrame] = i18nLazyString(UIStrings.pongMessage);
  return map;
}();
export const _filterTypes = [
  { name: "all", label: i18nLazyString(UIStrings.all), title: void 0 },
  { name: "send", label: i18nLazyString(UIStrings.send), title: void 0 },
  { name: "receive", label: i18nLazyString(UIStrings.receive), title: void 0 }
];
export class ResourceWebSocketFrameNode extends DataGrid.SortableDataGrid.SortableDataGridNode {
  url;
  frame;
  isTextFrame;
  dataTextInternal;
  binaryViewInternal;
  constructor(url, frame) {
    let length = String(frame.text.length);
    const time = new Date(frame.time * 1e3);
    const timeText = ("0" + time.getHours()).substr(-2) + ":" + ("0" + time.getMinutes()).substr(-2) + ":" + ("0" + time.getSeconds()).substr(-2) + "." + ("00" + time.getMilliseconds()).substr(-3);
    const timeNode = document.createElement("div");
    UI.UIUtils.createTextChild(timeNode, timeText);
    UI.Tooltip.Tooltip.install(timeNode, time.toLocaleString());
    let dataText = frame.text;
    let description = ResourceWebSocketFrameView.opCodeDescription(frame.opCode, frame.mask);
    const isTextFrame = frame.opCode === 1 /* TextFrame */;
    if (frame.type === SDK.NetworkRequest.WebSocketFrameType.Error) {
      description = dataText;
      length = i18nString(UIStrings.na);
    } else if (isTextFrame) {
      description = dataText;
    } else if (frame.opCode === 2 /* BinaryFrame */) {
      length = Platform.NumberUtilities.bytesToString(Platform.StringUtilities.base64ToSize(frame.text));
      description = opCodeDescriptions[frame.opCode]();
    } else {
      dataText = description;
    }
    super({ data: description, length, time: timeNode });
    this.url = url;
    this.frame = frame;
    this.isTextFrame = isTextFrame;
    this.dataTextInternal = dataText;
    this.binaryViewInternal = null;
  }
  createCells(element) {
    element.classList.toggle("websocket-frame-view-row-error", this.frame.type === SDK.NetworkRequest.WebSocketFrameType.Error);
    element.classList.toggle("websocket-frame-view-row-send", this.frame.type === SDK.NetworkRequest.WebSocketFrameType.Send);
    element.classList.toggle("websocket-frame-view-row-receive", this.frame.type === SDK.NetworkRequest.WebSocketFrameType.Receive);
    super.createCells(element);
  }
  nodeSelfHeight() {
    return 21;
  }
  dataText() {
    return this.dataTextInternal;
  }
  opCode() {
    return this.frame.opCode;
  }
  binaryView() {
    if (this.isTextFrame || this.frame.type === SDK.NetworkRequest.WebSocketFrameType.Error) {
      return null;
    }
    if (!this.binaryViewInternal) {
      if (this.dataTextInternal.length > 0) {
        this.binaryViewInternal = new BinaryResourceView(this.dataTextInternal, Platform.DevToolsPath.EmptyUrlString, Common.ResourceType.resourceTypes.WebSocket);
      }
    }
    return this.binaryViewInternal;
  }
}
export function ResourceWebSocketFrameNodeTimeComparator(a, b) {
  return a.frame.time - b.frame.time;
}
const _clearFrameOffsets = /* @__PURE__ */ new WeakMap();
//# sourceMappingURL=ResourceWebSocketFrameView.js.map
