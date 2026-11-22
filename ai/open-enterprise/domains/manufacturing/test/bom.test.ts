import { describe, expect, it } from "vitest";
import { editableFields, type ExecutionCommand, type PlannerContext, sealModule, uniqueSitesOf, validateModule } from "@open-erp/metamodel";
import bomDraft, { planners } from "../modules/bom/index.js";

const bom = sealModule(bomDraft, { code: "bom", domain: "manufacturing" });

describe("BOM", () => {
  it("passes the single-module semantic gate", () => {
    expect(validateModule(bom).errors).toEqual([]);
  });

  it("the version unique coordinate is productId × version, not one column and not productId alone", () => {
    const version = bom.fields.find((f) => f.key === "version");
    expect(version).toMatchObject({
      unique: true,
      uniqueWith: ["productId"],
      required: false,
      systemGenerated: true,
    });
    // productId itself must not be unique: that collapses to "each product can have only one BOM"
    expect(bom.fields.find((f) => f.key === "productId")?.unique).toBe(false);

    const sites = uniqueSitesOf(bom, {
      productId: "p-motor-750",
      version: "V1.0",
    });
    expect(sites).toEqual([
      {
        key: "version",
        path: "version",
        label: "Version",
        value: "V1.0",
        with: [{ key: "productId", value: "p-motor-750", label: "Product" }],
      },
    ]);
  });

  it("create starts active, and an active BOM cannot be edited", () => {
    const active = bom.lifecycle.statuses.find((s) => s.key === "active");
    expect(active).toMatchObject({ initial: true, editable: "none" });
    expect(bom.lifecycle.statuses.some((s) => s.key === "draft")).toBe(false);
    expect(bom.lifecycle.transitions.some((edge) => edge.code === "activate")).toBe(false);
    expect(editableFields(bom, "active")).toEqual([]);
    expect(bom.lifecycle.statuses.find((s) => s.key === "active")?.editable).toBe("none");
  });

  it("BOM structure is checked on create", () => {
    for (const id of ["lines_required", "quantity_positive", "loss_non_negative", "no_self_component", "no_recursive_component_cycle"]) {
      expect(bom.preconditions.find((precondition) => precondition.id === id)).toMatchObject({
        onTransition: "*",
        onCreate: true,
      });
    }
  });

  it("a product has only one active BOM at a time, and activating one drops the product's older versions", () => {
    // This is no longer a unique field or a single_default_bom precondition. It is lifecycle singleActiveWithin:
    // entering active reclassifies the product's other active records to disabled in the same transaction.
    expect(bom.preconditions.some((p) => p.id === "single_default_bom")).toBe(false);
    expect(bom.fields.some((f) => f.key === "isDefault")).toBe(false);
    expect(bom.lifecycle.singleActiveWithin).toEqual({
      within: ["productId"],
      status: "active",
      supersedeTo: "disabled",
    });
  });

  it("effective date is an audit field written on first activation, and it is not on the user write surface", () => {
    expect(bom.fields.find((f) => f.key === "effectiveDate")).toMatchObject({
      type: "date",
      systemGenerated: true,
      required: false,
      stampOnFirstEnter: { status: "active" },
    });
    expect(bom.preconditions.some((p) => p.id === "effective_date_required")).toBe(false);
  });

  it("lines no longer declare a child BOM version field", () => {
    const lines = bom.fields.find((f) => f.key === "lines");
    expect(lines?.fields?.some((f) => f.key === "childBomId")).toBe(false);
  });

  it("createVersion takes no parameters and does not decide a default pointer", () => {
    const edge = bom.lifecycle.transitions.find((t) => t.code === "createVersion");
    expect(edge).toMatchObject({ from: "active", to: "active", action: "New version from this", confirm: true });
    expect(edge?.params ?? []).toHaveLength(0);
    expect(edge?.params?.some((p) => p.key === "defaultMode") ?? false).toBe(false);
  });

  it("createVersion plan: the new draft copies only business columns and carries no default mark", async () => {
    const ctx: PlannerContext = {
      module: "bom",
      transition: "createVersion",
      bill: {
        id: "bom-v1",
        revision: 1,
        header: { status: "active", productId: "p-motor-750", version: "V1.0" },
        lines: {
          lines: [
            {
              id: "line-1",
              lineNo: 1,
              componentProductId: "p-core",
              unitQty: 1,
              lossRate: 2,
              unit: "piece",
              unitFactor: 1,
              baseUnitQty: 1,
              defaultIssueWarehouseId: "wh-1",
              childBomId: "bom-core-v1",
            },
            {
              id: "line-2",
              lineNo: 2,
              componentProductId: "p-coil",
              unitQty: 2,
              lossRate: 0,
              unit: "piece",
              defaultIssueWarehouseId: "wh-2",
            },
          ],
        },
      },
      params: {},
      read: {
        async getBill() { throw new Error("createVersion does not read other documents"); },
        async listBills() { throw new Error("createVersion does not list other documents"); },
        async invariantBillSummary() { throw new Error("createVersion does not read invariants"); },
        async invariantLineSummary() { throw new Error("createVersion does not read invariants"); },
      },
    };
    const plan = await planners.createVersion(ctx);
    const created = plan.commands.filter(
      (command): command is Extract<ExecutionCommand, { type: "createBill" }> => command.type === "createBill",
    );
    expect(created).toHaveLength(1);
    expect(created[0]?.header).toEqual({
      productId: "p-motor-750",
      remark: null,
    });
    const lines = created[0]?.lines["lines"] ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      componentProductId: "p-core",
      unitQty: 1,
      lossRate: 2,
      unit: "piece",
      defaultIssueWarehouseId: "wh-1",
    });
    expect(lines[0]).not.toHaveProperty("id");
    expect(lines[0]).not.toHaveProperty("lineNo");
    expect(lines[0]).not.toHaveProperty("childBomId");
    expect(lines[1]).toMatchObject({
      componentProductId: "p-coil",
      unitQty: 2,
      lossRate: 0,
      unit: "piece",
      defaultIssueWarehouseId: "wh-2",
    });
    expect(lines[1]).not.toHaveProperty("id");
    expect(lines[1]).not.toHaveProperty("lineNo");
  });
});
