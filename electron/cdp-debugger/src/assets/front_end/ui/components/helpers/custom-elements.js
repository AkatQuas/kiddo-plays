export function defineComponent(tagName, componentClass) {
  if (customElements.get(tagName)) {
    console.error(`${tagName} already defined!`);
    return;
  }
  customElements.define(tagName, componentClass);
}
//# sourceMappingURL=custom-elements.js.map
