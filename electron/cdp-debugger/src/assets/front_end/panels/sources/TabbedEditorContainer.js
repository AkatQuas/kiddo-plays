import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Extensions from "../../models/extensions/extensions.js";
import * as Persistence from "../../models/persistence/persistence.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Snippets from "../snippets/snippets.js";
import { SourcesView } from "./SourcesView.js";
import { UISourceCodeFrame } from "./UISourceCodeFrame.js";
const UIStrings = {
  areYouSureYouWantToCloseUnsaved: "Are you sure you want to close unsaved file: {PH1}?",
  unableToLoadThisContent: "Unable to load this content.",
  changesToThisFileWereNotSavedTo: "Changes to this file were not saved to file system."
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/TabbedEditorContainer.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TabbedEditorContainer extends Common.ObjectWrapper.ObjectWrapper {
  delegate;
  tabbedPane;
  tabIds;
  files;
  previouslyViewedFilesSetting;
  history;
  uriToUISourceCode;
  idToUISourceCode;
  currentFileInternal;
  currentView;
  scrollTimer;
  constructor(delegate, setting, placeholderElement, focusedPlaceholderElement) {
    super();
    this.delegate = delegate;
    this.tabbedPane = new UI.TabbedPane.TabbedPane();
    this.tabbedPane.setPlaceholderElement(placeholderElement, focusedPlaceholderElement);
    this.tabbedPane.setTabDelegate(new EditorContainerTabDelegate(this));
    this.tabbedPane.setCloseableTabs(true);
    this.tabbedPane.setAllowTabReorder(true, true);
    this.tabbedPane.addEventListener(UI.TabbedPane.Events.TabClosed, this.tabClosed, this);
    this.tabbedPane.addEventListener(UI.TabbedPane.Events.TabSelected, this.tabSelected, this);
    Persistence.Persistence.PersistenceImpl.instance().addEventListener(Persistence.Persistence.Events.BindingCreated, this.onBindingCreated, this);
    Persistence.Persistence.PersistenceImpl.instance().addEventListener(Persistence.Persistence.Events.BindingRemoved, this.onBindingRemoved, this);
    this.tabIds = /* @__PURE__ */ new Map();
    this.files = /* @__PURE__ */ new Map();
    this.previouslyViewedFilesSetting = setting;
    this.history = History.fromObject(this.previouslyViewedFilesSetting.get());
    this.uriToUISourceCode = /* @__PURE__ */ new Map();
    this.idToUISourceCode = /* @__PURE__ */ new Map();
  }
  onBindingCreated(event) {
    const binding = event.data;
    this.updateFileTitle(binding.fileSystem);
    const networkTabId = this.tabIds.get(binding.network);
    let fileSystemTabId = this.tabIds.get(binding.fileSystem);
    const wasSelectedInNetwork = this.currentFileInternal === binding.network;
    const currentSelectionRange = this.history.selectionRange(binding.network.url());
    const currentScrollLineNumber = this.history.scrollLineNumber(binding.network.url());
    this.history.remove(binding.network.url());
    if (!networkTabId) {
      return;
    }
    if (!fileSystemTabId) {
      const networkView = this.tabbedPane.tabView(networkTabId);
      const tabIndex = this.tabbedPane.tabIndex(networkTabId);
      if (networkView instanceof UISourceCodeFrame) {
        this.delegate.recycleUISourceCodeFrame(networkView, binding.fileSystem);
        fileSystemTabId = this.appendFileTab(binding.fileSystem, false, tabIndex, networkView);
      } else {
        fileSystemTabId = this.appendFileTab(binding.fileSystem, false, tabIndex);
        const fileSystemTabView = this.tabbedPane.tabView(fileSystemTabId);
        this.restoreEditorProperties(fileSystemTabView, currentSelectionRange, currentScrollLineNumber);
      }
    }
    this.closeTabs([networkTabId], true);
    if (wasSelectedInNetwork) {
      this.tabbedPane.selectTab(fileSystemTabId, false);
    }
    this.updateHistory();
  }
  onBindingRemoved(event) {
    const binding = event.data;
    this.updateFileTitle(binding.fileSystem);
  }
  get view() {
    return this.tabbedPane;
  }
  get visibleView() {
    return this.tabbedPane.visibleView;
  }
  fileViews() {
    return this.tabbedPane.tabViews();
  }
  leftToolbar() {
    return this.tabbedPane.leftToolbar();
  }
  rightToolbar() {
    return this.tabbedPane.rightToolbar();
  }
  show(parentElement) {
    this.tabbedPane.show(parentElement);
  }
  showFile(uiSourceCode) {
    const binding = Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode);
    uiSourceCode = binding ? binding.fileSystem : uiSourceCode;
    const frame = UI.Context.Context.instance().flavor(SourcesView);
    if (frame?.currentSourceFrame()?.contentSet && this.currentFileInternal === uiSourceCode && frame?.currentUISourceCode() === uiSourceCode) {
      Common.EventTarget.fireEvent("source-file-loaded", uiSourceCode.displayName(true));
    } else {
      this.innerShowFile(this.canonicalUISourceCode(uiSourceCode), true);
    }
  }
  closeFile(uiSourceCode) {
    const tabId2 = this.tabIds.get(uiSourceCode);
    if (!tabId2) {
      return;
    }
    this.closeTabs([tabId2]);
  }
  closeAllFiles() {
    this.closeTabs(this.tabbedPane.tabIds());
  }
  historyUISourceCodes() {
    const result = [];
    const uris = this.history.urls();
    for (const uri of uris) {
      const uiSourceCode = this.uriToUISourceCode.get(uri);
      if (uiSourceCode) {
        result.push(uiSourceCode);
      }
    }
    return result;
  }
  addViewListeners() {
    if (!this.currentView || !(this.currentView instanceof SourceFrame.SourceFrame.SourceFrameImpl)) {
      return;
    }
    this.currentView.addEventListener(SourceFrame.SourceFrame.Events.EditorUpdate, this.onEditorUpdate, this);
    this.currentView.addEventListener(SourceFrame.SourceFrame.Events.EditorScroll, this.onScrollChanged, this);
  }
  removeViewListeners() {
    if (!this.currentView || !(this.currentView instanceof SourceFrame.SourceFrame.SourceFrameImpl)) {
      return;
    }
    this.currentView.removeEventListener(SourceFrame.SourceFrame.Events.EditorUpdate, this.onEditorUpdate, this);
    this.currentView.removeEventListener(SourceFrame.SourceFrame.Events.EditorScroll, this.onScrollChanged, this);
  }
  onScrollChanged() {
    if (this.currentView instanceof SourceFrame.SourceFrame.SourceFrameImpl) {
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
      }
      this.scrollTimer = window.setTimeout(() => this.history.save(this.previouslyViewedFilesSetting), 100);
      if (this.currentFileInternal) {
        const { editor } = this.currentView.textEditor;
        const topBlock = editor.lineBlockAtHeight(editor.scrollDOM.getBoundingClientRect().top - editor.documentTop);
        const topLine = editor.state.doc.lineAt(topBlock.from).number - 1;
        this.history.updateScrollLineNumber(this.currentFileInternal.url(), topLine);
      }
    }
  }
  onEditorUpdate({ data: update }) {
    if (update.docChanged || update.selectionSet) {
      const { main } = update.state.selection;
      const lineFrom = update.state.doc.lineAt(main.from), lineTo = update.state.doc.lineAt(main.to);
      const range = new TextUtils.TextRange.TextRange(lineFrom.number - 1, main.from - lineFrom.from, lineTo.number - 1, main.to - lineTo.from);
      if (this.currentFileInternal) {
        this.history.updateSelectionRange(this.currentFileInternal.url(), range);
      }
      this.history.save(this.previouslyViewedFilesSetting);
      if (this.currentFileInternal) {
        Extensions.ExtensionServer.ExtensionServer.instance().sourceSelectionChanged(this.currentFileInternal.url(), range);
      }
    }
  }
  innerShowFile(uiSourceCode, userGesture) {
    const binding = Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode);
    uiSourceCode = binding ? binding.fileSystem : uiSourceCode;
    if (this.currentFileInternal === uiSourceCode) {
      return;
    }
    this.removeViewListeners();
    this.currentFileInternal = uiSourceCode;
    const tabId2 = this.tabIds.get(uiSourceCode) || this.appendFileTab(uiSourceCode, userGesture);
    this.tabbedPane.selectTab(tabId2, userGesture);
    if (userGesture) {
      this.editorSelectedByUserAction();
    }
    const previousView = this.currentView;
    this.currentView = this.visibleView;
    this.addViewListeners();
    const eventData = {
      currentFile: this.currentFileInternal,
      currentView: this.currentView,
      previousView,
      userGesture
    };
    this.dispatchEventToListeners(Events.EditorSelected, eventData);
  }
  titleForFile(uiSourceCode) {
    const maxDisplayNameLength = 30;
    let title = Platform.StringUtilities.trimMiddle(uiSourceCode.displayName(true), maxDisplayNameLength);
    if (uiSourceCode.isDirty()) {
      title += "*";
    }
    return title;
  }
  maybeCloseTab(id, nextTabId) {
    const uiSourceCode = this.files.get(id);
    if (!uiSourceCode) {
      return false;
    }
    const shouldPrompt = uiSourceCode.isDirty() && uiSourceCode.project().canSetFileContent();
    if (!shouldPrompt || confirm(i18nString(UIStrings.areYouSureYouWantToCloseUnsaved, { PH1: uiSourceCode.name() }))) {
      uiSourceCode.resetWorkingCopy();
      if (nextTabId) {
        this.tabbedPane.selectTab(nextTabId, true);
      }
      this.tabbedPane.closeTab(id, true);
      return true;
    }
    return false;
  }
  closeTabs(ids, forceCloseDirtyTabs) {
    const dirtyTabs = [];
    const cleanTabs = [];
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i];
      const uiSourceCode = this.files.get(id);
      if (uiSourceCode) {
        if (!forceCloseDirtyTabs && uiSourceCode.isDirty()) {
          dirtyTabs.push(id);
        } else {
          cleanTabs.push(id);
        }
      }
    }
    if (dirtyTabs.length) {
      this.tabbedPane.selectTab(dirtyTabs[0], true);
    }
    this.tabbedPane.closeTabs(cleanTabs, true);
    for (let i = 0; i < dirtyTabs.length; ++i) {
      const nextTabId = i + 1 < dirtyTabs.length ? dirtyTabs[i + 1] : null;
      if (!this.maybeCloseTab(dirtyTabs[i], nextTabId)) {
        break;
      }
    }
  }
  onContextMenu(tabId2, contextMenu) {
    const uiSourceCode = this.files.get(tabId2);
    if (uiSourceCode) {
      contextMenu.appendApplicableItems(uiSourceCode);
    }
  }
  canonicalUISourceCode(uiSourceCode) {
    const existingSourceCode = this.idToUISourceCode.get(uiSourceCode.canononicalScriptId());
    if (existingSourceCode) {
      return existingSourceCode;
    }
    this.idToUISourceCode.set(uiSourceCode.canononicalScriptId(), uiSourceCode);
    this.uriToUISourceCode.set(uiSourceCode.url(), uiSourceCode);
    return uiSourceCode;
  }
  addUISourceCode(uiSourceCode) {
    const canonicalSourceCode = this.canonicalUISourceCode(uiSourceCode);
    const duplicated = canonicalSourceCode !== uiSourceCode;
    const binding = Persistence.Persistence.PersistenceImpl.instance().binding(canonicalSourceCode);
    uiSourceCode = binding ? binding.fileSystem : canonicalSourceCode;
    if (duplicated && uiSourceCode.project().type() !== Workspace.Workspace.projectTypes.FileSystem) {
      uiSourceCode.disableEdit();
    }
    if (this.currentFileInternal === uiSourceCode) {
      return;
    }
    const uri = uiSourceCode.url();
    const index = this.history.index(uri);
    if (index === -1) {
      return;
    }
    if (!this.tabIds.has(uiSourceCode)) {
      this.appendFileTab(uiSourceCode, false);
    }
    if (!index) {
      this.innerShowFile(uiSourceCode, false);
      return;
    }
    if (!this.currentFileInternal) {
      return;
    }
    const currentProjectIsSnippets = Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(this.currentFileInternal);
    const addedProjectIsSnippets = Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(uiSourceCode);
    if (this.history.index(this.currentFileInternal.url()) && currentProjectIsSnippets && !addedProjectIsSnippets) {
      this.innerShowFile(uiSourceCode, false);
    }
  }
  removeUISourceCode(uiSourceCode) {
    this.removeUISourceCodes([uiSourceCode]);
  }
  removeUISourceCodes(uiSourceCodes) {
    const tabIds = [];
    for (const uiSourceCode of uiSourceCodes) {
      const tabId2 = this.tabIds.get(uiSourceCode);
      if (tabId2) {
        tabIds.push(tabId2);
      }
      if (this.uriToUISourceCode.get(uiSourceCode.url()) === uiSourceCode) {
        this.uriToUISourceCode.delete(uiSourceCode.url());
      }
      if (this.idToUISourceCode.get(uiSourceCode.canononicalScriptId()) === uiSourceCode) {
        this.idToUISourceCode.delete(uiSourceCode.canononicalScriptId());
      }
    }
    this.tabbedPane.closeTabs(tabIds);
  }
  editorClosedByUserAction(uiSourceCode) {
    this.history.remove(uiSourceCode.url());
    this.updateHistory();
  }
  editorSelectedByUserAction() {
    this.updateHistory();
  }
  updateHistory() {
    const tabIds = this.tabbedPane.lastOpenedTabIds(maximalPreviouslyViewedFilesCount);
    function tabIdToURI(tabId2) {
      const tab = this.files.get(tabId2);
      if (!tab) {
        return Platform.DevToolsPath.EmptyUrlString;
      }
      return tab.url();
    }
    this.history.update(tabIds.map(tabIdToURI.bind(this)));
    this.history.save(this.previouslyViewedFilesSetting);
  }
  tooltipForFile(uiSourceCode) {
    uiSourceCode = Persistence.Persistence.PersistenceImpl.instance().network(uiSourceCode) || uiSourceCode;
    return uiSourceCode.url();
  }
  appendFileTab(uiSourceCode, userGesture, index, replaceView) {
    const view = replaceView || this.delegate.viewForFile(uiSourceCode);
    const title = this.titleForFile(uiSourceCode);
    const tooltip = this.tooltipForFile(uiSourceCode);
    const tabId2 = this.generateTabId();
    this.tabIds.set(uiSourceCode, tabId2);
    this.files.set(tabId2, uiSourceCode);
    if (!replaceView) {
      const savedSelectionRange = this.history.selectionRange(uiSourceCode.url());
      const savedScrollLineNumber = this.history.scrollLineNumber(uiSourceCode.url());
      this.restoreEditorProperties(view, savedSelectionRange, savedScrollLineNumber);
    }
    this.tabbedPane.appendTab(tabId2, title, view, tooltip, userGesture, void 0, void 0, index);
    this.updateFileTitle(uiSourceCode);
    this.addUISourceCodeListeners(uiSourceCode);
    if (uiSourceCode.loadError()) {
      this.addLoadErrorIcon(tabId2);
    } else if (!uiSourceCode.contentLoaded()) {
      void uiSourceCode.requestContent().then((_content) => {
        if (uiSourceCode.loadError()) {
          this.addLoadErrorIcon(tabId2);
        }
      });
    }
    return tabId2;
  }
  addLoadErrorIcon(tabId2) {
    const icon = UI.Icon.Icon.create("smallicon-error");
    UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.unableToLoadThisContent));
    if (this.tabbedPane.tabView(tabId2)) {
      this.tabbedPane.setTabIcon(tabId2, icon);
    }
  }
  restoreEditorProperties(editorView, selection, firstLineNumber) {
    const sourceFrame = editorView instanceof SourceFrame.SourceFrame.SourceFrameImpl ? editorView : null;
    if (!sourceFrame) {
      return;
    }
    if (selection) {
      sourceFrame.setSelection(selection);
    }
    if (typeof firstLineNumber === "number") {
      sourceFrame.scrollToLine(firstLineNumber);
    }
  }
  tabClosed(event) {
    const { tabId: tabId2, isUserGesture } = event.data;
    const uiSourceCode = this.files.get(tabId2);
    if (this.currentFileInternal === uiSourceCode) {
      this.removeViewListeners();
      this.currentView = null;
      this.currentFileInternal = null;
    }
    if (uiSourceCode) {
      this.tabIds.delete(uiSourceCode);
    }
    this.files.delete(tabId2);
    if (uiSourceCode) {
      this.removeUISourceCodeListeners(uiSourceCode);
      this.dispatchEventToListeners(Events.EditorClosed, uiSourceCode);
      if (isUserGesture) {
        this.editorClosedByUserAction(uiSourceCode);
      }
    }
  }
  tabSelected(event) {
    const { tabId: tabId2, isUserGesture } = event.data;
    const uiSourceCode = this.files.get(tabId2);
    if (uiSourceCode) {
      this.innerShowFile(uiSourceCode, isUserGesture);
    }
  }
  addUISourceCodeListeners(uiSourceCode) {
    uiSourceCode.addEventListener(Workspace.UISourceCode.Events.TitleChanged, this.uiSourceCodeTitleChanged, this);
    uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.uiSourceCodeWorkingCopyChanged, this);
    uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.uiSourceCodeWorkingCopyCommitted, this);
  }
  removeUISourceCodeListeners(uiSourceCode) {
    uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.TitleChanged, this.uiSourceCodeTitleChanged, this);
    uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyChanged, this.uiSourceCodeWorkingCopyChanged, this);
    uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.uiSourceCodeWorkingCopyCommitted, this);
  }
  updateFileTitle(uiSourceCode) {
    const tabId2 = this.tabIds.get(uiSourceCode);
    if (tabId2) {
      const title = this.titleForFile(uiSourceCode);
      const tooltip = this.tooltipForFile(uiSourceCode);
      this.tabbedPane.changeTabTitle(tabId2, title, tooltip);
      let icon = null;
      if (uiSourceCode.loadError()) {
        icon = UI.Icon.Icon.create("smallicon-error");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.unableToLoadThisContent));
      } else if (Persistence.Persistence.PersistenceImpl.instance().hasUnsavedCommittedChanges(uiSourceCode)) {
        icon = UI.Icon.Icon.create("smallicon-warning");
        UI.Tooltip.Tooltip.install(icon, i18nString(UIStrings.changesToThisFileWereNotSavedTo));
      } else {
        icon = Persistence.PersistenceUtils.PersistenceUtils.iconForUISourceCode(uiSourceCode);
      }
      this.tabbedPane.setTabIcon(tabId2, icon);
    }
  }
  uiSourceCodeTitleChanged(event) {
    const uiSourceCode = event.data;
    this.updateFileTitle(uiSourceCode);
    this.updateHistory();
    for (const [k, v] of this.uriToUISourceCode) {
      if (v === uiSourceCode && k !== v.url()) {
        this.uriToUISourceCode.delete(k);
      }
    }
    for (const [k, v] of this.idToUISourceCode) {
      if (v === uiSourceCode && k !== v.canononicalScriptId()) {
        this.idToUISourceCode.delete(k);
      }
    }
    this.canonicalUISourceCode(uiSourceCode);
  }
  uiSourceCodeWorkingCopyChanged(event) {
    const uiSourceCode = event.data;
    this.updateFileTitle(uiSourceCode);
  }
  uiSourceCodeWorkingCopyCommitted(event) {
    const uiSourceCode = event.data.uiSourceCode;
    this.updateFileTitle(uiSourceCode);
  }
  generateTabId() {
    return "tab_" + tabId++;
  }
  currentFile() {
    return this.currentFileInternal || null;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["EditorSelected"] = "EditorSelected";
  Events2["EditorClosed"] = "EditorClosed";
  return Events2;
})(Events || {});
export let tabId = 0;
export const maximalPreviouslyViewedFilesCount = 30;
export class HistoryItem {
  url;
  isSerializable;
  selectionRange;
  scrollLineNumber;
  constructor(url, selectionRange, scrollLineNumber) {
    this.url = url;
    this.isSerializable = url.length < HistoryItem.serializableUrlLengthLimit;
    this.selectionRange = selectionRange;
    this.scrollLineNumber = scrollLineNumber;
  }
  static fromObject(serializedHistoryItem) {
    const selectionRange = serializedHistoryItem.selectionRange ? TextUtils.TextRange.TextRange.fromObject(serializedHistoryItem.selectionRange) : void 0;
    return new HistoryItem(serializedHistoryItem.url, selectionRange, serializedHistoryItem.scrollLineNumber);
  }
  serializeToObject() {
    if (!this.isSerializable) {
      return null;
    }
    const serializedHistoryItem = {
      url: this.url,
      selectionRange: this.selectionRange,
      scrollLineNumber: this.scrollLineNumber
    };
    return serializedHistoryItem;
  }
  static serializableUrlLengthLimit = 4096;
}
export class History {
  items;
  itemsIndex;
  constructor(items) {
    this.items = items;
    this.itemsIndex = /* @__PURE__ */ new Map();
    this.rebuildItemIndex();
  }
  static fromObject(serializedHistory) {
    const items = [];
    for (let i = 0; i < serializedHistory.length; ++i) {
      if ("url" in serializedHistory[i] && serializedHistory[i].url) {
        items.push(HistoryItem.fromObject(serializedHistory[i]));
      }
    }
    return new History(items);
  }
  index(url) {
    const index = this.itemsIndex.get(url);
    if (index !== void 0) {
      return index;
    }
    return -1;
  }
  rebuildItemIndex() {
    this.itemsIndex = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.items.length; ++i) {
      console.assert(!this.itemsIndex.has(this.items[i].url));
      this.itemsIndex.set(this.items[i].url, i);
    }
  }
  selectionRange(url) {
    const index = this.index(url);
    return index !== -1 ? this.items[index].selectionRange : void 0;
  }
  updateSelectionRange(url, selectionRange) {
    if (!selectionRange) {
      return;
    }
    const index = this.index(url);
    if (index === -1) {
      return;
    }
    this.items[index].selectionRange = selectionRange;
  }
  scrollLineNumber(url) {
    const index = this.index(url);
    return index !== -1 ? this.items[index].scrollLineNumber : void 0;
  }
  updateScrollLineNumber(url, scrollLineNumber) {
    const index = this.index(url);
    if (index === -1) {
      return;
    }
    this.items[index].scrollLineNumber = scrollLineNumber;
  }
  update(urls) {
    for (let i = urls.length - 1; i >= 0; --i) {
      const index = this.index(urls[i]);
      let item;
      if (index !== -1) {
        item = this.items[index];
        this.items.splice(index, 1);
      } else {
        item = new HistoryItem(urls[i]);
      }
      this.items.unshift(item);
      this.rebuildItemIndex();
    }
  }
  remove(url) {
    const index = this.index(url);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.rebuildItemIndex();
    }
  }
  save(setting) {
    setting.set(this.serializeToObject());
  }
  serializeToObject() {
    const serializedHistory = [];
    for (let i = 0; i < this.items.length; ++i) {
      const serializedItem = this.items[i].serializeToObject();
      if (serializedItem) {
        serializedHistory.push(serializedItem);
      }
      if (serializedHistory.length === maximalPreviouslyViewedFilesCount) {
        break;
      }
    }
    return serializedHistory;
  }
  urls() {
    const result = [];
    for (let i = 0; i < this.items.length; ++i) {
      result.push(this.items[i].url);
    }
    return result;
  }
}
export class EditorContainerTabDelegate {
  editorContainer;
  constructor(editorContainer) {
    this.editorContainer = editorContainer;
  }
  closeTabs(_tabbedPane, ids) {
    this.editorContainer.closeTabs(ids);
  }
  onContextMenu(tabId2, contextMenu) {
    this.editorContainer.onContextMenu(tabId2, contextMenu);
  }
}
//# sourceMappingURL=TabbedEditorContainer.js.map
