import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import locationsSettingsTabStyles from "./locationsSettingsTab.css.js";
let locationsSettingsTabInstance;
const UIStrings = {
  customLocations: "Custom locations",
  locationName: "Location name",
  lat: "Lat",
  long: "Long",
  timezoneId: "Timezone ID",
  locale: "Locale",
  latitude: "Latitude",
  longitude: "Longitude",
  locationNameCannotBeEmpty: "Location name cannot be empty",
  locationNameMustBeLessThanS: "Location name must be less than {PH1} characters",
  latitudeMustBeANumber: "Latitude must be a number",
  latitudeMustBeGreaterThanOrEqual: "Latitude must be greater than or equal to {PH1}",
  latitudeMustBeLessThanOrEqualToS: "Latitude must be less than or equal to {PH1}",
  longitudeMustBeANumber: "Longitude must be a number",
  longitudeMustBeGreaterThanOr: "Longitude must be greater than or equal to {PH1}",
  longitudeMustBeLessThanOrEqualTo: "Longitude must be less than or equal to {PH1}",
  timezoneIdMustContainAlphabetic: "Timezone ID must contain alphabetic characters",
  localeMustContainAlphabetic: "Locale must contain alphabetic characters",
  addLocation: "Add location..."
};
const str_ = i18n.i18n.registerUIStrings("panels/sensors/LocationsSettingsTab.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class LocationsSettingsTab extends UI.Widget.VBox {
  list;
  customSetting;
  editor;
  constructor() {
    super(true);
    this.contentElement.createChild("div", "header").textContent = i18nString(UIStrings.customLocations);
    const addButton = UI.UIUtils.createTextButton(i18nString(UIStrings.addLocation), this.addButtonClicked.bind(this), "add-locations-button");
    this.contentElement.appendChild(addButton);
    this.list = new UI.ListWidget.ListWidget(this);
    this.list.element.classList.add("locations-list");
    this.list.show(this.contentElement);
    this.customSetting = Common.Settings.Settings.instance().moduleSetting("emulation.locations");
    const list = this.customSetting.get().map((location) => replaceLocationTitles(location, this.customSetting.defaultValue));
    function replaceLocationTitles(location, defaultValues) {
      if (!location.title) {
        const replacement = defaultValues.find((defaultLocation) => defaultLocation.lat === location.lat && defaultLocation.long === location.long && defaultLocation.timezoneId === location.timezoneId && defaultLocation.locale === location.locale);
        if (!replacement) {
          console.error("Could not determine a location setting title");
        } else {
          return replacement;
        }
      }
      return location;
    }
    this.customSetting.set(list);
    this.customSetting.addChangeListener(this.locationsUpdated, this);
    this.setDefaultFocusedElement(addButton);
  }
  static instance() {
    if (!locationsSettingsTabInstance) {
      locationsSettingsTabInstance = new LocationsSettingsTab();
    }
    return locationsSettingsTabInstance;
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([locationsSettingsTabStyles]);
    this.list.registerCSSFiles([locationsSettingsTabStyles]);
    this.locationsUpdated();
  }
  locationsUpdated() {
    this.list.clear();
    const conditions = this.customSetting.get();
    for (const condition of conditions) {
      this.list.appendItem(condition, true);
    }
    this.list.appendSeparator();
  }
  addButtonClicked() {
    this.list.addNewItem(this.customSetting.get().length, { title: "", lat: 0, long: 0, timezoneId: "", locale: "" });
  }
  renderItem(location, _editable) {
    const element = document.createElement("div");
    element.classList.add("locations-list-item");
    const title = element.createChild("div", "locations-list-text locations-list-title");
    const titleText = title.createChild("div", "locations-list-title-text");
    titleText.textContent = location.title;
    UI.Tooltip.Tooltip.install(titleText, location.title);
    element.createChild("div", "locations-list-separator");
    element.createChild("div", "locations-list-text").textContent = String(location.lat);
    element.createChild("div", "locations-list-separator");
    element.createChild("div", "locations-list-text").textContent = String(location.long);
    element.createChild("div", "locations-list-separator");
    element.createChild("div", "locations-list-text").textContent = location.timezoneId;
    element.createChild("div", "locations-list-separator");
    element.createChild("div", "locations-list-text").textContent = location.locale;
    return element;
  }
  removeItemRequested(item, index) {
    const list = this.customSetting.get();
    list.splice(index, 1);
    this.customSetting.set(list);
  }
  commitEdit(location, editor, isNew) {
    location.title = editor.control("title").value.trim();
    const lat = editor.control("lat").value.trim();
    location.lat = lat ? parseFloat(lat) : 0;
    const long = editor.control("long").value.trim();
    location.long = long ? parseFloat(long) : 0;
    const timezoneId = editor.control("timezoneId").value.trim();
    location.timezoneId = timezoneId;
    const locale = editor.control("locale").value.trim();
    location.locale = locale;
    const list = this.customSetting.get();
    if (isNew) {
      list.push(location);
    }
    this.customSetting.set(list);
  }
  beginEdit(location) {
    const editor = this.createEditor();
    editor.control("title").value = location.title;
    editor.control("lat").value = String(location.lat);
    editor.control("long").value = String(location.long);
    editor.control("timezoneId").value = location.timezoneId;
    editor.control("locale").value = location.locale;
    return editor;
  }
  createEditor() {
    if (this.editor) {
      return this.editor;
    }
    const editor = new UI.ListWidget.Editor();
    this.editor = editor;
    const content = editor.contentElement();
    const titles = content.createChild("div", "locations-edit-row");
    titles.createChild("div", "locations-list-text locations-list-title").textContent = i18nString(UIStrings.locationName);
    titles.createChild("div", "locations-list-separator locations-list-separator-invisible");
    titles.createChild("div", "locations-list-text").textContent = i18nString(UIStrings.lat);
    titles.createChild("div", "locations-list-separator locations-list-separator-invisible");
    titles.createChild("div", "locations-list-text").textContent = i18nString(UIStrings.long);
    titles.createChild("div", "locations-list-separator locations-list-separator-invisible");
    titles.createChild("div", "locations-list-text").textContent = i18nString(UIStrings.timezoneId);
    titles.createChild("div", "locations-list-separator locations-list-separator-invisible");
    titles.createChild("div", "locations-list-text").textContent = i18nString(UIStrings.locale);
    const fields = content.createChild("div", "locations-edit-row");
    fields.createChild("div", "locations-list-text locations-list-title locations-input-container").appendChild(editor.createInput("title", "text", i18nString(UIStrings.locationName), titleValidator));
    fields.createChild("div", "locations-list-separator locations-list-separator-invisible");
    let cell = fields.createChild("div", "locations-list-text locations-input-container");
    cell.appendChild(editor.createInput("lat", "text", i18nString(UIStrings.latitude), latValidator));
    fields.createChild("div", "locations-list-separator locations-list-separator-invisible");
    cell = fields.createChild("div", "locations-list-text locations-list-text-longitude locations-input-container");
    cell.appendChild(editor.createInput("long", "text", i18nString(UIStrings.longitude), longValidator));
    fields.createChild("div", "locations-list-separator locations-list-separator-invisible");
    cell = fields.createChild("div", "locations-list-text locations-input-container");
    cell.appendChild(editor.createInput("timezoneId", "text", i18nString(UIStrings.timezoneId), timezoneIdValidator));
    fields.createChild("div", "locations-list-separator locations-list-separator-invisible");
    cell = fields.createChild("div", "locations-list-text locations-input-container");
    cell.appendChild(editor.createInput("locale", "text", i18nString(UIStrings.locale), localeValidator));
    return editor;
    function titleValidator(item, index, input) {
      const maxLength = 50;
      const value = input.value.trim();
      let errorMessage;
      if (!value.length) {
        errorMessage = i18nString(UIStrings.locationNameCannotBeEmpty);
      } else if (value.length > maxLength) {
        errorMessage = i18nString(UIStrings.locationNameMustBeLessThanS, { PH1: maxLength });
      }
      if (errorMessage) {
        return { valid: false, errorMessage };
      }
      return { valid: true, errorMessage: void 0 };
    }
    function latValidator(item, index, input) {
      const minLat = -90;
      const maxLat = 90;
      const value = input.value.trim();
      const parsedValue = Number(value);
      if (!value) {
        return { valid: true, errorMessage: void 0 };
      }
      let errorMessage;
      if (Number.isNaN(parsedValue)) {
        errorMessage = i18nString(UIStrings.latitudeMustBeANumber);
      } else if (parseFloat(value) < minLat) {
        errorMessage = i18nString(UIStrings.latitudeMustBeGreaterThanOrEqual, { PH1: minLat });
      } else if (parseFloat(value) > maxLat) {
        errorMessage = i18nString(UIStrings.latitudeMustBeLessThanOrEqualToS, { PH1: maxLat });
      }
      if (errorMessage) {
        return { valid: false, errorMessage };
      }
      return { valid: true, errorMessage: void 0 };
    }
    function longValidator(item, index, input) {
      const minLong = -180;
      const maxLong = 180;
      const value = input.value.trim();
      const parsedValue = Number(value);
      if (!value) {
        return { valid: true, errorMessage: void 0 };
      }
      let errorMessage;
      if (Number.isNaN(parsedValue)) {
        errorMessage = i18nString(UIStrings.longitudeMustBeANumber);
      } else if (parseFloat(value) < minLong) {
        errorMessage = i18nString(UIStrings.longitudeMustBeGreaterThanOr, { PH1: minLong });
      } else if (parseFloat(value) > maxLong) {
        errorMessage = i18nString(UIStrings.longitudeMustBeLessThanOrEqualTo, { PH1: maxLong });
      }
      if (errorMessage) {
        return { valid: false, errorMessage };
      }
      return { valid: true, errorMessage: void 0 };
    }
    function timezoneIdValidator(item, index, input) {
      const value = input.value.trim();
      if (value === "" || /[a-zA-Z]/.test(value)) {
        return { valid: true, errorMessage: void 0 };
      }
      const errorMessage = i18nString(UIStrings.timezoneIdMustContainAlphabetic);
      return { valid: false, errorMessage };
    }
    function localeValidator(item, index, input) {
      const value = input.value.trim();
      if (value === "" || /[a-zA-Z]{2}/.test(value)) {
        return { valid: true, errorMessage: void 0 };
      }
      const errorMessage = i18nString(UIStrings.localeMustContainAlphabetic);
      return { valid: false, errorMessage };
    }
  }
}
//# sourceMappingURL=LocationsSettingsTab.js.map
