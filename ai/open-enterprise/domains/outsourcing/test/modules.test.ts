import {
  evaluateTransition,
  type Field,
  isSystemSupplied,
  type ModuleSchema,
  referenceComparisonOf,
  sealModule,
  transitionAt,
  validateModule,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import subcontractIssueDraft from "../modules/subcontractIssue.js";
import subcontractMaterialReturnDraft from "../modules/subcontractMaterialReturn/index.js";
import subcontractOrderDraft, { planners as subcontractOrderPlanners } from "../modules/subcontractOrder/index.js";
import subcontractReceiptDraft from "../modules/subcontractReceipt/index.js";
import subcontractReturnDraft from "../modules/subcontractReturn.js";

const subcontractIssue = sealModule(subcontractIssueDraft, { code: "subcontractIssue", domain: "outsourcing" });
const subcontractMaterialReturn = sealModule(subcontractMaterialReturnDraft, { code: "subcontractMaterialReturn", domain: "outsourcing" });
const subcontractOrder = sealModule(subcontractOrderDraft, { code: "subcontractOrder", domain: "outsourcing" });
const subcontractReceipt = sealModule(subcontractReceiptDraft, { code: "subcontractReceipt", domain: "outsourcing" });
const subcontractReturn = sealModule(subcontractReturnDraft, { code: "subcontractReturn", domain: "outsourcing" });

const outsourcingModules = [
  subcontractOrder,
  subcontractIssue,
  subcontractMaterialReturn,
  subcontractReceipt,
  subcontractReturn,
] as const;

function headerField(module: ModuleSchema, key: string): Field {
  const field = module.fields.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`${module.code} missing field ${key}`);
  return field;
}

function lineField(module: ModuleSchema, table: string, key: string): Field {
  const tableField = headerField(module, table);
  const field = tableField.fields?.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`${module.code}.${table} missing field ${key}`);
  return field;
}

function transition(module: ModuleSchema, code: string) {
  const edge = module.lifecycle.transitions.find((candidate) => candidate.code === code);
  if (!edge) throw new Error(`${module.code} is missing transition ${code}`);
  return edge;
}

describe("Outsourcing closed-loop contract", () => {
  it("the five subcontract fact documents pass the semantic gate", () => {
    for (const module of outsourcingModules) expect(validateModule(module).errors, module.code).toEqual([]);
  });

  it("subcontract documents have no draft: create starts in a writable to-do state, and cancel leaves the initial state", () => {
    const expected = [
      [subcontractOrder, "pendingReview", null],
      [subcontractIssue, "awaitingIssueOut", "cancel"],
      [subcontractReceipt, "awaitingReceipt", "cancel"],
      [subcontractReturn, "awaitingReturn", "cancel"],
      [subcontractMaterialReturn, "pending", "cancel"],
    ] as const;
    for (const [module, initial, cancel] of expected) {
      const statuses = module.lifecycle.statuses;
      expect(statuses.some((status) => status.key === "draft"), module.code).toBe(false);
      expect(statuses.find((status) => status.initial)).toMatchObject({ key: initial, editable: "full" });
      for (const code of ["submit", "withdraw", "reject"] as const) {
        expect(module.lifecycle.transitions.some((edge) => edge.code === code), `${module.code}.${code}`).toBe(false);
      }
      if (cancel === null) continue;
      expect(transition(module, cancel)).toMatchObject({ from: initial, to: "cancelled" });
    }
    expect(subcontractOrder.handoff.find((item) => item.id === "notify_approver")).toMatchObject({
      onStatus: "pendingReview",
    });
  });

  it("a subcontract order is created by hand: the production task is only on the line, and one order can take several tasks", () => {
    expect(headerField(subcontractOrder, "supplierId")).toMatchObject({
      type: "ref",
      ref: "supplier",
      required: true,
    });
    expect(headerField(subcontractOrder, "plannedDeliveryDate")).toMatchObject({
      type: "date",
      required: true,
      createDefault: "today",
    });
    // The header has no productionTaskId. That field was left over from the push shape "one task = one order".
    expect(subcontractOrder.fields.some((field) => field.key === "productionTaskId")).toBe(false);
    expect(lineField(subcontractOrder, "lines", "productionTaskId")).toMatchObject({
      type: "ref",
      ref: "productionTask",
      required: true,
      // A whole-order subcontract can be created while pending review. The approval gate accepts pending review, awaitingLaunch, and inProduction.
      refFilter: { status: ["pendingReview", "awaitingLaunch", "inProduction"] },
    });
    expect(subcontractOrder.fields.some((field) => ["productionOrderId", "operationId"].includes(field.key))).toBe(false);
    expect(headerField(subcontractOrder, "processAssignmentId")).toMatchObject({
      type: "string",
      hidden: true,
      required: false,
    });
    const lines = headerField(subcontractOrder, "lines");
    expect(lines.fields?.some((field) => ["operationId", "orderLineId"].includes(field.key))).toBe(false);
    expect(lineField(subcontractOrder, "lines", "productId").snapshot).toEqual({
      from: "productionTask",
      match: "productionTaskId",
      through: null,
      field: "productId",
    });
    expect(lineField(subcontractOrder, "lines", "skuCode").derive).toEqual({
      kind: "lookup",
      from: "product",
      match: "productId",
      through: null,
      field: "barcode",
    });
    expect(lineField(subcontractOrder, "lines", "unit").refDefault).toEqual({
      from: "productionTask",
      match: "productionTaskId",
      through: null,
      field: "unit",
    });
    expect(lineField(subcontractOrder, "lines", "qty").refDefault).toEqual({
      from: "productionTask",
      match: "productionTaskId",
      through: null,
      field: "plannedQty",
    });
    const wholeTask = subcontractOrder.preconditions.find((rule) => rule.id === "whole_task_qty");
    expect(wholeTask).toMatchObject({ onTransition: "approve" });
    if (!wholeTask?.check) throw new Error("subcontractOrder is missing the whole-order subcontract quantity gate");
    expect(referenceComparisonOf(wholeTask.check)).toMatchObject({
      via: { from: "line", field: "productionTaskId" },
      entity: "productionTask",
      field: "basePlannedQty",
      op: "eq",
      right: { ref: "$line.baseQty" },
    });
    expect(subcontractOrder.preconditions.map((rule) => rule.id)).not.toContain("whole_task_qty_at_approve");
    const taskState = subcontractOrder.preconditions.find((rule) => rule.id === "task_pending_launch");
    if (!taskState?.check) throw new Error("subcontractOrder is missing the whole-order subcontract task-status gate");
    expect(referenceComparisonOf(taskState.check)).toMatchObject({
      entity: "productionTask",
      field: "status",
      op: "in",
      right: { value: ["pendingReview", "awaitingLaunch", "inProduction"] },
    });
  });

  it("subcontract order actions only create issue and receipt facts, not an operation-subcontract document", () => {
    // approve and unapprove are planner edges too. They move each production task on the lines
    // to "inProduction" or back to "awaitingLaunch". They create no document.
    expect(Object.keys(subcontractOrderPlanners)).toEqual([
      "approve",
      "unapprove",
      "issue",
      "receive",
      "finish",
      "close",
      "close_processing",
    ]);
    expect(transition(subcontractOrder, "issue").push).toBeNull();
    expect(transition(subcontractOrder, "issue").primary).toBe(true);
    // awaitingOutsource, processing, and completed share the same "Receive subcontract" action. Processing is the primary button.
    const receiveEdges = subcontractOrder.lifecycle.transitions.filter((edge) => edge.code === "receive");
    expect(receiveEdges
      .map((edge) => [edge.from, edge.to, edge.action, edge.push, edge.primary])).toEqual([
      ["awaitingOutsource", "processing", "Receive subcontract", null, false],
      ["processing", "processing", "Receive subcontract", null, true],
      ["completed", "completed", "Receive subcontract", null, false],
    ]);
    expect(receiveEdges.map((edge) => edge.params.map((param) => param.key))).toEqual([
      ["receiptDate", "warehouseId", "receiptRemark", "receiveLinesJson"],
      ["receiptDate", "warehouseId", "receiptRemark", "receiveLinesJson"],
      ["receiptDate", "warehouseId", "receiptRemark", "receiveLinesJson"],
    ]);
    expect(receiveEdges[0]?.params.find((param) => param.key === "warehouseId")).toMatchObject({
      type: "ref",
      ref: "warehouse",
      required: false,
    });
    expect(transitionAt(subcontractOrder, "completed", "forceCancel")).toMatchObject({
      from: "completed",
      to: "cancelled",
      internal: true,
    });
    expect(subcontractOrder.lifecycle.statuses.map((status) => status.key)).toContain("cancelled");
    expect(subcontractOrder.lifecycle.transitions.some((edge) => edge.from === "closedOut" && edge.action === "Receive subcontract")).toBe(false);
  });

  it("completing, closing, and ending a subcontract order all close the source production tasks in the planner", () => {
    for (const code of ["finish", "close", "close_processing"] as const) {
      expect(transition(subcontractOrder, code).push).toBeNull();
    }
  });

  it("Receive subcontract blocks an ended production task declaratively before the planner runs", () => {
    for (const [ruleId, taskStatuses] of [
      ["receive_task_active", { op: "eq", right: { value: "inProduction" } }],
      ["receive_after_complete_task_open", { op: "in", right: { value: ["inProduction", "completed"] } }],
    ] as const) {
      const rule = subcontractOrder.preconditions.find((candidate) => candidate.id === ruleId);
      expect(rule).toMatchObject({
        onTransition: "receive",
        source: "gate",
        level: "block",
      });
      if (!rule?.check) throw new Error(`subcontractOrder is missing precondition ${ruleId}`);
      expect(referenceComparisonOf(rule.check)).toMatchObject({
        via: { from: "line", field: "productionTaskId" },
        entity: "productionTask",
        field: "status",
        ...taskStatuses,
      });
    }
    for (const [ruleId, when] of [
      ["receive_task_active", { op: "ne" }],
      ["receive_after_complete_task_open", { op: "eq" }],
    ] as const) {
      expect(subcontractOrder.preconditions.find((rule) => rule.id === ruleId)?.when).toMatchObject({
        primitive: "field_compare",
        params: { left: { ref: "$bill.status" }, ...when, right: { value: "completed" } },
      });
    }
    // "Some task is not fully received" has no declared form. related_agg on "$line.x" is a per-line universal quantifier.
    // On a multi-task order, "A is fully received and B is not" is normal, and that gate would block the whole order when the first task fills up.
    // The judgment lives in receiptPlan: skip lines that are full, and refuse only when every line is full.
    expect(subcontractOrder.preconditions.map((rule) => rule.id)).not.toContain("receive_more_remaining");
    expect(subcontractOrder.preconditions.map((rule) => rule.id)).toEqual(expect.arrayContaining([
      "task_pending_launch",
      "no_other_active_order",
    ]));
    expect(subcontractOrder.preconditions.find((rule) => rule.id === "no_other_active_order")?.check).toMatchObject({
      primitive: "related_agg",
      params: {
        where: {
          status: ["awaitingOutsource", "processing"],
          sourceType: ["Whole-order subcontract", "Other subcontract"],
        },
      },
    });
  });

  it("receipt picks the gate from the order status: before completion the task must be in production, and a catch-up receipt after completion allows in production or completed", async () => {
    async function receiveOn(orderStatus: string, taskStatus: string) {
      return await evaluateTransition(
        {
          module: subcontractOrder,
          bill: { id: "sub-order-1", status: orderStatus, supplierId: "supplier-1", sourceType: "Whole-order subcontract" },
          lines: [{ id: "sub-order-line-1", productionTaskId: "task-1" }],
          params: {},
          actor: { id: "u1" },
          now: new Date("2026-09-20T08:00:00.000Z"),
          query: {
            get: async (entity, id) => entity === "productionTask" && id === "task-1" ? { status: taskStatus } : null,
            list: async () => [],
            balance: async () => 0,
          },
        },
        "receive",
      );
    }
    const verdictOf = async (orderStatus: string, taskStatus: string) => {
      const decision = await receiveOn(orderStatus, taskStatus);
      const rules = Object.fromEntries(decision.checks
        .filter((check) => check.id === "receive_task_active" || check.id === "receive_after_complete_task_open")
        .map((check) => [check.id, check.skipped ? "skipped" : check.ok ? "pass" : "block"]));
      return { pass: decision.verdict.pass, to: decision.to, rules };
    };

    for (const orderStatus of ["awaitingOutsource", "processing"]) {
      expect(await verdictOf(orderStatus, "inProduction")).toEqual({
        pass: true,
        to: "processing",
        rules: { receive_task_active: "pass", receive_after_complete_task_open: "skipped" },
      });
      expect(await verdictOf(orderStatus, "completed")).toEqual({
        pass: false,
        to: "processing",
        rules: { receive_task_active: "block", receive_after_complete_task_open: "skipped" },
      });
    }
    expect(await verdictOf("completed", "completed")).toEqual({
      pass: true,
      to: "completed",
      rules: { receive_task_active: "skipped", receive_after_complete_task_open: "pass" },
    });
    expect(await verdictOf("completed", "cancelled")).toEqual({
      pass: false,
      to: "completed",
      rules: { receive_task_active: "skipped", receive_after_complete_task_open: "block" },
    });
    await expect(receiveOn("closedOut", "inProduction")).rejects.toThrow(
      'This document is "closedOut" and cannot "Receive subcontract" (receive). This document has no actions available right now.',
    );
  });

  it("an issue line's only input is the production task's default BOM line, and it moves raw material from the sending warehouse into the subcontract WIP warehouse", () => {
    expect(headerField(subcontractIssue, "orderId")).toMatchObject({ type: "ref", ref: "subcontractOrder", required: true });
    expect(lineField(subcontractIssue, "materialLines", "taskLineId")).toMatchObject({
      type: "refLine",
      ref: "bom",
      through: "lines",
      required: true,
    });
    expect(isSystemSupplied(lineField(subcontractIssue, "materialLines", "productId"), headerField(subcontractIssue, "materialLines").fields ?? [])).toBe(true);
    expect(lineField(subcontractIssue, "materialLines", "qty").refDefault).toBeNull();
    expect(lineField(subcontractIssue, "materialLines", "requirementBaseQty").derive).toMatchObject({ kind: "formula" });
    expect(lineField(subcontractIssue, "materialLines", "bomUnitQty").snapshot).toMatchObject({ from: "bom", through: "lines", field: "baseUnitQty" });
    expect(lineField(subcontractIssue, "materialLines", "productionQty").snapshot).toMatchObject({ from: "productionTask", field: "plannedQty" });
    // The second book of "actually issued" (a rollup from warehouseDemand) is gone. The confirm edge posts stock itself,
    // the issue document is the warehouse fact, and leftover quantity uses this line's issue quantity.
    expect(() => lineField(subcontractIssue, "materialLines", "issuedBaseQty")).toThrow(/missing field/);
    expect(lineField(subcontractIssue, "materialLines", "unclosedBaseQty").derive).toMatchObject({
      kind: "formula",
      expr: { op: "sub", args: [{ field: "baseQty" }, { op: "add", args: [{ field: "returnedBaseQty" }, { field: "confirmedLossBaseQty" }] }] },
    });
    expect(() => lineField(subcontractIssue, "materialLines", "standardConsumedBaseQty")).toThrow(/missing field/);
    expect(lineField(subcontractIssue, "materialLines", "returnedBaseQty").derive).toMatchObject({ kind: "rollup", from: "subcontractMaterialReturn", where: { status: "returned" } });
    expect(lineField(subcontractIssue, "materialLines", "confirmedLossBaseQty").derive).toMatchObject({ kind: "rollup", from: "subcontractMaterialReturn", where: { status: "lossConfirmed" } });
    expect(() => lineField(subcontractIssue, "materialLines", "standardAllocatedBaseQty")).toThrow(/missing field/);
    expect(lineField(subcontractIssue, "materialLines", "unclosedBaseQty").derive).toMatchObject({ kind: "formula" });
    // The header no longer has a production task, so `task_matches_header` is gone. That gate compared exactly that cell.
    expect(subcontractIssue.fields.some((field) => field.key === "productionTaskId")).toBe(false);
    expect(subcontractIssue.preconditions.map((rule) => rule.id)).toEqual(expect.arrayContaining(["not_over_bom", "not_below_standard"]));
    expect(subcontractIssue.preconditions.map((rule) => rule.id)).not.toContain("task_matches_header");
    // `not_over_bom` must compare line by line inside this document. It must not go back to related_agg.
    // That gate's pair key `taskLineId` points at a BOM line (master data shared by every production task of the same product),
    // so the left side counted every task and the right side counted only this task. The second subcontract order for the same product was always blocked by mistake.
    expect(subcontractIssue.preconditions.find((rule) => rule.id === "not_over_bom")?.check).toMatchObject({
      primitive: "lines_all",
      params: {
        left: { ref: "$line.baseQty" },
        op: "lte",
        right: { ref: "$line.requirementBaseQty" },
      },
    });
    expect(transition(subcontractIssue, "confirm").effects?.map((effect) => [effect.op, effect.scope?.field, effect.amount])).toEqual([
      ["out", "warehouseId", { kind: "field", from: "line", field: "baseQty" }],
      ["in", "targetWarehouseId", { kind: "field", from: "line", field: "baseQty" }],
    ]);
  });

  it("a receipt references the subcontract order, and the line references the production task; quantity is the qualified amount confirmed offline as ready to receive", () => {
    expect(headerField(subcontractReceipt, "orderId")).toMatchObject({ type: "ref", ref: "subcontractOrder", required: true });
    expect(subcontractReceipt.fields.some((field) => field.key === "productionTaskId")).toBe(false);
    expect(lineField(subcontractReceipt, "lines", "orderLineId")).toMatchObject({
      type: "refLine",
      ref: "subcontractOrder",
      through: "lines",
    });
    expect(lineField(subcontractReceipt, "lines", "orderId")).toMatchObject({ type: "ref", ref: "subcontractOrder" });
    expect(lineField(subcontractReceipt, "lines", "productionTaskId")).toMatchObject({ type: "ref", ref: "productionTask", required: true });
    expect(lineField(subcontractReceipt, "lines", "qty").refDefault?.field).toBe("plannedQty");
    expect(lineField(subcontractReceipt, "lines", "qualifiedQty")).toMatchObject({ type: "number" });
    expect(lineField(subcontractReceipt, "lines", "defectQty")).toMatchObject({ type: "number" });
    expect(lineField(subcontractReceipt, "lines", "defectDeduction")).toMatchObject({ type: "money" });
    expect(lineField(subcontractReceipt, "lines", "defectTypeIds")).toMatchObject({ type: "string" });
    expect(subcontractReceipt.fields.flatMap((field) => field.fields ?? []).some((field) =>
      ["qualifiedBaseQty", "unqualifiedQty"].includes(field.key),
    )).toBe(false);
    expect(lineField(subcontractReceipt, "lines", "amount").derive).toEqual({
      kind: "formula",
      expr: { op: "mul", args: [{ field: "qty" }, { field: "taxPrice" }] },
    });
    expect(subcontractReceipt.preconditions.map((rule) => rule.id)).not.toContain("not_over_task");
    expect(subcontractReceipt.preconditions.find((rule) => rule.id === "receipt_reverse_without_active_returns")).toBeUndefined();
    expect(subcontractReceipt.preconditions.map((rule) => rule.id)).not.toContain("task_matches_header");
    expect(transition(subcontractReceipt, "confirm").effects?.map((effect) => [effect.target, effect.amount])).toEqual([
      ["stock", { kind: "field", from: "line", field: "baseQty" }],
      ["ap", { kind: "field", from: "bill", field: "totalAmount" }],
    ]);
  });

  it("a material return defaults to 0 and must be changed to a positive number before confirm, and the cumulative quantity cannot exceed the issue line", () => {
    expect(lineField(subcontractIssue, "materialLines", "returnQty").derive).toMatchObject({ kind: "formula", expr: { value: 0 } });
    expect(lineField(subcontractMaterialReturn, "materialLines", "issueLineId")).toMatchObject({
      type: "refLine",
      ref: "subcontractIssue",
      through: "materialLines",
      required: true,
    });
    expect(lineField(subcontractMaterialReturn, "materialLines", "qty")).toMatchObject({ required: true, pushFrom: "returnQty" });
    expect(subcontractMaterialReturn.preconditions.map((rule) => rule.id)).toEqual(expect.arrayContaining(["qty_positive", "not_over_issue"]));
    expect(lineField(subcontractMaterialReturn, "materialLines", "issueLineBaseQty").derive).toMatchObject({ kind: "lookup", field: "baseQty" });
    expect(headerField(subcontractMaterialReturn, "handlingType")?.options?.map((option) => option.value)).toEqual([
      "Return to warehouse",
      "Confirm loss",
    ]);
    expect(headerField(subcontractMaterialReturn, "remark")).toMatchObject({ type: "text", label: "Handling note" });
    expect(subcontractMaterialReturn.preconditions.find((rule) => rule.id === "loss_reason_required")).toMatchObject({
      onTransition: "releaseLossDemand",
      message: "Before confirming material scrap, write the reason in the handling note",
      check: { primitive: "required_fields", params: { fields: ["remark"] } },
      when: { primitive: "field_compare" },
    });
    expect(transition(subcontractMaterialReturn, "releaseDemand").push).toBeNull();
    expect(transition(subcontractMaterialReturn, "releaseLossDemand").push).toBeNull();
    expect(subcontractMaterialReturn.lifecycle.transitions.find((edge) => edge.code === "completeLoss")).toBeUndefined();
    expect(subcontractMaterialReturn.lifecycle.transitions.find((edge) => edge.code === "confirm")).toBeUndefined();
  });

  it("a subcontract goods return references only the receipt and the receipt line", () => {
    expect(headerField(subcontractReturn, "receiptId")).toMatchObject({ type: "ref", ref: "subcontractReceipt", required: true });
    expect(lineField(subcontractReturn, "lines", "receiptLineId")).toMatchObject({ type: "refLine", ref: "subcontractReceipt", through: "lines", required: true });
    expect(lineField(subcontractReturn, "lines", "orderLineId").snapshot).toMatchObject({
      from: "subcontractReceipt",
      match: "receiptLineId",
      through: "lines",
      field: "orderLineId",
    });
    expect(subcontractReturn.fields.some((field) => ["productionOrderId", "operationId", "orderLineId", "productionTaskId"].includes(field.key))).toBe(false);
    expect(lineField(subcontractReturn, "lines", "productionTaskId").snapshot).toMatchObject({ from: "subcontractReceipt", through: "lines" });
    expect(subcontractReturn.preconditions.map((rule) => rule.id)).toEqual(expect.arrayContaining(["receipt_posted", "not_over_return"]));
  });

  it("receipt and return progress sum by the order line, not across documents or operations by production task", () => {
    expect(lineField(subcontractOrder, "lines", "receivedBaseQty").derive).toMatchObject({
      kind: "rollup",
      from: "subcontractReceipt",
      through: "lines",
      match: "orderLineId",
      where: { status: "received" },
    });
    expect(lineField(subcontractOrder, "lines", "returnedBaseQty").derive).toMatchObject({
      kind: "rollup",
      from: "subcontractReturn",
      through: "lines",
      match: "orderLineId",
      where: { status: "returnedGoods" },
    });
  });

  it("confirming a subcontract issue or receipt posts immediately and is not handed to the warehouse", () => {
    expect(transition(subcontractIssue, "confirm")).toMatchObject({
      from: "awaitingIssueOut",
      to: "issuedOut",
      primary: true,
      push: null,
    });
    expect(transition(subcontractIssue, "confirm").effects.some((effect) => effect.target === "stock")).toBe(true);
    expect(subcontractIssue.lifecycle.transitions.find((edge) => edge.code === "releaseDemand")).toBeUndefined();

    expect(transition(subcontractReceipt, "confirm")).toMatchObject({
      from: "awaitingReceipt",
      to: "received",
      primary: true,
      push: null,
    });
    expect(transition(subcontractReceipt, "confirm").effects.some((effect) => effect.target === "stock")).toBe(true);

    const materialReturnRelease = transition(subcontractMaterialReturn, "releaseDemand");
    expect(materialReturnRelease).toMatchObject({ from: "pending", to: "returned", primary: true, push: null });
    expect(materialReturnRelease.effects.some((effect) => effect.target === "stock")).toBe(true);
    expect(subcontractMaterialReturn.fields.find((field) => field.key === "postingModel")).toBeUndefined();
    expect(subcontractIssue.fields.find((field) => field.key === "postingModel")).toBeUndefined();
  });

  it("subcontract issue and material return name both warehouses; a receipt line records qualified and defect quantities without a second quality-inspection entry", () => {
    expect(headerField(subcontractIssue, "warehouseId").ref).toBe("warehouse");
    expect(headerField(subcontractIssue, "targetWarehouseId").ref).toBe("warehouse");
    expect(lineField(subcontractMaterialReturn, "materialLines", "warehouseId")).toMatchObject({
      ref: "warehouse",
      snapshot: { from: "subcontractIssue", match: "issueId", through: null, field: "targetWarehouseId" },
    });
    expect(lineField(subcontractMaterialReturn, "materialLines", "targetWarehouseId")).toMatchObject({
      ref: "warehouse",
      snapshot: { from: "subcontractIssue", match: "issueId", through: null, field: "warehouseId" },
    });

    const receiptColumns = headerField(subcontractReceipt, "lines").fields ?? [];
    expect(receiptColumns.map((field) => field.key)).toEqual(expect.arrayContaining([
      "qualifiedQty", "defectQty", "defectDeduction", "defectTypeIds",
    ]));
    expect(receiptColumns.some((field) =>
      ["qualifiedBaseQty", "unqualifiedQty", "qualityGrade"].includes(field.key),
    )).toBe(false);
    expect(lineField(subcontractReceipt, "lines", "baseUnitPrice").calculate).toMatchObject({ op: "div" });
    expect(lineField(subcontractReturn, "lines", "baseUnitPrice").calculate).toMatchObject({ op: "div" });
  });
});
