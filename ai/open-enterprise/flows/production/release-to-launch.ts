// ---------------------------------------------------------------------------
// Schedule through start — an order becomes shop-floor work.
// When an assignment start first moves the task into production, the same transaction records the actual start time.
//
// Two steps, and the document changes in between:
//   Production order: Schedule production (creates production tasks; for make-in-house with processLines, operations are written onto the task child table)
//   Production task: Approve (approveScheduled, the workshop manager accepts the work) → awaitingProduction
//
// Task approval only confirms the shop-floor task. It does not advance the production order.
// The order moves from awaiting production into production only when an assignment actually starts.
// That action belongs to `dispatch-to-report` and is not drawn again here.
//
// After in-house scheduling there is no "launch / launchAll" step. On the product flow a production order
// has two ways out: Schedule production, or subcontract. The second scheduling screen places line, equipment,
// mold, and start/end from the routing, and writes the operations onto the production task child table in the
// same transaction. Task approval uses `approveScheduled` and enters awaiting production (the internal key is
// still `awaitingLaunch`). The task and the order enter production only after an assignment really starts.
//
// Assignment onto a person is another flow: `dispatch-to-report`
// (assign the task → approve the assignment when review is required → report work → approve the report when review is required; both steps pass together when review is not required).
// `launchAll` on the task page (lay out operations) only covers tasks whose schedule had no processLines and whose operation child table is still empty.
// It is not a required step on the in-house path, so it is not drawn here.
//
// The BOM and the routing must already be effective before start, or scheduling cannot explode material or write the task operation child table.
// Those two are not drawn as the first steps of this flow, because there is no causal order between them. BOM and routing
// are unrelated master data. Drawing them in a line would imply a sequence the system does not have.
// They are master-data maintenance, not something done in order.
//
// ## There is no "release" action. There is only "Schedule production"
//
// The requirement (wiki 244431994, small-work-order front end 1.0, section 4.5 Production) says:
// awaiting release — Schedule production / subcontract production → awaitingProduction. The button on screen is also "Schedule production",
// one button and two screens (1. confirm the lines to schedule → create production tasks; 2. place each operation on a
// line, equipment, mold, and start/end from the routing → write the task operation child table). An operation is not its own document.
//
// In the system this edge's code is `release` and its action text is "Release to production". That is an internal name.
// It does not create production tasks (the batch Planner in this directory does). It only records that this order has been scheduled.
// The flow used to call it "Release to production" too, and readers went looking for a button that is not on screen.
// This file uses the business name.
//
// The executor cannot click this step. `release` needs `releaseMode` (a platform mode slot; the business value is fixed
// at `separate`) plus `releaseLines` (which lines, and how much to schedule on each). That is a full workbench, not a confirm dialog.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Schedule through start",
  purpose: "How an approved production order becomes shop-floor work and is started",
  owner: "production-planner",
  roles: [
  "production-planner",
  "production-coordinator",
  "production-manager",
],
  triggerWords: [
  "Schedule production",
  "Release to production",
  "How an order becomes tasks",
],
  // The start is Schedule production, not Approve. Once a production order has no draft, approval is already
  // the last step of sales-order-to-production. Writing it on both flows makes two segments claim the same action,
  // and chain alignment flags it immediately (observed: "need a production order awaiting review, but earlier segments left it awaiting release").
  entry: "release",
  steps: [
    {
      key: "release",
      label: "Schedule production",
      kind: "action",
      module: "productionOrder",
      transition: "release",
      where: null,
      actor: "production-planner",
      note: "On screen this is the Schedule production button, in two steps: confirm the lines to schedule, then place each operation on a line, equipment, and mold. If the operation reservation is filled, it is written onto the task's child table",
      at: { x: 0, y: 0 },
      next: [
        // The condition is the status the next document must be in, not where this step lands.
        // The production task created by scheduling is pendingReview. Writing releasing (the order's own landing status)
        // looks smooth, but that branch can never be taken.
        { to: "approveTask", whenStatus: "pendingReview", label: null },
      ],
    },
    {
      key: "approveTask",
      label: "Approve the production task",
      kind: "action",
      module: "productionTask",
      transition: "approveScheduled",
      where: null,
      actor: "production-manager",
      note: "Scheduling has already written operations onto the task's child table. This approval moves the task to awaiting production. The production order stays awaiting production. After approval each operation can be assigned. The task and the order enter production only when an assignment starts. Subcontract tasks have no operation lines and do not use this edge",
      at: { x: 232, y: 0 },
      next: [],
    },
  ],
});
