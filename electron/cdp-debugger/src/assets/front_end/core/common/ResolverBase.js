export class ResolverBase {
  #unresolvedIds = /* @__PURE__ */ new Map();
  async waitFor(id) {
    const obj = this.getForId(id);
    if (!obj) {
      return this.getOrCreatePromise(id);
    }
    return obj;
  }
  tryGet(id, callback) {
    const obj = this.getForId(id);
    if (!obj) {
      const swallowTheError = () => {
      };
      void this.getOrCreatePromise(id).catch(swallowTheError).then((obj2) => {
        if (obj2) {
          callback(obj2);
        }
      });
      return null;
    }
    return obj;
  }
  clear() {
    this.stopListening();
    for (const [id, { reject }] of this.#unresolvedIds.entries()) {
      reject(new Error(`Object with ${id} never resolved.`));
    }
    this.#unresolvedIds.clear();
  }
  getOrCreatePromise(id) {
    const promiseInfo = this.#unresolvedIds.get(id);
    if (promiseInfo) {
      return promiseInfo.promise;
    }
    let resolve = () => {
    };
    let reject = () => {
    };
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.#unresolvedIds.set(id, { promise, resolve, reject });
    this.startListening();
    return promise;
  }
  onResolve(id, t) {
    const promiseInfo = this.#unresolvedIds.get(id);
    this.#unresolvedIds.delete(id);
    if (this.#unresolvedIds.size === 0) {
      this.stopListening();
    }
    promiseInfo?.resolve(t);
  }
}
//# sourceMappingURL=ResolverBase.js.map
