// There is only one copy of the signed-sum SQL. ledgerRepo.balance / aggregate and the inventory list
// each used to write their own, and a third was even written as the text `op in ('reserve','in')` — agreement was coincidence.
// The real CASE text is metamodel `ledgerNetCaseSql`: the e2e read path goes there too,
// and this side only wraps it as a drizzle fragment. Do not unfold another op list here.

import { sql, type SQL } from "drizzle-orm";
import { ledgerNetCaseSql, type EffectTarget } from "@open-erp/metamodel";

/**
 * Signed sum — balance semantics. The sign is looked up per ledger, and there is no `else`.
 *
 * It used to be `case when op in (positive ops) then amount else -amount end`. That `else`
 * read "this ledger has not defined a sign for the op" as a confident negative number. The write side now relies on a database CHECK
 * (`EFFECT_LEDGER_OP_SIGNED_CONSTRAINT`, generated from `EFFECT_TARGET_OPS`),
 * so a bad row cannot be written at all; the read side therefore does not hang a guard column, and fake-executor tests do not need to change.
 *
 * `coalesce(…, 0)` covers "there are no rows", not "there are rows but the sign cannot be read".
 */
export function ledgerNetSum(target: EffectTarget): SQL<string> {
  return sql<string>`coalesce(sum(${sql.raw(ledgerNetCaseSql(target))}), 0)`;
}
