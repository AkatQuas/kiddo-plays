// ---------------------------------------------------------------------------
// Finished-goods receipt — reported completion becomes goods in the warehouse.
//
// This is the step that posts. Inventory is written only when the warehouse confirms the receipt. The ledger only appends.
// The task dialog's createBill only creates a document awaiting review (it reserves receivable quantity and does not enter stock). If it was filled wrong, delete it. Do not cancel it.
//
// Prerequisite: the work report is approved. Receivable quantity = min(approved good quantity by operation) − already received (documents awaiting review also reserve it).
// Good quantity can be received while the task is in production. The task does not have to be completed, and the plan does not have to be filled.
// When there is no receivable quantity the dialog blocks. The system is not broken. There are no good pieces yet.
//
// The task completes when reported good quantity meets the plan. That is independent of this document. Confirming the receipt does not change the production task status.
// A production task has no received status.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Finished-goods receipt",
  purpose: "After the shop floor reports completion, how good quantity is received and posted to inventory",
  owner: "warehouse-clerk",
  roles: [
  "warehouse-clerk",
  "inventory-manager",
],
  triggerWords: [
  "Finished-goods receipt",
  "Receive finished goods",
  "How to receive stock after completion is reported",
],
  entry: "confirm",
  steps: [
    {
      key: "confirm",
      label: "Confirm receipt",
      kind: "action",
      module: "productionReceipt",
      transition: "releaseDemand",
      where: null,
      actor: "warehouse-clerk",
      note: "The task dialog first creates a receipt awaiting review, which reserves the receivable quantity. Stock posts only when the warehouse confirms that document. Receivable quantity = min(approved good quantity) − already received (documents awaiting review also reserve it). This does not change the production task status.",
      at: { x: 0, y: 0 },
      next: [],
    },
  ],
});
