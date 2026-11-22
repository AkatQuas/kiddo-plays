import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { ModuleSettingSchema } from "@open-erp/metamodel";
import {
  requireIdentity,
  type EffectiveModuleSetting,
  type Identity,
  type ModuleSettingAuditEntry,
  type ModuleSettingRepo,
} from "@open-erp/runtime-core";
import { moduleSettingAudit, moduleSettingState } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { applyWriteTimeouts, guardConcurrency, guardWrite } from "./pgError.js";
import type { Executor } from "./support.js";

export class ModuleSettingNotFoundError extends Error {
  override readonly name = "ModuleSettingNotFoundError";
}

export class ModuleSettingInputError extends Error {
  override readonly name = "ModuleSettingInputError";
}

export class ModuleSettingRevisionConflictError extends Error {
  override readonly name = "ModuleSettingRevisionConflictError";
  constructor(readonly settingCode: string, readonly expectedRevision: number, readonly currentRevision: number) {
    super(
      `module setting "${settingCode}" was changed by someone else (expected revision ${String(expectedRevision)}, ` +
        `current revision ${String(currentRevision)}); read it again before saving`,
    );
  }
}

interface StoredState {
  readonly value: string;
  readonly revision: number;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

function definitionsOf(settings: readonly ModuleSettingSchema[]): ReadonlyMap<string, ModuleSettingSchema> {
  const out = new Map<string, ModuleSettingSchema>();
  for (const setting of settings) {
    if (out.has(setting.code)) throw new ModuleSettingInputError(`the product declares module setting "${setting.code}" more than once`);
    out.set(setting.code, setting);
  }
  return out;
}

function definitionOf(definitions: ReadonlyMap<string, ModuleSettingSchema>, code: string): ModuleSettingSchema {
  const definition = definitions.get(code);
  if (!definition) throw new ModuleSettingNotFoundError(`the product does not declare module setting "${code}"`);
  return definition;
}

function effective(definition: ModuleSettingSchema, stored: StoredState | null): EffectiveModuleSetting {
  const value = stored?.value ?? definition.defaultOption;
  if (!definition.options.some((option) => option.code === value)) {
    throw new ModuleSettingInputError(
      `module setting "${definition.code}" stored an option "${value}" the product does not declare — refusing to guess the default`,
    );
  }
  return {
    code: definition.code,
    module: definition.module,
    label: definition.label,
    description: definition.description,
    effectiveWhen: definition.effectiveWhen,
    value,
    defaultValue: definition.defaultOption,
    revision: stored?.revision ?? 0,
    options: definition.options,
    updatedAt: stored?.updatedAt ?? null,
    updatedBy: stored?.updatedBy ?? null,
  };
}

export function createModuleSettingRepo(
  exec: Executor,
  settings: readonly ModuleSettingSchema[],
): ModuleSettingRepo {
  const definitions = definitionsOf(settings);

  const storedMap = async (tx: Executor, identity: Identity): Promise<ReadonlyMap<string, StoredState>> => {
    const who = requireIdentity(identity);
    const rows = await tx.select().from(moduleSettingState).where(scopedWhere(moduleSettingState, who));
    return new Map(rows.map((row) => [row.settingCode, {
      value: row.value,
      revision: row.revision,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    }]));
  };

  return {
    async list(identity) {
      const stored = await storedMap(exec, identity);
      return [...definitions.values()].map((definition) => effective(definition, stored.get(definition.code) ?? null));
    },

    async get(identity, code) {
      const who = requireIdentity(identity);
      const definition = definitionOf(definitions, code);
      const rows = await exec
        .select()
        .from(moduleSettingState)
        .where(scopedWhere(moduleSettingState, who, eq(moduleSettingState.settingCode, code)))
        .limit(1);
      const row = rows[0];
      return effective(definition, row ? {
        value: row.value,
        revision: row.revision,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      } : null);
    },

    async audit(identity, code) {
      const who = requireIdentity(identity);
      definitionOf(definitions, code);
      const rows = await exec
        .select()
        .from(moduleSettingAudit)
        .where(scopedWhere(moduleSettingAudit, who, eq(moduleSettingAudit.settingCode, code)))
        .orderBy(asc(moduleSettingAudit.revision));
      return rows.map((row): ModuleSettingAuditEntry => ({
        id: row.id,
        settingCode: row.settingCode,
        revision: row.revision,
        before: row.before,
        after: row.after,
        actorId: row.actorId,
        at: row.at,
      }));
    },

    async set(identity, code, expectedRevision, value, at) {
      const who = requireIdentity(identity);
      const definition = definitionOf(definitions, code);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        throw new ModuleSettingInputError("expectedRevision must be a non-negative integer");
      }
      if (!(at instanceof Date) || !Number.isFinite(at.getTime())) {
        throw new ModuleSettingInputError("the modification time must be a valid instant");
      }
      if (!definition.options.some((option) => option.code === value)) {
        throw new ModuleSettingInputError(
          `module setting "${definition.label}" does not accept "${value}"; choices: ${definition.options.map((option) => option.code).join(" / ")}`,
        );
      }

      return await guardConcurrency(`save module setting "${definition.label}"`, async () => await exec.transaction(async (tx) => {
        await applyWriteTimeouts(tx);
        const rows = await tx
          .select()
          .from(moduleSettingState)
          .where(scopedWhere(moduleSettingState, who, eq(moduleSettingState.settingCode, code)))
          .for("update")
          .limit(1);
        const current = rows[0];
        const currentRevision = current?.revision ?? 0;
        if (currentRevision !== expectedRevision) {
          throw new ModuleSettingRevisionConflictError(code, expectedRevision, currentRevision);
        }
        const before = current?.value ?? definition.defaultOption;
        if (before === value) {
          return effective(definition, current ? {
            value: current.value,
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          } : null);
        }
        const revision = currentRevision + 1;
        if (current) {
          await guardWrite(`save module setting "${definition.label}"`, async () =>
            await tx
              .update(moduleSettingState)
              .set({ value, revision, updatedAt: at, updatedBy: who.userId })
              .where(
                scopedWhere(
                  moduleSettingState,
                  who,
                  eq(moduleSettingState.settingCode, code),
                  eq(moduleSettingState.revision, expectedRevision),
                ),
              ),
          );
        } else {
          // On the first save, SELECT FOR UPDATE cannot lock a row that does not exist yet. Use
          // INSERT ... ON CONFLICT DO NOTHING on the unique key as the linearization point: the loser waits for the winner to commit,
          // gets an empty returning, then reads the winner's revision and returns a recoverable revision conflict, instead of letting
          // a unique-constraint exception surface as a generic 409 with no currentRevision.
          const inserted = await guardWrite(`save module setting "${definition.label}"`, async () =>
            await tx.insert(moduleSettingState).values(scopedValues(who, {
              id: randomUUID(),
              settingCode: code,
              value,
              revision,
              updatedAt: at,
              updatedBy: who.userId,
            })).onConflictDoNothing({
              target: [moduleSettingState.tenantId, moduleSettingState.settingCode],
            }).returning({ revision: moduleSettingState.revision }),
          );
          if (inserted.length === 0) {
            const concurrentRows = await tx
              .select({ revision: moduleSettingState.revision })
              .from(moduleSettingState)
              .where(scopedWhere(moduleSettingState, who, eq(moduleSettingState.settingCode, code)))
              .limit(1);
            const concurrent = concurrentRows[0];
            if (!concurrent) {
              throw new ModuleSettingInputError(
                `module setting "${code}" hit a race on its first save, but the competing row is not visible — refusing to guess the current revision`,
              );
            }
            throw new ModuleSettingRevisionConflictError(code, expectedRevision, concurrent.revision);
          }
        }
        await guardWrite(`record the change to module setting "${definition.label}"`, async () =>
          await tx.insert(moduleSettingAudit).values(scopedValues(who, {
            id: randomUUID(),
            settingCode: code,
            revision,
            before,
            after: value,
            actorId: who.userId,
            at,
          })),
        );
        return effective(definition, { value, revision, updatedAt: at, updatedBy: who.userId });
      }));
    },
  };
}
