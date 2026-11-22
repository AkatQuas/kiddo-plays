import { randomUUID } from "node:crypto";

const SKU = /^[a-z0-9-]{2,40}$/;

export async function stageOrder(store, actor, input) {
  assertActor(actor);
  const draft = normalizeDraft(input);
  const traceId = randomUUID();
  const action = await store.insertAction({
    id: randomUUID(),
    tenantId: actor.tenantId,
    kind: "create_order",
    payload: draft,
    createdBy: actor.id,
    traceId,
    status: "pending",
  });
  await store.insertEvidence({
    traceId,
    tenantId: actor.tenantId,
    kind: "staged",
    body: { actionId: action.id, draft, actorId: actor.id },
  });
  return {
    action,
    summary: `Staged ${draft.qty} ${draft.sku} for ${draft.customerName}. A person still has to confirm.`,
    evidenceTraceId: traceId,
  };
}

export async function confirmAction(store, actor, actionId) {
  assertActor(actor);
  if (actor.role !== "manager") {
    throw httpError(403, "only a manager can confirm a staged write");
  }
  const action = await store.findAction(actor.tenantId, actionId);
  if (!action) throw httpError(404, "pending action not found");
  if (action.status !== "pending") throw httpError(409, "action is no longer pending");
  if (action.kind !== "create_order") throw httpError(400, "unsupported action");

  const order = await store.insertOrder({
    id: randomUUID(),
    tenantId: actor.tenantId,
    customerName: action.payload.customerName,
    sku: action.payload.sku,
    qty: action.payload.qty,
    createdBy: actor.id,
    sourceActionId: action.id,
    status: "open",
  });
  await store.markAction(actor.tenantId, action.id, "confirmed");
  await store.insertEvidence({
    traceId: action.traceId,
    tenantId: actor.tenantId,
    kind: "confirmed",
    body: { actionId: action.id, orderId: order.id, actorId: actor.id },
  });
  return { order, evidenceTraceId: action.traceId, summary: `Opened order ${order.id}.` };
}

export async function queryOrders(store, actor) {
  assertActor(actor);
  const orders = await store.listOrders(actor.tenantId);
  const traceId = randomUUID();
  await store.insertEvidence({
    traceId,
    tenantId: actor.tenantId,
    kind: "query",
    body: { rows: orders, actorId: actor.id },
  });
  return {
    summary: `${orders.length} open order${orders.length === 1 ? "" : "s"} in this tenant.`,
    evidenceTraceId: traceId,
  };
}

export function agentSummary(result) {
  return {
    summary: result.summary,
    evidenceTraceId: result.evidenceTraceId,
  };
}

function normalizeDraft(input) {
  const customerName = String(input?.customerName ?? "").trim();
  const sku = String(input?.sku ?? "").trim().toLowerCase();
  const qty = Number(input?.qty);
  if (customerName.length < 2 || customerName.length > 80) {
    throw httpError(400, "customerName must be 2 to 80 characters");
  }
  if (!SKU.test(sku)) throw httpError(400, "sku must be a short lowercase code");
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000) {
    throw httpError(400, "qty must be an integer from 1 to 10000");
  }
  return { customerName, sku, qty };
}

function assertActor(actor) {
  if (!actor?.id || !actor.tenantId || !actor.role) {
    throw httpError(401, "missing actor");
  }
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
