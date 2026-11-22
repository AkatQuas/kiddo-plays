// ---------------------------------------------------------------------------
// RuleQuery — connect the kernel's read port to a real store
//
// `packages/metamodel` is zero IO. `related_agg` (shipped quantity must not exceed the order) and
// `ref_field_compare` (the customer must be enabled) both need data. The kernel only declares an interface.
// This layer injects the implementation. This is where "the kernel can run offline and be unit-tested" is paid off.
//
// Two hard requirements:
//   1. Everything goes through repositories. No raw SQL. Every repository method takes an Identity, so a query
//      inside rule evaluation carries the tenant scope too. Otherwise tenant A's order quantity can change tenant B's block decision,
//      and that overreach looks innocent: it returns no data, it only changes a judgment.
//   2. Conditions pass through normalizeQuery first. That is the security boundary: a field name must be a field
//      the target module declared, or a platform field, or it is refused. `from` / `match` in a rule come from the schema (trusted),
//      but using the same path means a wider condition source later does not need a second gate.
// ---------------------------------------------------------------------------

import {
  ledgerContract,
  normalizeAggregates,
  normalizeQuery,
  QUERY_MAX_LIMIT,
  type EffectTarget,
  type Query,
  type RuleQuery,
} from "@open-erp/metamodel";
import { requireRuntimeModule, type RuntimeCatalog } from "../contracts/catalog.js";
import type { Identity } from "../contracts/identity.js";
import type { BillRepo, LedgerRepo } from "../contracts/repositories.js";

/**
 * Maximum rows one rule evaluation may scan.
 *
 * Over the cap, throw. Do not truncate. The return value of `related_agg` is the posting gate's criterion:
 * after truncation "shipped so far" is smaller than the truth, and the gate allows an over-shipment it should have blocked —
 * and the result looks completely normal (a sum that is a bit small has no abnormal feature).
 */
export const RULE_QUERY_MAX_ROWS = 10_000;

// The class moved to the ledger repository (next to `LedgerError`) — that is where it is produced,
// and the aggregate surface and the point-query surface must share one class. Two error types for one rule would make the HTTP layer judge twice.
// The export stays here because `routes/balance.ts` and `http/app.ts` have always taken it from this module.
import { BalanceArgumentError } from "../contracts/errors.js";
export { BalanceArgumentError };

export interface RuleQueryDeps {
  /**
   * Whether this evaluation happens inside the transaction that will persist.
   *
   * Default false (read only). The call inside executeTransition passes true, so an availability check locks
   * the ledger coordinate before reading. Two concurrent postings then serialize, instead of each reading "still enough" and each posting.
   */
  readonly forUpdate?: boolean;
  readonly identity: Identity;
  readonly catalog: RuntimeCatalog;
  readonly bills: BillRepo;
  readonly ledger: LedgerRepo;
}

/** Compile `{ orderId: 'so-1', status: 'shipped' }` into a condition tree. An empty condition is null (match everything). */
function whereOf(filters: Readonly<Record<string, unknown>>): unknown {
  // An array means in. Hard-coding eq would make normalizeQuery compare an array to a scalar column,
  // match no rows, and related_agg would show a total of 0 that looks completely normal.
  const children = Object.entries(filters).map(([field, value]) => ({
    kind: "cond" as const,
    field,
    op: Array.isArray(value) ? ("in" as const) : ("eq" as const),
    value,
  }));
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return { kind: "group" as const, join: "and" as const, children };
}

export function createRuleQuery(deps: RuleQueryDeps): RuleQuery {
  const { identity, catalog, bills, ledger } = deps;
  // One transition often checks status, ownership, product, unit, and amount on the same source.
  // One repository projection already returns the whole row. Querying five times by field adds no consistency, only five round trips.
  // Caching the Promise also collapses concurrent reads started at the same moment. An exception is thrown as-is to every consumer.
  const getCache = new Map<string, Promise<Readonly<Record<string, unknown>> | null>>();

  const page = async (entity: string, filters: Readonly<Record<string, unknown>>, limit: number, offset: number) => {
    const schema = requireRuntimeModule(catalog, entity).schema;
    const raw: Record<string, unknown> = { where: whereOf(filters), limit, offset };
    const query: Query = normalizeQuery(schema, raw, `rule read (${entity})`);
    return await bills.list(identity, entity, query);
  };

  return {
    async get(entity, id, through) {
      // Deliberately not `bills.get`: that method throws when the row is missing, and the kernel here wants
      // "not found returns null". `ref_field_compare` uses null to say "customer#c9 does not exist".
      // Turning absence into an exception would make that rule unable to report a reason.
      if (id === undefined || id === null || id === "") {
        throw new Error(`rule read (${entity}): the reference key has no value, so the related row cannot be read`);
      }
      const layer = through ?? null;
      const cacheKey = JSON.stringify([entity, layer, id]);
      const hit = getCache.get(cacheKey);
      if (hit) return await hit;
      const pending = (async (): Promise<Readonly<Record<string, unknown>> | null> => {
        if (layer !== null) {
          const rows = await bills.lineRows(identity, entity, layer, { id }, 1);
          return rows[0] ?? null;
        }
        const first = await page(entity, { id }, 1, 0);
        return first.rows[0] ?? null;
      })();
      getCache.set(cacheKey, pending);
      return await pending;
    },

    async list(entity, where, through) {
      // A line layer (`through` set) takes its own path: the join key and the measure are on line columns,
      // while a criterion such as `status` is on the header. An ordinary list query cannot express that shape.
      if (through !== undefined && through !== null) {
        return await bills.lineRows(identity, entity, through, where, RULE_QUERY_MAX_ROWS);
      }
      const collected: Readonly<Record<string, unknown>>[] = [];
      let offset = 0;
      for (;;) {
        const result = await page(entity, where, QUERY_MAX_LIMIT, offset);
        collected.push(...result.rows);
        if (result.total > RULE_QUERY_MAX_ROWS) {
          throw new Error(
            `rule read (${entity}) matched ${result.total} rows, over the cap ${RULE_QUERY_MAX_ROWS} — ` +
              `the aggregate would be truncated, and a truncated sum looks completely normal. Refusing to give a gate conclusion on that basis`,
          );
        }
        if (collected.length >= result.total || !result.rows.length) return collected;
        offset += QUERY_MAX_LIMIT;
      }
    },

    async invariantAggregate(entity, where, through, agg, measure) {
      const schema = requireRuntimeModule(catalog, entity).schema;
      // A missing data scope means no read on the target module. An invariant may cross self/all; it does not cross module authorization.
      if (!identity.dataScopes[entity]) {
        throw new Error(`system invariant aggregate (${entity}): the current identity has no read on the target module; refusing to read`);
      }
      const summary = { field: measure, fn: agg } as const;
      let result;
      if (through !== null) {
        result = await bills.invariantLineSummary(identity, entity, through, where, summary);
      } else {
        const query = normalizeQuery(
          schema,
          { where: whereOf(where), limit: 1, offset: 0 },
          `system invariant aggregate (${entity})`,
        );
        const normalized = normalizeAggregates(schema, [summary], `system invariant aggregate (${entity}).summary`)[0];
        if (!normalized) throw new Error(`system invariant aggregate (${entity}) is missing summary`);
        result = await bills.invariantBillSummary(identity, entity, query, normalized);
      }
      // Same semantics as an ordinary related_agg walked row by row: an empty sum is 0, an empty min does not exist.
      if (result.total === 0) return agg === "sum" ? 0 : null;
      if (result.value === null) {
        throw new Error(`system invariant aggregate (${entity}.${measure}) matched ${result.total} rows but has no numeric value`);
      }
      return result.value;
    },

    /**
     * Balance = sum of the ledger. The coordinates are the same set effects use when they write the ledger,
     * so "the account the check reads" and "the account the posting writes" land in the same cell.
     *
     * The scope criterion comes from `EFFECT_SUBJECT` — the same table the effects gate uses.
     * Do not rewrite "only stock needs a warehouse" here. Two copies mean a future two-dimensional
     * target is recognized by the gate and not here, and the symptom is a cross-scope total that looks completely normal.
     */
    async balance(target: EffectTarget, subjectId: string, scopeId: string | null) {
      const contract = ledgerContract(target);
      if (!subjectId) throw new BalanceArgumentError(`balance: ${target} was given no subject id, so this account cannot be attributed`);
      if (contract.scope !== null && !scopeId) {
        throw new BalanceArgumentError(
          `balance: the ${target} account is kept per ${contract.scope}, and without it the only result is a total across every ${contract.scope} — ` +
            `that number looks completely normal and cannot answer whether this ${contract.scope} is enough. Refusing to return it`,
        );
      }
      if (contract.scope === null && scopeId) {
        throw new BalanceArgumentError(`balance: the ${target} account is one-dimensional, and scope id "${scopeId}" has no reading`);
      }
      // forUpdate follows "will this evaluation persist": the evaluation inside executeTransition
      // must lock the coordinate (see LedgerRepo.balance). preview / propose are read-only and do not take the lock.
      const value = await ledger.balance(identity, target, subjectId, scopeId, deps.forUpdate ?? false);
      // Do not degrade a missing value to 0. Under a pure balance, an invented 0 would quietly allow an over-stock posting.
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`balance: the ledger total for ${target}/${subjectId} is not a finite number (${String(value)})`);
      }
      return value;
    },
  };
}
