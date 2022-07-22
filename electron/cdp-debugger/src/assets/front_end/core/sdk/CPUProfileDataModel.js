import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import * as Platform from "../platform/platform.js";
import { ProfileNode, ProfileTreeModel } from "./ProfileTreeModel.js";
const UIStrings = {
  devtoolsCpuProfileParserIsFixing: "`DevTools`: `CPU` profile parser is fixing {PH1} missing samples."
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/CPUProfileDataModel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class CPUProfileNode extends ProfileNode {
  id;
  self;
  positionTicks;
  deoptReason;
  constructor(node, sampleTime) {
    const callFrame = node.callFrame || {
      functionName: node["functionName"],
      scriptId: node["scriptId"],
      url: node["url"],
      lineNumber: node["lineNumber"] - 1,
      columnNumber: node["columnNumber"] - 1
    };
    super(callFrame);
    this.id = node.id;
    this.self = (node.hitCount || 0) * sampleTime;
    this.positionTicks = node.positionTicks;
    this.deoptReason = node.deoptReason && node.deoptReason !== "no reason" ? node.deoptReason : null;
  }
}
export class CPUProfileDataModel extends ProfileTreeModel {
  profileStartTime;
  profileEndTime;
  timestamps;
  samples;
  lines;
  totalHitCount;
  profileHead;
  #idToNode;
  gcNode;
  programNode;
  idleNode;
  #stackStartTimes;
  #stackChildrenDuration;
  constructor(profile, target) {
    super(target);
    const isLegacyFormat = Boolean(profile["head"]);
    if (isLegacyFormat) {
      this.profileStartTime = profile.startTime * 1e3;
      this.profileEndTime = profile.endTime * 1e3;
      this.timestamps = profile.timestamps;
      this.compatibilityConversionHeadToNodes(profile);
    } else {
      this.profileStartTime = profile.startTime / 1e3;
      this.profileEndTime = profile.endTime / 1e3;
      this.timestamps = this.convertTimeDeltas(profile);
    }
    this.samples = profile.samples;
    this.lines = profile.lines;
    this.totalHitCount = 0;
    this.profileHead = this.translateProfileTree(profile.nodes);
    this.initialize(this.profileHead);
    this.extractMetaNodes();
    if (this.samples) {
      this.buildIdToNodeMap();
      this.sortSamples();
      this.normalizeTimestamps();
      this.fixMissingSamples();
    }
  }
  compatibilityConversionHeadToNodes(profile) {
    if (!profile.head || profile.nodes) {
      return;
    }
    const nodes = [];
    convertNodesTree(profile.head);
    profile.nodes = nodes;
    delete profile.head;
    function convertNodesTree(node) {
      nodes.push(node);
      node.children = node.children.map(convertNodesTree);
      return node.id;
    }
  }
  convertTimeDeltas(profile) {
    if (!profile.timeDeltas) {
      return [];
    }
    let lastTimeUsec = profile.startTime;
    const timestamps = new Array(profile.timeDeltas.length);
    for (let i = 0; i < profile.timeDeltas.length; ++i) {
      lastTimeUsec += profile.timeDeltas[i];
      timestamps[i] = lastTimeUsec;
    }
    return timestamps;
  }
  translateProfileTree(nodes) {
    function isNativeNode(node) {
      if (node.callFrame) {
        return Boolean(node.callFrame.url) && node.callFrame.url.startsWith("native ");
      }
      return Boolean(node["url"]) && node["url"].startsWith("native ");
    }
    function buildChildrenFromParents(nodes2) {
      if (nodes2[0].children) {
        return;
      }
      nodes2[0].children = [];
      for (let i = 1; i < nodes2.length; ++i) {
        const node = nodes2[i];
        const parentNode = nodeByIdMap.get(node.parent);
        if (parentNode.children) {
          parentNode.children.push(node.id);
        } else {
          parentNode.children = [node.id];
        }
      }
    }
    function buildHitCountFromSamples(nodes2, samples) {
      if (typeof nodes2[0].hitCount === "number") {
        return;
      }
      if (!samples) {
        throw new Error("Error: Neither hitCount nor samples are present in profile.");
      }
      for (let i = 0; i < nodes2.length; ++i) {
        nodes2[i].hitCount = 0;
      }
      for (let i = 0; i < samples.length; ++i) {
        ++nodeByIdMap.get(samples[i]).hitCount;
      }
    }
    const nodeByIdMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i];
      nodeByIdMap.set(node.id, node);
    }
    buildHitCountFromSamples(nodes, this.samples);
    buildChildrenFromParents(nodes);
    this.totalHitCount = nodes.reduce((acc, node) => acc + (node.hitCount || 0), 0);
    const sampleTime = (this.profileEndTime - this.profileStartTime) / this.totalHitCount;
    const keepNatives = Boolean(Common.Settings.Settings.instance().moduleSetting("showNativeFunctionsInJSProfile").get());
    const root = nodes[0];
    const idMap = /* @__PURE__ */ new Map([[root.id, root.id]]);
    const resultRoot = new CPUProfileNode(root, sampleTime);
    if (!root.children) {
      throw new Error("Missing children for root");
    }
    const parentNodeStack = root.children.map(() => resultRoot);
    const sourceNodeStack = root.children.map((id) => nodeByIdMap.get(id));
    while (sourceNodeStack.length) {
      let parentNode = parentNodeStack.pop();
      const sourceNode = sourceNodeStack.pop();
      if (!sourceNode || !parentNode) {
        continue;
      }
      if (!sourceNode.children) {
        sourceNode.children = [];
      }
      const targetNode = new CPUProfileNode(sourceNode, sampleTime);
      if (keepNatives || !isNativeNode(sourceNode)) {
        parentNode.children.push(targetNode);
        parentNode = targetNode;
      } else {
        parentNode.self += targetNode.self;
      }
      idMap.set(sourceNode.id, parentNode.id);
      parentNodeStack.push.apply(parentNodeStack, sourceNode.children.map(() => parentNode));
      sourceNodeStack.push.apply(sourceNodeStack, sourceNode.children.map((id) => nodeByIdMap.get(id)));
    }
    if (this.samples) {
      this.samples = this.samples.map((id) => idMap.get(id));
    }
    return resultRoot;
  }
  sortSamples() {
    const timestamps = this.timestamps;
    if (!timestamps) {
      return;
    }
    const samples = this.samples;
    if (!samples) {
      return;
    }
    const indices = timestamps.map((x, index) => index);
    indices.sort((a, b) => timestamps[a] - timestamps[b]);
    for (let i = 0; i < timestamps.length; ++i) {
      let index = indices[i];
      if (index === i) {
        continue;
      }
      const savedTimestamp = timestamps[i];
      const savedSample = samples[i];
      let currentIndex = i;
      while (index !== i) {
        samples[currentIndex] = samples[index];
        timestamps[currentIndex] = timestamps[index];
        currentIndex = index;
        index = indices[index];
        indices[currentIndex] = currentIndex;
      }
      samples[currentIndex] = savedSample;
      timestamps[currentIndex] = savedTimestamp;
    }
  }
  normalizeTimestamps() {
    if (!this.samples) {
      return;
    }
    let timestamps = this.timestamps;
    if (!timestamps) {
      const profileStartTime = this.profileStartTime;
      const interval = (this.profileEndTime - profileStartTime) / this.samples.length;
      timestamps = new Float64Array(this.samples.length + 1);
      for (let i = 0; i < timestamps.length; ++i) {
        timestamps[i] = profileStartTime + i * interval;
      }
      this.timestamps = timestamps;
      return;
    }
    for (let i = 0; i < timestamps.length; ++i) {
      timestamps[i] /= 1e3;
    }
    if (this.samples.length === timestamps.length) {
      const averageSample = ((timestamps[timestamps.length - 1] || 0) - timestamps[0]) / (timestamps.length - 1);
      this.timestamps.push((timestamps[timestamps.length - 1] || 0) + averageSample);
    }
    this.profileStartTime = timestamps[0];
    this.profileEndTime = timestamps[timestamps.length - 1];
  }
  buildIdToNodeMap() {
    this.#idToNode = /* @__PURE__ */ new Map();
    const idToNode = this.#idToNode;
    const stack = [this.profileHead];
    while (stack.length) {
      const node = stack.pop();
      idToNode.set(node.id, node);
      stack.push.apply(stack, node.children);
    }
  }
  extractMetaNodes() {
    const topLevelNodes = this.profileHead.children;
    for (let i = 0; i < topLevelNodes.length && !(this.gcNode && this.programNode && this.idleNode); i++) {
      const node = topLevelNodes[i];
      if (node.functionName === "(garbage collector)") {
        this.gcNode = node;
      } else if (node.functionName === "(program)") {
        this.programNode = node;
      } else if (node.functionName === "(idle)") {
        this.idleNode = node;
      }
    }
  }
  fixMissingSamples() {
    const samples = this.samples;
    if (!samples) {
      return;
    }
    const samplesCount = samples.length;
    if (!this.programNode || samplesCount < 3) {
      return;
    }
    const idToNode = this.#idToNode;
    const programNodeId = this.programNode.id;
    const gcNodeId = this.gcNode ? this.gcNode.id : -1;
    const idleNodeId = this.idleNode ? this.idleNode.id : -1;
    let prevNodeId = samples[0];
    let nodeId = samples[1];
    let count = 0;
    for (let sampleIndex = 1; sampleIndex < samplesCount - 1; sampleIndex++) {
      const nextNodeId = samples[sampleIndex + 1];
      if (nodeId === programNodeId && !isSystemNode(prevNodeId) && !isSystemNode(nextNodeId) && bottomNode(idToNode.get(prevNodeId)) === bottomNode(idToNode.get(nextNodeId))) {
        ++count;
        samples[sampleIndex] = prevNodeId;
      }
      prevNodeId = nodeId;
      nodeId = nextNodeId;
    }
    if (count) {
      Common.Console.Console.instance().warn(i18nString(UIStrings.devtoolsCpuProfileParserIsFixing, { PH1: count }));
    }
    function bottomNode(node) {
      while (node.parent && node.parent.parent) {
        node = node.parent;
      }
      return node;
    }
    function isSystemNode(nodeId2) {
      return nodeId2 === programNodeId || nodeId2 === gcNodeId || nodeId2 === idleNodeId;
    }
  }
  forEachFrame(openFrameCallback, closeFrameCallback, startTime, stopTime) {
    if (!this.profileHead || !this.samples) {
      return;
    }
    startTime = startTime || 0;
    stopTime = stopTime || Infinity;
    const samples = this.samples;
    const timestamps = this.timestamps;
    const idToNode = this.#idToNode;
    const gcNode = this.gcNode;
    const samplesCount = samples.length;
    const startIndex = Platform.ArrayUtilities.lowerBound(timestamps, startTime, Platform.ArrayUtilities.DEFAULT_COMPARATOR);
    let stackTop = 0;
    const stackNodes = [];
    let prevId = this.profileHead.id;
    let sampleTime;
    let gcParentNode = null;
    const stackDepth = this.maxDepth + 3;
    if (!this.#stackStartTimes) {
      this.#stackStartTimes = new Float64Array(stackDepth);
    }
    const stackStartTimes = this.#stackStartTimes;
    if (!this.#stackChildrenDuration) {
      this.#stackChildrenDuration = new Float64Array(stackDepth);
    }
    const stackChildrenDuration = this.#stackChildrenDuration;
    let node;
    let sampleIndex;
    for (sampleIndex = startIndex; sampleIndex < samplesCount; sampleIndex++) {
      sampleTime = timestamps[sampleIndex];
      if (sampleTime >= stopTime) {
        break;
      }
      const id = samples[sampleIndex];
      if (id === prevId) {
        continue;
      }
      node = idToNode.get(id);
      let prevNode = idToNode.get(prevId);
      if (node === gcNode) {
        gcParentNode = prevNode;
        openFrameCallback(gcParentNode.depth + 1, gcNode, sampleTime);
        stackStartTimes[++stackTop] = sampleTime;
        stackChildrenDuration[stackTop] = 0;
        prevId = id;
        continue;
      }
      if (prevNode === gcNode && gcParentNode) {
        const start = stackStartTimes[stackTop];
        const duration = sampleTime - start;
        stackChildrenDuration[stackTop - 1] += duration;
        closeFrameCallback(gcParentNode.depth + 1, gcNode, start, duration, duration - stackChildrenDuration[stackTop]);
        --stackTop;
        prevNode = gcParentNode;
        prevId = prevNode.id;
        gcParentNode = null;
      }
      while (node && node.depth > prevNode.depth) {
        stackNodes.push(node);
        node = node.parent;
      }
      while (prevNode !== node) {
        const start = stackStartTimes[stackTop];
        const duration = sampleTime - start;
        stackChildrenDuration[stackTop - 1] += duration;
        closeFrameCallback(prevNode.depth, prevNode, start, duration, duration - stackChildrenDuration[stackTop]);
        --stackTop;
        if (node && node.depth === prevNode.depth) {
          stackNodes.push(node);
          node = node.parent;
        }
        prevNode = prevNode.parent;
      }
      while (stackNodes.length) {
        const currentNode = stackNodes.pop();
        node = currentNode;
        openFrameCallback(currentNode.depth, currentNode, sampleTime);
        stackStartTimes[++stackTop] = sampleTime;
        stackChildrenDuration[stackTop] = 0;
      }
      prevId = id;
    }
    sampleTime = timestamps[sampleIndex] || this.profileEndTime;
    if (gcParentNode && idToNode.get(prevId) === gcNode) {
      const start = stackStartTimes[stackTop];
      const duration = sampleTime - start;
      stackChildrenDuration[stackTop - 1] += duration;
      closeFrameCallback(gcParentNode.depth + 1, node, start, duration, duration - stackChildrenDuration[stackTop]);
      --stackTop;
      prevId = gcParentNode.id;
    }
    for (let node2 = idToNode.get(prevId); node2 && node2.parent; node2 = node2.parent) {
      const start = stackStartTimes[stackTop];
      const duration = sampleTime - start;
      stackChildrenDuration[stackTop - 1] += duration;
      closeFrameCallback(node2.depth, node2, start, duration, duration - stackChildrenDuration[stackTop]);
      --stackTop;
    }
  }
  nodeByIndex(index) {
    return this.samples && this.#idToNode.get(this.samples[index]) || null;
  }
}
//# sourceMappingURL=CPUProfileDataModel.js.map
