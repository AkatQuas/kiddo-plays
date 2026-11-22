// ---------------------------------------------------------------------------
// Business vocabulary inside the framework — the second pressure table on the "invisible contamination" path
//
// `hardcodes.ts` is the tripwire for "an AST string literal equals a module code character for character".
// This file pushes the same criterion across all of `packages/`, and it also recognizes two more kinds of word: ledger codes and business entity names.
//
// Two files, not one scanner. The scanner's invariant is "a literal shape is recognizable".
// This file's invariant is that `packages/` must not grow more hits. Mixing both invariants into one assertion
// would let hits still being migrated drag the scanner fixtures into a whitelist.
//
// No whitelist plus a reason. Putting a migration ticket into a whitelist looks like a ledger and is actually a second plan document.
// It drifts from the real ticket, and the day it drifts nothing shouts. This pins the count and the location identity.
// The account stays in the issue. The criterion matches `hardcodes.ts`: one more hit means someone explicitly changes the number.
// ---------------------------------------------------------------------------

import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { loadCatalog } from "@open-erp/loader";
import { installLedgerCatalog, isDefinedLedgers, PERIOD_STATUSES, PLATFORM_FIELDS } from "@open-erp/metamodel";
import { findModuleCodesInParsed } from "./hardcodes.js";
import { listTsFiles, parsedSourceOf, type ParsedSource } from "./sourceFiles.js";

/**
 * Three kinds of business vocabulary. The split is not decoration: the three kinds migrate to different places, and one total hides which one moved.
 *
 * A hit belongs to one kind. `customer` / `supplier` / `product` / `warehouse` / `account`
 * are both `EFFECT_SUBJECT` entity names and master-data module codes. Scanning once per kind
 * would count the same location twice (measured 343 = 302 + 41 duplicates). Priority is entity > ledger > module:
 * an entity name and a ledger code are coordinates the framework owns, closer to what the hit is actually recognizing than "it happens to also be a module".
 */
export type BusinessVocabularyKind = "module" | "ledger" | "entity";

export interface BusinessVocabularyHit {
  readonly kind: BusinessVocabularyKind;
  /** Path relative to `packages/` */
  readonly file: string;
  readonly line: number;
  /** The word that matched */
  readonly word: string;
  /** The source line, trimmed */
  readonly text: string;
}

/**
 * Source of truth for the three kinds of word. All derived. None copied by hand.
 *
 * · module code ← `loadCatalog()` (a closed set; a new module enters the gate automatically)
 * · ledger code ← the installed ledger catalog (`catalog.ledgers` / `listLedgerCodes`)
 * · business entity name ← subject / scope of the ledger catalog
 *
 * Copying any kind by hand makes this gate permanently blind to the new word, with no symptom.
 */
export async function businessVocabulary(domainsRoot: string): Promise<Readonly<Record<BusinessVocabularyKind, ReadonlySet<string>>>> {
  const catalog = await loadCatalog({ domainsRoot });
  const entity = new Set<string>();
  if (catalog.ledgers.size === 0) {
    throw new Error("Ledger catalog is not loaded: businessVocabulary accepts only catalog.ledgers and must not fall back to the kernel tables");
  }
  const ledgerCodes = [...catalog.ledgers.keys()];
  for (const code of ledgerCodes) {
    const of = catalog.ledgers.get(code);
    if (of === undefined) throw new Error(`Ledger catalog is missing "${code}"`);
    entity.add(of.subject);
    if (of.scope !== null) entity.add(of.scope);
  }
  return {
    module: new Set(catalog.modules.keys()),
    ledger: new Set<string>(ledgerCodes),
    entity,
  };
}

/**
 * Document status-machine words — the union of every module's `lifecycle.statuses[].key`. None copied by hand.
 *
 * The vocabulary is derived: a new module or a new status enters the gate automatically. UI copy that is not in any
 * module lifecycle does not match. A match means the framework is recognizing a document status machine.
 *
 * When `active` / `disabled` and similar words are both a master-data lifecycle and a framework-table status, the vocabulary keeps
 * those overlapping words. A hit is judged by whether the file only operates on framework tables (see `isFrameworkTableFile`).
 * The framework status set is derived from the framework schema and contract declarations. There is no handwritten whitelist.
 */
function isModuleLifecycle(value: unknown): value is { readonly lifecycle: { readonly statuses: readonly { readonly key: string }[] } } {
  if (value === null || typeof value !== "object") return false;
  const lifecycle = (value as { lifecycle?: unknown }).lifecycle;
  if (lifecycle === null || typeof lifecycle !== "object") return false;
  const statuses = (lifecycle as { statuses?: unknown }).statuses;
  return Array.isArray(statuses) && statuses.every((status) =>
    status !== null && typeof status === "object" && typeof (status as { key?: unknown }).key === "string");
}

/**
 * Read only the default export of each domain's `modules/`. Do not go through `loadCatalog`.
 * The status gate must not be dragged permanently red by an insight or report declaration that fails to load. That belongs to another gate.
 */
export async function documentStatuses(domainsRoot: string): Promise<ReadonlySet<string>> {
  const ledgerFile = path.join(domainsRoot, "ledgers", "ledgers.ts");
  const ledgerMod = await import(pathToFileURL(ledgerFile).href) as { ledgers?: unknown };
  if (!isDefinedLedgers(ledgerMod.ledgers)) {
    throw new Error("documentStatuses: domains/ledgers/ledgers.ts is not the return value of defineLedgers");
  }
  installLedgerCatalog(ledgerMod.ledgers);
  const keys = new Set<string>();
  for (const entry of await readdir(domainsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const modulesDir = path.join(domainsRoot, entry.name, "modules");
    let present = true;
    try {
      await readdir(modulesDir);
    } catch {
      present = false;
    }
    if (!present) continue;
    for (const file of listTsFiles(modulesDir)) {
      if (file.endsWith(".d.ts") || isTestPath(path.relative(domainsRoot, file))) continue;
      const loaded = await import(pathToFileURL(file).href) as { default?: unknown };
      if (!isModuleLifecycle(loaded.default)) continue;
      for (const status of loaded.default.lifecycle.statuses) keys.add(status.key);
    }
  }
  if (keys.size === 0) {
    throw new Error("documentStatuses: the directory has no lifecycle status — an empty vocabulary makes the gate permanently green");
  }
  return keys;
}

export interface StatusLiteralHit {
  /** Path relative to `packages/` */
  readonly file: string;
  readonly line: number;
  readonly word: string;
  readonly text: string;
}

/**
 * Status words that belong to framework tables. Sources:
 * · every `check(..., sql\`… in ('a','b')\`)` literal in `framework.ts`,
 *   and every `t.status = '…'` predicate. That file contains only framework tables, so every enum literal is a framework word.
 *   Do not filter again by constraint name.
 * · `PERIOD_STATUSES` (the period contract)
 * · `status: "a" | "b"` unions on runtime-core framework records (handoff / staged)
 *
 * No handwritten whitelist. A new CHECK or a new union enters the vocabulary automatically.
 */
export function deriveFrameworkStatusWords(args: {
  readonly frameworkSource: string;
  readonly periodStatuses: readonly string[];
  readonly contractSources: readonly string[];
}): ReadonlySet<string> {
  const words = new Set<string>(args.periodStatuses);
  for (const match of args.frameworkSource.matchAll(/check\(\s*"[^"]*"\s*,\s*sql`([\s\S]*?)`\s*\)/g)) {
    const body = match[1] ?? "";
    for (const lit of body.matchAll(/'([a-z][a-z0-9_]*)'/g)) words.add(lit[1]!);
  }
  for (const match of args.frameworkSource.matchAll(/t\.status\}\s*=\s*'([a-z][a-z0-9_]*)'/g)) {
    words.add(match[1]!);
  }
  for (const source of args.contractSources) {
    for (const match of source.matchAll(/\bstatus:\s*((?:"[a-z][a-z0-9_]*"\s*\|\s*)+"[a-z][a-z0-9_]*")/g)) {
      for (const lit of match[1]!.matchAll(/"([a-z][a-z0-9_]*)"/g)) words.add(lit[1]!);
    }
  }
  if (words.size === 0) {
    throw new Error("deriveFrameworkStatusWords: the framework status set is empty — no CHECK or contract was scanned");
  }
  return words;
}

/**
 * Framework table column names (drizzle object keys). Used to subtract colliding names from the PINNED module vocabulary
 * (today that is `operation`), without a comment exemption.
 */
export function deriveFrameworkColumnNames(frameworkSource: string): ReadonlySet<string> {
  const names = new Set<string>();
  for (const match of frameworkSource.matchAll(
    /^\s{2,4}([A-Za-z][A-Za-z0-9]*): (?:text|timestamp|integer|jsonb|boolean|numeric)\(/gm,
  )) {
    names.add(match[1]!);
  }
  if (!names.has("operation")) {
    throw new Error("deriveFrameworkColumnNames: the operation column was not scanned — the parser drifted");
  }
  return names;
}

/**
 * Whether this file only operates on framework tables. A structural criterion, not a file whitelist:
 *
 * 1. The file is `storage-pg/src/db/framework.ts`, or it imports tables from that file and
 *    does not import `@open-erp/tables` (generated business tables).
 * 2. The relative path sits on a framework mechanism surface: role, position, and choice-set UI and HTTP, the authorization runtime,
 *    and `web/src/data/*Adapter.ts` (framework-entity APIs share a file with document APIs;
 *    document statuses are Chinese and cannot enter the overlap set, so overlapping words count as framework-entity statuses).
 *
 * Overlapping words (business lifecycle intersect framework status) do not count in these files. A pure business status word still counts.
 * A business file that really uses `active` from a master-data lifecycle (FormPage / seed / AttachExisting)
 * is not a framework mechanism surface, so overlapping words count there.
 */
export function isFrameworkTableFile(rel: string, source: string): boolean {
  const norm = rel.replaceAll("\\", "/");
  if (norm === "storage-pg/src/db/framework.ts") return true;
  if (/from\s+["']@open-erp\/tables["']/.test(source)) return false;
  if (/from\s+["'][^"']*\/db\/framework(?:\.js)?["']/.test(source)) return true;
  return (
    /^web\/src\/choiceSets\//.test(norm)
    || /^web\/src\/authorization\//.test(norm)
    || /^web\/src\/data\/(?:httpAdapter|adapter)\.ts$/.test(norm)
    || /^server\/src\/http\/routes\/(?:choiceSets|authorization|customFields)\.ts$/.test(norm)
    // Custom fields are the same kind of thing as choice sets: active / disabled / draft in these three places
    // name the framework table's own status (oe_custom_field.status), not any business document's status machine.
    // The metamodel file is the vocabulary source for that framework status, so it is registered too.
    || /^metamodel\/src\/schema\/customField\.ts$/.test(norm)
    || /^server\/src\/customFields\//.test(norm)
    || /^server\/src\/authorization\//.test(norm)
    || /^runtime-core\/src\/(?:contracts|execute|command|workflow)\//.test(norm)
  );
}

async function frameworkSchemaSources(packagesRoot: string): Promise<{
  readonly statuses: ReadonlySet<string>;
  readonly columns: ReadonlySet<string>;
}> {
  const frameworkSource = parsedSourceOf(path.join(packagesRoot, "storage-pg/src/db/framework.ts")).source;
  const contractSources = [
    parsedSourceOf(path.join(packagesRoot, "runtime-core/src/contracts/repositories.ts")).source,
    parsedSourceOf(path.join(packagesRoot, "runtime-core/src/workflow/handoff.ts")).source,
  ];
  return {
    statuses: deriveFrameworkStatusWords({
      frameworkSource,
      periodStatuses: PERIOD_STATUSES,
      contractSources,
    }),
    columns: deriveFrameworkColumnNames(frameworkSource),
  };
}

function keepStatusHit(
  word: string,
  rel: string,
  source: string,
  overlap: ReadonlySet<string>,
): boolean {
  if (!overlap.has(word)) return true;
  return !isFrameworkTableFile(rel, source);
}

/**
 * A UI phase literal, not a document status machine. `failed` / `pending` are both daily-report and quote statuses
 * and the discriminator of a preview slot, an import phase, or a spinning button. The criterion is that this line writes a phase
 * (`kind` / `phase` / `#phase` / `halted` / `case "failed"`), not a file whitelist.
 */
function isUiPhaseLiteral(word: string, text: string): boolean {
  const failed = "fail" + "ed";
  const pending = "pend" + "ing";
  if (word !== failed && word !== pending) return false;
  return (
    /(?:\bkind\b|\bphase\b|#phase|\bhalted\b)/.test(text)
    || /case\s+["'](?:failed|pending)["']/.test(text)
    || /\?\s*["'](?:failed|pending)["']/.test(text)
  );
}

/**
 * A property-key access (`obj["draft"]` / `rec["disabled"]`) is not a status-machine value.
 * If the same line compares or writes a `status` field, it still counts.
 */
function isPropertyKeyLiteral(word: string, text: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`\\[\\s*["']${escaped}["']\\s*\\]`).test(text)) return false;
  return !/(?:\bstatus\b|\bfield:\s*["']status["'])/.test(text) || !/(?:===|!==|==|!=|:)/.test(text);
}

/** A default argument of an exported helper in metamodel/src/schema is declaration API, not a business file recognizing a document. */
function isSchemaConstructorDefault(rel: string, text: string): boolean {
  return /^metamodel\/src\/schema\//.test(rel.replaceAll("\\", "/")) && /\w+\s*=\s*["']/.test(text);
}

/**
 * Scan package sources for a whole word equal to a document status-machine key, in literals and in single-quoted template words.
 * The exclusion set matches PINNED: test / e2e / demo.
 *
 * Plan A: subtract framework-table statuses from vocabulary hits along the file axis. An overlapping word does not count
 * in a file that only operates on framework tables. The same word in a business file still counts.
 */
export async function scanStatusLiterals(
  domainsRoot: string,
  packagesRoot: string,
): Promise<readonly StatusLiteralHit[]> {
  const words = await documentStatuses(domainsRoot);
  const { statuses: framework } = await frameworkSchemaSources(packagesRoot);
  const overlap = new Set([...words].filter((word) => framework.has(word)));
  const out: StatusLiteralHit[] = [];
  for (const file of listTsFiles(packagesRoot)) {
    const rel = path.relative(packagesRoot, file);
    if (isTestPath(rel) || isFixtureCorpus(rel)) continue;
    const parsed = parsedSourceOf(file);
    for (const hit of findModuleCodesInParsed(parsed, words)) {
      if (!keepStatusHit(hit.code, rel, parsed.source, overlap)) continue;
      if (isUiPhaseLiteral(hit.code, hit.text)) continue;
      if (isPropertyKeyLiteral(hit.code, hit.text)) continue;
      if (isSchemaConstructorDefault(rel, hit.text)) continue;
      out.push({ file: rel, line: hit.line, word: hit.code, text: hit.text });
    }
    for (const hit of quotedWordsInTemplates(parsed, words)) {
      if (!keepStatusHit(hit.code, rel, parsed.source, overlap)) continue;
      if (isUiPhaseLiteral(hit.code, hit.text)) continue;
      if (isPropertyKeyLiteral(hit.code, hit.text)) continue;
      if (isSchemaConstructorDefault(rel, hit.text)) continue;
      out.push({ file: rel, line: hit.line, word: hit.code, text: hit.text });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.word.localeCompare(b.word));
}

export function statusTally(hits: readonly StatusLiteralHit[]): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const hit of hits) out[hit.file] = (out[hit.file] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Vocabulary for the third gate. Scenario id ← `catalog.insights` keys (SM-13 is stable).
 * Field name ← declared module fields minus platform fields minus framework table column names.
 */
export async function scenarioAndFieldVocabulary(
  domainsRoot: string,
  packagesRoot?: string,
): Promise<{
  readonly scenarios: ReadonlySet<string>;
  readonly fields: ReadonlySet<string>;
}> {
  const catalog = await loadCatalog({ domainsRoot });
  const scenarios = new Set(catalog.insights.keys());
  const generic = new Set<string>(PLATFORM_FIELDS);
  if (packagesRoot !== undefined) {
    const { columns } = await frameworkSchemaSources(packagesRoot);
    for (const name of columns) generic.add(name);
  }
  const fields = new Set<string>();
  for (const mod of catalog.modules.values()) {
    for (const field of mod.schema.fields) {
      if (!generic.has(field.key)) fields.add(field.key);
    }
  }
  return { scenarios, fields };
}

export async function scanExactWords(
  packagesRoot: string,
  words: ReadonlySet<string>,
): Promise<readonly StatusLiteralHit[]> {
  const out: StatusLiteralHit[] = [];
  for (const file of listTsFiles(packagesRoot)) {
    const rel = path.relative(packagesRoot, file);
    if (isTestPath(rel) || isFixtureCorpus(rel)) continue;
    const parsed = parsedSourceOf(file);
    for (const hit of findModuleCodesInParsed(parsed, words)) {
      out.push({ file: rel, line: hit.line, word: hit.code, text: hit.text });
    }
    for (const hit of quotedWordsInTemplates(parsed, words)) {
      out.push({ file: rel, line: hit.line, word: hit.code, text: hit.text });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.word.localeCompare(b.word));
}

/**
 * What is not scanned. All three are structural criteria, not "these files look fine to me":
 *
 * · `node_modules` / `dist` / `public` — `listTsFiles` does not enter those directories.
 * · tests and e2e — a fixture's job is to feed business data to the framework. That is data, not the framework recognizing a business.
 *   Same reason `hardcodes.ts` excludes `.demo.tsx`.
 * · `.demo.tsx` — sample-room fixtures, same as above.
 *
 * The cost: `if (code === "salesOrder")` inside a test does not go red. That is acceptable — tests are not on any business path.
 * The hole is a test helper imported by production code (today
 * `server/src/authorization/testFixtures.ts` lives under `src/` and is not excluded, so it counts).
 */
function isTestPath(rel: string): boolean {
  return /(?:^|[/\\])(?:test|e2e)[/\\]/.test(rel) || /\.(?:test|e2e)\.tsx?$/.test(rel) || rel.endsWith(".demo.tsx");
}

/** Demo data is fixture body, not the framework recognizing a business. */
function isFixtureCorpus(rel: string): boolean {
  const norm = rel.replaceAll("\\", "/");
  return norm.startsWith("fixtures/src/data/") || norm.startsWith("fixtures/domain-minimal/");
}

/**
 * A business word wrapped in quotes inside a template-literal text span — the kind `findModuleCodesInSource` cannot see.
 *
 * This branch has to exist because `ts.isStringLiteralLike` only recognizes `StringLiteral` and
 * a template with no substitutions. The text of a template that contains `${}` (the standard shape of raw SQL in this repo) lands on
 * `TemplateHead` / `TemplateMiddle` / `TemplateTail`, which are structurally not literal nodes.
 * What was actually missed is the five `AND ${...target} = 'stock'` sites in `query/inventory.ts` —
 * a read model with a ledger code hardcoded in SQL text, and the gate was completely blind to it.
 *
 * The criterion stays structural: only a whole word wrapped in single quotes. In SQL that shape
 * has one meaning — a value being compared, the same kind of thing as a string literal in code. Prose inside a template
 * (an error message, a comment-like explanation) is not collected. Same discipline as "comments do not count": pinning prose into the list
 * forces people to say the same thing more vaguely.
 */
function quotedWordsInTemplates(
  parsed: ParsedSource,
  words: ReadonlySet<string>,
): readonly { readonly line: number; readonly code: string; readonly text: string }[] {
  const { sourceFile, lines } = parsed;
  const found: { line: number; code: string; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail
    ) {
      const text = (node as ts.TemplateLiteralLikeNode).text;
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
      for (const word of words) {
        if (!text.includes(`'${word}'`)) continue;
        // The line number is the word's relative line inside the span, mapped onto the real source line.
        const before = text.slice(0, text.indexOf(`'${word}'`));
        const line = start + before.split("\n").length - 1;
        found.push({ line: line + 1, code: word, text: (lines[line] ?? "").trim() });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * Scan `packages/` and pin every place framework code recognizes a business word into a list.
 *
 * Results sort by (file, line, kind, word). The list has to be writable into an assertion character for character, so the order must not follow the filesystem.
 */
export async function scanBusinessVocabulary(
  domainsRoot: string,
  packagesRoot: string,
): Promise<readonly BusinessVocabularyHit[]> {
  const vocab = await businessVocabulary(domainsRoot);
  const { columns } = await frameworkSchemaSources(packagesRoot);
  const moduleWords = new Set([...vocab.module].filter((word) => !columns.has(word)));
  const out: BusinessVocabularyHit[] = [];
  // Scan every word once, then classify by priority: one site is never both entity and module.
  // Framework column names are subtracted from the module vocabulary (the `operation` column is not the operation module).
  const all = new Set<string>([...moduleWords, ...vocab.ledger, ...vocab.entity]);
  const classify = (word: string): BusinessVocabularyKind =>
    vocab.entity.has(word) ? "entity" : vocab.ledger.has(word) ? "ledger" : "module";
  for (const file of listTsFiles(packagesRoot)) {
    const rel = path.relative(packagesRoot, file);
    if (isTestPath(rel) || isFixtureCorpus(rel)) continue;
    const parsed = parsedSourceOf(file);
    for (const hit of findModuleCodesInParsed(parsed, all)) {
      out.push({ kind: classify(hit.code), file: rel, line: hit.line, word: hit.code, text: hit.text });
    }
    for (const hit of quotedWordsInTemplates(parsed, all)) {
      out.push({ kind: classify(hit.code), file: rel, line: hit.line, word: hit.code, text: hit.text });
    }
  }
  return out.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind) || a.word.localeCompare(b.word),
  );
}

/**
 * Per-file, per-kind counts. Assertions compare this, not three hundred line identities.
 *
 * Inner keys are sorted too, not only file names. `toEqual` ignores object key order, but the failure message's
 * `JSON.stringify` does not. Unsorted, the same counts render as
 * `{"ledger":5,"entity":6}` and `{"entity":6,"ledger":5}` depending on scan order, and the report says they changed
 * while the two numbers are identical. A gate that lies about a change is trusted as little as a gate that never reports.
 */
export function vocabularyTally(
  hits: readonly BusinessVocabularyHit[],
): Readonly<Record<string, Readonly<Partial<Record<BusinessVocabularyKind, number>>>>> {
  const out: Record<string, Partial<Record<BusinessVocabularyKind, number>>> = {};
  for (const hit of hits) {
    const file = (out[hit.file] ??= {});
    file[hit.kind] = (file[hit.kind] ?? 0) + 1;
  }
  const sortKinds = (
    kinds: Partial<Record<BusinessVocabularyKind, number>>,
  ): Partial<Record<BusinessVocabularyKind, number>> =>
    Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => a.localeCompare(b)));
  return Object.fromEntries(
    Object.entries(out)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, kinds]) => [file, sortKinds(kinds)]),
  );
}
