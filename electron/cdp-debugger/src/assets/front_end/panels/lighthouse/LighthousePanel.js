import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as EmulationModel from "../../models/emulation/emulation.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as Emulation from "../emulation/emulation.js";
import { Events, LighthouseController } from "./LighthouseController.js";
import lighthousePanelStyles from "./lighthousePanel.css.js";
import { ProtocolService } from "./LighthouseProtocolService.js";
import * as LighthouseReport from "../../third_party/lighthouse/report/report.js";
import { LighthouseReportRenderer, LighthouseReportUIFeatures } from "./LighthouseReportRenderer.js";
import { Item, ReportSelector } from "./LighthouseReportSelector.js";
import { StartView } from "./LighthouseStartView.js";
import { StartViewFR } from "./LighthouseStartViewFR.js";
import { StatusView } from "./LighthouseStatusView.js";
import { TimespanView } from "./LighthouseTimespanView.js";
const UIStrings = {
  dropLighthouseJsonHere: "Drop `Lighthouse` JSON here",
  performAnAudit: "Perform an audit\u2026",
  clearAll: "Clear all",
  lighthouseSettings: "`Lighthouse` settings",
  printing: "Printing",
  thePrintPopupWindowIsOpenPlease: "The print popup window is open. Please close it to continue.",
  cancelling: "Cancelling"
};
const str_ = i18n.i18n.registerUIStrings("panels/lighthouse/LighthousePanel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let lighthousePanelInstace;
export class LighthousePanel extends UI.Panel.Panel {
  protocolService;
  controller;
  startView;
  statusView;
  timespanView;
  warningText;
  unauditableExplanation;
  cachedRenderedReports;
  dropTarget;
  auditResultsElement;
  clearButton;
  newButton;
  reportSelector;
  settingsPane;
  rightToolbar;
  showSettingsPaneSetting;
  stateBefore;
  isLHAttached;
  currentLighthouseRun;
  constructor() {
    super("lighthouse");
    this.protocolService = new ProtocolService();
    this.controller = new LighthouseController(this.protocolService);
    if (Root.Runtime.experiments.isEnabled("lighthousePanelFR")) {
      this.startView = new StartViewFR(this.controller);
      this.timespanView = new TimespanView(this.controller);
    } else {
      this.startView = new StartView(this.controller);
      this.timespanView = null;
    }
    this.statusView = new StatusView(this.controller);
    this.warningText = null;
    this.unauditableExplanation = null;
    this.cachedRenderedReports = /* @__PURE__ */ new Map();
    this.dropTarget = new UI.DropTarget.DropTarget(this.contentElement, [UI.DropTarget.Type.File], i18nString(UIStrings.dropLighthouseJsonHere), this.handleDrop.bind(this));
    this.controller.addEventListener(Events.PageAuditabilityChanged, this.refreshStartAuditUI.bind(this));
    this.controller.addEventListener(Events.PageWarningsChanged, this.refreshWarningsUI.bind(this));
    this.controller.addEventListener(Events.AuditProgressChanged, this.refreshStatusUI.bind(this));
    this.controller.addEventListener(Events.RequestLighthouseTimespanStart, this.onLighthouseTimespanStart.bind(this));
    this.controller.addEventListener(Events.RequestLighthouseTimespanEnd, this.onLighthouseTimespanEnd.bind(this));
    this.controller.addEventListener(Events.RequestLighthouseStart, this.onLighthouseStart.bind(this));
    this.controller.addEventListener(Events.RequestLighthouseCancel, this.onLighthouseCancel.bind(this));
    this.renderToolbar();
    this.auditResultsElement = this.contentElement.createChild("div", "lighthouse-results-container");
    this.renderStartView();
    this.controller.recomputePageAuditability();
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!lighthousePanelInstace || forceNew) {
      lighthousePanelInstace = new LighthousePanel();
    }
    return lighthousePanelInstace;
  }
  static getEvents() {
    return Events;
  }
  async onLighthouseTimespanStart() {
    this.timespanView?.show(this.contentElement);
    await this.startLighthouse();
    this.timespanView?.ready();
  }
  async onLighthouseTimespanEnd() {
    this.timespanView?.hide();
    await this.collectLighthouseResults();
  }
  async onLighthouseStart() {
    await this.startLighthouse();
    await this.collectLighthouseResults();
  }
  async onLighthouseCancel() {
    this.timespanView?.hide();
    void this.cancelLighthouse();
  }
  refreshWarningsUI(evt) {
    if (this.isLHAttached) {
      return;
    }
    this.warningText = evt.data.warning;
    this.startView.setWarningText(evt.data.warning);
  }
  refreshStartAuditUI(evt) {
    if (this.isLHAttached) {
      return;
    }
    this.startView.refresh();
    this.unauditableExplanation = evt.data.helpText;
    this.startView.setUnauditableExplanation(evt.data.helpText);
    this.startView.setStartButtonEnabled(!evt.data.helpText);
  }
  refreshStatusUI(evt) {
    this.statusView.updateStatus(evt.data.message);
  }
  refreshToolbarUI() {
    this.clearButton.setEnabled(this.reportSelector.hasItems());
  }
  clearAll() {
    this.reportSelector.clearAll();
    this.renderStartView();
    this.refreshToolbarUI();
  }
  renderToolbar() {
    const lighthouseToolbarContainer = this.element.createChild("div", "lighthouse-toolbar-container");
    const toolbar = new UI.Toolbar.Toolbar("", lighthouseToolbarContainer);
    this.newButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.performAnAudit), "largeicon-add");
    toolbar.appendToolbarItem(this.newButton);
    this.newButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.renderStartView.bind(this));
    toolbar.appendSeparator();
    this.reportSelector = new ReportSelector(() => this.renderStartView());
    toolbar.appendToolbarItem(this.reportSelector.comboBox());
    this.clearButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.clearAll), "largeicon-clear");
    toolbar.appendToolbarItem(this.clearButton);
    this.clearButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.clearAll.bind(this));
    this.settingsPane = new UI.Widget.HBox();
    this.settingsPane.show(this.contentElement);
    this.settingsPane.element.classList.add("lighthouse-settings-pane");
    this.settingsPane.element.appendChild(this.startView.settingsToolbar().element);
    this.showSettingsPaneSetting = Common.Settings.Settings.instance().createSetting("lighthouseShowSettingsToolbar", false, Common.Settings.SettingStorageType.Synced);
    this.rightToolbar = new UI.Toolbar.Toolbar("", lighthouseToolbarContainer);
    this.rightToolbar.appendSeparator();
    this.rightToolbar.appendToolbarItem(new UI.Toolbar.ToolbarSettingToggle(this.showSettingsPaneSetting, "largeicon-settings-gear", i18nString(UIStrings.lighthouseSettings)));
    this.showSettingsPaneSetting.addChangeListener(this.updateSettingsPaneVisibility.bind(this));
    this.updateSettingsPaneVisibility();
    this.refreshToolbarUI();
  }
  updateSettingsPaneVisibility() {
    this.settingsPane.element.classList.toggle("hidden", !this.showSettingsPaneSetting.get());
  }
  toggleSettingsDisplay(show) {
    this.rightToolbar.element.classList.toggle("hidden", !show);
    this.settingsPane.element.classList.toggle("hidden", !show);
    this.updateSettingsPaneVisibility();
  }
  renderStartView() {
    this.auditResultsElement.removeChildren();
    this.statusView.hide();
    this.reportSelector.selectNewReport();
    this.contentElement.classList.toggle("in-progress", false);
    this.startView.show(this.contentElement);
    this.toggleSettingsDisplay(true);
    this.startView.setUnauditableExplanation(this.unauditableExplanation);
    this.startView.setStartButtonEnabled(!this.unauditableExplanation);
    if (!this.unauditableExplanation) {
      this.startView.focusStartButton();
    }
    this.startView.setWarningText(this.warningText);
    this.newButton.setEnabled(false);
    this.refreshToolbarUI();
    this.setDefaultFocusedChild(this.startView);
  }
  renderStatusView(inspectedURL) {
    this.contentElement.classList.toggle("in-progress", true);
    this.statusView.setInspectedURL(inspectedURL);
    this.statusView.show(this.contentElement);
  }
  beforePrint() {
    this.statusView.show(this.contentElement);
    this.statusView.toggleCancelButton(false);
    this.statusView.renderText(i18nString(UIStrings.printing), i18nString(UIStrings.thePrintPopupWindowIsOpenPlease));
  }
  afterPrint() {
    this.statusView.hide();
    this.statusView.toggleCancelButton(true);
  }
  renderReport(lighthouseResult, artifacts) {
    this.toggleSettingsDisplay(false);
    this.contentElement.classList.toggle("in-progress", false);
    this.startView.hideWidget();
    this.statusView.hide();
    this.auditResultsElement.removeChildren();
    this.newButton.setEnabled(true);
    this.refreshToolbarUI();
    const cachedRenderedReport = this.cachedRenderedReports.get(lighthouseResult);
    if (cachedRenderedReport) {
      this.auditResultsElement.appendChild(cachedRenderedReport);
      return;
    }
    const reportContainer = this.auditResultsElement.createChild("div", "lh-vars lh-root lh-devtools");
    const dom = new LighthouseReport.DOM(this.auditResultsElement.ownerDocument, reportContainer);
    const renderer = new LighthouseReportRenderer(dom);
    const el = renderer.renderReport(lighthouseResult, reportContainer);
    void this.waitForMainTargetLoad().then(() => {
      void LighthouseReportRenderer.linkifyNodeDetails(el);
      void LighthouseReportRenderer.linkifySourceLocationDetails(el);
    });
    LighthouseReportRenderer.handleDarkMode(el);
    const features = new LighthouseReportUIFeatures(dom);
    features.setBeforePrint(this.beforePrint.bind(this));
    features.setAfterPrint(this.afterPrint.bind(this));
    LighthouseReportRenderer.addViewTraceButton(el, features, artifacts);
    features.initFeatures(lighthouseResult);
    this.cachedRenderedReports.set(lighthouseResult, reportContainer);
  }
  async waitForMainTargetLoad() {
    const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!mainTarget) {
      return;
    }
    const resourceTreeModel = mainTarget.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!resourceTreeModel) {
      return;
    }
    await resourceTreeModel.once(SDK.ResourceTreeModel.Events.Load);
  }
  buildReportUI(lighthouseResult, artifacts) {
    if (lighthouseResult === null) {
      return;
    }
    const optionElement = new Item(lighthouseResult, () => this.renderReport(lighthouseResult, artifacts), this.renderStartView.bind(this));
    this.reportSelector.prepend(optionElement);
    this.refreshToolbarUI();
    this.renderReport(lighthouseResult);
  }
  handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    if (!items.length) {
      return;
    }
    const item = items[0];
    if (item.kind === "file") {
      const file = items[0].getAsFile();
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => this.loadedFromFile(reader.result);
      reader.readAsText(file);
    }
  }
  loadedFromFile(report) {
    const data = JSON.parse(report);
    if (!data["lighthouseVersion"]) {
      return;
    }
    this.buildReportUI(data);
  }
  async startLighthouse() {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.LighthouseStarted);
    try {
      const inspectedURL = await this.controller.getInspectedURL({ force: true });
      const categoryIDs = this.controller.getCategoryIDs();
      const flags = this.controller.getFlags();
      this.currentLighthouseRun = { inspectedURL, categoryIDs, flags };
      await this.setupEmulationAndProtocolConnection();
      if (flags.mode === "timespan") {
        await this.protocolService.startTimespan(this.currentLighthouseRun);
      }
    } catch (err) {
      await this.restoreEmulationAndProtocolConnection();
      if (err instanceof Error) {
        this.statusView.renderBugReport(err);
      }
    }
  }
  async collectLighthouseResults() {
    try {
      if (!this.currentLighthouseRun) {
        throw new Error("Lighthouse is not started");
      }
      this.renderStatusView(this.currentLighthouseRun.inspectedURL);
      const lighthouseResponse = await this.protocolService.collectLighthouseResults(this.currentLighthouseRun);
      if (lighthouseResponse && lighthouseResponse.fatal) {
        const error = new Error(lighthouseResponse.message);
        error.stack = lighthouseResponse.stack;
        throw error;
      }
      if (!lighthouseResponse) {
        throw new Error("Auditing failed to produce a result");
      }
      Host.userMetrics.actionTaken(Host.UserMetrics.Action.LighthouseFinished);
      await this.restoreEmulationAndProtocolConnection();
      this.buildReportUI(lighthouseResponse.lhr, lighthouseResponse.artifacts);
      this.newButton.element.focus();
    } catch (err) {
      await this.restoreEmulationAndProtocolConnection();
      if (err instanceof Error) {
        this.statusView.renderBugReport(err);
      }
    } finally {
      this.currentLighthouseRun = void 0;
    }
  }
  async cancelLighthouse() {
    this.currentLighthouseRun = void 0;
    this.statusView.updateStatus(i18nString(UIStrings.cancelling));
    await this.restoreEmulationAndProtocolConnection();
    this.renderStartView();
  }
  async setupEmulationAndProtocolConnection() {
    const flags = this.controller.getFlags();
    const emulationModel = EmulationModel.DeviceModeModel.DeviceModeModel.instance();
    this.stateBefore = {
      emulation: {
        type: emulationModel.type(),
        enabled: emulationModel.enabledSetting().get(),
        outlineEnabled: emulationModel.deviceOutlineSetting().get(),
        toolbarControlsEnabled: emulationModel.toolbarControlsEnabledSetting().get(),
        scale: emulationModel.scaleSetting().get(),
        device: emulationModel.device(),
        mode: emulationModel.mode()
      },
      network: { conditions: SDK.NetworkManager.MultitargetNetworkManager.instance().networkConditions() }
    };
    emulationModel.toolbarControlsEnabledSetting().set(false);
    if ("emulatedFormFactor" in flags && flags.emulatedFormFactor === "desktop") {
      emulationModel.enabledSetting().set(false);
      emulationModel.emulate(EmulationModel.DeviceModeModel.Type.None, null, null);
    } else if (flags.emulatedFormFactor === "mobile") {
      emulationModel.enabledSetting().set(true);
      emulationModel.deviceOutlineSetting().set(true);
      for (const device of EmulationModel.EmulatedDevices.EmulatedDevicesList.instance().standard()) {
        if (device.title === "Moto G4") {
          emulationModel.emulate(EmulationModel.DeviceModeModel.Type.Device, device, device.modes[0], 1);
        }
      }
    }
    await this.protocolService.attach();
    this.isLHAttached = true;
  }
  async restoreEmulationAndProtocolConnection() {
    if (!this.isLHAttached) {
      return;
    }
    this.isLHAttached = false;
    await this.protocolService.detach();
    if (this.stateBefore) {
      const emulationModel = EmulationModel.DeviceModeModel.DeviceModeModel.instance();
      emulationModel.emulate(EmulationModel.DeviceModeModel.Type.None, null, null);
      const { type, enabled, outlineEnabled, toolbarControlsEnabled, scale, device, mode } = this.stateBefore.emulation;
      emulationModel.enabledSetting().set(enabled);
      emulationModel.deviceOutlineSetting().set(outlineEnabled);
      emulationModel.toolbarControlsEnabledSetting().set(toolbarControlsEnabled);
      if (type === EmulationModel.DeviceModeModel.Type.Responsive) {
        emulationModel.scaleSetting().set(scale);
      }
      emulationModel.emulate(type, device, mode, scale);
      SDK.NetworkManager.MultitargetNetworkManager.instance().setNetworkConditions(this.stateBefore.network.conditions);
      delete this.stateBefore;
    }
    Emulation.InspectedPagePlaceholder.InspectedPagePlaceholder.instance().update(true);
    const mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!mainTarget) {
      return;
    }
    const resourceTreeModel = mainTarget.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!resourceTreeModel) {
      return;
    }
    const inspectedURL = await this.controller.getInspectedURL();
    await resourceTreeModel.navigate(inspectedURL);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([lighthousePanelStyles]);
  }
}
//# sourceMappingURL=LighthousePanel.js.map
