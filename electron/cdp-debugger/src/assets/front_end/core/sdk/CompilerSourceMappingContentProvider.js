import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as i18n from "../i18n/i18n.js";
import { PageResourceLoader } from "./PageResourceLoader.js";
const UIStrings = {
  couldNotLoadContentForSS: "Could not load content for {PH1} ({PH2})"
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/CompilerSourceMappingContentProvider.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class CompilerSourceMappingContentProvider {
  #sourceURL;
  #contentTypeInternal;
  #initiator;
  constructor(sourceURL, contentType, initiator) {
    this.#sourceURL = sourceURL;
    this.#contentTypeInternal = contentType;
    this.#initiator = initiator;
  }
  contentURL() {
    return this.#sourceURL;
  }
  contentType() {
    return this.#contentTypeInternal;
  }
  async contentEncoded() {
    return false;
  }
  async requestContent() {
    try {
      const { content } = await PageResourceLoader.instance().loadResource(this.#sourceURL, this.#initiator);
      return { content, isEncoded: false };
    } catch (e) {
      const error = i18nString(UIStrings.couldNotLoadContentForSS, { PH1: this.#sourceURL, PH2: e.message });
      console.error(error);
      return { content: null, error, isEncoded: false };
    }
  }
  async searchInContent(query, caseSensitive, isRegex) {
    const { content } = await this.requestContent();
    if (typeof content !== "string") {
      return [];
    }
    return TextUtils.TextUtils.performSearchInContent(content, query, caseSensitive, isRegex);
  }
}
//# sourceMappingURL=CompilerSourceMappingContentProvider.js.map
