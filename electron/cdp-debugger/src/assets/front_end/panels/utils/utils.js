import * as Formatter from "../../models/formatter/formatter.js";
import * as DiffView from "../../ui/components/diff_view/diff_view.js";
export function imageNameForResourceType(resourceType) {
  if (resourceType.isDocument()) {
    return "ic_file_document";
  }
  if (resourceType.isImage()) {
    return "ic_file_image";
  }
  if (resourceType.isFont()) {
    return "ic_file_font";
  }
  if (resourceType.isScript()) {
    return "ic_file_script";
  }
  if (resourceType.isStyleSheet()) {
    return "ic_file_stylesheet";
  }
  if (resourceType.isWebbundle()) {
    return "ic_file_webbundle";
  }
  return "ic_file_default";
}
export async function formatCSSChangesFromDiff(diff) {
  const indent = "  ";
  const { originalLines, currentLines, rows } = DiffView.DiffView.buildDiffRows(diff);
  const originalRuleMaps = await buildStyleRuleMaps(originalLines.join("\n"));
  const currentRuleMaps = await buildStyleRuleMaps(currentLines.join("\n"));
  let changes = "";
  let recordedOriginalSelector, recordedCurrentSelector;
  let hasOpenDeclarationBlock = false;
  for (const { currentLineNumber, originalLineNumber, type } of rows) {
    if (type !== DiffView.DiffView.RowType.Deletion && type !== DiffView.DiffView.RowType.Addition) {
      continue;
    }
    const isDeletion = type === DiffView.DiffView.RowType.Deletion;
    const lines = isDeletion ? originalLines : currentLines;
    const lineIndex = isDeletion ? originalLineNumber - 1 : currentLineNumber - 1;
    const line = lines[lineIndex].trim();
    const { declarationIDToStyleRule, styleRuleIDToStyleRule } = isDeletion ? originalRuleMaps : currentRuleMaps;
    let styleRule;
    let prefix = "";
    if (declarationIDToStyleRule.has(lineIndex)) {
      styleRule = declarationIDToStyleRule.get(lineIndex);
      const selector = styleRule.selector;
      if (selector !== recordedOriginalSelector && selector !== recordedCurrentSelector) {
        prefix += `${selector} {
`;
      }
      prefix += indent;
      hasOpenDeclarationBlock = true;
    } else {
      if (hasOpenDeclarationBlock) {
        prefix = "}\n\n";
        hasOpenDeclarationBlock = false;
      }
      if (styleRuleIDToStyleRule.has(lineIndex)) {
        styleRule = styleRuleIDToStyleRule.get(lineIndex);
      }
    }
    const processedLine = isDeletion ? `/* ${line} */` : line;
    changes += prefix + processedLine + "\n";
    if (isDeletion) {
      recordedOriginalSelector = styleRule?.selector;
    } else {
      recordedCurrentSelector = styleRule?.selector;
    }
  }
  if (changes.length > 0) {
    changes += "}";
  }
  return changes;
}
async function buildStyleRuleMaps(content) {
  const rules = await new Promise((res) => {
    const rules2 = [];
    Formatter.FormatterWorkerPool.formatterWorkerPool().parseCSS(content, (isLastChunk, currentRules) => {
      rules2.push(...currentRules);
      if (isLastChunk) {
        res(rules2);
      }
    });
  });
  const declarationIDToStyleRule = /* @__PURE__ */ new Map();
  const styleRuleIDToStyleRule = /* @__PURE__ */ new Map();
  for (const rule of rules) {
    if ("styleRange" in rule) {
      const selector = rule.selectorText.split("\n").pop()?.trim();
      if (!selector) {
        continue;
      }
      const styleRule = { rule, selector };
      styleRuleIDToStyleRule.set(rule.styleRange.startLine, styleRule);
      for (const property of rule.properties) {
        declarationIDToStyleRule.set(property.range.startLine, styleRule);
      }
    }
  }
  return { declarationIDToStyleRule, styleRuleIDToStyleRule };
}
//# sourceMappingURL=utils.js.map
