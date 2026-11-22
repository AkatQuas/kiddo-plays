import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  OPERATION_LOG_PAGE_SIZE,
  type Identity,
  type OperationLogQuery,
} from "@open-erp/runtime-core";
import { operationLogLikePattern, operationLogListQuery } from "../src/repo/operationLogRepo.js";

const dialect = new PgDialect();

function identity(tenantId: string): Identity {
  return {
    tenantId,
    orgId: "org-a",
    userId: "user-secret",
    identify: "1",
    agentId: null,
    roles: [],
    permissions: [],
    dataScopes: {},
    authorization: {
      applicationId: "open-erp",
      policyVersion: "v1",
      catalogDigest: "digest",
      decisionId: "decision",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
  };
}

const base: OperationLogQuery = {
  keyword: null,
  billCode: null,
  from: null,
  to: null,
  modules: [],
  page: 1,
  pageSize: OPERATION_LOG_PAGE_SIZE,
};

describe("operation log SQL term", () => {
  it("keywords do not search user id, date closed left-right, default 10, and only by tenant", () => {
    expect(OPERATION_LOG_PAGE_SIZE).toBe(10);
    const page = operationLogListQuery(identity("tenant-a"), base);
    expect(page.limit).toBe(10);
    expect(page.offset).toBe(0);
    const next = operationLogListQuery(identity("tenant-a"), { ...base, page: 2 });
    expect(next.offset).toBe(10);

    const tenantOnly = dialect.sqlToQuery(page.where);
    expect(tenantOnly.sql).toContain("tenant_id");
    expect(tenantOnly.params).toContain("tenant-a");
    expect(tenantOnly.params).not.toContain("tenant-b");
    expect(tenantOnly.params).not.toContain("org-a");
    expect(tenantOnly.params).not.toContain("user-secret");
    expect(tenantOnly.sql).not.toContain("org_id");
    expect(tenantOnly.sql).not.toContain("actor_user_id");

    const other = dialect.sqlToQuery(operationLogListQuery(identity("tenant-b"), base).where);
    expect(other.params).toContain("tenant-b");
    expect(other.params).not.toContain("tenant-a");

    const from = new Date("2026-01-02T00:00:00.000Z");
    const to = new Date("2026-01-03T00:00:00.000Z");
    const ranged = dialect.sqlToQuery(operationLogListQuery(identity("tenant-a"), {
      ...base,
      keyword: "secret",
      from,
      to,
      modules: ["salesOrder"],
    }).where);
    expect(ranged.sql).toContain("actor_account");
    expect(ranged.sql).toContain("actor_name");
    expect(ranged.sql).not.toContain("actor_user_id");
    expect(ranged.sql.toLowerCase()).toContain("ilike");
    expect(ranged.params).toContain("%secret%");
    expect(ranged.params).not.toContain("user-secret");
    const compact = ranged.sql.replace(/\s+/g, " ");
    expect(compact).not.toContain("<=");
    const gte = /"at" >= \$(\d+)/.exec(compact);
    const lt = /"at" < \$(\d+)/.exec(compact);
    expect(gte?.[1]).toBeTruthy();
    expect(lt?.[1]).toBeTruthy();
    expect(Number(lt?.[1])).toBeGreaterThan(Number(gte?.[1]));
    expect(String(ranged.params[Number(gte?.[1]) - 1])).toBe(from.toISOString());
    expect(String(ranged.params[Number(lt?.[1]) - 1])).toBe(to.toISOString());
    expect(ranged.params.map((value) => value instanceof Date ? value.toISOString() : String(value))).toEqual([
      "tenant-a",
      "%secret%",
      "%secret%",
      from.toISOString(),
      to.toISOString(),
      "salesOrder",
    ]);
  });

  it("the single number is blurry on the bill code. There's no actual user id in the account key.", () => {
    const filtered = dialect.sqlToQuery(operationLogListQuery(identity("tenant-a"), {
      ...base,
      keyword: "secret",
      billCode: "XS%1_a",
    }).where);
    const compact = filtered.sql.replace(/\s+/g, " ");
    const bill = /"bill_code" ilike \$(\d+)/i.exec(compact);
    expect(bill?.[1]).toBeTruthy();
    expect(filtered.params[Number(bill?.[1]) - 1]).toBe(operationLogLikePattern("XS%1_a"));
    expect(compact.toLowerCase()).toContain("ilike");
    expect(compact).toMatch(/"actor_account" ilike \$\d+ or "oe_operation_log"\."actor_name" ilike \$\d+/i);
    expect(compact).not.toMatch(/"bill_code" ilike \$\d+ or/i);
    expect(compact).not.toMatch(/or "[^"]*"\."bill_code" ilike/i);
    expect(filtered.sql).not.toContain("actor_user_id");
    expect(filtered.params.filter((value) => value === "%secret%")).toHaveLength(2);
    expect(filtered.params).not.toContain("user-secret");
  });
});
