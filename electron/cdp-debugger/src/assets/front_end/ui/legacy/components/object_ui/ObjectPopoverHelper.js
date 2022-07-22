import * as Platform from "../../../../core/platform/platform.js";
import * as SDK from "../../../../core/sdk/sdk.js";
import * as UI from "../../legacy.js";
import * as Components from "../utils/utils.js";
import { CustomPreviewComponent } from "./CustomPreviewComponent.js";
import objectPopoverStyles from "./objectPopover.css.js";
import { ObjectPropertiesSection } from "./ObjectPropertiesSection.js";
import objectValueStyles from "./objectValue.css.js";
export class ObjectPopoverHelper {
  linkifier;
  resultHighlightedAsDOM;
  constructor(linkifier, resultHighlightedAsDOM) {
    this.linkifier = linkifier;
    this.resultHighlightedAsDOM = resultHighlightedAsDOM;
  }
  dispose() {
    if (this.resultHighlightedAsDOM) {
      SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
    }
    if (this.linkifier) {
      this.linkifier.dispose();
    }
  }
  static async buildObjectPopover(result, popover) {
    const description = Platform.StringUtilities.trimEndWithMaxLength(result.description || "", MaxPopoverTextLength);
    let popoverContentElement = null;
    if (result.type === "function" || result.type === "object") {
      let linkifier = null;
      let resultHighlightedAsDOM = false;
      if (result.subtype === "node") {
        SDK.OverlayModel.OverlayModel.highlightObjectAsDOMNode(result);
        resultHighlightedAsDOM = true;
      }
      if (result.customPreview()) {
        const customPreviewComponent = new CustomPreviewComponent(result);
        customPreviewComponent.expandIfPossible();
        popoverContentElement = customPreviewComponent.element;
      } else {
        popoverContentElement = document.createElement("div");
        popoverContentElement.classList.add("object-popover-content");
        popover.registerCSSFiles([objectValueStyles, objectPopoverStyles]);
        const titleElement = popoverContentElement.createChild("div", "object-popover-title");
        if (result.type === "function") {
          titleElement.classList.add("source-code");
          titleElement.appendChild(ObjectPropertiesSection.valueElementForFunctionDescription(result.description));
        } else {
          titleElement.classList.add("monospace");
          titleElement.createChild("span").textContent = description;
        }
        linkifier = new Components.Linkifier.Linkifier();
        const section = new ObjectPropertiesSection(result, "", linkifier, true);
        section.element.classList.add("object-popover-tree");
        section.titleLessMode();
        popoverContentElement.appendChild(section.element);
      }
      popoverContentElement.dataset.stableNameForTest = "object-popover-content";
      popover.setMaxContentSize(new UI.Geometry.Size(300, 250));
      popover.setSizeBehavior(UI.GlassPane.SizeBehavior.SetExactSize);
      popover.contentElement.appendChild(popoverContentElement);
      return new ObjectPopoverHelper(linkifier, resultHighlightedAsDOM);
    }
    popoverContentElement = document.createElement("span");
    popoverContentElement.dataset.stableNameForTest = "object-popover-content";
    popover.registerCSSFiles([objectValueStyles, objectPopoverStyles]);
    const valueElement = popoverContentElement.createChild("span", "monospace object-value-" + result.type);
    valueElement.style.whiteSpace = "pre";
    if (result.type === "string") {
      UI.UIUtils.createTextChildren(valueElement, `"${description}"`);
    } else {
      valueElement.textContent = description;
    }
    popover.contentElement.appendChild(popoverContentElement);
    return new ObjectPopoverHelper(null, false);
  }
}
const MaxPopoverTextLength = 1e4;
//# sourceMappingURL=ObjectPopoverHelper.js.map
