import * as i18n from "../../../../core/i18n/i18n.js";
import { Events as FilteredListWidgetEvents, FilteredListWidget, Provider } from "./FilteredListWidget.js";
const UIStrings = {
  pressEnterToConfirmOrEscapeTo: "{PH1} (Press 'Enter' to confirm or 'Escape' to cancel.)"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/quick_open/QuickInput.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class QuickInput {
  constructor() {
    throw new ReferenceError("Instance type not implemented.");
  }
  static show(options) {
    let canceledPromise = new Promise((_r) => {
    });
    const fulfilledPromise = new Promise((resolve) => {
      const provider = new QuickInputProvider(options, resolve);
      const widget = new FilteredListWidget(provider);
      if (options.placeHolder) {
        widget.setHintElement(options.placeHolder);
      }
      widget.setPromptTitle(options.placeHolder || options.prompt);
      widget.showAsDialog(options.prompt);
      canceledPromise = widget.once(FilteredListWidgetEvents.Hidden);
      widget.setQuery(options.value || "");
      if (options.valueSelection) {
        widget.setQuerySelectedRange(options.valueSelection[0], options.valueSelection[1]);
      }
    });
    return Promise.race([fulfilledPromise, canceledPromise]).then((values) => {
      return values;
    });
  }
}
class QuickInputProvider extends Provider {
  options;
  resolve;
  constructor(options, resolve) {
    super();
    this.options = options;
    this.resolve = resolve;
  }
  notFoundText() {
    return i18nString(UIStrings.pressEnterToConfirmOrEscapeTo, { PH1: this.options.prompt });
  }
  selectItem(_itemIndex, promptValue) {
    this.resolve(promptValue);
  }
}
//# sourceMappingURL=QuickInput.js.map
