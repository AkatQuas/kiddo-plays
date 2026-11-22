// ---------------------------------------------------------------------------
// Manual stock-in review — how inventory gains, returns, and other receipts with no clear source are recorded.
//
// This path is for goods that have no upstream document: inventory gain, sample return, and a wrong issue sent back.
// Purchase receipt and finished-goods receipt each have their own line. Do not top them up from here.
// A top-up from here leaves the purchase order short, and nothing says that it is short.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Manual stock-in review",
  purpose: "How goods with no upstream document enter the warehouse: inventory gain, returns, and samples. New documents await review, then approval posts them",
  owner: "inventory-manager",
  roles: ["inventory-manager", "warehouse-clerk"],
  triggerWords: ["Stock in", "Inventory gain", "Manual stock-in", "Other stock-in"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve the stock-in", kind: "action",
      module: "stockIn", transition: "approve", where: null,
      actor: "inventory-manager", note: "A new document is awaiting review. Approval increases inventory. After that it can be voided, not edited",
      at: { x: 0, y: 0 }, next: [],
    },
  ],
});
