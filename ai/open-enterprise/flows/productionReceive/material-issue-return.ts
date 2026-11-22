// Shop-floor issue and return — material goes from the warehouse to the shop floor, and what is left comes back.
//
// The return half has its own review. The shop floor saying how much to return does not count. Stock moves only after the warehouse checks it.
// Issue and return are drawn together because they are the two ends of the same thing.
// Split them and a reader cannot see which step the return continues from.

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Shop-floor issue and return",
  purpose: "How the warehouse handles a shop-floor request and a return of what was not used",
  owner: "warehouse-clerk",
  roles: ["production-coordinator", "warehouse-clerk", "team-leader"],
  triggerWords: ["Issue and return", "Shop floor needs material", "What to do when material comes back"],
  entry: "issue",
  steps: [
    {
      key: "issue", label: "Confirm the issue", kind: "action",
      module: "materialIssue", transition: "confirm", where: null,
      actor: "warehouse-clerk", note: "Material leaves the warehouse and enters shop-floor WIP. Stock moves on this step",
      at: { x: 0, y: 0 },
      next: [
        { to: "createReturn", whenStatus: "issued", label: "Leftover to return" },
        { to: "consumed", whenStatus: null, label: "Used up" },
      ],
    },
    {
      key: "createReturn", label: "Start a return", kind: "action",
      module: "materialIssue", transition: "createReturn", where: null,
      actor: "production-manager", note: "Finishing this step creates the return. The shop floor enters how much to send back",
      at: { x: 232, y: 0 },
      next: [{ to: "releaseReturn", whenStatus: "pendingReview", label: null }],
    },
    {
      key: "releaseReturn", label: "Confirm the return", kind: "action",
      module: "materialReturn", transition: "releaseDemand", where: null,
      actor: "warehouse-clerk", note: "Stock moves only after the warehouse checks it: material returns to the warehouse and WIP goes down",
      at: { x: 464, y: 0 }, next: [],
    },
    {
      key: "consumed", label: "Material consumed on the shop floor", kind: "manual",
      module: null, transition: null, where: null,
      actor: "team-leader", note: "An offline step. The system does not record used-up material as its own event. It shows up on the work report",
      at: { x: 232, y: 132 }, next: [],
    },
  ],
});
