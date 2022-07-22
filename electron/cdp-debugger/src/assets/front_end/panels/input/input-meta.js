import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  inputs: "Inputs",
  pause: "Pause",
  resume: "Resume",
  showInputs: "Show Inputs",
  startRecording: "Start recording",
  startReplaying: "Start replaying",
  stopRecording: "Stop recording"
};
const str_ = i18n.i18n.registerUIStrings("panels/input//input-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
let loadedInputModule;
async function loadInputModule() {
  if (!loadedInputModule) {
    loadedInputModule = await import("./input.js");
  }
  return loadedInputModule;
}
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "Inputs",
  title: i18nLazyString(UIStrings.inputs),
  commandPrompt: i18nLazyString(UIStrings.showInputs),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 7,
  async loadView() {
    const Input = await loadInputModule();
    return Input.InputTimeline.InputTimeline.instance();
  },
  experiment: Root.Runtime.ExperimentName.TIMELINE_REPLAY_EVENT
});
UI.ActionRegistration.registerActionExtension({
  actionId: "input.toggle-recording",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_START_RECORDING,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_STOP_RECORDING,
  toggleWithRedColor: true,
  async loadActionDelegate() {
    const Input = await loadInputModule();
    return Input.InputTimeline.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.INPUTS,
  experiment: Root.Runtime.ExperimentName.TIMELINE_REPLAY_EVENT,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.startRecording)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.stopRecording)
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "input.start-replaying",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_PLAY,
  toggleable: false,
  async loadActionDelegate() {
    const Input = await loadInputModule();
    return Input.InputTimeline.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.INPUTS,
  experiment: Root.Runtime.ExperimentName.TIMELINE_REPLAY_EVENT,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.startReplaying)
    }
  ]
});
UI.ActionRegistration.registerActionExtension({
  actionId: "input.toggle-pause",
  iconClass: UI.ActionRegistration.IconClass.LARGEICON_PAUSE,
  toggleable: true,
  toggledIconClass: UI.ActionRegistration.IconClass.LARGEICON_RESUME,
  async loadActionDelegate() {
    const Input = await loadInputModule();
    return Input.InputTimeline.ActionDelegate.instance();
  },
  category: UI.ActionRegistration.ActionCategory.INPUTS,
  experiment: Root.Runtime.ExperimentName.TIMELINE_REPLAY_EVENT,
  options: [
    {
      value: true,
      title: i18nLazyString(UIStrings.pause)
    },
    {
      value: false,
      title: i18nLazyString(UIStrings.resume)
    }
  ]
});
//# sourceMappingURL=input-meta.js.map
