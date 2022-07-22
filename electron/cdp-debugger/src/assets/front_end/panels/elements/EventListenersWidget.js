import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as EventListeners from "../event_listeners/event_listeners.js";
const UIStrings = {
  frameworkListeners: "`Framework` listeners",
  refresh: "Refresh",
  showListenersOnTheAncestors: "Show listeners on the ancestors",
  ancestors: "Ancestors",
  eventListenersCategory: "Event listeners category",
  all: "All",
  passive: "Passive",
  blocking: "Blocking",
  resolveEventListenersBoundWith: "Resolve event listeners bound with framework"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/EventListenersWidget.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let eventListenersWidgetInstance;
export class EventListenersWidget extends UI.ThrottledWidget.ThrottledWidget {
  toolbarItemsInternal;
  showForAncestorsSetting;
  dispatchFilterBySetting;
  showFrameworkListenersSetting;
  eventListenersView;
  lastRequestedNode;
  constructor() {
    super();
    this.toolbarItemsInternal = [];
    this.showForAncestorsSetting = Common.Settings.Settings.instance().moduleSetting("showEventListenersForAncestors");
    this.showForAncestorsSetting.addChangeListener(this.update.bind(this));
    this.dispatchFilterBySetting = Common.Settings.Settings.instance().createSetting("eventListenerDispatchFilterType", DispatchFilterBy.All);
    this.dispatchFilterBySetting.addChangeListener(this.update.bind(this));
    this.showFrameworkListenersSetting = Common.Settings.Settings.instance().createSetting("showFrameowkrListeners", true);
    this.showFrameworkListenersSetting.setTitle(i18nString(UIStrings.frameworkListeners));
    this.showFrameworkListenersSetting.addChangeListener(this.showFrameworkListenersChanged.bind(this));
    this.eventListenersView = new EventListeners.EventListenersView.EventListenersView(this.update.bind(this));
    this.eventListenersView.show(this.element);
    const refreshButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.refresh), "largeicon-refresh");
    refreshButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.update.bind(this));
    this.toolbarItemsInternal.push(refreshButton);
    this.toolbarItemsInternal.push(new UI.Toolbar.ToolbarSettingCheckbox(this.showForAncestorsSetting, i18nString(UIStrings.showListenersOnTheAncestors), i18nString(UIStrings.ancestors)));
    const dispatchFilter = new UI.Toolbar.ToolbarComboBox(this.onDispatchFilterTypeChanged.bind(this), i18nString(UIStrings.eventListenersCategory));
    function addDispatchFilterOption(name, value) {
      const option = dispatchFilter.createOption(name, value);
      if (value === this.dispatchFilterBySetting.get()) {
        dispatchFilter.select(option);
      }
    }
    addDispatchFilterOption.call(this, i18nString(UIStrings.all), DispatchFilterBy.All);
    addDispatchFilterOption.call(this, i18nString(UIStrings.passive), DispatchFilterBy.Passive);
    addDispatchFilterOption.call(this, i18nString(UIStrings.blocking), DispatchFilterBy.Blocking);
    dispatchFilter.setMaxWidth(200);
    this.toolbarItemsInternal.push(dispatchFilter);
    this.toolbarItemsInternal.push(new UI.Toolbar.ToolbarSettingCheckbox(this.showFrameworkListenersSetting, i18nString(UIStrings.resolveEventListenersBoundWith)));
    UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, this.update, this);
    this.update();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!eventListenersWidgetInstance || forceNew) {
      eventListenersWidgetInstance = new EventListenersWidget();
    }
    return eventListenersWidgetInstance;
  }
  doUpdate() {
    if (this.lastRequestedNode) {
      this.lastRequestedNode.domModel().runtimeModel().releaseObjectGroup(objectGroupName);
      delete this.lastRequestedNode;
    }
    const node = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode);
    if (!node) {
      this.eventListenersView.reset();
      this.eventListenersView.addEmptyHolderIfNeeded();
      return Promise.resolve();
    }
    this.lastRequestedNode = node;
    const selectedNodeOnly = !this.showForAncestorsSetting.get();
    const promises = [];
    promises.push(node.resolveToObject(objectGroupName));
    if (!selectedNodeOnly) {
      let currentNode = node.parentNode;
      while (currentNode) {
        promises.push(currentNode.resolveToObject(objectGroupName));
        currentNode = currentNode.parentNode;
      }
      promises.push(this.windowObjectInNodeContext(node));
    }
    return Promise.all(promises).then(this.eventListenersView.addObjects.bind(this.eventListenersView)).then(this.showFrameworkListenersChanged.bind(this));
  }
  toolbarItems() {
    return this.toolbarItemsInternal;
  }
  onDispatchFilterTypeChanged(event) {
    const filter = event.target;
    this.dispatchFilterBySetting.set(filter.value);
  }
  showFrameworkListenersChanged() {
    const dispatchFilter = this.dispatchFilterBySetting.get();
    const showPassive = dispatchFilter === DispatchFilterBy.All || dispatchFilter === DispatchFilterBy.Passive;
    const showBlocking = dispatchFilter === DispatchFilterBy.All || dispatchFilter === DispatchFilterBy.Blocking;
    this.eventListenersView.showFrameworkListeners(this.showFrameworkListenersSetting.get(), showPassive, showBlocking);
  }
  windowObjectInNodeContext(node) {
    const executionContexts = node.domModel().runtimeModel().executionContexts();
    let context = executionContexts[0];
    if (node.frameId()) {
      for (let i = 0; i < executionContexts.length; ++i) {
        const executionContext = executionContexts[i];
        if (executionContext.frameId === node.frameId() && executionContext.isDefault) {
          context = executionContext;
        }
      }
    }
    return context.evaluate({
      expression: "self",
      objectGroup: objectGroupName,
      includeCommandLineAPI: false,
      silent: true,
      returnByValue: false,
      generatePreview: false,
      throwOnSideEffect: void 0,
      timeout: void 0,
      disableBreaks: void 0,
      replMode: void 0,
      allowUnsafeEvalBlockedByCSP: void 0
    }, false, false).then((result) => {
      if ("object" in result) {
        return result.object;
      }
      return null;
    });
  }
  eventListenersArrivedForTest() {
  }
}
export const DispatchFilterBy = {
  All: "All",
  Blocking: "Blocking",
  Passive: "Passive"
};
const objectGroupName = "event-listeners-panel";
//# sourceMappingURL=EventListenersWidget.js.map
