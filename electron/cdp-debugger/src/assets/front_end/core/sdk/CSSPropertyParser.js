const globalValues = /* @__PURE__ */ new Set(["inherit", "initial", "unset"]);
const tagRegexp = /[\x20-\x7E]{4}/;
const numRegexp = /[+-]?(?:\d*\.)?\d+(?:[eE]\d+)?/;
const fontVariationSettingsRegexp = new RegExp(`(?:'(${tagRegexp.source})')|(?:"(${tagRegexp.source})")\\s+(${numRegexp.source})`);
export function parseFontVariationSettings(value) {
  if (globalValues.has(value.trim()) || value.trim() === "normal") {
    return [];
  }
  const results = [];
  for (const setting of splitByComma(stripComments(value))) {
    const match = setting.match(fontVariationSettingsRegexp);
    if (match) {
      results.push({
        tag: match[1] || match[2],
        value: parseFloat(match[3])
      });
    }
  }
  return results;
}
const fontFamilyRegexp = /^"(.+)"|'(.+)'$/;
export function parseFontFamily(value) {
  if (globalValues.has(value.trim())) {
    return [];
  }
  const results = [];
  for (const family of splitByComma(stripComments(value))) {
    const match = family.match(fontFamilyRegexp);
    if (match) {
      results.push(match[1] || match[2]);
    } else {
      results.push(family);
    }
  }
  return results;
}
export function splitByComma(value) {
  return value.split(",").map((part) => part.trim());
}
export function stripComments(value) {
  return value.replaceAll(/(\/\*(?:.|\s)*?\*\/)/g, "");
}
//# sourceMappingURL=CSSPropertyParser.js.map
