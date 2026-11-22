import { createServer } from "node:http";

const apiBase = required("API_BASE_URL").replace(/\/$/, "");
const serviceToken = required("SERVICE_TOKEN");
const port = Number(process.env.AGENT_PORT || 8090);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/run") {
      const body = await readJson(req);
      const actingUser = String(body.actingUser ?? "").trim();
      const goal = String(body.goal ?? "").trim();
      if (!actingUser || !goal) return send(res, 400, { error: "goal and actingUser are required" });
      const staged = goal.match(/^stage\s+(\d+)\s+([a-z0-9-]+)\s+for\s+(.+)$/i);
      const tool = staged ? "stage_order" : "query_orders";
      const payload = staged
        ? { qty: Number(staged[1]), sku: staged[2], customerName: staged[3].trim() }
        : {};
      const result = await callTool(tool, actingUser, payload);
      return send(res, 200, { tool, summary: result.summary, evidenceTraceId: result.evidenceTraceId });
    }
    return send(res, 404, { error: "not found" });
  } catch (error) {
    return send(res, error.status || 502, { error: error.message || "agent failed" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`agent listening on ${port}`);
});

async function callTool(name, actingUser, body) {
  const response = await fetch(`${apiBase}/api/agent/tools/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-service-token": serviceToken,
      "x-acting-user": actingUser,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "tool call rejected");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  return value;
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
