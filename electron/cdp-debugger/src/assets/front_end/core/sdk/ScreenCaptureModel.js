import { OverlayModel } from "./OverlayModel.js";
import { Capability } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
export class ScreenCaptureModel extends SDKModel {
  #agent;
  #onScreencastFrame;
  #onScreencastVisibilityChanged;
  constructor(target) {
    super(target);
    this.#agent = target.pageAgent();
    this.#onScreencastFrame = null;
    this.#onScreencastVisibilityChanged = null;
    target.registerPageDispatcher(this);
  }
  startScreencast(format, quality, maxWidth, maxHeight, everyNthFrame, onFrame, onVisibilityChanged) {
    this.#onScreencastFrame = onFrame;
    this.#onScreencastVisibilityChanged = onVisibilityChanged;
    void this.#agent.invoke_startScreencast({ format, quality, maxWidth, maxHeight, everyNthFrame });
  }
  stopScreencast() {
    this.#onScreencastFrame = null;
    this.#onScreencastVisibilityChanged = null;
    void this.#agent.invoke_stopScreencast();
  }
  async captureScreenshot(format, quality, clip) {
    await OverlayModel.muteHighlight();
    const result = await this.#agent.invoke_captureScreenshot({ format, quality, clip, fromSurface: true, captureBeyondViewport: true });
    await OverlayModel.unmuteHighlight();
    return result.data;
  }
  async fetchLayoutMetrics() {
    const response = await this.#agent.invoke_getLayoutMetrics();
    if (response.getError()) {
      return null;
    }
    return {
      viewportX: response.cssVisualViewport.pageX,
      viewportY: response.cssVisualViewport.pageY,
      viewportScale: response.cssVisualViewport.scale,
      contentWidth: response.cssContentSize.width,
      contentHeight: response.cssContentSize.height
    };
  }
  screencastFrame({ data, metadata, sessionId }) {
    void this.#agent.invoke_screencastFrameAck({ sessionId });
    if (this.#onScreencastFrame) {
      this.#onScreencastFrame.call(null, data, metadata);
    }
  }
  screencastVisibilityChanged({ visible }) {
    if (this.#onScreencastVisibilityChanged) {
      this.#onScreencastVisibilityChanged.call(null, visible);
    }
  }
  backForwardCacheNotUsed(_params) {
  }
  domContentEventFired(_params) {
  }
  loadEventFired(_params) {
  }
  lifecycleEvent(_params) {
  }
  navigatedWithinDocument(_params) {
  }
  frameAttached(_params) {
  }
  frameNavigated(_params) {
  }
  documentOpened(_params) {
  }
  frameDetached(_params) {
  }
  frameStartedLoading(_params) {
  }
  frameStoppedLoading(_params) {
  }
  frameRequestedNavigation(_params) {
  }
  frameScheduledNavigation(_params) {
  }
  frameClearedScheduledNavigation(_params) {
  }
  frameResized() {
  }
  javascriptDialogOpening(_params) {
  }
  javascriptDialogClosed(_params) {
  }
  interstitialShown() {
  }
  interstitialHidden() {
  }
  windowOpen(_params) {
  }
  fileChooserOpened(_params) {
  }
  compilationCacheProduced(_params) {
  }
  downloadWillBegin(_params) {
  }
  downloadProgress() {
  }
  prerenderAttemptCompleted(_params) {
  }
}
SDKModel.register(ScreenCaptureModel, { capabilities: Capability.ScreenCapture, autostart: false });
//# sourceMappingURL=ScreenCaptureModel.js.map
