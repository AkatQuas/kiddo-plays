// ---------------------------------------------------------------------------
// Shortage through kitting — the shop floor does not have enough material, and how the gap is filled.
//
// A production material requirement is not created by hand. After a production task is released, the system explodes the BOM into
// which materials this batch needs and how much is short. The shortfall is pushed to a purchase plan from here.
// That is the only path from shortage to purchasing that does not depend on someone retelling it.
//
// Confirm kitting is a person's judgment, not a system calculation. Click it only after the material has arrived and been counted.
// Clicking early makes downstream think production can start.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Shortage through kitting",
  purpose: "When production does not have enough material: how the gap becomes a purchase plan, and how kitting is closed once the material arrives",
  owner: "production-coordinator",
  roles: ["production-coordinator", "buyer", "warehouse-clerk"],
  triggerWords: ["Shortage", "Kitting", "Not enough material", "Material requirement", "Replenish"],
  entry: "toPurchasePlan",
  steps: [
    {
      key: "toPurchasePlan", label: "Push a purchase plan", kind: "action",
      module: "materialRequirement", transition: "toPurchasePlan", where: null,
      actor: "production-coordinator",
      note: "Push only the shortfall to purchasing. What is already in stock is not pushed",
      at: { x: 0, y: 0 },
      next: [{ to: "approvePlan", whenStatus: "pendingApproval", label: null }],
    },
    {
      key: "approvePlan", label: "Approve the purchase plan", kind: "action",
      module: "purchasePlan", transition: "approve", where: null,
      actor: "buyer",
      note: "A plan has no draft. Pushing one creates it awaiting approval. After approval, continue with purchase plan through order",
      at: { x: 232, y: 0 },
      next: [{ to: "complete", whenStatus: "awaitingIssue", label: null }],
    },
    {
      key: "complete", label: "Confirm kitting", kind: "action",
      module: "materialRequirement", transition: "complete", where: null,
      actor: "warehouse-clerk",
      note: "Click this only after the material has arrived and been counted. Clicking early makes the shop floor think it can start",
      at: { x: 696, y: 0 }, next: [],
    },
  ],
});
