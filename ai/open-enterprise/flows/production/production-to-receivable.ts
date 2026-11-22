// ---------------------------------------------------------------------------
// Finish through shipment — how finished goods go out, and how the order is closed.
//
// This flow is drawn through "Confirm issue". Confirming the issue reduces stock immediately. It no longer creates the old receivable.
//
// "Finish sales-order shipping" is not drawn either. When every line is fully shipped, the shipment planner
// itself pushes the order to completed (the rule is "shipped including this document >= ordered"; see
// `salesDeliveryPlanner.test.ts`). Drawing it was observed to fail: right after confirm shipment, the next step
// reported it could not find XS-…-0016 in awaitingShipment across 6 pages. The order was already completed,
// while the flow still said it should be in awaitingShipment waiting for a click.
// `salesOrder.finish` / `finishShipping` remain for shipping less and then stopping. A person can finish shipping manually,
// but a shipment awaiting review must be confirmed or cancelled first. That is a different path, not this one.
//
// Finished-goods receipt comes before this (there has to be stock to ship).
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Finish through shipment",
  purpose: "After the shop floor finishes, how the goods are shipped and how the sales order is closed",
  owner: "warehouse-clerk",
  roles: [
  "warehouse-clerk",
  "sales-clerk",
  "finance",
  "production-coordinator",
],
  triggerWords: [
  "Finished",
  "Ship",
  "Ship finished goods",
  "How to ship once it is made",
],
  entry: "ship",
  steps: [
    {
      key: "ship",
      label: "Ship",
      kind: "action",
      module: "salesOrder",
      transition: "ship",
      where: null,
      actor: "sales-clerk",
      note: "A sales order with production still open, including subcontracting, stays in production. Shipping looks at stock. Receipt and shipment do not push that status. Shipping can repeat while the order is in production. When every task is finished the order goes straight to finished, without a reported status and without waiting for receipt. Here, choose the lines and quantities to ship. That creates one sales shipment",
      at: { x: 0, y: 0 },
      next: [
        { to: "confirmOut", whenStatus: "pendingReview", label: null },
      ],
    },
    {
      key: "confirmOut",
      label: "Confirm issue",
      kind: "action",
      module: "salesDelivery",
      transition: "confirm",
      where: null,
      actor: "warehouse-clerk",
      note: "The shipment stays awaiting review. This step reduces stock. When every line is fully shipped and no other shipment is awaiting review, the order closes on this same step. A completed order cannot confirm another shipment. Documents awaiting review must be handled before shipment is finished",
      at: { x: 696, y: 0 },
      next: [],
    },
  ],
});
