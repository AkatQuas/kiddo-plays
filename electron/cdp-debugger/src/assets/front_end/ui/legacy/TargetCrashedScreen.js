import * as i18n from "../../core/i18n/i18n.js";
import targetCrashedScreenStyles from "./targetCrashedScreen.css.legacy.js";
import { VBox } from "./Widget.js";
const UIStrings = {
  devtoolsWasDisconnectedFromThe: "DevTools was disconnected from the page.",
  oncePageIsReloadedDevtoolsWill: "Once page is reloaded, DevTools will automatically reconnect."
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/TargetCrashedScreen.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TargetCrashedScreen extends VBox {
  hideCallback;
  constructor(hideCallback) {
    super(true);
    this.registerRequiredCSS(targetCrashedScreenStyles);
    this.contentElement.createChild("div", "message").textContent = i18nString(UIStrings.devtoolsWasDisconnectedFromThe);
    this.contentElement.createChild("div", "message").textContent = i18nString(UIStrings.oncePageIsReloadedDevtoolsWill);
    this.hideCallback = hideCallback;
  }
  willHide() {
    this.hideCallback.call(null);
  }
}
//# sourceMappingURL=TargetCrashedScreen.js.map
