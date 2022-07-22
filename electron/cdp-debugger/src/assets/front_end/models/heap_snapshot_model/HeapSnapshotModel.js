export const HeapSnapshotProgressEvent = {
  Update: "ProgressUpdate",
  BrokenSnapshot: "BrokenSnapshot"
};
export const baseSystemDistance = 1e8;
export class AllocationNodeCallers {
  nodesWithSingleCaller;
  branchingCallers;
  constructor(nodesWithSingleCaller, branchingCallers) {
    this.nodesWithSingleCaller = nodesWithSingleCaller;
    this.branchingCallers = branchingCallers;
  }
}
export class SerializedAllocationNode {
  id;
  name;
  scriptName;
  scriptId;
  line;
  column;
  count;
  size;
  liveCount;
  liveSize;
  hasChildren;
  constructor(nodeId, functionName, scriptName, scriptId, line, column, count, size, liveCount, liveSize, hasChildren) {
    this.id = nodeId;
    this.name = functionName;
    this.scriptName = scriptName;
    this.scriptId = scriptId;
    this.line = line;
    this.column = column;
    this.count = count;
    this.size = size;
    this.liveCount = liveCount;
    this.liveSize = liveSize;
    this.hasChildren = hasChildren;
  }
}
export class AllocationStackFrame {
  functionName;
  scriptName;
  scriptId;
  line;
  column;
  constructor(functionName, scriptName, scriptId, line, column) {
    this.functionName = functionName;
    this.scriptName = scriptName;
    this.scriptId = scriptId;
    this.line = line;
    this.column = column;
  }
}
export class Node {
  id;
  name;
  distance;
  nodeIndex;
  retainedSize;
  selfSize;
  type;
  canBeQueried;
  detachedDOMTreeNode;
  isAddedNotRemoved;
  constructor(id, name, distance, nodeIndex, retainedSize, selfSize, type) {
    this.id = id;
    this.name = name;
    this.distance = distance;
    this.nodeIndex = nodeIndex;
    this.retainedSize = retainedSize;
    this.selfSize = selfSize;
    this.type = type;
    this.canBeQueried = false;
    this.detachedDOMTreeNode = false;
    this.isAddedNotRemoved = null;
  }
}
export class Edge {
  name;
  node;
  type;
  edgeIndex;
  isAddedNotRemoved;
  constructor(name, node, type, edgeIndex) {
    this.name = name;
    this.node = node;
    this.type = type;
    this.edgeIndex = edgeIndex;
    this.isAddedNotRemoved = null;
  }
}
export class Aggregate {
  count;
  distance;
  self;
  maxRet;
  type;
  name;
  idxs;
  constructor() {
  }
}
export class AggregateForDiff {
  indexes;
  ids;
  selfSizes;
  constructor() {
    this.indexes = [];
    this.ids = [];
    this.selfSizes = [];
  }
}
export class Diff {
  addedCount;
  removedCount;
  addedSize;
  removedSize;
  deletedIndexes;
  addedIndexes;
  countDelta;
  sizeDelta;
  constructor() {
    this.addedCount = 0;
    this.removedCount = 0;
    this.addedSize = 0;
    this.removedSize = 0;
    this.deletedIndexes = [];
    this.addedIndexes = [];
  }
}
export class DiffForClass {
  addedCount;
  removedCount;
  addedSize;
  removedSize;
  deletedIndexes;
  addedIndexes;
  countDelta;
  sizeDelta;
  constructor() {
  }
}
export class ComparatorConfig {
  fieldName1;
  ascending1;
  fieldName2;
  ascending2;
  constructor(fieldName1, ascending1, fieldName2, ascending2) {
    this.fieldName1 = fieldName1;
    this.ascending1 = ascending1;
    this.fieldName2 = fieldName2;
    this.ascending2 = ascending2;
  }
}
export class WorkerCommand {
  callId;
  disposition;
  objectId;
  newObjectId;
  methodName;
  methodArguments;
  source;
  constructor() {
  }
}
export class ItemsRange {
  startPosition;
  endPosition;
  totalLength;
  items;
  constructor(startPosition, endPosition, totalLength, items) {
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.totalLength = totalLength;
    this.items = items;
  }
}
export class StaticData {
  nodeCount;
  rootNodeIndex;
  totalSize;
  maxJSObjectId;
  constructor(nodeCount, rootNodeIndex, totalSize, maxJSObjectId) {
    this.nodeCount = nodeCount;
    this.rootNodeIndex = rootNodeIndex;
    this.totalSize = totalSize;
    this.maxJSObjectId = maxJSObjectId;
  }
}
export class Statistics {
  total;
  v8heap;
  native;
  code;
  jsArrays;
  strings;
  system;
  constructor() {
  }
}
export class NodeFilter {
  minNodeId;
  maxNodeId;
  allocationNodeId;
  constructor(minNodeId, maxNodeId) {
    this.minNodeId = minNodeId;
    this.maxNodeId = maxNodeId;
  }
  equals(o) {
    return this.minNodeId === o.minNodeId && this.maxNodeId === o.maxNodeId && this.allocationNodeId === o.allocationNodeId;
  }
}
export class SearchConfig {
  query;
  caseSensitive;
  isRegex;
  shouldJump;
  jumpBackward;
  constructor(query, caseSensitive, isRegex, shouldJump, jumpBackward) {
    this.query = query;
    this.caseSensitive = caseSensitive;
    this.isRegex = isRegex;
    this.shouldJump = shouldJump;
    this.jumpBackward = jumpBackward;
  }
  toSearchRegex(_global) {
    throw new Error("Unsupported operation on search config");
  }
}
export class Samples {
  timestamps;
  lastAssignedIds;
  sizes;
  constructor(timestamps, lastAssignedIds, sizes) {
    this.timestamps = timestamps;
    this.lastAssignedIds = lastAssignedIds;
    this.sizes = sizes;
  }
}
export class Location {
  scriptId;
  lineNumber;
  columnNumber;
  constructor(scriptId, lineNumber, columnNumber) {
    this.scriptId = scriptId;
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
  }
}
//# sourceMappingURL=HeapSnapshotModel.js.map
