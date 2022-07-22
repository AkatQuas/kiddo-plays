import * as Platform from "../../../core/platform/platform.js";
import * as LitHtml from "../../lit-html/lit-html.js";
export function isExpandableNode(node) {
  return "children" in node;
}
class TrackDOMNodeToTreeNode extends LitHtml.Directive.Directive {
  constructor(partInfo) {
    super(partInfo);
    if (partInfo.type !== LitHtml.Directive.PartType.ATTRIBUTE) {
      throw new Error("TrackDOMNodeToTreeNode directive must be used as an attribute.");
    }
  }
  update(part, [weakMap, treeNode]) {
    const elem = part.element;
    if (!(elem instanceof HTMLLIElement)) {
      throw new Error("trackTreeNodeToDOMNode must be used on <li> elements.");
    }
    weakMap.set(elem, treeNode);
  }
  render(_weakmap, _treeNode) {
  }
}
export const trackDOMNodeToTreeNode = LitHtml.Directive.directive(TrackDOMNodeToTreeNode);
const findNextParentSibling = (currentDOMNode) => {
  const currentDOMNodeParentListItem = currentDOMNode.parentElement?.parentElement;
  if (currentDOMNodeParentListItem && currentDOMNodeParentListItem instanceof HTMLLIElement) {
    const parentNodeSibling = currentDOMNodeParentListItem.nextElementSibling;
    if (parentNodeSibling && parentNodeSibling instanceof HTMLLIElement) {
      return parentNodeSibling;
    }
    return findNextParentSibling(currentDOMNodeParentListItem);
  }
  return null;
};
const getFirstChildOfExpandedTreeNode = (currentDOMNode) => {
  const firstChild = currentDOMNode.querySelector(':scope > [role="group"] > [role="treeitem"]:first-child');
  if (!firstChild) {
    throw new Error("Could not find child of expanded node.");
  }
  return firstChild;
};
const domNodeIsExpandable = (domNode) => {
  return domNode.getAttribute("aria-expanded") !== null;
};
const domNodeIsLeafNode = (domNode) => {
  return !domNodeIsExpandable(domNode);
};
const domNodeIsExpanded = (domNode) => {
  return domNodeIsExpandable(domNode) && domNode.getAttribute("aria-expanded") === "true";
};
const getDeepLastChildOfExpandedTreeNode = (currentDOMNode) => {
  const lastChild = currentDOMNode.querySelector(':scope > [role="group"] > [role="treeitem"]:last-child');
  if (!lastChild) {
    throw new Error("Could not find child of expanded node.");
  }
  if (domNodeIsExpanded(lastChild)) {
    return getDeepLastChildOfExpandedTreeNode(lastChild);
  }
  return lastChild;
};
const getNextSiblingOfCurrentDOMNode = (currentDOMNode) => {
  const currentNodeSibling = currentDOMNode.nextElementSibling;
  if (currentNodeSibling && currentNodeSibling instanceof HTMLLIElement) {
    return currentNodeSibling;
  }
  return null;
};
const getPreviousSiblingOfCurrentDOMNode = (currentDOMNode) => {
  const currentNodeSibling = currentDOMNode.previousElementSibling;
  if (currentNodeSibling && currentNodeSibling instanceof HTMLLIElement) {
    return currentNodeSibling;
  }
  return null;
};
const getParentListItemForDOMNode = (currentDOMNode) => {
  let parentNode = currentDOMNode.parentElement;
  if (!parentNode) {
    return null;
  }
  while (parentNode && parentNode.getAttribute("role") !== "treeitem" && parentNode instanceof HTMLLIElement === false) {
    parentNode = parentNode.parentElement;
  }
  return parentNode;
};
const treeNodeChildrenWeakMap = /* @__PURE__ */ new WeakMap();
export const getNodeChildren = async (node) => {
  if (!node.children) {
    throw new Error("Asked for children of node that does not have any children.");
  }
  const cachedChildren = treeNodeChildrenWeakMap.get(node);
  if (cachedChildren) {
    return cachedChildren;
  }
  const children = await node.children();
  treeNodeChildrenWeakMap.set(node, children);
  return children;
};
export const getPathToTreeNode = async (tree, nodeIdToFind) => {
  for (const rootNode of tree) {
    const foundPathOrNull = await getPathToTreeNodeRecursively(rootNode, nodeIdToFind, [rootNode]);
    if (foundPathOrNull !== null) {
      return foundPathOrNull;
    }
  }
  return null;
};
const getPathToTreeNodeRecursively = async (currentNode, nodeIdToFind, pathToNode) => {
  if (currentNode.id === nodeIdToFind) {
    return pathToNode;
  }
  if (currentNode.children) {
    const children = await getNodeChildren(currentNode);
    for (const child of children) {
      const foundPathOrNull = await getPathToTreeNodeRecursively(child, nodeIdToFind, [...pathToNode, child]);
      if (foundPathOrNull !== null) {
        return foundPathOrNull;
      }
    }
  }
  return null;
};
export const findNextNodeForTreeOutlineKeyboardNavigation = (options) => {
  const {
    currentDOMNode,
    currentTreeNode,
    direction,
    setNodeExpandedState
  } = options;
  if (!currentTreeNode) {
    return currentDOMNode;
  }
  if (direction === Platform.KeyboardUtilities.ArrowKey.DOWN) {
    if (domNodeIsExpanded(currentDOMNode)) {
      return getFirstChildOfExpandedTreeNode(currentDOMNode);
    }
    const currentNodeSibling = getNextSiblingOfCurrentDOMNode(currentDOMNode);
    if (currentNodeSibling) {
      return currentNodeSibling;
    }
    const parentSibling = findNextParentSibling(currentDOMNode);
    if (parentSibling) {
      return parentSibling;
    }
  } else if (direction === Platform.KeyboardUtilities.ArrowKey.RIGHT) {
    if (domNodeIsLeafNode(currentDOMNode)) {
      return currentDOMNode;
    }
    if (domNodeIsExpanded(currentDOMNode)) {
      return getFirstChildOfExpandedTreeNode(currentDOMNode);
    }
    setNodeExpandedState(currentTreeNode, true);
    return currentDOMNode;
  } else if (direction === Platform.KeyboardUtilities.ArrowKey.UP) {
    const currentNodePreviousSibling = getPreviousSiblingOfCurrentDOMNode(currentDOMNode);
    if (currentNodePreviousSibling) {
      if (domNodeIsExpanded(currentNodePreviousSibling)) {
        return getDeepLastChildOfExpandedTreeNode(currentNodePreviousSibling);
      }
      return currentNodePreviousSibling;
    }
    const parentNode = getParentListItemForDOMNode(currentDOMNode);
    if (parentNode && parentNode instanceof HTMLLIElement) {
      return parentNode;
    }
  } else if (direction === Platform.KeyboardUtilities.ArrowKey.LEFT) {
    if (domNodeIsExpanded(currentDOMNode)) {
      setNodeExpandedState(currentTreeNode, false);
      return currentDOMNode;
    }
    const parentNode = getParentListItemForDOMNode(currentDOMNode);
    if (parentNode && parentNode instanceof HTMLLIElement) {
      return parentNode;
    }
  }
  return currentDOMNode;
};
//# sourceMappingURL=TreeOutlineUtils.js.map
