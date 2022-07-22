import * as LitHtml from "../../../ui/lit-html/lit-html.js";
export const primitiveRenderer = (value) => {
  return LitHtml.html`${value}`;
};
export const codeBlockRenderer = (value) => {
  if (!value) {
    return LitHtml.nothing;
  }
  const stringValue = String(value);
  return LitHtml.html`<code>${stringValue}</code>`;
};
//# sourceMappingURL=DataGridRenderers.js.map
