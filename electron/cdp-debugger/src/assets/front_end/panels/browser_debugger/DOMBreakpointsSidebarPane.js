import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Sources from "../sources/sources.js";
import domBreakpointsSidebarPaneStyles from "./domBreakpointsSidebarPane.css.js";
const UIStrings = {
  noBreakpoints: "No breakpoints",
  domBreakpointsList: "DOM Breakpoints list",
  sS: "{PH1}: {PH2}",
  sSS: "{PH1}: {PH2}, {PH3}",
  checked: "checked",
  unchecked: "unchecked",
  sBreakpointHit: "{PH1} breakpoint hit",
  breakpointHit: "breakpoint hit",
  revealDomNodeInElementsPanel: "Reveal DOM node in Elements panel",
  removeBreakpoint: "Remove breakpoint",
  removeAllDomBreakpoints: "Remove all DOM breakpoints",
  subtreeModified: "Subtree modified",
  attributeModified: "Attribute modified",
  nodeRemoved: "Node removed",
  breakOn: "Break on",
  breakpointRemoved: "Breakpoint removed",
  breakpointSet: "Breakpoint set"
};
const str_ = i18n.i18n.registerUIStrings("panels/browser_debugger/DOMBreakpointsSidebarPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let domBreakpointsSidebarPaneInstance;
export class DOMBreakpointsSidebarPane extends UI.Widget.VBox {
  elementToCheckboxes;
  #emptyElement;
  #breakpoints;
  #list;
  #highlightedBreakpoint;
  constructor() {
    super(true);
    this.elementToCheckboxes = /* @__PURE__ */ new WeakMap();
    this.#emptyElement = this.contentElement.createChild("div", "gray-info-message");
    this.#emptyElement.textContent = i18nString(UIStrings.noBreakpoints);
    this.#breakpoints = new UI.ListModel.ListModel();
    this.#list = new UI.ListControl.ListControl(this.#breakpoints, this, UI.ListControl.ListMode.NonViewport);
    this.contentElement.appendChild(this.#list.element);
    this.#list.element.classList.add("breakpoint-list", "hidden");
    UI.ARIAUtils.markAsList(this.#list.element);
    UI.ARIAUtils.setAccessibleName(this.#list.element, i18nString(UIStrings.domBreakpointsList));
    this.#emptyElement.tabIndex = -1;
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMDebuggerModel.DOMDebuggerModel, SDK.DOMDebuggerModel.Events.DOMBreakpointAdded, this.breakpointAdded, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMDebuggerModel.DOMDebuggerModel, SDK.DOMDebuggerModel.Events.DOMBreakpointToggled, this.breakpointToggled, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMDebuggerModel.DOMDebuggerModel, SDK.DOMDebuggerModel.Events.DOMBreakpointsRemoved, this.breakpointsRemoved, this);
    for (const domDebuggerModel of SDK.TargetManager.TargetManager.instance().models(SDK.DOMDebuggerModel.DOMDebuggerModel)) {
      domDebuggerModel.retrieveDOMBreakpoints();
      for (const breakpoint of domDebuggerModel.domBreakpoints()) {
        this.addBreakpoint(breakpoint);
      }
    }
    this.#highlightedBreakpoint = null;
    this.update();
  }
  static instance() {
    if (!domBreakpointsSidebarPaneInstance) {
      domBreakpointsSidebarPaneInstance = new DOMBreakpointsSidebarPane();
    }
    return domBreakpointsSidebarPaneInstance;
  }
  createElementForItem(item) {
    const element = document.createElement("div");
    element.classList.add("breakpoint-entry");
    element.addEventListener("contextmenu", this.contextMenu.bind(this, item), true);
    UI.ARIAUtils.markAsListitem(element);
    element.tabIndex = -1;
    const checkboxLabel = UI.UIUtils.CheckboxLabel.create(void 0, item.enabled);
    const checkboxElement = checkboxLabel.checkboxElement;
    checkboxElement.addEventListener("click", this.checkboxClicked.bind(this, item), false);
    checkboxElement.tabIndex = -1;
    this.elementToCheckboxes.set(element, checkboxElement);
    element.appendChild(checkboxLabel);
    element.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        checkboxLabel.checkboxElement.click();
        event.consume(true);
      }
    });
    const labelElement = document.createElement("div");
    labelElement.classList.add("dom-breakpoint");
    element.appendChild(labelElement);
    const description = document.createElement("div");
    const breakpointTypeLabel = BreakpointTypeLabels.get(item.type);
    description.textContent = breakpointTypeLabel ? breakpointTypeLabel() : null;
    const breakpointTypeText = breakpointTypeLabel ? breakpointTypeLabel() : "";
    UI.ARIAUtils.setAccessibleName(checkboxElement, breakpointTypeText);
    const checkedStateText = item.enabled ? i18nString(UIStrings.checked) : i18nString(UIStrings.unchecked);
    const linkifiedNode = document.createElement("monospace");
    linkifiedNode.style.display = "block";
    labelElement.appendChild(linkifiedNode);
    void Common.Linkifier.Linkifier.linkify(item.node, { preventKeyboardFocus: true, tooltip: void 0 }).then((linkified) => {
      linkifiedNode.appendChild(linkified);
      UI.ARIAUtils.setAccessibleName(checkboxElement, i18nString(UIStrings.sS, { PH1: breakpointTypeText, PH2: linkified.deepTextContent() }));
      UI.ARIAUtils.setAccessibleName(element, i18nString(UIStrings.sSS, { PH1: breakpointTypeText, PH2: linkified.deepTextContent(), PH3: checkedStateText }));
    });
    labelElement.appendChild(description);
    if (item === this.#highlightedBreakpoint) {
      element.classList.add("breakpoint-hit");
      UI.ARIAUtils.setDescription(element, i18nString(UIStrings.sBreakpointHit, { PH1: checkedStateText }));
      UI.ARIAUtils.setDescription(checkboxElement, i18nString(UIStrings.breakpointHit));
    } else {
      UI.ARIAUtils.setDescription(element, checkedStateText);
    }
    this.#emptyElement.classList.add("hidden");
    this.#list.element.classList.remove("hidden");
    return element;
  }
  heightForItem(_item) {
    return 0;
  }
  isItemSelectable(_item) {
    return true;
  }
  updateSelectedItemARIA(_fromElement, _toElement) {
    return true;
  }
  selectedItemChanged(from, to, fromElement, toElement) {
    if (fromElement) {
      fromElement.tabIndex = -1;
    }
    if (toElement) {
      this.setDefaultFocusedElement(toElement);
      toElement.tabIndex = 0;
      if (this.hasFocus()) {
        toElement.focus();
      }
    }
  }
  breakpointAdded(event) {
    this.addBreakpoint(event.data);
  }
  breakpointToggled(event) {
    const hadFocus = this.hasFocus();
    const breakpoint = event.data;
    this.#list.refreshItem(breakpoint);
    if (hadFocus) {
      this.focus();
    }
  }
  breakpointsRemoved(event) {
    const hadFocus = this.hasFocus();
    const breakpoints = event.data;
    let lastIndex = -1;
    for (const breakpoint of breakpoints) {
      const index = this.#breakpoints.indexOf(breakpoint);
      if (index >= 0) {
        this.#breakpoints.remove(index);
        lastIndex = index;
      }
    }
    if (this.#breakpoints.length === 0) {
      this.#emptyElement.classList.remove("hidden");
      this.setDefaultFocusedElement(this.#emptyElement);
      this.#list.element.classList.add("hidden");
    } else if (lastIndex >= 0) {
      const breakpointToSelect = this.#breakpoints.at(lastIndex);
      if (breakpointToSelect) {
        this.#list.selectItem(breakpointToSelect);
      }
    }
    if (hadFocus) {
      this.focus();
    }
  }
  addBreakpoint(breakpoint) {
    this.#breakpoints.insertWithComparator(breakpoint, (breakpointA, breakpointB) => {
      if (breakpointA.type > breakpointB.type) {
        return -1;
      }
      if (breakpointA.type < breakpointB.type) {
        return 1;
      }
      return 0;
    });
    if (!this.#list.selectedItem() || !this.hasFocus()) {
      this.#list.selectItem(this.#breakpoints.at(0));
    }
  }
  contextMenu(breakpoint, event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.defaultSection().appendItem(i18nString(UIStrings.revealDomNodeInElementsPanel), () => Common.Revealer.reveal(breakpoint.node));
    contextMenu.defaultSection().appendItem(i18nString(UIStrings.removeBreakpoint), () => {
      breakpoint.domDebuggerModel.removeDOMBreakpoint(breakpoint.node, breakpoint.type);
    });
    contextMenu.defaultSection().appendItem(i18nString(UIStrings.removeAllDomBreakpoints), () => {
      breakpoint.domDebuggerModel.removeAllDOMBreakpoints();
    });
    void contextMenu.show();
  }
  checkboxClicked(breakpoint, event) {
    breakpoint.domDebuggerModel.toggleDOMBreakpoint(breakpoint, event.target ? event.target.checked : false);
  }
  flavorChanged(_object) {
    this.update();
  }
  update() {
    const details = UI.Context.Context.instance().flavor(SDK.DebuggerModel.DebuggerPausedDetails);
    if (this.#highlightedBreakpoint) {
      const oldHighlightedBreakpoint = this.#highlightedBreakpoint;
      this.#highlightedBreakpoint = null;
      this.#list.refreshItem(oldHighlightedBreakpoint);
    }
    if (!details || !details.auxData || details.reason !== Protocol.Debugger.PausedEventReason.DOM) {
      return;
    }
    const domDebuggerModel = details.debuggerModel.target().model(SDK.DOMDebuggerModel.DOMDebuggerModel);
    if (!domDebuggerModel) {
      return;
    }
    const data = domDebuggerModel.resolveDOMBreakpointData(details.auxData);
    if (!data) {
      return;
    }
    for (const breakpoint of this.#breakpoints) {
      if (breakpoint.node === data.node && breakpoint.type === data.type) {
        this.#highlightedBreakpoint = breakpoint;
      }
    }
    if (this.#highlightedBreakpoint) {
      this.#list.refreshItem(this.#highlightedBreakpoint);
    }
    void UI.ViewManager.ViewManager.instance().showView("sources.domBreakpoints");
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([domBreakpointsSidebarPaneStyles]);
  }
}
const BreakpointTypeLabels = /* @__PURE__ */ new Map([
  [Protocol.DOMDebugger.DOMBreakpointType.SubtreeModified, i18nLazyString(UIStrings.subtreeModified)],
  [Protocol.DOMDebugger.DOMBreakpointType.AttributeModified, i18nLazyString(UIStrings.attributeModified)],
  [Protocol.DOMDebugger.DOMBreakpointType.NodeRemoved, i18nLazyString(UIStrings.nodeRemoved)]
]);
let contextMenuProviderInstance;
export class ContextMenuProvider {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!contextMenuProviderInstance || forceNew) {
      contextMenuProviderInstance = new ContextMenuProvider();
    }
    return contextMenuProviderInstance;
  }
  appendApplicableItems(event, contextMenu, object) {
    const node = object;
    if (node.pseudoType()) {
      return;
    }
    const domDebuggerModel = node.domModel().target().model(SDK.DOMDebuggerModel.DOMDebuggerModel);
    if (!domDebuggerModel) {
      return;
    }
    function toggleBreakpoint(type) {
      if (!domDebuggerModel) {
        return;
      }
      const label = Sources.DebuggerPausedMessage.BreakpointTypeNouns.get(type);
      const labelString = label ? label() : "";
      if (domDebuggerModel.hasDOMBreakpoint(node, type)) {
        domDebuggerModel.removeDOMBreakpoint(node, type);
        UI.ARIAUtils.alert(`${i18nString(UIStrings.breakpointRemoved)}: ${labelString}`);
      } else {
        domDebuggerModel.setDOMBreakpoint(node, type);
        UI.ARIAUtils.alert(`${i18nString(UIStrings.breakpointSet)}: ${labelString}`);
      }
    }
    const breakpointsMenu = contextMenu.debugSection().appendSubMenuItem(i18nString(UIStrings.breakOn));
    const allBreakpointTypes = {
      SubtreeModified: Protocol.DOMDebugger.DOMBreakpointType.SubtreeModified,
      AttributeModified: Protocol.DOMDebugger.DOMBreakpointType.AttributeModified,
      NodeRemoved: Protocol.DOMDebugger.DOMBreakpointType.NodeRemoved
    };
    for (const type of Object.values(allBreakpointTypes)) {
      const label = Sources.DebuggerPausedMessage.BreakpointTypeNouns.get(type);
      if (label) {
        breakpointsMenu.defaultSection().appendCheckboxItem(label(), toggleBreakpoint.bind(null, type), domDebuggerModel.hasDOMBreakpoint(node, type));
      }
    }
  }
}
//# sourceMappingURL=DOMBreakpointsSidebarPane.js.map
