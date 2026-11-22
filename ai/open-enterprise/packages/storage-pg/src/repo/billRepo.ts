// ---------------------------------------------------------------------------
// Document repository — reads and writes of the header + lines.
//
// 🔴 The first thing every method does is `requireIdentity` (via moduleScopedWhere / scopedValues),
// because the connection uses the database owner account and does not go through RLS: this layer is the only isolation line.
// Any query that did not pass through the scope wrapper is a security hole, not a style issue.
//
// A module table goes through `moduleScopedWhere` by default (tenant × data scope).
// `refLabels` / `refLineLabels` are a narrow exit of the same kind as `tenantInvariant`: they bind only the tenant (`scopedWhere`).
// They may be consumed only for echo-back. The id must come from a host row the server already read within scope. Do not use them to read a list, candidates, or a detail.
// A line table is reached through the header by default, and that header read already judged the scope.
//
// This layer **makes no business judgment**: it does not check preconditions, compute buttons, or write the ledger. It is only responsible for
// "reading and writing this table within scope". Judgment is in the kernel, and orchestration is in the executor — mixing them in
// would give the one write path evaluate → execute a bypass.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { asc, and, eq, getTableColumns, gt, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  isCustomFieldKey,
  ANALYSIS_SQL_MAX_ROWS,
  assertNoSystemSuppliedWrites,
  applyCreateDefaults,
  attachmentSitesOf,
  chainedRefSitesOf,
  checkBillPatch,
  checkGeneratedBill,
  checkGeneratedHeader,
  checkNewBill,
  coerceWriteValue,
  classifyWriteEnvelope,
  computeLineAggregates,
  createFromEligibilitySitesOf,
  fieldPermissionKey,
  isEmptyValue,
  isPlatformField,
  isPlannerSupplied,
  labelFieldsOf,
  referenceLabelSeparator,
  isSystemSupplied,
  isWriteEnvelopeIgnoredKey,
  omitMatchingSystemWriteKeys,
  lineIssueLabel,
  lineIssuePath,
  missingOptionalSnapshotValues,
  recheckRefSiteFilters,
  occupancyAuditBlocksRemoval,
  occupancyOf,
  relationsOf,
  refPreselectSitesOf,
  refSitesOf,
  resolveUnitChoice,
  SchemaError,
  unitChoiceIdentitiesOf,
  snapshotSourceGuarantee,
  statusWriteFieldsOf,
  statusWritePlan,
  statusWriteCoordinateKeys,
  type StatusWritePlan,
  uniqueDefaultWithinOf,
  summaryKey,
  transitionsReaching,
  unacceptableWriteKeys,
  uniqueSitesOf,
  type BillIssue,
  type CreateFromEligibilitySite,
  type Field,
  type LineRows,
  type ModuleSchema,
  isNumericFieldType,
  type Query,
  type RefFilterCondition,
  type RefPreselectSite,
  type RefSite,
  type SummarySpec,
  type UniqueSite,
} from "@open-erp/metamodel";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { BillInvalidError, BillNotFoundError, RepoError, StaleRevisionError, isKeyOwnedBy } from "@open-erp/runtime-core";
import {
  auditLog,
  effectLedger,
  handoffTask,
  reference,
  stagedAction,
} from "../db/framework.js";
import { ConcurrencyConflictError, guardConcurrency, guardWrite } from "./pgError.js";
import { assignAutoNumbers } from "./numbering.js";
import { materializeStoredCalculations } from "./materialize.js";
import { lineLabelOf, requireIdentity, type Identity } from "@open-erp/runtime-core";
import {
  compileAggregates,
  compileInvariantSummaryQuery,
  compileQuery,
  compileRefFilter,
  compileSearchPhrase,
  failedRefFilterConditions,
  refFilterColumnsOf,
  refFilterMatches,
  headerScope,
  lineScope,
  moduleScopedWhere,
  projection,
  resolveOperandum,
  type LineTable,
  type ModuleRegistry,
  type ModuleTables,
} from "./queryCompiler.js";
import type {
  BillGetNamedLines,
  BillRecord,
  BillRepo,
  BillWriteLockRequest,
  InvariantSummaryResult,
  PageResult,
  RefLineOptionsPage,
  RefOptionsPage,
} from "@open-erp/runtime-core";
import type { Executor } from "./support.js";
import { assertChoiceSetWrite } from "./choiceSetRepo.js";
import type { RuntimeChoiceSet } from "@open-erp/runtime-core";

function fail(message: string, apiHint: string | null = null): never {
  throw new RepoError(message, apiHint);
}

/**
 * "This document is not here" — **two audiences, one judgment**.
 *
 * 🔴 "Cannot see it" and "does not exist" are deliberately one sentence: saying them apart tells the caller
 * "it exists, you just have no permission", which is a probe that can enumerate someone else's data.
 *
 * The human sentence has **no bare uuid and no API usage**: the user has no concept of "internal id",
 * and the id is already in the address they are on; the only thing they must judge is "is this document still here / is it not mine to see".
 * The agent half keeps every coordinate and usage (see `RepoError.apiHint`).
 *
 * The two call sites (`readHeaderRow` / `readOne`) share this one copy: writing it twice looks like
 * the same "not found" saying two different sentences on the read-header path and the read-whole-document path, and neither side errors.
 */
export function billNotFoundError(label: string, module: string, id: string): BillNotFoundError {
  // The type is separate (it is still a RepoError): a write entrance that brought the revision it saw uses this to treat "cannot read it" as "deleted after it was opened".
  return new BillNotFoundError(
    module,
    id,
    `this "${label}" was not found — it may already have been deleted, or it is outside your view.`,
    `coordinate this time: module "${module}", id "${id}". ` +
      `If this value is actually a **document number** (code) rather than the internal id, look up the id by the number first` +
      ` (write the list condition as code eq that number), and do not retry with a different module.`,
  );
}

function billNotFound(label: string, module: string, id: string): never {
  throw billNotFoundError(label, module, id);
}

/**
 * "This document cannot be deleted" — **two audiences, one judgment**, the same rule as `billNotFoundError`.
 *
 * 🔴 Not one word of behavior changes (a document with downstream or history must not be deleted; that is a hard boundary); only **how it is said** changes.
 * The old sentence `delete "salesDelivery" #<uuid>: push-down lineage has already formed, and history cannot be rewritten by deletion`
 * was written for insiders in four places: the module code (a user does not recognize `salesDelivery`), a bare uuid,
 * internal jargon ("push-down lineage"), and **no next step**. And on the demo path every issue-document draft comes from push-down
 * ⇒ the draft's `editable` is `full`, the delete button is present ⇒ one click recites this sentence.
 *
 * 🔴 **Both refusal branches share this one constructor** (the framework-fact branch and the reference-graph branch, thirty lines apart in the same function):
 * each assembling its own sentence means next time someone changes only one, while the two look identical on the screen — the user cannot read
 * "these are two different criteria", and only reads "this system speaks well sometimes and badly sometimes".
 *
 * @param what   The subject in human wording, a **module label** ("sales delivery"), not the code
 * @param why    Why it cannot be deleted (human wording, no internal words)
 * @param next   What to do next. 🔴 A refusal with no next step leaves the user where they are
 * @param where  The exact coordinate the agent side needs (module code, id, the edge or table that hit)
 */
export function billNotRemovableError(what: string, why: string, next: string, where: string): RepoError {
  return new RepoError(`this "${what}" ${why}, and cannot be deleted — ${next}`, `coordinate this time: ${where}.`);
}

function billNotRemovable(what: string, why: string, next: string, where: string): never {
  throw billNotRemovableError(what, why, next, where);
}

type Row = Record<string, unknown>;

/** Writable fields: exclude derived ones (computed by the framework) and line tables (they go through the lines parameter). */
function writableKeys(schema: ModuleSchema, channel: "user" | "planner" = "user"): ReadonlySet<string> {
  return new Set(
    schema.fields
      .filter(
        (field) =>
          (!isSystemSupplied(field, schema.fields) || (channel === "planner" && isPlannerSupplied(field))) &&
          field.type !== "subtable",
      )
      .map((field) => field.key),
  );
}

function subtableFields(schema: ModuleSchema): readonly Field[] {
  return schema.fields.filter((f) => f.type === "subtable");
}

/**
 * Line totals of this write that must be stored (`lineAgg` fields).
 *
 * 🔴 **This is the only guarantee of lineAgg consistency.** Once the total is stored in a column, consistency is no longer given for free by "not storing a column" —
 * the obligation in exchange is: **every path that can change lines must recompute the total in the same transaction**. This repository's
 * `create` / `save` are where that obligation is met, and the seed path meets the same copy itself (`server/seed.ts`).
 * Missing one path does not error; the header total stays forever one value behind the lines.
 *
 * 🔴 Compute only the line tables **this write really replaced**. When a module has two line tables and this write changes only one,
 * treating the other as "zero rows" silently clears its total — the column is left with a completely legal 0.
 * (`computeLineAggregates`'s "missing key = zero rows" is the meaning for create, when the whole table is new.)
 */
function lineTotals(schema: ModuleSchema, lines: LineRows, what: string): Row {
  const all = computeLineAggregates(schema.fields, lines, what);
  const out: Row = {};
  for (const field of schema.fields) {
    const spec = field.lineAgg;
    if (!spec || !Object.hasOwn(lines, spec.of)) continue;
    out[field.key] = all[field.key];
  }
  return out;
}

/**
 * Header projection: platform columns + declared fields that have a column + expressions of derived fields.
 *
 * 🔴 tenantId is not returned to the caller: it is the isolation axis, not business data, and returning it only tempts the layer above to use it as a condition.
 * Inside the scope it is always the current tenant, so a rule that uses it as a criterion never held, and dropping it loses no expressive power.
 *
 * 🔴 orgId **cannot be dropped with it**: this projection is also the rule engine's input (`evaluate` treats the header as
 * `$bill` as-is), and `$bill.orgId` is a business criterion the kernel allows (`validate` recognizes it by `isPlatformField`).
 * After dropping it, a precondition that judges by owning organization receives undefined, and the comparison never holds —
 * it looks like "the business configured the rule too strictly", and nobody suspects a field was not read.
 * To keep orgId out of the HTTP response, cut it at the response boundary, not here where the rule would go blind with it.
 */
function headerSelection(registry: ModuleRegistry, tables: ModuleTables): Record<string, PgColumn | SQL> {
  // revision is the repository's concurrency token, not a business field. Neither rules nor ref labels should treat it as a cell of the header;
  // `readOne` projects it alone at the top of the record, and `list` projects it alone on the row.
  return projection(registry, headerScope(tables), { skipKeys: ["tenantId", "revision"] });
}

/** Line projection: id + lineNo + declared fields that have a column + derived fields on the row. */
function lineSelection(registry: ModuleRegistry, tables: ModuleTables, field: Field): Record<string, PgColumn | SQL> {
  return projection(registry, lineScope(tables, field), { skipKeys: ["tenantId"] });
}

/** A write refusal uses the real field wording; an unknown key has no declared label, so it states a contract problem and does not guess a name. */
export function writeKeyRejectionMessages(fields: readonly Field[], keys: readonly string[]): readonly string[] {
  return keys.map(key => {
    const field = fields.find(f => f.key === key);
    if (!field) return "the submission contains a field this form does not have; ask the assistant to rearrange it";
    if (field.snapshot) return `"${field.label}" is brought in automatically from the related record; do not fill it in by hand`;
    if (field.derive) return `"${field.label}" is computed by the system; do not fill it in by hand`;
    if (field.auto) return `"${field.label}" is generated automatically by the system; do not fill it in by hand`;
    return `"${field.label}" is filled in by the system; do not fill it in by hand`;
  });
}

/** Header write values: platform fields are always filled by this layer, and what the caller passed does not count. */
function headerWrite(
  schema: ModuleSchema,
  patch: Readonly<Record<string, unknown>>,
  what: string,
  channel: "user" | "planner" = "user",
  stored: Readonly<Record<string, unknown>> | null = null,
): Row {
  const classified = classifyWriteEnvelope(schema.fields, patch, channel, stored);
  if (classified.conflicts.length) {
    fail(`${what}: ${classified.conflicts.map((item) => item.message).join("; ")}`);
  }
  const matching = new Set(classified.ignored.map((item) => item.key));
  const writable = writableKeys(schema, channel);
  const declared = new Map(schema.fields.map((field) => [field.key, field]));
  const out: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    // Platform / row-structure keys: not a refusal, they **do not count** — the same criterion as authorizer.assertWritePayload.
    if (isWriteEnvelopeIgnoredKey(key)) continue;
    if (!writable.has(key) && !matching.has(key)) continue;
    const field = declared.get(key);
    out[key] = field ? coerceWriteValue(field, value) : value;
  }
  // 🔴 "Which keys are not accepted" is not judged here: the criterion is the kernel's `unacceptableWriteKeys`,
  // and the Planner's preview gate (`assertPlanTargets`) reads the same copy. Judging separately looks like
  // **preview all green, execution rolls the whole group back** (see the measured record on that function).
  const unknownKeys = unacceptableWriteKeys(schema.fields, patch, "header", channel, stored);
  if (unknownKeys.length) {
    // "Undeclared, a line table, or computed by the system" is one of three, and this **knows which**. The line-table grade is said
    // on its own because it is the only grade where "the values are all right, they are just in the wrong pocket" — the reader's next step (including the model's)
    // is to move them, not to delete and start over (KDocs#143).
    const subtables = new Set(
      schema.fields.filter((field) => field.type === "subtable").map((field) => field.key),
    );
    const misplaced = unknownKeys.filter((key) => subtables.has(key));
    const rest = unknownKeys.filter((key) => !subtables.has(key));
    const parts = [
      ...(misplaced.length ? [`"${misplaced.map(key => declared.get(key)?.label).join(", ")}" must be submitted as lines, and cannot be placed on the header; ask the assistant to rearrange it`] : []),
    ];
    parts.push(...writeKeyRejectionMessages(schema.fields, rest));
    fail(`"${schema.label}": ${parts.join("; ")}`);
  }
  // A derived field is refused even when it appears outside unknownKeys, and the error must be able to say "why it cannot be written".
  assertNoSystemSuppliedWrites(schema.fields, omitMatchingSystemWriteKeys(schema.fields, patch, channel, stored), channel);
  return out;
}

/**
 * A custom field has no column of its own: the value is packed into this table's one `custom` jsonb column.
 *
 * 🔴 Folding must happen at **the moment of writing**, and must not fold inside `headerWrite`.
 * Validation, the value gate, and reference resolution all recognize a key as a "field" (`resolveRefs` projects the header onto declared fields),
 * and folding early into the undeclared key `custom` makes that step drop the whole thing — measured, `resolved.header` is empty,
 * the write silently does not take effect, and it still returns 200. So `xFoo` travels the whole way as a field, and enters the column only at the end.
 */
function customColumnValue(
  schema: ModuleSchema | null,
  row: Row,
  layer: readonly Field[] | null = null,
): { readonly rest: Row; readonly set: Record<string, unknown>; readonly drop: readonly string[] } | null {
  const set: Record<string, unknown> = {};
  const drop: string[] = [];
  const rest: Row = {};
  let touched = false;
  for (const [key, value] of Object.entries(row)) {
    if (!isCustomFieldKey(key)) {
      rest[key] = value;
      continue;
    }
    touched = true;
    // An explicit clear deletes this cell from the jsonb, and does not leave a null placeholder —
    // `custom @> '{"k":null}'` and "this cell is absent" are not the same thing in a containment match.
    if (value === null || value === undefined) drop.push(key);
    else set[key] = jsonScalar(layer ?? schema?.fields ?? null, key, value);
  }
  return touched ? { rest, set, drop } : null;
}

/**
 * What lands in jsonb is always a scalar. A date must be collected as `YYYY-MM-DD`:
 * a `Date` serialized through JSON becomes a full instant with a time zone, so "2026-09-16" in UTC+8
 * is stored as "2026-09-15T16:00:00.000Z", and an equality query by date can never find it again.
 */
function jsonScalar(fields: readonly Field[] | null, key: string, value: unknown): unknown {
  if (!(value instanceof Date)) return value;
  const field = fields?.find((f) => f.key === key);
  return field?.type === "date" ? value.toISOString().slice(0, 10) : value.toISOString();
}

function lineWrite(
  schema: ModuleSchema,
  field: Field,
  row: Readonly<Record<string, unknown>>,
  what: string,
  channel: "user" | "planner" = "user",
  stored: Readonly<Record<string, unknown>> | null = null,
): Row {
  const declared = field.fields ?? [];
  const classified = classifyWriteEnvelope(declared, row, channel, stored);
  if (classified.conflicts.length) {
    fail(`${what}: ${classified.conflicts.map((item) => item.message).join("; ")}`);
  }
  const matching = new Set(classified.ignored.map((item) => item.key));
  const writable = new Set(
    declared
      .filter((column) => !isSystemSupplied(column, declared) || (channel === "planner" && isPlannerSupplied(column)))
      .map((column) => column.key),
  );
  const out: Row = {};
  const declaredByKey = new Map(declared.map((column) => [column.key, column]));
  for (const [key, value] of Object.entries(row)) {
    // id / lineNo / billId / platform fields are filled by this layer (`isWriteEnvelopeIgnoredKey`).
    if (isWriteEnvelopeIgnoredKey(key)) continue;
    if (!writable.has(key) && !matching.has(key)) continue;
    const column = declaredByKey.get(key);
    out[key] = column ? coerceWriteValue(column, value) : value;
  }
  // Same criterion as above: one copy in the kernel, shared by the Planner preview gate and the write gate.
  const unknownKeys = unacceptableWriteKeys(declared, row, "line", channel, stored);
  if (unknownKeys.length) {
    fail(`"${schema.label}" / "${field.label}": ${writeKeyRejectionMessages(declared, unknownKeys).join("; ")}`);
  }
  assertNoSystemSuppliedWrites(declared, omitMatchingSystemWriteKeys(declared, row, channel, stored), channel);
  // `id` continues down the pipeline only as the coordinate that, on save, proves "this is still the same existing fact"; it is not
  // in writable, it does not bypass the field-key gate, and create/append still has the server generate a new id when writing.
  return Object.hasOwn(row, "id") ? { ...out, id: row["id"] } : out;
}

/** One write after normalization. Header and lines have both passed the key gate and the value gate, and can be written directly. */
interface PreparedWrite {
  readonly header: Record<string, unknown>;
  readonly lines: Record<string, readonly Record<string, unknown>[]>;
}

/**
 * The **two gates** before a write, shared by create and save.
 *
 * 🔴 The two gates judge two completely different things, and the order cannot be reversed:
 *
 *   (1) **Key gate** (`headerWrite` / `lineWrite`) — an out-of-bounds key, or a key that tries to write a system-supplied value.
 *      This is **the caller using the interface wrong**, not a data-entry problem: it should throw one sentence (`RepoError` → 400),
 *      and should not enter issues for the user to "fix" a field that has no input at all.
 *   (2) **Value gate** (`instance.ts`) — a required value missing, a wrong type, an enum out of range, a number past its range.
 *      This is a **data-entry problem**: report every field at once (`BillInvalidError` → 400 with issues).
 *
 * 🔴 Why they must be gathered in one place: there used to be no value gate anywhere, and the only line of defense was a PostgreSQL column constraint,
 * so "issue date was not filled" showed as 500 "internal server error", while "an empty string filled into a required ref"
 * and "a reference pointing at a record that does not exist" did not even 500 — they wrote with 201 directly.
 * Written in two places, `create` and `save` will have one miss first, and the miss has no symptom.
 *
 * 🔴 The normalized line rows **must be reused by every later consumer**: the total (`lineTotals`) and the write
 * (`writeLines`) must compute the same values. The total used to be computed from the **client's raw rows**, and the write stored
 * the rows filtered by `lineWrite` — two sources, and two sources show up as the header total being a little off the sum of the lines.
 */
function prepareWrite(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: LineRows | null,
  completeness: "whole" | "patch",
  what: string,
  channel: "user" | "planner" = "user",
): PreparedWrite {
  const headerKeys = headerWrite(schema, header, what, channel);

  const lineKeys: Record<string, readonly Record<string, unknown>[]> = {};
  for (const [key, rows] of Object.entries(lines ?? {})) {
    const field = subtableFields(schema).find((f) => f.key === key);
    if (!field) fail(`"${schema.label}" has no line table from the submission; ask the assistant to rearrange it`);
    // A wrong shape is the interface used wrong (the same note as on writeLines: judge the shape before judging empty,
    // or a non-array's `.length` is undefined → a silent return → the lines are cleared with zero errors).
    if (!Array.isArray(rows)) {
      fail(`"${schema.label}" / "${field.label}" must be a set of line rows; ask the assistant to rearrange it`);
    }
    lineKeys[key] = rows.map((row, i) => {
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        fail(`"${schema.label}" / "${field.label}" row ${String(i + 1)} is incomplete; ask the assistant to rearrange it`);
      }
      return lineWrite(schema, field, row, what, channel);
    });
  }

  // Lines are always replaced as a whole table, so a row is always whole; only the **header** splits into whole / patch.
  const check =
    completeness === "whole"
      ? channel === "planner"
        ? checkGeneratedBill(schema, headerKeys, lineKeys)
        : checkNewBill(schema, headerKeys, lineKeys)
      : checkBillPatch(schema, headerKeys, lines === null ? null : lineKeys);
  if (!check.ok) throw new BillInvalidError(what, check.issues);
  // The value gate projects only declared fields, and deliberately drops platform fields. The id already isolated by lineWrite is joined
  // back alone, only for the row-identity check after the lock; lineNo is not joined back, because position was never the identity of the fact.
  const checkedLines = Object.fromEntries(
    Object.entries(check.lines).map(([key, rows]) => [
      key,
      rows.map((row, index) => {
        const lineId = lineKeys[key]?.[index]?.["id"];
        return lineId === undefined ? row : { ...row, id: lineId };
      }),
    ]),
  );
  return { header: check.header, lines: checkedLines };
}

/**
 * Fill one reference default into the target layer. **There is only this one criterion**, shared by header and lines.
 *
 * The two emptiness checks are deliberately asymmetric, each blocking one kind of silent error:
 *
 * 1. **The source side is wide** (`null` / `undefined` / `""` all count as absent) — an empty source only means "there is no suggested value",
 *     not an error. The target cell's own `required` and the value gate remain the final criterion (`assertResolvedWrite` runs once more).
 *
 * 2. **The target side is strict: only `=== null` counts, not `undefined`.** These two are completely different things on the write path:
 *       · `null`      — the value gate has seen this cell, and it is empty. The whole grade is always so; the patch grade is "the key was sent but cleared".
 *       · `undefined` — the patch **did not carry this key at all** (`checkLevel`'s "absent = not touched").
 *     Treating `undefined` as a missing value too means a patch that changes only the reference cell (switch supplier, change a material requirement,
 *     re-pick a dispatch order) silently writes the source value back over a target cell the user **edited by hand** — while refDefault's promise outward
 *     is exactly "a non-empty value the user gave wins". This path errors nowhere, the value is legal before and after the write,
 *     and only the person who opens the document next time finds the cell they changed is gone.
 *
 * Lines are always replaced as a whole table (whole), so the second rule's `undefined` branch structurally does not exist on a row;
 * the criterion is still written as one copy, so the day lines also support an incremental patch this does not evolve into two sets.
 *
 * ── `rebind`: the **only** exception to the second rule ──────────────────────────────────────────
 *
 * 🔴 The second criterion above has a hole: it reads "this key was not sent" as "the user wants to keep the original value" in every case,
 * and when the same patch **replaces the record that source reference points at**, the original value refers to **the previous source**.
 * Measured shape (a sales invoice): after `PATCH {customerId: "c-B"}`, the letterhead is still company A's —
 * an invoice billed to customer B with company A's letterhead, legal before and after the write, and neither side errors.
 *
 * The screen does not show this hole, because `FormPage.onFieldChange` actively clears the target cell to
 * `null` when `match` changes (so it takes the second rule's `null` branch). But that means the decision "changing the source must re-carry"
 * lives only in the browser, and an agent or a direct API call gets the opposite result — exactly the split
 * "front-end precheck is experience, server validation is the line of defense" forbids.
 *
 * When `rebind === true` (judged by `matchRebound`, and it holds only for the patch grade) `undefined`
 * also counts as missing. **The other criteria do not change one word**: a non-empty value the user gave explicitly in the same patch still wins,
 * and an empty source still does not write (it does not wipe the target cell — wiping the old tax number when the new customer has none deletes data for the user).
 *
 * It is exported only so this invariant has a direct regression line (same as `uniqueProbe` / `updateValues`).
 */
export function applyRefDefault(target: Row, field: string, value: unknown, rebind = false): void {
  if (value === null || value === undefined || value === "") return;
  const current = target[field];
  if (current !== null && !(rebind && current === undefined)) return;
  target[field] = value;
}

/**
 * Did this patch **replace** the record the `match` cell points at — the `rebind` criterion of `applyRefDefault`.
 *
 * 🔴 The criterion is "the value really changed", **not "the key appeared"**. A patch the screen sends carries every
 * writable key of the current state together (`buildWritePayload`), so a save that changes only the remark still has `customerId`
 * on the wire. Judging by "the key appeared" silently writes the letterhead the user edited by hand back to the customer file's copy —
 * which is exactly the error the second criterion of `applyRefDefault` was built to stop.
 *
 * Clearing `match` (changing it to null) **does not count** as changing the source: the source record does not exist, there is nothing to re-carry,
 * and this cell's final criterion returns to its own `required`.
 *
 * `stored === null` (a create) always returns false: every cell of the whole grade has been seen by the value gate and landed as `null`,
 * the existing `=== null` path already covers it, and this grade is neither needed nor supposed to run.
 */
export function matchRebound(
  stored: Readonly<Row> | null,
  patch: Readonly<Record<string, unknown>>,
  match: string,
): boolean {
  if (stored === null) return false;
  if (!Object.hasOwn(patch, match)) return false;
  const next = patch[match];
  if (next === null || next === undefined || next === "") return false;
  return next !== stored[match];
}

/** After reference defaults are filled, run the whole value gate once more: required / type / enum / numeric range are all judged on the final value. */
export function assertResolvedWrite(
  schema: ModuleSchema,
  write: PreparedWrite,
  completeness: "whole" | "patch",
  what: string,
  channel: "user" | "planner" = "user",
): void {
  const checked = completeness === "whole"
    ? channel === "planner"
      ? checkGeneratedBill(schema, write.header, write.lines)
      : checkNewBill(schema, write.header, write.lines)
    : checkBillPatch(schema, write.header, write.lines);
  if (!checked.ok) throw new BillInvalidError(what, checked.issues);
  // checked is the normalized result of the same value gate; later writes must consume it, so a default cannot bypass rounding or trim.
  //
  // 🔴 **Merge, do not replace** — both layers. The value gate recognizes only the keys **a user can fill**
  // (`checkLevel` walks `fillable(fields)`), so `checked` structurally
  // has no system-supplied values: a frozen `snapshot`, a `refLine`'s companion ref, `lineAgg`.
  // And this step runs **after** `resolveRefs`, when those cells were just filled.
  //
  // Lines used to be `write.lines[key] = rows`, a whole-table replace, which dropped everything resolveRefs had just produced.
  // The symptom is not in the application layer: the value gate skips system-supplied values entirely ⇒ it walks all the way to PostgreSQL NOT NULL,
  // and becomes an unreadable 500 (measured: `material_issue_lines.material_requirement_id` violates not-null).
  // The stub repository's offline cases stay all green — only a real database blows up, so this must have a real-database regression line under it.
  //
  // The header row was already `Object.assign` (merge semantics); both layers now use the same criterion.
  Object.assign(write.header, checked.header);
  for (const [key, rows] of Object.entries(checked.lines)) {
    const resolvedRows = write.lines[key] ?? [];
    if (rows.length !== resolvedRows.length) {
      fail(`${what}: line "${key}" has a different row count before and after the value gate (${resolvedRows.length} → ${rows.length}) — normalization must not add or remove rows`);
    }
    // A user key takes the value-gate's normalized form (rounding / trim / type convergence); a system-supplied key takes what resolveRefs filled.
    (write.lines as Record<string, readonly Record<string, unknown>[]>)[key] = rows.map((row, index) => ({
      ...resolvedRows[index],
      ...row,
    }));
  }
}

// ── candidate default selection (`Field.refPreselect`) ──────────────────────────────────────
//
// "After the production item is chosen, the BOM and the routing fall automatically onto that item's default version, and can still be switched."
//
// 🔴 **The candidate set must not be copied.** The condition used to pick the default is one evaluation of `refFilter ∪ refPreselect`
// (the kernel `resolveRefPreselect`), so the row filled in automatically is always one the user can also pick in the dropdown.
// A second query looks like the worst kind — "a record that is not in the dropdown at all was filled into this cell by the system",
// the user pages through every candidate and cannot find it, and the code on both sides looks right on its own.
//
// 🔴 **Fill only when there is exactly one.** 0 and more than 1 are not filled, no guessing, and the first is not taken:
//   · Taking the first requires a sort, and a "default" ordered by id / created time changes its answer when the data changes,
//     both answers are legal references, and nowhere says which one is wrong;
//   · "the default version is unique" has a separate `single_default_*` gate on BOM / routing, but that gate is on **the activate
//     edge** — the declaration layer does not assume it is always true (history data, imported data, and data from before the gate went live are all in the database).
// When no unique row can be picked, this cell stays empty, and whether it is required is said by its own `required` on the value-gate pass after the fill.
//
// 🔴 **One query for a group of coordinates, not a round trip per cell.** A 20-line production order has 40 coordinates waiting to be filled,
// and a query per cell is 40 round trips inside the transaction. Group by "target module × the columns the condition uses",
// the where is the or of each coordinate's condition, and SQL only `group by those columns` to count how many rows each group has plus the minimum id,
// and "which group counts as this cell" is compared per coordinate in JS (`refFilterMatches`, the same copy the write side uses to judge `filtered`).
// The count stays in SQL rather than pulling the rows back to count: pulling them back is either unbounded (a wide default condition is a full table scan)
// or limited — and a count with a limit turns "there are really 3" into "there is only 1",
// and then **fills a wrong default**, which is the error this capability must not make.

interface RefPreselectQuery {
  readonly entity: string;
  readonly conditions: readonly RefFilterCondition[];
}

/** Group key: target module + the set of columns the condition touches (the same column set is what can enter one group by). */
function preselectGroupKey(query: RefPreselectQuery): string {
  return JSON.stringify([query.entity, [...new Set(query.conditions.map((c) => c.field))].sort()]);
}

/** Projection keys of the count and the id. The prefix is so they do not collide with a condition column (a business field really might be named `n` / `count`). */
const PRESELECT_COUNT = "__preselect_count";
const PRESELECT_ID = "__preselect_id";

/**
 * The id of the candidate that belongs to this cell when the grouped count has **exactly one**; otherwise `null`.
 *
 * 🔴 **The sum is not "take one row"**: an `in`-shaped condition (`materialType: ["semi-finished","finished"]`) spreads one cell's
 * candidates across several groups, and looking only at the first group that hit reads "two" as "one", then fills a wrong default.
 *
 * Exported only so the "exactly one" invariant has a direct regression line (same as `applyRefDefault` / `uniqueProbe`):
 * its two wrong directions — counting several as one, counting one as none — show on the screen as "it filled something it should not"
 * and "this feature seems not to take effect", and neither errors.
 */
export function pickSinglePreselect(
  rows: readonly Readonly<Record<string, unknown>>[],
  conditions: readonly RefFilterCondition[],
): string | null {
  const matched = rows.filter((row) => refFilterMatches(row, conditions));
  const total = matched.reduce((sum, row) => sum + Number(row[PRESELECT_COUNT] ?? 0), 0);
  if (total !== 1) return null;
  const id = matched.find((row) => Number(row[PRESELECT_COUNT] ?? 0) === 1)?.[PRESELECT_ID];
  if (typeof id !== "string" || id === "") {
    fail("picking the default selection: there is exactly one candidate but its id cannot be read — the count and the projection are not the same source");
  }
  return id;
}

/**
 * For each coordinate, the id of "exactly one in the candidates"; `null` when a unique one cannot be picked.
 *
 * The return lines up with the input index — a Map would require the caller to guarantee unique keys, and two line rows
 * can have exactly the same condition on the same cell (two rows picked the same item), and then both coordinates need their own answer.
 */
async function lookupRefPreselect(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  queries: readonly RefPreselectQuery[],
  visibility: "actor" | "tenant",
  timezone: string,
): Promise<readonly (string | null)[]> {
  const out: (string | null)[] = queries.map(() => null);
  const groups = new Map<string, number[]>();
  queries.forEach((query, index) => {
    const key = preselectGroupKey(query);
    const hit = groups.get(key);
    if (hit) hit.push(index);
    else groups.set(key, [index]);
  });

  for (const indexes of groups.values()) {
    const head = indexes[0];
    if (head === undefined) continue;
    const first = queries[head] as RefPreselectQuery;
    const target = registry.get(first.entity);
    const what = `pick the default selection of "${first.entity}"`;
    // One and per coordinate, or inside the group: SQL is only responsible for fetching this batch of candidates once.
    const branches = indexes.map((index) => {
      const conditions = (queries[index] as RefPreselectQuery).conditions;
      // 🔴 No condition at all = counting "the unique one" over the whole entity. The declaration layer already refuses this shape
      // (`REF_PRESELECT_WITHOUT_FILTER`), and reaching here means someone bypassed coordinate resolution.
      // Letting it enter the or silently means this branch carries no condition and counts the other groups' rows in too.
      if (!conditions.length) fail(`${what}: some coordinate has not one condition — a default selection can only be picked inside the candidate set`);
      const parts = compileRefFilter(target, conditions, what);
      return and(...parts) as SQL;
    });
    const where = (or(...branches) ?? fail(`${what}: the condition compiled to an empty condition`)) as SQL;

    const columns = refFilterColumnsOf(target, first.conditions, what);
    const selection: Record<string, PgColumn | SQL> = { ...columns };
    for (const key of [PRESELECT_COUNT, PRESELECT_ID]) {
      if (Object.hasOwn(selection, key)) {
        fail(`${what}: the target module has a column named "${key}", which collides with this count projection`);
      }
    }
    selection[PRESELECT_COUNT] = sql<string>`count(*)`;
    // Read only when this group has exactly one row, so min returns that row itself.
    selection[PRESELECT_ID] = sql<string>`min(${target.header.id})`;

    let statement = exec
      .select(selection as never)
      .from(target.header)
      .where(
        visibility === "tenant"
          ? scopedWhere(target.header, identity, where)
          : moduleScopedWhere(target, identity, timezone, where),
      )
      .$dynamic();
    statement = statement.groupBy(...Object.values(columns));
    const rows = (await statement) as Record<string, unknown>[];

    for (const index of indexes) {
      out[index] = pickSinglePreselect(rows, (queries[index] as RefPreselectQuery).conditions);
    }
  }
  return out;
}

/**
 * Fill "the default one among the candidates" into this write.
 *
 * 🔴 It runs **before** `refSitesOf`: the filled value is an ordinary reference value, and it must take **the same**
 * existence / candidate-filter check as one the user picked, and it must be able to be the match of `snapshot` / `refDefault`.
 * Putting it after would be a bypass around the write-path gate, and what it fills in comes from another query.
 *
 * The value lands through `applyRefDefault`: there is only one criterion for "how an overridable starting value lands" —
 * and in particular a key the patch did not carry must not be touched one word (see the second rule of that function).
 */
async function preselectRefs(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  schema: ModuleSchema,
  write: PreparedWrite,
  what: string,
  visibility: "actor" | "tenant",
  timezone: string,
): Promise<PreparedWrite> {
  const slotOf = (from: PreparedWrite, site: RefPreselectSite): Readonly<Row> | undefined =>
    site.target.table === null ? from.header : from.lines[site.target.table]?.[site.target.row ?? -1];
  // 🔴 A cell whose patch **did not carry this key** is not asked: the second rule of `applyRefDefault` already decided not to touch it
  // (only `=== null` counts, and `undefined` is "not touched"), so a query sent out is destined to be dropped.
  // The criterion is still only that one copy — this is "is a round trip worth spending on it", not a second judgment of whether it can be filled.
  const sites: readonly RefPreselectSite[] = refPreselectSitesOf(schema, write.header, write.lines).filter(
    (site) => slotOf(write, site)?.[site.target.field] === null,
  );
  if (sites.length === 0) return write;
  const picked = await lookupRefPreselect(exec, identity, registry, sites, visibility, timezone);

  const header: Row = { ...write.header };
  const lines: Record<string, Row[]> = Object.fromEntries(
    Object.entries(write.lines).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))]),
  );
  sites.forEach((site, index) => {
    const id = picked[index];
    if (id === null || id === undefined) return;
    const target =
      site.target.table === null
        ? header
        : (lines[site.target.table]?.[site.target.row ?? -1] ??
          fail(`${what}: the refPreselect write-back coordinate "${site.target.path}" cannot find the line row — the declaration and the written row order disagree`));
    applyRefDefault(target, site.target.field, id);
  });
  return { header, lines };
}

/**
 * "How the **status** inside the candidate condition can be satisfied" — "where to go and which button to click".
 *
 * 🔴 Golden-path move G-01: creating an "order operation dispatch" directly is refused, and the reason only has `status ∈ inProgress`,
 * and the next sentence is "please pick another" — while the user has no second one to pick, and what they really must do is go to the "dispatch order"
 * and click that edge once. This information was always **derivable** (in the target module's state machine, which edge's `to` equals
 * the required status), it just had never been computed.
 *
 * 🔴 **Zero extra IO**: the condition and the target schema are already in hand at the call site. Hitting the database once more on the **refusal path**
 * for one sentence of wording (for example to count "how many candidates are left") is the wrong cost — that path is already the error path.
 *
 * `status` is a **platform field** (it is not in the module declaration), so this key name is the only way to recognize it,
 * the same criterion as the outbound projection's `foreignStatusGlossary`. When no status condition is found, or no edge can reach those statuses
 * (initial status / produced only by push-down), it returns `null`, and the caller keeps the original wording from that.
 *
 * @internal Exported only for the regression line: this sentence being wrong does not error, it only sends the user to a button that does not exist.
 */
export function statusRemedyOf(target: ModuleSchema, conditions: readonly RefFilterCondition[]): string | null {
  const wanted = conditions.find((c) => c.field === "status");
  if (!wanted) return null;
  const statusName = (key: string): string =>
    target.lifecycle.statuses.find((s) => s.key === key)?.label ?? key;
  const how = transitionsReaching(
    target,
    wanted.values.map((v) => String(v)),
  ).flatMap((approach) => {
    const to = statusName(approach.status);
    return approach.transitions.map(
      (edge) => `first go to "${target.label}" and run "${edge.action}" on it (${statusName(edge.from)} → ${to})`,
    );
  });
  return how.length ? how.join(", or ") : null;
}

function refFilterFieldLabel(target: ModuleSchema, field: string): string {
  if (field === "status") return "status";
  return target.fields.find((item) => item.key === field)?.label ?? field;
}

function refFilterValueLabel(target: ModuleSchema, field: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (field === "status") {
    return target.lifecycle.statuses.find((item) => item.key === String(value))?.label ?? String(value);
  }
  return String(value);
}

/**
 * The `REF_FILTER_MISMATCH` sentence. It consumes only the conditions **not satisfied**: also reciting a
 * `status ∈ active` that already holds recommends an edge that will not change anything when the user presses it.
 *
 * @internal Exported only for the regression line.
 */
export function refFilterMismatchMessage(
  target: ModuleSchema,
  siteLabel: string,
  failed: readonly RefFilterCondition[],
): string {
  const condText = failed
    .map(
      (condition) =>
        `${refFilterFieldLabel(target, condition.field)} ∈ ${condition.values
          .map((value) => refFilterValueLabel(target, condition.field, value))
          .join(" / ")}`,
    )
    .join("; ");
  const remedy = statusRemedyOf(target, failed);
  return (
    `the ${target.label} chosen for "${siteLabel}" is outside the allowed range` +
    ` (${condText}) — ` +
    (remedy === null
      ? `it exists, but it does not meet this cell's condition; please pick another`
      : `it exists, but it has not reached the required status: ${remedy}, or pick another that already meets the condition`)
  );
}

/**
 * "This record cannot be deleted; does it have another way out" — a **retirement edge**: void / cancel / reverse / disable.
 *
 * 🔴 This function exists because **the same shape was hit three times in measurement**, and each time a deletion refusal
 * recommended a way out that **does not exist on this module at all**:
 *   (1) "first **undo this push-down** on the connected document" — the whole warehouse has no such action. `oe_reference`
 *      (push-down lineage) has one INSERT, **zero DELETE, zero UPDATE**: push-down has no inverse,
 *      and once lineage is written it is permanent. (`salesOrder.cancel_ship`, "undo shipment", only returns the source document to
 *      the previous status; it neither deletes the lineage nor touches the downstream draft, and it is not what that sentence means.)
 *   (2) "or **void it instead**" — void is **per module, per status**: the initial status of a push-down target module already has an exit
 *      (the gate is pinned in `packages/builder/test/gate.test.ts`), but other statuses may not,
 *      for example `stockOut.rejected` has none.
 *   (3) "or **disable this one**" — `warehouse` is `singleState()`, and has no disable edge at all.
 *
 * What they share is not "each of these three sentences was written wrong"; it is **they describe a way out that "usually exists",
 * without checking whether this module actually has it**. So the way out must be derived from the declaration, and must not be hardcoded.
 *
 * 🔴 **Do not build a table of "which exits each module has"** — that is a second source of truth, and it would not follow a state-machine change.
 * The criterion is taken entirely from `lifecycle`:
 *   · **First grade · terminal edge**: `to` is terminal, and it is not `primary`. Void / cancel / reverse all look like this.
 *     Confirming a fulfillment document also walks into a terminal status (shipped / received); that is moving forward, not retiring.
 *   · **Second grade · disable edge** (looked at only when the first grade is empty): `to` is not editable and not terminal,
 *     and it **can only come back, and cannot go anywhere else** (outgoing edges are non-empty and all point back at the current status).
 *     Master data's `active ⇄ disabled` is exactly this shape.
 *
 * The second grade's "cannot go anywhere else" is **required**, not conservative: without it, a `subcontractOrder`
 * draft would recommend "submit for review" as the substitute for deletion (pending review is also `editable:"none"`),
 * and that edge pushes the document one step forward, which is the opposite action in the business.
 *
 * 🔴 A hint that tells the user to click a button that does not exist is **worse than no hint**: they think they
 * failed to find it, page around the screen, and after not finding it stop trusting the whole system. When no way out can be given, say only the fact plus
 * "please contact an administrator" — honest and actionable.
 * 🔴 Do **not** fall back to "cannot delete for now, please try again later": that is a lie, and this record will never become deletable.
 *
 * 🔴 Zero IO, zero extra queries: the schema and the current status are already in hand at the call site. Same as `statusRemedyOf` —
 * hitting the database once more on the **error path** for one sentence of wording is the wrong cost.
 *
 * @internal Exported only for the regression line: this sentence being wrong does not error, it only sends the user to a button that does not exist.
 */
export function retirementExitsOf(schema: ModuleSchema, status: string): readonly string[] {
  const byKey = new Map(schema.lifecycle.statuses.map((s) => [s.key, s]));
  const out = schema.lifecycle.transitions.filter((t) => t.from === status);

  // A primary action moves the flow forward, and is not retirement. After shipped / received is marked terminal,
  // "confirm issue" also walks to a terminal status, and must not be recommended as the substitute for deletion.
  // internal is only for the cascade Planner, and is not a user button on the current document.
  const terminal = out.filter((t) => t.internal !== true && t.primary !== true && byKey.get(t.to)?.terminal === true);
  if (terminal.length) return terminal.map((t) => t.action);

  return out
    .filter((t) => {
      const to = byKey.get(t.to);
      if (t.internal === true || !to || to.terminal || to.editable !== "none") return false;
      const onward = schema.lifecycle.transitions.filter((x) => x.from === t.to);
      // Outgoing edges non-empty and all pointing back ⇒ it is a parking spot, not the next cell of the flow.
      return onward.length > 0 && onward.every((x) => x.to === status);
    })
    .map((t) => t.action);
}

/**
 * The next step of "this document cannot be deleted" (the framework-fact branches: lineage / ledger / audit).
 *
 * 🔴 `because` is **that branch's own** "why deletion is the wrong thing to do" (the account must be reversed flat / the passage cannot be erased),
 * and it differs by branch; **the next step is computed by one criterion**, shared by these branches. Each branch writing its own sentence means
 * next time someone changes only one, while the sentences look identical on the screen — the user cannot read "these are several different criteria",
 * and only reads "this system speaks well sometimes and badly sometimes".
 *
 * **When no exit can be given, `because` must not be swallowed with it**: "why it cannot be deleted" can always be said,
 * and what cannot be said is only "what to do then". The two are separate, and the former is always given.
 *
 * @internal Exported only for the regression line, same as `statusRemedyOf`.
 */
export function removalRemedy(schema: ModuleSchema, status: string, because: string | null = null): string {
  const exits = retirementExitsOf(schema, status);
  const next = exits.length
    ? `if it was created by mistake, use this document's "${exits.join('" or "')}" instead`
    : "this document has no void entrance; contact an administrator";
  return because === null ? next : `${because}; ${next}`;
}

/**
 * The next step of "this record is still in use by others" (the incoming-reference branch).
 *
 * The same criterion as above, only the wording differs: here **the first step is always "go change those records"** (that can always be done),
 * and the second step "disable / void" is the optional half, which must be confirmed to exist first.
 *
 * @internal Exported only for the regression line.
 */
export function inUseRemedy(schema: ModuleSchema, status: string): string {
  const exits = retirementExitsOf(schema, status);
  return exits.length
    ? `first change those records to another value, or use this document's "${exits.join('" or "')}" instead (that keeps history; deletion does not)`
    : "first change those records to another value; only then can this be deleted";
}

/**
 * The record a reference points at **really exists**.
 *
 * The kernel cannot judge this one (zero IO), but "which coordinates to check" is derived from the declaration, so the kernel gives the list
 * (`refSitesOf`) — if the server scanned fields itself, scanning the header and forgetting the lines would certainly happen,
 * and the forgotten half shows up as a dangling reference written as usual.
 *
 * 🔴 The scope must be **word-for-word the same** as `refOptions` (`moduleScopedWhere`: tenant × dataScope).
 * Binding only the tenant lets a record the dropdown cannot pick be referenced by a hand-typed id; making it stricter the other way
 * produces "it can be picked in the dropdown, but save says it does not exist". The two sides do not each judge once; they judge the same thing.
 *
 * 🔴 This is **the only line of defense in the application layer**: this warehouse deliberately issues no cross-module foreign key (see AGENTS, "no cross-module foreign keys"),
 * so the database will not check this one for us. It used to exist nowhere, and the consequence was measured —
 * `customerId: "does not exist at all"` received 201, the customer name on the screen was blank,
 * and "dirty data" and "this customer never had a name" look identical.
 *
 * 🔴 Writes and the general delete share `billActionLockKey`: first look up the header a refLine belongs to, lock
 * every target coordinate in global order, then look the references up again. If the delete commits first, the re-check reports a dangling reference explicitly; if the write commits first,
 * the delete sees the downstream dependency after the lock and refuses. Without this shared lock, between the application-layer existence check and DELETE
 * there is a concurrency window a database foreign key cannot close for us.
 */
/**
 * "Which coordinates this write must lock" — compute only, do not lock.
 *
 * 🔴 Split **out of** `resolveRefs` so a multi-batch path (the Planner: N `createOne`s in a row inside one outer transaction)
 * can compute all N batches of coordinates at once before starting, and lock them once in global order.
 * Left inside `resolveRefs`, "compute coordinates" and "take the lock" are bound into one step, and a global order across batches
 * has nowhere to be expressed (see the note on `BillLockLedger`).
 *
 * 🔴 A `refLine` coordinate is **looked up** (it must join back to the header for `bill_id`), so this step has IO;
 * but it is the "first lookup before the lock" that `resolveRefs` already did, and it does not hit the database once more — it was only moved forward.
 */
async function writeLockCoordinates(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  schema: ModuleSchema,
  write: PreparedWrite,
  what: string,
  lockWith: readonly BillCoordinate[],
  visibility: "actor" | "tenant",
  timezone: string,
): Promise<{
  readonly filled: PreparedWrite;
  readonly sites: readonly RefSite[];
  readonly coordinates: readonly BillCoordinate[];
}> {
  // 🔴 Fill the default selection first, then derive the reference coordinates: a filled reference must take the same gate as one the user picked.
  const filled = await preselectRefs(exec, identity, registry, schema, write, what, visibility, timezone);
  // This pass computes **coordinates** only, and does not consume one word of the pending / conditions `refFilter` evaluated —
  // a coordinate is `site.entity` + `site.id`, and it does not depend on the filter. "Is this reference legal" uses
  // the copy `resolveRefs` recomputes **after the lock** (only then is the header in the database available).
  const sites = refSitesOf(schema, filled.header, filled.lines);
  const before = await lookupRefSites(exec, identity, registry, sites, timezone, visibility);
  const coordinates = new Map<string, BillCoordinate>();
  const add = (coordinate: BillCoordinate): void => {
    coordinates.set(JSON.stringify([coordinate.module, coordinate.id]), coordinate);
  };
  lockWith.forEach(add);
  for (const site of sites) {
    const lookup = before.get(site);
    if (!lookup) fail(`${what}: reference "${site.path}" has no first lookup result`);
    if (site.through === null) add({ module: site.entity, id: site.id });
    else if (lookup.owner !== null) add({ module: site.entity, id: lookup.owner });
  }
  return { filled, sites, coordinates: [...coordinates.values()] };
}

interface UnitChoiceLocation {
  readonly field: Field;
  readonly table: string | null;
  readonly row: number | null;
  readonly path: string;
  readonly label: string;
}

/** `RefSite.path` → the unit cell whose candidates this product reference supplies. The declaration only states the same-layer relation; the row coordinate is expanded here. */
function unitChoiceLocationsOf(
  schema: ModuleSchema,
  lines: Readonly<Record<string, readonly Readonly<Row>[]>>,
): ReadonlyMap<string, readonly UnitChoiceLocation[]> {
  const out = new Map<string, UnitChoiceLocation[]>();
  const add = (matchPath: string, location: UnitChoiceLocation): void => {
    const found = out.get(matchPath);
    if (found) found.push(location);
    else out.set(matchPath, [location]);
  };
  for (const field of schema.fields) {
    if (field.type === "subtable") {
      const columns = field.fields ?? [];
      const rows = lines[field.key] ?? [];
      rows.forEach((_row, index) => {
        for (const column of columns) {
          if (column.unitChoice == null) continue;
          add(lineIssuePath(field.key, index, column.unitChoice.match), {
            field: column,
            table: field.key,
            row: index,
            path: lineIssuePath(field.key, index, column.key),
            label: lineIssueLabel(field.label, index, column.label),
          });
        }
      });
      continue;
    }
    if (field.unitChoice == null) continue;
    add(field.unitChoice.match, { field, table: null, row: null, path: field.key, label: field.label });
  }
  return out;
}

function rowAt(
  header: Row,
  lines: Readonly<Record<string, readonly Row[]>>,
  location: UnitChoiceLocation,
  what: string,
): Row {
  if (location.table === null) return header;
  return lines[location.table]?.[location.row ?? -1] ??
    fail(`${what}: the unit-choice write-back coordinate "${location.path}" cannot find the line row — the declaration and the written row order disagree`);
}

/**
 * Materialize every stored calculation column, and collect a failure into a per-field problem the form can locate.
 * A header patch fills context from the old row read after the lock, but writes only the calculate columns back onto the patch.
 */
function materializeLineCalculations(
  schema: ModuleSchema,
  lines: Record<string, Row[]>,
): readonly BillIssue[] {
  const issues: BillIssue[] = [];
  for (const table of schema.fields) {
    if (table.type !== "subtable") continue;
    const fields = table.fields ?? [];
    for (const [index, row] of (lines[table.key] ?? []).entries()) {
      const result = materializeStoredCalculations(fields, row);
      Object.assign(row, result.values);
      for (const issue of result.issues) {
        issues.push({
          path: lineIssuePath(table.key, index, issue.field),
          label: lineIssueLabel(table.label, index, issue.label),
          code: issue.code,
          message: issue.message,
        });
      }
    }
  }
  return issues;
}

function materializeHeaderCalculations(
  schema: ModuleSchema,
  context: Readonly<Row>,
  target: Row,
  what: string,
): void {
  const result = materializeStoredCalculations(schema.fields, context);
  if (result.issues.length > 0) {
    throw new BillInvalidError(
      what,
      result.issues.map((issue) => ({
        path: issue.field,
        label: issue.label,
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  for (const field of schema.fields) {
    if (field.calculate != null && Object.hasOwn(result.values, field.key)) target[field.key] = result.values[field.key];
  }
}

async function resolveRefs(
  exec: Executor,
  identity: Identity,
  ledger: BillLockLedger,
  registry: ModuleRegistry,
  schema: ModuleSchema,
  write: PreparedWrite,
  what: string,
  timezone: string,
  lockWith: readonly BillCoordinate[] = [],
  visibility: "actor" | "tenant" = "actor",
  /**
   * On save (patch): read the header in the database **after the lock**. A create passes null.
   *
   * 🔴 It is a thunk rather than a value, because it must be read only **after the coordinate lock is taken**:
   * a value read before the lock can be changed at any time by another save, and using it to evaluate a candidate filter is another TOCTOU
   * (letting through a candidate that belongs to the **old** upstream document, while both sides look legal on their own).
   */
  storedHeaderOf: (() => Promise<Readonly<Row>>) | null = null,
  /**
   * Header keys writable in the current status (`save` passes them; `create` passes null = unlimited).
   *
   * 🔴 Used only by the `refDefault` **re-carry** grade. Re-carry writes a key that **did not appear in the patch**,
   * while the lifecycle writability gate (the `offending` passage at the start of `save`) judges the patch's own keys —
   * not bringing the allow-list here opens a path that **writes a field by bypassing the state machine**: on an approved document,
   * when "customer" is still open and "letterhead" is locked, changing the customer once also changes the locked letterhead,
   * and that cell is grey on the screen, so nobody expects it to change.
   *
   * A scan of the whole warehouse today hits 0 (no module has a writable match while the target is locked), but that is **today's declaration**,
   * not a structural guarantee: the next person who writes `editableFields` can create it in passing, and it does not error.
   */
  editableHeaderKeys: ReadonlySet<string> | null = null,
  choiceSets: readonly RuntimeChoiceSet[] = [],
): Promise<PreparedWrite> {
  const { filled, sites: coordinateSites, coordinates } = await writeLockCoordinates(
    exec,
    identity,
    registry,
    schema,
    write,
    what,
    lockWith,
    visibility,
    timezone,
  );
  await lockBillCoordinates(exec, identity, ledger, coordinates);
  // 🔴 Recompute sites after the lock: a `$bill.` operand of `refFilter` must see "the header already in the database ⊕ this patch".
  // The consequence of looking only at the patch is in `refSitesOf`'s `filterHeader` note — a cell that clearly has a value is judged "not filled yet",
  // and the wording still tells the user to fill it. **Merge only the operands, not the site set**: the second argument is still
  // `filled.header`, so one patch does not run every existing reference on this document through the candidate filter again.
  //
  // 🔴 The header in the database is also the `refDefault` re-carry criterion (`matchRebound`): whether this patch
  // **replaced** that source reference is known only by comparing it with the patch. Reuse this read, and do not hit the database once more.
  const storedHeader = storedHeaderOf === null ? null : await storedHeaderOf();
  const sites =
    storedHeader === null
      ? coordinateSites
      : refSitesOf(schema, filled.header, filled.lines, { ...storedHeader, ...filled.header });

  // 🔴 **A candidate filter waits until the system-supplied cells are filled before it is judged** (`site.filterAwaits`; the criterion is in the kernel).
  //
  // The measured deadlock: a release line's `bomId` candidates are narrowed by `$line.productId`, and `productId` is a snapshot frozen from
  // the source order line — the write gate forbids the client to write it, and it appears on the row only at the first `applySites`
  // hop. Judging before that ⇒ that cell is always empty ⇒ always `REF_FILTER_PENDING` "please fill it first",
  // and the user's screen has no such input at all. **Both paths are blocked, and the whole module cannot create one document.**
  //
  // The shape is word-for-word the same as the `refPreselect` one (the value gate lets it through first when it sees "the candidate set has a referent",
  // and runs **the same** value gate again after the server has filled it): what changes here is only **when it is judged**, and the criterion does not move one word —
  // the `REF_FILTER_PENDING` grade stays, and it is still right for "the candidates depend on the previous cell the user themselves must pick"
  // (`productionTask.bomId` ← the `productId` the user picked).
  //
  // 🔴 Batching happens only when such a coordinate **really exists** (`deferred.length > 0`); otherwise not one extra IO is done.
  // This is a general write capability; a staged row of the batch workbench is not written, so it does not open another repository write path.
  const ready = sites.filter((site) => site.filterAwaits === null);
  const deferred = sites.filter((site) => site.filterAwaits !== null);
  const unitChoices = unitChoiceLocationsOf(schema, filled.lines);
  const unitChoicePaths = new Set(unitChoices.keys());
  const lookups = await lookupRefSites(exec, identity, registry, ready, timezone, visibility, unitChoicePaths);

  // A companion ref is system-supplied, and is not in prepareWrite's result. Copy the rows first, and fill only the copy after resolution succeeds;
  // the later total and the write both consume this copy, so it does not "validate one copy and write another".
  const resolvedLines: Record<string, Row[]> = Object.fromEntries(
    Object.entries(filled.lines).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))]),
  );
  const resolvedHeader: Row = { ...filled.header };

  const issues: BillIssue[] = [];
  const applySites = (batch: readonly RefSite[], batchLookups: ReadonlyMap<RefSite, RefLookup>): void => {
    for (const site of batch) {
      const lookup = batchLookups.get(site);
      if (!lookup) fail(`${what}: reference "${site.path}" has no lookup result — the reference grouping and the result projection disagree`);
      const target = registry.get(site.entity);
      // 🔴 The cell the filter depends on is not filled yet ⇒ **refuse**, not "then do not filter".
      // Falling back to no filter is fail-open, and it happens only when that cell happens to be empty:
      // "this task's dispatch order" silently becomes "any dispatch order", and this path has no symptom.
      if (site.filter.pending.length) {
        // 🔴 The wording is two sentences, because **the next step is completely different**. By the time it reaches here the system-supplied batch has already been filled once
        // (`recheckRefSiteFilters`), and it is still empty ⇒ the upstream cell never had a value (legal: the source is optional,
        // and it froze as null). Telling it "please fill it first" is an instruction the user cannot carry out — they have no such
        // input on the screen, and changing it any number of times stays the same; what they should actually do is go back to the upstream document and fill it, or pick another upstream row that already has a value.
        const awaited = site.filterAwaits?.operands ?? [];
        const blocked = site.filter.pending.filter((operand) => awaited.includes(operand));
        issues.push({
          path: site.path,
          label: site.label,
          code: "REF_FILTER_PENDING",
          message:
            blocked.length === 0
              ? `the choices for "${site.label}" depend on ${site.filter.pending.join(", ")}, ` +
                `and that cell has no value yet — fill it first, then choose this cell`
              : `the choices for "${site.label}" depend on ${blocked.join(", ")}, and that cell is frozen from the source document, ` +
                `and this time no value was frozen — it is not filled on this document; go back to the upstream document and fill it, or pick a source row that already has a value`,
        });
        continue;
      }
      if (!lookup.found) {
        const targetLabel = site.through === null ? target.schema.label : `a line of ${target.schema.label}`;
        issues.push({
          path: site.path,
          label: site.label,
          code: "REF_NOT_FOUND",
          message: `the ${targetLabel} that "${site.label}" points at does not exist, or is outside your visible range (${site.id})`,
        });
        continue;
      }
      if (lookup.filtered) {
        // 🔴 The condition can be said; **where to go to satisfy it** used to be unsayable (golden-path move G-01):
        // "(… status ∈ inProgress) — please pick another", while the user has no second one to pick,
        // and what they really must do is go to that record of the target module and click some edge once.
        // The criterion is the kernel's `transitionsReaching` (which edge in the target state machine has `to` equal to the required one),
        // **zero extra IO**: the condition and the target schema are both in hand now, and the database is not hit once more for one sentence of wording.
        // Hand this sentence only the conditions **not satisfied**: reciting status ∈ active again for an SKU that is enabled but canSell=false
        // sends the person to click "enable again".
        //
        // 🔴 **Unchanged echo-back exemption** (the same logic as the `offending` check):
        // if a header ref field's submitted value matches what is already stored, the user only echoed the existing value back,
        // and did not switch to a new reference. Then refFilter is only a candidate narrowing (dropdown filter), not a
        // write gate — otherwise "editing a product that references a disabled product style" could never be saved because the original value fails
        // the filter, and not even the other fields could be changed.
        //
        // A line-level reference does not get this exemption (`filled.lines` is a whole-table replace, and there is no independent stored row to compare);
        // a `refLine` that points at a line (`through !== null`) does not either.
        const isUnchangedHeaderRef =
          site.companion === null &&
          site.through === null &&
          storedHeader !== null &&
          storedHeader[site.path] === site.id;
        if (!isUnchangedHeaderRef) {
          issues.push({
            path: site.path,
            label: site.label,
            code: "REF_FILTER_MISMATCH",
            message: refFilterMismatchMessage(target.schema, site.label, lookup.failedFilters),
          });
          continue;
        }
      }
      for (const snapshot of site.snapshots) {
        const raw = lookup.snapshot[snapshot.sourceField];
        // 🔴 Emptiness uses the kernel's one `isEmptyValue` (the same one the value gate, `required_fields`, and the front end's pick-a-row-and-carry use).
        // This used to be an in-place `=== null || === undefined || === ""` —
        // word-for-word the same as the front end's copy, so the problem was invisible, but the two emptiness checks drifting looks like
        // "the screen froze a value, and save says the source is empty", while both sides look right on their own.
        const empty = isEmptyValue(raw);
        // 🔴 When the source is empty, **refuse or write null** takes the kernel's one criterion
        // (`snapshotSourceGuarantee`, packages/metamodel/src/derive/snapshot.ts), and **the same function** decides on the table-building side whether this column
        // is nullable. Writing it twice will drift, and the drift does not error:
        // the column is nullable and this still refuses ⇒ the document sticks in a middle status and cannot get out; the column is NOT NULL and this lets null through
        // ⇒ an unreadable 500, and only when the source happens to be empty.
        const guaranteed = empty
          ? // `registry.get` **throws** on an unknown module (it does not return null) — a module missing on the snapshot chain
            // is a declaration error that should have been stopped at load time, and swallowing it as undefined here degrades it to
            // "the source is not guaranteed ⇒ write null", after which a declaration error has no symptom.
            snapshotSourceGuarantee((code) => registry.get(code).schema, {
              from: site.entity,
              through: site.through,
              field: snapshot.sourceField,
            }).guaranteed
          : true;
        if (empty && guaranteed) {
          // The declaration guaranteed non-empty, and runtime has none ⇒ **an internal inconsistency**, not a user-input problem.
          // 🔴 The wording is separate from the grade below: mixed into one sentence, a real integrity violation
          // (the source is required / auto / lineAgg and yet the lookup is empty) is read as "you left something unfilled",
          // and the user changing it any number of times stays the same.
          issues.push({
            path: snapshot.target.path,
            label: snapshot.target.label,
            code: "SNAPSHOT_SOURCE_EMPTY",
            message:
              `"${snapshot.target.label}" cannot be frozen from the source "${snapshot.sourceField}": ` +
              `that source is guaranteed non-empty by the declaration (required / numbering / line total), but the lookup is empty — ` +
              `this is an internal inconsistency; contact an administrator and give this document's number; it is not a problem with what you filled in`,
          });
          continue;
        }
        // The source is optional ⇒ **there is nothing to freeze, write null**.
        //
        // This is not letting an error through; it admits a legal state: a `snapshot` means "freeze the source value at the moment of the reference",
        // and at that moment there was no value. Forcing the user to fill a value they do not have was measured to cost
        // a sales order whose "spec" was left empty **that cannot ship after approval**, and the document has already left draft,
        // stuck in "awaitingShipment", and can only go back by unapprove → withdraw.
        // The target column was built nullable by the same criterion (see the tables/ output), so the write does not hit NOT NULL.
        const value = empty ? null : raw;
        if (snapshot.target.table === null) {
          resolvedHeader[snapshot.target.field] = value;
        } else {
          const row = resolvedLines[snapshot.target.table]?.[snapshot.target.row ?? -1];
          if (!row) {
            fail(`${what}: the snapshot write-back coordinate "${snapshot.target.path}" cannot find the line row — the declaration and the written row order disagree`);
          }
          row[snapshot.target.field] = value;
        }
      }
      for (const refDefault of site.defaults ?? []) {
        const target =
          refDefault.target.table === null
            ? resolvedHeader
            : (resolvedLines[refDefault.target.table]?.[refDefault.target.row ?? -1] ??
              fail(`${what}: the refDefault write-back coordinate "${refDefault.target.path}" cannot find the line row — the declaration and the written row order disagree`));
        // 🔴 The source reference was replaced ⇒ the target cell must be re-carried from the new source even when it is not in the patch.
        // The criterion holds only for an ordinary ref on the **header**: `site.path` is then the key of the `match` cell,
        // while lines are always replaced as a whole table (whole), every cell on the row has been seen by the value gate and landed as null,
        // and it takes `applyRefDefault`'s original `=== null` path, so this grade is neither needed nor supposed to run.
        //
        // 🔴 Then one more lifecycle-writability check: re-carry writes a key that did not appear in the patch,
        // and the `offending` gate at the start can see only the patch's own keys. Missing this check is a path that
        // changes a field by bypassing the state machine (a letterhead locked on an approved document is silently changed by one customer switch).
        const rebind =
          refDefault.target.table === null &&
          site.through === null &&
          matchRebound(storedHeader, filled.header, site.path) &&
          (editableHeaderKeys === null || editableHeaderKeys.has(refDefault.target.field));
        const targetFields =
          refDefault.target.table === null
            ? schema.fields
            : (schema.fields.find((field) => field.key === refDefault.target.table)?.fields ?? []);
        const targetField = targetFields.find((field) => field.key === refDefault.target.field);
        const rawDefault = lookup.snapshot[refDefault.sourceField];
        applyRefDefault(
          target,
          refDefault.target.field,
          targetField ? coerceWriteValue(targetField, rawDefault) : rawDefault,
          rebind,
        );
      }
      // Unit candidates and refDefault **must consume the same product projection**. Let refDefault land the starting value first,
      // then decide once by "user non-empty > refDefault > the product's main unit"; filling main first the other way
      // hides the upstream default unit that was really declared, and both are legal candidates, so the database does not error.
      for (const location of unitChoices.get(site.path) ?? []) {
        const targetRow = rowAt(resolvedHeader, resolvedLines, location, what);
        const submittedRow =
          location.table === null
            ? filled.header
            : filled.lines[location.table]?.[location.row ?? -1];
        if (!submittedRow) {
          fail(`${what}: the unit-choice input coordinate "${location.path}" cannot find the line row — the declaration and the written row order disagree`);
        }
        try {
          const resolved = resolveUnitChoice(
            target.schema,
            lookup.snapshot,
            submittedRow[location.field.key],
            targetRow[location.field.key],
            unitChoiceIdentitiesOf(target.schema, choiceSets),
          );
          targetRow[location.field.key] = resolved.value;
          targetRow[location.field.unitChoice!.factorInto] = resolved.factor;
        } catch (error) {
          if (!(error instanceof SchemaError)) throw error;
          issues.push({
            path: location.path,
            label: location.label,
            code: "ENUM_NOT_IN_OPTIONS",
            message: `"${location.label}" cannot determine a unit from the selected product: ${error.message}`,
          });
        }
      }
      if (site.companion === null) continue;
      const owner = lookup.owner;
      if (!owner) {
        fail(`${what}: the line-level reference "${site.id}" was found but has no bill_id — the query projection and the existence judgment disagree`);
      }
      const row = resolvedLines[site.companion.table]?.[site.companion.row];
      if (!row) {
        fail(
          `${what}: companion-reference coordinate ${site.companion.table}[${String(site.companion.row)}].${site.companion.field} ` +
            `cannot find the corresponding line row — the row order of refSitesOf and prepareWrite disagree`,
        );
      }
      const prior = row[site.companion.field];
      if (prior !== undefined && prior !== owner) {
        fail(
          `${what}: companion reference "${site.companion.field}" resolved to two upstream documents (${String(prior)} / ${owner}) — ` +
            `the declaration layer must not allow several refLines to share one companion column`,
        );
      }
      row[site.companion.field] = owner;
    }
  };

  applySites(ready, lookups);

  // Judge that batch of candidate filters only after the system-supplied values are filled. Three points:
  //   · **The coordinates did not change**, so the lock is not taken again: that pass of `writeLockCoordinates` computed by `site.id`,
  //     independent of the filter (the comment there says so too), and not one word of this batch's ids moved;
  //   · evaluation still goes through **the same** `resolveRefFilter` (`recheckRefSiteFilters` only changes the context),
  //     so the candidate side and the write side cannot drift — that is exactly why this capability exists;
  //   · it is placed **before** the second hop (`chainedRefSitesOf`): this batch may carry snapshots of its own,
  //     and entering the second hop after they are filled lets the second hop see every value already resolved.
  //     A leftover gap is recorded as it is: if an operand points at a snapshot that "is frozen only on the second hop", this round still cannot read a value ⇒
  //     it still reports `REF_FILTER_PENDING` (it sounds, and does not let it through silently). The whole warehouse hits 0 today; if it really appears,
  //     the right fix is to judge it at modeling time (that chain needs a third hop, and the write path has only two), not to add a third round here.
  if (deferred.length > 0) {
    const rechecked = recheckRefSiteFilters(
      deferred,
      storedHeader === null ? resolvedHeader : { ...storedHeader, ...resolvedHeader },
      resolvedLines,
    );
    const deferredLookups = await lookupRefSites(exec, identity, registry, rechecked, timezone, visibility, unitChoicePaths);
    applySites(rechecked, deferredLookups);
  }

  // Second hop: a ref filled by the first hop's snapshot / companion relation, then its second-stage consumers are honored:
  //   · a snapshot dependency (such as operationId → pieceRate);
  //   · unitChoice (such as source row → productId → unit/factor → calculate baseQty).
  // Both must happen before materializeLineCalculations below; a missing factor is not allowed to fall back to 1.
  // The lock order was already arranged by the first hop's coordinates; a chained target (product / operation master data) is a different lock axis from a document, and is looked up again as needed.
  const chained = chainedRefSitesOf(schema, resolvedHeader, resolvedLines, new Set(sites.map((site) => site.path)));
  if (chained.length > 0) {
    const chainedLookups = await lookupRefSites(exec, identity, registry, chained, timezone, visibility, unitChoicePaths);
    applySites(chained, chainedLookups);
  }

  // An empty reference of an optional snapshot is not "resolution was missed"; it is an explicit business state: the target value must be normalized to null.
  // A header save is a patch, and without the match it must not touch an existing snapshot; lines are always replaced as a whole table, so each row is whole.
  Object.assign(
    resolvedHeader,
    missingOptionalSnapshotValues(schema.fields, resolvedHeader, storedHeader === null ? "whole" : "patch"),
  );
  for (const table of schema.fields) {
    if (table.type !== "subtable" || table.fields === null) continue;
    for (const row of resolvedLines[table.key] ?? []) {
      Object.assign(row, missingOptionalSnapshotValues(table.fields, row, "whole"));
    }
  }

  if (issues.length) throw new BillInvalidError(what, issues);
  issues.push(...materializeLineCalculations(schema, resolvedLines));
  if (issues.length) throw new BillInvalidError(what, issues);
  return { header: resolvedHeader, lines: resolvedLines };
}

interface RefLookup {
  readonly found: boolean;
  /** The header id a `refLine` belongs to; null for an ordinary `ref`. */
  readonly owner: string | null;
  /** Source fields of snapshot / refDefault, from the same SQL projection as found/owner. */
  readonly snapshot: Readonly<Record<string, unknown>>;
  /**
   * The record **exists**, but it does not satisfy the candidate filter this cell declared (`refFilter`).
   *
   * 🔴 Reported apart from `found: false`, because the two sentences are completely different: "does not exist" points the user at creating one,
   * and "does not meet the condition" points the user at picking another. Combined into one sentence, a person who picked a workshop as the "production factory"
   * is told that workshop does not exist — and they created it in the organization tree yesterday.
   */
  readonly filtered: boolean;
  /** Which conditions were not satisfied when `filtered`; empty when not filtered. The refusal copy reports only this copy. */
  readonly failedFilters: readonly RefFilterCondition[];
}

/**
 * Expand a line-closing condition into an ordinary `id in (...)`.
 *
 * In the declaration `id: { from: "$line.planId", through: "lines", field: "productId" }`,
 * after evaluation `values` is still the plan id; this reads that document's lines and replaces them with product ids.
 * Both the candidate SQL and the write-side JS comparison consume only the expanded copy.
 */
async function expandRefFilterConditions(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  conditions: readonly RefFilterCondition[],
  timezone: string,
  visibility: "actor" | "tenant" = "actor",
): Promise<readonly RefFilterCondition[]> {
  const out: RefFilterCondition[] = [];
  for (const condition of conditions) {
    const via = condition.via;
    if (via === undefined) {
      out.push(condition);
      continue;
    }
    const entity = via.entity;
    if (typeof entity !== "string" || entity === "") {
      fail(`a candidate-filter line closing is missing the upstream module — bindRefFilterViaEntities should already have filled it`);
    }
    const billIds = [
      ...new Set(condition.values.filter((value): value is string => typeof value === "string" && value !== "")),
    ];
    if (billIds.length === 0) {
      out.push({ field: condition.field, values: [] });
      continue;
    }
    const source = registry.get(entity);
    const table = source.lines.get(via.through);
    if (!table) fail(`line closing: module "${entity}" has no line table "${via.through}" — the declaration-layer gate should already have stopped it`);
    const columns = getTableColumns(table as unknown as PgTable);
    const column = columns[via.sourceField];
    if (!column) {
      fail(`line closing: module "${entity}" line "${via.through}" has no column "${via.sourceField}" — the declaration-layer gate should already have stopped it`);
    }
    const scope = inArray(table.billId, billIds);
    const rows = (await exec
      .select({ value: column })
      .from(table as unknown as PgTable)
      .innerJoin(source.header, eq(table.billId, source.header.id))
      .where(
        visibility === "tenant"
          ? scopedWhere(source.header, identity, scope)
          : moduleScopedWhere(source, identity, timezone, scope),
      )) as { value: unknown }[];
    const values = [
      ...new Set(
        rows
          .map((row) => row.value)
          .filter((value): value is string => typeof value === "string" && value !== ""),
      ),
    ];
    out.push({ field: condition.field, values });
  }
  return out;
}

/**
 * Existence of a batch of references, and the header a `refLine` belongs to.
 *
 * Write resolution and the Action's existing-row check share this one query. Writing it twice means:
 * a new document can derive the companion ref correctly, while an old document's execution judges belonging with another join, and the meaning forks across a migration.
 */
async function lookupRefSites(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  sites: readonly RefSite[],
  timezone: string,
  visibility: "actor" | "tenant" = "actor",
  unitChoicePaths: ReadonlySet<string> = new Set(),
): Promise<ReadonlyMap<RefSite, RefLookup>> {
  const byTarget = new Map<string, RefSite[]>();
  for (const site of sites) {
    // JSON encoding makes the entity / through group key injective, and it does not carry a NUL into PostgreSQL text.
    const key = JSON.stringify([site.entity, site.through]);
    const group = byTarget.get(key);
    if (group) group.push(site);
    else byTarget.set(key, [site]);
  }

  const out = new Map<RefSite, RefLookup>();
  for (const group of byTarget.values()) {
    const head = group[0];
    if (!head) continue;
    const target = registry.get(head.entity);
    const ids = [...new Set(group.map((site) => site.id))];
    const unitSetFields = group.some((site) => unitChoicePaths.has(site.path))
      ? Object.values(target.schema.unitSet ?? {})
      : [];
    const snapshotFields = [
      ...new Set(
        group.flatMap((site) => [
          ...site.snapshots.map((snapshot) => snapshot.sourceField),
          ...(site.defaults ?? []).map((refDefault) => refDefault.sourceField),
          ...(unitChoicePaths.has(site.path) ? unitSetFields : []),
        ]),
      ),
    ];

    // 🔴 Filter columns **come back with the same query**, and no extra round trip is sent for them.
    // Each site's condition may differ (`$line.` is evaluated per row), so SQL is only responsible for fetching the columns,
    // and "does this row meet this cell's condition" is compared per site in JS (`failedRefFilterConditions`) —
    // the same comparison meaning as the candidate side, and the refusal copy reports only the ones not satisfied.
    const expandedFilters = new Map<RefSite, readonly RefFilterCondition[]>();
    for (const site of group) {
      expandedFilters.set(
        site,
        await expandRefFilterConditions(exec, identity, registry, site.filter.conditions, timezone, visibility),
      );
    }
    const filterFields = [
      ...new Set(group.flatMap((site) => (expandedFilters.get(site) ?? []).map((condition) => condition.field))),
    ];

    if (head.through === null) {
      const condition = inArray(target.header.id, ids);
      const columns = getTableColumns(target.header);
      const selection: Record<string, PgColumn | SQL> = { id: target.header.id };
      for (const key of snapshotFields) {
        // A custom field has no column of its own on the source document either: the value is packed in `custom` jsonb.
        // Pass-through (origin=inherit) composes exactly one snapshot, so this branch must recognize it,
        // or a correctly configured pass-through reports 500 as "the source table has no such column", while the configuration itself is completely right.
        if (isCustomFieldKey(key)) {
          const container = columns["custom"];
          if (!container) fail(`looking up a reference: module "${head.entity}" has not opened custom fields, and "${key}" cannot be read`);
          selection[key] = resolveOperandum(registry, headerScope(target), key, "looking up a reference").expr;
          continue;
        }
        const column = columns[key];
        if (!column) fail(`looking up a reference: module "${head.entity}" header has no snapshot source column "${key}"`);
        selection[key] = column;
      }
      Object.assign(
        selection,
        refFilterColumnsOf(
          target,
          group.flatMap((s) => [...(expandedFilters.get(s) ?? [])]),
          `looking up the candidate-filter columns of "${head.entity}"`,
        ),
      );
      const rows = (await exec
        .select(selection)
        .from(target.header)
        .where(
          visibility === "tenant"
            ? scopedWhere(target.header, identity, condition)
            : moduleScopedWhere(target, identity, timezone, condition),
        )) as (Record<string, unknown> & { id: string })[];
      const found = new Map(rows.map((row) => [row.id, row]));
      for (const site of group) {
        const row = found.get(site.id);
        const snapshot: Record<string, unknown> = {};
        for (const key of snapshotFields) snapshot[key] = row?.[key];
        const failed =
          row === undefined ? [] : failedRefFilterConditions(row, expandedFilters.get(site) ?? []);
        out.set(site, {
          found: row !== undefined,
          owner: null,
          snapshot,
          filtered: failed.length > 0,
          failedFilters: failed,
        });
      }
      continue;
    }
    if (filterFields.length) {
      // The declaration layer already limits refFilter to ref; reaching here means that gate leaked.
      // Ignoring it silently means a declared filter does not take effect on the **write side**, while it does on the candidate side —
      // exactly the direction of "the dropdown filtered it out, and a hand-typed id can still come in".
      fail(`looking up a reference: a candidate filter appeared on the line-level reference "${head.entity}.${head.through}" — the declaration-layer gate should already have stopped it`);
    }

    const lineTable = target.lines.get(head.through);
    if (!lineTable) {
      fail(`looking up a reference: module "${head.entity}" has no line table "${head.through}" — the declaration-layer gate should already have stopped it`);
    }
    // A line table is always reached through the header's scope; bill_id is taken at the same time, as the only belonging fact of a refLine.
    const condition = inArray(lineTable.id, ids);
    const columns = getTableColumns(lineTable as unknown as PgTable);
    const selection: Record<string, PgColumn | SQL> = { id: lineTable.id, billId: lineTable.billId };
    for (const key of snapshotFields) {
      if (isCustomFieldKey(key)) {
        const sourceTable = target.schema.fields.find((field) => field.type === "subtable" && field.key === head.through);
        if (!sourceTable) fail("looking up a reference: the source line of the custom field cannot be found");
        selection[key] = resolveOperandum(registry, lineScope(target, sourceTable), key, "looking up a reference").expr;
        continue;
      }
      const column = columns[key];
      if (!column) fail(`looking up a reference: module "${head.entity}" line "${head.through}" has no snapshot source column "${key}"`);
      selection[key] = column;
    }
    const rows = (await exec
      .select(selection)
      .from(lineTable)
      .innerJoin(target.header, eq(lineTable.billId, target.header.id))
      .where(
        visibility === "tenant"
          ? scopedWhere(target.header, identity, condition)
          : moduleScopedWhere(target, identity, timezone, condition),
      )) as { id: string; billId: string }[];
    const owners = new Map(rows.map((row) => [row.id, row]));
    for (const site of group) {
      const row = owners.get(site.id) as (Record<string, unknown> & { billId?: string }) | undefined;
      const snapshot: Record<string, unknown> = {};
      for (const key of snapshotFields) snapshot[key] = row?.[key];
      const owner = row?.billId;
      out.set(site, {
        found: row !== undefined,
        owner: owner ?? null,
        snapshot,
        filtered: false,
        failedFilters: [],
      });
    }
  }
  return out;
}

// ── unique fields: judge "filled a duplicate" before it reaches the database ──────────────────────────────
//
// 🔴 **The same layer and the same shape** as `resolveRefs`, the same source of the criterion: the kernel derives "which coordinates to check" from the declaration
// (`uniqueSitesOf`), and the server looks them up. If the server scanned the fields itself, adding a unique field later
// and forgetting to change this would make that field's duplicate check **silently not run** — the user filling a duplicate still gets 201.
//
// 🔴 Why the database unique index cannot be the validator (the hard rule in AGENTS.md): an index only recognizes the column name
// (`barcode`) and not the label ("barcode"), it aborts on the first conflict so it reports only one at a time,
// and it has no way to mark the conclusion on that cell of the form. The most expensive one: treating "the database refused" directly as a user-input
// error and returning 400 turns a real server bug (a platform column left unfilled, the generator building the wrong column) silently into "your input is wrong".
//
// So the two layers divide into **classifier + fallback**, and the wording and the type of the two errors stay apart:
//   · the application layer finds a conflict ⇒ `BillInvalidError` → 400 + per-field `UNIQUE_DUPLICATE` ("this value is taken")
//   · after the check it still hits the index ⇒ it can only be concurrency (another write committed between the check and the write) ⇒
//     `UniqueViolationError` → 409 "please retry".
// Mixing the two into one sentence means a real concurrency problem is forever treated as a user-input error, and the user changing it any number of times stays the same.
//
// 🔴 The scope is the **tenant** (`scopedWhere`), deliberately different from `resolveRefs`'s `moduleScopedWhere` —
// they judge different things: a reference asks "can you see it" (it follows the data scope, word-for-word the same as the dropdown),
// and uniqueness asks "is this value taken inside this tenant", which is a physical fact independent of who is looking.
// Looking it up by data scope, a person on the `self` grade cannot see a colleague's record ⇒ the duplicate check lets it through and the index refuses,
// and the two lines of defense of one save give two conclusions.
//
// 🔴 uniqueProbe takes only each coordinate's `bool_or`: the result set has no id / code of the occupying row.
// The occupying row's identity is structurally not taken. Kernel unique is a tenant-level fact (`scopedWhere`), and returning the occupying record's
// primary / status to the caller sends out a file coordinate outside the current user's data scope.
// Who occupies this unique value has its exit on the business page's restricted list (such as the team page "link an existing person"),
// and that path uses `moduleScopedWhere`, so the permission projection is naturally correct; an administrator who can see it can handle it there,
// and one who cannot see it cannot change it even if told the code.
// A ref unique's conflict copy dereferences only **the value submitted this time** (the target module's `views.list.referenceLabel`),
// which is the id the user just filled in, not the occupying row. A non-ref still only says "this value is taken".

/** Probe column name. `uniqueProbe` and the result reading must use the same copy; assembling it twice silently reads undefined. */
function probeKey(index: number): string {
  return `u${String(index)}`;
}

/**
 * On a patch write, complete a composite unique coordinate from the existing row in the database.
 *
 * Peers must not be filled only when the cell that carries `unique:true` changes: any dimension of a composite coordinate changing
 * occupies a new unique coordinate. For example changing only supplierId in `effectiveDate + supplierId + productId`,
 * with the date untouched, must still be duplicate-checked in the application layer first, and must not wait for the database unique index to report 409.
 * A single-column unique is unaffected (a unique field that did not appear in the patch is not checked anyway).
 */
export function mergeUniqueWithPeers(
  schema: { readonly fields: readonly { readonly key: string; readonly unique: boolean; readonly uniqueWith: readonly string[] | null }[] },
  patch: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...patch };
  for (const field of schema.fields) {
    if (!field.unique || field.uniqueWith === null || field.uniqueWith.length === 0) continue;
    const coordinate = [field.key, ...field.uniqueWith];
    if (!coordinate.some((key) => Object.hasOwn(patch, key))) continue;
    for (const key of coordinate) {
      if (Object.hasOwn(out, key)) continue;
      if (!Object.hasOwn(existing, key)) continue;
      out[key] = existing[key];
    }
  }
  return out;
}

/**
 * A row id in a whole-table replace is only a "proof of the same fact", not a field the client may write.
 * An existing id must belong to the same line table of the current document and may appear only once; a missing id is what means a new fact.
 */
export function replacementLineIdentities(
  next: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  existing: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  what: string,
): ReadonlyMap<string, ReadonlySet<string>> {
  const out = new Map<string, ReadonlySet<string>>();
  for (const [table, rows] of Object.entries(next)) {
    const existingIds = new Set<string>();
    for (const row of existing[table] ?? []) {
      const id = row["id"];
      if (typeof id !== "string" || !id) {
        fail(`${what}: a stored line of "${table}" has a row with no stable id, so whether the historical fact is unchanged cannot be judged`);
      }
      if (existingIds.has(id)) fail(`${what}: stored lines of "${table}" contain a duplicate id "${id}"`);
      existingIds.add(id);
    }
    const retained = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (!Object.hasOwn(row, "id")) continue;
      const id = row["id"];
      if (typeof id !== "string" || !id) {
        fail(`${what}: row ${String(index + 1)} of line "${table}" has an id that is not a valid existing-row coordinate`);
      }
      if (!existingIds.has(id)) {
        fail(`${what}: row ${String(index + 1)} of line "${table}" has id "${id}", which does not belong to the current document; a system row id cannot be specified or rewritten by the client`);
      }
      if (retained.has(id)) {
        fail(`${what}: line "${table}" submits the existing row id "${id}" more than once`);
      }
      retained.add(id);
    }
    out.set(table, retained);
  }
  return out;
}

function uniqueSiteMatch(tables: ModuleTables, site: UniqueSite, what: string): SQL {
  const column = tables.columns[site.key];
  if (!column) {
    fail(`${what}: unique field "${site.key}" has no corresponding column — the declaration and tables/ are out of sync; run yarn gen:db first`);
  }
  const parts: SQL[] = [sql`${column} = ${site.value}`];
  for (const peer of site.with) {
    const peerCol = tables.columns[peer.key];
    if (!peerCol) {
      fail(`${what}: composite-unique companion column "${peer.key}" has no corresponding column — the declaration and tables/ are out of sync; run yarn gen:db first`);
    }
    parts.push(sql`${peerCol} = ${peer.value}`);
  }
  // A single column = one cell equal; a composite = every companion column equal together with this field.
  return parts.length === 1 ? parts[0]! : and(...parts)!;
}

/**
 * The one duplicate-check query (condition + projection).
 *
 * **Exported only so these two invariants have a direct regression line** (same as `updateValues`): whether the tenant is in the condition,
 * and whether an update excludes itself, can be judged from the serialized SQL alone, and them going wrong has no symptom on the screen —
 * the first is visible only across tenants, and the second waits until someone saves a document that **did not change** that field.
 *
 * One aggregate query rather than a round trip per field: however many unique fields a module has, they take one trip.
 * The projection is only `bool_or`; the occupying row's identity is not taken.
 */
export function uniqueProbe(
  tables: ModuleTables,
  identity: Identity,
  sites: readonly UniqueSite[],
  excludeId: string | null,
  what: string,
): { readonly selection: Record<string, SQL>; readonly where: SQL } {
  const selection: Record<string, SQL> = {};
  const matches: SQL[] = [];
  sites.forEach((site, index) => {
    const hit = uniqueSiteMatch(tables, site, what);
    matches.push(hit);
    selection[probeKey(index)] = sql<boolean>`bool_or(${hit})`;
  });
  const anyHit = or(...matches);
  // An or of an empty condition is undefined, and querying with an empty condition queries the whole table — the caller must judge empty first.
  if (!anyHit) fail(`${what}: duplicate-checking while there is no unique coordinate to check — the caller should have judged empty first`);
  return {
    selection,
    where: scopedWhere(
      tables.header,
      identity,
      anyHit,
      // 🔴 Exclude itself on update: otherwise saving a document whose barcode **was not changed** is told "barcode is duplicated" —
      // the one occupying that value is itself. This goes wrong only on the save path, and create never sees it.
      excludeId === null ? undefined : ne(tables.header.id, excludeId),
    ),
  };
}

/** The human form of a value. String() of a Date is a long sentence in the local time zone, not what was filled in. */
function probeValueText(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * The sentence a person sees for a unique conflict. A ref dereferences only the value submitted this time, and does not carry the occupying row's identity.
 */
export function uniqueDuplicateMessage(input: {
  readonly schema: { readonly code: string; readonly label: string };
  readonly site: UniqueSite;
  readonly field: Pick<Field, "type">;
  readonly submittedText: string;
}): string {
  const { schema, site, field, submittedText } = input;
  if (field.type !== "ref") {
    const valueText = probeValueText(site.value);
    return site.with.length === 0
      ? `the ${site.label} you entered, "${valueText}", already exists; enter it again`
      : `the "${valueText}" filled in "${site.label}" is already registered on another ${schema.label} — ` +
        `given the same "${site.with.map((peer) => peer.label).join(" × ")}", ${site.label} cannot be repeated; check it and use another`;
  }
  if (submittedText === "") {
    fail(`module "${schema.code}" unique field "${site.label}" cannot compose a human reference label`);
  }
  return site.with.length === 0
    ? `the ${site.label} you entered, "${submittedText}", already exists; enter it again`
    : `the "${submittedText}" filled in "${site.label}" is already registered on another ${schema.label} — ` +
      `given the same "${site.with.map((peer) => peer.label).join(" × ")}", ${site.label} cannot be repeated; check it and use another`;
}

async function loadUniqueRefLabel(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  field: Field,
  site: UniqueSite,
  what: string,
): Promise<string> {
  const targetCode = field.ref;
  if (typeof targetCode !== "string" || targetCode === "") {
    fail(`${what}: field "${field.key}" is a ref but has no target module`);
  }
  if (typeof site.value !== "string" || site.value === "") {
    fail(`${what}: unique field "${site.label}" is not a valid reference id, and cannot be dereferenced`);
  }
  const target = registry.get(targetCode);
  const labelKeys = labelFieldsOf(target.schema);
  const selection: Record<string, PgColumn> = { id: target.header.id };
  for (const key of labelKeys) {
    const column = target.columns[key];
    if (!column) fail(`${what}: module "${target.schema.code}" reference-label field "${key}" has no corresponding column`);
    selection[key] = column;
  }
  const rows = await exec
    .select(selection)
    .from(target.header)
    .where(scopedWhere(target.header, identity, eq(target.header.id, site.value)))
    .limit(2);
  if (rows.length === 0) {
    fail(`${what}: reference target "${target.schema.label}" (id "${site.value}") does not exist, so the duplicate value of "${site.label}" cannot be said in human wording`);
  }
  if (rows.length !== 1) {
    fail(`${what}: reference target "${target.schema.label}" (id "${site.value}") returned ${String(rows.length)} rows — the primary key is broken`);
  }
  const row = rows[0] as Row;
  return composeRefLabel(
    target.schema,
    site.value,
    labelKeys.map((key) => labelText(target.schema, key, row[key])),
  );
}

async function assertNoDuplicates(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  tables: ModuleTables,
  header: Readonly<Record<string, unknown>>,
  /** On save, the current document id (exclude itself); null on create. */
  excludeId: string | null,
  what: string,
): Promise<void> {
  const sites = uniqueSitesOf(tables.schema, header);
  if (!sites.length) return;
  const { selection, where } = uniqueProbe(tables, identity, sites, excludeId, what);
  const rows = await exec.select(selection).from(tables.header).where(where);
  const row = rows[0] as Record<string, unknown> | undefined;
  // An aggregate with no group by always returns one row (each probe is null when not one row hit). Really having none means the query was broken,
  // and it **must not** be let through as "no conflict" — that silently turns off a line of defense.
  if (!row) fail(`${what}: the uniqueness query returned no result — the aggregate projection was broken`);

  const issues: BillIssue[] = [];
  for (const [index, site] of sites.entries()) {
    if (row[probeKey(index)] !== true) continue;
    const field = tables.schema.fields.find((item) => item.key === site.key);
    if (!field) fail(`${what}: unique coordinate "${site.key}" has no corresponding field on the module`);
    const submittedText =
      field.type === "ref" ? await loadUniqueRefLabel(exec, identity, registry, field, site, what) : probeValueText(site.value);
    issues.push({
      path: site.path,
      label: site.label,
      code: "UNIQUE_DUPLICATE",
      message: uniqueDuplicateMessage({
        schema: tables.schema,
        site,
        field,
        submittedText,
      }),
    });
  }
  if (issues.length) throw new BillInvalidError(what, issues);
}

// ── attachments: the object key must belong to this tenant ──────────────────────────────────────────────
//
// 🔴 **The same layer, the third half of the same pattern** as reference existence and the uniqueness duplicate check: the kernel (`attachmentSitesOf`)
// derives "which coordinates to check" from the declaration, and this layer judges them with the identity. The difference is zero IO —
// belonging is written in the key (see `storage/objectKey.ts`), and there is no need to ask the bucket once.
//
// 🔴 Missing this layer is the **most expensive** consequence of this delivery, and it has no symptom at all:
// the value of an attachment cell is JSON the client filled itself, and it can put any object key in it.
// Putting another tenant's key into one's own document, then downloading the file with a document **one is fully allowed to read** —
// the download route's two read-isolation layers (`moduleScopedWhere` + `canExposeField`) judge each one and pass each one,
// because that document really is theirs. The only place that can stop it is this check before the write.
//
// It is judged on the write path rather than the read path, because the read path cannot judge it: the key already read is in the database, and by then
// "how it got in" can no longer be known. The write path is the only entrance of this data.

/**
 * **Exported only so this invariant has a direct regression line** (same as `uniqueProbe` / `updateValues`):
 * it is a pure function, zero IO, and what it blocks is the most expensive over-privilege path in this delivery —
 * if it could be verified only by starting a real-database transaction for each of create/save, the practical result would mostly be that it has not one test case.
 */
export function assertAttachmentsOwned(
  identity: Identity,
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: LineRows,
  what: string,
): void {
  for (const site of attachmentSitesOf(schema, header, lines)) {
    for (const ref of site.refs) {
      if (isKeyOwnedBy(identity.tenantId, ref.key)) continue;
      // 🔴 Do not echo "which tenant it belongs to": that confirms that tenant and that object exist.
      // The key itself can be echoed — they just submitted it (the same judgment as `pgError.ts`).
      fail(
        `${what}: the attachment "${ref.key}" in "${site.label}" is not an object of this tenant, and the write is refused. ` +
          `An attachment's object key is issued by the server at upload time, and the client must not assemble it itself`,
      );
    }
  }
}

export interface BillCoordinate {
  readonly module: string;
  readonly id: string;
}

/** The document transaction lock key shared by Action and save. */
export function billActionLockKey(tenantId: string, module: string, id: string): string {
  return JSON.stringify([tenantId, "bill", module, id]);
}

/**
 * The **global order** of lock keys: UTF-16 code-unit order (`<` / `>`), not `localeCompare`.
 *
 * 🔴 Deadlock avoidance needs not "some sort", but **one total order used word-for-word in every place**.
 * `localeCompare` depends on ICU's collation table (case, accents, and digit runs are all treated specially),
 * and it is **not the same order** as the comparison in "is this key greater than the largest key I already hold" —
 * once the two orders split, the sort says "ascending" and the watermark says "descending", and the defense looks completely normal on both sides.
 * Code-unit order is a pure function, independent of locale, the same as `Array.sort`'s default order, and the key itself is
 * an ASCII structure string from `JSON.stringify`, so nothing is lost in readability.
 */
export function compareLockKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A set of coordinates → deduplicated lock keys sorted in global order. A pure function, exported only so the lock-order invariant has a direct regression line. */
export function orderedLockKeys(tenantId: string, coordinates: readonly BillCoordinate[]): readonly string[] {
  return [...new Set(coordinates.map((coord) => billActionLockKey(tenantId, coord.module, coord.id)))].sort(
    compareLockKeys,
  );
}

/**
 * The coordinate-lock **ledger** of one transaction.
 *
 * ## What it solves
 *
 * Deadlock avoidance has only one sufficient condition: **the order a transaction takes locks must be strictly ascending**. The proof is the standard one —
 * if a wait cycle T1→T2→…→Tn→T1 exists, then the key each Ti is waiting for is greater than every key it already holds,
 * so one trip around the cycle gives k₁ < k₂ < … < kₙ < k₁, a contradiction.
 *
 * 🔴 **"Each batch sorts itself" does not satisfy this condition**, and that is exactly the root cause of the measured deadlock:
 * `resolveRefs` sorts only inside **its own batch** of coordinates (one batch per `createOne`),
 * while the Planner does **4 `createOne`s in a row inside one outer transaction**. There is no constraint between batches,
 * so after batch 1 takes `warehouse:wh-sh` (sorted far back), batch 2 only then takes
 * `product:p-bolt-m8` (sorted far forward) — an ordinary single-batch writer on the other side (for example one
 * `stockIn`: line products + header warehouse, which sorts to product → warehouse) forms AB-BA with it.
 * That `40P01 ... [advisory lock A]; blocked by ...[advisory lock B]` in the server log is it.
 *
 * ## The treatment
 *
 * (1) **Cure the root**: a multi-batch path (the Planner) computes **every coordinate the whole outer transaction will take** at once before starting,
 *    and takes them once in global order (`lockWriteSet`). Keys later batches' `resolveRefs` ask for
 *    are all already held ⇒ not one new acquisition happens ⇒ an inverted order cannot be taken, structurally.
 *
 * (2) **Fallback**: if a key lower than the watermark still appears (a new command type added later,
 *    `preselectRefs` filling a reference on the spot, or a document id this transaction itself just created),
 *    this **does not wait** — it uses `pg_try_advisory_xact_lock` instead. Not granted, it throws
 *    `ConcurrencyConflictError` (409 "retry as-is"). Not waiting ⇒ a cycle cannot form ⇒
 *    **deadlock no longer exists structurally in the whole system**, rather than becoming less probable.
 *
 * 🔴 (2) is **not** "add a retry": the server retries not once, and whether it is idempotent is the caller's decision.
 * What it replaces is the shape "a random deadlock 500" — the same one failure, from then on with a name and a way to handle it.
 * And it is reachable only when (1) leaked; on a path (1) covers, it is never walked.
 *
 * The ledger is **transaction-scoped**: `pg_advisory_xact_lock` is held until the transaction ends, so "already taken"
 * is always true inside the transaction (taking it again is a harmless reentrant count, but it wastes one round trip).
 * Outside this transaction the ledger must be discarded — guaranteed by `assemble()` creating a new one every time it opens a transaction.
 */
export class BillLockLedger {
  readonly #held = new Set<string>();
  readonly #acquired: string[] = [];
  #highWater: string | null = null;

  /**
   * Lock keys this transaction actually took, **in order**.
   *
   * @internal Exported only for the regression line: a wrong lock order does not error, it only becomes a random 500 under concurrency.
   */
  get acquired(): readonly string[] {
    return this.#acquired;
  }

  async acquire(exec: Executor, identity: Identity, coordinates: readonly BillCoordinate[]): Promise<void> {
    for (const key of orderedLockKeys(identity.tenantId, coordinates)) {
      if (this.#held.has(key)) continue;
      if (this.#highWater === null || compareLockKeys(key, this.#highWater) > 0) {
        await exec.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        this.#highWater = key;
      } else {
        const rows = (await exec.execute(
          sql`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as ok`,
        )) as unknown as readonly Record<string, unknown>[];
        const row = Array.isArray(rows) ? rows[0] : undefined;
        const granted = row?.["ok"] === true || row?.["ok"] === "t";
        if (!granted) {
          throw new ConcurrencyConflictError(
            `taking the document coordinate lock ${key} collided with another concurrent write: this transaction already holds ${this.#highWater}, which sorts after it, ` +
              `and to avoid making a deadlock this **does not wait**, and rolls back directly. **Retry as-is** — this request itself is valid. ` +
              `If it keeps happening, some write path did not lock every coordinate it needs at once (it should go through lockWriteSet), and that is for the server to fix`,
            "40P01",
            null,
          );
        }
      }
      this.#held.add(key);
      this.#acquired.push(key);
    }
  }
}

function companionValue(record: BillRecord, site: RefSite, what: string): unknown {
  const companion = site.companion;
  if (companion === null) return undefined;
  const row = record.lines[companion.table]?.[companion.row];
  if (!row) {
    fail(
      `${what}: companion-reference coordinate ${companion.table}[${String(companion.row)}].${companion.field} ` +
        `cannot find the corresponding line row — the row order of refSitesOf and the read model disagree`,
    );
  }
  return row[companion.field];
}

async function actionCoordinates(
  exec: Executor,
  identity: Identity,
  registry: ModuleRegistry,
  module: string,
  record: BillRecord,
  validate: boolean,
  timezone: string,
): Promise<readonly BillCoordinate[]> {
  const schema = registry.get(module).schema;
  const what = `execute "${module}" #${record.id}`;
  const sites = refSitesOf(schema, record.header, record.lines);
  // An Action operator only needs to be able to operate the current document, and does not also need list visibility of every source master-data record.
  // What is checked here is a same-tenant physical fact; a concrete business read is still executed by ruleQuery within the position scope.
  const lookups = await lookupRefSites(exec, identity, registry, sites, timezone, "tenant");
  const coordinates = new Map<string, BillCoordinate>();
  const add = (coord: BillCoordinate): void => {
    coordinates.set(JSON.stringify([coord.module, coord.id]), coord);
  };
  add({ module, id: record.id });

  for (const site of sites) {
    const lookup = lookups.get(site);
    if (!lookup) fail(`${what}: reference "${site.path}" has no lookup result — the reference grouping and the result projection disagree`);
    if (validate && !lookup.found) {
      fail(`${what}: the ${site.entity}${site.through ? `.${site.through}` : ""}#${site.id} that reference "${site.path}" points at does not exist`);
    }

    if (site.through === null) {
      // An ordinary ref's value is the referenced header id. Lock it, so disabling master data and approving a document cannot each see their own instant.
      add({ module: site.entity, id: site.id });
      continue;
    }

    const storedOwner = companionValue(record, site, what);
    if (typeof storedOwner === "string" && storedOwner !== "") {
      // Existing dirty data may have stored the wrong header; lock the wrong coordinate too on the first fetch, then refuse it explicitly.
      add({ module: site.entity, id: storedOwner });
    }
    if (lookup.owner !== null) add({ module: site.entity, id: lookup.owner });
    if (validate && storedOwner !== lookup.owner) {
      fail(
        `${what}: ${site.path} actually belongs to ${site.entity}#${String(lookup.owner)}, ` +
          `but the companion reference stored ${JSON.stringify(storedOwner)} — the source disagrees across documents, and execution is refused`,
      );
    }
  }
  // Sorting here is only so the two comparisons of `coordinateFingerprint` are word-for-word comparable; the real lock-taking order
  // is the responsibility of `BillLockLedger` using the same `compareLockKeys` (see the note there).
  return [...coordinates.values()].sort((a, b) =>
    compareLockKeys(
      billActionLockKey(identity.tenantId, a.module, a.id),
      billActionLockKey(identity.tenantId, b.module, b.id),
    ),
  );
}

/**
 * Take a batch of coordinate locks. **Sorting and order are the ledger's responsibility**, and this no longer sorts each batch itself.
 *
 * 🔴 This function used to be "pg_advisory_xact_lock one by one in the order the caller gave", so "take them in global order"
 * was written as a sort at each of three call sites — and they guarantee order only **inside a batch**,
 * and nobody is responsible between batches. After the ledger, global order is a property of this layer, and a call site gives a **set**.
 */
async function lockBillCoordinates(
  exec: Executor,
  identity: Identity,
  ledger: BillLockLedger,
  coordinates: readonly BillCoordinate[],
): Promise<void> {
  await ledger.acquire(exec, identity, coordinates);
}

function coordinateFingerprint(identity: Identity, coordinates: readonly BillCoordinate[]): string {
  return JSON.stringify(coordinates.map((coord) => billActionLockKey(identity.tenantId, coord.module, coord.id)));
}

/**
 * The values to write on update. **Exported only so this invariant has a direct regression line** (see test/scope.test.ts):
 * it is the only implementation point of "one save must not change ownership", and it going wrong has no symptom on the screen.
 *
 * 🔴 It goes through scopedValues to get `requireIdentity`, but **the isolation columns must be dropped**:
 * `scopedValues` is a helper of insert shape, and it **asserts** ownership as the current identity. Put on an UPDATE it becomes
 * "whoever changed this data, it belongs to their organization" — a person in department B opens department A's document and saves,
 * and the document silently changes owner, with no abnormality on the screen. Changing ownership is a business action, not a side effect of save.
 */
/**
 * drizzle's `timestamp({ withTimezone: true })` is `mode: 'date'`, and the driver calls
 * `toISOString()` on the value. The value gate collects an ISO string into a Date, but a stamp (`setGeneratedHeader` /
 * `setStatus`'s `stampOnFirstEnter` / effective on create) does not go through that gate. The shape of sending a string in
 * is 500: `value.toISOString is not a function`. A date column is string mode; do not touch it.
 */
function driverTimestamps(schema: ModuleSchema, values: Row): Row {
  const declared = new Map(schema.fields.map((field) => [field.key, field]));
  let changed = false;
  const out: Row = { ...values };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") continue;
    const field = declared.get(key);
    if (field?.type !== "datetime") continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) {
      fail(`"${schema.label}" field "${field.label}" is not a parseable timestamp: "${value}"`);
    }
    out[key] = new Date(ms);
    changed = true;
  }
  return changed ? out : values;
}

export function updateValues(identity: Identity, values: Row, schema: ModuleSchema | null = null): Row {
  const { tenantId: _tenant, orgId: _org, ...rest } = scopedValues(identity, values);
  const timed = schema === null ? rest : driverTimestamps(schema, rest);
  const custom = customColumnValue(schema, timed);
  if (custom === null) return timed;
  // 🔴 **Merge rather than replace**: a patch that changes only one cell contains only that cell,
  // and writing it as the new `custom` silently clears the other custom fields on the same document.
  // Merge in the database with SQL `-` / `||`, which also avoids a concurrent overwrite between "read first, then write".
  const dropped = custom.drop.reduce<SQL>(
    (expr, key) => sql`${expr} - ${key}`,
    sql`coalesce("custom", '{}'::jsonb)`,
  );
  return {
    ...custom.rest,
    custom: Object.keys(custom.set).length === 0
      ? dropped
      : sql`${dropped} || ${JSON.stringify(custom.set)}::jsonb`,
  };
}

function initialStatus(schema: ModuleSchema): string {
  const initial = schema.lifecycle.statuses.find((s) => s.initial);
  // The validator guarantees there is exactly one initial status; really having none means the load-time gate was bypassed, and one must not be guessed.
  if (!initial) fail(`module "${schema.code}" has no initial status — a newly created document has nowhere to land a status`);
  return initial.key;
}

/**
 * A row read out → the type the field declared.
 *
 * 🔴 A PostgreSQL `numeric` comes out of postgres-js as a **string** (`"13600.0000"`), because numeric is
 * arbitrary precision and a JS number cannot hold every value. But the rest of this system — the rule engine's comparison,
 * a posted amount, `balance`'s return value, the renderer's dispatch by `field.type` — **all treat it as a number**.
 * The ledger repository has long converted it on read; the document repository did not, so the same "amount" is two types on the two paths.
 *
 * Not converting does not error: the screen shows a cell of "abnormal value", and a `>` in a rule becomes a string comparison
 * (`"9" > "10"` is true), and neither has any abnormal feature.
 *
 * If it cannot be converted, throw, and do not give `?? 0`: recording an unreadable amount as 0 is worse than not being able to read it.
 *
 * Precision: the range of `numeric(18,6)` can exceed `Number.MAX_SAFE_INTEGER`. That is a **tradeoff the whole system
 * has already made** (the ledger, the kernel, and the HTTP response are all numbers), and it is not newly introduced here. Really changing it to
 * decimal end to end has to change the kernel with it, and cannot be an exception on one repository — that would only split the two paths again.
 */
function decodeRow(fields: readonly Field[], row: Row, what: string): Row {
  const out: Row = { ...row };
  for (const field of fields) {
    if (field.type !== "number" && field.type !== "money" && field.type !== "percent" && field.type !== "datetime") continue;
    const raw = out[field.key];
    // datetime: the postgres driver deserializes a timestamp field into a JS Date,
    // but requireText in the planner requires typeof value === 'string'.
    // Convert it to an ISO string uniformly on the read path, so ctx.bill.header is always a string.
    if (field.type === "datetime") {
      if (raw instanceof Date) {
        if (!Number.isFinite(raw.valueOf())) {
          fail(`${what}: field "${field.label}" has an invalid Date value`);
        }
        out[field.key] = raw.toISOString();
      }
      continue;
    }
    if (typeof raw !== "string") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      fail(`${what}: field "${field.label}" value "${raw}" is not a number — the data in the database and the declared type disagree`);
    }
    out[field.key] = value;
  }
  return out;
}

/**
 * An aggregate row → `{ "field:aggregate": number | null }`.
 *
 * 🔴 `null` is "this batch cannot be computed" (no rows, or all empty), **not 0**:
 * a footer that shows "no data" as "total 0.00" makes a person think they filtered a batch of documents that cost nothing.
 * A value that is present but not a number throws — that is a SQL or data problem, and must not be treated as not computed.
 */
function decodeAggregates(
  module: string,
  specs: readonly SummarySpec[],
  row: Record<string, unknown>,
): Readonly<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  for (const spec of specs) {
    const key = summaryKey(spec);
    const raw = row[key];
    if (raw === null || raw === undefined) {
      out[key] = null;
      continue;
    }
    // A numeric comes out of postgres-js as a string, the same rule as decodeRow.
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      fail(`querying "${module}" aggregate "${key}" returned "${String(raw)}" — not a number, and it is not treated as 0`);
    }
    out[key] = value;
  }
  return out;
}

const INVARIANT_LINE_SUMMARY_MAX_ROWS = 10_000;

/** A single-value aggregate over a batch of rows already projected and decoded; used only inside a tenant-invariant line-table read. */
function invariantSummaryOfRows(
  module: string,
  through: string,
  rows: readonly Readonly<Record<string, unknown>>[],
  spec: SummarySpec,
): InvariantSummaryResult {
  const values = rows.flatMap((row) => {
    const raw = row[spec.field];
    if (raw === null || raw === undefined || raw === "") return [];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      fail(`system-invariant aggregate "${module}.${through}.${spec.field}" read a non-numeric "${String(raw)}"`);
    }
    return [value];
  });
  let value: number | null;
  if (!values.length) value = spec.fn === "count" ? 0 : null;
  else if (spec.fn === "sum") value = values.reduce((sum, item) => sum + item, 0);
  else if (spec.fn === "count") value = values.length;
  else if (spec.fn === "avg") value = values.reduce((sum, item) => sum + item, 0) / values.length;
  else if (spec.fn === "max") value = values.reduce((high, item) => item > high ? item : high);
  else value = values.reduce((low, item) => item < low ? item : low);
  return { total: rows.length, value };
}

export function createBillRepo(
  exec: Executor,
  registry: ModuleRegistry,
  timezone: string,
  /**
   * Transaction-scoped coordinate-lock ledger. Non-null = this repository is bound to one transaction, and lock order is computed once across **every** write in that transaction.
   *
   * null (the one on the pool) = each `create` / `save` / `remove` opens its own transaction with `inTx`,
   * and the ledger is one per time. 🔴 **It must not be changed to a mutable ledger stored in this closure**: one repository instance per process,
   * shared across concurrent requests, so two creates arriving together would pollute each other's watermark.
   */
  sharedLockLedger: BillLockLedger | null = null,
  choiceSets: readonly RuntimeChoiceSet[],
): BillRepo {
  const moduleSchemas = registry.all().map((module) => module.schema);

  const insertRow = async (
    on: Executor,
    table: PgTable,
    values: Row,
    what: string,
    schema: ModuleSchema | null = null,
  ): Promise<void> => {
    // A create is given the whole thing, so `custom` can be written as an object directly (only an update needs to merge in the database).
    const timed = schema === null ? values : driverTimestamps(schema, values);
    const custom = customColumnValue(schema, timed);
    const row = custom === null
      ? timed
      : { ...custom.rest, custom: Object.keys(custom.set).length === 0 ? null : custom.set };
    // A document number unique within the tenant is the constraint hit most often. Without translation the user sees a whole SQL statement.
    await guardWrite(what, async () => await on.insert(table).values(row as never));
  };

  const emptyLineRows = (tables: ModuleTables): Record<string, readonly Row[]> =>
    Object.fromEntries(subtableFields(tables.schema).map((field) => [field.key, []]));

  /**
   * Demote the old sibling of a unique-default / unique-effective coordinate on write. Shared by `setStatus` and "effective on create":
   * if the initial status is already `singleActiveWithin.status`, create must demote the old effective version of the same coordinate even without an edge,
   * or the same product briefly (or permanently) has two active rows.
   */
  const applyStatusWriteSideEffects = async (
    on: Executor,
    who: Identity,
    tables: ModuleTables,
    billId: string,
    plan: StatusWritePlan,
    changedAt: Date,
  ): Promise<void> => {
    for (const demote of plan.demote) {
      const defaultColumn = tables.columns[demote.field];
      const statusColumn = tables.columns["status"];
      if (!defaultColumn || !statusColumn) {
        fail(`"${tables.schema.label}" unique-default-within is missing the ${demote.field} / status column`);
      }
      const withinClauses = Object.entries(demote.within).map(([key, value]) => {
        const column = tables.columns[key];
        if (!column) fail(`"${tables.schema.label}" unique-default-within is missing column "${key}"`);
        return eq(column, value);
      });
      await on
        .update(tables.header)
        .set(updateValues(who, { [demote.field]: false }) as never)
        .where(
          scopedWhere(
            tables.header,
            who,
            and(
              ...withinClauses,
              eq(statusColumn as PgColumn, demote.status),
              eq(defaultColumn, true),
              ne(tables.header.id, billId),
            ),
          ),
        );
    }
    for (const sup of plan.supersede) {
      const statusColumn = tables.columns["status"];
      const revisionColumn = tables.columns["revision"];
      if (!statusColumn || !revisionColumn) {
        fail(`"${tables.schema.label}" unique-effective-within is missing the status / revision column`);
      }
      const withinClauses = Object.entries(sup.within).map(([key, value]) => {
        const column = tables.columns[key];
        if (!column) fail(`"${tables.schema.label}" unique-effective-within is missing column "${key}"`);
        return eq(column, value);
      });
      await on
        .update(tables.header)
        .set(
          updateValues(who, {
            status: sup.toStatus,
            revision: sql`${revisionColumn as PgColumn} + 1`,
            updatedBy: who.userId,
            updatedAt: changedAt,
          }) as never,
        )
        .where(
          scopedWhere(
            tables.header,
            who,
            and(
              ...withinClauses,
              eq(statusColumn as PgColumn, sup.fromStatus),
              ne(tables.header.id, billId),
            ),
          ),
        );
    }
  };

  const readLines = async (
    on: Executor,
    identity: Identity,
    tables: ModuleTables,
    billId: string,
  ): Promise<Record<string, readonly Row[]>> => {
    const out: Record<string, readonly Row[]> = {};
    for (const field of subtableFields(tables.schema)) {
      const table = tables.lines.get(field.key);
      if (!table) fail(`module "${tables.code}" line "${field.key}" has no corresponding line table`);
      const rows = await on
        .select(lineSelection(registry, tables, field))
        .from(table)
        .where(scopedWhere(table, identity, eq(table.billId, billId)))
        .orderBy(asc(table.lineNo));
      out[field.key] = (rows as Row[]).map((r) => decodeRow(field.fields ?? [], r, `read line "${field.label}" of "${tables.code}"`));
    }
    return out;
  };

  const lineRowCount = (lines: Readonly<Record<string, readonly Row[]>>): number =>
    Object.values(lines).reduce((n, rows) => n + rows.length, 0);

  /**
   * The line-table range of an agent `bill_get`. An empty array = every line table of this document, at most ANALYSIS_SQL_MAX_ROWS rows.
   * Non-empty = named by row id; the condition is pushed into SQL, and the whole table is not read and then filtered. Any id not found is refused.
   */
  const readNamedLines = async (
    on: Executor,
    identity: Identity,
    tables: ModuleTables,
    billId: string,
    lineIds: readonly string[],
  ): Promise<Record<string, readonly Row[]>> => {
    if (lineIds.length > ANALYSIS_SQL_MAX_ROWS) {
      fail(`lineIds is at most ${ANALYSIS_SQL_MAX_ROWS} rows; filter or compute a row set with analysis_sql`);
    }
    if (lineIds.length === 0) {
      const all = await readLines(on, identity, tables, billId);
      if (lineRowCount(all) > ANALYSIS_SQL_MAX_ROWS) {
        fail(`this document's line tables exceed ${ANALYSIS_SQL_MAX_ROWS} rows; filter or compute a row set with analysis_sql`);
      }
      return all;
    }
    const out = emptyLineRows(tables);
    const wanted = [...lineIds];
    const found = new Set<string>();
    for (const field of subtableFields(tables.schema)) {
      const table = tables.lines.get(field.key);
      if (!table) fail(`module "${tables.code}" line "${field.key}" has no corresponding line table`);
      const rows = await on
        .select(lineSelection(registry, tables, field))
        .from(table)
        .where(scopedWhere(table, identity, eq(table.billId, billId), inArray(table.id, wanted)))
        .orderBy(asc(table.lineNo));
      const decoded = (rows as Row[]).map((r) =>
        decodeRow(field.fields ?? [], r, `read line "${field.label}" of "${tables.code}"`),
      );
      out[field.key] = decoded;
      for (const row of decoded) {
        const id = row["id"];
        if (typeof id === "string") found.add(id);
      }
    }
    const missing = lineIds.filter((id) => !found.has(id));
    if (missing.length) {
      fail(
        `document "${tables.schema.label}" does not have these line rows: ${missing.join(", ")}. ` +
          `A row's identity is the line-table id, not lineNo`,
      );
    }
    return out;
  };

  /**
   * The **only** query that reads line rows across documents.
   *
   * 🔴 `lineRows` (the left value of the accumulation gate) and `refLineOptions` (the picker's candidate rows) share it,
   * and not one word may be written twice: the two judge the same thing — "which line rows this identity can see".
   * Both ways of drifting have zero errors: candidates wider than the gate ⇒ a row pickable in the picker is judged dangling on save;
   * candidates narrower than the gate ⇒ the user cannot see a row they should be able to reference, and the screen only looks like "a few are missing".
   *
   * The scope is the same shape as the refLine branch of `lookupRefSites`: join back to the header and then apply `moduleScopedWhere`
   * — a line table has no dataScope of its own, and querying only by the line-table tenant lets a person who cannot see that document read its lines.
   * Row order is by `lineNo`: entry order is the business order, and giving no order means every refresh sorts differently.
   */
  const selectLines = async (
    on: Executor,
    identity: Identity,
    tables: ModuleTables,
    field: Field,
    table: LineTable,
    conditions: readonly SQL[],
    limit: number,
  ): Promise<Row[]> =>
    (await on
      .select(lineSelection(registry, tables, field))
      .from(table as unknown as PgTable)
      .innerJoin(tables.header, eq(table.billId, tables.header.id))
      .where(moduleScopedWhere(tables, identity, timezone, ...conditions))
      .orderBy(asc(table.lineNo))
      .limit(limit)) as Row[];

  /**
   * A refLine coordinate → the upstream line table. `refLineOptions` and `refLineLabels` share this copy,
   * and do not write another "which table to query".
   */
  const refLineSourceOf = (
    module: string,
    path: string,
    what: string,
  ): { readonly entity: string; readonly through: string; readonly source: ModuleTables; readonly field: Field; readonly table: LineTable } => {
    const [tableKey, columnKey, ...rest] = path.split(".");
    if (!tableKey || !columnKey || rest.length) {
      fail(`${what}: the coordinate form is "<line table>.<column>", and "${path}" was received`);
    }
    // A refLine on an action line is not in the module table. The caller already took the upstream from the field declaration:
    // module = the upstream module, path = "<upstream line table>.__line__".
    if (columnKey === "__line__") {
      const source = registry.get(module);
      const located = lineTableOf(source, tableKey, what);
      return { entity: module, through: tableKey, source, field: located.field, table: located.table };
    }
    const target = registry.get(module).schema;
    const targetTable = target.fields.find((f) => f.key === tableKey && f.type === "subtable");
    if (!targetTable?.fields) fail(`${what}: module "${module}" has no line table "${tableKey}"`);
    const column = targetTable.fields.find((f) => f.key === columnKey);
    if (!column) fail(`${what}: line table "${tableKey}" has no column "${columnKey}"`);
    if (column.type !== "refLine") {
      fail(`${what}: column "${columnKey}" is ${column.type}, not a line-level reference — candidates of an ordinary reference go through refOptions`);
    }
    const entity = column.ref ?? fail(`${what}: refLine has no ref target — the declaration-layer gate should already have stopped it`);
    const through = column.through ?? fail(`${what}: refLine has no through — the declaration-layer gate should already have stopped it`);
    const source = registry.get(entity);
    const located = lineTableOf(source, through, what);
    return { entity, through, source, field: located.field, table: located.table };
  };

  /** The line-table field plus the line table; missing either throws (the declaration and the generated product being out of sync means the framework's own invariant broke). */
  const lineTableOf = (tables: ModuleTables, through: string, what: string): { field: Field; table: LineTable } => {
    const field = subtableFields(tables.schema).find((f) => f.key === through);
    if (!field) fail(`${what}: module "${tables.code}" has no line table "${through}"`);
    const table = tables.lines.get(through);
    if (!table) fail(`${what}: line table "${through}" has no corresponding line table`);
    return { field, table };
  };

  /**
   * Read only the header, not the lines.
   *
   * 🔴 It exists so **a header is not paid for by reading every line**: a `$bill.` operand of `refFilter`
   * can only be a cell on the header (that is how the declaration-layer gate is set), and reading the lines of a document of hundreds of rows for that
   * is a wasted round trip. Apart from that, the scope and the decode criterion are word-for-word the same as `readOne`.
   */
  const readHeaderRow = async (
    on: Executor,
    identity: Identity,
    module: string,
    id: string,
    visibility: "actor" | "tenant" = "actor",
  ): Promise<Row> => {
    const tables = registry.get(module);
    const rows = await on
      .select(headerSelection(registry, tables))
      .from(tables.header)
      .where(
        visibility === "actor"
          ? moduleScopedWhere(tables, identity, timezone, eq(tables.header.id, id))
          : scopedWhere(tables.header, identity, eq(tables.header.id, id)),
      )
      .limit(1);
    const header = rows[0] as Row | undefined;
    if (!header) billNotFound(tables.schema.label, module, id);
    return decodeRow(tables.schema.fields, header, `read "${module}"`);
  };

  const readOne = async (
    on: Executor,
    identity: Identity,
    module: string,
    id: string,
    visibility: "actor" | "tenant" = "actor",
    namedLineIds?: readonly string[],
  ): Promise<BillRecord> => {
    const tables = registry.get(module);
    const revisionColumn = tables.columns["revision"];
    if (!revisionColumn) fail(`read "${module}": the header has no revision column`);
    const rows = await on
      .select({ ...headerSelection(registry, tables), revision: revisionColumn })
      .from(tables.header)
      .where(
        visibility === "actor"
          ? moduleScopedWhere(tables, identity, timezone, eq(tables.header.id, id))
          : scopedWhere(tables.header, identity, eq(tables.header.id, id)),
      )
      .limit(1);
    const header = rows[0] as Row | undefined;
    // 🔴 Throw when it does not exist: returning null makes every caller fall back on their own, and one of them will forget.
    // The two audiences each take their own sentence, and the judgment happens once — the shape and the reason are both on `billNotFound`.
    if (!header) billNotFound(tables.schema.label, module, id);
    const revision = header["revision"];
    if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 1) {
      fail(`read "${module}" #${id}: revision must be a positive integer, and ${JSON.stringify(revision)} was received`);
    }
    const { revision: _revision, ...businessHeader } = header;
    return {
      id,
      revision,
      header: decodeRow(tables.schema.fields, businessHeader, `read "${module}"`),
      lines: namedLineIds === undefined
        ? await readLines(on, identity, tables, id)
        : await readNamedLines(on, identity, tables, id, namedLineIds),
    };
  };

  function eligibilitySiteKey(site: CreateFromEligibilitySite): string {
    return JSON.stringify([
      site.target.module,
      site.target.path,
      site.source.module,
      site.source.through,
      site.source.lineId,
    ]);
  }

  function finiteEligibilityValue(value: unknown, coordinate: string): number {
    if (typeof value !== "number" && typeof value !== "string") {
      fail(`create-from eligibility field "${coordinate}" did not return a number, and ${JSON.stringify(value)} was received`);
    }
    if (typeof value === "string" && value.trim() === "") {
      fail(`create-from eligibility field "${coordinate}" returned an empty string, and it is not treated as 0`);
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      fail(`create-from eligibility field "${coordinate}" did not return a finite number, and ${JSON.stringify(value)} was received`);
    }
    return number;
  }

  function eligibilityTargets(
    target: ModuleSchema,
    finalLines: LineRows,
    site: CreateFromEligibilitySite,
  ): readonly { readonly path: string; readonly label: string }[] {
    const [tableKey, fieldKey, ...rest] = site.target.path.split(".");
    const table = rest.length === 0
      ? target.fields.find((field) => field.key === tableKey && field.type === "subtable")
      : undefined;
    const field = (table?.fields ?? []).find((candidate) => candidate.key === fieldKey);
    if (table === undefined || field === undefined) {
      fail(`create-from eligibility target "${target.code}.${site.target.path}" cannot be resolved — the build-time gate should already have stopped it`);
    }
    const rows = finalLines[table.key];
    if (rows === undefined) {
      fail(`create-from eligibility target "${target.code}.${site.target.path}" has no owning line table in the final payload`);
    }
    const hits = rows.flatMap((row, index) =>
      row[field.key] === site.source.lineId
        ? [{
            path: lineIssuePath(table.key, index, field.key),
            label: lineIssueLabel(table.label, index, field.label),
          }]
        : [],
    );
    if (hits.length === 0) {
      fail(`create-from eligibility site "${site.source.lineId}" disagrees with the final payload`);
    }
    return hits;
  }

  /**
   * The final authority of create-from: after resolveRefs has locked the refLine owner, re-check the source status and the remaining balance against the final payload.
   * prepare / URL only assemble a draft, and a direct API cannot bypass this layer either.
   *
   * `previousLines` is given only when saving an existing draft: an old source later becoming invalid must not make "change the remark" fail; only a newly added or
   * switched-in refLine must satisfy the **entry** eligibility. create passes null, and every actual source is checked.
   */
  const assertCreateFromEligibility = async (
    on: Executor,
    identity: Identity,
    target: ModuleSchema,
    finalLines: LineRows,
    previousLines: LineRows | null,
    what: string,
  ): Promise<void> => {
    const allSites = createFromEligibilitySitesOf(moduleSchemas, target.code, finalLines);
    // Not a set difference, but a **multiset increment of reference counts**. The same source row may appear several times on the target lines;
    // when the old draft already has it once and this time it becomes twice, the second is a new "entry into the source" and must be re-checked.
    // Judging existence only by site key lets it through as historical lineage, and the draft can keep growing after the source is no longer eligible.
    const previousCounts = new Map<string, number>();
    if (previousLines !== null) {
      for (const site of createFromEligibilitySitesOf(moduleSchemas, target.code, previousLines)) {
        previousCounts.set(
          eligibilitySiteKey(site),
          eligibilityTargets(target, previousLines, site).length,
        );
      }
    }
    const sites = allSites.filter((site) => {
      const previousCount = previousCounts.get(eligibilitySiteKey(site));
      return previousCount === undefined || eligibilityTargets(target, finalLines, site).length > previousCount;
    });
    if (sites.length === 0) return;

    const groups = new Map<string, CreateFromEligibilitySite[]>();
    for (const site of sites) {
      const key = JSON.stringify([
        site.target.path,
        site.source.module,
        site.source.through,
        site.sourceStatuses,
        site.sourceRemaining,
      ]);
      const group = groups.get(key) ?? [];
      group.push(site);
      groups.set(key, group);
    }

    const issues: BillIssue[] = [];
    for (const group of groups.values()) {
      const first = group[0];
      if (first === undefined) fail("the create-from eligibility group is empty");
      const source = registry.get(first.source.module);
      const { field: sourceTableField, table: sourceTable } = lineTableOf(
        source,
        first.source.through,
        `${what}: check create-from source eligibility`,
      );
      const headerProjection = headerSelection(registry, source);
      const lineProjection = lineSelection(registry, source, sourceTableField);
      const status = headerProjection["status"];
      if (status === undefined) fail(`module "${source.code}" header projection has no status`);

      const selection: Record<string, PgColumn | SQL> = {
        lineId: sourceTable.id,
        sourceStatus: status,
      };
      if (first.sourceRemaining !== null) {
        const remaining = first.sourceRemaining;
        if (
          (remaining.header !== null &&
            (remaining.header.module !== source.code || remaining.header.table !== null)) ||
          remaining.line.module !== source.code ||
          remaining.line.table !== first.source.through
        ) {
          fail(`the create-from source-remaining coordinate disagrees with source "${source.code}.${first.source.through}"`);
        }
        const lineRemaining = lineProjection[remaining.line.field];
        if (lineRemaining === undefined) {
          fail(
            `create-from source remaining "${remaining.line.path}" has no queryable projection`,
          );
        }
        if (remaining.header !== null) {
          const headerRemaining = headerProjection[remaining.header.field];
          if (headerRemaining === undefined) {
            fail(`create-from source remaining "${source.code}.${remaining.header.path}" has no queryable projection`);
          }
          selection["headerRemaining"] = headerRemaining;
        }
        selection["lineRemaining"] = lineRemaining;
      }

      const lineIds = group.map((site) => site.source.lineId);
      const rows = await on
        .select(selection)
        .from(sourceTable as unknown as PgTable)
        .innerJoin(source.header, eq(sourceTable.billId, source.header.id))
        .where(
          moduleScopedWhere(
            source,
            identity,
            timezone,
            eq(sourceTable.tenantId, identity.tenantId),
            inArray(sourceTable.id, lineIds),
          ),
        );
      const byLine = new Map<string, Record<string, unknown>>();
      for (const raw of rows as Record<string, unknown>[]) {
        const lineId = raw["lineId"];
        if (typeof lineId !== "string" || lineId === "") {
          fail(`checking create-from source eligibility returned an illegal lineId: ${JSON.stringify(lineId)}`);
        }
        if (byLine.has(lineId)) fail(`checking create-from source eligibility returned source row "${lineId}" more than once`);
        byLine.set(lineId, raw);
      }

      for (const site of group) {
        const row = byLine.get(site.source.lineId);
        if (row === undefined) {
          // resolveRefs already confirmed it exists after the same owner lock; disappearing here means the two queries' scope or projection drifted.
          fail(`create-from source row "${site.source.lineId}" disappeared after the reference check`);
        }
        const reasons: string[] = [];
        if (site.sourceStatuses !== null) {
          const current = row["sourceStatus"];
          if (typeof current !== "string") {
            fail(`source "${source.code}" status is not a string: ${JSON.stringify(current)}`);
          }
          if (!site.sourceStatuses.includes(current)) {
            reasons.push(`the source document's current status "${current}" is not among the allowed statuses "${site.sourceStatuses.join(", ")}"`);
          }
        }
        if (site.sourceRemaining !== null) {
          const lineValue = finiteEligibilityValue(
            row["lineRemaining"],
            `${source.code}.${site.sourceRemaining.line.path}`,
          );
          if (site.sourceRemaining.header !== null) {
            const headerValue = finiteEligibilityValue(
              row["headerRemaining"],
              `${source.code}.${site.sourceRemaining.header.path}`,
            );
            if (headerValue <= 0) reasons.push("the source document has no remaining quantity that can be generated");
          }
          if (lineValue <= 0) reasons.push("the selected source line has no remaining quantity that can be generated");
        }
        if (reasons.length === 0) continue;
        for (const coordinate of eligibilityTargets(target, finalLines, site)) {
          issues.push({
            ...coordinate,
            code: "CREATE_FROM_SOURCE_INELIGIBLE",
            message: `"${coordinate.label}" no longer meets the create eligibility: ${reasons.join("; ")} — please pick a source line that can still be generated`,
          });
        }
      }
    }

    if (issues.length > 0) throw new BillInvalidError(what, issues);
  };

  /**
   * One write of "header + N line tables" must succeed or fail as a whole.
   *
   * 🔴 The transaction is wrapped **inside the repository**, not on the HTTP route — the invariant of `create` / `save` belongs to these two methods
   * themselves, and wrapping it at the caller means the third entrance will miss it, and the miss has no symptom.
   * drizzle sends a SAVEPOINT for an exec that is already inside a transaction, so the push-down path in the executor
   * (already inside a transaction) keeps the same meaning.
   *
   * The measured consequence: `save` is "DELETE every line first, then insert row by row", and when the two statements each autocommit,
   * the insert throwing (a column name out of bounds / a unique constraint / a numeric overflow) **permanently clears** this document's lines,
   * while the header's new amount is already committed — a document of "amount 13600, lines empty" can still go on to approval,
   * and post against an amount that no line supports.
   *
   * The cost (accepted on purpose): numbering (the row lock of `oe_code_seq`) is held until commit, so creates of the same tenant, prefix, and day
   * are serialized. What is gained is that a rollback returns the number, and numbers no longer skip. Do not move numbering out of the transaction to shorten the lock.
   */
  const inTx = async <T>(fn: (on: Executor, ledger: BillLockLedger) => Promise<T>): Promise<T> =>
    // 🔴 The ledger follows the **outermost** transaction: a repository bound to a transaction (Planner / executor) shares `sharedLockLedger`,
    // because `exec.transaction` inside a transaction sends a SAVEPOINT, and `pg_advisory_xact_lock` still belongs to the outer transaction.
    // The one on the pool has its real transaction boundary here, so a new one is created — `guardConcurrency` is wrapped at this layer for the same reason.
    await guardConcurrency("execute this write", async () =>
      await exec.transaction(
        async (tx) => await fn(tx as unknown as Executor, sharedLockLedger ?? new BillLockLedger()),
      ),
    );

  const createOne = async (
    identity: Identity,
    module: string,
    header: Readonly<Record<string, unknown>>,
    lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
    visibility: "actor" | "tenant",
    creationMode: "manual" | "generated",
  ): Promise<BillRecord> => {
    const id = requireIdentity(identity);
    const tables = registry.get(module);
    const billId = randomUUID();
    const what = visibility === "actor" ? `create "${module}"` : `a status-edge push-down creates "${module}"`;

    const createdAt = new Date();
    const defaulted = applyCreateDefaults(tables.schema, header, lines, createdAt, timezone);
    // Both entrances share the same schema key gate and value gate; being system-generated does not mean an arbitrary target field may be written.
    const write = prepareWrite(
      tables.schema,
      defaulted.header,
      defaulted.lines,
      "whole",
      what,
      creationMode === "generated" ? "planner" : "user",
    );

    return await inTx(async (on, ledger) => {
      // A reference of a user-created document is judged by their data scope; a declarative push-down only requires it to exist in the same tenant, so the target module's
      // direct read/create permission is not quietly turned into an extra condition of the transition permission.
      const resolved = await resolveRefs(
        on, id, ledger, registry, tables.schema, write, what, timezone, [], visibility, null, null, choiceSets,
      );
      if (creationMode === "manual") {
        await assertCreateFromEligibility(on, id, tables.schema, resolved.lines, null, what);
      }
      const completeForCalculation: LineRows = {
        ...Object.fromEntries(subtableFields(tables.schema).map((field) => [field.key, []])),
        ...resolved.lines,
      };
      materializeHeaderCalculations(
        tables.schema,
        { ...resolved.header, ...lineTotals(tables.schema, completeForCalculation, what) },
        resolved.header,
        what,
      );
      assertResolvedWrite(
        tables.schema,
        resolved,
        "whole",
        what,
        creationMode === "generated" ? "planner" : "user",
      );
      await assertChoiceSetWrite(on, id, choiceSets, tables.schema, resolved.header, resolved.lines, null, what);
      // 🔴 The same layer and the same transaction as reference existence: both are application-layer defenses of "the kernel says which to check, and the server checks".
      // Placing it before `assignAutoNumbers` does not matter — a numbering field must not be marked unique
      // (`FIELD_UNIQUE_SYSTEM_SUPPLIED`), and its uniqueness is governed by the primary index.
      await assertNoDuplicates(on, id, registry, tables, resolved.header, null, what);
      // 🔴 The third application-layer defense of the same layer (reference existence / uniqueness / attachment belonging). Zero IO,
      // but it must be here: the client can put any object key into an attachment cell, and after the write
      // "how this key got in" can never be known again. Push-down (visibility='tenant') is judged too —
      // a push-down payload is generated by the schema mapping, but the attachment value on the source document was filled by a person.
      assertAttachmentsOwned(id, tables.schema, resolved.header, resolved.lines, what);
      const numbered = await assignAutoNumbers(on, tables.schema, id.tenantId, resolved.header, timezone, createdAt);
      // A BOM version is not a tenant-wide sequence, and cannot reuse numbering: it increments by the productId dimension, and
      // the client is not allowed to write it (schema.systemGenerated). Generation stays inside the same transaction, after the uniqueness check;
      // under concurrency the productId × version unique index still falls back to 409.
      const withBomVersion = await assignGeneratedSequence(on, id, tables, numbered, what);
      const complete: LineRows = {
        ...Object.fromEntries(subtableFields(tables.schema).map((field) => [field.key, []])),
        ...resolved.lines,
      };
      // The write envelope strips systemGenerated (the client must not write it). Fill createDefaultBy again before the write:
      // otherwise a notNull column with no SQL DEFAULT (for example BOM version) is inserted as null.
      const withSystemDefaults = applyCreateDefaults(
        tables.schema,
        withBomVersion,
        complete,
        createdAt,
        timezone,
      ).header;
      // If the initial status is already the effective status (such as BOM / routing), create also runs the unique-effective demotion / stamp within the coordinate.
      // An empty from here means "never entered a status": only then does `firstEnterStamps` stamp the first effective date for the initial active
      // record; supersede is still handled by the to status being entered.
      const toStatus = initialStatus(tables.schema);
      const createStatusPlan = statusWritePlan(
        tables.schema,
        "",
        toStatus,
        withSystemDefaults,
        createdAt,
        timezone,
      );
      const values = scopedValues(id, {
        ...withSystemDefaults,
        ...lineTotals(tables.schema, complete, what),
        ...createStatusPlan.stamp,
        id: billId,
        status: toStatus,
        createdBy: id.userId,
        updatedBy: id.userId,
      });
      await insertRow(on, tables.header, values, what, tables.schema);

      for (const [key, rows] of Object.entries(resolved.lines)) {
        const field = subtableFields(tables.schema).find((candidate) => candidate.key === key);
        if (!field) fail(`${what}: the module has no line table "${key}"`);
        await writeLines(on, id, tables, field, billId, rows, what);
      }

      await applyStatusWriteSideEffects(on, id, tables, billId, createStatusPlan, createdAt);

      return await readOne(on, id, module, billId, visibility);
    });
  };

  /**
   * Delete protection is not a precondition each module writes for itself: the reference graph, the ledger, the audit, and push-down lineage are framework facts,
   * and missing any one of them leaves dangling history. This scans the whole registry, and returns only a summary of "still referenced",
   * and does not leak the detail of a downstream document the current position cannot see.
   */
  const assertRemovable = async (
    on: Executor,
    identity: Identity,
    module: string,
    billId: string,
    status: string,
  ): Promise<void> => {
    // A refusal must be able to say **what kind of document this is** (the module label, not the code), and both refusal branches use it.
    const target = registry.get(module);
    // Where to go after "cannot be deleted" is computed from **this record's current-status declaration**, and is not a hardcoded sentence:
    // the hardcoded sentences were each measured to point at a button that does not exist (see the note at the top of `retirementExitsOf`).
    // Each refusal branch's **reason** differs (lineage / ledger / audit / referenced),
    // but **the exit is computed by one criterion** — computing it once per branch means one branch drifts first, and the drift has no symptom.
    // `oe_execution_created_bill` is the source action's idempotency envelope (which document this execution created), not an occupancy graph, and it is not among these branches.
    //
    // The "staged action" branch is **deliberately not joined**: it points at the **page** "staged list",
    // not a button on this document, and that sentence never had the question "does this module have it".
    const remedy = removalRemedy(target.schema, status);
    const inUse = inUseRemedy(target.schema, status);
    const occupancy = occupancyOf(target.schema, status);
    const occupancyRetired = occupancy === "retired";
    const frameworkChecks = [
      {
        label: "status audit",
        // Occupancy retired: audit left by an occupancy-status edge (disable/enable/leave/return) does not count as something that must be kept.
        // Non-occupancy audit (for example a BOM that was once effective) must keep its trace, and must not be said as "it has entered the business flow".
        why: occupancyRetired
          ? "it was once put into use, and this record must keep its trace"
          : "it has already had a status transition (submit, approve, and such operations all leave a trace)",
        next: occupancyRetired
          ? "this trace cannot be erased; please keep this file"
          : removalRemedy(target.schema, status, "deletion would erase this passage with it, and nobody could look it up afterward"),
        run: async () => {
          const rows = await on
            .select({ id: auditLog.id, transitionCode: auditLog.transitionCode })
            .from(auditLog)
            .where(scopedWhere(auditLog, identity, eq(auditLog.module, module), eq(auditLog.billId, billId)));
          return rows.filter((row) => occupancyAuditBlocksRemoval(occupancy, row.transitionCode));
        },
      },
      {
        label: "ledger",
        why: "it has already been posted (inventory or receivables/payables have its journal)",
        // The original wording hardcoded "please reverse it instead". A reverse edge is **usually** there (a rollback edge walks to a terminal status, and the first grade of the criterion recognizes exactly that),
        // but "usually there" is not "certainly there" — same as `EFFECT_REVERSE_UNREACHABLE`, which checks reachability and not existence.
        next: removalRemedy(target.schema, status, "the account has to be flattened by a journal in the opposite direction, and deleting this document only makes the journal disagree"),
        run: async () =>
          await on
            .select({ id: effectLedger.id })
            .from(effectLedger)
            .where(
              scopedWhere(
                effectLedger,
                identity,
                eq(effectLedger.sourceModule, module),
                eq(effectLedger.sourceId, billId),
              ),
            )
            .limit(1),
      },
      {
        label: "push-down lineage",
        why: "it is connected to another document (it was pushed down from an upstream document, or it has already pushed a downstream document)",
        // 🔴 This used to say "first undo this push-down on the connected document, or void it instead" —
        // **neither** way out exists (undoing a push-down is an action the whole warehouse does not have; void is per module, and 7 modules do not have it).
        // It is now computed from this document's declaration: name the button when one can be given, and hand it to an administrator when it cannot. See `terminalExitsOf`.
        next: remedy,
        run: async () =>
          await on
            .select({ id: reference.id })
            .from(reference)
            .where(
              scopedWhere(
                reference,
                identity,
                sql`((${reference.srcModule} = ${module} and ${reference.srcId} = ${billId}) or (${reference.tgtModule} = ${module} and ${reference.tgtId} = ${billId}))`,
              ),
            )
            .limit(1),
      },
      {
        label: "staged action",
        why: "there is still a staged action that has not been handled",
        next: "first go to the staged list and confirm or reject it",
        run: async () =>
          await on
            .select({ id: stagedAction.id })
            .from(stagedAction)
            .where(
              scopedWhere(
                stagedAction,
                identity,
                eq(stagedAction.module, module),
                eq(stagedAction.billId, billId),
              ),
            )
            .limit(1),
      },
    ] as const;
    for (const check of frameworkChecks) {
      if ((await check.run()).length > 0) {
        // The human side says "what has already happened + which way to go", and the agent side separately receives the coordinate and the framework table's name:
        // a word such as "push-down lineage" is precise location information for the model, and jargon a user cannot understand.
        billNotRemovable(target.schema.label, check.why, check.next, `module "${module}" #${billId}, hit ${check.label}`);
      }
    }

    const all = registry.all();
    const inbound = relationsOf(
      all.map((tables) => tables.schema),
      module,
    ).inbound;
    const targetLineIds = new Map<string, readonly string[]>();

    for (const relation of inbound) {
      let targets: readonly string[];
      if (relation.toLevel === "bill") {
        targets = [billId];
      } else {
        const through = relation.toThrough;
        if (through === null) {
          fail(`delete "${module}" #${billId}: line-level relation ${relation.from}.${relation.field} has no target line table`);
        }
        const cached = targetLineIds.get(through);
        if (cached) {
          targets = cached;
        } else {
          const line = target.lines.get(through);
          if (!line) fail(`delete "${module}" #${billId}: the target module has no line table "${through}"`);
          const rows = await on
            .select({ id: line.id })
            .from(line)
            .where(scopedWhere(line, identity, eq(line.billId, billId)));
          targets = rows.map((row) => row.id as string);
          targetLineIds.set(through, targets);
        }
      }
      if (targets.length === 0) continue;

      const source = registry.get(relation.from);
      let hit: readonly unknown[];
      if (relation.via === "bill") {
        const column = source.columns[relation.field];
        if (!column) {
          fail(`delete "${module}" #${billId}: source module "${relation.from}" has no reference column "${relation.field}"`);
        }
        hit = await on
          .select({ id: source.header.id })
          .from(source.header)
          .where(
            scopedWhere(
              source.header,
              identity,
              inArray(column, targets),
              source.code === module ? ne(source.header.id, billId) : undefined,
            ),
          )
          .limit(1);
      } else {
        const through = relation.through;
        if (through === null) {
          fail(`delete "${module}" #${billId}: source relation ${relation.from}.${relation.field} has no line table`);
        }
        const line = source.lines.get(through);
        if (!line) {
          fail(`delete "${module}" #${billId}: source module "${relation.from}" has no line table "${through}"`);
        }
        const columns = getTableColumns(line as unknown as PgTable) as Readonly<
          Record<string, PgColumn>
        >;
        const column = columns[relation.field];
        if (!column) {
          fail(`delete "${module}" #${billId}: source line "${relation.from}.${through}" has no reference column "${relation.field}"`);
        }
        hit = await on
          .select({ id: line.id })
          .from(line)
          .where(
            scopedWhere(
              line,
              identity,
              inArray(column, targets),
              source.code === module ? ne(line.billId, billId) : undefined,
            ),
          )
          .limit(1);
      }
      if (hit.length > 0) {
        // 🔴 The human side can say **who is using it, and on which cell** (both take labels: "product file"'s "default warehouse"),
        // but **not which rows** — those records may be entirely outside the current position's visible range,
        // the same rule as "do not read and do not send out who occupies it". Only the agent side receives the module code and the field key,
        // and its next step is to look that coordinate up.
        // 🔴 "or disable this one" used to be hardcoded unconditionally — and `warehouse` is `singleState()`,
        // and **has no disable edge at all**. The same shape as "undo this push-down":
        // describing a way out that usually exists, without checking whether this module actually has it. It is now computed from the declaration; see `inUseRemedy`.
        billNotRemovable(
          target.schema.label,
          `it is still used by "${relation.fieldLabel}" of "${relation.fromLabel}"`,
          inUse,
          `module "${module}" #${billId}, hit incoming edge ${relation.from}.${relation.field}`,
        );
      }
    }
  };

  return {
    async list(
      identity: Identity,
      module: string,
      query: Query,
      aggregates: readonly SummarySpec[] = [],
      refFilter: readonly RefFilterCondition[] = [],
    ): Promise<PageResult> {
      const id = requireIdentity(identity);
      const tables = registry.get(module);
      const compiled = compileQuery(registry, tables, id, query, { timezone, refFilter });
      const revisionColumn = tables.columns["revision"];
      if (!revisionColumn) fail(`query "${module}": the header has no revision column`);

      // A list row carries revision: the moment the user sees it on the list is the version their later save / transition is based on,
      // and a human-side write must bring it back as-is (see the server's `requiredRevisionField`).
      const rows = await exec
        .select({ ...headerSelection(registry, tables), revision: revisionColumn })
        .from(tables.header)
        .where(compiled.where)
        .orderBy(...compiled.orderBy)
        .limit(compiled.limit)
        .offset(compiled.offset);

      // 🔴 total is the **count that meets the condition**, not this page's row count: the pager computes the page count from it,
      // and computing from this page's row count makes the last page forever show "there is a next page".
      //
      // 🔴 The aggregate hangs on **this** query, and does not open another round trip: it and total ask the same thing
      // ("what does the batch that meets the condition look like"), and sharing one WHERE is what guarantees the footer total and
      // the rows in the table come from the same instant. Opening another endpoint, the data changing between the two makes them disagree, and it does not error.
      const counted = await exec
        .select({ total: sql<string>`count(*)`, ...compileAggregates(registry, tables, aggregates) })
        .from(tables.header)
        .where(compiled.where);
      const summary = counted[0] as Record<string, unknown> | undefined;
      const total = Number(summary?.["total"]);
      if (!Number.isFinite(total)) fail(`module "${module}" count query returned no result`);

      return {
        rows: (rows as Row[]).map((r) => {
          const revision = r["revision"];
          if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 1) {
            fail(`query "${module}" #${String(r["id"])}: revision must be a positive integer, and ${JSON.stringify(revision)} was received`);
          }
          return decodeRow(tables.schema.fields, r, `query "${module}"`);
        }),
        total,
        aggregates: decodeAggregates(module, aggregates, summary ?? {}),
      };
    },

    async invariantBillSummary(identity, module, query, summary): Promise<InvariantSummaryResult> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      // 🔴 This is the only module-table query in this warehouse allowed to step past the actor data scope, and the return surface is only count + aggregate.
      // The tenant is still bound by scopedWhere; do not select any business column or id here in passing.
      const compiled = compileInvariantSummaryQuery(registry, tables, who, query, { timezone });
      const counted = await exec
        .select({ total: sql<string>`count(*)`, ...compileAggregates(registry, tables, [summary]) })
        .from(tables.header)
        .where(compiled.where);
      const row = counted[0] as Record<string, unknown> | undefined;
      const total = Number(row?.["total"]);
      if (!Number.isFinite(total)) fail(`system-invariant aggregate "${module}" returned no row count`);
      const aggregates = decodeAggregates(module, [summary], row ?? {});
      return { total, value: aggregates[summaryKey(summary)] ?? null };
    },

    async invariantLineSummary(identity, module, through, filters, summary): Promise<InvariantSummaryResult> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      const { field, table } = lineTableOf(tables, through, `system-invariant aggregate "${module}.${through}"`);
      const measure = field.fields?.find((candidate) => candidate.key === summary.field);
      if (!measure || !isNumericFieldType(measure.type)) {
        fail(`system-invariant aggregate "${module}.${through}" field "${summary.field}" does not exist or is not numeric`);
      }
      const lineColumns = getTableColumns(table as unknown as PgTable) as Readonly<Record<string, PgColumn>>;
      const conditions: SQL[] = [eq(table.tenantId, who.tenantId)];
      for (const [key, value] of Object.entries(filters)) {
        const column = lineColumns[key] ?? tables.columns[key];
        if (!column) {
          fail(
            `system-invariant aggregate "${module}.${through}": condition field "${key}" ` +
              `is neither on the line columns nor on the header — the settlement row set is not silently widened`,
          );
        }
        conditions.push(Array.isArray(value) ? inArray(column, value) : eq(column, value));
      }
      // The rows stay inside the repository to finish the aggregate; what the Planner receives is still only total + value.
      // Past the cap it is refused, and a truncated smaller total is not treated as a business fact.
      const selected = await exec
        .select(lineSelection(registry, tables, field))
        .from(table as unknown as PgTable)
        .innerJoin(tables.header, eq(table.billId, tables.header.id))
        .where(scopedWhere(tables.header, who, ...conditions))
        .orderBy(asc(table.lineNo))
        .limit(INVARIANT_LINE_SUMMARY_MAX_ROWS + 1);
      if (selected.length > INVARIANT_LINE_SUMMARY_MAX_ROWS) {
        fail(
          `system-invariant aggregate "${module}.${through}" exceeds ${INVARIANT_LINE_SUMMARY_MAX_ROWS} rows — ` +
            `a truncated result is refused for responsibility settlement`,
        );
      }
      const decoded = (selected as Row[]).map((row) =>
        decodeRow(field.fields ?? [], row, `system-invariant aggregate "${module}.${through}"`));
      return invariantSummaryOfRows(module, through, decoded, summary);
    },

    async get(
      identity: Identity,
      module: string,
      id: string,
      named?: BillGetNamedLines,
    ): Promise<BillRecord> {
      return await readOne(
        exec,
        requireIdentity(identity),
        module,
        id,
        "actor",
        named?.lineIds,
      );
    },

    async operationLogVisibility(identity, module, id) {
      const who = requireIdentity(identity);
      // Read only the header, and do not hand the document out. The actor uses the same data range as the detail GET.
      try {
        await readHeaderRow(exec, who, module, id, "actor");
        return "open" as const;
      } catch (error) {
        if (!(error instanceof BillNotFoundError)) throw error;
      }
      try {
        await readHeaderRow(exec, who, module, id, "tenant");
        return "hidden" as const;
      } catch (error) {
        if (!(error instanceof BillNotFoundError)) throw error;
        return "deleted" as const;
      }
    },

    async lockForAction(identity: Identity, module: string, id: string): Promise<BillRecord> {
      const who = requireIdentity(identity);
      // When bound to a transaction, use that transaction's ledger (the executor: the downstream document this edge will then create shares one lock order with it).
      // On the pool (a read-only rehearsal takes this path too) create one: then `pg_advisory_xact_lock` is already
      // a no-op that is released as soon as it is taken, and the ledger only keeps it from polluting someone else's watermark.
      const ledger = sharedLockLedger ?? new BillLockLedger();

      // The first read is only responsible for computing a complete, stable lock set; locks are taken in global order, so two documents that reference each other do not deadlock.
      // After they are taken it must be read and recomputed: a reference may be rewritten by a save while waiting for the lock, and judging on with the old coordinates is another TOCTOU.
      const beforeRecord = await readOne(exec, who, module, id);
      const before = await actionCoordinates(exec, who, registry, module, beforeRecord, false, timezone);
      await lockBillCoordinates(exec, who, ledger, before);

      const lockedRecord = await readOne(exec, who, module, id);
      const after = await actionCoordinates(exec, who, registry, module, lockedRecord, true, timezone);
      if (coordinateFingerprint(who, before) !== coordinateFingerprint(who, after)) {
        fail(`execute "${module}" #${id}: a source coordinate changed while waiting for the consistency lock; please retry`);
      }
      return lockedRecord;
    },

    async lockWriteSet(identity: Identity, requests: readonly BillWriteLockRequest[]): Promise<void> {
      const who = requireIdentity(identity);
      // 🔴 It must be the ledger inside the transaction. An xact lock taken on the pool is released as soon as the statement ends,
      // "lock everything first" becomes an empty sentence, and the symptom is still a random deadlock under concurrency — harder to find than not locking.
      const ledger =
        sharedLockLedger ??
        fail("pre-locking a write set can only be called inside repos.transaction(...): a transaction-level advisory lock on the pool is released as soon as it is taken");

      const coordinates: BillCoordinate[] = [];
      for (const request of requests) {
        if (request.kind === "action") {
          const record = await readOne(exec, who, request.module, request.id);
          coordinates.push(
            ...(await actionCoordinates(exec, who, registry, request.module, record, false, timezone)),
          );
          continue;
        }
        if (request.kind === "save") {
          const record = await readOne(exec, who, request.module, request.id);
          coordinates.push(
            ...(await actionCoordinates(exec, who, registry, request.module, record, false, timezone)),
          );
          const tables = registry.get(request.module);
          // A new reference is not in the old record's coordinates; like a create lock request this only discovers coordinates,
          // and the real key gate / value gate / candidate filter stay owned by the later save's prepareWrite.
          const sites = refSitesOf(tables.schema, request.patch, request.lines ?? {});
          const lookups = await lookupRefSites(exec, who, registry, sites, timezone, "tenant");
          for (const site of sites) {
            const lookup = lookups.get(site);
            if (!lookup) continue;
            if (site.through === null) coordinates.push({ module: site.entity, id: site.id });
            else if (lookup.owner !== null) coordinates.push({ module: site.entity, id: lookup.owner });
          }
          continue;
        }
        if (request.kind === "append") {
          coordinates.push({ module: request.module, id: request.id });
          const tables = registry.get(request.module);
          const sites = refSitesOf(tables.schema, {}, { [request.table]: request.rows });
          const lookups = await lookupRefSites(exec, who, registry, sites, timezone, "tenant");
          for (const site of sites) {
            const lookup = lookups.get(site);
            if (!lookup) continue;
            if (site.through === null) coordinates.push({ module: site.entity, id: site.id });
            else if (lookup.owner !== null) coordinates.push({ module: site.entity, id: lookup.owner });
          }
          continue;
        }
        const tables = registry.get(request.module);
        // 🔴 Feed the raw payload straight to `refSitesOf`: it accepts only a **string that has a value** as a reference,
        // so the Planner's `createdId` placeholder (an object) naturally does not land, and this does not need to know that shape.
        // The criterion is still only the kernel's one copy — this step has no second definition of "which ones to lock".
        const sites = refSitesOf(tables.schema, request.header, request.lines);
        const lookups = await lookupRefSites(exec, who, registry, sites, timezone, "tenant");
        for (const site of sites) {
          const lookup = lookups.get(site);
          // Existence, the candidate filter, and a dangling reference are not judged here at all: those are all the later `create`'s business,
          // and judging them here writes the same gate a second time, and the two criteria will drift sooner or later.
          if (!lookup) continue;
          if (site.through === null) coordinates.push({ module: site.entity, id: site.id });
          else if (lookup.owner !== null) coordinates.push({ module: site.entity, id: lookup.owner });
        }
      }
      await lockBillCoordinates(exec, who, ledger, coordinates);
    },

    async lineRows(
      identity: Identity,
      module: string,
      through: string,
      filters: Readonly<Record<string, unknown>>,
      maxRows: number,
    ): Promise<readonly Readonly<Record<string, unknown>>[]> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      const { field, table } = lineTableOf(tables, through, `read the line rows of "${module}"`);

      // A condition lands on one of two layers: one that exists on a line column is a row condition, and the rest are header conditions.
      // 🔴 If it is on neither, **throw**: silently ignoring a grain condition (such as status) counts draft rows and already-reversed rows
      // into the accumulation together, and that larger number is exactly the left value of the over-issue gate.
      const lineCols = getTableColumns(table as unknown as PgTable) as Readonly<Record<string, PgColumn>>;
      const conditions = [eq(table.tenantId, who.tenantId)];
      for (const [key, value] of Object.entries(filters)) {
        const lineCol = lineCols[key];
        const headerCol = lineCol ? null : tables.columns[key];
        const column = lineCol ?? headerCol;
        if (!column) {
          fail(
            `read the rows of "${module}.${through}": condition field "${key}" is neither on the line columns nor on the header — ` +
              `a grain condition is not silently dropped`,
          );
        }
        conditions.push(Array.isArray(value) ? inArray(column, value) : eq(column, value));
      }

      // The scope goes through `selectLines` (the copy shared with refLineOptions); this is only responsible for the condition and the overflow meaning.
      const rows = await selectLines(exec, who, tables, field, table, conditions, maxRows + 1);

      if (rows.length > maxRows) {
        // A truncated total looks completely normal, and it lets through an over-issue that should have been stopped — the same as the RULE_QUERY_MAX_ROWS one.
        fail(
          `read the rows of "${module}.${through}": more than ${maxRows} rows hit, and the aggregate would be truncated — ` +
            `a truncated total has no abnormal feature, and a gate conclusion is refused on that premise`,
        );
      }
      const what = `read line "${field.label}" of "${module}"`;
      return (rows as Row[]).map((r) => decodeRow(field.fields ?? [], r, what));
    },

    async create(
      identity: Identity,
      module: string,
      header: Readonly<Record<string, unknown>>,
      lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
    ): Promise<BillRecord> {
      return await createOne(identity, module, header, lines, "actor", "manual");
    },

    async createGenerated(
      identity: Identity,
      module: string,
      header: Readonly<Record<string, unknown>>,
      lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
    ): Promise<BillRecord> {
      return await createOne(identity, module, header, lines, "tenant", "generated");
    },

    async save(
      identity: Identity,
      module: string,
      id: string,
      patch: Readonly<Record<string, unknown>>,
      lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null,
      editable: ReadonlySet<string>,
      expectedStatus: string,
      expectedRevision: number,
    ): Promise<BillRecord> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      const what = `save "${module}" #${id}`;

      // The header is judged as a patch (a key that did not appear was not touched), and the lines are judged as a whole-table replace (what was passed is the whole content).
      // A required field that appeared but was cleared to empty is refused just the same — that does not hold, the same as never having filled it.
      const write = prepareWrite(tables.schema, patch, lines, "patch", what);

      return await inTx(async (on, ledger) => {
        // This document and every reference target this write touches are locked together in global order, then the references are looked up again.
        // They share the same coordinate lock as Action / delete, so they do not each take one and then wait in reverse.
        const resolved = await resolveRefs(
          on,
          who,
          ledger,
          registry,
          tables.schema,
          write,
          what,
          timezone,
          [{ module, id }],
          "actor",
          // 🔴 A `$bill.` operand of `refFilter` is evaluated as "the header already in the database ⊕ this patch".
          // The measured shape of looking only at the patch: a material-issue document's `productionOrderId` already has a value,
          // and changing only `productionTaskId` is refused by `REF_FILTER_PENDING`, with the reason "that cell has no value yet" —
          // and that cell has a value; bringing the original `productionOrderId` along returns 200.
          // 🔴 One that still cannot be read after the merge is refused as before: the reason of the PENDING grade did not change, and what changes here is only "what counts as not filled yet".
          async () => await readHeaderRow(on, who, module, id),
          // 🔴 Re-carry must not bypass the state machine: the `offending` gate judges the patch's own keys,
          // and re-carry writes a key that did not appear in the patch. The two share the same `editable`.
          editable,
          choiceSets,
        );
        // After the lock, confirm it exists and is inside the scope. When it does not exist, the update below silently affects 0 rows,
        // and the caller receives a "success".
        const existing = await readOne(on, who, module, id);
        if (existing.revision !== expectedRevision) {
          throw new StaleRevisionError(module, id, expectedRevision, existing.revision);
        }

        // 🔴 An out-of-bounds key always throws, and is not silently dropped — silently dropping it makes the caller believe the write succeeded,
        // and a problem such as "an approved order's amount was changed and did not take effect" cannot be reproduced afterward at all.
        // Required or not is irrelevant: if it is not in the range the current status may change, it cannot be changed.
        // A header key is extra tolerant: if the passed value is exactly the same as the value already in the database, it is treated as the client bringing it back as-is,
        // and is not blocked — so the front end echoing a read-only field's original value (such as a product code) while editing is not misjudged as out of bounds.
        // A line-table key cannot be compared value by value (whole-table replace), and appearing counts as out of bounds.
        const offending = [...Object.keys(patch), ...Object.keys(lines ?? {})].filter((key) => {
          if (isPlatformField(key) || editable.has(key)) return false;
          // A line-table key (whole-table replace) counts as out of bounds directly.
          if (Object.prototype.hasOwnProperty.call(lines ?? {}, key)) return true;
          // A header key: a value the same as the one in the database was brought back as-is, and does not count as out of bounds.
          return patch[key] !== existing.header[key];
        });
        if (offending.length) {
          const editableLabels = [...editable].map(
            (k) => tables.schema.fields.find((f) => f.key === k)?.label ?? k,
          );
          const offendingLabels = offending.map(
            (k) => tables.schema.fields.find((f) => f.key === k)?.label ?? k,
          );
          fail(
            `${what}: the current status cannot change "${offendingLabels.join(", ")}"` +
              ` (currently changeable: ${editableLabels.join(", ") || "none"})`,
          );
        }
        if (lines !== null) {
          // create-from is the eligibility of "entering a source", not a permanent relationship constraint: only a source row newly added or
          // switched in during this whole-table replace is checked. When an old source's remaining later goes to zero, changing the quantity or the remark must not be forced to re-pick historical lineage.
          await assertCreateFromEligibility(
            on,
            who,
            tables.schema,
            resolved.lines,
            existing.lines,
            what,
          );
        }
        const retainedLineIds = lines === null
          ? new Map<string, ReadonlySet<string>>()
          : replacementLineIdentities(resolved.lines, existing.lines, what);

        // A line calculate is already materialized after reference resolution; a header calculate waits until the new line total is ready,
        // or if it references lineAgg it reads the previous total in the database, and gets a legal but stale frozen value.
        //
        // 🔴 The patch grade's `resolved.header` contains only the keys the client changed this time plus system-recomputed fields,
        // and does not carry the current value of an auto field (such as product.code). `fillProductLineBarcodes` needs
        // header.code to generate a barcode, and can get it only by merging existing.header first.
        // Without the merge, editing any product that has lines hits
        // "generating a barcode needs the header code, but the code is still empty after numbering" — on the create path
        // assignAutoNumbers has already written the code into numbered.header, so create does not step on it.
        const totals = lines === null ? {} : lineTotals(tables.schema, resolved.lines, what);
        materializeHeaderCalculations(
          tables.schema,
          { ...existing.header, ...resolved.header, ...totals },
          resolved.header,
          what,
        );
        assertResolvedWrite(tables.schema, resolved, "patch", what);
        await assertChoiceSetWrite(on, who, choiceSets, tables.schema, resolved.header, resolved.lines, existing, what);

        // 🔴 Exclude itself (`id != the current document`): otherwise saving a document whose barcode **was not changed** is judged
        // "barcode duplicated" — the one occupying that value is itself. A unique field that did not appear in the patch is not checked
        // (`uniqueSitesOf` looks only at the keys that were passed), that value was not touched, and the row in the database already satisfies uniqueness.
        //
        // 🔴 A composite unique (`uniqueWith`) is the exception: when only `version` was changed, `productId` is not in the patch,
        // but the duplicate check must carry the cell in the database — otherwise "the same product switched to an already occupied version" is let through silently.
        await assertNoDuplicates(
          on,
          who,
          registry,
          tables,
          mergeUniqueWithPeers(tables.schema, resolved.header, existing.header),
          id,
          what,
        );
        // See the one in create: an attachment's object key is issued by the server, and one the client stuffed in is treated as over-privilege in every case.
        assertAttachmentsOwned(who, tables.schema, resolved.header, resolved.lines, what);

        // 🔴 The total and its lines must land in **the same UPDATE**, and it is computed from the **passed-in** new lines,
        // not the old rows in the database — lines are a whole-table replace (see the delete + writeLines below),
        // and computing from the old rows and then replacing them leaves the header forever one beat behind the lines, while that number looks completely normal.
        // When lines is null (only the header changes) not one total moves: the lines did not change, so the total did not change.
        // Product-specific: when lines are replaced as a whole table, recompute barcode + the duplicate check for the new rows (same as createOne).
        const values = updateValues(who, {
          ...resolved.header,
          ...totals,
          revision: sql`${tables.columns["revision"] as PgColumn} + 1`,
          updatedBy: who.userId,
          updatedAt: new Date(),
        }, tables.schema);
        // 🔴 The UPDATE carries `expectedStatus + expectedRevision`: `editable` was computed by the caller from the snapshot it read,
        // and matching only by id means a document someone else approved in between is still rewritten by the draft's rules —
        // the criterion was computed at one instant and the write happens at another, with nothing in between pinning it.
        // The same rule as setStatus's optimistic lock: **a read-then-write must write both the status and the revision it read into the WHERE**.
        const updated = await guardWrite(`save "${module}" #${id}`, async () => await on
          .update(tables.header)
          .set(values as never)
          .where(
            moduleScopedWhere(
              tables,
              who,
              timezone,
              eq(tables.header.id, id),
              eq(tables.columns["status"] as PgColumn, expectedStatus),
              eq(tables.columns["revision"] as PgColumn, expectedRevision),
            ),
          )
          .returning({ id: tables.header.id }));
        if (updated.length !== 1) {
          throw new StaleRevisionError(module, id, expectedRevision, null);
        }

        // Normalization, companion-reference resolution, totals, and the final write must consume the same lines.
        // When `lines === null`, `resolved.lines` is an empty object and not a single line table is touched.
        for (const [key, rows] of Object.entries(resolved.lines)) {
          const field = subtableFields(tables.schema).find((f) => f.key === key);
          if (!field) fail(`${what}: the module has no line table "${key}"`);
          const table = tables.lines.get(field.key);
          if (!table) fail(`module "${module}" line "${field.key}" has no corresponding line table`);
          // Whole-table replacement: a line number is positional, and a row-by-row diff scrambles line numbers when a row is inserted in the middle.
          // The DELETE and the INSERT that follows share one transaction — see the note on inTx
          await on.delete(table).where(scopedWhere(table, who, eq(table.billId, id)));
          await writeLines(on, who, tables, field, id, rows, what, 0, retainedLineIds.get(key) ?? new Set());
        }

        return await readOne(on, who, module, id);
      });
    },

    async appendLines(
      identity: Identity,
      module: string,
      id: string,
      tableKey: string,
      rows: readonly Readonly<Record<string, unknown>>[],
      expectedStatus: string,
      expectedRevision: number,
    ): Promise<BillRecord> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      const field = subtableFields(tables.schema).find((candidate) => candidate.key === tableKey);
      if (!field) fail(`append "${module}" #${id}: the module has no line table "${tableKey}"`);
      if (!rows.length) fail(`append "${module}" #${id}.${tableKey}: the appended rows cannot be empty`);
      const what = `append "${module}" #${id}.${tableKey}`;
      // The header is a patch (this call accepts no header input); each new line is still validated as a whole row.
      // It shares the create/save entrance, so system-supplied values and illegal keys are not relaxed because this is "planned generation".
      const write = prepareWrite(tables.schema, {}, { [tableKey]: rows }, "patch", what);

      return await inTx(async (on, ledger) => {
        const resolved = await resolveRefs(
          on,
          who,
          ledger,
          registry,
          tables.schema,
          write,
          what,
          timezone,
          [{ module, id }],
          "actor",
          async () => await readHeaderRow(on, who, module, id),
          new Set(),
          choiceSets,
        );
        const existing = await readOne(on, who, module, id);
        if (existing.revision !== expectedRevision) {
          throw new StaleRevisionError(module, id, expectedRevision, existing.revision);
        }
        if (existing.header["status"] !== expectedStatus) {
          fail(
            `${what}: the document is no longer in status "${expectedStatus}"; it is currently` +
              ` "${String(existing.header["status"])}" — the source edge and the appended facts must share the same status snapshot`,
          );
        }

        await assertCreateFromEligibility(on, who, tables.schema, resolved.lines, existing.lines, what);
        assertResolvedWrite(tables.schema, resolved, "patch", what);
        // Every appended row is a new fact. Even when it happens to equal the existing row at the same position, it does not inherit
        // the exemption for "a historically disabled value that did not change".
        await assertChoiceSetWrite(on, who, choiceSets, tables.schema, resolved.header, resolved.lines, null, what);
        // The current kernel does not allow a line column to declare unique; it still uses the same entrance so append is not missed when that capability moves up later.
        await assertNoDuplicates(on, who, registry, tables, resolved.header, id, what);
        assertAttachmentsOwned(who, tables.schema, resolved.header, resolved.lines, what);

        const existingRows = existing.lines[tableKey] ?? [];
        const maxLineNo = existingRows.reduce((max, row) => {
          const value = row["lineNo"];
          return typeof value === "number" && Number.isInteger(value) && value > max ? value : max;
        }, 0);
        const appended = resolved.lines[tableKey] ?? [];
        const completeLines: LineRows = {
          ...existing.lines,
          [tableKey]: [...existingRows, ...appended],
        };
        const totals = lineTotals(tables.schema, completeLines, what);
        const headerChanges: Row = { ...totals };
        materializeHeaderCalculations(
          tables.schema,
          { ...existing.header, ...totals },
          headerChanges,
          what,
        );

        // Even when this module has no lineAgg / calculate, update the header once and put expectedStatus + expectedRevision into the WHERE.
        // A line INSERT cannot carry the header snapshot condition itself; this UPDATE is where append's optimistic lock lands.
        const updated = await guardWrite(what, async () => await on
          .update(tables.header)
          .set(updateValues(who, {
            ...headerChanges,
            revision: sql`${tables.columns["revision"] as PgColumn} + 1`,
            updatedBy: who.userId,
            updatedAt: new Date(),
          }) as never)
          .where(
            moduleScopedWhere(
              tables,
              who,
              timezone,
              eq(tables.header.id, id),
              eq(tables.columns["status"] as PgColumn, expectedStatus),
              eq(tables.columns["revision"] as PgColumn, expectedRevision),
            ),
          )
          .returning({ id: tables.header.id }));
        if (updated.length !== 1) {
          throw new StaleRevisionError(module, id, expectedRevision, null);
        }

        await writeLines(on, who, tables, field, id, appended, what, maxLineNo);
        return await readOne(on, who, module, id);
      });
    },

    async remove(
      identity: Identity,
      module: string,
      id: string,
      expectedStatus: string,
      expectedRevision: number,
    ): Promise<void> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      const statusColumn = tables.columns["status"];
      if (!statusColumn) fail(`delete "${module}" #${id}: the header has no status column`);

      await inTx(async (on, ledger) => {
        // Share one lock with the reference coordinates of create/save/action. Read and check dependents only after the lock, so that "the check was empty"
        // and the real DELETE have no other business write inserting a reference between them.
        await lockBillCoordinates(on, who, ledger, [{ module, id }]);
        const record = await readOne(on, who, module, id);
        if (record.header["status"] !== expectedStatus) {
          fail(
            `delete "${module}" #${id}: the document is no longer in status "${expectedStatus}"; ` +
              `it is currently "${String(record.header["status"])}"; read it again before deciding`,
          );
        }
        if (record.revision !== expectedRevision) {
          throw new StaleRevisionError(module, id, expectedRevision, record.revision);
        }
        // The status is passed in so "which edge to take after it cannot be deleted" is computed from **this document's current declaration**:
        // the previous line just asserted header.status === expectedStatus, so the two come from the same source
        await assertRemovable(on, who, module, id, expectedStatus);

        // The initial state may already have instantiated handoff tasks; they are derived runtime state of the current record, not business history.
        // Other history tables (audit / ledger / push-down lineage / staged action) refuse in assertRemovable as soon as one row exists, and are never cascade-erased.
        // Occupancy-edge audit that occupies retired is the exception: retirement itself writes audit, and must not by itself pin a zero-reference record in place.
        // `oe_execution_created_bill` is the source action's idempotency envelope, not an occupancy graph: it neither blocks deletion nor is cascade-erased.
        await on
          .delete(handoffTask)
          .where(
            scopedWhere(
              handoffTask,
              who,
              eq(handoffTask.module, module),
              eq(handoffTask.billId, id),
            ),
          );
        const deleted = await guardWrite(
          `delete "${module}" #${id}`,
          async () =>
            await on
              .delete(tables.header)
              .where(
                moduleScopedWhere(
                  tables,
                  who,
                  timezone,
                  eq(tables.header.id, id),
                  eq(statusColumn, expectedStatus),
                  eq(tables.columns["revision"] as PgColumn, expectedRevision),
                ),
              )
              .returning({ id: tables.header.id }),
        );
        if (deleted.length !== 1) {
          throw new StaleRevisionError(module, id, expectedRevision, null);
        }
      });
    },

    async setGeneratedHeader(identity, module, id, patch, expectedRevision): Promise<BillRecord> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      const what = `write system fields on "${module}" #${id}`;
      const check = checkGeneratedHeader(tables.schema, patch);
      if (!check.ok) throw new BillInvalidError(what, check.issues);
      return await inTx(async (on) => {
        const existing = await readOne(on, who, module, id);
        if (existing.revision !== expectedRevision) {
          throw new StaleRevisionError(module, id, expectedRevision, existing.revision);
        }
        const values = updateValues(who, {
          ...check.header,
          revision: sql`${tables.columns["revision"] as PgColumn} + 1`,
          updatedBy: who.userId,
          updatedAt: new Date(),
        }, tables.schema);
        const updated = await guardWrite(what, async () =>
          await on
            .update(tables.header)
            .set(values as never)
            .where(
              moduleScopedWhere(
                tables,
                who,
                timezone,
                eq(tables.header.id, id),
                eq(tables.columns["revision"] as PgColumn, expectedRevision),
              ),
            )
            .returning({ id: tables.header.id }),
        );
        if (updated.length !== 1) throw new StaleRevisionError(module, id, expectedRevision, null);
        return await readOne(on, who, module, id);
      });
    },

    async setStatus(
      identity: Identity,
      module: string,
      id: string,
      from: string,
      to: string,
      expectedRevision: number,
    ): Promise<void> {
      const who = requireIdentity(identity);
      const tables = registry.get(module);
      // A unique default inside the coordinate, and stamping on first entry, follow the module declaration, not the module code.
      // Demoting the previous default and advancing this document (including the stamp) share the caller's transaction: demote from the pre-entry snapshot, then update this document;
      // if either step fails the whole group rolls back and the old default stays.
      const policyFields = statusWriteFieldsOf(tables.schema, to);
      const coordinateKeys = statusWriteCoordinateKeys(tables.schema, to);
      let currentRow: Readonly<Record<string, unknown>> = {};
      if (policyFields.length > 0 || coordinateKeys.length > 0) {
        const keys = new Set<string>();
        for (const field of policyFields) {
          keys.add(field.key);
          const unique = uniqueDefaultWithinOf(field);
          if (unique !== null) for (const key of unique.within) keys.add(key);
        }
        // Coordinate columns of singleActiveWithin go into the snapshot too — demotion circles the sibling set by the pre-entry coordinates.
        for (const key of coordinateKeys) keys.add(key);
        const selection: Record<string, PgColumn> = {};
        for (const key of keys) {
          const column = tables.columns[key];
          if (!column) {
            fail(`"${tables.schema.label}" status-write declaration uses a column "${key}" that does not exist`);
          }
          selection[key] = column;
        }
        const current = await exec
          .select(selection)
          .from(tables.header)
          .where(moduleScopedWhere(tables, who, timezone, eq(tables.header.id, id)))
          .limit(1);
        currentRow = (current[0] as Readonly<Record<string, unknown>> | undefined) ?? {};
      }
      // 🔴 Carry from + expectedRevision: when two people click the same edge at once, the second must fail instead of pushing the status a second time;
      // it also fails when the status did not change but someone else saved the content, so a decision computed from stale content is not posted.
      // This is the only optimistic lock; without it, "approving twice posts the books twice" is inevitable under concurrency.
      //
      // A self-loop edge is also protected by revision against a concurrent double execution; a second action that is truly meant to repeat must be
      // started from the new revision read after the first one finished. The idempotency key still covers network replay, and revision covers a stale snapshot; neither replaces the other.
      const changedAt = new Date();
      const plan = statusWritePlan(tables.schema, from, to, currentRow, changedAt, timezone);
      // A single active record / a single default inside the coordinate: on entering the active state, demote sibling records in the same transaction.
      // The optimistic lock protects only this document (the WHERE below carries from + revision); siblings have no revision guard,
      // the same rule as field demotion — two versions of the same product becoming active concurrently already violates the single-active invariant.
      await applyStatusWriteSideEffects(exec, who, tables, id, plan, changedAt);
      const statusValues: Record<string, unknown> = {
        status: to,
        revision: sql`${tables.columns["revision"] as PgColumn} + 1`,
        updatedBy: who.userId,
        updatedAt: changedAt,
        ...plan.stamp,
      };
      const updated = await exec
        .update(tables.header)
        .set(updateValues(who, statusValues, tables.schema) as never)
        .where(moduleScopedWhere(
          tables,
          who,
          timezone,
          eq(tables.header.id, id),
          eq(tables.columns["status"] as PgColumn, from),
          eq(tables.columns["revision"] as PgColumn, expectedRevision),
        ))
        .returning({ id: tables.header.id });
      if (updated.length !== 1) {
        const current = await readOne(exec, who, module, id);
        if (current.revision !== expectedRevision) {
          throw new StaleRevisionError(module, id, expectedRevision, current.revision);
        }
        fail(`"${module}" #${id} is not in status "${from}"; refusing to change it to "${to}"`);
      }
    },

    async refOptions(
      identity: Identity,
      entity: string,
      keyword: string,
      limit: number,
      ids: readonly string[] | null = null,
      filter: readonly RefFilterCondition[] = [],
    ): Promise<RefOptionsPage> {
      const who = requireIdentity(identity);
      const tables = registry.get(entity);
      if (!Number.isInteger(limit) || limit < 1) fail(`refOptions: limit must be a positive integer, received ${limit}`);
      // 🔴 The two questions are mutually exclusive. Giving both has no defined meaning ("search a keyword inside these ids" is not a requirement
      // anywhere), and an ambiguous argument will be used by some caller under whichever reading it assumed
      if (ids !== null && keyword.trim()) {
        fail(`refOptions(${entity}): ids and keyword are mutually exclusive — the former names candidates by id, the latter searches candidates (entry)`);
      }
      if (ids !== null && !ids.length) fail(`refOptions(${entity}): ids was an empty array — omit the parameter when nothing is requested`);

      const scope = headerScope(tables);
      const labelKeys = labelFieldsOf(tables.schema).filter((key) =>
        isPlatformField(key) || who.permissions.includes(fieldPermissionKey(entity, key, "read"))
      );
      const selection = refLabelSelection(registry, tables, scope, labelKeys, `refOptions(${entity})`, "value");

      // The field whitelist, permissions, and LIKE semantics match list search; the reference dropdown also supports whole-phrase tokenization.
      const conditions: SQL[] = [];
      const term = keyword.trim();
      if (term) conditions.push(compileSearchPhrase(registry, tables, scope, who, term));
      // Naming candidates by id shares the search-candidate scope and the same label composition; it only replaces "what to search"
      // with "these ids the user entered". This is not a host-row echo; echo goes through `refLabels`.
      if (ids !== null) conditions.push(inArray(tables.header.id, [...ids]));
      // Candidate filters apply only to the search-candidate branch, not to the name-by-id branch.
      // An id the user named may have been a candidate yesterday and be excluded by the filter today; the name is still answered inside the candidate range;
      // an id that cannot be seen does not appear in the result.
      if (ids === null && filter.length) {
        const expanded = await expandRefFilterConditions(exec, who, registry, filter, timezone);
        conditions.push(...compileRefFilter(tables, expanded, `candidates of "${entity}"`));
      }

      // Only candidates have "a page of 20". The ids path is the ones the user named, and it must return exactly as many as were asked,
      // without the candidate page size. An id that cannot be read is absent from the result; it is not a truncation.
      const fetchLimit = ids !== null ? ids.length : limit;
      // Candidates fetch one extra row to tell whether the page was truncated. Truncation itself is fine; **an invisible truncation** is not.
      //
      // Order: the primary key is created-at descending (the newest record first), and within the same second the primary label ascending keeps it stable.
      // Do not order by id: id is a randomUUID, and the first N rows ordered by it are a random, unreproducible subset.
      // Note: createdAt is a framework platform column and is not on the BillTable type, so it is referenced with a raw sql expression.
      const rows = await exec
        .select(selection)
        .from(tables.header)
        .where(moduleScopedWhere(tables, who, timezone, ...conditions))
        .orderBy(
          sql`${tables.header}.created_at DESC`,
          ...(labelKeys.length ? [asc(selection["label0"] as PgColumn | SQL)] : []),
          asc(tables.header.id),
        )
        .limit(ids === null ? fetchLimit + 1 : fetchLimit);

      const page = (rows as Row[]).slice(0, fetchLimit).map((row) => {
        const value = row["value"];
        if (typeof value !== "string") fail(`refOptions(${entity}): id is not a string`);
        const label = refLabelFromRow(tables.schema, value, labelKeys, row);
        return { value, label };
      });
      // Naming candidates by id has no "truncation": these are exactly the ones asked; one that cannot be read is invisible, not "there is more".
      return { options: page, truncated: ids === null && rows.length > limit };
    },

    async refLabels(identity, entity, ids) {
      const who = requireIdentity(identity);
      if (ids.length === 0) return new Map();
      const unique = [...new Set(ids)];
      const tables = registry.get(entity);
      const labelKeys = labelFieldsOf(tables.schema);
      const scope = headerScope(tables);
      const selection = refLabelSelection(registry, tables, scope, labelKeys, `refLabels(${entity})`, "id");
      // It may only be consumed as an echo. The id must come from a host row the server already read inside the scope. Do not use it to read a list, candidates, or a detail.
      const rows = await exec
        .select(selection)
        .from(tables.header)
        .where(scopedWhere(tables.header, who, inArray(tables.header.id, unique)));
      const byId = new Map<string, Row>();
      for (const row of rows as Row[]) {
        const id = row["id"];
        if (typeof id !== "string") fail(`refLabels(${entity}): id is not a string`);
        if (byId.has(id)) fail(`reference "${id}" of module "${entity}" returned more than one row — the primary key is broken`);
        byId.set(id, row);
      }
      const missing = unique.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        fail(`references of module "${entity}" cannot be read in this tenant: ${missing.join(", ")}`);
      }
      const out = new Map<string, string>();
      for (const id of unique) {
        const row = byId.get(id);
        if (row === undefined) fail(`a reference of module "${entity}" cannot be read in this tenant: ${id}`);
        out.set(id, refLabelFromRow(tables.schema, id, labelKeys, row));
      }
      return out;
    },

    async refLineLabels(identity, module, path, billId, ids) {
      const who = requireIdentity(identity);
      if (ids.length === 0) return new Map();
      const unique = [...new Set(ids)];
      const what = `echo "${module}.${path}"`;
      const { table, source } = refLineSourceOf(module, path, what);
      // It may only be consumed as an echo. The id must come from a host row the server already read inside the scope. Do not use it to read a list, candidates, or a detail.
      const rows = await exec
        .select({ id: table.id, lineNo: table.lineNo })
        .from(table as unknown as PgTable)
        .innerJoin(source.header, eq(table.billId, source.header.id))
        .where(scopedWhere(
          source.header,
          who,
          eq(table.billId, billId),
          eq(table.tenantId, who.tenantId),
          inArray(table.id, unique),
        ));
      const byId = new Map<string, { readonly lineNo: unknown }>();
      for (const row of rows) {
        const id = row.id;
        if (typeof id !== "string") fail(`${what}: the row id is not a string`);
        if (byId.has(id)) fail(`${what}: row "${id}" returned more than one row — the primary key is broken`);
        byId.set(id, { lineNo: row.lineNo });
      }
      const out = new Map<string, string>();
      for (const id of unique) {
        const row = byId.get(id);
        if (row === undefined) {
          fail(`module "${module}" path "${path}" row "${id}" cannot be read in this tenant`);
        }
        const label = lineLabelOf({ lineNo: row.lineNo });
        if (label === null) {
          fail(`module "${module}" path "${path}" row "${id}" line number is not an integer`);
        }
        out.set(id, label);
      }
      return out;
    },

    async refPreselect(
      identity: Identity,
      entity: string,
      conditions: readonly RefFilterCondition[],
    ): Promise<string | null> {
      const who = requireIdentity(identity);
      // An empty condition means counting "the single one" over the whole entity. The declaration layer already rejects that shape
      // (`REF_PRESELECT_WITHOUT_FILTER`); reaching here means the caller bypassed coordinate resolution
      if (!conditions.length) {
        fail(`refPreselect(${entity}): there is not a single condition — a default selection can only be picked inside this cell's candidate set`);
      }
      // This UI branch always judges by the current post's visible scope (the same words as the dropdown):
      // the row selected automatically must be one the user could also pick
      const [picked] = await lookupRefPreselect(exec, who, registry, [{ entity, conditions }], "actor", timezone);
      return picked ?? null;
    },

    async refLineOptions(
      identity: Identity,
      module: string,
      path: string,
      billId: string,
      limit: number,
      includeLineIds: readonly string[],
    ): Promise<RefLineOptionsPage> {
      const who = requireIdentity(identity);
      const what = `candidate lines of "${module}.${path}"`;
      if (!Number.isInteger(limit) || limit < 1) fail(`${what}: limit must be a positive integer, received ${limit}`);
      if (includeLineIds.length > 200) fail(`${what}: an exact echo accepts at most 200 line ids at once, received ${includeLineIds.length}`);
      if (new Set(includeLineIds).size !== includeLineIds.length || includeLineIds.some((id) => id.trim() === "")) {
        fail(`${what}: exact echo line ids must be non-empty and unique`);
      }

      // Who the upstream is is said by the target module's declaration, not given by the caller. It shares `refLineSourceOf` with echo.
      const target = registry.get(module).schema;
      const { entity, through, source, field, table } = refLineSourceOf(module, path, what);
      const [tableKey, columnKey] = path.split(".");
      if (tableKey === undefined || tableKey === "" || columnKey === undefined || columnKey === "") {
        fail(`${what}: the coordinate form is "<line table>.<column>", and "${path}" was received`);
      }

      // createFrom may declare a "remaining quantity > 0" eligibility. It constrains both the first-segment source document and the second-segment source line:
      // here only the line-level half is applied. The condition is compiled onto the derived projection itself, so a rollup/formula and a stored column
      // use the same expression; limiting first and then filtering in JS would silently cut off later usable lines.
      const createFrom = target.views.createFrom.find((entry) => entry.path === path);
      const eligibilityConditions: SQL[] = [];
      if (includeLineIds.length > 0) {
        eligibilityConditions.push(inArray(table.id, [...includeLineIds]));
      } else if (createFrom?.sourceRemaining !== null && createFrom?.sourceRemaining !== undefined) {
        const [remainingThrough, remainingKey, ...remainingRest] = createFrom.sourceRemaining.line.split(".");
        if (remainingRest.length > 0 || remainingThrough !== through || !remainingKey) {
          fail(`${what}: sourceRemaining.line "${createFrom.sourceRemaining.line}" does not match the source lines "${through}"`);
        }
        const operand = lineSelection(registry, source, field)[remainingKey];
        if (operand === undefined) {
          fail(`${what}: sourceRemaining.line "${createFrom.sourceRemaining.line}" has no queryable projection`);
        }
        eligibilityConditions.push(gt(sql`${operand}`, 0));
      }

      // The same `selectLines` as `lineRows`: the scope (join back to the upstream header + moduleScopedWhere)
      // is therefore word-for-word the same as the cumulative gate and the line-level branch of `resolveRefs`, and cannot be judged once each
      const rows = await selectLines(
        exec,
        who,
        source,
        field,
        table,
        [eq(table.tenantId, who.tenantId), eq(table.billId, billId), ...eligibilityConditions],
        limit + 1,
      );

      // 🔴 "The quantity already referenced away" is not computed again here: it is a **rollup declaration** on the upstream line
      // (`salesOrder.lines.shippedQty`), and `lineSelection` already computes it into the row as a derived column.
      // Here only "which column it is" is derived from the declaration — if it cannot be derived, say so (null),
      // and do not substitute another quantity column: a wrong "already referenced" lets the same line be referenced twice while both documents stay valid
      const consumed = (field.fields ?? []).find((col) => {
        const derive = col.derive;
        return (
          derive !== null &&
          derive.kind === "rollup" &&
          (derive.on ?? null) === null &&
          derive.from === module &&
          derive.through === tableKey &&
          derive.match === columnKey
        );
      });

      const what2 = `${what}: reading lines "${field.label}" of "${entity}"`;
      return {
        entity,
        through,
        consumedField: consumed?.key ?? null,
        rows: rows.slice(0, limit).map((row) => decodeRow(field.fields ?? [], row, what2)),
        truncated: rows.length > limit,
      };
    },
  };
}

/**
 * One piece of text inside a candidate label.
 *
 * 🔴 This path **does not go through `decodeRow`** (the candidate query projects only label columns, not the whole row),
 * so `String(v)` emits a PG `numeric` as stored: `"10.000000"`.
 * The user reads "the code has a lot of decimal points" — while the same value looks normal on the list page,
 * because that path decoded it. The criterion must share a source with `decodeRow`: **look at the declared field type**,
 * not at what the value happens to look like (`"10.000000"` and a code that is really named that cannot be told apart in JS).
 *
 * `labelFieldsOf` already keeps numeric columns out of labels; this still decodes: a `lineAgg` stored total
 * and a later relaxation of that filter both land here, and missing it does not throw, it only shows a string of trailing zeros again.
 */
/** When the composed text is empty, fall back to the id. */
function composeRefLabel(schema: ModuleSchema, id: string, parts: readonly string[]): string {
  const text = parts.filter((part) => part !== "").join(referenceLabelSeparator(schema));
  return text === "" ? id : text;
}

function refLabelSelection(
  registry: ModuleRegistry,
  tables: ModuleTables,
  scope: ReturnType<typeof headerScope>,
  keys: readonly string[],
  what: string,
  idAlias: "id" | "value",
): Record<string, PgColumn | SQL> {
  const selection: Record<string, PgColumn | SQL> = { [idAlias]: tables.header.id };
  keys.forEach((key, index) => {
    const operandum = resolveOperandum(registry, scope, key, what);
    selection[`label${index}`] = operandum.column === null ? operandum.expr : operandum.column;
  });
  return selection;
}

function refLabelFromRow(
  schema: ModuleSchema,
  id: string,
  keys: readonly string[],
  row: Row,
): string {
  return composeRefLabel(
    schema,
    id,
    keys.map((key, index) => labelText(schema, key, row[`label${index}`])),
  );
}

function labelText(schema: ModuleSchema, key: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const field = schema.fields.find((f) => f.key === key);
  if (field && isNumericFieldType(field.type) && typeof raw === "string") {
    const value = Number(raw);
    // If it cannot be converted, show it as stored: a label is a piece of text for a person, and throwing away the whole dropdown for it is out of proportion
    // (throwing in `decodeRow` is right — values on that path enter the rule engine and posting)
    return Number.isFinite(value) ? String(value) : raw;
  }
  return String(raw);
}

/**
 * Persist lines.
 *
 * 🔴 The argument is **rows that have already passed `prepareWrite`** (the key gate and the value gate have both run, and values are normalized).
 * Do not run `lineWrite` again here: that could make "the rows used to compute totals" and "the rows written" come from different sources,
 * and different sources show up as a header total that is a little off from adding the lines, while each number looks legal on its own.
 */
/**
 * A version sequence inside the coordinate: runs when the field declares `generatedSequence.kind = majorMinor`.
 * The form is V<major>.<minor>, the first version is V1.0, and later ones at the same coordinate add +minor.
 * The lock key is tenant + this module's code + the coordinate values — the current module's own code is the namespace, not a branch on some business module.
 */
async function assignGeneratedSequence(
  on: Executor,
  identity: Identity,
  tables: ModuleTables,
  header: Readonly<Record<string, unknown>>,
  what: string,
): Promise<Record<string, unknown>> {
  const field = tables.schema.fields.find((candidate) => candidate.generatedSequence?.kind === "majorMinor");
  if (!field?.generatedSequence) return { ...header };
  const coords = field.generatedSequence.within;
  const coordValues: string[] = [];
  for (const key of coords) {
    const value = header[key];
    if (typeof value !== "string" || value.trim() === "") {
      fail(`${what}: generating "${field.label}" requires "${key}" to be determined first`);
    }
    coordValues.push(value);
    if (!tables.columns[key]) fail(`${what}: generating "${field.label}" is missing coordinate column "${key}"`);
  }
  const versionColumn = tables.columns[field.key];
  if (!versionColumn || !tables.header.tenantId) {
    fail(`${what}: generating "${field.label}" is missing the ${field.key} / tenant_id column`);
  }
  const lockKey = `${identity.tenantId}:${tables.schema.code}:${coordValues.join(":")}`;
  await on.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
  const clauses = [
    eq(tables.header.tenantId, identity.tenantId),
    ...coords.map((key, i) => eq(tables.columns[key]!, coordValues[i])),
  ];
  const rows = (await on
    .select({ version: versionColumn })
    .from(tables.header)
    .where(and(...clauses))) as unknown as readonly { version?: unknown }[];
  let major = 1;
  let minor = -1;
  for (const row of rows) {
    const raw = row.version;
    if (typeof raw !== "string") continue;
    const match = /^V(\d+)\.(\d+)$/.exec(raw.trim());
    if (!match) fail(`${what}: existing version "${raw}" does not match the V<major>.<minor> rule, so it cannot be incremented automatically`);
    const m = Number(match[1]);
    const n = Number(match[2]);
    if (!Number.isSafeInteger(m) || !Number.isSafeInteger(n)) fail(`${what}: existing version "${raw}" is outside the incrementable range`);
    if (m > major || (m === major && n > minor)) {
      major = m;
      minor = n;
    }
  }
  return { ...header, [field.key]: `V${major}.${minor + 1}` };
}

async function writeLines(
  exec: Executor,
  identity: Identity,
  tables: ModuleTables,
  field: Field,
  billId: string,
  rows: readonly Readonly<Record<string, unknown>>[],
  what: string,
  lineNoOffset = 0,
  retainedIds: ReadonlySet<string> | null = null,
): Promise<void> {
  const table = tables.lines.get(field.key);
  if (!table) fail(`module "${tables.code}" line "${field.key}" has no corresponding line table`);
  // 🔴 Judge the shape before judging empty. Written as `if (!rows.length) return`, a non-array (`{}` / a string / a number)
  // reads `.length` as undefined → falsy → **a silent return**: the caller just deleted the whole line table,
  // the API returns 200, the lines are empty, and there is zero error. That is the opposite of fail-fast; do not change it back.
  // (`prepareWrite` already judged once; this stays because this function's correctness must not depend on the caller)
  if (!Array.isArray(rows)) {
    fail(`"${tables.schema.label}" "${field.label}" must be a set of lines; ask the assistant to rearrange it`);
  }
  if (!rows.length) return;

  const values = rows.map((row, i) => {
    // A line table has no orgId: lines are always reached through the header, and ownership follows the header (see codegen.ts).
    // It still goes through scopedValues because that is the only write entrance that carries requireIdentity —
    // bypassing it would let the caller specify tenantId itself
    const { id: submittedId, ...business } = row;
    const { orgId: _dropped, ...scoped } = scopedValues(identity, business);
    const id = typeof submittedId === "string" && retainedIds?.has(submittedId)
      ? submittedId
      : randomUUID();
    /**
     * 🔴 Custom fields on a line also have to be folded into this row's `custom` column.
     *
     * This path used to **lack** that step: the header goes through `insertRow` (which folds), and lines batch-insert themselves.
     * So a cell bound on a line was treated by drizzle as "the table has no such column" —
     * and this stretch is `values(x as never)`, which the type check cannot hold down. The insert then throws
     * column does not exist, or (the column exists but was not folded) silently drops the value.
     * Each line is folded again; the header's fold cannot be reused: the two layers have different field lists.
     */
    const custom = customColumnValue(null, scoped as Row, field.fields ?? []);
    const columns = custom === null
      ? scoped
      : { ...custom.rest, custom: Object.keys(custom.set).length === 0 ? null : custom.set };
    return { ...columns, id, billId, lineNo: lineNoOffset + i + 1 };
  });
  await guardWrite(what, async () => await exec.insert(table).values(values as never));
}
