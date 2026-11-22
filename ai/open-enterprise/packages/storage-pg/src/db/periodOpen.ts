import { and, eq, gt, lt, sql } from "drizzle-orm";
import { listPeriodBooks } from "@open-erp/metamodel";
import type { Db } from "./client.js";
import { period } from "./framework.js";

export function zonedDayStart(ymd: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`Period boundary "${ymd}" is not YYYY-MM-DD — a period boundary is a calendar day, interpreted as an instant in ${timeZone}.`);
  }
  const guess = new Date(`${ymd}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const at = (type: string): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`Intl did not provide ${type} — is timezone "${timeZone}" unsupported?`);
    return Number(found.value);
  };
  // formatToParts hour can be 24 (midnight) when hour12 is false. Normalize it to 0.
  const hour = at("hour") % 24;
  const asUtc = Date.UTC(at("year"), at("month") - 1, at("day"), hour, at("minute"), at("second"));
  // asUtc - guess = how far ahead of UTC that instant is in the target timezone. Subtract it so local time lands at 00:00.
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export interface OpenPeriodInput {
  readonly tenantId: string;
  readonly orgId: string;
  readonly code: string;
  readonly startYmd: string;
  readonly endYmd: string;
  readonly timeZone: string;
}

export interface OpenPeriodResult {
  readonly book: string;
  readonly action: "created" | "exists";
  readonly id: string;
  readonly seq: number;
}

/**
 * Open one period on each of a tenant's two sub-ledgers.
 *
 * Idempotent: if the same `(tenant, sub-ledger, code)` already exists, skip it and report `exists` honestly. Do not change it.
 * Changing the interval of a period that already has ledger rows hanging on it would leave a batch of posted rows outside any period, with no error.
 *
 * `seq` is the sub-ledger's current max + 1, and is not supplied by the caller: period order is unique inside a sub-ledger, and letting a person fill it in would collide.
 */
export async function openPeriods(
  db: Db["db"],
  input: OpenPeriodInput,
): Promise<readonly OpenPeriodResult[]> {
  const startAt = zonedDayStart(input.startYmd, input.timeZone);
  const endAt = zonedDayStart(input.endYmd, input.timeZone);
  if (endAt <= startAt) {
    throw new Error(`Period interval does not hold: ${input.startYmd} → ${input.endYmd} (half-open; the end must be later than the start).`);
  }

  const out: OpenPeriodResult[] = [];
  for (const book of listPeriodBooks()) {
    const existing = await db
      .select({ id: period.id, seq: period.seq })
      .from(period)
      .where(
        and(
          eq(period.tenantId, input.tenantId),
          eq(period.book, book),
          eq(period.code, input.code),
        ),
      );
    const found = existing[0];
    if (found) {
      out.push({ book, action: "exists", id: found.id, seq: found.seq });
      continue;
    }

    // Interval overlap must be stopped here.
    //
    // The block above only checks "does the same code already exist". The real shape of opening a period twice is a different code
    // whose interval sits on top of the old one (a convenient `2020-2030` first, then `2026` at the start of the year).
    // The command then inserts silently, and the ledger can still be posted —
    // until someone posts and `periodOf` finds two hits and throws:
    //
    //   periodOf: inventory has 2 overlapping periods at 2026-08-06T… (2020-2030, 2026)
    //
    // That sentence appears on every receipt, issue, and posting, and reads as if the kernel were broken, while the real mistake happened
    // months earlier in one `period:open`. Measured: it blocked the entire inventory and production chain.
    //
    // A period is an operations decision, infrequent, and a mistake contaminates every ledger — this kind of operation should be refused at the moment it is attempted,
    // not reported per posting at runtime. Overlap for a half-open interval [start, end): each segment's start is earlier than the other's end.
    const clash = await db
      .select({ code: period.code, startAt: period.startAt, endAt: period.endAt })
      .from(period)
      .where(
        and(
          eq(period.tenantId, input.tenantId),
          eq(period.book, book),
          lt(period.startAt, endAt),
          gt(period.endAt, startAt),
        ),
      );
    if (clash.length > 0) {
      const list = clash
        .map((c) => `${c.code} (${c.startAt.toISOString().slice(0, 10)} → ${c.endAt.toISOString().slice(0, 10)})`)
        .join(", ");
      throw new Error(
        `Period "${input.code}" overlaps an already-open period on book ${book}: ${list}. ` +
          `One moment can belong to only one period, or every posting fails. ` +
          `Close or delete the overlapping segment first, then open this one.`,
      );
    }

    const maxSeq = await db
      .select({ v: sql<number | null>`max(${period.seq})` })
      .from(period)
      .where(and(eq(period.tenantId, input.tenantId), eq(period.book, book)));
    const seq = (maxSeq[0]?.v ?? 0) + 1;
    const id = `period-${input.tenantId}-${book}-${input.code}`;

    await db.insert(period).values({
      id,
      tenantId: input.tenantId,
      orgId: input.orgId,
      book,
      code: input.code,
      seq,
      startAt,
      endAt,
      status: "open",
    });
    out.push({ book, action: "created", id, seq });
  }
  return out;
}

