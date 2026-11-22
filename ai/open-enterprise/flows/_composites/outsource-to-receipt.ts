// ---------------------------------------------------------------------------
// Core path · subcontracting — how the part we do not make ourselves is finished.
//
// Leftover handling is optional: if the material was used up, this segment does not exist. It is its own segment
// instead of being drawn inside the subcontract-order flow, because "what if material is left" is a floor judgment and may happen much later.
// ---------------------------------------------------------------------------

import { defineComposite } from "@open-erp/metamodel";

export default defineComposite({
  label: "Core path · subcontracting",
  purpose: "Give the work to a subcontractor: order, issue, receive, close, and clear leftover material",
  roles: ["buyer", "warehouse-clerk", "production-coordinator"],
  links: [
    { flow: "subcontract-to-receipt", say: "Place the subcontract order, issue material, receive the goods, and close the order" },
    { flow: "subcontract-material-return", say: "Material sent out and not used up: return it, or accept it as a loss", optional: true },
  ],
});
