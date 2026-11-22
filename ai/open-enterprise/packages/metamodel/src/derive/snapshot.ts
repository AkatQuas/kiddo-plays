// ---------------------------------------------------------------------------
// Non-null guarantee of a snapshot source — the only criterion for column
// nullability and for how the write path treats an empty source
//
// `snapshot` means "freeze the source value at the moment of the reference".
// Freezing a value has two halves. Miss one and the freeze chain does not close:
//
//   · `SNAPSHOT_MATCH_OPTIONAL` (validate.ts) — an ordinary snapshot's `match` is
//     required, so the reference must exist. Explicit `snapshot.optional: true`
//     allows the reference to be absent, and the target column must be nullable.
//   · This file — the source cell must have a value, so a value can be read when
//     the reference exists.
//
// This criterion does not decide "is this declaration legal". It decides "may
// the target column be null". Those were confused once, and the cost was a demo
// path that locked up on the spot. It is worth writing down:
//
//   Codegen used to emit `snapshot ⇒ .notNull()` unconditionally, and the loader
//   covered the premise with a gate: "the source must be required / auto, or
//   reject this declaration". That gate was `void`ed on 2026-08-04 (a2d8d90).
//   The reason was right: payroll settlement must freeze an optional labor-report
//   field (the "blank in draft, required on submit" path). That declaration is
//   valid and must not be rejected at load time. The gate went away, and codegen's
//   `.notNull()` did not follow. The inference "snapshot ⇒ there is always a
//   value", which holds only when the source is required, was left on an
//   unconditional physical constraint.
//
//   For the user: "spec / model" on a sales order is optional (item master-detail
//   is unfinished, so a person fills it for now). An order left blank, once
//   approved and shipped, returns 400 `SNAPSHOT_SOURCE_EMPTY` after the document
//   has already left draft. It is stuck in `awaitingShipment` and the only way
//   back is unapprove → withdraw.
//
// The right shape is: nullability of the target column follows nullability of
// the source. If the source had no value at that moment, there is nothing to
// freeze. That is a legal state, not an error. Forcing NOT NULL makes the user
// pay for an unfinished upstream feature, and the rejection points at a cell
// they cannot fill.
//
// There is one copy of this criterion, and there must not be a second. Three
// consumers each compile its output into their own shape:
//   · `packages/builder` codegen — whether the column gets `.notNull()`;
//   · `packages/server` billRepo — when the source is empty, reject (guaranteed
//     ⇒ integrity violation) or write null (not guaranteed ⇒ a legal empty value);
//   · `packages/loader` checkCrossReferences — only a cycle still needs an error.
// Drift does not look like an error: a nullable column whose write path still
// returns 400 (the document is still stuck), or a NOT NULL column whose write
// path allows null (an unreadable 500, and only when the source happens to be empty).
//
// This file answers only "does the source cell have a value" (existence).
// Freezing a value also needs a second dimension: "when does the match cell have
// a value" (timing, `refSupplyOf` in `fields.ts`). A source that is fully
// guaranteed on the declaration can still be empty forever at runtime because no
// hop ever resolves it. The two dimensions combine into one answer in
// `snapshotColumnNotNull`; see that function. Do not stuff timing into this file:
// `snapshotSourceGuarantee` receives source-side coordinates and has no match
// (see `SnapshotSource`). Stuffing it in would require inventing a fake match.
//
// Zero IO: it only consumes module declarations.
// ---------------------------------------------------------------------------

import { schemaFail } from "../schema/common.js";
import { isEmptyValue, refSupplyOf, type Field, type Snapshot } from "../schema/fields.js";
import { isPlatformField, type ModuleSchema } from "../schema/module.js";

/**
 * Look up a module declaration by code.
 *
 * A callback rather than a Map, because the three consumers hold different
 * container shapes (the loader's `Catalog.modules`, the builder's copy of the
 * same, the server's module registry), and each can already produce this one
 * function. Requiring them to convert into the same Map would only add three
 * conversion sites.
 */
export type SnapshotModuleResolver = (code: string) => ModuleSchema | undefined;

/** Why the source counts as "always has a value". The split exists so `explain` and error text can say which case it is. */
export type SnapshotGuaranteeVia =
  /** The source field is `required`, so the column is NOT NULL. */
  | "required"
  /** The source is a platform number, so it has a value at create time and the column is NOT NULL. */
  | "auto"
  /**
   * The source is a line total, so empty lines still have a value (the empty set of sum / count is 0) and the column is NOT NULL.
   *
   * This case was added back. The old gate only recognized `required` / `auto`,
   * so a receivable's `amount ← salesDelivery.totalAmount` (`lineAgg`) was judged
   * "source not guaranteed". That was a hole in the criterion, not in the
   * declaration. `lineAgg` is the same kind of thing as `auto` (the system writes
   * it, it has a column, it always has a value). Missing it makes a posting
   * amount that should be NOT NULL degrade to nullable along with it.
   */
  | "lineAgg"
  /** The source is a fact computed and stored at write time. The table builder constrains calculate columns to NOT NULL. */
  | "calculate"
  /** The source is a header platform column (`updatedAt` and the like): the framework supplies it, and the column is NOT NULL. */
  | "platform"
  /** The source is itself a snapshot, and the chain closes after recursive expansion. */
  | "chain";

/** Why the source counts as "might have no value". */
export type SnapshotGuaranteeGap =
  /** The source field is declared optional (usually "blank in draft, required on submit"). Legal, but the column must be nullable too. */
  | "optional"
  /** The source coordinate does not exist. Another declaration-layer gate reports it. This file only refuses to pretend there is a guarantee. */
  | "missing"
  /** The snapshot chain forms a cycle. */
  | "cycle";

/**
 * The coordinate this criterion is asked about: the source end (which module, which layer, which field).
 *
 * It deliberately does not take a whole `Snapshot`. `match` is the reference
 * cell on this side and has nothing to do with "does the source have a value"
 * (`SNAPSHOT_MATCH_OPTIONAL` guards that other half). Taking a whole `Snapshot`
 * would force a caller that only has source coordinates (the write path holds a
 * `RefSite`) to invent a fake `match`. An invented field eventually gets treated
 * as real somewhere. A `Snapshot` is still structurally assignable.
 */
export type SnapshotSource = Pick<Snapshot, "from" | "through" | "field">;

export type SnapshotGuarantee =
  | { readonly guaranteed: true; readonly via: SnapshotGuaranteeVia; readonly cycle: null }
  | { readonly guaranteed: false; readonly gap: SnapshotGuaranteeGap; readonly cycle: readonly string[] | null };

/**
 * Once a referenced source record is in hand, project same-layer snapshots with the same match into draft starter values.
 *
 * This is the only criterion for "see the frozen value as soon as the source is
 * chosen". Two entries share it:
 *   · the browser picking a ref / refLine row by row;
 *   · create-from on the server preparing line seeds for several source documents at once.
 *
 * A real save still has storage re-query and freeze through resolveRefs. A
 * snapshot value sent back by the client is not trusted. This function owns the
 * draft experience and explainability. If the two entries each wrote a copy,
 * batch create-from would carry only ordinary push fields, snapshots such as
 * productId / baseQty would all stay "pending calculation", and unitChoice would
 * have nothing from which to resolve a factor.
 *
 * A source field that exists but is empty is a legal fact; write null. A source
 * projection that does not even contain the key is a declaration or permission
 * projection mismatch and must be an error. A structural failure must not be
 * disguised as an empty cell.
 */
export function snapshotValuesFromRow(
  fields: readonly Field[],
  match: string,
  source: Readonly<Record<string, unknown>>,
  what: string,
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.snapshot?.match !== match) continue;
    if (!Object.hasOwn(source, field.snapshot.field)) {
      throw new Error(`${what}: the source record has no field "${field.snapshot.field}", so "${field.label}" cannot be filled in`);
    }
    const value = source[field.snapshot.field];
    out[field.key] = isEmptyValue(value) ? null : value;
  }
  return out;
}

/** Fields of the layer `through` names: `null` = header, otherwise the columns of that line table. */
function layerOf(schema: ModuleSchema | undefined, through: string | null): readonly Field[] | null {
  if (!schema) return null;
  if (through === null) return schema.fields;
  const subtable = schema.fields.find((f) => f.key === through && f.type === "subtable");
  return subtable?.fields ?? null;
}

/**
 * Whether a header platform column can be a snapshot source.
 *
 * Excludes `tenantId`, `id`, and `through !== null`, character-for-character the
 * same condition as the place in `checkCrossReferences` that accepts a platform
 * source. Tenant is an isolation pipe, not a business fact. A frozen `id` refers
 * to nothing. Line tables do not have these columns at all. Relaxing any one of
 * them makes this side say "guaranteed" while the other side says "no such field".
 */
function isGuaranteedPlatformSource(through: string | null, field: string): boolean {
  return through === null && isPlatformField(field) && field !== "tenantId" && field !== "id";
}

/**
 * Whether this snapshot's source has a non-null guarantee.
 *
 * Recursively expand the snapshot chain (when the source is itself a snapshot,
 * keep asking upward) and report a cycle honestly. A cycle is a sick declaration.
 * It is not the same class as "the source is optional": the first must be an
 * error, the second is a legal state.
 */
export function snapshotSourceGuarantee(
  resolve: SnapshotModuleResolver,
  source: SnapshotSource,
): SnapshotGuarantee {
  const walk = (from: string, through: string | null, key: string, stack: readonly string[]): SnapshotGuarantee => {
    const coordinate = `${from}.${through ?? "$bill"}.${key}`;
    if (stack.includes(coordinate)) {
      return { guaranteed: false, gap: "cycle", cycle: [...stack, coordinate] };
    }
    const layer = layerOf(resolve(from), through);
    const found = layer?.find((candidate) => candidate.key === key);
    if (!found) {
      // Platform columns are not in `schema.fields`, but every header has them, and they are all NOT NULL.
      return isGuaranteedPlatformSource(through, key)
        ? { guaranteed: true, via: "platform", cycle: null }
        : { guaranteed: false, gap: "missing", cycle: null };
    }
    if (found.required) return { guaranteed: true, via: "required", cycle: null };
    if (found.auto) return { guaranteed: true, via: "auto", cycle: null };
    if (found.lineAgg != null) return { guaranteed: true, via: "lineAgg", cycle: null };
    if (found.calculate != null) return { guaranteed: true, via: "calculate", cycle: null };
    if (!found.snapshot) return { guaranteed: false, gap: "optional", cycle: null };
    const next = walk(found.snapshot.from, found.snapshot.through, found.snapshot.field, [...stack, coordinate]);
    // Keep structural failures such as missing / cycle. Even if the tail of the
    // chain has a value, if this hop allows match to be empty the current source
    // field can still be null. "chain" must not paint that as guaranteed.
    if (!next.guaranteed) return next;
    if (found.snapshot.optional === true) return { guaranteed: false, gap: "optional", cycle: null };
    // Any hop on the chain that holds makes the whole chain hold, but the outside
    // only hears "chain". Which hop delivered it is not the caller's business.
    // Saying more would be read as a property of this field itself.
    return { guaranteed: true, via: "chain", cycle: null };
  };
  return walk(source.from, source.through, source.field, []);
}

/**
 * Whether this field's column should be NOT NULL — the sentence shared by table creation and the write path.
 *
 * This is not an inline expression inside `columnOf`. The write path asks the
 * same question (when the source is empty, reject or write null). Two copies
 * will drift.
 *
 * A non-snapshot field is always `true` here. This function answers only the
 * snapshot dimension. `required` / `auto` / `lineAgg` are folded in by `columnOf`.
 *
 * Both dimensions are required. The one added later is timing:
 *
 *   · Timing (`refSupplyOf(match)`) — does any hop resolve the match cell;
 *   · Existence (`snapshotSourceGuarantee`) — if it is resolved, does the source cell have a value.
 *
 * This used to look only at the second. The gap was observed once: the "business
 * document number" on an accounts-payable reconciliation line freezes a companion
 * ref. The source (the receipt number, `auto`) is fully guaranteed on the
 * declaration, so the column was built NOT NULL. That companion ref's value is
 * filled only during the first hop's resolution, and neither hop resolves the
 * snapshot hanging on it. On save the cell is `undefined`, Drizzle sends
 * `default`, Postgres rejects it, and the result is an unreadable 500.
 * "Guaranteed on the declaration" and "resolvable at runtime" are two questions.
 * Asking only the first drops a 500 through that gap.
 *
 * When timing does not hold, throw. Do not degrade to nullable. Nullable is
 * fail-open: rows that should have a value stay silently blank, while the
 * declaration says "freeze from the source", and nothing says this column no
 * longer freezes. The normal path never hits this throw: `SNAPSHOT_MATCH_UNRESOLVED`
 * (validate.ts) is already red at load time. It guards the day the gate is
 * removed — the header of this file records exactly that accident: the gate was
 * `void`ed, and the column constraint that depended on it did not follow.
 */
export function snapshotColumnNotNull(
  field: Field,
  /** Sibling fields (header `schema.fields`, or that line table's `fields`). Timing looks at the match on the same layer. */
  siblings: readonly Field[],
  resolve: SnapshotModuleResolver,
): boolean {
  if (field.snapshot == null) return true;
  const match = siblings.find((candidate) => candidate.key === field.snapshot?.match);
  const supply = match ? refSupplyOf(match, siblings) : null;
  if (supply === null || supply.stage === "unreachable") {
    schemaFail(
      `Field "${field.key}" snapshot coordinate "${String(field.snapshot.match)}" is never resolved by any hop` +
        ` (${supply?.why ?? "it is not a ref / refLine on the same layer"}) — every physical shape of this column is wrong: ` +
        `notNull becomes a 500 on save, and nullable lets rows that should have a value stay silently blank. ` +
        `SNAPSHOT_MATCH_UNRESOLVED should already have stopped this at load time`,
    );
  }
  // Explicit optional means the match reference may not exist. Even when the
  // source field itself is required, an empty reference has no record to freeze,
  // so the physical column must be nullable. An ordinary snapshot keeps the old strict constraint.
  if (field.snapshot.optional === true) return false;
  return snapshotSourceGuarantee(resolve, field.snapshot).guaranteed;
}

/**
 * Collapse "an optional snapshot has no source reference" into an explicit null.
 *
 * `whole` is for a new header and for lines in a whole-table replacement: an
 * optional match that did not appear also means there is no source. `patch`
 * writes null only when match is present this time and was cleared. Omitting
 * match means "do not change the existing snapshot". A non-empty match is not
 * handled here. It must still go through reference-existence checks and the
 * snapshot freeze in the same query.
 */
export function missingOptionalSnapshotValues(
  fields: readonly Field[],
  values: Readonly<Record<string, unknown>>,
  completeness: "whole" | "patch",
): Readonly<Record<string, null>> {
  const out: Record<string, null> = {};
  for (const field of fields) {
    const snapshot = field.snapshot;
    if (snapshot?.optional !== true) continue;
    if (completeness === "patch" && !Object.hasOwn(values, snapshot.match)) continue;
    if (isEmptyValue(values[snapshot.match])) out[field.key] = null;
  }
  return out;
}
