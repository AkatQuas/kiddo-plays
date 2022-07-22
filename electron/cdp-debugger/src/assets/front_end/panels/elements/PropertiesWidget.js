import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as ObjectUI from "../../ui/legacy/components/object_ui/object_ui.js";
import * as UI from "../../ui/legacy/legacy.js";
import propertiesWidgetStyles from "./propertiesWidget.css.js";
import { StylesSidebarPane } from "./StylesSidebarPane.js";
const OBJECT_GROUP_NAME = "properties-sidebar-pane";
const UIStrings = {
  filter: "Filter",
  filterProperties: "Filter Properties",
  showAll: "Show all",
  showAllTooltip: "When unchecked, only properties whose values are neither null nor undefined will be shown",
  noMatchingProperty: "No matching property"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/PropertiesWidget.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let propertiesWidgetInstance;
export class PropertiesWidget extends UI.ThrottledWidget.ThrottledWidget {
  node;
  showAllPropertiesSetting;
  filterRegex = null;
  noMatchesElement;
  treeOutline;
  expandController;
  lastRequestedNode;
  constructor() {
    super(true);
    this.showAllPropertiesSetting = Common.Settings.Settings.instance().createSetting("showAllProperties", false);
    this.showAllPropertiesSetting.addChangeListener(this.filterList.bind(this));
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMModel.DOMModel, SDK.DOMModel.Events.AttrModified, this.onNodeChange, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMModel.DOMModel, SDK.DOMModel.Events.AttrRemoved, this.onNodeChange, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMModel.DOMModel, SDK.DOMModel.Events.CharacterDataModified, this.onNodeChange, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(SDK.DOMModel.DOMModel, SDK.DOMModel.Events.ChildNodeCountUpdated, this.onNodeChange, this);
    UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, this.setNode, this);
    this.node = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode);
    const hbox = this.contentElement.createChild("div", "hbox properties-widget-toolbar");
    const filterContainerElement = hbox.createChild("div", "properties-widget-filter-box");
    const filterInput = StylesSidebarPane.createPropertyFilterElement(i18nString(UIStrings.filter), hbox, this.filterProperties.bind(this));
    UI.ARIAUtils.setAccessibleName(filterInput, i18nString(UIStrings.filterProperties));
    filterContainerElement.appendChild(filterInput);
    const toolbar = new UI.Toolbar.Toolbar("styles-pane-toolbar", hbox);
    toolbar.appendToolbarItem(new UI.Toolbar.ToolbarSettingCheckbox(this.showAllPropertiesSetting, i18nString(UIStrings.showAllTooltip), i18nString(UIStrings.showAll)));
    this.noMatchesElement = this.contentElement.createChild("div", "gray-info-message hidden");
    this.noMatchesElement.textContent = i18nString(UIStrings.noMatchingProperty);
    this.treeOutline = new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline({ readOnly: true });
    this.treeOutline.setShowSelectionOnKeyboardFocus(true, false);
    this.expandController = new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController(this.treeOutline);
    this.contentElement.appendChild(this.treeOutline.element);
    this.treeOutline.addEventListener(UI.TreeOutline.Events.ElementExpanded, () => {
      Host.userMetrics.actionTaken(Host.UserMetrics.Action.DOMPropertiesExpanded);
    });
    this.update();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!propertiesWidgetInstance || forceNew) {
      propertiesWidgetInstance = new PropertiesWidget();
    }
    return propertiesWidgetInstance;
  }
  filterProperties(regex) {
    this.filterRegex = regex;
    this.filterList();
  }
  filterList() {
    let noMatches = true;
    for (const element of this.treeOutline.rootElement().children()) {
      const { property } = element;
      const hidden = !property.match({
        includeNullOrUndefinedValues: this.showAllPropertiesSetting.get(),
        regex: this.filterRegex
      });
      if (!hidden) {
        noMatches = false;
      }
      element.hidden = hidden;
    }
    this.noMatchesElement.classList.toggle("hidden", !noMatches);
  }
  setNode(event) {
    this.node = event.data;
    this.update();
  }
  async doUpdate() {
    if (this.lastRequestedNode) {
      this.lastRequestedNode.domModel().runtimeModel().releaseObjectGroup(OBJECT_GROUP_NAME);
      delete this.lastRequestedNode;
    }
    if (!this.node) {
      this.treeOutline.removeChildren();
      return;
    }
    this.lastRequestedNode = this.node;
    const object = await this.node.resolveToObject(OBJECT_GROUP_NAME);
    if (!object) {
      return;
    }
    const treeElement = this.treeOutline.rootElement();
    let { properties } = await SDK.RemoteObject.RemoteObject.loadFromObjectPerProto(object, true);
    treeElement.removeChildren();
    if (properties === null) {
      properties = [];
    }
    ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement.populateWithProperties(treeElement, properties, null, true, true, object);
    this.filterList();
  }
  onNodeChange(event) {
    if (!this.node) {
      return;
    }
    const data = event.data;
    const node = data instanceof SDK.DOMModel.DOMNode ? data : data.node;
    if (this.node !== node) {
      return;
    }
    this.update();
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([propertiesWidgetStyles]);
  }
}
//# sourceMappingURL=PropertiesWidget.js.map
