import type { InsightSqlCellDef } from "@open-erp/metamodel";

export function sqlCell(cell: InsightSqlCellDef): InsightSqlCellDef {
  return cell;
}

export const leftover = {
  overdueUnshippedCount: sqlCell({
    kind: "sql",
    label: "Due and unshipped",
    sql: `SELECT count(*)::int AS value FROM {{table:salesOrder}} so
      WHERE so.status = {{status:salesOrder.inProgress}}
        AND so.promise_date < {{asOf}}::date`,
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
    params: [],
    result: "count",
    unit: "items",
  }),
  wipTaskCount: sqlCell({
    kind: "sql",
    label: "Tasks in production",
    sql: `SELECT count(*)::int AS value FROM {{table:productionTask}} t
      WHERE t.status = {{status:productionTask.inProduction}}`,
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
    params: ["asOf"],
    result: "sum",
    unit: "CNY",
  }),
  inTransitPoCount: sqlCell({
    kind: "sql",
    label: "Purchase orders in transit",
    sql: `SELECT count(*)::int AS value FROM {{table:purchaseOrder}} po
      WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})`,
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
    params: ["asOf"],
    result: "count",
    unit: "docs",
  }),
  stockCoords: sqlCell({
    kind: "sql",
    label: "Balance by warehouse",
    sql: `SELECT l.subject_id, l.scope_id,
        sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) AS net,
        max(l.occurred_at) AS last_occurred_at
      FROM {{ledger:stock}} l
      WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
      GROUP BY l.subject_id, l.scope_id
      HAVING sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) <> 0`,
    params: ["asOf"],
    result: "rows",
    unit: "items",
  }),
  idleCoords: sqlCell({
    kind: "sql",
    label: "Slow-moving material",
    sql: `SELECT l.subject_id, l.scope_id,
        sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) AS net,
        max(l.occurred_at) AS last_occurred_at,
        CASE WHEN max(l.occurred_at) IS NULL THEN -1
          ELSE floor(extract(epoch FROM ({{asOf}}::date::timestamptz - max(l.occurred_at))) / 86400)
        END AS value
      FROM {{ledger:stock}} l
      WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
      GROUP BY l.subject_id, l.scope_id
      HAVING sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) > 0
        AND (max(l.occurred_at) IS NULL OR max(l.occurred_at) <= ({{asOf}}::date - interval '90 days'))`,
    params: ["asOf"],
    result: "rows",
    unit: "items",
  }),
};
