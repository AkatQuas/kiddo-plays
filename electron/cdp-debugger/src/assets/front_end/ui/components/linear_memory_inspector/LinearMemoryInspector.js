import * as Common from "../../../core/common/common.js";
import * as LitHtml from "../../lit-html/lit-html.js";
import * as ComponentHelpers from "../helpers/helpers.js";
import linearMemoryInspectorStyles from "./linearMemoryInspector.css.js";
const { render, html } = LitHtml;
import { Mode, Navigation, LinearMemoryNavigator } from "./LinearMemoryNavigator.js";
import { LinearMemoryValueInterpreter } from "./LinearMemoryValueInterpreter.js";
import {
  VALUE_INTEPRETER_MAX_NUM_BYTES,
  Endianness,
  getDefaultValueTypeMapping
} from "./ValueInterpreterDisplayUtils.js";
import { formatAddress, parseAddress } from "./LinearMemoryInspectorUtils.js";
import { LinearMemoryViewer } from "./LinearMemoryViewer.js";
import * as i18n from "../../../core/i18n/i18n.js";
const UIStrings = {
  addressHasToBeANumberBetweenSAnd: "Address has to be a number between {PH1} and {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("ui/components/linear_memory_inspector/LinearMemoryInspector.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class MemoryRequestEvent extends Event {
  static eventName = "memoryrequest";
  data;
  constructor(start, end, address) {
    super(MemoryRequestEvent.eventName);
    this.data = { start, end, address };
  }
}
export class AddressChangedEvent extends Event {
  static eventName = "addresschanged";
  data;
  constructor(address) {
    super(AddressChangedEvent.eventName);
    this.data = address;
  }
}
export class SettingsChangedEvent extends Event {
  static eventName = "settingschanged";
  data;
  constructor(settings) {
    super(SettingsChangedEvent.eventName);
    this.data = settings;
  }
}
class AddressHistoryEntry {
  #address = 0;
  #callback;
  constructor(address, callback) {
    if (address < 0) {
      throw new Error("Address should be a greater or equal to zero");
    }
    this.#address = address;
    this.#callback = callback;
  }
  valid() {
    return true;
  }
  reveal() {
    this.#callback(this.#address);
  }
}
export class LinearMemoryInspector extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-linear-memory-inspector-inspector`;
  #shadow = this.attachShadow({ mode: "open" });
  #history = new Common.SimpleHistoryManager.SimpleHistoryManager(10);
  #memory = new Uint8Array();
  #memoryOffset = 0;
  #outerMemoryLength = 0;
  #address = -1;
  #currentNavigatorMode = Mode.Submitted;
  #currentNavigatorAddressLine = `${this.#address}`;
  #numBytesPerPage = 4;
  #valueTypeModes = getDefaultValueTypeMapping();
  #valueTypes = new Set(this.#valueTypeModes.keys());
  #endianness = Endianness.Little;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [linearMemoryInspectorStyles];
  }
  set data(data) {
    if (data.address < data.memoryOffset || data.address > data.memoryOffset + data.memory.length || data.address < 0) {
      throw new Error("Address is out of bounds.");
    }
    if (data.memoryOffset < 0) {
      throw new Error("Memory offset has to be greater or equal to zero.");
    }
    this.#memory = data.memory;
    this.#memoryOffset = data.memoryOffset;
    this.#outerMemoryLength = data.outerMemoryLength;
    this.#valueTypeModes = data.valueTypeModes || this.#valueTypeModes;
    this.#valueTypes = data.valueTypes || this.#valueTypes;
    this.#endianness = data.endianness || this.#endianness;
    this.#setAddress(data.address);
    this.#render();
  }
  #render() {
    const { start, end } = this.#getPageRangeForAddress(this.#address, this.#numBytesPerPage);
    const navigatorAddressToShow = this.#currentNavigatorMode === Mode.Submitted ? formatAddress(this.#address) : this.#currentNavigatorAddressLine;
    const navigatorAddressIsValid = this.#isValidAddress(navigatorAddressToShow);
    const invalidAddressMsg = i18nString(UIStrings.addressHasToBeANumberBetweenSAnd, { PH1: formatAddress(0), PH2: formatAddress(this.#outerMemoryLength) });
    const errorMsg = navigatorAddressIsValid ? void 0 : invalidAddressMsg;
    const canGoBackInHistory = this.#history.canRollback();
    const canGoForwardInHistory = this.#history.canRollover();
    render(html`
      <div class="view">
        <${LinearMemoryNavigator.litTagName}
          .data=${{ address: navigatorAddressToShow, valid: navigatorAddressIsValid, mode: this.#currentNavigatorMode, error: errorMsg, canGoBackInHistory, canGoForwardInHistory }}
          @refreshrequested=${this.#onRefreshRequest}
          @addressinputchanged=${this.#onAddressChange}
          @pagenavigation=${this.#navigatePage}
          @historynavigation=${this.#navigateHistory}></${LinearMemoryNavigator.litTagName}>
        <${LinearMemoryViewer.litTagName}
          .data=${{ memory: this.#memory.slice(start - this.#memoryOffset, end - this.#memoryOffset), address: this.#address, memoryOffset: start, focus: this.#currentNavigatorMode === Mode.Submitted }}
          @byteselected=${this.#onByteSelected}
          @resize=${this.#resize}>
        </${LinearMemoryViewer.litTagName}>
      </div>
      <div class="value-interpreter">
        <${LinearMemoryValueInterpreter.litTagName}
          .data=${{
      value: this.#memory.slice(this.#address - this.#memoryOffset, this.#address + VALUE_INTEPRETER_MAX_NUM_BYTES).buffer,
      valueTypes: this.#valueTypes,
      valueTypeModes: this.#valueTypeModes,
      endianness: this.#endianness,
      memoryLength: this.#outerMemoryLength
    }}
          @valuetypetoggled=${this.#onValueTypeToggled}
          @valuetypemodechanged=${this.#onValueTypeModeChanged}
          @endiannesschanged=${this.#onEndiannessChanged}
          @jumptopointeraddress=${this.#onJumpToPointerAddress}
          >
        </${LinearMemoryValueInterpreter.litTagName}/>
      </div>
      `, this.#shadow, {
      host: this
    });
  }
  #onJumpToPointerAddress(e) {
    e.stopPropagation();
    this.#currentNavigatorMode = Mode.Submitted;
    const addressInRange = Math.max(0, Math.min(e.data, this.#outerMemoryLength - 1));
    this.#jumpToAddress(addressInRange);
  }
  #onRefreshRequest() {
    const { start, end } = this.#getPageRangeForAddress(this.#address, this.#numBytesPerPage);
    this.dispatchEvent(new MemoryRequestEvent(start, end, this.#address));
  }
  #onByteSelected(e) {
    this.#currentNavigatorMode = Mode.Submitted;
    const addressInRange = Math.max(0, Math.min(e.data, this.#outerMemoryLength - 1));
    this.#jumpToAddress(addressInRange);
  }
  #createSettings() {
    return { valueTypes: this.#valueTypes, modes: this.#valueTypeModes, endianness: this.#endianness };
  }
  #onEndiannessChanged(e) {
    this.#endianness = e.data;
    this.dispatchEvent(new SettingsChangedEvent(this.#createSettings()));
    this.#render();
  }
  #isValidAddress(address) {
    const newAddress = parseAddress(address);
    return newAddress !== void 0 && newAddress >= 0 && newAddress < this.#outerMemoryLength;
  }
  #onAddressChange(e) {
    const { address, mode } = e.data;
    const isValid = this.#isValidAddress(address);
    const newAddress = parseAddress(address);
    this.#currentNavigatorAddressLine = address;
    if (newAddress !== void 0 && isValid) {
      this.#currentNavigatorMode = mode;
      this.#jumpToAddress(newAddress);
      return;
    }
    if (mode === Mode.Submitted && !isValid) {
      this.#currentNavigatorMode = Mode.InvalidSubmit;
    } else {
      this.#currentNavigatorMode = Mode.Edit;
    }
    this.#render();
  }
  #onValueTypeToggled(e) {
    const { type, checked } = e.data;
    if (checked) {
      this.#valueTypes.add(type);
    } else {
      this.#valueTypes.delete(type);
    }
    this.dispatchEvent(new SettingsChangedEvent(this.#createSettings()));
    this.#render();
  }
  #onValueTypeModeChanged(e) {
    e.stopImmediatePropagation();
    const { type, mode } = e.data;
    this.#valueTypeModes.set(type, mode);
    this.dispatchEvent(new SettingsChangedEvent(this.#createSettings()));
    this.#render();
  }
  #navigateHistory(e) {
    return e.data === Navigation.Forward ? this.#history.rollover() : this.#history.rollback();
  }
  #navigatePage(e) {
    const newAddress = e.data === Navigation.Forward ? this.#address + this.#numBytesPerPage : this.#address - this.#numBytesPerPage;
    const addressInRange = Math.max(0, Math.min(newAddress, this.#outerMemoryLength - 1));
    this.#jumpToAddress(addressInRange);
  }
  #jumpToAddress(address) {
    if (address < 0 || address >= this.#outerMemoryLength) {
      console.warn(`Specified address is out of bounds: ${address}`);
      return;
    }
    this.#setAddress(address);
    this.#update();
  }
  #getPageRangeForAddress(address, numBytesPerPage) {
    const pageNumber = Math.floor(address / numBytesPerPage);
    const pageStartAddress = pageNumber * numBytesPerPage;
    const pageEndAddress = Math.min(pageStartAddress + numBytesPerPage, this.#outerMemoryLength);
    return { start: pageStartAddress, end: pageEndAddress };
  }
  #resize(event) {
    this.#numBytesPerPage = event.data;
    this.#update();
  }
  #update() {
    const { start, end } = this.#getPageRangeForAddress(this.#address, this.#numBytesPerPage);
    if (start < this.#memoryOffset || end > this.#memoryOffset + this.#memory.length) {
      this.dispatchEvent(new MemoryRequestEvent(start, end, this.#address));
    } else {
      this.#render();
    }
  }
  #setAddress(address) {
    if (this.#address === address) {
      return;
    }
    const historyEntry = new AddressHistoryEntry(address, () => this.#jumpToAddress(address));
    this.#history.push(historyEntry);
    this.#address = address;
    this.dispatchEvent(new AddressChangedEvent(this.#address));
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-linear-memory-inspector-inspector", LinearMemoryInspector);
//# sourceMappingURL=LinearMemoryInspector.js.map
