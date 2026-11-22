// ---------------------------------------------------------------------------
// Saved-view repository — where a list page stores "how I look at this document"
//
// 🔴 `columns` stores the **diff** (`ColumnOverride[]`), not the whole column list, and this layer
// **only stores and loads it as-is**: composing it is `resolveColumns()` in `packages/metamodel/src/normalize/query.ts`.
// If the repository helpfully composed the diff into a full list and stored that, "add a field to the module" would
// silently stop working for every old user who had saved a view — they would never see the new column, and nothing would error.
//
// 🔴 Ownership comes from identity, not from the caller. `SavedViewInput` has no `ownerId`:
// letting the client set ownership would let someone create a view under another name, and that call would look completely innocent.
// A null ownerId is a **shared view** (an admin built it for the whole department). This layer can read it and cannot write it —
// if it could write it, anyone could turn their private view into a department-wide one.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { normalizeColumnOverrides, type Query, type SavedView } from "@open-erp/metamodel";
import { savedView } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import type { SavedViewInput, SavedViewRepo } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export class SavedViewError extends Error {
  override readonly name = "SavedViewError";
}

function fail(message: string): never {
  throw new SavedViewError(message);
}

/**
 * A stored row → `SavedView`.
 *
 * `query` / `columns` are jsonb, stored as-is and loaded as-is. A bad shape (not an object / not an array) throws on the spot:
 * an empty view that "looks usable" would make the user think their filter was cleared, when the truth is that the row is corrupt.
 */
function viewOf(raw: Record<string, unknown>): SavedView {
  const id = String(raw["id"]);
  const query = raw["query"];
  const columns = raw["columns"];
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    fail(`view ${id} query is not an object (actual ${JSON.stringify(query)}) — the stored data is corrupt, and this does not guess an empty query`);
  }
  if (!Array.isArray(columns)) {
    fail(`view ${id} columns is not an array (actual ${JSON.stringify(columns)}) — the column diff cannot be read, and this does not degrade to "no overrides"`);
  }
  return {
    id,
    module: String(raw["module"]),
    name: String(raw["name"]),
    ownerId: (raw["ownerId"] as string | null) ?? null,
    query: query as Query,
    // 🔴 Normalize the shape on read too, do not bare-cast: what jsonb stores is **history** —
    // rows saved before the summary dimension existed have no `summary` key, and a bare cast lets that flow into
    // the render layer as undefined, while `undefined` and `null` look the same for "is there a summary" and are not equal.
    // This is not a fallback for bad data: a key that is present with the wrong type still throws (see normalizeColumnOverrides).
    columns: normalizeColumnOverrides(columns, `view ${id} columns`),
    isDefault: raw["isDefault"] === true,
  };
}

export function createSavedViewRepo(exec: Executor): SavedViewRepo {
  /** Position after the last one under the same (tenant × module × me), plus 1. View-bar order must be stable, not left to insert order. */
  const nextSortOrder = async (tx: Executor, who: Identity, module: string): Promise<number> => {
    const rows = await tx
      .select({
        // coalesce(…, -1) is **arithmetic**: in an empty set the "last position" is -1, so the next one is 0.
        // That is a different thing from "fill in a default when the read fails".
        next: sql<string>`coalesce(max(${savedView.sortOrder}), -1) + 1`,
      })
      .from(savedView)
      .where(scopedWhere(savedView, who, eq(savedView.module, module), eq(savedView.ownerId, who.userId)));
    const next = Number(rows[0]?.next);
    if (!Number.isInteger(next)) fail(`save view: cannot compute a sort position (got ${String(rows[0]?.next)})`);
    return next;
  };

  /** When a write misses, say why: missing / shared / someone else's / wrong module are four different things. */
  const explainMiss = async (tx: Executor, who: Identity, id: string, what: string): Promise<never> => {
    const rows = await tx
      .select()
      .from(savedView)
      .where(scopedWhere(savedView, who, eq(savedView.id, id)))
      .limit(1);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) fail(`${what}: there is no view with id "${id}" (or it is not in the current tenant)`);
    const found = viewOf(row);
    if (found.ownerId === null) {
      fail(`${what}: "${found.name}" is a shared view (an admin built it for the whole department) and cannot be rewritten or deleted by an individual`);
    }
    if (found.ownerId !== who.userId) {
      fail(`${what}: view "${found.name}" belongs to ${found.ownerId}, not the current user ${who.userId}`);
    }
    fail(`${what}: view "${found.name}" is under module "${found.module}", which does not match the module on this request`);
  };

  return {
    async list(identity: Identity, module: string): Promise<readonly SavedView[]> {
      const who = requireIdentity(identity);
      if (!module.trim()) fail("list views: missing module — \"views for every module\" is not what any list page asks for");
      const rows = await exec
        .select()
        .from(savedView)
        .where(
          scopedWhere(
            savedView,
            who,
            eq(savedView.module, module),
            // Mine plus shared. Someone else's private view is not returned: a view stores query conditions,
            // and that is how someone else looks at the data.
            or(isNull(savedView.ownerId), eq(savedView.ownerId, who.userId)),
          ),
        )
        // View-bar order must be stable; when sortOrder ties, id makes a total order.
        .orderBy(asc(savedView.sortOrder), asc(savedView.id));
      return (rows as Record<string, unknown>[]).map(viewOf);
    },

    async save(identity: Identity, input: SavedViewInput): Promise<SavedView> {
      const who = requireIdentity(identity);
      if (!input.module.trim()) fail("save view: missing module");
      if (!input.name.trim()) fail("save view: the name cannot be empty — the view bar would show an empty button that cannot be clicked");

      // 🔴 Clearing the previous default and writing must be the same transaction: committed separately, there is a moment when **no view is the default**,
      // and if the failure lands in that moment the user's default view disappears.
      return await exec.transaction(async (tx) => {
        // Order cannot be reversed: the partial unique index is checked per statement, so writing first and clearing second always collides.
        if (input.isDefault) {
          await tx
            .update(savedView)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              scopedWhere(
                savedView,
                who,
                eq(savedView.module, input.module),
                // Clear only mine. The shared view's default slot is not an individual's to manage.
                eq(savedView.ownerId, who.userId),
                eq(savedView.isDefault, true),
                input.id === null ? undefined : ne(savedView.id, input.id),
              ),
            );
        }

        if (input.id === null) {
          const values = scopedValues(who, {
            id: randomUUID(),
            module: input.module,
            name: input.name,
            // 🔴 Ownership comes from identity. What the caller says does not count.
            ownerId: who.userId,
            query: input.query,
            columns: input.columns,
            sortOrder: await nextSortOrder(tx, who, input.module),
            isDefault: input.isDefault,
          });
          const inserted = await guardWrite(
            `save view "${input.name}"`,
            async () => await tx.insert(savedView).values(values).returning(),
          );
          const row = inserted[0] as Record<string, unknown> | undefined;
          if (!row) fail(`save view "${input.name}": the insert returned no row`);
          return viewOf(row);
        }

        // Bind it to a local first: the condition below is built in a closure, and a closure reading `input.id`
        // does not get the narrowing from the null branch above.
        const id = input.id;
        const updated = await guardWrite(
          `save view "${input.name}"`,
          async () =>
            await tx
              .update(savedView)
              .set({
                name: input.name,
                query: input.query,
                columns: input.columns,
                isDefault: input.isDefault,
                updatedAt: new Date(),
              })
              .where(
                scopedWhere(
                  savedView,
                  who,
                  eq(savedView.id, id),
                  eq(savedView.module, input.module),
                  // 🔴 Only mine can be changed. Shared views and other people's views are not found here, so they fall through to explainMiss.
                  eq(savedView.ownerId, who.userId),
                ),
              )
              .returning(),
        );
        const row = updated[0] as Record<string, unknown> | undefined;
        if (!row) return await explainMiss(tx, who, id, `save view "${input.name}"`);
        return viewOf(row);
      });
    },

    async remove(identity: Identity, id: string): Promise<void> {
      const who = requireIdentity(identity);
      if (!id.trim()) fail("delete view: missing id");
      const deleted = await exec
        .delete(savedView)
        .where(scopedWhere(savedView, who, eq(savedView.id, id), eq(savedView.ownerId, who.userId)))
        .returning({ id: savedView.id });
      // Failing to delete a view is not "already deleted": usually the client holds a stale id, or it is deleting a shared view.
      if (!deleted.length) await explainMiss(exec, who, id, "delete view");
    },
  };
}
