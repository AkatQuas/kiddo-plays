// ---------------------------------------------------------------------------
// Analysis SQL example — derive one executable two-table INNER JOIN from the catalog
//
// The tool surface and the gate's sample SQL must come from the same real
// relations as the catalog. A hand-written table name means the catalog has
// already switched modules while the model still JOINs a table that does not
// exist, the gate rejects it, and the model retries.
// ---------------------------------------------------------------------------

import { hasColumn, type Field } from "../schema/fields.js";
import type { ModuleSchema } from "../schema/module.js";
import type { AnalysisCatalog, AnalysisJoin, AnalysisRelation } from "./analysisCatalog.js";
import { analysisCatalogOf } from "./analysisCatalog.js";
import { businessColumnName, businessTableName } from "./pgNames.js";

export interface AnalysisJoinExample {
  readonly sql: string;
  readonly fromTable: string;
  readonly toTable: string;
  readonly fromColumns: readonly string[];
  readonly toColumns: readonly string[];
}

const SKIP_MEASURE = new Set([
  "id",
  "tenant_id",
  "org_id",
  "status",
  "revision",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "bill_id",
  "line_no",
]);

function measureColumn(relation: AnalysisRelation): string | null {
  const money = relation.fields.find((field) => field.type === "money" && !SKIP_MEASURE.has(field.column));
  if (money) return money.column;
  const numeric = relation.fields.find((field) => field.type === "number" && !SKIP_MEASURE.has(field.column));
  return numeric?.column ?? null;
}

function displayColumn(relation: AnalysisRelation): string | null {
  const named = relation.fields.find((field) => field.key === "name" && (field.type === "string" || field.type === "text"));
  if (named) return named.column;
  for (const key of relation.primaryFacts) {
    if (key === "id") continue;
    const field = relation.fields.find((item) => item.key === key && (item.type === "string" || item.type === "text"));
    if (field) return field.column;
  }
  return null;
}

function sqlOf(from: AnalysisRelation, to: AnalysisRelation, join: AnalysisJoin): AnalysisJoinExample {
  const on = join.fromColumns
    .map((column, index) => `h.${column} = t.${join.toColumns[index] ?? "id"}`)
    .join(" AND ");
  const display = displayColumn(to);
  const measure = measureColumn(from);
  const sql =
    display !== null && measure !== null
      ? `SELECT t.${display}, SUM(h.${measure}) AS total FROM ${from.name} h INNER JOIN ${to.name} t ON ${on} GROUP BY t.id, t.${display} ORDER BY total DESC LIMIT 20`
      : display !== null
        ? `SELECT t.${display}, h.id FROM ${from.name} h INNER JOIN ${to.name} t ON ${on} LIMIT 20`
        : measure !== null
          ? `SELECT h.${measure}, t.id FROM ${from.name} h INNER JOIN ${to.name} t ON ${on} LIMIT 20`
          : `SELECT h.id, t.id FROM ${from.name} h INNER JOIN ${to.name} t ON ${on} LIMIT 20`;
  return {
    sql,
    fromTable: from.name,
    toTable: to.name,
    fromColumns: join.fromColumns,
    toColumns: join.toColumns,
  };
}

/**
 * The first real relation pair in the catalog that can become a two-table INNER JOIN.
 *
 * Prefer header → master data (a ref with cardinality one). Otherwise fall back
 * to line → header on bill_id. If neither exists, return null — the caller must
 * not invent a fake table name to fill an example.
 */
export function analysisJoinExampleFromCatalog(catalog: AnalysisCatalog): AnalysisJoinExample | null {
  const byName = new Map(catalog.relations.map((relation) => [relation.name, relation]));
  for (const from of catalog.relations) {
    if (from.grain !== "header") continue;
    for (const join of from.joins) {
      if (join.cardinality !== "one") continue;
      if (join.via !== "ref" && join.via !== "refLine") continue;
      const to = byName.get(join.to);
      if (!to) continue;
      return sqlOf(from, to, join);
    }
  }
  for (const from of catalog.relations) {
    for (const join of from.joins) {
      if (join.via !== "header_line" || join.cardinality !== "one") continue;
      const to = byName.get(join.to);
      if (!to) continue;
      return sqlOf(from, to, join);
    }
  }
  return null;
}

function refsOf(module: ModuleSchema): readonly string[] {
  const refs: string[] = [];
  const take = (field: Field): void => {
    if ((field.type === "ref" || field.type === "refLine") && field.ref !== null) refs.push(field.ref);
  };
  for (const field of module.fields) {
    take(field);
    if (field.type !== "subtable") continue;
    for (const column of field.fields ?? []) take(column);
  }
  return refs;
}

function headerLineExample(modules: readonly ModuleSchema[]): AnalysisJoinExample | null {
  for (const module of [...modules].sort((left, right) => left.code.localeCompare(right.code))) {
    const table = module.fields.find((field) => field.type === "subtable");
    if (table === undefined) continue;
    const fromTable = businessTableName(module.code, table.key);
    const toTable = businessTableName(module.code);
    const measure = (table.fields ?? []).find((field) => hasColumn(field) && (field.type === "number" || field.type === "money"));
    const on = "h.bill_id = t.id";
    const sql =
      measure !== undefined
        ? `SELECT h.${businessColumnName(measure.key)}, t.id FROM ${fromTable} h INNER JOIN ${toTable} t ON ${on} LIMIT 20`
        : `SELECT h.id, t.id FROM ${fromTable} h INNER JOIN ${toTable} t ON ${on} LIMIT 20`;
    return {
      sql,
      fromTable,
      toTable,
      fromColumns: ["bill_id"],
      toColumns: ["id"],
    };
  }
  return null;
}

/**
 * For the tool surface: use the analysis catalog when the module table is closed.
 * When a referenced module is missing, fall back to this module's header and lines.
 * Never throw, and never invent a fake table.
 */
export function analysisJoinExampleFromModules(modules: readonly ModuleSchema[]): AnalysisJoinExample | null {
  const known = new Set(modules.map((module) => module.code));
  const closed = modules.filter((module) => refsOf(module).every((ref) => known.has(ref)));
  if (closed.length > 0) {
    const example = analysisJoinExampleFromCatalog(analysisCatalogOf(closed));
    if (example) return example;
  }
  return headerLineExample(modules);
}
