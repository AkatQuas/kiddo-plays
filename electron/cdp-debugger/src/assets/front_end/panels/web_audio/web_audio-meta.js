import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  webaudio: "WebAudio",
  audio: "audio",
  showWebaudio: "Show WebAudio"
};
const str_ = i18n.i18n.registerUIStrings("panels/web_audio/web_audio-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedWebAudioModule;
async function loadWebAudioModule() {
  if (!loadedWebAudioModule) {
    loadedWebAudioModule = await import("./web_audio.js");
  }
  return loadedWebAudioModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "web-audio",
  title: i18nLazyString(UIStrings.webaudio),
  commandPrompt: i18nLazyString(UIStrings.showWebaudio),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const WebAudio = await loadWebAudioModule();
    return WebAudio.WebAudioView.WebAudioView.instance();
  },
  tags: [i18nLazyString(UIStrings.audio)]
});
//# sourceMappingURL=web_audio-meta.js.map
