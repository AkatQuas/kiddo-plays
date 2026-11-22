// ---------------------------------------------------------------------------
// Field key → the name the user sees on the form
//
// Why this is an injected context, not something a primitive looks up itself:
// primitives in `packages/metamodel` are zero-IO pure functions. `evaluate(params, ctx)`
// holds only the values of one document, not the declaration that produced it.
// Every error can then only say the key: the user clicks "submit for review" and
// reads "Missing required fields: warehouseId" — a word that does not exist on
// the form (the form says "Ship-from warehouse").
//
// This is the same class of failure as the AGENTS.md rule "do not let a database
// column constraint act as the validator": Postgres knows the column
// `delivery_date` and does not know the label. Here the application's own
// primitives were making the same mistake, and they did not have to —
// `ModuleSchema` is already in the caller's hands; it was just never passed in.
//
// Why not stuff the whole schema into ctx: a primitive needs the name, not the
// type, the derive, or the options. Passing the whole schema replaces the
// "zero-IO pure evaluation" boundary with "a primitive may see any declaration".
// The next person then branches on `field.type` inside a primitive, which is
// exactly why `validate.ts` (declaration layer) and `primitives.ts` (instance
// layer) are separate.
// ---------------------------------------------------------------------------

import type { Transition } from "../schema/lifecycle.js";
import type { ModuleSchema } from "../schema/module.js";
import type { FieldLabels } from "./primitives.js";

/**
 * Name table for one module, optionally plus one edge.
 *
 * When `edge` is null, `param` is an empty table — `$param.` can appear only on
 * a concrete edge (a rule hanging on `*` may not reference it; see
 * `PRECONDITION_PARAM_ON_ALL`). An empty slot when there is no edge is a fact,
 * not a default.
 *
 * Line columns come from the single line table. Zero or many tables already
 * reject `$line.` via `PRECONDITION_LINE_NO_SUBTABLE` /
 * `PRECONDITION_LINE_AMBIGUOUS`. This returns an empty table in those cases,
 * using the same criterion as those two gates (it does not guess a second table).
 */
export function fieldLabelsOf(module: ModuleSchema, edge: Pick<Transition, "params"> | null = null): FieldLabels {
  const bill: Record<string, string> = {};
  for (const field of module.fields) bill[field.key] = field.label;

  const subtables = module.fields.filter((field) => field.type === "subtable");
  const line: Record<string, string> = {};
  if (subtables.length === 1) {
    for (const column of subtables[0]?.fields ?? []) line[column.key] = column.label;
  }

  const param: Record<string, string> = {};
  for (const declared of edge?.params ?? []) param[declared.key] = declared.label;

  return Object.freeze({ bill: Object.freeze(bill), line: Object.freeze(line), param: Object.freeze(param) });
}
