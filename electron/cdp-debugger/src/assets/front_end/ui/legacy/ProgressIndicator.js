import * as Utils from "./utils/utils.js";
import progressIndicatorStyles from "./progressIndicator.css.legacy.js";
export class ProgressIndicator {
  element;
  shadowRoot;
  contentElement;
  labelElement;
  progressElement;
  stopButton;
  isCanceledInternal;
  worked;
  isDone;
  constructor() {
    this.element = document.createElement("div");
    this.element.classList.add("progress-indicator");
    this.shadowRoot = Utils.createShadowRootWithCoreStyles(this.element, { cssFile: progressIndicatorStyles, delegatesFocus: void 0 });
    this.contentElement = this.shadowRoot.createChild("div", "progress-indicator-shadow-container");
    this.labelElement = this.contentElement.createChild("div", "title");
    this.progressElement = this.contentElement.createChild("progress");
    this.progressElement.value = 0;
    this.stopButton = this.contentElement.createChild("button", "progress-indicator-shadow-stop-button");
    this.stopButton.addEventListener("click", this.cancel.bind(this));
    this.isCanceledInternal = false;
    this.worked = 0;
  }
  show(parent) {
    parent.appendChild(this.element);
  }
  done() {
    if (this.isDone) {
      return;
    }
    this.isDone = true;
    this.element.remove();
  }
  cancel() {
    this.isCanceledInternal = true;
  }
  isCanceled() {
    return this.isCanceledInternal;
  }
  setTitle(title) {
    this.labelElement.textContent = title;
  }
  setTotalWork(totalWork) {
    this.progressElement.max = totalWork;
  }
  setWorked(worked, title) {
    this.worked = worked;
    this.progressElement.value = worked;
    if (title) {
      this.setTitle(title);
    }
  }
  incrementWorked(worked) {
    this.setWorked(this.worked + (worked || 1));
  }
}
//# sourceMappingURL=ProgressIndicator.js.map
