export var LengthUnit = /* @__PURE__ */ ((LengthUnit2) => {
  LengthUnit2["PIXEL"] = "px";
  LengthUnit2["CENTIMETER"] = "cm";
  LengthUnit2["MILLIMETER"] = "mm";
  LengthUnit2["INCH"] = "in";
  LengthUnit2["PICA"] = "pc";
  LengthUnit2["POINT"] = "pt";
  LengthUnit2["CH"] = "ch";
  LengthUnit2["EM"] = "em";
  LengthUnit2["REM"] = "rem";
  LengthUnit2["VH"] = "vh";
  LengthUnit2["VW"] = "vw";
  LengthUnit2["VMIN"] = "vmin";
  LengthUnit2["VMAX"] = "vmax";
  return LengthUnit2;
})(LengthUnit || {});
export const LENGTH_UNITS = [
  "px" /* PIXEL */,
  "cm" /* CENTIMETER */,
  "mm" /* MILLIMETER */,
  "in" /* INCH */,
  "pc" /* PICA */,
  "pt" /* POINT */,
  "ch" /* CH */,
  "em" /* EM */,
  "rem" /* REM */,
  "vh" /* VH */,
  "vw" /* VW */,
  "vmin" /* VMIN */,
  "vmax" /* VMAX */
];
export const CSSLengthRegex = new RegExp(`(?<value>[+-]?\\d*\\.?\\d+)(?<unit>${LENGTH_UNITS.join("|")})`);
export const parseText = (text) => {
  const result = text.match(CSSLengthRegex);
  if (!result || !result.groups) {
    return null;
  }
  return {
    value: Number(result.groups.value),
    unit: result.groups.unit
  };
};
//# sourceMappingURL=CSSLengthUtils.js.map
