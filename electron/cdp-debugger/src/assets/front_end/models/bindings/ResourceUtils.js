import * as Common from "../../core/common/common.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../workspace/workspace.js";
export function resourceForURL(url) {
  for (const resourceTreeModel of SDK.TargetManager.TargetManager.instance().models(SDK.ResourceTreeModel.ResourceTreeModel)) {
    const resource = resourceTreeModel.resourceForURL(url);
    if (resource) {
      return resource;
    }
  }
  return null;
}
export function displayNameForURL(url) {
  if (!url) {
    return "";
  }
  const resource = resourceForURL(url);
  if (resource) {
    return resource.displayName;
  }
  const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url);
  if (uiSourceCode) {
    return uiSourceCode.displayName();
  }
  const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
  const inspectedURL = mainTarget && mainTarget.inspectedURL();
  if (!inspectedURL) {
    return Platform.StringUtilities.trimURL(url, "");
  }
  const parsedURL = Common.ParsedURL.ParsedURL.fromString(inspectedURL);
  if (!parsedURL) {
    return url;
  }
  const lastPathComponent = parsedURL.lastPathComponent;
  const index = inspectedURL.indexOf(lastPathComponent);
  if (index !== -1 && index + lastPathComponent.length === inspectedURL.length) {
    const baseURL = inspectedURL.substring(0, index);
    if (url.startsWith(baseURL)) {
      return url.substring(index);
    }
  }
  const displayName = Platform.StringUtilities.trimURL(url, parsedURL.host);
  return displayName === "/" ? parsedURL.host + "/" : displayName;
}
export function metadataForURL(target, frameId, url) {
  const resourceTreeModel = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
  if (!resourceTreeModel) {
    return null;
  }
  const frame = resourceTreeModel.frameForId(frameId);
  if (!frame) {
    return null;
  }
  return resourceMetadata(frame.resourceForURL(url));
}
export function resourceMetadata(resource) {
  if (!resource || typeof resource.contentSize() !== "number" && !resource.lastModified()) {
    return null;
  }
  return new Workspace.UISourceCode.UISourceCodeMetadata(resource.lastModified(), resource.contentSize());
}
//# sourceMappingURL=ResourceUtils.js.map
