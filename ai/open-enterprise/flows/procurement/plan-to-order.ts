// ---------------------------------------------------------------------------
// Purchase plan through order — how "what to buy" becomes "already ordered".
//
// A plan and an order are two different things. The plan answers whether to buy and how much. The order answers who to buy from,
// at what price, and when it arrives. "Convert to purchase order" puts the approved quantity on a specific supplier.
// The plan itself does not post. Approving the order is what reserves payable exposure. Conversion is by product, so one plan can be split across several suppliers.
//
// Purchase order through receipt follows.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Purchase plan through order",
  purpose: "Roll what needs buying into a plan, approve it, and turn it into specific purchase orders",
  owner: "buyer",
  roles: ["buyer", "production-coordinator", "inventory-manager"],
  triggerWords: ["Purchase plan", "What to buy", "Approve purchasing", "Convert to purchase order"],
  entry: "approve",
  steps: [
    {
      key: "approve", label: "Approve the purchase plan", kind: "action",
      module: "purchasePlan", transition: "approve", where: null,
      actor: "buyer",
      note: "A plan has no draft, no submit step, and no withdraw. A new one awaits approval. Buyer and lines must be filled before it can be approved. Approval decides how much to buy, not who to buy it from",
      at: { x: 0, y: 0 },
      next: [{ to: "toOrder", whenStatus: "approved", label: null }],
    },
    {
      key: "toOrder", label: "Convert to purchase order", kind: "action",
      module: "purchasePlan", transition: "to_order", where: null,
      actor: "buyer",
      note: "The dialog enters this quantity by product and creates one order awaiting review. One plan can be split across suppliers in several conversions",
      at: { x: 232, y: 0 },
      next: [{ to: "finish", whenStatus: "approved", label: null }],
    },
    {
      key: "finish", label: "Complete the purchase plan", kind: "action",
      module: "purchasePlan", transition: "finish", where: null,
      actor: "buyer", note: "Click this only after every planned quantity has been pushed to an order. Otherwise keep pushing",
      at: { x: 464, y: 0 }, next: [],
    },
  ],
});
