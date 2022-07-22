import {
  AudioParamRadius,
  InputPortRadius,
  LeftSideTopPadding,
  TotalInputPortHeight,
  TotalOutputPortHeight,
  TotalParamPortHeight
} from "./GraphStyle.js";
export const calculateInputPortXY = (portIndex) => {
  const y = InputPortRadius + LeftSideTopPadding + portIndex * TotalInputPortHeight;
  return { x: 0, y };
};
export const calculateOutputPortXY = (portIndex, nodeSize, numberOfOutputs) => {
  const { width, height } = nodeSize;
  const outputPortY = height / 2 + (2 * portIndex - numberOfOutputs + 1) * TotalOutputPortHeight / 2;
  return { x: width, y: outputPortY };
};
export const calculateParamPortXY = (portIndex, offsetY) => {
  const paramPortY = offsetY + TotalParamPortHeight * (portIndex + 1) - AudioParamRadius;
  return { x: 0, y: paramPortY };
};
//# sourceMappingURL=NodeRendererUtility.js.map
