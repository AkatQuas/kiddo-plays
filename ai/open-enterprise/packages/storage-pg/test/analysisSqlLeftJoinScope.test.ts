// ---------------------------------------------------------------------------
// the data range for LEFT JOIN dimensions: the unquoted lines remain, and the outside references are filtered.
// go querycompiled, confirm that the subject Identity Guards really called LibyaScopePredicate.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";
import { ANALYSIS_CATALOG_VERSION, type AnalysisCatalog, type AnalysisField, type AnalysisRelation } from "@open-erp/metamodel";
import type { Identity } from "@open-erp/runtime-core";
import { createAnalysisSqlExecutor } from "../src/repo/analysisSqlRepo.js";
import type { Executor } from "../src/repo/support.js";

const TZ = "Asia/Shanghai";

function field(over: Pick<AnalysisField, "key" | "column" | "type">): AnalysisField {
  return {
    label: over.key,
    unit: null,
    scope: false,
    ...over,
  };
}

function relation(
  name: string,
  module: string,
  grain: "header" | "line",
  fields: readonly AnalysisField[],
): AnalysisRelation {
  return {
    name,
    module,
    moduleLabel: module,
    grain,
    through: grain === "line" ? "lines" : null,
    throughLabel: null,
    primaryFacts: ["id"],
    fields,
    joins: [],
    businessTimeFields: [],
    statusFields: [],
    validFactSemantics: "test",
    missingFacts: [],
  };
}

function catalog(): AnalysisCatalog {
  return {
    version: ANALYSIS_CATALOG_VERSION,
    generatedFrom: "domains",
    relations: [
      relation("oe_assignment", "assignment", "header", [
        field({ key: "id", column: "id", type: "string" }),
        field({ key: "orgId", column: "org_id", type: "string" }),
      ]),
      relation("oe_worker", "worker", "header", [
        field({ key: "id", column: "id", type: "string" }),
        field({ key: "teamId", column: "team_id", type: "string" }),
      ]),
      relation("oe_dept", "dept", "header", [field({ key: "id", column: "id", type: "string" })]),
      relation("oe_process_report", "processReport", "header", [
        field({ key: "id", column: "id", type: "string" }),
        field({ key: "createdBy", column: "created_by", type: "string" }),
      ]),
      relation("oe_process_report_lines", "processReport", "line", [
        field({ key: "id", column: "id", type: "string" }),
        field({ key: "billId", column: "bill_id", type: "string" }),
      ]),
      relation("oe_orphan_lines", "orphan", "line", [field({ key: "id", column: "id", type: "string" })]),
    ],
  };
}

function actor(dataScopes: Identity["dataScopes"]): Identity {
  return {
    tenantId: "t-demo",
    orgId: "O1",
    userId: "U1",
    identify: "1",
    agentId: null,
    roles: [{ code: "role", name: "role" }],
    permissions: [],
    dataScopes,
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

async function capture(sql: string, aliases: Readonly<Record<string, string>>, who: Identity): Promise<{
  readonly sql: string;
  readonly params: readonly unknown[];
}> {
  const captured: { sql: string; params: readonly unknown[] }[] = [];
  const exec = drizzle(async (text, params) => {
    captured.push({ sql: text, params });
    return { rows: [] };
  }) as unknown as Executor;
  await createAnalysisSqlExecutor(exec, catalog(), TZ).queryCompiled(who, { sql, params: [], aliases });
  const last = captured.at(-1);
  if (!last) throw new Error("test harness: no SQL was captured");
  return last;
}

const scopedSql = `SELECT f.id, w.name, d.name, l.id, o.id
FROM oe_assignment f
LEFT JOIN oe_worker w ON w.id = f.worker_id
LEFT JOIN oe_dept d ON d.id = f.dept_id
LEFT JOIN oe_process_report_lines l ON l.bill_id = f.id
LEFT JOIN oe_orphan_lines o ON o.bill_id = f.id`;

describe("data range for LEFT JOIN dimensions", () => {
  it("left connect header, false and line watch bill id packaged id IS NULL OR, non-left connect as it is", async () => {
    const bound = await capture(
      scopedSql,
      {
        f: "oe_assignment",
        w: "oe_worker",
        d: "oe_dept",
        l: "oe_process_report_lines",
        o: "oe_orphan_lines",
      },
      actor({
        assignment: { policies: ["specified"], predicates: [{ field: "orgId", op: "eq", values: ["org-1"] }] },
        worker: { policies: ["specified"], predicates: [{ field: "teamId", op: "eq", values: ["team-1"] }] },
        processReport: { policies: ["specified"], predicates: [{ field: "createdBy", op: "eq", values: ["u-1"] }] },
      }),
    );
    expect(bound.sql).toMatch(/LEFT JOIN oe_worker w ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$\d+/);
    expect(bound.sql).toMatch(/\(w\.id IS NULL OR \(w\.team_id = \$\d+\)\)/);
    expect(bound.sql).toMatch(/f\.org_id = \$\d+/);
    expect(bound.sql).not.toMatch(/f\.id IS NULL/);
    expect(bound.sql).toMatch(/\(d\.id IS NULL OR \(false\)\)/);
    expect(bound.sql).toMatch(
      /\(l\.id IS NULL OR \(l\.bill_id IN \(SELECT _scope_h\.id FROM oe_process_report _scope_h WHERE _scope_h\.tenant_id = \$\d+ AND _scope_h\.created_by = \$\d+\)\)\)/,
    );
    expect(bound.sql).toMatch(/\(o\.id IS NULL OR \(false\)\)/);
    expect(bound.sql).toMatch(/LEFT JOIN oe_process_report_lines l ON \(l\.bill_id = f\.id\) AND l\.tenant_id = \$\d+/);
    expect(bound.sql).toMatch(/LEFT JOIN oe_orphan_lines o ON \(o\.bill_id = f\.id\) AND o\.tenant_id = \$\d+/);
    const whereAt = bound.sql.search(/\bWHERE\b/i);
    expect(bound.sql.slice(whereAt)).not.toMatch(/\bw\.tenant_id\b/);
    expect(bound.sql.slice(whereAt)).not.toMatch(/\bd\.tenant_id\b/);
    expect(bound.sql.slice(whereAt)).not.toMatch(/\bl\.tenant_id\b/);
    expect(bound.params).toContain("t-demo");
    expect(bound.params).toContain("org-1");
    expect(bound.params).toContain("team-1");
    expect(bound.params).toContain("u-1");
  });

  it("left connection to all is uninclusive sub-word, tenant term is still ON", async () => {
    const bound = await capture(
      `SELECT f.id, w.name
FROM oe_assignment f
LEFT JOIN oe_worker w ON w.id = f.worker_id
WHERE f.status = 'awaitingProduction'`,
      { f: "oe_assignment", w: "oe_worker" },
      actor({
        assignment: { policies: ["all"], predicates: [] },
        worker: { policies: ["all"], predicates: [] },
      }),
    );
    expect(bound.sql).toMatch(/ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$\d+/);
    expect(bound.sql).not.toMatch(/w\.id IS NULL/);
    expect(bound.sql).not.toMatch(/f\.id IS NULL/);
    const whereAt = bound.sql.search(/\bWHERE\b/i);
    const where = bound.sql.slice(whereAt);
    expect(where).toMatch(/f\.tenant_id = \$\d+/);
    expect(where).not.toMatch(/\bw\.tenant_id\b/);
    expect(bound.params).toContain("t-demo");
  });
});
