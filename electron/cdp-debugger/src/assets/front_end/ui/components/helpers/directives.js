import * as LitHtml from "../../lit-html/lit-html.js";
class NodeRenderedCallback extends LitHtml.Directive.Directive {
  constructor(partInfo) {
    super(partInfo);
    if (partInfo.type !== LitHtml.Directive.PartType.ATTRIBUTE) {
      throw new Error("Node rendered callback directive must be used as an attribute.");
    }
  }
  update(part, [callback]) {
    callback(part.element);
  }
  render(_callback) {
  }
}
export const nodeRenderedCallback = LitHtml.Directive.directive(NodeRenderedCallback);
//# sourceMappingURL=directives.js.map
