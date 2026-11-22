import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseOrderDraft from "../modules/purchaseOrder.js";
import purchasePlanDraft from "../modules/purchasePlan.js";

const purchaseOrder = sealModule(purchaseOrderDraft, { code: "purchaseOrder", domain: "procurement" });
const purchasePlan = sealModule(purchasePlanDraft, { code: "purchasePlan", domain: "procurement" });

function fieldKeys(fields: readonly { key: string; fields?: readonly { key: string }[] | null }[]): string[] {
  return fields.flatMap((field) => [field.key, ...(field.fields ?? []).map((nested) => `${field.key}.${nested.key}`)]);
}

describe("Purchase plan supplier and reject contract", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(purchasePlan).errors).toEqual([]);
    expect(validateModule(purchaseOrder).errors).toEqual([]);
  });

  it("the plan has no supplier field", () => {
    const keys = fieldKeys(purchasePlan.fields);
    expect(keys.filter((key) => key === "preferredSupplierId" || key.endsWith(".preferredSupplierId") || key === "supplierId" || key.endsWith(".supplierId"))).toEqual([]);
    expect(purchasePlan.views.list.columns).not.toContain("preferredSupplierId");
    expect(purchasePlan.views.list.filters).not.toContain("preferredSupplierId");
    expect(purchasePlan.views.form.flatMap((section) => section.fields)).not.toContain("preferredSupplierId");
    expect(purchasePlan.preconditions.some((rule) => rule.id === "supplier_required" || rule.id === "resubmit_supplier_required")).toBe(false);
  });

  it("approve / resubmit no longer have supplier required_fields", () => {
    for (const edge of ["approve", "resubmit"] as const) {
      const gates = purchasePlan.preconditions.filter(
        (rule) =>
          rule.onTransition === edge &&
          rule.check?.primitive === "required_fields" &&
          (rule.check.params as { fields: readonly string[] }).fields.some((field) => field === "preferredSupplierId" || field === "supplierId"),
      );
      expect(gates, `${edge} should no longer have supplier required_fields`).toEqual([]);
    }
  });

  it("buyer may be empty while pending approval and is required on approve — a material-requirement push does not know who will buy", () => {
    expect(purchasePlan.fields.find((field) => field.key === "buyer")).toMatchObject({
      type: "ref",
      ref: "subject",
      required: false,
      refFilter: { status: "active" },
      person: { role: "receiver", via: "self" },
    });
    for (const edge of ["approve", "resubmit"] as const) {
      const gate = purchasePlan.preconditions.find(
        (rule) =>
          rule.onTransition === edge &&
          rule.check?.primitive === "required_fields" &&
          (rule.check.params as { fields: readonly string[] }).fields.includes("buyer"),
      );
      expect(gate, `${edge} should have a buyer required_fields gate`).toBeDefined();
      expect((gate?.check?.params as { fields: readonly string[] }).fields).toEqual(["buyer"]);
    }
  });

  it("a pending-approval plan created by push has a cancel exit", () => {
    expect(purchasePlan.lifecycle.statuses.find((status) => status.initial)?.key).toBe("pendingApproval");
    expect(purchasePlan.lifecycle.statuses.some((status) => status.key === "draft")).toBe(false);
    expect(purchasePlan.lifecycle.transitions.some((transition) => transition.code === "submit" || transition.code === "withdraw")).toBe(false);
    const cancel = purchasePlan.lifecycle.transitions.find((transition) => transition.code === "cancel");
    expect(cancel).toMatchObject({ from: "pendingApproval", to: "cancelled", confirm: true });
    expect(purchasePlan.lifecycle.statuses.find((status) => status.key === "cancelled")).toMatchObject({
      terminal: true,
      editable: "none",
    });
  });

  it("a pending-approval plan can be rejected to rejected with a required reason, then resubmitted after correction", () => {
    const reject = purchasePlan.lifecycle.transitions.find((transition) => transition.code === "reject");
    expect(reject).toMatchObject({
      from: "pendingApproval",
      to: "rejected",
      action: "Reject",
      confirm: true,
      params: [
        {
          key: "reason",
          label: "Reject reason",
          type: "text",
          required: true,
        },
      ],
    });

    // rejected must be a status you can leave. Adding the status without an exit leaves a rejected plan stuck forever,
    // and on the list it only looks like one more red tag.
    const resubmit = purchasePlan.lifecycle.transitions.find((transition) => transition.code === "resubmit");
    expect(resubmit).toMatchObject({ from: "rejected", to: "pendingApproval", primary: true });
    const abandon = purchasePlan.lifecycle.transitions.find((transition) => transition.code === "abandon");
    expect(abandon).toMatchObject({ from: "rejected", to: "closedOut", confirm: true });

    // Resubmit and approve must use the same entry gates, one for one.
    const approveGates = purchasePlan.preconditions
      .filter((rule) => rule.onTransition === "approve")
      .map((rule) => rule.check?.primitive);
    const resubmitGates = purchasePlan.preconditions
      .filter((rule) => rule.onTransition === "resubmit")
      .map((rule) => rule.check?.primitive);
    expect(resubmitGates).toEqual(approveGates);

    // Rejected is editable. The whole point of correction is that it can be changed.
    const rejected = purchasePlan.lifecycle.statuses.find((status) => status.key === "rejected");
    expect(rejected).toMatchObject({ editable: "full", terminal: false });
  });

  it("the order supplier may be empty while pending review and is required on approval, and is no longer brought from the plan", () => {
    expect(purchaseOrder.fields.find((field) => field.key === "supplierId")).toMatchObject({
      type: "ref",
      ref: "supplier",
      required: false,
      pushFrom: null,
      refFilter: { status: "active" },
    });

    const gate = purchaseOrder.preconditions.find((rule) => rule.id === "supplier_required");
    expect(gate).toMatchObject({ onTransition: "approve", source: "invariant", level: "block" });
    expect(gate?.check?.primitive).toBe("required_fields");
    expect((gate?.check?.params as { fields: readonly string[] }).fields).toEqual(["supplierId"]);
    expect(purchaseOrder.preconditions.some((rule) => rule.id === "supplier_required" && rule.onTransition === "submit")).toBe(false);
  });
});
