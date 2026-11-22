// ---------------------------------------------------------------------------
// Domain-swap gate — load a minimal alternate pack, generate tables, prove packages stay business-agnostic.
//
// Not in `npm run test:engine` until this repo ships `fixtures/domain-minimal` and test identity helpers
// (the full ERP server package is out of scope for this open-source tree). Re-enable in vitest.config.ts
// when those pieces land.
// ---------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadFixtures } from "@open-erp/fixtures";
import { loadCatalogFromRoot } from "@open-erp/loader";
import { isModuleDraft, modulePermissionKey } from "@open-erp/metamodel";
import { createRegistry } from "@open-erp/storage-pg";
import {
  scanBusinessVocabulary,
  scanExactWords,
  scanStatusLiterals,
  scenarioAndFieldVocabulary,
} from "../src/businessVocabulary.js";
import { validate, writeGeneratedTables } from "../src/index.js";
import { listTsFiles, parsedSourceOf } from "../src/sourceFiles.js";
import { testAuthorizer, testIdentityForCatalog } from "../../server/test/support/identity.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const PACKAGES = path.join(ROOT, "packages");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/domain-minimal");
const FIXTURE_DOMAINS = path.join(FIXTURE_ROOT, "domains");
const FIXTURE_TENANT = "widget-fixture";

function domainsImportHits(root: string, onlySrc: boolean): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const file of listTsFiles(root)) {
    const rel = path.relative(PACKAGES, file).replaceAll("\\", "/");
    if (onlySrc && !/\/src\//.test(rel)) continue;
    if (rel.includes("fixtures/")) continue;
    const source = parsedSourceOf(file).source;
    source.split("\n").forEach((text, index) => {
      if (!/from\s+["'][^"']*domains\//.test(text)) return;
      hits.push({ file: rel, line: index + 1, text: text.trim() });
    });
  }
  return hits;
}

function frameworkHits<T extends { file: string }>(hits: readonly T[]): T[] {
  return hits.filter((hit) => {
    const file = hit.file.replaceAll("\\", "/");
    if (file.startsWith("fixtures/")) return false;
    return /(?:^|\/)src\//.test(file);
  });
}

describe("gate: Change one domain packages zero change", () => {
  it("plugin Field Load + Verify + Generate Table + Triangular Pyramid with 0 + No effect", async () => {
    const catalog = await loadCatalogFromRoot(FIXTURE_ROOT, {
      insightScenarios: new Set(["widget_open_count"]),
    });
    expect([...catalog.modules.keys()].sort()).toEqual(["widget", "widgetOrder"]);
    expect(catalog.domains.map((domain) => domain.code)).toEqual(["widgets"]);
    expect([...catalog.ledgers.keys()]).toEqual(["widgetStock"]);
    expect([...catalog.insights.keys()]).toEqual(["widget_open_count"]);
    expect([...catalog.surfaces.keys()]).toEqual(["widgetList"]);
    expect(catalog.quickAsks.map((ask) => ask.key)).toEqual(["fx-widget-open-count"]);

    const result = await validate(FIXTURE_DOMAINS);
    expect(result.ok, JSON.stringify({
      perModule: result.perModule.filter((row) => row.errors.length),
      crossRefs: result.crossRefs,
      createPaths: result.createPaths,
    })).toBe(true);
    expect(result.moduleCount).toBe(2);

    const outDir = mkdtempSync(path.join(tmpdir(), "widget-fixture-tables-"));
    const generated = await writeGeneratedTables(FIXTURE_DOMAINS, outDir);
    expect(generated.files.map((file) => file.path).sort()).toEqual([
      "index.ts",
      "widget.ts",
      "widgetOrder.ts",
    ]);
    expect(generated.files.some((file) => file.content.includes("oe_widget"))).toBe(true);
    expect(generated.files.some((file) => file.content.includes("oe_widget_order"))).toBe(true);

    const vocabHits = frameworkHits(await scanBusinessVocabulary(FIXTURE_DOMAINS, PACKAGES));
    expect(vocabHits, `fixture words hit packages/**/src: ${JSON.stringify(vocabHits.slice(0, 8))}`).toEqual([]);
    const statusHits = frameworkHits(await scanStatusLiterals(FIXTURE_DOMAINS, PACKAGES));
    expect(statusHits, `fixture statuses hit packages/**/src: ${JSON.stringify(statusHits.slice(0, 8))}`).toEqual([]);
    const { scenarios } = await scenarioAndFieldVocabulary(FIXTURE_DOMAINS, PACKAGES);
    expect([...scenarios]).toEqual(["widget_open_count"]);
    const scenarioHits = frameworkHits(await scanExactWords(PACKAGES, scenarios));
    expect(scenarioHits, `fixture scenario ids hit packages/**/src: ${JSON.stringify(scenarioHits.slice(0, 8))}`).toEqual([]);

    const srcImports = domainsImportHits(PACKAGES, true);
    expect(srcImports, `packages/**/src still imports from domains: ${JSON.stringify(srcImports)}`).toEqual([]);

    const loaded = await loadFixtures({ root: FIXTURE_DOMAINS });
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.bills.map((group) => group.module).sort()).toEqual(["widget", "widgetOrder"]);

    const tables = await import(pathToFileURL(path.join(outDir, "index.ts")).href) as Record<string, unknown>;
    const registry = createRegistry(
      new Map([...catalog.modules].map(([code, loaded]) => [code, loaded.schema])),
      tables,
    );
    expect(registry.has("widget")).toBe(true);
    expect(registry.has("widgetOrder")).toBe(true);

    const viaIdentity = testIdentityForCatalog(catalog, {
      tenantId: FIXTURE_TENANT,
      orgId: "o-widget",
      userId: "u-widget",
      agentId: null,
    });
    expect(viaIdentity.permissions).toContain(modulePermissionKey("widget", "read"));
    // query facet permission is the coordinates that can be awarded. The full identity of the missions comes from articles, so it contains this key; has to look at this string.
    expect(viaIdentity.permissions).toContain("system:widgetList:read");
    expect(testAuthorizer(catalog).has(viaIdentity, "system:widgetList:read")).toBe(true);
    const widgetReadOnly = testIdentityForCatalog(catalog, {
      tenantId: FIXTURE_TENANT,
      orgId: "o-widget",
      userId: "u-widget",
      agentId: null,
      permissions: [modulePermissionKey("widget", "read")],
    });
    expect(testAuthorizer(catalog).has(widgetReadOnly, "system:widgetList:read")).toBe(false);

    // the module file is a single import. * Draft: code by file name,
    // only after the loader seal -- so identity is seen in the catalog, not in the statement. Look.
    const widgetOrder = await import(
      pathToFileURL(path.join(FIXTURE_DOMAINS, "widgets/modules/widgetOrder.ts")).href
    ) as { default: unknown };
    expect(isModuleDraft(widgetOrder.default)).toBe(true);
    expect(catalog.modules.get("widgetOrder")?.file).toBe("widgets/modules/widgetOrder.ts");

    const tablesImports: { file: string; text: string }[] = [];
    const closedKeyof: { file: string; text: string }[] = [];
    for (const file of listTsFiles(PACKAGES)) {
      const rel = path.relative(PACKAGES, file).replaceAll("\\", "/");
      if (!/\/src\//.test(rel) || rel.includes("fixtures/")) continue;
      const source = parsedSourceOf(file).source;
      for (const text of source.split("\n")) {
        if (/from\s+["']@open-erp\/tables["']/.test(text)) {
          tablesImports.push({ file: rel, text: text.trim() });
        }
        if (/keyof\s+typeof/.test(text) && /permission|ledger|SYSTEM_|FRAMEWORK_|stockQuery|productArchive/i.test(text)) {
          closedKeyof.push({ file: rel, text: text.trim() });
        }
      }
    }
    expect(tablesImports, `packages/**/src still imports @open-erp/tables: ${JSON.stringify(tablesImports)}`).toEqual([]);
    expect(closedKeyof, `packages/**/src still has a closed keyof typeof: ${JSON.stringify(closedKeyof)}`).toEqual([]);

    const serverTsconfig = readFileSync(path.join(PACKAGES, "server/tsconfig.json"), "utf8");
    const storageTsconfig = readFileSync(path.join(PACKAGES, "storage-pg/tsconfig.json"), "utf8");
    expect(serverTsconfig).not.toMatch(/tables/);
    expect(storageTsconfig).not.toMatch(/tables/);
  }, 60_000);

});
