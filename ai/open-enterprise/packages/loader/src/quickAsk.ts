// ---------------------------------------------------------------------------
// Load `quick-asks/asks/*.json` — home-page quick asks and question declarations product adds on its own
//
// These files are maintained by product / sales with AI (see `quick-asks/AGENTS.md`), not written by development.
// So this load-time check is their only gatekeeper: shape, module, status values, and condition fields are all checked here,
// and a failure means startup fails.
//
// Why it must be at load time and not at call time: a preset that points at a deleted field shows up at runtime as
// "the query always returns 0 rows" or a 400 the model cannot read — and the user only sees "the assistant cannot answer",
// with nothing turning red anywhere. The same class of accident really happened on `productionTask.issuedBaseQty`
// (a rollup pointed at `stockOut.lines.productionTaskId`, which had been simplified away; every query of the whole module 500'd,
// and it blew up only at query time). A declaration that is changed into a bad one should blow up on the spot at build / startup.
//
// Condition checks call `normalizeQuery` directly — the same implementation as runtime, and a second set of criteria is not copied here.
// The cost of a copy is that one day the two sides give different answers for the same where, and the looser side has no symptom.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { normalizeQuery, type ModuleSchema, type QuickAskEntry } from "@open-erp/metamodel";
import { fail } from "./errors.js";
import { exists, isDirectory } from "./filesystem.js";

/** Keys an entry recognizes. One extra key is a mistake — letting it through means nobody reads that key, while the writer believes it took effect. */
const ENTRY_KEYS: ReadonlySet<string> = new Set([
  "key", "text", "aliases", "showOn", "surface", "label", "kind", "note", "card",
  "module", "where", "sort", "columns",
  "scenario", "answeredBy",
  "reason", "instead",
  "firstCall", "precondition",
  "skill",
]);
const KINDS: ReadonlySet<string> = new Set(["list", "insight", "intent", "skill", "unsupported"]);

export interface QuickAskLoadInput {
  /** Absolute path of `quick-asks/`. A missing directory means this product has no quick asks: return an empty array, and that is not an error. */
  readonly root: string;
  readonly modules: ReadonlyMap<string, { readonly schema: ModuleSchema }>;
  /** Declared skill names, used to check `kind:"skill"`. */
  readonly skillNames: ReadonlySet<string>;
  /** Declared operating scenarios, used to check `kind:"insight"`. */
  readonly insightScenarios: ReadonlySet<string>;
}

/**
 * Scan and check every quick-ask declaration.
 *
 * Return order = file-name dictionary order × order inside the file, stable and testable.
 */
/**
 * Downrank word list. Product maintains it in `quick-asks/generic-tokens.json`.
 * A missing directory means this product has no quick asks and returns an empty array; a directory present with the file missing means startup fails.
 */
export function loadQuickAskGeneric(root: string): readonly string[] {
  const file = path.join(root, "generic-tokens.json");
  if (!exists(file)) {
    if (!isDirectory(root)) return [];
    fail(`${file}: the quick-ask directory is present, but the downrank word list is not — the mechanism no longer bakes in product words`);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (cause) {
    fail(`quick-asks/generic-tokens.json is not legal JSON — ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!doc || typeof doc !== "object") fail("quick-asks/generic-tokens.json: the top level must be an object");
  const tokens = (doc as Record<string, unknown>)["downweight"];
  if (!Array.isArray(tokens) || tokens.length === 0) {
    fail("quick-asks/generic-tokens.json: downweight must be a non-empty array");
  }
  for (const [index, token] of tokens.entries()) {
    if (typeof token !== "string" || token.length < 2) {
      fail(`quick-asks/generic-tokens.json: downweight[${String(index)}] must be a string of at least two characters`);
    }
  }
  return tokens as readonly string[];
}

export function loadQuickAsks(input: QuickAskLoadInput): readonly QuickAskEntry[] {
  const asksDir = path.join(input.root, "asks");
  // A missing directory is not an error: another deployment shape can ship with no quick asks at all.
  // A directory that cannot be parsed is an error — the file was changed into a bad one, and silently skipping quietly drops a batch of features.
  if (!isDirectory(asksDir)) return [];

  const out: QuickAskEntry[] = [];
  const seenKeys = new Map<string, string>();
  const seenText = new Map<string, string>();

  for (const file of readdirSync(asksDir).filter((f) => f.endsWith(".json")).sort()) {
    const at0 = `quick-asks/asks/${file}`;
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(path.join(asksDir, file), "utf8"));
    } catch (cause) {
      fail(`${at0} is not legal JSON — ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if (!doc || typeof doc !== "object") fail(`${at0}: the top level must be an object`);
    const entries = (doc as Record<string, unknown>)["entries"];
    if (!Array.isArray(entries)) fail(`${at0}: entries must be an array`);

    entries.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") fail(`${at0} entry ${String(index + 1)} must be an object`);
      const e = raw as Record<string, unknown>;
      const key = typeof e["key"] === "string" ? e["key"] : "";
      const at = `${at0} · ${key || `entry ${String(index + 1)}`}`;

      for (const k of Object.keys(e)) {
        if (!ENTRY_KEYS.has(k)) fail(`${at}: unrecognized key "${k}" — recognized keys are ${[...ENTRY_KEYS].join(" / ")}`);
      }
      if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(key)) {
        fail(`${at}: key must be lowercase letters, digits, and hyphens (3–64 characters)`);
      }
      const dupKey = seenKeys.get(key);
      if (dupKey) fail(`${at}: key "${key}" duplicates ${dupKey}`);
      seenKeys.set(key, at);

      const text = e["text"];
      if (typeof text !== "string" || text.trim() === "") fail(`${at}: text must not be empty`);
      // The original wording and aliases share one namespace: the same sentence cannot point at two entries, or the match depends on scan order.
      for (const phrase of [text as string, ...((e["aliases"] as string[]) ?? [])]) {
        if (typeof phrase !== "string" || phrase.trim() === "") fail(`${at}: aliases contains an empty string`);
        const norm = phrase.trim().replace(/[?？]+\s*$/, "");
        const dup = seenText.get(norm);
        if (dup) fail(`${at}: question "${phrase}" duplicates ${dup} — a match cannot tell which entry to take`);
        seenText.set(norm, at);
      }

      // card: check shape only. The source of truth for component names is the skill-components manifest, which this repo cannot depend on —
      // pretending it was checked is worse than not checking, so this says explicitly that only the shape is checked (a typo shows up as that cell not rendering).
      const card = e["card"];
      if (card !== undefined) {
        if (!card || typeof card !== "object" || Array.isArray(card)) fail(`${at}: card must be an object`);
        const c = card as Record<string, unknown>;
        for (const k of Object.keys(c)) {
          if (k !== "component" && k !== "props") fail(`${at}: unrecognized key "${k}" in card — only component and props`);
        }
        if (typeof c["component"] !== "string" || c["component"] === "") fail(`${at}: card.component must not be empty`);
        if (c["props"] !== undefined && (typeof c["props"] !== "object" || c["props"] === null || Array.isArray(c["props"]))) {
          fail(`${at}: card.props must be an object`);
        }
      }

      const kind = e["kind"];
      if (typeof kind !== "string" || !KINDS.has(kind)) {
        fail(`${at}: kind "${String(kind)}" is not recognized — it can only be ${[...KINDS].join(" / ")}`);
      }

      if (kind === "list") {
        const moduleCode = e["module"];
        if (typeof moduleCode !== "string") fail(`${at}: kind=list must provide module`);
        const loaded = input.modules.get(moduleCode);
        if (!loaded) fail(`${at}: module "${moduleCode}" does not exist`);
        if (e["where"] === undefined) fail(`${at}: kind=list must provide where — no condition means pulling the full set`);
        // The same check as runtime: fields, comparators, relative time, and line-row prefixes are all checked here.
        // Status values are not in normalizeQuery's criteria (it only knows whether a field is queryable), so they are checked once more below.
        try {
          normalizeQuery(loaded.schema, { where: e["where"], sort: e["sort"] ?? [] }, `${at}.where`);
        } catch (cause) {
          fail(`${at}: condition is illegal — ${cause instanceof Error ? cause.message : String(cause)}`);
        }
        assertStatuses(e["where"], loaded.schema, at);
        for (const column of (e["columns"] as string[]) ?? []) {
          if (!hasField(loaded.schema, column)) {
            fail(`${at}: column "${column}" does not exist on module "${moduleCode}"`);
          }
        }
      } else if (kind === "insight") {
        const scenario = e["scenario"];
        if (typeof scenario !== "string" || scenario === "") fail(`${at}: kind=insight must provide scenario`);
        // An empty set means the caller did not provide the scenario enum (the loader cannot depend on the server layer's copy). Skip this check.
        // Do not use a blank allow-list to reject every scenario — that turns "you did not tell me the allowed values" into "everything you wrote is wrong".
        // The real check happens when the server assembles tools (that is where INSIGHT_SCENARIOS is available).
        if (input.insightScenarios.size > 0 && !input.insightScenarios.has(scenario)) {
          fail(`${at}: operating scenario "${String(scenario)}" does not exist — allowed ${[...input.insightScenarios].join(" / ")}`);
        }
        // Required: a scenario only proves "this scenario exists". It does not prove "it can answer this sentence".
        // Six measured slow questions, 24–246 seconds, all had a legal scenario and answered the wrong question. Key-by-key checking is in
        // quickAsk.test.ts (that is where each scenario's actual output keys are available). Here only the shape is checked.
        const answeredBy = e["answeredBy"];
        if (!Array.isArray(answeredBy) || answeredBy.length === 0) {
          fail(
            `${at}: kind=insight must provide answeredBy — state which cells in the scenario answer this question (metric/group keys). ` +
              `If that cannot be written, "${String(scenario)}" cannot answer this sentence. Change the question or add to the scenario then. Do not hang it on to make up the count`,
          );
        }
        for (const [i2, k2] of answeredBy.entries()) {
          if (typeof k2 !== "string" || k2 === "") fail(`${at}: answeredBy[${String(i2)}] must be a non-empty string`);
        }
      } else if (kind === "unsupported") {
        // `reason` is required and must be specific: the model relays it to the user word for word.
        // A phrase like "not supported yet" says nothing, and the user's next sentence asks the same thing again.
        const reason = e["reason"];
        if (typeof reason !== "string" || reason.trim().length < 8) {
          fail(`${at}: kind=unsupported must provide reason, and must say what is missing (which field is absent on which module). It cannot only say "not supported"`);
        }
        const instead = e["instead"];
        if (instead !== undefined) {
          if (!Array.isArray(instead)) fail(`${at}: instead must be an array`);
          for (const [i2, x] of instead.entries()) {
            if (typeof x !== "string" || x === "") fail(`${at}: instead[${String(i2)}] must be a non-empty string`);
          }
        }
      } else if (kind === "skill") {
        const skill = e["skill"];
        if (typeof skill !== "string" || !input.skillNames.has(skill)) {
          fail(`${at}: business playbook "${String(skill)}" does not exist`);
        }
      } else if (kind === "intent") {
        const moduleCode = e["module"];
        if (moduleCode !== undefined && !input.modules.has(String(moduleCode))) {
          fail(`${at}: module "${String(moduleCode)}" does not exist`);
        }
        if (moduleCode === undefined && e["firstCall"] === undefined) {
          fail(`${at}: kind=intent must provide at least module or firstCall`);
        }
      }

      out.push(e as unknown as QuickAskEntry);
    });
  }
  return out;
}

const PLATFORM_COLUMNS: ReadonlySet<string> = new Set([
  "id", "code", "status", "createdAt", "createdBy", "updatedAt", "updatedBy",
]);

function hasField(schema: ModuleSchema, key: string): boolean {
  if (PLATFORM_COLUMNS.has(key)) return true;
  for (const field of schema.fields) {
    if (field.key === key) return true;
    if (field.type !== "subtable") continue;
    for (const column of field.fields ?? []) {
      if (`${field.key}.${column.key}` === key) return true;
    }
  }
  return false;
}

/**
 * Status values must match the lifecycle declaration character for character.
 *
 * `normalizeQuery` does not cover this (it only judges whether the status field is queryable), and one mistyped character
 * means the query always returns 0 rows and reports no error — the user sees "there are no documents waiting for review today", when in fact there are 8.
 */
function assertStatuses(node: unknown, schema: ModuleSchema, at: string): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj["kind"] === "group") {
    for (const child of (obj["children"] as unknown[]) ?? []) assertStatuses(child, schema, at);
    return;
  }
  if (obj["field"] !== "status") return;
  const declared = (schema.lifecycle?.statuses ?? []).map((s) => s.key);
  if (declared.length === 0) return;
  const value = obj["value"];
  for (const v of Array.isArray(value) ? value : [value]) {
    if (typeof v === "string" && !declared.includes(v)) {
      fail(`${at}: module "${schema.code}" has no status "${v}" — its statuses are ${declared.join(" / ")}`);
    }
  }
}
