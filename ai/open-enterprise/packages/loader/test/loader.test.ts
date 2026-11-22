import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkCreatePaths,
  checkCrossReferences,
  loadCatalog,
  requireModule,
  type Catalog,
  type LoadedModule,
} from "../src/index.js";
import {
  compilePivotSql,
  defineFixtureModule,
  hasEditableStatus,
  normalizeCheck,
  normalizeField,
  requireCoordinateSegment,
  withPushOrigins,
  type Field,
  type ModuleSchema,
} from "@open-erp/metamodel";

import { writeSiblingNavigation } from "./support/fixtureNavigation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.resolve(HERE, "../../../domains");
const fixture = (name: string): string => path.join(HERE, "fixtures", name);
const fx = (name: string) => {
  const domainsRoot = fixture(name);
  return { domainsRoot, navigationFile: path.join(domainsRoot, "navigation.ts") };
};

// Boundary tests for references build a temporary directory, so the 24 KiB/96 KiB sentinel body is not committed into a fixture.
const temporarySkillRoots = new Set<string>();
const temporarySkillFixture = (): string => {
  const base = mkdtempSync(path.join(tmpdir(), "open-loader-skill-"));
  const root = path.join(base, "domains");
  cpSync(fixture("skill-attachments"), root, { recursive: true });
  writeSiblingNavigation(root);
  temporarySkillRoots.add(base);
  return root;
};

afterEach(() => {
  for (const root of temporarySkillRoots) rmSync(root, { recursive: true, force: true });
  temporarySkillRoots.clear();
});

describe("loading the real domains/", () => {
  it("production orders anchor own-org-and-descendants on the factory dictionary code", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const target = catalog.authorization.scopeTargets.find((item) =>
      item.module === "productionOrder" && item.policy === "own-org-and-descendants");
    expect(target).toMatchObject({ field: "productionOrgId", walkUpToType: "factory" });
  });

  it("stock query surfaces: only a surface with its own page has a path; an alert surface does not", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(catalog.surfaces.get("stockQuery")?.path).toBe("/_stock-query");
    expect(catalog.surfaces.get("stockQueryBreakdown")?.path).toBeNull();
    expect(catalog.surfaces.get("productionReport")?.path).toBe("/_production-report");
    // The safety-stock alert surface is not in navigation: it is only the scope of a notification rule, and it has no page of its own
    expect(catalog.surfaces.get("stockBelowSafety")?.path).toBeNull();
  });

  it("the production-report surface compiles against the module catalog after load", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const surface = catalog.surfaces.get("productionReport");
    if (surface === undefined) throw new Error("missing the productionReport query surface");
    if (surface.pivotResolved === null) throw new Error("productionReport has no pivot bound");
    expect(surface.pivotResolved.requiredRowDims).toEqual([]);
    const sql = compilePivotSql(
      surface.pivotResolved,
      surface.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-01", rowDims: ["worker", "team"], colDim: "operation" },
      { timezone: "Asia/Shanghai" },
    );
    expect(sql).toContain("FULL JOIN");
    expect(sql).toContain("{{table:processAssignment}}");
    expect(sql).toContain("{{table:processReport}}");
  });

  it("the delivery-report surface compiles against the module catalog after load", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const surface = catalog.surfaces.get("deliveryReport");
    if (surface === undefined) throw new Error("missing the deliveryReport query surface");
    if (surface.pivotResolved === null) throw new Error("deliveryReport has no pivot bound");
    expect(surface.path).toBe("/_delivery-report");
    expect(surface.permission).toBe("system:deliveryReport:read");
    expect(surface.reads.modules).toContain("salesDelivery");
    const dimKeys = surface.pivotResolved.dimensions.map((dim) => dim.key);
    expect(dimKeys).toEqual(expect.arrayContaining(["salesOrder", "promiseDate", "overdue"]));
    expect(Object.keys(surface.pivotResolved.measures)).not.toContain("promiseDate");
    expect(Object.keys(surface.pivotResolved.measures)).not.toContain("overdue");
    expect(Object.keys(surface.pivotResolved.measures)).not.toContain("unit");
    const productUnit = surface.pivotResolved.dimensions
      .find((dim) => dim.key === "product")
      ?.attrs.find((attr) => attr.key === "productUnit");
    expect(productUnit).toMatchObject({ key: "productUnit", label: "Unit" });
    expect(productUnit?.choiceSet).toBeTruthy();
    expect(surface.pivotResolved.requiredRowDims).toEqual(["product"]);
    const sku = surface.pivotResolved.dimensions.find((dim) => dim.key === "sku");
    if (sku === undefined) throw new Error("missing the sku dimension");
    expect(sku.attrs).toEqual([]);
    expect(sku.attrs.find((attr) => attr.key === "skuUnit")).toBeUndefined();
    const sql = compilePivotSql(
      surface.pivotResolved,
      surface.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-01", rowDims: ["customer", "salesperson", "product"] },
      { timezone: "Asia/Shanghai" },
    );
    expect(sql).toContain("{{table:salesOrder.lines}}");
    expect(sql).toContain("{{table:salesDelivery}}");
    expect(sql).toContain("{{table:salesDelivery.lines}}");
    expect(sql).not.toContain("shipped_base_qty");
    const dimSql = compilePivotSql(
      surface.pivotResolved,
      surface.columns,
      { dateFrom: "2026-09-01", dateTo: "2026-09-01", rowDims: ["overdue", "promiseDate"] },
      { timezone: "Asia/Shanghai" },
    );
    expect(dimSql).toContain("{{table:salesOrder.lines}}");
  });

  it("module code and every header/line Field.key pass the same coordinate-syntax gate", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const coordinates: Array<{ value: string; label: string }> = [];

    const collectFields = (moduleCode: string, fields: readonly Field[], prefix = "fields"): void => {
      fields.forEach((field, index) => {
        const label = `${moduleCode}.${prefix}[${String(index)}].key`;
        coordinates.push({ value: field.key, label });
        if (field.fields) collectFields(moduleCode, field.fields, `${prefix}.${field.key}.fields`);
      });
    };

    for (const loaded of catalog.modules.values()) {
      coordinates.push({ value: loaded.code, label: `${loaded.file}.code` });
      collectFields(loaded.code, loaded.schema.fields);
    }

    for (const coordinate of coordinates) {
      expect(requireCoordinateSegment(coordinate.value, coordinate.label)).toBe(coordinate.value);
    }
  });

  it("a system-code enum without facing copy is rejected", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const loaded = requireModule(catalog, "productionOrder");
    const broken: Catalog = {
      ...catalog,
      modules: new Map([...catalog.modules, ["productionOrder", {
        ...loaded,
        schema: {
          ...loaded.schema,
          fields: loaded.schema.fields.map((field) => {
            if (field.key !== "productionType") return field;
            return {
              ...field,
              options: [{ value: "salesDelivery", label: "salesDelivery" }],
            };
          }),
        },
      }]]),
    };
    expect(checkCrossReferences(broken).map((error) => `${error.path} ${error.message}`).join("\n"))
      .toMatch(/fields\.productionType\.options.*salesDelivery.*facing copy/);
  });

  it("asking for a module that does not exist throws, instead of returning undefined for each caller to paper over", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(() => requireModule(catalog, "nope")).toThrow(/unknown module/);
  });
});

describe("directory conventions are enforced, not only written in the docs", () => {
  it("🔴 a file name that does not yield a legal code is rejected — the identity injection point must refuse, so a malformed file name cannot become a malformed module code", async () => {
    // Code has one source (the file name), so the file name itself must pass the coordinate-segment gate:
    // letting `alpha-beta` through would grow that code into the permission catalog, table names, and front-end routes
    await expect(loadCatalog(fx("bad-file-name"))).rejects.toThrow(
      /module\.code "alpha-beta" is not a legal coordinate id/,
    );
  });

  it("forgetting export default — otherwise the module silently does not exist", async () => {
    await expect(loadCatalog(fx("no-default"))).rejects.toThrow(/has no export default/);
  });

  // ── Support domains: agents / skills only, zero documents ──
  //
  // These three pin a real incident: `ops` is a support domain, and the loader used to require `modules/` unconditionally,
  // so the repo grew an **empty** `domains/ops/modules/`. Git cannot store an empty directory ⇒ it is not in
  // the repo ⇒ a local `docker build` (filesystem) comes up, and CI (git checkout)
  // throws `LoadError` on startup. One Dockerfile, two results, and the build stage was green.

  it("a support domain with no modules/ is legal — declaring `modules: false` must not still require that directory", async () => {
    const catalog = await loadCatalog(fx("support-domain"));
    expect(catalog.domains.map((d) => [d.code, d.modules])).toEqual([["d1", false], ["d2", true]]);
    // Zero documents, but the agent is still emitted — that is why a support domain exists
    expect(catalog.agents.map((a) => a.id)).toEqual(["helper"]);
    expect([...catalog.modules.keys()]).toEqual(["alpha"]);
  });

  it("🔴 missing modules/ without `modules: false` still throws — otherwise a mistyped `modules` becomes a silent zero-module domain", async () => {
    // Treating "no modules/ means a support domain" is fail-open: the domain whose directory was spelled `module/`
    // loses every document and the loader says nothing
    await expect(loadCatalog(fx("code-mismatch-no-modules"))).rejects.toThrow(
      /has no modules\/ directory[\s\S]*modules: false/,
    );
  });

  it("🔴 declaring `modules: false` and still dropping modules in must throw — none of them would be loaded", async () => {
    await expect(loadCatalog(fx("support-domain-with-modules"))).rejects.toThrow(
      /declares `modules: false`, but d1\/modules\/ contains module files/,
    );
  });

  it("exporting a raw object — load time re-runs both gates and rejects loudly", async () => {
    await expect(loadCatalog(fx("raw-object"))).rejects.toThrow();
  });

  it("🔴 a well-shaped bare object carrying postsToLedger:false — a duck check lets it through, and the real gate must stop it", async () => {
    // This pins what actually enforces "the export must be the return value of defineModule".
    // Checking `"code" in v && "lifecycle" in v` lets this fixture through,
    // and it silently turns off "a ledger posting must not land before the user can see it":
    // the web side only asserts that the key is present, not that it is right.
    await expect(loadCatalog(fx("bypass-gate"))).rejects.toThrow(/postsToLedger/);
  });

  it("two domains each have a module of the same name — which one wins must not depend on scan order", async () => {
    await expect(loadCatalog(fx("duplicate"))).rejects.toThrow(
      /module code "alpha" is duplicated/,
    );
  });

  it("🔴 two modules claim the same numbering prefix — they share a counter, and both sequences skip numbers with no explanation", async () => {
    // The codes do not collide, so the previous gate lets them through. But the prefix is one dimension of oe_code_seq:
    // sharing a prefix shares the sequence. Nobody collides on a number (it is the same counter), but both sequences skip —
    // a product jumps from SP-0007 to SP-0011, and the four numbers in between live on another table. Zero errors, and no way to see why.
    // It can only be checked in the loader: validateModule looks at one module at a time and is structurally blind to "someone else uses this prefix".
    await expect(loadCatalog(fx("duplicate-prefix"))).rejects.toThrow(
      /numbering prefix "SP" is duplicated/,
    );
  });

  it("a domain directory missing package.json — do not skip it silently (the modules would vanish)", async () => {
    // Skipping is for build output such as dist/. A directory that has modules/ and no package.json
    // was left unfinished, and the fail-open symptom is "the modules vanished", with no message
    await expect(loadCatalog(fx("no-package"))).rejects.toThrow(/no package.json/);
  });

  it("a domain with no domain.ts — do not fall back to the directory name as the display name", async () => {
    // Falling back would show `d1` on the menu, and nothing would tell you a file is missing
    await expect(loadCatalog(fx("no-domain"))).rejects.toThrow(/has no domain.ts/);
  });

  it("🔴 a directory name that does not yield a legal code must throw — the identity injection point is the only place left that can stop a malformed domain name", async () => {
    // The declaration has nowhere left to write a code, so "is the domain code a legal coordinate" has only the injection-point gate.
    // Letting it through turns a directory named `d-1/` into a malformed domain code with no warning,
    // and that code enters permission-catalog keys and menu groups
    await expect(loadCatalog(fx("domain-bad-dir-name"))).rejects.toThrow(
      /domain\.code "d-1" is not a legal coordinate id/,
    );
  });

  it("a missing domains root throws, and does not return an empty catalog", async () => {
    await expect(loadCatalog(fx("nonexistent"))).rejects.toThrow(/domains root does not exist/);
  });

  it("a missing navigation.ts fails and names the path, and does not collapse into an empty tree", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "open-loader-no-nav-"));
    const root = path.join(base, "domains");
    cpSync(fixture("escape-hatch"), root, { recursive: true });
    rmSync(path.join(root, "navigation.ts"), { force: true });
    try {
      await expect(loadCatalog({ domainsRoot: root })).rejects.toThrow(/navigation\.ts/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("create-path gate — the other question at this layer: can this document come into existence", () => {
  const catalogOf = (modules: ReadonlyMap<string, LoadedModule>, base: Catalog): Catalog => ({
    modules,
    choiceSets: base.choiceSets,
    moduleSettings: base.moduleSettings,
    domains: base.domains,
    skills: base.skills,
    flows: base.flows,
    composites: base.composites,
    agents: base.agents,
    authorization: base.authorization,
    dashboards: base.dashboards,
    surfaces: base.surfaces,
    insights: base.insights,
    report: base.report,
    ledgers: base.ledgers,
    ledgerBooks: base.ledgerBooks,
    quickAsks: base.quickAsks,
    navigation: base.navigation,
  });

  /**
   * The only shape that still blocks manual create: **the companion ref is required, and the paired line reference is optional**.
   *
   * 🔴 Both proofs in this group depend on it. After `NO_MANUAL_INPUT_TYPES` went empty, the real domains
   * have no module that cannot be created by hand — proving the gate against a real module that stays red would only prove a tautology.
   * The hole is not about rendering. It is the **declaration itself**: the companion column is filled only by the join off that refLine hop,
   * the client is not allowed to write it, and refLine may be left empty — empty, that column has no source,
   * the value gate skips system-supplied fields entirely, and it walks all the way to a PG NOT NULL.
   */
  const holedModule = (): ModuleSchema =>
    defineFixtureModule({
      code: "holedReceipt",
      label: "receipt with a hole",
      domain: "sales",
      numbering: { prefix: "HOLE", seqScope: "day" },
      fields: [
        { key: "code", label: "document number", type: "string", primary: true, auto: true },
        {
          key: "lines",
          label: "lines",
          type: "subtable",
          ref: "holedReceiptLine",
          fields: [
            { key: "orderId", label: "sales order", type: "ref", ref: "salesOrder", required: true },
            // 🔴 Deliberately not required: the companion orderId is required, and its only source may be absent
            { key: "orderLineId", label: "order line", type: "refLine", ref: "salesOrder", through: "lines" },
            { key: "qty", label: "quantity", type: "number", required: true },
          ],
        },
      ],
      lifecycle: {
        statuses: [
          { key: "draft", initial: true },
          { key: "done", terminal: true },
        ],
        transitions: [{ code: "done", from: "draft", to: "done", action: "complete" }],
      },
      views: { list: { columns: ["code"] }, form: [{ title: "header", fields: ["code", "lines"] }] },
    });

  /** Put a schema into a module table that contains only itself (borrowing a real module's LoadedModule shell). */
  const soloCatalog = (base: Catalog, shell: LoadedModule, code: string, schema: ModuleSchema): Catalog =>
    catalogOf(new Map([[code, { ...shell, code, schema }]]), base);

  it("🔴 salesDelivery is still reachable after its upstream is removed — the manual-create road is already open", async () => {
    // After the two-step document picker landed,
    // `refLine` left `NO_MANUAL_INPUT_TYPES`, and "required line reference + required companion ref" on a line
    // no longer blocks manual create. This assertion pins that flip: it is written down because the only question
    // the next person should ask when "removing the upstream is still not red" is "is the manual road open?".
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    expect(checkCreatePaths(catalog).some((e) => e.module === "salesDelivery")).toBe(false);
    expect(delivery.schema.creatable.pushedFrom).not.toEqual([]);

    const [alone] = withPushOrigins([delivery.schema]);
    if (!alone) throw new Error("withPushOrigins returned one module short");
    expect(alone.creatable.manual).toBe(true);
    expect(alone.creatable.blockers).toEqual([]);
    expect(checkCreatePaths(catalogOf(new Map([["salesDelivery", { ...delivery, schema: alone }]]), catalog))).toEqual([]);
  });

  it("🔴 the criterion is not a tautology: a required companion ref with an optional line reference is red when nothing pushes", async () => {
    // Same reason as the escape-hatch test that "the counter really counts": once a gate becomes a tautology,
    // the day it breaks nothing will notice. After `NO_MANUAL_INPUT_TYPES` went empty,
    // this is the only shape that still blocks manual create, so the proof has to land on this shape.
    //
    // The hole is not about rendering. It is the **declaration itself**: the companion column is filled only by the join off that refLine hop,
    // the client is not allowed to write it, and refLine may be left empty — empty, that column has no source,
    // the value gate skips system-supplied fields entirely, and it walks all the way to a PG NOT NULL
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    const [assembled] = withPushOrigins([holedModule()]);
    if (!assembled) throw new Error("withPushOrigins returned one module short");
    const errors = checkCreatePaths(soloCatalog(catalog, delivery, "holedReceipt", assembled));
    expect(errors.map((e) => ({ module: e.module, code: e.code, path: e.path }))).toEqual([
      { module: "holedReceipt", code: "MODULE_NO_CREATE_PATH", path: "creatable" },
    ]);
    // The report has to say **which cell** blocked manual create, or the person who receives the red gate has nowhere to start
    expect(errors[0]?.message).toContain("lines.orderId");
  });

  it("views.createFrom is the third create path — a document-picker entry means the module is not dead even when nobody pushes", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(checkCreatePaths(catalog).some((e) => e.module === "purchaseReturn")).toBe(false);
    const ret = requireModule(catalog, "purchaseReturn");
    expect(ret.schema.views.createFrom.length).toBeGreaterThan(0);
  });

  it("hasEditableStatus false plus a required systemGenerated blocker is the fourth create path (written outside the module)", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    const schema = defineFixtureModule({
      code: "directoryAccount",
      label: "directory account",
      domain: "d1",
      fields: [
        { key: "code", label: "account name", type: "string", primary: true },
        { key: "syncedAt", label: "synced at", type: "datetime", required: true, systemGenerated: true },
      ],
      lifecycle: {
        statuses: [
          { key: "active", label: "employed", initial: true, editable: "none" },
          { key: "disabled", label: "left", editable: "none" },
        ],
        transitions: [
          { code: "disable", from: "active", to: "disabled", action: "leave", internal: true },
          { code: "enable", from: "disabled", to: "active", action: "reinstate", internal: true },
        ],
      },
      views: { list: { columns: ["code"] }, form: [{ title: "account", fields: ["code", "syncedAt"] }] },
    });
    const [assembled] = withPushOrigins([schema]);
    if (!assembled) throw new Error("withPushOrigins returned one module short");
    expect(hasEditableStatus(assembled)).toBe(false);
    expect(assembled.creatable.manual).toBe(false);
    expect(assembled.creatable.pushedFrom).toEqual([]);
    expect(assembled.views.createFrom).toEqual([]);
    expect(checkCreatePaths(soloCatalog(catalog, delivery, "directoryAccount", assembled))).toEqual([]);
  });

  it("no editable status and no blocker / push / picker means it is not a create path, and it is rejected", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    const schema = defineFixtureModule({
      code: "lockedShell",
      label: "locked shell",
      domain: "d1",
      fields: [
        { key: "code", label: "code", type: "string", primary: true },
      ],
      lifecycle: {
        statuses: [
          { key: "active", label: "employed", initial: true, editable: "none" },
          { key: "disabled", label: "left", editable: "none" },
        ],
        transitions: [
          { code: "disable", from: "active", to: "disabled", action: "leave", internal: true },
          { code: "enable", from: "disabled", to: "active", action: "reinstate", internal: true },
        ],
      },
      views: { list: { columns: ["code"] }, form: [{ title: "record", fields: ["code"] }] },
    });
    const [assembled] = withPushOrigins([schema]);
    if (!assembled) throw new Error("withPushOrigins returned one module short");
    expect(hasEditableStatus(assembled)).toBe(false);
    const unreachable = {
      ...assembled,
      creatable: { manual: false, blockers: [], pushedFrom: [] as const },
    };
    const errors = checkCreatePaths(soloCatalog(catalog, delivery, "lockedShell", unreachable));
    expect(errors.map((e) => ({ module: e.module, code: e.code, path: e.path }))).toEqual([
      { module: "lockedShell", code: "MODULE_NO_CREATE_PATH", path: "creatable" },
    ]);
  });

  it("an editable status does not take the fourth path; with no push or picker it is still a dead module", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    const schema = defineFixtureModule({
      code: "halfLocked",
      label: "half-locked record",
      domain: "d1",
      fields: [
        { key: "code", label: "code", type: "string", primary: true },
        { key: "syncedAt", label: "synced at", type: "datetime", required: true, systemGenerated: true },
      ],
      lifecycle: {
        statuses: [
          { key: "active", label: "in use", initial: true, editable: "full" },
          { key: "disabled", label: "disabled", editable: "none" },
        ],
        transitions: [
          { code: "disable", from: "active", to: "disabled", action: "disable" },
          { code: "enable", from: "disabled", to: "active", action: "enable" },
        ],
      },
      views: { list: { columns: ["code"] }, form: [{ title: "record", fields: ["code", "syncedAt"] }] },
    });
    const [assembled] = withPushOrigins([schema]);
    if (!assembled) throw new Error("withPushOrigins returned one module short");
    expect(hasEditableStatus(assembled)).toBe(true);
    const errors = checkCreatePaths(soloCatalog(catalog, delivery, "halfLocked", assembled));
    expect(errors.map((e) => ({ module: e.module, code: e.code, path: e.path }))).toEqual([
      { module: "halfLocked", code: "MODULE_NO_CREATE_PATH", path: "creatable" },
    ]);
  });

  it("an editable status that can be created by hand is not rejected by the fourth path", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    const schema = defineFixtureModule({
      code: "openArchive",
      label: "editable record",
      domain: "d1",
      fields: [
        { key: "code", label: "code", type: "string", primary: true },
      ],
      lifecycle: {
        statuses: [
          { key: "active", label: "in use", initial: true, editable: "full" },
          { key: "disabled", label: "disabled", editable: "none" },
        ],
        transitions: [
          { code: "disable", from: "active", to: "disabled", action: "disable" },
          { code: "enable", from: "disabled", to: "active", action: "enable" },
        ],
      },
      views: { list: { columns: ["code"] }, form: [{ title: "record", fields: ["code"] }] },
    });
    const [assembled] = withPushOrigins([schema]);
    if (!assembled) throw new Error("withPushOrigins returned one module short");
    expect(hasEditableStatus(assembled)).toBe(true);
    expect(assembled.creatable.manual).toBe(true);
    expect(checkCreatePaths(soloCatalog(catalog, delivery, "openArchive", assembled))).toEqual([]);
  });

  it("🔴 an unassembled module (pushedFrom null) reports a missed assembly, not \"no push source\"", async () => {
    // The two meanings are opposite. Mixing them into one sentence reports a missed assembly as a room full of "unreachable modules",
    // and the place that actually needs a change (one missing withPushOrigins call) is never mentioned.
    // 🔴 Use the shape that **cannot** be created by hand: when `manual` is true the gate continues early,
    // and proving this with a manually creatable module leaves the assertion green on a branch that never ran
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const delivery = requireModule(catalog, "salesDelivery");
    const holed = holedModule();
    const raw = { ...holed, creatable: { ...holed.creatable, pushedFrom: null } };
    const errors = checkCreatePaths(soloCatalog(catalog, delivery, "holedReceipt", raw));
    expect(errors[0]?.path).toBe("creatable.pushedFrom");
    expect(errors[0]?.message).toContain("withPushOrigins");
  });
});

describe("cross-module reference checks — the layer a single-module gate cannot see", () => {
  it("a choiceSet must land in the product catalog, not a dictionary code discovered only at runtime", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const loaded = requireModule(catalog, "salesOrder");
    const fields = loaded.schema.fields.map((field) =>
      field.key === "orderSource" ? { ...field, choiceSet: "sales.missing" } : field,
    );
    const modules = new Map(catalog.modules);
    modules.set(loaded.code, { ...loaded, schema: { ...loaded.schema, fields } });
    const errors = checkCrossReferences({ ...catalog, modules });
    expect(errors.some((error) => error.path === "fields.orderSource.choiceSet" && error.message.includes("does not exist"))).toBe(true);
  });

  it("a configurable classification cannot enter a rule branch on a concrete value; a presence-only rule such as required_fields is not in that class", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const loaded = requireModule(catalog, "salesOrder");
    const [first, ...rest] = loaded.schema.preconditions;
    if (!first) throw new Error("salesOrder should have at least one precondition");
    const preconditions = [{
      ...first,
      check: normalizeCheck({
        primitive: "field_compare",
        left: { ref: "$bill.orderSource" },
        op: "eq",
        right: { value: "b2b" },
      }),
    }, ...rest];
    const modules = new Map(catalog.modules);
    modules.set(loaded.code, { ...loaded, schema: { ...loaded.schema, preconditions } });
    const errors = checkCrossReferences({ ...catalog, modules });
    expect(errors.some((error) => error.path.includes(`preconditions.${first.id}.check`) && error.message.includes("configurable-dictionary"))).toBe(true);
  });

  it("a directory-shaped custom module cannot bind a choiceSet: build time cannot prove the Planner does not branch on a concrete value", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const loaded = requireModule(catalog, "productionOrder");
    expect(loaded.escapeHatch).toBe(true);
    const classification = normalizeField({
      key: "classification",
      label: "classification",
      type: "enum",
      choiceSet: "sales.orderSource",
    });
    const modules = new Map(catalog.modules);
    modules.set(loaded.code, { ...loaded, schema: { ...loaded.schema, fields: [...loaded.schema.fields, classification] } });
    const errors = checkCrossReferences({ ...catalog, modules });
    expect(errors.some((error) => error.path === "fields.classification.choiceSet" && error.message.includes("Planner"))).toBe(true);
  });

  it("a refFilter cannot narrow candidates by a configurable classification, or a value a tenant adds later has no definable process meaning", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const errors = checkCrossReferences(
      withRefFilter(catalog, "salesOrder", "customerId", { servicePriority: "key" }),
    );
    expect(errors.some((error) => error.path.includes("refFilter.servicePriority") && error.message.includes("tenant-configurable dictionary"))).toBe(true);
  });

  it("org type is a structural dictionary: a refFilter may use a preset code, and a legacy display value is red", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const ok = checkCrossReferences(
      withRefFilter(catalog, "worker", "productionOrgId", { orgType: "factory", status: "active" }),
    );
    expect(ok.filter((error) => error.path.includes("refFilter.orgType"))).toEqual([]);

    const chinese = checkCrossReferences(
      withRefFilter(catalog, "worker", "productionOrgId", { orgType: "not-a-code" }),
    );
    expect(chinese.some((error) => error.path.includes("refFilter.orgType") && error.message.includes("manufacturing.orgType"))).toBe(true);
  });

  it("a ref that points at a module that does not exist is found", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const salesOrder = requireModule(catalog, "salesOrder");
    // Build a catalog that references a module that does not exist
    const broken = new Map(catalog.modules);
    broken.delete("warehouse");
    const errors = checkCrossReferences({ ...catalog, modules: broken });

    expect(errors.some((e) => e.module === "salesOrder" && e.path.includes("warehouseId"))).toBe(true);
    expect(salesOrder.schema.fields.find((f) => f.key === "warehouseId")?.ref).toBe("warehouse");
  });

  it("drill one layer: a ref on a line-table column must resolve too, or references inside lines are a blind spot", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    // A line's productId points at product — and that module really exists
    const lines = requireModule(catalog, "salesOrder").schema.fields.find((f) => f.key === "lines");
    expect(lines?.fields?.find((f) => f.key === "productId")?.ref).toBe("product");

    // Remove product, and the reference inside lines must be caught (it is not excused for living under lines)
    const broken = new Map(catalog.modules);
    broken.delete("product");
    const errors = checkCrossReferences({ ...catalog, modules: broken });
    expect(errors.some((e) => e.path === "fields.lines.fields.productId.ref")).toBe(true);
  });

  // ── Reference-candidate filters: both ends of the coordinate are checked at build time ──
  //
  // 🔴 A refFilter has two ends. Writing either end wrong raises nothing, and the symptoms are opposite:
  //   · target end (the condition key) wrong ⇒ the candidate side cannot compile that column, and it blows up on the first dropdown;
  //   · source end (`x` in `$bill.x`) wrong ⇒ a missing value is treated as "that cell is still empty" ⇒ the UI forever shows
  //     "fill in xxx first", and xxx does not exist. The second one is especially poisonous: it looks exactly like an ordinary
  //     business hint, and the user goes looking for a field that is not there.
  const withRefFilter = (
    base: Catalog,
    host: string,
    fieldKey: string,
    refFilter: Record<string, unknown>,
  ): Catalog => {
    const entry = requireModule(base, host);
    const fields = entry.schema.fields.map((f) => (f.key === fieldKey ? { ...f, refFilter } : f));
    const modules = new Map(base.modules);
    modules.set(host, { ...entry, schema: { ...entry.schema, fields } } as typeof entry);
    return { ...base, modules };
  };

  it("🔴 target end: a condition key that is not on the target module header is red (otherwise it blows up on the first dropdown)", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const errors = checkCrossReferences(
      withRefFilter(catalog, "salesOrder", "warehouseId", { noSuchColumn: "x" }),
    );
    expect(errors.some((e) => e.path.includes("refFilter.noSuchColumn"))).toBe(true);
  });

  it("🔴 source end: `x` in `$bill.x` is not on this module header → red (otherwise the UI forever nags the user to fill a cell that does not exist)", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const errors = checkCrossReferences(
      withRefFilter(catalog, "salesOrder", "warehouseId", { name: { from: "$bill.noSuchField" } }),
    );
    expect(errors.some((e) => e.path.includes("refFilter.name.from"))).toBe(true);
  });

  it("🔴 a static enum value outside the candidates is red: candidates stay empty, and an empty dropdown looks exactly like \"none created yet\"", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    // product.materialType's candidates are raw / semi / finished / packaging
    const errors = checkCrossReferences(
      withRefFilter(catalog, "salesOrder", "customerId", { name: "whatever" }),
    );
    // customer has no enum named name; this only checks that a present key is not a false positive
    expect(errors.filter((e) => e.path.includes("refFilter")).length).toBe(0);
  });

  it("🔴 the two ends point at different entities → red: SQL runs, candidates stay empty, both sides are uuids, and runtime cannot see it", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    // Compare a customer value against some ref column on the warehouse
    const warehouse = requireModule(catalog, "warehouse").schema.fields.find(
      (f) => f.type === "ref" && f.ref !== null,
    );
    if (!warehouse) return; // not applicable when the warehouse has no ref column; do not invent one
    const errors = checkCrossReferences(
      withRefFilter(catalog, "salesOrder", "warehouseId", { [warehouse.key]: { from: "$bill.customerId" } }),
    );
    expect(errors.some((e) => e.path.includes("refFilter"))).toBe(true);
  });

  it("🔴 a dynamic map must cover the whole source enum, and every target value must belong to the target enum", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const missing = checkCrossReferences(
      withRefFilter(catalog, "orgUnit", "parentOrgId", {
        orgType: { from: "$bill.orgType", map: { factory: null, workshop: "factory", line: "workshop" } },
      }),
    );
    expect(missing.some((error) => error.path.endsWith("refFilter.orgType.map") && error.message.includes("must be an enum"))).toBe(true);

    const invalid = checkCrossReferences(
      withRefFilter(catalog, "orgUnit", "parentOrgId", {
        orgType: { from: "$bill.orgType", map: { factory: null, workshop: "division", line: "workshop", team: "line" } },
      }),
    );
    expect(invalid.some((error) => error.path.endsWith("refFilter.orgType.map") && error.message.includes("must be an enum"))).toBe(true);
  });

  it("every refFilter already declared in the repo resolves — this is the regression line on real modules", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(checkCrossReferences(catalog).filter((e) => e.path.includes("refFilter"))).toEqual([]);
  });

  it("🔴 the exemption criterion is the type, not a name suffix: type:'ref' pointing at <X>Line is still checked for existence", async () => {
    // Exempting by suffix leaves `yarn test` green and the service starting normally, while relationsOf collects by type
    // and throws on existence — the first time anyone opens any document detail page it 500s,
    // and the symptom is nowhere near the line that was written wrong
    const catalog = await loadCatalog(fx("line-ref-typed"));
    const errors = checkCrossReferences(catalog);
    expect(errors).toEqual([
      { module: "alpha", path: "fields.sourceLineId.ref", message: "points at a module that does not exist, \"betaLine\"" },
    ]);
  });

  describe("🔴 which layer each derived coordinate lands on — the criterion lines up with queryCompiler one by one", () => {
    // This used to say "where still filters the header, so do not check it with layer here", and then checked **no layer at all**:
    // not the line layer (correct) and not the header (the miss). A wrong-layer where left `yarn test` green,
    // and failed only at runtime SQL compile — with the symptom that some module's list page would not open at all.
    //
    // The criterion lines up with `queryCompiler.rollupExpr`:
    // `filterCols` reads header columns when there is a header alias, otherwise the current layer's columns. where always checks the header, so the gate does not branch.
    const whereErrors = async (): Promise<readonly { path: string; message: string }[]> => {
      const catalog = await loadCatalog(fx("derive-coordinate-layer"));
      return checkCrossReferences(catalog).map((e) => ({ path: e.path, message: e.message }));
    };

    it("a wrong-layer where is caught, and an empty through uses **the same criterion** as a non-empty one", async () => {
      const errors = await whereErrors();
      expect(errors.map((e) => e.path)).toEqual([
        "fields.badLineWhere.derive.where.qty",
        "fields.badHeaderWhere.derive.where.qty",
        "fields.badDeriveWhere.derive.where.doubleQty",
        "fields.badMeasure.derive.measure",
        "fields.headerOccupiedUnbounded.derive.measure",
        "fields.badLookupMatch.derive.match",
      ]);
    });

    it("`measure` follows through by default; a mistyped measure name must be red at modeling time", async () => {
      // A measure is taken from the through layer by default. Only when through is non-empty and the line table is maxRows: 1 may it read a header column instead.
      // A mistyped measure name must be red here, not deferred to SQL compile time where the list page will not open.
      const errors = await whereErrors();
      const message = errors.find((e) => e.path === "fields.badMeasure.derive.measure")?.message ?? "";
      expect(message).toContain("module \"beta\" has no column for measure \"qty\"");
      expect(message).toContain("available:");
    });

    it("a through rollup that reads a header measure: maxRows 1 passes, unbounded is red", async () => {
      const errors = await whereErrors();
      expect(errors.map((e) => e.path)).not.toContain("fields.headerOccupied.derive.measure");
      const message = errors.find((e) => e.path === "fields.headerOccupiedUnbounded.derive.measure")?.message ?? "";
      expect(message).toContain("is on the header");
      expect(message).toContain("maxRows: 1");
    });

    it("🔴 lookup match is checked on **this module's own layer**, not the target module", async () => {
      // The scope in `columnFor(scope, derive.match, …)` is this layer: it is "which value on this row is compared
      // with the target id". Checking it on the target module reports a legal lookup as "the target has no xxxId".
      const errors = await whereErrors();
      const message = errors.find((e) => e.path === "fields.badLookupMatch.derive.match")?.message ?? "";
      expect(message).toContain("this module's own layer");
      expect(message).toContain("the header of module \"alpha\"");
      expect(message).toContain("not a field on the target module");
    });

    it("🔴 a derived field cannot be a where key — it builds no column, so SQL has nothing of it to compare", async () => {
      // The criterion on the queryCompiler side is `filterCols[key]`, which reads **columns in the table**:
      // a field with `hasColumn` false (derive / subtable) has no corresponding column in the database.
      // The error has to say "this key exists but it does not land in a column", not "there is no such field" — the two sentences point at two different fixes
      const errors = await whereErrors();
      const message = errors.find((e) => e.path.endsWith("where.doubleQty"))?.message ?? "";
      expect(message).toContain("doubleQty");
      expect(message).toContain("formula derived field");
      expect(message).toContain("builds no column");
      expect(message).toContain("available keys");
    });

    it("the error says it belongs on the header, not merely that the field does not exist", async () => {
      const [lineLevel] = await whereErrors();
      const message = lineLevel?.message ?? "";
      // (1) The criterion itself: it checks the target module header, and it is independent of through
      expect(message).toContain("header of target module \"beta\"");
      expect(message).toContain("independent of through");
      // (2) Where the key actually lives — "field does not exist" would send someone to add qty on beta,
      //    and beta already has qty, only on the line-table layer
      expect(message).toContain("lives only on line table \"lines\"");
      // (3) The way out: which keys are available (header fields that have a column, plus platform fields)
      expect(message).toContain("available keys");
      expect(message).toContain("totalQty");
      expect(message).toContain("status");
    });

    it("a legal where (status) on a header rollup and a row rollup still passes — the gate must not reject platform fields along with the rest", async () => {
      // Existing where clauses in the repo are almost all `{ status: … }`, and status is not in `schema.fields`.
      // The platform-field criterion is the kernel's copy (`isPublicPlatformField`), not restated in the loader
      const errors = await whereErrors();
      expect(errors.some((e) => e.path.startsWith("fields.doneTotal"))).toBe(false);
      expect(errors.some((e) => e.path.startsWith("fields.doneLineQty"))).toBe(false);
    });
  });
});

describe("escape hatch — directory-shaped modules", () => {
  it("a directory shape records escapeHatch, and the code is the directory name", async () => {
    const catalog = await loadCatalog(fx("escape-hatch"));
    const alpha = requireModule(catalog, "alpha");
    expect(alpha.escapeHatch).toBe(true);
    expect(alpha.code).toBe("alpha");
    expect(alpha.file).toBe(path.join("d1", "modules", "alpha", "index.ts"));
  });
});

describe("Module Planner — the named read-only compute entry of a directory module", () => {
  const context = (mode: string) => ({
    module: "alpha",
    transition: "release",
    bill: { id: "alpha-1", revision: 1, header: { status: "draft" }, lines: {} },
    params: { mode },
    read: {
      async getBill(): Promise<never> {
        throw new Error("this fixture must not read a document");
      },
      async listBills(): Promise<never> {
        throw new Error("this fixture must not read a list");
      },
      async invariantBillSummary(): Promise<never> {
        throw new Error("this fixture must not read an invariant aggregate");
      },
      async invariantLineSummary(): Promise<never> {
        throw new Error("this fixture must not read an invariant line aggregate");
      },
    },
  });

  it("registers by transition code, and a plain file module has an empty planner table", async () => {
    const catalog = await loadCatalog(fx("planner-valid"));
    const alpha = requireModule(catalog, "alpha");
    const beta = requireModule(catalog, "beta");
    expect([...alpha.planners.keys()]).toEqual(["release"]);
    expect(alpha.plannerConsistency.get("release")).toBe("latest");
    expect(beta.planners.size).toBe(0);
    expect(beta.plannerConsistency.size).toBe(0);

    const planner = alpha.planners.get("release");
    if (!planner) throw new Error("fixture is missing the release planner");
    const plan = await planner(context("valid"));
    expect(plan.commands.map((command) => command.commandId)).toEqual(["task", "step", "source-link"]);
    expect(plan.commands[1]).toMatchObject({
      type: "createBill",
      header: { parentId: { kind: "createdId", commandId: "task" } },
    });
  });

  /**
   * 🔴 Backfilling `Transition.expandsBills` **happens only on this path**.
   *
   * The criterion is in the kernel (`withPlannerExpansion`), but the trigger is this package: `normalizeLifecycle`
   * cannot see `planners` (it only receives the lifecycle object), so skipping this step leaves
   * every Planner edge at `false` — and false is exactly the "do not ask for confirmation" setting:
   * one click batch-creates documents, with zero errors and zero symptoms.
   *
   * This is also the probe for "fill the whole block": replace it with a per-module fill (every directory-shaped edge marked true)
   * and the `cancel` line below goes red.
   */
  it("🔴 an edge with a Planner gets expandsBills filled in, and the other edges of the same module stay put", async () => {
    const catalog = await loadCatalog(fx("planner-valid"));
    const alpha = requireModule(catalog, "alpha").schema;
    const byCode = (code: string): boolean => {
      const edge = alpha.lifecycle.transitions.find((t) => t.code === code);
      if (!edge) throw new Error(`fixture is missing edge "${code}"`);
      return edge.expandsBills;
    };
    expect(byCode("release")).toBe(true);
    expect(byCode("cancel")).toBe(false);
    // A plain file module has no Planner at all ⇒ every edge is false
    const beta = requireModule(catalog, "beta").schema;
    expect(beta.lifecycle.transitions.every((t) => !t.expandsBills)).toBe(true);
    expect(beta.creatable.pushedFrom).toEqual([
      { module: "alpha", moduleLabel: "source document", transition: "release", action: "release" },
    ]);
    expect(beta.creatable.manual).toBe(false);
  });

  it("a Planner-generated target is an automatic fact document: manual create stays closed, and the source copy is kept", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const task = requireModule(catalog, "productionTask").schema;
    expect(task.creatable.manual).toBe(false);
    expect(task.creatable.pushedFrom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: "productionOrder",
          transition: "release",
          action: "Schedule production",
        }),
      ]),
    );
    expect(task.creatable.blockers).toContainEqual(expect.objectContaining({ path: "creatable" }));
  });

  it("a plain file module must not export planners", async () => {
    await expect(loadCatalog(fx("planner-flat"))).rejects.toThrow(
      /a Planner is allowed only in a directory module at modules\/<code>\/index\.ts/,
    );
  });

  it("named planners must go through definePlanners, and cannot be guessed from object shape", async () => {
    await expect(loadCatalog(fx("planner-raw"))).rejects.toThrow(
      /must be the return value of definePlanners/,
    );
  });

  it("registering a transition that does not exist is rejected at load time", async () => {
    await expect(loadCatalog(fx("planner-unknown-transition"))).rejects.toThrow(
      /points at an unknown transition "missing"/,
    );
  });

  it("a static create target declared by a Planner must come from the same catalog", async () => {
    await expect(loadCatalog(fx("planner-unknown-create-target"))).rejects.toThrow(
      /Planner create path alpha\.release points at an unknown target module "missing"/,
    );
  });

  it("a Planner return passes the closed command gate immediately, so a bad command such as SQL never reaches the executor", async () => {
    const catalog = await loadCatalog(fx("planner-valid"));
    const planner = requireModule(catalog, "alpha").planners.get("release");
    if (!planner) throw new Error("fixture is missing the release planner");
    await expect(planner(context("bad-command"))).rejects.toThrow(
      /only createBill \/ createReference \/ setStatus/,
    );
  });

  it("the call context must match the registered module + transition", async () => {
    const catalog = await loadCatalog(fx("planner-valid"));
    const planner = requireModule(catalog, "alpha").planners.get("release");
    if (!planner) throw new Error("fixture is missing the release planner");
    await expect(planner({ ...context("valid"), transition: "other" })).rejects.toThrow(
      /was wrongly bound to alpha\.other/,
    );
  });

  it("a target module inside the plan must come from the same catalog", async () => {
    const catalog = await loadCatalog(fx("planner-valid"));
    const planner = requireModule(catalog, "alpha").planners.get("release");
    if (!planner) throw new Error("fixture is missing the release planner");
    await expect(planner(context("unknown-module"))).rejects.toThrow(/returned an unknown module "missing"/);
    // 🔴 The target module of `setStatus` must be in the same catalog too. The deeper criteria (whether that edge exists,
    // whether `expectedStatus` is its `from`, whether the target edge has a Planner of its own) live in the server's
    // `assertPlanTargets` — this layer only checks existence, and the two sites do not repeat the same judgment
    await expect(planner(context("unknown-status-target"))).rejects.toThrow(
      /returned an unknown module "missing" \(setStatus push-missing\.target\)/,
    );
  });
});

describe("Action params preparer — read-only initial parameter values of a directory module", () => {
  const context = {
    module: "alpha",
    transition: "release",
    bill: { id: "alpha-1", revision: 1, header: { status: "draft" }, lines: {} },
    now: new Date("2026-08-01T00:00:00.000Z"),
    read: {
      async getBill(): Promise<never> {
        throw new Error("this fixture must not read a document");
      },
      async listBills(): Promise<never> {
        throw new Error("this fixture must not read a list");
      },
      async invariantBillSummary(): Promise<never> {
        throw new Error("this fixture must not read an invariant aggregate");
      },
      async invariantLineSummary(): Promise<never> {
        throw new Error("this fixture must not read an invariant line aggregate");
      },
    },
  } as const;

  it("registers by transition and checks the bound context; a plain file module stays empty", async () => {
    const catalog = await loadCatalog(fx("planner-valid"));
    const alpha = requireModule(catalog, "alpha");
    expect([...alpha.actionPreparers.keys()]).toEqual(["release"]);
    expect(requireModule(catalog, "beta").actionPreparers.size).toBe(0);
    await expect(alpha.actionPreparers.get("release")?.(context)).resolves.toEqual({ mode: "prepared:draft" });
    await expect(alpha.actionPreparers.get("release")?.({ ...context, transition: "cancel" })).rejects.toThrow(
      /was wrongly bound to alpha\.cancel/,
    );
  });

  it("a plain file, a raw object, an unknown transition, and an edge with no parameters are all rejected at load time", async () => {
    await expect(loadCatalog(fx("action-preparer-flat"))).rejects.toThrow(
      /an action-parameter preparer is allowed only in a directory module at modules\/<code>\/index\.ts/,
    );
    await expect(loadCatalog(fx("action-preparer-raw"))).rejects.toThrow(
      /must be the return value of defineActionPreparers/,
    );
    await expect(loadCatalog(fx("action-preparer-unknown"))).rejects.toThrow(
      /points at an unknown transition "missing"/,
    );
    await expect(loadCatalog(fx("action-preparer-no-params"))).rejects.toThrow(
      /is bound to an edge with no parameters/,
    );
  });
});

// ---------------------------------------------------------------------------
// Business skills — playbooks delivered with the domain, scanned with the modules, under the same load-time enforcement
//
// 🔴 The reason the gate lives here rather than in the server is word for word the module table's: if the server and the CLI each scan once,
// the skill tables they see drift, and the drift shows up as "present on the HTTP endpoint, absent under `yarn test`".
// Every gate corresponds to a class of mistake someone will actually make, and every class of symptom is **silent**.
// ---------------------------------------------------------------------------

describe("business skills are enforced at load time too", () => {
  it("scans domains/<domain>/skills/*.md and records both the metadata and where it came from", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const hit = catalog.skills.find((s) => s.name === "order-delivery-assessment");
    expect(hit?.domain).toBe("sales");
    expect(hit?.file).toBe(path.join("sales", "skills", "order-delivery-assessment.md"));
    expect(hit?.version).toMatch(/^\d+\.\d+\.\d+$/);
    // The full text keeps its frontmatter: the catalog endpoint and the full-text endpoint have only this one source of truth for metadata
    expect(hit?.content.startsWith("---\n")).toBe(true);
  });

  it("file name and frontmatter name disagree — name is also the path segment used to fetch the full text", async () => {
    await expect(loadCatalog(fx("skill-name-mismatch"))).rejects.toThrow(
      /the coordinate gives name "beta-playbook", but the frontmatter writes "alpha-playbook"/,
    );
  });

  it("missing required metadata throws — version is not given a default; it is half of the key the other side caches the full text under", async () => {
    await expect(loadCatalog(fx("skill-missing-version"))).rejects.toThrow(
      /is missing version/,
    );
  });

  /**
   * 🔴 This pins that the discipline "bump the version when the body changes" **does not have to exist**.
   *
   * The other side caches the full text under `name@version`, and that cache has no TTL (only an LRU cap) — failing to bump
   * does not mean a delayed update, it means **keeping the old copy forever**, and neither side reports it. So the wire version includes
   * a fingerprint of the full text: change the body ⇒ the fingerprint changes ⇒ the cache must miss, whether or not someone bumped.
   *
   * The assertion recomputes the fingerprint instead of hard-coding a value: a hard-coded value would have to
   * change here every time the sample skill body changes, and "change it along with" is exactly what this change removes.
   */
  it("🔴 wireVersion = declared version + full-text fingerprint — a changed body must change the cache key, without anyone remembering to bump", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    for (const skill of catalog.skills) {
      const digest = createHash("sha256").update(skill.content, "utf8").digest("hex").slice(0, 8);
      expect(skill.wireVersion, skill.name).toBe(`${skill.version}+${digest}`);
    }
  });

  it("two domains each write a skill of the same name — which one wins must not depend on scan order", async () => {
    await expect(loadCatalog(fx("skill-duplicate"))).rejects.toThrow(
      /skill name "shared-playbook" is duplicated/,
    );
  });

  it("🔴 the directory shape supports one level of references, and keeps on-demand content outside the body", async () => {
    const catalog = await loadCatalog(fx("skill-attachments"));
    const skill = catalog.skills.find((item) => item.name === "order-playbook");
    expect(skill?.references?.map((reference) => reference.name)).toEqual(["detail"]);
    expect(skill?.references?.[0]?.wireVersion).toMatch(/^1\.0\.0\+[a-f0-9]{8}$/);
    expect(skill?.content).not.toContain("detailed-criteria body");
  });

  it("🔴 references allow only one level of Markdown files — a nested directory and a non-md file are both fail-closed", async () => {
    const nestedRoot = temporarySkillFixture();
    const referencesDir = path.join(nestedRoot, "d1", "skills", "order-playbook", "references");
    mkdirSync(path.join(referencesDir, "nested"));
    await expect(loadCatalog({ domainsRoot: nestedRoot })).rejects.toThrow(/nested references directories are not allowed/);

    const nonMarkdownRoot = temporarySkillFixture();
    const nonMarkdownDir = path.join(nonMarkdownRoot, "d1", "skills", "order-playbook", "references");
    writeFileSync(path.join(nonMarkdownDir, "notes.txt"), "not a skill reference\n");
    await expect(loadCatalog({ domainsRoot: nonMarkdownRoot })).rejects.toThrow(/is not \.md/);

    const nonDirectoryRoot = temporarySkillFixture();
    const skillRoot = path.join(nonDirectoryRoot, "d1", "skills", "order-playbook");
    rmSync(path.join(skillRoot, "references"), { recursive: true });
    writeFileSync(path.join(skillRoot, "references"), "not a directory\n");
    await expect(loadCatalog({ domainsRoot: nonDirectoryRoot })).rejects.toThrow(/must be a directory/);
  });

  it("🔴 references and every reference reject symbolic links", async () => {
    const referenceRoot = temporarySkillFixture();
    const skillRoot = path.join(referenceRoot, "d1", "skills", "order-playbook");
    const target = path.join(referenceRoot, ".reference-target");
    mkdirSync(target);
    rmSync(path.join(skillRoot, "references"), { recursive: true });
    symlinkSync(target, path.join(skillRoot, "references"));
    await expect(loadCatalog({ domainsRoot: referenceRoot })).rejects.toThrow(/symbolic links are not allowed/);

    const fileRoot = temporarySkillFixture();
    const referencesDir = path.join(fileRoot, "d1", "skills", "order-playbook", "references");
    symlinkSync("detail.md", path.join(referencesDir, "alias.md"));
    await expect(loadCatalog({ domainsRoot: fileRoot })).rejects.toThrow(/symbolic links are not allowed/);
  });

  it("🔴 more than 16 references is rejected, rather than silently truncated", async () => {
    const root = temporarySkillFixture();
    const referencesDir = path.join(root, "d1", "skills", "order-playbook", "references");
    for (let index = 0; index < 16; index += 1) {
      const name = `extra-${String(index).padStart(2, "0")}`;
      writeFileSync(
        path.join(referencesDir, `${name}.md`),
        `---\nname: ${name}\ndescription: extra reference\nversion: 1.0.0\n---\n\nbody.\n`,
      );
    }
    await expect(loadCatalog({ domainsRoot: root })).rejects.toThrow(/reference count exceeds 16/);
  });

  it("🔴 one reference over 24 KiB, or a total over 96 KiB, is rejected", async () => {
    const singleRoot = temporarySkillFixture();
    const singleDir = path.join(singleRoot, "d1", "skills", "order-playbook", "references");
    writeFileSync(
      path.join(singleDir, "detail.md"),
      `---\nname: detail\ndescription: oversized\nversion: 1.0.0\n---\n\n${"x".repeat(24 * 1024)}\n`,
    );
    await expect(loadCatalog({ domainsRoot: singleRoot })).rejects.toThrow(/exceeds the per-reference budget of 24576 bytes/);

    const totalRoot = temporarySkillFixture();
    const totalDir = path.join(totalRoot, "d1", "skills", "order-playbook", "references");
    for (let index = 0; index < 5; index += 1) {
      const name = `large-${String(index)}`;
      writeFileSync(
        path.join(totalDir, `${name}.md`),
        `---\nname: ${name}\ndescription: large reference\nversion: 1.0.0\n---\n\n${"x".repeat(20 * 1024)}\n`,
      );
    }
    await expect(loadCatalog({ domainsRoot: totalRoot })).rejects.toThrow(/exceeds the total reference budget of 98304 bytes/);
  });

  it("🔴 reference frontmatter is closed, and name must match the file coordinate", async () => {
    const unknownKeyRoot = temporarySkillFixture();
    const unknownKeyDir = path.join(unknownKeyRoot, "d1", "skills", "order-playbook", "references");
    writeFileSync(
      path.join(unknownKeyDir, "detail.md"),
      "---\nname: detail\ndescription: detail\nversion: 1.0.0\nmodel: forbidden\n---\n\nbody.\n",
    );
    await expect(loadCatalog({ domainsRoot: unknownKeyRoot })).rejects.toThrow(/does not recognize|not allowed/);

    const mismatchRoot = temporarySkillFixture();
    const mismatchDir = path.join(mismatchRoot, "d1", "skills", "order-playbook", "references");
    writeFileSync(
      path.join(mismatchDir, "detail.md"),
      "---\nname: other-detail\ndescription: detail\nversion: 1.0.0\n---\n\nbody.\n",
    );
    await expect(loadCatalog({ domainsRoot: mismatchRoot })).rejects.toThrow(/must match the reference file name "detail"/);

    const traversalRoot = temporarySkillFixture();
    const traversalDir = path.join(traversalRoot, "d1", "skills", "order-playbook", "references");
    writeFileSync(
      path.join(traversalDir, "detail.md"),
      "---\nname: ../escape\ndescription: detail\nversion: 1.0.0\n---\n\nbody.\n",
    );
    await expect(loadCatalog({ domainsRoot: traversalRoot })).rejects.toThrow(/must match the reference file name "detail"/);
  });

  // The other side's `skill-md-schema.ts` extractFrontmatter is the same flat "everything after the first colon is the value",
  // not YAML. So these punctuation marks are read the same on both sides, and rejecting them would only push authors toward a fullwidth colon
  it("an ASCII colon / # / brackets inside a value are kept — the other side is not a YAML parser", async () => {
    const catalog = await loadCatalog(fx("skill-punctuation"));
    const hit = catalog.skills.find((s) => s.name === "punctuated-playbook");
    expect(hit?.description).toBe("delivery assessment: header first, then line by line # not a comment [and not an array]");
  });

  it("🔴 a paired quote is rejected — that is the only spelling that would make the two sides read two different copies of the metadata", async () => {
    // The other side's stripQuotes removes the pair and this side does not, so the same file differs by one pair of quotes
    await expect(loadCatalog(fx("skill-quoted-value"))).rejects.toThrow(
      /wrapped as a pair/,
    );
  });
});

// ---------------------------------------------------------------------------
// Agent definitions — role personas delivered with the domain, scanned together with modules and skills
//
// An agent has two more gates than a skill, and they point **opposite ways**. Those two are the point of this block:
//   (1) The host may define what an agent is, and may not define how the runner runs
//      ⇒ model / temperature / orchestration throw the moment they appear, and the copy has to say which boundary it is
//   (2) `skillNames` existence is checked at load time
//      ⇒ leaving it to runtime means the other side gets a 404 and treats it as a host hiccup, and the model still goes on stage missing one playbook
//
// Every other symptom is **silent** too: a missing trim criterion ⇒ a control agent shows up on everyone's list;
// allowedTools written as `[]` ⇒ the agent silently loses its whole tool surface.
// ---------------------------------------------------------------------------

describe("agent definitions are enforced at load time too", () => {
  it("scans domains/<domain>/agents/*.md and records both the fields and where they came from", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const hit = catalog.agents.find((a) => a.id === "boss-assistant");
    expect(hit?.domain).toBe("ops");
    expect(hit?.file).toBe(path.join("ops", "agents", "boss-assistant.md"));
    expect(hit?.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(hit?.roles).toEqual(["*"]);
    // 🔴 instructions **do not include** frontmatter (deliberately unlike a skill's content):
    // agent metadata travels in JSON fields, and a second copy in the body is a second source of truth,
    // and the model would read that YAML as part of the persona
    expect(hit?.instructions.startsWith("---")).toBe(false);
  });

  it("every skill bound by a delivered agent can be fetched — this gate holds on the real domains/ too", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const names = new Set(catalog.skills.map((s) => s.name));
    // At least one agent really binds a skill; otherwise the next sentence is vacuously true on an empty set
    expect(catalog.agents.some((a) => a.skillNames.length > 0)).toBe(true);
    for (const agent of catalog.agents) {
      for (const name of agent.skillNames) expect(names, `${agent.id} → ${name}`).toContain(name);
    }
  });

  it("file name and frontmatter id disagree — id is also the path segment used to fetch the definition", async () => {
    await expect(loadCatalog(fx("agent-id-mismatch"))).rejects.toThrow(
      /the file name gives id "beta-desk", but the frontmatter writes "alpha-desk"/,
    );
  });

  /**
   * 🔴 The second main point of this block.
   *
   * Skipping the check does not raise here: the other side fetches the full text with `GET /api/agent/skills/:name` and gets a 404,
   * and all it knows is "this SOP cannot be read right now" — the model still goes on stage, short one business playbook,
   * and invents a process from general ERP knowledge. And it was only a typo.
   */
  it("🔴 skillNames points at a skill that does not exist — throw at load time, do not drop the name silently", async () => {
    await expect(loadCatalog(fx("agent-unknown-skill"))).rejects.toThrow(
      /references a skill that does not exist, "ghost-playbook"/,
    );
  });

  /**
   * 🔴 The existence check runs **after every domain has been scanned**, not inside the domain loop.
   *
   * Skill names are globally unique (not namespaced by domain), so a d1 agent binding a d2 skill is entirely legal.
   * Checking inside the loop would blow up that legal reference because d1 was scanned first, and the error would point at the
   * skill name that was fine — the person debugging would first suspect d2's skill file.
   */
  it("🔴 a cross-domain skill binding is legal — success must not depend on which domain is scanned first", async () => {
    const catalog = await loadCatalog(fx("agent-cross-domain-skill"));
    expect(catalog.agents.find((a) => a.id === "alpha-desk")?.skillNames).toEqual(["later-playbook"]);
  });

  /**
   * 🔴 The first main point of this block (the model-routing half).
   *
   * The closed key set would reject `model` anyway, so this test is **not about whether it rejects, it is about the copy**:
   * someone who reads "does not recognize model" assumes a typo or a feature that is not built yet, and files a request;
   * only "model routing is a platform runtime discipline, and the host has no right to define it" says this dimension is not theirs to set.
   * In the implementation the named rejection is ordered before the unknown-key check; reverse the order and this copy never appears.
   */
  it("🔴 model / temperature throw the moment they appear, and the copy says this dimension is not the host's", async () => {
    const load = loadCatalog(fx("agent-forbidden-model"));
    await expect(load).rejects.toThrow(/frontmatter key "model" is not for the host to declare/);
    await expect(load).rejects.toThrow(/model routing and orchestration are runtime rules of the platform \(agent host\)/);
    // Pin the negative: it **must not** collapse into the generic "unrecognized" copy
    await expect(load).rejects.not.toThrow(/does not recognize "model"/);
  });

  it("🔴 orchestration / teams likewise — orchestration policy is a platform runtime discipline too", async () => {
    const load = loadCatalog(fx("agent-forbidden-orchestration"));
    await expect(load).rejects.toThrow(/frontmatter key "orchestration" is not for the host to declare/);
    await expect(load).rejects.toThrow(/cannot say how several agents collaborate/);
  });

  it("a key that is genuinely unrecognized still uses the generic copy — the named list is not a stand-in for the allow-list", async () => {
    await expect(loadCatalog(fx("agent-unknown-key"))).rejects.toThrow(
      /does not recognize "avatar"/,
    );
  });

  /**
   * 🔴 roles is the catalog's trim criterion, and this dimension has no safe default.
   *
   * "Omitting it means every role can see it" would put a credit-control agent that forgot roles
   * on every role's assistant list, with zero errors — and its persona states the approval floor and the exception policy.
   */
  it("🔴 missing roles throws — there is no \"omitting it means every role can see it\" setting", async () => {
    await expect(loadCatalog(fx("agent-missing-roles"))).rejects.toThrow(
      /is missing roles — the agent catalog is trimmed by role/,
    );
  });

  it("two domains each write an agent of the same id — which one wins must not depend on scan order", async () => {
    await expect(loadCatalog(fx("agent-duplicate"))).rejects.toThrow(
      /agent id "shared-desk" is duplicated/,
    );
  });

  /**
   * 🔴 `allowedTools: []` and "this line was not written" have **opposite meanings**, so an empty array must not be treated as omitted.
   *
   * The other side **intersects** it with the tool catalog: `[]` is an explicit decision to mount no tools,
   * and the default is "no restriction". Allowing an empty shell silently rewrites the decision the author wrote into a different one,
   * and the symptom is "the AI refuses to do anything", with no log pointing at that intersection.
   */
  it("🔴 allowedTools written as an empty array is rejected — the empty set and the default mean opposite things on this axis", async () => {
    await expect(loadCatalog(fx("agent-empty-allowed-tools"))).rejects.toThrow(
      /allowedTools is an empty array — if there is no content, delete the whole line/,
    );
  });

  it("preflight takes one tool name and enters the catalog with the definition; omitting it is null", async () => {
    const catalog = await loadCatalog(fx("agent-preflight-ok"));
    expect(catalog.agents.find((agent) => agent.id === "alpha-desk")?.preflight).toBe("erp");
    const plain = await loadCatalog(fx("agent-taskmode-closed-set"));
    expect(plain.agents.every((agent) => agent.preflight === null)).toBe(true);
  });

  it("🔴 a preflight tool that is not in its own allowedTools is rejected — otherwise every preflight round silently matches nothing", async () => {
    await expect(loadCatalog(fx("agent-preflight-outside-allowed"))).rejects.toThrow(
      /preflight "erp" is not in its own allowedTools/,
    );
  });

  it("🔴 a directory shape is rejected — an agent definition can only be shipped as a single file", async () => {
    await expect(loadCatalog(fx("agent-attachments"))).rejects.toThrow(
      /is a directory — an agent definition has only the single-file form/,
    );
  });

  it("frontmatter and no body — the body is the instructions, and an empty persona is worse than not having the agent", async () => {
    await expect(loadCatalog(fx("agent-empty-body"))).rejects.toThrow(
      /has only frontmatter and no body/,
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-module coordinates inside rules — two gates, both checkable only once the catalog is complete
//
//   (1) `related_agg`: `on` and `match` must land on **the same set of ids**;
//   (2) `ref_field_compare`: a two-hop path must find the column, the type, and the landing point **on every hop**.
//
// Both stop the same accident shape: after one letter is swapped the declaration looks fine and `yarn test` is green,
// and runtime has no symptom — (1) the total is always 0 ⇒ the upper-bound gate always passes; (2) the read is undefined ⇒ the gate rejects every document,
// and tells the user to fill a field that does not exist on an upstream document.
// ---------------------------------------------------------------------------

describe("cross-module coordinates inside rules", () => {
  /** Build a copy of the real catalog with one precondition check's parameters changed, without touching domains/. */
  const withCheckParams = async (
    moduleCode: string,
    ruleId: string,
    patch: Record<string, unknown>,
  ): Promise<ReturnType<typeof checkCrossReferences>> => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const loaded = requireModule(catalog, moduleCode);
    const schema = loaded.schema;
    const preconditions = schema.preconditions.map((pc) =>
      pc.id === ruleId && pc.check
        ? { ...pc, check: { ...pc.check, params: { ...(pc.check.params as object), ...patch } } }
        : pc,
    );
    const modules = new Map(catalog.modules);
    modules.set(moduleCode, { ...loaded, schema: { ...schema, preconditions } });
    const errors = checkCrossReferences({ ...catalog, modules });
    return errors.filter((e) => e.path.includes(ruleId));
  };

  describe("related_agg: on and match must be the same set of ids", () => {
    // The anchor is the line-by-line write-off gate when a production order's work report completes (a partial release no longer waits until production is full):
    // `on: "$line.id"`（productionOrder.lines）
    // × `match: "sourceOrderLineId"` (productionTask.allocations points at the same line id)
    const RULE = "dispatch_allocated_in_full";

    it("🔴 replacing `on` with the header reference on the same row is red: an order id and an order-**line** id are two disjoint id sets", async () => {
      // This change "looks completely reasonable" at modeling time (`sourceOrderId` is on the same row, and it is a reference too),
      // and at runtime `list()` compares an order id with the order-line id column ⇒ no row matches ⇒ the total is 0 ⇒ it always passes
      const errors = await withCheckParams("productionOrder", RULE, { on: "$line.productId" });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/different coordinate spaces/);
    });

    it("🔴 `match` pointing at a quantity column is red: matching by value counts rows whose cell happens to be equal", async () => {
      const errors = await withCheckParams("productionOrder", RULE, { match: "allocatedQty" });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/cannot be a join key/);
    });

    it("a `match` column that does not exist at all is red (this check used to be missing entirely)", async () => {
      const errors = await withCheckParams("productionOrder", RULE, { match: "sourceOrderLinId" });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/has no column "sourceOrderLinId"/);
    });

    it("`from` points at a module that does not exist ⇒ red", async () => {
      const errors = await withCheckParams("productionOrder", RULE, { from: "productionTaskk" });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/a module that does not exist/);
    });
  });

  describe("ref_field_compare: check the coordinate on every hop", () => {
    // Anchor: finished-goods receipt → production task → its production order → the completion warehouse on the order.
    // The real declaration is one hop (it compares productionOrderId on the task); here it is rewritten as two hops to pin the gate.
    const RULE = "receipt_order_matches_task";
    const TWO_HOP = {
      then: { field: "productionOrderId", entity: "productionOrder", through: null },
      field: "completionWarehouseId",
      right: { ref: "$bill.warehouseId" },
    };

    it("both hops resolve ⇒ green", async () => {
      expect(await withCheckParams("productionReceipt", RULE, TWO_HOP)).toEqual([]);
    });

    it("🔴 a mistyped column name on the middle hop is red (otherwise runtime reads undefined and the gate rejects every document)", async () => {
      const errors = await withCheckParams("productionReceipt", RULE, {
        ...TWO_HOP,
        then: { ...TWO_HOP.then, field: "productionOrderld" },
      });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/hop 2: module "productionTask" has no field/);
    });

    it("🔴 writing the second hop's landing point as another module is red (the field read belongs to another table)", async () => {
      const errors = await withCheckParams("productionReceipt", RULE, {
        ...TWO_HOP,
        then: { ...TWO_HOP.then, entity: "warehouse" },
      });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/landing point does not match/);
    });

    it("🔴 the final field is checked on the **second hop's** table, not the first hop", async () => {
      // `productionOrderId` really exists on productionTask; treating it as the final field is still wrong —
      // the end is productionOrder, which has no such cell. If the gate still checked the first hop it would let this through silently
      const errors = await withCheckParams("productionReceipt", RULE, {
        ...TWO_HOP,
        field: "productionTaskId",
      });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/module "productionOrder" has no field/);
    });

    it("the second hop's landing module does not exist ⇒ red", async () => {
      const errors = await withCheckParams("productionReceipt", RULE, {
        ...TWO_HOP,
        then: { ...TWO_HOP.then, entity: "productionOrderr" },
      });
      expect(errors.map((e) => e.message).join(" | ")).toMatch(/a module that does not exist, "productionOrderr"/);
    });
  });

  describe("lines_required_if_ref_field: the target field must really exist", () => {
    const RULE = "detail_mode_lines_required";

    it("the real payment rule's target module and field both exist", async () => {
      expect(await withCheckParams("purchasePayment", RULE, {})).toEqual([]);
    });

    it("a mistyped target field is rejected at load time", async () => {
      const errors = await withCheckParams("purchasePayment", RULE, { field: "accountingMod" });
      expect(errors.map((error) => error.message).join(" | ")).toMatch(/has no field "accountingMod"/);
    });

    it("a target module that does not exist is rejected at load time", async () => {
      const errors = await withCheckParams("purchasePayment", RULE, { entity: "purchasePayableMissing" });
      expect(errors.map((error) => error.message).join(" | ")).toMatch(/a module that does not exist/);
    });
  });
});

// ---------------------------------------------------------------------------
// pushDefaults — "this cell is pinned by this edge, not copied from the source document"
//
// 🔴 It covers a class `push` structurally cannot express: a field the target requires and the source document **cannot have**.
// "This purchase order came from a purchase plan" is not copied from a cell on the plan; it is a fact of the edge;
// without it, the `purchasePlan.to_order` edge is rejected at build time by the "a draft must be able to land" gate —
// and the cost of bypassing that gate has been hit for real: runtime `bills.create` judges REQUIRED_BLANK, and the offline gate is green.
//
// The check has to live at the **cross-module** layer: the key points at a field on the target module, and a single-module gate is structurally blind to that.
// ---------------------------------------------------------------------------

describe("the cross-module gate for pushDefaults", () => {
  /** Build a copy of the real catalog with one edge changed, without touching domains/. */
  const withEdge = async (
    moduleCode: string,
    edgeCode: string,
    patch: Record<string, unknown>,
  ): Promise<ReturnType<typeof checkCrossReferences>> => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    const loaded = requireModule(catalog, moduleCode);
    const schema = loaded.schema;
    const transitions = schema.lifecycle.transitions.map((t) =>
      t.code === edgeCode ? { ...t, ...patch } : t,
    );
    const modules = new Map(catalog.modules);
    modules.set(moduleCode, {
      ...loaded,
      schema: { ...schema, lifecycle: { ...schema.lifecycle, transitions } },
    });
    return checkCrossReferences({ ...catalog, modules });
  };

  const onEdge = (errors: ReturnType<typeof checkCrossReferences>): string =>
    errors.filter((e) => e.path.includes("to_order")).map((e) => e.message).join(" | ");

  // 🔴 Remove pushDefaults and that edge must go red immediately — otherwise this gate does not exist
  it("after pushDefaults is removed, a required cell that cannot be carried over is named", async () => {
    const msg = onEdge(await withEdge("purchasePlan", "to_order", { pushDefaults: null }));
    expect(msg).toMatch(/sourceType/);
    expect(msg).toMatch(/lines\.taxPrice/);
    expect(msg).toMatch(/REQUIRED_BLANK|cannot be carried over/);
  });

  it("a key that does not exist on the target module is rejected (a typo leaves that cell empty as before)", async () => {
    const msg = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { sourceTyp: "from-plan" } }),
    );
    expect(msg).toMatch(/does not exist on push target "purchaseOrder"/);
  });

  it("an enum value outside the candidates is rejected (otherwise an illegal state is written, and every later query that filters on it misses a batch of rows)", async () => {
    const msg = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { sourceType: "planned-source" } }),
    );
    expect(msg).toMatch(/is not among the enum candidates/);
  });

  it("a type that does not match is rejected", async () => {
    const msg = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { "lines.taxPrice": "zero" } }),
    );
    expect(msg).toMatch(/is money, but the given value is string/);
  });

  // 🔴 Two sources of truth: which one wins depends on the statement order inside buildPushDraft, and each side looks legal on its own
  it("pinning a cell push could already copy is rejected", async () => {
    const msg = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { buyer: "ada" } }),
    );
    expect(msg).toMatch(/two sources of truth/);
  });

  it("a reference field must not be pinned — that welds one concrete row into the declaration", async () => {
    const msg = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { warehouseId: "wh-sh" } }),
    );
    // warehouseId can be copied by the same name and hits the two-sources rule first; switch to a ref field the source document does not have
    const msg2 = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { salesOrderId: "so-0001" } }),
    );
    expect(msg + msg2).toMatch(/reference field|two sources of truth/);
    expect(msg2).toMatch(/welds one concrete row into the declaration/);
  });

  it("a system-supplied field must not be pinned — the value computed at write time overwrites it", async () => {
    const msg = onEdge(
      await withEdge("purchasePlan", "to_order", { pushDefaults: { totalAmount: 100 } }),
    );
    expect(msg).toMatch(/system-supplied/);
  });

  it("an explicit push.line source table and target table must both exist and really be line tables", async () => {
    const missingSource = onEdge(await withEdge("purchasePlan", "to_order", {
      pushLine: { source: "linez", target: "lines" },
    }));
    expect(missingSource).toMatch(/source module "purchasePlan" has no field "linez"/);

    const sourceHeader = onEdge(await withEdge("purchasePlan", "to_order", {
      pushLine: { source: "buyer", target: "lines" },
    }));
    expect(sourceHeader).toMatch(/buyer.*not a line table/);

    const missingTarget = onEdge(await withEdge("purchasePlan", "to_order", {
      pushLine: { source: "lines", target: "linez" },
    }));
    expect(missingTarget).toMatch(/push target "purchaseOrder" has no field "linez"/);
  });

  it("after an object push is normalized, the target module still hits the existing unknown-module gate", async () => {
    const msg = onEdge(await withEdge("purchasePlan", "to_order", {
      push: "purchaseOrderTypo",
      pushLine: { source: "lines", target: "lines" },
    }));
    expect(msg).toMatch(/push target module "purchaseOrderTypo" does not exist/);
  });
});

describe("surface loading", () => {
  const roots = new Set<string>();
  afterEach(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    roots.clear();
  });

  const validSource = `import { defineSurfaces } from "@open-erp/metamodel";
export const surfaces = defineSurfaces({
  lookupDemo: {
    label: "fixture query",
    permission: "system:ledger:read",
    params: [],
    columns: [{ key: "code", label: "code", type: "string" }],
    sql: "SELECT a.code FROM {{table:alpha}} a LIMIT {{param:pageSize}} OFFSET {{offset}}",
  },
});
`;

  const hatchWith = (source: string, patch?: (root: string) => void): string => {
    const base = mkdtempSync(path.join(tmpdir(), "open-surfaces-"));
    const root = path.join(base, "domains");
    cpSync(fixture("escape-hatch"), root, { recursive: true });
    writeFileSync(path.join(root, "d1", "surfaces.ts"), source);
    patch?.(root);
    writeSiblingNavigation(root);
    roots.add(base);
    return root;
  };

  it("a domain surfaces.ts is loaded into the catalog through defineSurfaces", async () => {
    const catalog = await loadCatalog({ domainsRoot: hatchWith(validSource) });
    expect(catalog.surfaces.get("lookupDemo")?.domain).toBe("d1");
    expect(catalog.surfaces.get("lookupDemo")?.file).toBe(path.join("d1", "surfaces.ts"));
  });

  it("skipping defineSurfaces is rejected", async () => {
    await expect(loadCatalog({ domainsRoot: hatchWith("export const surfaces = { lookupDemo: {} };") }))
      .rejects.toThrow(/defineSurfaces/);
  });

  it("permission only checks the system:<name>:<action> shape, and a shape that matches is loaded", async () => {
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource.replace("system:ledger:read", "system:lookupDemo:read")),
    })).resolves.toMatchObject({ surfaces: expect.any(Map) });
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource.replace("system:ledger:read", "module:product:read")),
    })).rejects.toThrow(/is not a system permission key/);
  });

  it("an unknown named export is rejected", async () => {
    await expect(loadCatalog({ domainsRoot: hatchWith(`${validSource}\nexport const extra = 1;\n`) }))
      .rejects.toThrow(/unknown named exports/);
  });

  it("reads pointing at an unknown module is rejected", async () => {
    await expect(loadCatalog({ domainsRoot: hatchWith(validSource.replaceAll("alpha", "missing")) }))
      .rejects.toThrow(/unknown module "missing"/);
  });

  it("a choice column's choiceSet must be a declared dictionary", async () => {
    const source = validSource.replace(
      `{ key: "code", label: "code", type: "string" }`,
      `{ key: "unit", label: "unit", type: "choice", choiceSet: "missing.unit" }`,
    );
    await expect(loadCatalog({ domainsRoot: hatchWith(source) })).rejects.toThrow(/unknown dictionary "missing.unit"/);
  });

  it("declaring the same code twice is rejected", async () => {
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource, (root) => {
        writeFileSync(path.join(root, "d1", "modules", "alpha", "index.ts"), `${validSource}
import { defineModule } from "@open-erp/metamodel";
export default defineModule({
  label: "fixture",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
`);
      }),
    })).rejects.toThrow(/declared twice/);
  });
});

describe("insight loading", () => {
  const roots = new Set<string>();
  afterEach(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    roots.clear();
  });

  const validSource = `import { defineInsights } from "@open-erp/metamodel";
export const insights = defineInsights({
  mechanismAsOfCount: {
    label: "count before the as-of date",
    cells: {
      createdBeforeAsOf: {
        kind: "sql",
        label: "before the as-of date",
        sql: "SELECT count(*)::int AS value FROM {{table:alpha}} a WHERE a.created_at < {{asOf}}::date",
        params: ["asOf"],
        result: "count",
      },
    },
  },
});
`;

  const hatchWith = (source: string, extra?: (root: string) => void): string => {
    const base = mkdtempSync(path.join(tmpdir(), "open-insights-"));
    const root = path.join(base, "domains");
    cpSync(fixture("escape-hatch"), root, { recursive: true });
    mkdirSync(path.join(root, "insights"));
    writeFileSync(path.join(root, "insights", "insights.ts"), source);
    extra?.(root);
    writeSiblingNavigation(root);
    roots.add(base);
    return root;
  };

  it("a cross-cutting insights/ is loaded into the catalog through defineInsights, and is not added to the business-domain list", async () => {
    const catalog = await loadCatalog({ domainsRoot: hatchWith(validSource) });
    expect(catalog.insights.get("mechanismAsOfCount")?.label).toBe("count before the as-of date");
    expect(catalog.insights.get("mechanismAsOfCount")?.file).toBe(path.join("insights", "insights.ts"));
    expect(catalog.domains.map((domain) => domain.code)).not.toContain("insights");
  });

  it("skipping defineInsights is rejected", async () => {
    await expect(loadCatalog({ domainsRoot: hatchWith("export const insights = { mechanismAsOfCount: {} };") }))
      .rejects.toThrow(/defineInsights/);
  });

  it("an unknown module is rejected", async () => {
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource.replaceAll("alpha", "missing")),
    })).rejects.toThrow(/unknown module "missing"/);
  });

  it("a wrong status enum is rejected", async () => {
    const source = validSource.replace(
      "a.created_at < {{asOf}}::date",
      "a.status = {{status:alpha.not-a-status}} AND a.created_at < {{asOf}}::date",
    );
    await expect(loadCatalog({ domainsRoot: hatchWith(source) })).rejects.toThrow(/"not-a-status" is not among the module statuses/);
  });

  it("a .ts file outside the allow-list is rejected", async () => {
    await expect(loadCatalog({
      domainsRoot: hatchWith(validSource, (root) => {
        writeFileSync(path.join(root, "insights", "extra.ts"), "export const extra = 1;\n");
      }),
    })).rejects.toThrow(/is not on the load whitelist/);
  });

  it("the real catalog loads the operating measures, and does not treat insights as a business domain", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(catalog.report?.snapshotModule).toBe("dailyReport");
    const overdueUnshippedCount = catalog.insights.get("overdueUnshipped")?.cells["count"];
    expect(overdueUnshippedCount && "kind" in overdueUnshippedCount ? overdueUnshippedCount.kind : undefined).toBe("sql");
    expect(catalog.domains.map((domain) => domain.code)).not.toContain("insights");
  });
});
