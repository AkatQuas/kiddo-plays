// ---------------------------------------------------------------------------
// Core path · purchase through payment — from "we need to buy" to "the money has gone out".
//
// The three segments are each a complete piece of work: the planner decides whether to buy, purchasing decides who to buy from and whether the goods arrived,
// finance handles the invoice and the money. They are chained for a demo and for an end-to-end run, not in order to do the work.
// ---------------------------------------------------------------------------

import { defineComposite } from "@open-erp/metamodel";

export default defineComposite({
  label: "Core path · purchase through payment",
  purpose: "How a purchase is approved, ordered, and received, how the invoice is matched, and how it is paid",
  roles: ["buyer", "warehouse-clerk", "finance"],
  links: [
    { flow: "plan-to-order", say: "Roll demand into a purchase plan, approve it, and turn it into purchase orders" },
    { flow: "purchase-to-receipt", say: "Order and receive: goods enter the warehouse and the amount is posted to the supplier" },
    { flow: "purchase-invoice-review", say: "How a supplier invoice is reviewed and how the payable is fixed to the invoice amount" },
    { flow: "payment-to-allocation", say: "Pay, and apply that money to a specific payable" },
  ],
});
