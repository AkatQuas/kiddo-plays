import { describe, expect, it } from "vitest";
import { migrateDatabase } from "../src/migrate.js";
import { startReferenceServer } from "../src/main.js";

const databaseUrl = process.env["DATABASE_URL"]?.trim();

describe.runIf(databaseUrl !== undefined && databaseUrl !== "")("reference server (needs DATABASE_URL)", () => {
  it("migrates, creates a warehouse, and reads it back", async () => {
    await migrateDatabase(databaseUrl!);
    const server = await startReferenceServer({ port: 18_994, databaseUrl, migrate: false });
    await new Promise((r) => setTimeout(r, 200));
    const port = server.port;
    try {
      const created = await fetch(`http://127.0.0.1:${port}/api/modules/warehouse/bills`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ header: { name: `Smoke ${Date.now()}` } }),
      });
      expect(created.status).toBe(201);
      const payload = (await created.json()) as { bill: { id: string } };
      const billId = payload.bill.id;
      const read = await fetch(`http://127.0.0.1:${port}/api/modules/warehouse/bills/${billId}`);
      expect(read.status).toBe(200);
      const row = (await read.json()) as { bill: { header: { name: string } } };
      expect(row.bill.header.name).toMatch(/^Smoke /);
    } finally {
      await server.close();
    }
  }, 120_000);
});