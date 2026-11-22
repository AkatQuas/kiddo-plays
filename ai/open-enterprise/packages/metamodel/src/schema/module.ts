// ---------------------------------------------------------------------------
// A module is the aggregate of six concepts. A seventh is not allowed.
//
//   ① fields                 — inferred from the flow; each one should be able to say which step needs it
//   ② lifecycle.statuses     — where a document sits
//   ③ lifecycle.transitions  — one transfer of responsibility
//   ④ handoff                — todo / notice / reminder
//   ⑤ preconditions          — live on an edge; the threshold of a transfer of responsibility
//   ⑥ views                  — how the list and the form are presented
//
// Why only six: standardization does not limit the user's business. It limits how an Agent may express itself.
// Anything an Agent wants to express must land on these six concepts. What cannot land should not exist.
// A narrow vocabulary pays back three ways: a finite enum shrinks the hallucination space; a fixed structure
// can be checked statically and completely; a single meaning can be translated into words a person can read.
// ---------------------------------------------------------------------------

import { isReservedCustomPrefix } from "./customField.js";
import {
  assertClosedKeys,
  assertUniqueKeys,
  requireArray,
  requireCoordinateSegment,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";
import { createDefaultValue } from "../derive/createDefault.js";
import {
  createBlockersOf,
  isSystemSupplied,
  isPlannerSupplied,
  normalizeField,
  type CreateBlocker,
  type Field,
  type FieldType,
} from "./fields.js";
import { normalizeHandoff, type Handoff } from "./handoff.js";
import { normalizeLifecycle, transitionAction, type Lifecycle } from "./lifecycle.js";
import { normalizeNumbering, type Numbering } from "./numbering.js";
import { normalizePrecondition, type Precondition } from "./preconditions.js";
import { normalizeViews, type Views } from "./views.js";

/**
 * Seventh-concept gate (allowlist). Adding a top-level key adds a concept, and it must pass this gate first.
 * `capabilities` only narrows manual create, export, and import. Omitting it leaves all three open.
 * `create` is true, false, or "system". It is not another top-level key.
 */
export const MODULE_KEYS = [
  "label",
  "customFields",
  "numbering",
  "unitSet",
  "fields",
  "lifecycle",
  "handoff",
  "preconditions",
  "views",
  "capabilities",
] as const;

/** Closed keys of a capability declaration. An unknown key schemaFails. create accepts only true, false, or "system"; export and import accept only boolean. */
const CAPABILITY_KEYS = ["create", "export", "import"] as const;

/**
 * Seventh-concept gate (denylist).
 *
 * These are not "not supported yet". They already have a home, and must not grow a second entrance. The error names that home,
 * because the person (and the AI) who wrote the wrong key needs "write it here", not "not allowed".
 */
export const FORBIDDEN_MODULE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  actions: "Buttons are 100% derived from edges, editable, and todos. The only configurable choice is which edge is the primary button (transition.primary)",
  buttons: "Same as actions: a button is not a declaration site. It is a derived result",
  validations: "Business validation is not a module. It is a cross-cutting concern and lives on ⑤ preconditions",
  rules: "Same as validations: write them as preconditions. Nonstandard cases use a parameterized primitive with source:'code'",
  notifications: "Notifications are not a module. They are a cross-cutting concern and live on ④ handoff",
  hooks: "The only exit for nonstandard logic is a precondition with source:'code'. There is no arbitrary code mount point",
  workflow: "The flow is ③ lifecycle.transitions. There is no second flow definition",
  permissions: "Roles and field or row permissions are this system's RBAC data, not module schema. A module declares business capabilities only",
  api: "The API is compiled from the six concepts. It is not declared by hand",
  ui: "The UI is compiled from ⑥ views",
  period:
    "A period is a platform axis (like tenant isolation), not a module property. It constrains every module that posts, " +
    "and is owned by oe_period and period resolution (metamodel/period.ts). If it can be declared it can be omitted or set to the wrong tier, " +
    "and it can also be bypassed by inheritance on a route exit edge",
  fiscalYear: "Same as period: a fiscal year's shape is expressed by oe_period startAt/endAt. The framework does not know month or year",
});

/**
 * Platform fields. The framework provides them on every document. They must not be declared in fields.
 *
 * Declaring one creates a second source of truth. The framework already guarantees they exist, have a type, and are maintained.
 * Declaring them again only produces drift such as "the declared type does not match the type the framework actually writes", which nothing discovers automatically.
 *
 * Views still need to filter status, and checks still need to reference createdBy, so the gate must know them.
 * It just does not accept them in a declaration. Those two facts are separate.
 */
export const PLATFORM_FIELDS = [
  "id",
  "status",
  // Storage concurrency token. The framework maintains it and a declaration must not take the name. It is not in PUBLIC_PLATFORM_FIELDS,
  // because it is not part of the business header, list, or rule surface.
  "revision",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "tenantId",
  "orgId",
] as const;

export type PlatformField = (typeof PLATFORM_FIELDS)[number];

/** Platform fields that may appear in a business response. Tenant and org are isolation plumbing, not business data. */
export const PUBLIC_PLATFORM_FIELDS = [
  "id",
  "status",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
] as const satisfies readonly PlatformField[];

export function isPublicPlatformField(key: string): boolean {
  return (PUBLIC_PLATFORM_FIELDS as readonly string[]).includes(key);
}

export function isPlatformField(key: string): boolean {
  return (PLATFORM_FIELDS as readonly string[]).includes(key);
}

/**
 * Platform fields on a line. The framework provides them. They likewise must not be declared in `subtable.fields`,
 * but a rule may reference them. Same discipline as the header list, one level down (see `PLATFORM_FIELDS`).
 *
 * 🔴 The reason it exists is a shape that was hit twice in practice: "the upstream checks that every one of its lines has been fully consumed downstream"
 * can only be written `related_agg { on: "$line.id", from: <downstream>, through: "lines", match: <line-reference column> }`
 * (manufacturing: cumulative verified quantity of each order line >= that line's quantity; sales: cumulative shipped quantity of each line <= that line's order quantity).
 * Evaluation can do it (`line["id"]` is on the read model). What blocks it is static checking against declared line columns,
 * and `id` is a platform field that by definition must not be declared, so a rule that is entirely valid is rejected at modeling time as "references a column that does not exist".
 * The degraded spelling drops it to a whole-document total, and that is not the same gate: the document total can be enough while one line is not, and the gate still passes.
 *
 * 🔴 `billId` is deliberately not in the list. It is plumbing (same as `tenantId` / `orgId`), and the rule already runs on
 * that document. Using it as a criterion is constantly true on every readable line, which is the same reason `$bill.tenantId` is rejected.
 */
export const PLATFORM_LINE_FIELDS = ["id", "lineNo"] as const;

export function isPlatformLineField(key: string): boolean {
  return (PLATFORM_LINE_FIELDS as readonly string[]).includes(key);
}

/**
 * Keys the read model brings back that do not count inside a write envelope.
 *
 * ## Read is not write
 *
 * A detail view shows `id`, `status`, and the audit fields. A line needs `id` (line identity) and `lineNo`.
 * A form or an agent often saves the record it just read, unchanged. These keys are not business fields the caller means to overwrite.
 * Identity is in the URL, the state machine goes through transition, and audit fields are filled by the framework.
 *
 * The write path (`assertWritePayload` / `headerWrite` / `lineWrite` / stripping before the client submits) ignores them
 * in one place. Layers must not each decide. The authorizer used to hard-reject while storage ignored the key, which showed up as
 * "saving a rejected document reports that platform field id cannot be written", even though storage would never persist that key.
 *
 * 🔴 This is a different kind of thing from `isSystemSupplied`. Do not merge them into one notion of "system field":
 * | Kind | Example | When it appears in a write body |
 * |---|---|---|
 * | This function (platform / line structure) | `id` `status` `lineNo` `billId` | Ignored (does not count) |
 * | `isSystemSupplied`, and the value matches what the system will write | a hidden system cell written back from a read | Ignored (see `classifyWriteEnvelope`) |
 * | `isSystemSupplied`, and the value conflicts with what the system will write, or that value cannot be known yet | an `auto` number, a stolen write of a system cell | Rejected |
 */
export function isWriteEnvelopeIgnoredKey(key: string): boolean {
  return isPlatformField(key) || key === "lineNo" || key === "billId";
}

export interface WriteEnvelopeIgnoredKey {
  readonly key: string;
  readonly reason: string;
}

export interface WriteEnvelopeConflict {
  readonly key: string;
  readonly message: string;
}

export interface WriteEnvelopeClassification {
  readonly ignored: readonly WriteEnvelopeIgnoredKey[];
  readonly conflicts: readonly WriteEnvelopeConflict[];
}

function sameSystemWriteValue(submitted: unknown, expected: unknown): boolean {
  return submitted === expected;
}

/**
 * The value a system-supplied key "will write": an existing row uses the cell already stored; a create uses `createDefault` / `createDefaultBy`.
 * If it cannot be computed (auto / lineAgg / overwritten later on the write path) it is unknown. Unknown is always rejected. It must not be swallowed.
 */
function systemExpectedWriteValue(
  field: Field,
  payload: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, unknown>> | null,
): { readonly known: true; readonly value: unknown } | { readonly known: false } {
  if (stored !== null && Object.hasOwn(stored, field.key)) {
    return { known: true, value: stored[field.key] };
  }
  const fromDefault = createDefaultValue(field, payload, new Date(0), "UTC");
  if (fromDefault !== null) return { known: true, value: fromDefault };
  return { known: false };
}

export function systemWriteConflictMessage(field: Field): string {
  const help = field.help;
  const next =
    typeof help === "string" && help.trim() !== ""
      ? help.trim()
      : `Change it through the business owner of "${field.label}". Do not change it on this module.`;
  return `Field "${field.label}" is system-supplied. The submitted value does not match the value the system will write, so this cannot be treated as a successful write. ${next}`;
}

/**
 * A declared system-supplied key: a matching read-back is ignored; a stolen write is a conflict. Undeclared keys are not judged here.
 *
 * "The value that will be written" comes only from an existing `createDefaultBy` / `createDefault` and from the stored row. No second field table is opened.
 */
export function classifyWriteEnvelope(
  declared: readonly Field[],
  payload: Readonly<Record<string, unknown>>,
  channel: "user" | "planner" = "user",
  stored: Readonly<Record<string, unknown>> | null = null,
): WriteEnvelopeClassification {
  const ignored: WriteEnvelopeIgnoredKey[] = [];
  const conflicts: WriteEnvelopeConflict[] = [];
  const byKey = new Map(declared.map((field) => [field.key, field]));
  for (const [key, submitted] of Object.entries(payload)) {
    if (isWriteEnvelopeIgnoredKey(key)) continue;
    const field = byKey.get(key);
    if (field === undefined) continue;
    if (channel === "planner" && isPlannerSupplied(field)) continue;
    if (!isSystemSupplied(field, declared)) continue;
    const expected = systemExpectedWriteValue(field, payload, stored);
    if (!expected.known) continue;
    if (sameSystemWriteValue(submitted, expected.value)) {
      ignored.push({
        key,
        reason: `"${field.label}" is system-supplied. The submitted value matches the value the system will write, so it was ignored`,
      });
    } else {
      conflicts.push({ key, message: systemWriteConflictMessage(field) });
    }
  }
  return { ignored, conflicts };
}

/**
 * What was normalized on one write envelope. An empty `moved` means the input was returned unchanged.
 */
export interface HoistedBillEnvelope {
  readonly header: Readonly<Record<string, unknown>>;
  /** Normalized lines. When nothing was moved, the argument is returned as-is, and the type is not narrowed. */
  readonly lines: unknown;
  /** Line-table names moved from the header back into lines. */
  readonly moved: readonly string[];
  /** The top-level lines value could not be a legal envelope (it is not an object) and was discarded. */
  readonly droppedLines: boolean;
  /** Line-table names that were given as one row and had not yet been wrapped in an array (`lines.<table>` is a row object). */
  readonly wrapped: readonly string[];
}

/**
 * Whether the cell in the header holds "the rows of this line table". Three shapes are recognized, and each has been seen in practice:
 * an array of rows, one extra wrap under the same key (`{lines:[…]}`), and a single row object (the `[]` was missing).
 * An empty object and a scalar do not count. See the two boundaries written on `singleRow`.
 */
function strayRows(value: unknown, table: string): readonly unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "object" || value === null) return null;
  const inner = (value as Record<string, unknown>)[table];
  if (Array.isArray(inner)) return inner;
  const one = singleRow(value, table);
  return one === null ? null : [one];
}

/**
 * `lines.<table>` was given as one row object rather than an array of rows.
 *
 * Seen in production (`bill_create salesOrder`):
 *
 * ```jsonc
 * "lines": { "lines": { "productId": "…", "qty": 2321, "price": 26.34, "unit": "set" } }
 * ```
 *
 * Every value and every key was right. Only the wrapping `[]` was missing, and it came back as "lines.lines must be an array".
 * One row and many rows have no shape difference in natural language ("one line" and "a few lines"), so a model dropping
 * that pair of brackets is something that will happen, and one retry costs more than recognizing it here.
 *
 * ## Three boundaries where this function does not touch the value
 *
 * · An empty object is not wrapped. `{}` usually means "there are no lines". Wrapping it as `[{}]` invents an empty line,
 *   which then fails the required gate. "You gave no row" becomes "you gave one wrong row", which is harder to understand.
 * · One extra wrap under the same key (`{lines:[…]}`) is handed to `strayRows` to unwrap. It is not treated as a single row.
 * · An array, a string, or a number is not this case. It is passed through for `requireArray` to report.
 */
function singleRow(value: unknown, table: string): Readonly<Record<string, unknown>> | null {
  if (Array.isArray(value) || typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj[table])) return null; // a double envelope, not a single row
  return Object.keys(obj).length === 0 ? null : obj;
}

/**
 * When lines were stuffed into the header, move them back. The shape is normalized. No value is changed.
 *
 * ## Why this layer exists
 *
 * A create envelope is `{header, lines}`, and `lines` is grouped by line-table name. The write side (`headerWrite`'s key gate,
 * `billLines`'s `requireObject`) hard-rejects an envelope with the wrong shape, and that rejection is correct. When the caller is a model,
 * "reject and retry" produces no new information, and the next attempt may simply be wrong in a different way.
 *
 * Two shapes have been seen (KDocs#143):
 *
 * ```jsonc
 * // ① the agent's bill_create
 * { "header": { …, "lines": { "lines": [ …real rows… ] } }, "lines": {} }
 * // ② an open-create-confirm card submit
 * { "header": { …, "lines": { "lines": [ …real rows… ] } },
 *   "lines": [ { "goods": "…", "quantity": "20 units" } ] }   // the copy meant for a person to read
 * ```
 *
 * Both come from one sentence: the card contract says "header is the write value", so the model builds a machine copy
 * and a copy for a person to read, stuffs the machine copy into header, and puts the display copy into lines.
 *
 * ## 🔴 This is not a fallback default
 *
 * What is normalized is the shape: no key is added and no value is rewritten. Rows that were already written clearly are moved
 * from the wrong pocket to the right pocket. Required, unique, ref, and the value gate all still run afterwards.
 *
 * ## Three boundaries where this function does not touch the value
 *
 * · Both places gave the same table: do not move. Those are two contradictory statements, and picking one would decide for the caller.
 * · The cell in the header has an unrecognized shape (not a row array, and not one extra wrap under the same key): do not guess. Hand it to the key gate.
 * · The header has no lines at all: return the input unchanged, and do not touch a top-level lines value that is illegal
 *   (let `requireObject` report it, instead of quietly passing an empty envelope down).
 *
 * Only when rows were actually moved, and the top-level value could not be a legal envelope (it is not an object),
 * is it discarded and `droppedLines` reported. The caller must be able to hear that what it sent was dropped.
 */
export function hoistMisplacedLines(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: unknown,
): HoistedBillEnvelope {
  const intact: HoistedBillEnvelope = { header, lines, moved: [], droppedLines: false, wrapped: [] };
  const subtables = schema.fields.filter((field) => field.type === "subtable").map((field) => field.key);
  if (subtables.length === 0) return intact;

  const usable = typeof lines === "object" && lines !== null && !Array.isArray(lines);
  const envelope: Record<string, unknown> = usable ? { ...(lines as Record<string, unknown>) } : {};
  const nextHeader: Record<string, unknown> = { ...header };
  const moved: string[] = [];
  for (const table of subtables) {
    if (!(table in nextHeader)) continue;
    if (Array.isArray(envelope[table])) continue;
    const rows = strayRows(nextHeader[table], table);
    if (rows === null) continue;
    envelope[table] = rows;
    delete nextHeader[table];
    moved.push(table);
  }

  // When there is only one row, wrap the row object in an array (see `singleRow`). This runs after the header move:
  // the copy moved back from the header may also be a single row object.
  const wrapped: string[] = [];
  for (const table of subtables) {
    if (!(table in envelope)) continue;
    const one = singleRow(envelope[table], table);
    if (one === null) continue;
    envelope[table] = [one];
    wrapped.push(table);
  }

  if (moved.length === 0 && wrapped.length === 0) return intact;
  return {
    header: nextHeader,
    lines: envelope,
    moved,
    droppedLines: moved.length > 0 && !usable && lines !== undefined && lines !== null,
    wrapped,
  };
}

/** What was normalized, told back to the caller. An empty array means nothing was moved. */
export function describeHoistedEnvelope(
  hoisted: HoistedBillEnvelope,
  headerKey: "header" | "patch" = "header",
): readonly string[] {
  if (hoisted.moved.length === 0 && hoisted.wrapped.length === 0) return [];
  return [
    ...hoisted.moved.map((table) => `${headerKey}.${table} → lines.${table} (lines go in the lines parameter; do not put them in the header)`),
    ...(hoisted.droppedLines
      ? ["The top-level lines value is not a {line table name: [rows]} shape (it is usually the copy meant for a person to read) and was discarded. The write uses the rows moved back from the header"]
      : []),
    ...hoisted.wrapped.map(
      (table) => `lines.${table} was given as a single row object and was treated as one row (this cell is always an array; even one row must be written as [ { … } ])`,
    ),
  ];
}

export function classifyBillWriteEnvelope(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null,
  channel: "user" | "planner" = "user",
  stored: {
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  } | null = null,
): WriteEnvelopeClassification {
  const headerClass = classifyWriteEnvelope(schema.fields, header, channel, stored?.header ?? null);
  const ignored: WriteEnvelopeIgnoredKey[] = [...headerClass.ignored];
  const conflicts: WriteEnvelopeConflict[] = [...headerClass.conflicts];
  if (lines === null) return { ignored, conflicts };
  for (const [table, rows] of Object.entries(lines)) {
    const field = schema.fields.find((candidate) => candidate.key === table && candidate.type === "subtable");
    if (field === undefined || field.fields === null) continue;
    const storedRows = stored?.lines[table] ?? [];
    for (const [index, row] of rows.entries()) {
      const storedRow =
        typeof row["id"] === "string"
          ? (storedRows.find((candidate) => candidate["id"] === row["id"]) ?? null)
          : null;
      const rowClass = classifyWriteEnvelope(field.fields, row, channel, storedRow);
      const prefix = `${table}[${String(index + 1)}]`;
      for (const item of rowClass.ignored) {
        ignored.push({ key: `${prefix}.${item.key}`, reason: item.reason });
      }
      for (const item of rowClass.conflicts) {
        conflicts.push({ key: `${prefix}.${item.key}`, message: item.message });
      }
    }
  }
  return { ignored, conflicts };
}

export function omitMatchingSystemWriteKeys(
  declared: readonly Field[],
  payload: Readonly<Record<string, unknown>>,
  channel: "user" | "planner" = "user",
  stored: Readonly<Record<string, unknown>> | null = null,
): Record<string, unknown> {
  const matching = new Set(classifyWriteEnvelope(declared, payload, channel, stored).ignored.map((item) => item.key));
  if (matching.size === 0) return { ...payload };
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !matching.has(key)));
}

/**
 * Keys this module does not accept on one write: undeclared, a line table (that belongs in the lines parameter), or system-supplied
 * (including a stolen write, and a system cell whose value-to-be-written cannot be computed). A system-supplied key whose read-back matches is not in this list.
 *
 * 🔴 This is the only criterion of the key gate. Three consumers share it: storage's `headerWrite` / `lineWrite`
 * (the moment of persistence) and the Planner's `assertPlanTargets` (the moment of preview).
 *
 * It has to be one copy, not a second copy written beside the Planner. Two criteria drifting apart shows up as
 * a preview that is entirely green and an execution that rolls the whole group back. This was measured: the old production-release Planner
 * stuffed a field the target line had not declared into `materialRequirement.lines`.
 * The preview returned `verdict.pass = true`, nine gates all green, and a normal fingerprint.
 * The user confirmed, and 33 seconds later the whole group rolled back with "the line does not accept field …".
 * Nothing the user typed was wrong, and no step let them discover it. Once the criterion is shared,
 * this class turns red before a fingerprint is issued (`assertPlanTargets`, at the same moment as its setStatus checks).
 *
 * Matching versus stolen writes of system-supplied values are judged first by `classifyWriteEnvelope`. The system cells this function still sees
 * are the "the value that will be written cannot be known" tier (auto / lineAgg). A Planner `createdId` placeholder is an object,
 * and platform keys have already been removed by `isWriteEnvelopeIgnoredKey`, so this layer does not need to know about it.
 *
 * @param declared Header passes `schema.fields`. A line passes that line table's `field.fields`.
 * @param scope The header tier also rejects `subtable`. It has its own parameter channel, and writing it into header uses the wrong interface.
 */
export function unacceptableWriteKeys(
  declared: readonly Field[],
  payload: Readonly<Record<string, unknown>>,
  scope: "header" | "line",
  channel: "user" | "planner" = "user",
  stored: Readonly<Record<string, unknown>> | null = null,
): readonly string[] {
  const writable = new Set(
    declared
      .filter(
        (field) =>
          (!isSystemSupplied(field, declared) || (channel === "planner" && isPlannerSupplied(field))) &&
          (scope === "line" || field.type !== "subtable"),
      )
      .map((field) => field.key),
  );
  const matching = new Set(classifyWriteEnvelope(declared, payload, channel, stored).ignored.map((item) => item.key));
  return Object.keys(payload).filter(
    (key) => !isWriteEnvelopeIgnoredKey(key) && !writable.has(key) && !matching.has(key),
  );
}

/**
 * The type of each platform field.
 *
 * 🔴 This has to live in the kernel. Queryability and the comparator set have one criterion (`COMPARATORS_BY_TYPE`),
 * and that table is indexed by type. Without this map every consumer answers "what type is createdAt" for itself.
 * The server once copied one (`HEADER_PLATFORM_TYPES`), and the client copied a third.
 * When the three drift, the symptom is "the field is missing from the panel the agent can filter", and neither side reports an error.
 *
 * `Record<PlatformField, FieldType>` is an exhaustive constraint. Adding a platform field without filling it in does not compile.
 */
export const PLATFORM_FIELD_TYPES: Readonly<Record<PlatformField, FieldType>> = Object.freeze({
  id: "string",
  status: "enum",
  revision: "number",
  createdAt: "datetime",
  createdBy: "string",
  updatedAt: "datetime",
  updatedBy: "string",
  // Tenant and org may appear in a condition: they can only intersect with a scope condition, and can never widen the result set.
  tenantId: "string",
  orgId: "string",
});

/** One push edge that creates this module: who, and through which edge. The wording is derived here. It is not written by hand. */
export interface PushOrigin {
  readonly module: string;
  readonly moduleLabel: string;
  readonly transition: string;
  /** Button label of that edge (for example `receive`). The UI quotes it directly. */
  readonly action: string;
}

/**
 * An extra creation path discovered while the module table is assembled.
 *
 * An ordinary `transition.push` can be scanned by the kernel directly. A Planner `createBill` target lives on a named export,
 * is checked by the loader, projected into this shape, and then merged by the same `withPushOrigins`.
 * A target from this assembly-time source may only be generated by the system. The type does not grow another optional flag for it.
 */
export interface TargetedPushOrigin extends PushOrigin {
  readonly target: string;
}

/**
 * Where this module's data comes from. Derived. It is not in `MODULE_KEYS`.
 *
 * Same rule as `Transition.postsToLedger`: writing it into the declaration is rejected by the seventh-concept gate. Two sources, two levels of view:
 *   ① `manual` / `blockers` — a field that cannot be supplied is recorded as a blocker. When `capabilities.create` is false
 *      a further why is appended: "The module declaration does not allow manual create". When it is "system", the why is "Generated by the system; manual create is not allowed".
 *      `manual` is derived only from `blockers.length === 0`.
 *   ② `pushedFrom` — "who pushes to me" has to scan every module. One module is structurally blind to it,
 *      so it is filled while the module table is assembled (`@open-erp/loader` calls `withPushOrigins`).
 *
 * 🔴 An unresolved `pushedFrom` is `null`, not `[]`. The two mean opposite things. `[]` means "looked, and nobody
 * pushes to it" (with `manual: false`, create not `"system"`, and no document picker, this module cannot produce data).
 * `null` means "not yet looked up in the module table". Collapsing that to `[]` makes a catalog that skipped the assembly step
 * look unreachable on every module, and the UI would disable every New button on that conclusion.
 */
/** Capabilities after normalization. create is true, false, or "system"; export and import are booleans. An omitted export is recorded as true. An omitted import is recorded as true when create is true, and as false when create is false or "system". */
export interface ModuleCapabilities {
  readonly create: true | false | "system";
  readonly export: boolean;
  readonly import: boolean;
}

export interface Creatable {
  /** Can be created by hand. Equal to `blockers.length === 0`. */
  readonly manual: boolean;
  /** Reasons when `manual === false`. Empty when it can be created. The path narrowed by declaration is `capabilities.create`. */
  readonly blockers: readonly CreateBlocker[];
  readonly pushedFrom: readonly PushOrigin[] | null;
}

export interface ModuleSchema {
  /**
   * Identity. Not in the declaration. The loader derives it from the file path and injects it through `sealModule`:
   * the file name is the code, the directory name is the domain. Writing it into the declaration is a second source of the same fact, and a rename will drift.
   */
  readonly code: string;
  readonly label: string;
  /** Same as `code`: the owning domain is the directory name, injected at seal time. */
  readonly domain: string;
  /**
   * This module opens custom fields to the tenant. The open list is a product decision, not runtime data.
   * The table builder emits a `custom jsonb` column and a GIN index from it, so it can only travel with a version.
   *
   * 🔴 Not every table should open it. GIN was measured at about 10% write amplification, and the index is about 8% of the table.
   * A table nobody uses should not pay that cost. To open a new table, change this and ship a version.
   */
  readonly customFields: boolean;
  /**
   * Numbering rule. Required when there is an auto field. May be omitted when there is no auto field (master data often types its code).
   * The platform owns one format family. Here only the prefix is declared.
   */
  readonly numbering: Numbering | null;
  /**
   * The main and auxiliary unit set this module's records provide. The only convention: 1 auxiliary = conversionRate main.
   * A business-document field refers to it only through unitChoice.match. It does not repeat the three source field names.
   */
  readonly unitSet: UnitSet | null;
  readonly fields: readonly Field[];
  readonly lifecycle: Lifecycle;
  readonly handoff: readonly Handoff[];
  readonly preconditions: readonly Precondition[];
  readonly views: Views;
  /** Manual create, export, and import. See `ModuleCapabilities`. */
  readonly capabilities: ModuleCapabilities;
  /** Derived: where this module's data comes from. See `Creatable`. */
  readonly creatable: Creatable;
}

/**
 * Product of the shape gate (`normalizeModule`): the six concepts are normalized, but there is no identity yet.
 *
 * Only someone who has the file path (the loader) knows `code` and `domain`, so they do not enter this layer.
 */
export type ModuleShape = Omit<ModuleSchema, "code" | "domain">;

/**
 * Proof that the shape gate has been passed.
 *
 * 🔴 A duck check cannot do this. The loader used to test `"code" in v && "lifecycle" in v`.
 * A bare object with a fine shape passed too, so the shape gate (seventh-concept allowlist, TRANSITION key closure)
 * never ran on the load path. The worst shape is a bare object carrying `postsToLedger: false`:
 * "posting requires confirmation" is silently turned off, and the web `assertDerivedPresent` only checks presence,
 * not correctness (`typeof === "boolean"` lets it through), with no symptom along the way.
 *
 * 🔴 It also cannot be "the loader runs normalizeModule again". `normalizeTransition`
 * is not idempotent on an already normalized product. `TRANSITION_KEYS` does not include the derived `postsToLedger`,
 * so the closed-key gate rejects it as an unknown key and every module blows up (`postsToLedger.test.ts` pins this).
 *
 * A Symbol, non-enumerable: it does not enter `JSON.stringify`, and gates that walk `Object.keys`
 * such as `assertClosedKeys` do not see it. Sealing (`sealModule`) drops it with the spread. A sealed
 * `ModuleSchema` carries no proof, because nobody still needs to ask "did you pass the shape gate".
 */
export const MODULE_DRAFT: unique symbol = Symbol.for("open-erp.moduleDraft");

/**
 * Product of `defineModule({...})`: past the shape gate, stamped, and without identity.
 *
 * It is a different type from `ModuleSchema`, so TypeScript blocks misuse. A draft lacks `code` and `domain`
 * and cannot be passed to anything that consumes `ModuleSchema`. A bare object lacks the proof key and cannot be passed to `sealModule`.
 */
export interface ModuleDraft extends ModuleShape {
  readonly [MODULE_DRAFT]: true;
}

export interface UnitSet {
  readonly main: string;
  readonly auxiliary: string;
  readonly conversionRate: string;
}

function declaredBoolean(value: unknown, at: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true || value === false) return value;
  schemaFail(`${at} must be a boolean`);
}

function declaredCreate(value: unknown, at: string): true | false | "system" | undefined {
  if (value === undefined) return undefined;
  if (value === true || value === false || value === "system") return value;
  schemaFail(`${at} can only be true, false, or "system"`);
}

/**
 * A capability declaration can only narrow. Omitting the whole key means create, export, and import are all true.
 * An explicit create of true schemaFails when a field blocker already exists.
 * When create is false or "system", an explicit import of true also schemaFails. Those two tiers do not schemaFail because of a field blocker.
 */
function normalizeCapabilities(
  raw: unknown,
  label: string,
  fieldBlockers: readonly CreateBlocker[],
): ModuleCapabilities {
  if (raw === undefined) return { create: true, export: true, import: true };
  const obj = requireObject(
    raw,
    `${label}.capabilities`,
    '{ create?: true | false | "system"; export?: boolean; import?: boolean }',
  );
  assertClosedKeys(obj, CAPABILITY_KEYS, `${label}.capabilities`);
  const create = declaredCreate(obj["create"], `${label}.capabilities.create`);
  const exportEnabled = declaredBoolean(obj["export"], `${label}.capabilities.export`);
  const importEnabled = declaredBoolean(obj["import"], `${label}.capabilities.import`);
  if (create === true && fieldBlockers.length > 0) {
    const reasons = fieldBlockers.map((blocker) => blocker.why).join("; ");
    schemaFail(
      `${label}.capabilities.create is explicitly true, which contradicts the fact that fields already block manual create: ${reasons}`,
    );
  }
  const createOn = create === undefined ? true : create;
  if (createOn !== true && importEnabled === true) {
    schemaFail(`${label}.capabilities.import cannot widen import after manual create is turned off`);
  }
  const importOn = importEnabled === undefined ? createOn === true : importEnabled;
  const exportOn = exportEnabled === undefined ? true : exportEnabled;
  return { create: createOn, export: exportOn, import: importOn };
}

function normalizeUnitSet(raw: unknown, label: string): UnitSet {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, ["main", "auxiliary", "conversionRate"], label);
  return {
    main: requireCoordinateSegment(obj["main"], `${label}.main`),
    auxiliary: requireCoordinateSegment(obj["auxiliary"], `${label}.auxiliary`),
    conversionRate: requireCoordinateSegment(obj["conversionRate"], `${label}.conversionRate`),
  };
}

/**
 * Normalize one module declaration.
 *
 * This layer is shape only: closed keys, closed enums, grammar.
 * The semantic layer (status reachability, field-reference validity, effect rollback reachability) is in validate.ts.
 * They are split so a validation report can list every problem at once, instead of stopping at the first throw.
 */
export function normalizeModule(raw: unknown, label = "module"): ModuleShape {
  const obj = requireObject(raw, label);

  const forbidden = Object.keys(obj).filter((k) => k in FORBIDDEN_MODULE_KEYS);
  if (forbidden.length) {
    const reasons = forbidden.map((k) => `"${k}": ${FORBIDDEN_MODULE_KEYS[k]}`).join("; ");
    schemaFail(`${label} contains a seventh concept that must not exist: ${reasons}`);
  }
  assertClosedKeys(obj, MODULE_KEYS, label);

  // 🔴 `x` plus an uppercase letter is the reserved namespace of tenant custom fields (see schema/customField.ts).
  // If the declaration takes that name, a tenant field with the same name is silently shadowed by the declared field.
  // The symptom is "it was configured, but the form will not accept a value", with no error. This gate makes that impossible.
  for (const raw of Array.isArray(obj["fields"]) ? obj["fields"] : []) {
    const key = (raw as { key?: unknown })?.key;
    if (typeof key === "string" && isReservedCustomPrefix(key)) {
      schemaFail(
        `${label}.fields "${key}" uses a reserved namespace: a field name that starts with x and an uppercase letter is reserved for tenant custom fields. ` +
          `Rename the declared field (for example ${key.slice(1, 2).toLowerCase()}${key.slice(2)})`,
      );
    }
  }

  const customFieldsRaw = obj["customFields"];
  if (customFieldsRaw !== undefined && customFieldsRaw !== true) {
    schemaFail(`${label}.customFields accepts only true. Omitting it means custom fields are closed`);
  }

  const fields = requireArray(obj["fields"], `${label}.fields`).map((f, i) =>
    normalizeField(f, `${label}.fields[${i}]`),
  );
  if (!fields.length) schemaFail(`${label}.fields must not be empty`);
  assertUniqueKeys(
    fields.map((f) => f.key),
    `${label}.fields`,
  );

  const handoffRaw = obj["handoff"];
  const handoff =
    handoffRaw === undefined || handoffRaw === null
      ? []
      : requireArray(handoffRaw, `${label}.handoff`).map((h, i) => normalizeHandoff(h, `${label}.handoff[${i}]`));
  assertUniqueKeys(
    handoff.map((h) => h.id),
    `${label}.handoff`,
  );

  const pcRaw = obj["preconditions"];
  const preconditions =
    pcRaw === undefined || pcRaw === null
      ? []
      : requireArray(pcRaw, `${label}.preconditions`).map((p, i) =>
          normalizePrecondition(p, `${label}.preconditions[${i}]`),
        );
  assertUniqueKeys(
    preconditions.map((p) => p.id),
    `${label}.preconditions`,
  );

  const numberingRaw = obj["numbering"];
  const numbering =
    numberingRaw === undefined || numberingRaw === null
      ? null
      : normalizeNumbering(numberingRaw, `${label}.numbering`);
  const unitSetRaw = obj["unitSet"];
  const unitSet =
    unitSetRaw === undefined || unitSetRaw === null
      ? null
      : normalizeUnitSet(unitSetRaw, `${label}.unitSet`);

  // Field blockers can be computed at this layer. A declaration blocker is appended only when capabilities.create is not true.
  // false and "system" each append their own declaration blocker after the field blockers.
  // manual is blockers.length === 0. Assembly-time withPushOrigins recomputes it by the same rule.
  const fieldBlockers = createBlockersOf(fields);
  const capabilities = normalizeCapabilities(obj["capabilities"], label, fieldBlockers);
  const blockers: readonly CreateBlocker[] = capabilities.create === true
    ? fieldBlockers
    : [
        ...fieldBlockers,
        {
          path: "capabilities.create",
          label: "Manual create",
          type: "string",
          why: capabilities.create === "system"
            ? "Generated by the system; manual create is not allowed"
            : "The module declaration does not allow manual create",
        },
      ];

  return {
    label: requireText(obj["label"], `${label}.label`),
    customFields: customFieldsRaw === true,
    numbering,
    unitSet,
    fields,
    lifecycle: normalizeLifecycle(obj["lifecycle"], `${label}.lifecycle`),
    handoff,
    preconditions,
    views: normalizeViews(obj["views"], `${label}.views`),
    capabilities,
    creatable: { manual: blockers.length === 0, blockers, pushedFrom: null },
  };
}

/**
 * Fill `Transition.expandsBills`. The second source of a derived key, visible only from the module's named export.
 *
 * 🔴 The view is one level higher than the reverse side of `postsToLedger`, so the fill-in point is one level higher too.
 * Source ② of `postsToLedger` scans `reverseOn` on other edges of the same lifecycle,
 * which `normalizeLifecycle` already holds. Whether this edge has a Planner is written on
 * `export const planners` in `modules/<code>/index.ts`. That is not in the module declaration,
 * so `normalizeModule` cannot see it and should not (six-concept closure: planners is not a seventh concept,
 * it is the named extension of the directory-shape escape hatch). The only place that holds both the schema and the planners registry is
 * the scan loop in `@open-erp/loader`, so that loop is what calls this function.
 *
 * 🔴 Do not mutate the object inside the loader. Give the kernel a pure function. The criterion ("what counts as creating documents in bulk")
 * must be the same source as the gate that consumes it. Written inside the loader, a module table that does not go through the loader
 * (a unit test injection, a future second assembly path) would receive a schema that looks normal and is always false,
 * and false shows up exactly as "do not ask for confirmation": fail-open, with zero symptoms.
 *
 * When there are zero planners, return the schema unchanged (do not even allocate a new object). That is the shape of most modules.
 */
export function withPlannerExpansion(
  schema: ModuleSchema,
  plannerTransitions: ReadonlySet<string>,
): ModuleSchema {
  if (plannerTransitions.size === 0) return schema;
  for (const code of plannerTransitions) {
    // Fail fast. The loader already checked once. This asserts that the module table was not swapped between the two steps.
    // Skipping silently leaves that edge expandsBills: false forever, another fail-open with zero symptoms.
    if (transitionAction(schema.lifecycle, code) === null) {
      schemaFail(`Module "${schema.code}" has no action "${code}", so expandsBills cannot be filled`);
    }
  }
  // A Planner binds to an action: every starting point of that action creates documents in bulk.
  return {
    ...schema,
    lifecycle: {
      ...schema.lifecycle,
      transitions: schema.lifecycle.transitions.map((edge) =>
        plannerTransitions.has(edge.code) ? { ...edge, expandsBills: true } : edge,
      ),
    },
  };
}

/**
 * The authoring-time type of a module declaration.
 *
 * A module uses `satisfies ModuleInput` rather than `: ModuleInput`. It still typechecks, and it keeps the literal types,
 * so a downstream import gets the exact status keys and field keys instead of a widened string.
 *
 * This is the core payoff of TypeScript in this repo: a closed enum moves from a runtime gate to completion while typing.
 */
export interface ModuleInput {
  label: string;
  customFields?: true;
  numbering?: unknown;
  capabilities?: {
    create?: true | false | "system";
    export?: boolean;
    import?: boolean;
  };
  fields: readonly unknown[];
  lifecycle: unknown;
  handoff?: readonly unknown[];
  preconditions?: readonly unknown[];
  views: unknown;
}
