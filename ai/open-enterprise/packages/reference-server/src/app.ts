import { Hono } from "hono";
import type { ReferenceRuntime } from "./runtime.js";
import { registerReferenceRoutes } from "./routes.js";

export function createReferenceApp(runtime: ReferenceRuntime): Hono {
  const app = new Hono();
  registerReferenceRoutes(app, runtime);
  return app;
}