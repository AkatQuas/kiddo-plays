import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import domLinkifierStyles from "./domLinkifier.css.js";
const UIStrings = {
  node: "<node>"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/DOMLinkifier.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export const decorateNodeLabel = function(node, parentElement, tooltipContent) {
  const originalNode = node;
  const isPseudo = node.nodeType() === Node.ELEMENT_NODE && node.pseudoType();
  if (isPseudo && node.parentNode) {
    node = node.parentNode;
  }
  let title = node.nodeNameInCorrectCase();
  const nameElement = parentElement.createChild("span", "node-label-name");
  nameElement.textContent = title;
  const idAttribute = node.getAttribute("id");
  if (idAttribute) {
    const idElement = parentElement.createChild("span", "node-label-id");
    const part = "#" + idAttribute;
    title += part;
    UI.UIUtils.createTextChild(idElement, part);
    nameElement.classList.add("extra");
  }
  const classAttribute = node.getAttribute("class");
  if (classAttribute) {
    const classes = classAttribute.split(/\s+/);
    if (classes.length) {
      const foundClasses = /* @__PURE__ */ new Set();
      const classesElement = parentElement.createChild("span", "extra node-label-class");
      for (let i = 0; i < classes.length; ++i) {
        const className = classes[i];
        if (className && !foundClasses.has(className)) {
          const part = "." + className;
          title += part;
          UI.UIUtils.createTextChild(classesElement, part);
          foundClasses.add(className);
        }
      }
    }
  }
  if (isPseudo) {
    const pseudoElement = parentElement.createChild("span", "extra node-label-pseudo");
    const pseudoText = "::" + originalNode.pseudoType();
    UI.UIUtils.createTextChild(pseudoElement, pseudoText);
    title += pseudoText;
  }
  UI.Tooltip.Tooltip.install(parentElement, tooltipContent || title);
};
export const linkifyNodeReference = function(node, options = {
  tooltip: void 0,
  preventKeyboardFocus: void 0
}) {
  if (!node) {
    return document.createTextNode(i18nString(UIStrings.node));
  }
  const root = document.createElement("span");
  root.classList.add("monospace");
  const shadowRoot = UI.Utils.createShadowRootWithCoreStyles(root, { cssFile: [domLinkifierStyles], delegatesFocus: void 0 });
  const link = shadowRoot.createChild("div", "node-link");
  decorateNodeLabel(node, link, options.tooltip);
  link.addEventListener("click", () => {
    void Common.Revealer.reveal(node, false);
    return false;
  }, false);
  link.addEventListener("mouseover", node.highlight.bind(node, void 0), false);
  link.addEventListener("mouseleave", () => SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight(), false);
  if (!options.preventKeyboardFocus) {
    link.addEventListener("keydown", (event) => event.key === "Enter" && Common.Revealer.reveal(node, false) && false);
    link.tabIndex = 0;
    UI.ARIAUtils.markAsLink(link);
  }
  return root;
};
export const linkifyDeferredNodeReference = function(deferredNode, options = {
  tooltip: void 0,
  preventKeyboardFocus: void 0
}) {
  const root = document.createElement("div");
  const shadowRoot = UI.Utils.createShadowRootWithCoreStyles(root, { cssFile: [domLinkifierStyles], delegatesFocus: void 0 });
  const link = shadowRoot.createChild("div", "node-link");
  link.createChild("slot");
  link.addEventListener("click", deferredNode.resolve.bind(deferredNode, onDeferredNodeResolved), false);
  link.addEventListener("mousedown", (e) => e.consume(), false);
  if (!options.preventKeyboardFocus) {
    link.addEventListener("keydown", (event) => event.key === "Enter" && deferredNode.resolve(onDeferredNodeResolved));
    link.tabIndex = 0;
    UI.ARIAUtils.markAsLink(link);
  }
  function onDeferredNodeResolved(node) {
    void Common.Revealer.reveal(node);
  }
  return root;
};
let linkifierInstance;
export class Linkifier {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!linkifierInstance || forceNew) {
      linkifierInstance = new Linkifier();
    }
    return linkifierInstance;
  }
  linkify(object, options) {
    if (object instanceof SDK.DOMModel.DOMNode) {
      return linkifyNodeReference(object, options);
    }
    if (object instanceof SDK.DOMModel.DeferredDOMNode) {
      return linkifyDeferredNodeReference(object, options);
    }
    throw new Error("Can't linkify non-node");
  }
}
//# sourceMappingURL=DOMLinkifier.js.map
