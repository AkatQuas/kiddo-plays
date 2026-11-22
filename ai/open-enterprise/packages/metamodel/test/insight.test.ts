import { describe, expect, it } from "vitest";
import {
  compileSqlCell,
  defineInsight,
  defineInsights,
  evaluateInsight,
  isDefinedInsights,
  isInsightSqlCell,
} from "../src/index.js";

const sqlCell = {
  kind: "sql" as const,
  label: "Created before asOf",
  sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so WHERE so.created_at < {{asOf}}::date`,
  params: ["asOf"] as const,
  result: "count" as const,
};

const mechanism = {
  label: "Created before asOf",
  cells: { createdBeforeAsOf: sqlCell },
};

describe("defineInsights", () => {
  it("accepts only a credential object that went through the entry", () => {
    const insights = defineInsights({ mechanismAsOfCount: mechanism });
    expect(isDefinedInsights(insights)).toBe(true);
    expect(insights["mechanismAsOfCount"]?.label).toBe("Created before asOf");
    const cell = defineInsight(mechanism).cells["createdBeforeAsOf"];
    expect(isInsightSqlCell(cell)).toBe(true);
  });

  it("rejects an empty table, an unknown key, and a forbidden tenant_id", () => {
    expect(() => defineInsights({})).toThrow(/insights must not be empty/);
    expect(() => defineInsights({ mechanismAsOfCount: { ...mechanism, extra: 1 } })).toThrow(/unknown key/);
    expect(() => defineInsights({
      mechanismAsOfCount: {
        ...mechanism,
        cells: {
          createdBeforeAsOf: { ...sqlCell, sql: `SELECT count(*) FROM {{table:salesOrder}} so WHERE so.tenant_id = 'x'` },
        },
      },
    })).toThrow(/tenant_id/);
  });
});

describe("evaluateInsight sql", () => {
  const insights = defineInsights({ mechanismAsOfCount: mechanism });
  const dayA = new Date(2026, 7, 31, 15, 0, 0);

  it("goes through querySql and compiles params from asOf", async () => {
    const compiled = compileSqlCell(sqlCell, dayA);
    expect(compiled.params).toEqual(["2026-08-31"]);
    const result = await evaluateInsight("mechanismAsOfCount", {
      asOf: dayA,
      insights,
      querySql: async () => [{ value: 2 }],
    });
    expect(result.cells[0]?.value).toBe(2);
  });
});
