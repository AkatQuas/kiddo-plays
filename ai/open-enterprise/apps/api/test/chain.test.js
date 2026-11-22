import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { createMemoryStore } from "../src/memory-store.js";
import { hashPassword, DEMO_USERS } from "../src/passwords.js";
import { confirmAction, queryOrders, stageOrder } from "../src/chain.js";
import { saveAttachment } from "../src/attachments.js";
import { createApp } from "../src/server.js";

const baseEnv = {
  RELEASE_ENV: "local",
  IDENTITY_ISSUER: "local",
  ATTACHMENT_BACKEND: "file",
  ATTACHMENT_DIR: "/data/attachments",
  DATABASE_URL: "postgres://app:app@postgres:5432/open_enterprise",
  SESSION_SECRET: "local-session-secret",
  SERVICE_TOKEN: "local-service-token",
};

function seededStore() {
  return createMemoryStore(DEMO_USERS.map((user) => ({
    ...user,
    passwordHash: hashPassword(user.password, "fixed-salt"),
  })));
}

test("production refuses the local identity issuer", () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, RELEASE_ENV: "prod", IDENTITY_ISSUER: "local" }),
    /refused when RELEASE_ENV=prod/,
  );
});

test("attachment backend must be explicit", () => {
  assert.throws(() => loadConfig({ ...baseEnv, ATTACHMENT_BACKEND: "" }), /ATTACHMENT_BACKEND/);
  assert.throws(() => loadConfig({ ...baseEnv, ATTACHMENT_BACKEND: "disk" }), /explicit value file/);
});

test("stage does not open an order until a manager confirms", async () => {
  const store = seededStore();
  const clerk = await store.findUserById("user-clerk");
  const staged = await stageOrder(store, clerk, { customerName: "Harbor Office Supply", sku: "sheet", qty: 4 });
  assert.equal((await store.listOrders(clerk.tenantId)).length, 0);
  await assert.rejects(() => confirmAction(store, clerk, staged.action.id), /only a manager/);
  const manager = await store.findUserById("user-manager");
  const confirmed = await confirmAction(store, manager, staged.action.id);
  assert.equal(confirmed.order.customerName, "Harbor Office Supply");
  assert.equal((await store.listOrders(clerk.tenantId)).length, 1);
});

test("agent tool response keeps row bodies on the evidence channel", async () => {
  const store = seededStore();
  const manager = await store.findUserById("user-manager");
  await stageOrder(store, manager, { customerName: "Cedar Clinic", sku: "sheet", qty: 2 });
  await confirmAction(store, manager, (await store.listActions(manager.tenantId))[0].id);
  const result = await queryOrders(store, manager);
  assert.match(result.summary, /1 open order/);
  assert.equal(result.summary.includes("Cedar Clinic"), false);
  const records = await store.listEvidence(manager.tenantId, result.evidenceTraceId);
  assert.equal(records[0].body.rows[0].customerName, "Cedar Clinic");
});

test("service token and acting user are both required", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "open-enterprise-"));
  const config = loadConfig({ ...baseEnv, ATTACHMENT_DIR: dir, DATABASE_URL: "postgres://unused" });
  const store = seededStore();
  const handle = createApp(config, store);
  const missing = await call(handle, "POST", "/api/agent/tools/query_orders", { headers: {} });
  assert.equal(missing.status, 401);
  const ok = await call(handle, "POST", "/api/agent/tools/query_orders", {
    headers: { "x-service-token": baseEnv.SERVICE_TOKEN, "x-acting-user": "user-clerk" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.summary.includes("customerName"), false);
  const evidence = await call(handle, "GET", `/api/evidence/${ok.body.evidenceTraceId}`, {
    headers: { "x-service-token": baseEnv.SERVICE_TOKEN, "x-acting-user": "user-clerk" },
  });
  assert.equal(evidence.status, 401);
});

test("file attachment stays inside the configured directory", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "open-enterprise-files-"));
  const store = seededStore();
  const clerk = await store.findUserById("user-clerk");
  const saved = await saveAttachment(store, clerk, dir, {
    filename: "note.txt",
    contentBase64: Buffer.from("sample note").toString("base64"),
  });
  const text = await readFile(path.join(dir, clerk.tenantId, saved.id), "utf8");
  assert.equal(text, "sample note");
  await assert.rejects(
    () => saveAttachment(store, clerk, dir, { filename: "../note.txt", contentBase64: "YQ==" }),
    /filename/,
  );
});

async function call(handle, method, pathname, { headers = {}, body } = {}) {
  const req = {
    method,
    url: pathname,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    },
  };
  let status = 0;
  let payload = "";
  const res = {
    statusCode: 0,
    setHeader() {},
    writeHead(code) { status = code; },
    end(chunk) { payload = String(chunk ?? ""); },
  };
  await handle(req, res);
  return { status, body: payload ? JSON.parse(payload) : null };
}
