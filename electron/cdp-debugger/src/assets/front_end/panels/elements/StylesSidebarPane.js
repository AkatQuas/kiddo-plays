import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Workspace from "../../models/workspace/workspace.js";
import * as WorkspaceDiff from "../../models/workspace_diff/workspace_diff.js";
import { formatCSSChangesFromDiff } from "../../panels/utils/utils.js";
import * as DiffView from "../../ui/components/diff_view/diff_view.js";
import * as IconButton from "../../ui/components/icon_button/icon_button.js";
import * as InlineEditor from "../../ui/legacy/components/inline_editor/inline_editor.js";
import * as Components from "../../ui/legacy/components/utils/utils.js";
import * as UI from "../../ui/legacy/legacy.js";
import * as ElementsComponents from "./components/components.js";
import { ComputedStyleModel } from "./ComputedStyleModel.js";
import { ElementsPanel } from "./ElementsPanel.js";
import { ElementsSidebarPane } from "./ElementsSidebarPane.js";
import { ImagePreviewPopover } from "./ImagePreviewPopover.js";
import { StyleEditorWidget } from "./StyleEditorWidget.js";
import { StylePropertyHighlighter } from "./StylePropertyHighlighter.js";
import stylesSidebarPaneStyles from "./stylesSidebarPane.css.js";
import {
  StylePropertiesSection,
  BlankStylePropertiesSection,
  KeyframePropertiesSection,
  HighlightPseudoStylePropertiesSection
} from "./StylePropertiesSection.js";
import * as LayersWidget from "./LayersWidget.js";
const UIStrings = {
  noMatchingSelectorOrStyle: "No matching selector or style",
  invalidPropertyValue: "Invalid property value",
  unknownPropertyName: "Unknown property name",
  filter: "Filter",
  filterStyles: "Filter Styles",
  pseudoSElement: "Pseudo ::{PH1} element",
  inheritedFroms: "Inherited from ",
  inheritedFromSPseudoOf: "Inherited from ::{PH1} pseudo of ",
  incrementdecrementWithMousewheelOne: "Increment/decrement with mousewheel or up/down keys. {PH1}: R \xB11, Shift: G \xB11, Alt: B \xB11",
  incrementdecrementWithMousewheelHundred: "Increment/decrement with mousewheel or up/down keys. {PH1}: \xB1100, Shift: \xB110, Alt: \xB10.1",
  invalidString: "{PH1}, property name: {PH2}, property value: {PH3}",
  newStyleRule: "New Style Rule",
  cssPropertyName: "`CSS` property name: {PH1}",
  cssPropertyValue: "`CSS` property value: {PH1}",
  toggleRenderingEmulations: "Toggle common rendering emulations",
  automaticDarkMode: "Automatic dark mode",
  copyAllCSSChanges: "Copy all the CSS changes",
  copiedToClipboard: "Copied to clipboard",
  layer: "Layer",
  clickToRevealLayer: "Click to reveal layer in layer tree"
};
const str_ = i18n.i18n.registerUIStrings("panels/elements/StylesSidebarPane.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const HIGHLIGHTABLE_PROPERTIES = [
  { mode: "padding", properties: ["padding"] },
  { mode: "border", properties: ["border"] },
  { mode: "margin", properties: ["margin"] },
  { mode: "gap", properties: ["gap", "grid-gap"] },
  { mode: "column-gap", properties: ["column-gap", "grid-column-gap"] },
  { mode: "row-gap", properties: ["row-gap", "grid-row-gap"] },
  { mode: "grid-template-columns", properties: ["grid-template-columns"] },
  { mode: "grid-template-rows", properties: ["grid-template-rows"] },
  { mode: "grid-template-areas", properties: ["grid-areas"] },
  { mode: "justify-content", properties: ["justify-content"] },
  { mode: "align-content", properties: ["align-content"] },
  { mode: "align-items", properties: ["align-items"] },
  { mode: "flexibility", properties: ["flex", "flex-basis", "flex-grow", "flex-shrink"] }
];
let stylesSidebarPaneInstance;
export class StylesSidebarPane extends Common.ObjectWrapper.eventMixin(ElementsSidebarPane) {
  currentToolbarPane;
  animatedToolbarPane;
  pendingWidget;
  pendingWidgetToggle;
  toolbar;
  toolbarPaneElement;
  noMatchesElement;
  sectionsContainer;
  sectionByElement;
  swatchPopoverHelperInternal;
  linkifier;
  decorator;
  lastRevealedProperty;
  userOperation;
  isEditingStyle;
  filterRegexInternal;
  isActivePropertyHighlighted;
  initialUpdateCompleted;
  hasMatchedStyles;
  sectionBlocks;
  idleCallbackManager;
  needsForceUpdate;
  resizeThrottler;
  imagePreviewPopover;
  activeCSSAngle;
  #urlToChangeTracker = /* @__PURE__ */ new Map();
  #copyChangesButton;
  static instance() {
    if (!stylesSidebarPaneInstance) {
      stylesSidebarPaneInstance = new StylesSidebarPane();
    }
    return stylesSidebarPaneInstance;
  }
  constructor() {
    super(true);
    this.setMinimumSize(96, 26);
    this.registerCSSFiles([stylesSidebarPaneStyles]);
    Common.Settings.Settings.instance().moduleSetting("colorFormat").addChangeListener(this.update.bind(this));
    Common.Settings.Settings.instance().moduleSetting("textEditorIndent").addChangeListener(this.update.bind(this));
    this.currentToolbarPane = null;
    this.animatedToolbarPane = null;
    this.pendingWidget = null;
    this.pendingWidgetToggle = null;
    this.toolbar = null;
    this.toolbarPaneElement = this.createStylesSidebarToolbar();
    this.computedStyleModelInternal = new ComputedStyleModel();
    this.noMatchesElement = this.contentElement.createChild("div", "gray-info-message hidden");
    this.noMatchesElement.textContent = i18nString(UIStrings.noMatchingSelectorOrStyle);
    this.sectionsContainer = this.contentElement.createChild("div");
    UI.ARIAUtils.markAsList(this.sectionsContainer);
    this.sectionsContainer.addEventListener("keydown", this.sectionsContainerKeyDown.bind(this), false);
    this.sectionsContainer.addEventListener("focusin", this.sectionsContainerFocusChanged.bind(this), false);
    this.sectionsContainer.addEventListener("focusout", this.sectionsContainerFocusChanged.bind(this), false);
    this.sectionByElement = /* @__PURE__ */ new WeakMap();
    this.swatchPopoverHelperInternal = new InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper();
    this.swatchPopoverHelperInternal.addEventListener(InlineEditor.SwatchPopoverHelper.Events.WillShowPopover, this.hideAllPopovers, this);
    this.linkifier = new Components.Linkifier.Linkifier(MAX_LINK_LENGTH, true);
    this.decorator = new StylePropertyHighlighter(this);
    this.lastRevealedProperty = null;
    this.userOperation = false;
    this.isEditingStyle = false;
    this.filterRegexInternal = null;
    this.isActivePropertyHighlighted = false;
    this.initialUpdateCompleted = false;
    this.hasMatchedStyles = false;
    this.contentElement.classList.add("styles-pane");
    this.sectionBlocks = [];
    this.idleCallbackManager = null;
    this.needsForceUpdate = false;
    stylesSidebarPaneInstance = this;
    UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, this.forceUpdate, this);
    this.contentElement.addEventListener("copy", this.clipboardCopy.bind(this));
    this.resizeThrottler = new Common.Throttler.Throttler(100);
    this.imagePreviewPopover = new ImagePreviewPopover(this.contentElement, (event) => {
      const link = event.composedPath()[0];
      if (link instanceof Element) {
        return link;
      }
      return null;
    }, () => this.node());
    this.activeCSSAngle = null;
  }
  swatchPopoverHelper() {
    return this.swatchPopoverHelperInternal;
  }
  setUserOperation(userOperation) {
    this.userOperation = userOperation;
  }
  static createExclamationMark(property, title) {
    const exclamationElement = document.createElement("span", { is: "dt-icon-label" });
    exclamationElement.className = "exclamation-mark";
    if (!StylesSidebarPane.ignoreErrorsForProperty(property)) {
      exclamationElement.type = "smallicon-warning";
    }
    let invalidMessage;
    if (title) {
      UI.Tooltip.Tooltip.install(exclamationElement, title);
      invalidMessage = title;
    } else {
      invalidMessage = SDK.CSSMetadata.cssMetadata().isCSSPropertyName(property.name) ? i18nString(UIStrings.invalidPropertyValue) : i18nString(UIStrings.unknownPropertyName);
      UI.Tooltip.Tooltip.install(exclamationElement, invalidMessage);
    }
    const invalidString = i18nString(UIStrings.invalidString, { PH1: invalidMessage, PH2: property.name, PH3: property.value });
    property.setDisplayedStringForInvalidProperty(invalidString);
    return exclamationElement;
  }
  static ignoreErrorsForProperty(property) {
    function hasUnknownVendorPrefix(string) {
      return !string.startsWith("-webkit-") && /^[-_][\w\d]+-\w/.test(string);
    }
    const name = property.name.toLowerCase();
    if (name.charAt(0) === "_") {
      return true;
    }
    if (name === "filter") {
      return true;
    }
    if (name.startsWith("scrollbar-")) {
      return true;
    }
    if (hasUnknownVendorPrefix(name)) {
      return true;
    }
    const value = property.value.toLowerCase();
    if (value.endsWith("\\9")) {
      return true;
    }
    if (hasUnknownVendorPrefix(value)) {
      return true;
    }
    return false;
  }
  static createPropertyFilterElement(placeholder, container, filterCallback) {
    const input = document.createElement("input");
    input.type = "search";
    input.classList.add("custom-search-input");
    input.placeholder = placeholder;
    function searchHandler() {
      const regex = input.value ? new RegExp(Platform.StringUtilities.escapeForRegExp(input.value), "i") : null;
      filterCallback(regex);
    }
    input.addEventListener("input", searchHandler, false);
    function keydownHandler(event) {
      const keyboardEvent = event;
      if (keyboardEvent.key !== Platform.KeyboardUtilities.ESCAPE_KEY || !input.value) {
        return;
      }
      keyboardEvent.consume(true);
      input.value = "";
      searchHandler();
    }
    input.addEventListener("keydown", keydownHandler, false);
    return input;
  }
  static formatLeadingProperties(section) {
    const selectorText = section.headerText();
    const indent = Common.Settings.Settings.instance().moduleSetting("textEditorIndent").get();
    const style = section.style();
    const lines = [];
    for (const property of style.leadingProperties()) {
      if (property.disabled) {
        lines.push(`${indent}/* ${property.name}: ${property.value}; */`);
      } else {
        lines.push(`${indent}${property.name}: ${property.value};`);
      }
    }
    const allDeclarationText = lines.join("\n");
    const ruleText = `${selectorText} {
${allDeclarationText}
}`;
    return {
      allDeclarationText,
      ruleText
    };
  }
  revealProperty(cssProperty) {
    this.decorator.highlightProperty(cssProperty);
    this.lastRevealedProperty = cssProperty;
    this.update();
  }
  jumpToProperty(propertyName) {
    this.decorator.findAndHighlightPropertyName(propertyName);
  }
  forceUpdate() {
    this.needsForceUpdate = true;
    this.swatchPopoverHelperInternal.hide();
    this.resetCache();
    this.update();
  }
  sectionsContainerKeyDown(event) {
    const activeElement = Platform.DOMUtilities.deepActiveElement(this.sectionsContainer.ownerDocument);
    if (!activeElement) {
      return;
    }
    const section = this.sectionByElement.get(activeElement);
    if (!section) {
      return;
    }
    let sectionToFocus = null;
    let willIterateForward = false;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft": {
        sectionToFocus = section.previousSibling() || section.lastSibling();
        willIterateForward = false;
        break;
      }
      case "ArrowDown":
      case "ArrowRight": {
        sectionToFocus = section.nextSibling() || section.firstSibling();
        willIterateForward = true;
        break;
      }
      case "Home": {
        sectionToFocus = section.firstSibling();
        willIterateForward = true;
        break;
      }
      case "End": {
        sectionToFocus = section.lastSibling();
        willIterateForward = false;
        break;
      }
    }
    if (sectionToFocus && this.filterRegexInternal) {
      sectionToFocus = sectionToFocus.findCurrentOrNextVisible(willIterateForward);
    }
    if (sectionToFocus) {
      sectionToFocus.element.focus();
      event.consume(true);
    }
  }
  sectionsContainerFocusChanged() {
    this.resetFocus();
  }
  resetFocus() {
    if (!this.noMatchesElement.classList.contains("hidden")) {
      return;
    }
    if (this.sectionBlocks[0] && this.sectionBlocks[0].sections[0]) {
      const firstVisibleSection = this.sectionBlocks[0].sections[0].findCurrentOrNextVisible(true);
      if (firstVisibleSection) {
        firstVisibleSection.element.tabIndex = this.sectionsContainer.hasFocus() ? -1 : 0;
      }
    }
  }
  onAddButtonLongClick(event) {
    const cssModel = this.cssModel();
    if (!cssModel) {
      return;
    }
    const headers = cssModel.styleSheetHeaders().filter(styleSheetResourceHeader);
    const contextMenuDescriptors = [];
    for (let i = 0; i < headers.length; ++i) {
      const header = headers[i];
      const handler = this.createNewRuleInStyleSheet.bind(this, header);
      contextMenuDescriptors.push({ text: Bindings.ResourceUtils.displayNameForURL(header.resourceURL()), handler });
    }
    contextMenuDescriptors.sort(compareDescriptors);
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    for (let i = 0; i < contextMenuDescriptors.length; ++i) {
      const descriptor = contextMenuDescriptors[i];
      contextMenu.defaultSection().appendItem(descriptor.text, descriptor.handler);
    }
    contextMenu.footerSection().appendItem("inspector-stylesheet", this.createNewRuleInViaInspectorStyleSheet.bind(this));
    void contextMenu.show();
    function compareDescriptors(descriptor1, descriptor2) {
      return Platform.StringUtilities.naturalOrderComparator(descriptor1.text, descriptor2.text);
    }
    function styleSheetResourceHeader(header) {
      return !header.isViaInspector() && !header.isInline && Boolean(header.resourceURL());
    }
  }
  onFilterChanged(regex) {
    this.filterRegexInternal = regex;
    this.updateFilter();
    this.resetFocus();
  }
  refreshUpdate(editedSection, editedTreeElement) {
    if (editedTreeElement) {
      for (const section of this.allSections()) {
        if (section instanceof BlankStylePropertiesSection && section.isBlank) {
          continue;
        }
        section.updateVarFunctions(editedTreeElement);
      }
    }
    if (this.isEditingStyle) {
      return;
    }
    const node = this.node();
    if (!node) {
      return;
    }
    for (const section of this.allSections()) {
      if (section instanceof BlankStylePropertiesSection && section.isBlank) {
        continue;
      }
      section.update(section === editedSection);
    }
    if (this.filterRegexInternal) {
      this.updateFilter();
    }
    this.swatchPopoverHelper().reposition();
    this.nodeStylesUpdatedForTest(node, false);
  }
  async doUpdate() {
    if (!this.initialUpdateCompleted) {
      window.setTimeout(() => {
        if (!this.initialUpdateCompleted) {
          this.sectionsContainer.createChild("span", "spinner");
        }
      }, 200);
    }
    const matchedStyles = await this.fetchMatchedCascade();
    await this.innerRebuildUpdate(matchedStyles);
    if (!this.initialUpdateCompleted) {
      this.initialUpdateCompleted = true;
      this.appendToolbarItem(this.createRenderingShortcuts());
      if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.STYLES_PANE_CSS_CHANGES)) {
        this.#copyChangesButton = this.createCopyAllChangesButton();
        this.appendToolbarItem(this.#copyChangesButton);
        this.#copyChangesButton.element.classList.add("hidden");
      }
      this.dispatchEventToListeners(Events.InitialUpdateCompleted);
    }
    this.dispatchEventToListeners(Events.StylesUpdateCompleted, { hasMatchedStyles: this.hasMatchedStyles });
  }
  onResize() {
    void this.resizeThrottler.schedule(this.innerResize.bind(this));
  }
  innerResize() {
    const width = this.contentElement.getBoundingClientRect().width + "px";
    this.allSections().forEach((section) => {
      section.propertiesTreeOutline.element.style.width = width;
    });
    return Promise.resolve();
  }
  resetCache() {
    const cssModel = this.cssModel();
    if (cssModel) {
      cssModel.discardCachedMatchedCascade();
    }
  }
  fetchMatchedCascade() {
    const node = this.node();
    if (!node || !this.cssModel()) {
      return Promise.resolve(null);
    }
    const cssModel = this.cssModel();
    if (!cssModel) {
      return Promise.resolve(null);
    }
    return cssModel.cachedMatchedCascadeForNode(node).then(validateStyles.bind(this));
    function validateStyles(matchedStyles) {
      return matchedStyles && matchedStyles.node() === this.node() ? matchedStyles : null;
    }
  }
  setEditingStyle(editing, _treeElement) {
    if (this.isEditingStyle === editing) {
      return;
    }
    this.contentElement.classList.toggle("is-editing-style", editing);
    this.isEditingStyle = editing;
    this.setActiveProperty(null);
  }
  setActiveProperty(treeElement) {
    if (this.isActivePropertyHighlighted) {
      SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
    }
    this.isActivePropertyHighlighted = false;
    if (!this.node()) {
      return;
    }
    if (!treeElement || treeElement.overloaded() || treeElement.inherited()) {
      return;
    }
    const rule = treeElement.property.ownerStyle.parentRule;
    const selectorList = rule instanceof SDK.CSSRule.CSSStyleRule ? rule.selectorText() : void 0;
    for (const { properties, mode } of HIGHLIGHTABLE_PROPERTIES) {
      if (!properties.includes(treeElement.name)) {
        continue;
      }
      const node = this.node();
      if (!node) {
        continue;
      }
      node.domModel().overlayModel().highlightInOverlay({ node: this.node(), selectorList }, mode);
      this.isActivePropertyHighlighted = true;
      break;
    }
  }
  onCSSModelChanged(event) {
    const edit = event?.data && "edit" in event.data ? event.data.edit : null;
    if (edit) {
      for (const section of this.allSections()) {
        section.styleSheetEdited(edit);
      }
      return;
    }
    if (this.userOperation || this.isEditingStyle) {
      return;
    }
    this.resetCache();
    this.update();
  }
  focusedSectionIndex() {
    let index = 0;
    for (const block of this.sectionBlocks) {
      for (const section of block.sections) {
        if (section.element.hasFocus()) {
          return index;
        }
        index++;
      }
    }
    return -1;
  }
  continueEditingElement(sectionIndex, propertyIndex) {
    const section = this.allSections()[sectionIndex];
    if (section) {
      const element = section.closestPropertyForEditing(propertyIndex);
      if (!element) {
        section.element.focus();
        return;
      }
      element.startEditing();
    }
  }
  async innerRebuildUpdate(matchedStyles) {
    if (this.needsForceUpdate) {
      this.needsForceUpdate = false;
    } else if (this.isEditingStyle || this.userOperation) {
      return;
    }
    const focusedIndex = this.focusedSectionIndex();
    this.linkifier.reset();
    const prevSections = this.sectionBlocks.map((block) => block.sections).flat();
    this.sectionBlocks = [];
    const node = this.node();
    this.hasMatchedStyles = matchedStyles !== null && node !== null;
    if (!this.hasMatchedStyles) {
      this.sectionsContainer.removeChildren();
      this.noMatchesElement.classList.remove("hidden");
      return;
    }
    this.sectionBlocks = await this.rebuildSectionsForMatchedStyleRules(matchedStyles);
    const newSections = this.sectionBlocks.map((block) => block.sections).flat();
    const styleEditorWidget = StyleEditorWidget.instance();
    const boundSection = styleEditorWidget.getSection();
    if (boundSection) {
      styleEditorWidget.unbindContext();
      for (const [index2, prevSection] of prevSections.entries()) {
        if (boundSection === prevSection && index2 < newSections.length) {
          styleEditorWidget.bindContext(this, newSections[index2]);
        }
      }
    }
    this.sectionsContainer.removeChildren();
    const fragment = document.createDocumentFragment();
    let index = 0;
    let elementToFocus = null;
    for (const block of this.sectionBlocks) {
      const titleElement = block.titleElement();
      if (titleElement) {
        fragment.appendChild(titleElement);
      }
      for (const section of block.sections) {
        fragment.appendChild(section.element);
        if (index === focusedIndex) {
          elementToFocus = section.element;
        }
        index++;
      }
    }
    this.sectionsContainer.appendChild(fragment);
    if (elementToFocus) {
      elementToFocus.focus();
    }
    if (focusedIndex >= index) {
      this.sectionBlocks[0].sections[0].element.focus();
    }
    this.sectionsContainerFocusChanged();
    if (this.filterRegexInternal) {
      this.updateFilter();
    } else {
      this.noMatchesElement.classList.toggle("hidden", this.sectionBlocks.length > 0);
    }
    this.nodeStylesUpdatedForTest(node, true);
    if (this.lastRevealedProperty) {
      this.decorator.highlightProperty(this.lastRevealedProperty);
      this.lastRevealedProperty = null;
    }
    this.swatchPopoverHelper().reposition();
    Host.userMetrics.panelLoaded("elements", "DevTools.Launch.Elements");
    this.dispatchEventToListeners(Events.StylesUpdateCompleted, { hasMatchedStyles: false });
  }
  nodeStylesUpdatedForTest(_node, _rebuild) {
  }
  async rebuildSectionsForMatchedStyleRules(matchedStyles) {
    if (this.idleCallbackManager) {
      this.idleCallbackManager.discard();
    }
    this.idleCallbackManager = new IdleCallbackManager();
    const blocks = [new SectionBlock(null)];
    let sectionIdx = 0;
    let lastParentNode = null;
    let lastLayers = null;
    let sawLayers = false;
    const layersExperimentEnabled = Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.CSS_LAYERS);
    const addLayerSeparator = (style) => {
      if (!layersExperimentEnabled) {
        return;
      }
      const parentRule = style.parentRule;
      if (parentRule instanceof SDK.CSSRule.CSSStyleRule) {
        const layers = parentRule.layers;
        if ((layers.length || lastLayers) && lastLayers !== layers) {
          const block = SectionBlock.createLayerBlock(parentRule);
          blocks.push(block);
          sawLayers = true;
          lastLayers = layers;
        }
      }
    };
    LayersWidget.ButtonProvider.instance().item().setVisible(false);
    const refreshedURLs = /* @__PURE__ */ new Set();
    for (const style of matchedStyles.nodeStyles()) {
      if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.STYLES_PANE_CSS_CHANGES) && style.parentRule) {
        const url = style.parentRule.resourceURL();
        if (url && !refreshedURLs.has(url)) {
          await this.trackURLForChanges(url);
          refreshedURLs.add(url);
        }
      }
      const parentNode = matchedStyles.isInherited(style) ? matchedStyles.nodeForStyle(style) : null;
      if (parentNode && parentNode !== lastParentNode) {
        lastParentNode = parentNode;
        const block = await SectionBlock.createInheritedNodeBlock(lastParentNode);
        blocks.push(block);
      }
      addLayerSeparator(style);
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock) {
        this.idleCallbackManager.schedule(() => {
          const section = new StylePropertiesSection(this, matchedStyles, style, sectionIdx);
          sectionIdx++;
          lastBlock.sections.push(section);
        });
      }
    }
    const customHighlightPseudoRulesets = Array.from(matchedStyles.customHighlightPseudoNames()).map((highlightName) => {
      return {
        "highlightName": highlightName,
        "pseudoType": Protocol.DOM.PseudoType.Highlight,
        "pseudoStyles": matchedStyles.customHighlightPseudoStyles(highlightName)
      };
    });
    const otherPseudoRulesets = [...matchedStyles.pseudoTypes()].map((pseudoType) => {
      return { "highlightName": null, "pseudoType": pseudoType, "pseudoStyles": matchedStyles.pseudoStyles(pseudoType) };
    });
    const pseudoRulesets = customHighlightPseudoRulesets.concat(otherPseudoRulesets).sort((a, b) => {
      if (a.pseudoType === Protocol.DOM.PseudoType.Before && b.pseudoType !== Protocol.DOM.PseudoType.Before) {
        return -1;
      }
      if (a.pseudoType !== Protocol.DOM.PseudoType.Before && b.pseudoType === Protocol.DOM.PseudoType.Before) {
        return 1;
      }
      if (a.pseudoType < b.pseudoType) {
        return -1;
      }
      if (a.pseudoType > b.pseudoType) {
        return 1;
      }
      return 0;
    });
    for (const pseudo of pseudoRulesets) {
      lastParentNode = null;
      for (let i = 0; i < pseudo.pseudoStyles.length; ++i) {
        const style = pseudo.pseudoStyles[i];
        const parentNode = matchedStyles.isInherited(style) ? matchedStyles.nodeForStyle(style) : null;
        if (i === 0 || parentNode !== lastParentNode) {
          lastLayers = null;
          if (parentNode) {
            const block = await SectionBlock.createInheritedPseudoTypeBlock(pseudo.pseudoType, pseudo.highlightName, parentNode);
            blocks.push(block);
          } else {
            const block = SectionBlock.createPseudoTypeBlock(pseudo.pseudoType, pseudo.highlightName);
            blocks.push(block);
          }
        }
        lastParentNode = parentNode;
        addLayerSeparator(style);
        const lastBlock = blocks[blocks.length - 1];
        this.idleCallbackManager.schedule(() => {
          const section = new HighlightPseudoStylePropertiesSection(this, matchedStyles, style, sectionIdx);
          sectionIdx++;
          lastBlock.sections.push(section);
        });
      }
    }
    for (const keyframesRule of matchedStyles.keyframes()) {
      const block = SectionBlock.createKeyframesBlock(keyframesRule.name().text);
      for (const keyframe of keyframesRule.keyframes()) {
        this.idleCallbackManager.schedule(() => {
          block.sections.push(new KeyframePropertiesSection(this, matchedStyles, keyframe.style, sectionIdx));
          sectionIdx++;
        });
      }
      blocks.push(block);
    }
    if (layersExperimentEnabled) {
      if (sawLayers) {
        LayersWidget.ButtonProvider.instance().item().setVisible(true);
      } else if (LayersWidget.LayersWidget.instance().isShowing()) {
        ElementsPanel.instance().showToolbarPane(null, LayersWidget.ButtonProvider.instance().item());
      }
    }
    await this.idleCallbackManager.awaitDone();
    return blocks;
  }
  async createNewRuleInViaInspectorStyleSheet() {
    const cssModel = this.cssModel();
    const node = this.node();
    if (!cssModel || !node) {
      return;
    }
    this.setUserOperation(true);
    const styleSheetHeader = await cssModel.requestViaInspectorStylesheet(node);
    this.setUserOperation(false);
    await this.createNewRuleInStyleSheet(styleSheetHeader);
  }
  async createNewRuleInStyleSheet(styleSheetHeader) {
    if (!styleSheetHeader) {
      return;
    }
    const text = (await styleSheetHeader.requestContent()).content || "";
    const lines = text.split("\n");
    const range = TextUtils.TextRange.TextRange.createFromLocation(lines.length - 1, lines[lines.length - 1].length);
    if (this.sectionBlocks && this.sectionBlocks.length > 0) {
      this.addBlankSection(this.sectionBlocks[0].sections[0], styleSheetHeader.id, range);
    }
  }
  addBlankSection(insertAfterSection, styleSheetId, ruleLocation) {
    const node = this.node();
    const blankSection = new BlankStylePropertiesSection(this, insertAfterSection.matchedStyles, node ? node.simpleSelector() : "", styleSheetId, ruleLocation, insertAfterSection.style(), 0);
    this.sectionsContainer.insertBefore(blankSection.element, insertAfterSection.element.nextSibling);
    for (const block of this.sectionBlocks) {
      const index = block.sections.indexOf(insertAfterSection);
      if (index === -1) {
        continue;
      }
      block.sections.splice(index + 1, 0, blankSection);
      blankSection.startEditingSelector();
    }
    let sectionIdx = 0;
    for (const block of this.sectionBlocks) {
      for (const section of block.sections) {
        section.setSectionIdx(sectionIdx);
        sectionIdx++;
      }
    }
  }
  removeSection(section) {
    for (const block of this.sectionBlocks) {
      const index = block.sections.indexOf(section);
      if (index === -1) {
        continue;
      }
      block.sections.splice(index, 1);
      section.element.remove();
    }
  }
  filterRegex() {
    return this.filterRegexInternal;
  }
  updateFilter() {
    let hasAnyVisibleBlock = false;
    for (const block of this.sectionBlocks) {
      hasAnyVisibleBlock = block.updateFilter() || hasAnyVisibleBlock;
    }
    this.noMatchesElement.classList.toggle("hidden", Boolean(hasAnyVisibleBlock));
  }
  willHide() {
    this.hideAllPopovers();
    super.willHide();
  }
  hideAllPopovers() {
    this.swatchPopoverHelperInternal.hide();
    this.imagePreviewPopover.hide();
    if (this.activeCSSAngle) {
      this.activeCSSAngle.minify();
      this.activeCSSAngle = null;
    }
  }
  allSections() {
    let sections = [];
    for (const block of this.sectionBlocks) {
      sections = sections.concat(block.sections);
    }
    return sections;
  }
  async trackURLForChanges(url) {
    const currentTracker = this.#urlToChangeTracker.get(url);
    if (currentTracker) {
      WorkspaceDiff.WorkspaceDiff.workspaceDiff().unsubscribeFromDiffChange(currentTracker.uiSourceCode, currentTracker.diffChangeCallback);
    }
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url);
    if (!uiSourceCode) {
      return;
    }
    const diffChangeCallback = this.refreshChangedLines.bind(this, uiSourceCode);
    WorkspaceDiff.WorkspaceDiff.workspaceDiff().subscribeToDiffChange(uiSourceCode, diffChangeCallback);
    const newTracker = {
      uiSourceCode,
      changedLines: /* @__PURE__ */ new Set(),
      diffChangeCallback
    };
    this.#urlToChangeTracker.set(url, newTracker);
    await this.refreshChangedLines(newTracker.uiSourceCode);
  }
  isPropertyChanged(property) {
    const url = property.ownerStyle.parentRule?.resourceURL();
    if (!url) {
      return false;
    }
    const changeTracker = this.#urlToChangeTracker.get(url);
    if (!changeTracker) {
      return false;
    }
    const { changedLines, formattedCurrentMapping } = changeTracker;
    const uiLocation = Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance().propertyUILocation(property, true);
    if (!uiLocation) {
      return false;
    }
    if (!formattedCurrentMapping) {
      return changedLines.has(uiLocation.lineNumber + 1);
    }
    const formattedLineNumber = formattedCurrentMapping.originalToFormatted(uiLocation.lineNumber, uiLocation.columnNumber)[0];
    return changedLines.has(formattedLineNumber + 1);
  }
  updateChangeStatus() {
    if (!this.#copyChangesButton) {
      return;
    }
    let hasChangedStyles = false;
    for (const changeTracker of this.#urlToChangeTracker.values()) {
      if (changeTracker.changedLines.size > 0) {
        hasChangedStyles = true;
        break;
      }
    }
    this.#copyChangesButton.element.classList.toggle("hidden", !hasChangedStyles);
  }
  async refreshChangedLines(uiSourceCode) {
    const changeTracker = this.#urlToChangeTracker.get(uiSourceCode.url());
    if (!changeTracker) {
      return;
    }
    const diffResponse = await WorkspaceDiff.WorkspaceDiff.workspaceDiff().requestDiff(uiSourceCode, { shouldFormatDiff: true });
    const changedLines = /* @__PURE__ */ new Set();
    changeTracker.changedLines = changedLines;
    if (!diffResponse) {
      return;
    }
    const { diff, formattedCurrentMapping } = diffResponse;
    const { rows } = DiffView.DiffView.buildDiffRows(diff);
    for (const row of rows) {
      if (row.type === DiffView.DiffView.RowType.Addition) {
        changedLines.add(row.currentLineNumber);
      }
    }
    changeTracker.formattedCurrentMapping = formattedCurrentMapping;
  }
  async getFormattedChanges() {
    let allChanges = "";
    for (const [url, { uiSourceCode }] of this.#urlToChangeTracker) {
      const diffResponse = await WorkspaceDiff.WorkspaceDiff.workspaceDiff().requestDiff(uiSourceCode, { shouldFormatDiff: true });
      if (!diffResponse || diffResponse?.diff.length < 2) {
        continue;
      }
      const changes = await formatCSSChangesFromDiff(diffResponse.diff);
      if (changes.length > 0) {
        allChanges += `/* ${escapeUrlAsCssComment(url)} */

${changes}

`;
      }
    }
    return allChanges;
  }
  clipboardCopy(_event) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.StyleRuleCopied);
  }
  createStylesSidebarToolbar() {
    const container = this.contentElement.createChild("div", "styles-sidebar-pane-toolbar-container");
    const hbox = container.createChild("div", "hbox styles-sidebar-pane-toolbar");
    const filterContainerElement = hbox.createChild("div", "styles-sidebar-pane-filter-box");
    const filterInput = StylesSidebarPane.createPropertyFilterElement(i18nString(UIStrings.filter), hbox, this.onFilterChanged.bind(this));
    UI.ARIAUtils.setAccessibleName(filterInput, i18nString(UIStrings.filterStyles));
    filterContainerElement.appendChild(filterInput);
    const toolbar = new UI.Toolbar.Toolbar("styles-pane-toolbar", hbox);
    toolbar.makeToggledGray();
    void toolbar.appendItemsAtLocation("styles-sidebarpane-toolbar");
    this.toolbar = toolbar;
    const toolbarPaneContainer = container.createChild("div", "styles-sidebar-toolbar-pane-container");
    const toolbarPaneContent = toolbarPaneContainer.createChild("div", "styles-sidebar-toolbar-pane");
    return toolbarPaneContent;
  }
  showToolbarPane(widget, toggle) {
    if (this.pendingWidgetToggle) {
      this.pendingWidgetToggle.setToggled(false);
    }
    this.pendingWidgetToggle = toggle;
    if (this.animatedToolbarPane) {
      this.pendingWidget = widget;
    } else {
      this.startToolbarPaneAnimation(widget);
    }
    if (widget && toggle) {
      toggle.setToggled(true);
    }
  }
  appendToolbarItem(item) {
    if (this.toolbar) {
      this.toolbar.appendToolbarItem(item);
    }
  }
  startToolbarPaneAnimation(widget) {
    if (widget === this.currentToolbarPane) {
      return;
    }
    if (widget && this.currentToolbarPane) {
      this.currentToolbarPane.detach();
      widget.show(this.toolbarPaneElement);
      this.currentToolbarPane = widget;
      this.currentToolbarPane.focus();
      return;
    }
    this.animatedToolbarPane = widget;
    if (this.currentToolbarPane) {
      this.toolbarPaneElement.style.animationName = "styles-element-state-pane-slideout";
    } else if (widget) {
      this.toolbarPaneElement.style.animationName = "styles-element-state-pane-slidein";
    }
    if (widget) {
      widget.show(this.toolbarPaneElement);
    }
    const listener = onAnimationEnd.bind(this);
    this.toolbarPaneElement.addEventListener("animationend", listener, false);
    function onAnimationEnd() {
      this.toolbarPaneElement.style.removeProperty("animation-name");
      this.toolbarPaneElement.removeEventListener("animationend", listener, false);
      if (this.currentToolbarPane) {
        this.currentToolbarPane.detach();
      }
      this.currentToolbarPane = this.animatedToolbarPane;
      if (this.currentToolbarPane) {
        this.currentToolbarPane.focus();
      }
      this.animatedToolbarPane = null;
      if (this.pendingWidget) {
        this.startToolbarPaneAnimation(this.pendingWidget);
        this.pendingWidget = null;
      }
    }
  }
  createRenderingShortcuts() {
    const prefersColorSchemeSetting = Common.Settings.Settings.instance().moduleSetting("emulatedCSSMediaFeaturePrefersColorScheme");
    const autoDarkModeSetting = Common.Settings.Settings.instance().moduleSetting("emulateAutoDarkMode");
    const decorateStatus = (condition, title) => `${condition ? "\u2713 " : ""}${title}`;
    const icon = new IconButton.Icon.Icon();
    icon.data = {
      iconName: "ic_rendering",
      color: "var(--color-text-secondary)",
      width: "18px",
      height: "18px"
    };
    const button = new UI.Toolbar.ToolbarToggle(i18nString(UIStrings.toggleRenderingEmulations), icon);
    button.setToggleWithDot(true);
    button.element.addEventListener("click", (event) => {
      const menu = new UI.ContextMenu.ContextMenu(event);
      const preferredColorScheme = prefersColorSchemeSetting.get();
      const isLightColorScheme = preferredColorScheme === "light";
      const isDarkColorScheme = preferredColorScheme === "dark";
      const isAutoDarkEnabled = autoDarkModeSetting.get();
      const lightColorSchemeOption = decorateStatus(isLightColorScheme, "prefers-color-scheme: light");
      const darkColorSchemeOption = decorateStatus(isDarkColorScheme, "prefers-color-scheme: dark");
      const autoDarkModeOption = decorateStatus(isAutoDarkEnabled, i18nString(UIStrings.automaticDarkMode));
      menu.defaultSection().appendItem(lightColorSchemeOption, () => {
        autoDarkModeSetting.set(false);
        prefersColorSchemeSetting.set(isLightColorScheme ? "" : "light");
        button.setToggled(Boolean(prefersColorSchemeSetting.get()));
      });
      menu.defaultSection().appendItem(darkColorSchemeOption, () => {
        autoDarkModeSetting.set(false);
        prefersColorSchemeSetting.set(isDarkColorScheme ? "" : "dark");
        button.setToggled(Boolean(prefersColorSchemeSetting.get()));
      });
      menu.defaultSection().appendItem(autoDarkModeOption, () => {
        autoDarkModeSetting.set(!isAutoDarkEnabled);
        button.setToggled(Boolean(prefersColorSchemeSetting.get()));
      });
      void menu.show();
      event.stopPropagation();
    }, { capture: true });
    return button;
  }
  createCopyAllChangesButton() {
    const copyAllChangesButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.copyAllCSSChanges), "largeicon-copy");
    copyAllChangesButton.element.setAttribute("data-content", i18nString(UIStrings.copiedToClipboard));
    let timeout;
    copyAllChangesButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, async () => {
      const allChanges = await this.getFormattedChanges();
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(allChanges);
      Host.userMetrics.styleTextCopied(Host.UserMetrics.StyleTextCopied.AllChangesViaStylesPane);
      if (timeout) {
        clearTimeout(timeout);
        timeout = void 0;
      }
      copyAllChangesButton.element.classList.add("copied-to-clipboard");
      timeout = window.setTimeout(() => {
        copyAllChangesButton.element.classList.remove("copied-to-clipboard");
        timeout = void 0;
      }, 2e3);
    });
    return copyAllChangesButton;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["InitialUpdateCompleted"] = "InitialUpdateCompleted";
  Events2["StylesUpdateCompleted"] = "StylesUpdateCompleted";
  return Events2;
})(Events || {});
const MAX_LINK_LENGTH = 23;
export class SectionBlock {
  titleElementInternal;
  sections;
  constructor(titleElement) {
    this.titleElementInternal = titleElement;
    this.sections = [];
  }
  static createPseudoTypeBlock(pseudoType, pseudoArgument) {
    const separatorElement = document.createElement("div");
    separatorElement.className = "sidebar-separator";
    const pseudoArgumentString = pseudoArgument ? `(${pseudoArgument})` : "";
    const pseudoTypeString = `${pseudoType}${pseudoArgumentString}`;
    separatorElement.textContent = i18nString(UIStrings.pseudoSElement, { PH1: pseudoTypeString });
    return new SectionBlock(separatorElement);
  }
  static async createInheritedPseudoTypeBlock(pseudoType, pseudoArgument, node) {
    const separatorElement = document.createElement("div");
    separatorElement.className = "sidebar-separator";
    const pseudoArgumentString = pseudoArgument ? `(${pseudoArgument})` : "";
    const pseudoTypeString = `${pseudoType}${pseudoArgumentString}`;
    UI.UIUtils.createTextChild(separatorElement, i18nString(UIStrings.inheritedFromSPseudoOf, { PH1: pseudoTypeString }));
    const link = await Common.Linkifier.Linkifier.linkify(node, {
      preventKeyboardFocus: true,
      tooltip: void 0
    });
    separatorElement.appendChild(link);
    return new SectionBlock(separatorElement);
  }
  static createKeyframesBlock(keyframesName) {
    const separatorElement = document.createElement("div");
    separatorElement.className = "sidebar-separator";
    separatorElement.textContent = `@keyframes ${keyframesName}`;
    return new SectionBlock(separatorElement);
  }
  static async createInheritedNodeBlock(node) {
    const separatorElement = document.createElement("div");
    separatorElement.className = "sidebar-separator";
    UI.UIUtils.createTextChild(separatorElement, i18nString(UIStrings.inheritedFroms));
    const link = await Common.Linkifier.Linkifier.linkify(node, {
      preventKeyboardFocus: true,
      tooltip: void 0
    });
    separatorElement.appendChild(link);
    return new SectionBlock(separatorElement);
  }
  static createLayerBlock(rule) {
    const separatorElement = document.createElement("div");
    separatorElement.className = "sidebar-separator layer-separator";
    UI.UIUtils.createTextChild(separatorElement.createChild("div"), i18nString(UIStrings.layer));
    const layers = rule.layers;
    if (!layers.length && rule.origin === Protocol.CSS.StyleSheetOrigin.UserAgent) {
      const name2 = rule.origin === Protocol.CSS.StyleSheetOrigin.UserAgent ? "\xA0user\xA0agent\xA0stylesheet" : "\xA0implicit\xA0outer\xA0layer";
      UI.UIUtils.createTextChild(separatorElement.createChild("div"), name2);
      return new SectionBlock(separatorElement);
    }
    const layerLink = separatorElement.createChild("button");
    layerLink.className = "link";
    layerLink.title = i18nString(UIStrings.clickToRevealLayer);
    const name = layers.map((layer) => SDK.CSSModel.CSSModel.readableLayerName(layer.text)).join(".");
    layerLink.textContent = name;
    layerLink.onclick = () => LayersWidget.LayersWidget.instance().revealLayer(name);
    return new SectionBlock(separatorElement);
  }
  updateFilter() {
    let hasAnyVisibleSection = false;
    for (const section of this.sections) {
      hasAnyVisibleSection = section.updateFilter() || hasAnyVisibleSection;
    }
    if (this.titleElementInternal) {
      this.titleElementInternal.classList.toggle("hidden", !hasAnyVisibleSection);
    }
    return Boolean(hasAnyVisibleSection);
  }
  titleElement() {
    return this.titleElementInternal;
  }
}
export class IdleCallbackManager {
  discarded;
  promises;
  constructor() {
    this.discarded = false;
    this.promises = [];
  }
  discard() {
    this.discarded = true;
  }
  schedule(fn, timeout = 100) {
    if (this.discarded) {
      return;
    }
    this.promises.push(new Promise((resolve, reject) => {
      const run = () => {
        try {
          fn();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      window.requestIdleCallback(() => {
        if (this.discarded) {
          return resolve();
        }
        run();
      }, { timeout });
    }));
  }
  awaitDone() {
    return Promise.all(this.promises);
  }
}
export function quoteFamilyName(familyName) {
  return `'${familyName.replaceAll("'", "\\'")}'`;
}
export class CSSPropertyPrompt extends UI.TextPrompt.TextPrompt {
  isColorAware;
  cssCompletions;
  selectedNodeComputedStyles;
  parentNodeComputedStyles;
  treeElement;
  isEditingName;
  cssVariables;
  constructor(treeElement, isEditingName) {
    super();
    this.initialize(this.buildPropertyCompletions.bind(this), UI.UIUtils.StyleValueDelimiters);
    const cssMetadata = SDK.CSSMetadata.cssMetadata();
    this.isColorAware = SDK.CSSMetadata.cssMetadata().isColorAwareProperty(treeElement.property.name);
    this.cssCompletions = [];
    const node = treeElement.node();
    if (isEditingName) {
      this.cssCompletions = cssMetadata.allProperties();
      if (node && !node.isSVGNode()) {
        this.cssCompletions = this.cssCompletions.filter((property) => !cssMetadata.isSVGProperty(property));
      }
    } else {
      this.cssCompletions = cssMetadata.getPropertyValues(treeElement.property.name);
      if (node && cssMetadata.isFontFamilyProperty(treeElement.property.name)) {
        const fontFamilies = node.domModel().cssModel().fontFaces().map((font) => quoteFamilyName(font.getFontFamily()));
        this.cssCompletions.unshift(...fontFamilies);
      }
    }
    this.selectedNodeComputedStyles = null;
    this.parentNodeComputedStyles = null;
    this.treeElement = treeElement;
    this.isEditingName = isEditingName;
    this.cssVariables = treeElement.matchedStyles().availableCSSVariables(treeElement.property.ownerStyle);
    if (this.cssVariables.length < 1e3) {
      this.cssVariables.sort(Platform.StringUtilities.naturalOrderComparator);
    } else {
      this.cssVariables.sort();
    }
    if (!isEditingName) {
      this.disableDefaultSuggestionForEmptyInput();
      if (treeElement && treeElement.valueElement) {
        const cssValueText = treeElement.valueElement.textContent;
        const cmdOrCtrl = Host.Platform.isMac() ? "Cmd" : "Ctrl";
        if (cssValueText !== null) {
          if (cssValueText.match(/#[\da-f]{3,6}$/i)) {
            this.setTitle(i18nString(UIStrings.incrementdecrementWithMousewheelOne, { PH1: cmdOrCtrl }));
          } else if (cssValueText.match(/\d+/)) {
            this.setTitle(i18nString(UIStrings.incrementdecrementWithMousewheelHundred, { PH1: cmdOrCtrl }));
          }
        }
      }
    }
  }
  onKeyDown(event) {
    const keyboardEvent = event;
    switch (keyboardEvent.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "PageUp":
      case "PageDown":
        if (!this.isSuggestBoxVisible() && this.handleNameOrValueUpDown(keyboardEvent)) {
          keyboardEvent.preventDefault();
          return;
        }
        break;
      case "Enter":
        if (keyboardEvent.shiftKey) {
          return;
        }
        this.tabKeyPressed();
        keyboardEvent.preventDefault();
        return;
    }
    super.onKeyDown(keyboardEvent);
  }
  onMouseWheel(event) {
    if (this.handleNameOrValueUpDown(event)) {
      event.consume(true);
      return;
    }
    super.onMouseWheel(event);
  }
  tabKeyPressed() {
    this.acceptAutoComplete();
    return false;
  }
  handleNameOrValueUpDown(event) {
    function finishHandler(_originalValue, _replacementString) {
      if (this.treeElement.nameElement && this.treeElement.valueElement) {
        void this.treeElement.applyStyleText(this.treeElement.nameElement.textContent + ": " + this.treeElement.valueElement.textContent, false);
      }
    }
    function customNumberHandler(prefix, number, suffix) {
      if (number !== 0 && !suffix.length && SDK.CSSMetadata.cssMetadata().isLengthProperty(this.treeElement.property.name) && !this.treeElement.property.value.toLowerCase().startsWith("calc(")) {
        suffix = "px";
      }
      return prefix + number + suffix;
    }
    if (!this.isEditingName && this.treeElement.valueElement && UI.UIUtils.handleElementValueModifications(event, this.treeElement.valueElement, finishHandler.bind(this), this.isValueSuggestion.bind(this), customNumberHandler.bind(this))) {
      return true;
    }
    return false;
  }
  isValueSuggestion(word) {
    if (!word) {
      return false;
    }
    word = word.toLowerCase();
    return this.cssCompletions.indexOf(word) !== -1 || word.startsWith("--");
  }
  async buildPropertyCompletions(expression, query, force) {
    const lowerQuery = query.toLowerCase();
    const editingVariable = !this.isEditingName && expression.trim().endsWith("var(");
    if (!query && !force && !editingVariable && (this.isEditingName || expression)) {
      return Promise.resolve([]);
    }
    const prefixResults = [];
    const anywhereResults = [];
    if (!editingVariable) {
      this.cssCompletions.forEach((completion) => filterCompletions.call(this, completion, false));
    }
    const node = this.treeElement.node();
    if (this.isEditingName && node) {
      const nameValuePresets = SDK.CSSMetadata.cssMetadata().nameValuePresets(node.isSVGNode());
      nameValuePresets.forEach((preset) => filterCompletions.call(this, preset, false, true));
    }
    if (this.isEditingName || editingVariable) {
      this.cssVariables.forEach((variable) => filterCompletions.call(this, variable, true));
    }
    const results = prefixResults.concat(anywhereResults);
    if (!this.isEditingName && !results.length && query.length > 1 && "!important".startsWith(lowerQuery)) {
      results.push({
        text: "!important",
        title: void 0,
        subtitle: void 0,
        iconType: void 0,
        priority: void 0,
        isSecondary: void 0,
        subtitleRenderer: void 0,
        selectionRange: void 0,
        hideGhostText: void 0,
        iconElement: void 0
      });
    }
    const userEnteredText = query.replace("-", "");
    if (userEnteredText && userEnteredText === userEnteredText.toUpperCase()) {
      for (let i = 0; i < results.length; ++i) {
        if (!results[i].text.startsWith("--")) {
          results[i].text = results[i].text.toUpperCase();
        }
      }
    }
    for (const result of results) {
      if (editingVariable) {
        result.title = result.text;
        result.text += ")";
        continue;
      }
      const valuePreset = SDK.CSSMetadata.cssMetadata().getValuePreset(this.treeElement.name, result.text);
      if (!this.isEditingName && valuePreset) {
        result.title = result.text;
        result.text = valuePreset.text;
        result.selectionRange = { startColumn: valuePreset.startColumn, endColumn: valuePreset.endColumn };
      }
    }
    const ensureComputedStyles = async () => {
      if (!node || this.selectedNodeComputedStyles) {
        return;
      }
      this.selectedNodeComputedStyles = await node.domModel().cssModel().getComputedStyle(node.id);
      const parentNode = node.parentNode;
      if (parentNode) {
        this.parentNodeComputedStyles = await parentNode.domModel().cssModel().getComputedStyle(parentNode.id);
      }
    };
    for (const result of results) {
      await ensureComputedStyles();
      const iconInfo = ElementsComponents.CSSPropertyIconResolver.findIcon(this.isEditingName ? result.text : `${this.treeElement.property.name}: ${result.text}`, this.selectedNodeComputedStyles, this.parentNodeComputedStyles);
      if (!iconInfo) {
        continue;
      }
      const icon = new IconButton.Icon.Icon();
      const width = "12.5px";
      const height = "12.5px";
      icon.data = {
        iconName: iconInfo.iconName,
        width,
        height,
        color: "black"
      };
      icon.style.transform = `rotate(${iconInfo.rotate}deg) scale(${iconInfo.scaleX * 1.1}, ${iconInfo.scaleY * 1.1})`;
      icon.style.maxHeight = height;
      icon.style.maxWidth = width;
      result.iconElement = icon;
    }
    if (this.isColorAware && !this.isEditingName) {
      results.sort((a, b) => {
        if (a.isCSSVariableColor && b.isCSSVariableColor) {
          return 0;
        }
        return a.isCSSVariableColor ? -1 : 1;
      });
    }
    return Promise.resolve(results);
    function filterCompletions(completion, variable, nameValue) {
      const index = completion.toLowerCase().indexOf(lowerQuery);
      const result = {
        text: completion,
        title: void 0,
        subtitle: void 0,
        iconType: void 0,
        priority: void 0,
        isSecondary: void 0,
        subtitleRenderer: void 0,
        selectionRange: void 0,
        hideGhostText: void 0,
        iconElement: void 0,
        isCSSVariableColor: false
      };
      if (variable) {
        const computedValue = this.treeElement.matchedStyles().computeCSSVariable(this.treeElement.property.ownerStyle, completion);
        if (computedValue) {
          const color = Common.Color.Color.parse(computedValue);
          if (color) {
            result.subtitleRenderer = swatchRenderer.bind(null, color);
            result.isCSSVariableColor = true;
          } else {
            result.subtitleRenderer = computedValueSubtitleRenderer.bind(null, computedValue);
          }
        }
      }
      if (nameValue) {
        result.hideGhostText = true;
      }
      if (index === 0) {
        result.priority = this.isEditingName ? SDK.CSSMetadata.cssMetadata().propertyUsageWeight(completion) : 1;
        prefixResults.push(result);
      } else if (index > -1) {
        anywhereResults.push(result);
      }
    }
    function swatchRenderer(color) {
      const swatch = new InlineEditor.ColorSwatch.ColorSwatch();
      swatch.renderColor(color);
      swatch.style.pointerEvents = "none";
      return swatch;
    }
    function computedValueSubtitleRenderer(computedValue) {
      const subtitleElement = document.createElement("span");
      subtitleElement.className = "suggestion-subtitle";
      subtitleElement.textContent = `${computedValue}`;
      subtitleElement.style.maxWidth = "100px";
      subtitleElement.title = `${computedValue}`;
      return subtitleElement;
    }
  }
}
export function unescapeCssString(input) {
  const reCssEscapeSequence = /(?<!\\)\\(?:([a-fA-F0-9]{1,6})|(.))[\n\t\x20]?/gs;
  return input.replace(reCssEscapeSequence, (_, $1, $2) => {
    if ($2) {
      return $2;
    }
    const codePoint = parseInt($1, 16);
    const isSurrogate = 55296 <= codePoint && codePoint <= 57343;
    if (isSurrogate || codePoint === 0 || codePoint > 1114111) {
      return "\uFFFD";
    }
    return String.fromCodePoint(codePoint);
  });
}
export function escapeUrlAsCssComment(urlText) {
  const url = new URL(urlText);
  if (url.search) {
    return `${url.origin}${url.pathname}${url.search.replaceAll("*/", "*%2F")}${url.hash}`;
  }
  return url.toString();
}
export class StylesSidebarPropertyRenderer {
  rule;
  node;
  propertyName;
  propertyValue;
  colorHandler;
  bezierHandler;
  fontHandler;
  shadowHandler;
  gridHandler;
  varHandler;
  angleHandler;
  lengthHandler;
  constructor(rule, node, name, value) {
    this.rule = rule;
    this.node = node;
    this.propertyName = name;
    this.propertyValue = value;
    this.colorHandler = null;
    this.bezierHandler = null;
    this.fontHandler = null;
    this.shadowHandler = null;
    this.gridHandler = null;
    this.varHandler = document.createTextNode.bind(document);
    this.angleHandler = null;
    this.lengthHandler = null;
  }
  setColorHandler(handler) {
    this.colorHandler = handler;
  }
  setBezierHandler(handler) {
    this.bezierHandler = handler;
  }
  setFontHandler(handler) {
    this.fontHandler = handler;
  }
  setShadowHandler(handler) {
    this.shadowHandler = handler;
  }
  setGridHandler(handler) {
    this.gridHandler = handler;
  }
  setVarHandler(handler) {
    this.varHandler = handler;
  }
  setAngleHandler(handler) {
    this.angleHandler = handler;
  }
  setLengthHandler(handler) {
    this.lengthHandler = handler;
  }
  renderName() {
    const nameElement = document.createElement("span");
    UI.ARIAUtils.setAccessibleName(nameElement, i18nString(UIStrings.cssPropertyName, { PH1: this.propertyName }));
    nameElement.className = "webkit-css-property";
    nameElement.textContent = this.propertyName;
    nameElement.normalize();
    return nameElement;
  }
  renderValue() {
    const valueElement = document.createElement("span");
    UI.ARIAUtils.setAccessibleName(valueElement, i18nString(UIStrings.cssPropertyValue, { PH1: this.propertyValue }));
    valueElement.className = "value";
    if (!this.propertyValue) {
      return valueElement;
    }
    const metadata = SDK.CSSMetadata.cssMetadata();
    if (this.shadowHandler && metadata.isShadowProperty(this.propertyName) && !SDK.CSSMetadata.VariableRegex.test(this.propertyValue)) {
      valueElement.appendChild(this.shadowHandler(this.propertyValue, this.propertyName));
      valueElement.normalize();
      return valueElement;
    }
    if (this.gridHandler && metadata.isGridAreaDefiningProperty(this.propertyName)) {
      valueElement.appendChild(this.gridHandler(this.propertyValue, this.propertyName));
      valueElement.normalize();
      return valueElement;
    }
    if (metadata.isStringProperty(this.propertyName)) {
      UI.Tooltip.Tooltip.install(valueElement, unescapeCssString(this.propertyValue));
    }
    const regexes = [SDK.CSSMetadata.VariableRegex, SDK.CSSMetadata.URLRegex];
    const processors = [this.varHandler, this.processURL.bind(this)];
    if (this.bezierHandler && metadata.isBezierAwareProperty(this.propertyName)) {
      regexes.push(UI.Geometry.CubicBezier.Regex);
      processors.push(this.bezierHandler);
    }
    if (this.colorHandler && metadata.isColorAwareProperty(this.propertyName)) {
      regexes.push(Common.Color.Regex);
      processors.push(this.colorHandler);
    }
    if (this.angleHandler && metadata.isAngleAwareProperty(this.propertyName)) {
      regexes.push(InlineEditor.CSSAngleUtils.CSSAngleRegex);
      processors.push(this.angleHandler);
    }
    if (this.fontHandler && metadata.isFontAwareProperty(this.propertyName)) {
      if (this.propertyName === "font-family") {
        regexes.push(InlineEditor.FontEditorUtils.FontFamilyRegex);
      } else {
        regexes.push(InlineEditor.FontEditorUtils.FontPropertiesRegex);
      }
      processors.push(this.fontHandler);
    }
    if (Root.Runtime.experiments.isEnabled("cssTypeComponentLength") && this.lengthHandler) {
      regexes.push(InlineEditor.CSSLengthUtils.CSSLengthRegex);
      processors.push(this.lengthHandler);
    }
    const results = TextUtils.TextUtils.Utils.splitStringByRegexes(this.propertyValue, regexes);
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const processor = result.regexIndex === -1 ? document.createTextNode.bind(document) : processors[result.regexIndex];
      if (processor) {
        valueElement.appendChild(processor(result.value));
      }
    }
    valueElement.normalize();
    return valueElement;
  }
  processURL(text) {
    let url = text.substring(4, text.length - 1).trim();
    const isQuoted = /^'.*'$/s.test(url) || /^".*"$/s.test(url);
    if (isQuoted) {
      url = Common.ParsedURL.ParsedURL.substring(url, 1, url.length - 1);
    }
    const container = document.createDocumentFragment();
    UI.UIUtils.createTextChild(container, "url(");
    let hrefUrl = null;
    if (this.rule && this.rule.resourceURL()) {
      hrefUrl = Common.ParsedURL.ParsedURL.completeURL(this.rule.resourceURL(), url);
    } else if (this.node) {
      hrefUrl = this.node.resolveURL(url);
    }
    const link = ImagePreviewPopover.setImageUrl(Components.Linkifier.Linkifier.linkifyURL(hrefUrl || url, {
      text: url,
      preventClick: false,
      bypassURLTrimming: true,
      showColumnNumber: false,
      inlineFrameIndex: 0
    }), hrefUrl || url);
    container.appendChild(link);
    UI.UIUtils.createTextChild(container, ")");
    return container;
  }
}
let buttonProviderInstance;
export class ButtonProvider {
  button;
  constructor() {
    this.button = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.newStyleRule), "largeicon-add");
    this.button.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.clicked, this);
    const longclickTriangle = UI.Icon.Icon.create("largeicon-longclick-triangle", "long-click-glyph");
    this.button.element.appendChild(longclickTriangle);
    new UI.UIUtils.LongClickController(this.button.element, this.longClicked.bind(this));
    UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, onNodeChanged.bind(this));
    onNodeChanged.call(this);
    function onNodeChanged() {
      let node = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode);
      node = node ? node.enclosingElementOrSelf() : null;
      this.button.setEnabled(Boolean(node));
    }
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!buttonProviderInstance || forceNew) {
      buttonProviderInstance = new ButtonProvider();
    }
    return buttonProviderInstance;
  }
  clicked() {
    void StylesSidebarPane.instance().createNewRuleInViaInspectorStyleSheet();
  }
  longClicked(event) {
    StylesSidebarPane.instance().onAddButtonLongClick(event);
  }
  item() {
    return this.button;
  }
}
//# sourceMappingURL=StylesSidebarPane.js.map
