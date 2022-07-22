export class Mutex {
  #locked = false;
  #acquiringQueue = [];
  acquire() {
    let resolver = (_release) => {
    };
    const promise = new Promise((resolve) => {
      resolver = resolve;
    });
    this.#acquiringQueue.push(resolver);
    this.#processAcquiringQueue();
    return promise;
  }
  #processAcquiringQueue() {
    if (this.#locked) {
      return;
    }
    const nextAquirePromise = this.#acquiringQueue.shift();
    if (nextAquirePromise) {
      this.#locked = true;
      nextAquirePromise(this.#release.bind(this));
    }
  }
  #release() {
    this.#locked = false;
    this.#processAcquiringQueue();
  }
}
//# sourceMappingURL=Mutex.js.map
