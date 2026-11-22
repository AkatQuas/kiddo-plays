import { defineSurfaces } from "@open-erp/metamodel";

/**
 * Production report: a cross pivot of assignments and work reports. Params and columns are derived from the pivot declaration, not written by hand.
 */
export const surfaces = defineSurfaces({
  productionReport: {
    label: "Production report",
    permission: "system:productionReport:read",
    path: "/_production-report",
    sql: null,
    modes: null,
    extras: {},
    pivot: {
      facts: [
        {
          module: "processAssignment",
          status: ["awaitingProduction", "inProduction", "completed"],
          dateField: "assignedAt",
          // A fact measure can only be one column, or one rollup subquery. A listing sub would turn both measures into columns,
          // and the multiplication has to happen before the sum. Approved good and defect quantities are not in the base unit. calculate would add a table column;
          // a formula derive has no column, and only a rollup can be a fact measure. Pending production therefore uses a rowExpr, which is mutually exclusive with field.
          measures: {
            assigned: { field: "baseAssignedQty" },
            // Approved good and defect quantities are in the assignment unit (progressLines quantity, the same unit as assignedQty).
            // Pending in the base unit = max(0, baseAssignedQty − (approvedQualifiedQty + approvedDefectQty) × unitFactor).
            // Compute it per assignment, then sum: an over-produced assignment is 0 and does not offset another assignment's pending quantity.
            // A row group with no assignment leaves this column empty.
            pending: {
              rowExpr: {
                op: "max",
                args: [
                  { value: 0 },
                  {
                    op: "sub",
                    args: [
                      { field: "baseAssignedQty" },
                      {
                        op: "mul",
                        args: [
                          { op: "add", args: [{ field: "approvedQualifiedQty" }, { field: "approvedDefectQty" }] },
                          { field: "unitFactor" },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          module: "processReport",
          status: ["completed"],
          dateField: "reportedAt",
          measures: {
            qualified: { field: "baseQualifiedQty" },
            defect: { field: "baseDefectQty" },
          },
        },
      ],
      dimensions: {
        worker: { label: "Worker", path: ["workerId"], filterable: true },
        team: { label: "Team", path: ["teamId"], filterable: true },
        operation: { label: "Operation", path: ["operationId"], filterable: true },
        product: { label: "Product", path: ["productId", "productFamilyId"], filterable: false },
        sku: { label: "Product spec", path: ["productId"], filterable: false },
      },
      measures: {
        assigned: { label: "Assigned quantity", format: "integer", expr: { kind: "sum", of: "assigned" } },
        pending: { label: "Quantity still to produce", format: "integer", expr: { kind: "sum", of: "pending" } },
        produced: { label: "Produced quantity", format: "integer", expr: { kind: "add", left: "qualified", right: "defect" } },
        qualified: { label: "Good quantity", format: "integer", expr: { kind: "sum", of: "qualified" } },
        defect: { label: "Defective quantity", format: "integer", expr: { kind: "sum", of: "defect" } },
        yieldRate: {
          label: "Yield rate",
          format: "percent",
          expr: { kind: "ratio", numerator: "qualified", denominator: "produced", scale: 100 },
        },
      },
      defaultRowDims: ["worker", "team", "operation"],
      requiredRowDims: [],
      maxRangeDays: 731,
    },
  },
  deliveryReport: {
    label: "Delivery report",
    permission: "system:deliveryReport:read",
    path: "/_delivery-report",
    sql: null, modes: null, extras: {},
    pivot: {
      facts: [{
        module: "salesOrder", through: "lines",
        status: ["inProgress", "completed"], dateField: "createdAt",
        measures: {
          ordered: { field: "baseQty" },
          shipped: { field: "shippedBaseQty" },
        },
      }],
      dimensions: {
        customer: { label: "Customer", path: ["customerId"], filterable: true },
        salesperson: { label: "Salesperson", path: ["salesperson"], filterable: true },
        product: {
          label: "Product", path: ["productId", "productFamilyId"], filterable: true,
          attrs: { productUnit: { label: "Unit", field: "mainUnit" } },
        },
        sku: { label: "Product spec", path: ["productId"], filterable: true },
        salesOrder: { label: "Sales order no.", on: "header", field: "id", filterable: true },
        promiseDate: { label: "Promise date", on: "header", field: "promiseDate", filterable: true, filter: "dateRange" },
        overdue: { label: "Overdue status", on: "header", field: "promiseDate", filterable: true, bucket: "pastDue", options: { past: "Overdue", notPast: "inProgress" } },
      },
      measures: {
        ordered: { label: "Ordered quantity", format: "integer", expr: { kind: "sum", of: "ordered" } },
        shipped: { label: "Shipped quantity", format: "integer", expr: { kind: "sum", of: "shipped" } },
        unshipped: { label: "Unshipped quantity", format: "integer", expr: { kind: "sub", left: "ordered", right: "shipped" } },
        progress: { label: "Shipment progress", format: "percent", expr: { kind: "ratio", numerator: "shipped", denominator: "ordered", scale: 100 }, filter: "range" },
      },
      defaultRowDims: ["product", "customer", "salesperson"],
      requiredRowDims: ["product"],
      maxRangeDays: 731,
      defaultSort: "dateDesc",
    },
  },
});
