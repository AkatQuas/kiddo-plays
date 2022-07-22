import { GlassPane, MarginBehavior, SizeBehavior } from "./GlassPane.js";
import popoverStyles from "./popover.css.legacy.js";
export class PopoverHelper {
  disableOnClick;
  hasPadding;
  getRequest;
  scheduledRequest;
  hidePopoverCallback;
  container;
  showTimeout;
  hideTimeout;
  hidePopoverTimer;
  showPopoverTimer;
  boundMouseDown;
  boundMouseMove;
  boundMouseOut;
  constructor(container, getRequest) {
    this.disableOnClick = false;
    this.hasPadding = false;
    this.getRequest = getRequest;
    this.scheduledRequest = null;
    this.hidePopoverCallback = null;
    this.container = container;
    this.showTimeout = 0;
    this.hideTimeout = 0;
    this.hidePopoverTimer = null;
    this.showPopoverTimer = null;
    this.boundMouseDown = this.mouseDown.bind(this);
    this.boundMouseMove = this.mouseMove.bind(this);
    this.boundMouseOut = this.mouseOut.bind(this);
    this.container.addEventListener("mousedown", this.boundMouseDown, false);
    this.container.addEventListener("mousemove", this.boundMouseMove, false);
    this.container.addEventListener("mouseout", this.boundMouseOut, false);
    this.setTimeout(1e3);
  }
  setTimeout(showTimeout, hideTimeout) {
    this.showTimeout = showTimeout;
    this.hideTimeout = typeof hideTimeout === "number" ? hideTimeout : showTimeout / 2;
  }
  setHasPadding(hasPadding) {
    this.hasPadding = hasPadding;
  }
  setDisableOnClick(disableOnClick) {
    this.disableOnClick = disableOnClick;
  }
  eventInScheduledContent(ev) {
    const event = ev;
    return this.scheduledRequest ? this.scheduledRequest.box.contains(event.clientX, event.clientY) : false;
  }
  mouseDown(event) {
    if (this.disableOnClick) {
      this.hidePopover();
      return;
    }
    if (this.eventInScheduledContent(event)) {
      return;
    }
    this.startHidePopoverTimer(0);
    this.stopShowPopoverTimer();
    this.startShowPopoverTimer(event, 0);
  }
  mouseMove(ev) {
    const event = ev;
    if (this.eventInScheduledContent(event)) {
      return;
    }
    this.startHidePopoverTimer(this.hideTimeout);
    this.stopShowPopoverTimer();
    if (event.which && this.disableOnClick) {
      return;
    }
    this.startShowPopoverTimer(event, this.isPopoverVisible() ? this.showTimeout * 0.6 : this.showTimeout);
  }
  popoverMouseMove(_event) {
    this.stopHidePopoverTimer();
  }
  popoverMouseOut(popover, ev) {
    const event = ev;
    if (!popover.isShowing()) {
      return;
    }
    const node = event.relatedTarget;
    if (node && !node.isSelfOrDescendant(popover.contentElement)) {
      this.startHidePopoverTimer(this.hideTimeout);
    }
  }
  mouseOut(event) {
    if (!this.isPopoverVisible()) {
      return;
    }
    if (!this.eventInScheduledContent(event)) {
      this.startHidePopoverTimer(this.hideTimeout);
    }
  }
  startHidePopoverTimer(timeout) {
    if (!this.hidePopoverCallback || this.hidePopoverTimer) {
      return;
    }
    this.hidePopoverTimer = window.setTimeout(() => {
      this.hidePopover();
      this.hidePopoverTimer = null;
    }, timeout);
  }
  startShowPopoverTimer(event, timeout) {
    this.scheduledRequest = this.getRequest.call(null, event);
    if (!this.scheduledRequest) {
      return;
    }
    this.showPopoverTimer = window.setTimeout(() => {
      this.showPopoverTimer = null;
      this.stopHidePopoverTimer();
      this.hidePopoverInternal();
      const document = event.target.ownerDocument;
      this.showPopover(document);
    }, timeout);
  }
  stopShowPopoverTimer() {
    if (!this.showPopoverTimer) {
      return;
    }
    clearTimeout(this.showPopoverTimer);
    this.showPopoverTimer = null;
  }
  isPopoverVisible() {
    return Boolean(this.hidePopoverCallback);
  }
  hidePopover() {
    this.stopShowPopoverTimer();
    this.hidePopoverInternal();
  }
  hidePopoverInternal() {
    if (!this.hidePopoverCallback) {
      return;
    }
    this.hidePopoverCallback.call(null);
    this.hidePopoverCallback = null;
  }
  showPopover(document) {
    const popover = new GlassPane();
    popover.registerRequiredCSS(popoverStyles);
    popover.setSizeBehavior(SizeBehavior.MeasureContent);
    popover.setMarginBehavior(MarginBehavior.Arrow);
    const request = this.scheduledRequest;
    if (!request) {
      return;
    }
    void request.show.call(null, popover).then((success) => {
      if (!success) {
        return;
      }
      if (this.scheduledRequest !== request) {
        if (request.hide) {
          request.hide.call(null);
        }
        return;
      }
      if (popoverHelperInstance) {
        console.error("One popover is already visible");
        popoverHelperInstance.hidePopover();
      }
      popoverHelperInstance = this;
      popover.contentElement.classList.toggle("has-padding", this.hasPadding);
      popover.contentElement.addEventListener("mousemove", this.popoverMouseMove.bind(this), true);
      popover.contentElement.addEventListener("mouseout", this.popoverMouseOut.bind(this, popover), true);
      popover.setContentAnchorBox(request.box);
      popover.show(document);
      this.hidePopoverCallback = () => {
        if (request.hide) {
          request.hide.call(null);
        }
        popover.hide();
        popoverHelperInstance = null;
      };
    });
  }
  stopHidePopoverTimer() {
    if (!this.hidePopoverTimer) {
      return;
    }
    clearTimeout(this.hidePopoverTimer);
    this.hidePopoverTimer = null;
    this.stopShowPopoverTimer();
  }
  dispose() {
    this.container.removeEventListener("mousedown", this.boundMouseDown, false);
    this.container.removeEventListener("mousemove", this.boundMouseMove, false);
    this.container.removeEventListener("mouseout", this.boundMouseOut, false);
  }
}
let popoverHelperInstance = null;
//# sourceMappingURL=PopoverHelper.js.map
