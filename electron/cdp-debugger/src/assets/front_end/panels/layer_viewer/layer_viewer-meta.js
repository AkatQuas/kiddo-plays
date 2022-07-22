import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  resetView: "Reset view",
  switchToPanMode: "Switch to pan mode",
  switchToRotateMode: "Switch to rotate mode",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  panOrRotateUp: "Pan or rotate up",
  panOrRotateDown: "Pan or rotate down",
  panOrRotateLeft: "Pan or rotate left",
  panOrRotateRight: "Pan or rotate right"
};
const str_ = i18n.i18n.registerUIStrings("panels/layer_viewer/layer_viewer-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.reset-view",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.resetView),
  bindings: [
    {
      shortcut: "0"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.pan-mode",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.switchToPanMode),
  bindings: [
    {
      shortcut: "x"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.rotate-mode",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.switchToRotateMode),
  bindings: [
    {
      shortcut: "v"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.zoom-in",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.zoomIn),
  bindings: [
    {
      shortcut: "Shift+Plus"
    },
    {
      shortcut: "NumpadPlus"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.zoom-out",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.zoomOut),
  bindings: [
    {
      shortcut: "Shift+Minus"
    },
    {
      shortcut: "NumpadMinus"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.up",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.panOrRotateUp),
  bindings: [
    {
      shortcut: "Up"
    },
    {
      shortcut: "w"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.down",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.panOrRotateDown),
  bindings: [
    {
      shortcut: "Down"
    },
    {
      shortcut: "s"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.left",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.panOrRotateLeft),
  bindings: [
    {
      shortcut: "Left"
    },
    {
      shortcut: "a"
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "layers.right",
  category: UI.ActionRegistration.ActionCategory.LAYERS,
  title: i18nLazyString(UIStrings.panOrRotateRight),
  bindings: [
    {
      shortcut: "Right"
    },
    {
      shortcut: "d"
    }
  ]
});
//# sourceMappingURL=layer_viewer-meta.js.map
