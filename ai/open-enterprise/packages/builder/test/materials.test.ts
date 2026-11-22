import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@open-erp/loader";
import { describe, expect, it } from "vitest";
import { run, type Sink } from "../src/cli.js";
import {
  MATERIAL_FEATURES,
  findMaterials,
  materialCards,
  type MaterialCard,
} from "../src/index.js";

const DOMAINS = path.resolve(fileURLToPath(new URL("../../../domains", import.meta.url)));

function sink(): Sink & { text(): string } {
  const parts: string[] = [];
  return {
    write: (text: string) => parts.push(text),
    text: () => parts.join(""),
  };
}

async function cli(...argv: string[]): Promise<{ out: string; err: string; code: number }> {
  const out = sink();
  const err = sink();
  const code = await run(argv, out, err);
  return { out: out.text(), err: err.text(), code };
}

describe("modelling raw materials capability card", () => {
  it("only full catalog extrapolated and ordered by module code/ secure", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const first = materialCards(catalog);
    const second = materialCards(catalog);
    expect(first).toEqual(second);
    expect(first.map((card) => card.code)).toEqual([...first.map((card) => card.code)].sort());
    for (const card of first) {
      expect(card.features).toEqual([...card.features].sort());
      expect(card.file).toMatch(new RegExp(`^${card.domain}/modules/`));
    }
  });

  it("the representative module exposes the original language, not manually classified by the name of the module", async () => {
    const cards = materialCards(await loadCatalog({ domainsRoot: DOMAINS }));
    const byCode = (code: string): MaterialCard => {
      const card = cards.find((candidate) => candidate.code === code);
      if (!card) throw new Error(`test catalog is missing module ${code}`);
      return card;
    };

    expect(byCode("salesOrder").features).toEqual(
      expect.arrayContaining([
        "field:choiceSet",
        "field:subtable",
        "supply:lineAgg",
        "transition:push",
        "transition:selfLoop",
      ]),
    );
    expect(byCode("salesDelivery").features).toEqual(
      expect.arrayContaining([
        "field:refLine",
        "effect:target:stock",
        "effect:op:out",
        "effect:perLine",
        "relation:reverseUnavailable",
      ]),
    );
    expect(byCode("bom").features).toEqual(
      expect.arrayContaining([
        "constraint:unique",
        "constraint:uniqueWith",
        "field:stampOnFirstEnter",
        "relation:reverseQueryable",
      ]),
    );
    expect(byCode("productionOrder").features).toContain("transition:planner");
  });

  it("from SourceBinding IR press source / target / transfer to author ability", async () => {
    const cards = materialCards(await loadCatalog({ domainsRoot: DOMAINS }));
    const featuresOf = (code: string): readonly string[] => {
      const card = cards.find((candidate) => candidate.code === code);
      if (!card) throw new Error(`test catalog is missing module ${code}`);
      return card.features;
    };

    expect(featuresOf("materialRequirement")).toEqual(
      expect.arrayContaining([
        "sourceBinding:select:filtered:target",
        "sourceBinding:value:default:target",
      ]),
    );
    expect(featuresOf("bom")).toEqual(
      expect.arrayContaining([
        "sourceBinding:select:filtered:source",
      ]),
    );
    expect(featuresOf("salesDelivery")).toEqual(
      expect.arrayContaining([
        "sourceBinding:creation:push:target",
        "sourceBinding:value:lookup:target",
        "sourceBinding:value:snapshot:target",
      ]),
    );
    expect(featuresOf("salesOrder")).toEqual(
      expect.arrayContaining([
        "sourceBinding:creation:push:source",
        "sourceBinding:value:lookup:source",
        "sourceBinding:value:snapshot:source",
      ]),
    );
    expect(featuresOf("productionOrder")).toEqual(
      expect.arrayContaining([
        "sourceBinding:plannerExecution:transition",
        "sourceBinding:value:default:target",
      ]),
    );
  });

  it("the number of dimensions of the vocabulary is co-sourced with the metamode and sorted with its own certainty", () => {
    const features = MATERIAL_FEATURES.map((definition) => definition.feature);
    expect(features).toEqual([...features].sort());
    expect(new Set(features).size).toBe(features.length);
    expect(features).toEqual(
      expect.arrayContaining([
        "precondition:rule:related_agg",
        "effect:target:stock",
        "field:choiceSet",
        "handoff:todo",
        "sourceBinding:creation:createFrom:target",
        "sourceBinding:plannerExecution:transition",
        "sourceBinding:select:filtered:source",
        "sourceBinding:value:snapshot:target",
        "supply:refOwner",
      ]),
    );
  });
});

describe("search raw materials by hard capacity", () => {
  it("multiple need to only include all over-covered modules", async () => {
    const cards = materialCards(await loadCatalog({ domainsRoot: DOMAINS }));
    const result = findMaterials(cards, ["field:refLine", "effect:target:stock", "effect:perLine"]);
    expect(result.exact.map((candidate) => candidate.code)).toContain("salesDelivery");
    expect(result.exact.every((candidate) => candidate.missing.length === 0)).toBe(true);
    expect(result.partial.every((candidate) => candidate.matched.length > 0 && candidate.missing.length > 0)).toBe(true);
  });

  it("keep item by item and local material when not fully covered by a single module and do not impersonate partial as an example", () => {
    const cards: MaterialCard[] = [
      {
        code: "plannerMaterial",
        label: "Planner material",
        domain: "d",
        file: "d/modules/plannerMaterial.ts",
        features: ["transition:planner"],
      },
      {
        code: "uniqueMaterial",
        label: "Composite unique material",
        domain: "d",
        file: "d/modules/uniqueMaterial.ts",
        features: ["constraint:uniqueWith"],
      },
    ];
    const result = findMaterials(cards, ["transition:planner", "constraint:uniqueWith"]);
    expect(result.exact).toEqual([]);
    expect(result.uncovered).toEqual([]);
    expect(result.coverage.find((entry) => entry.feature === "transition:planner")?.candidates).toEqual([
      "plannerMaterial",
    ]);
    expect(result.coverage.find((entry) => entry.feature === "constraint:uniqueWith")?.candidates).toEqual(
      ["uniqueMaterial"],
    );
    expect(result.partial.map((candidate) => candidate.code)).toEqual(["plannerMaterial", "uniqueMaterial"]);
  });

  it("valid but unused feature visible entry uncovered", () => {
    const result = findMaterials([], ["effect:target:stock"]);
    expect(result.exact).toEqual([]);
    expect(result.partial).toEqual([]);
    expect(result.coverage).toEqual([{ feature: "effect:target:stock", candidates: [] }]);
    expect(result.uncovered).toEqual(["effect:target:stock"]);
  });

  it("query is a pure function: enter order and repeat need not change the certainty result", () => {
    const cards: MaterialCard[] = [
      { code: "b", label: "B", domain: "d", file: "d/modules/b.ts", features: ["field:ref"] },
      {
        code: "a",
        label: "A",
        domain: "d",
        file: "d/modules/a.ts",
        features: ["field:ref", "field:subtable"],
      },
    ];
    const result = findMaterials(cards, ["field:subtable", "field:ref", "field:ref"]);
    expect(result.required).toEqual(["field:ref", "field:subtable"]);
    expect(result.exact.map((candidate) => candidate.code)).toEqual(["a"]);
    expect(result.partial.map((candidate) => candidate.code)).toEqual(["b"]);
  });

  it("pure query retention of SourceBinding role without mixing the source template with the target statement template", () => {
    const cards: MaterialCard[] = [
      {
        code: "sourceMaterial",
        label: "Source sample",
        domain: "d",
        file: "d/modules/sourceMaterial.ts",
        features: [
          "sourceBinding:select:filtered:source",
          "sourceBinding:value:default:source",
        ],
      },
      {
        code: "targetMaterial",
        label: "Target sample",
        domain: "d",
        file: "d/modules/targetMaterial.ts",
        features: [
          "sourceBinding:select:filtered:target",
          "sourceBinding:value:default:target",
        ],
      },
    ];

    const targetResult = findMaterials(cards, [
      "sourceBinding:select:filtered:target",
      "sourceBinding:value:default:target",
    ]);
    expect(targetResult.exact.map((candidate) => candidate.code)).toEqual(["targetMaterial"]);
    expect(targetResult.partial).toEqual([]);

    const sourceResult = findMaterials(cards, [
      "sourceBinding:select:filtered:source",
      "sourceBinding:value:default:source",
    ]);
    expect(sourceResult.exact.map((candidate) => candidate.code)).toEqual(["sourceMaterial"]);
    expect(sourceResult.partial).toEqual([]);
  });

  it("unknown feature and empty pure query both fail-fast", () => {
    expect(() => findMaterials([], ["field:invented"])).toThrow(/unknown feature.*field:invented/);
    expect(() => findMaterials([], [])).toThrow(/at least one feature/);
    expect(() =>
      findMaterials(
        [{ code: "a", label: "A", domain: "d", file: "d/modules/a.ts", features: ["field:invented"] }],
        ["field:ref"],
      ),
    ).toThrow(/material "a" carries capabilities outside the vocabulary.*field:invented/);
  });
});

describe("materials CLI", () => {
  it("unknown feature, missing --need parameters and position parameters have clearly failed", async () => {
    await expect(cli("catalog", "--need", "field:invented", "--domains", DOMAINS)).rejects.toThrow(
      /unknown feature.*field:invented/,
    );
    await expect(cli("catalog", "--need")).rejects.toThrow(/--need requires a feature argument/);
    await expect(cli("catalog", "salesOrder", "--domains", DOMAINS)).rejects.toThrow(/does not accept positional argument/);
  });
});
