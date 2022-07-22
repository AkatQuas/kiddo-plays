import * as Common from "../../core/common/common.js";
import * as Root from "../../core/root/root.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as ColorPicker from "../../ui/legacy/components/color_picker/color_picker.js";
import * as Protocol from "../../generated/protocol.js";
import { CSSOverviewUnusedDeclarations } from "./CSSOverviewUnusedDeclarations.js";
export class CSSOverviewModel extends SDK.SDKModel.SDKModel {
  #runtimeAgent;
  #cssAgent;
  #domSnapshotAgent;
  #overlayAgent;
  constructor(target) {
    super(target);
    this.#runtimeAgent = target.runtimeAgent();
    this.#cssAgent = target.cssAgent();
    this.#domSnapshotAgent = target.domsnapshotAgent();
    this.#overlayAgent = target.overlayAgent();
  }
  highlightNode(node) {
    const highlightConfig = {
      contentColor: Common.Color.PageHighlight.Content.toProtocolRGBA(),
      showInfo: true,
      contrastAlgorithm: Root.Runtime.experiments.isEnabled("APCA") ? Protocol.Overlay.ContrastAlgorithm.Apca : Protocol.Overlay.ContrastAlgorithm.Aa
    };
    void this.#overlayAgent.invoke_hideHighlight();
    void this.#overlayAgent.invoke_highlightNode({ backendNodeId: node, highlightConfig });
  }
  async getNodeStyleStats() {
    const backgroundColors = /* @__PURE__ */ new Map();
    const textColors = /* @__PURE__ */ new Map();
    const textColorContrastIssues = /* @__PURE__ */ new Map();
    const fillColors = /* @__PURE__ */ new Map();
    const borderColors = /* @__PURE__ */ new Map();
    const fontInfo = /* @__PURE__ */ new Map();
    const unusedDeclarations = /* @__PURE__ */ new Map();
    const snapshotConfig = {
      computedStyles: [
        "background-color",
        "color",
        "fill",
        "border-top-width",
        "border-top-color",
        "border-bottom-width",
        "border-bottom-color",
        "border-left-width",
        "border-left-color",
        "border-right-width",
        "border-right-color",
        "font-family",
        "font-size",
        "font-weight",
        "line-height",
        "position",
        "top",
        "right",
        "bottom",
        "left",
        "display",
        "width",
        "height",
        "vertical-align"
      ],
      includeTextColorOpacities: true,
      includeBlendedBackgroundColors: true
    };
    const formatColor = (color) => {
      return color.hasAlpha() ? color.asString(Common.Color.Format.HEXA) : color.asString(Common.Color.Format.HEX);
    };
    const storeColor = (id, nodeId, target) => {
      if (id === -1) {
        return;
      }
      const colorText = strings[id];
      if (!colorText) {
        return;
      }
      const color = Common.Color.Color.parse(colorText);
      if (!color || color.rgba()[3] === 0) {
        return;
      }
      const colorFormatted = formatColor(color);
      if (!colorFormatted) {
        return;
      }
      const colorValues = target.get(colorFormatted) || /* @__PURE__ */ new Set();
      colorValues.add(nodeId);
      target.set(colorFormatted, colorValues);
      return color;
    };
    const isSVGNode = (nodeName) => {
      const validNodes = /* @__PURE__ */ new Set([
        "altglyph",
        "circle",
        "ellipse",
        "path",
        "polygon",
        "polyline",
        "rect",
        "svg",
        "text",
        "textpath",
        "tref",
        "tspan"
      ]);
      return validNodes.has(nodeName.toLowerCase());
    };
    const isReplacedContent = (nodeName) => {
      const validNodes = /* @__PURE__ */ new Set(["iframe", "video", "embed", "img"]);
      return validNodes.has(nodeName.toLowerCase());
    };
    const isTableElementWithDefaultStyles = (nodeName, display) => {
      const validNodes = /* @__PURE__ */ new Set(["tr", "td", "thead", "tbody"]);
      return validNodes.has(nodeName.toLowerCase()) && display.startsWith("table");
    };
    let elementCount = 0;
    const { documents, strings } = await this.#domSnapshotAgent.invoke_captureSnapshot(snapshotConfig);
    for (const { nodes, layout } of documents) {
      elementCount += layout.nodeIndex.length;
      for (let idx = 0; idx < layout.styles.length; idx++) {
        const styles = layout.styles[idx];
        const nodeIdx = layout.nodeIndex[idx];
        if (!nodes.backendNodeId || !nodes.nodeName) {
          continue;
        }
        const nodeId = nodes.backendNodeId[nodeIdx];
        const nodeName = nodes.nodeName[nodeIdx];
        const [backgroundColorIdx, textColorIdx, fillIdx, borderTopWidthIdx, borderTopColorIdx, borderBottomWidthIdx, borderBottomColorIdx, borderLeftWidthIdx, borderLeftColorIdx, borderRightWidthIdx, borderRightColorIdx, fontFamilyIdx, fontSizeIdx, fontWeightIdx, lineHeightIdx, positionIdx, topIdx, rightIdx, bottomIdx, leftIdx, displayIdx, widthIdx, heightIdx, verticalAlignIdx] = styles;
        storeColor(backgroundColorIdx, nodeId, backgroundColors);
        const textColor = storeColor(textColorIdx, nodeId, textColors);
        if (isSVGNode(strings[nodeName])) {
          storeColor(fillIdx, nodeId, fillColors);
        }
        if (strings[borderTopWidthIdx] !== "0px") {
          storeColor(borderTopColorIdx, nodeId, borderColors);
        }
        if (strings[borderBottomWidthIdx] !== "0px") {
          storeColor(borderBottomColorIdx, nodeId, borderColors);
        }
        if (strings[borderLeftWidthIdx] !== "0px") {
          storeColor(borderLeftColorIdx, nodeId, borderColors);
        }
        if (strings[borderRightWidthIdx] !== "0px") {
          storeColor(borderRightColorIdx, nodeId, borderColors);
        }
        if (fontFamilyIdx && fontFamilyIdx !== -1) {
          const fontFamily = strings[fontFamilyIdx];
          const fontFamilyInfo = fontInfo.get(fontFamily) || /* @__PURE__ */ new Map();
          const sizeLabel = "font-size";
          const weightLabel = "font-weight";
          const lineHeightLabel = "line-height";
          const size = fontFamilyInfo.get(sizeLabel) || /* @__PURE__ */ new Map();
          const weight = fontFamilyInfo.get(weightLabel) || /* @__PURE__ */ new Map();
          const lineHeight = fontFamilyInfo.get(lineHeightLabel) || /* @__PURE__ */ new Map();
          if (fontSizeIdx !== -1) {
            const fontSizeValue = strings[fontSizeIdx];
            const nodes2 = size.get(fontSizeValue) || [];
            nodes2.push(nodeId);
            size.set(fontSizeValue, nodes2);
          }
          if (fontWeightIdx !== -1) {
            const fontWeightValue = strings[fontWeightIdx];
            const nodes2 = weight.get(fontWeightValue) || [];
            nodes2.push(nodeId);
            weight.set(fontWeightValue, nodes2);
          }
          if (lineHeightIdx !== -1) {
            const lineHeightValue = strings[lineHeightIdx];
            const nodes2 = lineHeight.get(lineHeightValue) || [];
            nodes2.push(nodeId);
            lineHeight.set(lineHeightValue, nodes2);
          }
          fontFamilyInfo.set(sizeLabel, size);
          fontFamilyInfo.set(weightLabel, weight);
          fontFamilyInfo.set(lineHeightLabel, lineHeight);
          fontInfo.set(fontFamily, fontFamilyInfo);
        }
        const blendedBackgroundColor = textColor && layout.blendedBackgroundColors && layout.blendedBackgroundColors[idx] !== -1 ? Common.Color.Color.parse(strings[layout.blendedBackgroundColors[idx]]) : null;
        if (textColor && blendedBackgroundColor) {
          const contrastInfo = new ColorPicker.ContrastInfo.ContrastInfo({
            backgroundColors: [blendedBackgroundColor.asString(Common.Color.Format.HEXA)],
            computedFontSize: fontSizeIdx !== -1 ? strings[fontSizeIdx] : "",
            computedFontWeight: fontWeightIdx !== -1 ? strings[fontWeightIdx] : ""
          });
          const blendedTextColor = textColor.blendWithAlpha(layout.textColorOpacities ? layout.textColorOpacities[idx] : 1);
          contrastInfo.setColor(blendedTextColor);
          const formattedTextColor = formatColor(blendedTextColor);
          const formattedBackgroundColor = formatColor(blendedBackgroundColor);
          const key = `${formattedTextColor}_${formattedBackgroundColor}`;
          if (Root.Runtime.experiments.isEnabled("APCA")) {
            const contrastRatio = contrastInfo.contrastRatioAPCA();
            const threshold = contrastInfo.contrastRatioAPCAThreshold();
            const passes = contrastRatio && threshold ? Math.abs(contrastRatio) >= threshold : false;
            if (!passes) {
              const issue = {
                nodeId,
                contrastRatio,
                textColor: blendedTextColor,
                backgroundColor: blendedBackgroundColor,
                thresholdsViolated: {
                  aa: false,
                  aaa: false,
                  apca: true
                }
              };
              if (textColorContrastIssues.has(key)) {
                textColorContrastIssues.get(key).push(issue);
              } else {
                textColorContrastIssues.set(key, [issue]);
              }
            }
          } else {
            const aaThreshold = contrastInfo.contrastRatioThreshold("aa") || 0;
            const aaaThreshold = contrastInfo.contrastRatioThreshold("aaa") || 0;
            const contrastRatio = contrastInfo.contrastRatio() || 0;
            if (aaThreshold > contrastRatio || aaaThreshold > contrastRatio) {
              const issue = {
                nodeId,
                contrastRatio,
                textColor: blendedTextColor,
                backgroundColor: blendedBackgroundColor,
                thresholdsViolated: {
                  aa: aaThreshold > contrastRatio,
                  aaa: aaaThreshold > contrastRatio,
                  apca: false
                }
              };
              if (textColorContrastIssues.has(key)) {
                textColorContrastIssues.get(key).push(issue);
              } else {
                textColorContrastIssues.set(key, [issue]);
              }
            }
          }
        }
        CSSOverviewUnusedDeclarations.checkForUnusedPositionValues(unusedDeclarations, nodeId, strings, positionIdx, topIdx, leftIdx, rightIdx, bottomIdx);
        if (!isSVGNode(strings[nodeName]) && !isReplacedContent(strings[nodeName])) {
          CSSOverviewUnusedDeclarations.checkForUnusedWidthAndHeightValues(unusedDeclarations, nodeId, strings, displayIdx, widthIdx, heightIdx);
        }
        if (verticalAlignIdx !== -1 && !isTableElementWithDefaultStyles(strings[nodeName], strings[displayIdx])) {
          CSSOverviewUnusedDeclarations.checkForInvalidVerticalAlignment(unusedDeclarations, nodeId, strings, displayIdx, verticalAlignIdx);
        }
      }
    }
    return {
      backgroundColors,
      textColors,
      textColorContrastIssues,
      fillColors,
      borderColors,
      fontInfo,
      unusedDeclarations,
      elementCount
    };
  }
  getComputedStyleForNode(nodeId) {
    return this.#cssAgent.invoke_getComputedStyleForNode({ nodeId });
  }
  async getMediaQueries() {
    const queries = await this.#cssAgent.invoke_getMediaQueries();
    const queryMap = /* @__PURE__ */ new Map();
    if (!queries) {
      return queryMap;
    }
    for (const query of queries.medias) {
      if (query.source === "linkedSheet") {
        continue;
      }
      const entries = queryMap.get(query.text) || [];
      entries.push(query);
      queryMap.set(query.text, entries);
    }
    return queryMap;
  }
  async getGlobalStylesheetStats() {
    const expression = `(function() {
      let styleRules = 0;
      let inlineStyles = 0;
      let externalSheets = 0;
      const stats = {
        // Simple.
        type: new Set(),
        class: new Set(),
        id: new Set(),
        universal: new Set(),
        attribute: new Set(),

        // Non-simple.
        nonSimple: new Set()
      };

      for (const styleSheet of document.styleSheets) {
        if (styleSheet.href) {
          externalSheets++;
        } else {
          inlineStyles++;
        }

        // Attempting to grab rules can trigger a DOMException.
        // Try it and if it fails skip to the next stylesheet.
        let rules;
        try {
          rules = styleSheet.rules;
        } catch (err) {
          continue;
        }

        for (const rule of rules) {
          if ('selectorText' in rule) {
            styleRules++;

            // Each group that was used.
            for (const selectorGroup of rule.selectorText.split(',')) {
              // Each selector in the group.
              for (const selector of selectorGroup.split(/[\\t\\n\\f\\r ]+/g)) {
                if (selector.startsWith('.')) {
                  // Class.
                  stats.class.add(selector);
                } else if (selector.startsWith('#')) {
                  // Id.
                  stats.id.add(selector);
                } else if (selector.startsWith('*')) {
                  // Universal.
                  stats.universal.add(selector);
                } else if (selector.startsWith('[')) {
                  // Attribute.
                  stats.attribute.add(selector);
                } else {
                  // Type or non-simple selector.
                  const specialChars = /[#.:\\[\\]|\\+>~]/;
                  if (specialChars.test(selector)) {
                    stats.nonSimple.add(selector);
                  } else {
                    stats.type.add(selector);
                  }
                }
              }
            }
          }
        }
      }

      return {
        styleRules,
        inlineStyles,
        externalSheets,
        stats: {
          // Simple.
          type: stats.type.size,
          class: stats.class.size,
          id: stats.id.size,
          universal: stats.universal.size,
          attribute: stats.attribute.size,

          // Non-simple.
          nonSimple: stats.nonSimple.size
        }
      }
    })()`;
    const { result } = await this.#runtimeAgent.invoke_evaluate({ expression, returnByValue: true });
    if (result.type !== "object") {
      return;
    }
    return result.value;
  }
}
SDK.SDKModel.SDKModel.register(CSSOverviewModel, { capabilities: SDK.Target.Capability.DOM, autostart: false });
//# sourceMappingURL=CSSOverviewModel.js.map
