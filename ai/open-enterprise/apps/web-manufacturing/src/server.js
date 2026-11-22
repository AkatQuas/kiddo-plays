import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.WEB_PORT || 8080);
const upstream = new URL(process.env.API_UPSTREAM || "http://127.0.0.1:8080");
const root = path.resolve(process.env.WEB_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), "../public"));

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    const proxy = http.request({
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: upstream.host },
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    });
    proxy.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "api unreachable" }));
    });
    req.pipe(proxy);
    return;
  }

  serveFile(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end("static file error");
  });
});

async function serveFile(req, res) {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    await access(file);
  } catch {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

server.listen(port, "0.0.0.0", () => {
  console.log(`web listening on ${port}, api ${upstream.origin}`);
});
