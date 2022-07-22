import * as Platform from "../../../../core/platform/platform.js";
import * as SDK from "../../../../core/sdk/sdk.js";
import * as UI from "../../legacy.js";
import { RemoteObjectPreviewFormatter } from "./RemoteObjectPreviewFormatter.js";
export class JavaScriptREPL {
  static wrapObjectLiteral(code) {
    if (!(/^\s*\{/.test(code) && /\}\s*$/.test(code))) {
      return code;
    }
    const parse = (async () => 0).constructor;
    try {
      parse("return " + code + ";");
      const wrappedCode = "(" + code + ")";
      parse(wrappedCode);
      return wrappedCode;
    } catch (e) {
      return code;
    }
  }
  static preprocessExpression(text) {
    return JavaScriptREPL.wrapObjectLiteral(text);
  }
  static async evaluateAndBuildPreview(text, throwOnSideEffect, replMode, timeout, allowErrors, objectGroup, awaitPromise = false) {
    const executionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
    const isTextLong = text.length > maxLengthForEvaluation;
    if (!text || !executionContext || throwOnSideEffect && isTextLong) {
      return { preview: document.createDocumentFragment(), result: null };
    }
    const expression = JavaScriptREPL.preprocessExpression(text);
    const options = {
      expression,
      generatePreview: true,
      includeCommandLineAPI: true,
      throwOnSideEffect,
      timeout,
      objectGroup,
      disableBreaks: true,
      replMode,
      silent: void 0,
      returnByValue: void 0,
      allowUnsafeEvalBlockedByCSP: void 0
    };
    const result = await executionContext.evaluate(options, false, awaitPromise);
    const preview = JavaScriptREPL.buildEvaluationPreview(result, allowErrors);
    return { preview, result };
  }
  static buildEvaluationPreview(result, allowErrors) {
    const fragment = document.createDocumentFragment();
    if ("error" in result) {
      return fragment;
    }
    if (result.exceptionDetails && result.exceptionDetails.exception && result.exceptionDetails.exception.description) {
      const exception = result.exceptionDetails.exception.description;
      if (exception.startsWith("TypeError: ") || allowErrors) {
        fragment.createChild("span").textContent = result.exceptionDetails.text + " " + exception;
      }
      return fragment;
    }
    const formatter = new RemoteObjectPreviewFormatter();
    const { preview, type, subtype, className, description } = result.object;
    if (preview && type === "object" && subtype !== "node" && subtype !== "trustedtype") {
      formatter.appendObjectPreview(fragment, preview, false);
    } else {
      const nonObjectPreview = formatter.renderPropertyPreview(type, subtype, className, Platform.StringUtilities.trimEndWithMaxLength(description || "", 400));
      fragment.appendChild(nonObjectPreview);
    }
    return fragment;
  }
}
let maxLengthForEvaluation = 2e3;
export function setMaxLengthForEvaluation(value) {
  maxLengthForEvaluation = value;
}
export function getMaxLengthForEvaluation() {
  return maxLengthForEvaluation;
}
//# sourceMappingURL=JavaScriptREPL.js.map
