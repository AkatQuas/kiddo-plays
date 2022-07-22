import * as i18n from "../../core/i18n/i18n.js";
import * as Utils from "./utils/utils.js";
import * as ARIAUtils from "./ARIAUtils.js";
import { Keys } from "./KeyboardShortcut.js";
import { createTextButton } from "./UIUtils.js";
import infobarStyles from "./infobar.css.legacy.js";
const UIStrings = {
  dontShowAgain: "Don't show again",
  learnMore: "Learn more",
  close: "Close"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/Infobar.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class Infobar {
  element;
  shadowRoot;
  contentElement;
  mainRow;
  detailsRows;
  hasDetails;
  detailsMessage;
  infoContainer;
  infoMessage;
  infoText;
  actionContainer;
  disableSetting;
  closeContainer;
  toggleElement;
  closeButton;
  closeCallback;
  #firstFocusableElement = null;
  parentView;
  constructor(type, text, actions, disableSetting) {
    this.element = document.createElement("div");
    this.element.classList.add("flex-none");
    this.shadowRoot = Utils.createShadowRootWithCoreStyles(this.element, { cssFile: infobarStyles, delegatesFocus: void 0 });
    this.contentElement = this.shadowRoot.createChild("div", "infobar infobar-" + type);
    this.mainRow = this.contentElement.createChild("div", "infobar-main-row");
    this.detailsRows = this.contentElement.createChild("div", "infobar-details-rows hidden");
    this.hasDetails = false;
    this.detailsMessage = "";
    this.infoContainer = this.mainRow.createChild("div", "infobar-info-container");
    this.infoMessage = this.infoContainer.createChild("div", "infobar-info-message");
    this.infoMessage.createChild("div", type + "-icon icon");
    this.infoText = this.infoMessage.createChild("div", "infobar-info-text");
    this.infoText.textContent = text;
    ARIAUtils.markAsAlert(this.infoText);
    this.actionContainer = this.infoContainer.createChild("div", "infobar-info-actions");
    if (actions) {
      this.contentElement.setAttribute("role", "group");
      for (const action of actions) {
        const actionCallback = this.actionCallbackFactory(action);
        let buttonClass = "infobar-button";
        if (action.highlight) {
          buttonClass += " primary-button";
        }
        const button = createTextButton(action.text, actionCallback, buttonClass);
        if (action.highlight && !this.#firstFocusableElement) {
          this.#firstFocusableElement = button;
        }
        this.actionContainer.appendChild(button);
      }
    }
    this.disableSetting = disableSetting || null;
    if (disableSetting) {
      const disableButton = createTextButton(i18nString(UIStrings.dontShowAgain), this.onDisable.bind(this), "infobar-button");
      this.actionContainer.appendChild(disableButton);
    }
    this.closeContainer = this.mainRow.createChild("div", "infobar-close-container");
    this.toggleElement = createTextButton(i18nString(UIStrings.learnMore), this.onToggleDetails.bind(this), "link-style devtools-link hidden");
    this.toggleElement.setAttribute("role", "link");
    this.closeContainer.appendChild(this.toggleElement);
    this.closeButton = this.closeContainer.createChild("div", "close-button", "dt-close-button");
    this.closeButton.setTabbable(true);
    ARIAUtils.setDescription(this.closeButton, i18nString(UIStrings.close));
    self.onInvokeElement(this.closeButton, this.dispose.bind(this));
    if (type !== Type.Issue) {
      this.contentElement.tabIndex = 0;
    }
    ARIAUtils.setAccessibleName(this.contentElement, text);
    this.contentElement.addEventListener("keydown", (event) => {
      if (event.keyCode === Keys.Esc.code) {
        this.dispose();
        event.consume();
        return;
      }
      if (event.target !== this.contentElement) {
        return;
      }
      if (event.key === "Enter" && this.hasDetails) {
        this.onToggleDetails();
        event.consume();
        return;
      }
    });
    this.closeCallback = null;
  }
  static create(type, text, actions, disableSetting) {
    if (disableSetting && disableSetting.get()) {
      return null;
    }
    return new Infobar(type, text, actions, disableSetting);
  }
  dispose() {
    this.element.remove();
    this.onResize();
    if (this.closeCallback) {
      this.closeCallback.call(null);
    }
  }
  setText(text) {
    this.infoText.textContent = text;
    this.onResize();
  }
  setCloseCallback(callback) {
    this.closeCallback = callback;
  }
  setParentView(parentView) {
    this.parentView = parentView;
  }
  actionCallbackFactory(action) {
    if (!action.delegate) {
      return action.dismiss ? this.dispose.bind(this) : () => {
      };
    }
    if (!action.dismiss) {
      return action.delegate;
    }
    return (() => {
      if (action.delegate) {
        action.delegate();
      }
      this.dispose();
    }).bind(this);
  }
  onResize() {
    if (this.parentView) {
      this.parentView.doResize();
    }
  }
  onDisable() {
    if (this.disableSetting) {
      this.disableSetting.set(true);
    }
    this.dispose();
  }
  onToggleDetails() {
    this.detailsRows.classList.remove("hidden");
    this.toggleElement.remove();
    this.onResize();
    ARIAUtils.alert(this.detailsMessage);
    if (this.#firstFocusableElement) {
      this.#firstFocusableElement.focus();
    } else {
      this.closeButton.focus();
    }
  }
  createDetailsRowMessage(message) {
    this.hasDetails = true;
    this.detailsMessage = message || "";
    this.toggleElement.classList.remove("hidden");
    const infobarDetailsRow = this.detailsRows.createChild("div", "infobar-details-row");
    const detailsRowMessage = infobarDetailsRow.createChild("span", "infobar-row-message");
    detailsRowMessage.textContent = this.detailsMessage;
    return detailsRowMessage;
  }
}
export var Type = /* @__PURE__ */ ((Type2) => {
  Type2["Warning"] = "warning";
  Type2["Info"] = "info";
  Type2["Issue"] = "issue";
  Type2["Error"] = "error";
  return Type2;
})(Type || {});
//# sourceMappingURL=Infobar.js.map
