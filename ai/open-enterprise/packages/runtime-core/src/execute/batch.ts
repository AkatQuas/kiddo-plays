// ---------------------------------------------------------------------------
// Batch calls of the standard operations.
//
// Batch is not a second create / save / delete / execute. Its only job is to open the outer transaction,
// hand over the complete write set once, and send each item back to the single-item primitive.
// If any item throws, the outer transaction rolls back every item. HTTP / Agent / UI are different projections of this one capability.
// ---------------------------------------------------------------------------

import { OPERATION_BATCH_MAX_ITEMS, modulePermissionKey, schemaFail } from "@open-erp/metamodel";
import { requireIdentity, type Identity } from "../contracts/identity.js";
import { RepoError } from "../contracts/errors.js";
import type { BillRecord } from "../contracts/repositories.js";
import {
  createBill,
  deleteBill,
  evaluate,
  executeTransition,
  pinClock,
  saveDraft,
  staleIfGone,
  type Evaluated,
  type ExecuteResult,
  type RuntimeDeps,
} from "./execute.js";

function requireItems<T>(items: readonly T[], what: string): void {
  if (items.length === 0 || items.length > OPERATION_BATCH_MAX_ITEMS) {
    throw new RepoError(`${what} must contain 1..${OPERATION_BATCH_MAX_ITEMS} items; received ${items.length}`);
  }
}

function requireUniqueIds(items: readonly { readonly id: string }[], what: string): void {
  const ids = items.map((item) => item.id);
  if (ids.some((id) => id === "")) throw new RepoError(`${what} id must not be empty`);
  if (new Set(ids).size !== ids.length) throw new RepoError(`${what} must not include the same bill twice`);
}

export interface BatchCreateItem {
  readonly header: Readonly<Record<string, unknown>>;
  readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}

export interface BatchUpdateItem {
  readonly id: string;
  readonly patch: Readonly<Record<string, unknown>>;
  readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null;
  readonly expectedRevision: number | null;
}

export interface BatchDeleteItem {
  readonly id: string;
  readonly expectedRevision: number;
}

export interface BatchTransitionItem {
  readonly id: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly confirmedWarning: string | null;
  readonly idempotencyKey: string | null;
  readonly expectedRevision: number;
}

/** Read an explicit set of ids in one repeatable-read snapshot. */
export async function getBillsBatch(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  ids: readonly string[],
): Promise<readonly BillRecord[]> {
  requireIdentity(identity);
  requireItems(ids, "Batch read");
  requireUniqueIds(ids.map((id) => ({ id })), "Batch read");
  deps.authorizer.assertModule(identity, module, "read");
  return await deps.repos.transaction(async (repos) => {
    const out: BillRecord[] = [];
    for (const id of ids) out.push(await repos.bills.get(identity, module, id));
    return out;
  }, { isolationLevel: "repeatable read" });
}

/** Small direct creates: the whole batch shares one transaction. Import remains a different job that may fail row by row. */
export async function createBillsBatch(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  items: readonly BatchCreateItem[],
): Promise<readonly BillRecord[]> {
  requireIdentity(identity);
  requireItems(items, "Batch create");
  deps.authorizer.assertModule(identity, module, "create");
  return await deps.repos.transaction(async (repos) => {
    const tx = pinClock({ ...deps, repos });
    await repos.bills.lockWriteSet(identity, items.map((item) => ({
      kind: "create" as const,
      module,
      header: item.header,
      lines: item.lines,
    })));
    const out: BillRecord[] = [];
    for (const item of items) {
      out.push(await createBill(tx, identity, module, item.header, item.lines));
    }
    return out;
  });
}

export async function updateBillsBatch(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  items: readonly BatchUpdateItem[],
): Promise<readonly BillRecord[]> {
  requireIdentity(identity);
  requireItems(items, "Batch update");
  requireUniqueIds(items, "Batch update");
  deps.authorizer.assertModule(identity, module, "read");
  const loaded = deps.catalog.modules.get(module);
  if (loaded === undefined || deps.authorizer.catalog.byKey.has(modulePermissionKey(module, "update"))) {
    deps.authorizer.assertModule(identity, module, "update");
  } else {
    schemaFail(`"${loaded.schema.label}" has no editable status and cannot be updated`);
  }
  return await deps.repos.transaction(async (repos) => {
    const tx = pinClock({ ...deps, repos });
    // Taking the lock reads this batch: a bill that arrived with a revision and is already gone is a revision conflict, not a 404.
    await staleIfGone(module, items, async () => {
      await repos.bills.lockWriteSet(identity, items.map((item) => ({
        kind: "save" as const,
        module,
        id: item.id,
        patch: item.patch,
        lines: item.lines,
      })));
      // The first read inside lockWriteSet only discovers the batch coordinates. After every lock is held, re-read each bill
      // so a reference coordinate that changed while waiting cannot slip through. A lower coordinate that was not pre-locked makes the ledger lock fail fast.
      for (const item of items) await repos.bills.lockForAction(identity, module, item.id);
    });
    const out: BillRecord[] = [];
    for (const item of items) {
      out.push(await saveDraft(
        tx,
        identity,
        module,
        item.id,
        item.patch,
        item.lines,
        item.expectedRevision,
      ));
    }
    return out;
  });
}

export async function deleteBillsBatch(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  items: readonly BatchDeleteItem[],
): Promise<readonly { readonly id: string; readonly status: string }[]> {
  requireIdentity(identity);
  requireItems(items, "Batch delete");
  requireUniqueIds(items, "Batch delete");
  deps.authorizer.assertModule(identity, module, "read");
  if (
    deps.catalog.modules.get(module) === undefined ||
    deps.authorizer.catalog.byKey.has(modulePermissionKey(module, "delete"))
  ) {
    deps.authorizer.assertModule(identity, module, "delete");
  }
  return await deps.repos.transaction(async (repos) => {
    const tx = pinClock({ ...deps, repos });
    await staleIfGone(module, items, async () => {
      await repos.bills.lockWriteSet(identity, items.map((item) => ({
        kind: "action" as const,
        module,
        id: item.id,
      })));
      for (const item of items) await repos.bills.lockForAction(identity, module, item.id);
    });
    const out: { id: string; status: string }[] = [];
    for (const item of items) {
      out.push(await deleteBill(tx, identity, module, item.id, item.expectedRevision));
    }
    return out;
  });
}

/** Batch preview of an ordinary transition. A Planner's full plan preview belongs to its own workbench. */
export async function previewTransitionsBatch(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  transition: string,
  items: readonly Pick<BatchTransitionItem, "id" | "params" | "expectedRevision">[],
): Promise<readonly Evaluated[]> {
  requireIdentity(identity);
  requireItems(items, "Batch preview");
  requireUniqueIds(items, "Batch preview");
  const loaded = deps.catalog.modules.get(module);
  if (loaded?.planners.has(transition)) {
    throw new RepoError(`Planner edge ${module}.${transition} cannot use the ordinary batch preview; use the declared batch workbench`);
  }
  return await deps.repos.transaction(async (repos) => {
    const out: Evaluated[] = [];
    for (const item of items) {
      out.push(await evaluate(deps, {
        identity,
        module,
        billId: item.id,
        transition,
        params: item.params,
        expectedRevision: item.expectedRevision,
      }, repos));
    }
    return out;
  }, { isolationLevel: "repeatable read" });
}

/** Same module, same transition, one outer transaction. Any refusal or conflict rolls back the items already applied. */
export async function executeTransitionsBatch(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  transition: string,
  items: readonly BatchTransitionItem[],
): Promise<readonly ExecuteResult[]> {
  requireIdentity(identity);
  requireItems(items, "Batch execute");
  requireUniqueIds(items, "Batch execute");
  const loaded = deps.catalog.modules.get(module);
  if (loaded?.planners.has(transition)) {
    throw new RepoError(`Planner edge ${module}.${transition} cannot use the ordinary batch execute; use the declared batch workbench`);
  }
  deps.authorizer.assertModule(identity, module, "read");
  deps.authorizer.assertTransition(identity, module, transition);
  return await deps.repos.transaction(async (repos) => {
    const tx = pinClock({ ...deps, repos });
    await staleIfGone(module, items, async () => {
      await repos.bills.lockWriteSet(identity, items.map((item) => ({
        kind: "action" as const,
        module,
        id: item.id,
      })));
      for (const item of items) await repos.bills.lockForAction(identity, module, item.id);
    });
    const out: ExecuteResult[] = [];
    for (const item of items) {
      out.push(await executeTransition(tx, {
        identity,
        module,
        billId: item.id,
        transition,
        params: item.params,
        confirmedWarning: item.confirmedWarning,
        idempotencyKey: item.idempotencyKey,
        expectedRevision: item.expectedRevision,
      }));
    }
    return out;
  });
}
