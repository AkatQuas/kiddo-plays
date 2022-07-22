import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as SourceMapScopes from "../../models/source_map_scopes/source_map_scopes.js";
import * as LinearMemoryInspector from "../../ui/components/linear_memory_inspector/linear_memory_inspector.js";
import * as ObjectUI from "../../ui/legacy/components/object_ui/object_ui.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import scopeChainSidebarPaneStyles from "./scopeChainSidebarPane.css.js";
const UIStrings = {
  loading: "Loading...",
  notPaused: "Not paused",
  noVariables: "No variables",
  closureS: "Closure ({PH1})",
  closure: "Closure",
  exception: "Exception",
  returnValue: "Return value",
  revealInMemoryInspectorPanel: "Reveal in Memory Inspector panel"
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/ScopeChainSidebarPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let scopeChainSidebarPaneInstance;
export class ScopeChainSidebarPane extends UI.Widget.VBox {
  treeOutline;
  expandController;
  linkifier;
  infoElement;
  #scopesScript = null;
  constructor() {
    super(true);
    this.treeOutline = new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline();
    this.treeOutline.setShowSelectionOnKeyboardFocus(true);
    this.expandController = new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController(this.treeOutline);
    this.linkifier = new Components.Linkifier.Linkifier();
    this.infoElement = document.createElement("div");
    this.infoElement.className = "gray-info-message";
    this.infoElement.tabIndex = -1;
    void this.update();
  }
  static instance() {
    if (!scopeChainSidebarPaneInstance) {
      scopeChainSidebarPaneInstance = new ScopeChainSidebarPane();
    }
    return scopeChainSidebarPaneInstance;
  }
  flavorChanged(_object) {
    void this.update();
  }
  focus() {
    if (this.hasFocus()) {
      return;
    }
    if (UI.Context.Context.instance().flavor(SDK.DebuggerModel.DebuggerPausedDetails)) {
      this.treeOutline.forceSelect();
    }
  }
  sourceMapAttached(event) {
    if (event.data.client === this.#scopesScript) {
      void this.update();
    }
  }
  setScopeSourceMapSubscription(callFrame) {
    const oldScript = this.#scopesScript;
    this.#scopesScript = callFrame?.script ?? null;
    if (oldScript?.debuggerModel === this.#scopesScript?.debuggerModel) {
      return;
    }
    if (oldScript) {
      oldScript.debuggerModel.sourceMapManager().removeEventListener(SDK.SourceMapManager.Events.SourceMapAttached, this.sourceMapAttached, this);
    }
    if (this.#scopesScript) {
      this.#scopesScript.debuggerModel.sourceMapManager().addEventListener(SDK.SourceMapManager.Events.SourceMapAttached, this.sourceMapAttached, this);
    }
  }
  async update() {
    this.infoElement.textContent = i18nString(UIStrings.loading);
    this.contentElement.removeChildren();
    this.contentElement.appendChild(this.infoElement);
    this.linkifier.reset();
    const callFrame = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    this.setScopeSourceMapSubscription(callFrame);
    const [thisObject, scopeChain] = await Promise.all([
      SourceMapScopes.NamesResolver.resolveThisObject(callFrame),
      SourceMapScopes.NamesResolver.resolveScopeChain(callFrame)
    ]);
    if (callFrame === UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame)) {
      const details = UI.Context.Context.instance().flavor(SDK.DebuggerModel.DebuggerPausedDetails);
      this.treeOutline.removeChildren();
      if (!details || !callFrame || !scopeChain) {
        this.infoElement.textContent = i18nString(UIStrings.notPaused);
        return;
      }
      this.contentElement.removeChildren();
      this.contentElement.appendChild(this.treeOutline.element);
      let foundLocalScope = false;
      for (let i = 0; i < scopeChain.length; ++i) {
        const scope = scopeChain[i];
        const extraProperties = this.extraPropertiesForScope(scope, details, callFrame, thisObject, i === 0);
        if (scope.type() === Protocol.Debugger.ScopeType.Local) {
          foundLocalScope = true;
        }
        const section = this.createScopeSectionTreeElement(scope, extraProperties);
        if (scope.type() === Protocol.Debugger.ScopeType.Global) {
          section.collapse();
        } else if (!foundLocalScope || scope.type() === Protocol.Debugger.ScopeType.Local) {
          section.expand();
        }
        this.treeOutline.appendChild(section);
        if (i === 0) {
          section.select(true);
        }
      }
      this.sidebarPaneUpdatedForTest();
    }
  }
  createScopeSectionTreeElement(scope, extraProperties) {
    let emptyPlaceholder = null;
    if (scope.type() === Protocol.Debugger.ScopeType.Local || Protocol.Debugger.ScopeType.Closure) {
      emptyPlaceholder = i18nString(UIStrings.noVariables);
    }
    let title = scope.typeName();
    if (scope.type() === Protocol.Debugger.ScopeType.Closure) {
      const scopeName = scope.name();
      if (scopeName) {
        title = i18nString(UIStrings.closureS, { PH1: UI.UIUtils.beautifyFunctionName(scopeName) });
      } else {
        title = i18nString(UIStrings.closure);
      }
    }
    let subtitle = scope.description();
    if (!title || title === subtitle) {
      subtitle = null;
    }
    const icon = scope.icon();
    const titleElement = document.createElement("div");
    titleElement.classList.add("scope-chain-sidebar-pane-section-header");
    titleElement.classList.add("tree-element-title");
    if (icon) {
      const iconElement = document.createElement("img");
      iconElement.classList.add("scope-chain-sidebar-pane-section-icon");
      iconElement.src = icon;
      titleElement.appendChild(iconElement);
    }
    titleElement.createChild("div", "scope-chain-sidebar-pane-section-subtitle").textContent = subtitle;
    titleElement.createChild("div", "scope-chain-sidebar-pane-section-title").textContent = title;
    const section = new ObjectUI.ObjectPropertiesSection.RootElement(SourceMapScopes.NamesResolver.resolveScopeInObject(scope), this.linkifier, emptyPlaceholder, ObjectUI.ObjectPropertiesSection.ObjectPropertiesMode.All, extraProperties);
    section.title = titleElement;
    section.listItemElement.classList.add("scope-chain-sidebar-pane-section");
    section.listItemElement.setAttribute("aria-label", title);
    this.expandController.watchSection(title + (subtitle ? ":" + subtitle : ""), section);
    return section;
  }
  extraPropertiesForScope(scope, details, callFrame, thisObject, isFirstScope) {
    if (scope.type() !== Protocol.Debugger.ScopeType.Local || callFrame.script.isWasm()) {
      return [];
    }
    const extraProperties = [];
    if (thisObject) {
      extraProperties.push(new SDK.RemoteObject.RemoteObjectProperty("this", thisObject, void 0, void 0, void 0, void 0, void 0, true));
    }
    if (isFirstScope) {
      const exception = details.exception();
      if (exception) {
        extraProperties.push(new SDK.RemoteObject.RemoteObjectProperty(i18nString(UIStrings.exception), exception, void 0, void 0, void 0, void 0, void 0, true));
      }
      const returnValue = callFrame.returnValue();
      if (returnValue) {
        extraProperties.push(new SDK.RemoteObject.RemoteObjectProperty(i18nString(UIStrings.returnValue), returnValue, void 0, void 0, void 0, void 0, void 0, true, callFrame.setReturnValue.bind(callFrame)));
      }
    }
    return extraProperties;
  }
  sidebarPaneUpdatedForTest() {
  }
  wasShown() {
    super.wasShown();
    this.treeOutline.registerCSSFiles([scopeChainSidebarPaneStyles]);
    this.registerCSSFiles([scopeChainSidebarPaneStyles]);
  }
}
let openLinearMemoryInspectorInstance;
export class OpenLinearMemoryInspector extends UI.Widget.VBox {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!openLinearMemoryInspectorInstance || forceNew) {
      openLinearMemoryInspectorInstance = new OpenLinearMemoryInspector();
    }
    return openLinearMemoryInspectorInstance;
  }
  appendApplicableItems(event, contextMenu, target) {
    if (target instanceof ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement) {
      if (target.property && target.property.value && LinearMemoryInspector.LinearMemoryInspectorController.isMemoryObjectProperty(target.property.value)) {
        contextMenu.debugSection().appendItem(i18nString(UIStrings.revealInMemoryInspectorPanel), this.openMemoryInspector.bind(this, target.property.value));
      }
    }
  }
  async openMemoryInspector(obj) {
    const controller = LinearMemoryInspector.LinearMemoryInspectorController.LinearMemoryInspectorController.instance();
    Host.userMetrics.linearMemoryInspectorRevealedFrom(Host.UserMetrics.LinearMemoryInspectorRevealedFrom.ContextMenu);
    void controller.openInspectorView(obj);
  }
}
//# sourceMappingURL=ScopeChainSidebarPane.js.map
