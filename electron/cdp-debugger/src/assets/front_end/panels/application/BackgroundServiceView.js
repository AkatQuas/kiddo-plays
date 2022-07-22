import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import emptyWidgetStyles from "../../ui/legacy/emptyWidget.css.js";
import * as UI from "../../ui/legacy/legacy.js";
import backgroundServiceViewStyles from "./backgroundServiceView.css.js";
import { Events } from "./BackgroundServiceModel.js";
const UIStrings = {
  backgroundFetch: "Background Fetch",
  backgroundSync: "Background Sync",
  pushMessaging: "Push Messaging",
  notifications: "Notifications",
  paymentHandler: "Payment Handler",
  periodicBackgroundSync: "Periodic Background Sync",
  clear: "Clear",
  saveEvents: "Save events",
  showEventsFromOtherDomains: "Show events from other domains",
  stopRecordingEvents: "Stop recording events",
  startRecordingEvents: "Start recording events",
  timestamp: "Timestamp",
  event: "Event",
  origin: "Origin",
  swScope: "Service Worker Scope",
  instanceId: "Instance ID",
  backgroundServices: "Background Services",
  learnMore: "Learn more",
  selectAnEntryToViewMetadata: "Select an entry to view metadata",
  recordingSActivity: "Recording {PH1} activity...",
  devtoolsWillRecordAllSActivity: "DevTools will record all {PH1} activity for up to 3 days, even when closed.",
  clickTheRecordButtonSOrHitSTo: "Click the record button {PH1} or hit {PH2} to start recording.",
  empty: "empty",
  noMetadataForThisEvent: "No metadata for this event"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/BackgroundServiceView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class BackgroundServiceView extends UI.Widget.VBox {
  serviceName;
  model;
  serviceWorkerManager;
  securityOriginManager;
  recordAction;
  recordButton;
  originCheckbox;
  saveButton;
  toolbar;
  splitWidget;
  dataGrid;
  previewPanel;
  selectedEventNode;
  preview;
  static getUIString(serviceName) {
    switch (serviceName) {
      case Protocol.BackgroundService.ServiceName.BackgroundFetch:
        return i18nString(UIStrings.backgroundFetch);
      case Protocol.BackgroundService.ServiceName.BackgroundSync:
        return i18nString(UIStrings.backgroundSync);
      case Protocol.BackgroundService.ServiceName.PushMessaging:
        return i18nString(UIStrings.pushMessaging);
      case Protocol.BackgroundService.ServiceName.Notifications:
        return i18nString(UIStrings.notifications);
      case Protocol.BackgroundService.ServiceName.PaymentHandler:
        return i18nString(UIStrings.paymentHandler);
      case Protocol.BackgroundService.ServiceName.PeriodicBackgroundSync:
        return i18nString(UIStrings.periodicBackgroundSync);
      default:
        return "";
    }
  }
  constructor(serviceName, model) {
    super(true);
    this.serviceName = serviceName;
    this.model = model;
    this.model.addEventListener(Events.RecordingStateChanged, this.onRecordingStateChanged, this);
    this.model.addEventListener(Events.BackgroundServiceEventReceived, this.onEventReceived, this);
    this.model.enable(this.serviceName);
    this.serviceWorkerManager = this.model.target().model(SDK.ServiceWorkerManager.ServiceWorkerManager);
    this.securityOriginManager = this.model.target().model(SDK.SecurityOriginManager.SecurityOriginManager);
    if (!this.securityOriginManager) {
      throw new Error("SecurityOriginManager instance is missing");
    }
    this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.MainSecurityOriginChanged, () => this.onOriginChanged());
    this.recordAction = UI.ActionRegistry.ActionRegistry.instance().action("background-service.toggle-recording");
    this.toolbar = new UI.Toolbar.Toolbar("background-service-toolbar", this.contentElement);
    void this.setupToolbar();
    this.splitWidget = new UI.SplitWidget.SplitWidget(false, true);
    this.splitWidget.show(this.contentElement);
    this.dataGrid = this.createDataGrid();
    this.previewPanel = new UI.Widget.VBox();
    this.selectedEventNode = null;
    this.preview = null;
    this.splitWidget.setMainWidget(this.dataGrid.asWidget());
    this.splitWidget.setSidebarWidget(this.previewPanel);
    this.showPreview(null);
  }
  async setupToolbar() {
    this.recordButton = UI.Toolbar.Toolbar.createActionButton(this.recordAction);
    this.toolbar.appendToolbarItem(this.recordButton);
    const clearButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.clear), "largeicon-clear");
    clearButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.clearEvents());
    this.toolbar.appendToolbarItem(clearButton);
    this.toolbar.appendSeparator();
    this.saveButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.saveEvents), "largeicon-download");
    this.saveButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, (_event) => {
      void this.saveToFile();
    });
    this.saveButton.setEnabled(false);
    this.toolbar.appendToolbarItem(this.saveButton);
    this.toolbar.appendSeparator();
    this.originCheckbox = new UI.Toolbar.ToolbarCheckbox(i18nString(UIStrings.showEventsFromOtherDomains), i18nString(UIStrings.showEventsFromOtherDomains), () => this.refreshView());
    this.toolbar.appendToolbarItem(this.originCheckbox);
  }
  refreshView() {
    this.clearView();
    const events = this.model.getEvents(this.serviceName).filter((event) => this.acceptEvent(event));
    for (const event of events) {
      this.addEvent(event);
    }
  }
  clearView() {
    this.selectedEventNode = null;
    this.dataGrid.rootNode().removeChildren();
    this.saveButton.setEnabled(false);
    this.showPreview(null);
  }
  toggleRecording() {
    this.model.setRecording(!this.recordButton.toggled(), this.serviceName);
  }
  clearEvents() {
    this.model.clearEvents(this.serviceName);
    this.clearView();
  }
  onRecordingStateChanged({ data: state }) {
    if (state.serviceName !== this.serviceName) {
      return;
    }
    if (state.isRecording === this.recordButton.toggled()) {
      return;
    }
    this.recordButton.setToggled(state.isRecording);
    this.updateRecordButtonTooltip();
    this.showPreview(this.selectedEventNode);
  }
  updateRecordButtonTooltip() {
    const buttonTooltip = this.recordButton.toggled() ? i18nString(UIStrings.stopRecordingEvents) : i18nString(UIStrings.startRecordingEvents);
    this.recordButton.setTitle(buttonTooltip, "background-service.toggle-recording");
  }
  onEventReceived({
    data: serviceEvent
  }) {
    if (!this.acceptEvent(serviceEvent)) {
      return;
    }
    this.addEvent(serviceEvent);
  }
  onOriginChanged() {
    if (this.originCheckbox.checked()) {
      return;
    }
    this.refreshView();
  }
  addEvent(serviceEvent) {
    const data = this.createEventData(serviceEvent);
    const dataNode = new EventDataNode(data, serviceEvent.eventMetadata);
    this.dataGrid.rootNode().appendChild(dataNode);
    if (this.dataGrid.rootNode().children.length === 1) {
      this.saveButton.setEnabled(true);
      this.showPreview(this.selectedEventNode);
    }
  }
  createDataGrid() {
    const columns = [
      { id: "id", title: "#", weight: 1 },
      { id: "timestamp", title: i18nString(UIStrings.timestamp), weight: 8 },
      { id: "eventName", title: i18nString(UIStrings.event), weight: 10 },
      { id: "origin", title: i18nString(UIStrings.origin), weight: 10 },
      { id: "swScope", title: i18nString(UIStrings.swScope), weight: 5 },
      { id: "instanceId", title: i18nString(UIStrings.instanceId), weight: 10 }
    ];
    const dataGrid = new DataGrid.DataGrid.DataGridImpl({
      displayName: i18nString(UIStrings.backgroundServices),
      columns,
      editCallback: void 0,
      refreshCallback: void 0,
      deleteCallback: void 0
    });
    dataGrid.setStriped(true);
    dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, (event) => this.showPreview(event.data));
    return dataGrid;
  }
  createEventData(serviceEvent) {
    let swScope = "";
    const registration = this.serviceWorkerManager ? this.serviceWorkerManager.registrations().get(serviceEvent.serviceWorkerRegistrationId) : void 0;
    if (registration) {
      swScope = registration.scopeURL.substr(registration.securityOrigin.length);
    }
    return {
      id: this.dataGrid.rootNode().children.length + 1,
      timestamp: UI.UIUtils.formatTimestamp(serviceEvent.timestamp * 1e3, true),
      origin: serviceEvent.origin,
      swScope,
      eventName: serviceEvent.eventName,
      instanceId: serviceEvent.instanceId
    };
  }
  acceptEvent(event) {
    if (event.service !== this.serviceName) {
      return false;
    }
    if (this.originCheckbox.checked()) {
      return true;
    }
    const origin = event.origin.substr(0, event.origin.length - 1);
    return this.securityOriginManager.securityOrigins().includes(origin);
  }
  createLearnMoreLink() {
    let url = "https://developer.chrome.com/docs/devtools/javascript/background-services/?utm_source=devtools";
    switch (this.serviceName) {
      case Protocol.BackgroundService.ServiceName.BackgroundFetch:
        url += "#fetch";
        break;
      case Protocol.BackgroundService.ServiceName.BackgroundSync:
        url += "#sync";
        break;
      case Protocol.BackgroundService.ServiceName.PushMessaging:
        url += "#push";
        break;
      case Protocol.BackgroundService.ServiceName.Notifications:
        url += "#notifications";
        break;
      default:
        break;
    }
    return UI.XLink.XLink.create(url, i18nString(UIStrings.learnMore));
  }
  showPreview(dataNode) {
    if (this.selectedEventNode && this.selectedEventNode === dataNode) {
      return;
    }
    this.selectedEventNode = dataNode;
    if (this.preview) {
      this.preview.detach();
    }
    if (this.selectedEventNode) {
      this.preview = this.selectedEventNode.createPreview();
      this.preview.show(this.previewPanel.contentElement);
      return;
    }
    this.preview = new UI.Widget.VBox();
    this.preview.contentElement.classList.add("background-service-preview", "fill");
    const centered = this.preview.contentElement.createChild("div");
    if (this.dataGrid.rootNode().children.length) {
      centered.createChild("p").textContent = i18nString(UIStrings.selectAnEntryToViewMetadata);
    } else if (this.recordButton.toggled()) {
      const featureName = BackgroundServiceView.getUIString(this.serviceName);
      centered.createChild("p").textContent = i18nString(UIStrings.recordingSActivity, { PH1: featureName });
      centered.createChild("p").textContent = i18nString(UIStrings.devtoolsWillRecordAllSActivity, { PH1: featureName });
    } else {
      const landingRecordButton = UI.Toolbar.Toolbar.createActionButton(this.recordAction);
      const recordKey = document.createElement("b");
      recordKey.classList.add("background-service-shortcut");
      recordKey.textContent = UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutsForAction("background-service.toggle-recording")[0].title();
      const inlineButton = UI.UIUtils.createInlineButton(landingRecordButton);
      inlineButton.classList.add("background-service-record-inline-button");
      centered.createChild("p").appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.clickTheRecordButtonSOrHitSTo, { PH1: inlineButton, PH2: recordKey }));
      centered.appendChild(this.createLearnMoreLink());
    }
    this.preview.show(this.previewPanel.contentElement);
  }
  async saveToFile() {
    const fileName = `${this.serviceName}-${Platform.DateUtilities.toISO8601Compact(new Date())}.json`;
    const stream = new Bindings.FileUtils.FileOutputStream();
    const accepted = await stream.open(fileName);
    if (!accepted) {
      return;
    }
    const events = this.model.getEvents(this.serviceName).filter((event) => this.acceptEvent(event));
    await stream.write(JSON.stringify(events, void 0, 2));
    void stream.close();
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([emptyWidgetStyles, backgroundServiceViewStyles]);
  }
}
export class EventDataNode extends DataGrid.DataGrid.DataGridNode {
  eventMetadata;
  constructor(data, eventMetadata) {
    super(data);
    this.eventMetadata = eventMetadata.sort((m1, m2) => Platform.StringUtilities.compare(m1.key, m2.key));
  }
  createPreview() {
    const preview = new UI.Widget.VBox();
    preview.element.classList.add("background-service-metadata");
    for (const entry of this.eventMetadata) {
      const div = document.createElement("div");
      div.classList.add("background-service-metadata-entry");
      div.createChild("div", "background-service-metadata-name").textContent = entry.key + ": ";
      if (entry.value) {
        div.createChild("div", "background-service-metadata-value source-code").textContent = entry.value;
      } else {
        div.createChild("div", "background-service-metadata-value background-service-empty-value").textContent = i18nString(UIStrings.empty);
      }
      preview.element.appendChild(div);
    }
    if (!preview.element.children.length) {
      const div = document.createElement("div");
      div.classList.add("background-service-metadata-entry");
      div.createChild("div", "background-service-metadata-name background-service-empty-value").textContent = i18nString(UIStrings.noMetadataForThisEvent);
      preview.element.appendChild(div);
    }
    return preview;
  }
}
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
    const view = context.flavor(BackgroundServiceView);
    switch (actionId) {
      case "background-service.toggle-recording": {
        if (!view) {
          throw new Error("BackgroundServiceView instance is missing");
        }
        view.toggleRecording();
        return true;
      }
    }
    return false;
  }
}
//# sourceMappingURL=BackgroundServiceView.js.map
