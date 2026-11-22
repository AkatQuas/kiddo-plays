// ---------------------------------------------------------------------------
// Custom-field definitions and bindings — read and write **metadata** only, and touch no business row
//
// The shape copies `choiceSetRepo`: optimistic concurrency (one revision per module), audit append-only,
// and every write goes through the same `mutate`. Writing concurrency and traces twice will eventually drift into two behaviors.
// ---------------------------------------------------------------------------

import { and, asc, eq, or, isNull } from "drizzle-orm";
import {
  CustomFieldInputError,
  type CustomFieldBindingRecord,
  type CustomFieldRecord,
  type CustomFieldStatus,
  type CustomFieldSurfaces,
  type EffectiveCustomField,
} from "@open-erp/metamodel";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { customField, customFieldAudit, customFieldBinding, customFieldState } from "../db/framework.js";
import { scopedWhere } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import type { Executor } from "./support.js";

export class CustomFieldNotFoundError extends Error {}

/** Every enabled binding on a module right now, plus its revision. revision is the cache key at the merge point. */
export interface ModuleCustomFields {
  readonly module: string;
  readonly revision: number;
  readonly overlay: readonly EffectiveCustomField[];
}

export interface CustomFieldRepo {
  /** For the merge point: this tenant's enabled bindings on this module. **This is the hot path, and the caller must cache by revision.** */
  forModule(identity: Identity, module: string): Promise<ModuleCustomFields>;
  /** For the admin screen: every field definition in this tenant. */
  listFields(identity: Identity): Promise<readonly CustomFieldRecord[]>;
  /** For the admin screen: every binding of one field. */
  listBindings(identity: Identity, fieldId: string): Promise<readonly CustomFieldBindingRecord[]>;
  /** For the admin screen: each module's current revision. The screen must send it back unchanged for optimistic concurrency. */
  moduleRevisions(identity: Identity): Promise<Readonly<Record<string, number>>>;
  createField(identity: Identity, input: NewCustomField, at: Date): Promise<CustomFieldRecord>;
  updateField(identity: Identity, id: string, patch: CustomFieldPatch, at: Date): Promise<CustomFieldRecord>;
  saveBinding(identity: Identity, input: NewBinding, at: Date): Promise<CustomFieldBindingRecord>;
  removeBinding(identity: Identity, id: string, at: Date): Promise<void>;
}

export interface NewCustomField {
  readonly key: string;
  readonly label: string;
  readonly valueKind: CustomFieldRecord["valueKind"];
  readonly choiceSetCode: string | null;
  readonly help: string | null;
}

export interface CustomFieldPatch {
  readonly label?: string;
  readonly help?: string | null;
  readonly status?: CustomFieldStatus;
}

export interface NewBinding {
  readonly fieldId: string;
  readonly module: string;
  /** null = header; non-null = the key of that line table on this module. */
  readonly lineTable: string | null;
  readonly origin: CustomFieldBindingRecord["origin"];
  readonly inherit: CustomFieldBindingRecord["inherit"];
  readonly surfaces: CustomFieldSurfaces;
  readonly sortOrder: number;
  readonly status: CustomFieldStatus;
  /** The revision last read. A mismatch means someone else just changed it, and the overwrite is refused. */
  readonly expectedRevision: number;
}

function id(): string {
  return crypto.randomUUID();
}

function fieldOf(row: typeof customField.$inferSelect): CustomFieldRecord {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    valueKind: row.valueKind as CustomFieldRecord["valueKind"],
    choiceSetCode: row.choiceSetCode,
    help: row.help,
    status: row.status as CustomFieldStatus,
  };
}

function bindingOf(row: typeof customFieldBinding.$inferSelect): CustomFieldBindingRecord {
  return {
    id: row.id,
    fieldId: row.fieldId,
    module: row.module,
    lineTable: row.lineTable,
    origin: row.origin as CustomFieldBindingRecord["origin"],
    inherit: (row.inherit ?? null) as CustomFieldBindingRecord["inherit"],
    surfaces: row.surfaces as CustomFieldSurfaces,
    sortOrder: row.sortOrder,
    status: row.status as CustomFieldStatus,
  };
}

export function createCustomFieldRepo(exec: Executor): CustomFieldRepo {
  /** Increment the per-module revision by 1 and append one audit row. Every write goes through here, not through its own copy. */
  const bump = async (
    identity: Identity,
    module: string,
    fieldKey: string,
    action: string,
    before: unknown,
    after: unknown,
    at: Date,
    expectedRevision: number | null,
  ): Promise<number> => {
    const who = requireIdentity(identity);
    const rows = await exec
      .select()
      .from(customFieldState)
      .where(scopedWhere(customFieldState, who, eq(customFieldState.module, module)))
      .limit(1);
    const current = rows[0]?.revision ?? 0;
    if (expectedRevision !== null && expectedRevision !== current) {
      throw new CustomFieldInputError(
        `custom field configuration for "${module}" was just changed by someone else (current revision ${String(current)}, you saw ${String(expectedRevision)}) — refresh and retry, so you do not overwrite their change`,
      );
    }
    const next = current + 1;
    if (rows[0]) {
      await exec
        .update(customFieldState)
        .set({ revision: next, updatedAt: at, updatedBy: who.userId })
        .where(scopedWhere(customFieldState, who, eq(customFieldState.module, module)));
    } else {
      await exec.insert(customFieldState).values({
        tenantId: who.tenantId,
        orgId: who.orgId,
        module,
        revision: next,
        updatedAt: at,
        updatedBy: who.userId,
      });
    }
    await exec.insert(customFieldAudit).values({
      id: id(),
      tenantId: who.tenantId,
      orgId: who.orgId,
      module,
      fieldKey,
      action,
      revision: next,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
      actorId: who.userId,
      at,
    });
    return next;
  };

  return {
    async forModule(identity, module) {
      const who = requireIdentity(identity);
      const [stateRows, bindingRows] = await Promise.all([
        exec
          .select()
          .from(customFieldState)
          .where(scopedWhere(customFieldState, who, eq(customFieldState.module, module)))
          .limit(1),
        exec
          .select()
          .from(customFieldBinding)
          .where(
            scopedWhere(
              customFieldBinding,
              who,
              and(eq(customFieldBinding.module, module), eq(customFieldBinding.status, "active"))!,
            ),
          )
          .orderBy(asc(customFieldBinding.sortOrder)),
      ]);
      if (bindingRows.length === 0) {
        return { module, revision: stateRows[0]?.revision ?? 0, overlay: [] };
      }
      const fieldRows = await exec
        .select()
        .from(customField)
        .where(scopedWhere(customField, who, eq(customField.status, "active")));
      const byId = new Map(fieldRows.map((row) => [row.id, fieldOf(row)]));
      const overlay: EffectiveCustomField[] = [];
      for (const row of bindingRows) {
        const field = byId.get(row.fieldId);
        // When a field is disabled, its bindings stop applying with it — do not invent a placeholder field here,
        // or "disabled" would look like it did not take effect on the screen.
        if (!field) continue;
        overlay.push({ field, binding: bindingOf(row) });
      }
      return { module, revision: stateRows[0]?.revision ?? 0, overlay };
    },

    async listFields(identity) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(customField)
        .where(scopedWhere(customField, who))
        .orderBy(asc(customField.createdAt));
      return rows.map(fieldOf);
    },

    async moduleRevisions(identity) {
      const who = requireIdentity(identity);
      const rows = await exec.select().from(customFieldState).where(scopedWhere(customFieldState, who));
      const out: Record<string, number> = {};
      for (const row of rows as { module: string; revision: number }[]) out[row.module] = row.revision;
      return out;
    },

    async listBindings(identity, fieldId) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(customFieldBinding)
        .where(scopedWhere(customFieldBinding, who, eq(customFieldBinding.fieldId, fieldId)))
        .orderBy(asc(customFieldBinding.module));
      return rows.map(bindingOf);
    },

    async createField(identity, input, at) {
      const who = requireIdentity(identity);
      const row = {
        id: id(),
        tenantId: who.tenantId,
        orgId: who.orgId,
        key: input.key,
        label: input.label,
        valueKind: input.valueKind,
        choiceSetCode: input.choiceSetCode,
        help: input.help,
        status: "draft" as const,
        createdAt: at,
        createdBy: who.userId,
        updatedAt: at,
        updatedBy: who.userId,
      };
      // 🔴 **Check before storing.** Warehouse rule: classify user input before it enters PostgreSQL,
      // and do not relabel an arbitrary constraint failure as 400 — so a duplicate name is found here and stated per field,
      // and a real constraint hit (concurrency) is left to `guardWrite` to say "please retry". The two are not folded into one sentence.
      const clash = await exec
        .select({ key: customField.key, label: customField.label })
        .from(customField)
        .where(scopedWhere(customField, who, or(eq(customField.key, input.key), eq(customField.label, input.label))!));
      for (const taken of clash) {
        if (taken.key === input.key) throw new CustomFieldInputError(`field code "${input.key}" is already taken`);
        if (taken.label === input.label) throw new CustomFieldInputError(`field name "${input.label}" is already taken by another field`);
      }
      await guardWrite("create a custom field", async () => {
        await exec.insert(customField).values(row);
      });
      return { id: row.id, key: row.key, label: row.label, valueKind: row.valueKind, choiceSetCode: row.choiceSetCode, help: row.help, status: row.status };
    },

    async updateField(identity, fieldId, patch, at) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(customField)
        .where(scopedWhere(customField, who, eq(customField.id, fieldId)))
        .limit(1);
      const before = rows[0];
      if (!before) throw new CustomFieldNotFoundError(`custom field not found (${fieldId})`);
      const next = {
        ...before,
        ...(patch.label === undefined ? {} : { label: patch.label }),
        ...(patch.help === undefined ? {} : { help: patch.help }),
        ...(patch.status === undefined ? {} : { status: patch.status }),
        updatedAt: at,
        updatedBy: who.userId,
      };
      await exec
        .update(customField)
        .set({ label: next.label, help: next.help, status: next.status, updatedAt: at, updatedBy: who.userId })
        .where(scopedWhere(customField, who, eq(customField.id, fieldId)));
      // The field itself changed, so the schema of every module it is bound to changed — bump each one,
      // or those modules' caches will not invalidate and the screen will keep showing the old field name.
      const bindings = await exec
        .select()
        .from(customFieldBinding)
        .where(scopedWhere(customFieldBinding, who, eq(customFieldBinding.fieldId, fieldId)));
      for (const binding of bindings as { readonly module: string }[]) {
        await bump(identity, binding.module, before.key, "field.update", fieldOf(before), fieldOf(next), at, null);
      }
      return fieldOf(next);
    },

    async saveBinding(identity, input, at) {
      const who = requireIdentity(identity);
      const fieldRows = await exec
        .select()
        .from(customField)
        .where(scopedWhere(customField, who, eq(customField.id, input.fieldId)))
        .limit(1);
      const field = fieldRows[0];
      if (!field) throw new CustomFieldNotFoundError(`custom field not found (${input.fieldId})`);

      const existing = await exec
        .select()
        .from(customFieldBinding)
        .where(
          scopedWhere(
            customFieldBinding,
            who,
            /**
             * 🔴 Locating a binding must **include the level**: the same field can be bound both on a sales-order header
             * and on its line rows (two rules, each independent). Finding by (field, module) only
             * overwrites the first when the second is configured, and the symptom is "the header binding that was just saved is gone".
             */
            and(
              eq(customFieldBinding.fieldId, input.fieldId),
              eq(customFieldBinding.module, input.module),
              // A header is stored as null. `= null` in SQL is never true, so this must use is null.
              input.lineTable === null
                ? isNull(customFieldBinding.lineTable)
                : eq(customFieldBinding.lineTable, input.lineTable),
            )!,
          ),
        )
        .limit(1);

      const values = {
        fieldId: input.fieldId,
        module: input.module,
        lineTable: input.lineTable,
        origin: input.origin,
        inherit: (input.inherit ?? null) as never,
        surfaces: input.surfaces as never,
        sortOrder: input.sortOrder,
        status: input.status,
        updatedAt: at,
        updatedBy: who.userId,
      };
      let saved: typeof customFieldBinding.$inferSelect;
      if (existing[0]) {
        await exec
          .update(customFieldBinding)
          .set(values)
          .where(scopedWhere(customFieldBinding, who, eq(customFieldBinding.id, existing[0].id)));
        saved = { ...existing[0], ...values } as typeof customFieldBinding.$inferSelect;
      } else {
        saved = {
          id: id(),
          tenantId: who.tenantId,
          orgId: who.orgId,
          createdAt: at,
          createdBy: who.userId,
          ...values,
        } as typeof customFieldBinding.$inferSelect;
        await exec.insert(customFieldBinding).values(saved);
      }
      await bump(
        identity,
        input.module,
        field.key,
        existing[0] ? "binding.update" : "binding.create",
        existing[0] ? bindingOf(existing[0]) : null,
        bindingOf(saved),
        at,
        input.expectedRevision,
      );
      return bindingOf(saved);
    },

    async removeBinding(identity, bindingId, at) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(customFieldBinding)
        .where(scopedWhere(customFieldBinding, who, eq(customFieldBinding.id, bindingId)))
        .limit(1);
      const before = rows[0];
      if (!before) throw new CustomFieldNotFoundError(`this binding was not found (${bindingId})`);
      const fieldRows = await exec
        .select()
        .from(customField)
        .where(scopedWhere(customField, who, eq(customField.id, before.fieldId)))
        .limit(1);
      await exec
        .delete(customFieldBinding)
        .where(scopedWhere(customFieldBinding, who, eq(customFieldBinding.id, bindingId)));
      // 🔴 Unbinding **does not delete data**: the value in `custom` jsonb stays as-is.
      // Binding it again brings the value back; actually clearing it is a separate explicit action, and must not be done in passing.
      await bump(identity, before.module, fieldRows[0]?.key ?? "?", "binding.remove", bindingOf(before), null, at, null);
    },
  };
}

/** For the server to cache the merge result per tenant. The cache key must include tenantId, or tenants share each other's data. */
export function customFieldCacheKey(identity: Identity, module: string, revision: number): string {
  return `${requireIdentity(identity).tenantId}:${module}:${String(revision)}`;
}

