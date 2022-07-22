export function registerCustomElement(localName, typeExtension, definition) {
  self.customElements.define(typeExtension, class extends definition {
    constructor() {
      super();
      this.setAttribute("is", typeExtension);
    }
  }, { extends: localName });
  return () => document.createElement(localName, { is: typeExtension });
}
//# sourceMappingURL=register-custom-element.js.map
