import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Return task material",
  numbering: { prefix: "MRET", seqScope: "day" },

  fields: [
    { key: "code", label: "Return no.", type: "string", primary: true, auto: true },
    // The header has no source material issue, and no production order, production task, or return warehouse.
    // The first cell was removed by prod-087 (a month-end return covers material picked across a dozen issues,
    // and pinning the source on the header forced a dozen return documents). The other three were removed
    // with the issue: an issue already serves several production tasks, can cross orders, and has one warehouse
    // per line. A return is the mirror of that. A single order, task, or warehouse on the header would have no right-hand value.
    //
    // It is removed rather than made optional. An optional "source issue" cell would still show only one source
    // on a return that spans three issues. That is not a missing value. It is a statement that looks complete and is false.
    // Reverse lookup does not need it. `lines.materialIssueId` is a `via:'line' + toLevel:'bill'` edge and is still
    // reverse-queryable (`isReverseQueryable` in `packages/metamodel/src/relations/relations.ts`).
    { key: "returnDate", label: "Return date", type: "date" },
    // No handler field. The person who returned the material is the platform `createdBy`.
    // "Who handled this document" and the creator are the same person today, and `createdBy`
    // is already in `PLATFORM_QUERY_FIELDS` and fixed on the detail shell. Another `handlerId`
    // would make the user pick themselves from a person directory.
    // Reversible later: once the `agentic-enterprise` authorization center provides people and
    // permissions and a stable person directory, and the business confirms the handler is not
    // the creator, add it back as a real person reference. This is a known tradeoff.
    {
      key: "lines",
      label: "Return lines",
      type: "subtable",
      ref: "materialReturnLine",
      fields: [
        { key: "materialIssueId", label: "Source material issue", type: "ref", ref: "materialIssue", required: true },
        { key: "issueLineId", label: "Source issue line", type: "refLine", ref: "materialIssue", through: "lines", required: true },
        // `pushFrom` is required because `materialIssue.lines.productId` is a snapshot, not decoration.
        // The same-key auto-fill path does not accept a system-supplied source (`isPushFillable`: copying a
        // value the system already froze into a downstream column must not be triggered by a matching name).
        // Pushing a return from an issue would otherwise leave this required cell blank, and "Return task material"
        // would return 400 (`PUSH_TARGET_REQUIRED_UNFILLABLE` is exactly that).
        // Writing it here says the value is copied from that cell on the issue line.
        { key: "productId", label: "Material", type: "ref", ref: "product", required: true, pushFrom: "productId" },
        // The task coordinate is read from the source issue line. The issue already recorded which task this material is for.
        // The return does not ask again. Asking again would let someone fill a different task.
        //
        // This is a `lookup`, not a `snapshot`. That differs from `subcontractReturn.lines.productionTaskId`
        // because the source cell is a different kind of value. On a subcontract receipt the production task is an
        // ordinary ref the user chose (it can be frozen). On an issue, `productionTaskId` is the companion column of
        // `taskLineId`. Storage writes it from the refLine ownership, and seeds and callers must not fill it.
        // Freezing it throws "source value missing, cannot freeze snapshot" in a seed: the seed row is a literal object, and the companion column does not exist yet.
        //
        // Not freezing does not lose the fact. Once the source issue line is stored, that cell can never be edited (it has no input).
        // Every lookup therefore reads the same value. Freezing would not buy anything extra for this cell.
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", derive: { kind: "lookup", from: "materialIssue", through: "lines", match: "issueLineId", field: "productionTaskId" } },
        // The return warehouse lives on the line, matching the issue. The starting value is the warehouse the material was issued from.
        // `return_warehouse_matches_issue` pins each line to the source issue line's warehouse.
        // Restoring stock in a different warehouse would make both warehouse ledgers wrong while each document still looks legal.
        {
          key: "warehouseId",
          label: "Return to warehouse",
          type: "ref",
          ref: "warehouse",
          required: true,
          pushFrom: "warehouseId",
          refDefault: { from: "materialIssue", match: "issueLineId", through: "lines", field: "warehouseId" },
        },
        /**
         * These two cells are `ref`, not `string` (fixed in 3.5.0).
         *
         * They look up the value of a reference column (`productId` / `warehouseId`), which is an id.
         * Declared as `string`, the screen prints that text as-is: the return detail shows a uuid for
         * the issued material and `wh-sh` for the issue warehouse. The business sees a broken cell,
         * while each layer is correct on its own (the lookup read the right value, and the text displayed it).
         * As `ref`, the same value resolves to the product name and the warehouse name.
         *
         * Both column types are text (`ref` and `string` generate the same column),
         * so this change creates no migration. `yarn db:gen` reports "No schema changes".
         */
        {
          key: "issueProductId",
          label: "Issued material",
          type: "ref",
          ref: "product",
          derive: { kind: "lookup", from: "materialIssue", through: "lines", match: "issueLineId", field: "productId" },
        },
        {
          key: "issueWarehouseId",
          label: "Issue warehouse",
          type: "ref",
          ref: "warehouse",
          derive: { kind: "lookup", from: "materialIssue", through: "lines", match: "issueLineId", field: "warehouseId" },
        },
        { key: "qty", label: "Return quantity", type: "number", required: true },
        {
          key: "issueLineQty",
          label: "Issue quantity",
          type: "number",
          derive: { kind: "lookup", from: "materialIssue", through: "lines", match: "issueLineId", field: "qty" },
        },
        {
          key: "issueLineBaseQty",
          label: "Source issue quantity in main unit",
          type: "number",
          derive: { kind: "lookup", from: "materialIssue", through: "lines", match: "issueLineId", field: "baseQty" },
        },
        // Last hop of the freeze chain. What is returned is what the original issue line says, so it is frozen from the issue line, not from the product master. A later unit change on the product master cannot rewrite an issue or return that already happened.
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "materialIssue", match: "issueLineId", through: "lines", field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "baseQty", label: "Returned quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "baseUnitPrice", label: "Business price in main unit", type: "money", hidden: true, derive: { kind: "formula", expr: { value: 0 } } },
        { key: "batchNo", label: "Lot number", type: "string", help: "Recorded only. It does not enter the stock calculation. The ledger coordinate stops at the warehouse; stock by lot is not supported yet" },
        { key: "reason", label: "Return reason", type: "string" },
      ],
    },
    { key: "requestedBaseQty", label: "Requested quantity in main unit", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(baseQty)" } },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Created as pendingReview. Do not set editable: "none". A pendingReview document must still be editable.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "releaseDemand",
        from: "pendingReview",
        to: "completed",
        action: "Confirm material return",
        primary: true,
        effects: [{
          target: "stock",
          op: "in",
          subject: "$line.productId",
          // Same rule as the issue: the warehouse is on the line, so the scope must follow it. Leaving `$bill.` would return buttons from the trim warehouse into the fabric warehouse. Each ledger line would look legal, and only a stock count would show it.
          scope: "$line.warehouseId",
          amount: "{$line.baseQty}",
          reverseOn: [],
        }],
      },
      { code: "cancelAudit", from: "pendingReview", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },

  preconditions: [
    {
      id: "return_lines_required",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "A material return must list the material actually put back. An empty line list creates no stock fact",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "return_qty_positive",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "Return quantity must be positive. A negative quantity would record a stock increase as an issue",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "return_facts_required",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "Pushing from the issue only sets the source. The actual return date is required before confirming the return",
      // After the return handler was removed, this gate only has `returnDate`, and it still belongs here. `returnDate` is optional at declaration time (a pendingReview document can be created and the date filled later). "Required before confirm" has only a precondition as its outlet in the metamodel. Making the field `required` would demand it at save time, and the pendingReview document could not be created.
      check: { primitive: "required_fields", fields: ["returnDate"] },
    },
    // `return_order_matches_issue` and `return_task_matches_issue` were removed. The gates were not loosened.
    // Their right-hand values were header `productionOrderId` / `productionTaskId`, and those cells moved to the line with the issue.
    // Leaving them would make the right-hand value always undefined, so the comparison would never hold: a block that never passes, which looks like a strict business rule (`return_lines_match_issue` died that way).
    // What they used to check is now held by a stronger coordinate. The task is frozen from the source issue line, the user has no input, and there is no way to fill it wrong.
    {
      id: "return_issue_posted",
      onTransition: "releaseDemand",
      source: "gate",
      level: "block",
      why: "A return can reverse only an approved issue. An issue that is pending review or cancelled cannot create stock from nothing",
      check: {
        primitive: "ref_field_compare",
        via: "$line.materialIssueId",
        entity: "materialIssue",
        through: null,
        field: "status",
        op: "in",
        right: { value: ["issued"] },
      },
    },
    {
      id: "return_warehouse_matches_issue",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "A return must go back to the warehouse the source issue line actually deducted. Stock cannot be restored in a different warehouse",
      // Changed from `ref_field_compare` (compare the source header cell) to a per-line compare. The issue warehouse is already on the line. One issue can take fabric from the trim warehouse and buttons from another warehouse. A header compare would have no right-hand value.
      check: {
        primitive: "lines_all",
        left: { ref: "$line.warehouseId" },
        op: "eq",
        right: { ref: "$line.issueWarehouseId" },
      },
    },
    // `return_lines_match_issue` was removed. It pinned every line's source to the one document on the header.
    // Together with the four gates above, the net effect was "one return can hang on only one issue". After that header cell was gone, its right-hand value was always undefined and the comparison never held: a block that never passes, which looks like a strict business rule.
    {
      id: "return_products_match_issue_lines",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "The returned product must match the source issue line. Do not keep the source line and add stock for a different product",
      check: {
        primitive: "lines_all",
        left: { ref: "$line.productId" },
        op: "eq",
        right: { ref: "$line.issueProductId" },
      },
    },
    // `return_unit_matches_product` was removed. After `lines.unit` is frozen from the issue line, that comparison would take today's product master and compare it with a unit frozen at the time. One master-data unit change would block a batch of legal returns at approval, and it could not stop a real mis-entry because that cell no longer has an input.
    {
      id: "not_over_return",
      onTransition: "releaseDemand",
      source: "gate",
      level: "block",
      why: "Approved returns against one issue line cannot exceed the original issue. The excess was not material issued for this production",
      check: {
        primitive: "related_agg",
        from: "materialReturn",
        through: "lines",
        match: "issueLineId",
        on: "$line.issueLineId",
        agg: "sum",
        measure: "baseQty",
        where: { status: ["pendingReview", "completed"] },
        op: "lte",
        right: { ref: "$line.issueLineBaseQty" },
        /**
         * Do not `plus` this line again. This edge starts at pendingReview, and pendingReview is already
         * in the `where` above, so `related_agg` already reads the document under review.
         * Adding it again doubles every row: issue 10 and return 10 is reported as
         * "total 20 (10 already + 10 on this document), must not exceed 10". A full return can never pass,
         * while a partial return of at most half can. That is the contradiction the shop saw.
         *
         * Same rule as `productionReceipt.receipt_completion_available`:
         * when the starting status is inside `where`, `plus` is null.
         */
        plus: null,
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "returnDate", "status"],
      filters: ["status", "returnDate", "createdBy"],
      searchable: ["code"],
      defaultSort: { field: "createdAt", desc: true },
    },
    /**
     * Return from an issue, by line and by quantity.
     *
     * The shop reported that a return had to be for the whole issue. The gate was not the cause
     * (`not_over_return` uses `lte`, so a partial return is allowed, and pendingReview is fully editable).
     * The cause was the entry shape: "Return task material" on the issue pushes the whole document,
     * and the pendingReview copy arrives with the full quantity. Nobody could tell that the number could be changed.
     *
     * This `createFrom` is that missing entry: when creating a return, pick an issue, check the lines to return,
     * and enter how much to return on each line. It is the same mechanism as "Create task material issue" (picker plus cap).
     *
     * `sourceRemaining` is given at both levels:
     *   `header` decides whether this issue appears as a candidate (a fully returned issue is disabled up front with a reason);
     *   `line` decides which lines expand and the cap on each (a fully returned line disappears).
     * Both are eligibility, not the cap. The real cap is still `not_over_return` against the original issue quantity.
     *
     * The push button on the issue stays. It is the shortcut for returning the whole document quickly.
     * The pendingReview document it creates can still have its quantities edited. Both paths end on the same editable pendingReview document.
     */
    createFrom: [{
      path: "lines.issueLineId",
      label: "Return from issue",
      sourceStatuses: ["issued"],
      sourceRemaining: { header: "pendingReturnBaseQty", line: "lines.openReturnBaseQty" },
    }],
    form: [
      // The source issue, production task, and return warehouse are not in this header section. All three are per line
      // (see "Source issue line", "Production task", and "Return to warehouse" on the lines).
      // One return can settle several issues, several tasks, and several warehouses.
      { title: "Material return", fields: ["code", "returnDate"] },
      { title: "Return lines", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
