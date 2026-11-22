// ---------------------------------------------------------------------------
// Row-level data scope — one authorization dimension of RBAC
//
// This is not view configuration. A view only decides how to present. Data scope
// decides whether the current subject may read a business fact.
// It lives in its own file so the schema permission catalog and the server
// Authorizer share one closed enum, instead of the authorization layer depending
// backwards on the UI's views.ts.
// ---------------------------------------------------------------------------

import {
  isRelativeDateValue,
  isRelativeSpanN,
  isRelativeSpanToken,
  isRelativeSpanValue,
  relativeDateLabel,
  RELATIVE_DATES,
  RELATIVE_SPAN_MAX_N,
  RELATIVE_SPAN_UNIT,
  RELATIVE_TOKENS,
  type RelativeDateToken,
  type RelativeDateValue,
} from "../normalize/query.js";
import {
  assertClosedKeys,
  queryInputFail,
  requireEnum,
  requireObject,
  schemaFail,
} from "./common.js";

/**
 * Named scope policies the product currently supports.
 *
 * The policy name is for role configuration and audit explanation. SQL must never
 * guess it into some business field. The server's generic resolver must turn the
 * policy into the safe predicate below first. Storage only knows real columns.
 */
export const DATA_SCOPE_POLICIES = [
  "me",
  "own-org",
  "own-org-and-descendants",
  "specified",
  "all",
] as const;
export type DataScopePolicy = (typeof DATA_SCOPE_POLICIES)[number];

/** Organization / person binding operators. Do not split them into a comparator DSL. */
export const SCOPE_BINDING_OPS = [
  "me",
  "own-org",
  "own-org-and-descendants",
  "specified",
] as const;
export type ScopeBindingOp = (typeof SCOPE_BINDING_OPS)[number];

/**
 * Operators on a role's module condition = binding op + query literal comparators.
 * `all` is not an operator. A module that was not added is all.
 */
export const SCOPE_CONDITION_OPS = [
  ...SCOPE_BINDING_OPS,
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
  "between",
  "is_empty",
  "not_empty",
] as const;
export type ScopeConditionOp = (typeof SCOPE_CONDITION_OPS)[number];

export function isScopeBindingOp(op: string): op is ScopeBindingOp {
  return (SCOPE_BINDING_OPS as readonly string[]).includes(op);
}

export function isLiteralScopeOp(op: string): boolean {
  return (SCOPE_CONDITION_OPS as readonly string[]).includes(op) && !isScopeBindingOp(op);
}

/** A scope condition's value: an absolute string, or a relative-time value from the query kernel. Existing jsonb is all strings. */
export type ScopeValue = string | RelativeDateValue;

/** Named policy label of one group: a binding op wins, an empty group is all, and any other literal comparator is recorded as specified. */
export function derivedScopePolicy(conditions: readonly ScopeCondition[]): DataScopePolicy {
  const binding = conditions.find((condition) => isScopeBindingOp(condition.op));
  if (binding && isScopeBindingOp(binding.op)) return binding.op;
  return conditions.length === 0 ? "all" : "specified";
}

/** One row-cutting condition inside a group. AND inside the group, OR across groups of the same module. */
export interface ScopeCondition {
  readonly field: string;
  readonly op: ScopeConditionOp;
  readonly values: readonly ScopeValue[];
}

/** A resolved header predicate. A missing `op`, or a binding op, means a closed IN (current behavior). */
export interface DataScopePredicate {
  readonly field: string;
  readonly values: readonly ScopeValue[];
  readonly op?: ScopeConditionOp;
}

export function isScopeTimeFieldType(type: string): type is "date" | "datetime" {
  return type === "date" || type === "datetime";
}

/** Structural dedupe key: absolute strings compare equal after trim; relative values use `$rel` + `n`. Objects cannot be put in `new Set(values)`. */
export function scopeValueKey(value: ScopeValue): string {
  if (typeof value === "string") return value;
  return isRelativeSpanValue(value) ? `${value.$rel}:${String(value.n)}` : value.$rel;
}

/**
 * Fold one value from HTTP / jsonb into a `ScopeValue`.
 * Relative values must be in the kernel's closed set. A missing n or an illegal n throws. No default is filled in. Calendar validity is in `assertScopeConditionValues`.
 */
export function parseScopeValue(raw: unknown, label: string): ScopeValue {
  if (isRelativeDateValue(raw)) return normalizeScopeRelativeDate(raw, label);
  if (typeof raw !== "string" || !raw.trim()) {
    schemaFail(`${label} must be a non-empty string or a relative time {$rel}`);
  }
  return raw.trim();
}

/**
 * Operator × value gate for date / datetime. Other types are returned as-is.
 * A violation always throws: do not silently drop a value, and do not treat a relative token as a between endpoint.
 */
export function assertScopeConditionValues(
  fieldType: string,
  op: ScopeConditionOp,
  values: readonly ScopeValue[],
  label: string,
): readonly ScopeValue[] {
  if (!isScopeTimeFieldType(fieldType)) return values;

  for (const [index, value] of values.entries()) {
    const at = `${label}.values[${String(index)}]`;
    if (typeof value === "string") continue;
    if (!isRelativeDateValue(value)) {
      schemaFail(`${at} must be a non-empty string or a relative time {$rel}`);
    }
    assertRelativeOnField(normalizeScopeRelativeDate(value, at), fieldType, at);
  }

  switch (op) {
    case "is_empty":
    case "not_empty":
      if (values.length > 0) schemaFail(`${label}: ${op} does not accept values`);
      return values;
    case "eq":
      if (values.length !== 1) {
        schemaFail(`${label}: eq must have exactly 1 value (an absolute string or a relative token)`);
      }
      assertScopeEqValue(values[0]!, fieldType, `${label}.values[0]`);
      return values;
    case "ne":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      if (values.length !== 1) schemaFail(`${label}: ${op} must have exactly 1 absolute value`);
      assertScopeCompareValue(values[0]!, op, `${label}.values[0]`);
      return values;
    case "between":
      if (values.length !== 2) schemaFail(`${label}: between must be [min, max]`);
      assertScopeBetweenValues(values[0]!, values[1]!, label);
      return values;
    default:
      schemaFail(`${label}: ${fieldType} scope does not support "${op}"`);
  }
}

const SCOPE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SCOPE_MONTH = /^(\d{4})-(\d{2})$/;

/** YYYY-MM-DD or YYYY-MM. Split the calendar in UTC. Do not use a local `new Date("YYYY-MM-DD")`. */
function scopeAbsoluteGranularity(value: string): "day" | "month" | null {
  const day = SCOPE_DAY.exec(value);
  if (day) {
    const year = Number(day[1]);
    const month = Number(day[2]);
    const date = Number(day[3]);
    const utc = new Date(Date.UTC(year, month - 1, date));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) {
      return null;
    }
    return "day";
  }
  const month = SCOPE_MONTH.exec(value);
  if (month) {
    const monthNo = Number(month[2]);
    if (monthNo < 1 || monthNo > 12) return null;
    return "month";
  }
  return null;
}

function assertScopeAbsoluteDate(value: string, label: string): "day" | "month" {
  const granularity = scopeAbsoluteGranularity(value);
  if (granularity === null) {
    queryInputFail(
      "SCOPE_ABSOLUTE_DATE_MALFORMED",
      label,
      `${label}: a date accepts only YYYY-MM-DD or YYYY-MM, got ${JSON.stringify(value)}`,
      "Write 2026-09-21 (a day) or 2026-09 (a month). Do not use an ISO string with T, and do not use a date that does not exist on the calendar such as 2026-13-40",
    );
  }
  return granularity;
}

function normalizeScopeRelativeDate(raw: RelativeDateValue, label: string): RelativeDateValue {
  const obj = requireObject(raw, label);
  const rel = requireEnum(obj["$rel"], RELATIVE_TOKENS, `${label}.$rel`);
  if ((RELATIVE_DATES as readonly string[]).includes(rel) && !isRelativeSpanToken(rel)) {
    assertClosedKeys(obj, ["$rel"], label);
    return { $rel: rel };
  }
  if (!isRelativeSpanToken(rel)) {
    schemaFail(`${label}.$rel "${rel}" is not a kernel relative-time token`);
  }
  assertClosedKeys(obj, ["$rel", "n"], label);
  const n = obj["n"];
  if (n === undefined || n === null) {
    queryInputFail(
      "RELATIVE_SPAN_N_REQUIRED",
      `${label}.n`,
      `${label}.n is missing — "${rel}" is a parameterized token, and N is the only source of its span length. ` +
        `This dimension has no safe default: filling in 1 or 7 would silently answer a question the user did not ask`,
      `To query this month use {"op":"eq","value":{"$rel":"this_month"}}; otherwise pass an integer 1..${String(RELATIVE_SPAN_MAX_N)} as ${label}.n`,
    );
  }
  if (!isRelativeSpanN(n)) {
    queryInputFail(
      "RELATIVE_SPAN_N_OUT_OF_RANGE",
      `${label}.n`,
      `${label}.n must be an integer from 1 to ${RELATIVE_SPAN_MAX_N}, got ${JSON.stringify(n)} — ` +
        `a negative or an oversized value compiles into a condition that is perfectly legal and always empty or always full, and an empty result is read as "there is no such document"`,
      `To query this month use {"op":"eq","value":{"$rel":"this_month"}}; otherwise pass an integer 1..${String(RELATIVE_SPAN_MAX_N)} as ${label}.n`,
    );
  }
  return { $rel: rel, n };
}

function assertRelativeOnField(value: RelativeDateValue, fieldType: string, label: string): void {
  if (isRelativeSpanValue(value) && RELATIVE_SPAN_UNIT[value.$rel] === "rolling_hour" && fieldType !== "datetime") {
    schemaFail(
      `${label}: "${value.$rel}" is a rolling-hour span and can be used only on a datetime field (this one is ${fieldType}) — ` +
        `a date column has no time of day, and the hour part is silently dropped when it is converted. To ask by calendar day use last_n_days / next_n_days`,
    );
  }
}

function assertScopeEqValue(value: ScopeValue, fieldType: string, label: string): void {
  if (typeof value === "string") {
    assertScopeAbsoluteDate(value, label);
    return;
  }
  assertRelativeOnField(normalizeScopeRelativeDate(value, label), fieldType, label);
}

function assertScopeCompareValue(value: ScopeValue, op: ScopeConditionOp, label: string): void {
  if (isRelativeDateValue(value)) {
    queryInputFail(
      "SCOPE_RELATIVE_REQUIRES_EQ",
      label,
      `${label}: a relative-time token means a whole span and cannot be used with "${op}". For a whole period use op=eq plus a single relative token`,
      "For a whole period use op=eq plus a single relative token",
    );
  }
  if (typeof value !== "string") schemaFail(`${label} must be YYYY-MM-DD or YYYY-MM`);
  assertScopeAbsoluteDate(value, label);
}

function assertScopeBetweenValues(lo: ScopeValue, hi: ScopeValue, label: string): void {
  if (isRelativeDateValue(lo) || isRelativeDateValue(hi)) {
    const fixed = [lo, hi].find(
      (value): value is RelativeDateToken => isRelativeDateValue(value) && !isRelativeSpanValue(value),
    );
    const hint = fixed
      ? `To query "${relativeDateLabel(fixed)}" use op=eq and value=${JSON.stringify(fixed)}. between accepts only two absolute date/time endpoints`
      : "For a relative span use op=eq and a single token. between accepts only two absolute date/time endpoints";
    queryInputFail(
      "RELATIVE_RANGE_NOT_BETWEEN_ENDPOINT",
      label,
      `${label}: a relative-time token means a whole span and cannot be a between endpoint`,
      hint,
    );
  }
  if (typeof lo !== "string" || typeof hi !== "string") {
    schemaFail(`${label}: between accepts only two absolute date/time endpoints`);
  }
  const loGrain = assertScopeAbsoluteDate(lo, `${label}.values[0]`);
  const hiGrain = assertScopeAbsoluteDate(hi, `${label}.values[1]`);
  if (loGrain !== hiGrain) {
    queryInputFail(
      "SCOPE_BETWEEN_GRANULARITY_MISMATCH",
      label,
      `${label}: both ends of between must use the same granularity (both YYYY-MM-DD or both YYYY-MM)`,
      "Write both endpoints at the same granularity, for example [\"2026-09-01\",\"2026-09-30\"] or [\"2026-09\",\"2026-12\"]",
    );
  }
  if (lo > hi) {
    queryInputFail(
      "QUERY_RANGE_REVERSED",
      label,
      `${label}: lower bound ${JSON.stringify(lo)} is greater than upper bound ${JSON.stringify(hi)} — a reversed range never matches anything`,
      "Order the two absolute endpoints of between from earlier to later. For a whole period such as this month, use op=eq plus a single relative token",
    );
  }
}

/** The row-scope decision after positive grants from several roles have been merged. It is already executable. */
export interface DataScopeDecision {
  readonly policies: readonly DataScopePolicy[];
  readonly predicates: readonly DataScopePredicate[];
  /**
   * AND inside a group, OR between groups (several groups on one role, or several people and roles on the same module).
   * When absent, SQL treats `predicates` as one OR group per predicate (old snapshots).
   */
  readonly groups?: readonly (readonly DataScopePredicate[])[];
}

export type DataScope = DataScopeDecision;

/** The canonical decision that is not limited by row scope. System read-only jobs and test fixtures share this shape. */
export const ALL_DATA_SCOPE: DataScopeDecision = Object.freeze({
  policies: ["all"] as const,
  predicates: [] as const,
});

/** The canonical `createdBy + me` decision. The caller must pass the current subject explicitly. */
export function createdByMeDataScope(userId: string): DataScopeDecision {
  return { policies: ["me"], predicates: [{ field: "createdBy", values: [userId] }] };
}

/** A role's display name may be localized and edited. Cross-layer protocols recognize only this stable code shape. */
export const RBAC_ROLE_CODE_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

export function isRbacRoleCode(value: string): boolean {
  return RBAC_ROLE_CODE_PATTERN.test(value);
}
