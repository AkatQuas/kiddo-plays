import * as i18n from "../../core/i18n/i18n.js";
import emptyWidgetStyles from "./emptyWidget.css.legacy.js";
import { VBox } from "./Widget.js";
import { XLink } from "./XLink.js";
const UIStrings = {
  learnMore: "Learn more"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/EmptyWidget.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class EmptyWidget extends VBox {
  textElement;
  constructor(text) {
    super();
    this.registerRequiredCSS(emptyWidgetStyles);
    this.element.classList.add("empty-view-scroller");
    this.contentElement = this.element.createChild("div", "empty-view");
    this.textElement = this.contentElement.createChild("div", "empty-bold-text");
    this.textElement.textContent = text;
  }
  appendParagraph() {
    return this.contentElement.createChild("p");
  }
  appendLink(link) {
    return this.contentElement.appendChild(XLink.create(link, i18nString(UIStrings.learnMore)));
  }
  set text(text) {
    this.textElement.textContent = text;
  }
}
//# sourceMappingURL=EmptyWidget.js.map
