import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import searchViewStyles from "./searchView.css.js";
import { SearchConfig } from "./SearchConfig.js";
import { SearchResultsPane } from "./SearchResultsPane.js";
const UIStrings = {
  search: "Search",
  searchQuery: "Search Query",
  matchCase: "Match Case",
  useRegularExpression: "Use Regular Expression",
  refresh: "Refresh",
  clear: "Clear",
  indexing: "Indexing\u2026",
  searching: "Searching\u2026",
  indexingInterrupted: "Indexing interrupted.",
  foundMatchingLineInFile: "Found 1 matching line in 1 file.",
  foundDMatchingLinesInFile: "Found {PH1} matching lines in 1 file.",
  foundDMatchingLinesInDFiles: "Found {PH1} matching lines in {PH2} files.",
  noMatchesFound: "No matches found.",
  searchFinished: "Search finished.",
  searchInterrupted: "Search interrupted."
};
const str_ = i18n.i18n.registerUIStrings("panels/search/SearchView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SearchView extends UI.Widget.VBox {
  focusOnShow;
  isIndexing;
  searchId;
  searchMatchesCount;
  searchResultsCount;
  nonEmptySearchResultsCount;
  searchingView;
  notFoundView;
  searchConfig;
  pendingSearchConfig;
  searchResultsPane;
  progressIndicator;
  visiblePane;
  searchPanelElement;
  searchResultsElement;
  search;
  matchCaseButton;
  regexButton;
  searchMessageElement;
  searchProgressPlaceholderElement;
  searchResultsMessageElement;
  advancedSearchConfig;
  searchScope;
  constructor(settingKey) {
    super(true);
    this.setMinimumSize(0, 40);
    this.focusOnShow = false;
    this.isIndexing = false;
    this.searchId = 1;
    this.searchMatchesCount = 0;
    this.searchResultsCount = 0;
    this.nonEmptySearchResultsCount = 0;
    this.searchingView = null;
    this.notFoundView = null;
    this.searchConfig = null;
    this.pendingSearchConfig = null;
    this.searchResultsPane = null;
    this.progressIndicator = null;
    this.visiblePane = null;
    this.contentElement.classList.add("search-view");
    this.contentElement.addEventListener("keydown", (event) => {
      this.onKeyDownOnPanel(event);
    });
    this.searchPanelElement = this.contentElement.createChild("div", "search-drawer-header");
    this.searchResultsElement = this.contentElement.createChild("div");
    this.searchResultsElement.className = "search-results";
    const searchContainer = document.createElement("div");
    searchContainer.style.flex = "auto";
    searchContainer.style.justifyContent = "start";
    searchContainer.style.maxWidth = "300px";
    this.search = UI.HistoryInput.HistoryInput.create();
    this.search.addEventListener("keydown", (event) => {
      this.onKeyDown(event);
    });
    searchContainer.appendChild(this.search);
    this.search.placeholder = i18nString(UIStrings.search);
    this.search.setAttribute("type", "text");
    this.search.setAttribute("results", "0");
    this.search.setAttribute("size", "42");
    UI.ARIAUtils.setAccessibleName(this.search, i18nString(UIStrings.searchQuery));
    const searchItem = new UI.Toolbar.ToolbarItem(searchContainer);
    const toolbar = new UI.Toolbar.Toolbar("search-toolbar", this.searchPanelElement);
    this.matchCaseButton = SearchView.appendToolbarToggle(toolbar, "Aa", i18nString(UIStrings.matchCase));
    this.regexButton = SearchView.appendToolbarToggle(toolbar, ".*", i18nString(UIStrings.useRegularExpression));
    toolbar.appendToolbarItem(searchItem);
    const refreshButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.refresh), "largeicon-refresh");
    const clearButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.clear), "largeicon-clear");
    toolbar.appendToolbarItem(refreshButton);
    toolbar.appendToolbarItem(clearButton);
    refreshButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.onAction());
    clearButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => {
      this.resetSearch();
      this.onSearchInputClear();
    });
    const searchStatusBarElement = this.contentElement.createChild("div", "search-toolbar-summary");
    this.searchMessageElement = searchStatusBarElement.createChild("div", "search-message");
    this.searchProgressPlaceholderElement = searchStatusBarElement.createChild("div", "flex-centered");
    this.searchResultsMessageElement = searchStatusBarElement.createChild("div", "search-message");
    this.advancedSearchConfig = Common.Settings.Settings.instance().createLocalSetting(settingKey + "SearchConfig", new SearchConfig("", true, false).toPlainObject());
    this.load();
    this.searchScope = null;
  }
  static appendToolbarToggle(toolbar, text, tooltip) {
    const toggle = new UI.Toolbar.ToolbarToggle(tooltip);
    toggle.setText(text);
    toggle.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => toggle.setToggled(!toggle.toggled()));
    toolbar.appendToolbarItem(toggle);
    return toggle;
  }
  buildSearchConfig() {
    return new SearchConfig(this.search.value, !this.matchCaseButton.toggled(), this.regexButton.toggled());
  }
  async toggle(queryCandidate, searchImmediately) {
    if (queryCandidate) {
      this.search.value = queryCandidate;
    }
    if (this.isShowing()) {
      this.focus();
    } else {
      this.focusOnShow = true;
    }
    this.initScope();
    if (searchImmediately) {
      this.onAction();
    } else {
      this.startIndexing();
    }
  }
  createScope() {
    throw new Error("Not implemented");
  }
  initScope() {
    this.searchScope = this.createScope();
  }
  wasShown() {
    if (this.focusOnShow) {
      this.focus();
      this.focusOnShow = false;
    }
    this.registerCSSFiles([searchViewStyles]);
  }
  onIndexingFinished() {
    if (!this.progressIndicator) {
      return;
    }
    const finished = !this.progressIndicator.isCanceled();
    this.progressIndicator.done();
    this.progressIndicator = null;
    this.isIndexing = false;
    this.indexingFinished(finished);
    if (!finished) {
      this.pendingSearchConfig = null;
    }
    if (!this.pendingSearchConfig) {
      return;
    }
    const searchConfig = this.pendingSearchConfig;
    this.pendingSearchConfig = null;
    this.innerStartSearch(searchConfig);
  }
  startIndexing() {
    this.isIndexing = true;
    if (this.progressIndicator) {
      this.progressIndicator.done();
    }
    this.progressIndicator = new UI.ProgressIndicator.ProgressIndicator();
    this.searchMessageElement.textContent = i18nString(UIStrings.indexing);
    this.progressIndicator.show(this.searchProgressPlaceholderElement);
    if (this.searchScope) {
      this.searchScope.performIndexing(new Common.Progress.ProgressProxy(this.progressIndicator, this.onIndexingFinished.bind(this)));
    }
  }
  onSearchInputClear() {
    this.search.value = "";
    this.save();
    this.focus();
  }
  onSearchResult(searchId, searchResult) {
    if (searchId !== this.searchId || !this.progressIndicator) {
      return;
    }
    if (this.progressIndicator && this.progressIndicator.isCanceled()) {
      this.onIndexingFinished();
      return;
    }
    this.addSearchResult(searchResult);
    if (!searchResult.matchesCount()) {
      return;
    }
    if (!this.searchResultsPane) {
      this.searchResultsPane = new SearchResultsPane(this.searchConfig);
      this.showPane(this.searchResultsPane);
    }
    this.searchResultsPane.addSearchResult(searchResult);
  }
  onSearchFinished(searchId, finished) {
    if (searchId !== this.searchId || !this.progressIndicator) {
      return;
    }
    if (!this.searchResultsPane) {
      this.nothingFound();
    }
    this.searchFinished(finished);
    this.searchConfig = null;
    UI.ARIAUtils.alert(this.searchMessageElement.textContent + " " + this.searchResultsMessageElement.textContent);
  }
  async startSearch(searchConfig) {
    this.resetSearch();
    ++this.searchId;
    this.initScope();
    if (!this.isIndexing) {
      this.startIndexing();
    }
    this.pendingSearchConfig = searchConfig;
  }
  innerStartSearch(searchConfig) {
    this.searchConfig = searchConfig;
    if (this.progressIndicator) {
      this.progressIndicator.done();
    }
    this.progressIndicator = new UI.ProgressIndicator.ProgressIndicator();
    this.searchStarted(this.progressIndicator);
    if (this.searchScope) {
      void this.searchScope.performSearch(searchConfig, this.progressIndicator, this.onSearchResult.bind(this, this.searchId), this.onSearchFinished.bind(this, this.searchId));
    }
  }
  resetSearch() {
    this.stopSearch();
    this.showPane(null);
    this.searchResultsPane = null;
    this.clearSearchMessage();
  }
  clearSearchMessage() {
    this.searchMessageElement.textContent = "";
    this.searchResultsMessageElement.textContent = "";
  }
  stopSearch() {
    if (this.progressIndicator && !this.isIndexing) {
      this.progressIndicator.cancel();
    }
    if (this.searchScope) {
      this.searchScope.stopSearch();
    }
    this.searchConfig = null;
  }
  searchStarted(progressIndicator) {
    this.resetCounters();
    if (!this.searchingView) {
      this.searchingView = new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.searching));
    }
    this.showPane(this.searchingView);
    this.searchMessageElement.textContent = i18nString(UIStrings.searching);
    progressIndicator.show(this.searchProgressPlaceholderElement);
    this.updateSearchResultsMessage();
  }
  indexingFinished(finished) {
    this.searchMessageElement.textContent = finished ? "" : i18nString(UIStrings.indexingInterrupted);
  }
  updateSearchResultsMessage() {
    if (this.searchMatchesCount && this.searchResultsCount) {
      if (this.searchMatchesCount === 1 && this.nonEmptySearchResultsCount === 1) {
        this.searchResultsMessageElement.textContent = i18nString(UIStrings.foundMatchingLineInFile);
      } else if (this.searchMatchesCount > 1 && this.nonEmptySearchResultsCount === 1) {
        this.searchResultsMessageElement.textContent = i18nString(UIStrings.foundDMatchingLinesInFile, { PH1: this.searchMatchesCount });
      } else {
        this.searchResultsMessageElement.textContent = i18nString(UIStrings.foundDMatchingLinesInDFiles, { PH1: this.searchMatchesCount, PH2: this.nonEmptySearchResultsCount });
      }
    } else {
      this.searchResultsMessageElement.textContent = "";
    }
  }
  showPane(panel) {
    if (this.visiblePane) {
      this.visiblePane.detach();
    }
    if (panel) {
      panel.show(this.searchResultsElement);
    }
    this.visiblePane = panel;
  }
  resetCounters() {
    this.searchMatchesCount = 0;
    this.searchResultsCount = 0;
    this.nonEmptySearchResultsCount = 0;
  }
  nothingFound() {
    if (!this.notFoundView) {
      this.notFoundView = new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.noMatchesFound));
    }
    this.showPane(this.notFoundView);
    this.searchResultsMessageElement.textContent = i18nString(UIStrings.noMatchesFound);
  }
  addSearchResult(searchResult) {
    const matchesCount = searchResult.matchesCount();
    this.searchMatchesCount += matchesCount;
    this.searchResultsCount++;
    if (matchesCount) {
      this.nonEmptySearchResultsCount++;
    }
    this.updateSearchResultsMessage();
  }
  searchFinished(finished) {
    this.searchMessageElement.textContent = finished ? i18nString(UIStrings.searchFinished) : i18nString(UIStrings.searchInterrupted);
  }
  focus() {
    this.search.focus();
    this.search.select();
  }
  willHide() {
    this.stopSearch();
  }
  onKeyDown(event) {
    this.save();
    switch (event.keyCode) {
      case UI.KeyboardShortcut.Keys.Enter.code:
        this.onAction();
        break;
    }
  }
  onKeyDownOnPanel(event) {
    const isMac = Host.Platform.isMac();
    const shouldShowAllForMac = isMac && event.metaKey && !event.ctrlKey && event.altKey && event.code === "BracketRight";
    const shouldShowAllForOtherPlatforms = !isMac && event.ctrlKey && !event.metaKey && event.shiftKey && event.code === "BracketRight";
    const shouldCollapseAllForMac = isMac && event.metaKey && !event.ctrlKey && event.altKey && event.code === "BracketLeft";
    const shouldCollapseAllForOtherPlatforms = !isMac && event.ctrlKey && !event.metaKey && event.shiftKey && event.code === "BracketLeft";
    if (shouldShowAllForMac || shouldShowAllForOtherPlatforms) {
      this.searchResultsPane?.showAllMatches();
    } else if (shouldCollapseAllForMac || shouldCollapseAllForOtherPlatforms) {
      this.searchResultsPane?.collapseAllResults();
    }
  }
  save() {
    this.advancedSearchConfig.set(this.buildSearchConfig().toPlainObject());
  }
  load() {
    const searchConfig = SearchConfig.fromPlainObject(this.advancedSearchConfig.get());
    this.search.value = searchConfig.query();
    this.matchCaseButton.setToggled(!searchConfig.ignoreCase());
    this.regexButton.setToggled(searchConfig.isRegex());
  }
  onAction() {
    const searchConfig = this.buildSearchConfig();
    if (!searchConfig.query() || !searchConfig.query().length) {
      return;
    }
    void this.startSearch(searchConfig);
  }
}
//# sourceMappingURL=SearchView.js.map
