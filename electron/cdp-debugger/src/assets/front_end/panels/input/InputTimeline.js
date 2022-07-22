import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Timeline from "../timeline/timeline.js";
import inputTimelineStyles from "./inputTimeline.css.js";
import { InputModel } from "./InputModel.js";
const UIStrings = {
  clearAll: "Clear all",
  loadProfile: "Load profile\u2026",
  saveProfile: "Save profile\u2026"
};
const str_ = i18n.i18n.registerUIStrings("panels/input//InputTimeline.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let inputTimelineInstance;
export class InputTimeline extends UI.Widget.VBox {
  tracingClient;
  tracingModel;
  inputModel;
  state;
  toggleRecordAction;
  startReplayAction;
  togglePauseAction;
  panelToolbar;
  clearButton;
  loadButton;
  saveButton;
  fileSelectorElement;
  loader;
  constructor() {
    super(true);
    this.element.classList.add("inputs-timeline");
    this.tracingClient = null;
    this.tracingModel = null;
    this.inputModel = null;
    this.state = State.Idle;
    this.toggleRecordAction = UI.ActionRegistry.ActionRegistry.instance().action("input.toggle-recording");
    this.startReplayAction = UI.ActionRegistry.ActionRegistry.instance().action("input.start-replaying");
    this.togglePauseAction = UI.ActionRegistry.ActionRegistry.instance().action("input.toggle-pause");
    const toolbarContainer = this.contentElement.createChild("div", "input-timeline-toolbar-container");
    this.panelToolbar = new UI.Toolbar.Toolbar("input-timeline-toolbar", toolbarContainer);
    this.panelToolbar.appendToolbarItem(UI.Toolbar.Toolbar.createActionButton(this.toggleRecordAction));
    this.panelToolbar.appendToolbarItem(UI.Toolbar.Toolbar.createActionButton(this.startReplayAction));
    this.panelToolbar.appendToolbarItem(UI.Toolbar.Toolbar.createActionButton(this.togglePauseAction));
    this.clearButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.clearAll), "largeicon-clear");
    this.clearButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.reset.bind(this));
    this.panelToolbar.appendToolbarItem(this.clearButton);
    this.panelToolbar.appendSeparator();
    this.loadButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.loadProfile), "largeicon-load");
    this.loadButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.selectFileToLoad());
    this.saveButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.saveProfile), "largeicon-download");
    this.saveButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, (_event) => {
      void this.saveToFile();
    });
    this.panelToolbar.appendSeparator();
    this.panelToolbar.appendToolbarItem(this.loadButton);
    this.panelToolbar.appendToolbarItem(this.saveButton);
    this.panelToolbar.appendSeparator();
    this.createFileSelector();
    this.updateControls();
  }
  static instance(opts = { forceNew: false }) {
    const { forceNew } = opts;
    if (!inputTimelineInstance || forceNew) {
      inputTimelineInstance = new InputTimeline();
    }
    return inputTimelineInstance;
  }
  reset() {
    this.tracingClient = null;
    this.tracingModel = null;
    this.inputModel = null;
    this.setState(State.Idle);
  }
  createFileSelector() {
    if (this.fileSelectorElement) {
      this.fileSelectorElement.remove();
    }
    this.fileSelectorElement = UI.UIUtils.createFileSelectorElement(this.loadFromFile.bind(this));
    this.element.appendChild(this.fileSelectorElement);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([inputTimelineStyles]);
  }
  willHide() {
  }
  setState(state) {
    this.state = state;
    this.updateControls();
  }
  isAvailableState() {
    return this.state === State.Idle || this.state === State.ReplayPaused;
  }
  updateControls() {
    this.toggleRecordAction.setToggled(this.state === State.Recording);
    this.toggleRecordAction.setEnabled(this.isAvailableState() || this.state === State.Recording);
    this.startReplayAction.setEnabled(this.isAvailableState() && Boolean(this.tracingModel));
    this.togglePauseAction.setEnabled(this.state === State.Replaying || this.state === State.ReplayPaused);
    this.togglePauseAction.setToggled(this.state === State.ReplayPaused);
    this.clearButton.setEnabled(this.isAvailableState());
    this.loadButton.setEnabled(this.isAvailableState());
    this.saveButton.setEnabled(this.isAvailableState() && Boolean(this.tracingModel));
  }
  toggleRecording() {
    switch (this.state) {
      case State.Recording: {
        void this.stopRecording();
        break;
      }
      case State.Idle: {
        void this.startRecording();
        break;
      }
    }
  }
  startReplay() {
    void this.replayEvents();
  }
  toggleReplayPause() {
    switch (this.state) {
      case State.Replaying: {
        this.pauseReplay();
        break;
      }
      case State.ReplayPaused: {
        this.resumeReplay();
        break;
      }
    }
  }
  async saveToFile() {
    console.assert(this.state === State.Idle);
    if (!this.tracingModel) {
      return;
    }
    const fileName = `InputProfile-${Platform.DateUtilities.toISO8601Compact(new Date())}.json`;
    const stream = new Bindings.FileUtils.FileOutputStream();
    const accepted = await stream.open(fileName);
    if (!accepted) {
      return;
    }
    const backingStorage = this.tracingModel.backingStorage();
    await backingStorage.writeToStream(stream);
    void stream.close();
  }
  selectFileToLoad() {
    if (this.fileSelectorElement) {
      this.fileSelectorElement.click();
    }
  }
  loadFromFile(file) {
    console.assert(this.isAvailableState());
    this.setState(State.Loading);
    this.loader = Timeline.TimelineLoader.TimelineLoader.loadFromFile(file, this);
    this.createFileSelector();
  }
  async startRecording() {
    this.setState(State.StartPending);
    this.tracingClient = new TracingClient(SDK.TargetManager.TargetManager.instance().mainTarget(), this);
    const response = await this.tracingClient.startRecording();
    if (!response || response.getError()) {
      this.recordingFailed();
    } else {
      this.setState(State.Recording);
    }
  }
  async stopRecording() {
    if (!this.tracingClient) {
      return;
    }
    this.setState(State.StopPending);
    await this.tracingClient.stopRecording();
    this.tracingClient = null;
  }
  async replayEvents() {
    if (!this.inputModel) {
      return;
    }
    this.setState(State.Replaying);
    await this.inputModel.startReplay(this.replayStopped.bind(this));
  }
  pauseReplay() {
    if (!this.inputModel) {
      return;
    }
    this.inputModel.pause();
    this.setState(State.ReplayPaused);
  }
  resumeReplay() {
    if (!this.inputModel) {
      return;
    }
    this.inputModel.resume();
    this.setState(State.Replaying);
  }
  loadingStarted() {
  }
  loadingProgress(_progress) {
  }
  processingStarted() {
  }
  loadingComplete(tracingModel) {
    if (!tracingModel) {
      this.reset();
      return;
    }
    this.inputModel = new InputModel(SDK.TargetManager.TargetManager.instance().mainTarget());
    this.tracingModel = tracingModel;
    this.inputModel.setEvents(tracingModel);
    this.setState(State.Idle);
  }
  recordingFailed() {
    this.tracingClient = null;
    this.setState(State.Idle);
  }
  replayStopped() {
    this.setState(State.Idle);
  }
}
export var State = /* @__PURE__ */ ((State2) => {
  State2["Idle"] = "Idle";
  State2["StartPending"] = "StartPending";
  State2["Recording"] = "Recording";
  State2["StopPending"] = "StopPending";
  State2["Replaying"] = "Replaying";
  State2["ReplayPaused"] = "ReplayPaused";
  State2["Loading"] = "Loading";
  return State2;
})(State || {});
let actionDelegateInstance;
export class ActionDelegate {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!actionDelegateInstance || forceNew) {
      actionDelegateInstance = new ActionDelegate();
    }
    return actionDelegateInstance;
  }
  handleAction(context, actionId) {
    const inputViewId = "Inputs";
    void UI.ViewManager.ViewManager.instance().showView(inputViewId).then(() => UI.ViewManager.ViewManager.instance().view(inputViewId).widget()).then((widget) => this.innerHandleAction(widget, actionId));
    return true;
  }
  innerHandleAction(inputTimeline, actionId) {
    switch (actionId) {
      case "input.toggle-recording":
        inputTimeline.toggleRecording();
        break;
      case "input.start-replaying":
        inputTimeline.startReplay();
        break;
      case "input.toggle-pause":
        inputTimeline.toggleReplayPause();
        break;
      default:
        console.assert(false, `Unknown action: ${actionId}`);
    }
  }
}
export class TracingClient {
  target;
  tracingManager;
  client;
  tracingModel;
  tracingCompleteCallback;
  constructor(target, client) {
    this.target = target;
    this.tracingManager = target.model(SDK.TracingManager.TracingManager);
    this.client = client;
    const backingStorage = new Bindings.TempFile.TempFileBackingStorage();
    this.tracingModel = new SDK.TracingModel.TracingModel(backingStorage);
    this.tracingCompleteCallback = null;
  }
  async startRecording() {
    if (!this.tracingManager) {
      return;
    }
    const categoriesArray = ["devtools.timeline", "disabled-by-default-devtools.timeline.inputs"];
    const categories = categoriesArray.join(",");
    const response = await this.tracingManager.start(this, categories, "");
    if (response.getError()) {
      await this.waitForTracingToStop(false);
    }
    return response;
  }
  async stopRecording() {
    if (this.tracingManager) {
      this.tracingManager.stop();
    }
    await this.waitForTracingToStop(true);
    await SDK.TargetManager.TargetManager.instance().resumeAllTargets();
    this.tracingModel.tracingComplete();
    this.client.loadingComplete(this.tracingModel);
  }
  traceEventsCollected(events) {
    this.tracingModel.addEvents(events);
  }
  tracingComplete() {
    if (this.tracingCompleteCallback) {
      this.tracingCompleteCallback();
    }
    this.tracingCompleteCallback = null;
  }
  tracingBufferUsage(_usage) {
  }
  eventsRetrievalProgress(_progress) {
  }
  waitForTracingToStop(awaitTracingCompleteCallback) {
    return new Promise((resolve) => {
      if (this.tracingManager && awaitTracingCompleteCallback) {
        this.tracingCompleteCallback = resolve;
      } else {
        resolve();
      }
    });
  }
}
//# sourceMappingURL=InputTimeline.js.map
