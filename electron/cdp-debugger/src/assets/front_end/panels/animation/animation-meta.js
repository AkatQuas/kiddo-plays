import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
let loadedAnimationModule;
const UIStrings = {
  animations: "Animations",
  showAnimations: "Show Animations"
};
const str_ = i18n.i18n.registerUIStrings("panels/animation/animation-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
async function loadAnimationModule() {
  if (!loadedAnimationModule) {
    loadedAnimationModule = await import("./animation.js");
  }
  return loadedAnimationModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "animations",
  title: i18nLazyString(UIStrings.animations),
  commandPrompt: i18nLazyString(UIStrings.showAnimations),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 0,
  async loadView() {
    const Animation = await loadAnimationModule();
    return Animation.AnimationTimeline.AnimationTimeline.instance();
  }
});
//# sourceMappingURL=animation-meta.js.map
