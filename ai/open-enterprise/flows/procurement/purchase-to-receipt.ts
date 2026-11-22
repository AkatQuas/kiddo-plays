// Purchase order through receipt — the stretch of purchasing that is walked most often.
//
// This flow posts in two places, and both are on edges a person can click:
//   · Approve: reserve payable exposure (a commitment, not an actual amount)
//   · Confirm receipt: inventory in, and the payable becomes actual
// Commitment and actual are two postings, not one. The detail page has to show that at a glance.

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Purchase order through receipt",
  purpose: "When a shortage has to be bought: from the order, to goods in the warehouse, to the amount on the supplier",
  owner: "buyer",
  roles: ["buyer", "warehouse-clerk", "finance"],
  triggerWords: ["Purchase receipt", "Order through receipt", "What to do when a purchase arrives"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve the purchase order", kind: "action",
      module: "purchaseOrder", transition: "approve", where: null,
      actor: "buyer",
      note: "A purchase order has no draft and no submit step. Creating or pushing one leaves it awaiting review. Approve it after supplier and price are filled. Approval reserves the payable exposure. That is a commitment, not money already owed",
      at: { x: 0, y: 0 },
      next: [{ to: "receive", whenStatus: "awaitingReceipt", label: null }],
    },
    {
      key: "receive", label: "Receive", kind: "action",
      module: "purchaseOrder", transition: "receive", where: null,
      actor: "warehouse-clerk", note: "The first receipt can enter this quantity (it defaults to the open quantity and may be less). If some remains, receive again",
      at: { x: 232, y: 0 },
      next: [{ to: "confirmReceipt", whenStatus: "pendingReview", label: null }],
    },
    {
      key: "confirmReceipt", label: "Confirm receipt", kind: "action",
      module: "purchaseReceipt", transition: "confirm", where: null,
      actor: "warehouse-clerk", note: "The goods are actually in the warehouse: inventory increases and the payable becomes an actual amount",
      at: { x: 464, y: 0 },
      next: [{ to: "finish", whenStatus: "receiving", label: null }],
    },
    {
      key: "finish", label: "Close the purchase order", kind: "action",
      module: "purchaseOrder", transition: "finish", where: null,
      actor: "buyer", note: "On split deliveries, do not click this until everything has arrived",
      at: { x: 696, y: 0 }, next: [],
    },
  ],
});
