import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as DataGrid from "../../ui/legacy/components/data_grid/data_grid.js";
import * as UI from "../../ui/legacy/legacy.js";
import webauthnPaneStyles from "./webauthnPane.css.js";
const UIStrings = {
  export: "Export",
  remove: "Remove",
  noCredentialsTryCallingSFromYour: "No credentials. Try calling {PH1} from your website.",
  enableVirtualAuthenticator: "Enable virtual authenticator environment",
  id: "ID",
  isResident: "Is Resident",
  rpId: "RP ID",
  userHandle: "User Handle",
  signCount: "Signature Count",
  actions: "Actions",
  credentials: "Credentials",
  useWebauthnForPhishingresistant: "Use WebAuthn for phishing-resistant authentication",
  learnMore: "Learn more",
  newAuthenticator: "New authenticator",
  protocol: "Protocol",
  transport: "Transport",
  supportsResidentKeys: "Supports resident keys",
  supportsLargeBlob: "Supports large blob",
  add: "Add",
  addAuthenticator: "Add authenticator",
  active: "Active",
  editName: "Edit name",
  saveName: "Save name",
  authenticatorS: "Authenticator {PH1}",
  privateKeypem: "Private key.pem",
  uuid: "UUID",
  supportsUserVerification: "Supports user verification",
  yes: "Yes",
  no: "No",
  setSAsTheActiveAuthenticator: "Set {PH1} as the active authenticator"
};
const str_ = i18n.i18n.registerUIStrings("panels/webauthn/WebauthnPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const TIMEOUT = 1e3;
var Events = /* @__PURE__ */ ((Events2) => {
  Events2["ExportCredential"] = "ExportCredential";
  Events2["RemoveCredential"] = "RemoveCredential";
  return Events2;
})(Events || {});
class DataGridNode extends DataGrid.DataGrid.DataGridNode {
  constructor(credential) {
    super(credential);
    this.credential = credential;
  }
  nodeSelfHeight() {
    return 24;
  }
  createCell(columnId) {
    const cell = super.createCell(columnId);
    UI.Tooltip.Tooltip.install(cell, cell.textContent || "");
    if (columnId !== "actions") {
      return cell;
    }
    const exportButton = UI.UIUtils.createTextButton(i18nString(UIStrings.export), () => {
      if (this.dataGrid) {
        this.dataGrid.dispatchEventToListeners("ExportCredential" /* ExportCredential */, this.credential);
      }
    });
    cell.appendChild(exportButton);
    const removeButton = UI.UIUtils.createTextButton(i18nString(UIStrings.remove), () => {
      if (this.dataGrid) {
        this.dataGrid.dispatchEventToListeners("RemoveCredential" /* RemoveCredential */, this.credential);
      }
    });
    cell.appendChild(removeButton);
    return cell;
  }
}
class WebauthnDataGridBase extends DataGrid.DataGrid.DataGridImpl {
}
class WebauthnDataGrid extends Common.ObjectWrapper.eventMixin(WebauthnDataGridBase) {
}
class EmptyDataGridNode extends DataGrid.DataGrid.DataGridNode {
  createCells(element) {
    element.removeChildren();
    const td = this.createTDWithClass(DataGrid.DataGrid.Align.Center);
    if (this.dataGrid) {
      td.colSpan = this.dataGrid.visibleColumnsArray.length;
    }
    const code = document.createElement("span", { is: "source-code" });
    code.textContent = "navigator.credentials.create()";
    code.classList.add("code");
    const message = i18n.i18n.getFormatLocalizedString(str_, UIStrings.noCredentialsTryCallingSFromYour, { PH1: code });
    td.appendChild(message);
    element.appendChild(td);
  }
}
let webauthnPaneImplInstance;
const PRIVATE_NAME = "PRIVATE";
const PRIVATE_KEY_HEADER = `-----BEGIN ${PRIVATE_NAME} KEY-----
`;
const PRIVATE_KEY_FOOTER = `-----END ${PRIVATE_NAME} KEY-----`;
const PROTOCOL_AUTHENTICATOR_VALUES = {
  Ctap2: Protocol.WebAuthn.AuthenticatorProtocol.Ctap2,
  U2f: Protocol.WebAuthn.AuthenticatorProtocol.U2f
};
export class WebauthnPaneImpl extends UI.Widget.VBox {
  #activeAuthId = null;
  #hasBeenEnabled = false;
  #dataGrids = /* @__PURE__ */ new Map();
  #enableCheckbox;
  #availableAuthenticatorSetting;
  #model;
  #authenticatorsView;
  #topToolbarContainer;
  #topToolbar;
  #learnMoreView;
  #newAuthenticatorSection;
  #newAuthenticatorForm;
  #protocolSelect;
  #transportSelect;
  #residentKeyCheckboxLabel;
  residentKeyCheckbox;
  #userVerificationCheckboxLabel;
  #userVerificationCheckbox;
  #largeBlobCheckboxLabel;
  largeBlobCheckbox;
  addAuthenticatorButton;
  #isEnabling;
  constructor() {
    super(true);
    SDK.TargetManager.TargetManager.instance().observeModels(SDK.WebAuthnModel.WebAuthnModel, this);
    this.contentElement.classList.add("webauthn-pane");
    this.#availableAuthenticatorSetting = Common.Settings.Settings.instance().createSetting("webauthnAuthenticators", []);
    this.#createToolbar();
    this.#authenticatorsView = this.contentElement.createChild("div", "authenticators-view");
    this.#createNewAuthenticatorSection();
    this.#updateVisibility(false);
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!webauthnPaneImplInstance || forceNew) {
      webauthnPaneImplInstance = new WebauthnPaneImpl();
    }
    return webauthnPaneImplInstance;
  }
  modelAdded(model) {
    if (model.target() === SDK.TargetManager.TargetManager.instance().mainTarget()) {
      this.#model = model;
    }
  }
  modelRemoved(model) {
    if (model.target() === SDK.TargetManager.TargetManager.instance().mainTarget()) {
      this.#model = void 0;
    }
  }
  async #loadInitialAuthenticators() {
    let activeAuthenticatorId = null;
    const availableAuthenticators = this.#availableAuthenticatorSetting.get();
    for (const options of availableAuthenticators) {
      if (!this.#model) {
        continue;
      }
      const authenticatorId = await this.#model.addAuthenticator(options);
      void this.#addAuthenticatorSection(authenticatorId, options);
      options.authenticatorId = authenticatorId;
      if (options.active) {
        activeAuthenticatorId = authenticatorId;
      }
    }
    this.#availableAuthenticatorSetting.set(availableAuthenticators);
    if (activeAuthenticatorId) {
      void this.#setActiveAuthenticator(activeAuthenticatorId);
    }
  }
  async ownerViewDisposed() {
    if (this.#enableCheckbox) {
      this.#enableCheckbox.setChecked(false);
    }
    await this.#setVirtualAuthEnvEnabled(false);
  }
  #createToolbar() {
    this.#topToolbarContainer = this.contentElement.createChild("div", "webauthn-toolbar-container");
    this.#topToolbar = new UI.Toolbar.Toolbar("webauthn-toolbar", this.#topToolbarContainer);
    const enableCheckboxTitle = i18nString(UIStrings.enableVirtualAuthenticator);
    this.#enableCheckbox = new UI.Toolbar.ToolbarCheckbox(enableCheckboxTitle, enableCheckboxTitle, this.#handleCheckboxToggle.bind(this));
    this.#topToolbar.appendToolbarItem(this.#enableCheckbox);
  }
  #createCredentialsDataGrid(authenticatorId) {
    const columns = [
      {
        id: "credentialId",
        title: i18nString(UIStrings.id),
        longText: true,
        weight: 24
      },
      {
        id: "isResidentCredential",
        title: i18nString(UIStrings.isResident),
        dataType: DataGrid.DataGrid.DataType.Boolean,
        weight: 10
      },
      {
        id: "rpId",
        title: i18nString(UIStrings.rpId)
      },
      {
        id: "userHandle",
        title: i18nString(UIStrings.userHandle)
      },
      {
        id: "signCount",
        title: i18nString(UIStrings.signCount)
      },
      { id: "actions", title: i18nString(UIStrings.actions) }
    ];
    const dataGridConfig = {
      displayName: i18nString(UIStrings.credentials),
      columns,
      editCallback: void 0,
      deleteCallback: void 0,
      refreshCallback: void 0
    };
    const dataGrid = new WebauthnDataGrid(dataGridConfig);
    dataGrid.renderInline();
    dataGrid.setStriped(true);
    dataGrid.addEventListener("ExportCredential" /* ExportCredential */, this.#handleExportCredential, this);
    dataGrid.addEventListener("RemoveCredential" /* RemoveCredential */, this.#handleRemoveCredential.bind(this, authenticatorId));
    this.#dataGrids.set(authenticatorId, dataGrid);
    return dataGrid;
  }
  #handleExportCredential({ data: credential }) {
    this.#exportCredential(credential);
  }
  #handleRemoveCredential(authenticatorId, {
    data: credential
  }) {
    void this.#removeCredential(authenticatorId, credential.credentialId);
  }
  async #updateCredentials(authenticatorId) {
    const dataGrid = this.#dataGrids.get(authenticatorId);
    if (!dataGrid) {
      return;
    }
    if (this.#model) {
      const credentials = await this.#model.getCredentials(authenticatorId);
      dataGrid.rootNode().removeChildren();
      for (const credential of credentials) {
        const node = new DataGridNode(credential);
        dataGrid.rootNode().appendChild(node);
      }
      this.#maybeAddEmptyNode(dataGrid);
    }
    window.setTimeout(this.#updateCredentials.bind(this, authenticatorId), TIMEOUT);
  }
  #maybeAddEmptyNode(dataGrid) {
    if (dataGrid.rootNode().children.length) {
      return;
    }
    const node = new EmptyDataGridNode();
    dataGrid.rootNode().appendChild(node);
  }
  async #setVirtualAuthEnvEnabled(enable) {
    await this.#isEnabling;
    this.#isEnabling = new Promise(async (resolve) => {
      if (enable && !this.#hasBeenEnabled) {
        Host.userMetrics.actionTaken(Host.UserMetrics.Action.VirtualAuthenticatorEnvironmentEnabled);
        this.#hasBeenEnabled = true;
      }
      if (this.#model) {
        await this.#model.setVirtualAuthEnvEnabled(enable);
      }
      if (enable) {
        await this.#loadInitialAuthenticators();
      } else {
        this.#removeAuthenticatorSections();
      }
      this.#updateVisibility(enable);
      this.#isEnabling = void 0;
      resolve();
    });
  }
  #updateVisibility(enabled) {
    this.contentElement.classList.toggle("enabled", enabled);
  }
  #removeAuthenticatorSections() {
    this.#authenticatorsView.innerHTML = "";
    for (const dataGrid of this.#dataGrids.values()) {
      dataGrid.asWidget().detach();
    }
    this.#dataGrids.clear();
  }
  #handleCheckboxToggle(e) {
    void this.#setVirtualAuthEnvEnabled(e.target.checked);
  }
  #updateEnabledTransportOptions(enabledOptions) {
    if (!this.#transportSelect) {
      return;
    }
    const prevValue = this.#transportSelect.value;
    this.#transportSelect.removeChildren();
    for (const option of enabledOptions) {
      this.#transportSelect.appendChild(new Option(option, option));
    }
    this.#transportSelect.value = prevValue;
    if (!this.#transportSelect.value) {
      this.#transportSelect.selectedIndex = 0;
    }
  }
  #updateNewAuthenticatorSectionOptions() {
    if (!this.#protocolSelect || !this.residentKeyCheckbox || !this.#userVerificationCheckbox || !this.largeBlobCheckbox) {
      return;
    }
    if (this.#protocolSelect.value === Protocol.WebAuthn.AuthenticatorProtocol.Ctap2) {
      this.residentKeyCheckbox.disabled = false;
      this.#userVerificationCheckbox.disabled = false;
      this.largeBlobCheckbox.disabled = !this.residentKeyCheckbox.checked;
      if (this.largeBlobCheckbox.disabled) {
        this.largeBlobCheckbox.checked = false;
      }
      this.#updateEnabledTransportOptions([
        Protocol.WebAuthn.AuthenticatorTransport.Usb,
        Protocol.WebAuthn.AuthenticatorTransport.Ble,
        Protocol.WebAuthn.AuthenticatorTransport.Nfc,
        Protocol.WebAuthn.AuthenticatorTransport.Internal
      ]);
    } else {
      this.residentKeyCheckbox.checked = false;
      this.residentKeyCheckbox.disabled = true;
      this.#userVerificationCheckbox.checked = false;
      this.#userVerificationCheckbox.disabled = true;
      this.largeBlobCheckbox.checked = false;
      this.largeBlobCheckbox.disabled = true;
      this.#updateEnabledTransportOptions([
        Protocol.WebAuthn.AuthenticatorTransport.Usb,
        Protocol.WebAuthn.AuthenticatorTransport.Ble,
        Protocol.WebAuthn.AuthenticatorTransport.Nfc
      ]);
    }
  }
  #createNewAuthenticatorSection() {
    this.#learnMoreView = this.contentElement.createChild("div", "learn-more");
    this.#learnMoreView.appendChild(UI.Fragment.html`
  <div>
  ${i18nString(UIStrings.useWebauthnForPhishingresistant)}<br /><br />
  ${UI.XLink.XLink.create("https://developers.google.com/web/updates/2018/05/webauthn", i18nString(UIStrings.learnMore))}
  </div>
  `);
    this.#newAuthenticatorSection = this.contentElement.createChild("div", "new-authenticator-container");
    const newAuthenticatorTitle = UI.UIUtils.createLabel(i18nString(UIStrings.newAuthenticator), "new-authenticator-title");
    this.#newAuthenticatorSection.appendChild(newAuthenticatorTitle);
    this.#newAuthenticatorForm = this.#newAuthenticatorSection.createChild("div", "new-authenticator-form");
    const protocolGroup = this.#newAuthenticatorForm.createChild("div", "authenticator-option");
    const transportGroup = this.#newAuthenticatorForm.createChild("div", "authenticator-option");
    const residentKeyGroup = this.#newAuthenticatorForm.createChild("div", "authenticator-option");
    const userVerificationGroup = this.#newAuthenticatorForm.createChild("div", "authenticator-option");
    const largeBlobGroup = this.#newAuthenticatorForm.createChild("div", "authenticator-option");
    const addButtonGroup = this.#newAuthenticatorForm.createChild("div", "authenticator-option");
    const protocolSelectTitle = UI.UIUtils.createLabel(i18nString(UIStrings.protocol), "authenticator-option-label");
    protocolGroup.appendChild(protocolSelectTitle);
    this.#protocolSelect = protocolGroup.createChild("select", "chrome-select");
    UI.ARIAUtils.bindLabelToControl(protocolSelectTitle, this.#protocolSelect);
    Object.values(PROTOCOL_AUTHENTICATOR_VALUES).sort().forEach((option) => {
      if (this.#protocolSelect) {
        this.#protocolSelect.appendChild(new Option(option, option));
      }
    });
    if (this.#protocolSelect) {
      this.#protocolSelect.value = Protocol.WebAuthn.AuthenticatorProtocol.Ctap2;
    }
    const transportSelectTitle = UI.UIUtils.createLabel(i18nString(UIStrings.transport), "authenticator-option-label");
    transportGroup.appendChild(transportSelectTitle);
    this.#transportSelect = transportGroup.createChild("select", "chrome-select");
    UI.ARIAUtils.bindLabelToControl(transportSelectTitle, this.#transportSelect);
    this.#residentKeyCheckboxLabel = UI.UIUtils.CheckboxLabel.create(i18nString(UIStrings.supportsResidentKeys), false);
    this.#residentKeyCheckboxLabel.textElement.classList.add("authenticator-option-label");
    residentKeyGroup.appendChild(this.#residentKeyCheckboxLabel.textElement);
    this.residentKeyCheckbox = this.#residentKeyCheckboxLabel.checkboxElement;
    this.residentKeyCheckbox.checked = false;
    this.residentKeyCheckbox.classList.add("authenticator-option-checkbox");
    residentKeyGroup.appendChild(this.#residentKeyCheckboxLabel);
    this.#userVerificationCheckboxLabel = UI.UIUtils.CheckboxLabel.create("Supports user verification", false);
    this.#userVerificationCheckboxLabel.textElement.classList.add("authenticator-option-label");
    userVerificationGroup.appendChild(this.#userVerificationCheckboxLabel.textElement);
    this.#userVerificationCheckbox = this.#userVerificationCheckboxLabel.checkboxElement;
    this.#userVerificationCheckbox.checked = false;
    this.#userVerificationCheckbox.classList.add("authenticator-option-checkbox");
    userVerificationGroup.appendChild(this.#userVerificationCheckboxLabel);
    this.#largeBlobCheckboxLabel = UI.UIUtils.CheckboxLabel.create(i18nString(UIStrings.supportsLargeBlob), false);
    this.#largeBlobCheckboxLabel.textElement.classList.add("authenticator-option-label");
    largeBlobGroup.appendChild(this.#largeBlobCheckboxLabel.textElement);
    this.largeBlobCheckbox = this.#largeBlobCheckboxLabel.checkboxElement;
    this.largeBlobCheckbox.checked = false;
    this.largeBlobCheckbox.classList.add("authenticator-option-checkbox");
    this.largeBlobCheckbox.name = "large-blob-checkbox";
    largeBlobGroup.appendChild(this.#largeBlobCheckboxLabel);
    this.addAuthenticatorButton = UI.UIUtils.createTextButton(i18nString(UIStrings.add), this.#handleAddAuthenticatorButton.bind(this), "");
    addButtonGroup.createChild("div", "authenticator-option-label");
    addButtonGroup.appendChild(this.addAuthenticatorButton);
    const addAuthenticatorTitle = UI.UIUtils.createLabel(i18nString(UIStrings.addAuthenticator), "");
    UI.ARIAUtils.bindLabelToControl(addAuthenticatorTitle, this.addAuthenticatorButton);
    this.#updateNewAuthenticatorSectionOptions();
    if (this.#protocolSelect) {
      this.#protocolSelect.addEventListener("change", this.#updateNewAuthenticatorSectionOptions.bind(this));
    }
    if (this.residentKeyCheckbox) {
      this.residentKeyCheckbox.addEventListener("change", this.#updateNewAuthenticatorSectionOptions.bind(this));
    }
  }
  async #handleAddAuthenticatorButton() {
    const options = this.#createOptionsFromCurrentInputs();
    if (this.#model) {
      const authenticatorId = await this.#model.addAuthenticator(options);
      const availableAuthenticators = this.#availableAuthenticatorSetting.get();
      availableAuthenticators.push({ authenticatorId, active: true, ...options });
      this.#availableAuthenticatorSetting.set(availableAuthenticators.map((a) => ({ ...a, active: a.authenticatorId === authenticatorId })));
      const section = await this.#addAuthenticatorSection(authenticatorId, options);
      const mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");
      const prefersReducedMotion = mediaQueryList.matches;
      section.scrollIntoView({ block: "start", behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  }
  async #addAuthenticatorSection(authenticatorId, options) {
    const section = document.createElement("div");
    section.classList.add("authenticator-section");
    section.setAttribute("data-authenticator-id", authenticatorId);
    this.#authenticatorsView.appendChild(section);
    const headerElement = section.createChild("div", "authenticator-section-header");
    const titleElement = headerElement.createChild("div", "authenticator-section-title");
    UI.ARIAUtils.markAsHeading(titleElement, 2);
    await this.#clearActiveAuthenticator();
    const activeButtonContainer = headerElement.createChild("div", "active-button-container");
    const activeLabel = UI.UIUtils.createRadioLabel(`active-authenticator-${authenticatorId}`, i18nString(UIStrings.active));
    activeLabel.radioElement.addEventListener("click", this.#setActiveAuthenticator.bind(this, authenticatorId));
    activeButtonContainer.appendChild(activeLabel);
    activeLabel.radioElement.checked = true;
    this.#activeAuthId = authenticatorId;
    const removeButton = headerElement.createChild("button", "text-button");
    removeButton.textContent = i18nString(UIStrings.remove);
    removeButton.addEventListener("click", this.#removeAuthenticator.bind(this, authenticatorId));
    const toolbar = new UI.Toolbar.Toolbar("edit-name-toolbar", titleElement);
    const editName = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.editName), "largeicon-edit");
    const saveName = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.saveName), "largeicon-checkmark");
    saveName.setVisible(false);
    const nameField = titleElement.createChild("input", "authenticator-name-field");
    nameField.disabled = true;
    const userFriendlyName = authenticatorId.slice(-5);
    nameField.value = i18nString(UIStrings.authenticatorS, { PH1: userFriendlyName });
    this.#updateActiveLabelTitle(activeLabel, nameField.value);
    editName.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.#handleEditNameButton(titleElement, nameField, editName, saveName));
    saveName.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.#handleSaveNameButton(titleElement, nameField, editName, saveName, activeLabel));
    nameField.addEventListener("focusout", () => this.#handleSaveNameButton(titleElement, nameField, editName, saveName, activeLabel));
    nameField.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.#handleSaveNameButton(titleElement, nameField, editName, saveName, activeLabel);
      }
    });
    toolbar.appendToolbarItem(editName);
    toolbar.appendToolbarItem(saveName);
    this.#createAuthenticatorFields(section, authenticatorId, options);
    const label = document.createElement("div");
    label.classList.add("credentials-title");
    label.textContent = i18nString(UIStrings.credentials);
    section.appendChild(label);
    const dataGrid = this.#createCredentialsDataGrid(authenticatorId);
    dataGrid.asWidget().show(section);
    void this.#updateCredentials(authenticatorId);
    return section;
  }
  #exportCredential(credential) {
    let pem = PRIVATE_KEY_HEADER;
    for (let i = 0; i < credential.privateKey.length; i += 64) {
      pem += credential.privateKey.substring(i, i + 64) + "\n";
    }
    pem += PRIVATE_KEY_FOOTER;
    const link = document.createElement("a");
    link.download = i18nString(UIStrings.privateKeypem);
    link.href = "data:application/x-pem-file," + encodeURIComponent(pem);
    link.click();
  }
  async #removeCredential(authenticatorId, credentialId) {
    const dataGrid = this.#dataGrids.get(authenticatorId);
    if (!dataGrid) {
      return;
    }
    dataGrid.rootNode().children.find((n) => n.data.credentialId === credentialId).remove();
    this.#maybeAddEmptyNode(dataGrid);
    if (this.#model) {
      await this.#model.removeCredential(authenticatorId, credentialId);
    }
  }
  #createAuthenticatorFields(section, authenticatorId, options) {
    const sectionFields = section.createChild("div", "authenticator-fields");
    const uuidField = sectionFields.createChild("div", "authenticator-field");
    const protocolField = sectionFields.createChild("div", "authenticator-field");
    const transportField = sectionFields.createChild("div", "authenticator-field");
    const srkField = sectionFields.createChild("div", "authenticator-field");
    const slbField = sectionFields.createChild("div", "authenticator-field");
    const suvField = sectionFields.createChild("div", "authenticator-field");
    uuidField.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.uuid), "authenticator-option-label"));
    protocolField.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.protocol), "authenticator-option-label"));
    transportField.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.transport), "authenticator-option-label"));
    srkField.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.supportsResidentKeys), "authenticator-option-label"));
    slbField.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.supportsLargeBlob), "authenticator-option-label"));
    suvField.appendChild(UI.UIUtils.createLabel(i18nString(UIStrings.supportsUserVerification), "authenticator-option-label"));
    uuidField.createChild("div", "authenticator-field-value").textContent = authenticatorId;
    protocolField.createChild("div", "authenticator-field-value").textContent = options.protocol;
    transportField.createChild("div", "authenticator-field-value").textContent = options.transport;
    srkField.createChild("div", "authenticator-field-value").textContent = options.hasResidentKey ? i18nString(UIStrings.yes) : i18nString(UIStrings.no);
    slbField.createChild("div", "authenticator-field-value").textContent = options.hasLargeBlob ? i18nString(UIStrings.yes) : i18nString(UIStrings.no);
    suvField.createChild("div", "authenticator-field-value").textContent = options.hasUserVerification ? i18nString(UIStrings.yes) : i18nString(UIStrings.no);
  }
  #handleEditNameButton(titleElement, nameField, editName, saveName) {
    nameField.disabled = false;
    titleElement.classList.add("editing-name");
    nameField.focus();
    saveName.setVisible(true);
    editName.setVisible(false);
  }
  #handleSaveNameButton(titleElement, nameField, editName, saveName, activeLabel) {
    nameField.disabled = true;
    titleElement.classList.remove("editing-name");
    editName.setVisible(true);
    saveName.setVisible(false);
    this.#updateActiveLabelTitle(activeLabel, nameField.value);
  }
  #updateActiveLabelTitle(activeLabel, authenticatorName) {
    UI.Tooltip.Tooltip.install(activeLabel.radioElement, i18nString(UIStrings.setSAsTheActiveAuthenticator, { PH1: authenticatorName }));
  }
  #removeAuthenticator(authenticatorId) {
    if (this.#authenticatorsView) {
      const child = this.#authenticatorsView.querySelector(`[data-authenticator-id=${CSS.escape(authenticatorId)}]`);
      if (child) {
        child.remove();
      }
    }
    const dataGrid = this.#dataGrids.get(authenticatorId);
    if (dataGrid) {
      dataGrid.asWidget().detach();
      this.#dataGrids.delete(authenticatorId);
    }
    if (this.#model) {
      void this.#model.removeAuthenticator(authenticatorId);
    }
    const prevAvailableAuthenticators = this.#availableAuthenticatorSetting.get();
    const newAvailableAuthenticators = prevAvailableAuthenticators.filter((a) => a.authenticatorId !== authenticatorId);
    this.#availableAuthenticatorSetting.set(newAvailableAuthenticators);
    if (this.#activeAuthId === authenticatorId) {
      const availableAuthenticatorIds = Array.from(this.#dataGrids.keys());
      if (availableAuthenticatorIds.length) {
        void this.#setActiveAuthenticator(availableAuthenticatorIds[0]);
      } else {
        this.#activeAuthId = null;
      }
    }
  }
  #createOptionsFromCurrentInputs() {
    if (!this.#protocolSelect || !this.#transportSelect || !this.residentKeyCheckbox || !this.#userVerificationCheckbox || !this.largeBlobCheckbox) {
      throw new Error("Unable to create options from current inputs");
    }
    return {
      protocol: this.#protocolSelect.options[this.#protocolSelect.selectedIndex].value,
      ctap2Version: Protocol.WebAuthn.Ctap2Version.Ctap2_1,
      transport: this.#transportSelect.options[this.#transportSelect.selectedIndex].value,
      hasResidentKey: this.residentKeyCheckbox.checked,
      hasUserVerification: this.#userVerificationCheckbox.checked,
      hasLargeBlob: this.largeBlobCheckbox.checked,
      automaticPresenceSimulation: true,
      isUserVerified: true
    };
  }
  async #setActiveAuthenticator(authenticatorId) {
    await this.#clearActiveAuthenticator();
    if (this.#model) {
      await this.#model.setAutomaticPresenceSimulation(authenticatorId, true);
    }
    this.#activeAuthId = authenticatorId;
    const prevAvailableAuthenticators = this.#availableAuthenticatorSetting.get();
    const newAvailableAuthenticators = prevAvailableAuthenticators.map((a) => ({ ...a, active: a.authenticatorId === authenticatorId }));
    this.#availableAuthenticatorSetting.set(newAvailableAuthenticators);
    this.#updateActiveButtons();
  }
  #updateActiveButtons() {
    const authenticators = this.#authenticatorsView.getElementsByClassName("authenticator-section");
    Array.from(authenticators).forEach((authenticator) => {
      const button = authenticator.querySelector("input.dt-radio-button");
      if (!button) {
        return;
      }
      button.checked = authenticator.dataset.authenticatorId === this.#activeAuthId;
    });
  }
  async #clearActiveAuthenticator() {
    if (this.#activeAuthId && this.#model) {
      await this.#model.setAutomaticPresenceSimulation(this.#activeAuthId, false);
    }
    this.#activeAuthId = null;
    this.#updateActiveButtons();
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([webauthnPaneStyles]);
  }
}
//# sourceMappingURL=WebauthnPane.js.map
