// ---------------------------------------------------------------------------
// Query → SQL compilation — the second half of the safety boundary
//
// `normalizeQuery` in the kernel guarantees the **structure** is legal (the field is one this module declared, the comparator is closed,
// and an in value is an array). What it cannot guarantee is **which column this name maps to** — the kernel does not know the shape of the database.
//
// 🔴 So this is the only place a "field name" becomes a "column", and the rule is one sentence:
// **never string-interpolate**. Columns come from `getTableColumns()` on the generated Drizzle table,
// and a miss throws; values always go through parameter binding. Conditions come from the browser and the model, and both will send malicious or wrong names.
//
// Why not implement camelCase→snake_case again: the generated tables are themselves the product of `snake()`
// (builder/src/codegen.ts). Another mapping would be a second source of truth, and a rename would drift.
// The table variable name is the module code, and a line table is `<module>_<field key>`, taken straight from the generated product the same way.
//
// 🔴 A derived field (derive) has no column. Silently ignoring a condition on a derived field would **return a batch of rows that should have been filtered out**,
// and the returned data would look completely normal — so this either compiles to a subquery or expression, or it throws explicitly.
// There is no third path.
// ---------------------------------------------------------------------------

import { and, asc, desc, eq, getTableColumns, inArray, is, notInArray, or, sql, type SQL } from "drizzle-orm";
import { alias, PgTable, QueryBuilder, type PgColumn } from "drizzle-orm/pg-core";
import {
  COMPARATORS_BY_TYPE,
  isQueryFieldValue,
  assertQueryFieldComparison,
  DATA_SCOPE_POLICIES,
  isScopeBindingOp,
  isCustomFieldKey,
  fieldPermissionKey,
  isPlatformField,
  isRelativeDateValue,
  isRelativeSpanN,
  isRelativeSpanToken,
  isRelativeSpanValue,
  isSummarizableType,
  parseLinePath,
  PLATFORM_FIELD_TYPES,
  RELATIVE_DATES,
  RELATIVE_SPAN_MAX_N,
  summaryKey,
  type Expr,
  type Field,
  type FieldType,
  type FormulaOp,
  type LinePath,
  type ModuleSchema,
  type Query,
  type QueryComparator,
  type QueryCondition,
  type QueryNode,
  type RefFilterCondition,
  type RelativeDate,
  type RelativeDateValue,
  type RelativeSpan,
  type ScopeValue,
  type SummarySpec,
  searchTerms,
} from "@open-erp/metamodel";
import { scopedWhere, type ScopedTable } from "../db/scope.js";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import type { GeneratedTables } from "./generatedTables.js";

export class QueryCompileError extends Error {
  override readonly name = "QueryCompileError";
}

function fail(message: string): never {
  throw new QueryCompileError(message);
}

// ── table registry ──────────────────────────────────────────────────────────────

/** Header table. The generator guarantees each one has id plus the isolation columns — without them, this layer does not recognize it. */
export interface BillTable extends ScopedTable {
  readonly id: PgColumn;
}

/** Line table. No orgId: a line is always reached through the header, and ownership follows the header (see codegen.ts). */
export interface LineTable extends ScopedTable {
  readonly id: PgColumn;
  readonly billId: PgColumn;
  readonly lineNo: PgColumn;
}

export interface ModuleTables {
  readonly code: string;
  readonly schema: ModuleSchema;
  readonly header: BillTable;
  /** subtable field key → line table */
  readonly lines: ReadonlyMap<string, LineTable>;
  /** Property name (= field key / platform field name) → column */
  readonly columns: Readonly<Record<string, PgColumn>>;
}

export interface ModuleRegistry {
  /** Module code → tables. An unknown module throws, and does not return null for each caller to paper over. */
  get(code: string): ModuleTables;
  has(code: string): boolean;
  /** The full registry. Cross-module invariants such as delete-reference protection must scan the whole graph, not a subset the caller handed in. */
  all(): readonly ModuleTables[];
}

function tableNamed(tables: GeneratedTables, name: string, why: string): PgTable {
  const table = tables[name];
  if (!is(table, PgTable)) {
    fail(`${why}: the generated product has no table variable "${name}" — the module declaration and tables/ are out of sync; run yarn gen:db first`);
  }
  return table;
}

function columnsOf(table: PgTable): Readonly<Record<string, PgColumn>> {
  return getTableColumns(table) as Readonly<Record<string, PgColumn>>;
}

function requireColumns(table: PgTable, name: string, keys: readonly string[]): Readonly<Record<string, PgColumn>> {
  const cols = columnsOf(table);
  for (const key of keys) {
    if (!cols[key]) fail(`table "${name}" is missing column "${key}" — this layer accepts only the shape the generator produced`);
  }
  return cols;
}

/**
 * Build the registry. Resolve every module's tables **at startup**: a declaration out of sync with the generated product is a release incident,
 * and it should explode when the service starts, not when some user opens some module's list.
 */
export function createRegistry(
  schemas: ReadonlyMap<string, ModuleSchema>,
  tables: GeneratedTables,
): ModuleRegistry {
  const built = new Map<string, ModuleTables>();

  for (const [code, schema] of schemas) {
    const headerTable = tableNamed(tables, code, `module "${code}"`);
    requireColumns(headerTable, code, ["id", "tenantId", "orgId", "status", "revision"]);

    const lines = new Map<string, LineTable>();
    for (const field of schema.fields) {
      if (field.type !== "subtable") continue;
      // The line-table variable name rule is not invented here: codegen.ts uses `${schema.code}_${field.key}`.
      const lineName = `${code}_${field.key}`;
      const lineTable = tableNamed(tables, lineName, `line "${field.key}" of module "${code}"`);
      requireColumns(lineTable, lineName, ["id", "tenantId", "billId", "lineNo"]);
      lines.set(field.key, lineTable as unknown as LineTable);
    }

    built.set(code, {
      code,
      schema,
      header: headerTable as unknown as BillTable,
      lines,
      columns: columnsOf(headerTable),
    });
  }

  return {
    has: (code) => built.has(code),
    all: () => [...built.values()],
    get(code) {
      const found = built.get(code);
      if (!found) fail(`there is no module "${code}" — module tables come from what domains/ loaded, and an arbitrary name is not accepted`);
      return found;
    },
  };
}

// ── scope: one layer of "row" ────────────────────────────────────────────────────

/**
 * The range in which a field name can be resolved.
 *
 * The header is one layer, and each line table is another. They are separate because **the same field name on two layers is two things**
 * (header `qty` and line `qty`), and resolving them together will one day resolve the wrong one.
 * `productionReceipt` has this shape: the header "produced goods" and the line "finished goods" are both called `productId`.
 *
 * 🔴 So "which layer" is said by **the field name itself** (`lines.qty` versus bare `qty`; the criterion is the kernel's
 * `resolveAnalysisField` / `parseLinePath`), not by which layer the call site happens to be on.
 * A grouped analysis has both tables in FROM (lines inner join header) and picks the scope by name;
 * merging header fields into `lineScope.fields` to "support them while we are here" is wrong — columns come from
 * `scope.columns`, which are the line table's columns, and none of the merged-in names can be found.
 */
export interface FieldScope {
  /** So an error can say which one. */
  readonly what: string;
  readonly fields: readonly Field[];
  readonly columns: Readonly<Record<string, PgColumn>>;
  readonly id: PgColumn;
  readonly tenantId: PgColumn;
  /** Platform fields this layer knows → type. */
  readonly platform: Readonly<Record<string, FieldType>>;
  /** Alias prefix for derived subqueries, so names do not collide in one SQL statement. */
  readonly aliasPrefix: string;
}

/**
 * Platform field types on the header — **taken directly from the kernel's copy**.
 *
 * A copy was handwritten here once. That copy evolved apart from the kernel and the frontend, and the symptom was "the same field is
 * filterable on the agent side and missing on the panel", with no error in any of the three places. There is one criterion for comparability
 * (`COMPARATORS_BY_TYPE`, indexed by type), and there should likewise be only one criterion for type.
 *
 * Tenant and org are in the list: they can only **intersect** the tenant condition from `scopedWhere`,
 * and can never widen the result set (see `compileQuery`).
 */
const HEADER_PLATFORM_TYPES: Readonly<Record<string, FieldType>> = PLATFORM_FIELD_TYPES;

/** A line table has no state machine, no orgId, and no creator — it is reached through the header, and these are its only platform fields. */
const LINE_PLATFORM_TYPES: Readonly<Record<string, FieldType>> = Object.freeze({
  id: "string",
  lineNo: "number",
});

export function headerScope(tables: ModuleTables): FieldScope {
  return {
    what: tables.code,
    fields: tables.schema.fields,
    columns: tables.columns,
    id: tables.header.id,
    tenantId: tables.header.tenantId,
    platform: HEADER_PLATFORM_TYPES,
    aliasPrefix: tables.code,
  };
}

export function lineScope(tables: ModuleTables, field: Field): FieldScope {
  const table = tables.lines.get(field.key);
  if (!table) fail(`line "${field.key}" of module "${tables.code}" has no line table`);
  if (!field.fields?.length) fail(`line "${field.key}" of module "${tables.code}" has no column declaration`);
  return {
    what: `${tables.code}.${field.key}`,
    fields: field.fields,
    columns: columnsOf(table as unknown as PgTable),
    id: table.id,
    tenantId: table.tenantId,
    platform: LINE_PLATFORM_TYPES,
    aliasPrefix: `${tables.code}_${field.key}`,
  };
}

// ── field → something that can be compared ───────────────────────────────────────────────────

/** Field types that can take ILIKE. A fuzzy match on a number or date errors immediately in PostgreSQL, so say it here. */
const TEXTUAL_TYPES: readonly FieldType[] = ["string", "text", "phone", "enum", "ref"];

/** Something that can take part in comparison, sort, or projection: a column, or a derived scalar expression. */
export interface Operandum {
  readonly expr: SQL;
  /**
   * When it really is a column, give the column itself.
   *
   * Projection must use the **column object** rather than an equivalent SQL fragment: Drizzle decides whether to run `mapFromDriverValue`
   * by whether the selected thing is a column — after it degrades to a SQL fragment
   * `createdAt` turns from a Date into a string, and nothing errors.
   */
  readonly column: PgColumn | null;
  /**
   * For a custom field, give its key. That also means `expr` was taken out of the `custom` jsonb.
   *
   * Equality is rewritten from this into `custom @> '{"k":"v"}'` so it can use GIN — the `->>` form
   * cannot use a `jsonb_path_ops` index, and under high selectivity it degrades from 1.8ms to a full scan.
   */
  readonly customKey?: string;
  /** For a custom field, the column that holds it (`custom`), for rewriting a containment match. */
  readonly container?: PgColumn;
  /** Multi-select: the value is a jsonb array, and equality must be written `@> {"k":["v"]}` rather than `->> 'k' = 'v'`. */
  readonly multiple?: boolean;
  readonly type: FieldType;
  /** For errors. */
  readonly label: string;
}

/** Allow-list: field key → column. A miss throws, and it never falls through to "compose one by name". */
function columnFor(scope: FieldScope, key: string, why: string): PgColumn {
  const column = scope.columns[key];
  if (!column) {
    fail(`${why}: the table of "${scope.what}" has no column for "${key}" — a field name is accepted only when it was declared`);
  }
  return column;
}

/** The relation target of a derived field must be a module, or there is no way to write the subquery. */
function targetOf(registry: ModuleRegistry, from: string, why: string): ModuleTables {
  if (!registry.has(from)) {
    fail(`${why}: the entity "${from}" a derive points at is not a module, and cannot be compiled into a subquery — this condition cannot be ignored silently`);
  }
  return registry.get(from);
}

/**
 * The **layer** a derive reads: an empty `through` is the header table, otherwise it is that line table.
 *
 * 🔴 The two layers differ not only in the table, but in **what the tenant column and the id column mean**: `id` on a line table is the row id
 * (`refLine` stores that), and `billId` is what points back at the header. Picking the wrong one does not error; it just matches no row.
 */
function layerTableOf(
  target: ModuleTables,
  through: string | null,
  why: string,
): { readonly table: PgTable; readonly aliasHint: string } {
  if (through === null) return { table: target.header as unknown as PgTable, aliasHint: target.code };
  const line = target.lines.get(through);
  if (!line) {
    fail(`${why}: module "${target.code}" has no line table "${through}" — a row-level derive has nowhere to drill`);
  }
  return { table: line as unknown as PgTable, aliasHint: `${target.code}_${through}` };
}

/**
 * lookup → a correlated subquery.
 *
 * `(select target column from target table as t where t.id = this row.<match> and t.tenant_id = this row.tenant_id limit 1)`
 *
 * It is not compiled as a join: a join changes the row-count meaning of the main query (the whole row disappears when the target row is missing),
 * while a lookup means "bring one value along", and a miss should be null, not one fewer row.
 */
function lookupExpr(registry: ModuleRegistry, scope: FieldScope, field: Field, why: string): SQL {
  const derive = field.derive;
  if (derive?.kind !== "lookup") fail(`${why}: not a lookup derive`);
  const target = targetOf(registry, derive.from, why);
  const layer = layerTableOf(target, derive.through, why);

  // Check derived-ness on the layer the value column lives on: a row-level lookup brings a line column along.
  const layerFields =
    derive.through === null
      ? target.schema.fields
      : (target.schema.fields.find((f) => f.key === derive.through)?.fields ?? []);
  const targetField = layerFields.find((f) => f.key === derive.field);
  if (targetField?.derive) {
    fail(`${why}: the lookup target "${derive.from}.${derive.field}" is itself a derived field, and this layer does not nest derives — reference a field that has a column`);
  }
  const fk = columnFor(scope, derive.match, `${why} relation field`);

  const aliased = alias(layer.table, `__lk_${scope.aliasPrefix}_${field.key}`) as unknown as PgTable;
  const cols = columnsOf(aliased);
  const value = cols[derive.field];
  // 🔴 Both layers match on `id`: on the header layer it is the document id (`ref` stores that), and on the line layer it is the row id
  // (`refLine` stores that) — each matches its own layer, so this does not need to branch.
  const id = cols["id"];
  const tenant = cols["tenantId"];
  if (!value || !id || !tenant) {
    const at = derive.through === null ? `module "${derive.from}"` : `line table "${derive.through}" of module "${derive.from}"`;
    fail(`${why}: ${at} has no column "${derive.field}" (or is missing id / tenantId)`);
  }

  const sub = new QueryBuilder()
    .select({ v: value })
    .from(aliased)
    // 🔴 The subquery carries the tenant condition too: a cross-tenant lookup would bring out another tenant's customer name,
    // and the brought-out value would look completely normal.
    // No limit 1: the target is a primary-key match, at most one row. Writing it would only bind an extra parameter,
    // and "using limit to hide a possible multi-row" is exactly turning a data problem into silently taking the first row.
    .where(and(eq(id, fk), eq(tenant, scope.tenantId)));
  return sql`(${sub})`;
}

/**
 * rollup → a correlated subquery.
 *
 * Header layer: `(select agg(measure) from downstream table t where t.<match> = this row.<on or id> and t.tenant_id = … [and filter])`
 *
 * Line layer (`through` non-empty): `match` is on the **line table**, and `where` still filters the **header**. The measure is on the line table by default;
 * a header measure is valid only when the line table is `maxRows: 1` (the gate already pins that), so a multi-line document does not add the header measure once per line.
 * When the header is needed there is one more join:
 * `(select agg(l.measure or h.measure) from line l join header h on h.id = l.bill_id where l.<match> = this row.<on or id> … [and h.status …])`
 *
 * 🔴 `where` cannot be changed to query the line table: a line has no state machine, and `{ status: 'shipped' }` has no column on that layer.
 * Degrading to "no such column, so drop the condition" would count drafts into "the accumulated quantity already issued" — a number that is too large,
 * looks completely normal, and is exactly the left-hand value of the over-issue gate.
 *
 * sum / count use `coalesce(…, 0)`: **the sum of an empty set is 0**, which is arithmetic and not a fallback
 * (contrast `?? 0`, the fallback that writes "could not be read" as 0).
 * avg / min / max get no default — an empty set has no average and no minimum, and inventing one is the error.
 */
function rollupExpr(registry: ModuleRegistry, scope: FieldScope, field: Field, why: string): SQL {
  const derive = field.derive;
  if (derive?.kind !== "rollup") fail(`${why}: not a rollup derive`);
  const target = targetOf(registry, derive.from, why);
  const layer = layerTableOf(target, derive.through, why);

  const aliased = alias(layer.table, `__rl_${scope.aliasPrefix}_${field.key}`) as unknown as PgTable;
  const cols = columnsOf(aliased);
  const matchCol = cols[derive.match];
  const tenant = cols["tenantId"];
  if (!matchCol || !tenant) {
    const at = derive.through === null ? `downstream module "${derive.from}"` : `line table "${derive.from}.${derive.through}"`;
    fail(`${why}: ${at} has no field "${derive.match}" pointing back at this document (or is missing tenantId)`);
  }

  const localCoordinate = (derive.on ?? null) === null
    ? scope.id
    : columnFor(scope, derive.on as string, `${why} local match field`);
  const conditions: SQL[] = [eq(matchCol, localCoordinate), eq(tenant, scope.tenantId)];

  // A filter always lands on the header. A row-level rollup must join back to the header before it can judge it; a header measure joins too.
  const filterEntries = Object.entries(derive.where ?? {});
  const lineMeasureCol = derive.agg === "count" ? undefined : cols[derive.measure ?? ""];
  const needsHeader =
    derive.through !== null && (filterEntries.length > 0 || (derive.agg !== "count" && lineMeasureCol === undefined));
  const headerAlias = needsHeader
    ? alias(target.header as unknown as PgTable, `__rlh_${scope.aliasPrefix}_${field.key}`) as unknown as PgTable
    : null;
  const filterCols = headerAlias === null ? cols : columnsOf(headerAlias);
  for (const [key, value] of filterEntries) {
    const filterCol = filterCols[key];
    if (!filterCol) {
      const at =
        derive.through === null ? `downstream module "${derive.from}"` : `the header of downstream module "${derive.from}"`;
      fail(`${why}: the rollup filter references field "${key}", which does not exist on ${at}`);
    }
    // 🔴 An array is `in`, not `eq`. Written as eq, drizzle binds the whole array as one value,
    // and the result is **no row matches** — while the rollup column shows 0 and looks completely normal:
    // "this customer has no open orders" and "this rollup was written wrong" look identical on the screen.
    conditions.push(Array.isArray(value) ? inArray(filterCol, value) : eq(filterCol, value));
  }

  let measure: SQL;
  if (derive.agg === "count") {
    measure = sql`coalesce(count(*), 0)`;
  } else {
    const headerMeasureCol = headerAlias === null ? undefined : columnsOf(headerAlias)[derive.measure ?? ""];
    const measureCol = lineMeasureCol ?? headerMeasureCol;
    if (!measureCol) {
      fail(`${why}: rollup measure "${derive.measure}" has no column on downstream module "${derive.from}"`);
    }
    if (lineMeasureCol === undefined && headerMeasureCol !== undefined && derive.through !== null) {
      const throughField = target.schema.fields.find((field) => field.key === derive.through);
      if ((throughField?.maxRows ?? null) !== 1) {
        fail(
          `${why}: rollup measure "${derive.measure}" is on the header, but line table "${derive.through}" is not maxRows: 1` +
            ` — a multi-line document would add the same header measure once per line`,
        );
      }
    }
    measure =
      derive.agg === "sum"
        ? sql`coalesce(sum(${measureCol}), 0)`
        : derive.agg === "avg"
          ? sql`avg(${measureCol})`
          : derive.agg === "min"
            ? sql`min(${measureCol})`
            : sql`max(${measureCol})`;
  }

  const builder = new QueryBuilder().select({ v: measure }).from(aliased);
  if (headerAlias === null) {
    return sql`(${builder.where(and(...conditions))})`;
  }
  // Row-level rollup plus a header filter: join back. A join rather than another nested `exists` subquery,
  // because `bill_id` against the header primary key is naturally at most one row, and the row-count meaning does not change.
  const lineBillId = cols["billId"];
  const headerCols = columnsOf(headerAlias);
  const headerId = headerCols["id"];
  if (!lineBillId || !headerId) {
    fail(`${why}: a row-level rollup must join back to the header, but billId / id is missing — this is not a shape the generator produced`);
  }
  return sql`(${builder.innerJoin(headerAlias, eq(headerId, lineBillId)).where(and(...conditions))})`;
}

const FORMULA_SQL_OPS: Readonly<Record<Exclude<FormulaOp, "max">, string>> = Object.freeze({
  add: "+",
  sub: "-",
  mul: "*",
  div: "/",
});

/**
 * formula → an arithmetic expression on the same row.
 *
 * 🔴 Why translate it again in SQL (the kernel already has `evaluateFormula`):
 * filtering and paging can happen only in the database. If "lines whose amount is greater than 1000" is fetched and then filtered in JS,
 * `total` and paging are both wrong. What is translated is **the same declared expression tree**, not a second declaration —
 * the same thing as "translate a Query into SQL".
 *
 * `orElse` compiles to `coalesce`: it is a **declared** default ("no discount was filled" is a legal business fact),
 * not a `?? 0` hidden in evaluation code. Apart from that, if any operand is empty the whole expression is null,
 * and 0 is not invented — that would turn "a row that is not finished yet" into a real zero in the total.
 */
function formulaExpr(
  registry: ModuleRegistry,
  scope: FieldScope,
  expr: Expr,
  why: string,
  seen: ReadonlySet<string>,
): SQL {
  if ("value" in expr) {
    // Explicit cast: an expression such as `$1 * $2` where both sides are parameters errors immediately because PostgreSQL cannot infer the type.
    return sql`cast(${expr.value} as numeric)`;
  }
  if ("field" in expr) {
    const operandum = resolveOperandum(registry, scope, expr.field, why, seen);
    // PostgreSQL cannot multiply a boolean directly into a numeric. On the evaluation side a boolean is 0/1, and SQL matches that;
    // NULL is kept for orElse's coalesce, and "was not brought out" is not silently treated as false.
    if (operandum.type === "bool") {
      return sql`(case ${operandum.expr} when true then 1 when false then 0 else null end)`;
    }
    return operandum.expr;
  }
  if ("orElse" in expr) {
    const inner = formulaExpr(registry, scope, expr.orElse.of, why, seen);
    return sql`coalesce(${inner}, cast(${expr.orElse.whenEmpty} as numeric))`;
  }
  const parts = expr.args.map((arg) => formulaExpr(registry, scope, arg, why, seen));
  if (expr.op === "max") {
    // PostgreSQL greatest ignores a partial NULL; formula semantics say if any operand is empty, the whole expression is empty.
    const hasNull = parts.map((part) => sql`${part} is null`).reduce((left, right) => sql`${left} or ${right}`);
    return sql`(case when ${hasNull} then null else greatest(${sql.join(parts, sql`, `)}) end)`;
  }
  const operator = FORMULA_SQL_OPS[expr.op];
  const joined = parts.reduce((left, right) => sql`${left} ${sql.raw(operator)} ${right}`);
  // The parentheses must stay: a - (b - c) and a - b - c are not the same thing.
  return sql`(${joined})`;
}

/**
 * Resolve a field name into something that can be compared.
 *
 * 🔴 The only entrance. Any path that does not come through here is bypassing the allow-list.
 */
export function resolveOperandum(
  registry: ModuleRegistry,
  scope: FieldScope,
  key: string,
  why: string,
  seen: ReadonlySet<string> = new Set(),
): Operandum {
  const label = `${scope.what}.${key}`;

  const platformType = scope.platform[key];
  if (platformType) {
    const column = columnFor(scope, key, why);
    return { expr: sql`${column}`, column, type: platformType, label };
  }
  if (isPlatformField(key)) {
    fail(`${why}: this layer of "${scope.what}" has no platform field "${key}" — a line has no status or creator of its own; those are on the header`);
  }

  const field = scope.fields.find((f) => f.key === key) ?? null;
  if (!field) {
    fail(`${why}: "${scope.what}" has no field "${key}" — field names go through the allow-list, and an arbitrary name is not accepted`);
  }
  if (field.type === "subtable") {
    fail(`${why}: "${key}" is a line table, not a value, and cannot take part in comparison or sort`);
  }

  if (field.derive) {
    // A formula referencing a formula is legal, but a cycle is not: without this gate, a self-referential declaration makes the compiler recurse forever.
    if (seen.has(key)) {
      fail(`${why}: derived field "${label}" is defined in a cycle (${[...seen, key].join(" → ")})`);
    }
    const nested = new Set([...seen, key]);
    const at = `${why} derived field "${key}"`;
    const expr =
      field.derive.kind === "lookup"
        ? lookupExpr(registry, scope, field, at)
        : field.derive.kind === "rollup"
          ? rollupExpr(registry, scope, field, at)
          : formulaExpr(registry, scope, field.derive.expr, at, nested);
    return { expr, column: null, type: field.type, label };
  }

  // 🔴 A custom field has no column of its own: the value lives in this table's `custom` jsonb.
  // This branch must come **before** `columnFor` — otherwise it would reject a legal field with "the table has no such column".
  if (isCustomFieldKey(key)) {
    const container = scope.columns["custom"];
    if (!container) {
      fail(`${why}: "${scope.what}" does not open custom fields — which modules are open is decided by the module declaration`);
    }
    return {
      expr: customExpr(container, key, field.type, field.multiple === true),
      column: null,
      type: field.type,
      label,
      customKey: key,
      container,
      ...(field.multiple === true ? { multiple: true } : {}),
    };
  }

  const column = columnFor(scope, key, why);
  return { expr: sql`${column}`, column, type: field.type, label };
}

/**
 * Turn `custom->>'x_k'` into a comparable value by field type.
 *
 * What comes out of jsonb is always text, and comparing it to a number gives **dictionary order**:
 * "quantity > 9" would exclude 10 ('10' < '9'). So the cast must be explicit, and it cannot be skipped.
 */
function customExpr(container: PgColumn, key: string, type: Field["type"], multiple = false): SQL {
  // 🔴 Multi-select takes `->` (jsonb) rather than `->>` (text): the latter turns the whole array into a piece of JSON text,
  // and the projection is a string such as `"[\"fabric\",\"lining\"]"` — the screen renders it as a single value,
  // and the next save writes that text back as one option.
  if (multiple) return sql`${container} -> ${key}`;
  const text = sql`${container} ->> ${key}`;
  if (type === "number" || type === "money" || type === "percent") return sql`(${text})::numeric`;
  if (type === "bool") return sql`(${text})::boolean`;
  if (type === "date") return sql`(${text})::date`;
  if (type === "datetime") return sql`(${text})::timestamptz`;
  return text;
}

// ── comparators ────────────────────────────────────────────────────────────────

function assertComparator(operandum: Operandum, op: QueryComparator, why: string): void {
  const allowed = COMPARATORS_BY_TYPE[operandum.type];
  if (!allowed) fail(`${why}: "${operandum.label}" is type ${operandum.type} and cannot be a query condition`);
  if (!allowed.includes(op)) {
    fail(`${why}: "${operandum.label}" is type ${operandum.type} and does not support comparator "${op}"; available: ${allowed.join(" / ")}`);
  }
}

/**
 * If it can be rewritten as `custom @> '{"k":"v"}'`, return that SQL, otherwise null.
 *
 * The criterion is one sentence: **what this cell stores in jsonb is a string** (a choice-item code, text),
 * and the compared value is itself a string. Numbers and booleans are not in this set — `1` and `1.0`, `true` and `"true"`
 * are not the same literal in jsonb, containment would miss hits, and a miss is silent.
 */
function containmentOf(operandum: Operandum, value: unknown): SQL | null {
  if (operandum.customKey === undefined || operandum.container === undefined) return null;
  if (typeof value !== "string") return null;
  if (operandum.type !== "enum" && operandum.type !== "string" && operandum.type !== "text") return null;
  // A multi-select is stored as a jsonb array: `{"xK":["a","b"]} @> {"xK":["a"]}` is true,
  // while `->> 'xK'` comes out as the text of the whole array, and equality never holds.
  // Both shapes share the same GIN index, which is the legitimate use of a containment match.
  const probe = operandum.multiple === true ? [value] : value;
  return sql`${operandum.container} @> ${JSON.stringify({ [operandum.customKey]: probe })}::jsonb`;
}

function requireValue(value: unknown, op: QueryComparator, why: string): unknown {
  if (value === null || value === undefined) {
    fail(`${why}: comparator "${op}" cannot have an empty value — to query an empty value, change the comparison to is_empty / not_empty`);
  }
  return value;
}

// ── relative time → interval ───────────────────────────────────────────────────────
//
// 🔴 The time zone must be passed in explicitly. There is no default: "this month" is two different intervals in two time zones,
// and falling back to the server `TZ` would make the same saved view **quietly return a different batch** after it is deployed on another machine.
//
// 🔴 The evaluation instant is PostgreSQL `now()` (the transaction instant), not a timestamp computed in JS and passed in:
// a saved view must be **re-evaluated on every execution**, or "the last 7 days" saved today is still yesterday's 7 days tomorrow —
// it still returns data, and the answer is the answer to yesterday's question. That kind of expiry is silent, usable, and nobody goes looking.
//
// Intervals are always **half-open** `[from, to)`. A closed interval has to handle the tail `23:59:59.999999`,
// and timestamptz precision is microseconds — a hardcoded tail will one day miss the row that lands in the gap.
//
// 🔴 The two grades' boundaries are not in the same coordinate system, and this is the only easy place in this section to get wrong:
//   · **calendar day / calendar month** (fixed tokens and the `_days` / `_months` parameter grades) — the boundary aligns to local 00:00,
//     so fold into the target time zone's wall clock, compute, then fold back;
//   · **rolling hours** (the `_hours` parameter grade) — the boundary is `now()` itself, and it **does not enter the wall clock**.
//     Folding into the wall clock and back is not an identity on the two DST changeover days (that wall-clock instant either does not exist
//     or exists twice), and "the past 48 hours" must be exactly 48 hours on any day.

/** A time interval. Half-open: `from <= x < to`. */
export interface TimeRange {
  readonly from: SQL;
  readonly to: SQL;
}

/**
 * An evaluated interval also carries one fact: which coordinate system the two ends are in.
 * `wall` = the local wall-clock timestamp (still to be folded back to timestamptz, or cast to date);
 * otherwise both ends are already timestamptz, and folding again would shift them by a time-zone offset — while the result would still be a legal time.
 */
interface LocalRange extends TimeRange {
  readonly wall: boolean;
}

/**
 * token → a local wall-clock interval. `base` is a `timestamp` already folded into the target time zone.
 *
 * `date_trunc('week', …)` in PostgreSQL starts on **Monday**, which matches the local week convention.
 * `last_7d` is 7 days including today (when a user says "the last 7 days" they mean a week that includes today),
 * and that is a different question from a whole-span lookback such as `yesterday`. Both are kept.
 */
const RELATIVE_RANGE: Readonly<Record<RelativeDate, (base: SQL) => TimeRange>> = Object.freeze({
  // 🔴 ± interval must be its own group. PostgreSQL ranks AT TIME ZONE above + / -,
  // and a bare `date_trunc(...) + interval '1 day' at time zone tz` is read as
  // `date_trunc(...) + timezone(tz, interval)` → 42883 (production createdAt eq today).
  today: (b) => ({ from: sql`date_trunc('day', ${b})`, to: sql`(date_trunc('day', ${b}) + interval '1 day')` }),
  yesterday: (b) => ({
    from: sql`(date_trunc('day', ${b}) - interval '1 day')`,
    to: sql`date_trunc('day', ${b})`,
  }),
  last_7d: (b) => ({
    from: sql`(date_trunc('day', ${b}) - interval '6 days')`,
    to: sql`(date_trunc('day', ${b}) + interval '1 day')`,
  }),
  last_30d: (b) => ({
    from: sql`(date_trunc('day', ${b}) - interval '29 days')`,
    to: sql`(date_trunc('day', ${b}) + interval '1 day')`,
  }),
  this_week: (b) => ({
    from: sql`date_trunc('week', ${b})`,
    to: sql`(date_trunc('week', ${b}) + interval '1 week')`,
  }),
  last_week: (b) => ({
    from: sql`(date_trunc('week', ${b}) - interval '1 week')`,
    to: sql`date_trunc('week', ${b})`,
  }),
  this_month: (b) => ({
    from: sql`date_trunc('month', ${b})`,
    to: sql`(date_trunc('month', ${b}) + interval '1 month')`,
  }),
  last_month: (b) => ({
    from: sql`(date_trunc('month', ${b}) - interval '1 month')`,
    to: sql`date_trunc('month', ${b})`,
  }),
  last_3_months: (b) => ({
    from: sql`(date_trunc('month', ${b}) - interval '2 months')`,
    to: sql`(date_trunc('month', ${b}) + interval '1 month')`,
  }),
  this_quarter: (b) => ({
    from: sql`date_trunc('quarter', ${b})`,
    to: sql`(date_trunc('quarter', ${b}) + interval '3 months')`,
  }),
  last_quarter: (b) => ({
    from: sql`(date_trunc('quarter', ${b}) - interval '3 months')`,
    to: sql`date_trunc('quarter', ${b})`,
  }),
  this_year: (b) => ({
    from: sql`date_trunc('year', ${b})`,
    to: sql`(date_trunc('year', ${b}) + interval '1 year')`,
  }),
  ytd: (b) => ({
    from: sql`date_trunc('year', ${b})`,
    to: sql`(date_trunc('day', ${b}) + interval '1 day')`,
  }),
});

/**
 * An interval of N days / N hours.
 *
 * 🔴 **Parameter binding, no string splicing**: `interval '${n} days'` would insert a number that came from the browser and the model
 * into SQL text, and this layer has one rule — never string-interpolate. The multiplication form is deliberate:
 * `make_interval(days => …)` can be parameterized too, but its named-argument syntax is not portable on older PostgreSQL,
 * and `int * interval '1 day'` has always been portable.
 */
function intervalOf(n: number, unit: "day" | "hour" | "month"): SQL {
  if (unit === "day") return sql`(cast(${n} as int) * interval '1 day')`;
  if (unit === "hour") return sql`(cast(${n} as int) * interval '1 hour')`;
  return sql`(cast(${n} as int) * interval '1 month')`;
}

/**
 * Parameterized token → interval. **Where the measure is made good**, corresponding item by item to the kernel table `RELATIVE_SPAN_UNIT`.
 *
 * The calendar-day grade and the fixed calendar tokens are one family, not another system: `last_n_days` with n=1 is `today`,
 * and n=7 is `last_7d` (both include today); `last_n_months` with n=1 is `this_month`.
 * The fixed ones stay because a question aligned to a month or quarter, such as "this month / last quarter", cannot be expressed by a parameter,
 * not because the meaning is different.
 */
const RELATIVE_SPAN_RANGE: Readonly<Record<RelativeSpan, (base: SQL, n: number) => LocalRange>> = Object.freeze({
  last_n_days: (b, n) => ({
    wall: true,
    from: sql`(date_trunc('day', ${b}) - ${intervalOf(n - 1, "day")})`,
    to: sql`(date_trunc('day', ${b}) + interval '1 day')`,
  }),
  next_n_days: (b, n) => ({
    wall: true,
    from: sql`date_trunc('day', ${b})`,
    to: sql`(date_trunc('day', ${b}) + ${intervalOf(n, "day")})`,
  }),
  // 🔴 A rolling grade does not touch `base`: the boundary is this instant. Aligning it to any calendar boundary turns "N hours from now"
  // into "the Nth hour counted from midnight today" — up to a whole day off, and both answers look real.
  last_n_hours: (_b, n) => ({ wall: false, from: sql`now() - ${intervalOf(n, "hour")}`, to: sql`now()` }),
  next_n_hours: (_b, n) => ({ wall: false, from: sql`now()`, to: sql`now() + ${intervalOf(n, "hour")}` }),
  last_n_months: (b, n) => ({
    wall: true,
    from: sql`(date_trunc('month', ${b}) - ${intervalOf(n - 1, "month")})`,
    to: sql`(date_trunc('month', ${b}) + interval '1 month')`,
  }),
  next_n_months: (b, n) => ({
    wall: true,
    from: sql`date_trunc('month', ${b})`,
    to: sql`(date_trunc('month', ${b}) + ${intervalOf(n, "month")})`,
  }),
});

/**
 * Fold a relative value into two ends that can be compared with the column directly.
 *
 * What type it folds into is decided by **the column's type**: a `date` column compares dates, and a `datetime` column (timestamptz)
 * compares an instant with a time zone. Comparing a timestamp to a date column makes PostgreSQL convert implicitly and drop the time part —
 * which side drops it, and into what, follows PostgreSQL's conversion rules, not what we said.
 */
export function relativeRange(operandum: Operandum, value: RelativeDateValue, timezone: string, why: string): TimeRange {
  if (operandum.type !== "date" && operandum.type !== "datetime") {
    fail(`${why}: "${operandum.label}" is type ${operandum.type}, and a relative time can be used only on date / datetime`);
  }
  const tz = sql`cast(${timezone} as text)`;
  // now() is timestamptz; `at time zone <tz>` folds it into that time zone's wall-clock timestamp.
  const base = sql`(now() at time zone ${tz})`;
  const local: LocalRange = isRelativeSpanValue(value)
    ? RELATIVE_SPAN_RANGE[value.$rel](base, value.n)
    : { wall: true, ...RELATIVE_RANGE[value.$rel](base) };

  if (!local.wall) {
    // The kernel gate already judged this (a rolling grade is allowed only on datetime). Judge it again here: the compiler must be safe on its own.
    // Letting it through is `cast(now() - interval '48 hours' as date)` — the hour part is dropped silently,
    // and what comes back is a completely normal result set cut by calendar day.
    if (operandum.type !== "datetime") {
      fail(
        `${why}: "${operandum.label}" is type ${operandum.type}, and a rolling-hour grade can be used only on datetime — ` +
          `a date column has no time of day, and the hours would be dropped silently. For a calendar-day question use last_n_days / next_n_days`,
      );
    }
    return { from: local.from, to: local.to };
  }
  const bind = (edge: SQL): SQL =>
    // A wall-clock timestamp with `at time zone <tz>` again becomes timestamptz — the other half of the same operator.
    // This is not a repeat: one fold goes in, and one fold comes back.
    //
    // 🔴 datetime must parenthesize edge into one group first. The parentheses of `cast(edge as date)` are already enough;
    // `at time zone` has none, and PostgreSQL reads `x + interval AT TIME ZONE tz` as calling
    // `timezone(text, interval)` on the interval. That function does not exist, and the whole query 500s.
    operandum.type === "date" ? sql`cast(${edge} as date)` : sql`((${edge}) at time zone ${tz})`;
  return { from: bind(local.from), to: bind(local.to) };
}

/**
 * Accept the value if it is a relative token, otherwise throw. The kernel checks this (`normalizeQuery`), and this walks it again:
 * **the compiler must be safe on its own**, and cannot depend on an upstream gate — the `compileRaw` path has no kernel.
 * The criterion is not invented here: the token set and the bounds of N are both read from those two kernel copies.
 */
function asRelative(value: unknown, why: string): RelativeDateValue {
  if (!isRelativeDateValue(value)) fail(`${why}: not a relative time value`);
  const rel: string = value.$rel;
  if (isRelativeSpanToken(rel)) {
    const n = "n" in value ? value.n : undefined;
    if (!isRelativeSpanN(n)) {
      fail(
        `${why}: relative time token "${rel}" requires an integer n in 1..${String(RELATIVE_SPAN_MAX_N)}, ` +
          `received ${JSON.stringify(n)} — no default is filled in, and it is not compiled into SQL silently`,
      );
    }
    return { $rel: rel, n };
  }
  if (!(RELATIVE_DATES as readonly string[]).includes(rel)) {
    fail(`${why}: unrecognized relative time token "${rel}" — a closed set, and it is not silently stuffed into SQL as a string`);
  }
  return { $rel: rel as RelativeDate };
}

// ── absolute day / month grain → half-open interval ─────────────────────────────────────────────
//
// Grain is decided by the shape of the value, not by another field: `YYYY-MM-DD` is one day, and `YYYY-MM` is one month.
// An instant string with `T` or a space (`2026-10-16T00:00:00` / `2026-10-16 00:00:00`) is still a point, and is not treated as a day or month window.
// datetime (timestamptz) anchors the window at local 00:00 in the request time zone; a date column has no time of day and only does date arithmetic.

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CALENDAR_MONTH = /^(\d{4})-(\d{2})$/;
const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

function assertCalendarYmd(year: number, month: number, day: number, raw: string, why: string): void {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    fail(`${why}: date "${raw}" does not exist — an illegal date shape cannot be compared silently as a string`);
  }
}

function calendarStartDay(value: string, why: string): { readonly day: string; readonly unit: "day" | "month" } | null {
  const day = CALENDAR_DAY.exec(value);
  if (day) {
    assertCalendarYmd(Number(day[1]), Number(day[2]), Number(day[3]), value, why);
    return { day: value, unit: "day" };
  }
  const month = CALENDAR_MONTH.exec(value);
  if (month) {
    const monthNo = Number(month[2]);
    if (monthNo < 1 || monthNo > 12) {
      fail(`${why}: date "${value}" does not exist — an illegal date shape cannot be compared silently as a string`);
    }
    return { day: `${month[1]}-${month[2]}-01`, unit: "month" };
  }
  return null;
}

function isIsoInstant(value: string, why: string): boolean {
  const match = ISO_INSTANT.exec(value);
  if (!match) return false;
  assertCalendarYmd(Number(match[1]), Number(match[2]), Number(match[3]), value, why);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) {
    fail(`${why}: date "${value}" is not a legal ISO instant string — an illegal date shape cannot be compared silently as a string`);
  }
  return true;
}

/**
 * Expand an absolute value into a half-open window by day or month shape; an ISO instant string returns null and takes a point comparison.
 * Anything that is not date/datetime is not expanded. A shape that does not match throws, and a day string is not compared directly to timestamptz.
 */
function absoluteGrainRange(
  operandum: Operandum,
  value: unknown,
  timezone: string,
  why: string,
): TimeRange | null {
  if (operandum.type !== "date" && operandum.type !== "datetime") return null;
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    fail(
      `${why}: "${operandum.label}" is type ${operandum.type}, and the compared value must be YYYY-MM-DD, YYYY-MM, or an instant string with T / a space, ` +
        `received ${JSON.stringify(value)}`,
    );
  }
  const grain = calendarStartDay(value, why);
  if (!grain) {
    if (isIsoInstant(value, why)) return null;
    fail(
      `${why}: value "${value}" of "${operandum.label}" is not YYYY-MM-DD, YYYY-MM, or an instant string with T / a space — ` +
        `an illegal date shape cannot be compared silently as a string`,
    );
  }
  if (operandum.type === "date") {
    const from = sql`cast(${grain.day} as date)`;
    const to =
      grain.unit === "day"
        ? sql`(cast(${grain.day} as date) + 1)`
        : sql`cast((cast(${grain.day} as date) + interval '1 month') as date)`;
    return { from, to };
  }
  const tz = sql`cast(${timezone} as text)`;
  const origin = sql`cast(${grain.day} as timestamp)`;
  const toEdge =
    grain.unit === "day"
      ? sql`(${origin} + interval '1 day')`
      : sql`(${origin} + interval '1 month')`;
  // 🔴 ± interval must be grouped before AT TIME ZONE. PostgreSQL ranks AT TIME ZONE above + / -.
  return {
    from: sql`((${origin}) at time zone ${tz})`,
    to: sql`((${toEdge}) at time zone ${tz})`,
  };
}

function comparisonRange(
  operandum: Operandum,
  value: unknown,
  timezone: string,
  why: string,
): TimeRange | null {
  if (isRelativeDateValue(value)) return relativeRange(operandum, asRelative(value, why), timezone, why);
  return absoluteGrainRange(operandum, value, timezone, why);
}

/** LIKE metacharacters. Without escaping, a user searching for `%` matches every row. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function ilike(operandum: Operandum, text: string, why: string, negated = false): SQL {
  if (!TEXTUAL_TYPES.includes(operandum.type)) {
    fail(`${why}: "${operandum.label}" is type ${operandum.type} and cannot be fuzzy-matched`);
  }
  const pattern = `%${escapeLike(text)}%`;
  return negated ? sql`${operandum.expr} not ilike ${pattern}` : sql`${operandum.expr} ilike ${pattern}`;
}

function compileComparison(
  operandum: Operandum,
  op: QueryComparator,
  value: unknown,
  timezone: string,
  why: string,
): SQL {
  assertComparator(operandum, op, why);
  const left = operandum.expr;

  /** Half-open interval of a relative token or a day/month absolute value; a point comparison (number, ISO instant) returns null. */
  const range = (v: unknown, at: string): TimeRange | null => comparisonRange(operandum, v, timezone, at);

  switch (op) {
    // There is only one way to ask about an empty value: is_empty / not_empty. `eq null` used to do both jobs
    // ("query empty" and the in-between state on the screen of "the user has not filled it yet"), and the cost was that applying with no value
    // turned the list into 0 rows, which the user read as "my documents are gone".
    case "is_empty":
      return sql`${left} is null`;
    case "not_empty":
      return sql`${left} is not null`;

    case "eq": {
      const r = range(value, why);
      // "order date equals this month / equals a day" means it falls in this half-open interval, not that it equals one instant.
      if (r) return sql`(${left} >= ${r.from} and ${left} < ${r.to})`;
      const eqValue = requireValue(value, op, why);
      // Equality on a custom field is rewritten as jsonb containment: that is the only form that can use GIN(jsonb_path_ops).
      // It holds only for the kinds that are stored as strings — the literal shape of a number, boolean, or date in jsonb
      // is not necessarily character-for-character the same as the bound form of `${value}`, a rewrite would miss hits silently, so those still use `->>`.
      const contained = containmentOf(operandum, eqValue);
      if (contained) return contained;
      return sql`${left} = ${eqValue}`;
    }
    case "ne": {
      const r = range(value, why);
      if (r) return sql`(not (${left} >= ${r.from} and ${left} < ${r.to}))`;
      // `<> null` is always unknown in SQL, while the kernel's compare() is `left !== right`:
      // "remark ≠ 'x'" should, to a user, include rows that have no remark. is distinct from matches that intuition.
      return sql`${left} is distinct from ${requireValue(value, op, why)}`;
    }

    // A relative token or a day/month grain with a magnitude comparison is read as the **whole span**: "greater than this month" is after this month, not after the first of this month.
    // That is what makes lt and gte complements (without it, both conditions hit this month's rows).
    case "gt": {
      const r = range(value, why);
      return r ? sql`${left} >= ${r.to}` : sql`${left} > ${requireValue(value, op, why)}`;
    }
    case "gte": {
      const r = range(value, why);
      return r ? sql`${left} >= ${r.from}` : sql`${left} >= ${requireValue(value, op, why)}`;
    }
    case "lt": {
      const r = range(value, why);
      return r ? sql`${left} < ${r.from}` : sql`${left} < ${requireValue(value, op, why)}`;
    }
    case "lte": {
      const r = range(value, why);
      return r ? sql`${left} < ${r.to}` : sql`${left} <= ${requireValue(value, op, why)}`;
    }

    case "between": {
      if (!Array.isArray(value) || value.length !== 2) {
        fail(`${why}: comparator "between" must be an interval array of length exactly 2`);
      }
      const [lo, hi] = value as readonly unknown[];
      const loRange = range(lo, `${why}[0]`);
      const hiRange = range(hi, `${why}[1]`);
      // A number, money, or ISO instant is still a closed interval for a point comparison (the 500,000 document must be inside).
      // A day/month grain and a relative token are a half-open window: `col >= W(lo).from AND col < W(hi).to`.
      const lower = loRange ? sql`${left} >= ${loRange.from}` : sql`${left} >= ${requireValue(lo, op, `${why}[0]`)}`;
      const upper = hiRange ? sql`${left} < ${hiRange.to}` : sql`${left} <= ${requireValue(hi, op, `${why}[1]`)}`;
      return sql`(${lower} and ${upper})`;
    }

    case "in":
    case "not_in": {
      if (!Array.isArray(value)) fail(`${why}: comparator "${op}" must have an array value`);
      const values = value as readonly unknown[];
      // An empty set has a definite reading: in [] matches nobody, and not_in [] matches everybody.
      // (Contrast a condition group: either guess for an empty group silently changes the result set, so the kernel refuses it.)
      return op === "in" ? inArray(left, [...values]) : notInArray(left, [...values]);
    }
    case "contains":
      return ilike(operandum, String(requireValue(value, op, why)), why);
    case "not_contains":
      // NOT ILIKE of NULL is unknown, so an empty value does not hit "does not contain".
      return ilike(operandum, String(requireValue(value, op, why)), why, true);
  }
}

// ── condition tree ────────────────────────────────────────────────────────────────

/**
 * A line condition (`lines.orderId`) → an `exists` subquery.
 *
 * 🔴 It must be `exists` and not a join: a join would make an issue document that merged three lines of the same order
 * appear three times on the list, and `total` and paging would be wrong with it — while the repeated rows look like there really are three documents.
 * The row-count meaning of `exists` is exactly the same as without this condition; it only filters some out.
 *
 * The subquery carries the tenant condition too: the line table has `tenant_id`, and without it a line row from another tenant can
 * "pull" this tenant's header row into the result set (the tenant condition on the header layer cannot stop that).
 */
function compileLineExists(
  registry: ModuleRegistry,
  tables: ModuleTables,
  scope: FieldScope,
  path: LinePath,
  node: QueryCondition,
  timezone: string,
  why: string,
): SQL {
  const lineTable = tables.lines.get(path.table.key);
  if (!lineTable) fail(`${why}: line "${path.table.key}" of module "${tables.code}" has no line table`);
  const inner = lineScope(tables, path.table);
  const operandum = resolveOperandum(registry, inner, path.column.key, why);
  const test = compileComparison(operandum, node.op, node.value, timezone, why);

  const sub = new QueryBuilder()
    .select({ one: sql`1` })
    .from(lineTable as unknown as PgTable)
    .where(and(eq(lineTable.billId, scope.id), eq(lineTable.tenantId, scope.tenantId), test));
  return sql`exists (${sub})`;
}

function compileNode(
  registry: ModuleRegistry,
  tables: ModuleTables,
  scope: FieldScope,
  node: QueryNode,
  timezone: string,
  why: string,
): SQL {
  if (node.kind === "group") {
    if (!node.children.length) fail(`${why}: an empty condition group has no definite meaning`);
    const parts = node.children.map((child, i) =>
      compileNode(registry, tables, scope, child, timezone, `${why}.children[${i}]`),
    );
    const combined = node.join === "and" ? and(...parts) : or(...parts);
    if (!combined) fail(`${why}: a condition group compiled to an empty condition`);
    return combined;
  }
  // The path shape uses the same kernel criterion (`parseLinePath`), and this does not split the string again.
  const linePath = parseLinePath(tables.schema, node.field, why);
  if (linePath) return compileLineExists(registry, tables, scope, linePath, node, timezone, why);
  const operandum = resolveOperandum(registry, scope, node.field, why);
  if (isQueryFieldValue(node.value)) {
    assertQueryFieldComparison(tables.schema, node.field, node.op, node.value, why);
    assertComparator(operandum, node.op, why);
    const right = resolveOperandum(registry, scope, node.value.$field, why).expr;
    const left = operandum.expr;
    // Missing operands never trigger a notification, including inequality.
    switch (node.op) {
      case "eq": return sql`${left} = ${right}`;
      case "ne": return sql`${left} <> ${right}`;
      case "gt": return sql`${left} > ${right}`;
      case "gte": return sql`${left} >= ${right}`;
      case "lt": return sql`${left} < ${right}`;
      case "lte": return sql`${left} <= ${right}`;
      default: fail(`${why}: this comparison does not support choosing a field as the value`);
    }
  }
  return compileComparison(operandum, node.op, node.value, timezone, why);
}

/**
 * `search` → ILIKE on the columns declared in `views.list.searchable`.
 *
 * When not one character is declared searchable, **throw**, and do not degrade to "add no condition": that quietly drops what was typed in the search box,
 * and the user sees "searching for anything returns everything".
 */
function canReadQueryField(tables: ModuleTables, identity: Identity, field: string): boolean {
  if (isPlatformField(field)) return true;
  const dot = field.indexOf(".");
  const parent = dot > 0 ? field.slice(0, dot) : null;
  return (parent === null || identity.permissions.includes(fieldPermissionKey(tables.code, parent, "read"))) &&
    identity.permissions.includes(fieldPermissionKey(tables.code, field, "read"));
}

// ── reference candidate filter: land the condition the kernel already evaluated on this layer ────────────────────────────────
//
// 🔴 The criterion is not here. The criterion is the kernel's `resolveRefFilter` (a pure function), and the candidate side and the write side
// **share the same evaluation result**; this does only two chores: compile it to SQL (the candidate side must filter in the database),
// and compare it against a row already fetched (the write side already looked that row up by id, and another query just for the filter is not worth it).
//
// The two consumers must give the same answer, so the comparison meaning is written once (`refFilterValueMatches`).
// Writing it twice looks like the worst kind of bug: a record filtered out of the dropdown is saved by a hand-typed id and passes.

/**
 * Value-comparison meaning. **One copy**, two implementation shapes of the same criterion for the SQL side and the JS side.
 *
 * 🔴 A number must be compared as a number, not as a string: a PostgreSQL `numeric` comes out of postgres-js as
 * `"1.000000"`, while the declaration wrote `1`. `String(1) === "1.000000"` is false,
 * so a completely correct filter screens out every candidate, with no error —
 * "there are no candidates" and "this tenant really has not created any yet" look identical on the screen.
 */
function refFilterValueMatches(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (actual === null || actual === undefined) return false;
  if (typeof expected === "boolean") return actual === expected;
  if (typeof expected === "number") {
    const n = typeof actual === "number" ? actual : Number(actual);
    return Number.isFinite(n) && n === expected;
  }
  return String(actual) === String(expected);
}

/** Target columns that appear in the condition. The write side uses this to put them into the reference query it already has, with no extra round trip. */
export function refFilterColumnsOf(
  tables: ModuleTables,
  conditions: readonly RefFilterCondition[],
  what: string,
): Readonly<Record<string, PgColumn>> {
  const out: Record<string, PgColumn> = {};
  for (const condition of conditions) {
    const column = tables.columns[condition.field];
    if (!column) {
      // Reaching here means the loader's cross-module gate missed a cell. Throw, and do not skip silently:
      // skipping quietly cancels this filter, and "one filter is missing" has no outward symptom.
      fail(`${what}: module "${tables.code}" has no candidate filter column "${condition.field}" — the declaration gate should already have refused this`);
    }
    out[condition.field] = column;
  }
  return out;
}

/** Compile to a SQL condition (candidate side: filter it out in the database). */
export function compileRefFilter(
  tables: ModuleTables,
  conditions: readonly RefFilterCondition[],
  what: string,
): readonly SQL[] {
  const columns = refFilterColumnsOf(tables, conditions, what);
  const out: SQL[] = [];
  for (const condition of conditions) {
    if (condition.via !== undefined) {
      fail(`${what}: a line-closing condition was compiled to SQL before it was expanded — the upstream document id would be treated as the target id, and candidates would always be empty`);
    }
    const column = columns[condition.field] as PgColumn;
    // A single value also takes the inArray path: compiling the two shapes separately would be two places that must stay synonymous.
    const values = [...condition.values];
    if (values.length === 0) {
      // The upstream document has not one line: IN () is illegal in PostgreSQL, and false is what "no candidates" means.
      out.push(sql`false`);
      continue;
    }
    if (values.length === 1 && values[0] === null) {
      out.push(sql`${column} is null`);
      continue;
    }
    out.push(inArray(column, values as (string | number | boolean)[]));
  }
  return out;
}

/** Compare against a row already fetched (write side: that row was just looked up by id, and no extra query is sent for the filter). */
export function refFilterMatches(
  row: Readonly<Record<string, unknown>>,
  conditions: readonly RefFilterCondition[],
): boolean {
  return failedRefFilterConditions(row, conditions).length === 0;
}

/**
 * Which candidate conditions this row failed. The same comparison as `refFilterMatches`,
 * and the refusal copy reports only these — also reciting a `status ∈ active` that already holds sends the person to
 * a button such as "enable again" that will not change anything when pressed.
 */
export function failedRefFilterConditions(
  row: Readonly<Record<string, unknown>>,
  conditions: readonly RefFilterCondition[],
): readonly RefFilterCondition[] {
  return conditions.filter((condition) => {
    if (condition.via !== undefined) {
      fail(`a line-closing condition was compared in JS before it was expanded — the upstream document id would be treated as the target id`);
    }
    return !condition.values.some((expected) => refFilterValueMatches(row[condition.field], expected));
  });
}

/**
 * Which "term × searchable column" pairs each get an or branch.
 *
 * This is a pure function so the **criterion can be pinned**: a wrongly assembled branch does not error, it **searches fewer terms** —
 * and an empty result from searching less looks identical to "there really are none". Measured: dropping `terms[1..]`
 * turned no test in the whole warehouse red.
 *
 * With one term the output is word-for-word what it was (one branch per column).
 */
export function searchBranches(
  terms: readonly string[],
  searchable: readonly string[],
): readonly { readonly term: string; readonly key: string }[] {
  return terms.flatMap((term) => searchable.map((key) => ({ term, key })));
}

export function compileSearch(
  registry: ModuleRegistry,
  tables: ModuleTables,
  scope: FieldScope,
  identity: Identity,
  terms: readonly string[],
): SQL {
  const searchable = tables.schema.views.list.searchable.filter((field) => canReadQueryField(tables, identity, field));
  if (!searchable.length) {
    fail(`module "${tables.code}" does not declare views.list.searchable, so a search term cannot be handled — the search is not ignored silently`);
  }
  const parts = searchBranches(terms, searchable).map((branch) =>
    ilike(resolveOperandum(registry, scope, branch.key, `${tables.code}.views.list.searchable`), branch.term, "search"),
  );
  const combined = or(...parts);
  if (!combined) fail(`the search condition of module "${tables.code}" compiled to an empty condition`);
  return combined;
}

/**
 * Whole-sentence search of a reference dropdown: after splitting on whitespace, terms are AND and fields are OR.
 *
 * For example "classic 22 button close (all-steel) 2.12.03002301 all-steel" hits
 * `name`, `familyCode`, and `spec` separately, rather than requiring one field to contain the whole sentence.
 * An ordinary list search keeps the OR meaning of `compileSearch`, so existing query behavior does not change.
 */
export function searchPhraseTerms(keyword: string): readonly string[] {
  return keyword.trim().split(/\s+/u).filter((term) => term !== "");
}

export function compileSearchPhrase(
  registry: ModuleRegistry,
  tables: ModuleTables,
  scope: FieldScope,
  identity: Identity,
  keyword: string,
): SQL {
  const terms = searchPhraseTerms(keyword);
  if (!terms.length) fail(`the whole-sentence search of module "${tables.code}" has no usable search term`);

  const searchable = tables.schema.views.list.searchable.filter((field) => canReadQueryField(tables, identity, field));
  if (!searchable.length) {
    fail(`module "${tables.code}" does not declare views.list.searchable, so a search term cannot be handled — the search is not ignored silently`);
  }

  const termConditions = terms.map((term) => {
    const branches = searchBranches([term], searchable).map((branch) =>
      ilike(resolveOperandum(registry, scope, branch.key, `${tables.code}.views.list.searchable`), branch.term, "search"),
    );
    const combined = or(...branches);
    if (!combined) fail(`search term "${term}" of module "${tables.code}" compiled to an empty condition`);
    return combined;
  });
  const combined = and(...termConditions);
  if (!combined) fail(`the whole-sentence search condition of module "${tables.code}" compiled to an empty condition`);
  return combined;
}

// ── exit ──────────────────────────────────────────────────────────────────

export interface CompiledQuery {
  /** 🔴 It always contains the tenant condition: it is assembled by scopedWhere, and no path can obtain a where without the tenant. */
  readonly where: SQL;
  readonly orderBy: readonly SQL[];
  readonly limit: number;
  readonly offset: number;
}

/**
 * What compiling a query needs to know that is not part of the query itself.
 *
 * For now only the time zone. 🔴 **No default**: `?? "UTC"` or falling back to the server `TZ`
 * would make a condition such as "this month" quietly return a different batch after the deployment environment changes — and the query would look completely normal.
 */
export interface CompileOptions {
  /** IANA time zone name, such as `Asia/Shanghai`. A relative time (last 7 days / this month) is folded by this. */
  readonly timezone: string;
  /**
   * Reference candidate filter (already evaluated by the kernel `resolveRefFilter`).
   *
   * 🔴 It **intersects** the user condition, and does not replace it: in the picker the user can still filter and search on their own,
   * and those can only make the result emptier. This dimension does not accept a raw condition from the body —
   * the caller receives the copy the server evaluated by reading the declaration at the coordinate (`resolveRefCandidate`).
   */
  readonly refFilter?: readonly RefFilterCondition[];
}

type QueryScope = "actor" | "tenantInvariant";

/**
 * Compile one query.
 *
 * 🔴 `query` must already have passed `normalizeQuery(schema, raw)`. That step guarantees the structure and the fields are legal,
 * and this step guarantees a name can land only on an allow-listed column, and a value can only be bound as a parameter.
 */
function compileQueryInScope(
  registry: ModuleRegistry,
  tables: ModuleTables,
  identity: Identity,
  query: Query,
  options: CompileOptions,
  queryScope: QueryScope,
): CompiledQuery {
  const scope = headerScope(tables);
  const { timezone } = options;
  if (!timezone.trim()) fail(`${tables.code}: compiling the query is missing a time zone — a relative time has no definite interval without one`);

  const extra: SQL[] = [];
  if (query.where) extra.push(compileNode(registry, tables, scope, query.where, timezone, `${tables.code}.where`));
  const terms = searchTerms(query.search);
  if (terms.length > 0) {
    extra.push(compileSearch(registry, tables, scope, identity, terms));
  }
  // Reference candidate filter: the picker (`ReferencePicker`) takes the list path, so it must be able to accept
  // the same condition — otherwise "the dropdown filtered it, and 'more…' is the full set again", which is worse than no filter:
  // the user believes that is the complete candidate set, then picks one from it that cannot be saved.
  if (options.refFilter?.length) {
    extra.push(...compileRefFilter(tables, options.refFilter, `${tables.code} candidate filter`));
  }

  // 🔴 A user condition can only **intersect** the tenant plus the row-level scope. Even if the condition tree contains `tenantId = someone else`,
  // the result can only get emptier, and it can never see another tenant's rows or someone else's rows.
  const where = queryScope === "tenantInvariant"
    ? scopedWhere(tables.header, requireIdentity(identity), ...extra)
    : moduleScopedWhere(tables, identity, timezone, ...extra);

  const defaultSort = tables.schema.views.list.defaultSort;
  const declared = defaultSort && canReadQueryField(tables, identity, defaultSort.field) ? defaultSort : null;
  const sorts = query.sort.length ? query.sort : declared ? [declared] : [];
  const orderBy = sorts.map((s) => {
    const operandum = resolveOperandum(registry, scope, s.field, `${tables.code}.sort`);
    return s.desc ? desc(operandum.expr) : asc(operandum.expr);
  });
  /**
   * 🔴 **When the primary sort is a tie, break it by created-at descending.**
   *
   * The product catalog default is already `createdAt` descending. When the user clicks a business-day column, or the query sorts by a field that only goes to the **day**
   * (`orderDate` / `issueDate` / `purchaseDate` / `planDate`…),
   * documents created on the same day are **all tied**, and after the tie only the `id` below remains — a UUID, which is random.
   * What shows is "the document just created is not on the first row", more obvious the more documents are created in one day, and each refresh
   * shows a different order.
   *
   * This is not "sort was not configured"; it is **a tie with no fallback**: `orderDate desc` itself can be this query's grain,
   * and what must be fixed is what to sort by when it cannot decide. Breaking the tie by `createdAt` descending lets a new record float up steadily.
   *
   * Do not add it again when the caller already sorted by `createdAt`; still append `id` last:
   * an order by without a total order, paired with limit/offset, repeats or drops rows on paging, and cannot be reproduced.
   */
  const createdAt = tables.columns["createdAt"];
  if (
    createdAt !== undefined &&
    !sorts.some((s) => s.field === "createdAt") &&
    canReadQueryField(tables, identity, "createdAt")
  ) {
    orderBy.push(desc(createdAt));
  }
  orderBy.push(asc(tables.header.id));

  return { where, orderBy, limit: query.limit, offset: query.offset };
}

/**
 * Compile an ordinary query. The returned row set is always constrained by the actor data scope.
 */
export function compileQuery(
  registry: ModuleRegistry,
  tables: ModuleTables,
  identity: Identity,
  query: Query,
  options: CompileOptions,
): CompiledQuery {
  return compileQueryInScope(registry, tables, identity, query, options, "actor");
}

/**
 * Compile the condition of a system-invariant summary.
 *
 * 🔴 This is a deliberately separately named narrow exit: only a repository method that returns a count plus a single aggregate may consume it,
 * and it cannot feed a list, a line, analysis, or any rows/id return surface. It still enforces the tenant boundary, and only removes the actor data scope.
 */
export function compileInvariantSummaryQuery(
  registry: ModuleRegistry,
  tables: ModuleTables,
  identity: Identity,
  query: Query,
  options: CompileOptions,
): CompiledQuery {
  return compileQueryInScope(registry, tables, identity, query, options, "tenantInvariant");
}

/**
 * An aggregate item → a SQL expression.
 *
 * 🔴 **The same WHERE as the body, the same round trip** (the caller hangs it on the count query). Computing it in a second request
 * lets the data change between the two, and the footer total no longer matches the rows in the table — and that inconsistency has no error.
 *
 * A derived column (rollup / lookup / formula) can be aggregated just the same: `resolveOperandum` has already compiled it into
 * a scalar expression, and wrapping `sum()` around it is enough. That is not a coincidence — it takes the same path as sort and filter,
 * so "can sort by it" and "can sum it" always come and go together.
 */
/**
 * The complete scope of one module-table read: tenant × row-level data permission.
 *
 * 🔴 **Every read of a module table must go through here**, and must not use `scopedWhere` directly.
 * The latter binds only the tenant — that is the first layer of isolation; the module read/lookup data scope the Authorizer resolved
 * is the second layer, and writing the two layers apart means some read path will carry only the first, and the missing layer
 * shows in the result as "more data than someone else", with no error.
 *
 * A scope predicate reuses `compileComparison` (IN / contains / between / empty…), and does not write another SQL DSL.
 *
 * No such module in the authorization snapshot ⇒ fail-closed, zero rows. Any module-table read must be granted read/lookup + scope explicitly,
 * so a new module does not inherit an old role's wide permission.
 */
export function moduleScopedWhere(
  tables: ModuleTables,
  identity: Identity | null | undefined,
  timezone: string,
  ...extra: (SQL | undefined)[]
): SQL {
  // 🔴 Take the identity before computing the row-level scope: the other way around, a null identity first throws a TypeError on `identity.roles`,
  // while the caller is waiting for IdentityMissingError —
  // "there is no identity" must be thrown in one shape, or the 401 branch above cannot catch it.
  if (!timezone.trim()) {
    fail(`${tables.code}: compiling the query is missing a time zone — a relative time has no definite interval without one`);
  }
  const who = requireIdentity(identity);
  return scopedWhere(tables.header, who, rowScopeOf(tables, who, timezone), ...extra);
}

function headerTypeOf(tables: ModuleTables, field: string): FieldType {
  const platform = HEADER_PLATFORM_TYPES[field];
  if (platform) return platform;
  const def = tables.schema.fields.find((item) => item.key === field);
  if (!def || def.type === "subtable") {
    fail(`${tables.code}: data-scope predicate field "${field}" is not a real header column of the current module`);
  }
  return def.type;
}

function compileScopePredicate(
  tables: ModuleTables,
  field: string,
  op: QueryComparator,
  column: PgColumn,
  values: readonly ScopeValue[],
  timezone: string,
): SQL {
  const type = headerTypeOf(tables, field);
  const comparisonValue =
    op === "is_empty" || op === "not_empty"
      ? null
      : op === "between" || op === "in" || op === "not_in"
        ? [...values]
        : values[0];
  return compileComparison(
    { expr: sql`${column}`, column, type, label: `${tables.code}.${field}` },
    op,
    comparisonValue,
    timezone,
    `${tables.code}.${field}`,
  );
}

function assertRowScopeValues(
  tables: ModuleTables,
  field: string,
  op: string,
  values: readonly ScopeValue[],
): void {
  if (op === "in" || op === "not_in") {
    if (values.some((value) => typeof value !== "string" || !value.trim())) {
      fail(`${tables.code}.${field}：a data-scope predicate accepts only a non-empty string value`);
    }
    return;
  }
  for (const value of values) {
    if (isRelativeDateValue(value)) {
      if (op !== "eq") {
        fail(`${tables.code}.${field}: a relative time cannot be paired with "${op}" — for a whole period use op=eq plus a single relative token`);
      }
      continue;
    }
    if (typeof value !== "string" || !value.trim()) {
      fail(`${tables.code}.${field}：a data-scope predicate accepts only a non-empty string value`);
    }
  }
}

function rowScopeOf(tables: ModuleTables, identity: Identity, timezone: string): SQL | undefined {
  const scope = identity.dataScopes[tables.code];
  if (!scope) return sql`false`;
  // The server layer resolves a business name such as "the teams I manage" into a column plus a value; storage
  // only honors a closed OR-of-IN shape. This does not know teams, warehouses, or orders, and it does not allow raw SQL.
  const policies = [...scope.policies];
  if (policies.length === 0 || policies.some((policy) => !(DATA_SCOPE_POLICIES as readonly string[]).includes(policy))) {
    fail(`${tables.code}: the authorization snapshot contains an empty or unknown data-scope policy; refusing to run the query`);
  }
  if (policies.includes("all")) {
    if (policies.length !== 1 || scope.predicates.length !== 0 || (scope.groups?.length ?? 0) !== 0) {
      fail(`${tables.code}: an all scope must be in canonical form (all only, and no predicates)`);
    }
    return undefined;
  }

  const groups = scope.groups ?? scope.predicates.map((predicate) => [predicate]);
  const compiled: SQL[] = [];
  for (const group of groups) {
    const parts: SQL[] = [];
    let empty = false;
    for (const predicate of group) {
      if (!predicate.field.trim()) fail(`${tables.code}：a data-scope predicate is missing a field`);
      const column = tables.columns[predicate.field];
      if (!column) {
        fail(`${tables.code}: data-scope predicate field "${predicate.field}" is not a real header column of the current module`);
      }
      const op = predicate.op;
      if (op !== undefined && !isScopeBindingOp(op)) {
        if (op === "is_empty" || op === "not_empty") {
          parts.push(compileScopePredicate(tables, predicate.field, op, column, [], timezone));
          continue;
        }
        if (!Array.isArray(predicate.values)) {
          fail(`${tables.code}.${predicate.field}：a data-scope predicate accepts only a non-empty string value`);
        }
        if (predicate.values.length === 0) {
          empty = true;
          break;
        }
        assertRowScopeValues(tables, predicate.field, op, predicate.values);
        parts.push(compileScopePredicate(tables, predicate.field, op, column, predicate.values, timezone));
        continue;
      }
      if (!Array.isArray(predicate.values) || predicate.values.some((value) => typeof value !== "string" || !value.trim())) {
        fail(`${tables.code}.${predicate.field}：a data-scope predicate accepts only a non-empty string value`);
      }
      if (predicate.values.length === 0) {
        empty = true;
        break;
      }
      parts.push(inArray(column, [...predicate.values] as string[]));
    }
    if (empty || parts.length === 0) continue;
    compiled.push(parts.length === 1 ? parts[0]! : and(...parts)!);
  }
  return compiled.length === 0 ? sql`false` : compiled.length === 1 ? compiled[0] : or(...compiled);
}

export function compileAggregates(
  registry: ModuleRegistry,
  tables: ModuleTables,
  specs: readonly SummarySpec[],
): Record<string, SQL> {
  const out: Record<string, SQL> = {};
  const scope = headerScope(tables);
  for (const spec of specs) {
    const operandum = resolveOperandum(registry, scope, spec.field, `${tables.code}.aggregates`);
    if (!isSummarizableType(operandum.type)) {
      // The kernel's normalizeAggregates should have stopped it. Reaching here means someone bypassed that step.
      fail(`${tables.code}.aggregates: "${operandum.label}" is type ${operandum.type} and cannot be aggregated`);
    }
    const value = operandum.expr;
    out[summaryKey(spec)] =
      spec.fn === "sum"
        ? sql`sum(${value})`
        : spec.fn === "count"
          ? sql`count(${value})`
          : spec.fn === "avg"
            ? sql`avg(${value})`
            : spec.fn === "max"
              ? sql`max(${value})`
              : sql`min(${value})`;
  }
  return out;
}

/**
 * The projection of one layer of rows: platform columns + declared fields that have a column + expressions of derived fields.
 *
 * A derived field has no column, and its value can only be computed at query time — not projecting it leaves the screen a cell that is forever blank
 * and has no error (`customerName` / `shippedQty` are both in views.list.columns).
 * What cannot be compiled (a rollup pointing at a non-module, and so on) throws here: letting a module declare a value it cannot produce
 * leaves the screen a cell that is forever blank and never errors.
 */
export function projection(
  registry: ModuleRegistry,
  scope: FieldScope,
  options: { readonly skipKeys?: readonly string[] } = {},
): Record<string, PgColumn | SQL> {
  const skip = new Set(options.skipKeys ?? []);
  const out: Record<string, PgColumn | SQL> = {};

  for (const key of Object.keys(scope.platform)) {
    if (skip.has(key)) continue;
    const column = scope.columns[key];
    if (column) out[key] = column;
  }
  for (const field of scope.fields) {
    if (skip.has(field.key) || field.type === "subtable") continue;
    const operandum = resolveOperandum(registry, scope, field.key, `${scope.what} projection`);
    out[field.key] = operandum.column ?? operandum.expr;
  }
  return out;
}
