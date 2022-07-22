import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { Events } from "./LighthouseController.js";
import lighthouseDialogStyles from "./lighthouseDialog.css.js";
const UIStrings = {
  timespanStarting: "Timespan starting\u2026",
  timespanStarted: "Timespan started, interact with the page",
  endTimespan: "End timespan",
  cancel: "Cancel"
};
const str_ = i18n.i18n.registerUIStrings("panels/lighthouse/LighthouseTimespanView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class TimespanView extends UI.Dialog.Dialog {
  controller;
  statusHeader;
  endButton;
  constructor(controller) {
    super();
    this.controller = controller;
    this.statusHeader = null;
    this.endButton = null;
    this.setDimmed(true);
    this.setCloseOnEscape(false);
    this.setOutsideClickCallback((event) => event.consume(true));
    this.render();
  }
  show(dialogRenderElement) {
    this.reset();
    super.show(dialogRenderElement);
  }
  reset() {
    if (this.statusHeader && this.endButton) {
      this.statusHeader.textContent = i18nString(UIStrings.timespanStarting);
      this.endButton.disabled = true;
    }
  }
  ready() {
    if (this.statusHeader && this.endButton) {
      this.statusHeader.textContent = i18nString(UIStrings.timespanStarted);
      this.endButton.disabled = false;
      this.endButton.focus();
    }
  }
  render() {
    const dialogRoot = UI.Utils.createShadowRootWithCoreStyles(this.contentElement, { cssFile: [lighthouseDialogStyles], delegatesFocus: void 0 });
    this.endButton = UI.UIUtils.createTextButton(i18nString(UIStrings.endTimespan), this.endTimespan.bind(this), void 0, true);
    const cancelButton = UI.UIUtils.createTextButton(i18nString(UIStrings.cancel), this.cancel.bind(this));
    const fragment = UI.Fragment.Fragment.build`
  <div class="lighthouse-view vbox">
  <h2 $="status-header"></h2>
  <div class="lighthouse-action-buttons hbox">
  ${cancelButton}
  ${this.endButton}
  </div>
  </div>
  `;
    this.statusHeader = fragment.$("status-header");
    dialogRoot.appendChild(fragment.element());
    this.setSizeBehavior(UI.GlassPane.SizeBehavior.SetExactWidthMaxHeight);
    this.setMaxContentSize(new UI.Geometry.Size(500, 400));
    this.reset();
  }
  endTimespan() {
    this.controller.dispatchEventToListeners(Events.RequestLighthouseTimespanEnd, false);
  }
  cancel() {
    this.controller.dispatchEventToListeners(Events.RequestLighthouseCancel);
  }
}
//# sourceMappingURL=LighthouseTimespanView.js.map
