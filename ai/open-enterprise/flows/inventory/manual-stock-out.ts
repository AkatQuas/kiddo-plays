// ---------------------------------------------------------------------------
// Manual stock-out review — how inventory loss, scrap, and sample loans are recorded.
//
// Same rule as manual stock-in: only the part that has no upstream document. Sales shipment, shop-floor issue,
// and subcontract issue each have their own document. Issuing from here leaves those documents short forever.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Manual stock-out review",
  purpose: "How goods with no upstream document leave the warehouse: inventory loss, scrap, and sample loans. New documents await review, then approval posts them",
  owner: "inventory-manager",
  roles: ["inventory-manager", "warehouse-clerk"],
  triggerWords: ["Stock out", "Inventory loss", "Scrap", "Manual stock-out", "Other stock-out"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve the stock-out", kind: "action",
      module: "stockOut", transition: "approve", where: null,
      actor: "inventory-manager", note: "A new document is awaiting review. Approval reduces inventory. After that it can be voided, not edited",
      at: { x: 0, y: 0 }, next: [],
    },
  ],
});
