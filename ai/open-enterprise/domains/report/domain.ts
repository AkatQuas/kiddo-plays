import { defineDomain } from "@open-erp/metamodel";

/**
 * Report domain. The Reports group in the sidebar lives on the workspace root navigation.ts.
 * The daily report is still a read-only operating snapshot. The payroll report is a settlement document
 * formed from effective work reports (there is no wage approval). It is not a dashboard card, and it does not replace posting in other domains.
 *
 * The dashboard's only HTTP entry is the browser `GET /api/dashboard?code=`:
 * inside one company it is not cut by role or personal data scope, and it is not shared across companies.
 * `code` only picks a region of the same dashboard:
 *   home | warehouse | production | procurement | sales
 * A missing code means home.
 */
export default defineDomain({
  label: "Reports",
  dashboards: [
    // ── Home assistant ──────────────────────────────────────────────────
    {
      code: "home",
      label: "Home",
      version: "2.3.0",
      reportTeaser: true,
      cards: [
        {
          key: "factoryHealth",
          label: "Factory health",
          unit: "points",
          measure: { type: "snapshot", source: "dailyReport", field: "score" },
          compare: "previous_day",
          betterWhen: "higher",
          severity: "auto",
        },
        {
          key: "todaySalesAmount",
          label: "Sales today",
          unit: "CNY",
          measure: {
            type: "sum",
            module: "salesOrder",
            field: "totalAmount",
            filters: [
              { field: "orderDate", op: "eq", value: { $runtime: "today" } },
              { field: "status", op: "not_in", value: ["cancelled"] },
            ],
            cap: 500,
          },
          compare: "previous_day",
          betterWhen: "higher",
          severity: "auto",
        },
        {
          key: "todayOrders",
          label: "New orders today",
          unit: "docs",
          measure: {
            type: "count",
            module: "salesOrder",
            filters: [
              { field: "orderDate", op: "eq", value: { $runtime: "today" } },
              { field: "status", op: "not_in", value: ["cancelled"] },
            ],
          },
          compare: null,
          severity: "positive",
        },
        {
          key: "productionCompletionRate",
          label: "Production completion rate",
          unit: "%",
          measure: {
            type: "ratio",
            numerator: {
              type: "count",
              module: "productionTask",
              filters: [{ field: "status", op: "eq", value: "completed" }],
            },
            denominator: {
              type: "count",
              module: "productionTask",
              filters: [{ field: "status", op: "not_in", value: ["cancelled"] }],
            },
            precision: 1,
          },
          compare: {
            basis: "previous_day",
            unavailable: "Production tasks keep changing. There is no snapshot of yesterday on the same basis, so today's task status cannot be used to reconstruct yesterday's completion rate",
          },
          betterWhen: "higher",
          severity: "auto",
        },
        {
          key: "materialKitRate",
          label: "Material kit rate",
          unit: "%",
          measure: {
            type: "ratio",
            numerator: {
              type: "count",
              module: "materialRequirement",
              filters: [{ field: "status", op: "eq", value: "kitted" }],
            },
            denominator: {
              type: "count",
              module: "materialRequirement",
              filters: [{ field: "status", op: "not_in", value: ["cancelled"] }],
            },
            precision: 1,
          },
          compare: {
            basis: "previous_day",
            unavailable: "Material requirements keep changing. There is no snapshot of yesterday on the same basis, so today's kit status cannot be used to reconstruct yesterday's kit rate",
          },
          betterWhen: "higher",
          severity: "auto",
        },
        {
          key: "averageDeliveryCycle",
          label: "Average order delivery cycle",
          unit: "days",
          measure: { type: "snapshot", source: "dailyReport", field: "averageDeliveryCycleDays" },
          compare: "previous_day",
          betterWhen: "lower",
          severity: "auto",
        },
        // ── Bubbles and daily-report pressure points on the home scene ──
        // These cards are not in the bottom five, but they are still facts visible on home.
        // They live on the home surface so the browser does not walk role RBAC module by module
        // and show "no role" as if there were no data.
        {
          key: "purchasePendingReceipt",
          label: "Purchases awaiting receipt",
          unit: "docs",
          measure: {
            type: "count",
            module: "purchaseOrder",
            filters: [{ field: "status", op: "eq", value: "awaitingReceipt" }],
          },
          compare: null,
          severity: "attention",
        },
        {
          key: "productionInProgress",
          label: "Tasks in production",
          unit: "items",
          measure: {
            type: "count",
            module: "productionTask",
            filters: [{ field: "status", op: "eq", value: "inProduction" }],
          },
          compare: null,
          severity: "positive",
        },
        {
          key: "pendingWarehouseReview",
          label: "Warehouse documents awaiting review",
          unit: "docs",
          measure: {
            type: "breakdown",
            items: [
              {
                module: "materialIssue",
                label: "Material issues",
                filters: [{ field: "status", op: "eq", value: "pendingReview" }],
              },
              {
                module: "materialReturn",
                label: "Material returns",
                filters: [{ field: "status", op: "eq", value: "pendingReview" }],
              },
              {
                module: "productionReceipt",
                label: "Finished-goods receipts",
                filters: [{ field: "status", op: "eq", value: "pendingReview" }],
              },
            ],
          },
          compare: null,
          severity: "attention",
        },
        {
          key: "pendingMaterialIssue",
          label: "Key material awaiting issue",
          unit: "docs",
          measure: {
            type: "count",
            module: "materialRequirement",
            filters: [{ field: "status", op: "eq", value: "awaitingIssue" }],
          },
          compare: null,
          severity: "attention",
        },
        {
          key: "pendingSalesApproval",
          label: "Orders awaiting approval",
          unit: "docs",
          measure: {
            type: "count",
            module: "salesOrder",
            filters: [{ field: "status", op: "eq", value: "pendingReview" }],
          },
          compare: null,
          severity: "attention",
        },
      ],
      quickQuestions: [],
      shortcuts: [],
    },

    // ── Warehouse assistant ───────────────────────────────────────────────
    {
      code: "warehouse",
      label: "Warehouse assistant",
      version: "1.0.0",
      reportTeaser: false,
      cards: [
        {
          key: "todayOutbound",
          label: "Issues today",
          unit: "docs",
          measure: {
            type: "count",
            module: "stockOut",
            filters: [
              { field: "status", op: "eq", value: "approved" },
              { field: "applyTime", op: "eq", value: { $runtime: "today" } },
            ],
          },
          compare: null,
          severity: "auto",
        },
        {
          key: "todayInbound",
          label: "Receipts today",
          unit: "docs",
          measure: {
            type: "count",
            module: "stockIn",
            filters: [
              { field: "status", op: "eq", value: "approved" },
              { field: "applyTime", op: "eq", value: { $runtime: "today" } },
            ],
          },
          compare: null,
          severity: "positive",
        },
        {
          key: "pendingReview",
          label: "Documents awaiting review",
          unit: "docs",
          measure: {
            type: "breakdown",
            items: [
              { module: "materialIssue", label: "Material issues", filters: [{ field: "status", op: "eq", value: "pendingReview" }] },
              { module: "materialReturn", label: "Material returns", filters: [{ field: "status", op: "eq", value: "pendingReview" }] },
              { module: "productionReceipt", label: "Finished-goods receipts", filters: [{ field: "status", op: "eq", value: "pendingReview" }] },
            ],
          },
          compare: null,
          severity: "auto",
        },
        {
          key: "lowStock",
          label: "Below safety stock",
          unit: "kinds",
          measure: {
            type: "unsupported",
            reason: "Product masters have no safety stock yet, so below-safety stock cannot be calculated",
          },
          compare: null,
          severity: "warning",
        },
      ],
      quickQuestions: [
        { key: "purchaseArrivedNotReceived", label: "Which purchased materials have arrived but are not received?", prompt: "Look up purchased materials that have arrived but are not received" },
        { key: "materialIssuePendingReview", label: "Which material issues are not yet reviewed?", prompt: "Look up material issues that are not yet reviewed" },
        { key: "materialIssuePendingOutbound", label: "Which material issues are not yet issued?", prompt: "Look up material issues that are approved but not yet issued" },
        { key: "productionReadyForReceipt", label: "Which production tasks can be received into stock?", prompt: "Look up production tasks that are finished but not yet received as finished goods" },
      ],
      shortcuts: [
        { key: "stockQuery", label: "Look up stock", path: "/_stock-query" },
        { key: "stockIn", label: "Stock in", path: "/stockIn" },
        { key: "stockOut", label: "Stock out", path: "/stockOut" },
        { key: "product", label: "Maintain product masters", path: "/product" },
      ],
    },

    // ── Production assistant ──────────────────────────────────────────────
    {
      code: "production",
      label: "Production assistant",
      version: "1.0.0",
      reportTeaser: false,
      cards: [
        {
          key: "activeTasks",
          label: "Task count",
          unit: "docs",
          measure: {
            type: "count",
            module: "productionTask",
            filters: [
              {
                field: "status",
                op: "in",
                value: ["awaitingLaunch", "inProduction"],
              },
            ],
          },
          compare: null,
          severity: "auto",
        },
        {
          key: "todayOutput",
          label: "Work reports completed today",
          unit: "docs",
          measure: {
            type: "count",
            module: "processReport",
            filters: [
              { field: "status", op: "eq", value: "completed" },
              { field: "reportedAt", op: "gte", value: { $runtime: "today" } },
              { field: "reportedAt", op: "lt", value: { $runtime: "today", offsetDays: 1 } },
            ],
          },
          compare: null,
          severity: "positive",
        },
        {
          key: "soonOverdueTasks",
          label: "Due soon",
          unit: "docs",
          measure: {
            type: "count",
            module: "productionTask",
            filters: [
              {
                field: "status",
                op: "in",
                value: ["awaitingLaunch", "inProduction"],
              },
              { field: "plannedEndDate", op: "gte", value: { $runtime: "today" } },
              { field: "plannedEndDate", op: "lte", value: { $runtime: "today", offsetDays: 3 } },
            ],
          },
          compare: null,
          severity: "attention",
        },
        {
          key: "abnormalDocs",
          label: "Exception documents",
          unit: "docs",
          measure: {
            type: "breakdown",
            items: [
              {
                module: "productionOrder",
                label: "Production orders awaiting review",
                filters: [{ field: "status", op: "eq", value: "pendingReview" }],
              },
              {
                module: "processReport",
                label: "Work reports awaiting confirmation",
                filters: [{ field: "status", op: "eq", value: "pendingReview" }],
              },
              {
                module: "productionReceipt",
                label: "Finished-goods receipts awaiting review",
                filters: [{ field: "status", op: "eq", value: "pendingReview" }],
              },
            ],
          },
          compare: null,
          severity: "critical",
        },
      ],
      quickQuestions: [
        { key: "poPendingReview", label: "Which production orders are awaiting review?", prompt: "Look up production orders that are not yet reviewed" },
        { key: "poPendingRelease", label: "Which production orders are waiting to be released?", prompt: "Look up production orders that are approved but not released" },
        { key: "taskPendingDispatch", label: "Which production tasks are waiting to be assigned?", prompt: "Look up production tasks that are not yet assigned" },
        { key: "taskUnreportedToday", label: "Which tasks still have no work report today?", prompt: "Look up production tasks that still have no work report today" },
      ],
      shortcuts: [
        { key: "newProductionOrder", label: "New production order", path: "/productionOrder" },
        { key: "dispatchTask", label: "Assign production tasks", path: "/productionTask" },
        { key: "productionReceipt", label: "Finished-goods receipt", path: "/productionReceipt" },
      ],
    },

    // ── Purchasing assistant ──────────────────────────────────────────────
    {
      code: "procurement",
      label: "Purchasing assistant",
      version: "1.0.0",
      reportTeaser: false,
      cards: [
        {
          key: "openPurchaseOrders",
          label: "Open",
          unit: "docs",
          measure: {
            type: "count",
            module: "purchaseOrder",
            filters: [
              { field: "status", op: "in", value: ["pendingReview", "awaitingReceipt", "receiving"] },
            ],
          },
          compare: null,
          severity: "auto",
        },
        {
          key: "pendingInbound",
          label: "awaitingInbound",
          unit: "docs",
          measure: {
            type: "count",
            module: "purchaseOrder",
            filters: [{ field: "status", op: "in", value: ["awaitingReceipt", "receiving"] }],
          },
          compare: null,
          severity: "positive",
        },
        {
          key: "soonOverduePurchase",
          label: "Due soon",
          unit: "docs",
          // Planned arrival is on the line. Until the header has one due-date field, awaitingReceipt/receiving is a placeholder plus an explanation.
          // A real window on line planArrivalDate needs line-level aggregation, to be added with the analysis capability.
          measure: {
            type: "unsupported",
            reason: "Purchases due soon must be aggregated by the line's planned arrival date. A header count cannot express that until line-level query is available",
          },
          compare: null,
          severity: "warning",
        },

      ],
      quickQuestions: [
        { key: "poIncomplete", label: "Which purchase orders are not finished?", prompt: "Look up purchase orders that are not finished" },
        { key: "poArrivingSoon", label: "Which purchase orders are about to arrive?", prompt: "Look up purchase orders that are about to arrive" },
        { key: "poOverdue", label: "Which purchase orders are already overdue?", prompt: "Look up purchase orders that are already overdue" },
      ],
      shortcuts: [
        { key: "newPurchasePlan", label: "New purchase plan", path: "/purchasePlan" },
        { key: "newPurchaseOrder", label: "New purchase order", path: "/purchaseOrder" },
        { key: "purchaseReceipt", label: "Purchase receipt", path: "/purchaseReceipt" },
      ],
    },

    // ── Sales assistant ───────────────────────────────────────────────────
    {
      code: "sales",
      label: "Sales assistant",
      version: "1.0.0",
      reportTeaser: false,
      cards: [
        {
          key: "todaySalesAmount",
          label: "Sales today",
          unit: "CNY",
          measure: {
            type: "sum",
            module: "salesOrder",
            field: "totalAmount",
            filters: [
              { field: "orderDate", op: "eq", value: { $runtime: "today" } },
              { field: "status", op: "not_in", value: ["cancelled"] },
            ],
            cap: 500,
          },
          compare: null,
          severity: "auto",
        },
        {
          key: "pendingShip",
          label: "inProgress",
          unit: "docs",
          measure: {
            type: "count",
            module: "salesOrder",
            filters: [{ field: "status", op: "in", value: ["inProgress"] }],
          },
          compare: null,
          severity: "positive",
        },
        {
          key: "soonOverdueSales",
          label: "Due soon",
          unit: "docs",
          measure: {
            type: "count",
            module: "salesOrder",
            filters: [
              { field: "status", op: "in", value: ["inProgress"] },
              { field: "promiseDate", op: "gte", value: { $runtime: "today" } },
              { field: "promiseDate", op: "lte", value: { $runtime: "today", offsetDays: 3 } },
            ],
          },
          compare: null,
          severity: "attention",
        },

      ],
      quickQuestions: [
        { key: "todayNewOrders", label: "Which sales orders were added today?", prompt: "Look up sales orders added today" },
        { key: "monthUncollected", label: "How much receivable is still uncollected this month?", prompt: "Look up receivables not yet collected this month" },
        { key: "ordersPendingApprove", label: "Which sales orders are awaiting approval?", prompt: "Look up sales orders that are not yet approved" },
      ],
      shortcuts: [
        { key: "newSalesOrder", label: "New sales order", path: "/salesOrder" },
        { key: "listSalesOrder", label: "Look up sales orders", path: "/salesOrder" },
        { key: "salesDelivery", label: "Sales shipment", path: "/salesDelivery" },
      ],
    },
  ],
});
