import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as ARIAUtils from "./ARIAUtils.js";
import { AnchorBehavior, GlassPane, MarginBehavior, PointerEventsBehavior, SizeBehavior } from "./GlassPane.js";
import { Icon } from "./Icon.js";
import * as ThemeSupport from "./theme_support/theme_support.js";
import { createTextChild, ElementFocusRestorer } from "./UIUtils.js";
import softContextMenuStyles from "./softContextMenu.css.legacy.js";
import { InspectorView } from "./InspectorView.js";
const UIStrings = {
  checked: "checked",
  unchecked: "unchecked",
  sSS: "{PH1}, {PH2}, {PH3}",
  sS: "{PH1}, {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/SoftContextMenu.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SoftContextMenu {
  items;
  itemSelectedCallback;
  parentMenu;
  highlightedMenuItemElement;
  detailsForElementMap;
  document;
  glassPane;
  contextMenuElement;
  focusRestorer;
  hideOnUserMouseDownUnlessInMenu;
  activeSubMenuElement;
  subMenu;
  onMenuClosed;
  constructor(items, itemSelectedCallback, parentMenu, onMenuClosed) {
    this.items = items;
    this.itemSelectedCallback = itemSelectedCallback;
    this.parentMenu = parentMenu;
    this.highlightedMenuItemElement = null;
    this.detailsForElementMap = /* @__PURE__ */ new WeakMap();
    this.onMenuClosed = onMenuClosed;
  }
  show(document2, anchorBox) {
    if (!this.items.length) {
      return;
    }
    this.document = document2;
    this.glassPane = new GlassPane();
    this.glassPane.setPointerEventsBehavior(this.parentMenu ? PointerEventsBehavior.PierceGlassPane : PointerEventsBehavior.BlockedByGlassPane);
    this.glassPane.registerRequiredCSS(softContextMenuStyles);
    this.glassPane.setContentAnchorBox(anchorBox);
    this.glassPane.setSizeBehavior(SizeBehavior.MeasureContent);
    this.glassPane.setMarginBehavior(MarginBehavior.NoMargin);
    this.glassPane.setAnchorBehavior(this.parentMenu ? AnchorBehavior.PreferRight : AnchorBehavior.PreferBottom);
    this.contextMenuElement = this.glassPane.contentElement.createChild("div", "soft-context-menu");
    this.contextMenuElement.tabIndex = -1;
    ARIAUtils.markAsMenu(this.contextMenuElement);
    this.contextMenuElement.addEventListener("mouseup", (e) => e.consume(), false);
    this.contextMenuElement.addEventListener("keydown", this.menuKeyDown.bind(this), false);
    for (let i = 0; i < this.items.length; ++i) {
      this.contextMenuElement.appendChild(this.createMenuItem(this.items[i]));
    }
    this.glassPane.show(document2);
    this.focusRestorer = new ElementFocusRestorer(this.contextMenuElement);
    if (!this.parentMenu) {
      this.hideOnUserMouseDownUnlessInMenu = (event) => {
        let subMenu = this.subMenu;
        while (subMenu) {
          if (subMenu.contextMenuElement === event.composedPath()[0]) {
            return;
          }
          subMenu = subMenu.subMenu;
        }
        this.discard();
        event.consume(true);
      };
      this.document.body.addEventListener("mousedown", this.hideOnUserMouseDownUnlessInMenu, false);
      const devToolsElem = InspectorView.maybeGetInspectorViewInstance()?.element;
      if (devToolsElem) {
        let firedOnce = false;
        const observer = new ResizeObserver(() => {
          if (firedOnce) {
            return;
          }
          firedOnce = true;
        });
        observer.observe(devToolsElem);
      }
    }
  }
  setContextMenuElementLabel(label) {
    if (this.contextMenuElement) {
      ARIAUtils.setAccessibleName(this.contextMenuElement, label);
    }
  }
  discard() {
    if (this.subMenu) {
      this.subMenu.discard();
    }
    if (this.focusRestorer) {
      this.focusRestorer.restore();
    }
    if (this.glassPane) {
      this.glassPane.hide();
      delete this.glassPane;
      if (this.hideOnUserMouseDownUnlessInMenu) {
        if (this.document) {
          this.document.body.removeEventListener("mousedown", this.hideOnUserMouseDownUnlessInMenu, false);
        }
        delete this.hideOnUserMouseDownUnlessInMenu;
      }
    }
    if (this.parentMenu) {
      delete this.parentMenu.subMenu;
      if (this.parentMenu.activeSubMenuElement) {
        ARIAUtils.setExpanded(this.parentMenu.activeSubMenuElement, false);
        delete this.parentMenu.activeSubMenuElement;
      }
    }
    this.onMenuClosed?.();
  }
  createMenuItem(item) {
    if (item.type === "separator") {
      return this.createSeparator();
    }
    if (item.type === "subMenu") {
      return this.createSubMenu(item);
    }
    const menuItemElement = document.createElement("div");
    menuItemElement.classList.add("soft-context-menu-item");
    menuItemElement.tabIndex = -1;
    ARIAUtils.markAsMenuItem(menuItemElement);
    const checkMarkElement = Icon.create("smallicon-checkmark", "checkmark");
    menuItemElement.appendChild(checkMarkElement);
    if (!item.checked) {
      checkMarkElement.style.opacity = "0";
    }
    const detailsForElement = {
      actionId: void 0,
      isSeparator: void 0,
      customElement: void 0,
      subItems: void 0,
      subMenuTimer: void 0
    };
    if (item.element && !item.label) {
      const wrapper = menuItemElement.createChild("div", "soft-context-menu-custom-item");
      wrapper.appendChild(item.element);
      detailsForElement.customElement = item.element;
      this.detailsForElementMap.set(menuItemElement, detailsForElement);
      return menuItemElement;
    }
    if (!item.enabled) {
      menuItemElement.classList.add("soft-context-menu-disabled");
    }
    createTextChild(menuItemElement, item.label || "");
    if (item.element) {
      menuItemElement.appendChild(item.element);
    }
    menuItemElement.createChild("span", "soft-context-menu-shortcut").textContent = item.shortcut || "";
    menuItemElement.addEventListener("mousedown", this.menuItemMouseDown.bind(this), false);
    menuItemElement.addEventListener("mouseup", this.menuItemMouseUp.bind(this), false);
    menuItemElement.addEventListener("mouseover", this.menuItemMouseOver.bind(this), false);
    menuItemElement.addEventListener("mouseleave", this.menuItemMouseLeave.bind(this), false);
    detailsForElement.actionId = item.id;
    let accessibleName = item.label || "";
    if (item.type === "checkbox") {
      const checkedState = item.checked ? i18nString(UIStrings.checked) : i18nString(UIStrings.unchecked);
      if (item.shortcut) {
        accessibleName = i18nString(UIStrings.sSS, { PH1: String(item.label), PH2: item.shortcut, PH3: checkedState });
      } else {
        accessibleName = i18nString(UIStrings.sS, { PH1: String(item.label), PH2: checkedState });
      }
    } else if (item.shortcut) {
      accessibleName = i18nString(UIStrings.sS, { PH1: String(item.label), PH2: item.shortcut });
    }
    ARIAUtils.setAccessibleName(menuItemElement, accessibleName);
    this.detailsForElementMap.set(menuItemElement, detailsForElement);
    return menuItemElement;
  }
  createSubMenu(item) {
    const menuItemElement = document.createElement("div");
    menuItemElement.classList.add("soft-context-menu-item");
    menuItemElement.tabIndex = -1;
    ARIAUtils.markAsMenuItemSubMenu(menuItemElement);
    this.detailsForElementMap.set(menuItemElement, {
      subItems: item.subItems,
      actionId: void 0,
      isSeparator: void 0,
      customElement: void 0,
      subMenuTimer: void 0
    });
    const checkMarkElement = Icon.create("smallicon-checkmark", "soft-context-menu-item-checkmark");
    checkMarkElement.classList.add("checkmark");
    menuItemElement.appendChild(checkMarkElement);
    checkMarkElement.style.opacity = "0";
    createTextChild(menuItemElement, item.label || "");
    ARIAUtils.setExpanded(menuItemElement, false);
    if (Host.Platform.isMac() && !ThemeSupport.ThemeSupport.instance().hasTheme()) {
      const subMenuArrowElement = menuItemElement.createChild("span", "soft-context-menu-item-submenu-arrow");
      ARIAUtils.markAsHidden(subMenuArrowElement);
      subMenuArrowElement.textContent = "\u25B6";
    } else {
      const subMenuArrowElement = Icon.create("smallicon-triangle-right", "soft-context-menu-item-submenu-arrow");
      menuItemElement.appendChild(subMenuArrowElement);
    }
    menuItemElement.addEventListener("mousedown", this.menuItemMouseDown.bind(this), false);
    menuItemElement.addEventListener("mouseup", this.menuItemMouseUp.bind(this), false);
    menuItemElement.addEventListener("mouseover", this.menuItemMouseOver.bind(this), false);
    menuItemElement.addEventListener("mouseleave", this.menuItemMouseLeave.bind(this), false);
    return menuItemElement;
  }
  createSeparator() {
    const separatorElement = document.createElement("div");
    separatorElement.classList.add("soft-context-menu-separator");
    this.detailsForElementMap.set(separatorElement, {
      subItems: void 0,
      actionId: void 0,
      isSeparator: true,
      customElement: void 0,
      subMenuTimer: void 0
    });
    separatorElement.createChild("div", "separator-line");
    return separatorElement;
  }
  menuItemMouseDown(event) {
    event.consume(true);
  }
  menuItemMouseUp(event) {
    this.triggerAction(event.target, event);
    event.consume();
  }
  root() {
    let root = this;
    while (root.parentMenu) {
      root = root.parentMenu;
    }
    return root;
  }
  triggerAction(menuItemElement, event) {
    const detailsForElement = this.detailsForElementMap.get(menuItemElement);
    if (detailsForElement) {
      if (!detailsForElement.subItems) {
        this.root().discard();
        event.consume(true);
        if (typeof detailsForElement.actionId !== "undefined") {
          this.itemSelectedCallback(detailsForElement.actionId);
          delete detailsForElement.actionId;
        }
        return;
      }
    }
    this.showSubMenu(menuItemElement);
    event.consume();
  }
  showSubMenu(menuItemElement) {
    const detailsForElement = this.detailsForElementMap.get(menuItemElement);
    if (!detailsForElement) {
      return;
    }
    if (detailsForElement.subMenuTimer) {
      window.clearTimeout(detailsForElement.subMenuTimer);
      delete detailsForElement.subMenuTimer;
    }
    if (this.subMenu || !this.document) {
      return;
    }
    this.activeSubMenuElement = menuItemElement;
    ARIAUtils.setExpanded(menuItemElement, true);
    if (!detailsForElement.subItems) {
      return;
    }
    this.subMenu = new SoftContextMenu(detailsForElement.subItems, this.itemSelectedCallback, this);
    const anchorBox = menuItemElement.boxInWindow();
    anchorBox.y -= 5;
    anchorBox.x += 3;
    anchorBox.width -= 6;
    anchorBox.height += 10;
    this.subMenu.show(this.document, anchorBox);
  }
  menuItemMouseOver(event) {
    this.highlightMenuItem(event.target, true);
  }
  menuItemMouseLeave(event) {
    if (!this.subMenu || !event.relatedTarget) {
      this.highlightMenuItem(null, true);
      return;
    }
    const relatedTarget = event.relatedTarget;
    if (relatedTarget === this.contextMenuElement) {
      this.highlightMenuItem(null, true);
    }
  }
  highlightMenuItem(menuItemElement, scheduleSubMenu) {
    if (this.highlightedMenuItemElement === menuItemElement) {
      return;
    }
    if (this.subMenu) {
      this.subMenu.discard();
    }
    if (this.highlightedMenuItemElement) {
      const detailsForElement = this.detailsForElementMap.get(this.highlightedMenuItemElement);
      this.highlightedMenuItemElement.classList.remove("force-white-icons");
      this.highlightedMenuItemElement.classList.remove("soft-context-menu-item-mouse-over");
      if (detailsForElement && detailsForElement.subItems && detailsForElement.subMenuTimer) {
        window.clearTimeout(detailsForElement.subMenuTimer);
        delete detailsForElement.subMenuTimer;
      }
    }
    this.highlightedMenuItemElement = menuItemElement;
    if (this.highlightedMenuItemElement) {
      this.highlightedMenuItemElement.classList.add("force-white-icons");
      this.highlightedMenuItemElement.classList.add("soft-context-menu-item-mouse-over");
      const detailsForElement = this.detailsForElementMap.get(this.highlightedMenuItemElement);
      if (detailsForElement && detailsForElement.customElement) {
        detailsForElement.customElement.focus();
      } else {
        this.highlightedMenuItemElement.focus();
      }
      if (scheduleSubMenu && detailsForElement && detailsForElement.subItems && !detailsForElement.subMenuTimer) {
        detailsForElement.subMenuTimer = window.setTimeout(this.showSubMenu.bind(this, this.highlightedMenuItemElement), 150);
      }
    }
  }
  highlightPrevious() {
    let menuItemElement = this.highlightedMenuItemElement ? this.highlightedMenuItemElement.previousSibling : this.contextMenuElement ? this.contextMenuElement.lastChild : null;
    let menuItemDetails = menuItemElement ? this.detailsForElementMap.get(menuItemElement) : void 0;
    while (menuItemElement && menuItemDetails && (menuItemDetails.isSeparator || menuItemElement.classList.contains("soft-context-menu-disabled"))) {
      menuItemElement = menuItemElement.previousSibling;
      menuItemDetails = menuItemElement ? this.detailsForElementMap.get(menuItemElement) : void 0;
    }
    if (menuItemElement) {
      this.highlightMenuItem(menuItemElement, false);
    }
  }
  highlightNext() {
    let menuItemElement = this.highlightedMenuItemElement ? this.highlightedMenuItemElement.nextSibling : this.contextMenuElement ? this.contextMenuElement.firstChild : null;
    let menuItemDetails = menuItemElement ? this.detailsForElementMap.get(menuItemElement) : void 0;
    while (menuItemElement && (menuItemDetails && menuItemDetails.isSeparator || menuItemElement.classList.contains("soft-context-menu-disabled"))) {
      menuItemElement = menuItemElement.nextSibling;
      menuItemDetails = menuItemElement ? this.detailsForElementMap.get(menuItemElement) : void 0;
    }
    if (menuItemElement) {
      this.highlightMenuItem(menuItemElement, false);
    }
  }
  menuKeyDown(event) {
    const keyboardEvent = event;
    function onEnterOrSpace() {
      if (!this.highlightedMenuItemElement) {
        return;
      }
      const detailsForElement = this.detailsForElementMap.get(this.highlightedMenuItemElement);
      if (!detailsForElement || detailsForElement.customElement) {
        return;
      }
      this.triggerAction(this.highlightedMenuItemElement, keyboardEvent);
      if (detailsForElement.subItems && this.subMenu) {
        this.subMenu.highlightNext();
      }
      keyboardEvent.consume(true);
    }
    switch (keyboardEvent.key) {
      case "ArrowUp":
        this.highlightPrevious();
        keyboardEvent.consume(true);
        break;
      case "ArrowDown":
        this.highlightNext();
        keyboardEvent.consume(true);
        break;
      case "ArrowLeft":
        if (this.parentMenu) {
          this.highlightMenuItem(null, false);
          this.discard();
        }
        keyboardEvent.consume(true);
        break;
      case "ArrowRight": {
        if (!this.highlightedMenuItemElement) {
          break;
        }
        const detailsForElement = this.detailsForElementMap.get(this.highlightedMenuItemElement);
        if (detailsForElement && detailsForElement.subItems) {
          this.showSubMenu(this.highlightedMenuItemElement);
          if (this.subMenu) {
            this.subMenu.highlightNext();
          }
        }
        keyboardEvent.consume(true);
        break;
      }
      case "Escape":
        this.discard();
        keyboardEvent.consume(true);
        break;
      case "Enter":
        if (!(keyboardEvent.key === "Enter")) {
          return;
        }
        onEnterOrSpace.call(this);
        break;
      case " ":
        onEnterOrSpace.call(this);
        break;
      default:
        keyboardEvent.consume(true);
    }
  }
  markAsMenuItemCheckBox() {
    if (!this.contextMenuElement) {
      return;
    }
    for (const child of this.contextMenuElement.children) {
      ARIAUtils.markAsMenuItemCheckBox(child);
    }
  }
}
//# sourceMappingURL=SoftContextMenu.js.map
