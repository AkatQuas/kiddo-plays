// ---------------------------------------------------------------------------
// Work report through piece-rate pay — how a worker's work becomes this amount of money.
//
// A wage document is not a period summary. When a work report is approved (including a report awaiting review that assignment completion approves automatically) and good quantity
// is greater than 0, the system has already created one wage document awaiting settlement. One completed work report corresponds to one wage document.
//
// Reviewing the work report is not drawn on this flow. It is the closing action of assign-through-work-report.
// Wages have no review status. Once formed, they can be settled.
//
// Settlement confirms this wage. A settled row cannot be changed. The rate and the factor are frozen when the document is formed.
// ---------------------------------------------------------------------------

import { defineFlow } from "@open-erp/metamodel";

export default defineFlow({
  label: "Work report through piece-rate pay",
  purpose: "After the work report is approved, how the shop floor settles this piece-rate wage",
  owner: "production-manager",
  roles: ["production-manager", "finance"],
  triggerWords: ["Piece-rate wages", "Performance pay", "Payroll report", "How wages are calculated", "Settle wages"],
  entry: "settle",
  steps: [
    {
      key: "settle", label: "Settle piece-rate wages", kind: "action",
      module: "performanceSettlement", transition: "settle", where: null,
      actor: "production-manager",
      note: "Settlement pay = piece quantity × the piece rate frozen on the work report × the factor frozen there (operation line, then worker header, then 1 if empty). Defects are not paid. A settled row cannot be changed",
      at: { x: 0, y: 0 }, next: [],
    },
  ],
});
