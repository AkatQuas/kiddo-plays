import { defineInsights, type InsightSqlCellDef } from "@open-erp/metamodel";

function sqlCell(cell: InsightSqlCellDef): InsightSqlCellDef {
  return cell;
}

const leftover = {
  overdueUnshippedCount: sqlCell({
    kind: "sql",
    label: "Due and unshipped",
    sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
      WHERE so.status = {{status:salesOrder.inProgress}}
        AND so.promise_date < {{asOf}}::date`,
    link: "salesOrder",
    params: ["asOf"],
    result: "count",
    unit: "docs",
    itemsLimit: 3,
    summaryFields: ["customer_name", "promise_date"],
  }),
  delayedTaskCount: sqlCell({
    kind: "sql",
    label: "Delayed tasks",
    sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
      WHERE t.status NOT IN ({{status:productionTask.completed}}, {{status:productionTask.cancelled}})
        AND t.planned_start_date < {{asOf}}::date
        AND t.planned_end_date < {{asOf}}::date`,
    link: "productionTask",
    params: ["asOf"],
    result: "count",
    unit: "items",
    itemsLimit: 3,
    summaryFields: ["product_name", "planned_end_date", "planned_qty"],
  }),
  pendingRequirementCount: sqlCell({
    kind: "sql",
    label: "Requirements awaiting issue",
    sql: `SELECT count(*)::int AS value FROM {{table:materialRequirement}} m
      WHERE m.status = {{status:materialRequirement.awaitingIssue}}`,
    link: "materialRequirement",
    params: [],
    result: "count",
    unit: "items",
  }),
  wipTaskCount: sqlCell({
    kind: "sql",
    label: "Tasks in production",
    sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
      WHERE t.status IN ({{status:productionTask.inProduction}})`,
    link: "productionTask",
    params: [],
    result: "count",
    unit: "items",
  }),
  monthSalesAmount: sqlCell({
    kind: "sql",
    label: "Sales this month",
    sql: `SELECT coalesce(sum(so.total_amount), 0)::numeric AS value FROM {{table:salesOrder}} so
      WHERE so.order_date >= date_trunc('month', {{asOf}}::date)::date
        AND so.order_date <= {{asOf}}::date`,
    link: "salesOrder",
    params: ["asOf"],
    result: "sum",
    unit: "CNY",
  }),
  inTransitPoCount: sqlCell({
    kind: "sql",
    label: "Purchase orders in transit",
    sql: `SELECT count(*)::int AS value FROM {{table:purchaseOrder}} po
      WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})`,
    link: "purchaseOrder",
    params: [],
    result: "count",
    unit: "docs",
  }),
  purchaseDueInTransit: sqlCell({
    kind: "sql",
    label: "In-transit purchases due",
    sql: `SELECT count(DISTINCT po.id)::int AS value
      FROM {{table:purchaseOrder}} po
      JOIN {{table:purchaseOrder.lines}} pol ON pol.bill_id = po.id
      WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})
        AND pol.plan_arrival_date <= ({{asOf}}::date + 7)`,
    link: "purchaseOrder",
    params: ["asOf"],
    result: "count",
    unit: "docs",
  }),
  supplierOverdueCount: sqlCell({
    kind: "sql",
    label: "Purchase orders overdue and not arrived",
    sql: `SELECT count(DISTINCT po.id)::int AS value
      FROM {{table:purchaseOrder}} po
      JOIN {{table:purchaseOrder.lines}} pol ON pol.bill_id = po.id
      WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})
        AND pol.plan_arrival_date < {{asOf}}::date`,
    link: "purchaseOrder",
    params: ["asOf"],
    result: "count",
    unit: "docs",
  }),
  stockCoordCount: sqlCell({
    kind: "sql",
    label: "Non-zero on-hand coordinates",
    sql: `SELECT count(*)::int AS value FROM (
        SELECT l.subject_id, l.scope_id
        FROM {{ledger:stock}} l
        WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
        GROUP BY l.subject_id, l.scope_id
        HAVING sum({{ledgerNet:stock.l}}) <> 0
      ) coords`,
    params: ["asOf"],
    result: "count",
    unit: "items",
  }),
  stockCoords: sqlCell({
    kind: "sql",
    label: "Balance by warehouse (top 8)",
    sql: `SELECT l.subject_id, l.scope_id, count(*) OVER()::int AS total_count,
        coalesce(max(p.name), l.subject_id) AS product_name,
        coalesce(max(p.code), l.subject_id) AS product_code,
        coalesce(max(w.name), l.scope_id) AS warehouse_name,
        l.scope_id AS warehouse_id,
        sum({{ledgerNet:stock.l}}) AS net,
        max(l.occurred_at) AS last_occurred_at,
        {{asOf}}::date::text AS as_of
      FROM {{ledger:stock}} l
      LEFT JOIN {{table:product}} p ON p.id = l.subject_id
      LEFT JOIN {{table:warehouse}} w ON w.id = l.scope_id
      WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
      GROUP BY l.subject_id, l.scope_id
      HAVING sum({{ledgerNet:stock.l}}) <> 0
      ORDER BY net DESC
      LIMIT 8`,
    params: ["asOf"],
    result: "rows",
    unit: "items",
    itemsLimit: 8,
    table: {
      page: "/_stock-query",
      totalFrom: "total_count",
      columns: [
        { key: "productName", label: "Product", from: "product_name" },
        { key: "warehouseName", label: "Warehouse", from: "warehouse_name" },
        { key: "qty", label: "On hand", from: "net" },
        { key: "lastOccurredAt", label: "Last movement", from: "last_occurred_at" },
        { key: "asOf", label: "As of", from: "as_of" },
      ],
    },
  }),
  stockByWarehouse: sqlCell({
    kind: "sql",
    label: "Non-zero coordinates by warehouse",
    sql: `SELECT coalesce(max(w.name), coords.scope_id) AS label, count(*)::int AS value
      FROM (
        SELECT l.subject_id, l.scope_id
        FROM {{ledger:stock}} l
        WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
        GROUP BY l.subject_id, l.scope_id
        HAVING sum({{ledgerNet:stock.l}}) <> 0
      ) coords
      LEFT JOIN {{table:warehouse}} w ON w.id = coords.scope_id
      GROUP BY coords.scope_id ORDER BY value DESC LIMIT 8`,
    params: ["asOf"],
    result: "rows",
    unit: "items",
  }),
  idleCoords: sqlCell({
    kind: "sql",
    label: "Slow-moving material",
    sql: `SELECT l.subject_id, l.scope_id,
        sum({{ledgerNet:stock.l}}) AS net,
        max(l.occurred_at) AS last_occurred_at,
        CASE WHEN max(l.occurred_at) IS NULL THEN -1
          ELSE floor(extract(epoch FROM ({{asOf}}::date::timestamptz - max(l.occurred_at))) / 86400)
        END AS value
      FROM {{ledger:stock}} l
      WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
      GROUP BY l.subject_id, l.scope_id
      HAVING sum({{ledgerNet:stock.l}}) > 0
        AND (max(l.occurred_at) IS NULL OR max(l.occurred_at) <= ({{asOf}}::date - interval '90 days'))`,
    params: ["asOf"],
    result: "rows",
    unit: "items",
  }),
};

const salesDraftOrAudit = sqlCell({
  kind: "sql",
  label: "Sales orders awaiting review",
  sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
    WHERE so.status = {{status:salesOrder.pendingReview}}`,
  link: "salesOrder",
  params: [],
  result: "count",
  unit: "docs",
  itemsLimit: 3,
  summaryFields: ["customer_name", "total_amount"],
});

const dueSoonSales = sqlCell({
  kind: "sql",
  label: "Due within 7 days",
  sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
    WHERE so.status IN ({{status:salesOrder.inProgress}}, {{status:salesOrder.inProgress}})
      AND so.promise_date >= {{asOf}}::date
      AND so.promise_date <= ({{asOf}}::date + 7)`,
  link: "salesOrder",
  params: ["asOf"],
  result: "count",
  unit: "docs",
});

export const insights = defineInsights({
  overdueUnshipped: {
    label: "Due and unshipped",
    cells: { count: leftover.overdueUnshippedCount },
  },
  delayedTask: {
    label: "Delayed tasks",
    cells: { count: leftover.delayedTaskCount },
  },
  pendingRequirement: {
    label: "Requirements awaiting issue",
    cells: { count: leftover.pendingRequirementCount },
  },
  wipTask: {
    label: "Tasks in production",
    cells: { count: leftover.wipTaskCount },
  },
  factory_today: {
    label: "Factory today",
    brief: {
      title: "Factory today",
      hint: "Factory today / focus / operating risk",
      caveats: [
        "Counted from status at generation time. Historical issues and collections are not replayed",
        "Awaiting issue uses material requirement status=awaitingIssue",
        "In production counts production tasks in {inProduction}",
      ],
    },
    cells: {
      wip: leftover.wipTaskCount,
      overdue: leftover.delayedTaskCount,
      shortage: leftover.pendingRequirementCount,
      dueSoon: dueSoonSales,
      pendingApproval: salesDraftOrAudit,
    },
  },
  month_over_month: {
    label: "This month versus last month",
    brief: {
      title: "This month versus last month",
      hint: "Document counts, this month versus last month. Amounts use sales_month",
      caveats: ["Compared by document count, not by amount"],
    },
    cells: {
      thisMonthOrders: sqlCell({
        kind: "sql",
        label: "New orders this month",
        sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.order_date >= date_trunc('month', {{asOf}}::date)::date AND so.order_date <= {{asOf}}::date`,
        link: "salesOrder",
        params: ["asOf"],
        result: "count",
        unit: "docs",
      }),
      lastMonthOrders: sqlCell({
        kind: "sql",
        label: "New orders last month",
        sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.order_date >= date_trunc('month', {{asOf}}::date - interval '1 month')::date
            AND so.order_date < date_trunc('month', {{asOf}}::date)::date`,
        link: "salesOrder",
        params: ["asOf"],
        result: "count",
        unit: "docs",
      }),
      thisMonthDone: sqlCell({
        kind: "sql",
        label: "Tasks finished this month",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status = {{status:productionTask.completed}}
            AND t.actual_end_at >= date_trunc('month', {{asOf}}::date)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
      lastMonthDone: sqlCell({
        kind: "sql",
        label: "Tasks finished last month",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status = {{status:productionTask.completed}}
            AND t.actual_end_at >= date_trunc('month', {{asOf}}::date - interval '1 month')
            AND t.actual_end_at < date_trunc('month', {{asOf}}::date)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
    },
  },
  todo_inbox: {
    semantics: {
      packageRef: "open-erp/pending-work@1",
      terms: [{ ref: "open-erp/pending-order-count@1", cell: "salesToApprove", label: "Sales orders awaiting review", aliases: ["Sales orders awaiting review", "Sales orders awaiting approval"], meaning: "Count of sales orders currently awaiting review, with no limit on order date. Awaiting approval is the pendingReview status." }],
      templates: [],
    },
    label: "To-do overview",
    brief: {
      title: "To-do overview",
      hint: "My to-dos / pending / awaiting review",
      caveats: ["Counted from status at generation time, not replayed", "Due and unshipped counts only in-progress orders whose promise date is before today"],
    },
    cells: {
      toShipOverdue: leftover.overdueUnshippedCount,
      salesToApprove: salesDraftOrAudit,
      purchaseToApprove: sqlCell({
        kind: "sql",
        label: "Purchase orders awaiting review",
        sql: `SELECT count(*)::int AS value FROM {{table:purchaseOrder}} po
          WHERE po.status = {{status:purchaseOrder.pendingReview}}`,
        link: "purchaseOrder",
        params: [],
        result: "count",
        unit: "docs",
      }),
      toReceive: leftover.inTransitPoCount,
      toDispatch: sqlCell({
        kind: "sql",
        label: "Operations not fully assigned",
        sql: `SELECT count(*)::int AS value
          FROM {{table:productionTask.processLines}} pl
          JOIN {{table:productionTask}} t ON t.id = pl.bill_id
          WHERE t.status = {{status:productionTask.inProduction}}
            AND pl.planned_qty > coalesce((
              SELECT sum(a.assigned_qty) FROM {{table:processAssignment}} a
              WHERE a.process_line_id = pl.id
                AND a.status IN (
                  {{status:processAssignment.pendingReview}},
                  {{status:processAssignment.awaitingProduction}},
                  {{status:processAssignment.inProduction}}
                )
            ), 0) + coalesce((
              SELECT sum(pg.qualified_qty) FROM {{table:processAssignment.progressLines}} pg
              JOIN {{table:processAssignment}} a ON a.id = pg.bill_id
              WHERE a.process_line_id = pl.id AND a.status = {{status:processAssignment.completed}}
            ), 0)`,
        link: "productionTask",
        params: [],
        result: "count",
        unit: "items",
      }),
      toIssue: leftover.pendingRequirementCount,
    },
  },
  sales_month: {
    label: "Sales and collections this month",
    semantics: {
      packageRef: "open-erp/order-analysis@1",
      terms: [
        { ref: "open-erp/order-amount@1", cell: "totalAmount", label: "Sales order amount", aliases: ["Sales order amount", "Sales order amount", "Order amount", "Order amount"], ambiguousAliases: ["Sales amount", "Sales amount"], meaning: "Sales order totalAmount by order date, in every status. It is not shipped amount, collected amount, or posted revenue." },
        { ref: "open-erp/order-count@1", cell: "orderCount", label: "Orders this month", aliases: ["Orders this month", "Sales orders this month"], meaning: "Count of sales orders from the start of the month through the request date, in every status." },
      ],
      templates: [{
        ref: "open-erp/orders.amount-by-month@1", metricRef: "open-erp/order-amount@1",
        module: "salesOrder", dateField: "orderDate", valueField: "totalAmount", entityField: "customerId",
        entityModule: "customer", entityNameField: "name", entityPrefixes: ["Customer"], statusPolicy: "all",
        patterns: ["list {period} {entity} {metric} by month", "list {period} {entity} {metric} by month please", "list {entity} {period} {metric} by month", "{period} {entity} {metric} totals by month", "list {period} {entity} {metric} by month"],
      }],
    },
    brief: {
      title: "Sales and collections this month",
      hint: "Sales this month",
      caveats: ["Sales amount is booked to the order-date month", "Counted from status at generation time"],
    },
    cells: {
      totalAmount: leftover.monthSalesAmount,
      orderCount: sqlCell({
        kind: "sql",
        label: "New orders this month",
        sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.order_date >= date_trunc('month', {{asOf}}::date)::date AND so.order_date <= {{asOf}}::date`,
        link: "salesOrder",
        params: ["asOf"],
        result: "count",
        unit: "docs",
      }),
    },
  },
  sales_orders: {
    label: "Sales orders: delivery and new bookings",
    brief: {
      title: "Sales orders: delivery and new bookings",
      hint: "Large new orders / delivery risk / promise dates in the next 7 days",
      caveats: ["Past-due unshipped counts only in-progress orders, from status at generation time, and is not replayed"],
    },
    cells: {
      overdue: leftover.overdueUnshippedCount,
      dueSoon: dueSoonSales,
      due7: dueSoonSales,
      stale: sqlCell({
        kind: "sql",
        label: "Unshipped more than 7 days past due",
        sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.status = {{status:salesOrder.inProgress}} AND so.promise_date < ({{asOf}}::date - 7)`,
        link: "salesOrder",
        params: ["asOf"],
        result: "count",
        unit: "docs",
      }),
      recentLarge: sqlCell({
        kind: "sql",
        label: "Signed in the last 30 days",
        sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so WHERE so.order_date >= ({{asOf}}::date - 30)`,
        link: "salesOrder",
        params: ["asOf"],
        result: "count",
        unit: "docs",
        itemsLimit: 3,
        summaryFields: ["customer_name", "total_amount", "order_date"],
      }),
    },
  },
  production_progress: {
    label: "Production progress and blockers",
    brief: {
      title: "Production progress and blockers",
      hint: "Current progress / blocked step / operation backlog",
      caveats: ["In production is {inProduction}, from status at generation time"],
    },
    cells: {
      wip: leftover.wipTaskCount,
      overdueTask: leftover.delayedTaskCount,
      stale: sqlCell({
        kind: "sql",
        label: "Started more than 7 days ago and not finished",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status = {{status:productionTask.inProduction}} AND t.actual_start_at < ({{asOf}}::date - 7)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
      dueToday: sqlCell({
        kind: "sql",
        label: "Planned to finish today",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.planned_end_date >= {{asOf}}::date AND t.planned_end_date < ({{asOf}}::date + 1)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
      doneToday: sqlCell({
        kind: "sql",
        label: "Actually finished today",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.actual_end_at >= {{asOf}}::date AND t.actual_end_at < ({{asOf}}::date + 1)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
      byTaskStatus: sqlCell({
        kind: "sql",
        label: "Production tasks by status",
        sql: `SELECT t.status AS label, count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status IN ({{status:productionTask.pendingReview}}, {{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
          GROUP BY t.status ORDER BY value DESC LIMIT 8`,
        params: [],
        result: "rows",
        unit: "items",
      }),
      byOperation: sqlCell({
        kind: "sql",
        label: "Operation backlog ranking",
        sql: `SELECT p.operation_name AS label, count(*)::int AS value FROM {{table:processAssignment}} p
          WHERE p.status IN ({{status:processAssignment.pendingReview}}, {{status:processAssignment.awaitingProduction}}, {{status:processAssignment.inProduction}})
          GROUP BY p.operation_name ORDER BY value DESC LIMIT 8`,
        params: [],
        result: "rows",
        unit: "items",
      }),
    },
  },
  production_risk: {
    label: "Production delivery risk",
    brief: {
      title: "Production delivery risk",
      hint: "Production delay / risk in the next 7 days / no work report for a long time",
      caveats: ["Measured on the production task, from status at generation time"],
    },
    cells: {
      overdue: leftover.delayedTaskCount,
      dueSoon: sqlCell({
        kind: "sql",
        label: "Due within 7 days (delay risk)",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status IN ({{status:productionTask.pendingReview}}, {{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
            AND t.planned_end_date >= {{asOf}}::date AND t.planned_end_date <= ({{asOf}}::date + 7)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
      stale: sqlCell({
        kind: "sql",
        label: "Started more than 7 days ago and still not finished",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status = {{status:productionTask.inProduction}} AND t.actual_start_at < ({{asOf}}::date - 7)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
    },
  },
  purchase_due: {
    label: "Purchase payment and in transit",
    brief: {
      title: "Purchase payment and in transit",
      hint: "Purchases in transit over the next 7 days",
      caveats: ["In transit follows document status. Due-in-transit uses the line's planned arrival date"],
    },
    cells: {
      due7: leftover.purchaseDueInTransit,
      inTransit: leftover.inTransitPoCount,
    },
  },
  quality_defect: {
    label: "Defect rate and output",
    brief: {
      title: "Defect rate and output",
      hint: "Defect rate, output, and work reports by team, product, and operation",
      caveats: ["Defect rate = defect quantity / (good quantity + defect quantity), completed work reports only"],
    },
    cells: {
      reported: sqlCell({
        kind: "sql",
        label: "Cumulative reported quantity",
        sql: `SELECT coalesce(sum(p.base_qualified_qty + p.base_defect_qty), 0)::numeric AS value FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})`,
        link: "processReport",
        params: [],
        result: "sum",
        unit: "pcs",
      }),
      defect: sqlCell({
        kind: "sql",
        label: "Cumulative defect quantity",
        sql: `SELECT coalesce(sum(p.base_defect_qty), 0)::numeric AS value FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})`,
        link: "processReport",
        params: [],
        result: "sum",
        unit: "pcs",
      }),
      defectRate: sqlCell({
        kind: "sql",
        label: "Defect rate",
        sql: `SELECT CASE WHEN coalesce(sum(p.base_qualified_qty + p.base_defect_qty), 0) = 0 THEN NULL
            ELSE round(sum(p.base_defect_qty) / sum(p.base_qualified_qty + p.base_defect_qty) * 100, 1) END AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})`,
        link: "processReport",
        params: [],
        result: "scalar",
        unit: "%",
      }),
      defectRateByProduct: sqlCell({
        kind: "sql",
        label: "Defect rate by product",
        sql: `SELECT p.product_id AS label,
            CASE WHEN sum(p.base_qualified_qty + p.base_defect_qty) = 0 THEN NULL
              ELSE round(sum(p.base_defect_qty) / sum(p.base_qualified_qty + p.base_defect_qty) * 100, 1) END AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})
          GROUP BY p.product_id ORDER BY value DESC NULLS LAST LIMIT 8`,
        params: [],
        result: "rows",
        unit: "%",
      }),
      defectRateByTeam: sqlCell({
        kind: "sql",
        label: "Defect rate by team",
        sql: `SELECT p.team_id AS label,
            CASE WHEN sum(p.base_qualified_qty + p.base_defect_qty) = 0 THEN NULL
              ELSE round(sum(p.base_defect_qty) / sum(p.base_qualified_qty + p.base_defect_qty) * 100, 1) END AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})
          GROUP BY p.team_id ORDER BY value DESC NULLS LAST LIMIT 8`,
        params: [],
        result: "rows",
        unit: "%",
      }),
      outputByTeam: sqlCell({
        kind: "sql",
        label: "Output by team",
        sql: `SELECT p.team_id AS label, coalesce(sum(p.base_qualified_qty), 0)::numeric AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})
          GROUP BY p.team_id ORDER BY value DESC LIMIT 8`,
        params: [],
        result: "rows",
        unit: "pcs",
      }),
      teamOutput: sqlCell({
        kind: "sql",
        label: "Good quantity by team",
        sql: `SELECT coalesce(sum(p.base_qualified_qty), 0)::numeric AS value FROM {{table:processReport}} p
          WHERE p.status IN ({{status:processReport.completed}})`,
        link: "processReport",
        params: [],
        result: "sum",
        unit: "pcs",
      }),
      workerOutput: sqlCell({
        kind: "sql",
        label: "Good quantity by worker",
        sql: `SELECT p.worker_id AS label, coalesce(sum(p.base_qualified_qty), 0)::numeric AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})
          GROUP BY p.worker_id ORDER BY value DESC LIMIT 8`,
        params: [],
        result: "rows",
        unit: "pcs",
      }),
      workerDefect: sqlCell({
        kind: "sql",
        label: "Defects by worker",
        sql: `SELECT p.worker_id AS label, coalesce(sum(p.base_defect_qty), 0)::numeric AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})
          GROUP BY p.worker_id ORDER BY value DESC LIMIT 8`,
        params: [],
        result: "rows",
        unit: "pcs",
      }),
      rate: sqlCell({
        kind: "sql",
        label: "Defect rate",
        sql: `SELECT CASE WHEN coalesce(sum(p.base_qualified_qty + p.base_defect_qty), 0) = 0 THEN NULL
            ELSE round(sum(p.base_defect_qty) / sum(p.base_qualified_qty + p.base_defect_qty) * 100, 1) END AS value
          FROM {{table:processReport}} p WHERE p.status IN ({{status:processReport.completed}})`,
        link: "processReport",
        params: [],
        result: "scalar",
        unit: "%",
      }),
    },
  },
  material_shortage: {
    label: "Material shortage",
    brief: {
      title: "Material shortage",
      hint: "Shortage risk / which material is short / stopped for lack of material",
      caveats: ["Demand = quantity still to issue on unfinished tasks, minus on-hand in the same warehouse, from status at generation time. A shortage is counted per product and warehouse, so the same product in different warehouses is separate"],
    },
    cells: {
      openTasks: sqlCell({
        kind: "sql",
        label: "Unfinished production tasks",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status IN ({{status:productionTask.pendingReview}}, {{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})`,
        link: "productionTask",
        params: [],
        result: "count",
        unit: "items",
      }),
      pendingRequirement: leftover.pendingRequirementCount,
      shortageProducts: sqlCell({
        kind: "sql",
        label: "Product and warehouse combinations that are short",
        sql: `SELECT count(*)::int AS value FROM (
          SELECT ml.component_product_id, ml.default_issue_warehouse_id
          FROM {{table:productionTask}} t
          JOIN {{table:productionTask.materialLines}} ml ON ml.bill_id = t.id
          LEFT JOIN (
            SELECT l.subject_id, l.scope_id,
              sum({{ledgerNet:stock.l}}) AS net
            FROM {{ledger:stock}} l
            WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
            GROUP BY l.subject_id, l.scope_id
          ) s ON s.subject_id = ml.component_product_id AND s.scope_id = ml.default_issue_warehouse_id
          WHERE t.status IN ({{status:productionTask.pendingReview}}, {{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
          GROUP BY ml.component_product_id, ml.default_issue_warehouse_id
          HAVING greatest(sum({{field:ml.pendingIssueBaseQty}}) - coalesce(max(s.net), 0), 0) > 0
        ) z`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
      shortageTop: sqlCell({
        kind: "sql",
        label: "Product and warehouse with the largest gap",
        sql: `SELECT ml.component_product_id AS product_id, ml.default_issue_warehouse_id AS warehouse_id,
            max(p.name) AS product_name, max(w.name) AS warehouse_name,
            concat(max(p.name), ' · ', max(w.name)) AS label,
            greatest(sum({{field:ml.pendingIssueBaseQty}}) - coalesce(max(s.net), 0), 0) AS value
          FROM {{table:productionTask}} t
          JOIN {{table:productionTask.materialLines}} ml ON ml.bill_id = t.id
          JOIN {{table:product}} p ON p.id = ml.component_product_id
          JOIN {{table:warehouse}} w ON w.id = ml.default_issue_warehouse_id
          LEFT JOIN (
            SELECT l.subject_id, l.scope_id,
              sum({{ledgerNet:stock.l}}) AS net
            FROM {{ledger:stock}} l
            WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
            GROUP BY l.subject_id, l.scope_id
          ) s ON s.subject_id = ml.component_product_id AND s.scope_id = ml.default_issue_warehouse_id
          WHERE t.status IN ({{status:productionTask.pendingReview}}, {{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
          GROUP BY ml.component_product_id, ml.default_issue_warehouse_id
          HAVING greatest(sum({{field:ml.pendingIssueBaseQty}}) - coalesce(max(s.net), 0), 0) > 0
          ORDER BY value DESC LIMIT 8`,
        params: ["asOf"],
        result: "rows",
        unit: "items",
      }),
    },
  },
  purchase_requirement: {
    label: "Purchase demand, next 7 days",
    brief: {
      title: "Purchase demand, next 7 days",
      hint: "What to buy in the next 7 days / how much to purchase",
      caveats: ["To issue, minus on hand, minus in transit, from status at generation time"],
    },
    cells: {
      inTransitOrders: leftover.inTransitPoCount,
      toBuy: leftover.pendingRequirementCount,
      buyTop: leftover.pendingRequirementCount,
      tasksInWindow: sqlCell({
        kind: "sql",
        label: "Tasks to start within 7 days",
        sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status IN ({{status:productionTask.pendingReview}}, {{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
            AND t.planned_start_date <= ({{asOf}}::date + 7)`,
        link: "productionTask",
        params: ["asOf"],
        result: "count",
        unit: "items",
      }),
    },
  },
  supplier_delivery: {
    label: "Supplier delivery",
    brief: {
      title: "Supplier delivery",
      hint: "How many supplier deliveries are overdue / which supplier has the most orders in transit",
      caveats: ["From status at generation time: the line's planned arrival date has passed and the document is still in transit", "overdueOrders counts overdue purchase orders, not the number of suppliers"],
    },
    cells: {
      overdueOrders: leftover.supplierOverdueCount,
      openOrders: leftover.inTransitPoCount,
      overdueBySupplier: sqlCell({
        kind: "sql",
        label: "Supplier with the most overdue undelivered orders",
        sql: `SELECT po.supplier_id AS label, count(DISTINCT po.id)::int AS value
          FROM {{table:purchaseOrder}} po
          JOIN {{table:purchaseOrder.lines}} pol ON pol.bill_id = po.id
          WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})
            AND pol.plan_arrival_date < {{asOf}}::date
          GROUP BY po.supplier_id ORDER BY value DESC LIMIT 8`,
        params: ["asOf"],
        result: "rows",
        unit: "docs",
      }),
      openBySupplier: sqlCell({
        kind: "sql",
        label: "Supplier with the most orders in transit",
        sql: `SELECT po.supplier_id AS label, count(*)::int AS value FROM {{table:purchaseOrder}} po
          WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})
          GROUP BY po.supplier_id ORDER BY value DESC LIMIT 8`,
        params: [],
        result: "rows",
        unit: "docs",
      }),
    },
  },
  worker_efficiency: {
    label: "Labor and output this month",
    brief: {
      title: "Labor and output this month",
      hint: "Good output and defect quantity by team and worker this month",
      caveats: ["Good quantity on work reports completed this month. The worker is workerId on the report header"],
    },
    cells: {
      reports: sqlCell({
        kind: "sql",
        label: "Work reports completed this month",
        sql: `SELECT count(*)::int AS value FROM {{table:processReport}} p
          WHERE p.status IN ({{status:processReport.completed}})
            AND p.reported_at >= date_trunc('month', {{asOf}}::date)`,
        link: "processReport",
        params: ["asOf"],
        result: "count",
        unit: "docs",
      }),
      teamOutput: sqlCell({
        kind: "sql",
        label: "Output by team this month",
        sql: `SELECT p.team_id AS label, coalesce(sum(p.base_qualified_qty), 0)::numeric AS value
          FROM {{table:processReport}} p
          WHERE p.status IN ({{status:processReport.completed}})
            AND p.reported_at >= date_trunc('month', {{asOf}}::date)
          GROUP BY p.team_id ORDER BY value DESC LIMIT 8`,
        params: ["asOf"],
        result: "rows",
        unit: "pcs",
      }),
      workerOutput: sqlCell({
        kind: "sql",
        label: "Output by worker this month",
        sql: `SELECT p.worker_id AS label, coalesce(sum(p.base_qualified_qty), 0)::numeric AS value
          FROM {{table:processReport}} p
          WHERE p.status IN ({{status:processReport.completed}})
            AND p.reported_at >= date_trunc('month', {{asOf}}::date)
          GROUP BY p.worker_id ORDER BY value DESC LIMIT 8`,
        params: ["asOf"],
        result: "rows",
        unit: "pcs",
      }),
      workerDefect: sqlCell({
        kind: "sql",
        label: "Defects by worker this month",
        sql: `SELECT p.worker_id AS label, coalesce(sum(p.base_defect_qty), 0)::numeric AS value
          FROM {{table:processReport}} p
          WHERE p.status IN ({{status:processReport.completed}})
            AND p.reported_at >= date_trunc('month', {{asOf}}::date)
          GROUP BY p.worker_id ORDER BY value DESC LIMIT 8`,
        params: ["asOf"],
        result: "rows",
        unit: "pcs",
      }),
    },
  },
  stock_onhand: {
    label: "Stock on hand",
    brief: {
      title: "Stock on hand",
      hint: "Stock on hand / which products are in stock / how much each warehouse holds",
      caveats: ["Ledger balance is cut off on the as-of date and is not replayed"],
    },
    cells: {
      onhand: leftover.stockCoordCount,
      coords: leftover.stockCoordCount,
      topOnHand: leftover.stockCoords,
      byWarehouse: leftover.stockByWarehouse,
    },
  },
  stock_idle: {
    label: "Slow-moving material",
    brief: {
      title: "Slow-moving material (no movement for 90 days)",
      hint: "Slow-moving material / stock that has not moved / inventory sitting still",
      caveats: ["Last movement is at least 90 days before as-of, and the balance is greater than 0"],
    },
    cells: {
      idleCoords: leftover.idleCoords,
      idleTop: leftover.idleCoords,
      neverMoved: leftover.idleCoords,
    },
  },
});
