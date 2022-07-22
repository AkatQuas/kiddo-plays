import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import { Context } from "./Context.js";
export class Action extends Common.ObjectWrapper.ObjectWrapper {
  enabledInternal = true;
  toggledInternal = false;
  actionRegistration;
  constructor(actionRegistration) {
    super();
    this.actionRegistration = actionRegistration;
  }
  id() {
    return this.actionRegistration.actionId;
  }
  async execute() {
    if (!this.actionRegistration.loadActionDelegate) {
      return false;
    }
    const delegate = await this.actionRegistration.loadActionDelegate();
    const actionId = this.id();
    return delegate.handleAction(Context.instance(), actionId);
  }
  icon() {
    return this.actionRegistration.iconClass;
  }
  toggledIcon() {
    return this.actionRegistration.toggledIconClass;
  }
  toggleWithRedColor() {
    return Boolean(this.actionRegistration.toggleWithRedColor);
  }
  setEnabled(enabled) {
    if (this.enabledInternal === enabled) {
      return;
    }
    this.enabledInternal = enabled;
    this.dispatchEventToListeners(Events.Enabled, enabled);
  }
  enabled() {
    return this.enabledInternal;
  }
  category() {
    return this.actionRegistration.category;
  }
  tags() {
    if (this.actionRegistration.tags) {
      return this.actionRegistration.tags.map((tag) => tag()).join("\0");
    }
  }
  toggleable() {
    return Boolean(this.actionRegistration.toggleable);
  }
  title() {
    let title = this.actionRegistration.title ? this.actionRegistration.title() : "";
    const options = this.actionRegistration.options;
    if (options) {
      for (const pair of options) {
        if (pair.value !== this.toggledInternal) {
          title = pair.title();
        }
      }
    }
    return title;
  }
  toggled() {
    return this.toggledInternal;
  }
  setToggled(toggled) {
    console.assert(this.toggleable(), "Shouldn't be toggling an untoggleable action", this.id());
    if (this.toggledInternal === toggled) {
      return;
    }
    this.toggledInternal = toggled;
    this.dispatchEventToListeners(Events.Toggled, toggled);
  }
  options() {
    return this.actionRegistration.options;
  }
  contextTypes() {
    if (this.actionRegistration.contextTypes) {
      return this.actionRegistration.contextTypes();
    }
    return void 0;
  }
  canInstantiate() {
    return Boolean(this.actionRegistration.loadActionDelegate);
  }
  bindings() {
    return this.actionRegistration.bindings;
  }
  experiment() {
    return this.actionRegistration.experiment;
  }
  condition() {
    return this.actionRegistration.condition;
  }
  order() {
    return this.actionRegistration.order;
  }
}
const registeredActionExtensions = [];
const actionIdSet = /* @__PURE__ */ new Set();
export function registerActionExtension(registration) {
  const actionId = registration.actionId;
  if (actionIdSet.has(actionId)) {
    throw new Error(`Duplicate Action id '${actionId}': ${new Error().stack}`);
  }
  actionIdSet.add(actionId);
  registeredActionExtensions.push(new Action(registration));
}
export function getRegisteredActionExtensions() {
  return registeredActionExtensions.filter((action) => Root.Runtime.Runtime.isDescriptorEnabled({ experiment: action.experiment(), condition: action.condition() })).sort((firstAction, secondAction) => {
    const order1 = firstAction.order() || 0;
    const order2 = secondAction.order() || 0;
    return order1 - order2;
  });
}
export function maybeRemoveActionExtension(actionId) {
  const actionIndex = registeredActionExtensions.findIndex((action) => action.id() === actionId);
  if (actionIndex < 0 || !actionIdSet.delete(actionId)) {
    return false;
  }
  registeredActionExtensions.splice(actionIndex, 1);
  return true;
}
export var Platforms = /* @__PURE__ */ ((Platforms2) => {
  Platforms2["All"] = "All platforms";
  Platforms2["Mac"] = "mac";
  Platforms2["WindowsLinux"] = "windows,linux";
  Platforms2["Android"] = "Android";
  Platforms2["Windows"] = "windows";
  return Platforms2;
})(Platforms || {});
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["Enabled"] = "Enabled";
  Events2["Toggled"] = "Toggled";
  return Events2;
})(Events || {});
export const ActionCategory = {
  ELEMENTS: "Elements",
  SCREENSHOT: "Screenshot",
  NETWORK: "Network",
  MEMORY: "Memory",
  JAVASCRIPT_PROFILER: "JavaScript Profiler",
  CONSOLE: "Console",
  PERFORMANCE: "Performance",
  MOBILE: "Mobile",
  SENSORS: "Sensors",
  HELP: "Help",
  INPUTS: "Inputs",
  LAYERS: "Layers",
  NAVIGATION: "Navigation",
  DRAWER: "Drawer",
  GLOBAL: "Global",
  RESOURCES: "Resources",
  BACKGROUND_SERVICES: "Background Services",
  SETTINGS: "Settings",
  DEBUGGER: "Debugger",
  SOURCES: "Sources",
  RENDERING: "Rendering"
};
export var IconClass = /* @__PURE__ */ ((IconClass2) => {
  IconClass2["LARGEICON_NODE_SEARCH"] = "largeicon-node-search";
  IconClass2["LARGEICON_START_RECORDING"] = "largeicon-start-recording";
  IconClass2["LARGEICON_STOP_RECORDING"] = "largeicon-stop-recording";
  IconClass2["LARGEICON_REFRESH"] = "largeicon-refresh";
  IconClass2["LARGEICON_CLEAR"] = "largeicon-clear";
  IconClass2["LARGEICON_VISIBILITY"] = "largeicon-visibility";
  IconClass2["LARGEICON_PHONE"] = "largeicon-phone";
  IconClass2["LARGEICON_PLAY"] = "largeicon-play";
  IconClass2["LARGEICON_DOWNLOAD"] = "largeicon-download";
  IconClass2["LARGEICON_PAUSE"] = "largeicon-pause";
  IconClass2["LARGEICON_RESUME"] = "largeicon-resume";
  IconClass2["LARGEICON_TRASH_BIN"] = "largeicon-trash-bin";
  IconClass2["LARGEICON_SETTINGS_GEAR"] = "largeicon-settings-gear";
  IconClass2["LARGEICON_STEP_OVER"] = "largeicon-step-over";
  IconClass2["LARGE_ICON_STEP_INTO"] = "largeicon-step-into";
  IconClass2["LARGE_ICON_STEP"] = "largeicon-step";
  IconClass2["LARGE_ICON_STEP_OUT"] = "largeicon-step-out";
  IconClass2["LARGE_ICON_DEACTIVATE_BREAKPOINTS"] = "largeicon-deactivate-breakpoints";
  IconClass2["LARGE_ICON_ADD"] = "largeicon-add";
  return IconClass2;
})(IconClass || {});
export var KeybindSet = /* @__PURE__ */ ((KeybindSet2) => {
  KeybindSet2["DEVTOOLS_DEFAULT"] = "devToolsDefault";
  KeybindSet2["VS_CODE"] = "vsCode";
  return KeybindSet2;
})(KeybindSet || {});
//# sourceMappingURL=ActionRegistration.js.map
