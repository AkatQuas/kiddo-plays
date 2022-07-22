import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as PerfUI from "../../ui/legacy/components/perf_ui/perf_ui.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import { BottomUpProfileDataGridTree } from "./BottomUpProfileDataGrid.js";
import { CPUProfileFlameChart } from "./CPUProfileFlameChart.js";
import { ProfileDataGridTree } from "./ProfileDataGrid.js";
import { Events, ProfileHeader } from "./ProfileHeader.js";
import { ProfileSidebarTreeElement } from "./ProfileSidebarTreeElement.js";
import { TopDownProfileDataGridTree } from "./TopDownProfileDataGrid.js";
const UIStrings = {
  profile: "Profile",
  findByCostMsNameOrFile: "Find by cost (>50ms), name or file",
  function: "Function",
  profiler: "Profiler",
  profileViewMode: "Profile view mode",
  focusSelectedFunction: "Focus selected function",
  excludeSelectedFunction: "Exclude selected function",
  restoreAllFunctions: "Restore all functions",
  chart: "Chart",
  heavyBottomUp: "Heavy (Bottom Up)",
  treeTopDown: "Tree (Top Down)",
  profileD: "Profile {PH1}",
  loadingD: "Loading\u2026 {PH1}%",
  fileSReadErrorS: "File ''{PH1}'' read error: {PH2}",
  loading: "Loading\u2026",
  failedToReadFile: "Failed to read file",
  parsing: "Parsing\u2026",
  loaded: "Loaded"
};
const str_ = i18n.i18n.registerUIStrings("panels/profiler/ProfileView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ProfileView extends UI.View.SimpleView {
  profileInternal;
  searchableViewInternal;
  dataGrid;
  viewSelectComboBox;
  focusButton;
  excludeButton;
  resetButton;
  linkifierInternal;
  nodeFormatter;
  viewType;
  adjustedTotal;
  profileHeader;
  bottomUpProfileDataGridTree;
  topDownProfileDataGridTree;
  currentSearchResultIndex;
  dataProvider;
  flameChart;
  visibleView;
  searchableElement;
  profileDataGridTree;
  constructor() {
    super(i18nString(UIStrings.profile));
    this.profileInternal = null;
    this.searchableViewInternal = new UI.SearchableView.SearchableView(this, null);
    this.searchableViewInternal.setPlaceholder(i18nString(UIStrings.findByCostMsNameOrFile));
    this.searchableViewInternal.show(this.element);
    const columns = [];
    columns.push({
      id: "self",
      title: this.columnHeader("self"),
      width: "120px",
      fixedWidth: true,
      sortable: true,
      sort: DataGrid.DataGrid.Order.Descending,
      titleDOMFragment: void 0,
      align: void 0,
      editable: void 0,
      nonSelectable: void 0,
      longText: void 0,
      disclosure: void 0,
      weight: void 0,
      allowInSortByEvenWhenHidden: void 0,
      dataType: void 0,
      defaultWeight: void 0
    });
    columns.push({
      id: "total",
      title: this.columnHeader("total"),
      width: "120px",
      fixedWidth: true,
      sortable: true,
      sort: void 0,
      titleDOMFragment: void 0,
      align: void 0,
      editable: void 0,
      nonSelectable: void 0,
      longText: void 0,
      disclosure: void 0,
      weight: void 0,
      allowInSortByEvenWhenHidden: void 0,
      dataType: void 0,
      defaultWeight: void 0
    });
    columns.push({
      id: "function",
      title: i18nString(UIStrings.function),
      disclosure: true,
      sortable: true,
      sort: void 0,
      titleDOMFragment: void 0,
      align: void 0,
      editable: void 0,
      nonSelectable: void 0,
      longText: void 0,
      weight: void 0,
      allowInSortByEvenWhenHidden: void 0,
      dataType: void 0,
      defaultWeight: void 0,
      width: void 0,
      fixedWidth: void 0
    });
    this.dataGrid = new DataGrid.DataGrid.DataGridImpl({
      displayName: i18nString(UIStrings.profiler),
      columns,
      editCallback: void 0,
      deleteCallback: void 0,
      refreshCallback: void 0
    });
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SortingChanged, this.sortProfile, this);
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, this.nodeSelected.bind(this, true));
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.DeselectedNode, this.nodeSelected.bind(this, false));
    this.dataGrid.setRowContextMenuCallback(this.populateContextMenu.bind(this));
    this.viewSelectComboBox = new UI.Toolbar.ToolbarComboBox(this.changeView.bind(this), i18nString(UIStrings.profileViewMode));
    this.focusButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.focusSelectedFunction), "largeicon-visibility");
    this.focusButton.setEnabled(false);
    this.focusButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.focusClicked, this);
    this.excludeButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.excludeSelectedFunction), "largeicon-delete");
    this.excludeButton.setEnabled(false);
    this.excludeButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.excludeClicked, this);
    this.resetButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.restoreAllFunctions), "largeicon-refresh");
    this.resetButton.setEnabled(false);
    this.resetButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.resetClicked, this);
    this.linkifierInternal = new Components.Linkifier.Linkifier(maxLinkLength);
  }
  static buildPopoverTable(entryInfo) {
    const table = document.createElement("table");
    for (const entry of entryInfo) {
      const row = table.createChild("tr");
      row.createChild("td").textContent = entry.title;
      row.createChild("td").textContent = entry.value;
    }
    return table;
  }
  setProfile(profile) {
    this.profileInternal = profile;
    this.bottomUpProfileDataGridTree = null;
    this.topDownProfileDataGridTree = null;
    this.changeView();
    this.refresh();
  }
  profile() {
    return this.profileInternal;
  }
  initialize(nodeFormatter) {
    this.nodeFormatter = nodeFormatter;
    this.viewType = Common.Settings.Settings.instance().createSetting("profileView", ViewTypes.Heavy);
    const viewTypes = [ViewTypes.Flame, ViewTypes.Heavy, ViewTypes.Tree];
    const optionNames = /* @__PURE__ */ new Map([
      [ViewTypes.Flame, i18nString(UIStrings.chart)],
      [ViewTypes.Heavy, i18nString(UIStrings.heavyBottomUp)],
      [ViewTypes.Tree, i18nString(UIStrings.treeTopDown)]
    ]);
    const options = new Map(viewTypes.map((type) => [type, this.viewSelectComboBox.createOption(optionNames.get(type), type)]));
    const optionName = this.viewType.get() || viewTypes[0];
    const option = options.get(optionName) || options.get(viewTypes[0]);
    this.viewSelectComboBox.select(option);
    this.changeView();
    if (this.flameChart) {
      this.flameChart.update();
    }
  }
  focus() {
    if (this.flameChart) {
      this.flameChart.focus();
    } else {
      super.focus();
    }
  }
  columnHeader(_columnId) {
    throw "Not implemented";
  }
  selectRange(timeLeft, timeRight) {
    if (!this.flameChart) {
      return;
    }
    this.flameChart.selectRange(timeLeft, timeRight);
  }
  async toolbarItems() {
    return [this.viewSelectComboBox, this.focusButton, this.excludeButton, this.resetButton];
  }
  getBottomUpProfileDataGridTree() {
    if (!this.bottomUpProfileDataGridTree) {
      this.bottomUpProfileDataGridTree = new BottomUpProfileDataGridTree(this.nodeFormatter, this.searchableViewInternal, this.profileInternal.root, this.adjustedTotal);
    }
    return this.bottomUpProfileDataGridTree;
  }
  getTopDownProfileDataGridTree() {
    if (!this.topDownProfileDataGridTree) {
      this.topDownProfileDataGridTree = new TopDownProfileDataGridTree(this.nodeFormatter, this.searchableViewInternal, this.profileInternal.root, this.adjustedTotal);
    }
    return this.topDownProfileDataGridTree;
  }
  populateContextMenu(contextMenu, gridNode) {
    const node = gridNode;
    if (node.linkElement && !contextMenu.containsTarget(node.linkElement)) {
      contextMenu.appendApplicableItems(node.linkElement);
    }
  }
  willHide() {
    this.currentSearchResultIndex = -1;
  }
  refresh() {
    if (!this.profileDataGridTree) {
      return;
    }
    const selectedProfileNode = this.dataGrid.selectedNode ? this.dataGrid.selectedNode.profileNode : null;
    this.dataGrid.rootNode().removeChildren();
    const children = this.profileDataGridTree.children;
    const count = children.length;
    for (let index = 0; index < count; ++index) {
      this.dataGrid.rootNode().appendChild(children[index]);
    }
    if (selectedProfileNode) {
      selectedProfileNode.selected = true;
    }
  }
  refreshVisibleData() {
    let child = this.dataGrid.rootNode().children[0];
    while (child) {
      child.refresh();
      child = child.traverseNextNode(false, null, true);
    }
  }
  searchableView() {
    return this.searchableViewInternal;
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return false;
  }
  searchCanceled() {
    if (this.searchableElement) {
      this.searchableElement.searchCanceled();
    }
  }
  performSearch(searchConfig, shouldJump, jumpBackwards) {
    if (this.searchableElement) {
      this.searchableElement.performSearch(searchConfig, shouldJump, jumpBackwards);
    }
  }
  jumpToNextSearchResult() {
    if (this.searchableElement) {
      this.searchableElement.jumpToNextSearchResult();
    }
  }
  jumpToPreviousSearchResult() {
    if (this.searchableElement) {
      this.searchableElement.jumpToPreviousSearchResult();
    }
  }
  linkifier() {
    return this.linkifierInternal;
  }
  createFlameChartDataProvider() {
    throw "Not implemented";
  }
  ensureFlameChartCreated() {
    if (this.flameChart) {
      return;
    }
    this.dataProvider = this.createFlameChartDataProvider();
    this.flameChart = new CPUProfileFlameChart(this.searchableViewInternal, this.dataProvider);
    this.flameChart.addEventListener(PerfUI.FlameChart.Events.EntryInvoked, (event) => {
      void this.onEntryInvoked(event);
    });
  }
  async onEntryInvoked(event) {
    if (!this.dataProvider) {
      return;
    }
    const entryIndex = event.data;
    const node = this.dataProvider.entryNodes[entryIndex];
    const debuggerModel = this.profileHeader.debuggerModel;
    if (!node || !node.scriptId || !debuggerModel) {
      return;
    }
    const script = debuggerModel.scriptForId(node.scriptId);
    if (!script) {
      return;
    }
    const location = debuggerModel.createRawLocation(script, node.lineNumber, node.columnNumber);
    const uiLocation = await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(location);
    void Common.Revealer.reveal(uiLocation);
  }
  changeView() {
    if (!this.profileInternal) {
      return;
    }
    this.searchableViewInternal.closeSearch();
    if (this.visibleView) {
      this.visibleView.detach();
    }
    this.viewType.set(this.viewSelectComboBox.selectedOption().value);
    switch (this.viewType.get()) {
      case ViewTypes.Flame:
        this.ensureFlameChartCreated();
        this.visibleView = this.flameChart;
        this.searchableElement = this.flameChart;
        break;
      case ViewTypes.Tree:
        this.profileDataGridTree = this.getTopDownProfileDataGridTree();
        this.sortProfile();
        this.visibleView = this.dataGrid.asWidget();
        this.searchableElement = this.profileDataGridTree;
        break;
      case ViewTypes.Heavy:
        this.profileDataGridTree = this.getBottomUpProfileDataGridTree();
        this.sortProfile();
        this.visibleView = this.dataGrid.asWidget();
        this.searchableElement = this.profileDataGridTree;
        break;
    }
    const isFlame = this.viewType.get() === ViewTypes.Flame;
    this.focusButton.setVisible(!isFlame);
    this.excludeButton.setVisible(!isFlame);
    this.resetButton.setVisible(!isFlame);
    if (this.visibleView) {
      this.visibleView.show(this.searchableViewInternal.element);
    }
  }
  nodeSelected(selected) {
    this.focusButton.setEnabled(selected);
    this.excludeButton.setEnabled(selected);
  }
  focusClicked() {
    if (!this.dataGrid.selectedNode) {
      return;
    }
    this.resetButton.setEnabled(true);
    this.resetButton.element.focus();
    if (this.profileDataGridTree) {
      this.profileDataGridTree.focus(this.dataGrid.selectedNode);
    }
    this.refresh();
    this.refreshVisibleData();
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.CpuProfileNodeFocused);
  }
  excludeClicked() {
    const selectedNode = this.dataGrid.selectedNode;
    if (!selectedNode) {
      return;
    }
    this.resetButton.setEnabled(true);
    this.resetButton.element.focus();
    selectedNode.deselect();
    if (this.profileDataGridTree) {
      this.profileDataGridTree.exclude(selectedNode);
    }
    this.refresh();
    this.refreshVisibleData();
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.CpuProfileNodeExcluded);
  }
  resetClicked() {
    this.viewSelectComboBox.selectElement().focus();
    this.resetButton.setEnabled(false);
    if (this.profileDataGridTree) {
      this.profileDataGridTree.restore();
    }
    this.linkifierInternal.reset();
    this.refresh();
    this.refreshVisibleData();
  }
  sortProfile() {
    if (!this.profileDataGridTree) {
      return;
    }
    const sortAscending = this.dataGrid.isSortOrderAscending();
    const sortColumnId = this.dataGrid.sortColumnId();
    const sortProperty = sortColumnId === "function" ? "functionName" : sortColumnId || "";
    this.profileDataGridTree.sort(ProfileDataGridTree.propertyComparator(sortProperty, sortAscending), false);
    this.refresh();
  }
}
export const maxLinkLength = 30;
export var ViewTypes = /* @__PURE__ */ ((ViewTypes2) => {
  ViewTypes2["Flame"] = "Flame";
  ViewTypes2["Tree"] = "Tree";
  ViewTypes2["Heavy"] = "Heavy";
  return ViewTypes2;
})(ViewTypes || {});
export class WritableProfileHeader extends ProfileHeader {
  debuggerModel;
  fileName;
  jsonifiedProfile;
  profile;
  protocolProfileInternal;
  constructor(debuggerModel, type, title) {
    super(type, title || i18nString(UIStrings.profileD, { PH1: type.nextProfileUid() }));
    this.debuggerModel = debuggerModel;
  }
  onChunkTransferred(_reader) {
    if (this.jsonifiedProfile) {
      this.updateStatus(i18nString(UIStrings.loadingD, { PH1: Platform.NumberUtilities.bytesToString(this.jsonifiedProfile.length) }));
    }
  }
  onError(reader) {
    const error = reader.error();
    if (error) {
      this.updateStatus(i18nString(UIStrings.fileSReadErrorS, { PH1: reader.fileName(), PH2: error.message }));
    }
  }
  async write(text) {
    this.jsonifiedProfile += text;
  }
  async close() {
  }
  dispose() {
    this.removeTempFile();
  }
  createSidebarTreeElement(panel) {
    return new ProfileSidebarTreeElement(panel, this, "profile-sidebar-tree-item");
  }
  canSaveToFile() {
    return !this.fromFile() && Boolean(this.protocolProfileInternal);
  }
  async saveToFile() {
    const fileOutputStream = new Bindings.FileUtils.FileOutputStream();
    if (!this.fileName) {
      const now = Platform.DateUtilities.toISO8601Compact(new Date());
      const fileExtension = this.profileType().fileExtension();
      this.fileName = `${this.profileType().typeName()}-${now}${fileExtension}`;
    }
    const accepted = await fileOutputStream.open(this.fileName);
    if (!accepted || !this.tempFile) {
      return;
    }
    const data = await this.tempFile.read();
    if (data) {
      await fileOutputStream.write(data);
    }
    void fileOutputStream.close();
  }
  async loadFromFile(file) {
    this.updateStatus(i18nString(UIStrings.loading), true);
    const fileReader = new Bindings.FileUtils.ChunkedFileReader(file, 1e7, this.onChunkTransferred.bind(this));
    this.jsonifiedProfile = "";
    const success = await fileReader.read(this);
    if (!success) {
      this.onError(fileReader);
      return new Error(i18nString(UIStrings.failedToReadFile));
    }
    this.updateStatus(i18nString(UIStrings.parsing), true);
    let error = null;
    try {
      this.profile = JSON.parse(this.jsonifiedProfile);
      this.setProfile(this.profile);
      this.updateStatus(i18nString(UIStrings.loaded), false);
    } catch (e) {
      error = e;
      this.profileType().removeProfile(this);
    }
    this.jsonifiedProfile = null;
    if (this.profileType().profileBeingRecorded() === this) {
      this.profileType().setProfileBeingRecorded(null);
    }
    return error;
  }
  setProtocolProfile(profile) {
    this.setProfile(profile);
    this.protocolProfileInternal = profile;
    this.tempFile = new Bindings.TempFile.TempFile();
    this.tempFile.write([JSON.stringify(profile)]);
    if (this.canSaveToFile()) {
      this.dispatchEventToListeners(Events.ProfileReceived);
    }
  }
}
//# sourceMappingURL=ProfileView.js.map
