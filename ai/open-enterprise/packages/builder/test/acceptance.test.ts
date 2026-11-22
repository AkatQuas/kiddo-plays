import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@open-erp/loader";
import { describe, expect, it } from "vitest";
import {
  acceptanceFactsOf,
  acceptanceManifestOf,
  acceptanceObligationsOf,
  assertAcceptanceEvidence,
  type AcceptanceFacts,
  type AcceptanceModuleFact,
} from "../src/acceptance.js";

const DOMAINS = path.resolve(fileURLToPath(new URL("../../../domains", import.meta.url)));

describe("deterministic acceptance manifest", () => {
  it("from complete real datalog grouping", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const manifest = acceptanceManifestOf(catalog);
    expect(manifest.version).toBe(1);
    // 42: Delete Custodialization / salesReturn / stockmove / regulation planAdjustment.
    expect(manifest.modules).toHaveLength(43);
    expect(manifest.sources.length).toBeGreaterThan(300);
    expect(manifest.relations.length).toBeGreaterThan(100);
    expect(manifest.obligations.map((item) => item.id)).toEqual(
      [...manifest.obligations.map((item) => item.id)].sort(),
    );
    expect(new Set(manifest.obligations.map((item) => item.id)).size).toBe(manifest.obligations.length);

    const categories = new Set(manifest.obligations.map((item) => item.category));
    expect(categories).toEqual(
      new Set([
        "surface-list",
        "surface-detail",
        "surface-create",
        "surface-create-blocked",
        "surface-edit",
        "permission",
        "source-select",
        "source-value",
        "source-create",
        "planner-execution",
        "transition",
        "guard",
        "effect",
        "relation-link",
        "relation-reverse",
      ]),
    );
  });

  it("programOrder batching only generates Planner execution obligations, not disguised as an intermediate list creation stream", async () => {
    const manifest = acceptanceManifestOf(await loadCatalog({ domainsRoot: DOMAINS }));
    expect(
      manifest.sources.some(
        (binding) => binding.kind === "creation" && binding.target.module === "productionRelease",
      ),
    ).toBe(false);
    const planners = manifest.sources.filter(
      (binding) => binding.kind === "planner-execution" && binding.transition.module === "productionOrder",
    );
    expect(planners.map((binding) => binding.kind === "planner-execution" ? binding.transition.code : null))
      .toEqual(["cancel", "complete", "release"]);
    for (const planner of planners) {
      if (planner.kind !== "planner-execution") throw new Error("missing productionOrder planner binding");
      expect(planner.targets).toEqual({ kind: "dynamic" });
    }
  });

  it("browner/source-select project only real visible and writeable coordinates; hidden/full-life read-only fields retain database obligations", async () => {
    const manifest = acceptanceManifestOf(await loadCatalog({ domainsRoot: DOMAINS }));
    const browser = manifest.obligations.filter(
      (item) => item.layer === "browser" && item.category === "source-select",
    );
    const database = manifest.obligations.filter(
      (item) => item.layer === "database" && item.category === "source-select",
    );
    // planner has no access to a stand-alone target list for the automatic generation module; after excluding the ghost obligation to rely on the occasional initials seed,
    // browner retains only the coordinates that the Generic Runner can reach from the menu, and the database mechanism obligation does not diminish.
    // following selection of the new production task list source, the current browser = 110, database = 218. The numbers have changed to change dramatically here.
    // after changing the name of the company recording the billing to the optional refDefault, there is no additional requirement to fill in the Browner source-select obligation.
    // BOM, after detailed abolition of ChildBom version, Browner and database are missing.
    expect(browser).toHaveLength(109);
    expect(database).toHaveLength(221);

    const generatedOnly = manifest.modules.filter(
      (module) => module.creatable.blockers.some((blocker) => blocker.path === "creatable"),
    );
    const generatedOnlyCodes = new Set(generatedOnly.map((module) => module.code));
    const generatedOnlySelects = manifest.sources.filter(
      (binding) =>
        (binding.kind === "field-select" || binding.kind === "unit-choice") &&
        generatedOnlyCodes.has(binding.target.module),
    );
    expect(generatedOnlySelects).not.toHaveLength(0);
    for (const binding of generatedOnlySelects) {
      expect(
        manifest.obligations.some(
          (item) => item.layer === "database" && item.factId === binding.id,
        ),
        `${binding.id} must keep its database mechanism obligation`,
      ).toBe(true);
      expect(
        browser.some((item) => item.factId === binding.id),
        `${binding.id} has no standalone target form entry, so a seed must not fake browser reachability`,
      ).toBe(false);
    }
    expect(browser.some(
      (item) => item.factId === '["field-select","processReport","defects","defectTypeId"]',
    )).toBe(false);

    const hidden = manifest.sources.filter((binding) => {
      if (binding.kind !== "field-select" || !binding.selectable) return false;
      const target = manifest.modules.find((module) => module.code === binding.target.module);
      if (target === undefined) throw new Error(`manifest is missing target module ${binding.target.module}`);
      return !target.surfaces.formFields.includes(binding.target.table ?? binding.target.field);
    });
    expect(hidden.map((binding) => binding.id)).toEqual([
      '["field-select","processAssignment","progressLines","sourceProcessReportId"]',
      '["field-select","processAssignment","sourceLines","processLineId"]',
      '["field-select","processAssignment",null,"productionLineOrgId"]',
      '["field-select","processAssignment",null,"teamAssignmentOrgId"]',
      '["field-select","processAssignment",null,"workshopOrgId"]',
      '["field-select","processReport","sourceLines","processLineId"]',
      '["field-select","product",null,"defaultWarehouseId"]',
      '["field-select","product",null,"productFamilyId"]',
      '["field-select","productionReceipt","lines","productionTaskId"]',
      '["field-select","productionReceipt","lines","warehouseId"]',
      '["field-select","productionTask","materialLines","componentProductId"]',
      '["field-select","productionTask","materialLines","defaultIssueWarehouseId"]',
      '["field-select","productionTask",null,"customerId"]',
      '["field-select","productionTask",null,"materialRequirementId"]',
      '["field-select","stockIn",null,"productionReceiptId"]',
      '["field-select","subcontractMaterialReturn",null,"warehouseId"]',
    ]);
    const browserFacts = new Set(browser.map((obligation) => obligation.factId));
    expect(
      manifest.sources
        .filter((binding) => binding.kind === "unit-choice" && !browserFacts.has(binding.id))
        .map((binding) => binding.id),
    ).toEqual([
      '["unit-choice","materialRequirement","lines","unit"]',
      '["unit-choice","processAssignment",null,"unit"]',
      // processReport.unit has left the unit-chaice list: after receipt of the outside joint report, report
      // in the case of the two types of homemade/extra-offer, the unit was replaced by a planner (stringing + plannerSupplied).
      // with unitChoice, there is no unit selection.
      '["unit-choice","productionReceipt","lines","unit"]',
      '["unit-choice","productionTask","allocations","unit"]',
      '["unit-choice","productionTask","materialLines","unit"]',
      '["unit-choice","productionTask",null,"unit"]',
      '["unit-choice","subcontractIssue","materialLines","unit"]',
      '["unit-choice","subcontractReceipt","lines","unit"]',
    ]);
    for (const binding of hidden) {
      expect(database.some((item) => item.factId === binding.id)).toBe(true);
      expect(browser.some((item) => item.factId === binding.id)).toBe(false);
    }

    const neverWritable = manifest.sources.filter((binding) => {
      if (binding.kind !== "field-select" || !binding.selectable) return false;
      const target = manifest.modules.find((module) => module.code === binding.target.module);
      if (target === undefined) throw new Error(`manifest is missing target module ${binding.target.module}`);
      const root = binding.target.table ?? binding.target.field;
      const recordCanExist = target.creatable.manual || target.creatable.pushedFrom.length > 0;
      return (
        target.surfaces.formFields.includes(root) &&
        !(target.creatable.manual && target.creatable.fields.includes(root)) &&
        (!recordCanExist || target.surfaces.statuses.every((status) => !status.editableFields.includes(root)))
      );
    });
    expect(neverWritable.map((binding) => binding.id)).toEqual([
      '["field-select","materialRequirement","lines","componentProductId"]',
      '["field-select","materialRequirement","lines","defaultIssueWarehouseId"]',
      '["field-select","materialRequirement",null,"bomId"]',
      '["field-select","materialRequirement",null,"issueWarehouseId"]',
      '["field-select","materialRequirement",null,"productId"]',
      '["field-select","materialRequirement",null,"productionOrderId"]',
      '["field-select","materialRequirement",null,"productionOrgId"]',
      '["field-select","performanceSettlement",null,"processReportId"]',
      '["field-select","processAssignment",null,"equipmentId"]',
      '["field-select","processAssignment",null,"moldId"]',
      '["field-select","processAssignment",null,"operationId"]',
      '["field-select","processAssignment",null,"productionTaskId"]',
      '["field-select","processAssignment",null,"teamId"]',
      '["field-select","processAssignment",null,"workerId"]',
      '["field-select","processReport","defects","defectTypeId"]',
      '["field-select","processReport",null,"operationId"]',
      '["field-select","processReport",null,"processAssignmentId"]',
      '["field-select","processReport",null,"productionOrderId"]',
      '["field-select","processReport",null,"subcontractReceiptId"]',
      '["field-select","processReport",null,"subcontractSupplierId"]',
      '["field-select","processReport",null,"workerId"]',
      '["field-select","productionTask","allocations","sourceOrderLineId"]',
      '["field-select","productionTask",null,"bomId"]',
      '["field-select","productionTask",null,"completionWarehouseId"]',
      '["field-select","productionTask",null,"issueWarehouseId"]',
      '["field-select","productionTask",null,"productId"]',
      '["field-select","productionTask",null,"productionOrderId"]',
      '["field-select","productionTask",null,"productionOrgId"]',
      '["field-select","productionTask",null,"routingId"]',
    ]);
    for (const binding of neverWritable) {
      expect(database.some((item) => item.factId === binding.id)).toBe(true);
      expect(browser.some((item) => item.factId === binding.id)).toBe(false);
    }
  });

  it("browner/ source-select both Create, Push, Status, Form and subtable root", () => {
    const moduleFact = (
      code: string,
      input: {
        readonly manual: boolean;
        readonly createFields?: readonly string[];
        readonly pushed?: boolean;
        readonly generatedOnly?: boolean;
        readonly form?: readonly string[];
        readonly editable?: readonly string[];
      },
    ): AcceptanceModuleFact => ({
      code,
      label: code,
      domain: "test",
      file: `${code}.ts`,
      creatable: {
        manual: input.manual,
        blockers: input.generatedOnly === true
          ? [{ path: "creatable", type: "string", why: "Created by a planner" }]
          : [],
        fields: input.createFields ?? [],
        pushedFrom: input.pushed === true
          ? [{ module: "upstream", moduleLabel: "Upstream", transition: "push", action: "Push" }]
          : [],
      },
      surfaces: {
        listColumns: [],
        formFields: input.form ?? ["sourceId"],
        statuses: [{
          key: "draft",
          editable: input.editable === undefined ? "none" : "whitelist",
          editableFields: input.editable ?? [],
        }],
      },
      transitions: [],
    });
    const modules = [
      moduleFact("createOnly", { manual: true, createFields: ["sourceId"] }),
      moduleFact("generatedEditable", { manual: false, pushed: true, editable: ["sourceId"] }),
      moduleFact("plannerGeneratedEditable", {
        manual: false,
        pushed: true,
        generatedOnly: true,
        editable: ["sourceId"],
      }),
      moduleFact("generatedImmutable", { manual: false, pushed: true }),
      moduleFact("whitelistOtherRoot", { manual: false, pushed: true, editable: ["other"] }),
      moduleFact("subtableRoot", { manual: false, pushed: true, form: ["lines"], editable: ["lines"] }),
      moduleFact("hidden", { manual: true, createFields: ["sourceId"], form: [] }),
      moduleFact("notSelectable", { manual: true, createFields: ["sourceId"] }),
    ];
    const select = (
      module: string,
      options: { readonly table?: string; readonly selectable?: boolean } = {},
    ) => ({
      id: module,
      kind: "field-select" as const,
      scope: "cross-record" as const,
      mode: "live" as const,
      mechanism: options.table === undefined ? "ref" as const : "refLine" as const,
      source: { module: "upstream", level: "record" as const, table: null },
      target: {
        module,
        level: options.table === undefined ? "record" as const : "line" as const,
        table: options.table ?? null,
        field: "sourceId",
        path: options.table === undefined ? "sourceId" : `${options.table}.sourceId`,
      },
      selectable: options.selectable ?? true,
      filter: [],
      preselect: [],
      explain: module,
    });
    const facts: AcceptanceFacts = {
      version: 1,
      modules,
      sources: [
        select("createOnly"),
        select("generatedEditable"),
        select("plannerGeneratedEditable"),
        select("generatedImmutable"),
        select("whitelistOtherRoot"),
        select("subtableRoot", { table: "lines" }),
        select("hidden"),
        select("notSelectable", { selectable: false }),
      ],
      relations: [],
    };
    const obligations = acceptanceObligationsOf(facts);
    expect(
      obligations
        .filter((item) => item.layer === "browser" && item.category === "source-select")
        .map((item) => item.factId),
    ).toEqual(["createOnly", "generatedEditable", "subtableRoot"]);
    expect(
      obligations.filter((item) => item.layer === "database" && item.category === "source-select"),
    ).toHaveLength(8);
  });

  it("same acts of catalogs can be duplicated to create the same JSON", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const first = acceptanceFactsOf(catalog);
    const second = acceptanceFactsOf(catalog);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(acceptanceObligationsOf(first)).toEqual(acceptanceObligationsOf(second));
  });
});

describe("acceptance evidence set closure", () => {
  const obligations = [
    {
      id: "a",
      layer: "browser" as const,
      category: "surface-list" as const,
      module: "m",
      factId: null,
      scenarioRequired: false,
    },
    {
      id: "b",
      layer: "database" as const,
      category: "guard" as const,
      module: "m",
      factId: "g",
      scenarioRequired: true,
    },
  ];

  it("only if the assembly is strictly equal", () => {
    expect(() => assertAcceptanceEvidence(obligations, ["b", "a"])).not.toThrow();
    expect(() => assertAcceptanceEvidence(obligations, ["a"])).toThrow(/missing 1/);
    expect(() => assertAcceptanceEvidence(obligations, ["a", "b", "c"])).toThrow(/extra 1/);
    expect(() => assertAcceptanceEvidence(obligations, ["a", "a", "b"])).toThrow(/duplicate evidence ids/);
  });
});
