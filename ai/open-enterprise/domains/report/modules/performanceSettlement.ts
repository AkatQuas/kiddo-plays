import { defineModule } from "@open-erp/metamodel";

/** One completed work report corresponds to one wage slip. The rate and the pricing coefficient freeze when it is formed. Defects are not paid by the piece. */
export default defineModule({
  label: "Wage report",
  numbering: { prefix: "WAGE", seqScope: "day" },
  fields: [
    { key: "code", label: "Wage slip no.", type: "string", primary: true, auto: true },
    {
      key: "processReportId",
      label: "Work report",
      type: "ref",
      ref: "processReport",
      required: true,
      unique: true,
      help: "One completed work report corresponds to one wage slip",
    },
    {
      key: "processReportCode",
      label: "Work report no.",
      type: "string",
      derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "code" },
    },
    { key: "workerId", label: "Worker", type: "ref", ref: "worker", snapshot: { from: "processReport", match: "processReportId", through: null, field: "workerId" }, person: { role: "receiver", via: { ref: "worker", field: "platformUserId" } } },
    { key: "teamId", label: "Team", type: "ref", ref: "orgUnit", snapshot: { from: "processReport", match: "processReportId", through: null, field: "teamId" }, person: { role: "receiver", via: { members: "worker", by: "productionOrgId", field: "platformUserId" } } },
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", snapshot: { from: "processReport", match: "processReportId", through: null, field: "operationId" } },
    { key: "processAssignmentId", label: "Assignment", type: "ref", ref: "processAssignment", snapshot: { from: "processReport", match: "processReportId", through: null, field: "processAssignmentId" } },
    { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", snapshot: { from: "processReport", match: "processReportId", through: null, field: "productionTaskId" } },
    { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder", snapshot: { from: "processReport", match: "processReportId", through: null, field: "productionOrderId" } },
    { key: "productId", label: "Product", type: "ref", ref: "product", snapshot: { from: "processReport", match: "processReportId", through: null, field: "productId" } },

    // Report columns carried on read (`derive.lookup`: computed on query, not stored).
    // This batch is not a snapshot. It only looks up, with the list, the upstream cells the wage report shows,
    // so the screen does not walk back to the work report, assignment, task, order, and product row by row.
    // The frozen pricing facts stay in the snapshots above (rate, coefficient, quantity). Changing upstream does not change the money this slip settled.
    // The number and name cells take that one cell, not the reference label. `labels` returns a compound title
    // (assignment label = number + operation name, product label = name + barcode + specification). Putting that into a single-value column such as assignment number or product name adds an extra piece.
    { key: "assignmentCode", label: "Assignment no.", type: "string", derive: { kind: "lookup", from: "processAssignment", match: "processAssignmentId", through: null, field: "code" } },
    { key: "taskCode", label: "Production task no.", type: "string", derive: { kind: "lookup", from: "productionTask", match: "productionTaskId", through: null, field: "code" } },
    { key: "taskQty", label: "Task quantity", type: "number", derive: { kind: "lookup", from: "productionTask", match: "productionTaskId", through: null, field: "plannedQty" } },
    { key: "orderCode", label: "Production order no.", type: "string", derive: { kind: "lookup", from: "productionOrder", match: "productionOrderId", through: null, field: "code" } },
    { key: "orderQty", label: "Order quantity", type: "number", derive: { kind: "lookup", from: "productionOrder", match: "productionOrderId", through: null, field: "orderQty" } },
    { key: "productName", label: "Product name", type: "string", derive: { kind: "lookup", from: "product", match: "productId", through: null, field: "name" } },
    { key: "spec", label: "Specification", type: "string", derive: { kind: "lookup", from: "product", match: "productId", through: null, field: "spec" } },
    { key: "productBarcode", label: "SKU code", type: "string", derive: { kind: "lookup", from: "product", match: "productId", through: null, field: "barcode" } },
    { key: "productRemark", label: "Specification note", type: "text", derive: { kind: "lookup", from: "product", match: "productId", through: null, field: "remark" } },
    { key: "unit", label: "Unit", type: "string", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "unit" } },
    { key: "assignedQty", label: "Assigned quantity", type: "number", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "assignedQty" } },
    { key: "assignedAt", label: "Assigned at", type: "datetime", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "assignedAt" } },
    { key: "plannedStartDate", label: "Assignment start", type: "datetime", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "plannedStartDate" } },
    { key: "plannedEndDate", label: "Assignment end", type: "datetime", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "plannedEndDate" } },
    // A ref lookup: the cell still holds the equipment or mold identity. The name comes back with the list in the `labels` sidecar.
    { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "equipmentId" } },
    { key: "moldId", label: "Mold", type: "ref", ref: "mold", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "moldId" } },
    // The three production-organization cells are also one hop. The work report already froze factory, workshop, and line coordinates
    // (on the assignment side they are snapshotted level by level from the orgUnit ancestors), so this module does not walk the parent chain.
    { key: "factoryOrgId", label: "Factory", type: "ref", ref: "orgUnit", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "factoryOrgId" } },
    { key: "workshopOrgId", label: "Workshop", type: "ref", ref: "orgUnit", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "workshopOrgId" } },
    { key: "productionLineOrgId", label: "Production line", type: "ref", ref: "orgUnit", derive: { kind: "lookup", from: "processReport", match: "processReportId", through: null, field: "productionLineOrgId" } },

    { key: "pieceRate", label: "Piece rate", type: "money", snapshot: { from: "processReport", match: "processReportId", through: null, field: "pieceRate" } },
    {
      key: "pricingCoefficient",
      label: "Pricing coefficient",
      type: "number",
      // The Planner matches the worker's default operation-line coefficient by the reported operation, then falls back to the worker header. Blank pays as 1.
      plannerSupplied: true,
      help: "Frozen when the slip is created: default operation line, then worker header, then 1 if blank",
    },
    { key: "pieceQty", label: "Piece quantity", type: "number", snapshot: { from: "processReport", match: "processReportId", through: null, field: "qualifiedQty" } },
    { key: "defectQty", label: "Defect quantity", type: "number", snapshot: { from: "processReport", match: "processReportId", through: null, field: "defectQty" } },
    { key: "reportedAt", label: "Reported at", type: "datetime", snapshot: { from: "processReport", match: "processReportId", through: null, field: "reportedAt" } },
    {
      key: "remark",
      label: "Report remark",
      type: "text",
      snapshot: { from: "processReport", match: "processReportId", through: null, field: "remark", optional: true },
    },
    {
      key: "pieceWage",
      label: "Settled wage",
      type: "money",
      derive: {
        kind: "formula",
        expr: {
          op: "mul",
          args: [
            { field: "pieceQty" },
            { field: "pieceRate" },
            { orElse: { of: { field: "pricingCoefficient" }, whenEmpty: 1 } },
          ],
        },
      },
    },
  ],
  lifecycle: {
    statuses: [
      { key: "pendingSettlement", label: "pendingSettlement", color: "blue", initial: true, editable: "none" },
      { key: "settled", label: "settled", color: "green", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "settle", from: "pendingSettlement", to: "settled", action: "Settle", primary: true, confirm: true },
    ],
  },
  preconditions: [
    {
      id: "source_report_approved",
      onTransition: "settle",
      source: "gate",
      level: "block",
      why: "Wages are taken only from completed work reports",
      message: "The work report for this wage slip is not approved yet, so it cannot be settled.",
      check: { primitive: "ref_field_compare", via: "processReportId", entity: "processReport", field: "status", op: "eq", right: { value: "completed" } },
    },
  ],
  handoff: [
    {
      id: "settle_wage_report",
      kind: "todo",
      onStatus: "pendingSettlement",
      to: "production-manager",
      title: "Settle this wage",
      why: "The work report is approved. The system has calculated this wage from the qualified quantity, the frozen piece rate, and the pricing coefficient. After settle it cannot be changed",
    },
  ],
  views: {
    list: {
      columns: [
        "code", "pieceRate", "pricingCoefficient", "pieceQty", "pieceWage",
        "workerId", "teamId", "processReportCode", "reportedAt", "defectQty", "remark",
        "assignmentCode", "taskCode", "orderCode",
        "productName", "orderQty", "unit", "spec", "productBarcode", "productRemark",
        "operationId", "taskQty",
        "factoryOrgId", "workshopOrgId", "productionLineOrgId",
        "equipmentId", "moldId",
        "plannedStartDate", "plannedEndDate", "assignedQty", "assignedAt",
        "status",
      ],
      referenceLabel: ["code", "processReportCode"],
      filters: ["status", "reportedAt", "operationId", "workerId", "teamId"],
      searchable: ["code", "processReportCode"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Report source", fields: ["code", "processReportId", "processReportCode", "workerId", "teamId", "operationId", "processAssignmentId", "assignmentCode", "productionTaskId", "taskCode", "productionOrderId", "orderCode", "productId"] },
      { title: "Piece rate", fields: ["pieceRate", "pricingCoefficient", "pieceQty", "defectQty", "pieceWage", "reportedAt"] },
      { title: "Product and order", fields: ["productName", "spec", "productBarcode", "productRemark", "unit", "taskQty", "orderQty"] },
      { title: "Assignment", fields: ["plannedStartDate", "plannedEndDate", "assignedQty", "assignedAt", "equipmentId", "moldId"] },
      { title: "Production organization", fields: ["factoryOrgId", "workshopOrgId", "productionLineOrgId"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
