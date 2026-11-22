// ---------------------------------------------------------------------------
// Catalog-module batch workbench — assemble lines from many source bills in memory, then hand them to the Planner.
//
// It is not a seventh ModuleSchema concept: it creates no table, issues no numbers, and owns no lifecycle. Business facts still
// land on the source bills and the downstream bills the Planner creates; this only describes a named UI slot for the list multi-select state.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  assertUniqueKeys,
  requireArray,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import { normalizeField, type Field } from "../schema/fields.js";

export interface BatchActionSourceValue {
  readonly from: "bill" | "header" | "line" | "clock";
  readonly field: string | null;
  readonly offsetDays: number;
}

export interface BatchActionMode {
  readonly value: string;
  readonly label: string;
  readonly primary: boolean;
}

export interface BatchActionDefinition {
  readonly label: string;
  readonly sourceStatuses: readonly string[];
  readonly sourceTable: string;
  readonly sourceRemaining: string;
  /**
   * Business action code to execute. Every source status must have an edge with this code; the server resolves it from the source bill's current status,
   * and the workbench and the frontend never pick an edge by status.
   */
  readonly transition: string;
  /** Only synchronizes other source bills inside this batch plan; not projected as a manual button. */
  readonly internalTransitions: readonly string[];
  /** Staging lines in the dialog. They exist only in the browser and in action params, not as a business table. */
  readonly lineField: Field;
  /** Staging line column -> source-bill value. Cells not listed are filled by the user. */
  readonly seed: Readonly<Record<string, BatchActionSourceValue>>;
  readonly modes: readonly BatchActionMode[];
  readonly modeParam: string;
  readonly linesParam: string;
}

export type BatchActions = Readonly<Record<string, BatchActionDefinition>>;

const DEFINED_BATCH_ACTIONS = Symbol.for("open-erp.definedBatchActions");

function sourceValue(raw: unknown, at: string): BatchActionSourceValue {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["from", "field", "offsetDays"], at);
  const from = requireText(obj["from"], `${at}.from`);
  if (from !== "bill" && from !== "header" && from !== "line" && from !== "clock") {
    schemaFail(`${at}.from must be bill / header / line / clock`);
  }
  const field = obj["field"] === undefined || obj["field"] === null
    ? null
    : requireText(obj["field"], `${at}.field`);
  if (from === "bill" && field !== null) schemaFail(`${at} must not set field when reading from bill (the value is the source bill id)`);
  if ((from === "header" || from === "line") && field === null) schemaFail(`${at} must set field when reading from ${from}`);
  if (from === "clock" && field !== null) schemaFail(`${at} must not set field when reading from clock`);
  const offsetRaw = obj["offsetDays"];
  const offsetDays = offsetRaw === undefined || offsetRaw === null ? 0 : offsetRaw;
  if (typeof offsetDays !== "number" || !Number.isInteger(offsetDays)) {
    schemaFail(`${at}.offsetDays must be an integer number of days`);
  }
  if (from !== "clock" && offsetDays !== 0) schemaFail(`${at}.offsetDays is allowed only for clock`);
  return { from, field, offsetDays };
}

function mode(raw: unknown, at: string): BatchActionMode {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["value", "label", "primary"], at);
  return {
    value: requireText(obj["value"], `${at}.value`),
    label: requireText(obj["label"], `${at}.label`),
    primary: obj["primary"] === true,
  };
}

/**
 * The batch workbench only owns the input shape; the real business computation still comes from the planners in the same catalog, as an ExecutionPlan.
 * The credential lets the loader reject a hand-written registry that did not pass the closed gate.
 */
export function defineBatchActions(raw: unknown): BatchActions {
  const obj = requireObject(raw, "batchActions");
  if (!Object.keys(obj).length) schemaFail("batchActions must not be empty — do not export this named value when there is no workbench");
  const out: Record<string, BatchActionDefinition> = {};
  for (const [code, value] of Object.entries(obj)) {
    const at = `batchActions.${code}`;
    const action = requireObject(value, at);
    assertClosedKeys(
      action,
      ["label", "sourceStatuses", "sourceTable", "sourceRemaining", "transition", "internalTransitions", "lineField", "seed", "modes", "modeParam", "linesParam"],
      at,
    );
    const sourceStatuses = requireArray(action["sourceStatuses"], `${at}.sourceStatuses`).map((item, index) =>
      requireText(item, `${at}.sourceStatuses[${index}]`));
    if (!sourceStatuses.length) schemaFail(`${at}.sourceStatuses must not be empty`);
    assertUniqueKeys(sourceStatuses, `${at}.sourceStatuses`);

    const transition = requireText(action["transition"], `${at}.transition`);
    const internalTransitions = action["internalTransitions"] === undefined
      ? []
      : requireArray(action["internalTransitions"], `${at}.internalTransitions`).map((item, index) =>
          requireText(item, `${at}.internalTransitions[${index}]`));
    assertUniqueKeys(internalTransitions, `${at}.internalTransitions`);
    if (internalTransitions.includes(transition)) {
      schemaFail(`${at}.internalTransitions duplicates the executed action "${transition}"`);
    }

    const lineField = normalizeField(action["lineField"], `${at}.lineField`);
    if (lineField.type !== "subtable" || lineField.fields === null) {
      schemaFail(`${at}.lineField must be a subtable with a column declaration`);
    }
    const lineKeys = new Set(lineField.fields.map((field) => field.key));
    const seed = Object.fromEntries(
      Object.entries(requireObject(action["seed"], `${at}.seed`)).map(([key, item]) => {
        if (!lineKeys.has(key)) schemaFail(`${at}.seed.${key} is not in the lineField column declaration`);
        return [key, sourceValue(item, `${at}.seed.${key}`)];
      }),
    );
    const modes = requireArray(action["modes"], `${at}.modes`).map((item, index) =>
      mode(item, `${at}.modes[${index}]`));
    if (!modes.length) schemaFail(`${at}.modes must not be empty`);
    assertUniqueKeys(modes.map((item) => item.value), `${at}.modes`);
    if (modes.filter((item) => item.primary).length !== 1) {
      schemaFail(`${at}.modes must have exactly one primary`);
    }

    out[code] = {
      label: requireText(action["label"], `${at}.label`),
      sourceStatuses,
      sourceTable: requireText(action["sourceTable"], `${at}.sourceTable`),
      sourceRemaining: requireText(action["sourceRemaining"], `${at}.sourceRemaining`),
      transition,
      internalTransitions,
      lineField,
      seed,
      modes,
      modeParam: requireText(action["modeParam"], `${at}.modeParam`),
      linesParam: requireText(action["linesParam"], `${at}.linesParam`),
    };
  }
  Object.defineProperty(out, DEFINED_BATCH_ACTIONS, { value: true, enumerable: false, writable: false });
  return Object.freeze(out);
}

export function isDefinedBatchActions(value: unknown): value is BatchActions {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_BATCH_ACTIONS] === true;
}
