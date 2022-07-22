import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import { PreRegisteredView } from "./ViewManager.js";
const registeredViewExtensions = [];
export var ViewPersistence = /* @__PURE__ */ ((ViewPersistence2) => {
  ViewPersistence2["CLOSEABLE"] = "closeable";
  ViewPersistence2["PERMANENT"] = "permanent";
  ViewPersistence2["TRANSIENT"] = "transient";
  return ViewPersistence2;
})(ViewPersistence || {});
export var ViewLocationValues = /* @__PURE__ */ ((ViewLocationValues2) => {
  ViewLocationValues2["PANEL"] = "panel";
  ViewLocationValues2["SETTINGS_VIEW"] = "settings-view";
  ViewLocationValues2["ELEMENTS_SIDEBAR"] = "elements-sidebar";
  ViewLocationValues2["SOURCES_SIDEBAR_BOTTOM"] = "sources.sidebar-bottom";
  ViewLocationValues2["NAVIGATOR_VIEW"] = "navigator-view";
  ViewLocationValues2["DRAWER_VIEW"] = "drawer-view";
  ViewLocationValues2["DRAWER_SIDEBAR"] = "drawer-sidebar";
  ViewLocationValues2["NETWORK_SIDEBAR"] = "network-sidebar";
  ViewLocationValues2["SOURCES_SIDEBAR_TOP"] = "sources.sidebar-top";
  ViewLocationValues2["SOURCES_SIDEBAR_TABS"] = "sources.sidebar-tabs";
  return ViewLocationValues2;
})(ViewLocationValues || {});
const viewIdSet = /* @__PURE__ */ new Set();
export function registerViewExtension(registration) {
  const viewId = registration.id;
  Platform.DCHECK(() => !viewIdSet.has(viewId), `Duplicate view id '${viewId}'`);
  viewIdSet.add(viewId);
  registeredViewExtensions.push(new PreRegisteredView(registration));
}
export function getRegisteredViewExtensions() {
  return registeredViewExtensions.filter((view) => Root.Runtime.Runtime.isDescriptorEnabled({ experiment: view.experiment(), condition: view.condition() }));
}
export function maybeRemoveViewExtension(viewId) {
  const viewIndex = registeredViewExtensions.findIndex((view) => view.viewId() === viewId);
  if (viewIndex < 0 || !viewIdSet.delete(viewId)) {
    return false;
  }
  registeredViewExtensions.splice(viewIndex, 1);
  return true;
}
const registeredLocationResolvers = [];
const viewLocationNameSet = /* @__PURE__ */ new Set();
export function registerLocationResolver(registration) {
  const locationName = registration.name;
  if (viewLocationNameSet.has(locationName)) {
    throw new Error(`Duplicate view location name registration '${locationName}'`);
  }
  viewLocationNameSet.add(locationName);
  registeredLocationResolvers.push(registration);
}
export function getRegisteredLocationResolvers() {
  return registeredLocationResolvers;
}
export function resetViewRegistration() {
  registeredViewExtensions.length = 0;
  registeredLocationResolvers.length = 0;
  viewLocationNameSet.clear();
}
export const ViewLocationCategoryValues = {
  ELEMENTS: "Elements",
  DRAWER: "Drawer",
  DRAWER_SIDEBAR: "Drawer sidebar",
  PANEL: "Panel",
  NETWORK: "Network",
  SETTINGS: "Settings",
  SOURCES: "Sources"
};
//# sourceMappingURL=ViewRegistration.js.map
