import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
export class ImagePreviewPopover {
  getLinkElement;
  getDOMNode;
  popover;
  constructor(container, getLinkElement, getDOMNode) {
    this.getLinkElement = getLinkElement;
    this.getDOMNode = getDOMNode;
    this.popover = new UI.PopoverHelper.PopoverHelper(container, this.handleRequest.bind(this));
    this.popover.setHasPadding(true);
    this.popover.setTimeout(0, 100);
  }
  handleRequest(event) {
    const link = this.getLinkElement(event);
    if (!link) {
      return null;
    }
    const href = elementToURLMap.get(link);
    if (!href) {
      return null;
    }
    return {
      box: link.boxInWindow(),
      hide: void 0,
      show: async (popover) => {
        const node = this.getDOMNode(link);
        if (!node) {
          return false;
        }
        const precomputedFeatures = await Components.ImagePreview.ImagePreview.loadDimensionsForNode(node);
        const preview = await Components.ImagePreview.ImagePreview.build(node.domModel().target(), href, true, { imageAltText: void 0, precomputedFeatures });
        if (preview) {
          popover.contentElement.appendChild(preview);
        }
        return Boolean(preview);
      }
    };
  }
  hide() {
    this.popover.hidePopover();
  }
  static setImageUrl(element, url) {
    elementToURLMap.set(element, url);
    return element;
  }
  static getImageURL(element) {
    return elementToURLMap.get(element);
  }
}
const elementToURLMap = /* @__PURE__ */ new WeakMap();
//# sourceMappingURL=ImagePreviewPopover.js.map
