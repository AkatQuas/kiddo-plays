// ---------------------------------------------------------------------------
// Payment through payable allocation — the money has gone out, and the payment is recorded on the payable.
//
// Current flow: after the payment is approved, the amount rolls up to purchasePayable.paidAmount.
// The payment no longer posts directly to a cash account.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Payment through payable allocation",
  purpose: "Pay a supplier: approve the payment, and record the amount on the payable",
  owner: "finance",
  roles: ["finance"],
  triggerWords: ["Payment", "Pay the supplier", "Approve payment"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve payment", kind: "action",
      module: "purchasePayment", transition: "approve", where: null,
      actor: "finance",
      note: "A new payment awaits approval. After approval, the amount rolls up to paidAmount on the linked payable",
      at: { x: 0, y: 0 },
      next: [],
    },
  ],
});
