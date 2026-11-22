import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@open-erp/loader";
import { describe, expect, it } from "vitest";
import { surfaces } from "../surfaces.ts";

const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});

function stockPostingModules(): readonly string[] {
  const codes: string[] = [];
  for (const [code, loaded] of catalog.modules) {
    const posts = loaded.schema.lifecycle.transitions.some((transition) =>
      transition.effects.some((effect) => effect.target === "stock"),
    );
    if (posts) codes.push(code);
  }
  return codes.sort();
}

describe("Stock ledger document-number list", () => {
  it("reads.modules without product/warehouse equals the modules that post stock, and each has a {{table}} in SQL", () => {
    const surface = surfaces["stockLedgerDetail"];
    expect(surface, "missing query surface stockLedgerDetail").toBeDefined();
    const declared = (surface?.reads.modules ?? []).filter((code) => code !== "product" && code !== "warehouse");
    const posted = stockPostingModules();
    // Completion receipt now posts through the generated stockIn. The old productionReceipt source stays so historical ledger rows can still be traced.
    const expectedSources = [...new Set([...posted, "productionReceipt"])].sort();
    const declaredSet = new Set(declared);
    const expectedSet = new Set(expectedSources);
    const missing = expectedSources.filter((code) => !declaredSet.has(code));
    const extra = declared.filter((code) => !expectedSet.has(code));
    expect(
      missing,
      `these modules now post stock but are missing from the document-number list: ${missing.join(", ") || "(none)"}`,
    ).toEqual([]);
    expect(
      extra,
      `the document-number list includes modules that do not post stock: ${extra.join(", ") || "(none)"}`,
    ).toEqual([]);
    const sql = surface?.sql ?? "";
    const sourceKindList = sql.match(/a\.source_module IN \(([^)]*)\)/)?.[1] ?? "";
    for (const code of expectedSources) {
      expect(sql, `SQL is missing {{table:${code}}} (${code} is a traceable stock-ledger source but is not in the document-number UNION)`).toContain(`{{table:${code}}}`);
      expect(sourceKindList, `module ${code} is not in the sourceKind document list`).toContain(`'${code}'`);
    }
  });
});

describe("Stock ledger batch column", () => {
  it("source modules that declare batchNo on a line are joined to that line table in SQL; modules with no batch cell stay out", () => {
    const sql = surfaces["stockLedgerDetail"]?.sql ?? "";
    const joined = new Map<string, string>();
    for (const hit of sql.matchAll(/\{\{table:([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}\}/g)) {
      joined.set(hit[1] ?? "", hit[2] ?? "");
    }
    for (const code of stockPostingModules()) {
      const subtable = (catalog.modules.get(code)?.schema.fields ?? []).find(
        (field) => field.type === "subtable" && (field.fields ?? []).some((column) => column.key === "batchNo"),
      );
      if (!subtable) {
        expect(
          joined.has(code),
          `${code} lines have no batch cell and must not appear in the batch union — that would read a column that does not exist`,
        ).toBe(false);
        continue;
      }
      expect(
        joined.get(code),
        `${code} lines have batchNo, but the stock ledger detail does not join that line table (the batch column would stay silently empty)`,
      ).toBe(subtable.key);
    }
  });
});
