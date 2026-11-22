import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Material issue",
  numbering: { prefix: "MISSUE", seqScope: "day" },

  fields: [
    { key: "code", label: "Issue no.", type: "string", primary: true, auto: true },
    // The header keeps only the number, date, and remark. Three cells were removed on purpose:
    //
    // · `productionTaskId` — one issue can serve several production tasks (the shop goes to
    //   the warehouse once and picks material for every task in hand). A header cell would
    //   have to pick one task, and the cumulative issue gate, return snapshot, and cost
    //   collection would all pair on it. The number would stay right and point at the wrong task.
    // · `warehouseId` — one batch can come from different default issue warehouses (fabric in
    //   the Pinghu trim warehouse, buttons from the product's default warehouse). One header
    //   warehouse would force a split document for a cross-warehouse pick, which is a shape
    //   the declaration invented. After the cell moved to the line, the stock-out effect
    //   scope follows `$line.warehouseId`.
    // · `productionOrderId` / `materialRequirementId` — several tasks can cross orders, and
    //   a material requirement is no longer a prerequisite for issue (see `views.createFrom`
    //   and the relationship with material requirements below).
    //
    // This module can have only this one detail table. All three stock-out coordinates use
    // `$line.`. A second detail table (for example "production tasks on this document") hits
    // `EFFECT_LINE_AMBIGUOUS` and fails at modeling time. The task coordinate has to live on
    // the material line. That is the structure.
    { key: "issueDate", label: "Issue date", type: "date", createDefault: "today" },
    // No handler field. The person who issued the material is the platform `createdBy`.
    // "Who handled this document" and the creator are the same person today, and `createdBy`
    // is already in `PLATFORM_QUERY_FIELDS` and fixed on the detail shell. Another `handlerId`
    // would make the user pick themselves from a person directory.
    // Reversible later: once the `agentic-enterprise` authorization center provides people and
    // permissions and a stable person directory, and the business confirms the handler is not
    // the creator, add it back as a real person reference. This is a known tradeoff.
    {
      key: "lines",
      label: "Issue lines",
      type: "subtable",
      ref: "materialIssueLine",
      fields: [
        // The only business input: pick one frozen material-component line of a production task.
        { key: "taskLineId", label: "Task material line", type: "refLine", ref: "productionTask", through: "materialLines", required: true },
        // Companion stored column. Storage writes it from the refLine ownership. The client, push, and seeds must not fill it.
        // It answers which task this line's material is for, and it is the coordinate for looking issues up by task.
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
        { key: "productId", label: "Material", type: "ref", ref: "product", snapshot: { from: "productionTask", match: "taskLineId", through: "materialLines", field: "componentProductId" } },
        // The issue warehouse lives on the line. The starting value is the default issue warehouse frozen on that BOM line, and it can be overridden.
        // When that warehouse is short, picking from another warehouse (sequential issue or average issue) is an existing shop action.
        // `pushFrom` covers expanding a production task into a pendingReview document (visible immediately on pendingReview).
        // `refDefault` covers picking a task material line by hand on a blank row (filled on save).
        // Each entry path covers half. Whichever is missing leaves a blank cell.
        {
          key: "warehouseId",
          label: "Issue warehouse",
          type: "ref",
          ref: "warehouse",
          required: true,
          pushFrom: "defaultIssueWarehouseId",
          refDefault: { from: "productionTask", match: "taskLineId", through: "materialLines", field: "defaultIssueWarehouseId" },
        },
        // One hop on the freeze chain. Do not freeze from the product master again. What is issued is what the task material line says.
        // That line itself was frozen from `product.mainUnit` at release. Freezing from the product master would let a later unit change
        // make the issue and the task material line disagree, while each document still looks consistent with the product master.
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "productionTask", match: "taskLineId", through: "materialLines", field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "qty", label: "Issue quantity", type: "number", required: true, pushFrom: "requiredQty" },
        { key: "baseQty", label: "Issued quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "baseUnitPrice", label: "Business price in main unit", type: "money", hidden: true, derive: { kind: "formula", expr: { value: 0 } } },
        // Right-hand side of the cumulative gate. It reads the planned issue quantity (`baseRequiredQty`), not the still-to-issue quantity
        // (`pendingIssueBaseQty`). The latter is a current value and changes with this document's own status.
        // Using it as the cap would shrink the same line's ceiling as soon as one document is approved, and the second document would always exceed it.
        {
          key: "requirementBaseQty",
          label: "Task requirement in main unit",
          type: "number",
          derive: { kind: "lookup", from: "productionTask", through: "materialLines", match: "taskLineId", field: "baseRequiredQty" },
        },
        // On one raw-material list, navy fabric and charcoal fabric share the name and code prefix. The warehouse prepares by specification.
        // `bomPath` stays a lookup (it is not stored), and the screen does not show it. Semi-finished traceability is only an internal coordinate.
        { key: "spec", label: "Specification", type: "string", derive: { kind: "lookup", from: "productionTask", through: "materialLines", match: "taskLineId", field: "spec" } },
        { key: "bomPath", label: "BOM path", type: "string", hidden: true, derive: { kind: "lookup", from: "productionTask", through: "materialLines", match: "taskLineId", field: "bomPath" } },
        /**
         * Already returned / still returnable.
         *
         * The shop reported that a return had to be for the whole issue. The declaration already
         * allowed a partial return (`materialReturn.not_over_return` uses `lte`, and pendingReview
         * is fully editable). The block was the entry shape: `createReturn` pushes the whole
         * document, and the pendingReview copy arrives with the full quantity. Nobody could tell
         * that the number could be changed.
         *
         * A pick-lines-and-enter-quantities entry (`materialReturn.views.createFrom`) needs
         * "how much of this line can still be returned". The picker uses that to decide which
         * lines to expand and the cap on each line.
         *
         * Same shape as sales `openQty`: already returned is a rollup of downstream facts, and
         * still returnable is the subtraction. Neither is stored as a second column.
         */
        {
          key: "returnedBaseQty",
          label: "Already returned on this line (main unit)",
          type: "number",
          derive: {
            kind: "rollup",
            from: "materialReturn",
            through: "lines",
            match: "issueLineId",
            measure: "sum(baseQty)",
            // pendingReview also occupies the quantity. Otherwise the same line can be returned once by each of two pendingReview returns, and each document looks within the cap. Return statuses are pendingReview, completed, and cancelled.
            where: { status: ["pendingReview", "completed"] },
          },
        },
        {
          key: "openReturnBaseQty",
          label: "Returnable on this line (main unit)",
          type: "number",
          derive: {
            kind: "formula",
            expr: { op: "sub", args: [{ field: "baseQty" }, { orElse: { of: { field: "returnedBaseQty" }, whenEmpty: 0 } }] },
          },
          help: "Issued quantity in the main unit, minus returns, including unfinished return documents. The return picker caps each line at this",
        },
        { key: "batchNo", label: "Lot number", type: "string", help: "Recorded only. It does not enter the stock calculation. The ledger coordinate stops at the warehouse; stock by lot is not supported yet" },
        { key: "remark", label: "Remarks", type: "text" },
      ],
    },
    /**
     * How much of the whole document can still be returned. The picker's first stage reads it,
     * so a fully returned issue is disabled up front with a reason instead of opening and then
     * reporting that no line has a positive remainder.
     */
    { key: "pendingReturnBaseQty", label: "Returnable quantity in main unit", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(openReturnBaseQty)" } },
    { key: "requestedBaseQty", label: "Requested quantity in main unit", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(baseQty)" } },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Created as pendingReview. Do not set editable: "none". A pendingReview document must still be editable.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      { key: "issued", label: "issued", color: "green", editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "confirm",
        from: "pendingReview",
        to: "issued",
        action: "Confirm material issue",
        primary: true,
        effects: [{
          target: "stock",
          op: "out",
          subject: "$line.productId",
          scope: "$line.warehouseId",
          amount: "{$line.baseQty}",
          reverseOn: [],
        }],
      },
      { code: "createReturn", from: "issued", to: "issued", action: "Return task material", push: "materialReturn" },
      { code: "cancel", from: "pendingReview", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },

  preconditions: [
    {
      id: "issue_lines_required",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "A material issue must list what was actually taken from the warehouse. An empty line list creates no stock fact",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "issue_qty_positive",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "Issue quantity must be positive. Return material on a production material return",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "issue_facts_required",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "The actual issue date is required before confirming the material issue",
      // The production task and issue warehouse both live on the line and are required there, so the value gate checks them per line. Do not list them again here.
      // `issueDate` is optional at declaration time (a pendingReview document can be created and the date filled later). "Required before confirm" has only a precondition as its outlet in the metamodel. Making the field `required` would demand it at save time, and the pendingReview document could not be created.
      check: { primitive: "required_fields", fields: ["issueDate"] },
    },
    {
      id: "issue_stock_available",
      onTransition: "confirm",
      source: "gate",
      level: "block",
      why: "A material issue reduces stock on hand. It cannot continue into negative stock when available stock is short",
      check: {
        primitive: "available_sufficient",
        target: "stock",
        subject: "$line.productId",
        scope: "$line.warehouseId",
        need: "$line.baseQty",
      },
    },
    {
      id: "issue_task_active",
      onTransition: "confirm",
      source: "gate",
      level: "block",
      why: "Only a production task that is still running can issue material. A completed or cancelled task cannot reduce stock again",
      // Checked on the line (`$line.productionTaskId`). One document can carry several tasks, and one cancelled while the others are still running is normal. A header check would have no right-hand value to compare.
      check: {
        primitive: "ref_field_compare",
        via: "$line.productionTaskId",
        entity: "productionTask",
        through: null,
        field: "status",
        op: "in",
        right: { value: ["awaitingLaunch", "inProduction"] },
      },
    },
    {
      id: "not_over_task_requirement",
      onTransition: "confirm",
      source: "gate",
      level: "block",
      why: "Cumulative issues on one task material line cannot exceed that task's frozen BOM requirement. The excess has no production-material basis",
      // The match key `taskLineId` is the line id of `productionTask.materialLines`.
      // Each production task freezes its own copy at release. It is a document line, not master data.
      // This has to stay explicit because subcontract issue hit the opposite bug: `subcontractIssue.not_over_bom`
      // once pointed `taskLineId` at `bom.lines`. A BOM is master data built per product, so every task of that
      // product shares the same line ids. The left side then counted every task and the right side only this task,
      // and the second document was always blocked by mistake.
      // Before changing this gate's `match`, confirm the new coordinate is still one copy per task.
      check: {
        primitive: "related_agg",
        from: "materialIssue",
        through: "lines",
        match: "taskLineId",
        on: "$line.taskLineId",
        agg: "sum",
        measure: "baseQty",
        where: { status: ["issued"] },
        op: "lte",
        right: { ref: "$line.requirementBaseQty" },
        plus: { ref: "$line.baseQty" },
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "issueDate", "status"],
      filters: ["status", "issueDate", "createdBy"],
      searchable: ["code"],
      defaultSort: { field: "createdAt", desc: true },
    },
    // This is the only declaration of "select several production tasks and bring their BOM onto the issue lines". No custom UI is required.
    // Check rows on the production task list, the batch bar shows "Create task material issue", and the server `create-from/prepare`
    // expands each task's `materialLines` into pendingReview lines (at most 50 source documents / 200 lines at once).
    //
    // · `sourceStatuses` — completed or cancelled tasks get no entry. It judges the source document,
    //   and it does not overlap `issue_task_active`, which judges the moment of execution. The first says whether a document can be opened now.
    //   The second says whether the task is still running at approval. The whole time spent filling the document sits between them.
    // · `sourceRemaining` is given at both levels:
    //     `header` decides whether this task appears as a candidate (the list batch bar and the picker's first stage both read it,
    //       so a fully issued task, and a historical task whose frozen material lines are empty, is disabled up front with a reason);
    //     `line` decides which lines expand (a line that is fully issued disappears).
    //   Without the header level the list still looks clickable, and only after the click does it report that no line has a positive remainder.
    //   Both are eligibility, not the cap. The cap is `not_over_task_requirement`, judged against the frozen requirement.
    createFrom: [{
      path: "lines.taskLineId",
      label: "Create task material issue",
      sourceStatuses: ["awaitingLaunch", "inProduction"],
      sourceRemaining: { header: "pendingIssueBaseQty", line: "materialLines.pendingIssueBaseQty" },
    }],
    form: [
      { title: "Material issue", fields: ["code", "issueDate"] },
      { title: "Issue lines", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
