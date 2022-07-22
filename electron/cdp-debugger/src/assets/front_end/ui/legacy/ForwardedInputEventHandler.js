import * as Host from "../../core/host/host.js";
import { Context } from "./Context.js";
import { KeyboardShortcut } from "./KeyboardShortcut.js";
import { ForwardedShortcut, ShortcutRegistry } from "./ShortcutRegistry.js";
export class ForwardedInputEventHandler {
  constructor() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(Host.InspectorFrontendHostAPI.Events.KeyEventUnhandled, this.onKeyEventUnhandled, this);
  }
  async onKeyEventUnhandled(event) {
    const { type, key, keyCode, modifiers } = event.data;
    if (type !== "keydown") {
      return;
    }
    const context = Context.instance();
    const shortcutRegistry = ShortcutRegistry.instance();
    context.setFlavor(ForwardedShortcut, ForwardedShortcut.instance);
    await shortcutRegistry.handleKey(KeyboardShortcut.makeKey(keyCode, modifiers), key);
    context.setFlavor(ForwardedShortcut, null);
  }
}
new ForwardedInputEventHandler();
//# sourceMappingURL=ForwardedInputEventHandler.js.map
