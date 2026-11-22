// ---------------------------------------------------------------------------
// Subcontract leftover — how material that was sent out and not used up is cleared.
//
// Leftover has two destinations, and the books are different: return it (it enters the warehouse and is still our stock) or confirm the loss
// (it does not come back, and it becomes cost). This flow splits from the pending document into those two ends.
// The floor chooses which one. The system does not choose.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Subcontract leftover",
  purpose: "Material issued to a subcontractor and not used up: return it to the warehouse, or accept it as a loss",
  owner: "warehouse-clerk",
  roles: ["warehouse-clerk", "buyer", "production-coordinator"],
  triggerWords: ["Subcontract leftover", "Subcontract return", "Material left over", "Subcontract loss"],
  entry: "back",
  steps: [
    {
      key: "back", label: "Confirm leftover return", kind: "action",
      module: "subcontractMaterialReturn", transition: "releaseDemand", where: null,
      actor: "warehouse-clerk",
      note: "Pushing creates a document awaiting handling. Use this when the material has actually come back: subcontract WIP moves back to the raw warehouse. If it did not come back, do not use this; confirm the loss instead",
      at: { x: 0, y: 0 }, next: [],
    },
  ],
});
