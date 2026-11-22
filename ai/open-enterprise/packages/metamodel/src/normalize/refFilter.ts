// ---------------------------------------------------------------------------
// Reference candidate filter — "which records this cell may choose"
//
// This capability exists for one reason: **the candidate side and the rule
// side must be the same rule.**
//
// Before it, modules already declared many "this reference must satisfy X"
// constraints (`production_org_is_factory`, `bom_product_makeable`,
// `assignment_task_active`, …), but every one of them hung on `onTransition`
// and was judged **only at execution**; candidate queries (`refOptions` / the
// picker's `list`) knew nothing about those declarations. The inevitable path:
//
//   the dropdown lists the whole tenant → the user picks one that looks right
//   → save succeeds → submit is rejected
//
// All three costs are real: the person entering the bill pages through hundreds
// of rows (factory / workshop / line / team mixed together), a wrong pick is
// revealed only at the last step, and the error says "precondition X failed" —
// it cannot tell the user **which records they should have chosen**.
//
// So a filter is not "another validation layer". It projects a rule that already
// exists **onto the candidates ahead of time**. The hard discipline matches the
// "character for character" rule of `refOptions` / `resolveRefs`, and is stronger:
// the two sides do not each write SQL that merely looks the same. They **share
// the same pure function in this file** (`resolveRefFilter`), and the candidate
// side and the write side only compile its output into their own where.
//
// One rule implies: a record missing from the dropdown cannot be referenced by
// a hand-written id, and a record the dropdown offers cannot be rejected on save.
// ---------------------------------------------------------------------------

import { requireObject, requireText, schemaFail } from "../schema/common.js";

/** Scalar value of a filter condition. Deliberately the same value domain as `RowFilter` — the same kind of thing does not get a second domain. */
export type RefFilterScalar = string | number | boolean | null;

/**
 * Dynamic operand: read a value from **the bill being entered**.
 *
 * The prefix set is closed at two, with the same meaning as the rule primitives
 * (`$bill.` / `$line.`). This does not invent another path syntax:
 *   · `$bill.x` — current value of header field x
 *   · `$line.x` — current value of column x on **the same line** (only a ref on a line column may use it)
 *
 * There is no `$actor.` / `$param.`. The first (current operator) expresses
 * **data scope**, which `moduleScopedWhere` already owns; repeating it here
 * would produce two rules that both claim to be "the visible set". The second
 * is an edge parameter, and candidates are an entry-time concern, when no edge
 * has been taken yet.
 */
export interface RefFilterRef {
  readonly from: string;
  /** Source enum value → target candidate value; evaluation still feeds the same refFilter conditions. */
  readonly map?: Readonly<Record<string, RefFilterScalar | readonly RefFilterScalar[]>>;
  /**
   * Narrow by a **line column of the upstream bill**: `from` is that bill's id,
   * and the candidate key (for example `id`) must be among the values of column
   * `field` on that bill's `through` table.
   *
   * Mutually exclusive with `map`. `through` / `field` must come as a pair.
   *
   * **When from is blank, skip this condition; do not mark it pending.** It is a
   * narrowing added on top of the static conditions ("if a plan is chosen, offer
   * only that plan's goods"), not "no upstream means no candidate set". Marking
   * it pending would force a manual bill (which is allowed to have no plan) into
   * "pick a plan first".
   */
  readonly through?: string;
  readonly field?: string;
}

export type RefFilterOperand = RefFilterScalar | readonly RefFilterScalar[] | RefFilterRef;

/**
 * Reference candidate filter. The key is a field on the **target module** (or the
 * platform field `status`); the value is what it must equal.
 *
 * ```ts
 * { key: "productionOrgId", type: "ref", ref: "orgUnit",
 *   refFilter: { orgType: "factory" } }                     // static: a factory is only a factory
 *
 * { key: "productId", type: "ref", ref: "product",
 *   refFilter: { materialType: ["semiFinished", "finished"] } }       // static: an array means in
 *
 * { key: "processAssignmentId", type: "ref", ref: "processAssignment",
 *   refFilter: { productionTaskId: { from: "$bill.productionTaskId" } } }  // dynamic: only this task
 *
 * { key: "productId", type: "ref", ref: "product",
 *   refFilter: {
 *     canPurchase: true, status: "active",
 *     id: { from: "$line.planId", through: "lines", field: "productId" },
 *   } }  // a plan is chosen → only goods on that plan's lines; none chosen → still purchasable products
 * ```
 *
 * Keys are combined with **and** (the same shape as `RowFilter`). There is no
 * or and no comparator: "which records may be chosen" is equality and enum
 * membership in real business. A mini query language would make the candidate
 * side and the write side each implement a semantics, which is the thing this
 * capability exists to remove.
 */
export type RefFilter = Readonly<Record<string, RefFilterOperand>>;

/**
 * The **default row among the candidates** — "when this cell is blank, pick the
 * single row from this cell's existing candidate set that matches these conditions".
 *
 * The value domain matches `RefFilter` character for character (scalar / array = in),
 * because it is a **filter added on top of the candidate set**: compilation,
 * comparison, and cross-module coordinate lookup all reuse the `refFilter`
 * implementation. There is no second one.
 *
 * **There is only one candidate-set definition**: the default must be picked from
 * the set `refFilter` already drew, not from a second query. A second query has
 * the worst symptom — "a record the dropdown cannot offer was filled in
 * automatically" — while each side looks fine on its own. So this **does not
 * accept dynamic operands** (`$bill.` / `$line.`): a condition that follows the
 * bill's current value is part of the **candidate set** and belongs in
 * `refFilter`. Writing it here opens a second candidate set for the same cell.
 *
 * **Fill only when exactly one row matches**; zero or more than one fills nothing
 * (do not guess, do not take the first). That rule is honored on the consumer
 * side (`refPreselectSitesOf` projects the coordinate and the server counts
 * rows), not here — but it is the entire reason this type exists.
 */
export type RefPreselect = RefFilter;

/** Closed prefixes of a dynamic operand. Adding a fifth prefix also requires a projection; see AGENTS.md "closed prefix => statically checkable". */
export const REF_FILTER_PREFIXES = ["$bill.", "$line."] as const;

export function isRefFilterRef(value: unknown): value is RefFilterRef {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "from" in value;
}

function assertRefFilterScalar(value: unknown, label: string): asserts value is RefFilterScalar {
  const kind = typeof value;
  if (value === null || kind === "string" || kind === "number" || kind === "boolean") return;
  schemaFail(`${label} must be a scalar (string / number / boolean / null), an array of scalars, or { from: "$bill.x" }; received ${JSON.stringify(value)}`);
}

/**
 * Normalize and the declaration-time shape gate.
 *
 * This judges only **shape** (closed prefixes, value domain, empty sets).
 * "Does this key exist on the target module" and "does the operand field exist
 * on this module" are cross-module questions for the loader (`validateModule`
 * sees one module at a time and is structurally blind to the target).
 */
export function normalizeRefFilter(raw: unknown, label: string): RefFilter {
  const obj = requireObject(raw, label);
  const entries = Object.entries(obj);
  if (!entries.length) {
    schemaFail(`${label} is an empty object — no conditions means no filter; delete this key`);
  }
  const out: Record<string, RefFilterOperand> = {};
  for (const [key, value] of entries) {
    const at = `${label}.${key}`;
    if (!key.trim()) schemaFail(`${at}: a condition key must be a field name on the target module`);

    if (Array.isArray(value)) {
      if (!value.length) {
        schemaFail(`${at} is an empty array — "in these values" with none listed makes the candidate set always empty`);
      }
      value.forEach((v, i) => assertRefFilterScalar(v, `${at}[${i}]`));
      out[key] = [...value] as readonly RefFilterScalar[];
      continue;
    }

    if (isRefFilterRef(value)) {
      const rawRef = requireObject(value, at);
      const extra = Object.keys(rawRef).filter((k) => k !== "from" && k !== "map" && k !== "through" && k !== "field");
      if (extra.length) schemaFail(`${at} has unknown keys "${extra.join(", ")}": a dynamic operand only has from / map / through / field`);
      const from = requireText(rawRef["from"], `${at}.from`);
      if (!REF_FILTER_PREFIXES.some((p) => from.startsWith(p))) {
        schemaFail(
          `${at}.from "${from}" has an unknown prefix: only ${REF_FILTER_PREFIXES.join(" / ")}` +
            ` ($actor visibility is owned by data scope; $param has no edge in flight at entry time)`,
        );
      }
      const path = from.slice(from.indexOf(".") + 1);
      if (!path.trim()) schemaFail(`${at}.from "${from}" does not name a field`);
      const throughRaw = rawRef["through"];
      const fieldRaw = rawRef["field"];
      const hasThrough = throughRaw !== undefined && throughRaw !== null;
      const hasField = fieldRaw !== undefined && fieldRaw !== null;
      if (hasThrough !== hasField) {
        schemaFail(`${at}: through and field must be a pair — writing only one declares half a line narrowing, and the candidate side cannot execute it`);
      }
      let through: string | undefined;
      let sourceField: string | undefined;
      if (hasThrough && hasField) {
        through = requireText(throughRaw, `${at}.through`);
        sourceField = requireText(fieldRaw, `${at}.field`);
        if (!through.trim()) schemaFail(`${at}.through must not be empty`);
        if (!sourceField.trim()) schemaFail(`${at}.field must not be empty`);
      }
      const mapRaw = rawRef["map"];
      let map: RefFilterRef["map"];
      if (mapRaw !== undefined && mapRaw !== null) {
        const mapObject = requireObject(mapRaw, `${at}.map`);
        const entries = Object.entries(mapObject);
        if (!entries.length) schemaFail(`${at}.map is an empty object — the map has no source value that can be evaluated`);
        const normalized: Record<string, RefFilterScalar | readonly RefFilterScalar[]> = {};
        for (const [source, target] of entries) {
          if (!source.trim()) schemaFail(`${at}.map source value must not be empty`);
          if (Array.isArray(target)) {
            if (!target.length) schemaFail(`${at}.map.${source} is an empty array — this source value would produce an always-empty candidate set`);
            target.forEach((item, index) => assertRefFilterScalar(item, `${at}.map.${source}[${index}]`));
            normalized[source] = [...target] as readonly RefFilterScalar[];
          } else {
            assertRefFilterScalar(target, `${at}.map.${source}`);
            normalized[source] = target;
          }
        }
        map = normalized;
      }
      if (through !== undefined && map !== undefined) {
        schemaFail(`${at}: a line narrowing (through/field) cannot be combined with map — a map is enum to enum, a line narrowing is "which goods are on the upstream bill"`);
      }
      out[key] =
        through === undefined
          ? map === undefined
            ? { from }
            : { from, map }
          : { from, through, field: sourceField as string };
      continue;
    }

    assertRefFilterScalar(value, at);
    out[key] = value;
  }
  return out;
}

/**
 * Normalize and the declaration-time shape gate (`refPreselect`).
 *
 * Same value-domain checks as `normalizeRefFilter`, plus one closure:
 * **dynamic operands are always rejected**. See the `RefPreselect` comment —
 * there is one candidate-set definition, and a condition that follows the
 * current value belongs in `refFilter`.
 */
export function normalizeRefPreselect(raw: unknown, label: string): RefPreselect {
  const filter = normalizeRefFilter(raw, label);
  for (const [key, operand] of Object.entries(filter)) {
    if (!isRefFilterRef(operand)) continue;
    schemaFail(
      `${label}.${key} uses dynamic operand "${operand.from}" — ` +
        `preselect only answers "which candidate is the default", while "which set is the candidate set" is said by refFilter. ` +
        `A condition that follows this bill's current value belongs in refFilter: writing it here opens a second candidate set for the same cell, ` +
        `and when the two definitions drift the symptom is "a record the dropdown cannot offer was filled in automatically"`,
    );
  }
  return filter;
}

// ── Evaluation: the one implementation shared by the candidate side and the write side ──

/**
 * Evaluation product: one "target field in these values". A single value is
 * also encoded as a one-element array, so the compiler handles one shape.
 *
 * When `via` is present, `values` are first **upstream bill ids**; the repository
 * then expands them through `through.field` into the real candidate values.
 * Do not compile them to SQL or compare them in JS before that expansion — that
 * treats a plan id as a product id, and the candidate set stays empty with no error.
 */
export interface RefFilterVia {
  readonly through: string;
  readonly sourceField: string;
  readonly from: string;
  /** Upstream bill module. `bindRefFilterViaEntities` fills it from the `ref` of the `from` cell. */
  readonly entity?: string;
}

export interface RefFilterCondition {
  readonly field: string;
  readonly values: readonly RefFilterScalar[];
  readonly via?: RefFilterVia;
}

/** `bindRefFilterViaEntities` reads only these three fields, to avoid a refFilter ↔ Field import cycle. */
export interface RefFilterBindField {
  readonly key: string;
  readonly type: string;
  readonly ref: string | null;
}

/**
 * Evaluation result.
 *
 * `pending` is not an empty condition. It is **a negative conclusion**: the cell
 * a dynamic operand points at is still blank, so "this task's assignments" has
 * no referent right now. The two sides must honor it separately:
 *   · the candidate side returns the **empty set** and carries pending to the UI ("choose the source bill first")
 *   · the write side **rejects**
 *
 * Neither side may fall back to "do not filter" — that is fail-open, and the
 * symptom is exactly the one this capability exists to remove (the dropdown
 * lists everything). It happens only when that upstream cell happens to be
 * blank, which is the hardest case to reproduce.
 */
export interface RefFilterResolution {
  readonly conditions: readonly RefFilterCondition[];
  /** Dynamic operands whose value could not be read, kept as `$bill.x` so the caller can turn them into a label. */
  readonly pending: readonly string[];
}

export const EMPTY_REF_FILTER_RESOLUTION: RefFilterResolution = Object.freeze({
  conditions: Object.freeze([]),
  pending: Object.freeze([]),
});

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

/**
 * Evaluate the declaration plus the current draft into a set of "target field in these values".
 *
 * **Zero IO, a pure function.** The candidate side (`refOptions` / the picker's
 * list) and the write side (`resolveRefs`) both call it, so the two rules are
 * not "written the same"; they are **the same rule**.
 *
 * @param filter       the declaration on the field (`field.refFilter`)
 * @param headerValues current header values of this bill
 * @param rowValues    a ref on a line column passes that line's values; a header field passes null
 */
export function resolveRefFilter(
  filter: RefFilter | null | undefined,
  headerValues: Readonly<Record<string, unknown>>,
  rowValues: Readonly<Record<string, unknown>> | null,
): RefFilterResolution {
  if (filter == null || typeof filter !== "object" || Array.isArray(filter)) {
    return EMPTY_REF_FILTER_RESOLUTION;
  }

  const conditions: RefFilterCondition[] = [];
  const pending: string[] = [];

  for (const [field, operand] of Object.entries(filter)) {
    if (isRefFilterRef(operand)) {
      const { from } = operand;
      const map = operand.map ?? null;
      const through = operand.through;
      const sourceField = operand.field;
      const isLine = from.startsWith("$line.");
      const path = from.slice(from.indexOf(".") + 1);
      // $line. is not allowed on a header field (already rejected at declaration time). When rowValues is null, catch it again:
      // treating it silently as "no value" would present a declaration error as "fill this cell first", and that cell does not exist.
      const source = isLine ? rowValues : headerValues;
      const value = source === null ? undefined : source[path];
      if (isBlank(value)) {
        // A line narrowing is a narrowing on top of the static conditions: a blank upstream is skipped, and a manual bill still uses canPurchase + active.
        // An ordinary dynamic operand stays pending — "this task's assignments" has no referent when the task is blank.
        if (through === undefined) pending.push(from);
        continue;
      }
      let resolved: unknown = value;
      if (map !== null) {
        const mapped = map[String(value)];
        if (mapped === undefined) {
          schemaFail(`refFilter.${field}: value "${String(value)}" of ${from} has no mapping — declaration time should cover the source enum completely`);
        }
        resolved = mapped;
      }
      const values = Array.isArray(resolved) ? resolved : [resolved as RefFilterScalar];
      conditions.push(
        through === undefined || sourceField === undefined
          ? { field, values }
          : { field, values, via: { through, sourceField, from } },
      );
      continue;
    }

    if (Array.isArray(operand)) {
      conditions.push({ field, values: [...operand] as readonly RefFilterScalar[] });
      continue;
    }

    conditions.push({ field, values: [operand as RefFilterScalar] });
  }

  return { conditions, pending };
}

/**
 * "Which set should this cell's default be picked from" — the candidate set
 * (`refFilter`) **plus** the default conditions (`refPreselect`).
 *
 * This function exists entirely so **the candidate set is never copied**. If the
 * default fired its own query from its own conditions, "a record the dropdown
 * cannot offer at all was filled into this cell" would happen — the user can
 * page through every candidate and never find it, while both sides look correct
 * alone. The output here is the refFilter evaluation **plus** the default
 * conditions, and the consumers (the server's row count, the candidate endpoint)
 * only compile that into their own where.
 *
 * `null` means this cell declares no preselect, and the caller should do nothing
 * (distinct from "no unique row": the first means the capability is absent, the
 * second is a legal conclusion of the capability).
 *
 * A non-empty `pending` means the candidate set has no referent right now (that
 * upstream cell is still blank). **Do not pick**, and do not error: the final
 * rule for "BOM not filled" is this cell's own required, which the value gate
 * runs again after values are filled. Falling back to "pick one with no filter"
 * is fail-open, and the symptom is the one this capability must not have —
 * filling in a BOM that belongs to a different product.
 */
export function resolveRefPreselect(
  filter: RefFilter | null,
  preselect: RefPreselect | null,
  sole: boolean,
  headerValues: Readonly<Record<string, unknown>>,
  rowValues: Readonly<Record<string, unknown>> | null,
): RefFilterResolution | null {
  if (preselect === null && !sole) return null;
  const candidates = resolveRefFilter(filter, headerValues, rowValues);
  // `refPreselectSole`: the condition set **is** the candidate set; do not stack default conditions. A unique candidate is filled automatically.
  if (sole) return candidates;
  // Static values (dynamic operands are already rejected at declaration time), so this pending is always empty; still union them,
  // so that opening dynamic operands later does not silently drop a negative conclusion here.
  const chosen = resolveRefFilter(preselect, headerValues, rowValues);
  return {
    conditions: [...candidates.conditions, ...chosen.conditions],
    pending: [...candidates.pending, ...chosen.pending],
  };
}

/**
 * Every dynamic-operand coordinate in the declaration — for the **frontend**:
 * it learns "which cells' current values to send before fetching candidates"
 * and must not read the rule out of the declaration itself.
 *
 * Returns `{ scope, key }`: `scope` is `"bill"` / `"line"`, and `key` is the field name on that layer.
 */
export function refFilterOperands(
  filter: RefFilter | null | undefined,
): readonly { readonly scope: "bill" | "line"; readonly key: string }[] {
  if (filter == null || typeof filter !== "object" || Array.isArray(filter)) return [];
  const out: { scope: "bill" | "line"; key: string }[] = [];
  for (const operand of Object.values(filter)) {
    if (!isRefFilterRef(operand)) continue;
    const { from } = operand;
    out.push({
      scope: from.startsWith("$line.") ? "line" : "bill",
      key: from.slice(from.indexOf(".") + 1),
    });
  }
  return out;
}

/**
 * Attach the upstream module code to a line-narrowing condition.
 *
 * `resolveRefFilter` is a pure function and does not see the schema; which module
 * the `from` cell points at is the `ref` of the field on this layer. The
 * candidate endpoint and the write site both use this function. A missing bind
 * makes the repository treat a plan id as a product id.
 */
export function bindRefFilterViaEntities(
  headerFields: readonly RefFilterBindField[],
  lineFields: readonly RefFilterBindField[] | null,
  resolution: RefFilterResolution,
): RefFilterResolution {
  let changed = false;
  const conditions = resolution.conditions.map((condition) => {
    const via = condition.via;
    if (via === undefined || via.entity !== undefined) return condition;
    const isLine = via.from.startsWith("$line.");
    const key = via.from.slice(via.from.indexOf(".") + 1);
    const layer = isLine ? lineFields : headerFields;
    const source = layer?.find((field) => field.key === key);
    const entity = source?.type === "ref" ? source.ref : null;
    if (entity === null || entity === undefined || entity === "") {
      schemaFail(
        `refFilter.${condition.field} line-narrowing source "${via.from}" is not a reference — ` +
          `narrowing through an upstream bill's lines requires a source that is a ref to that bill`,
      );
    }
    changed = true;
    return { ...condition, via: { ...via, entity } };
  });
  return changed ? { conditions, pending: resolution.pending } : resolution;
}
