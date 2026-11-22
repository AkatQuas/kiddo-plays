// ---------------------------------------------------------------------------
// Read-only analysis SQL gate — parse plus a catalog allow-list; it does not execute
//
// The compiler must be safe by itself: even if an upstream (the Agent schema) already blocked it, this gate judges again.
// Parameters are accepted only as $n bindings; a model that splices a runtime value into the SQL text is always rejected.
// ---------------------------------------------------------------------------

import type { AnalysisCatalog, AnalysisJoin, AnalysisRelation } from "../derive/analysisCatalog.js";
import { analysisJoinExampleFromCatalog } from "../derive/analysisExample.js";

export const ANALYSIS_SQL_MAX_ROWS = 20;
export const ANALYSIS_SQL_MAX_PARAMS = 32;
export const ANALYSIS_SQL_USE_BILL_LIST = "ANALYSIS_SQL_USE_BILL_LIST";

export interface AnalysisSqlIssue {
  readonly code: string;
  readonly path: string;
  readonly expected: string;
  readonly correction: string;
  readonly example: string;
  /**
   * Legal values of this dimension (table names / column names).
   *
   * `expected` already writes the candidates into a sentence, but that sentence is for a person to read; a program cannot read it back,
   * so the caller would have to guess again. Once they are structured, the caller can compare directly and can compute the nearest candidate.
   */
  readonly valid?: readonly string[];
}

export class AnalysisSqlError extends Error {
  override readonly name = "AnalysisSqlError";
  constructor(
    message: string,
    readonly issues: readonly AnalysisSqlIssue[],
  ) {
    super(message);
  }
}

export interface ValidatedAnalysisSql {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly relations: readonly string[];
  readonly aliases: Readonly<Record<string, string>>;
}

export type AnalysisSqlCheck =
  | { readonly ok: true; readonly value: ValidatedAnalysisSql }
  | { readonly ok: false; readonly issues: readonly AnalysisSqlIssue[] };

const FORBIDDEN_HEAD = /^(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|copy|vacuum|analyze|comment|set|begin|commit|rollback|savepoint|lock|call|do|execute|prepare|deallocate|listen|notify|load|cluster|refresh|explain|declare|fetch|move|discard|reindex|security|reset)\b/i;

const FORBIDDEN_FUNC = new Set([
  "pg_sleep",
  "pg_read_file",
  "pg_write_file",
  "pg_ls_dir",
  "pg_read_binary_file",
  "dblink",
  "dblink_exec",
  "dblink_connect",
  "lo_import",
  "lo_export",
  "lo_unlink",
  "lo_put",
  "lo_get",
  "lo_creat",
  "lo_create",
  "set_config",
  "current_setting",
  "pg_reload_conf",
  "pg_rotate_logfile",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "pg_advisory_lock",
  "pg_advisory_xact_lock",
  "nextval",
  "setval",
  "currval",
  "lastval",
]);

const ALLOWED_FUNC = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "stddev",
  "variance",
  "abs",
  "round",
  "ceil",
  "ceiling",
  "floor",
  "trunc",
  "mod",
  "power",
  "sqrt",
  "sign",
  "greatest",
  "least",
  "nullif",
  "coalesce",
  "lower",
  "upper",
  "trim",
  "btrim",
  "ltrim",
  "rtrim",
  "length",
  "char_length",
  "substring",
  "concat",
  "date_trunc",
  "date_part",
  "extract",
  "age",
  "now",
  "current_date",
  "current_timestamp",
  "cast",
  "to_char",
  "to_date",
  "to_timestamp",
  "date",
]);

function issue(
  code: string,
  path: string,
  expected: string,
  correction: string,
  example: string,
  valid?: readonly string[],
): AnalysisSqlIssue {
  return { code, path, expected, correction, example, ...(valid?.length ? { valid } : {}) };
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function splitStatements(sql: string): readonly string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      current += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function unquoteIdent(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed.toLowerCase();
}

interface TableRef {
  readonly name: string;
  readonly alias: string;
}

function extractCteNames(sql: string): ReadonlySet<string> {
  const names = new Set<string>();
  // A `\b` must not be required before `,`: the second part of a multi-CTE looks like `…FROM t), task AS (`,
  // and the character before the comma is `)`. `)` and `,` are both non-word characters, so there is no word boundary, `\b` does not hold,
  // the second CTE is never captured, and it is then rejected as an "undeclared table".
  //
  // Observed: the model wrote `WITH issue AS (…), task AS (…)`, got back
  // ANALYSIS_SQL_RELATION_UNKNOWN on `task`, renamed it and was rejected again — two wasted rounds,
  // while the SQL it wrote was correct from start to finish.
  for (const match of sql.matchAll(
    /(?:\bwith\b|,)\s+(?:recursive\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*(?:\([^)]*\))?\s+as\s*\(/gi,
  )) {
    const name = unquoteIdent(match[1] ?? match[2] ?? "");
    if (name) names.add(name);
  }
  return names;
}

function hasSelectStar(sql: string): boolean {
  if (/\bselect\s+(?:distinct\s+)?\*/i.test(sql)) return true;
  return /\.\s*\*/.test(sql);
}

function extractSelectColumns(sql: string): readonly string[] {
  const match = sql.match(/\bselect\s+(?:distinct\s+)?([\s\S]+?)\s+from\b/i);
  if (!match) return [];
  return match[1]!
    .split(",")
    .map((part) => {
      const trimmed = part.trim().replace(/\s+as\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)$/i, "").trim();
      const ident = trimmed.includes(".") ? trimmed.slice(trimmed.lastIndexOf(".") + 1) : trimmed;
      return unquoteIdent(ident);
    })
    .filter((name) => name && name !== "*");
}

function inferListingRewrite(
  catalog: AnalysisCatalog,
  sql: string,
): {
  readonly use: "bill_list";
  readonly rewriteExample: { readonly module: string; readonly fields: readonly string[]; readonly query: Readonly<Record<string, unknown>> };
  readonly note?: string;
} {
  const tables = extractTables(sql);
  const relation = tables
    .map((table) => catalog.relations.find((item) => item.name === table.name))
    .find((item): item is AnalysisRelation => item !== undefined);
  if (relation === undefined) {
    throw new AnalysisSqlError("analysis_sql listing rewrite: tables in the SQL do not match an analysis-catalog relation; refusing to guess a module", [
      issue(
        "ANALYSIS_SQL_RELATION_UNKNOWN",
        "sql",
        "FROM/JOIN tables must be in the analysis catalog",
        "rewrite the SQL to cite only catalog relations, or switch to bill_list",
        "",
      ),
    ]);
  }
  const module = relation.module;
  // `bill_list` projects **header** columns only. Line columns (lines.*) are structurally unavailable —
  // so candidate columns must be looked up on the header relation, not filled in from the SQL's first table (often a line table).
  //
  // Observed in production: the SQL was `FROM oe_material_issue_lines l JOIN oe_material_issue h`,
  // the first table was the lines, and the example was written fields:["warehouseId","lineNo","productId","baseQty","unit"].
  // The model copied it → QUERY_FIELD_UNKNOWN; it added a lines. prefix and copied again → "no projectable column".
  // Both failures followed the directions we gave.
  const header = catalog.relations.find(
    (item) => item.module === module && item.grain === "header",
  ) ?? relation;
  const linePrefix = relation.grain === "line" && relation.through ? `${relation.through}.` : "";
  const columns = extractSelectColumns(sql);
  // Keep only columns that **really land on this module**.
  //
  // This used to be `?? column`: a miss stuffed the original column name into rewriteExample. Under multi-table SQL
  // those columns belong to other tables, so the rewrite suggestion invented fields this module does not have — observed in production,
  // `base_required_qty` from a production-task material line was written as a materialIssue field.
  // A teaching error that teaches the wrong thing is worse than saying only "no": the caller will follow it and fail once more.
  const fields = columns
    .map((column) => header.fields.find((field) => field.column === column || field.key === column)?.key)
    .filter((key): key is string => key !== undefined && key !== "id" && key !== "tenantId");
  // When line columns were named and not a single header column was hit, handing back only fields sends the caller down a dead end:
  // bill_list can never return those columns, so say where to get them.
  const droppedLineColumns =
    linePrefix !== "" &&
    columns.some((column) => relation.fields.some((f) => f.column === column || f.key === column)) &&
    columns.some((column) => !header.fields.some((f) => f.column === column || f.key === column));
  const inMatch = sql.match(/\bwhere\s+(?:(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s+in\s*\(/i);
  const inColumn = inMatch ? unquoteIdent(inMatch[1] ?? inMatch[2] ?? "") : "";
  // A filter may land on a line (bill_list supports the `lines.x` rule), but it must carry the through prefix.
  const onLine = inColumn !== "" && !header.fields.some((f) => f.column === inColumn || f.key === inColumn);
  const inField = inColumn
    ? (relation.fields.find((field) => field.column === inColumn || field.key === inColumn)?.key ?? "")
    : "";
  const query = inField
    ? { where: { kind: "cond", field: `${onLine ? linePrefix : ""}${inField}`, op: "in", value: ["…"] } }
    : {};
  const fallback = header.fields
    .filter((f) => !f.scope && f.key !== "id" && f.key !== "tenantId")
    .slice(0, 2)
    .map((f) => f.key);
  return {
    use: "bill_list",
    rewriteExample: {
      module,
      fields: fields.length > 0 ? fields : fallback.length > 0 ? fallback : ["code"],
      query,
    },
    ...(droppedLineColumns
      ? {
          note:
            "The columns you named are on line rows, and bill_list only returns header columns — they have already been removed from fields above." +
            "Use this to find which bills, then get the lines of the bills you need;" +
            "if you want a conclusion and not every row, finish it in the database with compare / agg.",
        }
      : {}),
  };
}

function listingIssue(catalog: AnalysisCatalog, sql: string): AnalysisSqlIssue {
  const rewrite = inferListingRewrite(catalog, sql);
  return issue(
    ANALYSIS_SQL_USE_BILL_LIST,
    "sql",
    "Use bill_list for a column profile, raw values of a few columns, or a check. Do not use analysis_sql to dump unreduced rows",
    `Switch to bill_list: { use: "bill_list", rewriteExample: ${JSON.stringify(rewrite.rewriteExample)} }. ` +
      (rewrite.note ? `${rewrite.note}` : "Do not split an unreduced analysis_sql into batches."),
    JSON.stringify(rewrite),
  );
}

/**
 * Whether this SQL is **reduced** — it is not dumping raw rows.
 *
 * Three tiers all count: `GROUP BY`, an aggregate function, and `SELECT DISTINCT`.
 *
 * The `DISTINCT` tier was added later. `SELECT DISTINCT x FROM t` and
 * `SELECT x FROM t GROUP BY x` are the same thing and the same result, only written differently; judging the first as
 * "dumping unreduced rows" rejects by spelling rather than by meaning. Observed in production: the model followed this repo's skill
 * to ask "which people have reported work" and wrote `SELECT DISTINCT worker_id … LIMIT 20`,
 * this gate rejected it, and the rewrite it offered, `bill_list(processReport, fields:["workerId"])`,
 * **does not dedupe at all** — it cannot answer the question the model asked, so that round was wasted.
 *
 * Like `GROUP BY`, `DISTINCT` only guarantees dedupe, not that the result is small
 * (`SELECT DISTINCT a,b,c,d,e` can shrink almost as little as `GROUP BY a,b,c,d,e`).
 * This gate stops "dumping every row with nothing reduced". The two spellings agree on that point, and DISTINCT
 * does not get a stricter standard of its own. The row cap is `LIMIT` and `ANALYSIS_SQL_MAX_ROWS`, not this gate.
 */
function isReduced(sql: string): boolean {
  if (/\bgroup\s+by\b/i.test(sql)) return true;
  // Both `SELECT DISTINCT` and `SELECT DISTINCT ON (…)` count.
  if (/\bselect\s+distinct\b/i.test(sql)) return true;
  if (comparesAcrossRelations(sql)) return true;
  return extractFunctions(sql).some((name) =>
    ["count", "sum", "avg", "min", "max", "stddev", "variance"].includes(name),
  );
}

/** Inequality operators inside WHERE / HAVING — `=` is not included; see `comparesAcrossRelations`. */
const INEQUALITY = /(?:>=|<=|<>|!=|>|<)/;

/**
 * Whether this SQL is **comparing magnitudes across tables** (`a.x > b.y`).
 *
 * The fourth tier, and it was found by stepping on it. The first three (GROUP BY / DISTINCT / aggregate) all ask "did the result row count shrink",
 * while this kind of reduction happens in the **predicate**: two tables are joined and filtered by "this bill's quantity > that bill's quantity".
 *
 * Observed in production: "which material issues drew more than the task required". The model wrote
 *
 *   SELECT … FROM oe_material_issue_lines mil
 *   INNER JOIN oe_production_task_material_lines tml ON mil.task_line_id = tml.id
 *   WHERE mil.base_qty > tml.base_required_qty LIMIT 20
 *
 * No GROUP BY and no aggregate, so it was judged "dumping unreduced rows", and the first redirect pointed at `bill_list`.
 * But **`bill_list` cannot express this predicate at all** — it can only compare one module's field with a constant,
 * it cannot reach the task material line, and it has no "field vs field". The rewriteExample even wrote
 * `base_required_qty` as a materialIssue field (that column lives on the production-task material line).
 *
 * Result: the model wrote correct SQL twice, was rejected twice, and fell back to fetching row by row and comparing in its own head —
 * 13 tool calls / 76 seconds, while this SQL answers in 0.1 seconds. Pointing at a capability that cannot do it is worse than not pointing.
 *
 * The rule uses the **inequality**, not "is there a JOIN":
 * - `WHERE a.qty > b.qty` → allow. That is why the `joins` in the analysis contract exist.
 * - `WHERE a.id = b.order_id` → do not allow. That is a join condition written in WHERE,
 *   and the query itself is still "stitch two tables together and dump them", which `bill_list` refLabels can cover.
 *
 * How wide the opening is: still bound by `LIMIT 1..20` and `ANALYSIS_SQL_MAX_ROWS`, at most 20 rows.
 */
function comparesAcrossRelations(sql: string): boolean {
  const tail = sql.match(/\b(?:where|having)\b([\s\S]+)$/i)?.[1];
  if (tail === undefined) return false;
  // Look only at the predicate; a cross-table comparison in ON is a join key, not a filter, so start from WHERE/HAVING.
  const scope = tail.replace(/\b(?:order\s+by|limit|offset|fetch)\b[\s\S]*$/i, "");
  return scope
    .split(/\b(?:and|or)\b/i)
    .some((predicate) => {
      if (!INEQUALITY.test(predicate)) return false;
      const aliases = new Set(
        [...predicate.matchAll(/(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)/g)]
          .map((match) => unquoteIdent(match[1] ?? match[2] ?? "")),
      );
      // Two different table qualifiers in the same predicate means "a column of this table" is compared with "a column of that table".
      return aliases.size >= 2;
    });
}

/**
 * Keywords that may legally follow a table name but are **not an alias**.
 *
 * The alias group is optional, and the regex will happily swallow the next keyword:
 * in `FROM oe_supplier_quote WHERE status = $1`, `WHERE` was taken as the alias `where`,
 * so injecting the tenant condition produced `"where".tenant_id = $1` — a PostgreSQL syntax error, 500.
 * A single-table query with no alias is the most common spelling, so this is hit often (observed: the quote comparison blew up every time).
 *
 * Block only the **unquoted** branch: `FROM t AS "where"` is a legal explicit alias and must not be rejected here.
 */
const NON_ALIAS_KEYWORDS: ReadonlySet<string> = new Set([
  "where", "group", "order", "limit", "offset", "having", "window", "union", "intersect", "except",
  "join", "inner", "left", "right", "full", "cross", "natural", "on", "using", "fetch", "for", "returning",
]);

function extractTables(sql: string): readonly TableRef[] {
  const refs: TableRef[] = [];
  const pattern =
    /\b(?:from|join)\s+(?:only\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))(?:\s*\.\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*)))?(?:\s+(?:as\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*)))?/gi;
  for (const match of sql.matchAll(pattern)) {
    const schemaOrTable = match[1] ?? match[2];
    const table = match[3] ?? match[4];
    // A quoted alias (match[5]) is accepted as-is; a bare word (match[6]) must first exclude keywords, see NON_ALIAS_KEYWORDS.
    const bare = match[6];
    const alias = match[5] ?? (bare !== undefined && NON_ALIAS_KEYWORDS.has(bare.toLowerCase()) ? undefined : bare);
    const name = unquoteIdent(table ?? schemaOrTable ?? "");
    if (!name || /^(select|lateral|unnest)$/i.test(name)) continue;
    if (table && schemaOrTable && !/^(public)$/i.test(unquoteIdent(schemaOrTable))) {
      refs.push({ name: `${unquoteIdent(schemaOrTable)}.${name}`, alias: unquoteIdent(alias ?? name) });
      continue;
    }
    refs.push({ name, alias: unquoteIdent(alias ?? name) });
  }
  return refs;
}

function extractFunctions(sql: string): readonly string[] {
  const names: string[] = [];
  for (const match of sql.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const name = match[1]!.toLowerCase();
    if (name === "as" || name === "on" || name === "and" || name === "or" || name === "in" || name === "not") continue;
    names.push(name);
  }
  return names;
}

function extractParams(sql: string): readonly number[] {
  const found = new Set<number>();
  for (const match of sql.matchAll(/\$(\d+)/g)) {
    found.add(Number(match[1]));
  }
  return [...found].sort((left, right) => left - right);
}

function extractQualifiedColumns(sql: string): readonly { readonly alias: string; readonly column: string }[] {
  const cols: { alias: string; column: string }[] = [];
  const pattern = /(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*\.\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_*]*))/g;
  for (const match of sql.matchAll(pattern)) {
    const alias = unquoteIdent(match[1] ?? match[2] ?? "");
    const column = unquoteIdent(match[3] ?? match[4] ?? "");
    if (!alias || !column) continue;
    if (/^(extract)$/i.test(alias)) continue;
    cols.push({ alias, column });
  }
  return cols;
}

function hasKeyword(sql: string, keyword: RegExp): boolean {
  return keyword.test(sql);
}

function findJoinPairs(sql: string, aliases: Readonly<Record<string, string>>): readonly { readonly left: string; readonly right: string }[] {
  const pairs: { left: string; right: string }[] = [];
  const joinPattern = /\bjoin\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))(?:\s+(?:as\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*)))?\s+on\s+([^]+?)(?=\b(?:inner|left|right|full|cross|join|where|group|having|order|limit|offset|union|except|intersect|$))/gi;
  for (const match of sql.matchAll(joinPattern)) {
    const rightName = unquoteIdent(match[3] ?? match[4] ?? match[1] ?? match[2] ?? "");
    const on = match[5] ?? "";
    const cols = extractQualifiedColumns(on);
    if (cols.length < 2) continue;
    const leftAlias = cols[0]!.alias;
    const rightAlias = cols.find((col) => col.alias !== leftAlias)?.alias ?? rightName;
    const leftRel = aliases[leftAlias];
    const rightRel = aliases[rightAlias] ?? aliases[rightName];
    if (leftRel && rightRel) pairs.push({ left: leftRel, right: rightRel });
  }
  return pairs;
}

function joinAllowed(from: AnalysisRelation, toName: string): AnalysisJoin | undefined {
  return from.joins.find((join) => join.to === toName);
}

function detectFanout(
  catalog: AnalysisCatalog,
  aliases: Readonly<Record<string, string>>,
  pairs: readonly { readonly left: string; readonly right: string }[],
  sql: string,
): AnalysisSqlIssue | null {
  const qualified = extractQualifiedColumns(sql);
  for (const pair of pairs) {
    const left = catalog.relations.find((relation) => relation.name === pair.left);
    const right = catalog.relations.find((relation) => relation.name === pair.right);
    if (!left || !right) continue;
    const leftToRight = joinAllowed(left, right.name);
    const rightToLeft = joinAllowed(right, left.name);
    const risky = (leftToRight?.fanoutRisk === true ? left : rightToLeft?.fanoutRisk === true ? right : null);
    const many = risky === left ? right : left;
    if (risky === null) continue;
    const oneAliases = Object.entries(aliases)
      .filter(([, name]) => name === risky.name)
      .map(([alias]) => alias);
    const summed = qualified.some((col) => {
      if (!oneAliases.includes(col.alias)) return false;
      if (col.column === "id" || col.column === "tenant_id") return false;
      const field = risky.fields.find((item) => item.column === col.column);
      if (!field) return false;
      if (field.type !== "number" && field.type !== "money" && field.type !== "percent") return false;
      const window = new RegExp(`\\b(sum|avg|count)\\s*\\(\\s*(?:"?${col.alias}"?\\s*\\.\\s*)?"?${col.column}"?`, "i");
      return window.test(sql);
    });
    if (summed) {
      return issue(
        "ANALYSIS_SQL_FANOUT_RISK",
        "sql.join",
        `after a one-to-many join (${risky.name} → ${many.name}) a numeric column on the one side cannot be aggregated`,
        `aggregate from the header relation itself; or dedupe / subquery by ${risky.name}.id before the join`,
        `SELECT ${risky.name === left.name ? "h" : "l"}.id, SUM(line.qty) FROM ${many.name} line INNER JOIN ${risky.name} h ON line.bill_id = h.id WHERE h.tenant_id = $1 GROUP BY h.id LIMIT 20`,
      );
    }
  }
  return null;
}

export function checkAnalysisSql(
  catalog: AnalysisCatalog,
  sql: string,
  params: readonly unknown[] = [],
): AnalysisSqlCheck {
  const issues: AnalysisSqlIssue[] = [];
  if (typeof sql !== "string" || !sql.trim()) {
    return {
      ok: false,
      issues: [
        issue(
          "ANALYSIS_SQL_EMPTY",
          "sql",
          "one non-empty read-only SELECT/WITH",
          "write a single SELECT and bind parameters from $1",
          `SELECT status, COUNT(*) AS n FROM oe_purchase_order WHERE tenant_id = $1 GROUP BY status LIMIT 20`,
        ),
      ],
    };
  }
  for (const [index, value] of params.entries()) {
    if (value !== null && typeof value === "object") {
      issues.push(
        issue(
          "ANALYSIS_SQL_PARAM_NOT_SCALAR",
          `params[${String(index)}]`,
          "a scalar (string / number / boolean / null)",
          "do not put an object or array into params; split an IN list into $n or use several queries",
          `{"params":["t-demo","reviewed"]}`,
        ),
      );
    }
  }

  const stripped = stripComments(sql).replace(/\s+/g, " ").trim();
  const statements = splitStatements(stripped);
  if (statements.length !== 1) {
    issues.push(
      issue(
        "ANALYSIS_SQL_MULTI_STATEMENT",
        "sql",
        "exactly one statement",
        "delete the second statement after the semicolon; submit one SELECT at a time",
        `SELECT COUNT(*) FROM oe_process_report WHERE tenant_id = $1 LIMIT 1`,
      ),
    );
    return { ok: false, issues };
  }
  const statement = statements[0]!;
  if (/^(with|select)\b/i.test(statement) && !isReduced(statement)) {
    return { ok: false, issues: [listingIssue(catalog, statement)] };
  }
  if (params.length > ANALYSIS_SQL_MAX_PARAMS) {
    issues.push(
      issue(
        "ANALYSIS_SQL_TOO_MANY_PARAMS",
        "params",
        `at most ${ANALYSIS_SQL_MAX_PARAMS} bound parameters`,
        "split into several queries only when a reduced analysis has too many parameters; do not batch an unreduced row dump",
        `{"sql":"SELECT COUNT(*) AS n FROM oe_purchase_order WHERE id = $1 LIMIT 1","params":["<id>"]}`,
      ),
    );
  }
  if (FORBIDDEN_HEAD.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_NOT_READONLY",
        "sql",
        "a single read-only SELECT or WITH ... SELECT",
        "do not write DDL/DML/transaction control; analysis allows only SELECT",
        `SELECT operation_id, SUM(base_defect_qty) AS defect FROM oe_process_report WHERE tenant_id = $1 GROUP BY operation_id LIMIT 20`,
      ),
    );
  }
  if (!/^(with|select)\b/i.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_NOT_SELECT",
        "sql",
        "start with SELECT or WITH",
        "change the statement to SELECT ... or WITH ... SELECT ...",
        `WITH x AS (SELECT 1) SELECT * FROM x`,
      ),
    );
  }
  if (/\b(for\s+update|for\s+share|for\s+no\s+key\s+update|into\s+(temp|temporary|table|strict)?)\b/i.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_LOCK_OR_INTO",
        "sql",
        "a read-only query without FOR UPDATE / SELECT INTO",
        "remove FOR UPDATE / INTO; an analysis query must not lock or materialize a table",
        `SELECT id FROM oe_purchase_order WHERE tenant_id = $1 LIMIT 10`,
      ),
    );
  }
  if (/\b(union|intersect|except)\b/i.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_SET_OP",
        "sql",
        "a single SELECT, with no UNION/INTERSECT/EXCEPT",
        "use a JOIN or two queries instead of a set operation",
        `SELECT product_id FROM oe_purchase_order_lines WHERE tenant_id = $1 LIMIT 20`,
      ),
    );
  }
  if (/\bcross\s+join\b/i.test(statement) || /,\s*(?:"?[A-Za-z_][A-Za-z0-9_]*"?\s+){0,1}(?:"?[A-Za-z_][A-Za-z0-9_]*"?)\s+where/i.test(statement.replace(/\bfrom\b/i, ""))) {
    // A comma join is too easy to miss; an explicit CROSS JOIN is always rejected.
  }
  if (/\bcross\s+join\b/i.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_CROSS_JOIN",
        "sql.join",
        "an INNER JOIN with ON, and it must land on an edge the analysis catalog allows",
        "write INNER JOIN ... ON an equality the catalog declares",
        `SELECT l.qty FROM oe_purchase_order_lines l INNER JOIN oe_purchase_order h ON l.bill_id = h.id WHERE h.tenant_id = $1 LIMIT 20`,
      ),
    );
  }
  if (/\b(left|right|full)\s+join\b/i.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_OUTER_JOIN",
        "sql.join",
        "INNER JOIN (outer joins are not open in this round)",
        "change it to INNER JOIN; narrow missing matches with WHERE, and do not use LEFT JOIN to amplify nulls. A ranking or total must INNER JOIN the master table for the display name; a zero-value object was never going to enter the ranking",
        analysisJoinExampleFromCatalog(catalog)?.sql ??
          (catalog.relations[0] !== undefined
            ? `SELECT id FROM ${catalog.relations[0].name} LIMIT 20`
            : "SELECT 1 LIMIT 1"),
      ),
    );
  }

  for (const name of extractFunctions(statement)) {
    if (FORBIDDEN_FUNC.has(name)) {
      issues.push(
        issue(
          "ANALYSIS_SQL_FORBIDDEN_FUNCTION",
          `sql.fn.${name}`,
          "an aggregate or scalar function with no side effects",
          `remove ${name}(...); an analysis query cannot call a function that writes, reads files, or connects outward`,
          `SELECT SUM(qty) FROM oe_purchase_order_lines WHERE tenant_id = $1`,
        ),
      );
    } else if (!ALLOWED_FUNC.has(name) && !/^(select|from|where|and|or|case|when|then|else|end|over|filter|as|on|inner|join|group|by|having|order|limit|offset|with|in|is|null|not|between|like|ilike|exists|any|all|some|distinct|true|false)$/.test(name)) {
      issues.push(
        issue(
          "ANALYSIS_SQL_FUNCTION_NOT_ALLOWED",
          `sql.fn.${name}`,
          `allowed functions: ${[...ALLOWED_FUNC].sort().join(", ")}`,
          `replace ${name} with a function on the allow-list, or move the calculation out of SQL`,
          `SELECT COALESCE(SUM(qty), 0) FROM oe_purchase_order_lines WHERE tenant_id = $1`,
        ),
      );
    }
  }

  const indexes = extractParams(statement);
  if (indexes.some((index) => index < 1)) {
    issues.push(issue("ANALYSIS_SQL_PARAM_INDEX", "sql", "a bind placeholder starting at $1", "number parameters contiguously from $1", `WHERE tenant_id = $1 AND status = $2`));
  }
  const maxIndex = indexes.at(-1) ?? 0;
  if (maxIndex !== params.length && !(maxIndex === 0 && params.length === 0)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_PARAM_COUNT",
        "params",
        `params.length must equal the largest $n in the SQL (this SQL uses $1..$${String(maxIndex)})`,
        "fill in or drop extra bindings; do not splice values into the SQL text",
        `{"sql":"SELECT 1 FROM oe_purchase_order WHERE tenant_id = $1 LIMIT 1","params":["t-demo"]}`,
      ),
    );
  }
  if (indexes.length > 0 && indexes.some((index, i) => index !== i + 1)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_PARAM_GAPS",
        "sql",
        "$1..$n contiguous, with no skipped index",
        "do not skip $2 and write $3",
        `WHERE tenant_id = $1 AND id = $2`,
      ),
    );
  }

  if (!hasKeyword(statement, /\blimit\b/i)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_LIMIT_REQUIRED",
        "sql.limit",
        `an explicit LIMIT of 1..${ANALYSIS_SQL_MAX_ROWS}`,
        `add LIMIT ${ANALYSIS_SQL_MAX_ROWS} (or smaller) at the end of the statement`,
        `SELECT status, COUNT(*) AS n FROM oe_purchase_order WHERE tenant_id = $1 GROUP BY status LIMIT 20`,
      ),
    );
  } else {
    const limitMatch = statement.match(/\blimit\s+(\d+)\b/i);
    if (!limitMatch) {
      issues.push(
        issue(
          "ANALYSIS_SQL_LIMIT_NOT_LITERAL",
          "sql.limit",
          "LIMIT must be a numeric literal, not an expression or a bound parameter",
          `write LIMIT ${ANALYSIS_SQL_MAX_ROWS}`,
          `... LIMIT 20`,
        ),
      );
    } else {
      const limit = Number(limitMatch[1]);
      if (!Number.isInteger(limit) || limit < 1 || limit > ANALYSIS_SQL_MAX_ROWS) {
        issues.push(
          issue(
            "ANALYSIS_SQL_LIMIT_OUT_OF_RANGE",
            "sql.limit",
            `an integer in 1..${ANALYSIS_SQL_MAX_ROWS}`,
            `change LIMIT to no more than ${ANALYSIS_SQL_MAX_ROWS}`,
            `... LIMIT 20`,
          ),
        );
      }
    }
  }

  if (hasSelectStar(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_SELECT_STAR",
        "sql.select",
        "a reduced column list (group keys + aggregates); SELECT * is forbidden",
        "write concrete columns and aggregates; use bill_list for an unreduced row set, and do not dump a table with analysis_sql",
        `SELECT status, COUNT(*) AS n FROM oe_purchase_order GROUP BY status LIMIT 20`,
      ),
    );
  }
  if (!isReduced(statement) && /^(with|select)\b/i.test(statement)) {
    issues.push(
      issue(
        "ANALYSIS_SQL_NOT_REDUCED",
        "sql",
        "a conclusion query with GROUP BY or an aggregate function",
        "use bill_list (fields + nextOffset) for a column profile, raw values of a few columns, or a check; analysis_sql accepts only a conclusion query after GROUP BY or aggregation",
        JSON.stringify(inferListingRewrite(catalog, statement))
      ),
    );
  }

  const ctes = extractCteNames(statement);
  const tables = extractTables(statement);
  const aliases: Record<string, string> = {};
  const used = new Set<string>();
  for (const table of tables) {
    if (ctes.has(table.name)) continue;
    if (table.name.includes(".")) {
      issues.push(
        issue(
          "ANALYSIS_SQL_SCHEMA_NOT_ALLOWED",
          `sql.relation.${table.name}`,
          "an analysis-catalog relation with no schema (oe_*)",
          "drop qualifiers such as pg_catalog / information_schema and query only tables in the analysis catalog",
          `FROM oe_process_report`,
        ),
      );
      continue;
    }
    const relation = catalog.relations.find((item) => item.name === table.name);
    if (!relation) {
      issues.push(
        issue(
          "ANALYSIS_SQL_RELATION_UNKNOWN",
          `sql.relation.${table.name}`,
          `a relation inside the analysis catalog (for example ${catalog.relations.slice(0, 3).map((item) => item.name).join(" / ")})`,
          "use only analysis-catalog table names the declaration generated; do not guess an undeclared table",
          `FROM oe_process_report r`,
          catalog.relations.map((item) => item.name),
        ),
      );
      continue;
    }
    aliases[table.alias] = relation.name;
    used.add(relation.name);
  }

  for (const col of extractQualifiedColumns(statement)) {
    const relationName = aliases[col.alias];
    if (!relationName) continue;
    if (col.column === "*") continue;
    const relation = catalog.relations.find((item) => item.name === relationName);
    if (!relation) continue;
    if (!relation.fields.some((field) => field.column === col.column)) {
      issues.push(
        issue(
          "ANALYSIS_SQL_COLUMN_UNKNOWN",
          `sql.column.${col.alias}.${col.column}`,
          `stored columns on "${relationName}": ${String(relation.fields.length)} (${relation.fields.map((field) => field.column).join(" / ")})`,
          "use a column from the catalog; a derived field has no physical column, see that relation's missingFacts",
          `SELECT ${col.alias}.id FROM ${relationName} ${col.alias} WHERE ${col.alias}.tenant_id = $1 LIMIT 10`,
          relation.fields.map((field) => field.column),
        ),
      );
    }
  }

  const pairs = findJoinPairs(statement, aliases);
  for (const pair of pairs) {
    const left = catalog.relations.find((item) => item.name === pair.left);
    const right = catalog.relations.find((item) => item.name === pair.right);
    if (!left || !right) continue;
    if (!joinAllowed(left, right.name) && !joinAllowed(right, left.name)) {
      issues.push(
        issue(
          "ANALYSIS_SQL_JOIN_NOT_DECLARED",
          "sql.join",
          `a join the catalog declares (${left.name} may join ${left.joins.map((join) => join.to).join(" / ") || "none"})`,
          "join only a ref or header-line edge in the declaration; no edge means a missing fact, so do not invent a queryable appearance",
          `INNER JOIN oe_purchase_order h ON l.bill_id = h.id`,
        ),
      );
    }
  }
  const fanout = detectFanout(catalog, aliases, pairs, statement);
  if (fanout) issues.push(fanout);

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      sql: statement,
      params: [...params],
      relations: [...used].sort(),
      aliases,
    },
  };
}

export function validateAnalysisSql(
  catalog: AnalysisCatalog,
  sql: string,
  params: readonly unknown[] = [],
): ValidatedAnalysisSql {
  const checked = checkAnalysisSql(catalog, sql, params);
  if (checked.ok) return checked.value;
  const first = checked.issues[0]!;
  throw new AnalysisSqlError(
    `${first.code} @ ${first.path}：${first.expected}。${first.correction}`,
    checked.issues,
  );
}

/** Agent endpoint convenience only: retain the strict SQL validator for all
 * other callers. Default a missing budget only after every other guard passed.
 */
export function prepareAgentAnalysisSql(catalog: AnalysisCatalog, sql: string, params: readonly unknown[] = []): {
  readonly validated: ValidatedAnalysisSql; readonly defaultLimitApplied: boolean;
} {
  const checked = checkAnalysisSql(catalog, sql, params);
  if (checked.ok) return { validated: checked.value, defaultLimitApplied: false };
  if (checked.issues.length > 0 && checked.issues.every(issue => issue.code === "ANALYSIS_SQL_LIMIT_REQUIRED")) {
    const statement = stripComments(sql).trim().replace(/;\s*$/, "");
    return { validated: validateAnalysisSql(catalog, `${statement} LIMIT ${ANALYSIS_SQL_MAX_ROWS}`, params), defaultLimitApplied: true };
  }
  // Keep original refusal, including multiple statements, parameters and scope.
  return { validated: validateAnalysisSql(catalog, sql, params), defaultLimitApplied: false };
}

/**
 * Aliases of physical tables reached by FROM/JOIN in the current SELECT scope (not subquery / CTE aliases).
 * al/sr inside a nested SELECT must not be lifted into the outer WHERE.
 * The return value is still every physical alias of that scope, including the right side of a LEFT JOIN.
 */
export function physicalAliasesInScope(sql: string): readonly string[] {
  return [...new Set(physicalAliasSites(sql).map((site) => site.alias))];
}

/**
 * In the same scope, aliases of physical tables (`oe_*`, not a subquery) on the right of LEFT / LEFT OUTER JOIN.
 */
export function leftJoinAliasesInScope(sql: string): readonly string[] {
  return [...new Set(physicalAliasSites(sql).filter((site) => site.leftJoin).map((site) => site.alias))];
}

function selectKeywordStarts(sql: string): readonly number[] {
  const starts: number[] = [];
  let quote: "'" | '"' | null = null;
  const lower = sql.toLowerCase();
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (!lower.startsWith("select", i)) continue;
    if (i > 0 && /[A-Za-z0-9_]/.test(sql[i - 1]!)) continue;
    if (/[A-Za-z0-9_]/.test(sql[i + 6] ?? "")) continue;
    starts.push(i);
  }
  return starts;
}

function selectStatementEnd(sql: string, start: number): number {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let i = start; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth < 0) return i;
    }
    if (depth !== 0) continue;
    const rest = sql.slice(i).toLowerCase();
    if (
      /^(union|intersect|except)\b/.test(rest) &&
      (i === start || /\s/.test(sql[i - 1] ?? " "))
    ) {
      return i;
    }
  }
  return sql.length;
}

/**
 * Insert the predicate into that level's WHERE for each SELECT scope.
 * The first argument of getClause is every physical alias of that scope; the second is the aliases of LEFT JOIN physical tables among them.
 * An alias inside a subquery must not be lifted outward, and an outer alias must not be written into an inner scope.
 * Edit from the back forward so slices do not shift. The second argument is passed every time.
 */
export function injectScopedWhere(
  sql: string,
  getClause: (aliases: readonly string[], leftAliases: readonly string[]) => string | null | undefined,
): string {
  const starts = selectKeywordStarts(sql);
  let next = sql;
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i]!;
    const end = selectStatementEnd(next, start);
    const fragment = next.slice(start, end);
    const clause = getClause(physicalAliasesInScope(fragment), leftJoinAliasesInScope(fragment));
    if (!clause) continue;
    if (fragment.includes(clause)) continue;
    next = `${next.slice(0, start)}${insertWhere(fragment, clause)}${next.slice(end)}`;
  }
  return next;
}

/**
 * On SQL that already passed the gate, inject tenant_id of each physical-table alias into every SELECT scope.
 * The caller passes the current identity's tenantId as an appended parameter; the model must not fill the tenant itself.
 * Pivot SQL does not go through the analysis gate; `queryCompiled` still injects from here.
 *
 * If tenant_id of a physical table on the right of a LEFT JOIN is written into WHERE, a miss (a whole-shift assignment whose worker_id is empty,
 * or a dimension row that belongs to another tenant) makes that column NULL, and the outer join is filtered into an inner join. The predicate is rewritten into that table's own ON,
 * and it shares the same `$n` with FROM / INNER / CROSS / a plain JOIN / RIGHT / FULL.
 */
export function injectTenantPredicates(
  validated: ValidatedAnalysisSql,
  tenantId: string,
): { readonly sql: string; readonly params: readonly unknown[] } {
  const nextIndex = validated.params.length + 1;
  const tenantSlot = `$${String(nextIndex)}`;
  const withWhere = injectScopedWhere(validated.sql, (aliases, leftAliases) => {
    const left = new Set(leftAliases);
    const anchored = aliases.filter((alias) => !left.has(alias));
    if (anchored.length === 0) return null;
    return anchored.map((alias) => `${quoteIdent(alias)}.tenant_id = ${tenantSlot}`).join(" AND ");
  });
  return { sql: injectLeftJoinOnTenant(withWhere, tenantSlot), params: [...validated.params, tenantId] };
}

/**
 * A data-scope clause. When a LEFT JOIN misses, the dimension id is NULL, and putting the scope predicate straight into WHERE would filter out the fact row.
 * A row that did not reference it stays; a row that referenced a dimension value outside the scope is still filtered out. An empty clause (policy all) is not pushed by the caller, and this does not add one.
 */
export function aliasScopePredicate(alias: string, clause: string, leftJoin: boolean): string {
  if (!leftJoin) return clause;
  return `(${quoteIdent(alias)}.id IS NULL OR (${clause}))`;
}

function quoteIdent(name: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function insertWhere(sql: string, clause: string): string {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  const lower = sql.toLowerCase();
  let insertAt = -1;
  let whereAt = -1;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth !== 0) continue;
    const rest = lower.slice(i);
    if (rest.startsWith("where") && (i === 0 || /\s/.test(sql[i - 1] ?? " "))) {
      whereAt = i;
      i += 4;
      continue;
    }
    if (
      /^(group\s+by|having|order\s+by|limit|offset|window)\b/.test(rest) &&
      (i === 0 || /\s/.test(sql[i - 1] ?? " "))
    ) {
      insertAt = i;
      break;
    }
  }
  if (whereAt >= 0) {
    const afterWhere = whereAt + "where".length;
    return `${sql.slice(0, afterWhere)} ${clause} AND${sql.slice(afterWhere)}`;
  }
  if (insertAt >= 0) {
    return `${sql.slice(0, insertAt)} WHERE ${clause} ${sql.slice(insertAt)}`;
  }
  // When a fragment ends before UNION, the tail may be only a newline or a line comment; WHERE must occupy its own line,
  // so it is not eaten on the same line as `-- comment` and does not glue onto the following UNION as `$1UNION`.
  return `${sql.trimEnd()}\nWHERE ${clause}\n`;
}

interface JoinOn {
  readonly onAt: number;
  readonly condStart: number;
  readonly condEnd: number;
}

interface PhysicalAliasSite {
  readonly alias: string;
  readonly leftJoin: boolean;
  readonly aliasEnd: number;
  readonly on: JoinOn | null;
}

/** The next clause or join. A function such as `left(` does not count; it must really be JOIN. */
const SCOPE_CLAUSE_BOUNDARY =
  /^(?:where|group\s+by|having|order\s+by|limit|offset|window|union|intersect|except|join|using|natural|(?:left|right|full|inner|cross)(?:\s+outer)?\s+join)\b/i;

function isKeywordAt(sql: string, index: number, pattern: RegExp): boolean {
  if (index > 0 && !/\s/.test(sql[index - 1]!)) return false;
  return pattern.test(sql.slice(index));
}

function isLeftJoinBefore(sql: string, joinAt: number): boolean {
  let k = joinAt;
  while (k > 0 && /\s/.test(sql[k - 1]!)) k -= 1;
  if (k >= 5 && sql.slice(k - 5, k).toLowerCase() === "outer" && (k === 5 || /\s/.test(sql[k - 6]!))) {
    k -= 5;
    while (k > 0 && /\s/.test(sql[k - 1]!)) k -= 1;
  }
  return k >= 4 && sql.slice(k - 4, k).toLowerCase() === "left" && (k === 4 || /\s/.test(sql[k - 5]!));
}

function clauseEnd(sql: string, from: number): number {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let i = from; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      if (depth < 0) return i;
      continue;
    }
    if (depth !== 0) continue;
    if (isKeywordAt(sql, i, SCOPE_CLAUSE_BOUNDARY)) return i;
  }
  return sql.length;
}

function readOnClause(sql: string, from: number): JoinOn | null {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let i = from; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      if (depth < 0) return null;
      continue;
    }
    if (depth !== 0) continue;
    if (isKeywordAt(sql, i, /^on\b/i)) {
      let condStart = i + 2;
      while (condStart < sql.length && /\s/.test(sql[condStart]!)) condStart += 1;
      return { onAt: i, condStart, condEnd: clauseEnd(sql, condStart) };
    }
    if (isKeywordAt(sql, i, SCOPE_CLAUSE_BOUNDARY)) return null;
  }
  return null;
}

/**
 * Physical tables at depth 0 of this level. FROM/JOIN inside a subquery is not collected.
 * The scan matches the original alias scan: quotes, parenthesis depth, `ONLY`, and a keyword is not an alias.
 */
function physicalAliasSites(sql: string): readonly PhysicalAliasSite[] {
  const sites: PhysicalAliasSite[] = [];
  let depth = 0;
  let quote: "'" | '"' | null = null;
  const lower = sql.toLowerCase();
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    if (quote) {
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    const rest = lower.slice(i);
    const isFrom = rest.startsWith("from");
    const isJoin = rest.startsWith("join");
    if ((!isFrom && !isJoin) || (i > 0 && !/\s/.test(sql[i - 1] ?? " "))) continue;
    let j = i + 4;
    while (j < sql.length && /\s/.test(sql[j]!)) j += 1;
    if (lower.slice(j).startsWith("only") && /\s/.test(sql[j + 4] ?? "")) {
      j += 4;
      while (j < sql.length && /\s/.test(sql[j]!)) j += 1;
    }
    if (sql[j] === "(") continue;
    const tableMatch = sql.slice(j).match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (tableMatch === null || !/^oe_[a-z0-9_]+$/i.test(tableMatch[1]!)) continue;
    const table = tableMatch[1]!;
    const tableEnd = j + table.length;
    j = tableEnd;
    while (j < sql.length && /\s/.test(sql[j]!)) j += 1;
    const asMatch = sql.slice(j).match(/^(?:as\s+)?([A-Za-z_][A-Za-z0-9_]*)/i);
    let alias = table;
    let aliasEnd = tableEnd;
    if (asMatch !== null) {
      const bare = asMatch[1];
      if (bare !== undefined && !NON_ALIAS_KEYWORDS.has(bare.toLowerCase())) {
        alias = bare;
        aliasEnd = j + asMatch[0].length;
      }
    }
    const leftJoin = isJoin && isLeftJoinBefore(sql, i);
    sites.push({
      alias,
      leftJoin,
      aliasEnd,
      on: leftJoin ? readOnClause(sql, aliasEnd) : null,
    });
  }
  return sites;
}

function onHasSamePredicate(condition: string, predicate: string): boolean {
  let from = 0;
  while (from <= condition.length) {
    const at = condition.indexOf(predicate, from);
    if (at < 0) return false;
    const after = condition[at + predicate.length];
    if (after === undefined || !/\d/.test(after)) return true;
    from = at + predicate.length;
  }
  return false;
}

function rewriteLeftJoinTenant(sql: string, tenantSlot: string): string {
  const sites = physicalAliasSites(sql).filter((site) => site.leftJoin);
  let next = sql;
  for (let i = sites.length - 1; i >= 0; i--) {
    const site = sites[i]!;
    const predicate = `${quoteIdent(site.alias)}.tenant_id = ${tenantSlot}`;
    if (site.on === null) {
      next = `${next.slice(0, site.aliasEnd)} ON ${predicate}${next.slice(site.aliasEnd)}`;
      continue;
    }
    const raw = next.slice(site.on.condStart, site.on.condEnd);
    const condition = raw.trim();
    if (condition.length > 0 && onHasSamePredicate(condition, predicate)) continue;
    const trailingWs = raw.slice(raw.trimEnd().length);
    const head = condition.length === 0 ? `ON ${predicate}` : `ON (${condition}) AND ${predicate}`;
    next = `${next.slice(0, site.on.onAt)}${head}${trailingWs}${next.slice(site.on.condEnd)}`;
  }
  return next;
}

/** Each SELECT scope rewrites its own LEFT JOIN. From the back forward, so slices do not shift. */
function injectLeftJoinOnTenant(sql: string, tenantSlot: string): string {
  const starts = selectKeywordStarts(sql);
  let next = sql;
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i]!;
    const end = selectStatementEnd(next, start);
    const fragment = next.slice(start, end);
    const rewritten = rewriteLeftJoinTenant(fragment, tenantSlot);
    if (rewritten === fragment) continue;
    next = `${next.slice(0, start)}${rewritten}${next.slice(end)}`;
  }
  return next;
}
