import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import processReportDraft from "../modules/processReport/index.js";

const processReport = sealModule(processReportDraft, { code: "processReport", domain: "productionProcess" });

const field = (key: string) => {
  const hit = processReport.fields.find((candidate) => candidate.key === key);
  if (!hit) throw new Error(`missing field ${key}`);
  return hit;
};

describe("Work-report fact", () => {
  it("passes the semantic gate; in-house work writes the worker from the assignment planner and subcontract leaves it empty, so it cannot be marked plannerSupplied", () => {
    expect(validateModule(processReport).errors).toEqual([]);
    // A work report now carries two kinds: in-house hangs on an assignment, and subcontract hangs on a subcontract receipt (see reportType). The assignment is therefore optional,
    // and each planner supplies the source on its own path.
    expect(field("processAssignmentId")).toMatchObject({ type: "ref", ref: "processAssignment", required: false });
    expect(field("reportType")).toMatchObject({ type: "enum" });
    expect(field("subcontractReceiptId")).toMatchObject({ type: "ref", ref: "subcontractReceipt" });
    expect(field("subcontractSupplierId")).toMatchObject({ type: "ref", ref: "supplier" });
    // In-house writes the worker from the assignment planner. Subcontract leaves the worker empty (the supplier is on subcontractSupplierId).
    // The two paths leave the other side blank, so the field cannot be marked plannerSupplied, and it is no longer snapshotted from the assignment.
    expect(field("workerId")?.plannerSupplied).toBeFalsy();
    expect(field("workerId")?.snapshot).toBeNull();
    // A subcontract report has no assignment, so the SKU can no longer be copied from the assignment. Both paths write productId and freeze the product barcode directly.
    expect(field("productBarcode").snapshot).toMatchObject({
      from: "product",
      match: "productId",
      field: "barcode",
    });
    // Product name, specification, specification remark, and task quantity also cannot be copied from the assignment. Both paths write the production task.
    expect(field("productName").snapshot).toMatchObject({
      from: "productionTask",
      match: "productionTaskId",
      field: "productName",
    });
    expect(field("spec").snapshot).toMatchObject({
      from: "productionTask",
      match: "productionTaskId",
      field: "spec",
    });
    expect(field("productRemark").snapshot).toMatchObject({
      from: "productionTask",
      match: "productionTaskId",
      field: "productRemark",
    });
    expect(field("taskQty").snapshot).toMatchObject({
      from: "productionTask",
      match: "productionTaskId",
      field: "plannedQty",
    });
  });

  it("qualified and defect quantities sit on the header and are no longer summed from multi-worker lines", () => {
    expect(field("qualifiedQty").type).toBe("number");
    expect(field("defectQty").type).toBe("number");
    expect(processReport.fields.some((candidate) => candidate.key === "workerReportLines")).toBe(false);
  });

  it("the page uses defect quantity and defect reason directly and does not expose write-off jargon to the floor", () => {
    expect(processReport.label).toBe("Work report");
    expect(field("defectQty").label).toBe("Defect quantity");
    expect(field("defects").label).toBe("Defect reason");
    expect(processReport.lifecycle.transitions.find((transition) => transition.code === "submit")).toBeUndefined();
  });

  it("a work report has a manual approve edge and a system sync-complete edge; cancel is system sync only", () => {
    expect(processReport.lifecycle.statuses.map((status) => status.key)).toEqual(["pendingReview", "completed", "cancelled"]);
    expect(processReport.lifecycle.statuses.find((status) => status.key === "pendingReview")?.initial).toBe(true);
    expect(processReport.lifecycle.statuses.find((status) => status.key === "completed")?.terminal).toBe(true);
    expect(processReport.lifecycle.statuses.find((status) => status.key === "cancelled")?.terminal).toBe(true);
    expect(processReport.lifecycle.transitions.find((transition) => transition.code === "approve")).toMatchObject({
      from: "pendingReview", to: "completed", action: "Approve", confirm: true,
      when: {
        primitive: "field_compare",
        params: {
          left: { ref: "$bill.reportType" },
          op: "eq",
          right: { value: "In-house" },
        },
      },
    });
    expect(processReport.lifecycle.transitions.find((transition) => transition.code === "syncApprove")).toMatchObject({
      from: "pendingReview", to: "completed", internal: true,
    });
    // Cancel follows subcontract receipt cancellation. It is a system sync edge, and a person cannot revoke the report.
    expect(processReport.lifecycle.transitions.find((transition) => transition.code === "syncCancel")).toMatchObject({
      from: "pendingReview", to: "cancelled", internal: true,
    });
    expect(processReport.lifecycle.transitions.some((transition) => transition.code === "markStockedIn")).toBe(false);
    expect(processReport.lifecycle.transitions.some((transition) => ["reject", "cancel", "revokeApproved"].includes(transition.code))).toBe(false);
    const words = [
      ...processReport.lifecycle.transitions.map((transition) => transition.action),
      ...processReport.lifecycle.statuses.map((status) => status.label),
    ];
    expect(words.join()).not.toMatch(/write-off|awaitingInbound|stocked in|reviewed|revoked/);
  });

  it("a subcontract work report cannot be approved by hand; its status follows the subcontract receipt", () => {
    expect(processReport.preconditions.find((item) => item.id === "own_report_manual_approval")).toMatchObject({
      onTransition: "approve",
      check: {
        primitive: "field_compare",
        params: {
          left: { ref: "$bill.reportType" },
          op: "eq",
          right: { value: "In-house" },
        },
      },
    });
  });

  it("a defect reason only selects a type and has no quantity or line remark", () => {
    const defects = field("defects");
    expect(defects).toMatchObject({ type: "subtable" });
    const lineKeys = defects.fields?.map((item) => item.key) ?? [];
    expect(lineKeys).toEqual(["defectTypeId", "defectName", "defectCategory"]);
    expect(processReport.fields.some((candidate) => candidate.key === "defectItemQty")).toBe(false);
  });

  it("defects require a reason, and no defects means no reason; both approve and syncApprove block the mismatch", () => {
    for (const id of ["report_defect_reasons_required", "sync_report_defect_reasons_required"]) {
      const rule = processReport.preconditions.find((item) => item.id === id);
      expect(rule).toMatchObject({
        check: {
          primitive: "field_compare",
          params: {
            left: { ref: "$bill.defectReasonCount" },
            op: "gt",
            right: { value: 0 },
          },
        },
      });
      expect(rule?.message).not.toMatch(/write-off|optional|quantity/);
    }
    for (const id of ["report_defect_reasons_empty", "sync_report_defect_reasons_empty"]) {
      expect(processReport.preconditions.find((item) => item.id === id)).toMatchObject({
        check: {
          primitive: "field_compare",
          params: {
            left: { ref: "$bill.defectReasonCount" },
            op: "eq",
            right: { value: 0 },
          },
        },
      });
    }
  });
});
