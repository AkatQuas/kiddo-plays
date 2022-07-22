import * as UI from "../../ui/legacy/legacy.js";
export class ExtensionView extends UI.Widget.Widget {
  server;
  id;
  iframe;
  frameIndex;
  constructor(server, id, src, className) {
    super();
    this.setHideOnDetach();
    this.element.className = "vbox flex-auto";
    this.element.tabIndex = -1;
    this.server = server;
    this.id = id;
    this.iframe = document.createElement("iframe");
    this.iframe.addEventListener("load", this.onLoad.bind(this), false);
    this.iframe.src = src;
    this.iframe.className = className;
    this.setDefaultFocusedElement(this.element);
    this.element.appendChild(this.iframe);
  }
  wasShown() {
    super.wasShown();
    if (typeof this.frameIndex === "number") {
      this.server.notifyViewShown(this.id, this.frameIndex);
    }
  }
  willHide() {
    if (typeof this.frameIndex === "number") {
      this.server.notifyViewHidden(this.id);
    }
  }
  onLoad() {
    const frames = window.frames;
    this.frameIndex = Array.prototype.indexOf.call(frames, this.iframe.contentWindow);
    if (this.isShowing()) {
      this.server.notifyViewShown(this.id, this.frameIndex);
    }
  }
}
export class ExtensionNotifierView extends UI.Widget.VBox {
  server;
  id;
  constructor(server, id) {
    super();
    this.server = server;
    this.id = id;
  }
  wasShown() {
    this.server.notifyViewShown(this.id);
  }
  willHide() {
    this.server.notifyViewHidden(this.id);
  }
}
//# sourceMappingURL=ExtensionView.js.map
