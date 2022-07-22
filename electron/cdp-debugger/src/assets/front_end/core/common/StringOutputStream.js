export class StringOutputStream {
  #dataInternal;
  constructor() {
    this.#dataInternal = "";
  }
  async write(chunk) {
    this.#dataInternal += chunk;
  }
  async close() {
  }
  data() {
    return this.#dataInternal;
  }
}
//# sourceMappingURL=StringOutputStream.js.map
