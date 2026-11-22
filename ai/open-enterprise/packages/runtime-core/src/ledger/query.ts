// ---------------------------------------------------------------------------
// Ledger query — the only copy of parsing and dispatch
//
// The ledger has two entries: the agent's `ledger_query` tool and a person's `GET /api/ledger`.
// Both ask the same question (what happened on this account / what is the balance now), so there can be only one criterion:
// permission, closed enums, where keys and types, paging bounds, and the mutually exclusive rows vs aggregate parameters
// are all judged in this file. Each entry only folds its own message shape into the same args.
//
// Two copies would be the same failure the `/api/balance` comment names: the flows a person sees
// and the flows an agent draws a conclusion from must be the same numbers. Drift does not show up as an error —
// the same question gets two answers that both "look normal".
//
// This layer does not rewrite "which account has a scope". That criterion exists only as `EFFECT_SUBJECT`,
// and `LedgerRepo.aggregate` refuses before SQL (a cross-warehouse total → BalanceArgumentError → 400).
//
// Read only, and it does not lock coordinates: `flows` / `aggregate` do not go through `LedgerRepo.balance`,
// so this path has no `forUpdate` dimension. A pure display must not contend with posting for that advisory lock.
// ---------------------------------------------------------------------------

import {
  EFFECT_OPS,
  ledgerContract,
  listLedgerCodes,
  LEDGER_DIMENSIONS,
  LEDGER_MEASURE_FNS,
  QUERY_DEFAULT_LIMIT,
  QUERY_MAX_LIMIT,
  requireEnum,
  requireText,
  schemaFail,
  type EffectTarget,
} from "@open-erp/metamodel";
import type { RuntimeAuthorizer } from "../contracts/authorization.js";
import type { Identity } from "../contracts/identity.js";
import type { LedgerFilter, LedgerRepo } from "../contracts/repositories.js";

/**
 * Keys the ledger can filter on.
 *
 * This layer does not check "do I know this key" one by one. Each entry already closed the set:
 * the agent surface uses `assertClosedArgs` (`additionalProperties: false` on `where`), and the HTTP surface uses
 * a query-string allowlist. A handwritten third copy would be a third source of truth for the same rule.
 * This list is only for reading each key and checking its type.
 */
const LEDGER_WHERE_KEYS = [
  "subjectId",
  "scopeId",
  "op",
  "sourceModule",
  "transitionCode",
  "occurredFrom",
  "occurredTo",
  "postingPeriod",
] as const;

/** The HTTP entry uses the same key names when it folds a query string into args. Do not copy them again. */
export const LEDGER_WHERE_QUERY_KEYS: readonly string[] = LEDGER_WHERE_KEYS;

function ledgerWhere(raw: unknown): LedgerFilter {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) schemaFail("where must be an object");
  const source = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of LEDGER_WHERE_KEYS) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || !value.trim()) schemaFail(`where.${key} must be a non-empty string`);
    out[key] = value.trim();
  }
  if (out["op"] !== undefined) requireEnum(out["op"], EFFECT_OPS, "where.op");
  for (const key of ["occurredFrom", "occurredTo"] as const) {
    if (out[key] !== undefined && Number.isNaN(Date.parse(out[key]))) {
      schemaFail(`where.${key} "${out[key]}" is not a parseable time`);
    }
  }
  return out as LedgerFilter;
}

function ledgerPaging(args: Readonly<Record<string, unknown>>): { limit: number; offset: number } {
  const limitRaw = args["limit"];
  const limit = limitRaw === undefined || limitRaw === null ? QUERY_DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > QUERY_MAX_LIMIT) {
    schemaFail(`limit must be an integer in 1..${QUERY_MAX_LIMIT}, received ${String(limitRaw)}`);
  }
  const offsetRaw = args["offset"];
  const offset = offsetRaw === undefined || offsetRaw === null ? 0 : Number(offsetRaw);
  if (!Number.isInteger(offset) || offset < 0) schemaFail(`offset must be a non-negative integer, received ${String(offsetRaw)}`);
  return { limit, offset };
}

/**
 * Sort (only `mode=aggregate` has it).
 *
 * Today only the HTTP surface can pass it: the agent tool schema has no `sort`.
 * That is a difference of channel exposure, not a second criterion — both entries still use this file's parser.
 * (The original reason was that the tool catalog was against a budget ceiling; that reason no longer holds, see the two
 * gates in `agentCatalog.test.ts`. So "should the agent also get `sort`" is an open choice again,
 * and it stays as it is until someone actually decides.)
 *
 * Whether a sort key is known is judged by the repository (it knows which measures were computed and which groups were formed).
 * This layer only judges shape. Checking in both places would create a second list of "things that can be sorted",
 * and drift would refuse a measure that was in fact queried.
 *
 * Direction is required and has no default. Ascending "last movement" finds idle stock (longest untouched first);
 * descending finds what moved recently. The two directions answer opposite questions.
 * Guessing one means the user reads an answer that is backwards, and it looks completely normal.
 */
function ledgerSort(raw: unknown): { key: string; desc: boolean } | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) schemaFail("sort must be an object of the form { key, desc }");
  const source = raw as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (key !== "key" && key !== "desc") schemaFail(`sort does not recognize "${key}"; only key and desc are accepted`);
  }
  const desc = source["desc"];
  if (typeof desc !== "boolean") schemaFail("sort.desc must explicitly be true or false — the two directions answer opposite questions");
  return { key: requireText(source["key"], "sort.key"), desc };
}

/** This layer needs exactly two dependencies. Taking a whole `AgentDeps` / `RouteDeps` would make it look wider than it is. */
export interface LedgerQueryDeps {
  readonly authorizer: RuntimeAuthorizer;
  readonly ledger: LedgerRepo;
}

/**
 * Query the ledger.
 *
 * Permission is judged by `assertLedger` after the target is resolved. A person's `/api/ledger` and the agent's
 * `ledger_query` still share this one function. The route does not add a second gate.
 */
export async function queryLedger(
  deps: LedgerQueryDeps,
  identity: Identity,
  args: Readonly<Record<string, unknown>>,
): Promise<Readonly<Record<string, unknown>>> {
  const target: EffectTarget = requireEnum(args["target"], listLedgerCodes(), "target");
  deps.authorizer.assertLedger(identity, target);
  const mode = requireEnum(args["mode"], ["aggregate", "rows"] as const, "mode");
  const where = ledgerWhere(args["where"]);
  const { limit, offset } = ledgerPaging(args);
  const contract = ledgerContract(target);

  if (mode === "rows") {
    for (const key of ["groupBy", "measures"] as const) {
      // Silently ignoring this would make the caller believe grouping took effect, while the result is an ungrouped flow.
      if (args[key] !== undefined) schemaFail(`mode=rows does not accept ${key} — use mode=aggregate to group`);
    }
    // Flow order is fixed (the latest entry is on the first page). A sort key has nothing to sort here.
    // Silently ignoring it would make the caller believe it was sorted, while the result is a different order.
    if (args["sort"] !== undefined) {
      schemaFail("mode=rows does not accept sort — flows are always newest-first by occurred time (the latest entry is on the first page)");
    }
    // A flow is row by row, and each row already carries scopeId. "Total across scopes" has no object here.
    // Silently ignoring it would make the caller believe they had widened something.
    if (args["acrossScopes"] !== undefined) {
      schemaFail("mode=rows does not accept acrossScopes — each flow row carries scopeId, and there is no total to cross");
    }
    const page = await deps.ledger.flows(identity, { target, where, limit, offset });
    return {
      target, mode, subjectType: contract.subject, scopeType: contract.scope,
      rows: page.rows, truncated: page.truncated, nextOffset: page.nextOffset, limit, offset,
      source: "Ledger flows, append-only; a reversal is an opposite entry whose reversalOf points back",
    };
  }

  const groupByRaw = args["groupBy"];
  if (groupByRaw !== undefined && !Array.isArray(groupByRaw)) schemaFail("groupBy must be an array");
  const groupBy = ((groupByRaw ?? []) as unknown[]).map((dim, i) =>
    requireEnum(dim, LEDGER_DIMENSIONS, `groupBy[${i}]`),
  );

  const measuresRaw = args["measures"];
  if (!Array.isArray(measuresRaw) || measuresRaw.length === 0) {
    schemaFail("mode=aggregate needs at least one measure: net=balance / sum=sum ignoring direction / count=number of entries / last_occurred_at=most recent movement");
  }
  const measures = (measuresRaw as unknown[]).map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) schemaFail(`measures[${i}] must be an object`);
    const record = item as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key !== "key" && key !== "fn") schemaFail(`measures[${i}] does not recognize "${key}"; only key and fn are accepted`);
    }
    return { key: requireText(record["key"], `measures[${i}].key`), fn: requireEnum(record["fn"], LEDGER_MEASURE_FNS, `measures[${i}].fn`) };
  });

  const sort = ledgerSort(args["sort"]);

  /**
   * Explicit acknowledgement of a cross-scope total. The default is the old behavior (an account with a scope is refused).
   * The criterion is still only `requireScopeResolved` — this layer judges shape, not "should this be allowed".
   *
   * Do not accept the string "true". Each entry folds its own message into args, and the HTTP layer turns
   * `?acrossScopes=1` into a boolean. Accepting a string here would give one parameter two spellings,
   * and one of them (`acrossScopes="false"`) is truthy in JS — a spelling that turns the rule off.
   */
  const acrossScopesRaw = args["acrossScopes"];
  if (acrossScopesRaw !== undefined && typeof acrossScopesRaw !== "boolean") {
    schemaFail("acrossScopes must be a boolean (true / false), not a string — \"false\" is truthy in a condition");
  }
  const acrossScopes = acrossScopesRaw === true;

  const page = await deps.ledger.aggregate(identity, {
    target, where, groupBy, measures, limit, offset,
    ...(sort === null ? {} : { sort }),
    ...(acrossScopes ? { acrossScopes: true } : {}),
  });
  return {
    target, mode, groupBy, subjectType: contract.subject, scopeType: contract.scope,
    ...(sort === null ? {} : { sort }),
    // The outer flag says it too, but the copy inside each row is the one that carries the weight (see LedgerQuery.acrossScopes):
    // the outer flag is for the caller to branch on, and the in-row flag is for whoever finally reads the number.
    ...(acrossScopes ? { acrossScopes: true } : {}),
    rows: page.rows, truncated: page.truncated, nextOffset: page.nextOffset, limit, offset,
    source: acrossScopes
      ? `Ledger sum, and it is a total across every ${contract.scope ?? "scope"} — it cannot answer whether a given ${contract.scope ?? "scope"} is enough`
      : "Ledger sum. There is no second source — there is no balance table and no balance column",
  };
}
