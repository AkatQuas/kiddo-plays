// ---------------------------------------------------------------------------
// Reference candidates: turn "which cell am I choosing for" into a set of filter conditions
//
// The criterion is read by the server from the declaration. The client only sends the coordinate and the current values on the same layer.
//
// That boundary is what makes `refFilter` real. If the client sent the conditions themselves,
// the filter would degrade into a suggestion — omitting it means the full set, and omitting it is the cheapest implementation,
// so the capability would silently fail on the first entry that forgot to wire it, and look completely normal.
//
// The only lie the client can tell is to report `$bill.productionOrderId` as some other order, so the dropdown
// shows that order's production tasks. It gets nothing extra:
//   - the candidate query still goes through `moduleScopedWhere` (tenant × data scope) and cannot cross identity;
//   - on save the write side resolves again from the values that will be stored (`refSitesOf` → `resolveRefFilter`),
//     and a lied cell that does not match the real value is a 400.
// The gain from lying is "see a batch of records you were already allowed to list". The cost is that save is refused.
// ---------------------------------------------------------------------------

import {
  bindRefFilterViaEntities,
  hasManualInput,
  resolveRefFilter,
  resolveRefPreselect,
  transitionActions,
  type Field,
  type ModuleSchema,
  type RefFilterCondition,
  type RefFilterResolution,
} from "@open-erp/metamodel";

export class RefCandidateError extends Error {
  override readonly name = "RefCandidateError";
}

function fail(message: string): never {
  throw new RefCandidateError(message);
}

export interface RefCandidateCoordinate {
  /** `"warehouseId"` (header) or `"lines.bomId"` (line column). Same coordinate shape as `refLineOptions`. Do not invent another. */
  readonly path: string;
  /** Current header values (the `$bill.` evaluation context). */
  readonly bill: Readonly<Record<string, unknown>>;
  /** A line-column ref passes the current row (`$line.` evaluation context). A header field passes null. */
  readonly line: Readonly<Record<string, unknown>> | null;
}

export interface RefCandidateTarget {
  readonly field: Field;
  readonly entity: string;
  readonly resolution: RefFilterResolution;
  /** Operands that have no value yet, turned into labels so the UI can say "choose the production order first". */
  readonly pendingLabels: readonly string[];
  /**
   * Query conditions for "which row to select automatically when this cell is blank" (candidate set ∪ default conditions).
   * `null` = this cell declares no default selection.
   *
   * Comes from the same `resolveRefPreselect` as the write side (`refPreselectSitesOf`):
   * the row the form fills and the row the server fills on save must be computed by one criterion.
   * Two copies show up as "the UI filled A, and after save it became B", and each side looks legal alone.
   */
  readonly preselect: readonly RefFilterCondition[] | null;
}

/**
 * Resolve one candidate coordinate.
 *
 * The coordinate shape is identical to `CreateBlocker.path` / `pushDefaults` / `refLineOptions`
 * (`<line table>.<column>`). A fourth path syntax would parse the same concept four times.
 */
export function resolveRefCandidate(schema: ModuleSchema, coordinate: RefCandidateCoordinate): RefCandidateTarget {
  const what = `candidates for "${schema.code}.${coordinate.path}"`;
  const parts = coordinate.path.split(".");
  const [first, second, ...rest] = parts;
  if (!first || rest.length || (parts.length === 2 && !second)) {
    fail(`${what}: a coordinate is "field" or "<line table>.<column>", received "${coordinate.path}"`);
  }

  let layer: readonly Field[];
  let field: Field | undefined;
  if (parts.length === 1) {
    layer = schema.fields;
    field = layer.find((f) => f.key === first);
    if (!field) fail(`${what}: module "${schema.code}" has no header field "${first}"`);
  } else {
    const table = schema.fields.find((f) => f.key === first && f.type === "subtable");
    const actionLine = table?.fields
      ? null
      : transitionActions(schema.lifecycle)
          .flatMap((action) => action.params)
          .find((param) => param.key === first && param.type === "billLines")?.lineField ?? null;
    const columns = table?.fields ?? actionLine?.fields;
    if (!columns) fail(`${what}: module "${schema.code}" has no line table "${first}"`);
    layer = columns;
    field = layer.find((f) => f.key === second);
    if (!field) fail(`${what}: line table "${first}" has no column "${String(second)}"`);
  }

  if (field.type !== "ref") {
    // Line candidates go through `refLineOptions` (that endpoint answers "row", not "record"). Folding them together
    // would make "does this return a record or a row" depend on the parameters, which is why the two field types are separate.
    fail(
      `${what}: "${field.key}" is ${field.type}, not a record reference — ` +
        (field.type === "refLine" ? "line-reference candidates use /api/refs/:module/:path/lines" : "it has no candidate set"),
    );
  }
  // A system-supplied ref (a companion ref and the like) cannot be filled by a user. Asking it for candidates means the caller wired the wrong field.
  if (!hasManualInput(field)) fail(`${what}: "${field.key}" is system-supplied and has no candidates to choose`);

  const entity = field.ref ?? fail(`${what}: ref field "${field.key}" has no ref target — the declaration gate should already have refused this`);
  // A header field passes null, not an empty object. `$line.` on a header is a declaration error (already refused at declare time).
  // An empty object would collapse it into "that cell is blank", and the UI would show a hint pointing at a field that does not exist.
  const rowValues = parts.length === 1 ? null : coordinate.line;
  const resolution = bindRefFilterViaEntities(
    schema.fields,
    parts.length === 1 ? null : layer,
    resolveRefFilter(field.refFilter, coordinate.bill, rowValues),
  );
  const preselect = resolveRefPreselect(
    field.refFilter,
    field.refPreselect,
    field.refPreselectSole,
    coordinate.bill,
    rowValues,
  );

  return {
    field,
    entity,
    resolution,
    // When pending is non-empty, do not return conditions: the candidate set has no referent yet, and a picked "default" would be a guess.
    // The caller uses `resolution.pending` to say what is missing, in the same sentence as the candidate branch.
    preselect: preselect === null || preselect.pending.length > 0 ? null : preselect.conditions,
    pendingLabels: resolution.pending.map((from) => {
      const isLine = from.startsWith("$line.");
      const key = from.slice(from.indexOf(".") + 1);
      const hit = (isLine ? layer : schema.fields).find((f) => f.key === key);
      return hit?.label ?? key;
    }),
  };
}
