import * as i18n from "../../../../core/i18n/i18n.js";
import * as Buttons from "../../../../ui/components/buttons/buttons.js";
import * as ComponentHelpers from "../../../../ui/components/helpers/helpers.js";
import * as LitHtml from "../../../../ui/lit-html/lit-html.js";
import userAgentClientHintsFormStyles from "./userAgentClientHintsForm.css.js";
import * as Input from "../../../../ui/components/input/input.js";
import * as IconButton from "../../../../ui/components/icon_button/icon_button.js";
import * as EmulationUtils from "../utils/utils.js";
const UIStrings = {
  title: "User agent client hints",
  brands: "Brands",
  brandProperties: "Brand properties",
  brandName: "Brand",
  brandNameAriaLabel: "Brand {PH1}",
  version: "Version",
  brandVersionAriaLabel: "Version {PH1}",
  addBrand: "Add Brand",
  deleteTooltip: "Delete",
  brandDeleteAriaLabel: "Delete {PH1}",
  fullBrowserVersion: "Full browser version",
  fullBrowserVersionPlaceholder: "Full browser version (e.g. 87.0.4280.88)",
  platformLabel: "Platform",
  platformProperties: "Platform properties",
  platformVersion: "Platform version",
  platformPlaceholder: "Platform (e.g. Android)",
  architecture: "Architecture",
  architecturePlaceholder: "Architecture (e.g. x86)",
  deviceProperties: "Device properties",
  deviceModel: "Device model",
  mobileCheckboxLabel: "Mobile",
  update: "Update",
  notRepresentable: "Not representable as structured headers string.",
  userAgentClientHintsInfo: "User agent client hints are an alternative to the user agent string that identify the browser and the device in a more structured way with better privacy accounting. Click the button to learn more.",
  addedBrand: "Added brand row",
  deletedBrand: "Deleted brand row"
};
const str_ = i18n.i18n.registerUIStrings("panels/settings/emulation/components/UserAgentClientHintsForm.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ClientHintsChangeEvent extends Event {
  static eventName = "clienthintschange";
  constructor() {
    super(ClientHintsChangeEvent.eventName);
  }
}
export class ClientHintsSubmitEvent extends Event {
  static eventName = "clienthintssubmit";
  detail;
  constructor(value) {
    super(ClientHintsSubmitEvent.eventName);
    this.detail = { value };
  }
}
const DEFAULT_METADATA = {
  brands: [
    {
      brand: "",
      version: ""
    }
  ],
  fullVersion: "",
  platform: "",
  platformVersion: "",
  architecture: "",
  model: "",
  mobile: false
};
export class UserAgentClientHintsForm extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-user-agent-client-hints-form`;
  #shadow = this.attachShadow({ mode: "open" });
  #isFormOpened = false;
  #isFormDisabled = false;
  #metaData = DEFAULT_METADATA;
  #showMobileCheckbox = false;
  #showSubmitButton = false;
  #brandsModifiedAriaMessage = "";
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [Input.checkboxStyles, userAgentClientHintsFormStyles];
  }
  set value(data) {
    const { metaData = DEFAULT_METADATA, showMobileCheckbox = false, showSubmitButton = false } = data;
    this.#metaData = {
      ...this.#metaData,
      ...metaData
    };
    this.#showMobileCheckbox = showMobileCheckbox;
    this.#showSubmitButton = showSubmitButton;
    this.#render();
  }
  get value() {
    return {
      metaData: this.#metaData
    };
  }
  set disabled(disableForm) {
    this.#isFormDisabled = disableForm;
    this.#isFormOpened = false;
    this.#render();
  }
  get disabled() {
    return this.#isFormDisabled;
  }
  #handleTreeExpand = (event) => {
    if (event.code === "Space" || event.code === "Enter" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.stopPropagation();
      this.#handleTreeClick(event.code);
    }
  };
  #handleTreeClick = (key) => {
    if (this.#isFormDisabled) {
      return;
    }
    if (key === "ArrowLeft" && !this.#isFormOpened || key === "ArrowRight" && this.#isFormOpened) {
      return;
    }
    this.#isFormOpened = !this.#isFormOpened;
    this.#render();
  };
  #handleBrandInputChange = (value, index, brandInputType) => {
    const updatedBrands = this.#metaData.brands?.map((browserBrand, brandIndex) => {
      if (brandIndex === index) {
        const { brand, version } = browserBrand;
        if (brandInputType === "brandName") {
          return {
            brand: value,
            version
          };
        }
        return {
          brand,
          version: value
        };
      }
      return browserBrand;
    });
    this.#metaData = {
      ...this.#metaData,
      brands: updatedBrands
    };
    this.dispatchEvent(new ClientHintsChangeEvent());
    this.#render();
  };
  #handleBrandDelete = (index) => {
    const { brands = [] } = this.#metaData;
    brands.splice(index, 1);
    this.#metaData = {
      ...this.#metaData,
      brands
    };
    this.dispatchEvent(new ClientHintsChangeEvent());
    this.#brandsModifiedAriaMessage = i18nString(UIStrings.deletedBrand);
    this.#render();
    let nextFocusElement = this.shadowRoot?.getElementById(`brand-${index + 1}-input`);
    if (!nextFocusElement) {
      nextFocusElement = this.shadowRoot?.getElementById("add-brand-button");
    }
    nextFocusElement?.focus();
  };
  #handleAddBrandClick = () => {
    const { brands } = this.#metaData;
    this.#metaData = {
      ...this.#metaData,
      brands: [
        ...Array.isArray(brands) ? brands : [],
        {
          brand: "",
          version: ""
        }
      ]
    };
    this.dispatchEvent(new ClientHintsChangeEvent());
    this.#brandsModifiedAriaMessage = i18nString(UIStrings.addedBrand);
    this.#render();
    const brandInputElements = this.shadowRoot?.querySelectorAll(".brand-name-input");
    if (brandInputElements) {
      const lastBrandInputElement = Array.from(brandInputElements).pop();
      if (lastBrandInputElement) {
        lastBrandInputElement.focus();
      }
    }
  };
  #handleAddBrandKeyPress = (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      this.#handleAddBrandClick();
    }
  };
  #handleInputChange = (stateKey, value) => {
    if (stateKey in this.#metaData) {
      this.#metaData = {
        ...this.#metaData,
        [stateKey]: value
      };
      this.#render();
    }
    this.dispatchEvent(new ClientHintsChangeEvent());
  };
  #handleLinkPress = (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      event.target.click();
    }
  };
  #handleSubmit = (event) => {
    event.preventDefault();
    if (this.#showSubmitButton) {
      this.dispatchEvent(new ClientHintsSubmitEvent(this.#metaData));
      this.#render();
    }
  };
  #renderInputWithLabel(label, placeholder, value, stateKey) {
    const handleInputChange = (event) => {
      const value2 = event.target.value;
      this.#handleInputChange(stateKey, value2);
    };
    return LitHtml.html`
      <label class="full-row label input-field-label-container">
        ${label}
        <input
          class="input-field"
          type="text"
          @input=${handleInputChange}
          .value=${value}
          placeholder=${placeholder}
        />
      </label>
    `;
  }
  #renderPlatformSection() {
    const { platform, platformVersion } = this.#metaData;
    const handlePlatformNameChange = (event) => {
      const value = event.target.value;
      this.#handleInputChange("platform", value);
    };
    const handlePlatformVersionChange = (event) => {
      const value = event.target.value;
      this.#handleInputChange("platformVersion", value);
    };
    return LitHtml.html`
      <span class="full-row label">${i18nString(UIStrings.platformLabel)}</span>
      <div class="full-row brand-row" aria-label=${i18nString(UIStrings.platformProperties)} role="group">
        <input
          class="input-field half-row"
          type="text"
          @input=${handlePlatformNameChange}
          .value=${platform}
          placeholder=${i18nString(UIStrings.platformPlaceholder)}
          aria-label=${i18nString(UIStrings.platformLabel)}
        />
        <input
          class="input-field half-row"
          type="text"
          @input=${handlePlatformVersionChange}
          .value=${platformVersion}
          placeholder=${i18nString(UIStrings.platformVersion)}
          aria-label=${i18nString(UIStrings.platformVersion)}
        />
      </div>
    `;
  }
  #renderDeviceModelSection() {
    const { model, mobile } = this.#metaData;
    const handleDeviceModelChange = (event) => {
      const value = event.target.value;
      this.#handleInputChange("model", value);
    };
    const handleMobileChange = (event) => {
      const value = event.target.checked;
      this.#handleInputChange("mobile", value);
    };
    const mobileCheckboxInput = this.#showMobileCheckbox ? LitHtml.html`
      <label class="mobile-checkbox-container">
        <input type="checkbox" @input=${handleMobileChange} .checked=${mobile} />
        ${i18nString(UIStrings.mobileCheckboxLabel)}
      </label>
    ` : LitHtml.html``;
    return LitHtml.html`
      <span class="full-row label">${i18nString(UIStrings.deviceModel)}</span>
      <div class="full-row brand-row" aria-label=${i18nString(UIStrings.deviceProperties)} role="group">
        <input
          class="input-field ${this.#showMobileCheckbox ? "device-model-input" : "full-row"}"
          type="text"
          @input=${handleDeviceModelChange}
          .value=${model}
          placeholder=${i18nString(UIStrings.deviceModel)}
        />
        ${mobileCheckboxInput}
      </div>
    `;
  }
  #renderBrands() {
    const {
      brands = [
        {
          brand: "",
          version: ""
        }
      ]
    } = this.#metaData;
    const brandElements = brands.map((brandRow, index) => {
      const { brand, version } = brandRow;
      const handleDeleteClick = () => {
        this.#handleBrandDelete(index);
      };
      const handleKeyPress = (event) => {
        if (event.code === "Space" || event.code === "Enter") {
          event.preventDefault();
          handleDeleteClick();
        }
      };
      const handleBrandBrowserChange = (event) => {
        const value = event.target.value;
        this.#handleBrandInputChange(value, index, "brandName");
      };
      const handleBrandVersionChange = (event) => {
        const value = event.target.value;
        this.#handleBrandInputChange(value, index, "brandVersion");
      };
      return LitHtml.html`
        <div class="full-row brand-row" aria-label=${i18nString(UIStrings.brandProperties)} role="group">
          <input
            class="input-field brand-name-input"
            type="text"
            @input=${handleBrandBrowserChange}
            .value=${brand}
            id="brand-${index + 1}-input"
            placeholder=${i18nString(UIStrings.brandName)}
            aria-label=${i18nString(UIStrings.brandNameAriaLabel, {
        PH1: index + 1
      })}
          />
          <input
            class="input-field"
            type="text"
            @input=${handleBrandVersionChange}
            .value=${version}
            placeholder=${i18nString(UIStrings.version)}
            aria-label=${i18nString(UIStrings.brandVersionAriaLabel, {
        PH1: index + 1
      })}
          />
          <${IconButton.Icon.Icon.litTagName}
            .data=${{ color: "var(--client-hints-form-icon-color)", iconName: "trash_bin_icon", width: "10px", height: "14px" }}
            title=${i18nString(UIStrings.deleteTooltip)}
            class="delete-icon"
            tabindex="0"
            role="button"
            @click=${handleDeleteClick}
            @keypress=${handleKeyPress}
            aria-label=${i18nString(UIStrings.brandDeleteAriaLabel, {
        PH1: index + 1
      })}
          >
          </${IconButton.Icon.Icon.litTagName}>
        </div>
      `;
    });
    return LitHtml.html`
      <span class="full-row label">${i18nString(UIStrings.brands)}</span>
      ${brandElements}
      <div
        class="add-container full-row"
        role="button"
        tabindex="0"
        id="add-brand-button"
        aria-label=${i18nString(UIStrings.addBrand)}
        @click=${this.#handleAddBrandClick}
        @keypress=${this.#handleAddBrandKeyPress}
      >
        <${IconButton.Icon.Icon.litTagName}
          aria-hidden="true"
          .data=${{ color: "var(--client-hints-form-icon-color)", iconName: "add-icon", width: "10px" }}
        >
        </${IconButton.Icon.Icon.litTagName}>
        ${i18nString(UIStrings.addBrand)}
      </div>
    `;
  }
  #render() {
    const { fullVersion, architecture } = this.#metaData;
    const brandSection = this.#renderBrands();
    const fullBrowserInput = this.#renderInputWithLabel(i18nString(UIStrings.fullBrowserVersion), i18nString(UIStrings.fullBrowserVersionPlaceholder), fullVersion || "", "fullVersion");
    const platformSection = this.#renderPlatformSection();
    const architectureInput = this.#renderInputWithLabel(i18nString(UIStrings.architecture), i18nString(UIStrings.architecturePlaceholder), architecture, "architecture");
    const deviceModelSection = this.#renderDeviceModelSection();
    const submitButton = this.#showSubmitButton ? LitHtml.html`
      <${Buttons.Button.Button.litTagName}
        .variant=${Buttons.Button.Variant.SECONDARY}
        .type=${"submit"}
      >
        ${i18nString(UIStrings.update)}
      </${Buttons.Button.Button.litTagName}>
    ` : LitHtml.html``;
    const output = LitHtml.html`
      <section class="root">
        <div
          class="tree-title"
          role="button"
          @click=${this.#handleTreeClick}
          tabindex="0"
          @keydown=${this.#handleTreeExpand}
          aria-expanded=${this.#isFormOpened}
          aria-controls="form-container"
          @disabled=${this.#isFormDisabled}
          aria-disabled=${this.#isFormDisabled}
          aria-label=${i18nString(UIStrings.title)}
        >
          <${IconButton.Icon.Icon.litTagName}
            class=${this.#isFormOpened ? "" : "rotate-icon"}
            .data=${{ color: "var(--client-hints-form-icon-color)", iconName: "chromeSelect", width: "20px" }}
          >
          </${IconButton.Icon.Icon.litTagName}>
          ${i18nString(UIStrings.title)}
          <x-link
           tabindex="0"
           href="https://web.dev/user-agent-client-hints/"
           target="_blank"
           class="info-link"
           @keypress=${this.#handleLinkPress}
           aria-label=${i18nString(UIStrings.userAgentClientHintsInfo)}
          >
            <${IconButton.Icon.Icon.litTagName}
              .data=${{ color: "var(--client-hints-form-icon-color)", iconName: "ic_info_black_18dp", width: "14px" }}
            >
            </${IconButton.Icon.Icon.litTagName}>
          </x-link>
        </div>
        <form
          id="form-container"
          class="form-container ${this.#isFormOpened ? "" : "hide-container"}"
          @submit=${this.#handleSubmit}
        >
          ${brandSection}
          ${fullBrowserInput}
          ${platformSection}
          ${architectureInput}
          ${deviceModelSection}
          ${submitButton}
        </form>
        <div aria-live="polite" aria-label=${this.#brandsModifiedAriaMessage}></div>
      </section>
    `;
    LitHtml.render(output, this.#shadow, { host: this });
  }
  validate = () => {
    for (const [metaDataKey, metaDataValue] of Object.entries(this.#metaData)) {
      if (metaDataKey === "brands") {
        const isBrandValid = this.#metaData.brands?.every(({ brand, version }) => {
          const brandNameResult = EmulationUtils.UserAgentMetadata.validateAsStructuredHeadersString(brand, i18nString(UIStrings.notRepresentable));
          const brandVersionResult = EmulationUtils.UserAgentMetadata.validateAsStructuredHeadersString(version, i18nString(UIStrings.notRepresentable));
          return brandNameResult.valid && brandVersionResult.valid;
        });
        if (!isBrandValid) {
          return { valid: false, errorMessage: i18nString(UIStrings.notRepresentable) };
        }
      } else {
        const metaDataError = EmulationUtils.UserAgentMetadata.validateAsStructuredHeadersString(metaDataValue, i18nString(UIStrings.notRepresentable));
        if (!metaDataError.valid) {
          return metaDataError;
        }
      }
    }
    return { valid: true };
  };
}
ComponentHelpers.CustomElements.defineComponent("devtools-user-agent-client-hints-form", UserAgentClientHintsForm);
//# sourceMappingURL=UserAgentClientHintsForm.js.map
