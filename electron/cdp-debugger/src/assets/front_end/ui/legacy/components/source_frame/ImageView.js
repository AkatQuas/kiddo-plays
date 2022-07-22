import * as Common from "../../../../core/common/common.js";
import * as Host from "../../../../core/host/host.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import * as Platform from "../../../../core/platform/platform.js";
import * as TextUtils from "../../../../models/text_utils/text_utils.js";
import * as Workspace from "../../../../models/workspace/workspace.js";
import * as UI from "../../legacy.js";
import imageViewStyles from "./imageView.css.legacy.js";
const UIStrings = {
  image: "Image",
  dropImageFileHere: "Drop image file here",
  imageFromS: "Image from {PH1}",
  dD: "{PH1} \xD7 {PH2}",
  copyImageUrl: "Copy image URL",
  copyImageAsDataUri: "Copy image as data URI",
  openImageInNewTab: "Open image in new tab",
  saveImageAs: "Save image as...",
  download: "download"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/source_frame/ImageView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ImageView extends UI.View.SimpleView {
  url;
  parsedURL;
  mimeType;
  contentProvider;
  uiSourceCode;
  sizeLabel;
  dimensionsLabel;
  aspectRatioLabel;
  mimeTypeLabel;
  container;
  imagePreviewElement;
  cachedContent;
  constructor(mimeType, contentProvider) {
    super(i18nString(UIStrings.image));
    this.registerRequiredCSS(imageViewStyles);
    this.element.tabIndex = -1;
    this.element.classList.add("image-view");
    this.url = contentProvider.contentURL();
    this.parsedURL = new Common.ParsedURL.ParsedURL(this.url);
    this.mimeType = mimeType;
    this.contentProvider = contentProvider;
    this.uiSourceCode = contentProvider instanceof Workspace.UISourceCode.UISourceCode ? contentProvider : null;
    if (this.uiSourceCode) {
      this.uiSourceCode.addEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this);
      new UI.DropTarget.DropTarget(this.element, [UI.DropTarget.Type.ImageFile, UI.DropTarget.Type.URI], i18nString(UIStrings.dropImageFileHere), this.handleDrop.bind(this));
    }
    this.sizeLabel = new UI.Toolbar.ToolbarText();
    this.dimensionsLabel = new UI.Toolbar.ToolbarText();
    this.aspectRatioLabel = new UI.Toolbar.ToolbarText();
    this.mimeTypeLabel = new UI.Toolbar.ToolbarText(mimeType);
    this.container = this.element.createChild("div", "image");
    this.imagePreviewElement = this.container.createChild("img", "resource-image-view");
    this.imagePreviewElement.addEventListener("contextmenu", this.contextMenu.bind(this), true);
  }
  async toolbarItems() {
    await this.updateContentIfNeeded();
    return [
      this.sizeLabel,
      new UI.Toolbar.ToolbarSeparator(),
      this.dimensionsLabel,
      new UI.Toolbar.ToolbarSeparator(),
      this.aspectRatioLabel,
      new UI.Toolbar.ToolbarSeparator(),
      this.mimeTypeLabel
    ];
  }
  wasShown() {
    void this.updateContentIfNeeded();
  }
  disposeView() {
    if (this.uiSourceCode) {
      this.uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.WorkingCopyCommitted, this.workingCopyCommitted, this);
    }
  }
  workingCopyCommitted() {
    void this.updateContentIfNeeded();
  }
  async updateContentIfNeeded() {
    const { content } = await this.contentProvider.requestContent();
    if (this.cachedContent === content) {
      return;
    }
    const contentEncoded = await this.contentProvider.contentEncoded();
    this.cachedContent = content;
    const imageSrc = TextUtils.ContentProvider.contentAsDataURL(content, this.mimeType, contentEncoded) || this.url;
    const loadPromise = new Promise((x) => {
      this.imagePreviewElement.onload = x;
    });
    this.imagePreviewElement.src = imageSrc;
    this.imagePreviewElement.alt = i18nString(UIStrings.imageFromS, { PH1: this.url });
    const size = content && !contentEncoded ? content.length : Platform.StringUtilities.base64ToSize(content);
    this.sizeLabel.setText(Platform.NumberUtilities.bytesToString(size));
    await loadPromise;
    this.dimensionsLabel.setText(i18nString(UIStrings.dD, { PH1: this.imagePreviewElement.naturalWidth, PH2: this.imagePreviewElement.naturalHeight }));
    this.aspectRatioLabel.setText(Platform.NumberUtilities.aspectRatio(this.imagePreviewElement.naturalWidth, this.imagePreviewElement.naturalHeight));
  }
  contextMenu(event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    const parsedSrc = new Common.ParsedURL.ParsedURL(this.imagePreviewElement.src);
    if (!this.parsedURL.isDataURL()) {
      contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyImageUrl), this.copyImageURL.bind(this));
    }
    if (parsedSrc.isDataURL()) {
      contextMenu.clipboardSection().appendItem(i18nString(UIStrings.copyImageAsDataUri), this.copyImageAsDataURL.bind(this));
    }
    contextMenu.clipboardSection().appendItem(i18nString(UIStrings.openImageInNewTab), this.openInNewTab.bind(this));
    contextMenu.clipboardSection().appendItem(i18nString(UIStrings.saveImageAs), async () => {
      await this.saveImage();
    });
    void contextMenu.show();
  }
  copyImageAsDataURL() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(this.imagePreviewElement.src);
  }
  copyImageURL() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(this.url);
  }
  async saveImage() {
    const contentEncoded = await this.contentProvider.contentEncoded();
    if (!this.cachedContent) {
      return;
    }
    const cachedContent = this.cachedContent;
    const imageDataURL = TextUtils.ContentProvider.contentAsDataURL(cachedContent, this.mimeType, contentEncoded, "", false);
    if (!imageDataURL) {
      return;
    }
    const link = document.createElement("a");
    link.href = imageDataURL;
    link.download = this.parsedURL.isDataURL() ? i18nString(UIStrings.download) : decodeURIComponent(this.parsedURL.displayName);
    link.click();
    link.remove();
  }
  openInNewTab() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(this.url);
  }
  async handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    if (!items.length || items[0].kind !== "file") {
      return;
    }
    const file = items[0].getAsFile();
    if (!file) {
      return;
    }
    const encoded = !file.name.endsWith(".svg");
    const fileCallback = (file2) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let result;
        try {
          result = reader.result;
        } catch (e) {
          result = null;
          console.error("Can't read file: " + e);
        }
        if (typeof result !== "string" || !this.uiSourceCode) {
          return;
        }
        this.uiSourceCode.setContent(encoded ? btoa(result) : result, encoded);
      };
      if (encoded) {
        reader.readAsBinaryString(file2);
      } else {
        reader.readAsText(file2);
      }
    };
    fileCallback(file);
  }
}
//# sourceMappingURL=ImageView.js.map
