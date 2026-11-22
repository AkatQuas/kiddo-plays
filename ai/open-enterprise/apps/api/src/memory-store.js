import { randomUUID } from "node:crypto";

export function createMemoryStore(seedUsers = []) {
  const users = seedUsers.map((user) => ({ ...user }));
  const actions = [];
  const orders = [];
  const evidence = [];
  const attachments = [];

  return {
    async findUserByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async findUserById(id) {
      return users.find((user) => user.id === id) ?? null;
    },
    async insertAction(action) {
      const row = { id: action.id ?? randomUUID(), status: "pending", ...action };
      actions.push(row);
      return row;
    },
    async listActions(tenantId) {
      return actions.filter((row) => row.tenantId === tenantId);
    },
    async findAction(tenantId, id) {
      return actions.find((row) => row.tenantId === tenantId && row.id === id) ?? null;
    },
    async markAction(tenantId, id, status) {
      const row = actions.find((item) => item.tenantId === tenantId && item.id === id);
      if (!row) return null;
      row.status = status;
      return row;
    },
    async insertOrder(order) {
      const row = { id: order.id ?? randomUUID(), status: "open", ...order };
      orders.push(row);
      return row;
    },
    async listOrders(tenantId) {
      return orders.filter((row) => row.tenantId === tenantId);
    },
    async insertEvidence(record) {
      evidence.push(record);
      return record;
    },
    async listEvidence(tenantId, traceId) {
      return evidence.filter((row) => row.tenantId === tenantId && row.traceId === traceId);
    },
    async insertAttachment(record) {
      attachments.push(record);
      return record;
    },
    async listAttachments(tenantId) {
      return attachments.filter((row) => row.tenantId === tenantId);
    },
  };
}
