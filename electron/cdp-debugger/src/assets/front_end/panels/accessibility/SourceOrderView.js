import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { AccessibilitySubPane } from "./AccessibilitySubPane.js";
const UIStrings = {
  sourceOrderViewer: "Source Order Viewer",
  noSourceOrderInformation: "No source order information available",
  thereMayBeADelayInDisplaying: "There may be a delay in displaying source order for elements with many children",
  showSourceOrder: "Show source order"
};
const str_ = i18n.i18n.registerUIStrings("panels/accessibility/SourceOrderView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const MAX_CHILD_ELEMENTS_THRESHOLD = 300;
export class SourceOrderPane extends AccessibilitySubPane {
  noNodeInfo;
  warning;
  checked;
  checkboxLabel;
  checkboxElement;
  overlayModel;
  constructor() {
    super(i18nString(UIStrings.sourceOrderViewer));
    this.noNodeInfo = this.createInfo(i18nString(UIStrings.noSourceOrderInformation));
    this.warning = this.createInfo(i18nString(UIStrings.thereMayBeADelayInDisplaying));
    this.warning.id = "source-order-warning";
    this.checked = false;
    this.checkboxLabel = UI.UIUtils.CheckboxLabel.create(i18nString(UIStrings.showSourceOrder), false);
    this.checkboxElement = this.checkboxLabel.checkboxElement;
    this.checkboxLabel.classList.add("source-order-checkbox");
    this.checkboxElement.addEventListener("click", this.checkboxClicked.bind(this), false);
    this.element.appendChild(this.checkboxLabel);
    this.nodeInternal = null;
    this.overlayModel = null;
  }
  async setNodeAsync(node) {
    if (!this.checkboxLabel.classList.contains("hidden")) {
      this.checked = this.checkboxElement.checked;
    }
    this.checkboxElement.checked = false;
    this.checkboxClicked();
    super.setNode(node);
    if (!this.nodeInternal) {
      this.overlayModel = null;
      return;
    }
    let foundSourceOrder = false;
    const childCount = this.nodeInternal.childNodeCount();
    if (childCount > 0) {
      if (!this.nodeInternal.children()) {
        await this.nodeInternal.getSubtree(1, false);
      }
      const children = this.nodeInternal.children();
      foundSourceOrder = children.some((child) => child.nodeType() === Node.ELEMENT_NODE);
    }
    this.noNodeInfo.classList.toggle("hidden", foundSourceOrder);
    this.warning.classList.toggle("hidden", childCount < MAX_CHILD_ELEMENTS_THRESHOLD);
    this.checkboxLabel.classList.toggle("hidden", !foundSourceOrder);
    if (foundSourceOrder) {
      this.overlayModel = this.nodeInternal.domModel().overlayModel();
      this.checkboxElement.checked = this.checked;
      this.checkboxClicked();
    } else {
      this.overlayModel = null;
    }
  }
  checkboxClicked() {
    if (!this.nodeInternal || !this.overlayModel) {
      return;
    }
    if (this.checkboxElement.checked) {
      Host.userMetrics.actionTaken(Host.UserMetrics.Action.SourceOrderViewActivated);
      this.overlayModel.highlightSourceOrderInOverlay(this.nodeInternal);
    } else {
      this.overlayModel.hideSourceOrderInOverlay();
    }
  }
}
//# sourceMappingURL=SourceOrderView.js.map
