import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { plannerCreateTargetsOf, transitionAt } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import { planners } from "../modules/productionOrder/index.js";

// Production release is no longer an intermediate document. It is a planner action on the production order collection.
// Without processLines it only creates tasks and material requirements. With them, operations are written onto the production task subtable.
const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const productionOrder = requireModule(catalog, "productionOrder").schema;

/** Schedule production is the same action on awaitingRelease, releasing, and inProduction. */
const RELEASE_FROM = ["awaitingRelease", "releasing", "inProduction"] as const;

describe("Production release: the production order is the only business host", () => {
  it("release and additional release are planner edges and explicitly collect this release's parameters", () => {
    for (const from of RELEASE_FROM) {
      const transition = transitionAt(productionOrder, from, "release");
      expect(transition.expandsBills).toBe(true);
      expect(transition.params.map((param) => param.key)).toEqual(["releaseMode", "releaseLines", "processLines"]);
      expect(transition.params.find((param) => param.key === "processLines")?.required).toBe(false);
    }
  });

  it("the schedule operation input accepts a production line and does not accept a team", () => {
    const processLines = transitionAt(productionOrder, "awaitingRelease", "release").params.find((param) => param.key === "processLines")?.lineField;
    expect(processLines?.fields?.map((field) => field.key)).toContain("productionLineOrgId");
    expect(processLines?.fields?.map((field) => field.key)).not.toContain("teamId");
    expect(processLines?.fields?.find((field) => field.key === "productionLineOrgId")).toMatchObject({
      required: true,
      refFilter: { orgType: "line", status: "active" },
    });
    const taskLines = requireModule(catalog, "productionTask").schema.fields.find((field) => field.key === "processLines");
    expect(taskLines?.fields?.find((field) => field.key === "workshopOrgId")?.snapshot).toMatchObject({
      match: "productionLineOrgId",
      field: "parentOrgId",
    });
  });

  it("the Schedule production planner declares that it creates tasks and material requirements, and writes operations onto the task subtable", () => {
    expect(plannerCreateTargetsOf(planners)).toEqual({ release: ["materialRequirement", "productionTask"] });
  });

  it("the workbench keeps only the single mode slot the platform requires and no longer offers a merge or do-not-merge choice", () => {
    const action = requireModule(catalog, "productionOrder").batchActions["releaseProduction"];
    expect(action?.modes).toEqual([{ value: "separate", label: "Confirm schedule", primary: true }]);
    expect(action?.seed).not.toHaveProperty("plannedStartDate");
    expect(action?.seed).not.toHaveProperty("plannedEndDate");
  });

  /**
   * The expected delivery date on a staging row must be carried by `seed` from the source order header.
   *
   * This field used to be declared as `derive.lookup(salesOrder.promiseDate)` with `match` pointing at
   * `salesOrderId`, but a staging row has no such field. It only has `sourceOrderId` and
   * `sourceOrderLineId`, both pointing at productionOrder. A staging row is not a business table and does not enter
   * the catalog, so the `sourceBindings` match gate never sees it and that dead declaration was never caught.
   *
   * What actually fills a staging row is `batchActions.seed`. Prepare first sets every field to null,
   * then overwrites only what seed names (`packages/server/src/http/routes/bills.ts`). Without this seed
   * the planner sees a blank delivery date on the schedule workbench, and the date the sales order promised is
   * the only basis for the planned start and end.
   */
  it("the schedule workbench expected delivery date is seeded from the order header, not a dead lookup on the staging row", () => {
    const action = requireModule(catalog, "productionOrder").batchActions["releaseProduction"];
    expect(action?.seed["promiseDate"]).toEqual({ from: "header", field: "promiseDate", offsetDays: 0 });

    const draftLine = action?.lineField.fields?.find((field) => field.key === "promiseDate");
    expect(draftLine?.label).toBe("Expected delivery date");
    // A staging row must not keep a lookup. Its match cannot be resolved at this level, and seed is already the only source.
    expect(draftLine?.derive).toBe(null);
  });

  it("the order header expected delivery date is still a live lookup of the sales promise and is not stored as a column", () => {
    const header = productionOrder.fields.find((field) => field.key === "promiseDate");
    expect(header?.derive).toMatchObject({
      kind: "lookup",
      from: "salesOrder",
      match: "salesOrderId",
      field: "promiseDate",
    });
  });

  it("release creates tasks and material requirements directly and no longer creates a productionRelease document", () => {
    expect(catalog.modules.has("productionRelease")).toBe(false);
    expect(RELEASE_FROM.map((from) => transitionAt(productionOrder, from, "release").to)).toEqual([
      "releasing",
      "releasing",
      "inProduction",
    ]);
  });

  it("frozen material has no issue-mode discriminator, and quantity still to issue is planned quantity minus quantity already issued", () => {
    const requirementLines = requireModule(catalog, "materialRequirement").schema.fields.find((field) => field.key === "lines");
    const taskLines = requireModule(catalog, "productionTask").schema.fields.find((field) => field.key === "materialLines");
    expect(requirementLines?.fields?.some((field) => field.key === "issueMode")).toBe(false);
    expect(taskLines?.fields?.some((field) => field.key === "issueMode")).toBe(false);
    expect(taskLines?.fields?.some((field) => field.key === "manualRequiredQty")).toBe(false);
    expect(taskLines?.fields?.find((field) => field.key === "pendingIssueBaseQty")?.derive).toMatchObject({
      kind: "formula",
      expr: { op: "sub", args: [{ field: "baseRequiredQty" }, { field: "issuedBaseQty" }] },
    });
  });
});
