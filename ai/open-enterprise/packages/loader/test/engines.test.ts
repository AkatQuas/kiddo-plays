import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listLedgerCodes } from "@open-erp/metamodel";
import { createEngineRegistry } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANUFACTURING = path.resolve(HERE, "../../../domains");
const COMMERCE = path.join(HERE, "fixtures", "support-domain");

describe("one process registers several domain engines", () => {
  it("entry is by engine id, and the ledger catalog does not leak into the engine loaded later", async () => {
    const registry = createEngineRegistry();
    await registry.register("manufacturing", MANUFACTURING);
    await registry.register("commerce", COMMERCE);

    const listed = registry.list().map((engine) => engine.id).sort();
    expect(listed).toEqual(["commerce", "manufacturing"]);

    const manufacturing = registry.run("manufacturing", (engine) => ({
      ledgers: [...listLedgerCodes()],
      hasSalesOrder: engine.catalog.modules.has("salesOrder"),
      hasAlpha: engine.catalog.modules.has("alpha"),
    }));
    const commerce = registry.run("commerce", (engine) => ({
      ledgers: [...listLedgerCodes()],
      hasSalesOrder: engine.catalog.modules.has("salesOrder"),
      hasAlpha: engine.catalog.modules.has("alpha"),
    }));

    expect(manufacturing.ledgers).toEqual(expect.arrayContaining(["stock", "ap"]));
    expect(manufacturing.hasSalesOrder).toBe(true);
    expect(manufacturing.hasAlpha).toBe(false);
    expect(commerce.ledgers).not.toContain("ap");
    expect(commerce.hasSalesOrder).toBe(false);
    expect(commerce.hasAlpha).toBe(true);

    const [left, right] = await Promise.all([
      registry.run("manufacturing", async () => {
        await Promise.resolve();
        return listLedgerCodes().includes("ap");
      }),
      registry.run("commerce", async () => {
        await Promise.resolve();
        return listLedgerCodes().includes("ap");
      }),
    ]);
    expect(left).toBe(true);
    expect(right).toBe(false);
  });

  it("registering the same id twice is rejected", async () => {
    const registry = createEngineRegistry();
    await registry.register("manufacturing", MANUFACTURING);
    await expect(registry.register("manufacturing", MANUFACTURING)).rejects.toThrow(/already registered/);
  });
});
