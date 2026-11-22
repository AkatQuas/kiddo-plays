import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { evaluateFormula, evaluateFormulaOrNull, formulaResolverOf, type Field, type NormalizedCheck, seedTransitionParams, visibleTransitions } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

/**
 * Sales order, convert to production, production order. This chain works today because a set of decisions lock together. Any half of them existing alone fails silently. This test pins the joints, not merely whether the edge exists:
 *
 *   1. Factory, both warehouses, and the line BOM and routing on a production order are no longer `required` (otherwise pushing a pending-review document fails to store with 400).
 *   2. Every field that was relaxed is required again on the correct edge (otherwise the gate was dropped, not moved).
 *   3. `awaitingRelease` opens the fields that are decided only at release (otherwise they can never be filled after approval and the document can never be released).
 *   4. Convert-to-production splits by product (target maxRows: 1). The factory is chosen on the dialog line.
 *   5. Planned start and end were removed from the order. The scheduling window lives on the production task, not on the push chain.
 */
const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const productionOrderModule = requireModule(catalog, "productionOrder");
const productionOrder = productionOrderModule.schema;
const releaseAction = productionOrderModule.batchActions["releaseProduction"];
if (releaseAction === undefined) throw new Error("productionOrder is missing the releaseProduction batch action");
const salesOrder = requireModule(catalog, "salesOrder").schema;

const headerField = (key: string) => {
  const found = productionOrder.fields.find((one) => one.key === key);
  if (!found) throw new Error(`productionOrder missing field ${key}`);
  return found;
};

const lineField = (key: string) => {
  const lines = productionOrder.fields.find((one) => one.key === "lines");
  const found = (lines?.fields ?? []).find((one) => one.key === key);
  if (!found) throw new Error(`productionOrder.lines is missing column ${key}`);
  return found;
};

/**
 * After normalization a check is `{ primitive, params }`. `params` is `unknown`
 * (each primitive has its own shape, and the kernel does not unfold that in the type). The shape is asserted in the test, not by the type.
 */
const paramsOf = (check: NormalizedCheck | null | undefined): Record<string, unknown> => {
  if (!check) throw new Error("this rule has no check");
  return check.params as Record<string, unknown>;
};

const ruleIds = (transition: string): readonly string[] =>
  productionOrder.preconditions.filter((rule) => rule.onTransition === transition).map((rule) => rule.id);

describe("sales-033: move the gate onto the correct edge instead of widening it", () => {
  // `required` means required at store time (compiled to a NOT NULL column), including pending review.
  // A sales order has no factory, no warehouse, and no BOM or routing.
  // `buildPushDraft` only carries fields with the same key and type, so the push cannot land unless those fields are relaxed.
  it("factory, both warehouses, and the line BOM and routing are no longer required; planned start and end were removed", () => {
    for (const key of ["productionOrgId", "completionWarehouseId", "issueWarehouseId"]) {
      expect(headerField(key).required, `${key} is still required`).toBe(false);
    }
    expect(productionOrder.fields.some((f) => f.key === "plannedStartDate")).toBe(false);
    expect(productionOrder.fields.some((f) => f.key === "plannedEndDate")).toBe(false);
    for (const key of ["bomId", "routingId"]) {
      expect(lineField(key).required, `lines.${key} is still required`).toBe(false);
    }
  });

  // The other half of the relaxation. Without it the gate was dropped, not moved, and the drop has no symptom.
  // A document with no factory can be approved all the way through until the planner throws 500 at release.
  //
  it("the factory is required again on approve; warehouses are taken line by line on the batch release workbench", () => {
    const submitRequired = productionOrder.preconditions.find((rule) => rule.id === "submit_fields_required");
    expect(submitRequired?.onTransition).toBe("approve");
    expect(submitRequired?.level).toBe("block");
    expect(submitRequired?.check?.primitive).toBe("required_fields");
    expect(paramsOf(submitRequired?.check)["fields"]).toEqual(["productionOrgId"]);

    // The production order no longer has a static release_* warehouse gate. The planner rereads and checks the staging rows for this release.
    expect(productionOrder.preconditions.map((rule) => rule.id)).not.toContain("release_warehouses_required");
    expect(releaseAction.sourceStatuses).toEqual(["awaitingRelease", "releasing", "inProduction"]);
    expect(releaseAction.transition).toBe("release");
    expect(releaseAction.lineField.fields?.some((field) => field.key === "issueWarehouseId")).toBe(true);
    expect(releaseAction.lineField.fields?.some((field) => field.key === "completionWarehouseId")).toBe(true);
  });

  // BOM is required at submit (approval is of an expandable material list). At release the planner rereads effectiveness and ownership by id.
  it("the line BOM fails closed on approve; Schedule production is the same planner action on all three statuses", () => {
    const submitBom = productionOrder.preconditions.find((rule) => rule.id === "submit_bom_matches_product");
    expect(submitBom?.onTransition).toBe("approve");
    expect(submitBom?.level).toBe("block");
    expect(submitBom?.check?.primitive).toBe("ref_field_compare");
    expect(paramsOf(submitBom?.check)).toMatchObject({
      via: { from: "line", field: "bomId" },
      field: "productId",
    });

    expect(productionOrderModule.planners.has("release")).toBe(true);
    expect(productionOrder.lifecycle.transitions.filter((edge) => edge.expandsBills).map((edge) => [edge.code, edge.from]))
      .toEqual([
        ["release", "awaitingRelease"],
        ["release", "releasing"],
        ["release", "inProduction"],
        ["complete", "inProduction"],
        ["complete", "reported"],
        ["cancel", "awaitingRelease"],
        ["cancel", "releasing"],
      ]);
    expect(ruleIds("markReleased")).toEqual(["mark_released_has_allocation"]);
  });

  // Relaxing the fields and opening them for edit are two halves of one decision. If `awaitingRelease` does not open these fields,
  // they can never be filled after approval, the document can never be released, and both declarations still look correct on their own.
  it("awaiting release opens the fields that are decided only at the moment of release", () => {
    const pending = productionOrder.lifecycle.statuses.find((one) => one.key === "awaitingRelease");
    expect(pending?.editable).toBe("whitelist");
    expect(pending?.editableFields).toEqual(["completionWarehouseId", "issueWarehouseId", "lines", "remark"]);
  });

  // releasing and in production deliberately do not open lines. Those statuses already have tasks and reports underneath,
  // and "a line that already has a report cannot change quantity or be deleted" cannot be attached. Preconditions hang only on edges,
  // and editing goes through billRepo.save, which has no precondition hook (the other half of prod-028).
  it("releasing and in production do not open lines; that half is missing platform support, not forgotten", () => {
    for (const key of ["releasing", "inProduction"]) {
      const status = productionOrder.lifecycle.statuses.find((one) => one.key === key);
      expect(status?.editableFields, `${key} opened lines`).not.toContain("lines");
    }
  });
});

describe("sales-032: one sales order becomes one production order per product", () => {
  const edge = salesOrder.lifecycle.transitions.find((one) => one.code === "to_production");

  it("in progress loops to itself, has zero effects, and pushes a production order", () => {
    expect(edge?.from).toBe("inProgress");
    expect(edge?.to).toBe("inProgress");
    expect(edge?.push).toBe("productionOrder");
    expect(edge?.effects ?? []).toHaveLength(0);
  });

  it("only standard production is fixed; the factory is chosen on the dialog line and is not written into pushDefaults", () => {
    expect(edge?.pushDefaults).toEqual({ productionType: "standardProduction" });
    expect(Object.keys(edge?.pushDefaults ?? {})).not.toContain("productionOrgId");
  });

  it("a production order has at most one line: one document, one product, and adding a second line by hand is blocked", () => {
    const lines = productionOrder.fields.find((one) => one.key === "lines");
    expect(lines).toMatchObject({ type: "subtable", required: true, maxRows: 1 });
  });

  it("each convert-to-production dialog line chooses its own factory, and candidates are only the factory level", () => {
    const lineParam = edge?.params.find((one) => one.type === "billLines");
    const factory = lineParam?.lineField?.fields?.find((field) => field.key === "productionOrgId");
    expect(factory).toMatchObject({
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "factory" },
    });
  });

  /**
   * 3.5.x: "a document can be converted only once" became "convert line by line against the remainder".
   *
   * It used to be `not_already_in_production` (the count of live production orders must be 0). The cost was
   * that an order of 1000 pieces with only 300 to make in house could only be converted as the whole 1000.
   * The remainder now sits on the line, and "do not make more" is enforced by `openProductionQty`.
   *
   * This case pins that the old restriction was not simply removed. Convert to production must
   *   1. declare the per-line remainder `lines.openProductionQty` (the push caps against it);
   *   2. carry a "lines to convert this time" parameter (without it there is no way to convert only part);
   *   3. hang a gate that at least one line can still be converted (after everything is converted the edge disappears from the buttons).
   * Miss any one of those and converting again becomes the workshop making the goods twice.
   */
  it("partial convert to production caps against the per-line remainder, and the edge disappears once it is full", () => {
    // Each partial conversion clicks the same Convert to production action. There is no second action.
    expect(salesOrder.lifecycle.transitions.filter((one) => one.push === "productionOrder").map((one) => one.code))
      .toEqual(["to_production"]);
    const edge = salesOrder.lifecycle.transitions.find((one) => one.code === "to_production");
    expect(edge?.push).toBe("productionOrder");
    // 1. The remainder column is quantity that can still be converted to production, not open quantity. Open quantity is the shipping measure and does not subtract what was already converted.
    expect(edge?.remaining).toBe("lines.openProductionQty");
    // 2. A billLines parameter means the dialog can reduce the quantity for this conversion.
    const lineParam = edge?.params.find((one) => one.type === "billLines");
    expect(lineParam?.key, "convert to production has no lines-to-convert parameter").toBe("productionLines");
    // The pairing column must be named salesOrderLineId. The push pairs on the refLine column on the target line that points back at this module.
    expect(lineParam?.lineField?.fields?.map((f) => f.key)).toContain("salesOrderLineId");
    // 3. At least one line can still be converted.
    const rule = salesOrder.preconditions.find((one) => one.id === "has_open_production_qty_to_production");
    expect(rule?.onTransition).toBe("to_production");
    expect(rule?.level).toBe("block");
    expect(rule?.check?.primitive).toBe("lines_any");

    // The one-shot gate is retired. Leaving it in place would make the second partial conversion impossible.
    expect(salesOrder.preconditions.some((one) => one.id === "not_already_in_production")).toBe(false);
  });

  /**
   * Quantity already converted to production is summed per line, and a cancelled production order does not count (cancelling it should allow conversion again).
   * The list is the non-terminal statuses, not "exclude cancelled". A future status missed from this list under-counts quantity already converted
   * (convertible quantity is too high, and that is visible). Missing it from the exclusion list over-counts (it blocks normal business with no symptom).
   */
  it("convertible-to-production quantity subtracts shipment occupancy and quantity already converted, line by line, and floors at zero", () => {
    const lines = salesOrder.fields.find((one) => one.key === "lines") as Field;
    const columns = new Map((lines.fields ?? []).map((f) => [f.key, f] as const));

    const producing = columns.get("producingBaseQty");
    expect(producing?.derive).toMatchObject({
      kind: "rollup",
      from: "productionOrder",
      through: "lines",
      // Look up by line, not by header. The header can only answer whether this order was converted at all.
      match: "salesOrderLineId",
      agg: "sum",
      measure: "baseQty",
    });
    const where = (producing?.derive as { where?: Record<string, unknown> } | null)?.where ?? null;
    expect(where?.["status"]).not.toContain("cancelled");

    // Convertible quantity also subtracts shipment occupancy. Quantity already shipped from stock does not need to be made.
    // After finished goods that were already converted are shipped, the remaining convertible quantity must not go negative.
    // The outer multiply is by canProduce. Raw material and packaging are 0, so skipNonPositive leaves them off the dialog.
    expect(columns.get("canProduce")?.derive).toMatchObject({
      kind: "lookup",
      from: "product",
      match: "productId",
      field: "canProduce",
    });
    expect(columns.get("openProductionBaseQty")?.derive).toMatchObject({
      kind: "formula",
      expr: { op: "mul" },
    });
    expect(columns.get("openProductionQty")).toBeDefined();

    const seed = salesOrder.lifecycle.transitions
      .find((one) => one.code === "to_production")
      ?.params.find((one) => one.key === "productionLines")?.seed;
    expect(seed?.skipNonPositive).toBe("openProductionQty");
    expect(seed).toBeDefined();
    const lineParam = salesOrder.lifecycle.transitions.find((one) => one.code === "to_production")
      ?.params.find((one) => one.key === "productionLines");
    expect(lineParam?.fixedRows).toBe(false);
    expect(lineParam?.readOnlyColumns).toEqual(expect.arrayContaining(["bomId", "routingId"]));
    expect(lineParam?.lineField?.fields?.map((f) => f.key)).toEqual(expect.arrayContaining(["bomId", "routingId"]));
    expect(lineParam?.lineField?.fields?.find((f) => f.key === "bomId")?.required).toBe(true);
    expect(lineParam?.lineField?.fields?.find((f) => f.key === "routingId")?.required).toBe(true);
    expect(salesOrder.preconditions.some((one) => one.id.startsWith("has_default_bom_"))).toBe(false);
    expect(salesOrder.preconditions.some((one) => one.id.startsWith("has_default_routing_"))).toBe(false);
  });

  it.each([
    { qty: 4, occupyingBaseQty: 4, producingBaseQty: 4, unitFactor: 1, canProduce: true, expected: 0 },
    { qty: 10, occupyingBaseQty: 2, producingBaseQty: 3, unitFactor: 1, canProduce: true, expected: 5 },
    { qty: 3, occupyingBaseQty: 4, producingBaseQty: 2, unitFactor: 10, canProduce: true, expected: 2.4 },
    { qty: 10, occupyingBaseQty: 2, producingBaseQty: null, unitFactor: 1, canProduce: true, expected: 8 },
    { qty: 10, occupyingBaseQty: 0, producingBaseQty: 0, unitFactor: 1, canProduce: false, expected: 0 },
  ])("convert-to-production remainder is converted to the main unit and is not below zero: $qty/$occupyingBaseQty/$producingBaseQty", (row) => {
    const fields = salesOrder.fields.find((field) => field.key === "lines")?.fields ?? [];
    const remaining = fields.find((field) => field.key === "openProductionQty")?.derive;
    if (remaining?.kind !== "formula") throw new Error("the sales line is missing the convertible-to-production formula");
    expect(evaluateFormula(remaining.expr, row, formulaResolverOf(fields))).toBe(row.expected);
  });

  it("when the order quantity is not filled yet, the non-negative floor does not disguise an unknown remainder as zero", () => {
    const fields = salesOrder.fields.find((field) => field.key === "lines")?.fields ?? [];
    const remaining = fields.find((field) => field.key === "openProductionQty")?.derive;
    if (remaining?.kind !== "formula") throw new Error("the sales line is missing the convertible-to-production formula");
    expect(evaluateFormulaOrNull(remaining.expr, {
      qty: null, unitFactor: 1, occupyingBaseQty: 0, producingBaseQty: 0, canProduce: true,
    }, formulaResolverOf(fields))).toBeNull();
  });

  it("the convert-to-production dialog does not list raw-material lines, and the button disappears when the whole order cannot be produced", () => {
    const edge = salesOrder.lifecycle.transitions.find((one) => one.code === "to_production");
    expect(edge).toBeDefined();
    const params = seedTransitionParams(edge!, {
      header: { status: "inProgress" },
      lines: {
        lines: [
          { id: "l-fg", productId: "p-fg", qty: 10, producingQty: 0, openProductionQty: 10 },
          { id: "l-rm", productId: "p-rm", qty: 5, producingQty: 0, openProductionQty: 0 },
        ],
      },
    });
    expect(params?.["productionLines"]).toEqual([
      expect.objectContaining({ salesOrderLineId: "l-fg", productId: "p-fg", qty: 10 }),
    ]);

    expect(
      visibleTransitions(salesOrder, "inProgress", {
        header: { status: "inProgress" },
        lines: { lines: [{ openProductionQty: 10 }, { openProductionQty: 0 }] },
      }).some((one) => one.code === "to_production"),
    ).toBe(true);
    expect(
      visibleTransitions(salesOrder, "inProgress", {
        header: { status: "inProgress" },
        lines: { lines: [{ openProductionQty: 0 }, { openProductionQty: 0 }] },
      }).some((one) => one.code === "to_production"),
    ).toBe(false);

    expect(salesOrder.preconditions.some((one) => one.id.endsWith("_product_producible"))).toBe(false);
  });
});

describe("sales-003 / prod-029: when production is cancelled, sales must know, and the order must not get stuck in production", () => {
  it("Cancel hangs a notify to sales, and both awaitingRelease and releasing send it", () => {
    const notices = productionOrder.handoff.filter((one) => one.to === "sales-representative");
    expect(notices.map((one) => [one.id, one.kind, one.onTransition, one.title])).toEqual([
      ["notify_sales_cancel", "notify", "cancel", "Production order cancelled"],
    ]);
    expect(productionOrder.lifecycle.transitions.filter((one) => one.code === "cancel").map((one) => one.from))
      .toEqual(["awaitingRelease", "releasing"]);
  });

  // Cancel while pending review does not notify. Sales has not been told to prepare production yet, so the notice would be noise.
  // Pending review only has the system action that follows the sales order being cancelled, and it does not share the Cancel code.
  it("cancel while pending review does not notify sales", () => {
    const notified = new Set(productionOrder.handoff.map((one) => one.onTransition));
    const fromReview = productionOrder.lifecycle.transitions.filter((one) => one.from === "pendingReview" && one.to === "cancelled");
    expect(fromReview.map((one) => one.code)).toEqual(["forceCancelFromReview"]);
    for (const one of fromReview) expect(notified.has(one.code), one.code).toBe(false);
  });

  it("the sales order has no dead status such as awaiting stocking that has no outgoing edge", () => {
    for (const status of salesOrder.lifecycle.statuses) {
      const outbound = salesOrder.lifecycle.transitions.filter((t) => t.from === status.key);
      if (status.terminal) continue;
      expect(outbound.length, `Status "${status.key}" has no outgoing transition`).toBeGreaterThan(0);
    }
  });

  it("cancel and complete still have a planner, but they no longer write the sales order status back", () => {
    for (const code of ["complete", "cancel"]) {
      expect(productionOrderModule.planners.has(code), `${code} has no planner that writes the sales order back`).toBe(true);
    }
    expect(productionOrderModule.planners.has("syncComplete")).toBe(false);
    expect(salesOrder.lifecycle.transitions.some((one) =>
      one.code === "releaseToShip" || one.code === "releaseToShipping" || one.code === "releaseToComplete",
    )).toBe(false);
  });
});

describe("prod-020: release allocation is judged line by line, not for the whole document", () => {
  // A whole-document measure and a per-line measure are not the same gate. On a two-line order, product A is scheduled for 200
  // and product B is not scheduled at all. The document total is still at least the document quantity, so it would pass, while product B's line has no work.
  // The fully-allocated gate hangs on order completion. Partial start is allowed while converting to production, but the order cannot be closed before scheduling is finished.
  it("dispatch_allocated_in_full is judged on $line.id times sourceOrderLineId and blocks on sync task complete", () => {
    const rule = productionOrder.preconditions.find((one) => one.id === "dispatch_allocated_in_full");
    expect(rule?.onTransition).toBe("syncComplete");
    expect(rule?.check?.primitive).toBe("related_agg");
    expect(paramsOf(rule?.check)).toMatchObject({
      on: "$line.id",
      match: "sourceOrderLineId",
      right: { ref: "$line.baseQty" },
      // Allocated quantity is produced by production tasks. This document itself is not in that line set.
      plus: null,
    });
    expect(productionOrder.preconditions.some((one) => one.onTransition === "startProduction")).toBe(false);
  });
});
