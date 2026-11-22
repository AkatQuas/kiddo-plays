// ---------------------------------------------------------------------------
// Purchase invoice review — how a supplier's invoice is checked into payables.
//
// An invoice does not move money. It only fixes the payable to the invoice amount. Paying is the payment-through-allocation
// flow. They are drawn separately because a payment term sits between them. The floor often matches invoices this month
// and pays next month, and the person who matches the invoice is not the person who pays.
//
// If the invoice amount does not match the received quantity, void and re-enter it while it is awaiting review. After approval the payable is fixed to the invoice amount and is not reversed.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Purchase invoice review",
  purpose: "How a supplier invoice is reviewed, and what the payable becomes after approval",
  owner: "finance",
  roles: ["finance", "buyer"],
  triggerWords: ["Purchase invoice", "Post the invoice", "Reconciliation", "Payables"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve the purchase invoice", kind: "action",
      module: "purchaseInvoice", transition: "approve", where: null,
      actor: "finance",
      note: "Invoice posting has no draft and no submit step. A new invoice awaits review. Enter it against received quantity. If the invoice amount does not match, ask the supplier for a replacement, or void and re-enter it while it is still awaiting review. After approval the payable is fixed to the invoice amount.",
      at: { x: 0, y: 0 }, next: [],
    },
  ],
});
