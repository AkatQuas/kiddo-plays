import * as Common from "../../core/common/common.js";
let zoomManagerInstance;
export class ZoomManager extends Common.ObjectWrapper.ObjectWrapper {
  frontendHost;
  zoomFactorInternal;
  constructor(window, frontendHost) {
    super();
    this.frontendHost = frontendHost;
    this.zoomFactorInternal = this.frontendHost.zoomFactor();
    window.addEventListener("resize", this.onWindowResize.bind(this), true);
  }
  static instance(opts = { forceNew: null, win: null, frontendHost: null }) {
    const { forceNew, win, frontendHost } = opts;
    if (!zoomManagerInstance || forceNew) {
      if (!win || !frontendHost) {
        throw new Error(`Unable to create zoom manager: window and frontendHost must be provided: ${new Error().stack}`);
      }
      zoomManagerInstance = new ZoomManager(win, frontendHost);
    }
    return zoomManagerInstance;
  }
  static removeInstance() {
    zoomManagerInstance = void 0;
  }
  zoomFactor() {
    return this.zoomFactorInternal;
  }
  cssToDIP(value) {
    return value * this.zoomFactorInternal;
  }
  dipToCSS(valueDIP) {
    return valueDIP / this.zoomFactorInternal;
  }
  onWindowResize() {
    const oldZoomFactor = this.zoomFactorInternal;
    this.zoomFactorInternal = this.frontendHost.zoomFactor();
    if (oldZoomFactor !== this.zoomFactorInternal) {
      this.dispatchEventToListeners(Events.ZoomChanged, { from: oldZoomFactor, to: this.zoomFactorInternal });
    }
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ZoomChanged"] = "ZoomChanged";
  return Events2;
})(Events || {});
//# sourceMappingURL=ZoomManager.js.map
