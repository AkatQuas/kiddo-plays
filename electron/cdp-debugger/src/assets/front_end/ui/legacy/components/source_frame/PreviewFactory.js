import * as Common from "../../../../core/common/common.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import * as UI from "../../legacy.js";
import { FontView } from "./FontView.js";
import { ImageView } from "./ImageView.js";
import { JSONView } from "./JSONView.js";
import { ResourceSourceFrame } from "./ResourceSourceFrame.js";
import { XMLView } from "./XMLView.js";
const UIStrings = {
  nothingToPreview: "Nothing to preview"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/source_frame/PreviewFactory.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class PreviewFactory {
  static async createPreview(provider, mimeType) {
    let resourceType = Common.ResourceType.ResourceType.fromMimeType(mimeType);
    if (resourceType === Common.ResourceType.resourceTypes.Other) {
      resourceType = provider.contentType();
    }
    switch (resourceType) {
      case Common.ResourceType.resourceTypes.Image:
        return new ImageView(mimeType, provider);
      case Common.ResourceType.resourceTypes.Font:
        return new FontView(mimeType, provider);
    }
    const deferredContent = await provider.requestContent();
    if (deferredContent.content === null) {
      return new UI.EmptyWidget.EmptyWidget(deferredContent.error);
    }
    if (!deferredContent.content) {
      return new UI.EmptyWidget.EmptyWidget(i18nString(UIStrings.nothingToPreview));
    }
    let content = deferredContent.content;
    if (await provider.contentEncoded()) {
      content = window.atob(content);
    }
    const parsedXML = XMLView.parseXML(content, mimeType);
    if (parsedXML) {
      return XMLView.createSearchableView(parsedXML);
    }
    const jsonView = await JSONView.createView(content);
    if (jsonView) {
      return jsonView;
    }
    if (resourceType.isTextType()) {
      const highlighterType = mimeType.replace(/;.*/, "") || provider.contentType().canonicalMimeType();
      return ResourceSourceFrame.createSearchableView(provider, highlighterType, true);
    }
    return null;
  }
}
//# sourceMappingURL=PreviewFactory.js.map
