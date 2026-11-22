// ---------------------------------------------------------------------------
// ② Status — where a document sits
// ③ Transition — one transfer of responsibility
//
// 🔴 This repo has no "degenerate lifecycle". The previous generation kept a degenerate shape
// for 42 old entities (a bare string array of statuses, any state free to jump to any other).
// That was a behavior-compatibility layer, not a shorter spelling. Here every status and edge
// is declared explicitly. Master data declares its single state too; it is not derived. Once something derived is treated as a declaration, the validator starts checking its own output.
// ---------------------------------------------------------------------------

import {
  normalizeGuardCheck,
  type NormalizedCheck,
} from "../derive/primitives.js";
import {
  assertClosedKeys,
  assertUniqueKeys,
  requireArray,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";
import { normalizeEffect, type Effect } from "./effects.js";
import { isSystemSupplied, normalizeEnumOptions, normalizeField, type EnumOption, type Field } from "./fields.js";

/** Status palette: six colors, shared by the modeler and the runtime. */
export const STATUS_COLORS = ["gray", "amber", "blue", "purple", "green", "red"] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

/** How editable a status is. Edit / save are derived from it. Deletion looks at `deletableIn` and does not get its own button. */
export const EDITABILITY = ["full", "whitelist", "none"] as const;
export type Editability = (typeof EDITABILITY)[number];

/** in-use = currently occupying; retired = released from occupancy; none = a draft or document, using the old initial-state criterion. */
export type Occupancy = "in-use" | "retired" | "none";

export interface Status {
  readonly key: string;
  readonly label: string;
  readonly color: StatusColor;
  readonly initial: boolean;
  readonly terminal: boolean;
  readonly editable: Editability;
  /** Fields that may be changed when editable === 'whitelist'. */
  readonly editableFields: readonly string[] | null;
  /**
   * Derived. Do not write it in the declaration. The permission projection must stamp it
   * from the full schema, or dropping the disable edge would treat an in-use record as deletable.
   */
  readonly occupancy?: Occupancy;
}

const STATUS_KEYS = ["key", "label", "color", "initial", "terminal", "editable", "editableFields"] as const;

export function normalizeStatus(raw: unknown, label = "status"): Status {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, STATUS_KEYS, label);
  const key = requireText(obj["key"], `${label}.key`);
  const at = `statuses.${key}`;

  const terminal = obj["terminal"] === true;
  const editable =
    obj["editable"] === undefined || obj["editable"] === null
      ? terminal
        ? ("none" as const)
        : ("full" as const)
      : requireEnum(obj["editable"], EDITABILITY, `${at}.editable`);

  const listRaw = obj["editableFields"];
  let editableFields: readonly string[] | null = null;
  if (listRaw !== undefined && listRaw !== null) {
    editableFields = requireArray(listRaw, `${at}.editableFields`).map((f, i) =>
      requireText(f, `${at}.editableFields[${i}]`),
    );
  }
  if (editable === "whitelist" && !editableFields?.length) {
    schemaFail(`${at}: when editable is whitelist, editableFields is required`);
  }
  if (editable !== "whitelist" && editableFields) {
    schemaFail(`${at}: editableFields is meaningful only when editable is whitelist`);
  }

  return {
    key,
    label: obj["label"] === undefined || obj["label"] === null ? key : requireText(obj["label"], `${at}.label`),
    color:
      obj["color"] === undefined || obj["color"] === null
        ? "gray"
        : requireEnum(obj["color"], STATUS_COLORS, `${at}.color`),
    initial: obj["initial"] === true,
    terminal,
    editable,
    editableFields,
  };
}

/**
 * Parameters on an edge: what must be asked before the button is pressed.
 *
 * Dropping them causes the worst kind of silent failure: the button still renders and can be
 * clicked, but the page posts an empty body, the handler never receives the receiving warehouse or this quantity, and the user sees an error that explains nothing.
 */
export const PARAM_TYPES = ["ref", "number", "date", "text", "enum", "billLines"] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

export interface TransitionParam {
  readonly key: string;
  readonly label: string;
  readonly type: ParamType;
  readonly required: boolean;
  /** Entity pointed at when type === 'ref'. */
  readonly ref: string | null;
  /** Fixed values allowed when type === 'enum'. Same shape as Field.options. */
  readonly options: readonly EnumOption[] | null;
  /** Full field contract of the temporary lines for this action when type === 'billLines'. */
  readonly lineField: Field | null;
  /** Supplied by the action preparer and still echoed back on the request. Not editable by the user. */
  readonly hidden?: boolean;
  /** Candidate rows of billLines are fixed by the action preparer. The UI may fill column values only, not add or remove rows. */
  readonly fixedRows?: boolean;
  /** Column keys of billLines that are shown but not user-writable. The server still treats every request as untrusted. */
  readonly readOnlyColumns?: readonly string[];
  /** Column keys of billLines that exist for the Planner only and are not shown to the user. */
  readonly hiddenColumns?: readonly string[];
  /**
   * Seed billLines from this document's lines. File modules have no actionPreparers, so the ship dialog starts from this declaration.
   * `columns` maps a parameter column to a source line field. A source of `id` means the line id.
   */
  readonly seed?: BillLinesSeed | null;
}

export interface BillLinesSeed {
  readonly from: string;
  readonly columns: Readonly<Record<string, string>>;
  readonly skipNonPositive: string | null;
}

const PARAM_KEYS = [
  "key", "label", "type", "required", "ref", "lineField",
  "options", "hidden", "fixedRows", "readOnlyColumns", "hiddenColumns", "seed",
] as const;
const BILL_LINES_SEED_KEYS = ["from", "columns", "skipNonPositive"] as const;

function normalizeParam(raw: unknown, label: string): TransitionParam {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, PARAM_KEYS, label);
  const key = requireText(obj["key"], `${label}.key`);
  const type = requireEnum(obj["type"], PARAM_TYPES, `${label}.type`);
  const refRaw = obj["ref"];
  const ref = refRaw === undefined || refRaw === null ? null : requireText(refRaw, `${label}.ref`);
  if (type === "ref" && !ref) schemaFail(`${label}: a ref parameter must name the entity it points at`);
  if (type !== "ref" && ref !== null) schemaFail(`${label}: ref is meaningful only on a ref parameter`);

  const optionsRaw = obj["options"];
  const options =
    optionsRaw === undefined || optionsRaw === null ? null : normalizeEnumOptions(optionsRaw, `${label}.options`);
  if (type === "enum" && (options === null || options.length === 0)) {
    schemaFail(`${label}: an enum parameter must declare at least one options entry and must not fall back to free text`);
  }
  if (type !== "enum" && options !== null) {
    schemaFail(`${label}: options is meaningful only on an enum parameter`);
  }

  const lineFieldRaw = obj["lineField"];
  const lineField =
    lineFieldRaw === undefined || lineFieldRaw === null
      ? null
      : normalizeField(lineFieldRaw, `${label}.lineField`);
  if (type === "billLines" && lineField === null) {
    schemaFail(`${label}: a billLines parameter must declare lineField`);
  }
  if (type !== "billLines" && lineField !== null) {
    schemaFail(`${label}: lineField is meaningful only on a billLines parameter`);
  }
  const hidden = obj["hidden"] === true;
  const fixedRows = obj["fixedRows"] === true;
  const readOnlyColumns =
    obj["readOnlyColumns"] === undefined || obj["readOnlyColumns"] === null
      ? []
      : requireArray(obj["readOnlyColumns"], `${label}.readOnlyColumns`).map((key, index) =>
        requireText(key, `${label}.readOnlyColumns[${String(index)}]`),
      );
  const hiddenColumns =
    obj["hiddenColumns"] === undefined || obj["hiddenColumns"] === null
      ? []
      : requireArray(obj["hiddenColumns"], `${label}.hiddenColumns`).map((key, index) =>
        requireText(key, `${label}.hiddenColumns[${String(index)}]`),
      );
  assertUniqueKeys(readOnlyColumns, `${label}.readOnlyColumns`);
  assertUniqueKeys(hiddenColumns, `${label}.hiddenColumns`);
  const seedRaw = obj["seed"];
  let seed: BillLinesSeed | null = null;
  if (seedRaw !== undefined && seedRaw !== null) {
    const rawSeed = requireObject(seedRaw, `${label}.seed`);
    assertClosedKeys(rawSeed, BILL_LINES_SEED_KEYS, `${label}.seed`);
    const columnsRaw = requireObject(rawSeed["columns"], `${label}.seed.columns`);
    const columns: Record<string, string> = {};
    for (const [column, fromField] of Object.entries(columnsRaw)) {
      columns[column] = requireText(fromField, `${label}.seed.columns.${column}`);
    }
    if (Object.keys(columns).length === 0) {
      schemaFail(`${label}.seed.columns must not be an empty object`);
    }
    const skipRaw = rawSeed["skipNonPositive"];
    seed = {
      from: requireText(rawSeed["from"], `${label}.seed.from`),
      columns,
      skipNonPositive:
        skipRaw === undefined || skipRaw === null ? null : requireText(skipRaw, `${label}.seed.skipNonPositive`),
    };
  }
  if (type !== "billLines" && (fixedRows || readOnlyColumns.length > 0 || hiddenColumns.length > 0 || seed !== null)) {
    schemaFail(`${label}: fixedRows / readOnlyColumns / hiddenColumns / seed are meaningful only on a billLines parameter`);
  }
  if (lineField !== null && (lineField.type !== "subtable" || !lineField.fields?.length)) {
    schemaFail(`${label}.lineField: a billLines lineField must be a subtable that declares columns`);
  }
  const paramLabel = obj["label"] === undefined || obj["label"] === null ? key : requireText(obj["label"], `${label}.label`);
  const required = obj["required"] !== false;
  if (
    lineField !== null &&
    (lineField.key !== key || lineField.label !== paramLabel || lineField.required !== required)
  ) {
    schemaFail(`${label}.lineField: key / label / required must match the parameter itself, so one action input does not carry two coordinates, names, or completeness rules`);
  }
  if (lineField?.fields) {
    const columns = new Set(lineField.fields.map((column) => column.key));
    for (const key of [...readOnlyColumns, ...hiddenColumns]) {
      if (!columns.has(key)) schemaFail(`${label}: line column "${key}" does not exist and cannot set display behavior`);
    }
    for (const key of readOnlyColumns) {
      if (hiddenColumns.includes(key)) {
        schemaFail(`${label}: line column "${key}" cannot be both hidden and readOnly`);
      }
    }
    for (const column of lineField.fields) {
      if (isSystemSupplied(column, lineField.fields)) {
        schemaFail(
          `${label}.lineField.fields.${column.key}: action temporary lines accept caller input only and do not support system-supplied fields (auto / derive / snapshot / calculate / lineAgg, or a refLine companion column)`,
        );
      }
      if (column.refDefault !== null || column.unitChoice !== null || column.pushFrom !== null || column.createDefault != null) {
        schemaFail(
          `${label}.lineField.fields.${column.key}: action temporary lines do not support refDefault / unitChoice / pushFrom / createDefault`,
        );
      }
      // A read-only column may carry refPreselect: the action line preselects it for the user to see, not to change.
      // Putting it on a writable column makes the dialog look choosable while the system overwrites the value before confirm.
      if (column.refPreselect !== null && !readOnlyColumns.includes(column.key)) {
        schemaFail(
          `${label}.lineField.fields.${column.key}: refPreselect may be attached only to readOnlyColumns. On action temporary lines the default is for the user to see, not to edit`,
        );
      }
    }
  }
  return {
    key,
    label: paramLabel,
    type,
    required,
    ref,
    options,
    lineField,
    hidden,
    fixedRows,
    readOnlyColumns,
    hiddenColumns,
    seed,
  };
}

export interface Transition {
  /**
   * Business action. An edge is identified by `(code, from)`: the same action has one edge per starting status and shares the code.
   * The client and the agent submit only the code. The server resolves the edge with `transitionAt` from the document's current status.
   */
  readonly code: string;
  readonly from: string;
  readonly to: string;
  /** Button label. */
  readonly action: string;
  /** May run only as a Planner consequence of a source action. It does not appear on buttons, the permission catalog, or manual operation help. */
  readonly internal?: true;
  /** Default action in this status (the primary button). Without it the UI can only render every edge as secondary. */
  readonly primary: boolean;
  /** Confirmation dialog. */
  readonly confirm: boolean;
  /** Code of the downstream document this push creates. */
  readonly push: string | null;
  /**
   * The only explicit line pairing for a push. `null` keeps the old refLine.through / same-name derivation.
   *
   * This is the normalized fact of the object form of `push`, not a second declaration key. The object is written
   * `push: { module, line: { source, target } }`, and consumers read only this normalized result.
   */
  readonly pushLine: PushLineMapping | null;
  /**
   * Cells this edge fixes at push time. Keys are header field keys of the target module, or `<subtable>.<column>`.
   *
   * 🔴 This covers what `push` cannot say: a field that is required on the target and that the source document structurally cannot have.
   * "This order came from a purchase plan" is not copied from a cell on the plan. It is a fact of this edge.
   * Without the declaration a person has to fill it in afterwards, so push can never produce a document that can be submitted.
   *
   * It is mutually exclusive with `pushFrom`: that one says which source cell to copy, this one says the cell does not come from the source.
   * Giving both for the same cell is two sources of truth, and `validateModule` rejects it.
   *
   * ⚠️ It is a deliberate placeholder, not a default fill. The value must pass the target field's type and enum checks at build time,
   * and "a placeholder must not be submitted as a real value" is guaranteed by the target module's own preconditions
   * (for example a tax-included price of 0 is rejected at submit by `price_positive`, in business language).
   * Declaring a placeholder with no downstream gate under it puts a fake value into the business flow.
   */
  readonly pushDefaults: Readonly<Record<string, string | number>> | null;
  readonly params: readonly TransitionParam[];
  readonly effects: readonly Effect[];
  /**
   * Remaining-quantity field. When it is <= 0 this edge disappears from buttons and the action catalog instead of going grey and toasting.
   *
   * A header field is written `openQty`; a line field is `lines.openQty`. On a projection that can see lines,
   * the edge stays while any line is > 0. A header-only projection such as a list does not hide it (missing rows must not be treated as fully shipped).
   *
   * It sits beside `when`: remaining is about quantity, when is about shape. Do not fold them into one expression.
   */
  readonly remaining?: string | null;
  /**
   * Whether this outgoing edge exists for the current kind of document. `null` means it exists unconditionally in this status.
   *
   * 🔴 This is not a gate. A gate means the edge exists but this attempt cannot pass it. When `when` is false the edge
   * is not in the visible set for this document at all. The write path blocks too (in words: this operation does not apply to the current document)
   * instead of turning into a schemaFail 500.
   *
   * It sits beside `remaining`: remaining hides the edge when quantity is <= 0, when means the edge does not exist when the field shape does not match.
   *
   * The guard is the same set as `Precondition.when`: only `field_compare` (`GUARD_PRIMITIVES`),
   * zero IO, looking at the shape of `$bill.` itself. An evaluation throw fails closed (treat as not applicable: hide the edge / block the write path).
   * That is the opposite of a gate's when, which treats a throw as applicable: there, do not turn the gate off; here, do not let an edge that should not run actually run.
   */
  readonly when?: NormalizedCheck | null;
  /**
   * Whether walking this edge posts to the ledger. Derived, not declared, same as `Effect.perLine`.
   * It is not in `TRANSITION_KEYS`. Writing it in the declaration is rejected by the closed-key gate.
   *
   * Two sources, and both are required:
   *   ① This edge declares `effects` — a forward posting (occupy an accounts-payable exposure, deduct stock, raise a receivable).
   *   ② Another edge's effect lists this edge in `reverseOn` — this edge declares no effects
   *      and still writes a reversing ledger entry. Unapprove is exactly that: it declares nothing, and it releases the exposure approve occupied.
   *   ② needs a module-wide view, so it is filled in `normalizeLifecycle` (one edge cannot see the others).
   *
   * 🔴 The UI decides from this whether a click needs confirmation first. Do not switch that decision to the runtime `plan`.
   * Judging from plan is fail-open: the same edge skips the dialog on a document whose plan happens to be empty,
   * and "sometimes it asks, sometimes it does not" has no symptom, so the user cannot form an expectation.
   * Whether to confirm is a declared property (constant). How much money the confirmation shows is the evaluated result (it differs per document).
   */
  readonly postsToLedger: boolean;
  /**
   * Whether walking this edge creates documents in bulk. Same as `postsToLedger`: derived, not declared,
   * not in `TRANSITION_KEYS`. Writing it in the declaration is rejected by the closed-key gate.
   *
   * Criterion (the first version has only one): this module is a directory shape, and this edge has a Planner.
   * A Planner's only product is an `ExecutionPlan`, and `createBill` is the main command of its three.
   * One run creating N production tasks plus N material requirements is its normal shape.
   *
   * 🔴 The fill-in point is `@open-erp/loader` (`withPlannerExpansion`), not `normalizeLifecycle`.
   * Same rule as source ② of `postsToLedger`, one level of view higher: the reverse side scans other edges
   * in the same lifecycle (a module-wide view, which normalizeLifecycle can see). Whether this edge has a Planner is written on
   * the named export `planners` in `modules/<code>/index.ts`. That export is not in the lifecycle declaration at all,
   * so `normalizeLifecycle` is structurally blind to it. The loader is the only place that holds both the schema and
   * the planners registry (the return value of `loadPlanners`), so the fill-in can only happen there.
   *
   * 🔴 Do not use the runtime `plan` to decide whether to confirm. The criterion is the same wording as on `postsToLedger`:
   * using plan is fail-open. The same edge skips the dialog on a document whose plan happens to be empty, and "sometimes it asks,
   * sometimes it does not" has no symptom. Whether to confirm is a declared property (constant).
   * How many documents the confirmation says will be created is the evaluated result (it differs per document, via the preview `ExecutionPlanSummary`).
   *
   * 🔴 Do not rely on the modeler writing `confirm: true` on each edge. That was measured to be missed (see AGENTS.md,
   * "posting requires confirmation"). The old production-release Planner's two bulk edges
   * had no parameters, no confirm, and zero effects, so none of the three criteria hit. It was one click, zero confirmation,
   * zero preview, and documents were created in bulk. Checking 20 rows on the list and clicking once created over a hundred.
   */
  readonly expandsBills: boolean;
}

export interface PushLineMapping {
  readonly source: string;
  readonly target: string;
}

const TRANSITION_KEYS = ["code", "from", "to", "action", "internal", "primary", "confirm", "push", "pushDefaults", "params", "effects", "remaining", "when"] as const;
const PUSH_KEYS = ["module", "line"] as const;
const PUSH_LINE_KEYS = ["source", "target"] as const;

function normalizePush(
  raw: unknown,
  at: string,
): { readonly module: string; readonly line: PushLineMapping | null } | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string") return { module: requireText(raw, at), line: null };

  const obj = requireObject(raw, at);
  if (Object.hasOwn(obj, "generatedOnly")) {
    schemaFail(`${at}.generatedOnly: a Planner-produced target is generated only. It must not be written by hand`);
  }
  assertClosedKeys(obj, PUSH_KEYS, at);
  const module = requireText(obj["module"], `${at}.module`);
  const lineRaw = obj["line"];
  if (lineRaw === undefined || lineRaw === null) {
    schemaFail(`${at}: the object form must declare line; otherwise write the module code as a string`);
  }
  const line = requireObject(lineRaw, `${at}.line`);
  assertClosedKeys(line, PUSH_LINE_KEYS, `${at}.line`);
  return {
    module,
    line: {
      source: requireText(line["source"], `${at}.line.source`),
      target: requireText(line["target"], `${at}.line.target`),
    },
  };
}

export function normalizeTransition(raw: unknown, label = "transition"): Transition {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, TRANSITION_KEYS, label);
  const code = requireText(obj["code"], `${label}.code`);
  const at = `transitions.${code}`;

  const paramsRaw = obj["params"];
  const params =
    paramsRaw === undefined || paramsRaw === null
      ? []
      : requireArray(paramsRaw, `${at}.params`).map((p, i) => normalizeParam(p, `${at}.params[${i}]`));
  assertUniqueKeys(
    params.map((p) => p.key),
    `${at}.params`,
  );

  const effectsRaw = obj["effects"];
  const effects =
    effectsRaw === undefined || effectsRaw === null
      ? []
      : requireArray(effectsRaw, `${at}.effects`).map((e, i) => normalizeEffect(e, `${at}.effects[${i}]`));

  const normalizedPush = normalizePush(obj["push"], `${at}.push`);
  const push = normalizedPush?.module ?? null;
  const defaultsRaw = obj["pushDefaults"];
  let pushDefaults: Record<string, string | number> | null = null;
  if (defaultsRaw !== undefined && defaultsRaw !== null) {
    if (push === null) schemaFail(`${at}.pushDefaults: this edge has no push, so a fixed downstream cell has nowhere to land`);
    const entries = Object.entries(requireObject(defaultsRaw, `${at}.pushDefaults`));
    if (!entries.length) schemaFail(`${at}.pushDefaults: an empty object was given. Omit the key when it is not needed`);
    pushDefaults = {};
    for (const [key, value] of entries) {
      if (typeof value !== "string" && typeof value !== "number") {
        schemaFail(`${at}.pushDefaults.${key}: only a string or a number is accepted (received ${typeof value})`);
      }
      pushDefaults[key] = value as string | number;
    }
  }

  const remainingRaw = obj["remaining"];
  const remaining =
    remainingRaw === undefined || remainingRaw === null
      ? null
      : requireText(remainingRaw, `${at}.remaining`);
  if (remaining !== null && remaining.trim() === "") {
    schemaFail(`${at}.remaining: an empty string was given. Omit the key when it is not needed`);
  }

  const whenRaw = obj["when"];
  const when =
    whenRaw === undefined || whenRaw === null ? null : normalizeGuardCheck(whenRaw, `${at}.when`);

  return {
    code,
    from: requireText(obj["from"], `${at}.from`),
    to: requireText(obj["to"], `${at}.to`),
    action: obj["action"] === undefined || obj["action"] === null ? code : requireText(obj["action"], `${at}.action`),
    ...(obj["internal"] === true ? { internal: true as const } : {}),
    primary: obj["primary"] === true,
    confirm: obj["confirm"] === true,
    push,
    pushLine: normalizedPush?.line ?? null,
    pushDefaults,
    params,
    effects,
    remaining,
    when,
    // Only source ① can be computed here. Source ② scans reverseOn on other edges; that module-wide view is in normalizeLifecycle.
    postsToLedger: effects.length > 0,
    // 🔴 Constant false. This is not a conclusion that the edge does not create documents in bulk. This layer cannot see planners.
    // The real value is filled by the loader's `withPlannerExpansion` (see the criterion on `Transition.expandsBills`).
    // It is not an optional key: a missing key makes the client's `!== true` look the same as `undefined`,
    // and `httpAdapter`'s presence assert relies on "the key must be there" to surface a version skew.
    expandsBills: false,
  };
}

/**
 * `Lifecycle.singleActiveWithin`: the single record that is in effect inside a coordinate.
 *
 * When any document enters `status` (no matter which edge arrives there), other records that are still in `status`
 * under the same `within` coordinate are moved to `supersedeTo` in the same transaction. Use: one product may have only one
 * BOM or routing in effect at a time. Activating a new version demotes the old one, and downstream always takes the one currently in effect.
 *
 * 🔴 This is a different thing from field-level `uniqueDefaultWithin`. That one sets a sibling document's bool to false on entry
 * (the sibling stays in effect). This one changes the sibling's status (the sibling is no longer in effect). Both demotions land
 * in the same transaction as `billRepo.setStatus`. Bypassing `evaluateTransition` is an intentional write-path side effect.
 */
export interface SingleActiveWithin {
  readonly within: readonly string[];
  readonly status: string;
  readonly supersedeTo: string;
}

const SINGLE_ACTIVE_WITHIN_KEYS = ["within", "status", "supersedeTo"] as const;

function normalizeSingleActiveWithin(raw: unknown, at: string): SingleActiveWithin {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SINGLE_ACTIVE_WITHIN_KEYS, at);
  const withinRaw = requireArray(obj["within"], `${at}.within`);
  if (withinRaw.length === 0) schemaFail(`${at}.within must not be an empty array: a coordinate needs at least one dimension`);
  const within = withinRaw.map((item, i) => requireText(item, `${at}.within[${i}]`));
  assertUniqueKeys(within, `${at}.within`);
  const status = requireText(obj["status"], `${at}.status`);
  const supersedeTo = requireText(obj["supersedeTo"], `${at}.supersedeTo`);
  if (status === supersedeTo) {
    schemaFail(`${at}: status and supersedeTo must differ. Demotion must move the sibling document to another status`);
  }
  return { within, status, supersedeTo };
}

export interface Lifecycle {
  readonly statuses: readonly Status[];
  readonly transitions: readonly Transition[];
  /** The single in-effect record inside a coordinate. `null` means no automatic demotion. */
  readonly singleActiveWithin: SingleActiveWithin | null;
}

export function normalizeLifecycle(raw: unknown, label = "lifecycle"): Lifecycle {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, ["statuses", "transitions", "singleActiveWithin"], label);

  const statuses = requireArray(obj["statuses"], `${label}.statuses`).map((s, i) =>
    normalizeStatus(s, `${label}.statuses[${i}]`),
  );
  if (!statuses.length) schemaFail(`${label}.statuses must not be empty: a document with no status does not exist`);
  assertUniqueKeys(
    statuses.map((s) => s.key),
    `${label}.statuses`,
  );

  const transitionsRaw = obj["transitions"];
  const transitions =
    transitionsRaw === undefined || transitionsRaw === null
      ? []
      : requireArray(transitionsRaw, `${label}.transitions`).map((t, i) =>
          normalizeTransition(t, `${label}.transitions[${i}]`),
        );
  assertTransitionIdentity(transitions, `${label}.transitions`);

  const singleActiveRaw = obj["singleActiveWithin"];
  const singleActiveWithin =
    singleActiveRaw === undefined || singleActiveRaw === null
      ? null
      : normalizeSingleActiveWithin(singleActiveRaw, `${label}.singleActiveWithin`);

  return { statuses, transitions: withReverseLedger(transitions), singleActiveWithin };
}

/**
 * An edge is identified by `(code, from)`: `code` is the business action, and the same action has one edge per starting status.
 *
 * Edges that share a code must be the same action: button label, internal, parameter declaration, effects, and push declaration match verbatim. The Planner,
 * action preparers, permission coordinates, ledger rows, and push origins (`pushedFrom`) all bind by code, so each of those naturally exists once.
 * If any of them differ, these are two actions and they need two codes.
 */
function assertTransitionIdentity(transitions: readonly Transition[], label: string): void {
  assertUniqueKeys(
    transitions.map((t) => `${t.code}@${t.from}`),
    `${label} (code, from)`,
  );
  const first = new Map<string, Transition>();
  for (const edge of transitions) {
    const head = first.get(edge.code);
    if (head === undefined) {
      first.set(edge.code, edge);
      continue;
    }
    const at = `${label}.${edge.code}`;
    if (edge.action !== head.action) {
      schemaFail(`${at}: starting points "${head.from}" and "${edge.from}" have different button labels ("${head.action}" / "${edge.action}"). The same code is the same action, so the label must match`);
    }
    if ((edge.internal === true) !== (head.internal === true)) {
      schemaFail(`${at}: starting points "${head.from}" and "${edge.from}" disagree on internal. The same code is either all system edges or all manual actions`);
    }
    if (JSON.stringify(edge.params) !== JSON.stringify(head.params)) {
      schemaFail(`${at}: starting points "${head.from}" and "${edge.from}" declare different params. One action accepts one set of parameters`);
    }
    // A ledger row records the action code, not the starting status. Different effects make a reversal unable to tell which edge posted.
    if (JSON.stringify(edge.effects) !== JSON.stringify(head.effects)) {
      schemaFail(`${at}: starting points "${head.from}" and "${edge.from}" have different effects. The ledger posts and reverses by code, so one action posts one kind of entry`);
    }
    // A push origin records only (module, code). A different push target or line mapping leaves the downstream document unable to say which kind of push created it.
    const pushOf = (t: Transition): string => JSON.stringify([t.push, t.pushLine, t.pushDefaults]);
    if (pushOf(edge) !== pushOf(head)) {
      schemaFail(`${at}: starting points "${head.from}" and "${edge.from}" declare different pushes. A downstream document records only which action pushed it, so one action pushes one kind of document`);
    }
  }
}

/**
 * A business action: the declaration shared by every edge of the same code.
 *
 * Use it when the question is what the action is called, whether it is a system edge, and which parameters it accepts. For one concrete edge (from / to / effects / when),
 * go only through `transitionAt(module, current status, code)`.
 */
export interface TransitionAction {
  readonly code: string;
  readonly action: string;
  readonly internal?: true;
  readonly params: readonly TransitionParam[];
}

/** Fields the action computation reads. Taken structurally so a projection that holds only a slice of the lifecycle (for example precondition derivation) can use the same function. */
export type TransitionActionSource = Pick<Transition, "code" | "action" | "internal" | "params">;

const ACTIONS = new WeakMap<readonly TransitionActionSource[], readonly TransitionAction[]>();

/** Every business action of a module, deduped in the order each code is first declared. */
export function transitionActions(
  lifecycle: { readonly transitions: readonly TransitionActionSource[] },
): readonly TransitionAction[] {
  const cached = ACTIONS.get(lifecycle.transitions);
  if (cached !== undefined) return cached;
  const seen = new Set<string>();
  const out: TransitionAction[] = [];
  for (const edge of lifecycle.transitions) {
    if (seen.has(edge.code)) continue;
    seen.add(edge.code);
    out.push({
      code: edge.code,
      action: edge.action,
      ...(edge.internal === true ? { internal: true as const } : {}),
      params: edge.params,
    });
  }
  const frozen = Object.freeze(out);
  ACTIONS.set(lifecycle.transitions, frozen);
  return frozen;
}

/** The business action for a code. Returns null when there is no such action; the caller refuses in its own words. */
export function transitionAction(
  lifecycle: { readonly transitions: readonly TransitionActionSource[] },
  code: string,
): TransitionAction | null {
  return transitionActions(lifecycle).find((action) => action.code === code) ?? null;
}

/**
 * Fills the second source of `postsToLedger`: this edge is listed in another edge's `reverseOn`.
 *
 * An edge with zero effects of its own can still write the ledger. Unapprove declares no effect, but the approve edge
 * says "rolled back by unapprove", so pressing it posts a reversal. Looking only at this edge's effects
 * would classify that edge as not posting, the UI would skip confirmation, and the exposure would be released silently.
 *
 * 🔴 `reverseOn` may point only at a transition of this same module (see the root AGENTS.md), so scanning this module is enough.
 * No cross-module view is required. A code that does not exist is reported by `validate`'s semantic gate, and is not checked again here:
 * that edge is not in `transitions`, so `has()` is false and it is not misread as posting.
 */
function withReverseLedger(transitions: readonly Transition[]): readonly Transition[] {
  const reversedBy = new Set(transitions.flatMap((t) => t.effects.flatMap((e) => e.reverseOn)));
  return transitions.map((t) =>
    t.postsToLedger || !reversedBy.has(t.code) ? t : { ...t, postsToLedger: true },
  );
}

/**
 * Single-state lifecycle for master data: one status that is both initial and terminal, and zero edges.
 *
 * 🔴 A single state is still a declaration, not "omit lifecycle". Omitting it forces every downstream caller to null-check,
 * while an explicit single state makes "buttons are derived from edges" hold on every module (zero edges, zero buttons).
 *
 * The helper exists so each master-data module does not copy the literal. `terminal: true` and
 * `editable: "full"` are a pair that must be written together. Writing only `terminal: true` makes
 * `normalizeStatus` treat editable as `none` under "a terminal status is not editable by default":
 * master data that can never be changed, and validate says nothing.
 * All three parameters may be changed. What the single state is called, and what color it shows, belong to the modeler. The kernel must not pin them.
 */
export function singleState(key = "active", label = "Active", color: StatusColor = "green"): Lifecycle {
  return normalizeLifecycle({
    statuses: [{ key, label, color, initial: true, terminal: true, editable: "full" }],
    transitions: [],
  });
}
