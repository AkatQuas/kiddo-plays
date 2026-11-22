// ---------------------------------------------------------------------------
// Analysis field resolution — the same notation as query.where
//
// This only resolves "which layer, which column". No IO, no SQL. The analysis_sql
// catalog and field allow-list live in `analysisCatalogOf`; this file keeps that
// one namespace rule.
// ---------------------------------------------------------------------------

import { queryInputFail, schemaFail } from "../schema/common.js";
import type { Field, FieldType } from "../schema/fields.js";
import { isPlatformField, PLATFORM_FIELD_TYPES, type ModuleSchema, type PlatformField } from "../schema/module.js";
// Path join and parse share the query implementation: analysis and query are the
// same notation. Separate copies do not fail loudly; they accept shapes that
// differ by one character, and each side thinks it is right.
import { linePathOf, parseLinePath } from "./query.js";

function subtableOf(module: ModuleSchema, through: string): Field {
  const table = module.fields.find((field) => field.key === through && field.type === "subtable");
  if (!table?.fields) {
    schemaFail(
      `module "${module.code}" has no line table "${through}" — ` +
        `choices: ${module.fields.filter((field) => field.type === "subtable").map((field) => field.key).join(" / ") || "none"}`,
    );
  }
  return table;
}

/** Which layer an analysis field lands on. Same-named columns on the two layers are different things, so the layer is part of the parse result, not a comment. */
export type AnalysisLayer = "header" | "line";

/**
 * What a dimension / measure field resolved to.
 *
 * `key` is the **bare column name on that layer** (the `<lineTable>.` prefix is
 * already stripped from a line column) and can be fed straight to the executor's
 * column allow-list — the caller does not cut the dot again. The only cut is `parseLinePath`.
 */
export interface AnalysisFieldRef {
  readonly layer: AnalysisLayer;
  readonly key: string;
  readonly type: FieldType;
}

/**
 * Resolve an analysis field name into "which layer, which column".
 *
 * The namespace matches `query.where` character for character: a line column is
 * `lines.qty`, a header column is the bare `qty`. Previously, passing `through`
 * switched the whole field namespace to "bare column names of that line table",
 * while callers learn field names from only one place — `module_describe`'s
 * queryable, where line columns are always written `lines.qty`. In the same call,
 * `query.where` accepted `lines.planArrivalDate` and the analysis side rejected
 * `lines.productId`, which was observed to collide 10 times in a row. One thing,
 * two names, and the caller has no way to know.
 *
 * **No bidirectional acceptance**: a bare line-column name under `through` is
 * always rejected. Accepting it would admit two names, and on a module such as
 * `productionReceipt` where both header and lines have `productId`, a bare
 * `productId` immediately has two equally natural readings — picking either one
 * silently answers a different question.
 *
 * `through` decides only the **expansion grain** (results expand by line), not
 * the namespace. A header column is therefore still a legal dimension inside a
 * line analysis — the ordinary question "defect rate of lines by supplier" could
 * not be written under `through` before, and the only way out was to pull rows
 * into context and compute by hand, which is exactly why in-database analysis
 * (now `analysis_sql`) exists.
 */
export function resolveAnalysisField(
  module: ModuleSchema,
  through: string | null,
  name: string,
  label: string,
): AnalysisFieldRef {
  // Path shape uses the same rule as query (`parseLinePath`): a dot means a line column, and an unparseable path throws.
  const path = parseLinePath(module, name, label);
  if (path) {
    if (through === null) {
      queryInputFail(
        "ANALYSIS_LINE_FIELD_REQUIRES_THROUGH",
        label,
        `${label}: "${name}" is a line column, but this analysis is header-level — ` +
          `pass analysis.through:"${path.table.key}" to expand by line`,
        `{"through":"${path.table.key}","dimensions":["${name}"],"measures":[...]}`,
      );
    }
    if (path.table.key !== through) {
      queryInputFail(
        "ANALYSIS_FIELD_OUTSIDE_THROUGH",
        label,
        `${label}: "${name}" is on line table "${path.table.key}", but this expansion is "${through}" — ` +
          `one analysis expands a single line table; a column from another table has no definite row-count meaning`,
        `analysis.through must equal "${path.table.key}", and every line field may only use "${path.table.key}.<column>"`,
      );
    }
    return { layer: "line", key: path.column.key, type: path.column.type };
  }

  // Header layer. Platform fields (status / createdBy / createdAt …) count as header columns in both kinds of analysis:
  // a line has no status or creator of its own; those already live on the header.
  if (isPlatformField(name)) {
    return { layer: "header", key: name, type: PLATFORM_FIELD_TYPES[name as PlatformField] };
  }
  const field = module.fields.find((candidate) => candidate.key === name);
  if (!field || field.type === "subtable" || field.type === "attachment") {
    analysisFieldFail(module, through, name, label);
  }
  return { layer: "header", key: name, type: field.type };
}

/**
 * When resolution fails, say the **correct spelling**.
 *
 * Saying only "no analyzable field" pushes the caller to retry the same word:
 * they saw `lines.qty` in `queryable`, and after a rejection the natural next
 * step is to try the bare `qty` (that is the collision that was observed), and
 * that path is closed too. So the bare line-column branch must be recognized on
 * its own and answered with the prefixed spelling.
 *
 * `name` that reaches here never contains a dot: a dotted name either parsed at
 * `parseLinePath` or already threw with "line table X has no column Y".
 */
function analysisFieldFail(module: ModuleSchema, through: string | null, name: string, label: string): never {
  if (through !== null) {
    const table = subtableOf(module, through);
    if (table.fields?.some((column) => column.key === name)) {
      queryInputFail(
        "ANALYSIS_LINE_FIELD_PATH_REQUIRED",
        label,
        `${label}: "${name}" is a column of line table "${through}" and must be written "${linePathOf(through, name)}" — ` +
          `the same notation as query.where. A bare key is only for header columns: both layers may be named "${name}", so a bare write has no single reading`,
        `write ${label} as "${linePathOf(through, name)}"; only a header field uses a bare key`,
      );
    }
  }
  const header = module.fields
    .filter((field) => field.type !== "subtable" && field.type !== "attachment")
    .map((field) => field.key);
  const lines =
    through === null ? [] : (subtableOf(module, through).fields ?? []).map((column) => linePathOf(through, column.key));
  schemaFail(
    `${label}: module "${module.code}" has no analyzable field "${name}" — ` +
      `write a header column as a bare key (${header.join(" / ") || "none"})` +
      (through === null ? "" : `; write a line column in prefixed form (${lines.join(" / ") || "none"})`),
  );
}
