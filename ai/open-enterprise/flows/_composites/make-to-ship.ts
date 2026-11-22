// ---------------------------------------------------------------------------
// Core path · production — from taking the order through shipment, end to end.
//
// This is not one longer flow. The five segments below are each a complete piece of business:
// sales takes the order, the planner releases it, the shop floor assigns and reports, the warehouse receives and ships.
// That is how the floor is divided, so each segment can be run, reviewed, and changed on its own.
//
// This file only answers which segment runs first and which runs next. It has two uses, and neither is doing the work:
//   · show a customer how the system hangs together from start to finish;
//   · run the whole core path with one command, and know which segment broke.
//
// The order is fixed: without a work report there is no quantity to receive, and without a receipt it cannot ship.
// Run out of order and some middle segment finds no document it can run. The error names that flow, not the sequence.
//
// Before start, this product's BOM and routing must already be effective. They are not drawn on the path,
// because they are unrelated master data with no sequence. Drawing them as steps would imply a cause.
// ---------------------------------------------------------------------------

import { defineComposite } from "@open-erp/metamodel";

export default defineComposite({
  label: "Core path · order through shipment",
  purpose: "Take the order, make it, receive it, and ship it to the customer, end to end",
  roles: ["sales-clerk", "production-planner", "production-coordinator", "production-reporter", "warehouse-clerk"],
  links: [
    { flow: "order-to-production", say: "Sales takes the order and approves it, then converts each product into a production order" },
    { flow: "release-to-launch", say: "The planner schedules production. After the task is approved it enters production" },
    { flow: "material-issue-return", say: "The shop floor issues material. What is left comes back", optional: true },
    { flow: "dispatch-to-report", say: "Assign the task to people, one assignment per person. Good quantity counts only after the work report is approved" },
    { flow: "receipt-to-stock", say: "Good quantity is received into the warehouse and posted to inventory" },
    { flow: "production-to-receivable", say: "Ship to the customer, close the order, and put the balance on the customer" },
  ],
});
