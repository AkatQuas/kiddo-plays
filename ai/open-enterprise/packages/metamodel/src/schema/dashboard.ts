// ---------------------------------------------------------------------------
// Dashboard declaration — the multi-region data contract of the company-wide screen
//
// One DashboardSchema = one surface (home / warehouse / production …).
// A card describes how to read data with a measure. Execution at runtime is generic.
// packages do not know business module names.
// ---------------------------------------------------------------------------

import { assertClosedKeys, requireObject, requireText, schemaFail } from "./common.js";
import { QUERY_COMPARATORS, type QueryComparator } from "../normalize/query.js";

export interface DashboardFilter {
  readonly field: string;
  readonly op: QueryComparator;
  readonly value: unknown;
}

export interface DashboardBreakdownItem {
  readonly module: string;
  readonly label: string;
  readonly filters: readonly DashboardFilter[];
}

export type DashboardScalarMeasure =
  | { readonly type: "count"; readonly module: string; readonly filters: readonly DashboardFilter[] }
  | {
      readonly type: "sum";
      readonly module: string;
      readonly field: string;
      readonly filters: readonly DashboardFilter[];
      readonly cap: number;
    };

export type DashboardMeasure =
  | DashboardScalarMeasure
  | {
      readonly type: "ratio";
      readonly numerator: DashboardScalarMeasure;
      readonly denominator: DashboardScalarMeasure;
      readonly precision: number;
    }
  | { readonly type: "breakdown"; readonly items: readonly DashboardBreakdownItem[] }
  | {
      readonly type: "snapshot";
      readonly source: string;
      readonly field: "score" | "internalScore" | "level" | "averageDeliveryCycleDays";
    }
  | { readonly type: "unsupported"; readonly reason: string };

export type DashboardComparisonSchema =
  | "previous_day"
  | { readonly basis: "previous_day"; readonly unavailable: string };

export interface DashboardCardSchema {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly measure: DashboardMeasure;
  /** Compare with yesterday on the same basis. When history cannot be rebuilt, unavailable must be declared explicitly. Do not fake 0 or a target. */
  readonly compare: DashboardComparisonSchema | null;
  /** Whether a larger or smaller value means improvement. Used only to explain the change. It does not alter the raw up/down direction. */
  readonly betterWhen: "higher" | "lower" | "neutral";
  readonly severity: "auto" | "normal" | "attention" | "warning" | "positive" | "critical";
}

export interface DashboardSchema {
  readonly code: string;
  readonly label: string;
  readonly version: string;
  readonly cards: readonly DashboardCardSchema[];
  readonly quickQuestions: readonly { readonly key: string; readonly label: string; readonly prompt: string }[];
  readonly shortcuts: readonly { readonly key: string; readonly label: string; readonly path: string }[];
  /** Whether to attach the daily-report teaser (usually home only) */
  readonly reportTeaser: boolean;
}

const text = (value: unknown, at: string): string => requireText(value, at);

function normalizeFilter(raw: unknown, at: string): DashboardFilter {
  const filter = requireObject(raw, at);
  assertClosedKeys(filter, ["field", "op", "value"] as const, at);
  const op = text(filter["op"], `${at}.op`);
  if (!(QUERY_COMPARATORS as readonly string[]).includes(op)) {
    schemaFail(`${at}.op "${op}" is not a legal comparator`);
  }
  if (!("value" in filter)) schemaFail(`${at}.value is required`);
  return { field: text(filter["field"], `${at}.field`), op: op as QueryComparator, value: filter["value"] };
}

function normalizeFilters(raw: unknown, at: string): readonly DashboardFilter[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) schemaFail(`${at} must be an array`);
  return raw.map((entry, index) => normalizeFilter(entry, `${at}[${String(index)}]`));
}

function normalizeScalarMeasure(raw: unknown, at: string): DashboardScalarMeasure {
  const obj = requireObject(raw, at);
  const type = text(obj["type"], `${at}.type`);
  if (type === "count") {
    assertClosedKeys(obj, ["type", "module", "filters"] as const, at);
    return {
      type: "count",
      module: text(obj["module"], `${at}.module`),
      filters: normalizeFilters(obj["filters"], `${at}.filters`),
    };
  }
  if (type === "sum") {
    assertClosedKeys(obj, ["type", "module", "field", "filters", "cap"] as const, at);
    const capRaw = obj["cap"];
    const cap = capRaw === undefined || capRaw === null ? 500 : Number(capRaw);
    if (!Number.isFinite(cap) || cap < 1 || cap > 5000) {
      schemaFail(`${at}.cap must be a number from 1 to 5000`);
    }
    return {
      type: "sum",
      module: text(obj["module"], `${at}.module`),
      field: text(obj["field"], `${at}.field`),
      filters: normalizeFilters(obj["filters"], `${at}.filters`),
      cap,
    };
  }
  schemaFail(`${at}.type "${type}" is not supported (only count|sum are accepted here)`);
}

function normalizeMeasure(raw: unknown, at: string): DashboardMeasure {
  const obj = requireObject(raw, at);
  const type = text(obj["type"], `${at}.type`);
  if (type === "count" || type === "sum") return normalizeScalarMeasure(raw, at);
  if (type === "ratio") {
    assertClosedKeys(obj, ["type", "numerator", "denominator", "precision"] as const, at);
    const precisionRaw = obj["precision"];
    const precision = precisionRaw === undefined || precisionRaw === null ? 1 : Number(precisionRaw);
    if (!Number.isInteger(precision) || precision < 0 || precision > 4) {
      schemaFail(`${at}.precision must be an integer from 0 to 4`);
    }
    return {
      type: "ratio",
      numerator: normalizeScalarMeasure(obj["numerator"], `${at}.numerator`),
      denominator: normalizeScalarMeasure(obj["denominator"], `${at}.denominator`),
      precision,
    };
  }
  if (type === "breakdown") {
    assertClosedKeys(obj, ["type", "items"] as const, at);
    const rawItems = obj["items"];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      schemaFail(`${at}.items must be a non-empty array`);
    }
    const items = rawItems.map((rawItem, index) => {
      const p = `${at}.items[${String(index)}]`;
      const item = requireObject(rawItem, p);
      // Accept the old shape status: "pendingReview" → filters: [{ field: status, op: eq, value }]
      if ("status" in item && !("filters" in item)) {
        assertClosedKeys(item, ["module", "label", "status"] as const, p);
        return {
          module: text(item["module"], `${p}.module`),
          label: text(item["label"], `${p}.label`),
          filters: [{ field: "status", op: "eq" as const, value: text(item["status"], `${p}.status`) }],
        };
      }
      assertClosedKeys(item, ["module", "label", "filters"] as const, p);
      return {
        module: text(item["module"], `${p}.module`),
        label: text(item["label"], `${p}.label`),
        filters: normalizeFilters(item["filters"], `${p}.filters`),
      };
    });
    return { type: "breakdown", items };
  }
  if (type === "snapshot") {
    assertClosedKeys(obj, ["type", "source", "field"] as const, at);
    const source = text(obj["source"], `${at}.source`);
    if (source === "") schemaFail(`${at}.source must not be empty (it must match defineReport's snapshotModule or snapshotRole)`);
    const field = text(obj["field"], `${at}.field`);
    if (
      field !== "score" &&
      field !== "internalScore" &&
      field !== "level" &&
      field !== "averageDeliveryCycleDays"
    ) {
      schemaFail(`${at}.field "${field}" is not supported`);
    }
    return {
      type: "snapshot",
      source,
      field: field as "score" | "internalScore" | "level" | "averageDeliveryCycleDays",
    };
  }
  if (type === "unsupported") {
    assertClosedKeys(obj, ["type", "reason"] as const, at);
    return { type: "unsupported", reason: text(obj["reason"], `${at}.reason`) };
  }
  schemaFail(`${at}.type "${type}" is not supported (count|sum|ratio|breakdown|snapshot|unsupported)`);
}

function hasTodayRuntime(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (value as Record<string, unknown>)["$runtime"] === "today";
}

function canShiftToPreviousDay(measure: DashboardMeasure): boolean {
  if (measure.type === "snapshot") return true;
  if (measure.type === "count" || measure.type === "sum") {
    return measure.filters.some((filter) => hasTodayRuntime(filter.value));
  }
  if (measure.type === "ratio") {
    return canShiftToPreviousDay(measure.numerator) && canShiftToPreviousDay(measure.denominator);
  }
  if (measure.type === "breakdown") {
    return measure.items.every((item) => item.filters.some((filter) => hasTodayRuntime(filter.value)));
  }
  return false;
}

/** Accept the v1 card shape (kind + module + filters + breakdown + unavailable) */
function normalizeLegacyCard(obj: Record<string, unknown>, at: string): DashboardCardSchema {
  assertClosedKeys(obj, ["key", "label", "kind", "unit", "module", "filters", "breakdown", "unavailable"] as const, at);
  const kind = text(obj["kind"], `${at}.kind`);
  const unit = text(obj["unit"], `${at}.unit`);
  const key = text(obj["key"], `${at}.key`);
  const label = text(obj["label"], `${at}.label`);
  if (kind === "count") {
    const module = obj["module"];
    if (typeof module !== "string" || !module) schemaFail(`${at}.kind=count must specify module`);
    return {
      key,
      label,
      unit,
      measure: { type: "count", module, filters: normalizeFilters(obj["filters"], `${at}.filters`) },
      compare: null,
      betterWhen: "neutral",
      severity: "auto",
    };
  }
  if (kind === "breakdown") {
    const rawBreakdown = obj["breakdown"] ?? [];
    if (!Array.isArray(rawBreakdown) || rawBreakdown.length === 0) {
      schemaFail(`${at}.kind=breakdown must specify breakdown`);
    }
    const items = rawBreakdown.map((rawItem, index) => {
      const p = `${at}.breakdown[${String(index)}]`;
      const item = requireObject(rawItem, p);
      assertClosedKeys(item, ["module", "label", "status"] as const, p);
      return {
        module: text(item["module"], `${p}.module`),
        label: text(item["label"], `${p}.label`),
        filters: [{ field: "status", op: "eq" as const, value: text(item["status"], `${p}.status`) }],
      };
    });
    return {
      key,
      label,
      unit,
      measure: { type: "breakdown", items },
      compare: null,
      betterWhen: "neutral",
      severity: "auto",
    };
  }
  if (kind === "unsupported") {
    const unavailable = obj["unavailable"];
    if (typeof unavailable !== "string" || !unavailable) {
      schemaFail(`${at}.kind=unsupported must specify unavailable`);
    }
    return {
      key,
      label,
      unit,
      measure: { type: "unsupported", reason: unavailable },
      compare: null,
      betterWhen: "neutral",
      severity: "warning",
    };
  }
  schemaFail(`${at}.kind "${kind}" is not supported`);
}

function normalizeCard(raw: unknown, at: string): DashboardCardSchema {
  const obj = requireObject(raw, at);
  if ("kind" in obj && !("measure" in obj)) {
    return normalizeLegacyCard(obj, at);
  }
  assertClosedKeys(obj, ["key", "label", "unit", "measure", "compare", "betterWhen", "severity"] as const, at);
  const measure = normalizeMeasure(obj["measure"], `${at}.measure`);
  const compareRaw = obj["compare"];
  let compare: DashboardCardSchema["compare"] = null;
  if (compareRaw !== undefined && compareRaw !== null) {
    if (typeof compareRaw === "string") {
      if (compareRaw !== "previous_day") schemaFail(`${at}.compare "${compareRaw}" is not supported`);
      if (!canShiftToPreviousDay(measure)) {
        schemaFail(`${at}.compare: this measure cannot reconstruct yesterday's value from dated facts; declare an unavailable reason explicitly`);
      }
      compare = "previous_day";
    } else {
      const c = requireObject(compareRaw, `${at}.compare`);
      assertClosedKeys(c, ["basis", "unavailable"] as const, `${at}.compare`);
      const basis = text(c["basis"], `${at}.compare.basis`);
      if (basis !== "previous_day") schemaFail(`${at}.compare.basis "${basis}" is not supported`);
      compare = {
        basis: "previous_day",
        unavailable: text(c["unavailable"], `${at}.compare.unavailable`),
      };
    }
  }
  const betterWhenRaw = obj["betterWhen"];
  const betterWhen = betterWhenRaw === undefined || betterWhenRaw === null
    ? "neutral"
    : text(betterWhenRaw, `${at}.betterWhen`);
  if (!(betterWhen === "higher" || betterWhen === "lower" || betterWhen === "neutral")) {
    schemaFail(`${at}.betterWhen "${betterWhen}" is not supported`);
  }
  const severityRaw = obj["severity"];
  const severity =
    severityRaw === undefined || severityRaw === null
      ? "auto"
      : (text(severityRaw, `${at}.severity`) as DashboardCardSchema["severity"]);
  if (!(["auto", "normal", "attention", "warning", "positive", "critical"] as const).includes(severity)) {
    schemaFail(`${at}.severity "${severity}" is not supported`);
  }
  return {
    key: text(obj["key"], `${at}.key`),
    label: text(obj["label"], `${at}.label`),
    unit: text(obj["unit"], `${at}.unit`),
    measure,
    compare,
    betterWhen,
    severity,
  };
}

export function normalizeDashboard(raw: unknown, at = "dashboard"): DashboardSchema {
  const root = requireObject(raw, at);
  assertClosedKeys(
    root,
    ["code", "label", "version", "cards", "quickQuestions", "shortcuts", "reportTeaser"] as const,
    at,
  );
  const rawCards = root["cards"];
  if (!Array.isArray(rawCards) || rawCards.length === 0) schemaFail(`${at}.cards must be a non-empty array`);
  const cards = rawCards.map((rawCard, index) => normalizeCard(rawCard, `${at}.cards[${String(index)}]`));
  const keys = cards.map((card) => card.key);
  if (new Set(keys).size !== keys.length) schemaFail(`${at}.cards.key must be unique`);

  const list = (key: "quickQuestions" | "shortcuts") => {
    const raw = root[key] ?? [];
    if (!Array.isArray(raw)) schemaFail(`${at}.${key} must be an array`);
    return raw;
  };
  const quickQuestions = list("quickQuestions").map((raw, index) => {
    const p = `${at}.quickQuestions[${String(index)}]`;
    const obj = requireObject(raw, p);
    assertClosedKeys(obj, ["key", "label", "prompt"] as const, p);
    return {
      key: text(obj["key"], `${p}.key`),
      label: text(obj["label"], `${p}.label`),
      prompt: text(obj["prompt"], `${p}.prompt`),
    };
  });
  const shortcuts = list("shortcuts").map((raw, index) => {
    const p = `${at}.shortcuts[${String(index)}]`;
    const obj = requireObject(raw, p);
    assertClosedKeys(obj, ["key", "label", "path"] as const, p);
    return {
      key: text(obj["key"], `${p}.key`),
      label: text(obj["label"], `${p}.label`),
      path: text(obj["path"], `${p}.path`),
    };
  });

  const teaserRaw = root["reportTeaser"];
  let reportTeaser = false;
  if (teaserRaw !== undefined && teaserRaw !== null) {
    if (typeof teaserRaw !== "boolean") schemaFail(`${at}.reportTeaser must be a boolean`);
    reportTeaser = teaserRaw;
  }

  return {
    code: text(root["code"], `${at}.code`),
    label: text(root["label"], `${at}.label`),
    version: text(root["version"], `${at}.version`),
    cards,
    quickQuestions,
    shortcuts,
    reportTeaser,
  };
}

export const defineDashboard = (input: unknown): DashboardSchema => normalizeDashboard(input);
