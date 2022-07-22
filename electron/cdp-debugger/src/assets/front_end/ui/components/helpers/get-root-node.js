import * as Platform from "../../../core/platform/platform.js";
export function getRootNode(node) {
  const potentialRoot = node.getRootNode();
  Platform.DCHECK(() => potentialRoot instanceof Document || potentialRoot instanceof ShadowRoot, `Expected root of widget to be a document or shadowRoot, but was "${potentialRoot.nodeName}"`);
  return potentialRoot;
}
//# sourceMappingURL=get-root-node.js.map
