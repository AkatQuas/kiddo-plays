// ---------------------------------------------------------------------------
// Module discovery search — fold a natural business phrase into a fixed number of candidates
//
// This is a high-recall candidate reducer. It is not a unique decision, and it
// does not translate business words into query conditions. It only consumes the
// business names and short descriptions developers declared. Zero IO, no model,
// no vectors.
// ---------------------------------------------------------------------------

import { compileOperations } from "./operations.js";
import { schemaFail } from "../schema/common.js";
import type { Field } from "../schema/fields.js";
import { transitionActions } from "../schema/lifecycle.js";
import type { ModuleSchema } from "../schema/module.js";

/** Fixed server return cap. Not exposed to the model as an argument. */
export const MODULES_SEARCH_LIMIT = 5;

/** A reasonable cap on query length. A longer sentence should be folded into a business phrase first, not sent as a whole narrative. */
export const MODULES_SEARCH_QUERY_MAX = 120;

export interface ModuleSearchHit {
  readonly module: string;
  readonly label: string;
  readonly domain: string;
  readonly domainLabel: string;
}

type TermKind = "name" | "code" | "field" | "lifecycle" | "text" | "domain";

interface SearchTerm {
  readonly text: string;
  readonly weight: number;
  readonly kind: TermKind;
}

export interface ModuleSearchDoc {
  readonly module: string;
  readonly label: string;
  readonly domain: string;
  readonly domainLabel: string;
  readonly terms: readonly SearchTerm[];
}

const WEIGHT: Readonly<Record<TermKind, number>> = Object.freeze({
  name: 100,
  code: 80,
  field: 36,
  lifecycle: 28,
  text: 12,
  domain: 8,
});

/**
 * Generic words that are not a sufficient match on their own.
 * They can strengthen a business phrase that is already present. A hit only in
 * a domain name or a description must not pull the whole domain back.
 */
const GENERIC_TOKENS: ReadonlySet<string> = new Set([
  "purchase",
  "sales",
  "production",
  "inventory",
  "finance",
  "funds",
  "management",
  "document",
  "business",
  "module",
  "system",
  "data",
  "information",
  "record",
  "list",
  "query",
  "process",
  "operation",
  "handling",
  "work",
  "status",
  "related",
  "all",
  "every",
]);

const PUNCT_RE = /[\s,.!?;:()[\]"'/\\|+~-]+/g;
const SPOKEN_PREFIX_RE = /^(?:please |kindly |help me |show me )+/;
const SPOKEN_INFIX_RE = /a bit of |a bit |a little /g;
/** Stripped from Latin tokenization so fillers cannot substring-match business terms (e.g. "me" inside "material"). */
const SPOKEN_FILLER_TOKENS: ReadonlySet<string> = new Set(["help", "me", "please", "kindly", "bit", "show"]);

/**
 * Role names for the same warehouse action. A closed word family in the search
 * layer, not a module alias, and not part of the declaration. Sales says "ship";
 * the warehouse says "issue". The user's words often use only one side.
 */
const ROLE_VERB_CLASSES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze(["ship", "issue"]),
]);

const ROLE_VERB_OF: ReadonlyMap<string, readonly string[]> = new Map(
  ROLE_VERB_CLASSES.flatMap((group) => group.map((verb) => [verb, group] as const)),
);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(PUNCT_RE, "");
}

/** Drop spoken prefixes and fillers such as "a bit", so "issue a bit of material" returns to the declared "issue material". */
function compactSpoken(value: string): string {
  let text = value.trim().toLowerCase();
  text = text.replace(SPOKEN_PREFIX_RE, "");
  text = text.replace(SPOKEN_INFIX_RE, " ");
  return text.replace(PUNCT_RE, "");
}

function roleVerbsOf(token: string): readonly string[] {
  return ROLE_VERB_OF.get(token) ?? [];
}

function addTerm(terms: SearchTerm[], raw: string | null | undefined, kind: TermKind): void {
  if (raw === undefined || raw === null) return;
  const text = normalize(raw);
  if (text.length < 2) return;
  terms.push({ text, weight: WEIGHT[kind], kind });
}

function camelParts(code: string): readonly string[] {
  return code
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 2);
}

function collectFields(fields: readonly Field[], terms: SearchTerm[]): void {
  for (const field of fields) {
    addTerm(terms, field.label, "field");
    addTerm(terms, field.help, "text");
    if (field.options) {
      for (const option of field.options) {
        addTerm(terms, option.value, "field");
        if (option.label !== option.value) addTerm(terms, option.label, "field");
      }
    }
    if (field.fields) collectFields(field.fields, terms);
  }
}

function domainLabelOf(domain: string, labels: ReadonlyMap<string, string>): string {
  const label = labels.get(domain);
  if (!label) schemaFail(`Domain "${domain}" has no declared business name`);
  return label;
}

/** Build search documents from module declarations. Domain labels have one source of truth: catalog.domains. */
export function buildModuleSearchDocs(
  modules: readonly ModuleSchema[],
  domainLabels: ReadonlyMap<string, string>,
): readonly ModuleSearchDoc[] {
  return [...modules]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((schema) => {
      const domainLabel = domainLabelOf(schema.domain, domainLabels);
      const terms: SearchTerm[] = [];
      addTerm(terms, schema.label, "name");
      addTerm(terms, schema.code, "code");
      for (const part of camelParts(schema.code)) addTerm(terms, part, "code");
      addTerm(terms, domainLabel, "domain");
      addTerm(terms, schema.domain, "domain");
      addTerm(terms, schema.numbering?.prefix ?? null, "name");
      collectFields(schema.fields, terms);
      for (const status of schema.lifecycle.statuses) {
        addTerm(terms, status.label, "lifecycle");
        addTerm(terms, status.key, "lifecycle");
      }
      for (const action of transitionActions(schema.lifecycle)) {
        addTerm(terms, action.action, "lifecycle");
        for (const param of action.params) addTerm(terms, param.label, "field");
      }
      for (const rule of schema.preconditions) addTerm(terms, rule.why, "text");
      for (const handoff of schema.handoff) addTerm(terms, handoff.title, "text");
      for (const group of schema.views.form) addTerm(terms, group.title, "text");
      for (const bench of schema.views.workbenches) addTerm(terms, bench.label, "text");
      for (const attach of schema.views.attachExisting) {
        addTerm(terms, attach.label, "text");
        addTerm(terms, attach.targetLabel, "text");
      }
      for (const op of compileOperations(schema)) {
        addTerm(terms, op.label, "text");
        addTerm(terms, op.summary, "text");
      }
      return {
        module: schema.code,
        label: schema.label,
        domain: schema.domain,
        domainLabel,
        terms,
      };
    });
}

interface QueryTokens {
  readonly raw: string;
  readonly tokens: readonly string[];
}

function addCjkTokens(text: string, tokens: Set<string>, lexicon: ReadonlySet<string>): void {
  for (const run of text.match(/[\u3400-\u9fff]+/g) ?? []) {
    const segments = [run].filter((segment) => segment.length >= 2);
    for (const segment of segments) {
      tokens.add(segment);
      for (let i = 0; i + 2 <= segment.length; i += 1) {
        tokens.add(segment.slice(i, i + 2));
      }
      for (let n = 3; n <= Math.min(4, segment.length); n += 1) {
        for (let i = 0; i + n <= segment.length; i += 1) {
          const gram = segment.slice(i, i + n);
          if (lexicon.has(gram)) tokens.add(gram);
        }
      }
    }
  }
}

function queryTokens(query: string, lexicon: ReadonlySet<string>): QueryTokens {
  const raw = compactSpoken(query);
  const tokens = new Set<string>();
  addCjkTokens(raw, tokens, lexicon);
  for (const latin of query.toLowerCase().match(/[a-z][a-z0-9]{1,}/g) ?? []) {
    if (SPOKEN_FILLER_TOKENS.has(latin)) continue;
    tokens.add(latin);
    for (const part of camelParts(latin)) tokens.add(part);
  }
  for (const token of [...tokens]) {
    for (const verb of roleVerbsOf(token)) tokens.add(verb);
  }
  return {
    raw,
    tokens: [...tokens].sort((left, right) => right.length - left.length || left.localeCompare(right)),
  };
}

function tokenScore(term: SearchTerm, token: string): number {
  if (!term.text.includes(token)) return 0;
  let score = term.weight * token.length;
  if (term.text === token) score *= 3;
  else if (term.text.startsWith(token)) score *= 1.5;
  if (GENERIC_TOKENS.has(token)) score *= 0.2;
  return score;
}

function isStrongHit(term: SearchTerm, token: string): boolean {
  if (term.kind === "name" || term.kind === "code") return true;
  if (GENERIC_TOKENS.has(token)) return false;
  return term.kind === "field" || term.kind === "lifecycle";
}

interface RankedDoc {
  readonly hit: ModuleSearchHit;
  readonly score: number;
}

function rankDoc(doc: ModuleSearchDoc, query: QueryTokens): RankedDoc | null {
  if (!query.raw) return null;
  let score = 0;
  let strong = false;
  const matched: string[] = [];

  if (query.raw.length >= 2 && doc.terms.some((term) => term.kind === "name" && term.text.includes(query.raw))) {
    score += 220;
    strong = true;
  }

  for (const token of query.tokens) {
    if (matched.some((seen) => seen.includes(token))) continue;
    let best = 0;
    let bestTerm: SearchTerm | null = null;
    for (const term of doc.terms) {
      const hit = tokenScore(term, token);
      if (hit > best) {
        best = hit;
        bestTerm = term;
      }
    }
    if (best <= 0 || bestTerm === null) continue;
    matched.push(token);
    score += best;
    if (isStrongHit(bestTerm, token)) strong = true;
  }

  if (!strong || score <= 0) return null;
  return {
    hit: {
      module: doc.module,
      label: doc.label,
      domain: doc.domain,
      domainLabel: doc.domainLabel,
    },
    score,
  };
}

/**
 * Search modules by query. No sufficient match returns an empty array, not the whole catalog.
 * Equal scores sort stably by module code.
 */
export function searchModules(
  docs: readonly ModuleSearchDoc[],
  query: string,
  limit = MODULES_SEARCH_LIMIT,
): readonly ModuleSearchHit[] {
  if (limit < 1) schemaFail("The internal limit of modules_search must be a positive integer");
  const lexicon = new Set(docs.flatMap((doc) => doc.terms.map((term) => term.text)));
  const tokens = queryTokens(query, lexicon);
  const ranked = docs
    .map((doc) => rankDoc(doc, tokens))
    .filter((entry): entry is RankedDoc => entry !== null)
    .sort((left, right) => right.score - left.score || left.hit.module.localeCompare(right.hit.module));
  return ranked.slice(0, limit).map((entry) => entry.hit);
}
