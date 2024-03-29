import * as i18n from "../../core/i18n/i18n.js";
const UIStrings = {
  topAppliedToAStatically: "`Top` applied to a statically positioned element",
  leftAppliedToAStatically: "`Left` applied to a statically positioned element",
  rightAppliedToAStatically: "`Right` applied to a statically positioned element",
  bottomAppliedToAStatically: "`Bottom` applied to a statically positioned element",
  widthAppliedToAnInlineElement: "`Width` applied to an inline element",
  heightAppliedToAnInlineElement: "`Height` applied to an inline element",
  verticalAlignmentAppliedTo: "Vertical alignment applied to element which is neither `inline` nor `table-cell`"
};
const str_ = i18n.i18n.registerUIStrings("panels/css_overview/CSSOverviewUnusedDeclarations.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class CSSOverviewUnusedDeclarations {
  static add(target, key, item) {
    const values = target.get(key) || [];
    values.push(item);
    target.set(key, values);
  }
  static checkForUnusedPositionValues(unusedDeclarations, nodeId, strings, positionIdx, topIdx, leftIdx, rightIdx, bottomIdx) {
    if (strings[positionIdx] !== "static") {
      return;
    }
    if (strings[topIdx] !== "auto") {
      const reason = i18nString(UIStrings.topAppliedToAStatically);
      this.add(unusedDeclarations, reason, {
        declaration: `top: ${strings[topIdx]}`,
        nodeId
      });
    }
    if (strings[leftIdx] !== "auto") {
      const reason = i18nString(UIStrings.leftAppliedToAStatically);
      this.add(unusedDeclarations, reason, {
        declaration: `left: ${strings[leftIdx]}`,
        nodeId
      });
    }
    if (strings[rightIdx] !== "auto") {
      const reason = i18nString(UIStrings.rightAppliedToAStatically);
      this.add(unusedDeclarations, reason, {
        declaration: `right: ${strings[rightIdx]}`,
        nodeId
      });
    }
    if (strings[bottomIdx] !== "auto") {
      const reason = i18nString(UIStrings.bottomAppliedToAStatically);
      this.add(unusedDeclarations, reason, {
        declaration: `bottom: ${strings[bottomIdx]}`,
        nodeId
      });
    }
  }
  static checkForUnusedWidthAndHeightValues(unusedDeclarations, nodeId, strings, displayIdx, widthIdx, heightIdx) {
    if (strings[displayIdx] !== "inline") {
      return;
    }
    if (strings[widthIdx] !== "auto") {
      const reason = i18nString(UIStrings.widthAppliedToAnInlineElement);
      this.add(unusedDeclarations, reason, {
        declaration: `width: ${strings[widthIdx]}`,
        nodeId
      });
    }
    if (strings[heightIdx] !== "auto") {
      const reason = i18nString(UIStrings.heightAppliedToAnInlineElement);
      this.add(unusedDeclarations, reason, {
        declaration: `height: ${strings[heightIdx]}`,
        nodeId
      });
    }
  }
  static checkForInvalidVerticalAlignment(unusedDeclarations, nodeId, strings, displayIdx, verticalAlignIdx) {
    if (!strings[displayIdx] || strings[displayIdx] === "inline" || strings[displayIdx].startsWith("table")) {
      return;
    }
    if (strings[verticalAlignIdx] !== "baseline") {
      const reason = i18nString(UIStrings.verticalAlignmentAppliedTo);
      this.add(unusedDeclarations, reason, {
        declaration: `vertical-align: ${strings[verticalAlignIdx]}`,
        nodeId
      });
    }
  }
}
//# sourceMappingURL=CSSOverviewUnusedDeclarations.js.map
