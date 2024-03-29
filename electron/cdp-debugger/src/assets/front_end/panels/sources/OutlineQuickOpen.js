import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Formatter from "../../models/formatter/formatter.js";
import * as QuickOpen from "../../ui/legacy/components/quick_open/quick_open.js";
import * as UI from "../../ui/legacy/legacy.js";
import { SourcesView } from "./SourcesView.js";
const UIStrings = {
  noFileSelected: "No file selected.",
  openAJavascriptOrCssFileToSee: "Open a JavaScript or CSS file to see symbols",
  noResultsFound: "No results found"
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/OutlineQuickOpen.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let outlineQuickOpenInstance;
export class OutlineQuickOpen extends QuickOpen.FilteredListWidget.Provider {
  items;
  active;
  constructor() {
    super();
    this.items = [];
    this.active = false;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!outlineQuickOpenInstance || forceNew) {
      outlineQuickOpenInstance = new OutlineQuickOpen();
    }
    return outlineQuickOpenInstance;
  }
  attach() {
    this.items = [];
    this.active = false;
    const uiSourceCode = this.currentUISourceCode();
    if (uiSourceCode) {
      this.active = Formatter.FormatterWorkerPool.formatterWorkerPool().outlineForMimetype(uiSourceCode.workingCopy(), uiSourceCode.contentType().canonicalMimeType(), this.didBuildOutlineChunk.bind(this));
    }
  }
  didBuildOutlineChunk(isLastChunk, items) {
    this.items.push(...items);
    this.refresh();
  }
  itemCount() {
    return this.items.length;
  }
  itemKeyAt(itemIndex) {
    const item = this.items[itemIndex];
    return item.title + (item.subtitle ? item.subtitle : "");
  }
  itemScoreAt(itemIndex, query) {
    const item = this.items[itemIndex];
    const methodName = query.split("(")[0];
    if (methodName.toLowerCase() === item.title.toLowerCase()) {
      return 1 / (1 + item.line);
    }
    return -item.line - 1;
  }
  renderItem(itemIndex, query, titleElement, _subtitleElement) {
    const item = this.items[itemIndex];
    titleElement.textContent = item.title + (item.subtitle ? item.subtitle : "");
    QuickOpen.FilteredListWidget.FilteredListWidget.highlightRanges(titleElement, query);
    const tagElement = titleElement.parentElement?.parentElement?.createChild("span", "tag");
    if (!tagElement) {
      return;
    }
    tagElement.textContent = ":" + (item.line + 1);
  }
  selectItem(itemIndex, _promptValue) {
    if (itemIndex === null) {
      return;
    }
    const uiSourceCode = this.currentUISourceCode();
    if (!uiSourceCode) {
      return;
    }
    const lineNumber = this.items[itemIndex].line;
    if (!isNaN(lineNumber) && lineNumber >= 0) {
      void Common.Revealer.reveal(uiSourceCode.uiLocation(lineNumber, this.items[itemIndex].column));
    }
  }
  currentUISourceCode() {
    const sourcesView = UI.Context.Context.instance().flavor(SourcesView);
    if (!sourcesView) {
      return null;
    }
    return sourcesView.currentUISourceCode();
  }
  notFoundText() {
    if (!this.currentUISourceCode()) {
      return i18nString(UIStrings.noFileSelected);
    }
    if (!this.active) {
      return i18nString(UIStrings.openAJavascriptOrCssFileToSee);
    }
    return i18nString(UIStrings.noResultsFound);
  }
}
//# sourceMappingURL=OutlineQuickOpen.js.map
