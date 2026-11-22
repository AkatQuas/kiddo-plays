import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "MatReq",
  numbering: { prefix: "MATREQ", seqScope: "day" },

  fields: [
    { key: "code", label: "Requirement no.", type: "string", primary: true, auto: true },
    { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder", required: true },
    // Candidates match the production order side (the same business sentence must not have two wordings).
    // The BOM must belong to this document's product and be active, the product must be one of the two makeable types, and the factory must be the factory level.
    // Values the planner writes at release already satisfy `release_bom_active` / `release_bom_matches_product`,
    // so these are always true on the release path. They block a document created by hand,
    // and that path is open today (every required field on this module can be filled, so a person can create a material requirement directly).
    // `refPreselect` is the same sentence as the cell on the production order line: the currently active version among the candidates is selected, and it can be switched.
    // It covers the hand-created path named above. The release path has the planner write the value (non-empty means preselect does not apply).
    {
      key: "bomId",
      label: "Source BOM",
      type: "ref",
      ref: "bom",
      required: true,
      refFilter: { productId: { from: "$bill.productId" }, status: "active" },
      refPreselectSole: true,
    },
    { key: "productId", label: "Product", type: "ref", ref: "product", required: true, refFilter: { canProduce: true } },
    // The release path is copied explicitly by the planner from the production order (non-empty means the default does not apply). `refDefault` covers
    // the hand-created document named above. These three cells can only be the values on the order, and a person used to copy them off the order again.
    // Both sides use the same `orgType: "factory"`, so a value brought across is inside this cell's candidates.
    {
      key: "productionOrgId",
      label: "Factory",
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "factory" },
      refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "productionOrgId" },
    },
    {
      key: "issueWarehouseId",
      label: "Issue warehouse",
      type: "ref",
      ref: "warehouse",
      required: true,
      refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "issueWarehouseId" },
    },
    { key: "requiredDate", label: "Requirement date", type: "date", required: true },
    {
      key: "lines",
      label: "Manually issued component",
      type: "subtable",
      ref: "materialRequirementLine",
      fields: [
        { key: "componentProductId", label: "Component", type: "ref", ref: "product", required: true },
        { key: "unitQty", label: "BOM quantity per", type: "number", required: true },
        { key: "lossRate", label: "Scrap rate", type: "percent", required: true },
        { key: "productionBaseQty", label: "Production quantity in main unit", type: "number", required: true, help: "The finished-goods quantity in the main unit, frozen at release. It is only the auditable multiplier for BOM explosion" },
        {
          key: "baseQty",
          label: "Net requirement",
          type: "number",
          derive: { kind: "formula", expr: { op: "mul", args: [{ field: "baseUnitQty" }, { field: "productionBaseQty" }] } },
        },
        {
          key: "lossQty",
          label: "Scrap quantity",
          type: "number",
          derive: {
            kind: "formula",
            expr: {
              op: "mul",
              args: [
                { field: "baseQty" },
                { op: "div", args: [{ field: "lossRate" }, { value: 100 }] },
              ],
            },
          },
        },
        { key: "requiredQty", label: "Requirement including scrap", type: "number", required: true },
        { key: "baseRequiredQty", label: "Main-unit requirement", type: "number", calculate: { op: "mul", args: [{ field: "requiredQty" }, { field: "unitFactor" }] } },
        // The three rollups `issuedBaseQty` / `issuedQty` / `pendingQty` were removed because the coordinate is gone,
        // not because quantity already issued should be hidden. They matched `materialIssue.lines.requirementLineId`,
        // and issue now reads the production task's frozen material line, so that column no longer exists.
        // Already issued and still to issue now live on `productionTask.materialLines` (`issuedBaseQty` /
        // `pendingIssueBaseQty`). The match key is `taskLineId`.
        //
        // Keeping an approximation that looks like quantity already issued (for example matching by component product) is worse than having none.
        // The same component can be issued by two tasks of this order at once. A total by product has a value, can be sorted,
        // and is completely legal, and it answers a different question.
        // On one raw-material list, navy fabric and charcoal fabric share the name and code prefix.
        // The warehouse prepares from this cell. Without it they can only guess.
        // Specification and unit no longer come from the same place. After product was split into header and lines, `mainUnit` is still on the header (unit is still frozen),
        // while `spec` moved into `productLine`. A header-level ref cannot point at a line, so this cell falls back to hand entry for now.
        // The upgrade path is the same as salesOrder.lines.spec: add a `refLine` on this line pointing at product `lines`.
        { key: "spec", label: "Specification", type: "string", help: "After the product master was split, the specification dimension is not wired yet, so it is entered by hand" },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "product", match: "componentProductId", through: null, field: "mainUnit" }, unitChoice: { match: "componentProductId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "baseUnitQty", label: "BOM usage in main unit", type: "number", calculate: { op: "mul", args: [{ field: "unitQty" }, { field: "unitFactor" }] } },
        { key: "defaultIssueWarehouseId", label: "BOM default issue warehouse", type: "ref", ref: "warehouse", required: true },
        { key: "sourceLineNo", label: "BOM line no.", type: "number", required: true },
        {
          key: "bomPath",
          label: "BOM path",
          type: "string",
          required: true,
          /**
           * The product requirement is that the screen does not show this column, but it cannot be `hidden` in the declaration.
           * The kernel has a gate: `hidden` must not be `required` (a hidden required cell has no input,
           * and it only jams the document). This cell must be non-empty. It is the lookup source of `materialIssue.bomPath`
           * (the issue side is already `hidden`, and it still has to be computed as an internal coordinate).
           *
           * Changing `required` to `systemGenerated` would pass the gate, but it would make the generated column nullable
           * and need a migration, and the only gain is hiding one column. The hide lives in the renderer
           * (erp-web `fieldOverrides.hiddenLineFields`). The declaration stays honest.
           */
        },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      { key: "awaitingIssue", label: "awaitingIssue", color: "amber", initial: true, editable: "none" },
      { key: "kitted", label: "kitted", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      // The `issue` push edge was removed. The entry for issue is now selecting several production tasks and generating
      // (`materialIssue.views.createFrom` on `lines.taskLineId`). One issue can serve several tasks, cross orders, and have one warehouse per line.
      // A push is naturally one source document to one target document, and it cannot express several sources.
      // Leaving it would be a second entry that can only create a single-task issue,
      // and the pushed document it produced could not fill a single cell in the new field shape.
      {
        // A self-loop. The material requirement stays on awaitingIssue. What is pushed is a purchase plan waiting for approval, not a close of the material plan itself.
        // One requirement may be split into several plans by supplier. Leaving awaitingIssue would take away material that has not been transferred yet.
        // There is no remainder gate today (a plan line has no rollup back to the requirement line). Clicking twice produces two identical plans.
        // The extra one is dropped with Cancel on the plan that is waiting for approval.
        code: "toPurchasePlan",
        from: "awaitingIssue",
        to: "awaitingIssue",
        action: "Push purchase plan",
        push: "purchasePlan",
      },
      { code: "complete", from: "awaitingIssue", to: "kitted", action: "Confirm kitting", confirm: true },
      { code: "cancel", from: "awaitingIssue", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },

  // This document now has no preconditions. They were removed on purpose.
  // `materials_issued_in_full` (a kit must have every item fully issued) and `no_unreversed_issue_on_cancel`
  // (cancel is not allowed while an unreversed issue exists) both used `$line.issuedBaseQty` as the left side, and that rollup's match coordinate
  // disappeared with the issue change (see the note on the lines). Leaving them would not mean the gates were still there. They would be two gates that always pass.
  // After the left side reads undefined, `gte` / `eq` never hold, so the engine lets a missing value through,
  // and the screen still shows those two rules as passed. That is worse than having no gate.
  //
  // This is a known capability gap, not a judgment that the business does not need it. The material requirement has become
  // a material plan frozen at release. Whether the kit is complete is judged by a person looking at the task's quantity still to issue.
  // To connect it again, the kit check should ask the production task (every `materialLines.pendingIssueBaseQty`
  // is 0), not assemble an approximate issued quantity by product here.
  preconditions: [],

  views: {
    list: {
      columns: ["code", "productionOrderId", "productId", "issueWarehouseId", "requiredDate", "status"],
      filters: ["status", "productionOrgId", "issueWarehouseId", "requiredDate"],
      searchable: ["code"],
      defaultSort: { field: "createdAt", desc: true },
    },
    // Entry order is candidate-dependency order. `bomId` candidates are narrowed by `$bill.productId`,
    // so the product to make must be placed before it. The reverse was measured (acceptance WB-BUG-54,
    // "cannot link an active BOM"). The user fills from top to bottom, and when they reach source BOM, productId is still empty.
    // Candidates fail closed to an empty set, and the dropdown says there is no matching option, while that active BOM is sitting in the database.
    // Same discipline as the narrowing chains on the assignment and the work report: the previous cell is the premise of the next cell's candidates.
    form: [
      { title: "Requirement source", fields: ["code", "productionOrderId", "productId", "bomId", "productionOrgId", "issueWarehouseId", "requiredDate"] },
      { title: "Manually issued component", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
