import * as i18n from "../../core/i18n/i18n.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as SourceFrame from "../../ui/legacy/components/source_frame/source_frame.js";
import * as UI from "../../ui/legacy/legacy.js";
import { RequestHTMLView } from "./RequestHTMLView.js";
import { RequestResponseView } from "./RequestResponseView.js";
import { SignedExchangeInfoView } from "./SignedExchangeInfoView.js";
import { WebBundleInfoView } from "./components/WebBundleInfoView.js";
const UIStrings = {
  failedToLoadResponseData: "Failed to load response data",
  previewNotAvailable: "Preview not available"
};
const str_ = i18n.i18n.registerUIStrings("panels/network/RequestPreviewView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RequestPreviewView extends RequestResponseView {
  constructor(request) {
    super(request);
  }
  async showPreview() {
    const view = await super.showPreview();
    if (!(view instanceof UI.View.SimpleView)) {
      return view;
    }
    const toolbar = new UI.Toolbar.Toolbar("network-item-preview-toolbar", this.element);
    void view.toolbarItems().then((items) => {
      items.map((item) => toolbar.appendToolbarItem(item));
    });
    return view;
  }
  async htmlPreview() {
    const contentData = await this.request.contentData();
    if (contentData.error) {
      return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.failedToLoadResponseData) + ": " + contentData.error);
    }
    const allowlist = /* @__PURE__ */ new Set(["text/html", "text/plain", "application/xhtml+xml"]);
    if (!allowlist.has(this.request.mimeType)) {
      return null;
    }
    const content = contentData.encoded ? window.atob(contentData.content) : contentData.content;
    const jsonView = await SourceFrame.JSONView.JSONView.createView(content);
    if (jsonView) {
      return jsonView;
    }
    const dataURL = TextUtils.ContentProvider.contentAsDataURL(contentData.content, this.request.mimeType, contentData.encoded, this.request.charset());
    return dataURL ? new RequestHTMLView(dataURL) : null;
  }
  async createPreview() {
    if (this.request.signedExchangeInfo()) {
      return new SignedExchangeInfoView(this.request);
    }
    if (this.request.webBundleInfo()) {
      return new WebBundleInfoView(this.request);
    }
    const htmlErrorPreview = await this.htmlPreview();
    if (htmlErrorPreview) {
      return htmlErrorPreview;
    }
    const provided = await SourceFrame.PreviewFactory.PreviewFactory.createPreview(this.request, this.request.mimeType);
    if (provided) {
      return provided;
    }
    return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.previewNotAvailable));
  }
}
//# sourceMappingURL=RequestPreviewView.js.map
