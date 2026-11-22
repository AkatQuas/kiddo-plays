import pg from "pg";
import { hashPassword, DEMO_USERS } from "./passwords.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  tenant_id text NOT NULL,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_actions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  created_by text NOT NULL,
  trace_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  customer_name text NOT NULL,
  sku text NOT NULL,
  qty integer NOT NULL,
  status text NOT NULL,
  created_by text NOT NULL,
  source_action_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence (
  id bigserial PRIMARY KEY,
  trace_id text NOT NULL,
  tenant_id text NOT NULL,
  kind text NOT NULL,
  body jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  filename text NOT NULL,
  storage_key text NOT NULL,
  byte_length integer NOT NULL,
  created_by text NOT NULL
);
`;

export function createPgStore(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  return {
    pool,
    async migrate() {
      await pool.query(SCHEMA);
      for (const user of DEMO_USERS) {
        await pool.query(
          `INSERT INTO users (id, email, name, role, tenant_id, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [user.id, user.email, user.name, user.role, user.tenantId, hashPassword(user.password)],
        );
      }
    },
    async close() {
      await pool.end();
    },
    async findUserByEmail(email) {
      const { rows } = await pool.query(
        "SELECT id, email, name, role, tenant_id, password_hash FROM users WHERE email = $1",
        [email],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async findUserById(id) {
      const { rows } = await pool.query(
        "SELECT id, email, name, role, tenant_id, password_hash FROM users WHERE id = $1",
        [id],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async insertAction(action) {
      await pool.query(
        `INSERT INTO pending_actions (id, tenant_id, kind, payload, status, created_by, trace_id)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
        [action.id, action.tenantId, action.kind, JSON.stringify(action.payload), action.status, action.createdBy, action.traceId],
      );
      return action;
    },
    async listActions(tenantId) {
      const { rows } = await pool.query(
        "SELECT * FROM pending_actions WHERE tenant_id = $1 ORDER BY id",
        [tenantId],
      );
      return rows.map(mapAction);
    },
    async findAction(tenantId, id) {
      const { rows } = await pool.query(
        "SELECT * FROM pending_actions WHERE tenant_id = $1 AND id = $2",
        [tenantId, id],
      );
      return rows[0] ? mapAction(rows[0]) : null;
    },
    async markAction(tenantId, id, status) {
      const { rows } = await pool.query(
        `UPDATE pending_actions SET status = $3 WHERE tenant_id = $1 AND id = $2 RETURNING *`,
        [tenantId, id, status],
      );
      return rows[0] ? mapAction(rows[0]) : null;
    },
    async insertOrder(order) {
      const id = order.id;
      await pool.query(
        `INSERT INTO orders (id, tenant_id, customer_name, sku, qty, status, created_by, source_action_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, order.tenantId, order.customerName, order.sku, order.qty, order.status, order.createdBy, order.sourceActionId],
      );
      return order;
    },
    async listOrders(tenantId) {
      const { rows } = await pool.query(
        "SELECT * FROM orders WHERE tenant_id = $1 ORDER BY id",
        [tenantId],
      );
      return rows.map(mapOrder);
    },
    async insertEvidence(record) {
      await pool.query(
        `INSERT INTO evidence (trace_id, tenant_id, kind, body) VALUES ($1, $2, $3, $4::jsonb)`,
        [record.traceId, record.tenantId, record.kind, JSON.stringify(record.body)],
      );
      return record;
    },
    async listEvidence(tenantId, traceId) {
      const { rows } = await pool.query(
        "SELECT trace_id, tenant_id, kind, body FROM evidence WHERE tenant_id = $1 AND trace_id = $2 ORDER BY id",
        [tenantId, traceId],
      );
      return rows.map((row) => ({
        traceId: row.trace_id,
        tenantId: row.tenant_id,
        kind: row.kind,
        body: row.body,
      }));
    },
    async insertAttachment(record) {
      await pool.query(
        `INSERT INTO attachments (id, tenant_id, filename, storage_key, byte_length, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [record.id, record.tenantId, record.filename, record.storageKey, record.byteLength, record.createdBy],
      );
      return record;
    },
    async listAttachments(tenantId) {
      const { rows } = await pool.query(
        "SELECT * FROM attachments WHERE tenant_id = $1 ORDER BY id",
        [tenantId],
      );
      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        filename: row.filename,
        storageKey: row.storage_key,
        byteLength: row.byte_length,
        createdBy: row.created_by,
      }));
    },
  };
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenantId: row.tenant_id,
    passwordHash: row.password_hash,
  };
}

function mapAction(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    payload: row.payload,
    status: row.status,
    createdBy: row.created_by,
    traceId: row.trace_id,
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerName: row.customer_name,
    sku: row.sku,
    qty: row.qty,
    status: row.status,
    createdBy: row.created_by,
    sourceActionId: row.source_action_id,
  };
}
