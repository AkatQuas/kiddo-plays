import * as i18n from "../../core/i18n/i18n.js";
import platformFontsWidgetStyles from "./platformFontsWidget.css.js";
import * as UI from "../../ui/legacy/legacy.js";
import { Events } from "./ComputedStyleModel.js";
const UIStrings = {
  renderedFonts: "Rendered Fonts",
  networkResource: "Network resource",
  localFile: "Local file",
  dGlyphs: "{n, plural, =1 {(# glyph)} other {(# glyphs)}}"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/PlatformFontsWidget.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class PlatformFontsWidget extends UI.ThrottledWidget.ThrottledWidget {
  sharedModel;
  sectionTitle;
  fontStatsSection;
  constructor(sharedModel) {
    super(true);
    this.sharedModel = sharedModel;
    this.sharedModel.addEventListener(Events.ComputedStyleChanged, this.update, this);
    this.sectionTitle = document.createElement("div");
    this.sectionTitle.classList.add("title");
    this.contentElement.classList.add("platform-fonts");
    this.contentElement.appendChild(this.sectionTitle);
    this.sectionTitle.textContent = i18nString(UIStrings.renderedFonts);
    this.fontStatsSection = this.contentElement.createChild("div", "stats-section");
  }
  doUpdate() {
    const cssModel = this.sharedModel.cssModel();
    const node = this.sharedModel.node();
    if (!node || !cssModel) {
      return Promise.resolve();
    }
    return cssModel.getPlatformFonts(node.id).then(this.refreshUI.bind(this, node));
  }
  refreshUI(node, platformFonts) {
    if (this.sharedModel.node() !== node) {
      return;
    }
    this.fontStatsSection.removeChildren();
    const isEmptySection = !platformFonts || !platformFonts.length;
    this.sectionTitle.classList.toggle("hidden", isEmptySection);
    if (isEmptySection || !platformFonts) {
      return;
    }
    platformFonts.sort(function(a, b) {
      return b.glyphCount - a.glyphCount;
    });
    for (let i = 0; i < platformFonts.length; ++i) {
      const fontStatElement = this.fontStatsSection.createChild("div", "font-stats-item");
      const fontNameElement = fontStatElement.createChild("span", "font-name");
      fontNameElement.textContent = platformFonts[i].familyName;
      const fontDelimeterElement = fontStatElement.createChild("span", "font-delimeter");
      fontDelimeterElement.textContent = "\u2014";
      const fontOrigin = fontStatElement.createChild("span");
      fontOrigin.textContent = platformFonts[i].isCustomFont ? i18nString(UIStrings.networkResource) : i18nString(UIStrings.localFile);
      const fontUsageElement = fontStatElement.createChild("span", "font-usage");
      const usage = platformFonts[i].glyphCount;
      fontUsageElement.textContent = i18nString(UIStrings.dGlyphs, { n: usage });
    }
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([platformFontsWidgetStyles]);
  }
}
//# sourceMappingURL=PlatformFontsWidget.js.map
