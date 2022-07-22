import * as ObjectUIModule from "./object_ui.js";
self.ObjectUI = self.ObjectUI || {};
ObjectUI = ObjectUI || {};
ObjectUI.CustomPreviewComponent = ObjectUIModule.CustomPreviewComponent.CustomPreviewComponent;
ObjectUI.JavaScriptREPL = ObjectUIModule.JavaScriptREPL.JavaScriptREPL;
Object.defineProperty(ObjectUI.JavaScriptREPL, "_MaxLengthForEvaluation", {
  set: ObjectUIModule.JavaScriptREPL.setMaxLengthForEvaluation,
  get: ObjectUIModule.JavaScriptREPL.getMaxLengthForEvaluation
});
ObjectUI.ObjectPopoverHelper = ObjectUIModule.ObjectPopoverHelper.ObjectPopoverHelper;
ObjectUI.ArrayGroupingTreeElement = ObjectUIModule.ObjectPropertiesSection.ArrayGroupingTreeElement;
ObjectUI.ExpandableTextPropertyValue = ObjectUIModule.ObjectPropertiesSection.ExpandableTextPropertyValue;
ObjectUI.ObjectPropertiesSection = ObjectUIModule.ObjectPropertiesSection.ObjectPropertiesSection;
Object.defineProperty(ObjectUI.ObjectPropertiesSection, "_maxRenderableStringLength", {
  set: ObjectUIModule.ObjectPropertiesSection.setMaxRenderableStringLength,
  get: ObjectUIModule.ObjectPropertiesSection.getMaxRenderableStringLength
});
ObjectUI.ObjectPropertiesSection.getObjectPropertiesSectionFrom = ObjectUIModule.ObjectPropertiesSection.getObjectPropertiesSectionFrom;
ObjectUI.ObjectPropertiesSectionsTreeOutline = ObjectUIModule.ObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline;
ObjectUI.ObjectPropertiesSection.RootElement = ObjectUIModule.ObjectPropertiesSection.RootElement;
ObjectUI.ObjectPropertiesSection.Renderer = ObjectUIModule.ObjectPropertiesSection.Renderer;
ObjectUI.ObjectPropertyTreeElement = ObjectUIModule.ObjectPropertiesSection.ObjectPropertyTreeElement;
ObjectUI.ObjectPropertyPrompt = ObjectUIModule.ObjectPropertiesSection.ObjectPropertyPrompt;
ObjectUI.ObjectPropertiesSectionsTreeExpandController = ObjectUIModule.ObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController;
ObjectUI.RemoteObjectPreviewFormatter = ObjectUIModule.RemoteObjectPreviewFormatter.RemoteObjectPreviewFormatter;
//# sourceMappingURL=object_ui-legacy.js.map
