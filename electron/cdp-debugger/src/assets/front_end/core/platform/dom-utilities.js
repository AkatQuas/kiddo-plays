export function deepActiveElement(doc) {
  let activeElement = doc.activeElement;
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}
//# sourceMappingURL=dom-utilities.js.map
