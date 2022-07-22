let instance = null;
export class RecorderPluginManager {
  #plugins = /* @__PURE__ */ new Set();
  static instance() {
    if (!instance) {
      instance = new RecorderPluginManager();
    }
    return instance;
  }
  addPlugin(plugin) {
    this.#plugins.add(plugin);
  }
  removePlugin(plugin) {
    this.#plugins.delete(plugin);
  }
  plugins() {
    return Array.from(this.#plugins.values());
  }
}
//# sourceMappingURL=RecorderPluginManager.js.map
