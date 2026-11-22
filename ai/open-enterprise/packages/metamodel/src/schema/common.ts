/**
 * Shared kernel helpers.
 *
 * 🔴 This package is zero IO: it does not import a database, read files, or touch
 * the network. Callers inject anything that needs data. That is why `yarn test`
 * can run every gate offline on an FDE laptop.
 */

/** Declaration-layer error: the schema is wrong. Distinct from a runtime business error. */
export class SchemaError extends Error {
  override readonly name: string = "SchemaError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * An actionable hint attached to a rejection.
 *
 * 🔴 The test: after reading this error, can the caller (a model or a browser)
 * fix it in one try? "No such field" alone forces another guess. A legal set
 * plus the nearest candidates means it does not have to guess.
 *
 * `fixable` says who should fix it. The cost of leaving that dimension out has
 * been measured: the model cannot tell whether to edit itself or ask the user,
 * so it retries, and the same parameters can be sent a dozen times
 * (`assertNotLooping` exists as the stop-loss for that).
 */
export interface QueryInputHint {
  /** Legal values on this dimension. The constructor truncates when the set is long and says so in `correctUsage`. */
  readonly valid?: readonly string[];
  /** The few legal values closest to the bad value. An empty array means the same as omission; do not send an empty array. */
  readonly didYouMean?: readonly string[];
  /**
   * `machine` = the right answer can be computed from the declaration or the data, and the caller should fix it and retry;
   * `human`   = the right answer exists only in the user's head (how wide, which basis), so stop and ask.
   */
  readonly fixable?: "machine" | "human";
  /** Where to read the full declaration (a tool call or a path). When the legal set cannot be given, at least give this. */
  readonly read?: string;
}

/**
 * Structured input error for a query request.
 *
 * Query conditions are produced by both models and browsers. A single natural-language
 * sentence invites the caller to patch a string locally instead of returning to the
 * one legal shape. A stable code/path lets a program locate the problem, correctUsage
 * is a canonical form that can be rebuilt directly, and `hint` gives the legal set,
 * the nearest candidates, and who should fix it (see `QueryInputHint`).
 */
export class QueryInputError extends SchemaError {
  override readonly name = "QueryInputError";

  constructor(
    message: string,
    readonly code: string,
    readonly path: string,
    readonly correctUsage: string,
    readonly hint: QueryInputHint = {},
  ) {
    super(message);
  }
}

export function queryInputFail(
  code: string,
  path: string,
  message: string,
  correctUsage: string,
  hint: QueryInputHint = {},
): never {
  throw new QueryInputError(message, code, path, correctUsage, hint);
}

/**
 * The only on-the-wire shape of a rejection, for the whole system.
 *
 * 🔴 One function, not an inline expansion at every exit: each new field on
 * `hint` that an exit forgets does not throw. It only costs that caller one
 * chance to get it right in a single try — and the missing field has no outward
 * symptom except "the model retries especially hard on this path".
 */
export function queryInputWire(err: QueryInputError): Readonly<Record<string, unknown>> {
  return {
    error: err.message,
    code: err.code,
    path: err.path,
    correctUsage: err.correctUsage,
    ...(err.hint.valid?.length ? { valid: err.hint.valid } : {}),
    ...(err.hint.didYouMean?.length ? { didYouMean: err.hint.didYouMean } : {}),
    ...(err.hint.fixable ? { fixable: err.hint.fixable } : {}),
    ...(err.hint.read ? { read: err.hint.read } : {}),
  };
}

/** How many `didYouMean` candidates to return at most — more than this and the model tries them one by one, which is slower than giving none. */
const DID_YOU_MEAN_MAX = 3;
/** An edit distance above this fraction of the bad value's length is not "close". Prefer to give nothing. */
const DID_YOU_MEAN_RATIO = 0.5;

/** Case-insensitive Levenshtein distance. Pure computation; the package's zero-IO rule still holds. */
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[t.length] ?? Math.max(s.length, t.length);
}

/**
 * Pick the legal values closest to the bad value.
 *
 * 🔴 Prefer an empty array over padding: a candidate that is nowhere near the
 * input will actually be tried, which is slower than "no candidate, go read the
 * declaration", and the failure is quieter (the condition is syntactically legal
 * and the result is always empty). So there is a distance-ratio gate:
 * `createdDate`→`createdAt` is offered, `abc`→`createdAt` is not.
 *
 * A substring relation counts as a hit (`date`→`orderDate`) and is not subject
 * to the distance gate — that is the typical shape of a model that "remembered half",
 * where the edit distance is large.
 */
export function didYouMean(got: string, valid: readonly string[]): readonly string[] {
  const raw = typeof got === "string" ? got.trim() : "";
  if (!raw || valid.length === 0) return [];
  const lower = raw.toLowerCase();
  const limit = Math.max(1, Math.floor(raw.length * DID_YOU_MEAN_RATIO));
  const scored = valid
    .map((candidate) => {
      const c = candidate.toLowerCase();
      const contains = c.includes(lower) || lower.includes(c);
      return { candidate, distance: contains ? 0 : editDistance(raw, candidate) };
    })
    .filter((x) => x.distance <= limit)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));
  return scored.slice(0, DID_YOU_MEAN_MAX).map((x) => x.candidate);
}

export function schemaFail(message: string): never {
  throw new SchemaError(message);
}

/** A declaration slot must be a non-empty string. Empty, whitespace, and non-strings are rejected — no default. */
export function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) schemaFail(`${label} must be a non-empty string`);
  return (value as string).trim();
}

/** A finite number. NaN, Infinity, and non-numbers are rejected. */
export function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) schemaFail(`${label} must be a finite number`);
  return value as number;
}

/** Optional text: undefined / null / "" mean unset; a filled value is checked and trimmed by requireText. */
export function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireText(value, label);
}

/**
 * One segment of a schema coordinate: module code and Field.key share this closed grammar.
 *
 * They are spliced directly into dotted paths, URLs, permission keys, and stable ids.
 * Allowing arbitrary text means every consumer interprets `.`, `/`, `:`, `#`, and
 * other separators on its own; the same declaration can then point at different objects.
 * Only the lowerCamel ASCII shape already used by the real catalog is accepted.
 *
 * ⚠️ transition / status / domain codes are not the same kind of coordinate. Do not reuse this helper for them.
 */
export const COORDINATE_SEGMENT_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export function requireCoordinateSegment(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (value !== text || !COORDINATE_SEGMENT_PATTERN.test(text)) {
    schemaFail(
      `${label} "${String(value)}" is not a legal coordinate id: it must be lowerCamel ASCII (starts with a lowercase letter, then only letters or digits), ` +
        `for example salesOrder / productId`,
    );
  }
  return text;
}

/**
 * @param shape Expected shape. Saying only "must be an object" and echoing the
 *   received value tells the reader (especially a model) that it was wrong without
 *   saying what right looks like, so the next try is a different kind of wrong.
 *   The received value is still echoed, but truncated — it may be a whole document,
 *   and that does not belong in one error message.
 */
export function requireObject(value: unknown, label: string, shape?: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const got = JSON.stringify(value) ?? String(value);
    const shown = got.length > 200 ? `${got.slice(0, 200)}… (truncated)` : got;
    schemaFail(`${label} must be an object: ${shown}${shape === undefined ? "" : `. ${shape}`}`);
  }
  return value as Record<string, unknown>;
}

export function requireArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) schemaFail(`${label} must be an array`);
  return value;
}

/** Closed-enum check. Unknown values are not allowed — a closed enum is what keeps the hallucination space small. */
export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    schemaFail(`${label} "${String(value)}" is unknown; allowed: ${allowed.join(" / ")} (closed enum; unknown values are rejected)`);
  }
  return value as T;
}

/** Closed keys: a key outside the allow-list is rejected. Adding a key to a declaration means adding a concept, and it must pass the seventh-concept gate first. */
export function assertClosedKeys(raw: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const extra = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (extra.length) {
    schemaFail(`${label} unknown key "${extra.join(", ")}": only ${allowed.join(" / ")} allowed`);
  }
}

/**
 * Row-set filter: `{ status: "shipped" }` or `{ status: ["awaitingShipment", "partial"] }`.
 *
 * An array means `in`. This is not a new concept. It widens the value of the same key:
 * "not yet settled" is naturally a set of statuses in real work. Hard-coding a single
 * status silently drops intermediate states such as partial shipment — and the symptom
 * is a total that looks completely normal and is simply too small.
 *
 * 🔴 The value must be a scalar or a non-empty array of scalars. Allowing objects or
 * nested arrays would open a mini query language nobody implements, and the consumers
 * (the SQL compiler, kernel reads) would each guess a semantics.
 */
export type RowFilter = Readonly<Record<string, unknown>>;

export function normalizeRowFilter(raw: unknown, label: string): RowFilter {
  const obj = requireObject(raw, label);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const at = `${label}.${key}`;
    if (Array.isArray(value)) {
      if (!value.length) schemaFail(`${at} is an empty array — "in these values" with none given is never true`);
      value.forEach((v, i) => assertScalar(v, `${at}[${i}]`));
      out[key] = [...value];
      continue;
    }
    assertScalar(value, at);
    out[key] = value;
  }
  return out;
}

function assertScalar(value: unknown, label: string): void {
  const kind = typeof value;
  if (value === null || kind === "string" || kind === "number" || kind === "boolean") return;
  schemaFail(`${label} must be a scalar (string / number / boolean / null) or an array of scalars, got ${JSON.stringify(value)}`);
}

/** Declaring the same key twice has no legal reading under any concept. Always reject it. */
export function assertUniqueKeys(keys: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) schemaFail(`${label} declared "${key}" more than once`);
    seen.add(key);
  }
}
