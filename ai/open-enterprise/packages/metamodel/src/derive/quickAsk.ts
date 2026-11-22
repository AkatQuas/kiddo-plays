// ---------------------------------------------------------------------------
// Quick-ask matching — "which entry under quick-asks/ does this sentence hit"
//
// Same shape as `moduleSearch.ts`: it only eats declarations, zero IO, no model
// call, no vectors. The reference implementation is `quick-asks/scripts/_match.mjs`
// (the product preview service runs the same algorithm) — the two must stay
// word-for-word on the same rule. Drift shows up as "it hits fine in preview and
// misses in production", and neither side reports an error.
//
// ## Why this is worth having
//
// The 31 sentences on the home page are fixed wording the buttons send, plus the
// 100+ the product will add later. Writing all of them into the agent's resident
// body means: (1) about 77 characters each, paid in full every turn; (2) a flash
// model doing literal match across a hundred-line table and also turning prose into
// nested query JSON — measured at 31 entries it already wrote `orderDate` as
// `createdAt` and `limit:100` as `200`.
//
// After the switch: the resident text is one sentence plus one `quick_ask({ask})`
// tool. Whether the table has 30 entries or 300, the resident bytes are exactly
// the same. The model's whole job this turn is to copy what the user just said into one parameter.
//
// ## Three layers, loosened one by one, but prefer a miss over a guess
//
//   1. Exact     equal word for word after normalization. Wording a button sends takes this path.
//   2. Alias     `aliases` declared on the entry ("bought too dear" → "which prices are clearly high").
//   3. Lexical   tokens + weight + IDF. The vocabulary comes from the declaration itself:
//                module names, status values inside conditions, text, aliases.
//
// ## Why not vectors / embeddings
//
// The most dangerous pair here is exactly the one that is semantically very close and whose answers are completely different:
//
//     "which material issues are not approved yet" → materialIssue status=pendingReview  (issue not confirmed yet)
//     "which materials have arrived and are not received yet" → purchaseReceipt status=pendingReview  (goods arrived, receipt not confirmed)
//
// Embedding similarity is 0.95+, and the cost of answering wrong is handing the user a completely different batch of documents, with nothing looking wrong on the page.
// Embeddings are worse than lexical match on this pair — lexical match at least holds the two distinguishing characters.
// What is wanted here is not stronger recall. It is a stronger refusal: `ambiguous` and `miss` are both designed, normal endings.
// ---------------------------------------------------------------------------

/** Declaration of one quick ask. The shape corresponds word for word to `quick-asks/asks/*.json`. */
export interface QuickAskEntry {
  readonly key: string;
  /** Saying this sentence hits it. The original wording the home-page button sends. */
  readonly text: string;
  /** Other ways the user might say it. A hit still counts as the `exact` band. */
  readonly aliases?: readonly string[];
  /** Which assistant bubble on the home page shows it. `null` means do not show it, but it can still be asked (matching is global). */
  readonly showOn?: string | null;
  readonly surface?: string;
  readonly label?: string;
  /**
   * `unsupported` means what this sentence asks does not exist in this repo.
   *
   * It is not a placeholder for "not built yet". It is a real answer: say "the system
   * has no such measure" on the first turn, instead of letting the model look for a field that does not exist.
   *
   * The cost of not declaring it was measured (8/21 production, "which rejected receipts are still over 2 days old with no return-or-exchange document created?"):
   * the receipt has no accepted/rejected quantity, so the model called module_describe 7 times,
   * bill_get 7 times, and loaded open-meta-ops 4 more times — 23 tools, 450k input tokens —
   * and still turned around to ask the user "what do you mean by rejected". It could have said that on the first turn.
   */
  readonly kind: "list" | "insight" | "intent" | "skill" | "unsupported";
  /** kind=unsupported: why it cannot be answered. Be specific to a field or module. Do not only say "unsupported". */
  readonly reason?: string;
  /** kind=unsupported: the closest questions that can be answered (original wording), laid out as choices for the model. */
  readonly instead?: readonly string[];
  readonly note?: string;
  /**
   * Which card this question should produce, pinned in advance.
   *
   * It exists because a question that asks to do work, such as "help me create a document",
   * degrades into a prose Q&A when the model decides how to present it ("which customer? what to buy? which delivery date?") —
   * and what the user wanted by pressing that button is a form that can be filled in. The card name and props are written in the declaration.
   * The server hands them to the host to render as they are. The model does not compose a single word.
   *
   * The shape matches the fence body in open-agent-ui: `{ component, props }`.
   * The source of truth for component names is the skill-components manifest, not this repo — load time can only check the shape.
   * It cannot check "whether this component exists". A wrong name shows up as that cell not rendering, which the quick-asks preview page can see.
   */
  readonly card?: { readonly component: string; readonly props?: Readonly<Record<string, unknown>> };
  /** kind=list */
  readonly module?: string;
  readonly where?: unknown;
  readonly sort?: readonly { readonly field: string; readonly desc?: boolean }[];
  readonly columns?: readonly string[];
  /** kind=insight */
  readonly scenario?: string;
  /**
   * Which cells of the scenario this question is answered by (metric / group keys).
   *
   * ## It blocks the class of mistake a gate cannot block
   *
   * Previously only "does the scenario exist" was checked, so all 25 insight questions passed — and six of them hung on a scenario
   * that could not answer them ("shortage risk" hung on task delay, "must replenish" hung on payables coming due).
   * Measured in production on 8/18: sorting by time taken was sorting by whether they matched. A match took 6–7 seconds. A mismatch took 24–246 seconds.
   * It is slow because, after receiving data that answers a different question, the model starts over and queries again, and that useless payload
   * stays in context, making every later turn more expensive.
   *
   * Being unable to write `answeredBy` means this scenario cannot answer this sentence — what has to change then is the question or the scenario,
   * not hanging it on to make up the count. This field turns "does it match" from a subjective judgment into a checkable fact.
   *
   * The source of truth for the keys is the key each scenario in `insight.ts` actually produces. This repo's loader cannot depend on the server layer,
   * so load time only checks the shape (a non-empty string array). Key-by-key checking is the gate in `quickAsk.test.ts`.
   */
  readonly answeredBy?: readonly string[];
  /** kind=intent */
  readonly firstCall?: string;
  readonly precondition?: string;
  /** kind=skill */
  readonly skill?: string;
}

/** Normalize: only differences the user should not be responsible for (whitespace, fullwidth, a trailing question mark). */
export function normalizeAsk(text: string): string {
  return String(text ?? "")
    .trim()
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ")
    .replace(/[?\uff1f]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Spoken fillers. "Help me look up … please" and "look up …" are the same question.
 *
 * Strip multi-character fillers only. A single character was included once, and `awaitingRelease` was stripped into a broken fragment —
 * both sides broke together so they could still match, but the vocabulary no longer contained the word for "release", and other sentences could not find it.
 */
/**
 * Shells with no business meaning, removed before tokenization.
 *
 * Order matters: "help me create" / "help me make" must come before "help me" (the regex tries left to right).
 * If they come later, only "help me" is eaten, and the leftover "make a document" becomes a 3-gram —
 * it straddles the verb and the noun, has no business meaning, and gets a very high IDF because only one entry happens to contain it.
 * Measured consequence: "help me make a stock-out" confidently hit "help me make a stock-in" at 138,
 * while the characters that actually distinguish them never become a word. After the shell is removed, both sides are left with
 * "stock-out" versus "stock-in", and the only overlap is the generic word "document", so it falls back to ambiguity — the user clicks once to decide.
 *
 * Multi-character shells only. A single character was collected once and cut "awaitingRelease" apart, and nothing hit.
 * Do not also collect "help me newly create": that would shave "help me newly create a document" down to a fragment sitting next to "release",
 * the character this repo most easily damages by mistake.
 */
const FILLER =
  /(\u5e2e\u6211\u521b\u5efa|\u5e2e\u6211\u5efa|\u5e2e\u6211|\u9ebb\u70e6|\u8bf7\u95ee|\u6211\u60f3|\u6211\u8981|\u60f3\u8981|\u6211\u9700\u8981|\u80fd\u4e0d\u80fd|\u53ef\u4e0d\u53ef\u4ee5|\u7ed9\u6211|\u66ff\u6211|\u4e00\u4e0b\u5b50|\u4e00\u4e0b|\u770b\u770b|\u67e5\u67e5|\u7684\u8bdd|\u76ee\u524d|\u5f53\u524d|\u7cfb\u7edf\u91cc|\u91cc\u9762|\u600e\u4e48\u6837|\u600e\u6837|\u5982\u4f55)/g;

const CJK = /[\u3400-\u9fff]+/g;

function strip(text: string): string {
  return normalizeAsk(text).replace(FILLER, "");
}

/** Weight of a search term, by how well this word can locate this one entry. */
const WEIGHT: Readonly<Record<string, number>> = {
  text: 10, alias: 10, status: 8, module: 6, column: 2,
};

interface Term {
  readonly text: string;
  readonly kind: string;
}

interface QuickAskDoc {
  readonly entry: QuickAskEntry;
  readonly terms: readonly Term[];
}

export interface QuickAskIndex {
  readonly exact: ReadonlyMap<string, QuickAskEntry>;
  readonly docs: readonly QuickAskDoc[];
  readonly lexicon: ReadonlySet<string>;
  readonly idf: (token: string) => number;
  /** Generic words that, alone, cannot locate any entry. The vocabulary is injected by the declaration catalog. This only down-weights them. */
  readonly generic: ReadonlySet<string>;
}

/** Every status value that appears in the condition tree — the words that best distinguish two neighboring questions. */
function collectStatuses(node: unknown, into: string[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj["kind"] === "group") {
    for (const child of (obj["children"] as unknown[]) ?? []) collectStatuses(child, into);
    return;
  }
  if (obj["field"] !== "status") return;
  const value = obj["value"];
  for (const v of Array.isArray(value) ? value : [value]) {
    if (typeof v === "string" && v) into.push(v);
  }
}

function grams(text: string, min: number, max: number, into: Set<string>): void {
  for (const run of text.match(CJK) ?? []) {
    for (let n = min; n <= Math.min(max, run.length); n += 1) {
      for (let i = 0; i + n <= run.length; i += 1) into.add(run.slice(i, i + n));
    }
  }
}

/**
 * Build the index. `moduleLabels` is module code → display name. The source of truth for synonyms is the system's own declaration,
 * not a separately written word list.
 */
export function buildQuickAskIndex(
  entries: readonly QuickAskEntry[],
  moduleLabels: Readonly<Record<string, string>> = {},
  genericTokens: readonly string[] = [],
): QuickAskIndex {
  const exact = new Map<string, QuickAskEntry>();
  const docs: QuickAskDoc[] = [];
  const lexicon = new Set<string>();

  for (const entry of entries) {
    const terms: Term[] = [];
    const add = (raw: string | undefined, kind: string): void => {
      const t = strip(raw ?? "");
      if (t.length < 2) return;
      terms.push({ text: t, kind });
      // The vocabulary must collect every 3–6 character substring of this word, not only the whole word.
      // The version that collected only whole words missed across the board: a 3-gram on the query side counts as a word only if it appeared in the vocabulary,
      // and "material issue" is only a stretch of "which material issues are not approved yet", never a whole word — so it could never be cut out,
      // leaving only two-character fragments, which do not clear the "one word that can locate it" gate.
      grams(t, 3, 6, lexicon);
    };

    const key = normalizeAsk(entry.text);
    if (!exact.has(key)) exact.set(key, entry);
    for (const alias of entry.aliases ?? []) {
      const k = normalizeAsk(alias);
      if (!exact.has(k)) exact.set(k, entry);
      add(alias, "alias");
    }
    // The words printed on the button are themselves a way of asking, but they enter the exact index only, not the lexical vocabulary.
    //
    // They enter the exact index because the home-page button sends `text`, while a user repeating it, an acceptance script, and a dashboard prompt
    // often send `label` ("new order" rather than "help me newly create an order"). Leaving it out was measured — "new order" fell into the ambiguity band,
    // the model skipped quick_ask entirely and loaded a Skill itself, 227 seconds.
    //
    // Keeping it out of the lexical vocabulary was a later cut, also measured: a label is short, and it uses
    // the business-object name ("shipment", "receipt") — which is also a noun. Once it is in the vocabulary,
    // any long question that mentions this object hits it for the whole stretch, and also takes the triple bonus of `term.text === token`:
    //
    //     "help me see which shipments have already been released" → new shipment  556 points
    //
    // The user is looking up a list, and the screen pops a create-document form. The literal overlap is 4/4,
    // and the lexical layer cannot tell them apart — the real difference is "which ones … already" versus "help me …", which is sentence shape, not a word.
    // So a label is recognized only when the whole sentence is equal: that is when the user really read the words on the button.
    if (entry.label !== undefined && entry.label !== "") {
      const k = normalizeAsk(entry.label);
      if (!exact.has(k)) exact.set(k, entry);
    }
    add(entry.text, "text");
    if (entry.module !== undefined) add(moduleLabels[entry.module], "module");
    const statuses: string[] = [];
    collectStatuses(entry.where, statuses);
    for (const s of statuses) add(s, "status");
    for (const c of entry.columns ?? []) if (CJK.test(c)) add(c, "column");

    docs.push({ entry, terms });
  }

  // IDF: a word has locating value only if it appears in few entries.
  // Without it, "material issues not yet approved" scores almost equally on "pendingReview" and "awaitingShipment" —
  // the shared "material issue" is long and contributes the most, while the word that actually distinguishes them is only a two-character fragment.
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set<string>();
    for (const term of doc.terms) grams(term.text, 2, 6, seen);
    for (const g of seen) df.set(g, (df.get(g) ?? 0) + 1);
  }
  const idf = (token: string): number => Math.log(1 + docs.length / (1 + (df.get(token) ?? 0)));

  return { exact, docs, lexicon, idf, generic: new Set(genericTokens) };
}

function tokensOf(text: string, lexicon: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set<string>();
  for (const run of text.match(CJK) ?? []) {
    if (run.length >= 2) out.add(run);
    for (let i = 0; i + 2 <= run.length; i += 1) out.add(run.slice(i, i + 2));
    for (let n = 3; n <= Math.min(6, run.length); n += 1) {
      for (let i = 0; i + n <= run.length; i += 1) {
        const gram = run.slice(i, i + n);
        if (lexicon.has(gram)) out.add(gram);
      }
    }
  }
  for (const latin of text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? []) out.add(latin);
  return out;
}

/**
 * How well one entry explains this sentence: the total score, plus which words it explained.
 *
 * Both are required. The total answers "how alike". The word set answers "alike in what" — and the latter can separate a case
 * the total cannot: two scores bite close, but one of them is reading a part of the other.
 */
function scoreDoc(
  doc: QuickAskDoc,
  queryTokens: ReadonlySet<string>,
  idf: (t: string) => number,
  generic: ReadonlySet<string>,
): { readonly total: number; readonly tokens: ReadonlySet<string> } {
  let total = 0;
  let strong = false;
  const used: string[] = [];
  for (const token of [...queryTokens].sort((a, b) => b.length - a.length)) {
    if (used.some((seen) => seen.includes(token))) continue;
    let best = 0;
    let bestKind: string | null = null;
    for (const term of doc.terms) {
      /**
       * Fold case before comparing.
       *
       * The query side writes `text.toLowerCase()` when cutting Latin words, while `normalizeAsk` on the index side does not fold
       * case — so the vocabulary stores `BOM`, the query gives `bom`, and `includes` is always false.
       * The consequence is not "a little off". The word disappears completely. Measured:
       * "look up the BOM list for flange-0827-49f3" scored only the two characters for "list" across the whole field, three unrelated
       * entries tied at 78 (each happened to contain "list" in an alias), and the real BOM query ranked fourth.
       * 11 of 241 catalog entries contain an uppercase Latin word (BOM×5, OCR×4, XX, AI). None of them could match before.
       *
       * What is folded is the comparison itself, not `term.text`: that still has to be handed back to the user as it was.
       */
      const text = term.text.toLowerCase();
      if (!text.includes(token)) continue;
      let s = (WEIGHT[term.kind] ?? 1) * token.length * idf(token);
      if (text === token) s *= 3;
      if (generic.has(token)) s *= 0.2;
      if (s > best) { best = s; bestKind = term.kind; }
    }
    if (best <= 0) continue;
    used.push(token);
    total += best;
    // Only "one word that can locate it" counts. Hitting only a generic word ("document", "which") is not a hit.
    if (!generic.has(token) && (bestKind === "status" || bestKind === "module" || bestKind === "alias" || token.length >= 3)) {
      strong = true;
    }
  }
  return strong ? { total, tokens: new Set(used) } : { total: 0, tokens: new Set<string>() };
}

/** Anything below this score is not recognized. */
export const QUICK_ASK_MIN_SCORE = 60;
/** The first place must lead the second by this multiple, or it counts as ambiguous — this gate blocks the "approve / stock-out" pair. */
export const QUICK_ASK_MARGIN = 1.35;
/** At most this many candidates are handed over for the user to pick when it is ambiguous. */
export const QUICK_ASK_CANDIDATES = 3;

export type QuickAskMatch =
  | { readonly how: "exact" | "lexical"; readonly entry: QuickAskEntry }
  | { readonly how: "ambiguous"; readonly candidates: readonly QuickAskEntry[] }
  | { readonly how: "miss"; readonly reason?: "uncovered" };

/**
 * Match. Three endings, and no fourth:
 *   `exact` / `lexical` — take the fast path
 *   `ambiguous`         — do not guess; hand the candidates over so the assistant can ask the user
 *   `miss`              — fall back to ordinary routing. Slow, but it will not answer wrong
 */
/**
 * An explicit "I am asking for a list" sentence shape.
 *
 * They do not point at any one entry (anyone might be asked this way), so they do not enter the vocabulary and they do not take part in scoring.
 * They do one thing: strike the create-document form class out of the lexical candidates.
 *
 * ## Why this cut is required
 *
 * The original wording of a create button naturally contains the business-object name — "help me create a stock-in", "help me ship".
 * So any sentence that asks about this object hits it for the whole stretch, and the score is high:
 *
 *     "help me see which shipments have already been released" → new shipment  556 points
 *     "which stock-ins are not finished yet"                   → new stock-in
 *
 * The user is looking up a list, and the screen pops a form for them to fill in. The literal overlap is complete,
 * and the word layer cannot tell them apart — the real difference is "which ones … already" versus "help me …", which is sentence shape, not a word.
 * So this cut is made on sentence shape.
 *
 * Only the lexical band is cut. An exact hit on the original wording or an alias is unaffected: if the user really says "help me ship", the form still comes out.
 */
const ASKING = /(\u54ea\u4e9b|\u54ea\u4e2a|\u54ea\u5bb6|\u54ea\u5f20|\u54ea\u6761|\u54ea\u4f4d|\u591a\u5c11|\u6709\u6ca1\u6709|\u5217\u51fa|\u67e5\u4e00\u4e0b|\u67e5\u8be2|\u7edf\u8ba1|\u770b\u4e00\u4e0b|\u770b\u770b)/;

/**
 * Whether the entry's own wording is "go and do a piece of work". The dual of `ASKING`, also cut on sentence shape.
 *
 * Why the `card` band is not enough: it only recognizes entries that "pop a form when pressed", and upload / import
 * have no form and start by receiving a file, so they still slip through. Measured: one sentence "look up the BOM list for X"
 * tied with an entry "upload a BOM file to create a version" — both contain `BOM`, the word layer cannot separate them,
 * and the real difference is "look up …" versus "upload …", which is sentence shape, not a word.
 *
 * Recognize the start only, not a containment: an entry that starts with "query" will still contain other verbs in the body,
 * and judging by containment would strike it out too. The first verb of the original wording is the declaration of what this entry does.
 *
 * What is collected is an action verb, not a business word: upload / create / import have nothing to do with module names or status values.
 * They are the same class of thing as "which" / "look up" in `ASKING` (sentence shape). The framework stays unaware of the business.
 */
const ACTING = /^(\u4e0a\u4f20|\u5bfc\u5165|\u5bfc\u51fa|\u65b0\u5efa|\u521b\u5efa|\u65b0\u589e|\u5f55\u5165|\u767b\u8bb0|\u53d1\u8d77|\u5220\u9664|\u4fee\u6539|\u7f16\u8f91)/;

/**
 * Whether pressing this one means going to do work — the class a list question should least guess.
 *
 * The two criteria are a union:
 *   · it has a `card` (pressing it pops a form to fill in);
 *   · the original wording is itself an action (`ACTING`).
 */
function isFormEntry(entry: QuickAskEntry): boolean {
  if (entry.card !== undefined && (entry.kind === "intent" || entry.kind === "skill")) return true;
  return ACTING.test(normalizeAsk(entry.text));
}

/**
 * A fixed fetch can explain a complete question only. A score only proves "alike". It must not swallow extra conditions.
 * Compare the original wording and each alias one by one, and keep uncovered characters, numbers, and names. Do not splice different aliases into one measure.
 * Only a question shell with no conditional meaning is exempt. Time, negation, scope, and sort words are not exempt.
 * intent/skill are still handed to ordinary routing to bind concrete values. Business fields are not inferred here.
 * fixedQuestionCovered in the preview mirror must keep the same algorithm.
 */
const QUESTION_SHELL = /(\u5e2e\u6211|\u9ebb\u70e6|\u8bf7\u95ee|\u8bf7|\u6211\u60f3|\u6211\u9700\u8981|\u80fd\u4e0d\u80fd|\u53ef\u4e0d\u53ef\u4ee5|\u7ed9\u6211|\u66ff\u6211|\u4e00\u4e0b\u5b50|\u4e00\u4e0b|\u770b\u4e0b|\u770b\u4e00\u4e0b|\u770b\u770b|\u67e5\u67e5|\u67e5\u4e00\u4e0b|\u67e5\u8be2|\u67e5\u770b|\u5217\u51fa|\u6709\u54ea\u4e9b|\u54ea\u4e9b|\u7684|\u5462|\u5417|\u5440|\u554a)/g;

function fixedQuestionCovered(entry: QuickAskEntry, text: string): boolean {
  if (entry.kind !== "list" && entry.kind !== "insight") return true;
  const query = normalizeAsk(text).toLowerCase();
  return [entry.text, ...(entry.aliases ?? [])].some((phrase) => {
    const source = normalizeAsk(phrase).toLowerCase();
    const covered = Array<boolean>(query.length).fill(false);
    // Mark the original positions. Do not delete characters first and then splice the two sides into a new word.
    for (let at = 0; at + 2 <= query.length; at += 1) {
      if (source.includes(query.slice(at, at + 2))) {
        covered[at] = true;
        covered[at + 1] = true;
      }
    }
    for (const hit of query.matchAll(QUESTION_SHELL)) {
      for (let at = hit.index; at < hit.index + hit[0].length; at += 1) covered[at] = true;
    }
    return query.split("").every((char, at) => covered[at] || /[\s\uff0c,\u3002\uff1b;?!?\uff1f\u300c\u300d\u300e\u300f\u201c\u201d"'\uff1a:\u3001\uff08\uff09()]/u.test(char));
  });
}

export function matchQuickAsk(index: QuickAskIndex, text: string): QuickAskMatch {
  const direct = index.exact.get(normalizeAsk(text));
  if (direct) return { how: "exact", entry: direct };

  const tokens = tokensOf(strip(text), index.lexicon);
  if (tokens.size === 0) return { how: "miss" };

  // Judge sentence shape on the normalized original wording, not the stripped copy: "look" / "search" fillers have already been eaten by FILLER.
  const asking = ASKING.test(normalizeAsk(text));

  const ranked = index.docs
    .filter((doc) => !(asking && isFormEntry(doc.entry)))
    .map((doc) => {
      const hit = scoreDoc(doc, tokens, index.idf, index.generic);
      return { entry: doc.entry, score: hit.total, tokens: hit.tokens };
    })
    .filter((r) => r.score >= QUICK_ASK_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.entry.key.localeCompare(b.entry.key));

  if (ranked.length === 0) return { how: "miss" };
  const top = ranked[0]!;
  const second = ranked[1];
  if (!fixedQuestionCovered(top.entry, text)) return { how: "miss", reason: "uncovered" };
  if (second && top.score < second.score * QUICK_ASK_MARGIN) {
    /**
     * Among rivals that bite close, drop the weaker same reading first, then judge whether it is real ambiguity.
     *
     * The criterion: the words it explained are a proper subset of the first place's, and the score is lower. That is not "another reading of the same sentence".
     * It is "less of the same sentence" — the two do not form a choice.
     *
     * The ability to block the "approve / stock-out" pair is not reduced at all: those two each explain a word the other does not have
     * (approve / stock), neither is a subset of the other, and they are still handed to a person as ambiguity. Only when no rival remains after the drop does it count as a hit.
     *
     * Measured: "look up the BOM list for X" used to lay out three — the correct one explained `bom` and "list",
     * and the other two explained only `bom`, at a lower score. They are not another understanding. They are a weaker copy of the same one.
     */
    const strictSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
      a.size < b.size && [...a].every((one) => b.has(one));
    const rivals = ranked
      .slice(1)
      .filter((r) => r.score >= top.score / QUICK_ASK_MARGIN && !strictSubset(r.tokens, top.tokens));
    if (rivals.length === 0) return { how: "lexical", entry: top.entry };
    return { how: "ambiguous", candidates: ranked.slice(0, QUICK_ASK_CANDIDATES).map((r) => r.entry) };
  }
  return { how: "lexical", entry: top.entry };
}
