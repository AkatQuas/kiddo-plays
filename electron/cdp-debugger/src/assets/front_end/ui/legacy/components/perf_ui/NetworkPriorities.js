import * as i18n from "../../../../core/i18n/i18n.js";
import * as Protocol from "../../../../generated/protocol.js";
const UIStrings = {
  lowest: "Lowest",
  low: "Low",
  medium: "Medium",
  high: "High",
  highest: "Highest"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/perf_ui/NetworkPriorities.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export function uiLabelForNetworkPriority(priority) {
  return priorityUILabelMap().get(priority) || "";
}
const uiLabelToPriorityMapInstance = /* @__PURE__ */ new Map();
export function uiLabelToNetworkPriority(priorityLabel) {
  if (uiLabelToPriorityMapInstance.size === 0) {
    priorityUILabelMap().forEach((value, key) => uiLabelToPriorityMapInstance.set(value, key));
  }
  return uiLabelToPriorityMapInstance.get(priorityLabel) || "";
}
let _priorityUILabelMapInstance;
export function priorityUILabelMap() {
  if (_priorityUILabelMapInstance) {
    return _priorityUILabelMapInstance;
  }
  const map = /* @__PURE__ */ new Map();
  map.set(Protocol.Network.ResourcePriority.VeryLow, i18nString(UIStrings.lowest));
  map.set(Protocol.Network.ResourcePriority.Low, i18nString(UIStrings.low));
  map.set(Protocol.Network.ResourcePriority.Medium, i18nString(UIStrings.medium));
  map.set(Protocol.Network.ResourcePriority.High, i18nString(UIStrings.high));
  map.set(Protocol.Network.ResourcePriority.VeryHigh, i18nString(UIStrings.highest));
  _priorityUILabelMapInstance = map;
  return map;
}
const networkPriorityWeights = /* @__PURE__ */ new Map();
export function networkPriorityWeight(priority) {
  if (networkPriorityWeights.size === 0) {
    networkPriorityWeights.set(Protocol.Network.ResourcePriority.VeryLow, 1);
    networkPriorityWeights.set(Protocol.Network.ResourcePriority.Low, 2);
    networkPriorityWeights.set(Protocol.Network.ResourcePriority.Medium, 3);
    networkPriorityWeights.set(Protocol.Network.ResourcePriority.High, 4);
    networkPriorityWeights.set(Protocol.Network.ResourcePriority.VeryHigh, 5);
  }
  return networkPriorityWeights.get(priority) || 0;
}
//# sourceMappingURL=NetworkPriorities.js.map
