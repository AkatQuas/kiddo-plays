import * as i18n from "../../../core/i18n/i18n.js";
import * as EmulationModel from "../../../models/emulation/emulation.js";
import * as UI from "../../../ui/legacy/legacy.js";
import * as EmulationComponents from "./components/components.js";
import devicesSettingsTabStyles from "./devicesSettingsTab.css.js";
let devicesSettingsTabInstance;
const UIStrings = {
  emulatedDevices: "Emulated Devices",
  addCustomDevice: "Add custom device...",
  device: "Device",
  deviceName: "Device Name",
  width: "Width",
  height: "Height",
  devicePixelRatio: "Device pixel ratio",
  userAgentString: "User agent string",
  userAgentType: "User agent type",
  deviceNameMustBeLessThanS: "Device name must be less than {PH1} characters.",
  deviceNameCannotBeEmpty: "Device name cannot be empty.",
  deviceAddedOrUpdated: "Device {PH1} successfully added/updated."
};
const str_ = i18n.i18n.registerUIStrings("panels/settings/emulation/DevicesSettingsTab.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class DevicesSettingsTab extends UI.Widget.VBox {
  containerElement;
  addCustomButton;
  ariaSuccessMessageElement;
  list;
  muteUpdate;
  emulatedDevicesList;
  editor;
  constructor() {
    super();
    this.element.classList.add("settings-tab-container");
    this.element.classList.add("devices-settings-tab");
    const header = this.element.createChild("header");
    UI.UIUtils.createTextChild(header.createChild("h1"), i18nString(UIStrings.emulatedDevices));
    this.containerElement = this.element.createChild("div", "settings-container-wrapper").createChild("div", "settings-tab settings-content settings-container");
    const buttonsRow = this.containerElement.createChild("div", "devices-button-row");
    this.addCustomButton = UI.UIUtils.createTextButton(i18nString(UIStrings.addCustomDevice), this.addCustomDevice.bind(this));
    this.addCustomButton.id = "custom-device-add-button";
    buttonsRow.appendChild(this.addCustomButton);
    this.ariaSuccessMessageElement = this.containerElement.createChild("div", "device-success-message");
    UI.ARIAUtils.markAsPoliteLiveRegion(this.ariaSuccessMessageElement, false);
    this.list = new UI.ListWidget.ListWidget(this, false);
    this.list.element.classList.add("devices-list");
    this.list.show(this.containerElement);
    this.muteUpdate = false;
    this.emulatedDevicesList = EmulationModel.EmulatedDevices.EmulatedDevicesList.instance();
    this.emulatedDevicesList.addEventListener(EmulationModel.EmulatedDevices.Events.CustomDevicesUpdated, this.devicesUpdated, this);
    this.emulatedDevicesList.addEventListener(EmulationModel.EmulatedDevices.Events.StandardDevicesUpdated, this.devicesUpdated, this);
    this.setDefaultFocusedElement(this.addCustomButton);
  }
  static instance() {
    if (!devicesSettingsTabInstance) {
      devicesSettingsTabInstance = new DevicesSettingsTab();
    }
    return devicesSettingsTabInstance;
  }
  wasShown() {
    super.wasShown();
    this.devicesUpdated();
    this.registerCSSFiles([devicesSettingsTabStyles]);
    this.list.registerCSSFiles([devicesSettingsTabStyles]);
  }
  devicesUpdated() {
    if (this.muteUpdate) {
      return;
    }
    this.list.clear();
    let devices = this.emulatedDevicesList.custom().slice();
    for (let i = 0; i < devices.length; ++i) {
      this.list.appendItem(devices[i], true);
    }
    this.list.appendSeparator();
    devices = this.emulatedDevicesList.standard().slice();
    devices.sort(EmulationModel.EmulatedDevices.EmulatedDevice.deviceComparator);
    for (let i = 0; i < devices.length; ++i) {
      this.list.appendItem(devices[i], false);
    }
  }
  muteAndSaveDeviceList(custom) {
    this.muteUpdate = true;
    if (custom) {
      this.emulatedDevicesList.saveCustomDevices();
    } else {
      this.emulatedDevicesList.saveStandardDevices();
    }
    this.muteUpdate = false;
  }
  addCustomDevice() {
    const device = new EmulationModel.EmulatedDevices.EmulatedDevice();
    device.deviceScaleFactor = 0;
    device.horizontal.width = 700;
    device.horizontal.height = 400;
    device.vertical.width = 400;
    device.vertical.height = 700;
    this.list.addNewItem(this.emulatedDevicesList.custom().length, device);
  }
  toNumericInputValue(value) {
    return value ? String(value) : "";
  }
  renderItem(device, editable) {
    const label = document.createElement("label");
    label.classList.add("devices-list-item");
    const checkbox = label.createChild("input", "devices-list-checkbox");
    checkbox.type = "checkbox";
    checkbox.checked = device.show();
    checkbox.addEventListener("click", onItemClicked.bind(this), false);
    const span = document.createElement("span");
    span.classList.add("device-name");
    span.appendChild(document.createTextNode(device.title));
    label.appendChild(span);
    return label;
    function onItemClicked(event) {
      const show = checkbox.checked;
      device.setShow(show);
      this.muteAndSaveDeviceList(editable);
      event.consume();
    }
  }
  removeItemRequested(item) {
    this.emulatedDevicesList.removeCustomDevice(item);
  }
  commitEdit(device, editor, isNew) {
    device.title = editor.control("title").value.trim();
    device.vertical.width = editor.control("width").value ? parseInt(editor.control("width").value, 10) : 0;
    device.vertical.height = editor.control("height").value ? parseInt(editor.control("height").value, 10) : 0;
    device.horizontal.width = device.vertical.height;
    device.horizontal.height = device.vertical.width;
    device.deviceScaleFactor = editor.control("scale").value ? parseFloat(editor.control("scale").value) : 0;
    device.userAgent = editor.control("user-agent").value;
    device.modes = [];
    device.modes.push({
      title: "",
      orientation: EmulationModel.EmulatedDevices.Vertical,
      insets: new EmulationModel.DeviceModeModel.Insets(0, 0, 0, 0),
      image: null
    });
    device.modes.push({
      title: "",
      orientation: EmulationModel.EmulatedDevices.Horizontal,
      insets: new EmulationModel.DeviceModeModel.Insets(0, 0, 0, 0),
      image: null
    });
    device.capabilities = [];
    const uaType = editor.control("ua-type").value;
    if (uaType === EmulationModel.DeviceModeModel.UA.Mobile || uaType === EmulationModel.DeviceModeModel.UA.MobileNoTouch) {
      device.capabilities.push(EmulationModel.EmulatedDevices.Capability.Mobile);
    }
    if (uaType === EmulationModel.DeviceModeModel.UA.Mobile || uaType === EmulationModel.DeviceModeModel.UA.DesktopTouch) {
      device.capabilities.push(EmulationModel.EmulatedDevices.Capability.Touch);
    }
    const userAgentControlValue = editor.control("ua-metadata").value.metaData;
    if (userAgentControlValue) {
      device.userAgentMetadata = {
        ...userAgentControlValue,
        mobile: uaType === EmulationModel.DeviceModeModel.UA.Mobile || uaType === EmulationModel.DeviceModeModel.UA.MobileNoTouch
      };
    }
    if (isNew) {
      this.emulatedDevicesList.addCustomDevice(device);
    } else {
      this.emulatedDevicesList.saveCustomDevices();
    }
    this.addCustomButton.scrollIntoViewIfNeeded();
    this.addCustomButton.focus();
    this.ariaSuccessMessageElement.setAttribute("aria-label", i18nString(UIStrings.deviceAddedOrUpdated, { PH1: device.title }));
  }
  beginEdit(device) {
    const editor = this.createEditor();
    editor.control("title").value = device.title;
    editor.control("width").value = this.toNumericInputValue(device.vertical.width);
    editor.control("height").value = this.toNumericInputValue(device.vertical.height);
    editor.control("scale").value = this.toNumericInputValue(device.deviceScaleFactor);
    editor.control("user-agent").value = device.userAgent;
    let uaType;
    if (device.mobile()) {
      uaType = device.touch() ? EmulationModel.DeviceModeModel.UA.Mobile : EmulationModel.DeviceModeModel.UA.MobileNoTouch;
    } else {
      uaType = device.touch() ? EmulationModel.DeviceModeModel.UA.DesktopTouch : EmulationModel.DeviceModeModel.UA.Desktop;
    }
    editor.control("ua-type").value = uaType;
    editor.control("ua-metadata").value = { metaData: device.userAgentMetadata || void 0 };
    return editor;
  }
  createEditor() {
    if (this.editor) {
      return this.editor;
    }
    const editor = new UI.ListWidget.Editor();
    this.editor = editor;
    const content = editor.contentElement();
    const deviceFields = content.createChild("div", "devices-edit-fields");
    UI.UIUtils.createTextChild(deviceFields.createChild("b"), i18nString(UIStrings.device));
    const deviceNameField = editor.createInput("title", "text", i18nString(UIStrings.deviceName), titleValidator);
    deviceFields.createChild("div", "hbox").appendChild(deviceNameField);
    deviceNameField.id = "custom-device-name-field";
    const screen = deviceFields.createChild("div", "hbox");
    screen.appendChild(editor.createInput("width", "text", i18nString(UIStrings.width), widthValidator));
    screen.appendChild(editor.createInput("height", "text", i18nString(UIStrings.height), heightValidator));
    const dpr = editor.createInput("scale", "text", i18nString(UIStrings.devicePixelRatio), scaleValidator);
    dpr.classList.add("device-edit-fixed");
    screen.appendChild(dpr);
    const uaStringFields = content.createChild("div", "devices-edit-fields");
    UI.UIUtils.createTextChild(uaStringFields.createChild("b"), i18nString(UIStrings.userAgentString));
    const ua = uaStringFields.createChild("div", "hbox");
    ua.appendChild(editor.createInput("user-agent", "text", i18nString(UIStrings.userAgentString), () => {
      return { valid: true, errorMessage: void 0 };
    }));
    const uaTypeOptions = [
      EmulationModel.DeviceModeModel.UA.Mobile,
      EmulationModel.DeviceModeModel.UA.MobileNoTouch,
      EmulationModel.DeviceModeModel.UA.Desktop,
      EmulationModel.DeviceModeModel.UA.DesktopTouch
    ];
    const uaType = editor.createSelect("ua-type", uaTypeOptions, () => {
      return { valid: true, errorMessage: void 0 };
    }, i18nString(UIStrings.userAgentType));
    uaType.classList.add("device-edit-fixed");
    ua.appendChild(uaType);
    const uaMetadata = editor.createCustomControl("ua-metadata", EmulationComponents.UserAgentClientHintsForm.UserAgentClientHintsForm, userAgentMetadataValidator);
    uaMetadata.value = {};
    uaMetadata.addEventListener("clienthintschange", () => editor.requestValidation(), false);
    content.appendChild(uaMetadata);
    return editor;
    function userAgentMetadataValidator() {
      return uaMetadata.validate();
    }
    function titleValidator(item, index, input) {
      let valid = false;
      let errorMessage;
      const value = input.value.trim();
      if (value.length >= EmulationModel.DeviceModeModel.MaxDeviceNameLength) {
        errorMessage = i18nString(UIStrings.deviceNameMustBeLessThanS, { PH1: EmulationModel.DeviceModeModel.MaxDeviceNameLength });
      } else if (value.length === 0) {
        errorMessage = i18nString(UIStrings.deviceNameCannotBeEmpty);
      } else {
        valid = true;
      }
      return { valid, errorMessage };
    }
    function widthValidator(item, index, input) {
      return EmulationModel.DeviceModeModel.DeviceModeModel.widthValidator(input.value);
    }
    function heightValidator(item, index, input) {
      return EmulationModel.DeviceModeModel.DeviceModeModel.heightValidator(input.value);
    }
    function scaleValidator(item, index, input) {
      return EmulationModel.DeviceModeModel.DeviceModeModel.scaleValidator(input.value);
    }
  }
}
//# sourceMappingURL=DevicesSettingsTab.js.map
