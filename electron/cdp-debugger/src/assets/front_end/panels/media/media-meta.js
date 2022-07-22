import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  media: "Media",
  video: "video",
  showMedia: "Show Media"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/media-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedMediaModule;
async function loadMediaModule() {
  if (!loadedMediaModule) {
    loadedMediaModule = await import("./media.js");
  }
  return loadedMediaModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: "medias",
  title: i18nLazyString(UIStrings.media),
  commandPrompt: i18nLazyString(UIStrings.showMedia),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const Media = await loadMediaModule();
    return Media.MainView.MainView.instance();
  },
  tags: [
    i18nLazyString(UIStrings.media),
    i18nLazyString(UIStrings.video)
  ]
});
//# sourceMappingURL=media-meta.js.map
