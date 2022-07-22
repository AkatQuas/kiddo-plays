import * as i18n from "../../../../core/i18n/i18n.js";
import * as Platform from "../../../../core/platform/platform.js";
import * as TextUtils from "../../../../models/text_utils/text_utils.js";
import * as UI from "../../legacy.js";
import fontViewStyles from "./fontView.css.legacy.js";
const UIStrings = {
  font: "Font",
  previewOfFontFromS: "Preview of font from {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/source_frame/FontView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class FontView extends UI.View.SimpleView {
  url;
  mimeType;
  contentProvider;
  mimeTypeLabel;
  fontPreviewElement;
  dummyElement;
  fontStyleElement;
  inResize;
  constructor(mimeType, contentProvider) {
    super(i18nString(UIStrings.font));
    this.registerRequiredCSS(fontViewStyles);
    this.element.classList.add("font-view");
    this.url = contentProvider.contentURL();
    UI.ARIAUtils.setAccessibleName(this.element, i18nString(UIStrings.previewOfFontFromS, { PH1: this.url }));
    this.mimeType = mimeType;
    this.contentProvider = contentProvider;
    this.mimeTypeLabel = new UI.Toolbar.ToolbarText(mimeType);
  }
  async toolbarItems() {
    return [this.mimeTypeLabel];
  }
  onFontContentLoaded(uniqueFontName, deferredContent) {
    const { content } = deferredContent;
    const url = content ? TextUtils.ContentProvider.contentAsDataURL(content, this.mimeType, true) : this.url;
    if (!this.fontStyleElement) {
      return;
    }
    this.fontStyleElement.textContent = Platform.StringUtilities.sprintf('@font-face { font-family: "%s"; src: url(%s); }', uniqueFontName, url);
    this.updateFontPreviewSize();
  }
  createContentIfNeeded() {
    if (this.fontPreviewElement) {
      return;
    }
    const uniqueFontName = "WebInspectorFontPreview" + ++_fontId;
    this.fontStyleElement = document.createElement("style");
    void this.contentProvider.requestContent().then((deferredContent) => {
      this.onFontContentLoaded(uniqueFontName, deferredContent);
    });
    this.element.appendChild(this.fontStyleElement);
    const fontPreview = document.createElement("div");
    for (let i = 0; i < _fontPreviewLines.length; ++i) {
      if (i > 0) {
        fontPreview.createChild("br");
      }
      UI.UIUtils.createTextChild(fontPreview, _fontPreviewLines[i]);
    }
    this.fontPreviewElement = fontPreview.cloneNode(true);
    if (!this.fontPreviewElement) {
      return;
    }
    UI.ARIAUtils.markAsHidden(this.fontPreviewElement);
    this.fontPreviewElement.style.overflow = "hidden";
    this.fontPreviewElement.style.setProperty("font-family", uniqueFontName);
    this.fontPreviewElement.style.setProperty("visibility", "hidden");
    this.dummyElement = fontPreview;
    this.dummyElement.style.visibility = "hidden";
    this.dummyElement.style.zIndex = "-1";
    this.dummyElement.style.display = "inline";
    this.dummyElement.style.position = "absolute";
    this.dummyElement.style.setProperty("font-family", uniqueFontName);
    this.dummyElement.style.setProperty("font-size", _measureFontSize + "px");
    this.element.appendChild(this.fontPreviewElement);
  }
  wasShown() {
    this.createContentIfNeeded();
    this.updateFontPreviewSize();
  }
  onResize() {
    if (this.inResize) {
      return;
    }
    this.inResize = true;
    try {
      this.updateFontPreviewSize();
    } finally {
      this.inResize = null;
    }
  }
  measureElement() {
    if (!this.dummyElement) {
      throw new Error("No font preview loaded");
    }
    this.element.appendChild(this.dummyElement);
    const result = { width: this.dummyElement.offsetWidth, height: this.dummyElement.offsetHeight };
    this.element.removeChild(this.dummyElement);
    return result;
  }
  updateFontPreviewSize() {
    if (!this.fontPreviewElement || !this.isShowing()) {
      return;
    }
    this.fontPreviewElement.style.removeProperty("visibility");
    const dimension = this.measureElement();
    const height = dimension.height;
    const width = dimension.width;
    const containerWidth = this.element.offsetWidth - 50;
    const containerHeight = this.element.offsetHeight - 30;
    if (!height || !width || !containerWidth || !containerHeight) {
      this.fontPreviewElement.style.removeProperty("font-size");
      return;
    }
    const widthRatio = containerWidth / width;
    const heightRatio = containerHeight / height;
    const finalFontSize = Math.floor(_measureFontSize * Math.min(widthRatio, heightRatio)) - 2;
    this.fontPreviewElement.style.setProperty("font-size", finalFontSize + "px", void 0);
  }
}
let _fontId = 0;
const _fontPreviewLines = ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "abcdefghijklm", "nopqrstuvwxyz", "1234567890"];
const _measureFontSize = 50;
//# sourceMappingURL=FontView.js.map
