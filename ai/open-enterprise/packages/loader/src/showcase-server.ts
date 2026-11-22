import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { listLedgerCodes } from "@open-erp/metamodel";
import { createEngineRegistry, describeEngine, type EngineRegistry } from "./index.js";

export interface ShowcaseRoots {
  readonly manufacturing: string;
  readonly commerce: string;
}

export async function openShowcaseRegistry(roots: ShowcaseRoots): Promise<EngineRegistry> {
  const registry = createEngineRegistry();
  await registry.register("manufacturing", roots.manufacturing);
  await registry.register("commerce", roots.commerce);
  return registry;
}

export function showcaseHandler(registry: EngineRegistry) {
  return function handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true });
      return;
    }
    const match = url.pathname.match(/^\/api\/(manufacturing|commerce)\/(catalog|ledgers)$/);
    if (req.method !== "GET" || !match) {
      send(res, 404, { error: "not found" });
      return;
    }
    const engineId = match[1] ?? "";
    const view = match[2];
    try {
      const body = registry.run(engineId, (engine) => {
        if (view === "ledgers") {
          return {
            id: engine.id,
            books: engine.ledgerCatalog.books,
            ledgers: engine.ledgerCatalog.ledgers,
            codes: listLedgerCodes(),
          };
        }
        return describeEngine(engine);
      });
      send(res, 200, body);
    } catch (error) {
      send(res, 404, { error: error instanceof Error ? error.message : "missing engine" });
    }
  };
}

export async function startShowcaseServer(roots: ShowcaseRoots, port: number) {
  const registry = await openShowcaseRegistry(roots);
  const server = createServer(showcaseHandler(registry));
  await new Promise<void>((resolve) => server.listen(port, "0.0.0.0", () => resolve()));
  return server;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}
