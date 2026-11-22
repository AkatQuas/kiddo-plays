import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listLedgerCodes } from "@open-erp/metamodel";
import { createEngineRegistry } from "../src/index.js";
import { startShowcaseServer } from "../src/showcase-server.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("manufacturing and commerce showcases", () => {
  it("registered in the same process, a request sees each engine's own modules and ledgers by engine id", async () => {
    const registry = createEngineRegistry();
    await registry.register("manufacturing", path.join(ROOT, "domains"));
    await registry.register("commerce", path.join(ROOT, "showcases/commerce/domains"));

    const commerce = registry.run("commerce", (engine) => ({
      modules: [...engine.catalog.modules.keys()].sort(),
      ledgers: [...listLedgerCodes()].sort(),
      receipt: engine.catalog.modules.get("goodsReceipt")?.schema.lifecycle.transitions.find((edge) => edge.code === "receive"),
      shipment: engine.catalog.modules.get("shipment")?.schema.lifecycle.transitions.find((edge) => edge.code === "ship"),
    }));
    expect(commerce.modules).toEqual(["customer", "goodsReceipt", "product", "shipment", "supplier", "warehouse"]);
    expect(commerce.ledgers).toEqual(["ap", "stock"]);
    expect(commerce.receipt?.effects?.[0]).toMatchObject({ target: "stock", op: "in" });
    expect(commerce.shipment?.effects?.[0]).toMatchObject({ target: "stock", op: "out" });

    const manufacturing = registry.run("manufacturing", (engine) => engine.catalog.modules.has("bom"));
    expect(manufacturing).toBe(true);
    expect(registry.run("commerce", (engine) => engine.catalog.modules.has("bom"))).toBe(false);
  });

  it("two webs share one server, and the domain is in the path", async () => {
    const server = await startShowcaseServer({
      manufacturing: path.join(ROOT, "domains"),
      commerce: path.join(ROOT, "showcases/commerce/domains"),
    }, 0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const manufacturing = await fetch(`http://127.0.0.1:${port}/api/manufacturing/catalog`).then((response) => response.json());
      const commerce = await fetch(`http://127.0.0.1:${port}/api/commerce/ledgers`).then((response) => response.json());
      expect(manufacturing.modules.some((mod: { code: string }) => mod.code === "bom")).toBe(true);
      expect(commerce.id).toBe("commerce");
      expect(commerce.codes).toEqual(expect.arrayContaining(["stock", "ap"]));
    } finally {
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    }
  });
});
