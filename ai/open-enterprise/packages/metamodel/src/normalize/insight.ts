// ---------------------------------------------------------------------------
// Insight — cross-domain read-only aggregation. One SQL cell per cell. Packages only compile and execute.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  COORDINATE_SEGMENT_PATTERN,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import {
  compileSqlCell,
  isInsightSqlCell,
  normalizeSqlCell,
  sqlCellLedgers,
  sqlCellModules,
  type CompiledSqlCell,
  type InsightSqlCell,
} from "./sqlCell.js";
import { normalizeSemantics, type SemanticDefinition } from "./semantic.js";

export type InsightCell = InsightSqlCell;

export interface InsightBrief {
  readonly title: string;
  readonly hint: string;
  readonly caveats: readonly string[];
}

export interface InsightDefinition {
  readonly semantics?: SemanticDefinition;
  readonly label: string;
  readonly brief?: InsightBrief;
  readonly cells: Readonly<Record<string, InsightCell>>;
}

export type Insights = Readonly<Record<string, InsightDefinition>>;

export const DEFINED_INSIGHTS_BY_KERNEL = Symbol.for("open-erp.definedInsights");

const INSIGHT_DEF_KEYS = ["label", "brief", "cells", "semantics"] as const;
const BRIEF_KEYS = ["title", "hint", "caveats"] as const;

export function insightDayStart(asOf: Date, dayOffset = 0): Date {
  const day = new Date(asOf.getTime());
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + dayOffset);
  return day;
}

export function insightDateOnly(asOf: Date, dayOffset = 0): string {
  const day = insightDayStart(asOf, dayOffset);
  return `${String(day.getFullYear())}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function requireInsightCode(code: string, at: string): void {
  if (!COORDINATE_SEGMENT_PATTERN.test(code) && !/^[a-z][a-zA-Z0-9_]*$/.test(code)) {
    schemaFail(`${at} "${code}" is not a legal insight code`);
  }
}

function normalizeBrief(raw: unknown, at: string): InsightBrief {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, BRIEF_KEYS, at);
  const caveats = Array.isArray(obj["caveats"])
    ? obj["caveats"].map((item, i) => requireText(item, `${at}.caveats[${String(i)}]`))
    : [];
  if (!Array.isArray(obj["caveats"])) schemaFail(`${at}.caveats must be an array`);
  return {
    title: requireText(obj["title"], `${at}.title`),
    hint: requireText(obj["hint"], `${at}.hint`),
    caveats,
  };
}

export function defineInsight(raw: unknown, at = "insight"): InsightDefinition {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, INSIGHT_DEF_KEYS, at);
  const cellsRaw = requireObject(obj["cells"], `${at}.cells`);
  const entries = Object.entries(cellsRaw);
  if (!entries.length) schemaFail(`${at}.cells must not be empty — do not declare this insight when it has no cells`);
  const cells: Record<string, InsightCell> = {};
  for (const [key, value] of entries) {
    if (!COORDINATE_SEGMENT_PATTERN.test(key) && !/^[a-z][a-zA-Z0-9_]*$/.test(key)) {
      schemaFail(`${at}.cells key "${key}" is not legal`);
    }
    cells[key] = normalizeSqlCell(value, `${at}.cells.${key}`);
  }
  return {
    label: requireText(obj["label"], `${at}.label`),
    ...(obj["brief"] === undefined ? {} : { brief: normalizeBrief(obj["brief"], `${at}.brief`) }),
    cells,
    ...(obj["semantics"] === undefined ? {} : { semantics: normalizeSemantics(obj["semantics"], Object.keys(cells), `${at}.semantics`) }),
  };
}

export function defineInsights(raw: unknown): Insights {
  const obj = requireObject(raw, "insights");
  const entries = Object.entries(obj);
  if (!entries.length) schemaFail("insights must not be empty — do not export this named value when there are no questions");
  const out: Record<string, InsightDefinition> = {};
  for (const [code, value] of entries) {
    requireInsightCode(code, "insights code");
    out[code] = defineInsight(value, `insights.${code}`);
  }
  Object.defineProperty(out, DEFINED_INSIGHTS_BY_KERNEL, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return out;
}

export function isDefinedInsights(value: unknown): value is Insights {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_INSIGHTS_BY_KERNEL] === true
  );
}

export interface InsightCellResult {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly missing?: boolean;
  readonly dataQuality?: { readonly unavailable: string };
  readonly unit?: string;
  readonly groupRows?: readonly { readonly label: string; readonly value: number; readonly values?: Readonly<Record<string, number>> }[];
  readonly truncated?: boolean;
  readonly tableRows?: readonly Readonly<Record<string, unknown>>[];
  readonly displayTableRows?: readonly Readonly<Record<string, unknown>>[];
  readonly tableColumns?: readonly { readonly key: string; readonly label: string }[];
  readonly tablePage?: string;
  readonly tableTotal?: number;
  readonly items?: readonly { readonly id: string; readonly code: string; readonly summary: string }[];
}

export interface InsightEvaluateResult {
  readonly code: string;
  readonly label: string;
  readonly asOf: string;
  readonly brief?: InsightBrief;
  readonly cells: readonly InsightCellResult[];
}

export interface InsightLabelHit {
  readonly name: string;
  readonly code?: string;
}

export interface InsightEvaluateOptions {
  readonly asOf?: Date;
  readonly insights: Insights;
  readonly querySql?: (compiled: CompiledSqlCell) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  /** @deprecated The SQL cell path no longer uses this. */
  readonly count?: (module: string, where: unknown) => Promise<number>;
}

function evaluateSqlCell(
  key: string,
  cell: InsightSqlCell,
  asOf: Date,
  options: InsightEvaluateOptions,
): Promise<InsightCellResult> {
  if (options.querySql === undefined) throw new Error(`${key}: sql cell has no querySql injected`);
  const compiled = compileSqlCell(cell, asOf);
  return options.querySql(compiled).then((rows) => {
    const first = rows[0] ?? {};
    const raw = Number(first["value"] ?? first["count"] ?? first["sum"] ?? first["n"] ?? 0);
    const value = cell.result === "rows" ? rows.length : raw;
    const tableRows = cell.result === "rows" || cell.table !== undefined ? rows : undefined;
    const displayTableRows = cell.table === undefined || tableRows === undefined
      ? undefined
      : tableRows.map((row) => {
          const out: Record<string, unknown> = {};
          for (const column of cell.table!.columns) out[column.key] = row[column.from] ?? null;
          for (const [key, value] of Object.entries(row)) {
            const camel = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
            if (out[camel] === undefined && camel !== "id" && camel !== "module") out[camel] = value;
          }
          if (cell.table!.page !== undefined) out["page"] = cell.table!.page;
          return out;
        });
    const tableTotal = cell.table?.totalFrom === undefined ? undefined : rows.length === 0 ? 0 : Number(first[cell.table.totalFrom]);
    if (tableTotal !== undefined && (!Number.isSafeInteger(tableTotal) || tableTotal < rows.length)) {
      throw new Error(`${key}: table total is missing or smaller than the number of rows returned`);
    }
    const items = cell.itemsLimit === undefined || tableRows === undefined
      ? undefined
      : tableRows.slice(0, cell.itemsLimit).map((row) => ({
          id: String(row["id"] ?? ""),
          code: String(row["code"] ?? ""),
          summary: (cell.summaryFields ?? []).map((field) => String(row[field] ?? "")).filter(Boolean).join(" · "),
        }));
    return {
      key,
      label: cell.label,
      value,
      ...(Number.isFinite(raw) && cell.result !== "rows" && first["value"] === null ? { missing: true } : {}),
      ...(cell.unit === undefined ? {} : { unit: cell.unit }),
      ...(tableRows === undefined ? {} : { tableRows }),
      ...(tableTotal === undefined ? {} : { tableTotal, truncated: tableTotal > rows.length }),
      ...(displayTableRows === undefined ? {} : { displayTableRows, tableColumns: cell.table!.columns.map((column) => ({ key: column.key, label: column.label })) }),
      ...(cell.table?.page === undefined ? {} : { tablePage: cell.table.page }),
      ...(items === undefined ? {} : { items }),
      ...(cell.result === "rows"
        ? {
            groupRows: rows.map((row) => ({
              label: String(row["label"] ?? row["name"] ?? row["code"] ?? row["id"] ?? ""),
              value: Number(row["value"] ?? row["n"] ?? 0),
            })),
          }
        : {}),
    };
  });
}

export async function evaluateInsight(
  code: string,
  options: InsightEvaluateOptions,
): Promise<InsightEvaluateResult> {
  const definition = options.insights[code];
  if (definition === undefined) {
    schemaFail(`unknown insight "${code}"; available: ${Object.keys(options.insights).join(" / ") || "(none)"}`);
  }
  const asOf = options.asOf ?? new Date();
  const cells: InsightCellResult[] = [];
  for (const [key, cell] of Object.entries(definition.cells)) {
    try {
      cells.push(await evaluateSqlCell(key, cell, asOf, options));
    } catch (cause) {
      cells.push({
        key,
        label: cell.label,
        value: 0,
        dataQuality: { unavailable: cause instanceof Error ? cause.message : String(cause) },
      });
    }
  }
  return {
    code,
    label: definition.label,
    asOf: asOf.toISOString(),
    ...(definition.brief === undefined ? {} : { brief: definition.brief }),
    cells,
  };
}

export function modulesOfInsight(definition: InsightDefinition): readonly string[] {
  return [...new Set(Object.values(definition.cells).flatMap(sqlCellModules))];
}

export function ledgersOfInsight(definition: InsightDefinition): readonly string[] {
  return [...new Set(Object.values(definition.cells).flatMap(sqlCellLedgers))];
}

export function briefInsights(insights: Insights): Insights {
  const out: Record<string, InsightDefinition> = {};
  for (const [code, definition] of Object.entries(insights)) {
    if (definition.brief !== undefined) out[code] = definition;
  }
  return out;
}

export function insightScenariosOf(insights: Insights): readonly string[] {
  return Object.keys(briefInsights(insights));
}

export function resolveInsightCell(
  insights: Insights,
  code: string,
  cellKey: string,
): InsightCell {
  const definition = insights[code];
  if (definition === undefined) {
    schemaFail(`unknown insight "${code}"; available: ${Object.keys(insights).join(" / ") || "(none)"}`);
  }
  const cell = definition.cells[cellKey];
  if (cell === undefined) {
    schemaFail(`insight "${code}" has no cell "${cellKey}"; it has: ${Object.keys(definition.cells).join(" / ")}`);
  }
  return cell;
}

export function insightsFromLoaded(
  loaded: ReadonlyMap<string, InsightDefinition> | null | undefined,
): Insights {
  const out: Record<string, InsightDefinition> = {};
  if (loaded == null) return out;
  for (const [code, definition] of loaded) out[code] = definition;
  return out;
}

export function isInsightSqlCellOnly(cell: unknown): cell is InsightSqlCell {
  return isInsightSqlCell(cell);
}
