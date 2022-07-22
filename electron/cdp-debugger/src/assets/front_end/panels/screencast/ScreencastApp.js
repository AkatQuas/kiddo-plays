import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ScreencastView } from "./ScreencastView.js";
const UIStrings = {
  toggleScreencast: "Toggle screencast"
};
const str_ = i18n.i18n.registerUIStrings("panels/screencast/ScreencastApp.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let appInstance;
export class ScreencastApp {
  enabledSetting;
  toggleButton;
  rootSplitWidget;
  screenCaptureModel;
  screencastView;
  constructor() {
    this.enabledSetting = Common.Settings.Settings.instance().createSetting("screencastEnabled", true);
    this.toggleButton = new UI.Toolbar.ToolbarToggle(i18nString(UIStrings.toggleScreencast), "largeicon-phone");
    this.toggleButton.setToggled(this.enabledSetting.get());
    this.toggleButton.setEnabled(false);
    this.toggleButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.toggleButtonClicked, this);
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.ScreenCaptureModel.ScreenCaptureModel, this);
  }
  static instance() {
    if (!appInstance) {
      appInstance = new ScreencastApp();
    }
    return appInstance;
  }
  presentUI(document) {
    const rootView = new UI.RootView.RootView();
    this.rootSplitWidget = new UI.SplitWidget.SplitWidget(false, true, "InspectorView.screencastSplitViewState", 300, 300);
    this.rootSplitWidget.setVertical(true);
    this.rootSplitWidget.setSecondIsSidebar(true);
    this.rootSplitWidget.show(rootView.element);
    this.rootSplitWidget.hideMain();
    this.rootSplitWidget.setSidebarWidget(UI.InspectorView.InspectorView.instance());
    UI.InspectorView.InspectorView.instance().setOwnerSplit(this.rootSplitWidget);
    rootView.attachToDocument(document);
    rootView.focus();
  }
  modelAdded(screenCaptureModel) {
    if (this.screenCaptureModel) {
      return;
    }
    this.screenCaptureModel = screenCaptureModel;
    this.toggleButton.setEnabled(true);
    this.screencastView = new ScreencastView(screenCaptureModel);
    if (this.rootSplitWidget) {
      this.rootSplitWidget.setMainWidget(this.screencastView);
    }
    this.screencastView.initialize();
    this.onScreencastEnabledChanged();
  }
  modelRemoved(screenCaptureModel) {
    if (this.screenCaptureModel !== screenCaptureModel) {
      return;
    }
    delete this.screenCaptureModel;
    this.toggleButton.setEnabled(false);
    if (this.screencastView) {
      this.screencastView.detach();
      delete this.screencastView;
    }
    this.onScreencastEnabledChanged();
  }
  toggleButtonClicked() {
    const enabled = !this.toggleButton.toggled();
    this.enabledSetting.set(enabled);
    this.onScreencastEnabledChanged();
  }
  onScreencastEnabledChanged() {
    if (!this.rootSplitWidget) {
      return;
    }
    const enabled = Boolean(this.enabledSetting.get() && this.screencastView);
    this.toggleButton.setToggled(enabled);
    if (enabled) {
      this.rootSplitWidget.showBoth();
    } else {
      this.rootSplitWidget.hideMain();
    }
  }
}
let toolbarButtonProviderInstance;
export class ToolbarButtonProvider {
  static instance(opts = { forceNew: false }) {
    const { forceNew } = opts;
    if (!toolbarButtonProviderInstance || forceNew) {
      toolbarButtonProviderInstance = new ToolbarButtonProvider();
    }
    return toolbarButtonProviderInstance;
  }
  item() {
    return ScreencastApp.instance().toggleButton;
  }
}
let screencastAppProviderInstance;
export class ScreencastAppProvider {
  static instance(opts = { forceNew: false }) {
    const { forceNew } = opts;
    if (!screencastAppProviderInstance || forceNew) {
      screencastAppProviderInstance = new ScreencastAppProvider();
    }
    return screencastAppProviderInstance;
  }
  createApp() {
    return ScreencastApp.instance();
  }
}
//# sourceMappingURL=ScreencastApp.js.map
