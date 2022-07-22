import * as i18n from "../../../../core/i18n/i18n.js";
import * as UI from "../../legacy.js";
import { SourceFrameImpl } from "./SourceFrame.js";
import resourceSourceFrameStyles from "./resourceSourceFrame.css.legacy.js";
const UIStrings = {
  find: "Find"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/source_frame/ResourceSourceFrame.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ResourceSourceFrame extends SourceFrameImpl {
  constructor(resource, givenContentType, options) {
    super(() => resource.requestContent(), options);
    this.givenContentType = givenContentType;
    this.resourceInternal = resource;
  }
  resourceInternal;
  static createSearchableView(resource, contentType, autoPrettyPrint) {
    return new SearchableContainer(resource, contentType, autoPrettyPrint);
  }
  getContentType() {
    return this.givenContentType;
  }
  get resource() {
    return this.resourceInternal;
  }
  populateTextAreaContextMenu(contextMenu, lineNumber, columnNumber) {
    super.populateTextAreaContextMenu(contextMenu, lineNumber, columnNumber);
    contextMenu.appendApplicableItems(this.resourceInternal);
  }
}
export class SearchableContainer extends UI.Widget.VBox {
  sourceFrame;
  constructor(resource, contentType, autoPrettyPrint) {
    super(true);
    this.registerRequiredCSS(resourceSourceFrameStyles);
    const sourceFrame = new ResourceSourceFrame(resource, contentType);
    this.sourceFrame = sourceFrame;
    const canPrettyPrint = sourceFrame.resource.contentType().isDocumentOrScriptOrStyleSheet() || contentType === "application/json";
    sourceFrame.setCanPrettyPrint(canPrettyPrint, autoPrettyPrint);
    const searchableView = new UI.SearchableView.SearchableView(sourceFrame, sourceFrame);
    searchableView.element.classList.add("searchable-view");
    searchableView.setPlaceholder(i18nString(UIStrings.find));
    sourceFrame.show(searchableView.element);
    sourceFrame.setSearchableView(searchableView);
    searchableView.show(this.contentElement);
    const toolbar = new UI.Toolbar.Toolbar("toolbar", this.contentElement);
    void sourceFrame.toolbarItems().then((items) => {
      items.map((item) => toolbar.appendToolbarItem(item));
    });
  }
  async revealPosition(lineNumber, columnNumber) {
    this.sourceFrame.revealPosition({ lineNumber, columnNumber }, true);
  }
}
//# sourceMappingURL=ResourceSourceFrame.js.map
