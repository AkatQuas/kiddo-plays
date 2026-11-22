import { defineSurfaces } from "@open-erp/metamodel";
import { PRODUCT_TYPES } from "./productTypes.ts";
import { INVENTORY_UNIT_CHOICE_SET } from "./unitChoices.ts";

const STOCK_FILTERS = `
  AND ({{param:productType}}::text IS NULL OR p.product_type = {{param:productType}})
  AND ({{param:code}}::text IS NULL OR p.code ILIKE {{like:code}})
  AND ({{param:name}}::text IS NULL OR p.name ILIKE {{like:name}})`;

const BY_WAREHOUSE = `
SELECT
  p.id AS product_id,
  p.code AS product_code,
  p.name AS product_name,
  p.product_type AS product_type,
  p.main_unit AS main_unit,
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  coalesce(sum({{ledgerNet:stock.l}}), 0) AS available_qty,
  max(l.occurred_at) AS last_occurred_at,
  count(*) OVER() AS _total
FROM {{table:product}} p
CROSS JOIN {{table:warehouse}} w
LEFT JOIN {{ledger:stock}} l
  ON l.subject_id = p.id
 AND l.scope_id = w.id
WHERE ({{param:warehouseId}}::text IS NULL OR w.id = {{param:warehouseId}})
  ${STOCK_FILTERS}
GROUP BY p.id, w.id
ORDER BY p.code, w.code
LIMIT {{param:pageSize}} OFFSET {{offset}}`;

const CROSS_WAREHOUSE = `
SELECT
  p.id AS product_id,
  p.code AS product_code,
  p.name AS product_name,
  p.product_type AS product_type,
  p.main_unit AS main_unit,
  NULL AS warehouse_id,
  NULL AS warehouse_code,
  NULL AS warehouse_name,
  coalesce(sum({{ledgerNet:stock.l}}), 0) AS available_qty,
  max(l.occurred_at) AS last_occurred_at,
  count(*) OVER() AS _total
FROM {{table:product}} p
LEFT JOIN {{ledger:stock}} l
  ON l.subject_id = p.id
 AND EXISTS (SELECT 1 FROM {{table:warehouse}} w WHERE w.id = l.scope_id)
WHERE EXISTS (SELECT 1 FROM {{table:warehouse}} vis)
  ${STOCK_FILTERS}
GROUP BY p.id
ORDER BY p.code
LIMIT {{param:pageSize}} OFFSET {{offset}}`;

const BREAKDOWN = `
SELECT
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  coalesce(sum({{ledgerNet:stock.l}}), 0) AS available_qty,
  max(l.occurred_at) AS last_occurred_at
FROM {{table:product}} p
CROSS JOIN {{table:warehouse}} w
LEFT JOIN {{ledger:stock}} l
  ON l.subject_id = p.id
 AND l.scope_id = w.id
WHERE p.id = {{param:productId}}
GROUP BY w.id
ORDER BY w.code`;

const WAREHOUSE_OPTIONS = `
SELECT w.id AS value, w.name AS label
FROM {{table:warehouse}} w
ORDER BY w.code`;

/**
 * Documents that post the stock ledger. The document-number UNION and sourceKind=bill share this list.
 * Leave one out and the coverage gate fails: that module now posts stock but is missing from the document-number list.
 */
const STOCK_LEDGER_SOURCE_MODULES = [
  "materialIssue",
  "materialReturn",
  "productionReceipt",
  "purchaseReceipt",
  "purchaseReturn",
  "salesDelivery",
  "stockIn",
  "stockOut",
  "subcontractIssue",
  "subcontractMaterialReturn",
  "subcontractReceipt",
  "subcontractReturn",
] as const;

const STOCK_LEDGER_SOURCE_UNION = STOCK_LEDGER_SOURCE_MODULES.map((code) => {
  const alias = `t_${code.toLowerCase()}`;
  return `SELECT '${code}'::text AS module, ${alias}.id, ${alias}.code FROM {{table:${code}}} ${alias}`;
}).join("\n  UNION ALL\n  ");

const STOCK_LEDGER_SOURCE_IN = STOCK_LEDGER_SOURCE_MODULES.map((code) => `'${code}'`).join(", ");

/**
 * Source modules whose lines record a batch number → the child-table field key
 * (the part after the dot in `{{table:module.child}}`).
 *
 * Read it from the line, not the header. Batch is a line attribute. One document can
 * carry a different batch on each line, and the header has no such value. Every ledger
 * row is posted by one line (`source_line_id`). Reading the header would pick one batch
 * out of several on the document, which invents a value.
 *
 * Sources not in this map (no batch cell on the line, such as purchaseReturn / subcontractReturn)
 * leave the column NULL. A missing registration is caught by the coverage gate in
 * `test/stockLedgerDetail.test.ts` in this domain.
 */
const STOCK_LEDGER_BATCH_SOURCES: Readonly<Record<string, string>> = {
  materialIssue: "lines",
  materialReturn: "lines",
  productionReceipt: "lines",
  purchaseReceipt: "lines",
  salesDelivery: "lines",
  stockIn: "lines",
  stockOut: "lines",
  subcontractIssue: "materialLines",
  subcontractMaterialReturn: "materialLines",
  subcontractReceipt: "lines",
};

const STOCK_LEDGER_BATCH_UNION = Object.entries(STOCK_LEDGER_BATCH_SOURCES)
  .map(([code, through]) => {
    const alias = `b_${code.toLowerCase()}`;
    return `SELECT '${code}'::text AS module, ${alias}.id, ${alias}.batch_no FROM {{table:${code}.${through}}} ${alias}`;
  })
  .join("\n  UNION ALL\n  ");

/**
 * Balance is a window sum over the full (product, warehouse) set, then direction, time, and paging are applied.
 * Filters must not change the balance. Newest rows come first.
 */
const STOCK_LEDGER_DETAIL = `
WITH ledger_all AS (
  SELECT
    l.id,
    l.occurred_at,
    l.op,
    l.amount,
    l.source_module,
    l.source_id,
    l.source_line_id,
    l.reversal_of,
    sum({{ledgerNet:stock.l}}) OVER (ORDER BY l.occurred_at, l.id ROWS UNBOUNDED PRECEDING) AS balance_qty
  FROM {{ledger:stock}} l
  INNER JOIN {{table:product}} p ON p.id = l.subject_id
  INNER JOIN {{table:warehouse}} w ON w.id = l.scope_id
  WHERE l.subject_id = {{param:productId}}
    AND l.scope_id = {{param:warehouseId}}
)
SELECT
  a.id,
  a.occurred_at,
  a.op,
  CASE WHEN a.op = 'in' THEN a.amount ELSE NULL END AS in_qty,
  CASE WHEN a.op = 'out' THEN a.amount ELSE NULL END AS out_qty,
  a.balance_qty,
  a.source_module,
  CASE
    WHEN a.source_module IN (${STOCK_LEDGER_SOURCE_IN}) THEN a.source_module
    ELSE NULL
  END AS source_module_label,
  a.source_id,
  src.code AS source_code,
  bat.batch_no AS batch_no,
  CASE
    WHEN a.reversal_of IS NOT NULL THEN 'reversal'
    WHEN a.source_module IN (${STOCK_LEDGER_SOURCE_IN}) THEN 'bill'
    ELSE 'opening'
  END AS source_kind,
  count(*) OVER() AS _total
FROM ledger_all a
LEFT JOIN (
  ${STOCK_LEDGER_SOURCE_UNION}
) src ON src.module = a.source_module AND src.id = a.source_id
LEFT JOIN (
  ${STOCK_LEDGER_BATCH_UNION}
) bat ON bat.module = a.source_module AND bat.id = a.source_line_id
WHERE ({{param:direction}}::text IS NULL OR a.op = {{param:direction}})
  AND ({{param:occurredFrom}}::timestamptz IS NULL OR a.occurred_at >= {{param:occurredFrom}}::timestamptz)
  AND ({{param:occurredTo}}::timestamptz IS NULL OR a.occurred_at <= {{param:occurredTo}}::timestamptz)
ORDER BY a.occurred_at DESC, a.id DESC
LIMIT {{param:pageSize}} OFFSET {{offset}}`;

/**
 * Products at or below safety stock.
 *
 * The rule lives on the query surface, not in the notification engine, so the framework
 * stays unaware of the business: the engine only "loads a batch of candidates for a scope".
 * It does not need to know what stock or safety stock means.
 *
 * Three rules, all confirmed with product:
 *   1. Cross-warehouse total. Safety stock is a replenishment signal. Splitting by warehouse
 *      false-alarms every time stock is transferred.
 *   2. Only products that have a threshold. `safety_stock_qty IS NULL` means this spec is not
 *      warned, which is different from 0 (not one short is allowed).
 *   3. Only active products, and the comparison uses the status key, not the label.
 */
const BELOW_SAFETY_STOCK = `
SELECT
  p.id AS id,
  p.id AS product_id,
  p.code AS product_code,
  p.name AS name,
  p.spec AS spec,
  p.main_unit AS main_unit,
  p.safety_stock_qty AS safety_stock_qty,
  coalesce(sum({{ledgerNet:stock.l}}), 0) AS on_hand_qty,
  count(*) OVER() AS _total
FROM {{table:product}} p
LEFT JOIN {{ledger:stock}} l
  ON l.subject_id = p.id
 AND EXISTS (SELECT 1 FROM {{table:warehouse}} w WHERE w.id = l.scope_id)
WHERE p.safety_stock_qty IS NOT NULL
  AND p.status = {{status:product.active}}
GROUP BY p.id
HAVING coalesce(sum({{ledgerNet:stock.l}}), 0) <= p.safety_stock_qty
ORDER BY p.code
LIMIT {{param:pageSize}} OFFSET {{offset}}`;

export const surfaces = defineSurfaces({
  stockQuery: {
    label: "Stock report",
    permission: "system:stockQuery:read",
    path: "/_stock-query",
    params: [
      {
        key: "mode",
        label: "Mode",
        type: "enum",
        options: [
          { value: "byWarehouse", label: "By warehouse" },
          { value: "crossWarehouse", label: "All warehouses" },
        ],
      },
      {
        key: "productType",
        label: "Product type",
        type: "enum",
        options: PRODUCT_TYPES.map((option) => ({ value: option.value, label: option.label })),
      },
      { key: "code", label: "Product code", type: "string" },
      { key: "name", label: "Product name", type: "string" },
      {
        key: "warehouseId",
        label: "Warehouse",
        type: "string",
        incompatibleWith: { mode: ["crossWarehouse"] },
      },
      { key: "page", label: "Page", type: "integer" },
      { key: "pageSize", label: "Rows per page", type: "integer" },
    ],
    columns: [
      { key: "productId", label: "Product", type: "string" },
      { key: "productCode", label: "Product code", type: "string" },
      { key: "productName", label: "Product name", type: "string" },
      { key: "productType", label: "Product type", type: "string" },
      { key: "mainUnit", label: "Primary unit", type: "choice", choiceSet: INVENTORY_UNIT_CHOICE_SET },
      { key: "warehouseId", label: "Warehouse", type: "string" },
      { key: "warehouseCode", label: "Warehouse code", type: "string" },
      { key: "warehouseName", label: "Warehouse name", type: "string" },
      { key: "availableQty", label: "Available quantity", type: "string" },
      { key: "lastOccurredAt", label: "Last movement", type: "datetime" },
    ],
    modes: {
      byWarehouse: BY_WAREHOUSE,
      crossWarehouse: CROSS_WAREHOUSE,
    },
    extras: {
      warehouseOptions: {
        kind: "sql",
        sql: WAREHOUSE_OPTIONS,
      },
    },
  },
  stockQueryBreakdown: {
    label: "Stock by warehouse",
    permission: "system:stockQuery:read",
    path: null,
    params: [{ key: "productId", label: "Product", type: "string", required: true }],
    columns: [
      { key: "warehouseId", label: "Warehouse", type: "string" },
      { key: "warehouseCode", label: "Warehouse code", type: "string" },
      { key: "warehouseName", label: "Warehouse name", type: "string" },
      { key: "availableQty", label: "Available quantity", type: "string" },
      { key: "lastOccurredAt", label: "Last movement", type: "datetime" },
    ],
    sql: BREAKDOWN,
  },
  stockLedgerDetail: {
    label: "Stock ledger detail",
    permission: "system:stockQuery:read",
    path: null,
    params: [
      { key: "productId", label: "Product", type: "string", required: true },
      { key: "warehouseId", label: "Warehouse", type: "string", required: true },
      {
        key: "direction",
        label: "Direction",
        type: "enum",
        options: [
          { value: "in", label: "In" },
          { value: "out", label: "Out" },
        ],
      },
      { key: "occurredFrom", label: "Occurred from", type: "string" },
      { key: "occurredTo", label: "Occurred to", type: "string" },
      { key: "page", label: "Page", type: "integer" },
      { key: "pageSize", label: "Rows per page", type: "integer" },
    ],
    columns: [
      { key: "id", label: "Entry", type: "string" },
      { key: "occurredAt", label: "Occurred at", type: "datetime" },
      { key: "op", label: "Direction", type: "string" },
      { key: "inQty", label: "Quantity in", type: "string" },
      { key: "outQty", label: "Quantity out", type: "string" },
      { key: "balanceQty", label: "Balance", type: "string" },
      { key: "sourceModule", label: "Document type code", type: "string" },
      { key: "sourceModuleLabel", label: "Document type", type: "moduleLabel" },
      { key: "sourceId", label: "Document id", type: "string" },
      { key: "sourceCode", label: "Document no.", type: "string" },
      { key: "batchNo", label: "Batch no.", type: "string" },
      { key: "sourceKind", label: "Source", type: "string" },
    ],
    sql: STOCK_LEDGER_DETAIL,
    extras: {
      page: { kind: "page" },
      pageSize: { kind: "pageSize" },
    },
  },
  stockBelowSafety: {
    label: "Products at or below safety stock",
    permission: "system:stockQuery:read",
    // `path: null` — this is not a page for people. It is only a candidate source for the notification engine.
    path: null,
    params: [
      { key: "page", label: "Page", type: "integer" },
      { key: "pageSize", label: "Rows per page", type: "integer" },
    ],
    columns: [
      { key: "id", label: "Product", type: "string" },
      { key: "productId", label: "Product", type: "string" },
      { key: "productCode", label: "Product code", type: "string" },
      { key: "name", label: "Product name", type: "string" },
      { key: "spec", label: "Spec", type: "string" },
      { key: "mainUnit", label: "Primary unit", type: "choice", choiceSet: INVENTORY_UNIT_CHOICE_SET },
      { key: "safetyStockQty", label: "Safety stock", type: "string" },
      { key: "onHandQty", label: "On hand", type: "string" },
    ],
    sql: BELOW_SAFETY_STOCK,
    extras: {
      page: { kind: "page" },
      pageSize: { kind: "pageSize" },
    },
  },
});
