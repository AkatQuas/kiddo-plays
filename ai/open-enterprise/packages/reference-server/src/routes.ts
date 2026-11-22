import { Hono, type Context } from "hono";
import { SchemaError } from "@open-erp/metamodel";
import { createBill, executeTransition } from "@open-erp/runtime-core";
import type { ReferenceRuntime } from "./runtime.js";
import { referenceIdentity } from "./identity.js";

function requireObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new SchemaError("Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function linesOf(body: Record<string, unknown>) {
  const raw = body["lines"];
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new SchemaError("lines must be an object");
  return raw as Record<string, readonly Readonly<Record<string, unknown>>[]>;
}

function catalogPayload(runtime: ReferenceRuntime) {
  return {
    domains: runtime.catalog.domains.map((domain) => ({ code: domain.code, label: domain.label })),
    modules: [...runtime.catalog.modules.values()].map((mod) => ({
      code: mod.code,
      domain: mod.domain,
      label: mod.schema.label,
    })),
  };
}

export function registerReferenceRoutes(app: Hono, runtime: ReferenceRuntime): void {
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.get("/readyz", (c) => c.json({ ok: true, modules: runtime.catalog.modules.size }));
  app.get("/api/catalog", (c) => c.json(catalogPayload(runtime)));

  app.post("/api/modules/:module/bills", async (c) => {
    const identity = referenceIdentity(runtime.catalog);
    const module = c.req.param("module");
    if (!runtime.catalog.modules.has(module)) return c.json({ error: `unknown module ${module}` }, 404);
    try {
      const body = requireObject(await c.req.json());
      const header = (body["header"] ?? body) as Record<string, unknown>;
      const bill = await createBill(runtime.deps, identity, module, header, linesOf(body));
      return c.json({ bill }, 201);
    } catch (error) {
      return errorJson(c, error);
    }
  });

  app.get("/api/modules/:module/bills/:id", async (c) => {
    const identity = referenceIdentity(runtime.catalog);
    const module = c.req.param("module");
    const id = c.req.param("id");
    if (!runtime.catalog.modules.has(module)) return c.json({ error: `unknown module ${module}` }, 404);
    try {
      const bill = await runtime.repos.bills.get(identity, module, id);
      return c.json({ bill });
    } catch (error) {
      return errorJson(c, error);
    }
  });

  app.post("/api/modules/:module/bills/:id/transitions/:transition", async (c) => {
    const identity = referenceIdentity(runtime.catalog);
    const module = c.req.param("module");
    const billId = c.req.param("id");
    const transition = c.req.param("transition");
    if (!runtime.catalog.modules.has(module)) return c.json({ error: `unknown module ${module}` }, 404);
    try {
      const body = requireObject(await c.req.json().catch(() => ({})));
      const params = (body["params"] ?? {}) as Record<string, unknown>;
      const result = await executeTransition(runtime.deps, {
        identity,
        module,
        billId,
        transition,
        params,
        confirmedWarning: typeof body["confirm"] === "string" ? body["confirm"] : null,
        idempotencyKey: typeof body["idempotencyKey"] === "string" ? body["idempotencyKey"] : null,
        ...(typeof body["revision"] === "number" || typeof body["expectedRevision"] === "number"
          ? {
              expectedRevision:
                typeof body["revision"] === "number" ? body["revision"] : (body["expectedRevision"] as number),
            }
          : {}),
      });
      return c.json(result);
    } catch (error) {
      return errorJson(c, error);
    }
  });
}

function errorJson(c: Context, error: unknown): Response {
  if (error instanceof SchemaError) return c.json({ error: error.message }, 400);
  if (error instanceof Error) return c.json({ error: error.message }, 500);
  return c.json({ error: String(error) }, 500);
}