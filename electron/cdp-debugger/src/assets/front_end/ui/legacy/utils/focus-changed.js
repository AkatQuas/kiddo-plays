import * as Platform from "../../../core/platform/platform.js";
function WidgetfocusWidgetForNode(node) {
  while (node) {
    if (node.__widget) {
      break;
    }
    node = node.parentNodeOrShadowHost();
  }
  if (!node) {
    return;
  }
  let widget = node.__widget;
  while (widget && widget.parentWidget()) {
    const parentWidget = widget.parentWidget();
    if (!parentWidget) {
      break;
    }
    parentWidget.defaultFocusedChild = widget;
    widget = parentWidget;
  }
}
function XWidgetfocusWidgetForNode(node) {
  node = node && node.parentNodeOrShadowHost();
  const XWidgetCtor = customElements.get("x-widget");
  let widget = null;
  while (node) {
    if (XWidgetCtor && node instanceof XWidgetCtor) {
      if (widget) {
        node.defaultFocusedElement = widget;
      }
      widget = node;
    }
    node = node.parentNodeOrShadowHost();
  }
}
export function focusChanged(event) {
  const target = event.target;
  const document = target ? target.ownerDocument : null;
  const element = document ? Platform.DOMUtilities.deepActiveElement(document) : null;
  WidgetfocusWidgetForNode(element);
  XWidgetfocusWidgetForNode(element);
}
//# sourceMappingURL=focus-changed.js.map
