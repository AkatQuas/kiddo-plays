import * as Common from "../../core/common/common.js";
import * as Platform from "../../core/platform/platform.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as UI from "../../ui/legacy/legacy.js";
import { ElementsSidebarPane } from "./ElementsSidebarPane.js";
import metricsSidebarPaneStyles from "./metricsSidebarPane.css.js";
export class MetricsSidebarPane extends ElementsSidebarPane {
  originalPropertyData;
  previousPropertyDataCandidate;
  inlineStyle;
  highlightMode;
  boxElements;
  isEditingMetrics;
  constructor() {
    super();
    this.originalPropertyData = null;
    this.previousPropertyDataCandidate = null;
    this.inlineStyle = null;
    this.highlightMode = "";
    this.boxElements = [];
  }
  doUpdate() {
    if (this.isEditingMetrics) {
      return Promise.resolve();
    }
    const node = this.node();
    const cssModel = this.cssModel();
    if (!node || node.nodeType() !== Node.ELEMENT_NODE || !cssModel) {
      this.contentElement.removeChildren();
      this.element.classList.add("collapsed");
      return Promise.resolve();
    }
    function callback(style) {
      if (!style || this.node() !== node) {
        return;
      }
      this.updateMetrics(style);
    }
    if (!node.id) {
      return Promise.resolve();
    }
    const promises = [
      cssModel.getComputedStyle(node.id).then(callback.bind(this)),
      cssModel.getInlineStyles(node.id).then((inlineStyleResult) => {
        if (inlineStyleResult && this.node() === node) {
          this.inlineStyle = inlineStyleResult.inlineStyle;
        }
      })
    ];
    return Promise.all(promises);
  }
  onCSSModelChanged() {
    this.update();
  }
  toggleVisibility(isVisible) {
    this.element.classList.toggle("invisible", !isVisible);
  }
  getPropertyValueAsPx(style, propertyName) {
    const propertyValue = style.get(propertyName);
    if (!propertyValue) {
      return 0;
    }
    return Number(propertyValue.replace(/px$/, "") || 0);
  }
  getBox(computedStyle, componentName) {
    const suffix = componentName === "border" ? "-width" : "";
    const left = this.getPropertyValueAsPx(computedStyle, componentName + "-left" + suffix);
    const top = this.getPropertyValueAsPx(computedStyle, componentName + "-top" + suffix);
    const right = this.getPropertyValueAsPx(computedStyle, componentName + "-right" + suffix);
    const bottom = this.getPropertyValueAsPx(computedStyle, componentName + "-bottom" + suffix);
    return { left, top, right, bottom };
  }
  highlightDOMNode(showHighlight, mode, event) {
    event.consume();
    const node = this.node();
    if (showHighlight && node) {
      if (this.highlightMode === mode) {
        return;
      }
      this.highlightMode = mode;
      node.highlight(mode);
    } else {
      this.highlightMode = "";
      SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
    }
    for (const { element, name, backgroundColor } of this.boxElements) {
      const shouldHighlight = !node || mode === "all" || name === mode;
      element.style.backgroundColor = shouldHighlight ? backgroundColor : "";
      element.classList.toggle("highlighted", shouldHighlight);
    }
  }
  updateMetrics(style) {
    const metricsElement = document.createElement("div");
    metricsElement.className = "metrics";
    const self = this;
    function createBoxPartElement(style2, name, side, suffix) {
      const element = document.createElement("div");
      element.className = side;
      const propertyName = (name !== "position" ? name + "-" : "") + side + suffix;
      let value = style2.get(propertyName);
      if (value === void 0) {
        return element;
      }
      if (value === "" || name !== "position" && value === "0px") {
        value = "\u2012";
      } else if (name === "position" && value === "auto") {
        value = "\u2012";
      }
      value = value.replace(/px$/, "");
      value = Platform.NumberUtilities.toFixedIfFloating(value);
      element.textContent = value;
      element.addEventListener("dblclick", this.startEditing.bind(this, element, name, propertyName, style2), false);
      return element;
    }
    function getContentAreaWidthPx(style2) {
      let width = style2.get("width");
      if (!width) {
        return "";
      }
      width = width.replace(/px$/, "");
      const widthValue = Number(width);
      if (!isNaN(widthValue) && style2.get("box-sizing") === "border-box") {
        const borderBox = self.getBox(style2, "border");
        const paddingBox = self.getBox(style2, "padding");
        width = (widthValue - borderBox.left - borderBox.right - paddingBox.left - paddingBox.right).toString();
      }
      return Platform.NumberUtilities.toFixedIfFloating(width);
    }
    function getContentAreaHeightPx(style2) {
      let height = style2.get("height");
      if (!height) {
        return "";
      }
      height = height.replace(/px$/, "");
      const heightValue = Number(height);
      if (!isNaN(heightValue) && style2.get("box-sizing") === "border-box") {
        const borderBox = self.getBox(style2, "border");
        const paddingBox = self.getBox(style2, "padding");
        height = (heightValue - borderBox.top - borderBox.bottom - paddingBox.top - paddingBox.bottom).toString();
      }
      return Platform.NumberUtilities.toFixedIfFloating(height);
    }
    const noMarginDisplayType = /* @__PURE__ */ new Set([
      "table-cell",
      "table-column",
      "table-column-group",
      "table-footer-group",
      "table-header-group",
      "table-row",
      "table-row-group"
    ]);
    const noPaddingDisplayType = /* @__PURE__ */ new Set([
      "table-column",
      "table-column-group",
      "table-footer-group",
      "table-header-group",
      "table-row",
      "table-row-group"
    ]);
    const noPositionType = /* @__PURE__ */ new Set(["static"]);
    const boxes = ["content", "padding", "border", "margin", "position"];
    const boxColors = [
      Common.Color.PageHighlight.Content,
      Common.Color.PageHighlight.Padding,
      Common.Color.PageHighlight.Border,
      Common.Color.PageHighlight.Margin,
      Common.Color.Color.fromRGBA([0, 0, 0, 0])
    ];
    const boxLabels = ["content", "padding", "border", "margin", "position"];
    let previousBox = null;
    this.boxElements = [];
    for (let i = 0; i < boxes.length; ++i) {
      const name = boxes[i];
      const display = style.get("display");
      const position = style.get("position");
      if (!display || !position) {
        continue;
      }
      if (name === "margin" && noMarginDisplayType.has(display)) {
        continue;
      }
      if (name === "padding" && noPaddingDisplayType.has(display)) {
        continue;
      }
      if (name === "position" && noPositionType.has(position)) {
        continue;
      }
      const boxElement = document.createElement("div");
      boxElement.className = `${name} highlighted`;
      const backgroundColor = boxColors[i].asString(Common.Color.Format.RGBA) || "";
      boxElement.style.backgroundColor = backgroundColor;
      boxElement.addEventListener("mouseover", this.highlightDOMNode.bind(this, true, name === "position" ? "all" : name), false);
      this.boxElements.push({ element: boxElement, name, backgroundColor });
      if (name === "content") {
        const widthElement = document.createElement("span");
        widthElement.textContent = getContentAreaWidthPx(style);
        widthElement.addEventListener("dblclick", this.startEditing.bind(this, widthElement, "width", "width", style), false);
        const heightElement = document.createElement("span");
        heightElement.textContent = getContentAreaHeightPx(style);
        heightElement.addEventListener("dblclick", this.startEditing.bind(this, heightElement, "height", "height", style), false);
        const timesElement = document.createElement("span");
        timesElement.textContent = " \xD7 ";
        boxElement.appendChild(widthElement);
        boxElement.appendChild(timesElement);
        boxElement.appendChild(heightElement);
      } else {
        const suffix = name === "border" ? "-width" : "";
        const labelElement = document.createElement("div");
        labelElement.className = "label";
        labelElement.textContent = boxLabels[i];
        boxElement.appendChild(labelElement);
        boxElement.appendChild(createBoxPartElement.call(this, style, name, "top", suffix));
        boxElement.appendChild(document.createElement("br"));
        boxElement.appendChild(createBoxPartElement.call(this, style, name, "left", suffix));
        if (previousBox) {
          boxElement.appendChild(previousBox);
        }
        boxElement.appendChild(createBoxPartElement.call(this, style, name, "right", suffix));
        boxElement.appendChild(document.createElement("br"));
        boxElement.appendChild(createBoxPartElement.call(this, style, name, "bottom", suffix));
      }
      previousBox = boxElement;
    }
    metricsElement.appendChild(previousBox);
    metricsElement.addEventListener("mouseover", this.highlightDOMNode.bind(this, false, "all"), false);
    metricsElement.addEventListener("mouseleave", this.highlightDOMNode.bind(this, false, "all"), false);
    this.contentElement.removeChildren();
    this.contentElement.appendChild(metricsElement);
    this.element.classList.remove("collapsed");
  }
  startEditing(targetElement, box, styleProperty, computedStyle) {
    if (UI.UIUtils.isBeingEdited(targetElement)) {
      return;
    }
    const context = { box, styleProperty, computedStyle, keyDownHandler: () => {
    } };
    const boundKeyDown = this.handleKeyDown.bind(this, context);
    context.keyDownHandler = boundKeyDown;
    targetElement.addEventListener("keydown", boundKeyDown, false);
    this.isEditingMetrics = true;
    const config = new UI.InplaceEditor.Config(this.editingCommitted.bind(this), this.editingCancelled.bind(this), context);
    UI.InplaceEditor.InplaceEditor.startEditing(targetElement, config);
    const selection = targetElement.getComponentSelection();
    selection && selection.selectAllChildren(targetElement);
  }
  handleKeyDown(context, event) {
    const element = event.currentTarget;
    function finishHandler(originalValue, replacementString) {
      this.applyUserInput(element, replacementString, originalValue, context, false);
    }
    function customNumberHandler(prefix, number, suffix) {
      if (context.styleProperty !== "margin" && number < 0) {
        number = 0;
      }
      return prefix + number + suffix;
    }
    UI.UIUtils.handleElementValueModifications(event, element, finishHandler.bind(this), void 0, customNumberHandler);
  }
  editingEnded(element, context) {
    this.originalPropertyData = null;
    this.previousPropertyDataCandidate = null;
    element.removeEventListener("keydown", context.keyDownHandler, false);
    delete this.isEditingMetrics;
  }
  editingCancelled(element, context) {
    if (this.inlineStyle) {
      if (!this.originalPropertyData) {
        const pastLastSourcePropertyIndex = this.inlineStyle.pastLastSourcePropertyIndex();
        if (pastLastSourcePropertyIndex) {
          void this.inlineStyle.allProperties()[pastLastSourcePropertyIndex - 1].setText("", false);
        }
      } else {
        void this.inlineStyle.allProperties()[this.originalPropertyData.index].setText(this.originalPropertyData.propertyText || "", false);
      }
    }
    this.editingEnded(element, context);
    this.update();
  }
  applyUserInput(element, userInput, previousContent, context, commitEditor) {
    if (!this.inlineStyle) {
      return this.editingCancelled(element, context);
    }
    if (commitEditor && userInput === previousContent) {
      return this.editingCancelled(element, context);
    }
    if (context.box !== "position" && (!userInput || userInput === "\u2012")) {
      userInput = "0px";
    } else if (context.box === "position" && (!userInput || userInput === "\u2012")) {
      userInput = "auto";
    }
    userInput = userInput.toLowerCase();
    if (/^\d+$/.test(userInput)) {
      userInput += "px";
    }
    const styleProperty = context.styleProperty;
    const computedStyle = context.computedStyle;
    if (computedStyle.get("box-sizing") === "border-box" && (styleProperty === "width" || styleProperty === "height")) {
      if (!userInput.match(/px$/)) {
        Common.Console.Console.instance().error("For elements with box-sizing: border-box, only absolute content area dimensions can be applied");
        return;
      }
      const borderBox = this.getBox(computedStyle, "border");
      const paddingBox = this.getBox(computedStyle, "padding");
      let userValuePx = Number(userInput.replace(/px$/, ""));
      if (isNaN(userValuePx)) {
        return;
      }
      if (styleProperty === "width") {
        userValuePx += borderBox.left + borderBox.right + paddingBox.left + paddingBox.right;
      } else {
        userValuePx += borderBox.top + borderBox.bottom + paddingBox.top + paddingBox.bottom;
      }
      userInput = userValuePx + "px";
    }
    this.previousPropertyDataCandidate = null;
    const allProperties = this.inlineStyle.allProperties();
    for (let i = 0; i < allProperties.length; ++i) {
      const property = allProperties[i];
      if (property.name !== context.styleProperty || !property.activeInStyle()) {
        continue;
      }
      this.previousPropertyDataCandidate = property;
      property.setValue(userInput, commitEditor, true, callback.bind(this));
      return;
    }
    this.inlineStyle.appendProperty(context.styleProperty, userInput, callback.bind(this));
    function callback(success) {
      if (!success) {
        return;
      }
      if (!this.originalPropertyData) {
        this.originalPropertyData = this.previousPropertyDataCandidate;
      }
      if (this.highlightMode) {
        const node = this.node();
        if (!node) {
          return;
        }
        node.highlight(this.highlightMode);
      }
      if (commitEditor) {
        this.update();
      }
    }
  }
  editingCommitted(element, userInput, previousContent, context) {
    this.editingEnded(element, context);
    this.applyUserInput(element, userInput, previousContent, context, true);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([metricsSidebarPaneStyles]);
  }
}
//# sourceMappingURL=MetricsSidebarPane.js.map
