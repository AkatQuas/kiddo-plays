// ---------------------------------------------------------------------------
// analyzing SQL data ranges: compile by op, no longer always IN
//
// 🔴 Old realization unread op, empty values skips the whole group, relative value is JSON parameter push -- silent data.
// these three nails are the SQLs that you can see when they're fixed.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { ANALYSIS_CATALOG_VERSION, type AnalysisCatalog, type AnalysisField } from "@open-erp/metamodel";
import type { Identity } from "@open-erp/runtime-core";
import { compileAnalysisScopeClause, foldCompiledSql } from "../src/repo/analysisSqlRepo.js";

const TZ = "Asia/Shanghai";

function field(over: Pick<AnalysisField, "key" | "column" | "type"> & Partial<AnalysisField>): AnalysisField {
  return {
    label: over.key,
    unit: over.type === "date" || over.type === "datetime" ? over.type : null,
    scope: false,
    ...over,
  };
}

function catalog(): AnalysisCatalog {
  return {
    version: ANALYSIS_CATALOG_VERSION,
    generatedFrom: "domains",
    relations: [
      {
        name: "oe_demo",
        module: "demo",
        moduleLabel: "demo",
        grain: "header",
        through: null,
        throughLabel: null,
        primaryFacts: ["id"],
        fields: [
          field({ key: "id", column: "id", type: "string" }),
          field({ key: "bizDate", column: "biz_date", type: "date" }),
          field({ key: "createdAt", column: "created_at", type: "datetime" }),
          field({ key: "remark", column: "remark", type: "string" }),
        ],
        joins: [],
        businessTimeFields: ["bizDate", "createdAt"],
        statusFields: ["status"],
        validFactSemantics: "test",
        missingFacts: [],
      },
    ],
  };
}

function actor(
  predicates: Identity["dataScopes"][string]["predicates"],
  groups?: Identity["dataScopes"][string]["groups"],
): Identity {
  return {
    tenantId: "T1",
    orgId: "O1",
    userId: "U1",
    identify: "1",
    agentId: null,
    roles: [{ code: "role", name: "role" }],
    permissions: [],
    dataScopes: {
      demo: groups
        ? { policies: ["specified"], predicates, groups }
        : { policies: ["specified"], predicates },
    },
    authorization: {
      applicationId: "open-erp",
      policyVersion: "1",
      catalogDigest: "x",
      decisionId: "d",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  };
}

function compile(predicates: Identity["dataScopes"][string]["predicates"]): {
  readonly sql: string;
  readonly params: unknown[];
} {
  const params: unknown[] = [];
  const sql = compileAnalysisScopeClause(catalog(), "h", "demo", actor(predicates), TZ, params);
  return { sql, params };
}

function compileGroups(groups: NonNullable<Identity["dataScopes"][string]["groups"]>): {
  readonly sql: string;
  readonly params: unknown[];
} {
  const params: unknown[] = [];
  const sql = compileAnalysisScopeClause(catalog(), "h", "demo", actor(groups.flat(), groups), TZ, params);
  return { sql, params };
}

describe("compileAnalysisScopeClause", () => {
  it("between, two-day string is half-open, not IN (d1, d2)", () => {
    const { sql, params } = compile([
      { field: "bizDate", op: "between", values: ["2026-09-01", "2026-09-30"] },
    ]);
    expect(sql).not.toMatch(/\bIN\s*\(/i);
    expect(sql).toMatch(/h\.biz_date\s*>=/i);
    expect(sql).toMatch(/h\.biz_date\s*</i);
    expect(sql).not.toMatch(/<=/);
    expect(params).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("is empty encoded IS NULL, not skipping into unconditional", () => {
    const { sql, params } = compile([{ field: "remark", op: "is_empty", values: [] }]);
    expect(sql).toMatch(/h\.remark\s+IS NULL/i);
    expect(sql).not.toBe("");
    expect(sql).not.toBe("false");
    expect(params).toEqual([]);
  });

  it("relative value eq {$rel:today} Walk date trunc semi-comparison, params does not have JSON objects", () => {
    const { sql, params } = compile([{ field: "createdAt", op: "eq", values: [{ $rel: "today" }] }]);
    expect(sql).toMatch(/date_trunc\s*\(\s*'day'/i);
    expect(sql).toMatch(/>=/);
    expect(sql).toMatch(/</);
    expect(sql).not.toMatch(/\bIN\s*\(/i);
    expect(params.some((value) => value !== null && typeof value === "object")).toBe(false);
    expect(JSON.stringify(params)).not.toContain("$rel");
    expect(params).toContain(TZ);
  });

  it("tie resolve empty set (missing op + values=[]) whole group to false, not 500", () => {
    expect(() => compile([{ field: "id", values: [] }])).not.toThrow();
    const { sql, params } = compile([{ field: "id", values: [] }]);
    expect(sql).toBe("false");
    expect(params).toEqual([]);
  });

  it("or, in two groups, own-org empty collections are lost, leaving valuable IN, not 500", () => {
    const { sql, params } = compileGroups([
      [{ field: "id", values: [] }],
      [{ field: "id", op: "in", values: ["org-a", "org-b"] }],
    ]);
    expect(sql).toMatch(/h\.id\s+IN\s*\(/i);
    expect(sql).not.toBe("false");
    expect(params).toEqual(["org-a", "org-b"]);
  });

  it("eq + values =[] the same whole group is thrown to false, not 500", () => {
    expect(() => compile([{ field: "id", op: "eq", values: [] }])).not.toThrow();
    const { sql, params } = compile([{ field: "id", op: "eq", values: [] }]);
    expect(sql).toBe("false");
    expect(params).toEqual([]);
  });
});

describe("foldCompiledSql", () => {
  it("$N doesn't match params, fail, silently.", () => {
    expect(() => foldCompiledSql({ sql: "a = $1 OR b = $1", params: ["x"] }, [])).toThrow(/\$N count \(2\) does not match params \(1\)/);
    expect(() => foldCompiledSql({ sql: "a = $1", params: [] }, [])).toThrow(/\$N count \(1\) does not match params \(0\)/);
  });

  it("dest length offset after gate pass", () => {
    const dest: unknown[] = ["a", "b"];
    expect(foldCompiledSql({ sql: "h.x = $1", params: ["c"] }, dest)).toBe("h.x = $3");
    expect(dest).toEqual(["a", "b", "c"]);
  });
});
