import * as Host from "../../core/host/host.js";
import * as Root from "../../core/root/root.js";
import { ActionRegistry } from "./ActionRegistry.js";
import { ShortcutRegistry } from "./ShortcutRegistry.js";
import { SoftContextMenu } from "./SoftContextMenu.js";
import { deepElementFromEvent } from "./UIUtils.js";
export class Item {
  typeInternal;
  label;
  disabled;
  checked;
  contextMenu;
  idInternal;
  customElement;
  shortcut;
  constructor(contextMenu, type, label, disabled, checked) {
    this.typeInternal = type;
    this.label = label;
    this.disabled = disabled;
    this.checked = checked;
    this.contextMenu = contextMenu;
    this.idInternal = void 0;
    if (type === "item" || type === "checkbox") {
      this.idInternal = contextMenu ? contextMenu.nextId() : 0;
    }
  }
  id() {
    if (this.idInternal === void 0) {
      throw new Error("Tried to access a ContextMenu Item ID but none was set.");
    }
    return this.idInternal;
  }
  type() {
    return this.typeInternal;
  }
  isEnabled() {
    return !this.disabled;
  }
  setEnabled(enabled) {
    this.disabled = !enabled;
  }
  buildDescriptor() {
    switch (this.typeInternal) {
      case "item": {
        const result = {
          type: "item",
          id: this.idInternal,
          label: this.label,
          enabled: !this.disabled,
          checked: void 0,
          subItems: void 0
        };
        if (this.customElement) {
          const resultAsSoftContextMenuItem = result;
          resultAsSoftContextMenuItem.element = this.customElement;
        }
        if (this.shortcut) {
          const resultAsSoftContextMenuItem = result;
          resultAsSoftContextMenuItem.shortcut = this.shortcut;
        }
        return result;
      }
      case "separator": {
        return {
          type: "separator",
          id: void 0,
          label: void 0,
          enabled: void 0,
          checked: void 0,
          subItems: void 0
        };
      }
      case "checkbox": {
        const result = {
          type: "checkbox",
          id: this.idInternal,
          label: this.label,
          checked: Boolean(this.checked),
          enabled: !this.disabled,
          subItems: void 0
        };
        if (this.customElement) {
          const resultAsSoftContextMenuItem = result;
          resultAsSoftContextMenuItem.element = this.customElement;
        }
        return result;
      }
    }
    throw new Error("Invalid item type:" + this.typeInternal);
  }
  setShortcut(shortcut) {
    this.shortcut = shortcut;
  }
}
export class Section {
  contextMenu;
  items;
  constructor(contextMenu) {
    this.contextMenu = contextMenu;
    this.items = [];
  }
  appendItem(label, handler, disabled, additionalElement) {
    const item = new Item(this.contextMenu, "item", label, disabled);
    if (additionalElement) {
      item.customElement = additionalElement;
    }
    this.items.push(item);
    if (this.contextMenu) {
      this.contextMenu.setHandler(item.id(), handler);
    }
    return item;
  }
  appendCustomItem(element) {
    const item = new Item(this.contextMenu, "item");
    item.customElement = element;
    this.items.push(item);
    return item;
  }
  appendSeparator() {
    const item = new Item(this.contextMenu, "separator");
    this.items.push(item);
    return item;
  }
  appendAction(actionId, label, optional) {
    const action = ActionRegistry.instance().action(actionId);
    if (!action) {
      if (!optional) {
        console.error(`Action ${actionId} was not defined`);
      }
      return;
    }
    if (!label) {
      label = action.title();
    }
    const result = this.appendItem(label, action.execute.bind(action));
    const shortcut = ShortcutRegistry.instance().shortcutTitleForAction(actionId);
    if (shortcut) {
      result.setShortcut(shortcut);
    }
  }
  appendSubMenuItem(label, disabled) {
    const item = new SubMenu(this.contextMenu, label, disabled);
    item.init();
    this.items.push(item);
    return item;
  }
  appendCheckboxItem(label, handler, checked, disabled, additionalElement) {
    const item = new Item(this.contextMenu, "checkbox", label, disabled, checked);
    this.items.push(item);
    if (this.contextMenu) {
      this.contextMenu.setHandler(item.id(), handler);
    }
    if (additionalElement) {
      item.customElement = additionalElement;
    }
    return item;
  }
}
export class SubMenu extends Item {
  sections;
  sectionList;
  constructor(contextMenu, label, disabled) {
    super(contextMenu, "subMenu", label, disabled);
    this.sections = /* @__PURE__ */ new Map();
    this.sectionList = [];
  }
  init() {
    ContextMenu.groupWeights.forEach((name) => this.section(name));
  }
  section(name) {
    let section = name ? this.sections.get(name) : null;
    if (!section) {
      section = new Section(this.contextMenu);
      if (name) {
        this.sections.set(name, section);
        this.sectionList.push(section);
      } else {
        this.sectionList.splice(ContextMenu.groupWeights.indexOf("default"), 0, section);
      }
    }
    return section;
  }
  headerSection() {
    return this.section("header");
  }
  newSection() {
    return this.section("new");
  }
  revealSection() {
    return this.section("reveal");
  }
  clipboardSection() {
    return this.section("clipboard");
  }
  editSection() {
    return this.section("edit");
  }
  debugSection() {
    return this.section("debug");
  }
  viewSection() {
    return this.section("view");
  }
  defaultSection() {
    return this.section("default");
  }
  saveSection() {
    return this.section("save");
  }
  footerSection() {
    return this.section("footer");
  }
  buildDescriptor() {
    const result = {
      type: "subMenu",
      label: this.label,
      enabled: !this.disabled,
      subItems: [],
      id: void 0,
      checked: void 0
    };
    const nonEmptySections = this.sectionList.filter((section) => Boolean(section.items.length));
    for (const section of nonEmptySections) {
      for (const item of section.items) {
        if (!result.subItems) {
          result.subItems = [];
        }
        result.subItems.push(item.buildDescriptor());
      }
      if (section !== nonEmptySections[nonEmptySections.length - 1]) {
        if (!result.subItems) {
          result.subItems = [];
        }
        result.subItems.push({
          type: "separator",
          id: void 0,
          subItems: void 0,
          checked: void 0,
          enabled: void 0,
          label: void 0
        });
      }
    }
    return result;
  }
  appendItemsAtLocation(location) {
    const items = getRegisteredItems();
    items.sort((firstItem, secondItem) => {
      const order1 = firstItem.order || 0;
      const order2 = secondItem.order || 0;
      return order1 - order2;
    });
    for (const item of items) {
      if (item.experiment && !Root.Runtime.experiments.isEnabled(item.experiment)) {
        continue;
      }
      const itemLocation = item.location;
      const actionId = item.actionId;
      if (!itemLocation || !itemLocation.startsWith(location + "/")) {
        continue;
      }
      const section = itemLocation.substr(location.length + 1);
      if (!section || section.includes("/")) {
        continue;
      }
      if (actionId) {
        this.section(section).appendAction(actionId);
      }
    }
  }
  static uniqueSectionName = 0;
}
export class ContextMenu extends SubMenu {
  contextMenu;
  defaultSectionInternal;
  pendingPromises;
  pendingTargets;
  event;
  useSoftMenu;
  x;
  y;
  onSoftMenuClosed;
  handlers;
  idInternal;
  softMenu;
  contextMenuLabel;
  constructor(event, options = {}) {
    super(null);
    const mouseEvent = event;
    this.contextMenu = this;
    super.init();
    this.defaultSectionInternal = this.defaultSection();
    this.pendingPromises = [];
    this.pendingTargets = [];
    this.event = mouseEvent;
    this.useSoftMenu = Boolean(options.useSoftMenu);
    this.x = options.x === void 0 ? mouseEvent.x : options.x;
    this.y = options.y === void 0 ? mouseEvent.y : options.y;
    this.onSoftMenuClosed = options.onSoftMenuClosed;
    this.handlers = /* @__PURE__ */ new Map();
    this.idInternal = 0;
    const target = deepElementFromEvent(event);
    if (target) {
      this.appendApplicableItems(target);
    }
  }
  static initialize() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.SetUseSoftMenu, setUseSoftMenu);
    function setUseSoftMenu(event) {
      ContextMenu.useSoftMenu = event.data;
    }
  }
  static installHandler(doc) {
    doc.body.addEventListener("contextmenu", handler, false);
    function handler(event) {
      const contextMenu = new ContextMenu(event);
      void contextMenu.show();
    }
  }
  nextId() {
    return this.idInternal++;
  }
  async show() {
    ContextMenu.pendingMenu = this;
    this.event.consume(true);
    const loadedProviders = await Promise.all(this.pendingPromises);
    if (ContextMenu.pendingMenu !== this) {
      return;
    }
    ContextMenu.pendingMenu = null;
    for (let i = 0; i < loadedProviders.length; ++i) {
      const providers = loadedProviders[i];
      const target = this.pendingTargets[i];
      for (const provider of providers) {
        provider.appendApplicableItems(this.event, this, target);
      }
    }
    this.pendingPromises = [];
    this.pendingTargets = [];
    this.innerShow();
  }
  discard() {
    if (this.softMenu) {
      this.softMenu.discard();
    }
  }
  innerShow() {
    const menuObject = this.buildMenuDescriptors();
    const eventTarget = this.event.target;
    if (!eventTarget) {
      return;
    }
    const ownerDocument = eventTarget.ownerDocument;
    if (this.useSoftMenu || ContextMenu.useSoftMenu || Host.InspectorFrontendHost.InspectorFrontendHostInstance.isHostedMode()) {
      this.softMenu = new SoftContextMenu(menuObject, this.itemSelected.bind(this), void 0, this.onSoftMenuClosed);
      this.softMenu.show(ownerDocument, new AnchorBox(this.x, this.y, 0, 0));
      if (this.contextMenuLabel) {
        this.softMenu.setContextMenuElementLabel(this.contextMenuLabel);
      }
    } else {
      let listenToEvents = function() {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.ContextMenuCleared, this.menuCleared, this);
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.ContextMenuItemSelected, this.onItemSelected, this);
      };
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.showContextMenuAtPoint(this.x, this.y, menuObject, ownerDocument);
      queueMicrotask(listenToEvents.bind(this));
    }
  }
  setContextMenuLabel(label) {
    this.contextMenuLabel = label;
  }
  setX(x) {
    this.x = x;
  }
  setY(y) {
    this.y = y;
  }
  setHandler(id, handler) {
    if (handler) {
      this.handlers.set(id, handler);
    }
  }
  buildMenuDescriptors() {
    return super.buildDescriptor().subItems;
  }
  onItemSelected(event) {
    this.itemSelected(event.data);
  }
  itemSelected(id) {
    const handler = this.handlers.get(id);
    if (handler) {
      handler.call(this);
    }
    this.menuCleared();
  }
  menuCleared() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.removeEventListener(Host.InspectorFrontendHostAPI.Events.ContextMenuCleared, this.menuCleared, this);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.removeEventListener(Host.InspectorFrontendHostAPI.Events.ContextMenuItemSelected, this.onItemSelected, this);
  }
  containsTarget(target) {
    return this.pendingTargets.indexOf(target) >= 0;
  }
  appendApplicableItems(target) {
    this.pendingPromises.push(loadApplicableRegisteredProviders(target));
    this.pendingTargets.push(target);
  }
  markAsMenuItemCheckBox() {
    if (this.softMenu) {
      this.softMenu.markAsMenuItemCheckBox();
    }
  }
  static pendingMenu = null;
  static useSoftMenu = false;
  static groupWeights = ["header", "new", "reveal", "edit", "clipboard", "debug", "view", "default", "save", "footer"];
}
const registeredProviders = [];
export function registerProvider(registration) {
  registeredProviders.push(registration);
}
async function loadApplicableRegisteredProviders(target) {
  return Promise.all(registeredProviders.filter(isProviderApplicableToContextTypes).map((registration) => registration.loadProvider()));
  function isProviderApplicableToContextTypes(providerRegistration) {
    if (!Root.Runtime.Runtime.isDescriptorEnabled({ experiment: providerRegistration.experiment, condition: void 0 })) {
      return false;
    }
    if (!providerRegistration.contextTypes) {
      return true;
    }
    for (const contextType of providerRegistration.contextTypes()) {
      if (target instanceof contextType) {
        return true;
      }
    }
    return false;
  }
}
const registeredItemsProviders = [];
export function registerItem(registration) {
  registeredItemsProviders.push(registration);
}
export function maybeRemoveItem(registration) {
  const itemIndex = registeredItemsProviders.findIndex((item) => item.actionId === registration.actionId && item.location === registration.location);
  if (itemIndex < 0) {
    return false;
  }
  registeredItemsProviders.splice(itemIndex, 1);
  return true;
}
function getRegisteredItems() {
  return registeredItemsProviders;
}
export var ItemLocation = /* @__PURE__ */ ((ItemLocation2) => {
  ItemLocation2["DEVICE_MODE_MENU_SAVE"] = "deviceModeMenu/save";
  ItemLocation2["MAIN_MENU"] = "mainMenu";
  ItemLocation2["MAIN_MENU_DEFAULT"] = "mainMenu/default";
  ItemLocation2["MAIN_MENU_FOOTER"] = "mainMenu/footer";
  ItemLocation2["MAIN_MENU_HELP_DEFAULT"] = "mainMenuHelp/default";
  ItemLocation2["NAVIGATOR_MENU_DEFAULT"] = "navigatorMenu/default";
  ItemLocation2["TIMELINE_MENU_OPEN"] = "timelineMenu/open";
  return ItemLocation2;
})(ItemLocation || {});
//# sourceMappingURL=ContextMenu.js.map
