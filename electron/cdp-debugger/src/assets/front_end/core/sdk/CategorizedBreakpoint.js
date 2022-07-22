export class CategorizedBreakpoint {
  #categoryInternal;
  titleInternal;
  enabledInternal;
  constructor(category, title) {
    this.#categoryInternal = category;
    this.titleInternal = title;
    this.enabledInternal = false;
  }
  category() {
    return this.#categoryInternal;
  }
  enabled() {
    return this.enabledInternal;
  }
  setEnabled(enabled) {
    this.enabledInternal = enabled;
  }
  title() {
    return this.titleInternal;
  }
  setTitle(title) {
    this.titleInternal = title;
  }
}
//# sourceMappingURL=CategorizedBreakpoint.js.map
