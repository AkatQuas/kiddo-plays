import { generateInputPortId, generateOutputPortId, generateParamPortId } from "./NodeView.js";
export class EdgeView {
  id;
  type;
  sourceId;
  destinationId;
  sourcePortId;
  destinationPortId;
  constructor(data, type) {
    const edgePortsIds = generateEdgePortIdsByData(data, type);
    if (!edgePortsIds) {
      throw new Error("Unable to generate edge port IDs");
    }
    const { edgeId, sourcePortId, destinationPortId } = edgePortsIds;
    this.id = edgeId;
    this.type = type;
    this.sourceId = data.sourceId;
    this.destinationId = data.destinationId;
    this.sourcePortId = sourcePortId;
    this.destinationPortId = destinationPortId;
  }
}
export const generateEdgePortIdsByData = (data, type) => {
  if (!data.sourceId || !data.destinationId) {
    console.error(`Undefined node message: ${JSON.stringify(data)}`);
    return null;
  }
  const sourcePortId = generateOutputPortId(data.sourceId, data.sourceOutputIndex);
  const destinationPortId = getDestinationPortId(data, type);
  return {
    edgeId: `${sourcePortId}->${destinationPortId}`,
    sourcePortId,
    destinationPortId
  };
  function getDestinationPortId(data2, type2) {
    if (type2 === EdgeTypes.NodeToNode) {
      const portData = data2;
      return generateInputPortId(data2.destinationId, portData.destinationInputIndex);
    }
    if (type2 === EdgeTypes.NodeToParam) {
      const portData = data2;
      return generateParamPortId(data2.destinationId, portData.destinationParamId);
    }
    console.error(`Unknown edge type: ${type2}`);
    return "";
  }
};
export var EdgeTypes = /* @__PURE__ */ ((EdgeTypes2) => {
  EdgeTypes2["NodeToNode"] = "NodeToNode";
  EdgeTypes2["NodeToParam"] = "NodeToParam";
  return EdgeTypes2;
})(EdgeTypes || {});
//# sourceMappingURL=EdgeView.js.map
