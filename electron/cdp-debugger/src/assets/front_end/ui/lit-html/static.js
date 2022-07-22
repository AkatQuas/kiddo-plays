import * as LitHtml from "../../third_party/lit-html/lit-html.js";
export function flattenTemplate(strings, ...values) {
  const valueMap = [];
  const newStrings = [];
  let buffer = "";
  for (let v = 0; v < values.length; v++) {
    const possibleStatic = values[v];
    if (isStaticLiteral(possibleStatic)) {
      buffer += strings[v] + possibleStatic.value;
      valueMap.push(false);
    } else {
      buffer += strings[v];
      newStrings.push(buffer);
      buffer = "";
      valueMap.push(true);
    }
  }
  newStrings.push(buffer + strings[values.length]);
  newStrings.raw = [...newStrings];
  return { strings: newStrings, valueMap };
}
export function html(strings, ...values) {
  if (values.some((value) => isStaticLiteral(value))) {
    return htmlWithStatics(strings, ...values);
  }
  return LitHtml.html(strings, ...values);
}
export function literal(value) {
  return {
    value: value[0],
    $$static$$: true
  };
}
function isStaticLiteral(item) {
  return typeof item === "object" && (item !== null && "$$static$$" in item);
}
const flattenedTemplates = /* @__PURE__ */ new WeakMap();
function htmlWithStatics(strings, ...values) {
  const existing = flattenedTemplates.get(strings);
  if (existing) {
    const filteredValues = values.filter((a, index) => {
      if (!existing) {
        return false;
      }
      return existing.valueMap[index];
    });
    return LitHtml.html(existing.strings, ...filteredValues);
  }
  flattenedTemplates.set(strings, flattenTemplate(strings, ...values));
  return htmlWithStatics(strings, ...values);
}
//# sourceMappingURL=static.js.map
