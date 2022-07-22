export class LiveLocationWithPool {
  #updateDelegate;
  #locationPool;
  #updatePromise;
  constructor(updateDelegate, locationPool) {
    this.#updateDelegate = updateDelegate;
    this.#locationPool = locationPool;
    this.#locationPool.add(this);
    this.#updatePromise = null;
  }
  async update() {
    if (!this.#updateDelegate) {
      return;
    }
    if (this.#updatePromise) {
      await this.#updatePromise.then(() => this.update());
    } else {
      this.#updatePromise = this.#updateDelegate(this);
      await this.#updatePromise;
      this.#updatePromise = null;
    }
  }
  async uiLocation() {
    throw "Not implemented";
  }
  dispose() {
    this.#locationPool.delete(this);
    this.#updateDelegate = null;
  }
  isDisposed() {
    return !this.#locationPool.has(this);
  }
  async isIgnoreListed() {
    throw "Not implemented";
  }
}
export class LiveLocationPool {
  #locations;
  constructor() {
    this.#locations = /* @__PURE__ */ new Set();
  }
  add(location) {
    this.#locations.add(location);
  }
  delete(location) {
    this.#locations.delete(location);
  }
  has(location) {
    return this.#locations.has(location);
  }
  disposeAll() {
    for (const location of this.#locations) {
      location.dispose();
    }
  }
}
//# sourceMappingURL=LiveLocation.js.map
