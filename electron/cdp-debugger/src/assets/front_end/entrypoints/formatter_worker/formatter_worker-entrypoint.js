import * as Platform from "../../core/platform/platform.js";
import * as FormatterWorker from "./formatter_worker.js";
import { FormatterActions } from "./FormatterActions.js";
self.onmessage = function(event) {
  const method = event.data.method;
  const params = event.data.params;
  if (!method) {
    return;
  }
  switch (method) {
    case FormatterActions.FORMAT:
      self.postMessage(FormatterWorker.FormatterWorker.format(params.mimeType, params.content, params.indentString));
      break;
    case FormatterActions.PARSE_CSS:
      FormatterWorker.CSSRuleParser.parseCSS(params.content, self.postMessage);
      break;
    case FormatterActions.HTML_OUTLINE:
      FormatterWorker.HTMLOutline.htmlOutline(params.content, self.postMessage);
      break;
    case FormatterActions.JAVASCRIPT_OUTLINE:
      FormatterWorker.JavaScriptOutline.javaScriptOutline(params.content, self.postMessage);
      break;
    case FormatterActions.JAVASCRIPT_IDENTIFIERS:
      self.postMessage(FormatterWorker.FormatterWorker.javaScriptIdentifiers(params.content));
      break;
    case FormatterActions.JAVASCRIPT_SUBSTITUTE: {
      const mapping = new Map(params.mapping);
      self.postMessage(FormatterWorker.Substitute.substituteExpression(params.content, mapping));
      break;
    }
    case FormatterActions.JAVASCRIPT_SCOPE_TREE: {
      self.postMessage(FormatterWorker.ScopeParser.parseScopes(params.content)?.export());
      break;
    }
    case FormatterActions.EVALUATE_JAVASCRIPT_SUBSTRING:
      self.postMessage(FormatterWorker.FormatterWorker.evaluatableJavaScriptSubstring(params.content));
      break;
    case FormatterActions.ARGUMENTS_LIST:
      self.postMessage(FormatterWorker.FormatterWorker.argumentsList(params.content));
      break;
    default:
      Platform.assertNever(method, `Unsupport method name: ${method}`);
  }
};
self.postMessage("workerReady");
//# sourceMappingURL=formatter_worker-entrypoint.js.map
