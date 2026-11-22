// ---------------------------------------------------------------------------
// Bill relations — deriving "who points at whom"
//
// This is not a seventh concept: a module declaration has no relations key. Like `Query` / `CheckReport` /
// `OperationDescriptor`, it is a runtime value type — it **projects** `type:'ref'` in fields
// into a graph.
//
// ── Why it must be derived and cannot be declared ──
//
// `{ key:'orderId', type:'ref', ref:'salesOrder' }` already says everything:
// this value is the id of a salesOrder record. Asking a person to write "salesDelivery belongs to salesOrder" again
// would be a second source of truth — change the ref target and forget the relation declaration, and neither side errors.
//
// The reverse is the same: **"who points at me" = scan every module for a field whose ref === this module**.
// Adding a new module that references a sales order then grows that panel on the order detail page, with zero configuration.
//
// ── The hole that was observed ──
//
// Without this derivation, the renderer read `ref` as "the selected item of a dropdown" rather than "an edge":
// "sales order SO-2026-0007" on a delivery was dead text, and "shipped quantity 1500" on the order computed correctly
// but did not show which deliveries shipped it. The anchor count inside the detail page's `<main>` was 0.
// A relation that was declared and unused by the renderer is that part falling back to hand-written UI.
//
// ── Division of labor with oe_reference ──
//
// That table records **line-level lineage** (this row was pushed from that row), and it exists only when a push ran.
// This file derives **declaration-level relations** (this field points at that module), which always hold.
// The grains differ; it is not a choice of one: reverse-looking up downstream bills must use the latter — using the former,
// a bill that was not pushed (built by hand, imported) displays as "no downstream", while the rollup on the same screen shows the total.
//
// Zero IO: it consumes only module declarations.
// ---------------------------------------------------------------------------

import { isDerived, isPlannerSupplied, type Field } from "../schema/fields.js";
import { lineIssueLabel, lineIssuePath, parseLineIssuePath } from "../validate/instance.js";
import type { ModuleSchema } from "../schema/module.js";
import type { PushLineMapping } from "../schema/lifecycle.js";
import { linePathOf } from "../normalize/query.js";

/**
 * One reference relation: the `field` of the `from` module points at the `to` module.
 *
 * The direction is always **the side that holds the field → the side that is pointed at**. A so-called "reverse relation" is not another relation;
 * it is the same edge seen from the other end — so there is one type, and no split into InboundRelation / OutboundRelation.
 */
export interface Relation {
  /** Module code that holds the ref field. */
  readonly from: string;
  readonly fromLabel: string;
  /** Module code that is pointed at. */
  readonly to: string;
  /** Key of the ref field. In a line-level relation this is the key of the **line column**. */
  readonly field: string;
  readonly fieldLabel: string;
  /**
   * Which layer on **this side** the relation hangs on.
   *
   * `bill` is a header field — reverse lookup is an ordinary list query (`where field eq id`).
   * `line` is a line-table column — reverse lookup uses a **line condition** (compiled to an `exists` subquery), and what comes back is still
   * a header row: the user wants "which deliveries", not "which lines".
   *
   * Whether it can be reverse-looked-up is `toLevel`, not this dimension — see `isReverseQueryable`.
   */
  readonly via: "bill" | "line";
  /**
   * Whether it points at **a bill** or **a line** on the other side.
   *
   * `bill` — `type:'ref'`, and the value is the id of the other header.
   * `line` — `type:'refLine'`, and the value is the id of a **line** on the other side, on the line table `toThrough`.
   *
   * This dimension must not be merged with `via`. They are layers in two directions: a delivery line pointing at an order line is
   * `via:'line' + toLevel:'line'`, and a delivery line pointing at an order header is `via:'line' + toLevel:'bill'`.
   * Both exist on the same bill, and only the latter can be reverse-looked-up from the order detail page (the former's right-hand value is a line id,
   * not the current bill's id) — collapsing them into one dimension would compare a line id with a bill id and produce a panel that is always empty.
   */
  readonly toLevel: "bill" | "line";
  /** When toLevel==='line', the field key of the line table on the other side (`refLine.through`); otherwise null. */
  readonly toThrough: string | null;
  /** When via==='line', the subtable field it belongs to (`lines`); null for a header relation. */
  readonly through: string | null;
  readonly throughLabel: string | null;
}

/**
 * Every relation of one module in both directions.
 *
 * `outbound` links fields on the detail page; `inbound` feeds the "related bills" panel.
 */
export interface ModuleRelations {
  readonly module: string;
  /** Relations this module points outward (including line level). */
  readonly outbound: readonly Relation[];
  /** Relations others point at this module (including line level). */
  readonly inbound: readonly Relation[];
}

/**
 * Whether a relation can be reverse-looked-up as a list query.
 *
 * The rule is `toLevel`, not `via`: the right-hand value of a reverse lookup is **the id of the bill on the current detail page**, so only
 * an edge that points at a header can match. An edge with `toLevel:'line'` (delivery line → order line) stores a **line id**,
 * comparing it with a bill id matches nothing, and the result is a panel that is always empty, which looks like "no downstream".
 *
 * `via:'line' + toLevel:'bill'` (the `orderId` on a delivery line) **can** be reverse-looked-up. That is the whole basis on which a merged delivery
 * can grow a "related bills" panel on the order detail page: after the merge the header no longer has `orderId`,
 * and the only declaration-level path is the one on the line. It compiles to an `exists` subquery and does not rely on `oe_reference` —
 * that table exists only when a push ran, so a merged bill built by hand would display as "this order has no downstream".
 */
export function isReverseQueryable(relation: Relation): boolean {
  return relation.toLevel === "bill";
}

/**
 * Which **field name** the condition hangs on when reverse-looking-up this inbound edge.
 *
 * The field name of a line-level reference (`via:'line'`) is not `orderId`; it is `lines.orderId`: that key lives on
 * the **line table**, and the header does not have it at all. Missing this layer does not look like an empty panel; it is a 400
 * — `module "salesDelivery" has no field "orderId"` — the relation is right and the query language accepts it
 * (`parseLinePath` → `exists` subquery). Only this one projection was wrong.
 *
 * It lives here rather than being assembled by each consumer: the panel's fetch, the address "view all" jumps to, and the
 * relation description a CLI/agent receives must be **the same** field name. Assembling them separately, the lightest symptom is that the panel can query and the link cannot,
 * and neither side errors — the same discipline as `isReverseQueryable`: whether it can be reverse-looked-up, and how, are
 * properties of the relation, not inferences of each consumer.
 *
 * An edge that cannot be reverse-looked-up throws: the caller should have asked `isReverseQueryable` first. Inventing a field name for it
 * (for example comparing a `refLine` line id with a bill id) produces a panel that is always empty,
 * and an empty panel is read as "this bill has no downstream".
 */
export function reverseQueryFieldOf(relation: Relation): string {
  if (!isReverseQueryable(relation)) {
    throw new Error(
      `relations: ${relation.from}.${relation.field} cannot be reverse-looked-up (toLevel=${relation.toLevel}); there is no usable query field name` +
        ` — it stores a line id, which cannot be compared with a bill id`,
    );
  }
  // How the path is joined is said by `linePathOf`. Do not assemble the string here: it and `parseLinePath` are
  // two sides of the same shape, and the filter panel's line candidates assemble that same one.
  return relation.through === null ? relation.field : linePathOf(relation.through, relation.field);
}

/**
 * Whether this field's value can point at another record. **Two kinds, and both rules are in the declaration**:
 *
 *   `type:'ref'`            the value itself is the id of the target record
 *   `derive.kind:'lookup'`  the value is **display text brought across** (order number, customer name),
 *                           and the id is on the ref field that `derive.match` names
 *
 * The second kind must be counted. Missing it produces an awkward screen: "order number SO-2026-0007" on a delivery
 * is clearly that order but cannot be clicked, while the field next to it, derived from **the same relation**, is live —
 * a user will not think the two differ, because they do not.
 *
 * It lives here rather than being judged by each consumer: the place that renders the link and the place that computes the address must use the same rule.
 * Two copies produce "some fields render as links but cannot compute an address", and then throw on the spot.
 */
export function isLinkableField(field: Field): boolean {
  return field.type === "ref" || (field.derive !== null && field.derive.kind === "lookup");
}

// ── Push: can this cell on the target be filled from the source bill ──

/**
 * Whether a target field can be **filled automatically** from the source bill on push. Four paths; missing all of them means it cannot be filled:
 *
 *   1. System-supplied (derive / auto / lineAgg / the header companion ref of a refLine) — the framework fills it
 *   2. An ordinary `ref` pointing back at the source module — fill the source bill id
 *   3. A `refLine` pointing back at that line table of the source module — fill the id of the matching line
 *   4. The source bill has a non-system-supplied field with the **same key, type, and ref** — carry the value;
 *      when a line column wrote an explicit `pushFrom` and the source line has no such cell, fall back to the source header
 *      (a material requirement's required date is a fact of the whole bill, and a purchase-plan line's arrival date must carry that day)
 *
 * There is only one rule, shared by two places: `buildPushDraft` (it really fills) and
 * `PUSH_TARGET_REQUIRED_UNFILLABLE` (the offline gate, which asks "can the required cells be filled").
 * Two copies were observed to fail — the gate said fine, and the first click of "ship" at runtime was a 400
 * (`REQUIRED_BLANK`: `deliveryDate` on the target is required, and the source bill has no such field).
 * Unit tests stayed green because the stub repository's create does not run the value gate.
 *
 * `primary` is judged on its own: a bill number belongs to each bill (`auto` already covers it, so it is not repeated here).
 */
export function isPushFillable(
  source: ModuleSchema,
  target: Field,
  /** The line table the target field is on; pass null for a header field. The line-level reference rule needs it. */
  targetTable: Field | null,
  /** The same rule as `isSystemSupplied`, injected by the caller so the kernel does not import itself in a cycle. */
  systemSupplied: (field: Field) => boolean,
  line: PushLineMapping | null = null,
): boolean {
  // plannerSupplied has no default path of "copy because the name happens to match"; only an explicit pushFrom
  // is a real source that may be copied automatically. This one rule is used by the executor, the completeness gate, and
  // the pushDefaults conflict gate, so one side does not say it can copy while the other side does not.
  if (isPlannerSupplied(target) && target.pushFrom === null) return false;
  if (!isPlannerSupplied(target) && systemSupplied(target)) return true;
  if (target.type === "ref" && target.ref === source.code) return true;

  // The matching layer on the source bill: when the target is on a line table, the paired source line table is said by `refLine.through`.
  const sourceTable = targetTable === null ? null : pushSourceTable(source, targetTable, line);
  const sourceLayer = targetTable === null ? source.fields : (sourceTable?.fields ?? null);
  if (sourceLayer === null) return false;

  if (targetTable !== null && target.type === "refLine" && target.ref === source.code) {
    // The line id is on the source line itself. `through` must name **the source line table paired this time**, or the fill is someone else's line id.
    // This used to compare `targetTable.key` (what the target table is called), and a differently named declaration was always judged "cannot be filled" —
    // and the gate and the executor read the same rule, so the offline gate went silent with them.
    return target.through === sourceTable?.key;
  }

  const from = pushSourceField(source, target, targetTable, line);
  if (!from) return false;
  // When `pushFrom` names the source explicitly, the source field **may** be derived (net price is a formula, and the value is already computed on the read path).
  // The same-key path still does not accept a derived field: that is "the name happens to match", and quietly freezing a query-time value into a downstream column
  // must not be triggered by coincidence. Only the modeler saying it explicitly may do that.
  if (target.pushFrom === null && systemSupplied(from)) return false;
  return from.type === target.type && from.ref === target.ref;
}

/**
 * Which **field object** on the source bill this target cell should read on push. `pushFrom` wins; otherwise the same key.
 *
 * It is extracted on its own because "which field" has two consumers (judging whether it is allowed, and actually reading it),
 * and they must see the same field — otherwise the gate passes on `netPrice` and the executor reads `price`.
 * Return null when it cannot be found, and let the caller decide to error or skip.
 */
/**
 * **Initial values of one source line → one target line.**
 *
 * Two consumers share this, and neither may write its own copy:
 *   · push (`buildPushDraft` in `runtime-core/src/execute/execute.ts`) — the state machine creates the downstream draft;
 *   · the manual picker (lines mode of `web/parts/ReferencePicker.tsx`) — a person picks the upstream bill first,
 *     then checks the lines to receive / return / invoice.
 *
 * The two paths **must produce the same bill**: the same order lines, pushed through "ship" or built by hand into a delivery,
 * must carry the same fields, or the ledger differs (whether net price was carried decides how much receivable is recorded),
 * while both bills look legal, pass the gates, and raise no error.
 *
 * Three kinds are not carried, for different reasons:
 *   · system-supplied columns (including the header companion ref of a `refLine`) — the framework fills them. The companion ref especially:
 *     its value is taken from `bill_id` only in the **same join** the repository uses to check that the line exists,
 *     and neither the client nor push may write it (writing it hits the key gate, 400);
 *   · columns the source line does not have (the target's own quantity and date) — leave the draft blank for a person to fill; guessing a value
 *     would make them think it is real;
 *   · same-named columns whose type / ref target does not match — the rule is `isPushFillable`, the same one as the offline gate.
 *
 * `systemSupplied` is injected by the caller (same as `isPushFillable`, to avoid an import cycle inside the kernel).
 */
export function pushLineValues(
  source: ModuleSchema,
  /** The line-table field on the target module (`type: 'subtable'`). */
  targetTable: Field,
  /** Source bill id: an ordinary `ref` on the target line that points back at the source module is filled with it. */
  sourceBillId: string,
  /** One line of the source bill. `id` is a platform field, and `refLine` takes it directly. */
  sourceRow: Readonly<Record<string, unknown>>,
  systemSupplied: (field: Field, siblings?: readonly Field[]) => boolean,
  line: PushLineMapping | null = null,
  /**
   * Source bill header. An explicit `pushFrom` on a line column falls back here when it reads the header.
   * Omit it and the value is not carried — if the manual picker has no header at that moment, leave the cell blank. Do not impersonate it with a same-named value that happens to sit on the line.
   */
  sourceHeader: Readonly<Record<string, unknown>> | null = null,
): Record<string, unknown> {
  const columns = targetTable.fields ?? [];
  const out: Record<string, unknown> = {};
  for (const column of columns) {
    // The header companion ref of a refLine on the same line is system-supplied too. The draft carries only the refLine,
    // and the repository fills the companion column from that same line's bill_id inside the existence query. The client has no second input.
    if (systemSupplied(column, columns)) continue;

    // An ordinary line-level ref (a business reference with no refLine partner) is still carried as the source bill id.
    // A header companion ref that has a refLine partner was already skipped by the system-supplied rule above.
    //
    // `pushFrom === null` is part of the rule, the same shape character for character as the header side (`buildPushDraft`):
    // **derivation is the default, and a declaration is the decision**. "Points back at the source module ⇒ fill the source bill id" is a default guessed from the one sentence `ref`;
    // `pushFrom` is the source the modeler said explicitly. Without this condition, a second
    // ref on the same line table that points back at the source module (the one with `pushFrom`) would be unconditionally overwritten with the source bill id, and that declaration would be dead,
    // while both cells are legal bill ids ⇒ nowhere would error.
    if (column.type === "ref" && column.ref === source.code && column.pushFrom === null) {
      out[column.key] = sourceBillId;
      continue;
    }

    // A source-line reference on the line takes the source line's own id directly, not a lookup by index — index pairing is only for writing
    // `oe_reference`, and that step happens after persistence.
    // Same as above: an explicit `pushFrom` does not take this derivation — the modeler said "this cell comes from that column of the source line",
    // not "this cell is the source line itself" (both are line ids, so overwriting the wrong one is still legal).
    if (column.type === "refLine" && column.ref === source.code && column.pushFrom === null) {
      // Which source line table is paired is answered only by `pushSourceTable` (the rule is `column.through`,
      // not "the two sides happen to share a name"); if it cannot point, it throws there, and this does not judge again.
      pushSourceTable(source, targetTable, line);
      const lineId = sourceRow["id"];
      if (typeof lineId === "string" && lineId) out[column.key] = lineId;
      continue;
    }

    // Carrying a same-named value uses the same kernel rule (clause 4 of `isPushFillable`),
    // shared with the offline gate — a gate that passes while this cannot carry the value shows up as a runtime 400.
    if (!isPushFillable(source, column, targetTable, systemSupplied, line)) continue;
    const from = pushSourceField(source, column, targetTable, line);
    if (!from) continue;
    // Read the **source field**'s key (under `pushFrom` it is not the same name as the target key).
    // Reading by the target key would silently get undefined for a renamed carry ⇒ that cell stays empty,
    // and an empty unit price computes an amount of 0: the receivable under-records a whole bill, and every check stays legal.
    const lineLayer = pushSourceTable(source, targetTable, line)?.fields ?? [];
    const onLine = lineLayer.some((field) => field.key === from.key);
    const value = onLine ? sourceRow[from.key] : sourceHeader?.[from.key];
    if (value === undefined || value === null) continue;
    out[column.key] = value;
  }
  return out;
}

export function pushSourceField(
  source: ModuleSchema,
  target: Field,
  targetTable: Field | null,
  line: PushLineMapping | null = null,
): Field | null {
  const key = target.pushFrom ?? target.key;
  if (targetTable === null) {
    return source.fields.find((field) => field.key === key) ?? null;
  }
  const lineLayer = pushSourceTable(source, targetTable, line)?.fields ?? null;
  if (lineLayer === null) return null;
  const fromLine = lineLayer.find((field) => field.key === key);
  if (fromLine) return fromLine;
  // Only an explicit pushFrom may fall back to the header: a name that happens to match must not spread a header fact onto every line.
  if (target.pushFrom !== null) {
    return source.fields.find((field) => field.key === target.pushFrom) ?? null;
  }
  return null;
}

/**
 * **Which line table of the source bill the rows of this target line table come from.**
 *
 * The rule is the **explicit declaration** `refLine.through`, not "the two line tables happen to share a name".
 *
 * Four places used to each guess by name (`isPushFillable` / `pushSourceField` / `pushLineValues` /
 * the server's `buildPushDraft`). When the names matched, all four guessed right together; when they differed, all four missed together —
 * `find` returned `undefined`, so **the whole line table carried no column** (not "one cell short").
 *
 * **The declaration-layer gate exists. Runtime simply used the wrong key.**
 * The refLine section of `loader/src/index.ts` already checks at build time that "the table `through` names exists on the target
 * module and really is a line table". So by the time execution reaches here `through` can be pointed at; if it cannot, the module table
 * was loaded by bypassing the loader ⇒ throw, and do not return `null` for the caller to skip as "this table has no counterpart".
 *
 * The repo has three differently named declarations today, all `required: true`:
 *   · `productionTask.allocations.sourceOrderLineId` ← `productionOrder.lines`
 *   · `subcontractIssue.materialLines.orderLineId` ← `subcontractOrder.lines`
 *   · `subcontractMaterialReturn.materialLines.orderLineId` ← `subcontractOrder.lines`
 * None of the three has a `push` edge pointing at it, so only the **manual picker** path reaches them — a person picks the upstream bill,
 * checks the lines, and not one cell is filled, while `refLine` and its companion `ref` must both be required according to `createBlockersOf`
 * ⇒ that bill **cannot be stored structurally**, the failure happens after the user has finished filling, and nowhere can say
 * "these cells should have been carried from upstream". Edges that go through `push` are mostly same-named on both sides today, so they stayed green —
 * **testing only the same-named case is the same as not testing.**
 *
 * When no refLine points back at the source module, fall back to the same name: in that case **no declaration** says the pairing, and the same name is the only
 * convention left (`salesOrder → productionOrder.lines` is this kind). Not finding the same name means there really is no counterpart table.
 * Return `null` and let the caller skip.
 */
/**
 * One coordinate on the target draft, **mapped back to that cell on the source bill**.
 *
 * Why it exists (F-03 of S1): when a status-edge push fails, `issues[].path` reports a coordinate of the **target module**
 * (`lines[0].productId` means a line of the target bill), while the user is standing on the **source bill** page — that cell
 * does not exist in front of them, cannot be marked red, and cannot be changed. They are told "pick another one", and they have no such dropdown.
 *
 * The mapping reads only the same pairing after normalization: an object push's `line` wins; an old string push keeps deriving from the existing declaration:
 *   · lines: `buildPushDraft` / `pushLineValues` copy row by row **by index** (`lineLink` writes
 *     `oe_reference` that way), so target row i ↔ source row i; which table is said by `pushSourceTable`;
 *   · which source column that column comes from is said by `pushSourceField` (`pushFrom` first, otherwise the same name) —
 *     the **same function** used when the value is really copied, not "a second copy that looks the same". Without this,
 *     a renamed carry (`pushFrom`) would be mapped onto a key that does not exist on the source bill,
 *     and the symptom would still be "cannot mark it red", only for a different reason.
 *
 * Headers have the same shape (`pushSourceField(source, field, null)`).
 *
 * **Return `null` when it cannot be mapped**, and let the caller explicitly say "this cell points at no position on this bill" —
 * quietly falling back to the target coordinate does nothing, which is F-03 itself.
 * Being unable to map is a **real tier**: cells fixed by `pushDefaults`, and the target's own quantity and date,
 * really have no corresponding cell on the source bill.
 */
export function pushSourceIssueCoordinate(
  source: ModuleSchema,
  target: ModuleSchema,
  targetPath: string,
  lineMapping: PushLineMapping | null = null,
): { readonly path: string; readonly label: string } | null {
  const line = parseLineIssuePath(targetPath);
  if (line === null) {
    const field = target.fields.find((f) => f.key === targetPath);
    if (!field) return null;
    if (isPlannerSupplied(field)) return null;
    const from = pushSourceField(source, field, null);
    return from ? { path: from.key, label: from.label } : null;
  }
  const targetTable = target.fields.find((f) => f.key === line.table && f.type === "subtable");
  if (!targetTable) return null;
  const sourceTable = pushSourceTable(source, targetTable, lineMapping);
  if (!sourceTable) return null;
  const column = (targetTable.fields ?? []).find((c) => c.key === line.field);
  if (!column) return null;
  if (isPlannerSupplied(column)) return null;
  const from = pushSourceField(source, column, targetTable, lineMapping);
  if (!from) return null;
  const onLine = (sourceTable.fields ?? []).some((field) => field.key === from.key);
  if (!onLine) return { path: from.key, label: from.label };
  return {
    path: lineIssuePath(sourceTable.key, line.index, from.key),
    label: lineIssueLabel(sourceTable.label, line.index, from.label),
  };
}

export function pushSourceTable(
  source: ModuleSchema,
  targetTable: Field,
  line: PushLineMapping | null = null,
): Field | null {
  if (line !== null) {
    if (targetTable.key !== line.target) return null;
    const incompatible = (targetTable.fields ?? []).find((field) =>
      field.type === "refLine" && field.ref === source.code && field.through !== line.source
    );
    if (incompatible) {
      throw new Error(
        `relations: push.line.source "${line.source}" does not match ` +
          `refLine.through "${String(incompatible.through)}" of ${targetTable.key}.${incompatible.key} (the build-time gate should have stopped it)`,
      );
    }
    const hit = source.fields.find((field) => field.key === line.source && field.type === "subtable");
    if (!hit) {
      throw new Error(
        `relations: ${source.code} has no line table "${line.source}" — ` +
          `push.line.source does not point at any line table of the source module (the build-time gate should have stopped it)`,
      );
    }
    return hit;
  }
  const link = (targetTable.fields ?? []).find((c) => c.type === "refLine" && c.ref === source.code);
  if (link) {
    const hit = source.fields.find((f) => f.key === link.through && f.type === "subtable");
    if (!hit) {
      throw new Error(
        `relations: ${source.code} has no line table "${String(link.through)}" — ` +
          `the refLine coordinate of ${link.key} does not point at any line table of the source module (the build-time gate should have stopped it)`,
      );
    }
    return hit;
  }
  return source.fields.find((f) => f.key === targetTable.key && f.type === "subtable") ?? null;
}

/**
 * Flatten every ref field of a module (header, plus one level of line columns).
 *
 * Only `type === 'ref'` and `type === 'refLine'` count. A `subtable` field also carries `ref`, but that is **the line table's table name**
 * (`salesDeliveryLine`), not a module code — treating it as a relation would immediately point at a module that does not exist.
 *
 * **A derived ref (`derive`) is not a relation edge and is not projected.**
 *
 * The rule is "who decided this value": `type:'ref'` is **chosen by the user** (which warehouse this bill ships from),
 * while the value of `derive:{kind:'lookup'}` is **a copy computed from another field** —
 * the real body of `salesDelivery.lines.orderWarehouseId` is `salesOrder.warehouseId`,
 * and the delivery itself never chose that warehouse. Counting the copy in "who points at me" counts the same reference twice.
 *
 * The same rule already holds on the render side: when `fieldHref` computes a link for a derived lookup it follows
 * the ref field that `derive.match` names (clicking the `orderWarehouseId` cell opens the **sales order**,
 * not the warehouse) — that cell was never an edge pointing at warehouse.
 *
 * Three consequences; miss one and this rule was written for nothing:
 *   · reverse lookup (`inbound`) — a derived field **never creates a column** (see `hasColumn`), so reverse-looking it up is
 *     looking up a column that does not exist. The observed consequence is not an empty panel but the whole path collapsing: delete protection
 *     (`assertRemovable` of `billRepo`) reaches this edge, cannot get a column, and `fail()`s,
 *     so **a module pointed at by a derived ref structurally cannot delete any record**, not even a brand-new
 *     warehouse with no downstream — and the error text says "no reference column",
 *     which reads like an internal inconsistency, with nothing pointing at a `derive` declaration.
 *   · the detail page's reverse-lookup panel loses a duplicate panel sitting next to the real one (the panel derived from this module's `warehouseId`
 *     is the real one).
 *   · outbound edges are the same: that is not a reference this module holds; it is display value it brought across.
 *
 * **`snapshot` is not in this exclusion**: a frozen value **has a column**, and after freezing it has no further relation to the source,
 * so it is the reference this record itself holds — deleting the target leaves dangling history, and reverse lookup can find it.
 * Both are "system-supplied", but `isSystemSupplied` is the wrong rule here (it would swallow snapshot too).
 *
 * Whether the target module exists is still checked: that hop is `checkCrossReferences` in the `loader`, at **build time**,
 * field by field on `field.ref` (it does not look at `derive`), and it does not depend on this projection.
 */
function refFieldsOf(module: ModuleSchema): readonly Relation[] {
  const out: Relation[] = [];

  const push = (field: Field, through: Field | null): void => {
    if (field.type !== "ref" && field.type !== "refLine") return;
    if (isDerived(field)) return;
    if (field.ref === null) {
      // normalizeField already blocked this. Block it again because this function may also be fed a module object from somewhere else.
      throw new Error(`relations: ${module.code}.${field.key} is ${field.type} but names no target entity`);
    }
    if (field.type === "refLine" && field.through === null) {
      throw new Error(`relations: ${module.code}.${field.key} is a refLine but does not say which line table on the other side it points at`);
    }
    out.push({
      from: module.code,
      fromLabel: module.label,
      to: field.ref,
      field: field.key,
      fieldLabel: field.label,
      via: through === null ? "bill" : "line",
      toLevel: field.type === "refLine" ? "line" : "bill",
      toThrough: field.through,
      through: through?.key ?? null,
      throughLabel: through?.label ?? null,
    });
  };

  for (const field of module.fields) {
    push(field, null);
    // Lines have only one level, so this drills only one level — `fields` cannot contain another subtable.
    for (const column of field.fields ?? []) push(column, field);
  }
  return out;
}

/**
 * Modules in this module table that a non-derived ref / refLine points at.
 * An edge whose target is not in the table is not counted; a dangling ref on the product catalog is rejected by the loader's `checkCrossReferences`.
 */
export function referencedModuleCodes(modules: readonly ModuleSchema[]): ReadonlySet<string> {
  const known = new Set(modules.map((module) => module.code));
  const referenced = new Set<string>();
  for (const relation of modules.flatMap(refFieldsOf)) {
    if (known.has(relation.to)) referenced.add(relation.to);
  }
  return referenced;
}

/**
 * Compute one module's relation graph.
 *
 * `modules` must be the **whole module table**: a reverse relation is defined as "scan every module", and passing a subset
 * produces a result that looks normal and is actually missing edges.
 *
 * A ref that points at an unknown module throws and is not skipped. `checkCrossReferences` in `yarn test`
 * should have stopped it first; reaching here means the module table is partial, and skipping silently would drop a panel
 * and a link from the detail page, with nowhere reporting an error.
 */
export function relationsOf(modules: readonly ModuleSchema[], code: string): ModuleRelations {
  const known = new Set(modules.map((m) => m.code));
  if (!known.has(code)) {
    throw new Error(`relations: the module table has no "${code}" — known: ${[...known].join(" / ") || "(none)"}`);
  }

  const all = modules.flatMap(refFieldsOf);
  for (const r of all) {
    if (!known.has(r.to)) {
      throw new Error(`relations: ${r.from}.${r.field} points at an unknown module "${r.to}" — the module table is partial, or the ref is wrong`);
    }
  }

  return {
    module: code,
    outbound: all.filter((r) => r.from === code),
    // A self-reference (a module pointing at itself, such as "parent account") is in both directions: it really is both an outbound and an inbound edge.
    inbound: all.filter((r) => r.to === code),
  };
}
