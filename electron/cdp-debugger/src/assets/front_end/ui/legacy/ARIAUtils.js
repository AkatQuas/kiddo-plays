import * as Platform from "../../core/platform/platform.js";
let _id = 0;
export function nextId(prefix) {
  return (prefix || "") + ++_id;
}
export function bindLabelToControl(label, control) {
  const controlId = nextId("labelledControl");
  control.id = controlId;
  label.setAttribute("for", controlId);
}
export function markAsAlert(element) {
  element.setAttribute("role", "alert");
  element.setAttribute("aria-live", "polite");
}
export function markAsApplication(element) {
  element.setAttribute("role", "application");
}
export function markAsButton(element) {
  element.setAttribute("role", "button");
}
export function markAsCheckbox(element) {
  element.setAttribute("role", "checkbox");
}
export function markAsCombobox(element) {
  element.setAttribute("role", "combobox");
}
export function markAsModalDialog(element) {
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
}
export function markAsGroup(element) {
  element.setAttribute("role", "group");
}
export function markAsLink(element) {
  element.setAttribute("role", "link");
}
export function markAsMenuButton(element) {
  markAsButton(element);
  element.setAttribute("aria-haspopup", "true");
}
export function markAsProgressBar(element, min = 0, max = 100) {
  element.setAttribute("role", "progressbar");
  element.setAttribute("aria-valuemin", min.toString());
  element.setAttribute("aria-valuemax", max.toString());
}
export function markAsTab(element) {
  element.setAttribute("role", "tab");
}
export function markAsTablist(element) {
  element.setAttribute("role", "tablist");
}
export function markAsTabpanel(element) {
  element.setAttribute("role", "tabpanel");
}
export function markAsTree(element) {
  element.setAttribute("role", "tree");
}
export function markAsTreeitem(element) {
  element.setAttribute("role", "treeitem");
}
export function markAsTextBox(element) {
  element.setAttribute("role", "textbox");
}
export function markAsMenu(element) {
  element.setAttribute("role", "menu");
}
export function markAsMenuItem(element) {
  element.setAttribute("role", "menuitem");
}
export function markAsMenuItemCheckBox(element) {
  element.setAttribute("role", "menuitemcheckbox");
}
export function markAsMenuItemSubMenu(element) {
  markAsMenuItem(element);
  element.setAttribute("aria-haspopup", "true");
}
export function markAsList(element) {
  element.setAttribute("role", "list");
}
export function markAsListitem(element) {
  element.setAttribute("role", "listitem");
}
export function markAsMain(element) {
  element.setAttribute("role", "main");
}
export function markAsComplementary(element) {
  element.setAttribute("role", "complementary");
}
export function markAsNavigation(element) {
  element.setAttribute("role", "navigation");
}
export function markAsListBox(element) {
  element.setAttribute("role", "listbox");
}
export function markAsMultiSelectable(element) {
  element.setAttribute("aria-multiselectable", "true");
}
export function markAsOption(element) {
  element.setAttribute("role", "option");
}
export function markAsRadioGroup(element) {
  element.setAttribute("role", "radiogroup");
}
export function markAsHidden(element) {
  element.setAttribute("aria-hidden", "true");
}
export function markAsSlider(element, min = 0, max = 100) {
  element.setAttribute("role", "slider");
  element.setAttribute("aria-valuemin", String(min));
  element.setAttribute("aria-valuemax", String(max));
}
export function markAsHeading(element, level) {
  element.setAttribute("role", "heading");
  element.setAttribute("aria-level", level.toString());
}
export function markAsPoliteLiveRegion(element, isAtomic) {
  element.setAttribute("aria-live", "polite");
  if (isAtomic) {
    element.setAttribute("aria-atomic", "true");
  }
}
export function markAsLog(element) {
  element.setAttribute("role", "log");
}
export function hasRole(element) {
  return element.hasAttribute("role");
}
export function removeRole(element) {
  element.removeAttribute("role");
}
export function setPlaceholder(element, placeholder) {
  if (placeholder) {
    element.setAttribute("aria-placeholder", placeholder);
  } else {
    element.removeAttribute("aria-placeholder");
  }
}
export function markAsPresentation(element) {
  element.setAttribute("role", "presentation");
}
export function markAsStatus(element) {
  element.setAttribute("role", "status");
}
export function ensureId(element) {
  if (!element.id) {
    element.id = nextId("ariaElement");
  }
}
export function setAriaValueText(element, valueText) {
  element.setAttribute("aria-valuetext", valueText);
}
export function setAriaValueNow(element, value) {
  element.setAttribute("aria-valuenow", value);
}
export function setAriaValueMinMax(element, min, max) {
  element.setAttribute("aria-valuemin", min);
  element.setAttribute("aria-valuemax", max);
}
export function setControls(element, controlledElement) {
  if (!controlledElement) {
    element.removeAttribute("aria-controls");
    return;
  }
  ensureId(controlledElement);
  element.setAttribute("aria-controls", controlledElement.id);
}
export function setChecked(element, value) {
  element.setAttribute("aria-checked", Boolean(value).toString());
}
export function setCheckboxAsIndeterminate(element) {
  element.setAttribute("aria-checked", "mixed");
}
export function setDisabled(element, value) {
  element.setAttribute("aria-disabled", Boolean(value).toString());
}
export function setExpanded(element, value) {
  element.setAttribute("aria-expanded", Boolean(value).toString());
}
export function unsetExpandable(element) {
  element.removeAttribute("aria-expanded");
}
export function setHidden(element, value) {
  element.setAttribute("aria-hidden", Boolean(value).toString());
}
export function setLevel(element, level) {
  element.setAttribute("aria-level", level.toString());
}
export var AutocompleteInteractionModel = /* @__PURE__ */ ((AutocompleteInteractionModel2) => {
  AutocompleteInteractionModel2["inline"] = "inline";
  AutocompleteInteractionModel2["list"] = "list";
  AutocompleteInteractionModel2["both"] = "both";
  AutocompleteInteractionModel2["none"] = "none";
  return AutocompleteInteractionModel2;
})(AutocompleteInteractionModel || {});
export function setAutocomplete(element, interactionModel = "none" /* none */) {
  element.setAttribute("aria-autocomplete", interactionModel);
}
export function clearAutocomplete(element) {
  element.removeAttribute("aria-autocomplete");
}
export var PopupRole = /* @__PURE__ */ ((PopupRole2) => {
  PopupRole2["False"] = "false";
  PopupRole2["True"] = "true";
  PopupRole2["Menu"] = "menu";
  PopupRole2["ListBox"] = "listbox";
  PopupRole2["Tree"] = "tree";
  PopupRole2["Grid"] = "grid";
  PopupRole2["Dialog"] = "dialog";
  return PopupRole2;
})(PopupRole || {});
export function setHasPopup(element, value = "false" /* False */) {
  if (value !== "false" /* False */) {
    element.setAttribute("aria-haspopup", value);
  } else {
    element.removeAttribute("aria-haspopup");
  }
}
export function setSelected(element, value) {
  element.setAttribute("aria-selected", Boolean(value).toString());
}
export function clearSelected(element) {
  element.removeAttribute("aria-selected");
}
export function setInvalid(element, value) {
  if (value) {
    element.setAttribute("aria-invalid", value.toString());
  } else {
    element.removeAttribute("aria-invalid");
  }
}
export function setPressed(element, value) {
  element.setAttribute("aria-pressed", Boolean(value).toString());
}
export function setValueNow(element, value) {
  element.setAttribute("aria-valuenow", value.toString());
}
export function setValueText(element, value) {
  element.setAttribute("aria-valuetext", value.toString());
}
export function setProgressBarValue(element, valueNow, valueText) {
  element.setAttribute("aria-valuenow", valueNow.toString());
  if (valueText) {
    element.setAttribute("aria-valuetext", valueText);
  }
}
export function setAccessibleName(element, name) {
  element.setAttribute("aria-label", name);
}
const _descriptionMap = /* @__PURE__ */ new WeakMap();
export function setDescription(element, description) {
  const oldDescription = _descriptionMap.get(element);
  if (oldDescription) {
    oldDescription.remove();
  }
  element.removeAttribute("data-aria-utils-animation-hack");
  if (!description) {
    _descriptionMap.delete(element);
    element.removeAttribute("aria-describedby");
    return;
  }
  const descriptionElement = document.createElement("span");
  descriptionElement.textContent = description;
  descriptionElement.style.display = "none";
  ensureId(descriptionElement);
  element.setAttribute("aria-describedby", descriptionElement.id);
  _descriptionMap.set(element, descriptionElement);
  const contentfulVoidTags = /* @__PURE__ */ new Set(["INPUT", "IMG"]);
  if (!contentfulVoidTags.has(element.tagName)) {
    element.appendChild(descriptionElement);
    return;
  }
  const inserted = element.insertAdjacentElement("afterend", descriptionElement);
  if (inserted) {
    return;
  }
  element.setAttribute("data-aria-utils-animation-hack", "sorry");
  element.addEventListener("animationend", () => {
    if (_descriptionMap.get(element) !== descriptionElement) {
      return;
    }
    element.removeAttribute("data-aria-utils-animation-hack");
    element.insertAdjacentElement("afterend", descriptionElement);
  }, { once: true });
}
export function setActiveDescendant(element, activedescendant) {
  if (!activedescendant) {
    element.removeAttribute("aria-activedescendant");
    return;
  }
  if (activedescendant.isConnected && element.isConnected) {
    console.assert(element.hasSameShadowRoot(activedescendant), "elements are not in the same shadow dom");
  }
  ensureId(activedescendant);
  element.setAttribute("aria-activedescendant", activedescendant.id);
}
export function setSetSize(element, size) {
  element.setAttribute("aria-setsize", size.toString());
}
export function setPositionInSet(element, position) {
  element.setAttribute("aria-posinset", position.toString());
}
function hideFromLayout(element) {
  element.style.position = "absolute";
  element.style.left = "-999em";
  element.style.width = "100em";
  element.style.overflow = "hidden";
}
let alertElementOne;
let alertElementTwo;
let alertToggle = false;
export function alertElementInstance() {
  if (!alertElementOne) {
    const element = document.body.createChild("div");
    hideFromLayout(element);
    element.setAttribute("role", "alert");
    element.setAttribute("aria-atomic", "true");
    alertElementOne = element;
  }
  if (!alertElementTwo) {
    const element = document.body.createChild("div");
    hideFromLayout(element);
    element.setAttribute("role", "alert");
    element.setAttribute("aria-atomic", "true");
    alertElementTwo = element;
  }
  alertToggle = !alertToggle;
  if (alertToggle) {
    alertElementTwo.textContent = "";
    return alertElementOne;
  }
  alertElementOne.textContent = "";
  return alertElementTwo;
}
export function alert(message) {
  const element = alertElementInstance();
  element.textContent = Platform.StringUtilities.trimEndWithMaxLength(message, 1e4);
}
//# sourceMappingURL=ARIAUtils.js.map
