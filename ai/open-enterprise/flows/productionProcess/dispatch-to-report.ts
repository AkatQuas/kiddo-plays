// ---------------------------------------------------------------------------
// Assign through work report — a production task lands on a person, and the quantity is reported back.
//
// Once the task is approved and awaiting production, each operation can be assigned. For a later operation in sequence, reportable quantity equals the previous operation's approved good quantity. Assignment does not wait for the previous operation.
// Assignment is the Assign action on the production task. The Planner creates one assignment awaiting review per person (one document per person, not a task line).
// The work report hangs on that assignment and can be entered more than once. A team-wide assignment is taken up by the worker who actually reports.
// Good quantity counts only after the work report is approved. An assignment of 50 needs 50 good. Defects do not fill that quota.
//
// An assignment must be started before it can be completed. Reported quantity reaching the assigned quantity does not replace the shop floor's completion confirmation.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Assign through work report",
  purpose: "Who a production task is assigned to, and how the quantity is reported back and confirmed",
  owner: "production-coordinator",
  roles: [
    "production-coordinator",
    "team-leader",
    "production-reporter",
    "production-manager",
  ],
  triggerWords: [
    "Assign",
    "Report work",
    "Complete the assignment",
    "How an operation is assigned to a person",
  ],
  entry: "assign",
  steps: [
    {
      key: "assign",
      label: "Assign the task",
      kind: "action",
      module: "productionTask",
      transition: "assign",
      where: null,
      actor: "production-planner",
      note: "Assign one operation, or cover every operation that is not yet assigned. With named workers, each person gets one assignment awaiting review. Without named workers, the whole assignment goes to the team. A reviewed task can be assigned without waiting for the previous operation",
      at: { x: 0, y: 0 },
      next: [
        { to: "approveAssignment", whenStatus: "pendingReview", label: null },
      ],
    },
    {
      key: "approveAssignment",
      label: "Approve the assignment",
      kind: "action",
      module: "processAssignment",
      transition: "approve",
      where: null,
      actor: "production-manager",
      note: "An assignment fixes who does this operation, how much, and at what piece rate. Those three go straight into wages, so someone has to confirm them",
      at: { x: 232, y: 0 },
      next: [
        { to: "start", whenStatus: "awaitingProduction", label: null },
      ],
    },
    {
      key: "start",
      label: "Start the assignment",
      kind: "action",
      module: "processAssignment",
      transition: "start",
      where: null,
      actor: "team-leader",
      note: "After start, the assignment enters production and moves a production task and production order that are still awaiting production into production with it. The task's actual start is this moment",
      at: { x: 464, y: 0 },
      next: [
        { to: "report", whenStatus: "inProduction", label: null },
        { to: "completeAssignment", whenStatus: "inProduction", label: "Complete the assignment" },
      ],
    },
    {
      key: "report",
      label: "Report work",
      kind: "action",
      module: "processAssignment",
      transition: "report",
      where: null,
      actor: "production-reporter",
      note: "The work report hangs on this assignment and can be entered more than once. A team-wide assignment must name the worker who actually reports. Enter this time's good and defect quantities. Good quantity may exceed the assignment's remaining quantity. A defect quantity above 0 requires a defect reason. For a later operation in sequence, reportable quantity equals the previous operation's approved good quantity. Defects do not fill that quota",
      at: { x: 696, y: 0 },
      next: [
        { to: "approve", whenStatus: "pendingReview", label: null },
      ],
    },
    {
      key: "approve",
      label: "Review the work report",
      kind: "action",
      module: "processReport",
      transition: "approve",
      where: null,
      actor: "team-leader",
      note: "Good quantity counts only after this review, and only then enters each operation's approved good quantity and the receipt bottleneck. Receipt is against the production task and can happen more than once. The bottleneck is the minimum approved good quantity across operations",
      at: { x: 928, y: 0 },
      next: [],
    },
    {
      key: "completeAssignment",
      label: "Complete the assignment",
      kind: "action",
      module: "processAssignment",
      transition: "complete",
      where: null,
      actor: "team-leader",
      note: "Mark this in-production assignment completed. That does not complete the production task. Unreported remainder returns to the operation and can be assigned again. After every operation's good quantity meets the plan and no assignment is still open, the user explicitly completes the production task",
      at: { x: 232, y: 180 },
      next: [],
    },
  ],
});
