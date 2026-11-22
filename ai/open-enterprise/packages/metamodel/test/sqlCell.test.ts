import { describe, expect, it } from "vitest";
import { compileBoundSql, compileSqlCell, defineInsights, evaluateInsight, isInsightSqlCell } from "../src/index.js";

const overdue = {
  kind: "sql" as const,
  label: "Due and unshipped",
  sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so WHERE so.status = {{status:salesOrder.inProgress}} AND so.promise_date < {{asOf}}::date`,
  params: ["asOf"] as const,
  result: "count" as const,
};

describe("sql cell", () => {
  it("placeholder encoded into physical table names and binding parameters, state as text mass", () => {
    const insights = defineInsights({
      overdueUnshipped: { label: "Overdue and unshipped", cells: { count: overdue } },
    });
    const cell = insights["overdueUnshipped"]!.cells["count"];
    expect(isInsightSqlCell(cell)).toBe(true);
    if (!isInsightSqlCell(cell)) return;
    const compiled = compileSqlCell(cell, new Date("2026-09-02T08:00:00+08:00"));
    expect(compiled.sql).toContain("oe_sales_order");
    expect(compiled.sql).toContain("'inProgress'");
    expect(compiled.sql).not.toContain("{{");
    expect(compiled.params).toEqual(["2026-09-02"]);
    expect(compiled.aliases).toEqual({ so: "oe_sales_order" });
    expect(cell.reads).toEqual({
      modules: ["salesOrder"],
      statuses: { salesOrder: ["inProgress"] },
    });
  });

  it("link must be a module read by Bengue SQL; default not", () => {
    const insights = defineInsights({
      overdueUnshipped: { label: "Overdue and unshipped", cells: { count: { ...overdue, link: "salesOrder" } } },
    });
    const cell = insights["overdueUnshipped"]!.cells["count"];
    expect(isInsightSqlCell(cell) && cell.link).toBe("salesOrder");
    expect(() => defineInsights({
      overdueUnshipped: { label: "Overdue and unshipped", cells: { count: { ...overdue, link: "warehouse" } } },
    })).toThrow(/is not among the modules this cell's SQL reads/);
  });

  it("querySql, press result for value", async () => {
    const insights = defineInsights({
      overdueUnshipped: { label: "Overdue and unshipped", cells: { count: overdue } },
    });
    const result = await evaluateInsight("overdueUnshipped", {
      insights,
      asOf: new Date("2026-09-02T08:00:00+08:00"),
      count: async () => {
        throw new Error("must not use count");
      },
      querySql: async (compiled) => {
        expect(compiled.params[0]).toBe("2026-09-02");
        return [{ value: 9 }];
      },
    });
    expect(result.cells[0]?.value).toBe(9);
  });

  it("templates are rejected for print id or lack of aliases", () => {
    expect(() => defineInsights({
      bad: {
        label: "x",
        cells: {
          count: {
            ...overdue,
            sql: "SELECT 1 FROM {{table:salesOrder}} so WHERE so.tenant_id = 'x'",
          },
        },
      },
    })).toThrow(/tenant_id/);
    expect(() => defineInsights({
      bad: {
        label: "x",
        cells: { count: { ...overdue, sql: "SELECT 1 FROM {{table:salesOrder}} WHERE so.promise_date < {{asOf}}::date" } },
      },
    })).toThrow(/alias/);
  });
});

describe("commonBundSql (surface additional)", () => {
  it("bind optional filters, page breaks and ledgerNet, without changing asof slots for networkSqlCell", () => {
    const compiled = compileBoundSql(
      `SELECT p.id, coalesce(sum({{ledgerNet:stock.l}}), 0)
       FROM {{table:product}} p
       LEFT JOIN {{ledger:stock}} l ON l.subject_id = p.id
       WHERE ({{param:productType}}::text IS NULL OR p.product_type = {{param:productType}})
       LIMIT {{param:pageSize}} OFFSET {{offset}}`,
      { productType: "Finished goods", page: 2, pageSize: 20 },
    );
    expect(compiled.sql).toContain("oe_product");
    expect(compiled.sql).toContain("oe_effect_ledger");
    expect(compiled.sql).toContain("l.op");
    expect(compiled.sql).not.toContain("{{");
    expect(compiled.params).toEqual(["Finished goods", 20, 20]);
    expect(compiled.aliases).toEqual({ p: "oe_product", l: "oe_effect_ledger" });
  });

  it("default Page/ PageSize, like empty button", () => {
    const compiled = compileBoundSql(
      `SELECT p.code FROM {{table:product}} p WHERE ({{param:code}}::text IS NULL OR p.code ILIKE {{like:code}}) LIMIT {{param:pageSize}} OFFSET {{offset}}`,
      {},
    );
    expect(compiled.params).toEqual([null, null, 50, 0]);
  });

  it("{param:} Tie the array as it is, give it to ANY", () => {
    const compiled = compileBoundSql(
      `SELECT p.id FROM {{table:product}} p WHERE p.id = ANY({{param:ids}}::text[])`,
      { ids: ["a", "b"] },
    );
    expect(compiled.sql).toContain("ANY($1::text[])");
    expect(compiled.params).toEqual([["a", "b"]]);
  });
});

it("inventory extract retains the total number of coordinates and cannot count the current number of lines as a total", async () => {
  const insights = defineInsights({
    stock: { label:"Balance", cells: {
      top: { kind:"sql", label:"Balance excerpt",
        sql:"SELECT count(*) over() AS total_count FROM {{table:warehouse}} w LIMIT 8",
        params:[], result:"rows",
        table:{ totalFrom:"total_count", columns:[{key:"name",label:"Warehouse",from:"name"}] },
      },
    } },
  });
  const result = await evaluateInsight("stock", { insights, asOf:new Date(), querySql:async()=>[{name:"A",total_count:12},{name:"B",total_count:12}] });
  expect(result.cells[0]).toMatchObject({tableTotal:12,truncated:true});
  const missing = await evaluateInsight("stock",{insights,querySql:async()=>[{name:"A"}]});
  expect(missing.cells[0]?.dataQuality?.unavailable).toContain("table total");
  const empty = await evaluateInsight("stock",{insights,querySql:async()=>[]});
  expect(empty.cells[0]).toMatchObject({tableTotal:0,truncated:false});
});
