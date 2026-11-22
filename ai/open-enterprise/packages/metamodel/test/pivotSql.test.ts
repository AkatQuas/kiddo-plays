// @vitest-environment jsdom
// catalog. Jsdom skips firmCatalog.setup.
import { describe, expect, it } from "vitest";
import {
  applyPivotParamRules,
  bindPivotModules,
  compilePivotFilterOptionsSql,
  compilePivotSql,
  paramsWithoutOwnDimFilter,
  defineFixtureModule,
  defineSurfaces,
  normalizeSurfaceParams,
  pivotActiveAttrs,
  surfacePivotListing,
} from "../src/index.js";

function archive(
  code: string,
  label: string,
  fields: readonly Record<string, unknown>[],
  statuses: readonly Record<string, unknown>[] = [{ key: "active", initial: true, terminal: true }],
) {
  const first = fields[0];
  if (first === undefined || typeof first["key"] !== "string") throw new Error("fields[0].key");
  return defineFixtureModule({
    code,
    label,
    domain: "test",
    fields,
    lifecycle: { statuses, transitions: [] },
    views: { list: { columns: [first["key"]] } },
  });
}

const worker = archive("worker", "Worker", [
  { key: "name", label: "Name", type: "string", required: true, primary: true },
  { key: "level", label: "Level", type: "number" },
]);
const team = archive("team", "Team", [
  { key: "name", label: "Name", type: "string", required: true, primary: true },
]);
const operation = archive("operation", "Operation", [
  { key: "name", label: "Name", type: "string", required: true, primary: true },
]);
const dispatch = archive("dispatch", "Assignment", [
  { key: "code", label: "Document number", type: "string", required: true, primary: true },
  { key: "workerId", label: "Worker", type: "ref", ref: "worker", required: true },
  { key: "teamId", label: "Team", type: "ref", ref: "team", required: true },
]);
const workReport = archive(
  "workReport",
  "Work report",
  [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "workerId", label: "Worker", type: "ref", ref: "worker", required: true },
    { key: "teamId", label: "Team", type: "ref", ref: "team", required: true },
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
    { key: "dispatchId", label: "Assignment", type: "ref", ref: "dispatch" },
    { key: "occurredAt", label: "Occurred at", type: "datetime", required: true },
    { key: "qty", label: "Quantity", type: "number", required: true },
    { key: "hours", label: "Hours", type: "number", required: true },
  ],
  [{ key: "completed", initial: true, terminal: true }],
);
const scrapReport = archive(
  "scrapReport",
  "Scrap",
  [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "workerId", label: "Worker", type: "ref", ref: "worker", required: true },
    { key: "teamId", label: "Team", type: "ref", ref: "team", required: true },
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
    { key: "occurredAt", label: "Occurred at", type: "datetime", required: true },
    { key: "scrapQty", label: "Scrap quantity", type: "number", required: true },
  ],
  [{ key: "posted", initial: true, terminal: true }],
);
const scrapOther = archive(
  "scrapOther",
  "Other scrap",
  [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "workerId", label: "Worker", type: "ref", ref: "team", required: true },
    { key: "occurredAt", label: "Occurred at", type: "datetime", required: true },
    { key: "scrapQty", label: "Scrap quantity", type: "number", required: true },
  ],
  [{ key: "posted", initial: true, terminal: true }],
);

const modules = { worker, team, operation, dispatch, workReport, scrapReport, scrapOther };

const pivot = {
  facts: [
    {
      module: "workReport",
      status: ["completed"],
      dateField: "occurredAt",
      measures: { qtyCompleted: { field: "qty" }, hours: { field: "hours" } },
    },
    {
      module: "scrapReport",
      status: ["posted"],
      dateField: "occurredAt",
      measures: { scrapQty: { field: "scrapQty" } },
    },
  ],
  dimensions: {
    worker: { label: "Worker", path: ["workerId"], filterable: true },
    team: { label: "Team", path: ["teamId"], filterable: true },
    operation: { label: "Operation", path: ["operationId"], filterable: false },
  },
  measures: {
    qtyCompleted: { label: "Finished quantity", format: "integer", expr: { kind: "sum", of: "qtyCompleted" } },
    hours: { label: "Hours", format: "integer", expr: { kind: "sum", of: "hours" } },
    scrapQty: { label: "Scrap quantity", format: "integer", expr: { kind: "sum", of: "scrapQty" } },
    outputQty: { label: "Output quantity", format: "integer", expr: { kind: "add", left: "qtyCompleted", right: "scrapQty" } },
    yieldRate: {
      label: "Yield",
      format: "percent",
      expr: { kind: "ratio", numerator: "qtyCompleted", denominator: "outputQty", scale: 100 },
    },
  },
  defaultRowDims: ["worker", "team"],
  requiredRowDims: [],
  maxRangeDays: 62,
};

const base = {
  label: "Production report",
  permission: "system:productionReport:read",
  path: "/_production-report",
  pivot,
};

function definePivot(over: Record<string, unknown> = {}, catalog = modules) {
  const surfaces = defineSurfaces({ productionReport: { ...base, ...over } });
  const surface = surfaces["productionReport"];
  if (surface?.pivot) bindPivotModules(surface.pivot, catalog, "surfaces.productionReport.pivot");
  return surfaces;
}

function surfaceOf(over: Record<string, unknown> = {}) {
  const surfaces = defineSurfaces({ productionReport: { ...base, ...over } });
  const surface = surfaces["productionReport"];
  if (surface === undefined || surface.pivot === null) throw new Error("productionReport");
  const resolved = bindPivotModules(surface.pivot, modules, "surfaces.productionReport.pivot");
  return { surface, resolved };
}

describe("pivot declaration gate", () => {
  it.each([
    ["pivot+sql both set", { sql: "SELECT 1 FROM {{table:workReport}} f" }, /exactly one/],
    ["pivot+modes both set", { modes: { a: "SELECT 1 FROM {{table:workReport}} f" } }, /exactly one/],
    ["none of three", { pivot: null }, /exactly one/],
    ["handwritten params", { params: [] }, /pivot su/],
    ["handwritten columns", { columns: [{ key: "qty", label: "Count", type: "number" }] }, /pivot su/],
    [
      "unknown fact module",
      { pivot: { ...pivot, facts: [{ ...pivot.facts[0]!, module: "missing" }, pivot.facts[1]!] } },
      /unknown module "missing"/,
    ],
    [
      "empty status",
      { pivot: { ...pivot, facts: [{ ...pivot.facts[0]!, status: [] }, pivot.facts[1]!] } },
      /status must not be empty/,
    ],
    [
      "unknown status",
      { pivot: { ...pivot, facts: [{ ...pivot.facts[0]!, status: ["nope"] }, pivot.facts[1]!] } },
      /is not a status of module "workReport"/,
    ],
    [
      "dateField not datetime",
      { pivot: { ...pivot, facts: [{ ...pivot.facts[0]!, dateField: "qty" }, pivot.facts[1]!] } },
      /must be datetime/,
    ],
    [
      "fact measure field not number",
      {
        pivot: {
          ...pivot,
          facts: [
            { ...pivot.facts[0]!, measures: { qtyCompleted: { field: "workerId" }, hours: { field: "hours" } } },
            pivot.facts[1]!,
          ],
        },
      },
      /must be a numeric field/,
    ],
    [
      "duplicate fact measure keys",
      {
        pivot: {
          ...pivot,
          facts: [pivot.facts[0]!, { ...pivot.facts[1]!, measures: { qtyCompleted: { field: "scrapQty" } } }],
        },
      },
      /fact measure "qtyCompleted" is duplicated/,
    ],
    [
      "path empty",
      {
        pivot: {
          ...pivot,
          dimensions: { ...pivot.dimensions, worker: { ...pivot.dimensions["worker"]!, path: [] } },
        },
      },
      /must be 1 or 2 hops/,
    ],
    [
      "path >2 hops",
      {
        pivot: {
          ...pivot,
          dimensions: {
            ...pivot.dimensions,
            worker: { ...pivot.dimensions["worker"]!, path: ["workerId", "teamId", "operationId"] },
          },
        },
      },
      /must be 1 or 2 hops/,
    ],
    [
      "first hop missing on a fact",
      {
        pivot: {
          ...pivot,
          dimensions: { ...pivot.dimensions, worker: { ...pivot.dimensions["worker"]!, path: ["missingId"] } },
        },
      },
      /has no field/,
    ],
    [
      "first hop refs different modules",
      {
        pivot: {
          ...pivot,
          facts: [pivot.facts[0]!, { ...pivot.facts[1]!, module: "scrapOther" }],
        },
      },
      /the first hop must point at the same module on every fact/,
    ],
    [
      "hop not a ref",
      {
        pivot: {
          ...pivot,
          dimensions: { ...pivot.dimensions, worker: { ...pivot.dimensions["worker"]!, path: ["qty"] } },
        },
      },
      /must be a ref field/,
    ],
    [
      "defaultRowDims empty",
      { pivot: { ...pivot, defaultRowDims: [] } },
      /defaultRowDims must not be empty/,
    ],
    [
      "defaultRowDims unknown",
      { pivot: { ...pivot, defaultRowDims: ["nope"] } },
      /is not a key of dimensions/,
    ],
    ["maxRangeDays not positive int", { pivot: { ...pivot, maxRangeDays: 0 } }, /must be a positive integer/],
    [
      "measure expr cycle",
      {
        pivot: {
          ...pivot,
          measures: {
            ...pivot.measures,
            outputQty: { label: "Output quantity", format: "integer", expr: { kind: "add", left: "yieldRate", right: "scrapQty" } },
            yieldRate: {
              label: "Yield",
              format: "percent",
              expr: { kind: "ratio", numerator: "qtyCompleted", denominator: "outputQty", scale: 100 },
            },
          },
        },
      },
      /cyclic reference/,
    ],
    [
      "measure expr dangling ref",
      {
        pivot: {
          ...pivot,
          measures: {
            ...pivot.measures,
            outputQty: { label: "Output quantity", format: "integer", expr: { kind: "add", left: "qtyCompleted", right: "missing" } },
          },
        },
      },
      /unknown measure "missing"/,
    ],
    [
      "ratio referring unknown measure",
      {
        pivot: {
          ...pivot,
          measures: {
            ...pivot.measures,
            yieldRate: {
              label: "Yield",
              format: "percent",
              expr: { kind: "ratio", numerator: "qtyCompleted", denominator: "missing", scale: 100 },
            },
          },
        },
      },
      /unknown measure "missing"/,
    ],
    [
      "add referring unknown measure",
      {
        pivot: {
          ...pivot,
          measures: {
            ...pivot.measures,
            outputQty: { label: "Output quantity", format: "integer", expr: { kind: "add", left: "nope", right: "scrapQty" } },
          },
        },
      },
      /unknown measure "nope"/,
    ],
    [
      "sum.of not a fact measure",
      {
        pivot: {
          ...pivot,
          measures: {
            ...pivot.measures,
            qtyCompleted: { label: "Finished quantity", format: "integer", expr: { kind: "sum", of: "outputQty" } },
          },
        },
      },
      /is not a fact measure/,
    ],
    [
      "reserved dim order",
      {
        pivot: {
          ...pivot,
          dimensions: {
            ...pivot.dimensions,
            order: { label: "Order", path: ["workerId"], filterable: false },
          },
        },
      },
      /is an SQL reserved word/,
    ],
    [
      "reserved dim user",
      {
        pivot: {
          ...pivot,
          dimensions: {
            ...pivot.dimensions,
            user: { label: "User", path: ["workerId"], filterable: false },
          },
        },
      },
      /is an SQL reserved word/,
    ],
    [
      "reserved dim group",
      {
        pivot: {
          ...pivot,
          dimensions: {
            ...pivot.dimensions,
            group: { label: "Group", path: ["workerId"], filterable: false },
          },
        },
      },
      /is an SQL reserved word/,
    ],
  ] as const)("%s", (_name, over, pattern) => {
    expect(() => definePivot(over)).toThrow(pattern);
  });

  it("shape Passes without module directory", () => {
    const surfaces = defineSurfaces({ productionReport: base });
    expect(surfaces["productionReport"]?.pivot).not.toBeNull();
    expect(surfaces["productionReport"]?.reads.modules).toEqual(["workReport", "scrapReport"]);
  });

  it("bind later reads with fact and dimension hop modules", () => {
    const { surface, resolved } = surfaceOf();
    expect(resolved.reads.modules).toEqual(["workReport", "scrapReport", "worker", "team", "operation"]);
    expect(surface.reads.modules).toEqual(["workReport", "scrapReport"]);
  });

  it("actually measure / measure key", () => {
    expect(() => definePivot({
      pivot: {
        ...pivot,
        facts: [
          { ...pivot.facts[0]!, measures: { ...pivot.facts[0]!.measures, user: { field: "qty" } } },
          pivot.facts[1]!,
        ],
      },
    })).toThrow(/is an SQL reserved word/);
    expect(() => definePivot({
      pivot: {
        ...pivot,
        measures: {
          ...pivot.measures,
          group: { label: "Group", format: "integer", expr: { kind: "sum", of: "qtyCompleted" } },
        },
      },
    })).toThrow(/is an SQL reserved word/);
  });
});

describe("pivot piems / columns", () => {
  const { surface, resolved } = surfaceOf();

  it("params: regular order, stingList, page/pageSize, sortBy=measure keys", () => {
    expect(surface.params.map((param) => param.key)).toEqual([
      "rowDims",
      "colDim",
      "dateFrom",
      "dateTo",
      "worker",
      "team",
      "sortBy",
      "sortCol",
      "sortDesc",
      "page",
      "pageSize",
    ]);
    expect(surface.params.find((param) => param.key === "rowDims")?.type).toBe("stringList");
    expect(surface.params.find((param) => param.key === "worker")?.type).toBe("stringList");
    expect(surface.params.find((param) => param.key === "dateFrom")?.required).toBe(true);
    expect(surface.params.find((param) => param.key === "dateTo")?.required).toBe(true);
    expect(surface.params.find((param) => param.key === "page")?.type).toBe("integer");
    expect(surface.params.find((param) => param.key === "pageSize")?.type).toBe("integer");
    expect(surface.params.find((param) => param.key === "sortBy")?.options?.map((option) => option.value)).toEqual([
      "qtyCompleted",
      "hours",
      "scrapQty",
      "outputQty",
      "yieldRate",
    ]);
    expect(surface.params.find((param) => param.key === "operation")).toBeUndefined();
  });

  it("columns: dim + dimLabel and measures", () => {
    expect(surface.columns.map((column) => column.key)).toEqual([
      "worker",
      "workerLabel",
      "team",
      "teamLabel",
      "operation",
      "operationLabel",
      "qtyCompleted",
      "hours",
      "scrapQty",
      "outputQty",
      "yieldRate",
    ]);
    expect(surface.columns.filter((column) => column.key.endsWith("Label")).every((column) => column.type === "string")).toBe(true);
    expect(surface.columns.find((column) => column.key === "yieldRate")?.type).toBe("number");
  });

  it("only contract fields", () => {
    expect(surfacePivotListing(resolved)).toEqual({
      dimensions: [
        { key: "worker", label: "Worker", module: "worker" },
        { key: "team", label: "Team", module: "team" },
        { key: "operation", label: "Operation", module: "operation" },
      ],
      measures: [
        { key: "qtyCompleted", label: "Finished quantity", format: "integer" },
        { key: "hours", label: "Hours", format: "integer" },
        { key: "scrapQty", label: "Scrap quantity", format: "integer" },
        { key: "outputQty", label: "Output quantity", format: "integer" },
        { key: "yieldRate", label: "Yield", format: "percent" },
      ],
      defaultRowDims: ["worker", "team"],
      requiredRowDims: [],
      maxRangeDays: 62,
      defaultSort: "labelAsc",
    });
  });
});

describe("pivot running time parameters", () => {
  const { surface } = surfaceOf();

  it("missing date, bad format, spacing,rowDims/colDim/sortDesc; emptyrowDims", () => {
    const at = "productionReport";
    expect(() => normalizeSurfaceParams(surface.params, {}, at, surface.pivot)).toThrow(/dateFrom is required/);
    expect(() =>
      normalizeSurfaceParams(surface.params, { dateFrom: ["2026-09-01"] }, at, surface.pivot),
    ).toThrow(/dateTo is required/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["09-01"], dateTo: ["2026-09-02"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-10"], dateTo: ["2026-09-01"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/cannot be earlier than/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-01-01"], dateTo: ["2026-12-31"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/maxRangeDays/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"], rowDims: ["worker", "worker"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/must not contain duplicates/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"], rowDims: ["nope"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/is not a key of dimensions/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"], colDim: ["nope"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/is not a key of dimensions/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"], rowDims: ["worker"], colDim: ["worker"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/must not appear in rowDims/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"], sortDesc: ["true"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/may be used only when sortBy is given/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"], sortBy: ["nope"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/unknown/);
    expect(
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-07"] },
        at,
        surface.pivot,
      )["rowDims"],
    ).toEqual(["worker", "team"]);
  });

  it("sortCol: fill in column and sortBy; no column or sortBy rejects", () => {
    const at = "productionReport";
    const dates = { dateFrom: ["2026-09-01"], dateTo: ["2026-09-02"] };
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { ...dates, colDim: ["operation"], sortBy: ["qtyCompleted"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/sortCol is required/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { ...dates, sortBy: ["qtyCompleted"], sortCol: ["op-1"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/sortCol may be used only when there is a column dimension/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { ...dates, sortCol: ["op-1"] },
        at,
        surface.pivot,
      ),
    ).toThrow(/sortCol may be used only when sortBy is given/);
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { ...dates, colDim: ["operation"], sortBy: ["qtyCompleted"], sortCol: [""] },
        at,
        surface.pivot,
      ),
    ).toThrow(/sortCol is required/);
    const pivot = surface.pivot;
    if (pivot === null) throw new Error("pivot");
    expect(() =>
      applyPivotParamRules(
        pivot,
        {
          rowDims: ["worker", "team"],
          colDim: "operation",
          dateFrom: "2026-09-01",
          dateTo: "2026-09-02",
          sortBy: "qtyCompleted",
          sortCol: "",
        },
        at,
      ),
    ).toThrow(/sortCol is required/);
  });
});

describe("compilePivotSql", () => {
  const { surface, resolved } = surfaceOf();
  const dates = { dateFrom: "2026-09-01", dateTo: "2026-09-07" };

  function sql(params: Readonly<Record<string, unknown>>, options: { timezone: string; unbounded?: boolean } = { timezone: "Asia/Shanghai" }) {
    return compilePivotSql(resolved, surface.columns, params, options);
  }

  it("with colDim: FULL JOIN, ratio, keys page, total, placeholder, time zone", () => {
    const compiled = sql({ ...dates, rowDims: ["worker", "team"], colDim: "operation" });
    expect(compiled.startsWith("WITH")).toBe(true);
    expect(compiled).toContain("FULL JOIN");
    expect(compiled).not.toContain("IS NOT DISTINCT FROM");
    expect(compiled).toMatch(/coalesce\(f\d+_worker_\d+\.id, ''\)/);
    expect(compiled).toContain("nullif(m.worker, '')");
    expect(compiled).toMatch(/FULL JOIN p_fact_1 f1\n    ON f0\.\w+ = f1\.\w+/);
    expect(compiled).toContain("LEFT JOIN");
    expect(compiled).toMatch(/round\(.*nullif.*, 0\).* \* 100, 2\)/);
    expect(compiled).toContain("p_keys AS");
    expect(compiled).toContain("LIMIT {{param:pageSize}} OFFSET {{offset}}");
    expect(compiled.indexOf("LIMIT {{param:pageSize}}")).toBeLessThan(compiled.lastIndexOf("FROM p_measured m"));
    expect(compiled).toContain("count(*) OVER() AS _total");
    expect(compiled).toContain("k._total AS _total");
    expect(compiled).toContain("{{param:dateFrom}}");
    expect(compiled).toContain("{{param:dateTo}}");
    expect(compiled).toContain("{{table:workReport}}");
    expect(compiled).toContain("{{table:scrapReport}}");
    expect(compiled).toContain("{{table:worker}}");
    expect(compiled).toContain("{{status:workReport.completed}}");
    expect(compiled).toContain("AT TIME ZONE 'Asia/Shanghai'");
    expect(compiled).not.toMatch(/AT TIME ZONE '(UTC|Asia\/Chongqing)'/);
    expect(compiled).not.toContain("ANY({{param:worker}}");
    expect(compiled).not.toMatch(/\bNULL AS operation\b/);
    expect(compiled).toContain("INNER JOIN p_keys k");
    expect(compiled).toContain("coalesce(sum(");
    expect(compiled).not.toMatch(/coalesce\([A-Za-z0-9_.]+, 0\)/);
    expect(compiled).toContain("ASC NULLS LAST");
  });

  it("unbounded: keeps no pages", () => {
    const compiled = sql(
      { ...dates, rowDims: ["worker", "team"], colDim: "operation" },
      { timezone: "Asia/Shanghai", unbounded: true },
    );
    expect(compiled).toContain("p_keys AS");
    expect(compiled).not.toContain("LIMIT {{param:pageSize}}");
    expect(compiled).not.toContain("{{offset}}");
    expect(compiled).toContain("count(*) OVER() AS _total");
  });

  it("noout colDim: Unselected dimensions as NULL", () => {
    const compiled = sql({ ...dates, rowDims: ["worker", "team"] });
    expect(compiled).not.toContain("colDim");
    expect(compiled).toContain("NULL AS operation");
    expect(compiled).toContain("NULL AS operation_label");
    expect(compiled).toContain("FULL JOIN");
  });

  it("♪ With Philter: Striking List ♪", () => {
    const withFilter = sql({ ...dates, rowDims: ["worker", "team"], worker: ["w1", "w2"] });
    expect(withFilter).toContain("= ANY({{param:worker}}::text[])");
    const without = sql({ ...dates, rowDims: ["worker", "team"] });
    expect(without).not.toContain("ANY({{param:worker}}");
  });

  it("with sortBy: grouping by lines; without dimension", () => {
    const sorted = sql({ ...dates, rowDims: ["worker", "team"], sortBy: "qtyCompleted", sortDesc: true });
    expect(sorted).toContain("sum(m.qty_completed) DESC NULLS LAST");
    expect(sorted).toContain("DESC NULLS LAST");
    expect(sorted).not.toMatch(/coalesce\([A-Za-z0-9_.]+, 0\)/);
    const unsorted = sql({ ...dates, rowDims: ["worker", "team"] });
    expect(unsorted).toContain("k_worker.name ASC NULLS LAST");
    expect(unsorted).not.toContain("sum(m.qty_completed)");
    const orderExpr = "sum(m.qty_completed) FILTER (WHERE m.operation = {{param:sortCol}}) DESC NULLS LAST";
    const colSorted = sql({
      ...dates,
      rowDims: ["worker", "team"],
      colDim: "operation",
      sortBy: "qtyCompleted",
      sortCol: "op-1",
      sortDesc: true,
    });
    expect(colSorted).toContain(orderExpr);
    const grouped = colSorted.slice(colSorted.indexOf("p_grouped AS"), colSorted.indexOf("p_keys AS"));
    expect(grouped).toContain(`row_number() OVER (ORDER BY ${orderExpr})`);
    expect(grouped.split(orderExpr).length - 1).toBe(1);
    const finalSelect = colSorted.slice(colSorted.indexOf("\nSELECT\n"));
    expect(finalSelect).not.toContain(orderExpr);
    expect(finalSelect).toContain("m.qty_completed AS qty_completed");
  });

  it("oRDER BY", () => {
    const compiled = sql({ ...dates, rowDims: ["worker", "team"], sortBy: "yieldRate" });
    expect(compiled).toMatch(/round\(\(sum\(m\.qty_completed\)\) \/ nullif\(\(\(sum\(m\.qty_completed\) \+ sum\(m\.scrap_qty\)\)\), 0\) \* 100, 2\)/);
    expect(compiled).toContain("FROM p_merged m");
    expect(compiled).not.toContain("sum(m.yield_rate)");
    const filter = "FILTER (WHERE m.operation = {{param:sortCol}})";
    const colSorted = sql({
      ...dates,
      rowDims: ["worker", "team"],
      colDim: "operation",
      sortBy: "yieldRate",
      sortCol: "op-1",
    });
    expect(colSorted).toContain(
      `round((sum(m.qty_completed) ${filter}) / nullif(((sum(m.qty_completed) ${filter} + sum(m.scrap_qty) ${filter})), 0) * 100, 2)`,
    );
    expect(colSorted).not.toContain("sum(m.yield_rate)");
  });

  it("timezone from Parameters, Do Not Write Dead", () => {
    const sh = sql({ ...dates, rowDims: ["worker", "team"] }, { timezone: "Asia/Shanghai" });
    const utc = sql({ ...dates, rowDims: ["worker", "team"] }, { timezone: "UTC" });
    expect(sh).toContain("AT TIME ZONE 'Asia/Shanghai'");
    expect(utc).toContain("AT TIME ZONE 'UTC'");
    expect(utc).not.toContain("Asia/Shanghai");
  });

  it("2 Jump Path Continuous LEFT JOIN", () => {
    const surfaces = defineSurfaces({
      productionReport: {
        ...base,
        pivot: {
          facts: [pivot.facts[0]],
          dimensions: {
            worker: { label: "Worker", path: ["dispatchId", "workerId"], filterable: false },
          },
          measures: {
            qtyCompleted: { label: "Finished quantity", format: "integer", expr: { kind: "sum", of: "qtyCompleted" } },
          },
          defaultRowDims: ["worker"],
          requiredRowDims: [],
          maxRangeDays: 31,
        },
      },
    });
    const twoHop = surfaces["productionReport"]!;
    if (twoHop.pivot === null) throw new Error("twoHop.pivot");
    const resolvedTwo = bindPivotModules(twoHop.pivot, modules, "twoHop");
    const compiled = compilePivotSql(resolvedTwo, twoHop.columns, { ...dates, rowDims: ["worker"] }, { timezone: "UTC" });
    expect(compiled).toContain("LEFT JOIN {{table:dispatch}}");
    expect(compiled).toContain("LEFT JOIN {{table:worker}}");
    expect(compiled).toContain(".dispatch_id");
    expect(compiled).toContain(".worker_id");
    expect(compiled).not.toContain("FULL JOIN");
  });

  it("production report SQL still FORM header, no h aliases mandatory", () => {
    const compiled = sql({ ...dates, rowDims: ["worker", "team"] });
    expect(compiled).toContain("FROM {{table:workReport}} f");
    expect(compiled).toContain("FROM {{table:scrapReport}} f");
    expect(compiled).not.toContain("INNER JOIN {{table:workReport}} h");
    expect(compiled).not.toContain("{{table:workReport.lines}}");
  });

  it("compile doesn't fix RowDims, first normalize", () => {
    expect(() => sql(dates)).toThrow(/must already have passed normalizeSurfaceParams/);
  });

  it("sortBy must take sotCol; sotCol cannot be given alone or without Levi", () => {
    expect(() => sql({
      ...dates,
      rowDims: ["worker", "team"],
      colDim: "operation",
      sortBy: "qtyCompleted",
    })).toThrow(/must include sortCol/);
    expect(() => sql({
      ...dates,
      rowDims: ["worker", "team"],
      colDim: "operation",
      sortBy: "qtyCompleted",
      sortCol: "",
    })).toThrow(/must include sortCol/);
    expect(() => sql({
      ...dates,
      rowDims: ["worker", "team"],
      sortBy: "qtyCompleted",
      sortCol: "op-1",
    })).toThrow(/sortCol may be used only when there is a column dimension/);
    expect(() => sql({
      ...dates,
      rowDims: ["worker", "team"],
      colDim: "operation",
      sortCol: "op-1",
    })).toThrow(/sortCol may be used only when sortBy is given/);
  });

  it("SQL with column axes with enviments; no enviments excluding cols", () => {
    const compiled = sql({ ...dates, rowDims: ["worker", "team"], colDim: "operation" });
    expect(compiled).toContain("p_grouped");
    expect(compiled).toContain("AS _cols");
    expect(compiled).toContain("jsonb_agg");
    expect(compiled).toContain("ORDER BY s.label ASC NULLS LAST, s.id ASC NULLS LAST");
    expect(compiled).toMatch(/INNER JOIN p_grouped k[\s\S]*AS _cols/);
    expect(compiled).not.toMatch(/INNER JOIN p_keys k[\s\S]*AS _cols/);
    const plain = sql({ ...dates, rowDims: ["worker", "team"] });
    expect(plain).not.toContain("_cols");
    expect(plain).not.toContain("colDim");
  });
});

const subject = archive("subject", "System account", [
  { key: "displayName", label: "Display name", type: "string", required: true, primary: true },
]);
const customer = archive("customer", "Customer", [
  { key: "name", label: "Name", type: "string", required: true, primary: true },
]);
const productFamily = archive("productFamily", "Product", [
  { key: "name", label: "Name", type: "string", required: true, primary: true },
  { key: "code", label: "Product code", type: "string", required: true },
  { key: "mainUnit", label: "Main unit", type: "enum", choiceSet: "inventory.unit" },
]);
const skuProduct = defineFixtureModule({
  code: "product",
  label: "SKU",
  domain: "test",
  fields: [
    { key: "name", label: "Name", type: "string", required: true, primary: true },
    { key: "spec", label: "Specification", type: "string", required: true },
    { key: "productFamilyId", label: "Product", type: "ref", ref: "productFamily", required: true },
    {
      key: "familyCode",
      label: "Product code",
      type: "string",
      derive: { kind: "lookup", from: "productFamily", match: "productFamilyId", field: "code" },
    },
    { key: "mainUnit", label: "Main unit", type: "enum", choiceSet: "inventory.unit" },
  ],
  lifecycle: { statuses: [{ key: "active", initial: true, terminal: true }], transitions: [] },
  views: { list: { columns: ["name"], referenceLabel: ["name", "familyCode", "spec"], referenceLabelSeparator: "/" } },
});
const salesDelivery = archive(
  "salesDelivery",
  "Shipment",
  [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "salesDeliveryLine",
      fields: [
        { key: "orderLineId", label: "Order line", type: "string", required: true },
        { key: "baseQty", label: "Quantity", type: "number", required: true },
      ],
    },
  ],
  [{ key: "shipped", initial: true, terminal: true }],
);
const salesOrder = defineFixtureModule({
  code: "salesOrder",
  label: "Sales order",
  domain: "test",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    { key: "salesperson", label: "Salesperson", type: "ref", ref: "subject" },
    { key: "promiseDate", label: "Delivery date", type: "date" },
    { key: "qty", label: "Header quantity", type: "number" },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "salesOrderLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "unit", label: "Unit", type: "string", required: true },
        { key: "baseQty", label: "Quantity", type: "number", required: true },
        { key: "qty", label: "Line quantity", type: "number" },
        {
          key: "shippedBaseQty",
          label: "Shipped",
          type: "number",
          derive: {
            kind: "rollup",
            from: "salesDelivery",
            through: "lines",
            match: "orderLineId",
            measure: "sum(baseQty)",
            where: { status: "shipped" },
          },
        },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "inProgress", initial: true, terminal: false },
      { key: "completed", initial: false, terminal: true },
    ],
    transitions: [{ code: "complete", from: "inProgress", to: "completed", action: "Complete" }],
  },
  views: { list: { columns: ["code"] } },
});

const deliveryModules = { customer, productFamily, product: skuProduct, salesDelivery, salesOrder, subject };

const deliveryPivot = {
  facts: [{
    module: "salesOrder",
    through: "lines",
    status: ["inProgress", "completed"],
    dateField: "createdAt",
    measures: {
      ordered: { field: "baseQty" },
      shipped: { field: "shippedBaseQty" },
    },
  }],
  dimensions: {
    customer: { label: "Customer", path: ["customerId"], filterable: true },
    salesperson: { label: "Salesperson", path: ["salesperson"], filterable: true },
    product: {
      label: "Product",
      path: ["productId", "productFamilyId"],
      filterable: true,
      attrs: { productUnit: { label: "Unit", field: "mainUnit" } },
    },
    sku: { label: "Product spec", path: ["productId"], filterable: true },
    salesOrder: { label: "Sales number", on: "header", field: "id", filterable: true },
    promiseDate: { label: "Delivery date", on: "header", field: "promiseDate", filterable: true, filter: "dateRange" },
    overdue: {
      label: "Overdue status",
      on: "header",
      field: "promiseDate",
      filterable: true,
      bucket: "pastDue",
      options: { past: "Overdue", notPast: "inProgress" },
    },
  },
  measures: {
    ordered: { label: "Order count", format: "integer", expr: { kind: "sum", of: "ordered" } },
    shipped: { label: "Total shipped", format: "integer", expr: { kind: "sum", of: "shipped" } },
    unshipped: { label: "Total not shipped", format: "integer", expr: { kind: "sub", left: "ordered", right: "shipped" } },
    progress: {
      label: "Shipment progress",
      format: "percent",
      expr: { kind: "ratio", numerator: "shipped", denominator: "ordered", scale: 100 },
      filter: "range",
    },
  },
  defaultRowDims: ["product", "customer", "salesperson"],
  requiredRowDims: ["product"],
  maxRangeDays: 731,
  defaultSort: "dateDesc",
} as const;

const deliveryBase = {
  label: "Promise-date report",
  permission: "system:deliveryReport:read",
  path: "/_delivery-report",
  pivot: deliveryPivot,
};

function deliverySurface(over: Record<string, unknown> = {}) {
  const surfaces = defineSurfaces({ deliveryReport: { ...deliveryBase, ...over } });
  const surface = surfaces["deliveryReport"];
  if (surface === undefined || surface.pivot === null) throw new Error("deliveryReport");
  const resolved = bindPivotModules(surface.pivot, deliveryModules, "surfaces.deliveryReport.pivot");
  return { surface, resolved };
}

describe("pivot", () => {
  const dates = { dateFrom: "2026-09-01", dateTo: "2026-09-07" };

  function compileDelivery(
    surface: ReturnType<typeof deliverySurface>["surface"],
    resolved: ReturnType<typeof deliverySurface>["resolved"],
    values: Record<string, unknown> = {},
  ): string {
    const raw: Record<string, string[]> = {
      dateFrom: [dates.dateFrom],
      dateTo: [dates.dateTo],
    };
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue;
      raw[key] = Array.isArray(value) ? value.map(String) : [String(value)];
    }
    const params = normalizeSurfaceParams(surface.params, raw, "deliveryReport", surface.pivot);
    return compilePivotSql(resolved, surface.columns, params, { timezone: "Asia/Shanghai" });
  }

  it("declaration period", () => {
    const { surface, resolved } = deliverySurface();
    expect(surface.reads.modules).toEqual(["salesOrder"]);
    expect(resolved.reads.modules).toContain("salesDelivery");
    expect(resolved.reads.modules).toEqual(expect.arrayContaining([
      "salesOrder",
      "customer",
      "product",
      "productFamily",
      "salesDelivery",
      "subject",
    ]));
  });

  it("it has to be detailed.", () => {
    expect(() => deliverySurface({
      pivot: { ...deliveryPivot, facts: [{ ...deliveryPivot.facts[0], through: "code" }] },
    })).toThrow(/must be a line table of module "salesOrder"/);
  });

  it("through SQL with line tables and INNER JOIN header", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["customer", "salesperson", "product"] });
    expect(compiled).toContain("FROM {{table:salesOrder.lines}} f");
    expect(compiled).toContain("INNER JOIN {{table:salesOrder}} h ON h.id = f.bill_id");
    expect(compiled).toContain("h.status IN ({{status:salesOrder.inProgress}}, {{status:salesOrder.completed}})");
  });

  it("it's the same name as the watch.", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        facts: [{ ...deliveryPivot.facts[0], measures: { ...deliveryPivot.facts[0].measures, ordered: { field: "qty" } } }],
      },
    })).toThrow(/both the line and the header have field "qty"/);
  });

  it("rollup Query Walking {table:} Placed, no shifted base qty", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["customer"] });
    expect(compiled).toContain("{{table:salesDelivery.lines}}");
    expect(compiled).toContain("{{table:salesDelivery}}");
    expect(compiled).toContain("{{status:salesDelivery.shipped}}");
    expect(compiled).toContain("l.order_line_id = f.id");
    expect(compiled).not.toContain("shipped_base_qty");
  });

  it("on/field not ref;path and on", () => {
    const { resolved } = deliverySurface();
    const order = resolved.dimensions.find((dim) => dim.key === "salesOrder");
    expect(order?.path).toEqual([]);
    expect(order?.fieldAlias).toBe("h");
    expect(order?.endpointModule).toBe("salesOrder");
    const salesperson = resolved.dimensions.find((dim) => dim.key === "salesperson");
    expect(salesperson?.endpointModule).toBe("subject");
    expect(salesperson?.labelParts).toEqual([{ column: "display_name", lookup: null }]);
    expect(salesperson?.filter).toBeNull();
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          salesOrder: { ...deliveryPivot.dimensions.salesOrder, path: ["customerId"] },
        },
      },
    })).toThrow(/path and on\/field must be one or the other/);
  });

  it("listening: no penned/filterable, defaultSort; operator hop module subject", () => {
    const { surface, resolved } = deliverySurface();
    const listing = surfacePivotListing(resolved);
    expect(listing.defaultSort).toBe("dateDesc");
    expect(listing.defaultRowDims).toEqual(["product", "customer", "salesperson"]);
    expect(listing.requiredRowDims).toEqual(["product"]);
    expect(listing.dimensions.find((dim) => dim.key === "salesOrder")).toEqual({
      key: "salesOrder",
      label: "Sales number",
      module: "salesOrder",
    });
    expect(listing.dimensions.find((dim) => dim.key === "salesperson")).toEqual({
      key: "salesperson",
      label: "Salesperson",
      module: "subject",
    });
    expect(listing.dimensions.find((dim) => dim.key === "promiseDate")).toEqual({
      key: "promiseDate",
      label: "Delivery date",
      filter: "dateRange",
    });
    expect(listing.dimensions.find((dim) => dim.key === "overdue")).toEqual({
      key: "overdue",
      label: "Overdue status",
      options: [
        { value: "past", label: "Overdue" },
        { value: "notPast", label: "inProgress" },
      ],
    });
    expect(listing.dimensions.find((dim) => dim.key === "product")).toEqual({
      key: "product",
      label: "Product",
      module: "productFamily",
      attrs: [{ key: "productUnit", label: "Unit" }],
    });
    expect(listing.dimensions.find((dim) => dim.key === "sku")).toEqual({
      key: "sku",
      label: "Product spec",
      module: "product",
    });
    expect("attrs" in (listing.dimensions.find((dim) => dim.key === "sku") ?? {})).toBe(false);
    expect(listing.measures.map((measure) => measure.format)).toEqual([
      "integer", "integer", "integer", "percent",
    ]);
    expect(listing.measures.find((measure) => measure.key === "progress")).toEqual({
      key: "progress",
      label: "Shipment progress",
      format: "percent",
      filter: "range",
    });
    expect(listing.dimensions.every((dim) => !("pinned" in dim) && !("filterable" in dim))).toBe(true);
    expect(surface.params.find((param) => param.key === "salesperson")?.type).toBe("stringList");
    expect(surface.params.find((param) => param.key === "promiseDateFrom")?.type).toBe("string");
    expect(surface.params.find((param) => param.key === "promiseDateTo")?.type).toBe("string");
    expect(surface.params.find((param) => param.key === "overdue")?.type).toBe("stringList");
    expect(surface.params.find((param) => param.key === "progressMin")?.type).toBe("number");
    expect(surface.params.find((param) => param.key === "sortBy")?.options?.map((option) => option.value)).toEqual([
      "ordered", "shipped", "unshipped", "progress",
    ]);
    expect(surface.columns.find((column) => column.key === "promiseDate")?.type).toBe("string");
    expect(surface.columns.find((column) => column.key === "overdue")?.type).toBe("string");
    expect(surface.columns.find((column) => column.key === "productUnit")).toBeUndefined();
  });

  it("ignore rowDims using defaultRowDims; sales list entry line V", () => {
    const { surface } = deliverySurface();
    const at = "deliveryReport";
    expect(
      normalizeSurfaceParams(surface.params, { dateFrom: ["2026-09-01"], dateTo: ["2026-09-07"] }, at, surface.pivot)["rowDims"],
    ).toEqual(["product", "customer", "salesperson"]);
    expect(
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-07"], rowDims: ["salesOrder", "customer"] },
        at,
        surface.pivot,
      )["rowDims"],
    ).toEqual(["salesOrder", "customer"]);
  });

  it("defaultSort dateDesc", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["customer"] });
    expect(compiled).toContain("max(h.created_at) AS _sort_date");
    expect(compiled).toContain("max(m._sort_date) DESC NULLS LAST");
    const { surface: prod, resolved: prodResolved } = surfaceOf();
    const labelSorted = compilePivotSql(
      prodResolved,
      prod.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-07", rowDims: ["worker", "team"] },
      { timezone: "Asia/Shanghai" },
    );
    expect(labelSorted).toContain("k_worker.name ASC NULLS LAST");
    expect(labelSorted).not.toContain("_sort_date");
  });

  it("hAVING Progress Range Min/Max", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      progressMin: 10,
      progressMax: 90,
    });
    expect(compiled).toMatch(/HAVING .*>= \{\{param:progressMin\}\}/);
    expect(compiled).toMatch(/HAVING .*<= \{\{param:progressMax\}\}/);
  });

  it("wHERE Closed interval; missing side only adds one", () => {
    const { surface, resolved } = deliverySurface();
    const both = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      promiseDateFrom: "2026-09-01",
      promiseDateTo: "2026-09-30",
    });
    expect(both).toContain("h.promise_date >= {{param:promiseDateFrom}}::date");
    expect(both).toContain("h.promise_date <= {{param:promiseDateTo}}::date");
    expect(both).not.toContain("{{param:promiseDateTo}}::date + 1");
    expect(both).not.toMatch(/promise_date >= \({{param:promiseDateFrom}}::date\)::timestamp AT TIME ZONE/);
    const fromOnly = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      promiseDateFrom: "2026-09-01",
    });
    expect(fromOnly).toContain("h.promise_date >= {{param:promiseDateFrom}}::date");
    expect(fromOnly).not.toContain("{{param:promiseDateTo}}");
    const toOnly = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      promiseDateTo: "2026-09-30",
    });
    expect(toOnly).toContain("h.promise_date <= {{param:promiseDateTo}}::date");
    expect(toOnly).not.toContain("{{param:promiseDateFrom}}::date");
  });

  it("date dimension", () => {
    const { surface } = deliverySurface();
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        {
          dateFrom: ["2026-09-01"],
          dateTo: ["2026-09-07"],
          promiseDateFrom: ["2026-09-10"],
          promiseDateTo: ["2026-09-01"],
        },
        "deliveryReport",
        surface.pivot,
      ),
    ).toThrow(/promiseDateTo cannot be earlier than promiseDateFrom/);
  });

  it("date on dimension coalesce empty string, return NULL with nulrif", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["promiseDate"] });
    expect(compiled).toContain("coalesce(h.promise_date::text, '')");
    expect(compiled).toContain("nullif(m.promise_date, '') AS promise_date");
    expect(compiled).toContain("nullif(m.promise_date, '') AS promise_date_label");
  });

  it("bucket dimension CASE shape and tab map", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["overdue"] });
    expect(compiled).toContain("CASE WHEN h.promise_date IS NULL THEN NULL");
    expect(compiled).toContain("THEN 'past' ELSE 'notPast' END");
    expect(compiled).toContain("CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai'");
    expect(compiled).toContain("WHEN 'past' THEN 'Overdue'");
    expect(compiled).toContain("WHEN 'notPast' THEN 'inProgress'");
    expect(compiled).toContain("coalesce(CASE WHEN h.promise_date IS NULL THEN NULL");
    expect(compiled).toMatch(/END, ''\) AS overdue/);
    const filtered = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      overdue: ["past"],
    });
    expect(filtered).toContain("= ANY({{param:overdue}}::text[])");
    expect(filtered).toContain("THEN 'past' ELSE 'notPast' END");
  });

  it("bucket rows empty for sentry: act coalesce, restore nulif, keepjoin", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["customer", "overdue"] });
    expect(compiled).toMatch(/coalesce\(CASE WHEN h\.promise_date IS NULL THEN NULL[\s\S]*END, ''\) AS overdue/);
    expect(compiled).toContain("nullif(m.overdue, '')");
    expect(compiled).toContain("m.overdue = k.overdue");
    expect(compiled).not.toContain("IS NOT DISTINCT FROM");
  });

  it("bucket unknown filter rejected", () => {
    const { surface, resolved } = deliverySurface();
    expect(() =>
      normalizeSurfaceParams(
        surface.params,
        { dateFrom: ["2026-09-01"], dateTo: ["2026-09-07"], overdue: ["foo"] },
        "deliveryReport",
        surface.pivot,
      ),
    ).toThrow(/choices: past \/ notPast/);
    expect(() => compilePivotSql(
      resolved,
      surface.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-07", rowDims: ["customer"], overdue: ["foo"] },
      { timezone: "Asia/Shanghai" },
    )).toThrow(/choices: past \/ notPast/);
  });

  it("the dimension label is a peer name: multi-gauge by referenceLabel spell, lookup and a table", () => {
    const { surface, resolved } = deliverySurface();
    const sku = resolved.dimensions.find((dim) => dim.key === "sku");
    expect(sku?.labelParts).toEqual([
      { column: "name", lookup: null },
      { column: "code", lookup: { module: "productFamily", matchColumn: "product_family_id" } },
      { column: "spec", lookup: null },
    ]);
    expect(sku?.labelSeparator).toBe("/");
    const compiled = compileDelivery(surface, resolved, { rowDims: ["customer"], colDim: "sku" });
    expect(compiled).toContain("LEFT JOIN {{table:productFamily}} r_sku_1 ON r_sku_1.id = r_sku.product_family_id");
    expect(compiled).toContain("nullif(concat_ws('/', nullif(r_sku.name, ''), nullif(r_sku_1.code, ''), nullif(r_sku.spec, '')), '')");
    expect(resolved.reads.modules).toContain("productFamily");
  });

  it("non-string rejection in peer names", () => {
    const enumLabeled = defineFixtureModule({
      code: "customer",
      label: "Customer",
      domain: "test",
      fields: [
        { key: "name", label: "Name", type: "string", required: true, primary: true },
        { key: "grade", label: "Level", type: "enum", choiceSet: "sales.grade" },
      ],
      lifecycle: { statuses: [{ key: "active", initial: true, terminal: true }], transitions: [] },
      views: { list: { columns: ["name"], referenceLabel: ["name", "grade"] } },
    });
    const surfaces = defineSurfaces({ deliveryReport: deliveryBase });
    const pivotDecl = surfaces["deliveryReport"]?.pivot;
    if (pivotDecl === null || pivotDecl === undefined) throw new Error("deliveryReport");
    expect(() => bindPivotModules(pivotDecl, { ...deliveryModules, customer: enumLabeled }, "surfaces.deliveryReport.pivot"))
      .toThrow(/name "grade" must be string/);
  });

  it("attrs Columns: layout includes prevention", () => {
    const { surface, resolved } = deliverySurface();
    expect(pivotActiveAttrs(resolved, new Set(["product"]))).toEqual([
      {
        dimKey: "product",
        key: "productUnit",
        label: "Unit",
        column: "main_unit",
        choiceSet: "inventory.unit",
      },
    ]);
    expect(pivotActiveAttrs(resolved, new Set(["customer"]))).toEqual([]);
    const withProduct = compileDelivery(surface, resolved, { rowDims: ["customer", "product"] });
    expect(withProduct).toContain("r_product.main_unit AS product_unit");
    expect(withProduct).toContain("LEFT JOIN {{table:productFamily}} r_product");
    const keysBlock = withProduct.match(/p_keys AS \([\s\S]*?\n\)/)?.[0] ?? "";
    expect(keysBlock).not.toContain("product_unit");
    expect(withProduct).not.toContain("k.product_unit");
    const without = compileDelivery(surface, resolved, { rowDims: ["customer"] });
    expect(without).not.toContain("AS product_unit");
    expect(without).not.toContain("r_product.main_unit");
  });

  it("attrs column: colDim=produdc", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, { rowDims: ["customer"], colDim: "product" });
    expect(compiled).toContain("r_product.main_unit AS product_unit");
    expect(compiled).toContain("LEFT JOIN {{table:productFamily}} r_product");
    const keysBlock = compiled.match(/p_keys AS \([\s\S]*?\n\)/)?.[0] ?? "";
    expect(keysBlock).not.toContain("product_unit");
    expect(compiled).not.toContain("k.product_unit");
  });

  it("astr: reuse r sales order JOIN, SELECT out attr column", () => {
    const { surface, resolved } = deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          salesOrder: {
            ...deliveryPivot.dimensions.salesOrder,
            attrs: { orderCode: { label: "Document number", field: "code" } },
          },
        },
      },
    });
    const compiled = compileDelivery(surface, resolved, { rowDims: ["salesOrder"] });
    expect(compiled).toContain(
      "LEFT JOIN {{table:salesOrder}} r_sales_order ON r_sales_order.id = nullif(m.sales_order, '')",
    );
    expect(compiled).toContain("r_sales_order.code AS order_code");
    expect(compiled.split("LEFT JOIN {{table:salesOrder}} r_sales_order").length - 1).toBe(1);
  });

  it("attr Hang on Ungrounded Dimensions", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          promiseDate: {
            ...deliveryPivot.dimensions.promiseDate,
            attrs: { salesName: { label: "Name", field: "salesperson" } },
          },
        },
      },
    })).toThrow(/has an endpoint module/);
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          overdue: {
            ...deliveryPivot.dimensions.overdue,
            attrs: { overdueFlag: { label: "Mark", field: "code" } },
          },
        },
      },
    })).toThrow(/has an endpoint module/);
  });

  it("attr field type not rejected", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          salesOrder: {
            ...deliveryPivot.dimensions.salesOrder,
            attrs: { orderQty: { label: "Quantity", field: "qty" } },
          },
        },
      },
    })).toThrow(/must be string or enum/);
  });

  it("attr key conflict with dimension key refused", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          product: {
            ...deliveryPivot.dimensions.product,
            attrs: { customer: { label: "Customer", field: "mainUnit" } },
          },
        },
      },
    })).toThrow(/conflicts with/);
  });

  it("attrKey and Pioneer Refuse", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          product: {
            ...deliveryPivot.dimensions.product,
            attrs: { customerLabel: { label: "Customer name", field: "mainUnit" } },
          },
        },
      },
    })).toThrow(/conflicts with/);
  });

  it("attr key is a reservation refusal", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          product: {
            ...deliveryPivot.dimensions.product,
            attrs: { order: { label: "Sequence", field: "mainUnit" } },
          },
        },
      },
    })).toThrow(/is an SQL reserved word/);
  });

  it("single deleted: agg / expr kind unknown", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        facts: [{
          ...deliveryPivot.facts[0],
          measures: { ...deliveryPivot.facts[0].measures, ordered: { field: "baseQty", agg: "single" } },
        }],
      },
    })).toThrow(/unknown/);
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        measures: {
          ...deliveryPivot.measures,
          ordered: { label: "Order count", format: "integer", expr: { kind: "single", of: "ordered" } },
        },
      },
    })).toThrow(/unknown/);
  });

  it("delete: the declaration is unknown", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        measures: {
          ...deliveryPivot.measures,
          ordered: { label: "Order count", format: "text", expr: { kind: "sum", of: "ordered" } },
        },
      },
    })).toThrow(/unknown/);
  });

  it("you know, um attr has to have a choiceSet.", () => {
    const productWithGrade = archive("product", "SKU", [
      { key: "name", label: "Name", type: "string", required: true, primary: true },
      { key: "spec", label: "Specification", type: "string", required: true },
      { key: "productFamilyId", label: "Product", type: "ref", ref: "productFamily", required: true },
      { key: "mainUnit", label: "Main unit", type: "enum", choiceSet: "inventory.unit" },
      { key: "grade", label: "Level", type: "enum", options: ["A", "B"] },
    ]);
    const surfaces = defineSurfaces({
      deliveryReport: {
        ...deliveryBase,
        pivot: {
          ...deliveryPivot,
          dimensions: {
            ...deliveryPivot.dimensions,
            sku: {
              ...deliveryPivot.dimensions.sku,
              attrs: { productGrade: { label: "Level", field: "grade" } },
            },
          },
        },
      },
    });
    const surface = surfaces["deliveryReport"];
    if (surface === undefined || surface.pivot === null) throw new Error("deliveryReport");
    const pivot = surface.pivot;
    expect(() => bindPivotModules(
      pivot,
      { ...deliveryModules, product: productWithGrade },
      "surfaces.deliveryReport.pivot",
    )).toThrow(/choiceSet/);
  });

  it("not date field rejected with dateRange / duck", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          salesOrder: {
            ...deliveryPivot.dimensions.salesOrder,
            filter: "dateRange",
          },
        },
      },
    })).toThrow(/is only for date fields/);
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          created: { label: "Create", on: "header", field: "createdAt", filterable: true, filter: "dateRange" },
        },
      },
    })).toThrow(/is only for date fields/);
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          salesperson: {
            label: "Salesperson",
            on: "header",
            field: "salesperson",
            filterable: true,
            bucket: "pastDue",
            options: { past: "Overdue", notPast: "inProgress" },
          },
        },
      },
    })).toThrow(/is only for date fields/);
  });

  it("platform createdAt", () => {
    const { resolved } = deliverySurface();
    expect(resolved.facts[0]?.dateField).toBe("createdAt");
    expect(resolved.facts[0]?.dateColumn).toBe("created_at");
    expect(resolved.facts[0]?.dateAlias).toBe("h");
  });

  it("agg failed to match type", () => {
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        facts: [{
          ...deliveryPivot.facts[0],
          measures: { ...deliveryPivot.facts[0].measures, promiseDate: { field: "promiseDate" } },
        }],
      },
    })).toThrow(/a date field must declare agg: "max"/);
    expect(() => deliverySurface({
      pivot: {
        ...deliveryPivot,
        facts: [{
          ...deliveryPivot.facts[0],
          measures: { ...deliveryPivot.facts[0].measures, unit: { field: "unit" } },
        }],
      },
    })).toThrow(/a text field must declare agg: "max"/);
  });

  it("operator hop sif id; sortBy line count without sum date bar", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      salesperson: "2816446863325978949",
      sortBy: "ordered",
      sortDesc: true,
    });
    expect(compiled).toContain("LEFT JOIN {{table:subject}} f0_salesperson_0 ON f0_salesperson_0.id = h.salesperson");
    expect(compiled).toContain("f0_salesperson_0.id = ANY({{param:salesperson}}::text[])");
    expect(compiled).toContain("sum(m.ordered) DESC NULLS LAST");
    const colSorted = compileDelivery(surface, resolved, {
      rowDims: ["customer"],
      colDim: "product",
      sortBy: "ordered",
      sortCol: "pf-1",
      sortDesc: true,
    });
    expect(colSorted).toContain("sum(m.ordered) FILTER (WHERE m.product = {{param:sortCol}}) DESC NULLS LAST");
  });

  it("directly copile no longer rejected because it was not pre-set", () => {
    const { surface, resolved } = deliverySurface();
    const compiled = compilePivotSql(
      resolved,
      surface.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-07", rowDims: ["customer"] },
      { timezone: "Asia/Shanghai" },
    );
    expect(compiled).toContain("FROM {{table:salesOrder.lines}} f");
    expect(compiled).toContain("NULL AS sales_order");
  });

  it("on dimension only filed:id refers to the endpoint; other field labels are the value itself", () => {
    const { resolved } = deliverySurface({
      pivot: {
        ...deliveryPivot,
        dimensions: {
          ...deliveryPivot.dimensions,
          salesOrder: { ...deliveryPivot.dimensions.salesOrder, field: "code" },
        },
      },
    });
    const order = resolved.dimensions.find((dim) => dim.key === "salesOrder");
    expect(order?.endpointModule).toBeNull();
    expect(order?.labelParts).toEqual([]);
  });

  it("range Min/ Max", () => {
    const { surface, resolved } = deliverySurface();
    const out = normalizeSurfaceParams(
      surface.params,
      {
        dateFrom: ["2026-09-01"],
        dateTo: ["2026-09-07"],
        progressMin: ["10"],
        progressMax: ["90"],
      },
      "deliveryReport",
      surface.pivot,
    );
    expect(out["progressMin"]).toBe(10);
    expect(out["progressMax"]).toBe(90);
    expect(() => compilePivotSql(
      resolved,
      surface.columns,
      { ...out, progressMin: "10" },
      { timezone: "Asia/Shanghai" },
    )).toThrow(/progressMin must be a number/);
  });

  it("filter candidate: Values appearing in the current binding report; Benv is selected for narrowness", () => {
    const { surface, resolved } = deliverySurface();
    const raw: Record<string, string[]> = {
      dateFrom: [dates.dateFrom],
      dateTo: [dates.dateTo],
      customer: ["c-1"],
      product: ["p-selected"],
      progressMin: ["10"],
    };
    const params = normalizeSurfaceParams(surface.params, raw, "deliveryReport", surface.pivot);
    expect(paramsWithoutOwnDimFilter(params, "product")["product"]).toBeUndefined();
    expect(paramsWithoutOwnDimFilter(params, "product")["customer"]).toEqual(["c-1"]);
    const compiled = compilePivotFilterOptionsSql(resolved, "product", params, { timezone: "Asia/Shanghai" });
    expect(compiled).toContain("h.status IN ({{status:salesOrder.inProgress}}, {{status:salesOrder.completed}})");
    expect(compiled).toContain("{{param:dateFrom}}");
    expect(compiled).toContain("{{param:dateTo}}");
    expect(compiled).toContain("= ANY({{param:customer}}::text[])");
    expect(compiled).not.toContain("{{param:product}}");
    expect(compiled).toContain("LEFT JOIN {{table:productFamily}} r_product");
    expect(compiled).toContain("AS value");
    expect(compiled).toContain("AS label");
    expect(compiled).toContain("m.progress >= {{param:progressMin}}");
    const sku = compilePivotFilterOptionsSql(resolved, "sku", {
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      sku: ["sku-selected"],
    }, { timezone: "Asia/Shanghai" });
    expect(sku).toContain("nullif(concat_ws('/', nullif(r_sku.name, ''), nullif(r_sku_1.code, ''), nullif(r_sku.spec, '')), '')");
    expect(sku).not.toContain("{{param:sku}}");
  });
});

const pendingRowExpr = {
  op: "sub",
  args: [
    { field: "baseAssignedQty" },
    {
      op: "mul",
      args: [
        { op: "add", args: [{ field: "approvedQualifiedQty" }, { field: "approvedDefectQty" }] },
        { field: "unitFactor" },
      ],
    },
  ],
};

const assignment = defineFixtureModule({
  code: "assignment",
  label: "Assignment",
  domain: "test",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "workerId", label: "Staff", type: "ref", ref: "worker", required: true },
    { key: "assignedAt", label: "Assigned at", type: "datetime", required: true },
    { key: "baseAssignedQty", label: "Converted assignment quantity", type: "number" },
    { key: "approvedQualifiedQty", label: "Reviewed good quantity", type: "number" },
    { key: "approvedDefectQty", label: "Reviewed rejects", type: "number" },
    { key: "unitFactor", label: "Unit conversion factor", type: "number" },
    {
      key: "formulaQty",
      label: "Derived quantity",
      type: "number",
      derive: { kind: "formula", expr: { op: "add", args: [{ field: "baseAssignedQty" }, { value: 1 }] } },
    },
  ],
  lifecycle: {
    statuses: [
      { key: "awaitingProduction", initial: true, terminal: false },
      { key: "inProduction", initial: false, terminal: false },
      { key: "completed", initial: false, terminal: true },
    ],
    transitions: [
      { code: "start", from: "awaitingProduction", to: "inProduction", action: "Start" },
      { code: "complete", from: "inProduction", to: "completed", action: "Complete" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

const assignmentReport = archive(
  "assignmentReport",
  "Work report",
  [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "workerId", label: "Staff", type: "ref", ref: "worker", required: true },
    { key: "reportedAt", label: "Report time", type: "datetime", required: true },
    { key: "baseQualifiedQty", label: "Good", type: "number", required: true },
  ],
  [{ key: "completed", initial: true, terminal: true }],
);

function assignmentSurface(pendingMeasure: Record<string, unknown>) {
  const surfaces = defineSurfaces({
    productionReport: {
      label: "Production report",
      permission: "system:productionReport:read",
      path: "/_production-report",
      pivot: {
        facts: [
          {
            module: "assignment",
            status: ["awaitingProduction", "inProduction", "completed"],
            dateField: "assignedAt",
            measures: {
              assigned: { field: "baseAssignedQty" },
              pending: pendingMeasure,
            },
          },
          {
            module: "assignmentReport",
            status: ["completed"],
            dateField: "reportedAt",
            measures: { qualified: { field: "baseQualifiedQty" } },
          },
        ],
        dimensions: {
          worker: { label: "Staff", path: ["workerId"], filterable: false },
        },
        measures: {
          assigned: { label: "Total assigned", format: "integer", expr: { kind: "sum", of: "assigned" } },
          pending: { label: "Total awaiting production", format: "integer", expr: { kind: "sum", of: "pending" } },
          qualified: { label: "Good quantity", format: "integer", expr: { kind: "sum", of: "qualified" } },
        },
        defaultRowDims: ["worker"],
        requiredRowDims: [],
        maxRangeDays: 31,
      },
    },
  });
  const surface = surfaces["productionReport"];
  if (surface === undefined || surface.pivot === null) throw new Error("assignment pivot");
  const resolved = bindPivotModules(surface.pivot, { worker, assignment, assignmentReport }, "assignment");
  return { surface, resolved };
}

describe("rowExpr to be delivered", () => {
  it("let's do it at the sender's office first. Som, the merger layer does not fill the missing side with zero.", () => {
    const { surface, resolved } = assignmentSurface({ rowExpr: pendingRowExpr });
    const compiled = compilePivotSql(
      resolved,
      surface.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-07", rowDims: ["worker"] },
      { timezone: "Asia/Shanghai" },
    );
    expect(compiled).toContain(
      "coalesce(sum((f.base_assigned_qty - ((f.approved_qualified_qty + f.approved_defect_qty) * f.unit_factor))), 0)",
    );
    expect(compiled).toContain("coalesce(sum(");
    expect(compiled).not.toContain("coalesce(pending, 0)");
    expect(compiled).not.toContain("coalesce(f0.pending, 0)");
    expect(compiled).not.toMatch(/coalesce\([A-Za-z0-9_.]+, 0\)/);
    expect(compiled).toContain("ASC NULLS LAST");
  });

  it("field appears simultaneously with rowExpr, references to missing fields, references to derivative fields are rejected", () => {
    expect(() => assignmentSurface({ field: "baseAssignedQty", rowExpr: pendingRowExpr })).toThrow(/field and rowExpr/);
    expect(() => assignmentSurface({ rowExpr: { field: "missingQty" } })).toThrow(/has no field/);
    expect(() => assignmentSurface({ rowExpr: { field: "formulaQty" } })).toThrow(/is a derived field and has no stored column/);
  });
});
