import * as SDK from "../../../../core/sdk/sdk.js";
import * as CssOverviewModule from "../../../../panels/css_overview/css_overview.js";
export const FontPropertiesRegex = /^[^- ][a-zA-Z-]+|-?\+?(?:[0-9]+\.[0-9]+|\.[0-9]+|[0-9]+)[a-zA-Z%]{0,4}/;
export const FontFamilyRegex = /(?:"[\w \,-]+",? ?|'[\w \,-]+',? ?|[\w \,-]+,? ?)+/;
const fontSizeRegex = /(^[\+\d\.]+)([a-zA-Z%]+)/;
const lineHeightRegex = /(^[\+\d\.]+)([a-zA-Z%]*)/;
const fontWeightRegex = /(^[\+\d\.]+)/;
const letterSpacingRegex = /([\+-0-9\.]+)([a-zA-Z%]+)/;
const fontSizeUnits = /* @__PURE__ */ new Set(["px", "em", "rem", "%", "vh", "vw"]);
const lineHeightUnits = /* @__PURE__ */ new Set(["", "px", "em", "%"]);
const letterSpacingUnits = /* @__PURE__ */ new Set(["em", "rem", "px"]);
const fontSizeKeyValuesArray = [
  "",
  "xx-small",
  "x-small",
  "smaller",
  "small",
  "medium",
  "large",
  "larger",
  "x-large",
  "xx-large"
];
const lineHeightKeyValuesArray = ["", "normal"];
const fontWeightKeyValuesArray = ["", "lighter", "normal", "bold", "bolder"];
const letterSpacingKeyValuesArray = ["", "normal"];
export const GlobalValues = ["inherit", "initial", "unset"];
fontSizeKeyValuesArray.push(...GlobalValues);
lineHeightKeyValuesArray.push(...GlobalValues);
fontWeightKeyValuesArray.push(...GlobalValues);
letterSpacingKeyValuesArray.push(...GlobalValues);
const fontSizeKeyValues = new Set(fontSizeKeyValuesArray);
const lineHeightKeyValues = new Set(lineHeightKeyValuesArray);
const fontWeightKeyValues = new Set(fontWeightKeyValuesArray);
const letterSpacingKeyValues = new Set(letterSpacingKeyValuesArray);
const fontSizeRangeMap = /* @__PURE__ */ new Map([
  ["px", { min: 0, max: 72, step: 1 }],
  ["em", { min: 0, max: 4.5, step: 0.1 }],
  ["rem", { min: 0, max: 4.5, step: 0.1 }],
  ["%", { min: 0, max: 450, step: 1 }],
  ["vh", { min: 0, max: 10, step: 0.1 }],
  ["vw", { min: 0, max: 10, step: 0.1 }],
  ["vmin", { min: 0, max: 10, step: 0.1 }],
  ["vmax", { min: 0, max: 10, step: 0.1 }],
  ["cm", { min: 0, max: 2, step: 0.1 }],
  ["mm", { min: 0, max: 20, step: 0.1 }],
  ["in", { min: 0, max: 1, step: 0.01 }],
  ["pt", { min: 0, max: 54, step: 1 }],
  ["pc", { min: 0, max: 4.5, step: 0.1 }]
]);
const lineHeightRangeMap = /* @__PURE__ */ new Map([
  ["", { min: 0, max: 2, step: 0.1 }],
  ["em", { min: 0, max: 2, step: 0.1 }],
  ["%", { min: 0, max: 200, step: 1 }],
  ["px", { min: 0, max: 32, step: 1 }],
  ["rem", { min: 0, max: 2, step: 0.1 }],
  ["vh", { min: 0, max: 4.5, step: 0.1 }],
  ["vw", { min: 0, max: 4.5, step: 0.1 }],
  ["vmin", { min: 0, max: 4.5, step: 0.1 }],
  ["vmax", { min: 0, max: 4.5, step: 0.1 }],
  ["cm", { min: 0, max: 1, step: 0.1 }],
  ["mm", { min: 0, max: 8.5, step: 0.1 }],
  ["in", { min: 0, max: 0.5, step: 0.1 }],
  ["pt", { min: 0, max: 24, step: 1 }],
  ["pc", { min: 0, max: 2, step: 0.1 }]
]);
const fontWeightRangeMap = /* @__PURE__ */ new Map([
  ["", { min: 100, max: 700, step: 100 }]
]);
const letterSpacingRangeMap = /* @__PURE__ */ new Map([
  ["px", { min: -10, max: 10, step: 0.01 }],
  ["em", { min: -0.625, max: 0.625, step: 1e-3 }],
  ["rem", { min: -0.625, max: 0.625, step: 1e-3 }],
  ["%", { min: -62.5, max: 62.5, step: 0.1 }],
  ["vh", { min: -1.5, max: 1.5, step: 0.01 }],
  ["vw", { min: -1.5, max: 1.5, step: 0.01 }],
  ["vmin", { min: -1.5, max: 1.5, step: 0.01 }],
  ["vmax", { min: -1.5, max: 1.5, step: 0.01 }],
  ["cm", { min: -0.25, max: 0.025, step: 1e-3 }],
  ["mm", { min: -2.5, max: 2.5, step: 0.01 }],
  ["in", { min: -0.1, max: 0.1, step: 1e-3 }],
  ["pt", { min: -7.5, max: 7.5, step: 0.01 }],
  ["pc", { min: -0.625, max: 0.625, step: 1e-3 }]
]);
export const FontSizeStaticParams = {
  regex: fontSizeRegex,
  units: fontSizeUnits,
  keyValues: fontSizeKeyValues,
  rangeMap: fontSizeRangeMap,
  defaultUnit: "px"
};
export const LineHeightStaticParams = {
  regex: lineHeightRegex,
  units: lineHeightUnits,
  keyValues: lineHeightKeyValues,
  rangeMap: lineHeightRangeMap,
  defaultUnit: ""
};
export const FontWeightStaticParams = {
  regex: fontWeightRegex,
  units: null,
  keyValues: fontWeightKeyValues,
  rangeMap: fontWeightRangeMap,
  defaultUnit: null
};
export const LetterSpacingStaticParams = {
  regex: letterSpacingRegex,
  units: letterSpacingUnits,
  keyValues: letterSpacingKeyValues,
  rangeMap: letterSpacingRangeMap,
  defaultUnit: "em"
};
export const SystemFonts = [
  "Arial",
  "Bookman",
  "Candara",
  "Comic Sans MS",
  "Courier New",
  "Garamond",
  "Georgia",
  "Helvetica",
  "Impact",
  "Palatino",
  "Roboto",
  "Times New Roman",
  "Verdana"
];
export const GenericFonts = [
  "serif",
  "sans-serif",
  "monspace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong"
];
export async function generateComputedFontArray() {
  const modelArray = SDK.TargetManager.TargetManager.instance().models(CssOverviewModule.CSSOverviewModel.CSSOverviewModel);
  if (modelArray) {
    const cssOverviewModel = modelArray[0];
    if (cssOverviewModel) {
      const { fontInfo } = await cssOverviewModel.getNodeStyleStats();
      const computedFontArray = Array.from(fontInfo.keys());
      return computedFontArray;
    }
  }
  return [];
}
export function getRoundingPrecision(step) {
  switch (step) {
    case 1:
      return 0;
    case 0.1:
      return 1;
    case 0.01:
      return 2;
    case 1e-3:
      return 3;
    default:
      return 0;
  }
}
//# sourceMappingURL=FontEditorUtils.js.map
