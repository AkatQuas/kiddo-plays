import * as i18n from "../../core/i18n/i18n.js";
import { Dialog } from "./Dialog.js";
import { SizeBehavior } from "./GlassPane.js";
import remoteDebuggingTerminatedScreenStyles from "./remoteDebuggingTerminatedScreen.css.legacy.js";
import { createTextButton } from "./UIUtils.js";
import { VBox } from "./Widget.js";
const UIStrings = {
  debuggingConnectionWasClosed: "Debugging connection was closed. Reason: ",
  reconnectWhenReadyByReopening: "Reconnect when ready by reopening DevTools.",
  reconnectDevtools: "Reconnect `DevTools`"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/RemoteDebuggingTerminatedScreen.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class RemoteDebuggingTerminatedScreen extends VBox {
  constructor(reason) {
    super(true);
    this.registerRequiredCSS(remoteDebuggingTerminatedScreenStyles);
    const message = this.contentElement.createChild("div", "message");
    const span = message.createChild("span");
    span.append(i18nString(UIStrings.debuggingConnectionWasClosed));
    const reasonElement = span.createChild("span", "reason");
    reasonElement.textContent = reason;
    this.contentElement.createChild("div", "message").textContent = i18nString(UIStrings.reconnectWhenReadyByReopening);
    const button = createTextButton(i18nString(UIStrings.reconnectDevtools), () => window.location.reload());
    this.contentElement.createChild("div", "button").appendChild(button);
  }
  static show(reason) {
    const dialog = new Dialog();
    dialog.setSizeBehavior(SizeBehavior.MeasureContent);
    dialog.addCloseButton();
    dialog.setDimmed(true);
    new RemoteDebuggingTerminatedScreen(reason).show(dialog.contentElement);
    dialog.show();
  }
}
//# sourceMappingURL=RemoteDebuggingTerminatedScreen.js.map
