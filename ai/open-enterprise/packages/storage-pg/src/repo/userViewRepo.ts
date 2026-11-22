// ---------------------------------------------------------------------------
// User-view repository — stores a user's custom list-view configuration
// Adapts the UserViewRepo contract from runtime-core
// ---------------------------------------------------------------------------

import { sql } from "drizzle-orm";
import type { Executor } from "./support.js";
import type { UserView, UserViewInput } from "@open-erp/metamodel";
import type { Identity } from "@open-erp/runtime-core";
import { randomUUID } from "node:crypto";

export type { UserViewRepo } from "@open-erp/runtime-core";
import type { UserViewRepo } from "@open-erp/runtime-core";

export class ViewConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ViewConfigError";
  }
}

export class UserViewNotFoundError extends ViewConfigError {
  constructor() { super("view does not exist", "VIEW_NOT_FOUND"); }
}
export class UserViewDuplicateNameError extends ViewConfigError {
  constructor() { super("a view with this name already exists; use another name", "VIEW_NAME_DUPLICATE"); }
}
export class UserViewLimitError extends ViewConfigError {
  constructor() { super("each module can have at most 20 views", "VIEW_LIMIT_EXCEEDED"); }
}
export class UserViewPermissionDeniedError extends ViewConfigError {
  constructor() { super("no permission to operate on this view", "VIEW_PERMISSION_DENIED"); }
}

function textArray(values: readonly string[]) {
  return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
}

export function createUserViewRepo(exec: Executor): UserViewRepo {
  const assertShareTargets = async (executor: Executor, identity: Identity, scope: UserViewInput["scope"], users: readonly string[], depts: readonly string[]): Promise<void> => {
    if (scope !== "custom") return;
    const rows = (await executor.execute(sql`
      SELECT
        (SELECT COUNT(DISTINCT id) FROM oe_subject WHERE tenant_id = ${identity.tenantId} AND id = ANY(${textArray(users)})) AS users,
        (SELECT COUNT(DISTINCT id) FROM oe_org_unit WHERE tenant_id = ${identity.tenantId} AND id = ANY(${textArray(depts)})) AS depts
    `)) as unknown as readonly Record<string, unknown>[];
    if (Number(rows[0]?.['users'] ?? 0) !== new Set(users).size || Number(rows[0]?.['depts'] ?? 0) !== new Set(depts).size) {
      throw new ViewConfigError("the shared user or department does not exist", "INVALID_PARAMETER");
    }
  };
  const assertCanManage = async (executor: Executor, identity: Identity, id: string): Promise<void> => {
    const rows = (await executor.execute(sql`
      SELECT user_id as "userId"
      FROM oe_user_view
      WHERE id = ${id}
        AND tenant_id = ${identity.tenantId}
        AND (user_id = ${identity.userId} OR scope = 'all' OR ${identity.userId} = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_user_ids)))
          OR EXISTS (SELECT 1 FROM oe_org_affiliation oa WHERE oa.tenant_id = oe_user_view.tenant_id AND oa.subject_user_id = ${identity.userId} AND oa.resource_id = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_dept_ids)))))
    `)) as unknown as readonly Record<string, unknown>[];
    const row = rows[0];
    if (!row) throw new UserViewNotFoundError();
    if (row['userId'] !== identity.userId) throw new UserViewPermissionDeniedError();
  };

  /** Visibility check: owned by me, or inside the share scope. Returns the row's userId / module for later branches. */
  const assertVisible = async (
    executor: Executor,
    identity: Identity,
    id: string,
  ): Promise<{ readonly userId: string; readonly module: string }> => {
    const rows = (await executor.execute(sql`
      SELECT user_id as "userId", module
      FROM oe_user_view
      WHERE id = ${id}
        AND tenant_id = ${identity.tenantId}
        AND (user_id = ${identity.userId} OR scope = 'all' OR ${identity.userId} = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_user_ids)))
          OR EXISTS (SELECT 1 FROM oe_org_affiliation oa WHERE oa.tenant_id = oe_user_view.tenant_id AND oa.subject_user_id = ${identity.userId} AND oa.resource_id = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_dept_ids)))))
    `)) as unknown as readonly Record<string, unknown>[];
    const row = rows[0];
    if (!row) throw new UserViewNotFoundError();
    return { userId: row['userId'] as string, module: row['module'] as string };
  };

  const mapViewRow = (row: Record<string, unknown>, identity: Identity): UserView => ({
    id: row['id'] as string,
    name: row['name'] as string,
    icon: row['icon'] as string,
    module: row['module'] as string,
    userId: row['userId'] as string,
    ownerName: row['ownerName'] as string,
    scope: row['scope'] === 'all' ? 'all' : 'custom',
    scopeUserIds: (row['scopeUserIds'] as string[]) || [],
    scopeDeptIds: (row['scopeDeptIds'] as string[]) || [],
    canManage: row['userId'] === identity.userId,
    filters: (row['filters'] as unknown as UserView['filters']) || [],
    displayFields: (row['displayFields'] as unknown as UserView['displayFields']) || [],
    sortRules: (row['sortRules'] as unknown as UserView['sortRules']) || [],
    sortOrder: Number(row['sortOrder'] ?? 0),
    createdAt: row['createdAt'] as string,
    updatedAt: row['updatedAt'] as string,
  });

  /** Reorder by the personal tab preference; views missing from the preference keep their sortOrder and go at the end. Returns display positions 1..n. */
  const applyPersonalOrder = (
    views: readonly UserView[],
    orderedIds: readonly string[] | null,
  ): readonly UserView[] => {
    if (orderedIds === null || orderedIds.length === 0) {
      return views.map((view, index) => ({ ...view, sortOrder: index + 1 }));
    }
    const rank = new Map(orderedIds.map((id, index) => [id, index]));
    const sorted = [...views].sort((a, b) => {
      const ai = rank.has(a.id) ? rank.get(a.id)! : Number.POSITIVE_INFINITY;
      const bi = rank.has(b.id) ? rank.get(b.id)! : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return a.sortOrder - b.sortOrder;
    });
    return sorted.map((view, index) => ({ ...view, sortOrder: index + 1 }));
  };

  return {
    async list(identity: Identity, module: string): Promise<readonly UserView[]> {
      const rows = (await exec.execute(sql`
        SELECT
          id::text,
          name,
          icon,
          module,
          user_id as "userId", COALESCE((SELECT display_name FROM oe_subject ps WHERE ps.tenant_id = oe_user_view.tenant_id AND ps.id = oe_user_view.user_id), user_id) as "ownerName", scope, scope_user_ids as "scopeUserIds", scope_dept_ids as "scopeDeptIds",
          filters,
          display_fields as "displayFields",
          sort_rules as "sortRules",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM oe_user_view
        WHERE tenant_id = ${identity.tenantId} AND module = ${module}
          AND (user_id = ${identity.userId} OR scope = 'all' OR ${identity.userId} = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_user_ids)))
            OR EXISTS (SELECT 1 FROM oe_org_affiliation oa WHERE oa.tenant_id = oe_user_view.tenant_id AND oa.subject_user_id = ${identity.userId} AND oa.resource_id = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_dept_ids)))))
        ORDER BY sort_order ASC
      `)) as unknown as readonly Record<string, unknown>[];

      const views = rows.map((row) => mapViewRow(row, identity));

      const prefRows = (await exec.execute(sql`
        SELECT ordered_ids as "orderedIds"
        FROM oe_user_view_tab_order
        WHERE tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
          AND module = ${module}
        LIMIT 1
      `)) as unknown as readonly Record<string, unknown>[];
      const orderedIds = (prefRows[0]?.['orderedIds'] as string[] | undefined) ?? null;

      return applyPersonalOrder(views, orderedIds);
    },

    async getById(identity: Identity, id: string): Promise<UserView | null> {
      const rows = (await exec.execute(sql`
        SELECT
          id::text,
          name,
          icon,
          module,
          user_id as "userId", COALESCE((SELECT display_name FROM oe_subject ps WHERE ps.tenant_id = oe_user_view.tenant_id AND ps.id = oe_user_view.user_id), user_id) as "ownerName", scope, scope_user_ids as "scopeUserIds", scope_dept_ids as "scopeDeptIds",
          filters,
          display_fields as "displayFields",
          sort_rules as "sortRules",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM oe_user_view
        WHERE id = ${id}
          AND tenant_id = ${identity.tenantId}
          AND (user_id = ${identity.userId} OR scope = 'all' OR ${identity.userId} = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_user_ids)))
            OR EXISTS (SELECT 1 FROM oe_org_affiliation oa WHERE oa.tenant_id = oe_user_view.tenant_id AND oa.subject_user_id = ${identity.userId} AND oa.resource_id = ANY(ARRAY(SELECT jsonb_array_elements_text(scope_dept_ids)))))
      `)) as unknown as readonly Record<string, unknown>[];

      if (rows.length === 0) return null;

      const row = rows[0];
      if (!row) return null;

      return mapViewRow(row, identity);
    },

    async create(identity: Identity, input: UserViewInput): Promise<UserView> {
      // Check the view count limit (at most 20 per user per module).
      return await exec.transaction(async (tx) => {
      // Serialize creates for the same tenant/user/module, so concurrent requests cannot all pass the count check and compute the same order.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`open-user-view:${identity.tenantId}:${identity.userId}:${input.module}`}, 0))`);
      await assertShareTargets(tx, identity, input.scope, input.scopeUserIds ?? [], input.scopeDeptIds ?? []);

      const countRows = (await tx.execute(sql`
        SELECT COUNT(*) as count
        FROM oe_user_view
        WHERE tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
          AND module = ${input.module}
      `)) as unknown as readonly Record<string, unknown>[];

      const count = Number(countRows[0]?.['count'] ?? 0);
      if (count >= 20) {
        throw new UserViewLimitError();
      }

      // Check name uniqueness (no duplicate names under the same module).
      const duplicateRows = (await tx.execute(sql`
        SELECT id
        FROM oe_user_view
        WHERE tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
          AND module = ${input.module}
          AND name = ${input.name}
      `)) as unknown as readonly Record<string, unknown>[];

      if (duplicateRows.length > 0) {
        throw new UserViewDuplicateNameError();
      }

      // Compute sortOrder automatically.
      const maxRows = (await tx.execute(sql`
        SELECT COALESCE(MAX(sort_order), 0) as max_order
        FROM oe_user_view
        WHERE tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
          AND module = ${input.module}
      `)) as unknown as readonly Record<string, unknown>[];
      const sortOrder = Number(maxRows[0]?.['max_order'] ?? 0) + 1;
      const id = randomUUID();
      const code = `view-${randomUUID()}`;

      const rows = (await tx.execute(sql`
        INSERT INTO oe_user_view (
          id, tenant_id, org_id, status, revision, created_by, updated_by, code,
          name,
          icon,
          module,
          user_id,
          scope, scope_user_ids, scope_dept_ids,
          filters,
          display_fields,
          sort_rules,
          sort_order
        ) VALUES (
          ${id}, ${identity.tenantId}, ${identity.orgId}, 'active', 1, ${identity.userId}, ${identity.userId}, ${code},
          ${input.name},
          ${input.icon},
          ${input.module},
          ${identity.userId},
          ${input.scope ?? 'all'}, ${JSON.stringify(input.scopeUserIds ?? [])}::jsonb, ${JSON.stringify(input.scopeDeptIds ?? [])}::jsonb,
          ${JSON.stringify(input.filters)}::jsonb,
          ${JSON.stringify(input.displayFields)}::jsonb,
          ${JSON.stringify(input.sortRules)}::jsonb,
          ${sortOrder}
        )
        RETURNING
          id::text,
          name,
          icon,
          module,
          user_id as "userId", COALESCE((SELECT display_name FROM oe_subject ps WHERE ps.tenant_id = oe_user_view.tenant_id AND ps.id = oe_user_view.user_id), user_id) as "ownerName", scope, scope_user_ids as "scopeUserIds", scope_dept_ids as "scopeDeptIds",
          filters,
          display_fields as "displayFields",
          sort_rules as "sortRules",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `)) as unknown as readonly Record<string, unknown>[];

      const row = rows[0];
      if (!row) {
        throw new Error("failed to create the view");
      }
      return {
        id: row['id'] as string,
        name: row['name'] as string,
        icon: row['icon'] as string,
        module: row['module'] as string,
        userId: row['userId'] as string,
        ownerName: row['ownerName'] as string,
        scope: row['scope'] === 'all' ? 'all' : 'custom', scopeUserIds: (row['scopeUserIds'] as string[]) || [], scopeDeptIds: (row['scopeDeptIds'] as string[]) || [], canManage: true,
        filters: (row['filters'] as unknown as UserView['filters']) || [],
        displayFields: (row['displayFields'] as unknown as UserView['displayFields']) || [],
        sortRules: (row['sortRules'] as unknown as UserView['sortRules']) || [],
        sortOrder: Number(row['sortOrder'] ?? 0),
        createdAt: row['createdAt'] as string,
        updatedAt: row['updatedAt'] as string,
      };
      });
    },

    async update(identity: Identity, id: string, input: UserViewInput): Promise<UserView> {
      return await exec.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`open-user-view:${identity.tenantId}:${identity.userId}:${id}`}, 0))`);
      await assertCanManage(tx, identity, id);
      await assertShareTargets(tx, identity, input.scope, input.scopeUserIds ?? [], input.scopeDeptIds ?? []);
      // Read the current view's module first.
      const currentRows = (await tx.execute(sql`
        SELECT user_id, module
        FROM oe_user_view
        WHERE id = ${id}
          AND tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
      `)) as unknown as readonly Record<string, unknown>[];

      if (currentRows.length === 0) {
        throw new UserViewNotFoundError();
      }

      const current = currentRows[0];
      const module = current?.['module'] as string;

      // Check whether the name duplicates another view.
      const duplicateRows = (await tx.execute(sql`
        SELECT id
        FROM oe_user_view
        WHERE tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
          AND module = ${module}
          AND name = ${input.name}
          AND id != ${id}
      `)) as unknown as readonly Record<string, unknown>[];

      if (duplicateRows.length > 0) {
        throw new UserViewDuplicateNameError();
      }

      const rows = (await tx.execute(sql`
        UPDATE oe_user_view
        SET
          name = ${input.name},
          icon = ${input.icon},
          filters = ${JSON.stringify(input.filters)}::jsonb,
          display_fields = ${JSON.stringify(input.displayFields)}::jsonb,
          sort_rules = ${JSON.stringify(input.sortRules)}::jsonb,
          scope = ${input.scope ?? 'custom'}, scope_user_ids = ${JSON.stringify(input.scopeUserIds ?? [])}::jsonb, scope_dept_ids = ${JSON.stringify(input.scopeDeptIds ?? [])}::jsonb,
          revision = revision + 1,
          updated_by = ${identity.userId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
          AND tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
        RETURNING
          id::text,
          name,
          icon,
          module,
          user_id as "userId", COALESCE((SELECT display_name FROM oe_subject ps WHERE ps.tenant_id = oe_user_view.tenant_id AND ps.id = oe_user_view.user_id), user_id) as "ownerName", scope, scope_user_ids as "scopeUserIds", scope_dept_ids as "scopeDeptIds",
          filters,
          display_fields as "displayFields",
          sort_rules as "sortRules",
          sort_order as "sortOrder",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `)) as unknown as readonly Record<string, unknown>[];

      if (rows.length === 0) {
        throw new UserViewNotFoundError();
      }

      const row = rows[0];
      if (!row) {
        throw new UserViewNotFoundError();
      }
      return {
        id: row['id'] as string,
        name: row['name'] as string,
        icon: row['icon'] as string,
        module: row['module'] as string,
        userId: row['userId'] as string,
        ownerName: row['ownerName'] as string,
        scope: row['scope'] === 'all' ? 'all' : 'custom', scopeUserIds: (row['scopeUserIds'] as string[]) || [], scopeDeptIds: (row['scopeDeptIds'] as string[]) || [], canManage: true,
        filters: (row['filters'] as unknown as UserView['filters']) || [],
        displayFields: (row['displayFields'] as unknown as UserView['displayFields']) || [],
        sortRules: (row['sortRules'] as unknown as UserView['sortRules']) || [],
        sortOrder: Number(row['sortOrder'] ?? 0),
        createdAt: row['createdAt'] as string,
        updatedAt: row['updatedAt'] as string,
      };
      });
    },

    async remove(identity: Identity, id: string): Promise<void> {
      await assertCanManage(exec, identity, id);
      const rows = (await exec.execute(sql`
        DELETE FROM oe_user_view
        WHERE id = ${id}
          AND tenant_id = ${identity.tenantId}
          AND user_id = ${identity.userId}
        RETURNING id
      `)) as unknown as readonly Record<string, unknown>[];

      if (rows.length === 0) {
        throw new UserViewNotFoundError();
      }
    },

    async updateSort(identity: Identity, module: string, orders: readonly { id: string; sortOrder: number }[]): Promise<void> {
      if (orders.length === 0) return;
      const seen = new Set<number>();
      const seenIds = new Set<string>();
      for (const order of orders) {
        if (!Number.isInteger(order.sortOrder) || order.sortOrder <= 0 || seen.has(order.sortOrder)) {
          throw new ViewConfigError("sort positions must be distinct positive integers", "INVALID_PARAMETER");
        }
        if (seenIds.has(order.id)) {
          throw new ViewConfigError("the sort list contains a duplicate view", "INVALID_PARAMETER");
        }
        seen.add(order.sortOrder);
        seenIds.add(order.id);
      }
      await exec.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`open-user-view:${identity.tenantId}:${identity.userId}:${module}`}, 0))`);

        const ownedOrders: { id: string; sortOrder: number }[] = [];
        for (const order of orders) {
          const visible = await assertVisible(tx, identity, order.id);
          if (visible.module !== module) {
            throw new ViewConfigError("a sort item does not match the module", "INVALID_PARAMETER");
          }
          if (visible.userId === identity.userId) {
            ownedOrders.push(order);
          }
        }

        // Take the full personal tab order by ascending sortOrder and store it in the preference table.
        const orderedIds = [...orders]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((order) => order.id);
        await tx.execute(sql`
          INSERT INTO oe_user_view_tab_order (tenant_id, user_id, module, ordered_ids, updated_at)
          VALUES (${identity.tenantId}, ${identity.userId}, ${module}, ${JSON.stringify(orderedIds)}::jsonb, CURRENT_TIMESTAMP)
          ON CONFLICT (tenant_id, user_id, module) DO UPDATE SET
            ordered_ids = EXCLUDED.ordered_ids,
            updated_at = CURRENT_TIMESTAMP
        `);

        // Sync the default sort_order of self-built views, for recipients who do not have a personal preference yet.
        if (ownedOrders.length > 0) {
          const values = ownedOrders.map(({ id, sortOrder }) => sql`(${id}, ${sortOrder})`);
          await tx.execute(sql`
            UPDATE oe_user_view
            SET sort_order = data.sort_order::numeric,
                updated_at = CURRENT_TIMESTAMP
            FROM (VALUES ${sql.join(values, sql`, `)}) AS data(id, sort_order)
            WHERE oe_user_view.id = data.id
              AND oe_user_view.tenant_id = ${identity.tenantId}
              AND oe_user_view.user_id = ${identity.userId}
              AND oe_user_view.module = ${module}
          `);
        }
      });
    },
    async share(identity: Identity, id: string, input): Promise<UserView> {
      await assertCanManage(exec, identity, id);
      const users = input.scopeUserIds ?? [];
      const depts = input.scopeDeptIds ?? [];
      await assertShareTargets(exec, identity, input.scope, users, depts);
      const rows = (await exec.execute(sql`
        UPDATE oe_user_view SET scope = ${input.scope ?? 'custom'}, scope_user_ids = ${JSON.stringify(users)}::jsonb,
          scope_dept_ids = ${JSON.stringify(depts)}::jsonb, revision = revision + 1, updated_by = ${identity.userId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND tenant_id = ${identity.tenantId} AND user_id = ${identity.userId}
        RETURNING id::text
      `)) as unknown as readonly Record<string, unknown>[];
      if (rows.length === 0) throw new UserViewNotFoundError();
      const view = await this.getById(identity, id);
      if (!view) throw new UserViewNotFoundError();
      return view;
    },
    async unshareUser(identity: Identity, id: string, userId: string): Promise<UserView> {
      await assertCanManage(exec, identity, id);
      const rows = (await exec.execute(sql`
        UPDATE oe_user_view SET scope_user_ids = COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(scope_user_ids) x WHERE x <> ${userId}), '[]'::jsonb),
          revision = revision + 1, updated_by = ${identity.userId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND tenant_id = ${identity.tenantId} AND user_id = ${identity.userId} RETURNING id::text
      `)) as unknown as readonly Record<string, unknown>[];
      if (rows.length === 0) throw new UserViewNotFoundError();
      const view = await this.getById(identity, id);
      if (!view) throw new UserViewNotFoundError();
      return view;
    },
  };
}
