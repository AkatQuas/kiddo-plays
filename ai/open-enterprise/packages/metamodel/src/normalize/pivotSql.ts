// ---------------------------------------------------------------------------
// Pivot SQL — compile a SurfacePivot into the sqlCell placeholder dialect
//
// Compiles a SurfacePivot into the sqlCell placeholder dialect. Tenant and table names still go through {{table:}} / the executor.
// Zero IO.
// ---------------------------------------------------------------------------

import { snake } from "../derive/pgNames.js";
import { schemaFail, type RowFilter } from "../schema/common.js";
import { collectBoundSqlReads } from "./sqlCell.js";
import {
  asStringList,
  type ResolvedPivot,
  type ResolvedPivotDimension,
  type ResolvedPivotFactMeasure,
  type ResolvedPivotRollup,
  type SurfaceColumn,
} from "./surface.js";

const TZ_PATTERN = /^[A-Za-z0-9_+\-\/]+$/;

function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) schemaFail(`compilePivotSql: illegal identifier "${name}"`);
  return name;
}

function col(key: string): string {
  return ident(snake(key));
}

function tzLiteral(timezone: string): string {
  if (!TZ_PATTERN.test(timezone)) schemaFail(`compilePivotSql: timezone "${timezone}" is not legal`);
  return `'${timezone.replace(/'/g, "''")}'`;
}

function hopAlias(factIndex: number, dim: string, hop: number): string {
  return ident(`f${String(factIndex)}_${snake(dim)}_${String(hop)}`);
}

function lblAlias(prefix: string, dim: string): string {
  return ident(`${prefix}_${snake(dim)}`);
}

function measureExprSql(key: string, resolved: ResolvedPivot, rowGroup = false, filter?: string): string {
  const measure = resolved.measures[key];
  if (measure === undefined) schemaFail(`compilePivotSql: unknown measure "${key}"`);
  if (filter !== undefined && !rowGroup) schemaFail("compilePivotSql: FILTER can only be added to a row-group total");
  if (filter === "") schemaFail("compilePivotSql: FILTER condition must not be empty");
  const expr = measure.expr;
  if (expr.kind === "sum") {
    if (!rowGroup) return col(expr.of);
    const base = `sum(m.${col(expr.of)})`;
    return filter === undefined ? base : `${base} FILTER (WHERE ${filter})`;
  }
  if (expr.kind === "max") {
    if (!rowGroup) return col(expr.of);
    const base = `max(m.${col(expr.of)})`;
    return filter === undefined ? base : `${base} FILTER (WHERE ${filter})`;
  }
  if (expr.kind === "add") {
    return `(${measureExprSql(expr.left, resolved, rowGroup, filter)} + ${measureExprSql(expr.right, resolved, rowGroup, filter)})`;
  }
  if (expr.kind === "sub") {
    return `(${measureExprSql(expr.left, resolved, rowGroup, filter)} - ${measureExprSql(expr.right, resolved, rowGroup, filter)})`;
  }
  if (expr.kind !== "ratio") schemaFail(`compilePivotSql: unknown expr.kind`);
  return `round((${measureExprSql(expr.numerator, resolved, rowGroup, filter)}) / nullif((${measureExprSql(expr.denominator, resolved, rowGroup, filter)}), 0) * ${String(expr.scale)}, 2)`;
}

function dimByKey(resolved: ResolvedPivot, key: string): ResolvedPivotDimension {
  const dim = resolved.dimensions.find((item) => item.key === key);
  if (dim === undefined) schemaFail(`compilePivotSql: unknown dimension "${key}"`);
  return dim;
}

function factJoins(
  factIndex: number,
  dim: ResolvedPivotDimension,
  needed: ReadonlySet<string>,
): string[] {
  if (!needed.has(dim.key) || dim.path.length === 0) return [];
  const lines: string[] = [];
  for (const [hopIndex, hop] of dim.path.entries()) {
    const alias = hopAlias(factIndex, dim.key, hopIndex);
    const prev = hopIndex === 0 ? hop.fromAlias : hopAlias(factIndex, dim.key, hopIndex - 1);
    lines.push(
      `  LEFT JOIN {{table:${hop.toModule}}} ${alias} ON ${alias}.id = ${prev}.${ident(hop.column)}`,
    );
  }
  return lines;
}

function endpointAlias(factIndex: number, dim: ResolvedPivotDimension): string {
  return hopAlias(factIndex, dim.key, dim.path.length - 1);
}

/** id is never an empty string; a missed LEFT JOIN uses the '' sentinel so FULL JOIN can still use equality. */
function dimSentinelSql(factIndex: number, dim: ResolvedPivotDimension): string {
  if (dim.fieldAlias !== null && dim.fieldColumn !== null) {
    return `coalesce(${dim.fieldAlias}.${ident(dim.fieldColumn)}, '')`;
  }
  return `coalesce(${endpointAlias(factIndex, dim)}.id, '')`;
}

function requireOnField(dim: ResolvedPivotDimension, at: string): { alias: "f" | "h"; column: string } {
  if (dim.fieldAlias === null || dim.fieldColumn === null) {
    schemaFail(`${at}: ${dim.key} needs a field on the same table`);
  }
  return { alias: dim.fieldAlias, column: dim.fieldColumn };
}

function bucketCaseSql(dim: ResolvedPivotDimension, timezone: string): string {
  const field = requireOnField(dim, "compilePivotSql");
  const qualified = `${field.alias}.${ident(field.column)}`;
  return `CASE WHEN ${qualified} IS NULL THEN NULL WHEN ${qualified} < (CURRENT_TIMESTAMP AT TIME ZONE ${tzLiteral(timezone)})::date THEN 'past' ELSE 'notPast' END`;
}

function bucketLabelSql(source: string, dim: ResolvedPivotDimension): string {
  if (dim.options === null) schemaFail(`compilePivotSql: ${dim.key} is missing bucket options`);
  return `CASE ${source} WHEN 'past' THEN ${sqlScalarLiteral(dim.options.past, `compilePivotSql.${dim.key}.past`)} WHEN 'notPast' THEN ${sqlScalarLiteral(dim.options.notPast, `compilePivotSql.${dim.key}.notPast`)} END`;
}

/** A null is encoded as the '' sentinel so JOIN / keyJoin use equality; restore turns it back into NULL with nullif. */
function dimValueSql(factIndex: number, dim: ResolvedPivotDimension, timezone: string): string {
  if (dim.valueKind === "bucket") return `coalesce(${bucketCaseSql(dim, timezone)}, '')`;
  if (dim.valueKind === "date") {
    const field = requireOnField(dim, "compilePivotSql");
    return `coalesce(${field.alias}.${ident(field.column)}::text, '')`;
  }
  return dimSentinelSql(factIndex, dim);
}

function dimRestoreSql(dim: ResolvedPivotDimension): string {
  return `nullif(m.${col(dim.key)}, '')`;
}

function lookupAlias(prefix: string, dim: string, part: number): string {
  return ident(`${lblAlias(prefix, dim)}_${String(part)}`);
}

/**
 * The endpoint record's display name. Multiple cells use the same join as `composeRefLabel`:
 * a blank cell takes no place and the declared separator joins the rest;
 * all blank is NULL (the frontend shows "unspecified"), and it does not fall back to the id.
 */
function endpointLabelSql(dim: ResolvedPivotDimension, aliasPrefix: string): string {
  if (dim.endpointModule === null) schemaFail(`compilePivotSql: ${dim.key} has no endpoint module`);
  const parts = dim.labelParts.map((part, index) => {
    const alias = part.lookup === null ? lblAlias(aliasPrefix, dim.key) : lookupAlias(aliasPrefix, dim.key, index);
    return `${alias}.${ident(part.column)}`;
  });
  if (parts.length === 0) schemaFail(`compilePivotSql: ${dim.key} has an empty display name`);
  if (parts.length === 1) return parts[0]!;
  const separator = sqlScalarLiteral(dim.labelSeparator, `compilePivotSql.${dim.key}.labelSeparator`);
  return `nullif(concat_ws(${separator}, ${parts.map((part) => `nullif(${part}, '')`).join(", ")}), '')`;
}

/** The same rule as the output column `${dim}Label`: a bucket label, nullif when there is no endpoint, otherwise the endpoint display name. */
function dimLabelSql(dim: ResolvedPivotDimension, aliasPrefix: string): string {
  if (dim.valueKind === "bucket") return bucketLabelSql(`m.${col(dim.key)}`, dim);
  if (dim.endpointModule === null) return dimRestoreSql(dim);
  return endpointLabelSql(dim, aliasPrefix);
}

function dimLabelJoinLines(dim: ResolvedPivotDimension, aliasPrefix: string, indent: string): string[] {
  if (dim.endpointModule === null) return [];
  const alias = lblAlias(aliasPrefix, dim.key);
  return [
    `${indent}LEFT JOIN {{table:${dim.endpointModule}}} ${alias} ON ${alias}.id = ${dimRestoreSql(dim)}`,
    ...dim.labelParts.flatMap((part, index) => {
      if (part.lookup === null) return [];
      const lookup = lookupAlias(aliasPrefix, dim.key, index);
      return [
        `${indent}LEFT JOIN {{table:${part.lookup.module}}} ${lookup} ON ${lookup}.id = ${alias}.${ident(part.lookup.matchColumn)}`,
      ];
    }),
  ];
}

function rowSentinelEq(rowDims: readonly string[]): string {
  return rowDims.map((key) => `m.${col(key)} = k.${col(key)}`).join("\n AND ");
}

function dateBounds(alias: "f" | "h", dateColumn: string, timezone: string): string[] {
  const tz = tzLiteral(timezone);
  const colName = ident(dateColumn);
  return [
    `    AND ${alias}.${colName} >= ({{param:dateFrom}}::date)::timestamp AT TIME ZONE ${tz}`,
    `    AND ${alias}.${colName} < (({{param:dateTo}}::date + 1)::timestamp) AT TIME ZONE ${tz}`,
  ];
}

function sqlScalarLiteral(value: unknown, at: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  schemaFail(`${at} unsupported filter value`);
}

function rollupWhereSql(from: string, headerAlias: string, where: RowFilter | null): string[] {
  if (where === null) return [];
  const parts: string[] = [];
  for (const [key, value] of Object.entries(where)) {
    const column = `${headerAlias}.${ident(col(key))}`;
    const values = Array.isArray(value) ? value : [value];
    const rendered = values.map((item) => {
      if (key === "status") {
        if (typeof item !== "string") schemaFail("compilePivotSql: rollup where.status must be a string");
        return `{{status:${from}.${item}}}`;
      }
      return sqlScalarLiteral(item, `compilePivotSql.rollup.where.${key}`);
    });
    if (rendered.length === 1) parts.push(`${column} = ${rendered[0]}`);
    else parts.push(`${column} IN (${rendered.join(", ")})`);
  }
  return parts;
}

function rollupSubquerySql(rollup: ResolvedPivotRollup): string {
  const local = rollup.onColumn === null ? "f.id" : `f.${ident(rollup.onColumn)}`;
  const innerMeasure = rollup.agg === "count"
    ? "coalesce(count(*), 0)"
    : (() => {
        if (rollup.measureColumn === null) schemaFail("compilePivotSql: rollup is missing a measure column");
        const table = rollup.measureLayer === "line" ? "l" : "d";
        const column = `${table}.${ident(rollup.measureColumn)}`;
        return rollup.agg === "sum" ? `coalesce(sum(${column}), 0)` : `${rollup.agg}(${column})`;
      })();
  if (rollup.through !== null) {
    const wheres = [
      `l.${ident(rollup.matchColumn)} = ${local}`,
      ...rollupWhereSql(rollup.from, "d", rollup.where),
    ];
    return [
      `(`,
      `SELECT ${innerMeasure}`,
      `FROM {{table:${rollup.from}.${rollup.through}}} l`,
      `INNER JOIN {{table:${rollup.from}}} d ON d.id = l.bill_id`,
      `WHERE ${wheres.join(" AND ")}`,
      `)`,
    ].join(" ");
  }
  const wheres = [
    `d.${ident(rollup.matchColumn)} = ${local}`,
    ...rollupWhereSql(rollup.from, "d", rollup.where),
  ];
  return [
    `(`,
    `SELECT ${innerMeasure}`,
    `FROM {{table:${rollup.from}}} d`,
    `WHERE ${wheres.join(" AND ")}`,
    `)`,
  ].join(" ");
}

function factMeasureSelect(measure: ResolvedPivotFactMeasure): string {
  const inner = measure.rowSql != null
    ? measure.rowSql
    : measure.rollup !== null
      ? rollupSubquerySql(measure.rollup)
      : `${measure.alias}.${ident(measure.column)}`;
  if (measure.agg === "sum") return `    coalesce(sum(${inner}), 0) AS ${col(measure.key)}`;
  return `    ${measure.agg}(${inner}) AS ${col(measure.key)}`;
}

function dimFilterSql(
  factIndex: number,
  dim: ResolvedPivotDimension,
  params: Readonly<Record<string, unknown>>,
  timezone: string,
): string | null {
  if (!dim.filterable) return null;
  if (dim.filter === "dateRange") {
    const field = requireOnField(dim, "compilePivotSql");
    const qualified = `${field.alias}.${ident(field.column)}`;
    const clauses: string[] = [];
    const from = params[`${dim.key}From`];
    const to = params[`${dim.key}To`];
    if (from !== undefined && from !== null && from !== "") {
      clauses.push(`    AND ${qualified} >= {{param:${dim.key}From}}::date`);
    }
    if (to !== undefined && to !== null && to !== "") {
      clauses.push(`    AND ${qualified} <= {{param:${dim.key}To}}::date`);
    }
    return clauses.length === 0 ? null : clauses.join("\n");
  }
  if (dim.filter === "ilike") {
    const value = params[dim.key];
    if (typeof value !== "string" || value === "") return null;
    if (dim.fieldAlias === null || dim.fieldColumn === null) {
      schemaFail(`compilePivotSql: the ILIKE filter on ${dim.key} needs a field on the same table`);
    }
    return `    AND ${dim.fieldAlias}.${ident(dim.fieldColumn)} ILIKE {{like:${dim.key}}}`;
  }
  const values = asStringList(params[dim.key], `compilePivotSql.${dim.key}`);
  if (values.length === 0) return null;
  if (dim.bucket === "pastDue") {
    for (const value of values) {
      if (value !== "past" && value !== "notPast") {
        schemaFail(`compilePivotSql: ${dim.key} "${value}" is unknown; choices: past / notPast`);
      }
    }
    return `    AND (${bucketCaseSql(dim, timezone)}) = ANY({{param:${dim.key}}}::text[])`;
  }
  if (dim.fieldAlias !== null && dim.fieldColumn !== null) {
    return `    AND ${dim.fieldAlias}.${ident(dim.fieldColumn)} = ANY({{param:${dim.key}}}::text[])`;
  }
  return `    AND ${endpointAlias(factIndex, dim)}.id = ANY({{param:${dim.key}}}::text[])`;
}

function compileFactCte(
  resolved: ResolvedPivot,
  factIndex: number,
  g: readonly string[],
  needed: ReadonlySet<string>,
  params: Readonly<Record<string, unknown>>,
  timezone: string,
  includeSortDate: boolean,
): string {
  const fact = resolved.facts[factIndex];
  if (fact === undefined) schemaFail("compilePivotSql: fact index is out of range");
  const dimSelects = g.map((key) => {
    const dim = dimByKey(resolved, key);
    return `    ${dimValueSql(factIndex, dim, timezone)} AS ${col(key)}`;
  });
  const measureSelects = fact.measures.map((measure) => factMeasureSelect(measure));
  if (includeSortDate) {
    measureSelects.push(`    max(${fact.dateAlias}.${ident(fact.dateColumn)}) AS _sort_date`);
  }
  const joins = resolved.dimensions.flatMap((dim) => factJoins(factIndex, dim, needed));
  const statuses = fact.status.map((status) => `{{status:${fact.module}.${status}}}`).join(", ");
  const statusAlias = fact.through === null ? "f" : "h";
  const filters: string[] = [
    `    ${statusAlias}.status IN (${statuses})`,
    ...dateBounds(fact.dateAlias, fact.dateColumn, timezone),
  ];
  for (const dim of resolved.dimensions) {
    const clause = dimFilterSql(factIndex, dim, params, timezone);
    if (clause !== null) filters.push(clause);
  }
  const group = g.map((key) => dimValueSql(factIndex, dimByKey(resolved, key), timezone)).join(", ");
  const from = fact.through === null
    ? [`  FROM {{table:${fact.module}}} f`]
    : [
        `  FROM {{table:${fact.module}.${fact.through}}} f`,
        `  INNER JOIN {{table:${fact.module}}} h ON h.id = f.bill_id`,
      ];
  return [
    `p_fact_${String(factIndex)} AS (`,
    `  SELECT`,
    [...dimSelects, ...measureSelects].join(",\n"),
    ...from,
    ...joins,
    `  WHERE`,
    filters.join("\n"),
    `  GROUP BY ${group}`,
    `)`,
  ].join("\n");
}

/** The missing side stays NULL. A present record whose total is 0 is already in the fact CTE's coalesce(sum, 0). */
function mergedMeasureSql(alias: string | null, measure: ResolvedPivotFactMeasure): string {
  const source = alias === null ? col(measure.key) : `${alias}.${col(measure.key)}`;
  return `    ${source} AS ${col(measure.key)}`;
}

function compileMerged(resolved: ResolvedPivot, g: readonly string[], includeSortDate: boolean): string {
  const facts = resolved.facts;
  const dimCols = g.map((key) => col(key));
  if (facts.length === 1) {
    const selects = [
      ...dimCols.map((name) => `    ${name}`),
      ...facts[0]!.measures.map((measure) => mergedMeasureSql(null, measure)),
      ...(includeSortDate ? [`    _sort_date`] : []),
    ];
    return [`p_merged AS (`, `  SELECT`, selects.join(",\n"), `  FROM p_fact_0`, `)`].join("\n");
  }
  const aliases = facts.map((_, index) => `f${String(index)}`);
  const dimSelects = dimCols.map(
    (name) => `    coalesce(${aliases.map((alias) => `${alias}.${name}`).join(", ")}) AS ${name}`,
  );
  const measureSelects = facts.flatMap((fact, index) =>
    fact.measures.map((measure) => mergedMeasureSql(aliases[index]!, measure)),
  );
  if (includeSortDate) {
    measureSelects.push(
      `    coalesce(${aliases.map((alias) => `${alias}._sort_date`).join(", ")}) AS _sort_date`,
    );
  }
  const lines = [
    `p_merged AS (`,
    `  SELECT`,
    [...dimSelects, ...measureSelects].join(",\n"),
    `  FROM p_fact_0 ${aliases[0]}`,
  ];
  for (let index = 1; index < facts.length; index += 1) {
    const prev = aliases.slice(0, index);
    const curr = aliases[index]!;
    const ons = dimCols.map((name) => {
      const left = prev.length === 1 ? `${prev[0]}.${name}` : `coalesce(${prev.map((alias) => `${alias}.${name}`).join(", ")})`;
      return `${left} = ${curr}.${name}`;
    });
    lines.push(`  FULL JOIN p_fact_${String(index)} ${curr}`);
    lines.push(`    ON ${ons.join("\n   AND ")}`);
  }
  lines.push(`)`);
  return lines.join("\n");
}

function compileMeasured(resolved: ResolvedPivot, g: readonly string[]): string {
  const selects = [
    ...g.map((key) => `    ${col(key)}`),
    ...resolved.measureOrder.map((key) => `    ${measureExprSql(key, resolved, false)} AS ${col(key)}`),
  ];
  return [`p_measured AS (`, `  SELECT`, selects.join(",\n"), `  FROM p_merged`, `)`].join("\n");
}

function havingClauses(
  resolved: ResolvedPivot,
  params: Readonly<Record<string, unknown>>,
): string[] {
  const out: string[] = [];
  for (const [key, measure] of Object.entries(resolved.measures)) {
    if (measure.filter !== "range") continue;
    const expr = measureExprSql(key, resolved, true);
    const min = params[`${key}Min`];
    const max = params[`${key}Max`];
    if (min !== undefined && min !== null && min !== "") {
      if (typeof min !== "number" || !Number.isFinite(min)) {
        schemaFail(`compilePivotSql: ${key}Min must be a number`);
      }
      out.push(`${expr} >= {{param:${key}Min}}`);
    }
    if (max !== undefined && max !== null && max !== "") {
      if (typeof max !== "number" || !Number.isFinite(max)) {
        schemaFail(`compilePivotSql: ${key}Max must be a number`);
      }
      out.push(`${expr} <= {{param:${key}Max}}`);
    }
  }
  return out;
}

function compileKeys(
  resolved: ResolvedPivot,
  rowDims: readonly string[],
  params: Readonly<Record<string, unknown>>,
  unbounded: boolean,
  dateDesc: boolean,
  colDim: string | null,
): string {
  const sortBy = typeof params["sortBy"] === "string" ? params["sortBy"] : null;
  const useLabelSort = sortBy === null && !dateDesc;
  const labelJoins = useLabelSort
    ? rowDims.flatMap((key) => dimLabelJoinLines(dimByKey(resolved, key), "k", "  "))
    : [];
  const group = useLabelSort
    ? [
        ...rowDims.map((key) => `m.${col(key)}`),
        ...rowDims.flatMap((key) => {
          const dim = dimByKey(resolved, key);
          if (dim.endpointModule === null) return [];
          return [endpointLabelSql(dim, "k")];
        }),
      ].join(", ")
    : rowDims.map((key) => `m.${col(key)}`).join(", ");
  let order: string;
  if (sortBy !== null) {
    const measure = resolved.measures[sortBy];
    if (measure === undefined) schemaFail(`compilePivotSql: unknown sortBy "${sortBy}"`);
    const dir = params["sortDesc"] === true ? "DESC" : "ASC";
    const filter = colDim === null ? undefined : `m.${col(colDim)} = {{param:sortCol}}`;
    order = `${measureExprSql(sortBy, resolved, true, filter)} ${dir} NULLS LAST`;
  } else if (dateDesc) {
    order = `max(m._sort_date) DESC NULLS LAST`;
  } else {
    order = rowDims
      .map((key) => {
        const dim = dimByKey(resolved, key);
        if (dim.valueKind === "bucket") {
          return `${bucketLabelSql(`m.${col(key)}`, dim)} ASC NULLS LAST`;
        }
        if (dim.endpointModule === null) {
          return `m.${col(key)} ASC NULLS LAST`;
        }
        return `${endpointLabelSql(dim, "k")} ASC NULLS LAST`;
      })
      .join(", ");
  }
  const havings = havingClauses(resolved, params);
  const selects = [
    ...rowDims.map((key) => `    m.${col(key)} AS ${col(key)}`),
    `    count(*) OVER() AS _total`,
    `    row_number() OVER (ORDER BY ${order}) AS _ord`,
  ];
  return [
    `p_grouped AS (`,
    `  SELECT`,
    selects.join(",\n"),
    `  FROM p_merged m`,
    ...labelJoins,
    `  GROUP BY ${group}`,
    ...(havings.length === 0 ? [] : [`  HAVING ${havings.join(" AND ")}`]),
    `),`,
    `p_keys AS (`,
    `  SELECT * FROM p_grouped`,
    `  ORDER BY _ord`,
    ...(unbounded ? [] : [`  LIMIT {{param:pageSize}} OFFSET {{offset}}`]),
    `)`,
  ].join("\n");
}

function resultExpr(
  columnKey: string,
  resolved: ResolvedPivot,
  g: ReadonlySet<string>,
): string {
  if (columnKey === "_total") return "k._total";
  const dim = resolved.dimensions.find((item) => item.key === columnKey);
  if (dim !== undefined) {
    if (!g.has(dim.key)) return "NULL";
    return dimRestoreSql(dim);
  }
  if (columnKey.endsWith("Label")) {
    const key = columnKey.slice(0, -"Label".length);
    const labeled = resolved.dimensions.find((item) => item.key === key);
    if (labeled !== undefined) {
      if (!g.has(labeled.key)) return "NULL";
      return dimLabelSql(labeled, "r");
    }
  }
  if (columnKey in resolved.measures) return `m.${col(columnKey)}`;
  schemaFail(`compilePivotSql: unknown output column "${columnKey}"`);
}

export function pivotActiveAttrs(
  resolved: ResolvedPivot,
  activeDimKeys: ReadonlySet<string>,
): readonly {
  readonly dimKey: string;
  readonly key: string;
  readonly label: string;
  readonly column: string;
  readonly choiceSet: string | null;
}[] {
  const out: {
    dimKey: string;
    key: string;
    label: string;
    column: string;
    choiceSet: string | null;
  }[] = [];
  for (const dim of resolved.dimensions) {
    if (!activeDimKeys.has(dim.key)) continue;
    for (const attr of dim.attrs) {
      out.push({
        dimKey: dim.key,
        key: attr.key,
        label: attr.label,
        column: attr.column,
        choiceSet: attr.choiceSet,
      });
    }
  }
  return out;
}

/** Values already chosen on this dimension are not part of the candidate constraint, or the dropdown could not add the remaining values. */
export function paramsWithoutOwnDimFilter(
  params: Readonly<Record<string, unknown>>,
  dimKey: string,
): Readonly<Record<string, unknown>> {
  if (!(dimKey in params)) return params;
  const next: Record<string, unknown> = { ...params };
  delete next[dimKey];
  return next;
}

function measureFilterWheres(
  resolved: ResolvedPivot,
  params: Readonly<Record<string, unknown>>,
): string[] {
  const out: string[] = [];
  for (const [key, measure] of Object.entries(resolved.measures)) {
    if (measure.filter !== "range") continue;
    const min = params[`${key}Min`];
    const max = params[`${key}Max`];
    if (min !== undefined && min !== null && min !== "") {
      if (typeof min !== "number" || !Number.isFinite(min)) {
        schemaFail(`compilePivotFilterOptionsSql: ${key}Min must be a number`);
      }
      out.push(`m.${col(key)} >= {{param:${key}Min}}`);
    }
    if (max !== undefined && max !== null && max !== "") {
      if (typeof max !== "number" || !Number.isFinite(max)) {
        schemaFail(`compilePivotFilterOptionsSql: ${key}Max must be a number`);
      }
      out.push(`m.${col(key)} <= {{param:${key}Max}}`);
    }
  }
  return out;
}

/**
 * Filter dropdown: ids of this dimension that appear in the report facts under the current constraints, plus the same endpoint display name as the table.
 * It does not consume values already chosen on this dimension, and it does not take rowDims / paging.
 */
export function compilePivotFilterOptionsSql(
  resolved: ResolvedPivot,
  dimKey: string,
  params: Readonly<Record<string, unknown>>,
  options: { readonly timezone: string },
): string {
  if (typeof options.timezone !== "string" || options.timezone.trim() === "") {
    schemaFail("compilePivotFilterOptionsSql: timezone is required");
  }
  const dim = dimByKey(resolved, dimKey);
  if (!dim.filterable) schemaFail(`compilePivotFilterOptionsSql: ${dimKey} is not filterable`);
  const values = paramsWithoutOwnDimFilter(params, dimKey);
  const g = [dimKey];
  const needed = new Set<string>([dimKey]);
  for (const item of resolved.dimensions) {
    if (!item.filterable || item.key === dimKey) continue;
    if (item.filter === "dateRange") continue;
    if (item.filter === "ilike") {
      if (typeof values[item.key] === "string" && values[item.key] !== "") needed.add(item.key);
      continue;
    }
    if (asStringList(values[item.key], `compilePivotFilterOptionsSql.${item.key}`).length > 0) {
      needed.add(item.key);
    }
  }
  const ctes = [
    ...resolved.facts.map((_, index) =>
      compileFactCte(resolved, index, g, needed, values, options.timezone, false),
    ),
    compileMerged(resolved, g, false),
    compileMeasured(resolved, g),
  ];
  const restore = dimRestoreSql(dim);
  const filters = [`${restore} IS NOT NULL`, ...measureFilterWheres(resolved, values)];
  const sql = [
    `WITH`,
    ctes.join(",\n"),
    `SELECT DISTINCT`,
    `  ${restore} AS value,`,
    `  ${dimLabelSql(dim, "r")} AS label`,
    `FROM p_measured m`,
    ...dimLabelJoinLines(dim, "r", ""),
    `WHERE ${filters.join(" AND ")}`,
    `ORDER BY label ASC NULLS LAST, value ASC NULLS LAST`,
  ].join("\n");
  collectBoundSqlReads(sql, "compilePivotFilterOptionsSql");
  return sql;
}

function requireNormalizedPivotParams(
  params: Readonly<Record<string, unknown>>,
): { readonly rowDims: readonly string[]; readonly colDim: string | null } {
  const rowRaw = params["rowDims"];
  if (!Array.isArray(rowRaw) || rowRaw.length === 0 || rowRaw.some((item) => typeof item !== "string")) {
    schemaFail("compilePivotSql: rowDims must already have passed normalizeSurfaceParams");
  }
  const rowDims = rowRaw as readonly string[];
  const colRaw = params["colDim"];
  const colDim = typeof colRaw === "string" ? colRaw : null;
  return { rowDims, colDim };
}

function assertPivotSort(params: Readonly<Record<string, unknown>>, colDim: string | null): void {
  const sortByRaw = params["sortBy"];
  const sortByGiven = typeof sortByRaw === "string" && sortByRaw !== "";
  const sortColRaw = params["sortCol"];
  if (sortColRaw !== undefined && sortColRaw !== null && sortColRaw !== "" && typeof sortColRaw !== "string") {
    schemaFail("compilePivotSql: sortCol must be a string");
  }
  const sortColGiven = typeof sortColRaw === "string" && sortColRaw !== "";
  if (sortColGiven && !sortByGiven) schemaFail("compilePivotSql: sortCol may be used only when sortBy is given");
  if (sortColGiven && colDim === null) schemaFail("compilePivotSql: sortCol may be used only when there is a column dimension");
  if (colDim !== null && sortByGiven && !sortColGiven) schemaFail("compilePivotSql: when a column dimension exists, sortBy must include sortCol");
}

/**
 * Column-axis scalar subquery. The same WITH must already contain p_measured and p_grouped
 * (p_grouped = every row group after HAVING; columns are rowDims; not paged).
 * Returns a jsonb expression without AS. Elements are { id, label, <attrKey>... }.
 * Order is label ASC NULLS LAST, id ASC NULLS LAST.
 */
export function compilePivotColAxisExpr(
  resolved: ResolvedPivot,
  rowDims: readonly string[],
  colDim: string,
): string {
  if (rowDims.length === 0) schemaFail("compilePivotSql: the column axis needs row dimensions");
  for (const key of rowDims) dimByKey(resolved, key);
  const dim = dimByKey(resolved, colDim);
  const labelAlias = dim.endpointModule !== null ? lblAlias("r", dim.key) : null;
  const attrSelects = dim.attrs.map((attr) => {
    if (labelAlias === null) schemaFail(`compilePivotSql: the attr of ${dim.key} needs an endpoint label`);
    return `      ${labelAlias}.${ident(attr.column)} AS ${col(attr.key)}`;
  });
  const objectFields = [
    "'id', s.id",
    "'label', s.label",
    ...dim.attrs.map((attr) => `'${ident(attr.key)}', s.${col(attr.key)}`),
  ];
  return [
    `(`,
    `  SELECT coalesce(jsonb_agg(`,
    `    jsonb_build_object(${objectFields.join(", ")})`,
    `    ORDER BY s.label ASC NULLS LAST, s.id ASC NULLS LAST`,
    `  ), '[]'::jsonb)`,
    `  FROM (`,
    `    SELECT DISTINCT`,
    [
      `      ${dimRestoreSql(dim)} AS id`,
      `      ${dimLabelSql(dim, "r")} AS label`,
      ...attrSelects,
    ].join(",\n"),
    `    FROM p_measured m`,
    `    INNER JOIN p_grouped k ON ${rowSentinelEq(rowDims)}`,
    ...dimLabelJoinLines(dim, "r", "    "),
    `  ) s`,
    `)`,
  ].join("\n");
}

export function compilePivotSql(
  resolved: ResolvedPivot,
  columns: readonly SurfaceColumn[],
  params: Readonly<Record<string, unknown>>,
  options: { readonly timezone: string; readonly unbounded?: boolean },
): string {
  if (typeof options.timezone !== "string" || options.timezone.trim() === "") {
    schemaFail("compilePivotSql: timezone is required");
  }
  const { rowDims: typedRowDims, colDim } = requireNormalizedPivotParams(params);
  assertPivotSort(params, colDim);
  const values = params;
  const g = colDim === null ? typedRowDims : [...typedRowDims, colDim];
  const gSet = new Set(g);
  const needed = new Set(g);
  for (const dim of resolved.dimensions) {
    if (!dim.filterable) continue;
    if (dim.filter === "dateRange") continue;
    if (dim.filter === "ilike") {
      if (typeof values[dim.key] === "string" && values[dim.key] !== "") needed.add(dim.key);
      continue;
    }
    if (asStringList(values[dim.key], `compilePivotSql.${dim.key}`).length > 0) needed.add(dim.key);
  }
  const dateDesc = resolved.defaultSort === "dateDesc" && typeof values["sortBy"] !== "string";
  const ctes = [
    ...resolved.facts.map((_, index) =>
      compileFactCte(resolved, index, g, needed, values, options.timezone, dateDesc),
    ),
    compileMerged(resolved, g, dateDesc),
    compileMeasured(resolved, g),
    compileKeys(resolved, typedRowDims, values, options.unbounded === true, dateDesc, colDim),
  ];
  const keyJoin = rowSentinelEq(typedRowDims);
  const labelJoins = g.flatMap((key) => dimLabelJoinLines(dimByKey(resolved, key), "r", ""));
  const selectList = [
    ...columns.map((column) => `  ${resultExpr(column.key, resolved, gSet)} AS ${col(column.key)}`),
    ...pivotActiveAttrs(resolved, gSet).map(
      (attr) => `  ${lblAlias("r", attr.dimKey)}.${ident(attr.column)} AS ${col(attr.key)}`,
    ),
    `  k._total AS _total`,
    ...(colDim === null ? [] : [`  ${compilePivotColAxisExpr(resolved, typedRowDims, colDim)} AS _cols`]),
  ];
  const labelOrderExpr = (() => {
    if (colDim === null) return null;
    const dim = dimByKey(resolved, colDim);
    if (dim.endpointModule === null) return `m.${col(colDim)}`;
    return endpointLabelSql(dim, "r");
  })();
  const order = labelOrderExpr === null ? `k._ord` : `k._ord, ${labelOrderExpr} ASC NULLS LAST`;
  const sql = [
    `WITH`,
    ctes.join(",\n"),
    `SELECT`,
    selectList.join(",\n"),
    `FROM p_measured m`,
    `INNER JOIN p_keys k`,
    `  ON ${keyJoin}`,
    ...labelJoins,
    `ORDER BY ${order}`,
  ].join("\n");
  collectBoundSqlReads(sql, "compilePivotSql");
  return sql;
}
