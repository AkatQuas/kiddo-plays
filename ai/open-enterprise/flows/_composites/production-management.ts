// ---------------------------------------------------------------------------
// Production — one production order from approval through receipt, through the worker being paid.
//
// The source is the product panorama (small-work-order front end 1.0, section 4.5 Production).
// It has two forks. This path draws both, instead of picking one and drawing a straight line:
//
//   · After a production order is awaiting release: schedule it here, or send it to a subcontractor.
//     The downstream documents are different (production task vs subcontract order). Only one path is taken.
//   · After work is reported: settle pay, or receive into stock. The two do not depend on each other, so either may be first.
//     Piece-rate pay is `optional`, not a fork: skipping it does not block receipt.
//
// This path does not start from the sales order. "Sales order → convert to production" belongs to order-through-shipment
// and is already drawn there. Drawing the same segment on both paths means one of them will be forgotten when it changes.
// To demo from the sales order, run "Core path · order through shipment".
// ---------------------------------------------------------------------------

import { defineComposite } from "@open-erp/metamodel";

export default defineComposite({
  label: "Core path · production",
  purpose: "How a production order is approved, scheduled or subcontracted, assigned and reported, and received, and how piece-rate wages are settled",
  roles: ["production-planner", "production-manager", "production-coordinator", "warehouse-clerk", "finance"],
  links: [
    {
      flow: "release-to-launch",
      say: "1. Make it here: schedule production, including operations. After the task is approved it enters production",
      branch: "How this batch gets made",
    },
    {
      flow: "subcontract-to-receipt",
      say: "1. Send it out: place a subcontract order, issue material, and receive the goods",
      branch: "How this batch gets made",
    },
    {
      flow: "material-issue-return",
      say: "2. The shop floor issues material against the task. What is left comes back",
      optional: true,
    },
    { flow: "dispatch-to-report", say: "3. Assign the task, one assignment per person. After approval, report work and review the report. Remainder is closed by completing the assignment" },
    {
      flow: "report-to-payroll",
      say: "4. Reported work becomes piece-rate wages and is settled after review. This does not depend on receipt; either can happen first",
      optional: true,
    },
    { flow: "receipt-to-stock", say: "5. Good quantity is received into the warehouse and posted to inventory" },
  ],
});
