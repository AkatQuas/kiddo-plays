// ---------------------------------------------------------------------------
// Module-code literals in source — the scanner for the "invisible pollution" path
//
// The escape-hatch section of AGENTS.md says: without an escape hatch the pressure does not disappear.
// It only runs to two worse places —
//   1. stuffing a strange key into the schema (global pollution: every module must understand it, forever);
//   2. writing `if (code === 'salesOrder')` in code (invisible pollution: not greppable, not countable,
//      invisible in review).
// (1) is held by the `MODULE_KEYS` / `FORBIDDEN_MODULE_KEYS` gates.
// (2) is made a countable tripwire by `findModuleCodesInSource`, for `businessVocabulary.ts` and the gate fixtures.
// ---------------------------------------------------------------------------

import ts from "typescript";
import { parsedSourceOf, scriptKindOf, type ParsedSource } from "./sourceFiles.js";

export interface ModuleHardcode {
  /** Path relative to the scan root. An absolute path would make the manifest red on someone else's machine. */
  readonly file: string;
  readonly line: number;
  /** The module code that was hit. */
  readonly code: string;
  /** The original line, trimmed. When the manifest goes red, this should show what it is without opening the file. */
  readonly text: string;
}

/**
 * Module-code literals that appear in a code position in one source file.
 *
 * Two criteria, both structural:
 *
 * 1. It must be a string literal on the AST (`ts.isStringLiteralLike`). Comments and JSX text
 *    are structurally not literal nodes, so they are excluded automatically — not by a regex that
 *    "looks like a comment". Pinning comments into the manifest would force the next person to delete
 *    the sentences in the repo that most deserve to stay.
 *
 * 2. The whole literal equals a module code, character for character. It is not a substring.
 *    Something like `"/bills/salesOrder"` does not count. That is a path, and paths are built from the code
 *    by `links.ts`. It is not recognizing a module.
 *
 * What this gate does not stop, said up front (a gate that can be bypassed without anyone knowing is worse than no gate):
 *   - Identifier-shaped keys (`{ salesOrder: <Foo/> }`) do not count. Catching them means catching every
 *     `Identifier`, and codes such as `product` / `customer` / `operation` / `worker` / `mold`
 *     are also ordinary variable names. The noise would be large enough that the criterion cannot stand,
 *     and a gate silenced with `// eslint-disable` is no gate.
 *   - A concatenated string (`"sales" + "Order"`) does not count.
 * It is a tripwire, not a sandbox. It stops the common shape of this mistake
 * (`code === "salesOrder"`, `entity="salesOrder"`, `module: "salesOrder"`) and turns "not greppable" into "goes red".
 */
export function findModuleCodesInSource(
  source: string,
  fileName: string,
  codes: ReadonlySet<string>,
): readonly Omit<ModuleHardcode, "file">[] {
  if (scriptKindOf(fileName) === null) return [];
  return findModuleCodesInParsed(parsedSourceOf(fileName, source), codes);
}

/** Scan string literals on an already parsed source file. Same criterion as `findModuleCodesInSource`. */
export function findModuleCodesInParsed(
  parsed: ParsedSource,
  codes: ReadonlySet<string>,
): readonly Omit<ModuleHardcode, "file">[] {
  const { sourceFile, lines } = parsed;
  const found: Omit<ModuleHardcode, "file">[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) && codes.has(node.text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      found.push({ line: line + 1, code: node.text, text: (lines[line] ?? "").trim() });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
