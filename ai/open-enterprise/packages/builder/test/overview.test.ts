import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@open-erp/loader";
import { sourceBindingsOf } from "@open-erp/metamodel";
import { systemOverview } from "../src/overview.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DOMAINS = path.join(ROOT, "domains");

describe("system overview", () => {
  it("the default is a complete but compact catalog orientation index", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const result = systemOverview(catalog);

    expect(result.kind).toBe("system-overview");
    expect(result.wireVersion).toBe(1);
    expect(result.domains.map((domain) => domain.domain)).toEqual(catalog.domains.map((domain) => domain.code));
    expect(result.domains.flatMap((domain) => domain.modules.map((module) => module.module))).toEqual(
      [...catalog.modules.keys()],
    );
    expect(result.bindings).toEqual([]);
    expect(result.responsibility.agents.map((agent) => agent.id)).toEqual(catalog.agents.map((agent) => agent.id));
    expect(result.responsibility.skills.map((skill) => skill.name)).toEqual(catalog.skills.map((skill) => skill.name));

    const schemas = [...catalog.modules.values()].map((module) => module.schema);
    const expectedFlowIds = sourceBindingsOf(schemas)
      .filter((binding) => binding.kind === "creation" || binding.kind === "planner-execution")
      .map((binding) => binding.id);
    expect(result.flows.map((flow) => flow.id)).toEqual(expectedFlowIds);
  });

  it("--around expands only the one-hop neighborhood of the focus, and keeps dependencies apart from creation flows", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const focus = "materialIssue";
    const result = systemOverview(catalog, { around: focus });
    const modules = new Set(result.domains.flatMap((domain) => domain.modules.map((module) => module.module)));

    expect(modules.has(focus)).toBe(true);
    expect(result.bindings.length).toBeGreaterThan(0);
    for (const binding of result.bindings) {
      expect(binding.source.module === focus || binding.target.module === focus).toBe(true);
      expect(binding.kind).not.toBe("push");
      expect(binding.kind).not.toBe("create-from");
    }
    expect(result.flows.some((flow) => flow.source.module === focus ||
      flow.target.kind === "module" && flow.target.module === focus)).toBe(true);
    for (const flow of result.flows) {
      expect(flow.source.module === focus || flow.target.kind === "module" && flow.target.module === focus).toBe(true);
    }
  });

  it("a domain slice keeps the external endpoint of a cross-domain flow, and does not mix external modules into the module catalog", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const result = systemOverview(catalog, { domain: "productionReceive" });
    expect(result.domains.map((domain) => domain.domain)).toEqual(["productionReceive"]);
    expect(result.domains[0]?.modules.every((module) => module.domain === "productionReceive")).toBe(true);
    expect(result.flows.some((flow) => {
      if (flow.target.kind !== "module") return false;
      const sourceDomain = catalog.modules.get(flow.source.module)?.domain;
      const targetDomain = catalog.modules.get(flow.target.module)?.domain;
      return sourceDomain !== targetDomain;
    })).toBe(true);
  });

  it("an unknown coordinate and a conflicting scope fail fast", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    expect(() => systemOverview(catalog, { domain: "missing" })).toThrow(/unknown domain/);
    expect(() => systemOverview(catalog, { around: "missing" })).toThrow(/unknown module/);
    expect(() => systemOverview(catalog, { domain: "sales", around: "salesOrder" })).toThrow(/cannot be used together/);
  });
});
