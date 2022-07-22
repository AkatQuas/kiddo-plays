import * as i18n from "../../../../core/i18n/i18n.js";
import { FilteredListWidget, getRegisteredProviders } from "./FilteredListWidget.js";
const UIStrings = {
  typeToSeeAvailableCommands: "Type '?' to see available commands"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/quick_open/QuickOpen.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export const history = [];
export class QuickOpenImpl {
  prefix;
  prefixes;
  providers;
  filteredListWidget;
  constructor() {
    this.prefix = null;
    this.prefixes = [];
    this.providers = /* @__PURE__ */ new Map();
    this.filteredListWidget = null;
    getRegisteredProviders().forEach(this.addProvider.bind(this));
    this.prefixes.sort((a, b) => b.length - a.length);
  }
  static show(query) {
    const quickOpen = new this();
    const filteredListWidget = new FilteredListWidget(null, history, quickOpen.queryChanged.bind(quickOpen));
    quickOpen.filteredListWidget = filteredListWidget;
    filteredListWidget.setHintElement(i18nString(UIStrings.typeToSeeAvailableCommands));
    filteredListWidget.showAsDialog();
    filteredListWidget.setQuery(query);
  }
  addProvider(extension) {
    const prefix = extension.prefix;
    if (prefix === null) {
      return;
    }
    this.prefixes.push(prefix);
    this.providers.set(prefix, {
      provider: extension.provider,
      titlePrefix: extension.titlePrefix,
      titleSuggestion: extension.titleSuggestion
    });
  }
  async queryChanged(query) {
    const prefix = this.prefixes.find((prefix2) => query.startsWith(prefix2));
    if (typeof prefix !== "string") {
      return;
    }
    if (!this.filteredListWidget) {
      return;
    }
    this.filteredListWidget.setPrefix(prefix);
    const titlePrefixFunction = this.providers.get(prefix)?.titlePrefix;
    this.filteredListWidget.setCommandPrefix(titlePrefixFunction ? titlePrefixFunction() : "");
    const titleSuggestionFunction = query === prefix && this.providers.get(prefix)?.titleSuggestion;
    this.filteredListWidget.setCommandSuggestion(titleSuggestionFunction ? titleSuggestionFunction() : "");
    if (this.prefix === prefix) {
      return;
    }
    this.prefix = prefix;
    this.filteredListWidget.setProvider(null);
    const providerFunction = this.providers.get(prefix)?.provider;
    if (!providerFunction) {
      return;
    }
    const provider = await providerFunction();
    if (this.prefix !== prefix || !this.filteredListWidget) {
      return;
    }
    this.filteredListWidget.setProvider(provider);
    this.providerLoadedForTest(provider);
  }
  providerLoadedForTest(_provider) {
  }
}
let showActionDelegateInstance;
export class ShowActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!showActionDelegateInstance || forceNew) {
      showActionDelegateInstance = new ShowActionDelegate();
    }
    return showActionDelegateInstance;
  }
  handleAction(context, actionId) {
    switch (actionId) {
      case "quickOpen.show":
        QuickOpenImpl.show("");
        return true;
    }
    return false;
  }
}
//# sourceMappingURL=QuickOpen.js.map
