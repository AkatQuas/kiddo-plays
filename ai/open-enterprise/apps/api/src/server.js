import { createServer } from "node:http";
import { hashPassword, verifyPassword, DEMO_USERS } from "./passwords.js";
import { issueSession, readCookie, readSession, tokensMatch } from "./session.js";
import { agentSummary, confirmAction, httpError, queryOrders, stageOrder } from "./chain.js";
import { saveAttachment } from "./attachments.js";
import { loadConfig } from "./config.js";
import { createPgStore } from "./pg-store.js";

const LINKS = [
  { from: "browser", to: "web", call: "pages and same-origin /api" },
  { from: "web", to: "api", call: "session cookie set by the local identity issuer" },
  { from: "api", to: "postgres", call: "orders, pending actions, evidence rows" },
  { from: "api", to: "file volume", call: "explicit ATTACHMENT_BACKEND=file" },
  { from: "api", to: "agent", call: "goal plus acting user, when AGENT_HOST_URL is set" },
  { from: "agent", to: "api", call: "X-Service-Token and X-Acting-User, summary only" },
];

export function createApp(config, store, fetchImpl = fetch) {
  return async function handle(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/health") {
        return send(res, 200, { ok: true, releaseEnv: config.releaseEnv, identityIssuer: config.identityIssuer });
      }
      if (req.method === "GET" && url.pathname === "/api/links") {
        return send(res, 200, { links: LINKS });
      }
      if (req.method === "POST" && url.pathname === "/api/session") {
        return send(res, 200, await login(config, store, await readJson(req), res));
      }
      if (req.method === "POST" && url.pathname === "/api/session/logout") {
        res.setHeader("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
        return send(res, 200, { ok: true });
      }

      const agentMatch = url.pathname.match(/^\/api\/agent\/tools\/([a-z_]+)$/);
      if (req.method === "POST" && agentMatch) {
        const actor = await actorFromService(config, store, req);
        const body = await readJson(req);
        const result = await dispatchTool(store, actor, agentMatch[1], body);
        return send(res, 200, agentSummary(result));
      }

      const actor = await actorFromSession(config, store, req);
      if (req.method === "GET" && url.pathname === "/api/me") {
        if (!actor) return send(res, 401, { error: "sign in required" });
        return send(res, 200, publicUser(actor));
      }
      if (!actor) return send(res, 401, { error: "sign in required" });

      if (req.method === "GET" && url.pathname === "/api/orders") {
        return send(res, 200, { orders: await store.listOrders(actor.tenantId) });
      }
      if (req.method === "POST" && url.pathname === "/api/orders") {
        return send(res, 201, await stageOrder(store, actor, await readJson(req)));
      }
      if (req.method === "GET" && url.pathname === "/api/actions") {
        return send(res, 200, { actions: await store.listActions(actor.tenantId) });
      }
      const confirm = url.pathname.match(/^\/api\/actions\/([^/]+)\/confirm$/);
      if (req.method === "POST" && confirm) {
        return send(res, 200, await confirmAction(store, actor, decodeURIComponent(confirm[1])));
      }
      const evidence = url.pathname.match(/^\/api\/evidence\/([^/]+)$/);
      if (req.method === "GET" && evidence) {
        const rows = await store.listEvidence(actor.tenantId, decodeURIComponent(evidence[1]));
        return send(res, 200, { records: rows });
      }
      if (req.method === "POST" && url.pathname === "/api/attachments") {
        return send(res, 201, await saveAttachment(store, actor, config.attachmentDir, await readJson(req)));
      }
      if (req.method === "GET" && url.pathname === "/api/attachments") {
        const rows = await store.listAttachments(actor.tenantId);
        return send(res, 200, { attachments: rows.map(({ storageKey, ...rest }) => rest) });
      }
      if (req.method === "POST" && url.pathname === "/api/console/run") {
        const body = await readJson(req);
        return send(res, 200, await runConsole(config, store, actor, body.goal, fetchImpl));
      }
      return send(res, 404, { error: "not found" });
    } catch (error) {
      const status = error.status || 500;
      return send(res, status, { error: status === 500 ? "internal error" : error.message });
    }
  };
}

async function login(config, store, body, res) {
  if (config.identityIssuer !== "local") {
    throw httpError(403, "this process does not issue local sessions");
  }
  const user = await store.findUserByEmail(String(body.email ?? "").trim().toLowerCase());
  if (!user || !verifyPassword(String(body.password ?? ""), user.passwordHash)) {
    throw httpError(401, "unknown email or password");
  }
  const token = issueSession(user, config.sessionSecret);
  res.setHeader("Set-Cookie", `session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`);
  return publicUser(user);
}

async function actorFromSession(config, store, req) {
  const token = readCookie(req.headers.cookie, "session");
  const session = readSession(token, config.sessionSecret);
  if (!session) return null;
  const user = await store.findUserById(session.id);
  if (!user || user.tenantId !== session.tenantId || user.role !== session.role) return null;
  return user;
}

async function actorFromService(config, store, req) {
  const token = req.headers["x-service-token"];
  if (!tokensMatch(token, config.serviceToken)) throw httpError(401, "service token rejected");
  const actingUser = String(req.headers["x-acting-user"] ?? "").trim();
  const user = await store.findUserById(actingUser);
  if (!user) throw httpError(401, "acting user rejected");
  return user;
}

async function dispatchTool(store, actor, name, body) {
  if (name === "query_orders") return queryOrders(store, actor);
  if (name === "stage_order") return stageOrder(store, actor, body);
  throw httpError(404, "unknown tool");
}

export async function runConsole(config, store, actor, goal, fetchImpl) {
  const text = String(goal ?? "").trim();
  if (!text) throw httpError(400, "goal is required");
  if (config.agentHostUrl) {
    try {
      const response = await fetchImpl(`${config.agentHostUrl}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal: text, actingUser: actor.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "agent host failed");
      return { engine: "agent", ...payload };
    } catch (error) {
      const ruled = await rule(store, actor, text);
      return {
        engine: "rule",
        warning: `Agent host unreachable. The query path still runs. ${error.message}`,
        ...ruled,
      };
    }
  }
  return { engine: "rule", ...await rule(store, actor, text) };
}

async function rule(store, actor, goal) {
  const staged = goal.match(/^stage\s+(\d+)\s+([a-z0-9-]+)\s+for\s+(.+)$/i);
  if (staged) {
    const result = await stageOrder(store, actor, {
      qty: Number(staged[1]),
      sku: staged[2],
      customerName: staged[3],
    });
    return { summary: result.summary, evidenceTraceId: result.evidenceTraceId, action: result.action };
  }
  const result = await queryOrders(store, actor);
  return { summary: result.summary, evidenceTraceId: result.evidenceTraceId };
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "body must be JSON");
  }
}

export async function start(env = process.env) {
  const config = loadConfig(env);
  const store = createPgStore(config.databaseUrl);
  await store.migrate();
  const server = createServer(createApp(config, store));
  await new Promise((resolve) => server.listen(config.apiPort, "0.0.0.0", resolve));
  console.log(`api listening on ${config.apiPort} release=${config.releaseEnv} issuer=${config.identityIssuer}`);
  return server;
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  start().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

export { DEMO_USERS, hashPassword };
