import * as UI from "../../../ui/legacy/legacy.js";
import {
  BottomPaddingWithoutParam,
  BottomPaddingWithParam,
  LeftMarginOfText,
  LeftSideTopPadding,
  NodeLabelFontStyle,
  ParamLabelFontStyle,
  PortTypes,
  RightMarginOfText,
  TotalInputPortHeight,
  TotalOutputPortHeight,
  TotalParamPortHeight
} from "./GraphStyle.js";
import { calculateInputPortXY, calculateOutputPortXY, calculateParamPortXY } from "./NodeRendererUtility.js";
export class NodeView {
  id;
  type;
  numberOfInputs;
  numberOfOutputs;
  label;
  size;
  position;
  layout;
  ports;
  constructor(data, label) {
    this.id = data.nodeId;
    this.type = data.nodeType;
    this.numberOfInputs = data.numberOfInputs;
    this.numberOfOutputs = data.numberOfOutputs;
    this.label = label;
    this.size = { width: 0, height: 0 };
    this.position = null;
    this.layout = {
      inputPortSectionHeight: 0,
      outputPortSectionHeight: 0,
      maxTextLength: 0,
      totalHeight: 0
    };
    this.ports = /* @__PURE__ */ new Map();
    this.initialize(data);
  }
  initialize(data) {
    this.updateNodeLayoutAfterAddingNode(data);
    this.setupInputPorts();
    this.setupOutputPorts();
  }
  addParamPort(paramId, paramType) {
    const paramPorts = this.getPortsByType(PortTypes.Param);
    const numberOfParams = paramPorts.length;
    const { x, y } = calculateParamPortXY(numberOfParams, this.layout.inputPortSectionHeight);
    this.addPort({
      id: generateParamPortId(this.id, paramId),
      type: PortTypes.Param,
      label: paramType,
      x,
      y
    });
    this.updateNodeLayoutAfterAddingParam(numberOfParams + 1, paramType);
    this.setupOutputPorts();
  }
  getPortsByType(type) {
    const result = [];
    this.ports.forEach((port) => {
      if (port.type === type) {
        result.push(port);
      }
    });
    return result;
  }
  updateNodeLayoutAfterAddingNode(data) {
    const inputPortSectionHeight = TotalInputPortHeight * Math.max(1, data.numberOfInputs) + LeftSideTopPadding;
    this.layout.inputPortSectionHeight = inputPortSectionHeight;
    this.layout.outputPortSectionHeight = TotalOutputPortHeight * data.numberOfOutputs;
    this.layout.totalHeight = Math.max(inputPortSectionHeight + BottomPaddingWithoutParam, this.layout.outputPortSectionHeight);
    const nodeLabelLength = measureTextWidth(this.label, NodeLabelFontStyle);
    this.layout.maxTextLength = Math.max(this.layout.maxTextLength, nodeLabelLength);
    this.updateNodeSize();
  }
  updateNodeLayoutAfterAddingParam(numberOfParams, paramType) {
    const leftSideMaxHeight = this.layout.inputPortSectionHeight + numberOfParams * TotalParamPortHeight + BottomPaddingWithParam;
    this.layout.totalHeight = Math.max(leftSideMaxHeight, this.layout.outputPortSectionHeight);
    const paramLabelLength = measureTextWidth(paramType, ParamLabelFontStyle);
    this.layout.maxTextLength = Math.max(this.layout.maxTextLength, paramLabelLength);
    this.updateNodeSize();
  }
  updateNodeSize() {
    this.size = {
      width: Math.ceil(LeftMarginOfText + this.layout.maxTextLength + RightMarginOfText),
      height: this.layout.totalHeight
    };
  }
  setupInputPorts() {
    for (let i = 0; i < this.numberOfInputs; i++) {
      const { x, y } = calculateInputPortXY(i);
      this.addPort({ id: generateInputPortId(this.id, i), type: PortTypes.In, x, y, label: void 0 });
    }
  }
  setupOutputPorts() {
    for (let i = 0; i < this.numberOfOutputs; i++) {
      const portId = generateOutputPortId(this.id, i);
      const { x, y } = calculateOutputPortXY(i, this.size, this.numberOfOutputs);
      if (this.ports.has(portId)) {
        const port = this.ports.get(portId);
        if (!port) {
          throw new Error(`Unable to find port with id ${portId}`);
        }
        port.x = x;
        port.y = y;
      } else {
        this.addPort({ id: portId, type: PortTypes.Out, x, y, label: void 0 });
      }
    }
  }
  addPort(port) {
    this.ports.set(port.id, port);
  }
}
export const generateInputPortId = (nodeId, inputIndex) => {
  return `${nodeId}-input-${inputIndex || 0}`;
};
export const generateOutputPortId = (nodeId, outputIndex) => {
  return `${nodeId}-output-${outputIndex || 0}`;
};
export const generateParamPortId = (nodeId, paramId) => {
  return `${nodeId}-param-${paramId}`;
};
export class NodeLabelGenerator {
  totalNumberOfNodes;
  constructor() {
    this.totalNumberOfNodes = 0;
  }
  generateLabel(nodeType) {
    if (nodeType.endsWith("Node")) {
      nodeType = nodeType.slice(0, nodeType.length - 4);
    }
    this.totalNumberOfNodes += 1;
    const label = `${nodeType} ${this.totalNumberOfNodes}`;
    return label;
  }
}
let _contextForFontTextMeasuring;
export const measureTextWidth = (text, fontStyle) => {
  if (!_contextForFontTextMeasuring) {
    const context2 = document.createElement("canvas").getContext("2d");
    if (!context2) {
      throw new Error("Unable to create canvas context.");
    }
    _contextForFontTextMeasuring = context2;
  }
  const context = _contextForFontTextMeasuring;
  context.save();
  if (fontStyle) {
    context.font = fontStyle;
  }
  const width = UI.UIUtils.measureTextWidth(context, text);
  context.restore();
  return width;
};
//# sourceMappingURL=NodeView.js.map
