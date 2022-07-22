import * as Acorn from "../../third_party/acorn/acorn.js";
import { ECMA_VERSION } from "./AcornTokenizer.js";
import { DefinitionKind } from "./FormatterActions.js";
import { ScopeVariableAnalysis } from "./ScopeParser.js";
export function substituteExpression(expression, nameMap) {
  const replacements = computeSubstitution(expression, nameMap);
  return applySubstitution(expression, replacements);
}
function computeSubstitution(expression, nameMap) {
  const root = Acorn.parse(expression, { ecmaVersion: ECMA_VERSION, allowAwaitOutsideFunction: true, ranges: false });
  const scopeVariables = new ScopeVariableAnalysis(root);
  scopeVariables.run();
  const freeVariables = scopeVariables.getFreeVariables();
  const result = [];
  const allNames = scopeVariables.getAllNames();
  for (const rename of nameMap.values()) {
    allNames.add(rename);
  }
  function getNewName(base) {
    let i = 1;
    while (allNames.has(`${base}_${i}`)) {
      i++;
    }
    const newName = `${base}_${i}`;
    allNames.add(newName);
    return newName;
  }
  for (const [name, rename] of nameMap.entries()) {
    const defUse = freeVariables.get(name);
    if (!defUse) {
      continue;
    }
    const binders = [];
    for (const use of defUse) {
      result.push({
        from: name,
        to: rename,
        offset: use.offset,
        isShorthandAssignmentProperty: use.isShorthandAssignmentProperty
      });
      binders.push(...use.scope.findBinders(rename));
    }
    for (const binder of binders) {
      if (binder.definitionKind === DefinitionKind.Fixed) {
        throw new Error(`Cannot avoid capture of '${rename}'`);
      }
      const newName = getNewName(rename);
      for (const use of binder.uses) {
        result.push({
          from: rename,
          to: newName,
          offset: use.offset,
          isShorthandAssignmentProperty: use.isShorthandAssignmentProperty
        });
      }
    }
  }
  result.sort((l, r) => l.offset - r.offset);
  return result;
}
function applySubstitution(expression, replacements) {
  const accumulator = [];
  let last = 0;
  for (const r of replacements) {
    accumulator.push(expression.slice(last, r.offset));
    let replacement = r.to;
    if (r.isShorthandAssignmentProperty) {
      replacement = `${r.from}: ${r.to}`;
    }
    accumulator.push(replacement);
    last = r.offset + r.from.length;
  }
  accumulator.push(expression.slice(last));
  return accumulator.join("");
}
//# sourceMappingURL=Substitute.js.map
