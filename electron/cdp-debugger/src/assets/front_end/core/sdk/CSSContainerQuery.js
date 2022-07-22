import * as TextUtils from "../../models/text_utils/text_utils.js";
import { CSSQuery } from "./CSSQuery.js";
export class CSSContainerQuery extends CSSQuery {
  name;
  static parseContainerQueriesPayload(cssModel, payload) {
    return payload.map((cq) => new CSSContainerQuery(cssModel, cq));
  }
  constructor(cssModel, payload) {
    super(cssModel);
    this.reinitialize(payload);
  }
  reinitialize(payload) {
    this.text = payload.text;
    this.range = payload.range ? TextUtils.TextRange.TextRange.fromObject(payload.range) : null;
    this.styleSheetId = payload.styleSheetId;
    this.name = payload.name;
  }
  active() {
    return true;
  }
  async getContainerForNode(nodeId) {
    const containerNode = await this.cssModel.domModel().getContainerForNode(nodeId, this.name);
    if (!containerNode) {
      return;
    }
    return new CSSContainerQueryContainer(containerNode);
  }
}
export class CSSContainerQueryContainer {
  containerNode;
  constructor(containerNode) {
    this.containerNode = containerNode;
  }
  async getContainerSizeDetails() {
    const styles = await this.containerNode.domModel().cssModel().getComputedStyle(this.containerNode.id);
    if (!styles) {
      return;
    }
    const containerType = styles.get("container-type");
    const contain = styles.get("contain");
    const writingMode = styles.get("writing-mode");
    if (!containerType || !contain || !writingMode) {
      return;
    }
    const queryAxis = getQueryAxis(`${containerType} ${contain}`);
    const physicalAxis = getPhysicalAxisFromQueryAxis(queryAxis, writingMode);
    let width, height;
    if (physicalAxis === PhysicalAxis.Both || physicalAxis === PhysicalAxis.Horizontal) {
      width = styles.get("width");
    }
    if (physicalAxis === PhysicalAxis.Both || physicalAxis === PhysicalAxis.Vertical) {
      height = styles.get("height");
    }
    return {
      queryAxis,
      physicalAxis,
      width,
      height
    };
  }
}
export const getQueryAxis = (propertyValue) => {
  const segments = propertyValue.split(" ");
  let isInline = false;
  let isBlock = false;
  for (const segment of segments) {
    if (segment === "size") {
      return QueryAxis.Both;
    }
    isInline = isInline || segment === "inline-size";
    isBlock = isBlock || segment === "block-size";
  }
  if (isInline && isBlock) {
    return QueryAxis.Both;
  }
  if (isInline) {
    return QueryAxis.Inline;
  }
  if (isBlock) {
    return QueryAxis.Block;
  }
  return QueryAxis.None;
};
export const getPhysicalAxisFromQueryAxis = (queryAxis, writingMode) => {
  const isVerticalWritingMode = writingMode.startsWith("vertical");
  switch (queryAxis) {
    case QueryAxis.None:
      return PhysicalAxis.None;
    case QueryAxis.Both:
      return PhysicalAxis.Both;
    case QueryAxis.Inline:
      return isVerticalWritingMode ? PhysicalAxis.Vertical : PhysicalAxis.Horizontal;
    case QueryAxis.Block:
      return isVerticalWritingMode ? PhysicalAxis.Horizontal : PhysicalAxis.Vertical;
  }
};
export var QueryAxis = /* @__PURE__ */ ((QueryAxis2) => {
  QueryAxis2["None"] = "";
  QueryAxis2["Inline"] = "inline-size";
  QueryAxis2["Block"] = "block-size";
  QueryAxis2["Both"] = "size";
  return QueryAxis2;
})(QueryAxis || {});
export var PhysicalAxis = /* @__PURE__ */ ((PhysicalAxis2) => {
  PhysicalAxis2["None"] = "";
  PhysicalAxis2["Horizontal"] = "Horizontal";
  PhysicalAxis2["Vertical"] = "Vertical";
  PhysicalAxis2["Both"] = "Both";
  return PhysicalAxis2;
})(PhysicalAxis || {});
//# sourceMappingURL=CSSContainerQuery.js.map
