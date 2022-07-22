import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  disabled: "Disabled",
  ifTrueThisElementCurrentlyCannot: "If true, this element currently cannot be interacted with.",
  invalidUserEntry: "Invalid user entry",
  ifTrueThisElementsUserentered: "If true, this element's user-entered value does not conform to validation requirement.",
  editable: "Editable",
  ifAndHowThisElementCanBeEdited: "If and how this element can be edited.",
  focusable: "Focusable",
  ifTrueThisElementCanReceiveFocus: "If true, this element can receive focus.",
  focused: "Focused",
  ifTrueThisElementCurrentlyHas: "If `true`, this element currently has focus.",
  canSetValue: "Can set value",
  whetherTheValueOfThisElementCan: "Whether the value of this element can be set.",
  liveRegion: "Live region",
  whetherAndWhatPriorityOfLive: "Whether and what priority of live updates may be expected for this element.",
  atomicLiveRegions: "Atomic (live regions)",
  ifThisElementMayReceiveLive: "If this element may receive live updates, whether the entire live region should be presented to the user on changes, or only changed nodes.",
  relevantLiveRegions: "Relevant (live regions)",
  ifThisElementMayReceiveLiveUpdates: "If this element may receive live updates, what type of updates should trigger a notification.",
  busyLiveRegions: "`Busy` (live regions)",
  whetherThisElementOrItsSubtree: "Whether this element or its subtree are currently being updated (and thus may be in an inconsistent state).",
  liveRegionRoot: "Live region root",
  ifThisElementMayReceiveLiveUpdatesThe: "If this element may receive live updates, the root element of the containing live region.",
  hasAutocomplete: "Has autocomplete",
  whetherAndWhatTypeOfAutocomplete: "Whether and what type of autocomplete suggestions are currently provided by this element.",
  hasPopup: "Has popup",
  whetherThisElementHasCausedSome: "Whether this element has caused some kind of pop-up (such as a menu) to appear.",
  level: "Level",
  theHierarchicalLevelOfThis: "The hierarchical level of this element.",
  multiselectable: "Multi-selectable",
  whetherAUserMaySelectMoreThanOne: "Whether a user may select more than one option from this widget.",
  orientation: "Orientation",
  whetherThisLinearElements: "Whether this linear element's orientation is horizontal or vertical.",
  multiline: "Multi-line",
  whetherThisTextBoxMayHaveMore: "Whether this text box may have more than one line.",
  readonlyString: "Read-only",
  ifTrueThisElementMayBeInteracted: "If true, this element may be interacted with, but its value cannot be changed.",
  requiredString: "Required",
  whetherThisElementIsARequired: "Whether this element is a required field in a form.",
  minimumValue: "Minimum value",
  forARangeWidgetTheMinimumAllowed: "For a range widget, the minimum allowed value.",
  maximumValue: "Maximum value",
  forARangeWidgetTheMaximumAllowed: "For a range widget, the maximum allowed value.",
  valueDescription: "Value description",
  aHumanreadableVersionOfTheValue: "A human-readable version of the value of a range widget (where necessary).",
  checked: "Checked",
  whetherThisCheckboxRadioButtonOr: "Whether this checkbox, radio button or tree item is checked, unchecked, or mixed (e.g. has both checked and un-checked children).",
  expanded: "Expanded",
  whetherThisElementOrAnother: "Whether this element, or another grouping element it controls, is expanded.",
  pressed: "Pressed",
  whetherThisToggleButtonIs: "Whether this toggle button is currently in a pressed state.",
  selectedString: "Selected",
  whetherTheOptionRepresentedBy: "Whether the option represented by this element is currently selected.",
  activeDescendant: "Active descendant",
  theDescendantOfThisElementWhich: "The descendant of this element which is active; i.e. the element to which focus should be delegated.",
  elementToWhichTheUserMayChooseTo: "Element to which the user may choose to navigate after this one, instead of the next element in the DOM order.",
  controls: "Controls",
  elementOrElementsWhoseContentOr: "Element or elements whose content or presence is/are controlled by this widget.",
  describedBy: "Described by",
  elementOrElementsWhichFormThe: "Element or elements which form the description of this element.",
  labeledBy: "Labeled by",
  elementOrElementsWhichMayFormThe: "Element or elements which may form the name of this element.",
  elementOrElementsWhichShouldBe: "Element or elements which should be considered descendants of this element, despite not being descendants in the DOM.",
  theComputedNameOfThisElement: "The computed name of this element.",
  role: "Role",
  indicatesThePurposeOfThisElement: "Indicates the purpose of this element, such as a user interface idiom for a widget, or structural role within a document.",
  value: "Value",
  theValueOfThisElementThisMayBe: "The value of this element; this may be user-provided or developer-provided, depending on the element.",
  help: "Help",
  theComputedHelpTextForThis: "The computed help text for this element.",
  description: "Description",
  theAccessibleDescriptionForThis: "The accessible description for this element.",
  fromAttribute: "From attribute",
  valueFromAttribute: "Value from attribute.",
  implicit: "Implicit",
  implicitValue: "Implicit value.",
  fromStyle: "From style",
  valueFromStyle: "Value from style.",
  contents: "Contents",
  valueFromElementContents: "Value from element contents.",
  fromPlaceholderAttribute: "From placeholder attribute",
  valueFromPlaceholderAttribute: "Value from placeholder attribute.",
  relatedElement: "Related element",
  valueFromRelatedElement: "Value from related element.",
  fromCaption: "From `caption`",
  valueFromFigcaptionElement: "Value from `figcaption` element.",
  fromDescription: "From `description`",
  valueFromDescriptionElement: "Value from `description` element.",
  fromLabel: "From `label`",
  valueFromLabelElement: "Value from `label` element.",
  fromLabelFor: "From `label` (`for=` attribute)",
  valueFromLabelElementWithFor: "Value from `label` element with `for=` attribute.",
  fromLabelWrapped: "From `label` (wrapped)",
  valueFromLabelElementWrapped: "Value from a wrapping `label` element.",
  fromLegend: "From `legend`",
  valueFromLegendElement: "Value from `legend` element.",
  fromRubyAnnotation: "From ruby annotation",
  valueFromNativeHtmlRuby: "Value from plain HTML ruby annotation.",
  valueFromTableCaption: "Value from `table` `caption`.",
  fromTitle: "From title",
  valueFromTitleAttribute: "Value from title attribute.",
  fromNativeHtml: "From native HTML",
  valueFromNativeHtmlUnknownSource: "Value from native HTML (unknown source)."
};
const str_ = i18n.i18n.registerUIStrings("panels/accessibility/AccessibilityStrings.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export const AXAttributes = {
  "disabled": {
    name: i18nLazyString(UIStrings.disabled),
    description: i18nLazyString(UIStrings.ifTrueThisElementCurrentlyCannot),
    group: "AXGlobalStates"
  },
  "invalid": {
    name: i18nLazyString(UIStrings.invalidUserEntry),
    description: i18nLazyString(UIStrings.ifTrueThisElementsUserentered),
    group: "AXGlobalStates"
  },
  "editable": { name: i18nLazyString(UIStrings.editable), description: i18nLazyString(UIStrings.ifAndHowThisElementCanBeEdited) },
  "focusable": {
    name: i18nLazyString(UIStrings.focusable),
    description: i18nLazyString(UIStrings.ifTrueThisElementCanReceiveFocus)
  },
  "focused": { name: i18nLazyString(UIStrings.focused), description: i18nLazyString(UIStrings.ifTrueThisElementCurrentlyHas) },
  "settable": {
    name: i18nLazyString(UIStrings.canSetValue),
    description: i18nLazyString(UIStrings.whetherTheValueOfThisElementCan)
  },
  "live": {
    name: i18nLazyString(UIStrings.liveRegion),
    description: i18nLazyString(UIStrings.whetherAndWhatPriorityOfLive),
    group: "AXLiveRegionAttributes"
  },
  "atomic": {
    name: i18nLazyString(UIStrings.atomicLiveRegions),
    description: i18nLazyString(UIStrings.ifThisElementMayReceiveLive),
    group: "AXLiveRegionAttributes"
  },
  "relevant": {
    name: i18nLazyString(UIStrings.relevantLiveRegions),
    description: i18nLazyString(UIStrings.ifThisElementMayReceiveLiveUpdates),
    group: "AXLiveRegionAttributes"
  },
  "busy": {
    name: i18nLazyString(UIStrings.busyLiveRegions),
    description: i18nLazyString(UIStrings.whetherThisElementOrItsSubtree),
    group: "AXLiveRegionAttributes"
  },
  "root": {
    name: i18nLazyString(UIStrings.liveRegionRoot),
    description: i18nLazyString(UIStrings.ifThisElementMayReceiveLiveUpdatesThe),
    group: "AXLiveRegionAttributes"
  },
  "autocomplete": {
    name: i18nLazyString(UIStrings.hasAutocomplete),
    description: i18nLazyString(UIStrings.whetherAndWhatTypeOfAutocomplete),
    group: "AXWidgetAttributes"
  },
  "haspopup": {
    name: i18nLazyString(UIStrings.hasPopup),
    description: i18nLazyString(UIStrings.whetherThisElementHasCausedSome),
    group: "AXWidgetAttributes"
  },
  "level": {
    name: i18nLazyString(UIStrings.level),
    description: i18nLazyString(UIStrings.theHierarchicalLevelOfThis),
    group: "AXWidgetAttributes"
  },
  "multiselectable": {
    name: i18nLazyString(UIStrings.multiselectable),
    description: i18nLazyString(UIStrings.whetherAUserMaySelectMoreThanOne),
    group: "AXWidgetAttributes"
  },
  "orientation": {
    name: i18nLazyString(UIStrings.orientation),
    description: i18nLazyString(UIStrings.whetherThisLinearElements),
    group: "AXWidgetAttributes"
  },
  "multiline": {
    name: i18nLazyString(UIStrings.multiline),
    description: i18nLazyString(UIStrings.whetherThisTextBoxMayHaveMore),
    group: "AXWidgetAttributes"
  },
  "readonly": {
    name: i18nLazyString(UIStrings.readonlyString),
    description: i18nLazyString(UIStrings.ifTrueThisElementMayBeInteracted),
    group: "AXWidgetAttributes"
  },
  "required": {
    name: i18nLazyString(UIStrings.requiredString),
    description: i18nLazyString(UIStrings.whetherThisElementIsARequired),
    group: "AXWidgetAttributes"
  },
  "valuemin": {
    name: i18nLazyString(UIStrings.minimumValue),
    description: i18nLazyString(UIStrings.forARangeWidgetTheMinimumAllowed),
    group: "AXWidgetAttributes"
  },
  "valuemax": {
    name: i18nLazyString(UIStrings.maximumValue),
    description: i18nLazyString(UIStrings.forARangeWidgetTheMaximumAllowed),
    group: "AXWidgetAttributes"
  },
  "valuetext": {
    name: i18nLazyString(UIStrings.valueDescription),
    description: i18nLazyString(UIStrings.aHumanreadableVersionOfTheValue),
    group: "AXWidgetAttributes"
  },
  "checked": {
    name: i18nLazyString(UIStrings.checked),
    description: i18nLazyString(UIStrings.whetherThisCheckboxRadioButtonOr),
    group: "AXWidgetStates"
  },
  "expanded": {
    name: i18nLazyString(UIStrings.expanded),
    description: i18nLazyString(UIStrings.whetherThisElementOrAnother),
    group: "AXWidgetStates"
  },
  "pressed": {
    name: i18nLazyString(UIStrings.pressed),
    description: i18nLazyString(UIStrings.whetherThisToggleButtonIs),
    group: "AXWidgetStates"
  },
  "selected": {
    name: i18nLazyString(UIStrings.selectedString),
    description: i18nLazyString(UIStrings.whetherTheOptionRepresentedBy),
    group: "AXWidgetStates"
  },
  "activedescendant": {
    name: i18nLazyString(UIStrings.activeDescendant),
    description: i18nLazyString(UIStrings.theDescendantOfThisElementWhich),
    group: "AXRelationshipAttributes"
  },
  "flowto": {
    name: i18n.i18n.lockedLazyString("Flows to"),
    description: i18nLazyString(UIStrings.elementToWhichTheUserMayChooseTo),
    group: "AXRelationshipAttributes"
  },
  "controls": {
    name: i18nLazyString(UIStrings.controls),
    description: i18nLazyString(UIStrings.elementOrElementsWhoseContentOr),
    group: "AXRelationshipAttributes"
  },
  "describedby": {
    name: i18nLazyString(UIStrings.describedBy),
    description: i18nLazyString(UIStrings.elementOrElementsWhichFormThe),
    group: "AXRelationshipAttributes"
  },
  "labelledby": {
    name: i18nLazyString(UIStrings.labeledBy),
    description: i18nLazyString(UIStrings.elementOrElementsWhichMayFormThe),
    group: "AXRelationshipAttributes"
  },
  "owns": {
    name: i18n.i18n.lockedLazyString("Owns"),
    description: i18nLazyString(UIStrings.elementOrElementsWhichShouldBe),
    group: "AXRelationshipAttributes"
  },
  "name": {
    name: i18n.i18n.lockedLazyString("Name"),
    description: i18nLazyString(UIStrings.theComputedNameOfThisElement),
    group: "Default"
  },
  "role": {
    name: i18nLazyString(UIStrings.role),
    description: i18nLazyString(UIStrings.indicatesThePurposeOfThisElement),
    group: "Default"
  },
  "value": {
    name: i18nLazyString(UIStrings.value),
    description: i18nLazyString(UIStrings.theValueOfThisElementThisMayBe),
    group: "Default"
  },
  "help": {
    name: i18nLazyString(UIStrings.help),
    description: i18nLazyString(UIStrings.theComputedHelpTextForThis),
    group: "Default"
  },
  "description": {
    name: i18nLazyString(UIStrings.description),
    description: i18nLazyString(UIStrings.theAccessibleDescriptionForThis),
    group: "Default"
  }
};
export const AXSourceTypes = {
  "attribute": { name: i18nLazyString(UIStrings.fromAttribute), description: i18nLazyString(UIStrings.valueFromAttribute) },
  "implicit": {
    name: i18nLazyString(UIStrings.implicit),
    description: i18nLazyString(UIStrings.implicitValue)
  },
  "style": { name: i18nLazyString(UIStrings.fromStyle), description: i18nLazyString(UIStrings.valueFromStyle) },
  "contents": { name: i18nLazyString(UIStrings.contents), description: i18nLazyString(UIStrings.valueFromElementContents) },
  "placeholder": {
    name: i18nLazyString(UIStrings.fromPlaceholderAttribute),
    description: i18nLazyString(UIStrings.valueFromPlaceholderAttribute)
  },
  "relatedElement": { name: i18nLazyString(UIStrings.relatedElement), description: i18nLazyString(UIStrings.valueFromRelatedElement) }
};
export const AXNativeSourceTypes = {
  "description": {
    name: i18nLazyString(UIStrings.fromDescription),
    description: i18nLazyString(UIStrings.valueFromDescriptionElement)
  },
  "figcaption": { name: i18nLazyString(UIStrings.fromCaption), description: i18nLazyString(UIStrings.valueFromFigcaptionElement) },
  "label": { name: i18nLazyString(UIStrings.fromLabel), description: i18nLazyString(UIStrings.valueFromLabelElement) },
  "labelfor": {
    name: i18nLazyString(UIStrings.fromLabelFor),
    description: i18nLazyString(UIStrings.valueFromLabelElementWithFor)
  },
  "labelwrapped": {
    name: i18nLazyString(UIStrings.fromLabelWrapped),
    description: i18nLazyString(UIStrings.valueFromLabelElementWrapped)
  },
  "legend": { name: i18nLazyString(UIStrings.fromLegend), description: i18nLazyString(UIStrings.valueFromLegendElement) },
  "rubyannotation": {
    name: i18nLazyString(UIStrings.fromRubyAnnotation),
    description: i18nLazyString(UIStrings.valueFromNativeHtmlRuby)
  },
  "tablecaption": { name: i18nLazyString(UIStrings.fromCaption), description: i18nLazyString(UIStrings.valueFromTableCaption) },
  "title": { name: i18nLazyString(UIStrings.fromTitle), description: i18nLazyString(UIStrings.valueFromTitleAttribute) },
  "other": {
    name: i18nLazyString(UIStrings.fromNativeHtml),
    description: i18nLazyString(UIStrings.valueFromNativeHtmlUnknownSource)
  }
};
//# sourceMappingURL=AccessibilityStrings.js.map
