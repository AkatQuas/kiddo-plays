// ---------------------------------------------------------------------------
// Read each source file from disk and parse it once. Scanner visitors share that `ts.SourceFile`.
// The cache key is the absolute path from `path.resolve`; the same process reuses it by path.
// ---------------------------------------------------------------------------

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const SKIP_DIRS: ReadonlySet<string> = new Set(["node_modules", "dist", "public"]);

export interface ParsedSource {
  readonly fileName: string;
  readonly source: string;
  readonly sourceFile: ts.SourceFile;
  readonly lines: readonly string[];
}

const cache = new Map<string, ParsedSource>();

export function scriptKindOf(fileName: string): ts.ScriptKind | null {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (fileName.endsWith(".ts")) return ts.ScriptKind.TS;
  return null;
}

function parse(fileName: string, source: string): ParsedSource {
  const kind = scriptKindOf(fileName);
  if (kind === null) throw new Error(`parsedSourceOf: not a TypeScript source file: ${fileName}`);
  return {
    fileName,
    source,
    // Scanners only need literal and import node positions. They do not need parent pointers or JSDoc.
    sourceFile: ts.createSourceFile(
      fileName,
      source,
      { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
      false,
      kind,
    ),
    lines: source.split("\n"),
  };
}

/** Both the disk read and `createSourceFile` are cached by path. Passing `source` skips the disk read; a changed body is parsed again. */
export function parsedSourceOf(fileName: string, source?: string): ParsedSource {
  const key = path.resolve(fileName);
  const existing = cache.get(key);
  if (source === undefined) {
    if (existing !== undefined) return existing;
    const parsed = parse(key, readFileSync(key, "utf8"));
    cache.set(key, parsed);
    return parsed;
  }
  if (existing !== undefined && existing.source === source) return existing;
  const parsed = parse(key, source);
  cache.set(key, parsed);
  return parsed;
}

/** Skip `node_modules` / `dist` / `public`. A missing root returns an empty list and does not throw. */
export function listTsFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return files;
}
