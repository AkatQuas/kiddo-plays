import { randomUUID } from "node:crypto";
import { desc, eq, getTableColumns, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { isChoiceSetItemCode, type BillIssue, type ModuleSchema } from "@open-erp/metamodel";
import {
  BillInvalidError,
  requireIdentity,
  type BillRecord,
  type Identity,
  type RuntimeCatalog,
  type RuntimeChoiceSet,
} from "@open-erp/runtime-core";
import { choiceSetAudit, choiceSetItem, choiceSetState } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { applyWriteTimeouts, guardConcurrency, guardWrite } from "./pgError.js";
import type { GeneratedTables } from "./generatedTables.js";
import { createRegistry, type ModuleRegistry } from "./queryCompiler.js";
import { schemasOf } from "./support.js";
import type { Executor } from "./support.js";

export type ChoiceSetItemStatus = "active" | "disabled";
export type ChoiceSetItemSource = "preset" | "custom";

export interface EffectiveChoiceSetItem {
  readonly code: string;
  readonly label: string;
  readonly color?: RuntimeChoiceSet["items"][number]["color"];
  readonly sortOrder: number;
  readonly status: ChoiceSetItemStatus;
  readonly source: ChoiceSetItemSource;
  /** A permanent product tombstone; distinct from an ordinary disabled item the tenant can restore. */
  readonly retired: boolean;
}

export interface ChoiceSetAuditEntry {
  readonly id: string;
  readonly action: "item.add" | "item.update";
  readonly itemCode: string;
  readonly revision: number;
  readonly before: EffectiveChoiceSetItem | null;
  readonly after: EffectiveChoiceSetItem;
  readonly actorId: string;
  readonly at: Date;
}

export interface EffectiveChoiceSet {
  readonly code: string;
  readonly label: string;
  readonly revision: number;
  readonly items: readonly EffectiveChoiceSetItem[];
  readonly updatedAt: Date | null;
  readonly updatedBy: string | null;
  readonly audit: readonly ChoiceSetAuditEntry[];
}

export interface NewChoiceSetItem {
  readonly code: string;
  readonly label: string;
  readonly sortOrder?: number;
}

export interface ChoiceSetItemPatch {
  readonly label?: string;
  readonly sortOrder?: number;
  readonly status?: ChoiceSetItemStatus;
}

export class ChoiceSetInputError extends Error {
  override readonly name = "ChoiceSetInputError";
}

export class ChoiceSetNotFoundError extends Error {
  override readonly name = "ChoiceSetNotFoundError";
}

export class ChoiceSetRevisionConflictError extends Error {
  override readonly name = "ChoiceSetRevisionConflictError";
  constructor(
    readonly choiceSetCode: string,
    readonly expectedRevision: number,
    readonly currentRevision: number,
  ) {
    super(
      `choice set "${choiceSetCode}" was changed by someone else (expected revision ${String(expectedRevision)}, ` +
        `current revision ${String(currentRevision)}); read it again before deciding`,
    );
  }
}

export class ChoiceSetConfigurationError extends Error {
  override readonly name = "ChoiceSetConfigurationError";
}

export interface StoredChoiceSetItemFact {
  readonly id: string;
  readonly itemCode: string;
  readonly source: string;
  readonly label: string | null;
  readonly sortOrder: number | null;
  readonly status: string | null;
}

function definitionMap(definitions: readonly RuntimeChoiceSet[]): ReadonlyMap<string, RuntimeChoiceSet> {
  const out = new Map<string, RuntimeChoiceSet>();
  for (const definition of definitions) {
    if (out.has(definition.code)) {
      throw new ChoiceSetConfigurationError(`the product declares a duplicate choice set code "${definition.code}"`);
    }
    for (const item of definition.items) {
      if (!isChoiceSetItemCode(item.code)) {
        throw new ChoiceSetConfigurationError(`product choice set item code "${definition.code}.${item.code}" is not legal`);
      }
    }
    out.set(definition.code, definition);
  }
  return out;
}

function definitionOf(definitions: ReadonlyMap<string, RuntimeChoiceSet>, code: string): RuntimeChoiceSet {
  const definition = definitions.get(code);
  if (!definition) throw new ChoiceSetNotFoundError(`the product does not declare choice set "${code}"`);
  return definition;
}

function requiredCode(value: string, label: string): string {
  const code = value.trim();
  if (!isChoiceSetItemCode(code)) {
    throw new ChoiceSetInputError(`${label} must start with an ASCII letter and may contain only letters, digits, dots, underscores, or hyphens, at most 64 characters`);
  }
  return code;
}

function requiredDistinctCodes(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ChoiceSetInputError(`${label} must be a non-empty array of codes`);
  }
  const codes = value.map((code, index) => {
    if (typeof code !== "string") throw new ChoiceSetInputError(`${label}[${String(index)}] must be a string`);
    return requiredCode(code, `${label}[${String(index)}]`);
  });
  if (new Set(codes).size !== codes.length) throw new ChoiceSetInputError(`${label} cannot contain duplicate codes`);
  return codes;
}

function requiredLabel(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ChoiceSetInputError(`${label} must be a non-empty string`);
  if (normalized.length > 200) throw new ChoiceSetInputError(`${label} cannot exceed 200 characters`);
  return normalized;
}

function validSortOrder(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new ChoiceSetInputError(`${label} must be an integer in 0..2147483647`);
  }
  return value;
}

export function nextChoiceSetSortOrder(items: readonly { readonly sortOrder: number }[]): number {
  return validSortOrder(Math.max(0, ...items.map((item) => item.sortOrder)) + 1_000, "sortOrder");
}

/** A product tombstone is a permanent retirement, not a disabled state the tenant can toggle. */
export function assertChoiceSetItemStatus(
  definition: RuntimeChoiceSet,
  itemCode: string,
  status: ChoiceSetItemStatus,
): void {
  if (definition.items.find((item) => item.code === itemCode)?.retired === true && status !== "disabled") {
    throw new ChoiceSetInputError(`retired product choice set item "${definition.code}.${itemCode}" cannot be enabled again`);
  }
}

function statusOf(value: string | null, what: string): ChoiceSetItemStatus | null {
  if (value === null) return null;
  if (value === "active" || value === "disabled") return value;
  throw new ChoiceSetConfigurationError(`${what} status "${value}" is not legal`);
}

function sourceOf(value: string, what: string): ChoiceSetItemSource {
  if (value === "preset" || value === "custom") return value;
  throw new ChoiceSetConfigurationError(`${what} source "${value}" is not legal`);
}

export function mergeChoiceSetItems(
  definition: RuntimeChoiceSet,
  rows: readonly StoredChoiceSetItemFact[],
): readonly EffectiveChoiceSetItem[] {
  const storedCodes = new Set<string>();
  for (const row of rows) {
    if (!isChoiceSetItemCode(row.itemCode)) {
      throw new ChoiceSetConfigurationError(
        `tenant choice set item code "${definition.code}.${row.itemCode}" is not legal; business columns and choice facts accept only a stable code`,
      );
    }
    if (storedCodes.has(row.itemCode)) {
      throw new ChoiceSetConfigurationError(`tenant choice set item "${definition.code}.${row.itemCode}" has a duplicate fact`);
    }
    storedCodes.add(row.itemCode);
    sourceOf(row.source, `${definition.code}.${row.itemCode}`);
    statusOf(row.status, `${definition.code}.${row.itemCode}`);
    if (row.label !== null && (row.label.trim() !== row.label || !row.label || row.label.length > 200)) {
      throw new ChoiceSetConfigurationError(`tenant choice set item "${definition.code}.${row.itemCode}" has an illegal label`);
    }
    if (row.sortOrder !== null &&
        (!Number.isInteger(row.sortOrder) || row.sortOrder < 0 || row.sortOrder > 2_147_483_647)) {
      throw new ChoiceSetConfigurationError(`tenant choice set item "${definition.code}.${row.itemCode}" has an illegal sortOrder`);
    }
  }
  const defaults = new Map(definition.items.map((item, index) => [item.code, { item, index }]));
  const overrides = new Map(rows.map((row) => [row.itemCode, row]));
  const result: EffectiveChoiceSetItem[] = [];

  for (const [code, entry] of defaults) {
    const override = overrides.get(code);
    if (override && sourceOf(override.source, `${definition.code}.${code}`) === "custom") {
      throw new ChoiceSetConfigurationError(
        `tenant custom item "${definition.code}.${code}" collides with a product preset code; ` +
          `product active/retired codes are kept permanently and cannot be overwritten by custom`,
      );
    }
    result.push({
      code,
      label: override?.label ?? entry.item.label,
      ...(entry.item.color === undefined ? {} : { color: entry.item.color }),
      sortOrder: override?.sortOrder ?? (entry.index + 1) * 1_000,
      status: entry.item.retired
        ? "disabled"
        : statusOf(override?.status ?? null, `${definition.code}.${code}`) ?? "active",
      source: "preset",
      retired: entry.item.retired,
    });
    overrides.delete(code);
  }

  for (const row of overrides.values()) {
    if (sourceOf(row.source, `${definition.code}.${row.itemCode}`) !== "custom") {
      throw new ChoiceSetConfigurationError(
        `the product removed preset item "${definition.code}.${row.itemCode}"; a preset code can only be disabled, not deleted from the declaration`,
      );
    }
    if (row.label === null || row.sortOrder === null || row.status === null) {
      throw new ChoiceSetConfigurationError(`tenant custom item "${definition.code}.${row.itemCode}" is missing a complete fact`);
    }
    result.push({
      code: row.itemCode,
      label: row.label,
      sortOrder: row.sortOrder,
      status: statusOf(row.status, `${definition.code}.${row.itemCode}`) ?? "active",
      source: "custom",
      retired: false,
    });
  }

  return result.sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code, "en"));
}

export function assertEffectiveChoiceSetMutation(code: string, items: readonly EffectiveChoiceSetItem[]): void {
  const labels = new Set<string>();
  for (const item of items) {
    if (labels.has(item.label)) throw new ChoiceSetInputError(`choice set "${code}" has a duplicate name "${item.label}"`);
    labels.add(item.label);
  }
  if (!items.some((item) => item.status === "active")) {
    throw new ChoiceSetInputError(`choice set "${code}" must keep at least one enabled item`);
  }
}

/** Transaction lock key shared by configuration changes and business writes. When taking several, the caller must sort by choice set code. */
export function choiceSetLockKey(tenantId: string, choiceSetCode: string): string {
  return `${tenantId}:choice-set:${choiceSetCode}`;
}

export async function lockChoiceSets(
  exec: Executor,
  identity: Identity,
  choiceSetCodes: readonly string[],
): Promise<void> {
  const who = requireIdentity(identity);
  const codes = [...new Set(choiceSetCodes)].sort();
  for (const code of codes) {
    await exec.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${choiceSetLockKey(who.tenantId, code)}, 0))`,
    );
  }
}

async function storedOverrides(
  exec: Executor,
  identity: Identity,
  choiceSetCodes: readonly string[],
): Promise<readonly (StoredChoiceSetItemFact & { readonly choiceSetCode: string })[]> {
  if (choiceSetCodes.length === 0) return [];
  return await exec
    .select({
      id: choiceSetItem.id,
      choiceSetCode: choiceSetItem.choiceSetCode,
      itemCode: choiceSetItem.itemCode,
      source: choiceSetItem.source,
      label: choiceSetItem.label,
      sortOrder: choiceSetItem.sortOrder,
      status: choiceSetItem.status,
    })
    .from(choiceSetItem)
    .where(scopedWhere(choiceSetItem, identity, inArray(choiceSetItem.choiceSetCode, [...choiceSetCodes])));
}

async function currentSet(
  exec: Executor,
  identity: Identity,
  definition: RuntimeChoiceSet,
  includeAudit: boolean,
): Promise<EffectiveChoiceSet> {
  // Run in order on the same transaction connection: a postgres.js transaction connection cannot rely on concurrent query scheduling.
  const states = await exec
    .select({
      revision: choiceSetState.revision,
      updatedAt: choiceSetState.updatedAt,
      updatedBy: choiceSetState.updatedBy,
    })
    .from(choiceSetState)
    .where(scopedWhere(choiceSetState, identity, eq(choiceSetState.choiceSetCode, definition.code)));
  const overrides = await storedOverrides(exec, identity, [definition.code]);
  const audits = includeAudit
    ? await exec
        .select({
          id: choiceSetAudit.id,
          action: choiceSetAudit.action,
          itemCode: choiceSetAudit.itemCode,
          revision: choiceSetAudit.revision,
          before: choiceSetAudit.before,
          after: choiceSetAudit.after,
          actorId: choiceSetAudit.actorId,
          at: choiceSetAudit.at,
        })
        .from(choiceSetAudit)
        .where(scopedWhere(choiceSetAudit, identity, eq(choiceSetAudit.choiceSetCode, definition.code)))
        .orderBy(desc(choiceSetAudit.revision))
    : [];
  if (states.length > 1) throw new ChoiceSetConfigurationError(`choice set "${definition.code}" has a duplicate revision row`);
  const state = states[0];
  const items = mergeChoiceSetItems(definition, overrides);
  return {
    code: definition.code,
    label: definition.label,
    revision: state?.revision ?? 0,
    items,
    updatedAt: state?.updatedAt ?? null,
    updatedBy: state?.updatedBy ?? null,
    audit: audits.map((row) => ({
      id: row.id,
      action: row.action as "item.add" | "item.update",
      itemCode: row.itemCode,
      revision: row.revision,
      before: row.before as EffectiveChoiceSetItem | null,
      after: row.after as EffectiveChoiceSetItem,
      actorId: row.actorId,
      at: row.at,
    })),
  };
}

function assertExpectedRevision(set: EffectiveChoiceSet, expectedRevision: number): void {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ChoiceSetInputError("expectedRevision must be a non-negative integer");
  }
  if (set.revision !== expectedRevision) {
    throw new ChoiceSetRevisionConflictError(set.code, expectedRevision, set.revision);
  }
}

async function advanceRevision(
  exec: Executor,
  identity: Identity,
  set: EffectiveChoiceSet,
  at: Date,
): Promise<number> {
  const who = requireIdentity(identity);
  const next = set.revision + 1;
  if (set.revision === 0) {
    await guardWrite(`initialize choice set "${set.code}" revision`, async () => {
      await exec.insert(choiceSetState).values(scopedValues(who, {
        choiceSetCode: set.code,
        revision: next,
        updatedAt: at,
        updatedBy: who.userId,
      }));
    });
    return next;
  }
  const updated = await guardWrite(`update choice set "${set.code}" revision`, async () => await exec
    .update(choiceSetState)
    .set({ revision: next, updatedAt: at, updatedBy: who.userId })
    .where(scopedWhere(
      choiceSetState,
      who,
      eq(choiceSetState.choiceSetCode, set.code),
      eq(choiceSetState.revision, set.revision),
    ))
    .returning({ revision: choiceSetState.revision }));
  if (updated.length !== 1) throw new ChoiceSetRevisionConflictError(set.code, set.revision, set.revision + 1);
  return next;
}

export interface ChoiceSetRepo {
  list(identity: Identity): Promise<readonly EffectiveChoiceSet[]>;
  get(identity: Identity, code: string): Promise<EffectiveChoiceSet>;
  options(
    identity: Identity,
    code: string,
    includeDisabled: boolean,
  ): Promise<{
    readonly revision: number;
    readonly options: readonly {
      readonly value: string;
      readonly label: string;
      readonly disabled: boolean;
      readonly color?: RuntimeChoiceSet["items"][number]["color"];
      readonly source: ChoiceSetItemSource;
    }[];
  }>;
  addItem(identity: Identity, code: string, expectedRevision: number, input: NewChoiceSetItem, at: Date): Promise<EffectiveChoiceSet>;
  updateItem(
    identity: Identity,
    code: string,
    itemCode: string,
    expectedRevision: number,
    patch: ChoiceSetItemPatch,
    at: Date,
  ): Promise<EffectiveChoiceSet>;
  batchUpdateItems(
    identity: Identity,
    code: string,
    expectedRevision: number,
    itemCodes: readonly string[],
    status: ChoiceSetItemStatus,
    at: Date,
  ): Promise<EffectiveChoiceSet>;
  reorderItems(
    identity: Identity,
    code: string,
    expectedRevision: number,
    orderedCodes: readonly string[],
    at: Date,
  ): Promise<EffectiveChoiceSet>;
}

export interface ChoiceSetUsageCounter {
  /**
   * Return how many times each stable code appears across every bound business field in the current tenant.
   * This is the tenant-level impact analysis for system:choiceSet:manage. It does not return rows, ids, or a per-module split.
   */
  count(identity: Identity, choiceSetCode: string): Promise<ReadonlyMap<string, number>>;
}

interface ChoiceSetChange {
  readonly action: "item.add" | "item.update";
  readonly before: EffectiveChoiceSetItem | null;
  readonly after: EffectiveChoiceSetItem;
}

async function persistEffectiveItem(
  exec: Executor,
  identity: Identity,
  definition: RuntimeChoiceSet,
  before: EffectiveChoiceSetItem,
  after: EffectiveChoiceSetItem,
  at: Date,
): Promise<void> {
  const who = requireIdentity(identity);
  const productItem = definition.items.find((item) => item.code === before.code);
  const preset = before.source === "preset";
  const rows = await exec
    .select({ id: choiceSetItem.id })
    .from(choiceSetItem)
    .where(scopedWhere(
      choiceSetItem,
      who,
      eq(choiceSetItem.choiceSetCode, definition.code),
      eq(choiceSetItem.itemCode, before.code),
    ));
  const values = {
    label: preset && after.label === productItem?.label ? null : after.label,
    sortOrder: preset && after.sortOrder === (definition.items.findIndex((item) => item.code === before.code) + 1) * 1_000
      ? null
      : after.sortOrder,
    status: preset && after.status === (productItem?.retired === true ? "disabled" : "active") ? null : after.status,
    updatedAt: at,
    updatedBy: who.userId,
  };
  if (rows.length === 0) {
    await guardWrite(`change choice set item "${definition.code}.${before.code}"`, async () => {
      await exec.insert(choiceSetItem).values(scopedValues(who, {
        id: randomUUID(),
        choiceSetCode: definition.code,
        itemCode: before.code,
        source: preset ? "preset" : "custom",
        ...values,
        createdAt: at,
        createdBy: who.userId,
      }));
    });
  } else if (rows.length === 1) {
    await guardWrite(`change choice set item "${definition.code}.${before.code}"`, async () => {
      await exec.update(choiceSetItem).set(values).where(scopedWhere(choiceSetItem, who, eq(choiceSetItem.id, rows[0]!.id)));
    });
  } else {
    throw new ChoiceSetConfigurationError(`choice set item "${definition.code}.${before.code}" has a duplicate tenant override`);
  }
}

export function createChoiceSetRepo(exec: Executor, productDefinitions: readonly RuntimeChoiceSet[]): ChoiceSetRepo {
  const definitions = definitionMap(productDefinitions);

  const mutate = async (
    identity: Identity,
    code: string,
    expectedRevision: number,
    change: (
      on: Executor,
      set: EffectiveChoiceSet,
      definition: RuntimeChoiceSet,
    ) => Promise<readonly ChoiceSetChange[]>,
    at: Date,
  ): Promise<EffectiveChoiceSet> => {
    const who = requireIdentity(identity);
    const definition = definitionOf(definitions, code);
    if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new ChoiceSetInputError("the modification time must be a valid instant");
    return await guardConcurrency(`maintain choice set "${code}"`, async () => await exec.transaction(async (tx) => {
      await applyWriteTimeouts(tx);
      await lockChoiceSets(tx, who, [code]);
      const beforeSet = await currentSet(tx, who, definition, false);
      assertExpectedRevision(beforeSet, expectedRevision);
      const changed = await change(tx, beforeSet, definition);
      const afterMutation = await currentSet(tx, who, definition, false);
      assertEffectiveChoiceSetMutation(code, afterMutation.items);
      if (changed.length === 0) return await currentSet(tx, who, definition, true);
      const revision = await advanceRevision(tx, who, beforeSet, at);
      await guardWrite(`record the audit for choice set "${code}"`, async () => {
        await tx.insert(choiceSetAudit).values(changed.map((entry) => scopedValues(who, {
          id: randomUUID(),
          choiceSetCode: code,
          itemCode: entry.after.code,
          action: entry.action,
          revision,
          before: entry.before,
          after: entry.after,
          actorId: who.userId,
          at,
        })));
      });
      return await currentSet(tx, who, definition, true);
    }));
  };

  return {
    async list(identity) {
      const who = requireIdentity(identity);
      const codes = [...definitions.keys()];
      if (codes.length === 0) return [];
      const [states, overrides] = await Promise.all([
        exec
          .select({
            choiceSetCode: choiceSetState.choiceSetCode,
            revision: choiceSetState.revision,
            updatedAt: choiceSetState.updatedAt,
            updatedBy: choiceSetState.updatedBy,
          })
          .from(choiceSetState)
          .where(scopedWhere(choiceSetState, who, inArray(choiceSetState.choiceSetCode, codes))),
        storedOverrides(exec, who, codes),
      ]);
      const stateByCode = new Map(states.map((state) => [state.choiceSetCode, state]));
      return [...definitions.values()].map((definition) => {
        const state = stateByCode.get(definition.code);
        const items = mergeChoiceSetItems(definition, overrides.filter((row) => row.choiceSetCode === definition.code));
        return {
          code: definition.code,
          label: definition.label,
          revision: state?.revision ?? 0,
          items,
          updatedAt: state?.updatedAt ?? null,
          updatedBy: state?.updatedBy ?? null,
          audit: [],
        };
      });
    },

    async get(identity, code) {
      return await currentSet(exec, requireIdentity(identity), definitionOf(definitions, code), true);
    },

    async options(identity, code, includeDisabled) {
      return await resolveChoiceSetOptions(exec, identity, productDefinitions, code, includeDisabled);
    },

    async addItem(identity, code, expectedRevision, input, at) {
      const itemCode = requiredCode(input.code, "choice item code");
      const itemLabel = requiredLabel(input.label, "choice item name");
      return await mutate(identity, code, expectedRevision, async (on, set) => {
        if (set.items.some((item) => item.code === itemCode)) {
          throw new ChoiceSetInputError(`choice set "${code}" already has code "${itemCode}"`);
        }
        if (set.items.some((item) => item.label === itemLabel)) {
          throw new ChoiceSetInputError(`choice set "${code}" already has name "${itemLabel}"`);
        }
        const sortOrder = input.sortOrder === undefined
          ? nextChoiceSetSortOrder(set.items)
          : validSortOrder(input.sortOrder, "sortOrder");
        const after: EffectiveChoiceSetItem = {
          code: itemCode,
          label: itemLabel,
          sortOrder,
          status: "active",
          source: "custom",
          retired: false,
        };
        const who = requireIdentity(identity);
        await guardWrite(`add choice set item "${code}.${itemCode}"`, async () => {
          await on.insert(choiceSetItem).values(scopedValues(who, {
            id: randomUUID(),
            choiceSetCode: code,
            itemCode,
            source: "custom",
            label: itemLabel,
            sortOrder,
            status: "active",
            createdAt: at,
            createdBy: who.userId,
            updatedAt: at,
            updatedBy: who.userId,
          }));
        });
        return [{ action: "item.add", before: null, after }];
      }, at);
    },

    async updateItem(identity, code, itemCodeRaw, expectedRevision, patch, at) {
      const itemCode = requiredCode(itemCodeRaw, "choice item code");
      if (Object.keys(patch).length === 0) throw new ChoiceSetInputError("a choice item change must include at least one field");
      return await mutate(identity, code, expectedRevision, async (on, set, definition) => {
        const before = set.items.find((item) => item.code === itemCode);
        if (!before) throw new ChoiceSetNotFoundError(`choice set "${code}" has no option "${itemCode}"`);
        const after: EffectiveChoiceSetItem = {
          ...before,
          ...(patch.label === undefined ? {} : { label: requiredLabel(patch.label, "choice item name") }),
          ...(patch.sortOrder === undefined ? {} : { sortOrder: validSortOrder(patch.sortOrder, "sortOrder") }),
          ...(patch.status === undefined ? {} : { status: patch.status }),
        };
        if (after.status !== "active" && after.status !== "disabled") {
          throw new ChoiceSetInputError("status accepts only active / disabled");
        }
        assertChoiceSetItemStatus(definition, itemCode, after.status);
        if (set.items.some((item) => item.code !== itemCode && item.label === after.label)) {
          throw new ChoiceSetInputError(`choice set "${code}" already has name "${after.label}"`);
        }
        assertEffectiveChoiceSetMutation(code, set.items.map((item) => item.code === itemCode ? after : item));

        await persistEffectiveItem(on, identity, definition, before, after, at);
        return [{ action: "item.update", before, after }];
      }, at);
    },

    async batchUpdateItems(identity, code, expectedRevision, itemCodesRaw, status, at) {
      const itemCodes = requiredDistinctCodes(itemCodesRaw, "itemCodes");
      if (status !== "active" && status !== "disabled") {
        throw new ChoiceSetInputError("status accepts only active / disabled");
      }
      return await mutate(identity, code, expectedRevision, async (on, set, definition) => {
        const selected = new Set(itemCodes);
        for (const itemCode of itemCodes) {
          if (!set.items.some((item) => item.code === itemCode)) {
            throw new ChoiceSetNotFoundError(`choice set "${code}" has no option "${itemCode}"`);
          }
          assertChoiceSetItemStatus(definition, itemCode, status);
        }
        const proposed = set.items.map((item) => selected.has(item.code) ? { ...item, status } : item);
        assertEffectiveChoiceSetMutation(code, proposed);
        const changes: ChoiceSetChange[] = [];
        for (const after of proposed) {
          const before = set.items.find((item) => item.code === after.code)!;
          if (before.status === after.status) continue;
          await persistEffectiveItem(on, identity, definition, before, after, at);
          changes.push({ action: "item.update", before, after });
        }
        return changes;
      }, at);
    },

    async reorderItems(identity, code, expectedRevision, orderedCodesRaw, at) {
      const orderedCodes = requiredDistinctCodes(orderedCodesRaw, "orderedCodes");
      return await mutate(identity, code, expectedRevision, async (on, set, definition) => {
        const effectiveCodes = new Set(set.items.map((item) => item.code));
        if (orderedCodes.length !== effectiveCodes.size || orderedCodes.some((itemCode) => !effectiveCodes.has(itemCode))) {
          throw new ChoiceSetInputError(
            `orderedCodes must equal exactly the current valid items of choice set "${code}", with no code missing or added`,
          );
        }
        const byCode = new Map(set.items.map((item) => [item.code, item]));
        const proposed = orderedCodes.map((itemCode, index) => {
          const before = byCode.get(itemCode)!;
          return { ...before, sortOrder: validSortOrder((index + 1) * 1_000, `orderedCodes[${String(index)}]`) };
        });
        assertEffectiveChoiceSetMutation(code, proposed);
        const changes: ChoiceSetChange[] = [];
        for (const after of proposed) {
          const before = byCode.get(after.code)!;
          if (before.sortOrder === after.sortOrder) continue;
          await persistEffectiveItem(on, identity, definition, before, after, at);
          changes.push({ action: "item.update", before, after });
        }
        return changes;
      }, at);
    },
  };
}

interface ChoiceUsageSite {
  readonly statement: SQL;
}

function choiceUsageSites(
  registry: ModuleRegistry,
  identity: Identity,
  choiceSetCode: string,
): readonly ChoiceUsageSite[] {
  const sites: ChoiceUsageSite[] = [];
  for (const tables of registry.all()) {
    for (const binding of choiceFields(tables.schema)) {
      if (binding.choiceSet !== choiceSetCode) continue;
      const [through, field] = binding.path.split(".");
      if (field === undefined) {
        const column = tables.columns[through!];
        if (!column) {
          throw new ChoiceSetConfigurationError(
            `choice set usage count cannot find the header column "${tables.code}.${binding.path}"; the declaration and tables are out of sync`,
          );
        }
        sites.push({
          statement: sql`
            select cast(${column} as text) as "itemCode", count(*)::bigint as "usageCount"
              from ${tables.header}
             where ${scopedWhere(tables.header, identity, isNotNull(column))}
             group by ${column}
          `,
        });
        continue;
      }
      const line = tables.lines.get(through!);
      if (!line) {
        throw new ChoiceSetConfigurationError(
          `choice set usage count cannot find line table "${tables.code}.${through}"; the declaration and tables are out of sync`,
        );
      }
      const column = getTableColumns(line)[field];
      if (!column) {
        throw new ChoiceSetConfigurationError(
          `choice set usage count cannot find the line column "${tables.code}.${binding.path}"; the declaration and tables are out of sync`,
        );
      }
      sites.push({
        statement: sql`
          select cast(${column} as text) as "itemCode", count(*)::bigint as "usageCount"
            from ${line}
            inner join ${tables.header}
              on ${eq(line.billId, tables.header.id)}
             and ${eq(line.tenantId, tables.header.tenantId)}
           where ${scopedWhere(tables.header, identity, isNotNull(column))}
           group by ${column}
        `,
      });
    }
  }
  return sites;
}

/**
 * Narrow aggregate exit for the choice set admin surface.
 *
 * The caller must assert `system:choiceSet:manage` first. That permission is tenant-wide and dataScoped=false,
 * so this deliberately uses only the tenant boundary of `scopedWhere` and does not apply the actor's module data scope. The return surface is
 * also deliberately closed to item code plus count, with no business rows, ids, field-value samples, or a per-module split.
 * Every binding point is derived from the registry/schema, with no branch on module code. Several binding points are aggregated in one UNION ALL,
 * so the field count does not become the number of SQL round trips.
 */
export function createChoiceSetUsageCounter(
  exec: Executor,
  catalog: RuntimeCatalog,
  tables: GeneratedTables,
): ChoiceSetUsageCounter {
  const definitions = definitionMap(catalog.choiceSets);
  const registry = createRegistry(schemasOf(catalog), tables);
  return {
    async count(identity, choiceSetCode) {
      const who = requireIdentity(identity);
      definitionOf(definitions, choiceSetCode);
      const sites = choiceUsageSites(registry, who, choiceSetCode);
      if (sites.length === 0) return new Map();
      const rows = await exec.execute(sql`
        select "itemCode", sum("usageCount")::text as "usageCount"
          from (${sql.join(sites.map((site) => site.statement), sql` union all `)}) as choice_usage
         group by "itemCode"
      `) as unknown as readonly { readonly itemCode: unknown; readonly usageCount: unknown }[];
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (typeof row.itemCode !== "string") {
          throw new ChoiceSetConfigurationError(`choice set "${choiceSetCode}" usage count returned a non-string code`);
        }
        const count = typeof row.usageCount === "string" || typeof row.usageCount === "number"
          ? Number(row.usageCount)
          : Number.NaN;
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new ChoiceSetConfigurationError(`choice set "${choiceSetCode}.${row.itemCode}" usage count is not a safe integer`);
        }
        counts.set(row.itemCode, count);
      }
      return counts;
    },
  };
}

function choiceFields(schema: ModuleSchema): readonly { readonly path: string; readonly label: string; readonly choiceSet: string }[] {
  const out: { path: string; label: string; choiceSet: string }[] = [];
  for (const top of schema.fields) {
    if (top.choiceSet) out.push({ path: top.key, label: top.label, choiceSet: top.choiceSet });
    if (top.type !== "subtable") continue;
    for (const line of top.fields ?? []) {
      if (line.choiceSet) out.push({ path: `${top.key}.${line.key}`, label: line.label, choiceSet: line.choiceSet });
    }
  }
  return out;
}

/** The only criterion for a disabled exemption: the stable row id and this field value both match the same existing fact. */
export function unchangedExistingLineValue(
  row: Readonly<Record<string, unknown>>,
  existingById: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
  field: string,
): boolean {
  const id = row["id"];
  return typeof id === "string" && existingById.get(id)?.[field] === row[field];
}

/**
 * Dynamic enum gate on the business write path. The call site must already be inside the business write transaction. This function takes the lock shared with the maintenance surface first,
 * then reads the current valid set, so "disable succeeded" and "a new business commit uses that code" have a definite order.
 */
export async function assertChoiceSetWrite(
  exec: Executor,
  identity: Identity,
  definitionsInput: readonly RuntimeChoiceSet[],
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  existing: BillRecord | null,
  what: string,
): Promise<void> {
  const sites = choiceFields(schema).filter((site) => {
    const [table, column] = site.path.split(".");
    return column === undefined ? Object.hasOwn(header, table!) : Object.hasOwn(lines, table!);
  });
  if (sites.length === 0) return;
  const definitions = definitionMap(definitionsInput);
  for (const site of sites) definitionOf(definitions, site.choiceSet);
  await lockChoiceSets(exec, identity, sites.map((site) => site.choiceSet));
  const sets = new Map<string, EffectiveChoiceSet>();
  for (const code of [...new Set(sites.map((site) => site.choiceSet))]) {
    sets.set(code, await currentSet(exec, identity, definitionOf(definitions, code), false));
  }

  const issues: BillIssue[] = [];
  const validate = (site: { path: string; label: string; choiceSet: string }, value: unknown, unchanged: boolean): void => {
    if (value === null || value === undefined || value === "") return;
    if (typeof value !== "string") return; // The base type gate already handles this class of problem.
    if (unchanged) return; // An unchanged historical disabled value may be saved along with other fields.
    const item = sets.get(site.choiceSet)!.items.find((candidate) => candidate.code === value);
    if (!item) {
      issues.push({
        path: site.path,
        label: site.label,
        code: "CHOICE_SET_UNKNOWN",
        message: `option code "${value}" of "${site.label}" is not in choice set "${site.choiceSet}"`,
      });
    } else if (item.status !== "active") {
      issues.push({
        path: site.path,
        label: site.label,
        code: "CHOICE_SET_DISABLED",
        message: `option "${item.label}" of "${site.label}" is disabled; use an enabled item`,
      });
    }
  };

  for (const site of sites) {
    const [table, column] = site.path.split(".");
    if (column === undefined) {
      validate(site, header[table!], existing?.header[table!] === header[table!]);
      continue;
    }
    const nextRows = lines[table!] ?? [];
    const oldRows = existing?.lines[table!] ?? [];
    const oldById = new Map(oldRows.flatMap((row) =>
      typeof row["id"] === "string" ? [[row["id"] as string, row] as const] : []));
    for (let index = 0; index < nextRows.length; index += 1) {
      const row = nextRows[index]!;
      // The only exemption for disabled is "the same value on the same existing fact". Position/lineNo changes with deletion and reordering
      // and cannot prove identity; a row with no stable id is judged as a new fact.
      const beforeCount = issues.length;
      validate(site, row[column!], unchangedExistingLineValue(row, oldById, column!));
      if (issues.length > beforeCount) {
        const last = issues[issues.length - 1]!;
        issues[issues.length - 1] = {
          ...last,
          path: `${table}[${String(index)}].${column}`,
          label: `${site.label} row ${String(index + 1)}`,
        };
      }
    }
  }
  if (issues.length) throw new BillInvalidError(what, issues);
}

/** Read-only resolver: a historical value may resolve a disabled item; candidates may exclude disabled when asked. */
export async function resolveChoiceSetOptions(
  exec: Executor,
  identity: Identity,
  definitionsInput: readonly RuntimeChoiceSet[],
  code: string,
  includeDisabled: boolean,
): Promise<{
  readonly revision: number;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly disabled: boolean;
    readonly color?: RuntimeChoiceSet["items"][number]["color"];
    readonly source: ChoiceSetItemSource;
  }[];
}> {
  const definitions = definitionMap(definitionsInput);
  const set = await currentSet(exec, requireIdentity(identity), definitionOf(definitions, code), false);
  return {
    revision: set.revision,
    options: set.items
      .filter((item) => includeDisabled || item.status === "active")
      .map((item) => ({
        value: item.code,
        label: item.label,
        disabled: item.status === "disabled",
        ...(item.color === undefined ? {} : { color: item.color }),
        source: item.source,
      })),
  };
}
