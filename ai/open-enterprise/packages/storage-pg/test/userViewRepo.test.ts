import type { UserViewInput } from "@open-erp/metamodel";
import type { Identity } from "@open-erp/runtime-core";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUserViewRepo, UserViewNotFoundError } from "../src/repo/userViewRepo.js";

const identity = {
  tenantId: "tenant-a",
  orgId: "org-a",
  userId: "owner-a",
  identify: "1",
  agentId: null,
} as Identity;

const now = "2026-09-29T00:00:00.000Z";

function viewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "view-owned",
    name: "my view",
    icon: "icon-blue",
    module: "purchaseOrder",
    userId: identity.userId,
    ownerName: "Owner",
    scope: "custom",
    scopeUserIds: [],
    scopeDeptIds: [],
    filters: [],
    displayFields: ["code"],
    sortRules: [],
    sortOrder: "1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("verify user view share range", () => {
  it("set the space sector as text[] when the custom scope is only selected", async () => {
    const dialect = new PgDialect();
    const queries: ReturnType<typeof dialect.sqlToQuery>[] = [];
    const db = {
      async execute(query: SQL) {
        const compiled = dialect.sqlToQuery(query);
        queries.push(compiled);
        if (compiled.sql.includes("COUNT(DISTINCT id)")) return [{ users: 1, depts: 0 }];
        if (compiled.sql.includes("COUNT(*) as count")) return [{ count: 0 }];
        if (compiled.sql.includes("MAX(sort_order)")) return [{ max_order: 0 }];
        if (compiled.sql.includes("INSERT INTO oe_user_view")) {
          return [viewRow({ id: "view-a", name: "shared view", scopeUserIds: ["person-a"], sortOrder: "1" })];
        }
        return [];
      },
      async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
        return callback(db);
      },
    };
    const repo = createUserViewRepo(db as never);
    const input: UserViewInput = {
      name: "shared view",
      icon: "icon-blue",
      module: "purchaseOrder",
      filters: [],
      displayFields: ["code"],
      sortRules: [],
      scope: "custom",
      scopeUserIds: ["person-a"],
      scopeDeptIds: [],
    };

    await expect(repo.create(identity, input)).resolves.toMatchObject({
      scope: "custom",
      scopeUserIds: ["person-a"],
      scopeDeptIds: [],
    });

    const shareCheck = queries.find((query) => query.sql.includes("COUNT(DISTINCT id)"));
    expect(shareCheck?.sql).toContain("id = ANY(ARRAY[$2]::text[])");
    expect(shareCheck?.sql).toContain("id = ANY(ARRAY[]::text[])");
    expect(shareCheck?.params).toContain("person-a");
  });
});

describe("user View Individual Tab Sorting", () => {
  it("list reordered by individual ordered ids, unrecorded view by sortOrder", async () => {
    const dialect = new PgDialect();
    const db = {
      async execute(query: SQL) {
        const compiled = dialect.sqlToQuery(query);
        if (compiled.sql.includes("FROM oe_user_view") && compiled.sql.includes("ORDER BY sort_order")) {
          return [
            viewRow({ id: "owned", sortOrder: "1" }),
            viewRow({ id: "shared", userId: "other", ownerName: "Other", sortOrder: "2", scopeUserIds: [identity.userId] }),
            viewRow({ id: "new-view", sortOrder: "3" }),
          ];
        }
        if (compiled.sql.includes("FROM oe_user_view_tab_order")) {
          return [{ orderedIds: ["shared", "owned"] }];
        }
        return [];
      },
      async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
        return callback(db);
      },
    };
    const repo = createUserViewRepo(db as never);
    const listed = await repo.list(identity, "purchaseOrder");
    expect(listed.map((view) => view.id)).toEqual(["shared", "owned", "new-view"]);
    expect(listed.map((view) => view.sortOrder)).toEqual([1, 2, 3]);
    expect(listed[0]?.canManage).toBe(false);
    expect(listed[1]?.canManage).toBe(true);
  });

  it("updateSort write personal preferences and release visible shared views while creating a simultaneous self-generated view", async () => {
    const dialect = new PgDialect();
    const queries: ReturnType<typeof dialect.sqlToQuery>[] = [];
    const db = {
      async execute(query: SQL) {
        const compiled = dialect.sqlToQuery(query);
        queries.push(compiled);
        if (compiled.sql.includes("pg_advisory_xact_lock")) return [];
        if (compiled.sql.includes("SELECT user_id") && compiled.sql.includes("module")) {
          const id = compiled.params[0] as string;
          if (id === "shared") return [{ userId: "other", module: "purchaseOrder" }];
          if (id === "owned") return [{ userId: identity.userId, module: "purchaseOrder" }];
          return [];
        }
        return [];
      },
      async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
        return callback(db);
      },
    };
    const repo = createUserViewRepo(db as never);
    await repo.updateSort(identity, "purchaseOrder", [
      { id: "shared", sortOrder: 1 },
      { id: "owned", sortOrder: 2 },
    ]);

    const upsert = queries.find((query) => query.sql.includes("INSERT INTO oe_user_view_tab_order"));
    expect(upsert).toBeDefined();
    expect(upsert?.params).toContain(JSON.stringify(["shared", "owned"]));

    const ownedUpdate = queries.find((query) =>
      query.sql.includes("UPDATE oe_user_view") && query.sql.includes("sort_order"),
    );
    expect(ownedUpdate).toBeDefined();
    expect(ownedUpdate?.params).toContain("owned");
    expect(ownedUpdate?.params).toContain(2);
  });

  it("other Organiser", async () => {
    const dialect = new PgDialect();
    const db = {
      async execute(query: SQL) {
        const compiled = dialect.sqlToQuery(query);
        if (compiled.sql.includes("pg_advisory_xact_lock")) return [];
        if (compiled.sql.includes("SELECT user_id") && compiled.sql.includes("module")) return [];
        return [];
      },
      async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
        return callback(db);
      },
    };
    const repo = createUserViewRepo(db as never);
    await expect(
      repo.updateSort(identity, "purchaseOrder", [{ id: "missing", sortOrder: 1 }]),
    ).rejects.toBeInstanceOf(UserViewNotFoundError);
  });
});
