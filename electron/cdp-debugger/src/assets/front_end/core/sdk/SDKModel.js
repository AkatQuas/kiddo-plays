import * as Common from "../common/common.js";
const registeredModels = /* @__PURE__ */ new Map();
export class SDKModel extends Common.ObjectWrapper.ObjectWrapper {
  #targetInternal;
  constructor(target) {
    super();
    this.#targetInternal = target;
  }
  target() {
    return this.#targetInternal;
  }
  async preSuspendModel(_reason) {
  }
  async suspendModel(_reason) {
  }
  async resumeModel() {
  }
  async postResumeModel() {
  }
  dispose() {
  }
  static register(modelClass, registrationInfo) {
    if (registrationInfo.early && !registrationInfo.autostart) {
      throw new Error(`Error registering model ${modelClass.name}: early models must be autostarted.`);
    }
    registeredModels.set(modelClass, registrationInfo);
  }
  static get registeredModels() {
    return registeredModels;
  }
}
//# sourceMappingURL=SDKModel.js.map
