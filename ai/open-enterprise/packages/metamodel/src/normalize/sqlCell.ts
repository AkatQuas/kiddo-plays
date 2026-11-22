// ---------------------------------------------------------------------------
// SQL cell — the only fetch declaration shared by insight and the daily report
//
// Each cell is one SELECT with placeholders. Packages only substitute and execute; they do not interpret business meaning.
// asOf is a date parameter, not a replay. The executor injects the tenant; the template must not write tenant_id.
// Zero IO.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireArray,
  requireCoordinateSegment,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import { businessTableName } from "../derive/pgNames.js";
import { ledgerNetCaseSql } from "../schema/effects.js";

function dateOnly(asOf: Date): string {
  const day = new Date(asOf.getTime());
  day.setHours(0, 0, 0, 0);
  return `${String(day.getFullYear())}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export const SQL_CELL_RESULTS = ["count", "sum", "rows", "scalar", "table"] as const;
export type SqlCellResult = (typeof SQL_CELL_RESULTS)[number];

export const SQL_CELL_PARAMS = ["asOf"] as const;
export type SqlCellParam = (typeof SQL_CELL_PARAMS)[number];

export interface SqlCellReads {
  readonly modules: readonly string[];
  readonly statuses?: Readonly<Record<string, readonly string[]>>;
  readonly ledgers?: readonly string[];
}

export interface InsightSqlCell {
  readonly kind: "sql";
  readonly label: string;
  readonly sql: string;
  readonly reads: SqlCellReads;
  /** Drill-down module; omitted means no link. It must be a module this cell's SQL reads. */
  readonly link?: string;
  readonly params: readonly SqlCellParam[];
  readonly result: SqlCellResult;
  readonly unit?: string;
  readonly itemsLimit?: number;
  readonly summaryFields?: readonly string[];
  readonly table?: {
    readonly columns: readonly { readonly key: string; readonly label: string; readonly from: string }[];
    readonly page?: string;
    readonly totalFrom?: string;
  };
}

/** A cell written by hand in a domain: reads are derived from the SQL and are not in the declaration. */
export type InsightSqlCellDef = Omit<InsightSqlCell, "reads">;

const SQL_CELL_KEYS = [
  "kind", "label", "sql", "params", "result", "unit", "itemsLimit", "summaryFields", "table", "link",
] as const;
const PLACEHOLDER = /\{\{(table|ledger|status|asOf|field|ledgerNet):([^}]*)\}\}|\{\{(asOf)\}\}/g;
const TABLE_ALIAS = /\{\{(?:table|ledger):[^}]+\}\}\s+([A-Za-z_][A-Za-z0-9_]*)/g;
const SQL_KEYWORDS = new Set(["where", "join", "left", "right", "inner", "outer", "cross", "on", "group", "order", "limit", "having", "union", "except", "intersect", "as"]);

export function isInsightSqlCell(cell: unknown): cell is InsightSqlCell {
  return typeof cell === "object" && cell !== null && (cell as { kind?: string }).kind === "sql";
}

export function normalizeSqlCell(raw: unknown, at: string): InsightSqlCell {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SQL_CELL_KEYS, at);
  if (obj["kind"] !== "sql") schemaFail(`${at}.kind must be sql`);
  const sql = requireText(obj["sql"], `${at}.sql`).trim();
  if (!/^(select|with)\b/i.test(sql)) schemaFail(`${at}.sql must be a SELECT or WITH`);
  if (/;/.test(sql)) schemaFail(`${at}.sql must not contain a semicolon`);
  if (/tenant_id/i.test(sql)) schemaFail(`${at}.sql must not write tenant_id — the executor injects the tenant`);
  if (/\$\{|`/.test(sql)) schemaFail(`${at}.sql must not use template interpolation`);
  const params = requireArray(obj["params"], `${at}.params`).map((item, i) =>
    requireEnum(item, SQL_CELL_PARAMS, `${at}.params[${String(i)}]`),
  );
  const placeholders = [...sql.matchAll(PLACEHOLDER)];
  if (placeholders.length === 0) schemaFail(`${at}.sql must contain at least one placeholder`);
  const usedTables = new Set<string>();
  const usedLedgers = new Set<string>();
  const usedStatuses = new Map<string, Set<string>>();
  let usesAsOf = false;
  for (const match of placeholders) {
    const kind = match[1] ?? match[3];
    const body = match[2] ?? "";
    if (kind === "asOf") {
      usesAsOf = true;
      continue;
    }
    if (kind === "field" || kind === "ledgerNet") {
      if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(body)) schemaFail(`${at}.sql ${kind} must be alias.field or ledger.alias`);
      continue;
    }
    if (kind === "table") {
      const [module, through] = body.split(".");
      if (!module) schemaFail(`${at}.sql placeholder {{table:}} is missing a module`);
      usedTables.add(module);
      if (through !== undefined && through !== "") requireCoordinateSegment(through, `${at}.sql {{table:${body}}}`);
      continue;
    }
    if (kind === "ledger") {
      if (!body) schemaFail(`${at}.sql placeholder {{ledger:}} is missing a ledger code`);
      usedLedgers.add(body);
      continue;
    }
    if (kind === "status") {
      const dot = body.indexOf(".");
      if (dot <= 0) schemaFail(`${at}.sql {{status:}} must be module.status`);
      const module = body.slice(0, dot);
      const status = body.slice(dot + 1);
      const set = usedStatuses.get(module) ?? new Set<string>();
      set.add(status);
      usedStatuses.set(module, set);
    }
  }
  if (usedTables.size === 0 && usedLedgers.size === 0) {
    schemaFail(`${at} derives neither a module nor a ledger`);
  }
  if (usesAsOf && !params.includes("asOf")) schemaFail(`${at}.params uses {{asOf}} and must include asOf`);
  if (!usesAsOf && params.includes("asOf")) schemaFail(`${at}.params lists asOf but the SQL has no {{asOf}}`);
  const aliases = [...sql.matchAll(TABLE_ALIAS)].filter((match) => !SQL_KEYWORDS.has((match[1] ?? "").toLowerCase()));
  if ([...sql.matchAll(/\{\{(?:table|ledger):[^}]+\}\}/g)].length !== aliases.length) {
    schemaFail(`${at}.sql every {{table}}/{{ledger}} must be followed by an alias`);
  }
  const modules = [...usedTables];
  const statuses = usedStatuses.size === 0
    ? undefined
    : Object.fromEntries([...usedStatuses].map(([module, set]) => [module, [...set]]));
  const ledgers = usedLedgers.size === 0 ? undefined : [...usedLedgers];
  const link = obj["link"] === undefined || obj["link"] === null
    ? undefined
    : requireCoordinateSegment(obj["link"], `${at}.link`);
  if (link !== undefined && !modules.includes(link)) {
    schemaFail(`${at}.link "${link}" is not among the modules this cell's SQL reads`);
  }
  return {
    kind: "sql",
    label: requireText(obj["label"], `${at}.label`),
    sql,
    reads: {
      modules,
      ...(statuses === undefined ? {} : { statuses }),
      ...(ledgers === undefined ? {} : { ledgers }),
    },
    ...(link === undefined ? {} : { link }),
    params,
    result: requireEnum(obj["result"], SQL_CELL_RESULTS, `${at}.result`),
    ...(obj["unit"] === undefined ? {} : { unit: requireText(obj["unit"], `${at}.unit`) }),
    ...(obj["itemsLimit"] === undefined ? {} : { itemsLimit: Number(obj["itemsLimit"]) }),
    ...(obj["summaryFields"] === undefined
      ? {}
      : { summaryFields: requireArray(obj["summaryFields"], `${at}.summaryFields`).map((item, i) => requireText(item, `${at}.summaryFields[${String(i)}]`)) }),
    ...(obj["table"] === undefined
      ? {}
      : {
          table: (() => {
            const rawTable = requireObject(obj["table"], `${at}.table`);
            assertClosedKeys(rawTable, ["columns", "page", "totalFrom"] as const, `${at}.table`);
            return {
              columns: requireArray(rawTable["columns"], `${at}.table.columns`).map((item, i) => {
                const col = requireObject(item, `${at}.table.columns[${String(i)}]`);
                assertClosedKeys(col, ["key", "label", "from"] as const, `${at}.table.columns[${String(i)}]`);
                return {
                  key: requireCoordinateSegment(col["key"], `${at}.table.columns[${String(i)}].key`),
                  label: requireText(col["label"], `${at}.table.columns[${String(i)}].label`),
                  from: requireText(col["from"], `${at}.table.columns[${String(i)}].from`),
                };
              }),
              ...(rawTable["totalFrom"] === undefined ? {} : { totalFrom: requireText(rawTable["totalFrom"], `${at}.table.totalFrom`) }),
              ...(rawTable["page"] === undefined ? {} : { page: requireText(rawTable["page"], `${at}.table.page`) }),
            };
          })(),
        }),
  };
}

export interface CompiledSqlCell {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly aliases: Readonly<Record<string, string>>;
  readonly fields?: readonly { readonly token: string; readonly alias: string; readonly key: string }[];
}

export function compileSqlCell(cell: Pick<InsightSqlCell, "sql" | "params">, asOf: Date): CompiledSqlCell {
  const params: unknown[] = [];
  const aliases: Record<string, string> = {};
  const fields: { token:string; alias:string; key:string }[] = [];
  let asOfSlot = "";
  if (cell.params.includes("asOf")) {
    params.push(dateOnly(asOf));
    asOfSlot = `$${String(params.length)}`;
  }
  const sql = cell.sql.replace(PLACEHOLDER, (whole, kind: string | undefined, body: string | undefined, bare: string | undefined, offset: number) => {
    const type = kind ?? bare;
    if (type === "asOf") {
      if (asOfSlot === "") schemaFail("compileSqlCell: {{asOf}} is not registered in params");
      return asOfSlot;
    }
    if (type === "status") {
      const status = (body ?? "").slice((body ?? "").indexOf(".") + 1);
      return `'${status.replace(/'/g, "''")}'`;
    }
    if (type === "ledgerNet") {
      const [target, alias] = (body ?? "").split(".");
      return ledgerNetFor(target ?? "", alias ?? "", "insight");
    }
    if (type === "field") {
      const [alias, key] = (body ?? "").split(".");
      if (!alias || !key) schemaFail("field must be alias.field");
      const token = `__oe_field_${fields.length}__`;
      fields.push({token,alias,key});
      return token;
    }
    const rest = cell.sql.slice(offset + whole.length);
    const aliasMatch = rest.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)/);
    const alias = aliasMatch?.[1];
    if (alias === undefined) schemaFail(`compileSqlCell: ${whole} is missing an alias`);
    if (type === "table") {
      const [module, through] = (body ?? "").split(".");
      const table = businessTableName(module ?? "", through && through !== "" ? through : null);
      aliases[alias] = table;
      return table;
    }
    if (type === "ledger") {
      aliases[alias] = "oe_effect_ledger";
      return `(SELECT * FROM oe_effect_ledger WHERE target = '${(body ?? "").replace(/'/g, "''")}')`;
    }
    schemaFail(`compileSqlCell: unknown placeholder ${whole}`);
  });
  return { sql, params, aliases, ...(fields.length ? {fields} : {}) };
}

export function sqlCellModules(cell: InsightSqlCell): readonly string[] {
  return cell.reads.modules;
}

export function sqlCellLedgers(cell: InsightSqlCell): readonly string[] {
  return cell.reads.ledgers ?? [];
}

// ---------------------------------------------------------------------------
// Bound parameters (appended by surface). compileSqlCell is unchanged: insight still accepts only asOf.
// {{param:k}} / {{like:k}} / {{offset}} / {{ledgerNet:stock.alias}}
// ---------------------------------------------------------------------------

const BOUND_PLACEHOLDER =
  /\{\{(table|ledger|ledgerNet|status|asOf|param|like):([^}]*)\}\}|\{\{(asOf|offset)\}\}/g;

export const SURFACE_DEFAULT_PAGE = 1;
export const SURFACE_DEFAULT_PAGE_SIZE = 50;
export const SURFACE_MAX_PAGE_SIZE = 500;

export interface BoundSqlReads {
  readonly modules: readonly string[];
  readonly ledgers: readonly string[];
}

export function mergeBoundSqlReads(parts: readonly BoundSqlReads[]): BoundSqlReads {
  const modules: string[] = [];
  const ledgers: string[] = [];
  for (const part of parts) {
    for (const module of part.modules) {
      if (!modules.includes(module)) modules.push(module);
    }
    for (const ledger of part.ledgers) {
      if (!ledgers.includes(ledger)) ledgers.push(ledger);
    }
  }
  return { modules, ledgers };
}

function pageOf(values: Readonly<Record<string, unknown>>): number {
  const raw = values["page"];
  if (raw === undefined) return SURFACE_DEFAULT_PAGE;
  const n = typeof raw === "number" ? raw : Number.NaN;
  if (!Number.isInteger(n) || n < 1) schemaFail("page must be a positive integer");
  return n;
}

function pageSizeOf(values: Readonly<Record<string, unknown>>): number {
  const raw = values["pageSize"];
  if (raw === undefined) return SURFACE_DEFAULT_PAGE_SIZE;
  const n = typeof raw === "number" ? raw : Number.NaN;
  if (!Number.isInteger(n) || n < 1) schemaFail("pageSize must be a positive integer");
  return Math.min(SURFACE_MAX_PAGE_SIZE, n);
}

export function surfacePageOf(values: Readonly<Record<string, unknown>>): number {
  return pageOf(values);
}

export function surfacePageSizeOf(values: Readonly<Record<string, unknown>>): number {
  return pageSizeOf(values);
}

function ledgerNetFor(target: string, alias: string, at: string): string {
  requireCoordinateSegment(target, `${at} {{ledgerNet:${target}}}`);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) schemaFail(`${at} {{ledgerNet:}} alias is not legal`);
  return ledgerNetCaseSql(target)
    .replace(/\bop\b/g, `${alias}.op`)
    .replace(/\bamount\b/g, `${alias}.amount`);
}

/** Declaration-time gate: placeholders and aliases. Returns the table / ledger names that first appear in the SQL. param/like/offset/ledgerNet are surface additions. */
export function collectBoundSqlReads(sqlText: string, at: string): BoundSqlReads {
  const sql = sqlText.trim();
  if (!/^(select|with)\b/i.test(sql)) schemaFail(`${at}.sql must be a SELECT or WITH`);
  if (/;/.test(sql)) schemaFail(`${at}.sql must not contain a semicolon`);
  if (/tenant_id/i.test(sql)) schemaFail(`${at}.sql must not write tenant_id — the executor injects the tenant`);
  if (/\$\{|`/.test(sql)) schemaFail(`${at}.sql must not use template interpolation`);
  const placeholders = [...sql.matchAll(BOUND_PLACEHOLDER)];
  if (placeholders.length === 0) schemaFail(`${at}.sql must contain at least one placeholder`);
  const usedTables = new Set<string>();
  const usedLedgers = new Set<string>();
  for (const match of placeholders) {
    const kind = match[1] ?? match[3];
    const body = match[2] ?? "";
    if (kind === "table") {
      const [module, through] = body.split(".");
      if (!module) schemaFail(`${at}.sql placeholder {{table:}} is missing a module`);
      usedTables.add(module);
      if (through !== undefined && through !== "") requireCoordinateSegment(through, `${at}.sql {{table:${body}}}`);
      continue;
    }
    if (kind === "ledger" || kind === "ledgerNet") {
      const target = kind === "ledgerNet" ? body.split(".")[0] : body;
      if (!target) schemaFail(`${at}.sql placeholder {{${kind}:}} is missing a ledger code`);
      usedLedgers.add(target);
      if (kind === "ledgerNet") {
        const alias = body.split(".")[1];
        if (!alias) schemaFail(`${at}.sql {{ledgerNet:}} must be ledger.alias`);
      }
    }
  }
  const aliases = [...sql.matchAll(TABLE_ALIAS)].filter((match) => !SQL_KEYWORDS.has((match[1] ?? "").toLowerCase()));
  if ([...sql.matchAll(/\{\{(?:table|ledger):[^}]+\}\}/g)].length !== aliases.length) {
    schemaFail(`${at}.sql every {{table}}/{{ledger}} must be followed by an alias`);
  }
  return { modules: [...usedTables], ledgers: [...usedLedgers] };
}

export function compileBoundSql(
  sqlText: string,
  values: Readonly<Record<string, unknown>> = {},
  asOf?: Date,
): CompiledSqlCell {
  const params: unknown[] = [];
  const aliases: Record<string, string> = {};
  const slots = new Map<string, string>();
  let asOfSlot = "";
  const slot = (key: string, value: unknown): string => {
    const existing = slots.get(key);
    if (existing !== undefined) return existing;
    params.push(value);
    const next = `$${String(params.length)}`;
    slots.set(key, next);
    return next;
  };
  const sql = sqlText.replace(
    BOUND_PLACEHOLDER,
    (whole, kind: string | undefined, body: string | undefined, bare: string | undefined, offset: number) => {
      const type = kind ?? bare;
      if (type === "asOf") {
        if (asOfSlot === "") {
          if (asOf === undefined) schemaFail("compileBoundSql: {{asOf}} requires asOf");
          asOfSlot = slot("asOf", dateOnly(asOf));
        }
        return asOfSlot;
      }
      if (type === "offset") return slot("offset", (pageOf(values) - 1) * pageSizeOf(values));
      if (type === "param") {
        const key = body ?? "";
        if (key === "page") return slot("param:page", pageOf(values));
        if (key === "pageSize") return slot("param:pageSize", pageSizeOf(values));
        const value = values[key];
        return slot(`param:${key}`, value === undefined ? null : value);
      }
      if (type === "like") {
        const key = body ?? "";
        const value = values[key];
        return slot(
          `like:${key}`,
          value === undefined || value === "" ? null : `%${String(value)}%`,
        );
      }
      if (type === "status") {
        const status = (body ?? "").slice((body ?? "").indexOf(".") + 1);
        return `'${status.replace(/'/g, "''")}'`;
      }
      if (type === "ledgerNet") {
        const [target, alias] = (body ?? "").split(".");
        if (!target || !alias) schemaFail("compileBoundSql: {{ledgerNet:}} must be ledger.alias");
        return ledgerNetFor(target, alias, "compileBoundSql");
      }
      const rest = sqlText.slice(offset + whole.length);
      const aliasMatch = rest.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)/);
      const alias = aliasMatch?.[1];
      if (alias === undefined) schemaFail(`compileBoundSql: ${whole} is missing an alias`);
      if (type === "table") {
        const [module, through] = (body ?? "").split(".");
        const table = businessTableName(module ?? "", through && through !== "" ? through : null);
        aliases[alias] = table;
        return table;
      }
      if (type === "ledger") {
        aliases[alias] = "oe_effect_ledger";
        return `(SELECT * FROM oe_effect_ledger WHERE target = '${(body ?? "").replace(/'/g, "''")}')`;
      }
      schemaFail(`compileBoundSql: unknown placeholder ${whole}`);
    },
  );
  return { sql, params, aliases };
}

export function stripLimitOffset(sqlText: string): string | null {
  const match = sqlText.match(/\s+LIMIT\s+\$\d+\s+OFFSET\s+\$\d+\s*$/i);
  if (match === null || match.index === undefined) return null;
  return sqlText.slice(0, match.index);
}
