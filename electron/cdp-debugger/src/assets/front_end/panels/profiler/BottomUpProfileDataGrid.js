import * as Platform from "../../core/platform/platform.js";
import { ProfileDataGridNode, ProfileDataGridTree } from "./ProfileDataGrid.js";
export class BottomUpProfileDataGridNode extends ProfileDataGridNode {
  remainingNodeInfos;
  constructor(profileNode, owningTree) {
    super(profileNode, owningTree, profileNode.parent !== null && Boolean(profileNode.parent.parent));
    this.remainingNodeInfos = [];
  }
  static sharedPopulate(container) {
    if (container.remainingNodeInfos === void 0) {
      return;
    }
    const remainingNodeInfos = container.remainingNodeInfos;
    const count = remainingNodeInfos.length;
    for (let index = 0; index < count; ++index) {
      const nodeInfo = remainingNodeInfos[index];
      const ancestor = nodeInfo.ancestor;
      const focusNode = nodeInfo.focusNode;
      let child = container.findChild(ancestor);
      if (child) {
        const totalAccountedFor = nodeInfo.totalAccountedFor;
        child.self += focusNode.self;
        if (!totalAccountedFor) {
          child.total += focusNode.total;
        }
      } else {
        child = new BottomUpProfileDataGridNode(ancestor, container.tree);
        if (ancestor !== focusNode) {
          child.self = focusNode.self;
          child.total = focusNode.total;
        }
        container.appendChild(child);
      }
      const parent = ancestor.parent;
      if (parent && parent.parent) {
        nodeInfo.ancestor = parent;
        if (!child.remainingNodeInfos) {
          child.remainingNodeInfos = [];
        }
        child.remainingNodeInfos.push(nodeInfo);
      }
    }
    delete container.remainingNodeInfos;
  }
  takePropertiesFromProfileDataGridNode(profileDataGridNode) {
    this.save();
    this.self = profileDataGridNode.self;
    this.total = profileDataGridNode.total;
  }
  keepOnlyChild(child) {
    this.save();
    this.removeChildren();
    this.appendChild(child);
  }
  exclude(aCallUID) {
    if (this.remainingNodeInfos) {
      this.populate();
    }
    this.save();
    const children = this.children;
    let index = this.children.length;
    while (index--) {
      children[index].exclude(aCallUID);
    }
    const child = this.childrenByCallUID.get(aCallUID);
    if (child) {
      this.merge(child, true);
    }
  }
  restore() {
    super.restore();
    if (!this.children.length) {
      this.setHasChildren(this.willHaveChildren(this.profileNode));
    }
  }
  merge(child, shouldAbsorb) {
    this.self -= child.self;
    super.merge(child, shouldAbsorb);
  }
  populateChildren() {
    BottomUpProfileDataGridNode.sharedPopulate(this);
  }
  willHaveChildren(profileNode) {
    return Boolean(profileNode.parent && profileNode.parent.parent);
  }
}
export class BottomUpProfileDataGridTree extends ProfileDataGridTree {
  deepSearch;
  remainingNodeInfos;
  constructor(formatter, searchableView, rootProfileNode, total) {
    super(formatter, searchableView, total);
    this.deepSearch = false;
    let profileNodeUIDs = 0;
    const profileNodeGroups = [[], [rootProfileNode]];
    const visitedProfileNodesForCallUID = /* @__PURE__ */ new Map();
    this.remainingNodeInfos = [];
    for (let profileNodeGroupIndex = 0; profileNodeGroupIndex < profileNodeGroups.length; ++profileNodeGroupIndex) {
      const parentProfileNodes = profileNodeGroups[profileNodeGroupIndex];
      const profileNodes = profileNodeGroups[++profileNodeGroupIndex];
      const count = profileNodes.length;
      const profileNodeUIDValues = /* @__PURE__ */ new WeakMap();
      for (let index = 0; index < count; ++index) {
        const profileNode = profileNodes[index];
        if (!profileNodeUIDValues.get(profileNode)) {
          profileNodeUIDValues.set(profileNode, ++profileNodeUIDs);
        }
        if (profileNode.parent) {
          let visitedNodes = visitedProfileNodesForCallUID.get(profileNode.callUID);
          let totalAccountedFor = false;
          if (!visitedNodes) {
            visitedNodes = /* @__PURE__ */ new Set();
            visitedProfileNodesForCallUID.set(profileNode.callUID, visitedNodes);
          } else {
            const parentCount = parentProfileNodes.length;
            for (let parentIndex = 0; parentIndex < parentCount; ++parentIndex) {
              const parentUID = profileNodeUIDValues.get(parentProfileNodes[parentIndex]);
              if (parentUID && visitedNodes.has(parentUID)) {
                totalAccountedFor = true;
                break;
              }
            }
          }
          const uid = profileNodeUIDValues.get(profileNode);
          if (uid) {
            visitedNodes.add(uid);
          }
          this.remainingNodeInfos.push({ ancestor: profileNode, focusNode: profileNode, totalAccountedFor });
        }
        const children = profileNode.children;
        if (children.length) {
          profileNodeGroups.push(parentProfileNodes.concat([profileNode]));
          profileNodeGroups.push(children);
        }
      }
    }
    ProfileDataGridNode.populate(this);
    return this;
  }
  focus(profileDataGridNode) {
    if (!profileDataGridNode) {
      return;
    }
    this.save();
    let currentNode = profileDataGridNode;
    let focusNode = profileDataGridNode;
    while (currentNode.parent && currentNode instanceof BottomUpProfileDataGridNode) {
      currentNode.takePropertiesFromProfileDataGridNode(profileDataGridNode);
      focusNode = currentNode;
      currentNode = currentNode.parent;
      if (currentNode instanceof BottomUpProfileDataGridNode) {
        currentNode.keepOnlyChild(focusNode);
      }
    }
    this.children = [focusNode];
    this.total = profileDataGridNode.total;
  }
  exclude(profileDataGridNode) {
    if (!profileDataGridNode) {
      return;
    }
    this.save();
    const excludedCallUID = profileDataGridNode.callUID;
    const excludedTopLevelChild = this.childrenByCallUID.get(excludedCallUID);
    if (excludedTopLevelChild) {
      Platform.ArrayUtilities.removeElement(this.children, excludedTopLevelChild);
    }
    const children = this.children;
    const count = children.length;
    for (let index = 0; index < count; ++index) {
      children[index].exclude(excludedCallUID);
    }
    if (this.lastComparator) {
      this.sort(this.lastComparator, true);
    }
  }
  populateChildren() {
    BottomUpProfileDataGridNode.sharedPopulate(this);
  }
}
//# sourceMappingURL=BottomUpProfileDataGrid.js.map
