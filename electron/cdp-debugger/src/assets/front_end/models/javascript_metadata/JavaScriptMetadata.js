import { NativeFunctions } from "./NativeFunctions.js";
import * as DOMPinnedProperties from "./DOMPinnedProperties.js";
let javaScriptMetadataInstance;
export class JavaScriptMetadataImpl {
  static domPinnedProperties = DOMPinnedProperties;
  uniqueFunctions;
  receiverMethods;
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!javaScriptMetadataInstance || forceNew) {
      javaScriptMetadataInstance = new JavaScriptMetadataImpl();
    }
    return javaScriptMetadataInstance;
  }
  constructor() {
    this.uniqueFunctions = /* @__PURE__ */ new Map();
    this.receiverMethods = /* @__PURE__ */ new Map();
    for (const nativeFunction of NativeFunctions) {
      if (!nativeFunction.receivers) {
        this.uniqueFunctions.set(nativeFunction.name, nativeFunction.signatures);
        continue;
      }
      for (const receiver of nativeFunction.receivers) {
        let method = this.receiverMethods.get(receiver);
        if (!method) {
          method = /* @__PURE__ */ new Map();
          this.receiverMethods.set(receiver, method);
        }
        method.set(nativeFunction.name, nativeFunction.signatures);
      }
    }
  }
  signaturesForNativeFunction(name) {
    return this.uniqueFunctions.get(name) || null;
  }
  signaturesForInstanceMethod(name, receiverClassName) {
    const instanceMethod = this.receiverMethods.get(receiverClassName);
    if (!instanceMethod) {
      return null;
    }
    return instanceMethod.get(name) || null;
  }
  signaturesForStaticMethod(name, receiverConstructorName) {
    const staticMethod = this.receiverMethods.get(receiverConstructorName + "Constructor");
    if (!staticMethod) {
      return null;
    }
    return staticMethod.get(name) || null;
  }
}
//# sourceMappingURL=JavaScriptMetadata.js.map
