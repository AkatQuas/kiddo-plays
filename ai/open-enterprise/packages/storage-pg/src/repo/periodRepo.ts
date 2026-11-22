// ---------------------------------------------------------------------------
// Period repository — where a belonging period's data comes from
//
// This stage only has "read every period of one sub-ledger" and "open one period". Closing a period is not here:
// closing is an edge with preconditions (the previous period is closed, debits equal credits, no negative stock, in-transit list),
// and those are not built yet. Do not offer a close() that only flips a status bit — it would make "close period" look like it already exists.
//
// The criterion for the belonging period is in metamodel/period.ts (a pure function, unit-testable offline). This file only moves data.
// Same rule as the kernel's zero IO.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { normalizePeriod, type Period, type PeriodBook } from "@open-erp/metamodel";
import { period as periodTable } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import { requireIdentity, type Identity, type NewPeriod, type PeriodRepo } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export class PeriodError extends Error {
  override readonly name = "PeriodError";
}

function rowOf(raw: Record<string, unknown>): Period {
  // Go through the kernel's normalizePeriod: a row read from the database and the input used to open a period share one criterion.
  // A second copy would let a row whose start_at/end_at was edited by hand skip checks such as a non-empty interval.
  return normalizePeriod({
    book: raw["book"],
    code: raw["code"],
    seq: Number(raw["seq"]),
    startAt: raw["startAt"],
    endAt: raw["endAt"],
    status: raw["status"],
  });
}

export function createPeriodRepo(exec: Executor): PeriodRepo {
  return {
    async list(identity: Identity, book: PeriodBook): Promise<readonly Period[]> {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(periodTable)
        .where(scopedWhere(periodTable, who, eq(periodTable.book, book)))
        .orderBy(asc(periodTable.seq));
      return (rows as Record<string, unknown>[]).map(rowOf);
    },

    async open(identity: Identity, input: NewPeriod): Promise<Period> {
      const who = requireIdentity(identity);
      // Pass the kernel gate before writing: a half-open non-empty interval, seq ≥ 1, and a closed enum for book/status.
      const normalized = normalizePeriod({ ...input, status: "open" }, "openPeriod");
      await guardWrite(
        `open period ${normalized.book}/${normalized.code}`,
        async () =>
          await exec.insert(periodTable).values(
            scopedValues(who, {
              id: randomUUID(),
              book: normalized.book,
              code: normalized.code,
              seq: normalized.seq,
              startAt: normalized.startAt,
              endAt: normalized.endAt,
              status: normalized.status,
            }),
          ),
      );
      return normalized;
    },
  };
}
