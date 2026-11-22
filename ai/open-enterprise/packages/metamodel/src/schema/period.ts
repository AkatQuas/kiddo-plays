/**
 * Period axis — which accounting period a ledger row belongs to.
 *
 * 🔴 Not a seventh concept: a module cannot declare it and cannot route around it.
 * The period constraint applies to every module that posts, at the same layer as
 * tenant isolation. Writing `period` into a schema is rejected by `FORBIDDEN_MODULE_KEYS`.
 *
 * ── This stage records only "which period", not "close the books" ─────────
 * This file and the `oe_period` table deliver one thing: from today on, every
 * ledger row carries a correct posting period. Close, period-end checks, snapshots,
 * the GL balance gate, and period reports are all not built yet. See "known pitfalls" in AGENTS.md.
 *
 * Why this one must be done now and the rest can wait: `postingPeriod` is a decision,
 * not a calculation. Every ledger row, at the moment it is written, has an answer
 * to "which period does this entry belong to". Nobody asked, so it was not stored.
 * The day someone asks, existing rows can only be guessed from `occurredAt` — right
 * for most rows, wrong for backfills and cross-period reversals, and those are
 * exactly the rows that need the column. Zero errors; every cross-period report is
 * just a little off. Same shape as `seqScope` being required with no default: what
 * you miss is not an error, it is a permanently wrong meaning that can never be repaired.
 *
 * ── Three time axes. None of them can be dropped ───────────────────────────
 *   occurredAt     when the fact happened
 *   postingPeriod  which period this entry belongs to (a decision; it may legally differ from the above)
 *   createdAt      when the system learned about it
 *
 * An April 15 adjustment that belongs to March, or an April backfill of a March 30
 * document — these are not data errors. They are normal business. Forcing
 * `period = f(occurredAt)` means the only way to book into March is to lie that
 * `occurredAt` was in March: falsifying the fact to satisfy the posting rule is
 * worse than having one more column.
 */

import { requireEnum, requireText, schemaFail } from "./common.js";
import { type EffectTarget } from "./effects.js";
import { ledgerDefinitionOf } from "../normalize/ledger.js";
// EffectTarget is only the argument type of periodBookOf; the ledger-to-book map lives in the catalog, not in this file.

// ── Books ─────────────────────────────────────────────────────────────────

/**
 * Period books. In a real company the inventory and finance period boundaries
 * do not line up: inventory closes after the count, finance closes after the
 * books are reconciled. One axis for both cannot express "the count period is
 * still open" and "finance is already closed" at the same time.
 */
export const PERIOD_BOOKS = ["finance", "inventory"] as const;
export type PeriodBook = (typeof PERIOD_BOOKS)[number];

/** User-facing book name. Prompts must not leak the finance/inventory enum tokens raw; these labels are the English words for those books. */
export const PERIOD_BOOK_LABELS: Record<PeriodBook, string> = {
  finance: "Finance",
  inventory: "Inventory",
};

/** Which book this target belongs to. The gate reads the loaded catalog; do not look it up inline. */
export function periodBookOf(target: EffectTarget): PeriodBook {
  return ledgerDefinitionOf(target).book as PeriodBook;
}

// ── Period ────────────────────────────────────────────────────────────────

export const PERIOD_STATUSES = ["open", "closed"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

/**
 * One period.
 *
 * `code` is free text, not a date format: a fiscal year need not start in January
 * (April in Japan, October for some foreign companies), retail uses a 4-4-5 week
 * calendar (a "month" of 28 or 35 days), and some companies have 13 periods (the
 * 13th holds year-end adjustments). Giving `code` a format would be a second source
 * of truth — shape is expressed by `startAt` / `endAt`. The framework does not know what a "month" is.
 *
 * `seq` is the period order. "Prior ending balance = this opening balance" is a chain,
 * and closing in order is its premise. Sorting by `code` does not hold for shapes like
 * `'2026-W05'`. This stage has no close yet, but the column has to be right now —
 * like `postingPeriod`, it cannot be backfilled later.
 */
export interface Period {
  readonly book: PeriodBook;
  readonly code: string;
  readonly seq: number;
  /** Half-open interval [startAt, endAt). Store an instant, not a date. See periodOf below. */
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: PeriodStatus;
}

function requireDate(value: unknown, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    schemaFail(`${label} must be a valid Date`);
  }
  return value as Date;
}

/** Normalize one period. Rows read from the database go through here too — one check for both sources. */
export function normalizePeriod(raw: unknown, label = "period"): Period {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) schemaFail(`${label} must be an object`);
  const obj = raw as Record<string, unknown>;
  const book = requireEnum(obj["book"], PERIOD_BOOKS, `${label}.book`);
  const code = requireText(obj["code"], `${label}.code`);
  const at = `${label}(${book}/${code})`;

  const seq = obj["seq"];
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 1) {
    schemaFail(`${at}.seq must be an integer ≥ 1 — ordered close depends on it; without it "previous period" is undefined`);
  }

  const startAt = requireDate(obj["startAt"], `${at}.startAt`);
  const endAt = requireDate(obj["endAt"], `${at}.endAt`);
  // 🔴 Half-open and must be non-empty. A period with startAt === endAt contains no instant,
  // so every entry "does not belong to it", while it looks like a normal open period.
  if (startAt.getTime() >= endAt.getTime()) {
    schemaFail(`${at}: startAt must be earlier than endAt (the interval is half-open [startAt, endAt))`);
  }

  return {
    book,
    code,
    seq,
    startAt,
    endAt,
    status: requireEnum(obj["status"], PERIOD_STATUSES, `${at}.status`),
  };
}

// ── Assignment ────────────────────────────────────────────────────────────

/**
 * Which period this instant falls in.
 *
 * 🔴 The comparison is of instants, not dates, so this function needs no time-zone
 * argument. Period boundaries are computed in the deployment time zone (`OE_TIMEZONE`)
 * into timestamptz when the period is created: "March 1 00:00 Shanghai" is a definite
 * instant, and every later comparison happens on the timeline.
 *
 * That is also why `calendarYmd(now, timeZone)` must not grow a second consumer on
 * this axis — it serves numbering (a sequence segment is a calendar-day concept),
 * while a period serves the books (an interval is an instant concept). Mixing them
 * would silently count "April 1 07:00 Shanghai" as March under a container TZ (usually UTC).
 *
 * The interval is half-open [startAt, endAt): a closed interval would put the last
 * instant of a period into two periods, and both queries would "have counted it".
 */
export function periodOf(periods: readonly Period[], book: PeriodBook, at: Date): Period | null {
  const t = requireDate(at, "periodOf.at").getTime();
  const hits = periods.filter((p) => p.book === book && p.startAt.getTime() <= t && t < p.endAt.getTime());
  // 🔴 Overlap throws. Do not take the first. Taking the first makes the posting
  // period depend on array order — the same entry can land in different periods
  // across two queries, and neither side reports an error.
  if (hits.length > 1) {
    schemaFail(
      `periodOf: ${book} has ${String(hits.length)} overlapping periods at ${at.toISOString()}` +
        ` (${hits.map((p) => p.code).join(", ")}) — the posting period must not depend on array order`,
    );
  }
  return hits[0] ?? null;
}

/** Periods currently open on a book, ascending by seq. An empty array is a legal query result, not a legal premise for posting. */
export function openPeriods(periods: readonly Period[], book: PeriodBook): readonly Period[] {
  return periods
    .filter((p) => p.book === book && p.status === "open")
    .slice()
    .sort((a, b) => a.seq - b.seq);
}

/** Result of resolving the posting period. When `shiftedFrom` is set, the user must be able to see it. */
export interface PostingPeriodResolution {
  readonly period: Period;
  /** The period the fact fell in (already closed, so the entry was not booked there). null = no shift. */
  readonly shiftedFrom: Period | null;
}

export class PeriodClosedError extends Error {
  override readonly name = "PeriodClosedError";
}

/**
 * Which period this entry is booked into. The only place in the repo that makes
 * this decision — same discipline as `codePeriod`: whoever branches can handle
 * only one branch, and the missed half shows up at runtime as a silently wrong posting period.
 *
 * Two steps:
 *   ① The period `occurredAt` falls in is open → that is the one. Almost every case takes this path.
 *   ② That period is closed (or `occurredAt` is in no period) → book into the earliest
 *      period that is currently open, and set `shiftedFrom`. This is "correct a prior-period
 *      error in the current period", which is right in accounting.
 *
 * 🔴 ② must not be a hard block. Blocking sends the user to edit the document date
 * to satisfy the posting rule — the fact is falsified, which is the entire reason
 * the two time axes exist.
 *
 * 🔴 ② must not be silent either. The caller that receives `shiftedFrom` must make
 * it visible (at this stage periods are always open, so this path is unreachable;
 * when close lands, it connects to a warning tier plus confirmedWarning).
 *
 * 🔴 No open period → throw. Do not auto-create a period and do not `?? current month`:
 * a guessed posting period is written into an append-only ledger, and the ledger does not get a second chance.
 */
export function resolvePostingPeriod(
  periods: readonly Period[],
  book: PeriodBook,
  occurredAt: Date,
): PostingPeriodResolution {
  const natural = periodOf(periods, book, occurredAt);
  if (natural && natural.status === "open") return { period: natural, shiftedFrom: null };

  const fallback = openPeriods(periods, book)[0];
  if (!fallback) {
    // User-facing: the book uses its label (not the raw finance/inventory token), and the time is day granularity (not an ISO timestamp).
    const bookLabel = PERIOD_BOOK_LABELS[book];
    const occurredDay = occurredAt.toISOString().slice(0, 10);
    const why = natural
        ? `the business event falls in closed accounting period "${natural.code}", and ${bookLabel} has no open period`
        : `business date ${occurredDay} is not inside any ${bookLabel} accounting period, and there is no open period`;
    throw new PeriodClosedError(
      `Cannot decide which accounting period this entry belongs to: ${why}. Open the matching accounting period, then try again.`,
    );
  }
  return { period: fallback, shiftedFrom: natural };
}
