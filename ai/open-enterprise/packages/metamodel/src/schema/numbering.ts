// ---------------------------------------------------------------------------
// Numbering — a module declares a prefix and the range inside which the
// sequence stays continuous. The format is derived from that range.
//
// Two format families, owned by the platform. Modules cannot customize them:
//   seqScope: "day"     {prefix}-{yyyyMMdd}-{seq:04}   e.g. DOC-20260803-0001
//   seqScope: "tenant"  {prefix}-{seq:04}              e.g. MST-0001
//
// 🔴 The date segment is not a second configurable item. It is the necessary
// result of "the sequence restarts each business day": every business day has
// its own 0001, and a code without the date would collide. The other way
// around, a sequence that is continuous across the whole tenant is already
// unique, and a date segment is noise — worse, it welds the entry date into
// an immutable identifier. A master record's category, name, and spec can
// change; the entry date never can.
//
// So a module declares only the seqScope axis. format / sequence width /
// separator are not open: once they are configurable, agent parsing, import
// cleanup, and list sorting fork immediately.
//
// seqScope must be declared explicitly and not derived from module shape:
// the repo has no "master data / document" discriminator, and the substitute
// signals one might reach for (whether there are posting effects, whether the
// state machine has two states) bind two unrelated facts together — there is
// no causal link between "posting" and "which range the sequence is continuous
// in". Same discipline as lifecycle: once something that should be declared
// is derived instead, the validator starts validating its own output.
//
// Atomicity and tenant isolation of numbering live in the server (oe_code_seq).
// This file holds only pure functions and types.
// ---------------------------------------------------------------------------

import { requireObject, requireText, schemaFail } from "./common.js";

/**
 * The range inside which the sequence stays continuous
 * (= what the "sequence segment" dimension of the `oe_code_seq` primary key
 * `(tenant, prefix, sequence segment)` is).
 *
 * Both ranges are inside a tenant — the tenant is the isolation axis, not an
 * option. The difference is whether to slice finer:
 *
 * - `"day"`: also slice by business day. Documents use this — a document is a
 *   dated event, the date segment in the code is useful to a person (you can
 *   see which day it is), and it naturally segments by day. Each day restarts at 1.
 * - `"tenant"`: do not slice finer. One monotonic sequence for the whole tenant.
 *   Master data uses this — "which record was entered Nth" is not an attribute
 *   of the product and should not appear in its code.
 */
export type SeqScope = "day" | "tenant";

export const SEQ_SCOPES: readonly SeqScope[] = Object.freeze(["day", "tenant"]);

export interface Numbering {
  /**
   * Code prefix. Documents use a short document prefix; master data uses a short archive prefix.
   * 1–12 characters of uppercase letters, digits, or Han. Must not start with a digit.
   * Must not contain `-`.
   *
   * 🔴 The prefix is a one-time author choice, not derived from `label`, even
   * though in this repo the two happen to match character for character today.
   * Do not derive `prefix = label`. The reason is in the "code" section: a code
   * is what references point at, and changing it breaks every reference (issued
   * numbers are printed, copied into other systems, and written into chat);
   * `label` is a display name and follows a rename. Binding them means a title
   * edit changes the shape of an immutable identifier — either later documents
   * switch prefix (two code families in one module) or the label can never change.
   * Declare them independently.
   */
  readonly prefix: string;
  /** Range the sequence is continuous in. Required, no default — see the file header. */
  readonly seqScope: SeqScope;
}

/**
 * Prefix shape: short, stable, safe to splice into a code, and splittable back apart.
 *
 * 🔴 The only hard invariant: the prefix must not contain `-`. `-` is the segment
 * separator in `formatCode`. If the prefix contains it, `{prefix}-{period}-{seq}`
 * can never be split back into three segments — a prefix that itself contains a
 * hyphen yields four segments, and "four segments" is elsewhere the signal that
 * someone bypassed formatCode. A legal declaration would turn that check into a
 * false positive, and neither side would report an error.
 *
 * This is not blocked by `!prefix.includes("-")`. It is blocked by an allow-list.
 * Blacklisting only `-` (`/^[^-]{1,12}$/`) would also allow a fullwidth slash,
 * an ideographic period, spaces, zero-width characters, emoji, and the worst case:
 * the fullwidth hyphen U+FF0D (what a Chinese IME emits by default). It is almost
 * indistinguishable from `-` by eye and in code review, but it is a different
 * character — the split fails, while a person believes it succeeded.
 * So write it the other way: allow only three explicitly accepted classes.
 * `-` and everything else are rejected by construction.
 *
 * Why each class:
 * - `A-Z`: every existing prefix is in this class. This change widens the set;
 *   it does not replace it. None of the existing prefixes may stop working.
 * - `0-9`: allowed only after the first character. A prefix that starts with a
 *   digit has the same shape as the sequence segment / business day.
 *   Nobody can tell which segment is the prefix in `20260803-20260803-0001`.
 * - `\u4e00-\u9fff` (CJK Unified Ideographs, basic block — everyday simplified
 *   and traditional Han): where a full Han prefix lands.
 *   Extension blocks are deliberately excluded (Ext A `\u3400-\u4dbf`, and Ext B
 *   and above sit outside the BMP and need surrogate pairs): those are rare and
 *   variant characters. Fonts lack glyphs, IMEs cannot type them, and export to
 *   older GBK systems turns them into question marks — and a code is something
 *   a person reads aloud, copies into Excel, and posts in a chat. Widening later
 *   is one line plus one test. Staying inside the BMP also guarantees that
 *   `{0,11}` counts characters, not "some characters count as two".
 * - Fullwidth punctuation, CJK punctuation (ideographic comma U+3001, ideographic
 *   period U+3002, corner brackets U+300C/U+300D), whitespace, and underscore are
 *   not on the allow-list: the first group is visually confused with the separator,
 *   and the second makes the same code look different in a URL, a search index,
 *   and a CSV.
 *
 * Length 1–12: across 43 modules the longest observed Han label was 7 characters,
 * median 4. 12 leaves 5 characters of headroom on the longest (about 1.7x), enough
 * for a customer branch to add a longer module name. A 12-character prefix plus
 * `-YYYYMMDD-NNNN` is 26 characters, still one readable line in a list column and
 * an export. The cap is not aesthetic. It catches "someone pasted a sentence into prefix".
 */
const PREFIX = /^[A-Z\u4e00-\u9fff][A-Z0-9\u4e00-\u9fff]{0,11}$/u;

export function normalizeNumbering(raw: unknown, at: string): Numbering {
  const obj = requireObject(raw, at);
  // 🔴 Do not call `.toUpperCase()` (it used to). It is a no-op on Han, but
  // keeping it has three real harms:
  // ① It silently rewrites the declaration — the author writes `sp`, every stored
  //    code is `SP`, so one fact has two sources of truth. `yarn catalog` and
  //    grep `"sp"` match no real code, while "the code is the only source of truth
  //    for the schema" requires the string written in the file to be the string that is issued;
  // ② It already disagreed with `formatCode`: `formatCode("xs", …)` throws (a test pins this),
  //    while `normalizeNumbering({ prefix: "xs" })` used to silently become `XS` —
  //    the same value, two conclusions;
  // ③ Widening the character set makes the hole larger: normalize used to run
  //    before the allow-list, so it would manufacture a legal prefix —
  //    `ß`→`SS`, `ﬁ`→`FI`, `ſ`→`S`, `ı`→`I`. Those characters are all outside
  //    the allow-list, yet they were rewritten into values that pass. The string
  //    the author wrote and the string the system issued were not the same, with zero errors.
  // All 43 existing prefixes are already uppercase, so removing it changes none of them.
  const prefix = requireText(obj["prefix"], `${at}.prefix`);
  if (!PREFIX.test(prefix)) {
    schemaFail(
      `${at}.prefix must be 1–12 characters of uppercase letters, digits, or Han, must not start with a digit, ` +
        `and must not contain "-" ("-" separates code segments; once included, the code cannot be split back apart) — got "${prefix}"`,
    );
  }
  // 🔴 No default. Defaulting to "day" would silently give master data a dated
  // code — that is not a "you forgot to configure it" error. It is a permanent
  // wrong segment in a batch of codes, with zero errors.
  const scopeText = requireText(obj["seqScope"], `${at}.seqScope`);
  if (!SEQ_SCOPES.includes(scopeText as SeqScope)) {
    schemaFail(`${at}.seqScope must be ${SEQ_SCOPES.map((v) => `"${v}"`).join(" | ")} (got "${scopeText}")`);
  }
  const seqScope = scopeText as SeqScope;
  const keys = Object.keys(obj).filter((k) => k !== "prefix" && k !== "seqScope");
  if (keys.length) {
    schemaFail(
      `${at} accepts only prefix and seqScope — format / sequence width are not configurable (the format is derived from seqScope and owned by the platform). Extra keys: ${keys.join(", ")}`,
    );
  }
  return { prefix, seqScope };
}

/**
 * Calendar day yyyymmdd. Numbering slices the sequence by business day, not by
 * the UTC day boundary and not by the process day boundary.
 *
 * 🔴 `timeZone` is required and has no default. A default (`?? process TZ`)
 * immediately creates a second "today": query-side `today` / `this_month` use
 * `OE_TIMEZONE` (server `env.timezone()`, no default, checked at startup). If
 * numbering fell back to the process TZ, a container that runs UTC by convention
 * would write Shanghai 00:00–08:00 document numbers as the previous day, forever
 * disagreeing with the day the list computes, and the sequence number would
 * follow that drift, with zero errors. There is one source of truth for the
 * business day: the time zone the deployment declares.
 *
 * `Intl.DateTimeFormat` is pure computation and does not violate the kernel's zero-IO rule.
 */
export function calendarYmd(now: Date, timeZone: string): string {
  const tz = requireText(timeZone, "calendarYmd.timeZone");
  // en-CA's short date is exactly YYYY-MM-DD; drop the separators to get 8 digits
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const ymd = parts.replaceAll("-", "");
  if (!/^\d{8}$/.test(ymd)) {
    schemaFail(`calendarYmd: the calendar day in time zone "${tz}" is not 8 digits (got "${parts}")`);
  }
  return ymd;
}

/** Sequence-segment shape: an 8-digit business day, or an empty string (tenant-wide, not sliced). */
const PERIOD = /^(\d{8})?$/;

/**
 * Which segment this module's sequence belongs to. Empty string = tenant-wide, not sliced further.
 *
 * 🔴 The only place in the repo that reads `seqScope`. Callers pass the whole
 * numbering object and do not branch themselves — whoever branches can handle
 * only one branch, and the missed half shows up at runtime as a silently wrong code format.
 *
 * `now` / `timeZone` are unused when `seqScope` is `"tenant"`, but the signature
 * still requires them: the call site then does not need to know which range the
 * current module uses, and the shape stays uniform. The time zone is required
 * configuration checked at server startup anyway; there is no such thing as
 * "a master-data module may omit the time zone".
 */
export function codePeriod(numbering: Numbering, now: Date, timeZone: string): string {
  switch (numbering.seqScope) {
    case "day":
      return calendarYmd(now, timeZone);
    case "tenant":
      return "";
  }
}

/**
 * Build the code. seq starts at 1.
 *
 * 🔴 The only format source of truth in the repo. Server numbering and seed
 * fixtures must go through here. Do not write another `${prefix}-${period}-…`.
 *
 * The segment count is decided by whether period is empty — that is what
 * "the format is derived from seqScope" looks like on the ground: there is no
 * second switch. Empty or not, period already says everything.
 */
export function formatCode(prefix: string, period: string, seq: number): string {
  if (!PREFIX.test(prefix)) {
    schemaFail(`formatCode: illegal prefix "${prefix}"`);
  }
  if (!PERIOD.test(period)) {
    schemaFail(`formatCode: period must be 8 digits or an empty string (got "${period}")`);
  }
  if (!Number.isInteger(seq) || seq <= 0) {
    schemaFail(`formatCode: seq must be a positive integer (got ${String(seq)})`);
  }
  const tail = String(seq).padStart(4, "0");
  return period ? `${prefix}-${period}-${tail}` : `${prefix}-${tail}`;
}
