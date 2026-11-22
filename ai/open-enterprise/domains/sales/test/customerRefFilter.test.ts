import { sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import customerDraft from "../modules/customer.js";
import salesOrderDraft from "../modules/salesOrder/index.js";

const customer = sealModule(customerDraft, { code: "customer", domain: "sales" });
const salesOrder = sealModule(salesOrderDraft, { code: "salesOrder", domain: "sales" });

describe("sales-order customer reference: only active customers", () => {
  it("a new sales order narrows the customer cell to active", () => {
    const field = salesOrder.fields.find((item) => item.key === "customerId");
    expect(field).toMatchObject({
      type: "ref",
      ref: "customer",
      required: true,
      refFilter: { status: "active" },
    });
  });

  // refFilter does not replace the precondition. A customer can still be disabled while the draft sits,
  // and an order that already picked a customer and then stayed in pending review does not re-run write validation.
  // The two criteria must be the same value, or "allowed at entry, rejected at approval" shows up on one document,
  // or the other way around if the approve gate is removed and only the entry filter remains.
  it("the gate at approval and the candidate filter are the same value, and both are present", () => {
    const rule = salesOrder.preconditions.find((pc) => pc.id === "customer_active");
    expect(rule, "salesOrder is missing customer_active").toBeTruthy();
    expect(rule?.level).toBe("block");
    expect(rule?.onTransition).toBe("approve");
    expect(rule?.check).toMatchObject({
      primitive: "ref_field_compare",
      params: {
        via: { from: "bill", field: "customerId" },
        entity: "customer",
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    });
    expect(salesOrder.fields.find((item) => item.key === "customerId")?.refFilter?.["status"]).toBe("active");
  });

  // Written down: outside pending review the customer cannot be edited, so disabling a customer does not make an in-flight order unable to save its remark.
  it("only pending review can edit the customer, which is why the header may filter on active", () => {
    for (const status of salesOrder.lifecycle.statuses) {
      if (status.key === "pendingReview") {
        expect(status.editable).toBe("full");
        continue;
      }
      if (status.editable === "none" || status.terminal) continue;
      if (status.editable !== "whitelist") continue;
      expect(status.editableFields, `${status.key} whitelist contains customerId`).not.toContain("customerId");
    }
  });

  it("the customer list still shows disabled customers, and they can be enabled again", () => {
    expect(customer.views.list.filters).toContain("status");
    expect(customer.lifecycle.transitions.some((edge) => edge.code === "enable" && edge.from === "disabled")).toBe(
      true,
    );
  });
});
