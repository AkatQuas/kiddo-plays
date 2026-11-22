// ---------------------------------------------------------------------------
// Subcontract order through receipt — how work we do not do ourselves is sent out and comes back.
//
// Subcontracting has two legs: material sent out (subcontract issue) and goods coming back (subcontract receipt).
// Both are pushed from the subcontract order, and each has its own document to confirm. Drawing only one leg
// makes the floor think confirming receipt is the end, while issued material is still sitting in subcontract WIP with nobody clearing it.
//
// After approval the order enters awaitingOutsource. Once an issue or a receipt has been pushed, the order enters processing.
// Subcontract receipt is the same action in awaiting subcontract, processing, and completed. Each batch is received with that action.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Subcontract order through receipt",
  purpose: "Give an operation or a whole item to a subcontractor: order, issue, receive, and close",
  owner: "buyer",
  roles: ["buyer", "warehouse-clerk", "production-coordinator"],
  triggerWords: ["Subcontract", "Subcontractor", "Send out to be made", "Subcontract receipt", "Subcontract issue"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve the subcontract order", kind: "action",
      module: "subcontractOrder", transition: "approve", where: null,
      actor: "buyer", note: "A new document is awaiting review. Issue and receipt are allowed only after approval",
      at: { x: 0, y: 0 },
      next: [{ to: "pushIssue", whenStatus: "awaitingOutsource", label: null }],
    },
    {
      key: "pushIssue", label: "Push a subcontract issue", kind: "action",
      module: "subcontractOrder", transition: "issue", where: null,
      actor: "buyer", note: "Create one subcontract issue from the order. The order moves to processing",
      at: { x: 232, y: 0 },
      next: [{ to: "confirmIssue", whenStatus: "awaitingIssueOut", label: null }],
    },
    {
      key: "confirmIssue", label: "Confirm the subcontract issue", kind: "action",
      module: "subcontractIssue", transition: "confirm", where: null,
      actor: "warehouse-clerk",
      note: "The material has actually been sent: it moves from the raw warehouse to subcontract WIP, and it is still our stock",
      at: { x: 464, y: 0 },
      next: [{ to: "pushReceipt", whenStatus: "processing", label: null }],
    },
    {
      key: "pushReceipt", label: "Push a subcontract receipt", kind: "action",
      module: "subcontractOrder", transition: "receive", where: null,
      actor: "buyer", note: "Receive each batch as the subcontractor finishes it. Receiving can happen more than once",
      at: { x: 696, y: 0 },
      next: [{ to: "confirmReceipt", whenStatus: "awaitingReceipt", label: null }],
    },
    {
      key: "confirmReceipt", label: "Confirm the subcontract receipt", kind: "action",
      module: "subcontractReceipt", transition: "confirm", where: null,
      actor: "warehouse-clerk",
      note: "Goods enter the warehouse and the processing fee is posted to the subcontractor. Subcontract WIP is reduced by what was consumed",
      at: { x: 928, y: 0 },
      next: [{ to: "finish", whenStatus: "processing", label: null }],
    },
    {
      key: "finish", label: "Subcontract complete", kind: "action",
      module: "subcontractOrder", transition: "finish", where: null,
      actor: "buyer", note: "Click this only when the quantity is complete. If it is not, keep receiving",
      at: { x: 1160, y: 0 }, next: [],
    },
  ],
});
