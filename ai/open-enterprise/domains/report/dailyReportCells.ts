import { defineInsights } from "@open-erp/metamodel";
import { leftover, sqlCell } from "./sqlLib.js";

const approved = `so.status NOT IN ({{status:salesOrder.pendingReview}}, {{status:salesOrder.cancelled}})`;
const approvedPo = `po.status NOT IN ({{status:purchaseOrder.pendingReview}}, {{status:purchaseOrder.cancelled}})`;
const issuedQty = `coalesce((
  SELECT sum(il.base_qty) FROM {{table:materialIssue.lines}} il
  JOIN {{table:materialIssue}} mi ON mi.id = il.bill_id
  WHERE il.task_line_id = ml.id AND mi.status IN ({{status:materialIssue.pendingReview}}, {{status:materialIssue.issued}})
), 0)`;
const pendingIssue = `ml.manual_base_qty - ${issuedQty}`;

function countSql(sql: string, extra: Partial<{ label: string; unit: string; link: string }> = {}) {
  return sqlCell({ kind: "sql", sql, params: ["asOf"], result: "count", label: extra.label ?? "", ...extra });
}

export const insights = defineInsights({
  dueTodayIncomplete: {
    label: "Sales orders due today that are not finished",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.status IN ({{status:salesOrder.pendingReview}}, {{status:salesOrder.inProgress}})
            AND so.promise_date = {{asOf}}::date`,
        { label: "Due today, not finished", unit: "docs" },
      ),
    },
  },
  dueIn3DaysUnshipped: {
    label: "Sales orders due in the next 3 days that are not finished",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.status IN ({{status:salesOrder.pendingReview}}, {{status:salesOrder.inProgress}})
            AND so.promise_date >= {{asOf}}::date
            AND so.promise_date <= ({{asOf}}::date + 3)`,
        { label: "Delivery in the next 3 days", unit: "docs" },
      ),
    },
  },
  dueTodayPendingAudit: {
    label: "Sales orders due today that are still awaiting review",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.status = {{status:salesOrder.pendingReview}}
            AND so.promise_date = {{asOf}}::date`,
        { label: "Due today, awaiting review", unit: "docs" },
      ),
    },
  },
  delayedOver7Days: {
    label: "Production tasks delayed more than 7 days",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status NOT IN ({{status:productionTask.completed}}, {{status:productionTask.cancelled}})
            AND t.planned_start_date < {{asOf}}::date
            AND t.planned_end_date < ({{asOf}}::date - 7)`,
        { label: "Delayed more than 7 days", unit: "items" },
      ),
    },
  },
  reportedNotReceived: {
    label: "Tasks reported but not received",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:productionTask}} t
          WHERE t.status = {{status:productionTask.completed}}
            AND t.planned_start_date < {{asOf}}::date
            AND COALESCE((
              SELECT sum(pr.inbound_qty) FROM {{table:productionReceipt}} pr
              WHERE pr.production_task_id = t.id
                AND pr.status IN ({{status:productionReceipt.pendingReview}}, {{status:productionReceipt.completed}})
            ), 0) < t.planned_qty`,
        { label: "Reported, not received", unit: "items" },
      ),
    },
  },
  pendingRelease: {
    label: "Production orders awaiting release",
    cells: {
      count: sqlCell({
        kind: "sql",
        label: "Production orders awaiting release",
        sql: `SELECT count(*)::int AS value FROM {{table:productionOrder}} o
          WHERE o.status = {{status:productionOrder.awaitingRelease}}`,
        params: [],
        result: "count",
        unit: "items",
      }),
    },
  },
  pendingAudit: {
    label: "Documents awaiting review as of the report date",
    cells: {
      purchaseOrder: countSql(`SELECT count(*)::int AS value FROM {{table:purchaseOrder}} po
          WHERE po.status = {{status:purchaseOrder.pendingReview}}
            AND po.purchase_date <= {{asOf}}::date`,
        { label: "Purchase orders awaiting review" },
      ),
      salesOrder: countSql(`SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE so.status = {{status:salesOrder.pendingReview}}
            AND so.order_date <= {{asOf}}::date`,
        { label: "Sales orders awaiting review" },
      ),
      total: countSql(`SELECT (
            (SELECT count(*) FROM {{table:purchaseOrder}} po
              WHERE po.status = {{status:purchaseOrder.pendingReview}} AND po.purchase_date <= {{asOf}}::date)
            + (SELECT count(*) FROM {{table:salesOrder}} so
              WHERE so.status = {{status:salesOrder.pendingReview}} AND so.order_date <= {{asOf}}::date)
          )::int AS value`,
        { label: "Awaiting review, total" },
      ),
      byModule: sqlCell({
        kind: "sql",
        label: "Awaiting review by module",
        sql: `SELECT 'purchaseOrder' AS module, count(*)::int AS value FROM {{table:purchaseOrder}} po
            WHERE po.status = {{status:purchaseOrder.pendingReview}} AND po.purchase_date <= {{asOf}}::date
          UNION ALL
          SELECT 'salesOrder' AS module, count(*)::int AS value FROM {{table:salesOrder}} so
            WHERE so.status = {{status:salesOrder.pendingReview}} AND so.order_date <= {{asOf}}::date`,
        params: ["asOf"],
        result: "rows",
      }),
    },
  },
  hadSalesOutboundYesterday: {
    label: "Sales shipments yesterday",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:salesDelivery}} sd
          WHERE sd.status = {{status:salesDelivery.shipped}}
            AND sd.delivery_date = {{asOf}}::date`,
        { label: "Sales shipments yesterday" },
      ),
      amount: sqlCell({
        kind: "sql",
        label: "Sales shipment amount yesterday",
        sql: `SELECT coalesce(sum(sdl.base_qty * sdl.base_unit_price), 0)::numeric AS value
          FROM {{table:salesDelivery}} sd
          JOIN {{table:salesDelivery.lines}} sdl ON sdl.bill_id = sd.id
          WHERE sd.status = {{status:salesDelivery.shipped}}
            AND sd.delivery_date = {{asOf}}::date`,
        params: ["asOf"],
        result: "sum",
        unit: "CNY",
      }),
    },
  },
  hadProductionReceiptYesterday: {
    label: "Production receipts yesterday",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:productionReceipt}} pr
          WHERE pr.status = {{status:productionReceipt.completed}}
            AND pr.receipt_date = {{asOf}}::date`,
        { label: "Production receipts yesterday" },
      ),
    },
  },
  hadPurchaseReceiptYesterday: {
    label: "Purchase receipts yesterday",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:purchaseReceipt}} pr
          WHERE pr.status = {{status:purchaseReceipt.received}}
            AND pr.receipt_date = {{asOf}}::date`,
        { label: "Purchase receipts yesterday" },
      ),
    },
  },
  dailyMaterialAvailability: {
    label: "Daily material gap",
    cells: {
      availability: sqlCell({
        kind: "sql",
        label: "To issue versus on hand",
        sql: `SELECT ml.component_product_id AS product_id,
            ml.default_issue_warehouse_id AS warehouse_id,
            sum((${pendingIssue})) AS demand,
            coalesce(s.net, 0) AS on_hand,
            greatest(sum((${pendingIssue})) - coalesce(s.net, 0), 0) AS value,
            string_agg(distinct t.code, E'\\x01') AS task_codes
          FROM {{table:productionTask}} t
          JOIN {{table:productionTask.materialLines}} ml ON ml.bill_id = t.id
          LEFT JOIN (
            SELECT l.subject_id, l.scope_id,
              sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) AS net
            FROM {{ledger:stock}} l
            WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
            GROUP BY l.subject_id, l.scope_id
          ) s ON s.subject_id = ml.component_product_id AND s.scope_id = ml.default_issue_warehouse_id
          WHERE t.status IN ({{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
            AND t.planned_start_date < {{asOf}}::date
            AND (${pendingIssue}) > 0
          GROUP BY ml.component_product_id, ml.default_issue_warehouse_id, s.net
          ORDER BY value DESC
          LIMIT 100`,
        params: ["asOf"],
        result: "rows",
      }),
      zeroStock: sqlCell({
        kind: "sql",
        label: "Key material at zero stock",
        sql: `SELECT count(*)::int AS value FROM (
          SELECT ml.component_product_id, ml.default_issue_warehouse_id
          FROM {{table:productionTask}} t
          JOIN {{table:productionTask.materialLines}} ml ON ml.bill_id = t.id
          LEFT JOIN (
            SELECT l.subject_id, l.scope_id,
              sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) AS net
            FROM {{ledger:stock}} l
            WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
            GROUP BY l.subject_id, l.scope_id
          ) s ON s.subject_id = ml.component_product_id AND s.scope_id = ml.default_issue_warehouse_id
          WHERE t.status IN ({{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
            AND t.planned_start_date < {{asOf}}::date
            AND (${pendingIssue}) > 0
          GROUP BY ml.component_product_id, ml.default_issue_warehouse_id, s.net
          HAVING coalesce(s.net, 0) <= 0
        ) z`,
        params: ["asOf"],
        result: "count",
      }),
      shortages: sqlCell({
        kind: "sql",
        label: "Shortage lines",
        sql: `SELECT count(*)::int AS value FROM (
          SELECT ml.component_product_id, ml.default_issue_warehouse_id
          FROM {{table:productionTask}} t
          JOIN {{table:productionTask.materialLines}} ml ON ml.bill_id = t.id
          LEFT JOIN (
            SELECT l.subject_id, l.scope_id,
              sum(CASE WHEN l.op IN ('in', 'reserve') THEN l.amount ELSE -l.amount END) AS net
            FROM {{ledger:stock}} l
            WHERE l.occurred_at <= ({{asOf}}::date + interval '1 day' - interval '1 millisecond')
            GROUP BY l.subject_id, l.scope_id
          ) s ON s.subject_id = ml.component_product_id AND s.scope_id = ml.default_issue_warehouse_id
          WHERE t.status IN ({{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
            AND t.planned_start_date < {{asOf}}::date
            AND (${pendingIssue}) > 0
          GROUP BY ml.component_product_id, ml.default_issue_warehouse_id, s.net
          HAVING greatest(sum((${pendingIssue})) - coalesce(s.net, 0), 0) > 0
        ) z`,
        params: ["asOf"],
        result: "count",
      }),
      partialIssue: countSql(`SELECT count(DISTINCT t.id)::int AS value FROM {{table:productionTask}} t
          JOIN {{table:productionTask.materialLines}} ml ON ml.bill_id = t.id
          WHERE t.status IN ({{status:productionTask.awaitingLaunch}}, {{status:productionTask.inProduction}})
            AND t.planned_start_date < {{asOf}}::date
            AND (${pendingIssue}) > 0
            AND (${issuedQty}) > 0`,
        { label: "Partially issued tasks" },
      ),
    },
  },
  overduePurchase: {
    label: "Purchases overdue and not arrived",
    cells: {
      count: leftover.supplierOverdueCount,
      rows: sqlCell({
        kind: "sql",
        label: "Purchases overdue and not arrived, lines",
        sql: `SELECT po.id, po.code, po.supplier_id, subject.display_name AS buyer, po.total_amount, po.sales_order_id,
            min(pol.plan_arrival_date) AS earliest_overdue_date,
            ({{asOf}}::date - min(pol.plan_arrival_date))::int AS overdue_days,
            count(pol.id)::int AS overdue_line_count,
            coalesce(sum(pol.base_qty), 0) AS outstanding_qty,
            coalesce(po.total_amount, 0) AS outstanding_amount
          FROM {{table:purchaseOrder}} po
          JOIN {{table:purchaseOrder.lines}} pol ON pol.bill_id = po.id
          LEFT JOIN {{table:subject}} subject ON subject.id = po.buyer
          WHERE po.status IN ({{status:purchaseOrder.awaitingReceipt}}, {{status:purchaseOrder.receiving}})
            AND pol.plan_arrival_date < {{asOf}}::date
          GROUP BY po.id, po.code, po.supplier_id, subject.display_name, po.total_amount, po.sales_order_id
          ORDER BY overdue_days DESC, po.total_amount DESC
          LIMIT 100`,
        params: ["asOf"],
        result: "rows",
      }),
    },
  },
  purchaseFulfillment: {
    label: "Purchase fulfillment this month",
    cells: {
      onTimeRate: sqlCell({
        kind: "sql",
        label: "Purchase on-time rate",
        sql: `WITH due AS (
            SELECT pol.id, pol.plan_arrival_date
            FROM {{table:purchaseOrder}} po
            JOIN {{table:purchaseOrder.lines}} pol ON pol.bill_id = po.id
            WHERE ${approvedPo}
              AND pol.plan_arrival_date >= date_trunc('month', {{asOf}}::date)::date
              AND pol.plan_arrival_date <= {{asOf}}::date
          ), recv AS (
            SELECT prl.order_line_id, min(pr.receipt_date) AS receipt_date
            FROM {{table:purchaseReceipt}} pr
            JOIN {{table:purchaseReceipt.lines}} prl ON prl.bill_id = pr.id
            WHERE pr.status = {{status:purchaseReceipt.received}}
            GROUP BY prl.order_line_id
          )
          SELECT CASE WHEN count(*) = 0 THEN NULL
            ELSE (count(*) FILTER (WHERE r.receipt_date IS NOT NULL AND r.receipt_date <= d.plan_arrival_date))::numeric
              / count(*) * 100
          END AS value
          FROM due d
          LEFT JOIN recv r ON r.order_line_id = d.id`,
        params: ["asOf"],
        result: "scalar",
        unit: "%",
      }),
      cycleDays: sqlCell({
        kind: "sql",
        label: "Purchase arrival cycle",
        sql: `SELECT avg((pr.receipt_date - po.purchase_date))::numeric AS value
          FROM {{table:purchaseReceipt}} pr
          JOIN {{table:purchaseReceipt.lines}} prl ON prl.bill_id = pr.id
          JOIN {{table:purchaseOrder.lines}} pol ON pol.id = prl.order_line_id
          JOIN {{table:purchaseOrder}} po ON po.id = pol.bill_id
          WHERE pr.status = {{status:purchaseReceipt.received}}
            AND pr.receipt_date >= date_trunc('month', {{asOf}}::date)::date
            AND pr.receipt_date <= {{asOf}}::date`,
        params: ["asOf"],
        result: "scalar",
        unit: "days",
      }),
    },
  },
  deliveryCycle: {
    label: "Order delivery cycle",
    cells: {
      days7: sqlCell({
        kind: "sql",
        label: "Delivery cycle, last 7 days",
        sql: `SELECT avg((sd.delivery_date - so.order_date))::numeric AS value
          FROM {{table:salesDelivery}} sd
          JOIN {{table:salesDelivery.lines}} sdl ON sdl.bill_id = sd.id
          JOIN {{table:salesOrder.lines}} sol ON sol.id = sdl.order_line_id
          JOIN {{table:salesOrder}} so ON so.id = sol.bill_id
          WHERE sd.status = {{status:salesDelivery.shipped}}
            AND ${approved}
            AND sd.delivery_date >= ({{asOf}}::date - 6)
            AND sd.delivery_date <= {{asOf}}::date`,
        params: ["asOf"],
        result: "scalar",
        unit: "days",
      }),
      days15: sqlCell({
        kind: "sql",
        label: "Delivery cycle, last 15 days",
        sql: `SELECT avg((sd.delivery_date - so.order_date))::numeric AS value
          FROM {{table:salesDelivery}} sd
          JOIN {{table:salesDelivery.lines}} sdl ON sdl.bill_id = sd.id
          JOIN {{table:salesOrder.lines}} sol ON sol.id = sdl.order_line_id
          JOIN {{table:salesOrder}} so ON so.id = sol.bill_id
          WHERE sd.status = {{status:salesDelivery.shipped}}
            AND ${approved}
            AND sd.delivery_date >= ({{asOf}}::date - 14)
            AND sd.delivery_date <= {{asOf}}::date`,
        params: ["asOf"],
        result: "scalar",
        unit: "days",
      }),
      days30: sqlCell({
        kind: "sql",
        label: "Delivery cycle, last 30 days",
        sql: `SELECT avg((sd.delivery_date - so.order_date))::numeric AS value
          FROM {{table:salesDelivery}} sd
          JOIN {{table:salesDelivery.lines}} sdl ON sdl.bill_id = sd.id
          JOIN {{table:salesOrder.lines}} sol ON sol.id = sdl.order_line_id
          JOIN {{table:salesOrder}} so ON so.id = sol.bill_id
          WHERE sd.status = {{status:salesDelivery.shipped}}
            AND ${approved}
            AND sd.delivery_date >= ({{asOf}}::date - 29)
            AND sd.delivery_date <= {{asOf}}::date`,
        params: ["asOf"],
        result: "scalar",
        unit: "days",
      }),
    },
  },
  planAchieve: {
    label: "Plan attainment",
    cells: {
      rate: sqlCell({
        kind: "sql",
        label: "Plan attainment rate",
        sql: `SELECT CASE WHEN due.qty = 0 THEN NULL
            ELSE (coalesce(c.qty, 0) / due.qty * 100)
          END AS value
          FROM (
            SELECT coalesce(sum(t.base_planned_qty), 0) AS qty FROM {{table:productionTask}} t
            WHERE t.planned_start_date::date <= {{asOf}}::date
              AND t.planned_end_date::date >= {{asOf}}::date
              AND t.status <> {{status:productionTask.cancelled}}
          ) due
          CROSS JOIN (
            SELECT coalesce(sum(pr.base_qualified_qty), 0) AS qty FROM {{table:processReport}} pr
            WHERE pr.status = {{status:processReport.completed}}
              AND pr.reported_at::date = {{asOf}}::date
          ) c`,
        params: ["asOf"],
        result: "scalar",
        unit: "%",
      }),
    },
  },
  passRate: {
    label: "Product pass rate",
    cells: {
      rate: sqlCell({
        kind: "sql",
        label: "Pass rate",
        sql: `SELECT CASE WHEN (q.qualified + q.defect) = 0 THEN NULL
            ELSE q.qualified / (q.qualified + q.defect) * 100
          END AS value
          FROM (
            SELECT coalesce(sum(pr.base_qualified_qty), 0) AS qualified,
              coalesce(sum(pr.base_defect_qty), 0) AS defect
            FROM {{table:processReport}} pr
            WHERE pr.status = {{status:processReport.completed}}
              AND pr.reported_at::date = {{asOf}}::date
          ) q`,
        params: ["asOf"],
        result: "scalar",
        unit: "%",
      }),
    },
  },
  materialKit: {
    label: "Material kitting",
    cells: {
      rate: sqlCell({
        kind: "sql",
        label: "Kit rate",
        sql: `SELECT CASE WHEN count(*) = 0 THEN NULL
            ELSE count(*) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM {{table:productionTask.materialLines}} ml
              WHERE ml.bill_id = t.id AND (${pendingIssue}) > 0
            ))::numeric / count(*) * 100
          END AS value
          FROM {{table:productionTask}} t
          WHERE t.planned_start_date::date = {{asOf}}::date
            AND t.status <> {{status:productionTask.cancelled}}`,
        params: ["asOf"],
        result: "scalar",
        unit: "%",
      }),
    },
  },
  monthSales: {
    label: "Monthly sales",
    cells: {
      thisMonth: sqlCell({
        kind: "sql",
        label: "Sales this month through today",
        sql: `SELECT coalesce(sum(so.total_amount), 0)::numeric AS value FROM {{table:salesOrder}} so
          WHERE ${approved}
            AND so.order_date >= date_trunc('month', {{asOf}}::date)::date
            AND so.order_date <= {{asOf}}::date`,
        params: ["asOf"],
        result: "sum",
        unit: "CNY",
      }),
      previousMonth: sqlCell({
        kind: "sql",
        label: "Sales last month",
        sql: `SELECT coalesce(sum(so.total_amount), 0)::numeric AS value FROM {{table:salesOrder}} so
          WHERE ${approved}
            AND so.order_date >= (date_trunc('month', {{asOf}}::date) - interval '1 month')::date
            AND so.order_date < date_trunc('month', {{asOf}}::date)::date`,
        params: ["asOf"],
        result: "sum",
        unit: "CNY",
      }),
      changeRate: sqlCell({
        kind: "sql",
        label: "Month-over-month sales",
        sql: `SELECT CASE WHEN prev.v = 0 THEN NULL ELSE (cur.v / prev.v - 1) * 100 END AS value
          FROM (
            SELECT coalesce(sum(so.total_amount), 0) AS v FROM {{table:salesOrder}} so
            WHERE ${approved}
              AND so.order_date >= date_trunc('month', {{asOf}}::date)::date
              AND so.order_date <= {{asOf}}::date
          ) cur
          CROSS JOIN (
            SELECT coalesce(sum(so.total_amount), 0) AS v FROM {{table:salesOrder}} so
            WHERE ${approved}
              AND so.order_date >= (date_trunc('month', {{asOf}}::date) - interval '1 month')::date
              AND so.order_date < date_trunc('month', {{asOf}}::date)::date
          ) prev`,
        params: ["asOf"],
        result: "scalar",
        unit: "%",
      }),
    },
  },
  reportDaySales: {
    label: "Sales added on the report date",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:salesOrder}} so
          WHERE ${approved} AND so.order_date = {{asOf}}::date`,
        { label: "Sales orders added on the report date" },
      ),
      amount: sqlCell({
        kind: "sql",
        label: "Sales amount added on the report date",
        sql: `SELECT coalesce(sum(so.total_amount), 0)::numeric AS value FROM {{table:salesOrder}} so
          WHERE ${approved} AND so.order_date = {{asOf}}::date`,
        params: ["asOf"],
        result: "sum",
      }),
    },
  },
  reportDayProductionPlan: {
    label: "Production plans on the report date",
    cells: {
      count: countSql(`SELECT count(*)::int AS value FROM {{table:productionOrder}} o
          WHERE o.status IN (
              {{status:productionOrder.awaitingRelease}}, {{status:productionOrder.releasing}},
              {{status:productionOrder.inProduction}}, {{status:productionOrder.reported}}
            )
            AND o.created_at::date <= {{asOf}}::date`,
        { label: "Production plans on the report date" },
      ),
    },
  },
  overdueUnshippedRows: {
    label: "Overdue unshipped lines",
    cells: {
      rows: sqlCell({
        kind: "sql",
        label: "Overdue and unshipped",
        sql: `SELECT so.id, so.code, so.customer_id, c.name AS customer_name, so.total_amount,
            so.promise_date, so.status, subject.display_name AS salesperson,
            coalesce(so.total_amount, 0) AS outstanding_amount
          FROM {{table:salesOrder}} so
          LEFT JOIN {{table:customer}} c ON c.id = so.customer_id
          LEFT JOIN {{table:subject}} subject ON subject.id = so.salesperson
          WHERE so.status = {{status:salesOrder.inProgress}}
            AND so.promise_date < {{asOf}}::date
          ORDER BY so.total_amount DESC
          LIMIT 100`,
        params: ["asOf"],
        result: "rows",
      }),
      amount: sqlCell({
        kind: "sql",
        label: "Overdue unshipped amount",
        sql: `SELECT coalesce(sum(so.total_amount), 0)::numeric AS value FROM {{table:salesOrder}} so
          WHERE so.status = {{status:salesOrder.inProgress}}
            AND so.promise_date < {{asOf}}::date`,
        params: ["asOf"],
        result: "sum",
      }),
    },
  },
  delayedTaskRows: {
    label: "Delayed task lines",
    cells: {
      rows: sqlCell({
        kind: "sql",
        label: "Delayed tasks",
        sql: `SELECT t.id, t.code, t.product_name, t.planned_end_date, t.status,
            t.planned_qty, 0::numeric AS completed_qty
          FROM {{table:productionTask}} t
          WHERE t.status NOT IN ({{status:productionTask.completed}}, {{status:productionTask.cancelled}})
            AND t.planned_start_date < {{asOf}}::date
            AND t.planned_end_date < {{asOf}}::date
          ORDER BY t.planned_end_date ASC
          LIMIT 100`,
        params: ["asOf"],
        result: "rows",
      }),
    },
  },
  recentActivity: {
    label: "Activity, last 7 days",
    cells: {
      days: sqlCell({
        kind: "sql",
        label: "Activity, last 7 days",
        sql: `SELECT d.d::text AS date,
            (SELECT count(*) FROM {{table:salesOrder}} so
              WHERE so.status NOT IN ({{status:salesOrder.pendingReview}}, {{status:salesOrder.cancelled}})
                AND so.order_date = d.d)::int AS sales_order_count,
            (SELECT coalesce(sum(so.total_amount), 0) FROM {{table:salesOrder}} so
              WHERE so.status NOT IN ({{status:salesOrder.pendingReview}}, {{status:salesOrder.cancelled}})
                AND so.order_date = d.d) AS sales_order_amount,
            (SELECT count(*) FROM {{table:productionOrder}} o
              WHERE o.status IN ({{status:productionOrder.awaitingRelease}}, {{status:productionOrder.releasing}},
                {{status:productionOrder.inProduction}}, {{status:productionOrder.reported}})
                AND o.created_at::date <= d.d)::int AS production_plan_count,
            (SELECT count(*) FROM {{table:salesDelivery}} sd
              WHERE sd.status = {{status:salesDelivery.shipped}} AND sd.delivery_date = d.d)::int AS sales_outbound_count,
            (SELECT coalesce(sum(sdl.base_qty * sdl.base_unit_price), 0)
              FROM {{table:salesDelivery}} sd
              JOIN {{table:salesDelivery.lines}} sdl ON sdl.bill_id = sd.id
              WHERE sd.status = {{status:salesDelivery.shipped}} AND sd.delivery_date = d.d) AS sales_outbound_amount,
            (SELECT count(*) FROM {{table:productionReceipt}} pr
              WHERE pr.status = {{status:productionReceipt.completed}}
                AND pr.receipt_date = d.d)::int AS production_receipt_count,
            (SELECT count(*) FROM {{table:purchaseReceipt}} pr
              WHERE pr.status = {{status:purchaseReceipt.received}} AND pr.receipt_date = d.d)::int AS purchase_receipt_count,
            (SELECT CASE WHEN count(*) = 0 THEN NULL
              ELSE count(*) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM {{table:productionTask.materialLines}} ml
                WHERE ml.bill_id = t.id AND (${pendingIssue}) > 0
              ))::numeric / count(*) * 100 END
              FROM {{table:productionTask}} t
              WHERE t.planned_start_date::date = d.d AND t.status <> {{status:productionTask.cancelled}}
            ) AS material_kit_rate
          FROM generate_series({{asOf}}::date - 6, {{asOf}}::date, interval '1 day') AS d(d)`,
        params: ["asOf"],
        result: "rows",
      }),
    },
  },
  recentRiskTrend: {
    label: "Risk, last 7 days",
    cells: {
      days: sqlCell({
        kind: "sql",
        label: "Risk volume, last 7 days",
        sql: `SELECT to_char(d.d::date, 'YYYY-MM-DD') AS date,
            (
              (SELECT count(*) FROM {{table:salesOrder}} so
                WHERE so.status = {{status:salesOrder.inProgress}} AND so.promise_date < (d.d::date + 1))
              + (SELECT count(*) FROM {{table:productionTask}} t
                WHERE t.status NOT IN ({{status:productionTask.completed}}, {{status:productionTask.cancelled}})
                  AND t.planned_start_date < (d.d::date + 1) AND t.planned_end_date < (d.d::date + 1))
              + (SELECT count(*) FROM {{table:salesOrder}} so
                WHERE so.status IN ({{status:salesOrder.pendingReview}}, {{status:salesOrder.inProgress}})
                  AND so.promise_date >= (d.d::date + 1) AND so.promise_date <= (d.d::date + 4))
              + (SELECT count(*) FROM {{table:productionTask}} t
                WHERE t.status = {{status:productionTask.completed}} AND t.planned_start_date < (d.d::date + 1)
                  AND COALESCE((
                    SELECT sum(pr.inbound_qty) FROM {{table:productionReceipt}} pr
                    WHERE pr.production_task_id = t.id
                      AND pr.status IN ({{status:productionReceipt.pendingReview}}, {{status:productionReceipt.completed}})
                  ), 0) < t.planned_qty)
              + (SELECT count(*) FROM {{table:materialRequirement}} m
                WHERE m.status = {{status:materialRequirement.awaitingIssue}})
            )::int AS risk_count
          FROM generate_series({{asOf}}::date - 6, {{asOf}}::date, interval '1 day') AS d(d)`,
        params: ["asOf"],
        result: "rows",
      }),
    },
  },
});
