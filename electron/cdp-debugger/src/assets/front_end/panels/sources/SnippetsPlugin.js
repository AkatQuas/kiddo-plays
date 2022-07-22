import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Snippets from "../snippets/snippets.js";
import { Plugin } from "./Plugin.js";
const UIStrings = {
  enter: "\u2318+Enter",
  ctrlenter: "Ctrl+Enter"
};
const str_ = i18n.i18n.registerUIStrings("panels/sources/SnippetsPlugin.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SnippetsPlugin extends Plugin {
  static accepts(uiSourceCode) {
    return Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(uiSourceCode);
  }
  async rightToolbarItems() {
    const runSnippet = UI.Toolbar.Toolbar.createActionButtonForId("debugger.run-snippet");
    runSnippet.setText(Host.Platform.isMac() ? i18nString(UIStrings.enter) : i18nString(UIStrings.ctrlenter));
    return [runSnippet];
  }
}
//# sourceMappingURL=SnippetsPlugin.js.map
