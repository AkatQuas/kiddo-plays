// ---------------------------------------------------------------------------
// Sales order to production — after the order is taken, how it becomes a production order the shop floor accepts.
//
// This flow stops at "production order approved". It is not drawn through to launch. Release and launch are the planner's
// work, on two other pages, often a day later. Drawing all six steps as one flow means sales has to read a flow that is
// half irrelevant to "did my order convert", and a planner editing the release segment would touch the copy sales is reviewing.
// The handoff is here: the production order exists, awaiting the planner's review.
//
// Schedule-through-start follows. The join is derived (the previous flow's landing status is the next flow's start), not a table someone maintains.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Sales order to production",
  purpose: "After an order is taken, how it becomes a production order the shop floor accepts",
  owner: "sales-clerk",
  roles: [
  "sales-clerk",
  "production-planner",
],
  triggerWords: [
  "Convert to production",
  "Schedule the order",
  "What happens after the order is taken",
],
  entry: "approve",
  steps: [
    {
      key: "approve",
      label: "Approve the sales order",
      kind: "action",
      module: "salesOrder",
      transition: "approve",
      where: null,
      actor: "sales-clerk",
      note: "A sales order has no draft and no submit step. A new one awaits review. Promise date, customer, and lines must be filled before approval. A disabled customer is also blocked here",
      at: { x: 0, y: 0 },
      next: [
        { to: "toProduction", whenStatus: "inProgress", label: null },
      ],
    },
    {
      key: "toProduction",
      label: "Convert to production",
      kind: "action",
      module: "salesOrder",
      transition: "to_production",
      where: null,
      actor: "production-planner",
      note: "Pick a plant for each product line. Convert to production creates one production order per product",
      at: { x: 232, y: 0 },
      next: [
        { to: "approveOrder", whenStatus: "pendingReview", label: null },
      ],
    },
    {
      key: "approveOrder",
      label: "Approve the production order",
      kind: "action",
      module: "productionOrder",
      transition: "approve",
      where: null,
      actor: "production-planner",
      note: "A production order has no draft. Conversion creates it in pendingReview. The plant was chosen at conversion. If approval fails, this product line usually has no effective BOM. Edit the line and fill that in first",
      at: { x: 464, y: 0 },
      next: [],
    },
  ],
});
