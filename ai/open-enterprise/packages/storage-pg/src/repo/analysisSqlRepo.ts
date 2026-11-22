// ---------------------------------------------------------------------------
// Analysis SQL repository — a gated read-only SELECT runs on PostgreSQL
//
// 🔴 Tenant and data scope are injected by the runtime. A tenant_id or scope value the model fills in itself is not accepted.
// The compiler (validateAnalysisSql) must be safe on its own, and identity is bound again here.
// ---------------------------------------------------------------------------

import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  aliasScopePredicate,
  analysisCatalogOf,
  businessTableName,
  injectScopedWhere,
  injectTenantPredicates,
  isRelativeDateValue,
  isRelativeSpanN,
  isRelativeSpanToken,
  isScopeBindingOp,
  RELATIVE_DATES,
  validateAnalysisSql,
  type AnalysisCatalog,
  type AnalysisField,
  type AnalysisRelation,
  type FieldType,
  type CompiledSqlCell,
  type RelativeDateValue,
} from "@open-erp/metamodel";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import type { RuntimeCatalog } from "@open-erp/runtime-core";
import { headerScope, lineScope, resolveOperandum, relativeRange, type ModuleRegistry, type Operandum } from "./queryCompiler.js";
import { schemasOf, type Executor } from "./support.js";
import type { GroupAnalysisResult } from "./analysisRepo.js";

const PG_DIALECT = new PgDialect();
const DAY_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_VALUE = /^(\d{4})-(\d{2})$/;

function fail(message: string): never {
  throw new Error(message);
}

function requireTimezone(timezone: string, why: string): string {
  if (!timezone.trim()) fail(`${why}: missing a time zone — a relative time has no definite interval without one`);
  return timezone;
}

export interface AnalysisSqlRepo {
  querySql(
    identity: Identity,
    sqlText: string,
    params: readonly unknown[],
  ): Promise<GroupAnalysisResult & { readonly relations: readonly string[] }>;
  queryCompiled(
    identity: Identity,
    compiled: CompiledSqlCell,
  ): Promise<GroupAnalysisResult>;
}

function sqlParam(value: unknown) {
  if (!Array.isArray(value)) return sql`${value}`;
  if (value.length === 0) return sql.raw("ARRAY[]::text[]");
  return sql`ARRAY[${sql.join(value.map((item) => sql`${item}`), sql`, `)}]`;
}

export function boundSql(text: string, params: readonly unknown[]) {
  const chunks = text.split(/\$(\d+)/);
  let statement = sql.empty();
  statement = sql`${sql.raw(chunks[0] ?? "")}`;
  for (let i = 1; i < chunks.length; i += 2) {
    const index = Number(chunks[i]) - 1;
    const literal = chunks[i + 1] ?? "";
    statement = sql`${statement}${sqlParam(params[index])}${sql.raw(literal)}`;
  }
  return statement;
}

function rewriteLimitPlusOne(sqlText: string): { readonly sql: string; readonly limit: number } {
  const match = sqlText.match(/\blimit\s+(\d+)\b/i);
  const limit = match ? Number(match[1]) : 100;
  return {
    sql: sqlText.replace(/\blimit\s+\d+\b/i, `LIMIT ${String(limit + 1)}`),
    limit,
  };
}

function quoteIdent(name: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function isoDay(at: Date): string {
  const year = String(at.getUTCFullYear());
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarWindow(value: string, why: string): { readonly from: string; readonly to: string } {
  const day = DAY_VALUE.exec(value);
  if (day) {
    const year = Number(day[1]);
    const month = Number(day[2]);
    const date = Number(day[3]);
    const start = new Date(Date.UTC(year, month - 1, date));
    if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== date) {
      fail(`${why}: date "${value}" is not a valid calendar day`);
    }
    return { from: value, to: isoDay(new Date(Date.UTC(year, month - 1, date + 1))) };
  }
  const monthValue = MONTH_VALUE.exec(value);
  if (monthValue) {
    const year = Number(monthValue[1]);
    const month = Number(monthValue[2]);
    if (month < 1 || month > 12) fail(`${why}: month "${value}" is not valid`);
    return {
      from: `${monthValue[1]}-${monthValue[2]}-01`,
      to: isoDay(new Date(Date.UTC(year, month, 1))),
    };
  }
  fail(`${why}: a date / datetime absolute value accepts only YYYY-MM-DD or YYYY-MM, received ${JSON.stringify(value)}`);
}

/**
 * Fold an already compiled fragment into the outer `$N` sequence. Before renumbering, the count of `$digits` must equal params, or the positions shift silently.
 */
export function foldCompiledSql(
  compiled: { readonly sql: string; readonly params: readonly unknown[] },
  dest: unknown[],
): string {
  const slots = compiled.sql.match(/\$(\d+)/g) ?? [];
  if (slots.length !== compiled.params.length) {
    fail(
      `analysis SQL fragment: $N count (${String(slots.length)}) does not match params (${String(compiled.params.length)}) — renumbering would shift positions silently`,
    );
  }
  const offset = dest.length;
  const remapped = compiled.sql.replace(/\$(\d+)/g, (_all, n: string) => `$${String(offset + Number(n))}`);
  dest.push(...compiled.params);
  return remapped;
}

function foldSql(fragment: SQL, params: unknown[]): string {
  return foldCompiledSql(PG_DIALECT.sqlToQuery(fragment), params);
}

function analysisOperandum(alias: string, column: string, type: FieldType, label: string): Operandum {
  return {
    expr: sql.raw(`${quoteIdent(alias)}.${quoteIdent(column)}`),
    column: null,
    type,
    label,
  };
}

function absoluteTimeRange(
  type: "date" | "datetime",
  value: string,
  timezone: string,
  why: string,
): { readonly from: SQL; readonly to: SQL } {
  const window = calendarWindow(value, why);
  if (type === "date") {
    return { from: sql`cast(${window.from} as date)`, to: sql`cast(${window.to} as date)` };
  }
  const tz = sql`cast(${timezone} as text)`;
  return {
    from: sql`((cast(${window.from} as timestamp)) at time zone ${tz})`,
    to: sql`((cast(${window.to} as timestamp)) at time zone ${tz})`,
  };
}

function foldTimeCompare(
  left: SQL,
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte",
  from: SQL,
  to: SQL,
  params: unknown[],
): string {
  const fragment =
    op === "eq"
      ? sql`(${left} >= ${from} and ${left} < ${to})`
      : op === "ne"
        ? sql`(not (${left} >= ${from} and ${left} < ${to}))`
        : op === "gt"
          ? sql`${left} >= ${to}`
          : op === "gte"
            ? sql`${left} >= ${from}`
            : op === "lt"
              ? sql`${left} < ${from}`
              : sql`${left} < ${to}`;
  return foldSql(fragment, params);
}

function headerFieldsOf(catalog: AnalysisCatalog, module: string): readonly AnalysisField[] {
  const relation = catalog.relations.find((item) => item.module === module && item.grain === "header");
  if (!relation) fail(`analysis SQL data scope: the catalog has no header for module "${module}"`);
  return relation.fields;
}

function fieldOf(fields: readonly AnalysisField[], module: string, field: string): AnalysisField {
  const found = fields.find((item) => item.key === field);
  if (!found) fail(`analysis SQL data scope: header of module "${module}" has no field "${field}"`);
  return found;
}

function requireNonEmptyStrings(values: readonly unknown[], why: string): readonly string[] {
  if (values.length === 0) fail(`${why}: IN / NOT IN values cannot be empty`);
  return values.map((value, index) => {
    if (isRelativeDateValue(value)) {
      fail(`${why}[${String(index)}]: IN / NOT IN does not accept a relative time value`);
    }
    if (typeof value !== "string" || !value.trim()) {
      fail(`${why}[${String(index)}]: a data-scope predicate accepts only a non-empty string value`);
    }
    return value;
  });
}

function requireSingleValue(values: readonly unknown[], op: string, why: string): unknown {
  if (values.length !== 1) fail(`${why}: comparator "${op}" must have exactly one value, received ${String(values.length)}`);
  const value = values[0];
  if (value === undefined) fail(`${why}: comparator "${op}" is missing a value`);
  return value;
}

function bindSlot(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${String(params.length)}`;
}

function compileRelativeEq(
  operandum: Operandum,
  value: RelativeDateValue,
  timezone: string,
  why: string,
  params: unknown[],
): string {
  if (isRelativeSpanToken(value.$rel) && !isRelativeSpanN("n" in value ? value.n : undefined)) {
    fail(
      `${why}: relative time token "${value.$rel}" requires an integer n in 1..3650, received ${JSON.stringify("n" in value ? value.n : undefined)}`,
    );
  }
  if (!isRelativeSpanToken(value.$rel) && !(RELATIVE_DATES as readonly string[]).includes(value.$rel)) {
    fail(`${why}: unrecognized relative time token "${value.$rel}" — a closed set, and it is not silently stuffed into SQL as a string`);
  }
  const range = relativeRange(operandum, value, timezone, why);
  return foldSql(sql`(${operandum.expr} >= ${range.from} and ${operandum.expr} < ${range.to})`, params);
}

function compilePredicate(
  alias: string,
  module: string,
  field: AnalysisField,
  op: string | undefined,
  values: readonly unknown[],
  timezone: string,
  params: unknown[],
): string {
  const why = `${module}.${field.key}`;
  const column = `${quoteIdent(alias)}.${quoteIdent(field.column)}`;
  const left = analysisOperandum(alias, field.column, field.type, why).expr;
  const timeType = field.type === "date" || field.type === "datetime" ? field.type : null;

  if (op === "is_empty") return `${column} IS NULL`;
  if (op === "not_empty") return `${column} IS NOT NULL`;

  if (op === "contains") {
    const value = requireSingleValue(values, op, why);
    if (typeof value !== "string") fail(`${why}: contains accepts only a string value`);
    return `${column} ILIKE ${bindSlot(params, `%${escapeLike(value)}%`)}`;
  }

  if (op === undefined || op === "in" || op === "not_in" || isScopeBindingOp(op)) {
    const strings = requireNonEmptyStrings(values, why);
    const slots = strings.map((value) => bindSlot(params, value));
    const joined = slots.join(", ");
    return op === "not_in" ? `${column} NOT IN (${joined})` : `${column} IN (${joined})`;
  }

  if (op === "between") {
    if (values.length !== 2) fail(`${why}: comparator "between" must have exactly two values, received ${String(values.length)}`);
    const lo = values[0];
    const hi = values[1];
    if (isRelativeDateValue(lo) || isRelativeDateValue(hi)) {
      fail(`${why}: a relative time token means a whole interval and cannot be a between endpoint`);
    }
    if (timeType) {
      if (typeof lo !== "string" || typeof hi !== "string") {
        fail(`${why}: both ends of between on date / datetime must be YYYY-MM-DD or YYYY-MM`);
      }
      const loRange = absoluteTimeRange(timeType, lo, timezone, `${why}[0]`);
      const hiRange = absoluteTimeRange(timeType, hi, timezone, `${why}[1]`);
      return foldSql(sql`(${left} >= ${loRange.from} and ${left} < ${hiRange.to})`, params);
    }
    if (lo === undefined || hi === undefined) fail(`${why}: both ends of between must have a value`);
    return `${column} >= ${bindSlot(params, lo)} AND ${column} <= ${bindSlot(params, hi)}`;
  }

  if (op === "eq" || op === "ne" || op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    const value = requireSingleValue(values, op, why);
    if (isRelativeDateValue(value)) {
      if (op !== "eq") {
        fail(`${why}: a relative time allows only op=eq, received "${op}" — for a whole period use op=eq plus a single relative token`);
      }
      return compileRelativeEq(analysisOperandum(alias, field.column, field.type, why), value, timezone, why, params);
    }
    if (timeType) {
      if (typeof value !== "string") fail(`${why}: a date / datetime absolute value must be YYYY-MM-DD or YYYY-MM`);
      const range = absoluteTimeRange(timeType, value, timezone, why);
      return foldTimeCompare(left, op, range.from, range.to, params);
    }
    const slot = bindSlot(params, value);
    if (op === "eq") return `${column} = ${slot}`;
    if (op === "ne") return `${column} IS DISTINCT FROM ${slot}`;
    if (op === "gt") return `${column} > ${slot}`;
    if (op === "gte") return `${column} >= ${slot}`;
    if (op === "lt") return `${column} < ${slot}`;
    return `${column} <= ${slot}`;
  }

  fail(`${why}: unrecognized data-scope operator "${op}"`);
}

/**
 * Row scope for analysis SQL. Compiled by `op`.
 * Empty-value operators are not skipped because values=[]. Value operators with values=[] drop the whole group, same as `rowScopeOf` (empty group = deny).
 * Relative values go through `relativeRange`.
 */
export function compileAnalysisScopeClause(
  catalog: AnalysisCatalog,
  alias: string,
  module: string,
  identity: Identity,
  timezone: string,
  params: unknown[],
): string {
  requireTimezone(timezone, `analysis SQL ${module}`);
  const scope = identity.dataScopes[module];
  if (!scope) return "false";
  if (scope.policies.includes("all")) return "";
  const fields = headerFieldsOf(catalog, module);
  const groups = scope.groups ?? scope.predicates.map((predicate) => [predicate]);
  const groupSql: string[] = [];
  for (const group of groups) {
    const parts: string[] = [];
    let empty = false;
    for (const predicate of group) {
      if (!predicate.field.trim()) fail(`${module}: a data-scope predicate is missing a field`);
      const field = fieldOf(fields, module, predicate.field);
      const op = predicate.op;
      // Same rule as queryCompiler.rowScopeOf: a non-empty-value operator with values=[] drops the whole group, and does not throw 500.
      if (op !== "is_empty" && op !== "not_empty" && predicate.values.length === 0) {
        empty = true;
        break;
      }
      parts.push(compilePredicate(alias, module, field, op, predicate.values, timezone, params));
    }
    if (empty || parts.length === 0) continue;
    groupSql.push(parts.length === 1 ? parts[0]! : `(${parts.join(" AND ")})`);
  }
  return groupSql.length === 0 ? "false" : groupSql.length === 1 ? groupSql[0]! : `(${groupSql.join(" OR ")})`;
}

function headerOf(catalog: AnalysisCatalog, relation: AnalysisRelation): AnalysisRelation | undefined {
  if (relation.grain === "header") return relation;
  return catalog.relations.find((item) => item.module === relation.module && item.grain === "header");
}

function injectIdentityGuards(
  catalog: AnalysisCatalog,
  sqlText: string,
  params: readonly unknown[],
  aliases: Readonly<Record<string, string>>,
  identity: Identity,
  timezone: string,
): { readonly sql: string; readonly params: readonly unknown[] } {
  const withTenant = injectTenantPredicates(
    { sql: sqlText, params, relations: [], aliases },
    identity.tenantId,
  );
  const nextParams = [...withTenant.params];
  const nextSql = injectScopedWhere(withTenant.sql, (scopedAliases, leftAliases) => {
    const extras: string[] = [];
    const usedHeaders = new Set<string>();
    const scoped = new Set(scopedAliases);
    const left = new Set(leftAliases);

    for (const [alias, name] of Object.entries(aliases)) {
      if (!scoped.has(alias)) continue;
      const relation = catalog.relations.find((item) => item.name === name);
      if (!relation || relation.grain !== "header") continue;
      usedHeaders.add(relation.name);
      const extra = compileAnalysisScopeClause(catalog, alias, relation.module, identity, timezone, nextParams);
      if (extra) extras.push(aliasScopePredicate(alias, extra, left.has(alias)));
    }

    for (const [alias, name] of Object.entries(aliases)) {
      if (!scoped.has(alias)) continue;
      const relation = catalog.relations.find((item) => item.name === name);
      if (!relation || relation.grain !== "line") continue;
      const header = headerOf(catalog, relation);
      if (!header) {
        extras.push(aliasScopePredicate(alias, "false", left.has(alias)));
        continue;
      }
      if (usedHeaders.has(header.name)) continue;
      const headerAlias = "_scope_h";
      const headerTable = businessTableName(relation.module);
      const extra = compileAnalysisScopeClause(
        catalog,
        headerAlias,
        relation.module,
        identity,
        timezone,
        nextParams,
      );
      const tenantSlot = `$${String(nextParams.push(identity.tenantId))}`;
      const headerFilter = extra
        ? `${quoteIdent(headerAlias)}.tenant_id = ${tenantSlot} AND ${extra}`
        : `${quoteIdent(headerAlias)}.tenant_id = ${tenantSlot}`;
      extras.push(
        aliasScopePredicate(
          alias,
          `${quoteIdent(alias)}.bill_id IN (SELECT ${quoteIdent(headerAlias)}.id FROM ${headerTable} ${quoteIdent(headerAlias)} WHERE ${headerFilter})`,
          left.has(alias),
        ),
      );
    }

    return extras.length === 0 ? null : extras.join(" AND ");
  });

  return { sql: nextSql, params: nextParams };
}

export function createAnalysisSqlExecutor(
  exec: Executor,
  catalog: AnalysisCatalog,
  timezone: string,
  registry?: ModuleRegistry,
): Pick<AnalysisSqlRepo, "querySql" | "queryCompiled"> {
  const tz = requireTimezone(timezone, "analysis SQL");
  return {
    async querySql(identity, sqlText, params) {
      const who = requireIdentity(identity);
      const validated = validateAnalysisSql(catalog, sqlText, params);
      const widened = rewriteLimitPlusOne(validated.sql);
      const bound = injectIdentityGuards(catalog, widened.sql, validated.params, validated.aliases, who, tz);
      const rows = (await exec.execute(boundSql(bound.sql, bound.params))) as unknown as readonly Readonly<
        Record<string, unknown>
      >[];
      const truncated = rows.length > widened.limit;
      return {
        rows: truncated ? rows.slice(0, widened.limit) : rows,
        truncated,
        relations: validated.relations,
      };
    },
    async queryCompiled(identity, compiled) {
      const who = requireIdentity(identity);
      const params = [...compiled.params];
      let text = compiled.sql;
      for (const ref of compiled.fields ?? []) {
        if (!registry) fail("analysis derived field is missing the module registry");
        const relation = catalog.relations.find(r => r.name === compiled.aliases[ref.alias]);
        if (!relation) fail(`analysis derived field has unknown alias "${ref.alias}"`);
        const tables = registry.get(relation.module);
        const scope = relation.grain === "header" ? headerScope(tables)
          : lineScope(tables, tables.schema.fields.find(f => f.key === relation.through)!);
        const expression = resolveOperandum(registry,scope,ref.key,"analysis SQL cell").expr;
        const rendered = foldSql(expression,params);
        // Resolver qualifies columns with the generated physical table; this SELECT uses an alias.
        const quoted = `"${compiled.aliases[ref.alias]}".`;
        text = text.replace(ref.token, rendered.split(quoted).join(`"${ref.alias}".`));
      }
      const bound = injectIdentityGuards(catalog, text, params, compiled.aliases, who, tz);
      const rows = (await exec.execute(boundSql(bound.sql, bound.params))) as unknown as readonly Readonly<
        Record<string, unknown>
      >[];
      return { rows, truncated: false };
    },
  };
}

export function createAnalysisSqlRepo(exec: Executor, runtime: RuntimeCatalog, timezone: string): AnalysisSqlRepo {
  requireTimezone(timezone, "analysis SQL");
  const catalog = analysisCatalogOf([...schemasOf(runtime).values()]);
  return createAnalysisSqlExecutor(exec, catalog, timezone);
}
