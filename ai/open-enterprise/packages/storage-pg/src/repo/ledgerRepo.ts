// ---------------------------------------------------------------------------
// Ledger repository — the only source of truth for a balance
//
// 🔴 Append only. This file has no update and no delete, and that is not an omission:
// a reversal is **another row in the opposite direction** with reversalOf pointing back. Allowing a row to be changed would allow history to be rewritten,
// and when the books do not match there would be no way to tell whether the business was wrong or someone edited a row.
//
// Balance = the sum of this table. There is no balance table and no balance column, so the return value here is the books themselves.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  effectOpSign,
  ledgerContract,
  ledgerLabel,
  LEDGER_DIMENSIONS,
  type EffectOp,
  type EffectTarget,
  type LedgerDimension,
  type PlannerLedgerReadCoordinate,
} from "@open-erp/metamodel";
import { effectLedger } from "../db/framework.js";
import { ledgerNetSum } from "../query/ledgerNet.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import { BalanceArgumentError, LedgerConstraintError, requireIdentity, type Identity } from "@open-erp/runtime-core";
import { LEDGER_SCOPE_SPAN_KEY } from "@open-erp/runtime-core";
import type {
  LedgerGroupRow,
  LedgerPage,
  LedgerQuery,
  LedgerRepo,
  LedgerRow,
  NewLedgerRow,
} from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

/**
 * A posting invariant was broken — a **real fault**. The HTTP layer answers 500 and logs it (see the classification list in `http/app.ts`).
 * Examples: a stored amount is not a number, a ledger row has no posting period. The caller cannot fix these.
 */
export class LedgerError extends Error {
  override readonly name = "LedgerError";
}

/** A posting invariant broke → 500. */
function fail(message: string): never {
  throw new LedgerError(message);
}

/** The caller wrote the coordinate wrong → 400, and the error must say what to do next. */
function badArgument(message: string): never {
  throw new BalanceArgumentError(message);
}


function toNumber(raw: unknown, what: string): number {
  const value = Number(raw);
  // A ledger amount has no reading of "missing means 0": recording 0 is worse than not recording,
  // because it makes the balance look like it was "already computed".
  if (raw === null || raw === undefined || raw === "" || !Number.isFinite(value)) {
    fail(`${what}: amount "${String(raw)}" is not a number`);
  }
  return value;
}

/**
 * The posting period must be a non-empty string.
 *
 * A ledger row has no reading of "a missing period means no period": a row that belongs to no period is
 * silently missed by every period query, while the balance sum still includes it — the two measures do not match, and neither errors.
 */
function requirePeriod(raw: unknown, what: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    fail(`ledger row ${what}: posting period "${String(raw)}" is not a non-empty string`);
  }
  return raw.trim();
}

/**
 * The occurrence instant must be a real instant.
 *
 * The column is NOT NULL, so failing to read it means **the read shape is wrong** (a different projection, a column left out of the select),
 * not that the data is missing — degrading to `null` would show a blank column on a page of movements already sorted by time,
 * while the sort would still be right: the only symptom is "where did the time column go", with no way to say which step dropped it.
 */
function requireInstant(raw: unknown, what: string): string {
  const at = raw instanceof Date ? raw : typeof raw === "string" || typeof raw === "number" ? new Date(raw) : null;
  if (at === null || Number.isNaN(at.getTime())) {
    fail(`ledger row ${what}: occurred-at "${String(raw)}" is not a recognizable instant`);
  }
  return at.toISOString();
}

function rowOf(raw: Record<string, unknown>): LedgerRow {
  return {
    id: String(raw["id"]),
    target: raw["target"] as EffectTarget,
    op: raw["op"] as EffectOp,
    amount: toNumber(raw["amount"], `ledger row ${String(raw["id"])}`),
    subjectType: String(raw["subjectType"]),
    subjectId: String(raw["subjectId"]),
    scopeType: (raw["scopeType"] as string | null) ?? null,
    scopeId: (raw["scopeId"] as string | null) ?? null,
    sourceModule: String(raw["sourceModule"]),
    sourceId: String(raw["sourceId"]),
    sourceLineId: (raw["sourceLineId"] as string | null) ?? null,
    transitionCode: String(raw["transitionCode"]),
    reversalOf: (raw["reversalOf"] as string | null) ?? null,
    // A NOT NULL column, with no reading of "missing means an empty string": a ledger row that belongs to no period
    // makes every period query silently undercount it.
    postingPeriod: requirePeriod(raw["postingPeriod"], String(raw["id"])),
    occurredAt: requireInstant(raw["occurredAt"], String(raw["id"])),
  };
}

/**
 * Balance coordinate → the advisory-lock key.
 *
 * 🔴 **Exported only so this invariant has a direct regression line** (see test/ledgerLock.test.ts): it runs on
 * the write-path lock, and a lock failure looks like the whole posting 500s — but only on a **real database**. Stub tests stay green.
 *
 * 🔴 The separator cannot be NUL. It used to be `a<NUL>b<NUL>c`: the reason for choosing it was right (NUL cannot appear in
 * any id, so the concatenation is reversible), but **a PostgreSQL text parameter does not allow 0x00** —
 * `invalid byte sequence for encoding "UTF8": 0x00` (22021). The consequence is
 * the `forUpdate: true` path **throws every time**, so every "approve" and "confirm issue" 500s,
 * while `forUpdate: false` (the read API, available quantity on the screen) is completely normal — so it looks like
 * "posting is broken", not "the lock is broken".
 *
 * Use `JSON.stringify` rather than another visible separator: id values are not controlled by this layer (the tenant comes from the request header,
 * subject / scope are business record ids), any visible character can appear in a segment, and the composed key is no longer reversible —
 * two different coordinates share one lock, and the symptom is serialization with no apparent cause. JSON escaping guarantees an injection,
 * and `null` (no scope) and `""` are not folded into the same key.
 */
export function balanceLockKey(
  tenantId: string,
  target: EffectTarget,
  subjectId: string,
  scopeId: string | null,
): string {
  return JSON.stringify([tenantId, target, subjectId, scopeId]);
}

/** Balance coordinates in one transaction must take locks in this code-point total order; exported for the concurrency contract test. */
export function orderedBalanceLockKeys(
  tenantId: string,
  coordinates: readonly PlannerLedgerReadCoordinate[],
): readonly string[] {
  return [...new Set(coordinates.map((coordinate) =>
    balanceLockKey(tenantId, coordinate.target, coordinate.subjectId, coordinate.scopeId)))].sort();
}

/** Dimension name → ledger column. `LEDGER_DIMENSIONS` is a closed enum, and this table must match it item for item. */
const DIMENSION_COLUMNS: Readonly<Record<LedgerDimension, AnyPgColumn>> = Object.freeze({
  subjectId: effectLedger.subjectId,
  scopeId: effectLedger.scopeId,
  op: effectLedger.op,
  sourceModule: effectLedger.sourceModule,
  transitionCode: effectLedger.transitionCode,
  postingPeriod: effectLedger.postingPeriod,
});

/**
 * Translate filter conditions into a where.
 *
 * `occurredFrom/To` is a closed interval: when the caller says "the last 90 days", whether the endpoints are included should not be a guess.
 */
function filterConditions(query: LedgerQuery | Omit<LedgerQuery, "groupBy" | "measures">): SQL[] {
  const w = query.where;
  const parts: SQL[] = [eq(effectLedger.target, query.target)];
  if (w.subjectId !== undefined) parts.push(eq(effectLedger.subjectId, w.subjectId));
  if (w.scopeId !== undefined) parts.push(eq(effectLedger.scopeId, w.scopeId));
  if (w.op !== undefined) parts.push(eq(effectLedger.op, w.op));
  if (w.sourceModule !== undefined) parts.push(eq(effectLedger.sourceModule, w.sourceModule));
  if (w.transitionCode !== undefined) parts.push(eq(effectLedger.transitionCode, w.transitionCode));
  if (w.postingPeriod !== undefined) parts.push(eq(effectLedger.postingPeriod, w.postingPeriod));
  if (w.occurredFrom !== undefined) parts.push(gte(effectLedger.occurredAt, new Date(w.occurredFrom)));
  if (w.occurredTo !== undefined) parts.push(lte(effectLedger.occurredAt, new Date(w.occurredTo)));
  return parts;
}

/**
 * 🔴 For a ledger that has a scope (currently only stock), throw immediately when scopeId is neither filtered, nor grouped, **nor explicitly acknowledged**
 * as a cross-scope total.
 *
 * This rule has the same origin as "do not total every warehouse" in `balance()`: an inventory number totaled across every warehouse
 * looks completely normal — it has a value, a unit, and it can be sorted — and it answers "is the Shanghai warehouse enough to ship" wrongly.
 *
 * 🔴 The `acrossScopes` opening is **only on the aggregate surface of the read path**, because another class of question had no answer under the old rule:
 * "which products still have stock" and "which goods have not moved in 90 days" ask for a company-wide measure. Grouping warehouse by warehouse splits one product
 * into N rows, and the caller adding those N rows does the same cross-warehouse total on the client, without the label.
 * The two counterweights are written on `LedgerQuery.acrossScopes`: **it must be passed explicitly** + **every row carries a label**.
 *
 * The return value is whether this is a cross-scope total. The caller uses it to decide whether to label the rows —
 * computing the criterion here and labeling somewhere else would immediately be two judgments of "is this cross-warehouse".
 */
function requireScopeResolved(target: EffectTarget, query: LedgerQuery): boolean {
  const contract = ledgerContract(target);
  if (!contract) badArgument(`ledger: unknown posting target "${target}"`);
  if (contract.scope === null) {
    if (query.where.scopeId !== undefined) {
      badArgument(`ledger: the ${target} ledger is one-dimensional and does not accept scopeId (only stock lands on a warehouse)`);
    }
    if (query.groupBy.includes("scopeId")) {
      badArgument(`ledger: the ${target} ledger is one-dimensional, and grouping by scopeId separates nothing`);
    }
    // "Across scope" has no reading on a one-dimensional ledger: accepting it would make the caller think they narrowed or widened something.
    if (query.acrossScopes === true) {
      badArgument(`ledger: the ${target} ledger is one-dimensional and has no scope to cross — acrossScopes has no reading on this ledger`);
    }
    return false;
  }
  const filtered = query.where.scopeId !== undefined;
  const grouped = query.groupBy.includes("scopeId");
  if (filtered || grouped) {
    // It already lands on a concrete scope or is split by scope. Saying "across" as well is a contradictory declaration.
    if (query.acrossScopes === true) {
      badArgument(
        `ledger: both a ${contract.scope} was specified or grouped and acrossScopes was requested — those are opposite measures, and this does not guess which one counts`,
      );
    }
    return false;
  }
  if (query.acrossScopes !== true) {
    badArgument(
      `ledger: the ${target} ledger lands on ${contract.scope} — ` +
        `either specify one ${contract.scope} with where.scopeId, or put "scopeId" in groupBy to split by ${contract.scope}. ` +
        `If a total across ${contract.scope} is really wanted (a company-wide measure such as "which products still have stock"), pass acrossScopes=true explicitly. ` +
        `Every produced row is labeled "total across ${contract.scope}". ` +
        `It is not the default: that number looks normal and answers "which ${contract.scope} is enough" wrongly`,
    );
  }
  return true;
}

async function lockBalanceCoordinates(
  exec: Executor,
  identity: Identity,
  coordinates: readonly PlannerLedgerReadCoordinate[],
  inTransaction: boolean,
): Promise<void> {
  const who = requireIdentity(identity);
  if (!coordinates.length) return;
  if (!inTransaction) {
    fail("a balance coordinate lock can be called only inside repos.transaction(...): a transaction lock on the pool is released as soon as the single statement ends");
  }
  for (const coordinate of coordinates) {
    const contract = ledgerContract(coordinate.target);
    if (!contract) badArgument(`balance coordinate lock: unknown ledger "${coordinate.target}"`);
    if (!coordinate.subjectId.trim()) badArgument("balance coordinate lock: subjectId must be a non-empty string");
    if (contract.scope !== null && !coordinate.scopeId?.trim()) {
      badArgument(`balance coordinate lock: ${coordinate.target} must supply a ${contract.scope} scopeId`);
    }
    if (contract.scope === null && coordinate.scopeId !== null) {
      badArgument(`balance coordinate lock: ${coordinate.target} is a one-dimensional ledger and does not accept scopeId`);
    }
  }
  // The total order is part of the concurrency contract: two multi-line documents cannot form A→B / B→A even if their line order is reversed.
  for (const key of orderedBalanceLockKeys(who.tenantId, coordinates)) {
    await exec.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }
}

interface NonNegativeProjection {
  readonly target: EffectTarget;
  readonly subjectId: string;
  readonly scopeId: string | null;
  signed: number;
  deducted: boolean;
}

/**
 * A ledger whose contract declares nonNegative: after the lock is held and before insert, stack this batch's signed deltas onto the current balance by coordinate.
 * The framework only executes the contract property and does not branch on ledger code. If it would go short, the whole batch is refused.
 */
async function assertNonNegativeAppend(
  repo: LedgerRepo,
  identity: Identity,
  rows: readonly NewLedgerRow[],
): Promise<void> {
  const byCoordinate = new Map<string, NonNegativeProjection>();
  for (const row of rows) {
    const { target, op, amount, subjectId, scopeId } = row.effect;
    if (!ledgerContract(target).nonNegative) continue;
    const signed = amount * effectOpSign(target, op);
    const key = JSON.stringify([target, subjectId, scopeId]);
    const existing = byCoordinate.get(key);
    if (existing) {
      existing.signed += signed;
      if (signed < 0) existing.deducted = true;
    } else {
      byCoordinate.set(key, { target, subjectId, scopeId, signed, deducted: signed < 0 });
    }
  }

  for (const coord of byCoordinate.values()) {
    if (!coord.deducted) continue;
    const current = await repo.balance(identity, coord.target, coord.subjectId, coord.scopeId);
    const projected = current + coord.signed;
    if (projected < 0) {
      const contract = ledgerContract(coord.target);
      const place =
        contract.scope !== null && coord.scopeId ? ` in ${contract.scope} "${coord.scopeId}"` : "";
      throw new LedgerConstraintError(
        `${ledgerLabel(coord.target)} is short: ${contract.subject} "${coord.subjectId}"${place} has ${current}, and this needs ${-coord.signed}`,
      );
    }
  }
}

export function createLedgerRepo(exec: Executor, inTransaction = false): LedgerRepo {
  const repo: LedgerRepo = {
    async lockBalances(identity, coordinates): Promise<void> {
      await lockBalanceCoordinates(exec, identity, coordinates, inTransaction);
    },
    async balance(
      identity: Identity,
      target: EffectTarget,
      subjectId: string,
      scopeId: string | null,
      forUpdate = false,
    ): Promise<number> {
      const who = requireIdentity(identity);
      const contract = ledgerContract(target);
      if (!contract) badArgument(`balance: unknown posting target "${target}"`);

      // 🔴 stock with no scopeId throws. When "how much is in which warehouse" has no answer, it must not degrade to "total of every warehouse" —
      // that number looks completely normal, and there is no way to notice it is wrong.
      if (contract.scope !== null && !scopeId?.trim()) {
        badArgument(`balance: the ${target} ledger lands on ${contract.scope} and must be given a scopeId — do not total every ${contract.scope}`);
      }
      if (contract.scope === null && scopeId !== null) {
        badArgument(`balance: the ${target} ledger is one-dimensional and does not accept scopeId (only stock lands on a warehouse)`);
      }
      if (!subjectId.trim()) badArgument(`balance: the ${target} ledger must be given a subjectId`);

      // 🔴 On the write path, lock this cell first, then read it.
      //
      // The transaction is READ COMMITTED: two concurrent issues each `select sum(...)` and both read "still enough",
      // each inserts its own ledger row, and both commit — stock goes negative, while each ledger row looks legal on its own
      // and both checks really "passed". This is the hardest kind of fail-open to find: there is no anomaly marker.
      //
      // Use a transaction-level advisory lock rather than `SELECT … FOR UPDATE`: what must be locked is **one coordinate**
      // (target × subject × scope), not a few rows — a newly inserted row is outside the lock range of any existing row,
      // and a row lock cannot stop the second insert. The lock is issued by coordinate, and the grain is exactly "this product in this warehouse".
      // Different products / different customers stay concurrent.
      //
      // Lock only inside a write transaction: the read API (/api/balance, available quantity on a list) passes forUpdate=false,
      // or a pure display would contend with posting for the lock.
      if (forUpdate) {
        await lockBalanceCoordinates(exec, who, [{ target, subjectId, scopeId }], inTransaction);
      }

      const rows = await exec
        .select({
          // coalesce(…, 0) is **arithmetic**, not a fallback: the sum of an empty set is 0.
          // That is a different thing from "fill in a default when the value cannot be read" — that one hides a bug.
          //
          // 🔴 Use `ledgerNetSum(target)` rather than writing the same expression again here: these two used to be
          // word-for-word copies, and they stayed together only because both read the same global POSITIVE_OPS. After signs are graded per ledger,
          // missing this spot means the **single-coordinate balance** (/api/balance, available-quantity display, precondition evaluation)
          // and the grouped balance use two sign systems, and neither side errors.
          net: ledgerNetSum(target),
        })
        .from(effectLedger)
        .where(
          scopedWhere(
            effectLedger,
            who,
            eq(effectLedger.target, target),
            eq(effectLedger.subjectId, subjectId),
            scopeId === null ? isNull(effectLedger.scopeId) : eq(effectLedger.scopeId, scopeId),
          ),
        );

      const net = rows[0]?.net;
      if (net === undefined) fail(`balance: the sum query for ${target} returned no result`);
      return toNumber(net, `balance(${target})`);
    },

    async rowsOf(identity: Identity, module: string, billId: string): Promise<readonly LedgerRow[]> {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(effectLedger)
        .where(
          scopedWhere(effectLedger, who, eq(effectLedger.sourceModule, module), eq(effectLedger.sourceId, billId)),
        )
        // Posting order is the reading order when reconciling; when occurredAt ties, id makes a total order.
        .orderBy(asc(effectLedger.occurredAt), asc(effectLedger.id));
      return (rows as Record<string, unknown>[]).map(rowOf);
    },

    async aggregate(identity: Identity, query: LedgerQuery): Promise<LedgerPage<LedgerGroupRow>> {
      const who = requireIdentity(identity);
      const acrossScopes = requireScopeResolved(query.target, query);
      // 🔴 The word comes from `EFFECT_SUBJECT` (`stock` → `warehouse`), and **no second display name is invented**:
      // that value also appears in the response `scopeType`, in `balance()` errors, and in the effects gate.
      // Translating it to another name here would be a second "what this scope is called", and the two would eventually disagree.
      // The space is so it reads as a token rather than half a word.
      const scopeSpan = acrossScopes
        ? `total across all ${ledgerContract(query.target).scope ?? "scopes"}`
        : null;

      for (const dim of query.groupBy) {
        if (!LEDGER_DIMENSIONS.includes(dim)) badArgument(`ledger.aggregate: unknown group dimension "${dim}"`);
      }
      if (new Set(query.groupBy).size !== query.groupBy.length) {
        badArgument("ledger.aggregate: groupBy has a duplicate dimension");
      }
      // "Group only, do not measure" lists the distinct dimension values, and that is the job of mode=rows.
      // Allowing it would put rows with no measure in the result, and the caller could only query again.
      if (!query.measures.length) badArgument("ledger.aggregate: at least one measure is required");
      const keys = query.measures.map((m) => m.key);
      if (new Set(keys).size !== keys.length) badArgument("ledger.aggregate: a measure key is duplicated");
      // A measure key with the same name as a dimension gives one key two meanings in the result, and the later write silently covers the earlier one.
      for (const key of keys) {
        if ((query.groupBy as readonly string[]).includes(key)) {
          badArgument(`ledger.aggregate: measure key "${key}" has the same name as a group dimension, and they would overwrite each other in the result`);
        }
        // Reserved key: every row of a cross-scope total must carry it. The same name would let a measure silently cover the label,
        // and after that the row could no longer say it is a cross-scope number — the one thing this opening must not lose.
        if (key === LEDGER_SCOPE_SPAN_KEY) {
          badArgument(
            `ledger.aggregate: a measure key cannot be named "${LEDGER_SCOPE_SPAN_KEY}" — ` +
              `that is the in-row label of a cross-scope total, and taking it would silently cover the label`,
          );
        }
      }

      const selection: Record<string, unknown> = {};
      for (const dim of query.groupBy) selection[dim] = DIMENSION_COLUMNS[dim];
      for (const measure of query.measures) {
        selection[measure.key] =
          measure.fn === "net"
            ? ledgerNetSum(query.target)
            : measure.fn === "sum"
              ? sql<string>`coalesce(sum(${effectLedger.amount}), 0)`
              : measure.fn === "count"
                ? sql<string>`count(*)`
                : sql<string | null>`max(${effectLedger.occurredAt})`;
      }

      // 🔴 Sorting happens on the **server**, and the key must be something this query actually computed.
      // Sorting by a measure that was not queried sorts a number the result cannot see, and the user cannot check why the order is what it is;
      // sorting the page the client already holds produces the illusion that "only this page is ordered" —
      // "which goods have been still the longest" asks for the first rows of the whole set, and that sort answers a different question.
      const sort = query.sort;
      const sortExpr =
        sort === undefined
          ? null
          : ((): SQL | AnyPgColumn => {
              // No grouping means one row for the whole set, and there is nothing to sort. Ignoring it silently would make the caller think it was sorted.
              if (!query.groupBy.length) {
                badArgument("ledger.aggregate: without groupBy the result is one row, and there is nothing to sort");
              }
              const hit = selection[sort.key];
              if (hit === undefined) {
                badArgument(
                  `ledger.aggregate: sorting by "${sort.key}", but this query did not select it — ` +
                    `what can be sorted is this query's group dimensions and measures (${[...query.groupBy, ...query.measures.map((m) => m.key)].join(" / ") || "(none)"})`,
                );
              }
              return hit as SQL | AnyPgColumn;
            })();

      // Take one extra row to decide "is there more", rather than another count(*):
      // a grouped total needs another subquery, which is not worth it for one boolean.
      const probe = query.limit + 1;
      let statement = exec
        .select(selection as never)
        .from(effectLedger)
        .where(scopedWhere(effectLedger, who, and(...filterConditions(query)) as SQL))
        .$dynamic();
      if (query.groupBy.length) {
        statement = statement.groupBy(...query.groupBy.map((dim) => DIMENSION_COLUMNS[dim]));
        // Paging must have a total order, or page two can overlap page one or skip a row.
        // When a sort key is given it comes first, and the dimensions **still follow** as tie-breakers:
        // sorting by the measure alone leaves two rows with the same value without a total order, while each page looks normal on its own.
        statement = statement.orderBy(
          ...(sortExpr === null ? [] : [sort?.desc === true ? desc(sortExpr) : asc(sortExpr)]),
          ...query.groupBy.map((dim) => asc(DIMENSION_COLUMNS[dim])),
        );
      }
      const raw = (await statement.limit(probe).offset(query.offset)) as Record<string, unknown>[];

      const truncated = raw.length > query.limit;
      const page = truncated ? raw.slice(0, query.limit) : raw;
      const rows: LedgerGroupRow[] = page.map((record) => {
        const row: Record<string, string | number | null> = {};
        // 🔴 The label is on the **row**, not only on the outer response: a row is copied into a table, a CSV, and the model's answer,
        // and the outer marker is dropped on every one of those paths. A row of numbers must be able to say what measure it is.
        if (scopeSpan !== null) row[LEDGER_SCOPE_SPAN_KEY] = scopeSpan;
        for (const dim of query.groupBy) {
          const value = record[dim];
          row[dim] = value === null || value === undefined ? null : String(value);
        }
        for (const measure of query.measures) {
          const value = record[measure.key];
          if (measure.fn === "last_occurred_at") {
            // When the group has no rows it is null, which means "never moved", and that is not the same as 0.
            row[measure.key] = value === null || value === undefined ? null : new Date(value as string).toISOString();
          } else {
            row[measure.key] = toNumber(value, `ledger.aggregate ${measure.key}`);
          }
        }
        return row;
      });

      return { rows, truncated, nextOffset: truncated ? query.offset + query.limit : null };
    },

    async flows(
      identity: Identity,
      query: Omit<LedgerQuery, "groupBy" | "measures">,
    ): Promise<LedgerPage<LedgerRow>> {
      const who = requireIdentity(identity);
      const contract = ledgerContract(query.target);
      if (!contract) badArgument(`ledger.flows: unknown posting target "${query.target}"`);
      if (contract.scope === null && query.where.scopeId !== undefined) {
        badArgument(`ledger.flows: the ${query.target} ledger is one-dimensional and does not accept scopeId`);
      }
      // scopeId is not required here: movements are returned row by row, and each row carries its own scopeId.
      // There is no risk of "across warehouses collapsed into one number" — that defect belongs to aggregation.

      const probe = query.limit + 1;
      const raw = (await exec
        .select()
        .from(effectLedger)
        .where(scopedWhere(effectLedger, who, and(...filterConditions(query)) as SQL))
        // The opposite of rowsOf's ascending order: that one is the reading order for reconciliation, this one asks "has it moved recently",
        // so the latest movement is on the first page. When occurredAt ties, id makes a total order.
        .orderBy(desc(effectLedger.occurredAt), desc(effectLedger.id))
        .limit(probe)
        .offset(query.offset)) as Record<string, unknown>[];

      const truncated = raw.length > query.limit;
      const page = truncated ? raw.slice(0, query.limit) : raw;
      return {
        rows: page.map(rowOf),
        truncated,
        nextOffset: truncated ? query.offset + query.limit : null,
      };
    },

    async append(identity: Identity, rows: readonly NewLedgerRow[]): Promise<void> {
      const who = requireIdentity(identity);
      // Posting an edge with no side effect is an empty array, and that is not an error.
      if (!rows.length) return;

      const values = rows.map((row) => {
        const effect = row.effect;
        const contract = ledgerContract(effect.target);
        if (!contract) fail(`append: unknown posting target "${effect.target}"`);
        if (contract.scope !== null && !effect.scopeId) {
          fail(`append: the ${effect.target} ledger must land on ${contract.scope} — an inventory ledger with no scopeId cannot be aggregated afterwards`);
        }
        if (contract.scope === null && effect.scopeId !== null) {
          fail(`append: the ${effect.target} ledger is one-dimensional and does not accept a scope`);
        }
        if (!Number.isFinite(effect.amount)) fail(`append: the amount is not a finite number; refusing to post`);

        return scopedValues(who, {
          id: randomUUID(),
          target: effect.target,
          op: effect.op,
          amount: String(effect.amount),
          subjectType: effect.subjectType,
          subjectId: effect.subjectId,
          scopeType: effect.scopeType,
          scopeId: effect.scopeId,
          sourceModule: row.sourceModule,
          sourceId: row.sourceId,
          sourceLineId: row.sourceLineId,
          transitionCode: row.transitionCode,
          reversalOf: row.reversalOf,
          occurredAt: row.occurredAt,
          // 🔴 Decided by the caller (resolvePostingPeriod in execute). The repository does not compute it itself.
          // Computing it here would open a second place that assigns a period, and that place would not carry the "if it was deferred, tell the user" half.
          postingPeriod: requirePeriod(row.postingPeriod, `${row.sourceModule}/${row.sourceId}`),
          createdBy: who.userId,
        });
      });

      // Every writer first takes the same balance coordinate lock as the Planner read-set / available_sufficient.
      // Otherwise "0 stock, then a concurrent receipt" can insert a new balance between the Planner's locked recompute and the actual save,
      // the fingerprint stays stable, and a shortage plan that is no longer the latest fact gets executed.
      await lockBalanceCoordinates(
        exec,
        who,
        rows.map((row) => ({
          target: row.effect.target,
          subjectId: row.effect.subjectId,
          scopeId: row.effect.scopeId,
        })),
        inTransaction,
      );

      await assertNonNegativeAppend(repo, who, rows);

      // reversalOf has a unique index: the same row can be reversed only once. A collision must be sayable as "a duplicate reversal",
      // rather than dumping the whole insert, amount and subject included, to the caller.
      await guardWrite("append a ledger row", async () => await exec.insert(effectLedger).values(values));
    },
  };
  return repo;
}
