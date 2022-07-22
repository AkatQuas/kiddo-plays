import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  thisRequestHasNoResponseData: "This request has no response data available.",
  failedToLoadResponseData: "Failed to load response data"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/RequestResponseView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RequestResponseView extends UI.Widget.VBox {
  request;
  contentViewPromise;
  constructor(request) {
    super();
    this.element.classList.add("request-view");
    this.request = request;
    this.contentViewPromise = null;
  }
  static hasTextContent(request, contentData) {
    const mimeType = request.mimeType || "";
    let resourceType = Common.ResourceType.ResourceType.fromMimeType(mimeType);
    if (resourceType === Common.ResourceType.resourceTypes.Other) {
      resourceType = request.contentType();
    }
    if (resourceType === Common.ResourceType.resourceTypes.Image) {
      return mimeType.startsWith("image/svg");
    }
    if (resourceType.isTextType()) {
      return true;
    }
    if (contentData.error) {
      return false;
    }
    if (resourceType === Common.ResourceType.resourceTypes.Other) {
      return Boolean(contentData.content) && !contentData.encoded;
    }
    return false;
  }
  static async sourceViewForRequest(request) {
    let sourceView = requestToSourceView.get(request);
    if (sourceView !== void 0) {
      return sourceView;
    }
    const contentData = await request.contentData();
    if (!RequestResponseView.hasTextContent(request, contentData)) {
      requestToSourceView.delete(request);
      return null;
    }
    const highlighterType = request.resourceType().canonicalMimeType() || request.mimeType;
    sourceView = SourceFrame.ResourceSourceFrame.ResourceSourceFrame.createSearchableView(request, highlighterType);
    requestToSourceView.set(request, sourceView);
    return sourceView;
  }
  wasShown() {
    void this.doShowPreview();
  }
  doShowPreview() {
    if (!this.contentViewPromise) {
      this.contentViewPromise = this.showPreview();
    }
    return this.contentViewPromise;
  }
  async showPreview() {
    const responseView = await this.createPreview();
    responseView.show(this.element);
    return responseView;
  }
  async createPreview() {
    const contentData = await this.request.contentData();
    const sourceView = await RequestResponseView.sourceViewForRequest(this.request);
    if ((!contentData.content || !sourceView) && !contentData.error) {
      return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.thisRequestHasNoResponseData));
    }
    if (contentData.content && sourceView) {
      return sourceView;
    }
    if (contentData.error) {
      return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.failedToLoadResponseData) + ": " + contentData.error);
    }
    if (this.request.statusCode === 204) {
      return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.thisRequestHasNoResponseData));
    }
    return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.failedToLoadResponseData));
  }
  async revealLine(line) {
    const view = await this.doShowPreview();
    if (view instanceof SourceFrame.ResourceSourceFrame.SearchableContainer) {
      void view.revealPosition(line);
    }
  }
}
const requestToSourceView = /* @__PURE__ */ new WeakMap();
//# sourceMappingURL=RequestResponseView.js.map
