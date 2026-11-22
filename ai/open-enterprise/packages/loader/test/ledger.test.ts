import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadCatalog } from "../src/index.js";
import { writeSiblingNavigation } from "./support/fixtureNavigation.js";
import {
  effectLedgerOpSignedCheckPredicate,
  installLedgerCatalog,
  peekLedgerCatalog,
} from "@open-erp/metamodel";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.resolve(HERE, "../../../domains");
const fixture = (name: string): string => path.join(HERE, "fixtures", name);

const roots = new Set<string>();
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
  installLedgerCatalog(null);
});

const validSource = `import { defineLedgers } from "@open-erp/metamodel";
export const ledgers = defineLedgers({
  books: ["inventory"],
  ledgers: {
    stock: {
      label: "stock",
      subject: "alpha",
      scope: null,
      ops: { in: 1, out: -1 },
      measure: "quantity",
      book: "inventory",
    },
  },
});
`;

const hatchWith = (source: string, extra?: (root: string) => void): string => {
  const base = mkdtempSync(path.join(tmpdir(), "open-ledgers-"));
  const root = path.join(base, "domains");
  cpSync(fixture("escape-hatch"), root, { recursive: true });
  mkdirSync(path.join(root, "ledgers"));
  writeFileSync(path.join(root, "ledgers", "ledgers.ts"), source);
  extra?.(root);
  writeSiblingNavigation(root);
  roots.add(base);
  return root;
};

const inventedTargetModule = `import { defineModule } from "@open-erp/metamodel";
export default defineModule({
  label: "beta",
  fields: [{ key: "code", label: "number", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "done", label: "done", terminal: true },
    ],
    transitions: [{
      code: "post",
      from: "draft",
      to: "done",
      action: "post",
      effects: [{ target: "invented", op: "in", subject: "$bill.code", amount: 1, reverseOn: [] }],
    }],
  },
  views: { list: { columns: ["code"] } },
});
`;

describe("ledger loading", () => {
  it("a cross-cutting ledgers/ is loaded into the catalog through defineLedgers, and is not added to the business-domain list", async () => {
    const catalog = await loadCatalog({ domainsRoot: hatchWith(validSource) });
    expect(catalog.ledgers.get("stock")?.subject).toBe("alpha");
    expect(catalog.ledgers.get("stock")?.file).toBe(path.join("ledgers", "ledgers.ts"));
    expect(catalog.ledgerBooks).toEqual(["inventory"]);
    expect(catalog.domains.map((domain) => domain.code)).not.toContain("ledgers");
  });

  it("skipping defineLedgers is rejected", async () => {
    await expect(loadCatalog({ domainsRoot: hatchWith("export const ledgers = { books: [], ledgers: {} };") }))
      .rejects.toThrow(/defineLedgers/);
  });

  it("a .ts file outside the allow-list is rejected", async () => {
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource, (root) => {
        writeFileSync(path.join(root, "ledgers", "extra.ts"), "export const extra = 1;\n");
      }),
    })).rejects.toThrow(/is not on the load whitelist/);
  });

  it("a module effect pointing at a target that does not exist is red at load", async () => {
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource, (root) => {
        writeFileSync(path.join(root, "d1", "modules", "beta.ts"), inventedTargetModule);
      }),
    })).rejects.toThrow(/invented/);
  });

  it("the real catalog loads two ledgers plus two period sub-ledgers, and does not treat that directory as a business domain", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(catalog.ledgers.get("stock")?.ops.reserve).toBeUndefined();
    expect(catalog.ledgers.get("stock")?.ops).toEqual({ in: 1, out: -1 });
    expect(catalog.ledgers.get("ap")?.ops).toEqual({ reserve: 1, release: -1, in: 1, out: -1 });
    expect(catalog.domains.map((domain) => domain.code)).not.toContain("ledgers");
  });

  it("after the real catalog loads, the CHECK predicate shares its source with the product catalog", async () => {
    const fromProduct = effectLedgerOpSignedCheckPredicate();
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const installed = peekLedgerCatalog();
    expect(installed).not.toBeNull();
    expect(effectLedgerOpSignedCheckPredicate()).toBe(fromProduct);
    expect(catalog.ledgers.has("stock")).toBe(true);
  });

  it("adding reserve to product stock without release turns the self-check red", async () => {
    const source = readFileSync(path.join(REAL, "ledgers", "ledgers.ts"), "utf8");
    const drifted = source.replace("{ in: 1, out: -1 }", "{ in: 1, out: -1, reserve: -1 }");
    expect(drifted, "the edit must land on product stock.ops (the first in/out)").not.toBe(source);
    await expect(loadCatalog({ domainsRoot: hatchWith(drifted) })).rejects.toThrow(/as a pair/);
  });
});
