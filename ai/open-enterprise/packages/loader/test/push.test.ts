import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, type ModulePlanner, type ModuleSchema } from "@open-erp/metamodel";
import { checkCrossReferences, type Catalog, type LoadedModule } from "../src/index.js";
import { resolveModuleOrigins } from "../src/module.js";

const status = (key: string, initial = false, terminal = false) => ({ key, initial, terminal });

function moduleOf(code: string, push: unknown | null, sourceTable = "sourceLines"): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    fields: [
      { key: "name", type: "string" },
      { key: sourceTable, type: "subtable", ref: `${code}Line`, fields: [{ key: "qty", type: "number" }] },
    ],
    lifecycle: {
      statuses: push === null ? [status("active", true)] : [status("draft", true), status("done", false, true)],
      transitions: push === null ? [] : [{ code: "generate", from: "draft", to: "done", action: "generate", push }],
    },
    views: { list: { columns: ["name"] }, form: [] },
  });
}

function loaded(schema: ModuleSchema): LoadedModule {
  return {
    code: schema.code,
    domain: schema.domain,
    file: `${schema.code}.ts`,
    schema,
    escapeHatch: false,
    planners: new Map(),
    plannerConsistency: new Map(),
    actionPreparers: new Map(),
    batchActions: {},
  };
}

function catalogOf(...schemas: readonly ModuleSchema[]): Catalog {
  return {
    modules: new Map(schemas.map((schema) => [schema.code, loaded(schema)])),
    choiceSets: [],
    moduleSettings: [],
    domains: [],
    skills: [],
    agents: [],
    authorization: { roles: [], orgTree: null, scopeTargets: [] },
  } as unknown as Catalog;
}

describe("loader semantics of a push object", () => {
  it("an explicit source/target table pair passes; an unknown module, an unknown table, and a non-line field each return to the declared coordinate", () => {
    const target = moduleOf("target", null, "targetLines");
    const valid = moduleOf("valid", {
      module: "target",
      line: { source: "sourceLines", target: "targetLines" },
    });
    expect(checkCrossReferences(catalogOf(valid, target))).toEqual([]);

    const cases = [
      {
        source: moduleOf("unknownModule", "missing"),
        pattern: /lifecycle\.transitions\.generate\.push.*push target module "missing" does not exist/,
      },
      {
        source: moduleOf("unknownSource", {
          module: "target",
          line: { source: "missingLines", target: "targetLines" },
        }),
        pattern: /push\.line\.source.*has no field "missingLines"/,
      },
      {
        source: moduleOf("headerSource", {
          module: "target",
          line: { source: "name", target: "targetLines" },
        }),
        pattern: /push\.line\.source.*name.*not a line table/,
      },
      {
        source: moduleOf("unknownTarget", {
          module: "target",
          line: { source: "sourceLines", target: "missingLines" },
        }),
        pattern: /push\.line\.target.*has no field "missingLines"/,
      },
    ];
    for (const one of cases) {
      const rendered = checkCrossReferences(catalogOf(one.source, target))
        .map((error) => `${error.path}: ${error.message}`).join(" | ");
      expect(rendered).toMatch(one.pattern);
    }
  });

  it("push.line.source and the target refLine.through pointing at two source tables is rejected at assembly", () => {
    const source = normalizeFixtureModule({
      code: "sourceWithTwoLines",
      label: "sourceWithTwoLines",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        { key: "lines", type: "subtable", ref: "sourceLine", fields: [{ key: "qty", type: "number" }] },
        { key: "requestLines", type: "subtable", ref: "requestLine", fields: [{ key: "qty", type: "number" }] },
      ],
      lifecycle: {
        statuses: [status("draft", true), status("done", false, true)],
        transitions: [{
          code: "generate",
          from: "draft",
          to: "done",
          action: "generate",
          push: { module: "targetWithRefLine", line: { source: "requestLines", target: "targetLines" } },
        }],
      },
      views: { list: { columns: ["name"] }, form: [] },
    });
    const target = normalizeFixtureModule({
      code: "targetWithRefLine",
      label: "targetWithRefLine",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        {
          key: "targetLines",
          type: "subtable",
          ref: "targetLine",
          fields: [
            { key: "sourceId", type: "ref", ref: "sourceWithTwoLines" },
            { key: "sourceLineId", type: "refLine", ref: "sourceWithTwoLines", through: "lines" },
            { key: "qty", type: "number" },
          ],
        },
      ],
      lifecycle: { statuses: [status("active", true)], transitions: [] },
      views: { list: { columns: ["name"] }, form: [] },
    });

    const rendered = checkCrossReferences(catalogOf(source, target))
      .map((error) => `${error.path}: ${error.message}`).join(" | ");
    expect(rendered).toMatch(/explicit source table "requestLines" and refLine\.through "lines".*do not match/);
  });

  it("writing generatedOnly on an edge is rejected during normalization", () => {
    expect(() => moduleOf("generated", { module: "target", generatedOnly: true })).toThrow(
      /a Planner-produced target is generated only\. It must not be written by hand/,
    );
  });

  it("a Planner create path gives the target a generated-only blocker; an ordinary push does not", () => {
    const ordinaryTarget = loaded(moduleOf("plainTarget", null));
    const ordinarySource = loaded(moduleOf("plainSource", "plainTarget"));
    const ordinary = resolveModuleOrigins(new Map([
      [ordinarySource.code, ordinarySource],
      [ordinaryTarget.code, ordinaryTarget],
    ]), []);
    const plain = ordinary.get("plainTarget");
    if (!plain) throw new Error("after assembly there is no ordinary target");
    expect(plain.schema.creatable.blockers.some((blocker) => blocker.path === "creatable")).toBe(false);
    expect(plain.schema.creatable.manual).toBe(true);

    const planner: ModulePlanner = () => {
      throw new Error("a Planner does not run on the assembly path");
    };
    const source: LoadedModule = {
      ...loaded(moduleOf("beta", "alpha")),
      planners: new Map([["generate", planner]]),
    };
    const target = loaded(moduleOf("alpha", null));
    const resolved = resolveModuleOrigins(new Map([
      [source.code, source],
      [target.code, target],
    ]), [{ source: "beta", target: "alpha", transition: "generate" }]);
    const alpha = resolved.get("alpha");
    if (!alpha) throw new Error("after assembly there is no Planner target");
    expect(alpha.schema.creatable.manual).toBe(false);
    expect(alpha.schema.creatable.blockers).toContainEqual(expect.objectContaining({
      path: "creatable",
      why: "this module can be generated by the system only from confirmed source-document facts, and cannot be created by hand without a source",
    }));
    expect(alpha.schema.creatable.pushedFrom).toEqual([
      { module: "beta", moduleLabel: "beta", transition: "generate", action: "generate" },
    ]);
  });

  it("an ordinary push does not satisfy plannerSupplied: a target that contains that field is rejected", () => {
    const source = moduleOf("ordinaryGeneratedSource", "plannerTarget");
    const target = normalizeFixtureModule({
      code: "plannerTarget",
      label: "plannerTarget",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        { key: "frozenPlanValue", type: "number", required: true, plannerSupplied: true },
      ],
      lifecycle: { statuses: [status("active", true)], transitions: [] },
      views: { list: { columns: ["name"] }, form: [] },
    });

    const rendered = checkCrossReferences(catalogOf(source, target))
      .map((error) => `${error.path}: ${error.message}`).join(" | ");
    expect(rendered).toMatch(/field "frozenPlanValue" on push target "plannerTarget" declares plannerSupplied/);
    expect(rendered).toMatch(/only through an explicit pushFrom or pushDefaults/);
  });

  it("a system snapshot can be an ordinary push's only value source only through an explicit pushFrom on the target", () => {
    const supplier = moduleOf("supplier", null);
    const receipt = normalizeFixtureModule({
      code: "receipt",
      label: "receipt",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        { key: "supplierId", type: "ref", ref: "supplier" },
      ],
      lifecycle: { statuses: [status("active", true)], transitions: [] },
      views: { list: { columns: ["name"] }, form: [] },
    });
    const source = normalizeFixtureModule({
      code: "returnSource",
      label: "returnSource",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        { key: "receiptId", type: "ref", ref: "receipt" },
        {
          key: "supplierId",
          type: "ref",
          ref: "supplier",
          snapshot: { from: "receipt", match: "receiptId", through: null, field: "supplierId" },
        },
      ],
      lifecycle: {
        statuses: [status("draft", true), status("done", false, true)],
        transitions: [{
          code: "generate",
          from: "draft",
          to: "done",
          action: "generate",
          push: "demand",
        }],
      },
      views: { list: { columns: ["name"] }, form: [] },
    });
    const sourceWithoutSupplier = normalizeFixtureModule({
      code: "sourceWithoutSupplier",
      label: "sourceWithoutSupplier",
      domain: "test",
      fields: [{ key: "name", type: "string" }],
      lifecycle: {
        statuses: [status("draft", true), status("done", false, true)],
        transitions: [{
          code: "generate",
          from: "draft",
          to: "done",
          action: "generate",
          push: "demand",
        }],
      },
      views: { list: { columns: ["name"] }, form: [] },
    });
    const target = (pushFrom: string | undefined, required: boolean): ModuleSchema => normalizeFixtureModule({
      code: "demand",
      label: "demand",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        { key: "supplierId", type: "ref", ref: "supplier", required, ...(pushFrom === undefined ? {} : { pushFrom }) },
      ],
      lifecycle: { statuses: [status("active", true)], transitions: [] },
      views: { list: { columns: ["name"] }, form: [] },
    });

    expect(checkCrossReferences(catalogOf(
      source,
      sourceWithoutSupplier,
      target("supplierId", false),
      receipt,
      supplier,
    ))).toEqual([]);
    const typo = checkCrossReferences(catalogOf(
      source,
      sourceWithoutSupplier,
      target("supplierID", false),
      receipt,
      supplier,
    )).map((error) => `${error.path}: ${error.message}`).join(" | ");
    expect(typo).toMatch(/pushFrom: "supplierID".*has no such field/);
    const requiredOnEveryEdge = checkCrossReferences(catalogOf(
      source,
      sourceWithoutSupplier,
      target("supplierId", true),
      receipt,
      supplier,
    )).map((error) => `${error.path}: ${error.message}`).join(" | ");
    expect(requiredOnEveryEdge).toMatch(/sourceWithoutSupplier.*|pushFrom: "supplierId".*has no such field/);
    const withoutExplicitSource = checkCrossReferences(catalogOf(source, target(undefined, true), receipt, supplier))
      .map((error) => `${error.path}: ${error.message}`).join(" | ");
    expect(withoutExplicitSource).toMatch(/required field "supplierId".*cannot be carried over/);
  });

  it("pushDefaults and automatic copy share one criterion: a Planner does not guess by the same name, and only an explicit pushFrom conflicts", () => {
    const sourceFor = (target: string): ModuleSchema => normalizeFixtureModule({
      code: `sourceFor${target}`,
      label: "source",
      domain: "test",
      fields: [
        { key: "name", type: "string" },
        { key: "sourceType", type: "enum", options: ["fixed", "other"] },
      ],
      lifecycle: {
        statuses: [status("draft", true), status("done", false, true)],
        transitions: [{
          code: "generate",
          from: "draft",
          to: "done",
          action: "generate",
          push: target,
          pushDefaults: { sourceType: "fixed" },
        }],
      },
      views: { list: { columns: ["name"] }, form: [] },
    });
    const targetFor = (code: string, field: Record<string, unknown>): ModuleSchema => normalizeFixtureModule({
      code,
      label: code,
      domain: "test",
      fields: [{ key: "name", type: "string" }, { key: "sourceType", type: "enum", options: ["fixed", "other"], ...field }],
      lifecycle: { statuses: [status("active", true)], transitions: [] },
      views: { list: { columns: ["name"] }, form: [] },
    });
    const messages = (source: ModuleSchema, target: ModuleSchema): string =>
      checkCrossReferences(catalogOf(source, target)).map((error) => error.message).join(" | ");

    const plannerByDefault = targetFor("plannerByDefault", { plannerSupplied: true, required: true });
    expect(messages(sourceFor(plannerByDefault.code), plannerByDefault)).not.toMatch(/two sources of truth/);

    const ordinary = targetFor("ordinarySameName", { required: true });
    expect(messages(sourceFor(ordinary.code), ordinary)).toMatch(/two sources of truth/);

    const plannerByPushFrom = targetFor("plannerByPushFrom", { plannerSupplied: true, required: true, pushFrom: "sourceType" });
    expect(messages(sourceFor(plannerByPushFrom.code), plannerByPushFrom)).toMatch(/two sources of truth/);
  });
});
