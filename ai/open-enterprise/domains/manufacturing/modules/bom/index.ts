import {
  defineModule,
  definePlanners,
  schemaFail,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlanRecord,
  type PlannerContext,
  requireText,
} from "@open-erp/metamodel";

/**
 * Derive a new version from the current active version. The repository
 * increments the version number inside the same transaction, so neither the
 * Planner nor the client may submit version (that also avoids a preview value
 * going stale under concurrency). The new version is stored already active,
 * and the product's previous active version is disabled in the same transaction.
 */
async function createVersionPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  if (ctx.bill.header["status"] !== "active") schemaFail("Only an active BOM can create a new version");

  const sourceProductId = requireText(ctx.bill.header["productId"], "Current BOM product");
  const sourceLines = ctx.bill.lines["lines"] ?? [];
  const lines: PlanRecord[] = sourceLines.map((raw) => {
    const next: Record<string, PlanRecord[string]> = {};
    // Copy only business columns the user maintains. Platform columns and
    // calculate / unitChoice supplied columns are recomputed by createBill.
    // parentLineNo comes along: new-version lines are stored in the original
    // order, line numbers still start at 1, and parent/child pointers still match.
    for (const [key, value] of Object.entries(raw)) {
      // childBomId is retired: same-document levels use parentLineNo. Drop any stored pin on copy.
      if (["id", "lineNo", "baseUnitQty", "unitFactor", "childBomId"].includes(key)) continue;
      if (value !== undefined) next[key] = value as PlanRecord[string];
    }
    return next;
  });

  const commands: ExecutionCommand[] = [
    {
      type: "createBill",
      commandId: "bom-new-version",
      module: "bom",
      header: {
        productId: sourceProductId,
        remark: null,
      },
      lines: { lines },
    },
  ];

  // A Planner may not push an edge on a document it just created in the same plan.
  // The new version is stored active by createBill. Create preconditions check the structure.
  return { version: 1, commands };
}

export const planners = definePlanners(
  { createVersion: createVersionPlan },
  undefined,
  { createVersion: "latest" },
);

/** Product BOM version. Production planning reads components, quantities, and the issue warehouse from the specific record. */
export default defineModule({
  label: "BOM",
  numbering: { prefix: "BOM", seqScope: "tenant" },

  fields: [
    { key: "code", label: "BOM code", type: "string", primary: true, auto: true },
    // ── Candidate filter: this is where "which products can be chosen" is decided. Other modules cite this block.
    //
    // The material-type rule and `bom_product_makeable` below are the same criterion at two moments.
    // Both are required: the filter covers entry (a button never appears in the dropdown), and the
    // precondition covers the moment of activation (`productType` is in product's editableFields, so
    // it can still change after selection, and an existing BOM is not rechecked just because the product type changed).
    //
    // `status: "active"` is added only on records that freeze (BOM / routing / stock documents).
    // The candidate side and the write side of refFilter share one condition: including it means
    // "a document that references a disabled product can no longer be saved". After a BOM is active,
    // `editable` is "none". After a stock document posts, only remark can change, so history never
    // hits the filter. Single-state master data (molds) is always `editable: "full"`. Adding the
    // filter there would reject even a change of owner on every file that once referenced a product
    // after that product is disabled. That pins existing records instead of guiding entry (see mold.ts).
    {
      key: "productId",
      label: "Product",
      type: "ref",
      ref: "product",
      required: true,
      refFilter: { status: "active" },
    },
    // The unique coordinate is `productId × version`, not version alone and not productId:
    //   · version unique alone makes "women's commuter suit V1.0" collide with "men's business suit V1.0", which users read as "only one row is allowed";
    //   · productId unique alone means each product can have only one BOM, and versioned files are gone.
    // `uniqueWith` makes both the application check and the unique index use the compound coordinate. A duplicate is a 400 on the version cell.
    {
      key: "version",
      label: "Version",
      type: "string",
      // Mode B: version is a system sequence per product. The person entering it cannot edit it.
      // Inside the transaction the repository increments from that product's current highest version (V1.0 → V1.1).
      systemGenerated: true,
      unique: true,
      uniqueWith: ["productId"],
      generatedSequence: { kind: "majorMinor", within: ["productId"] },
      help: "The system increments from the product's current highest version. It cannot be edited by hand, and version numbers cannot repeat on the same product",
    },
    {
      key: "effectiveDate",
      label: "Effective date",
      type: "date",
      systemGenerated: true,
      // Stamp the business date the first time it enters active. An existing value is not overwritten (disable then enable keeps the original date).
      stampOnFirstEnter: { status: "active" },
      help: "Recorded automatically in the business time zone the first time it becomes active. It cannot be typed or overwritten by hand",
    },
    {
      key: "lines",
      label: "BOM lines",
      type: "subtable",
      ref: "bomLine",
      fields: [
        // The component set and the header set are complementary, not the same list.
        // finished is the layer that is sold, so it does not enter someone else's material list.
        // rawMaterial and packaging can appear only here. semiFinished is on both sides.
        // parentLineNo only rebuilds the edit tree: parent and child of "add component" inside this BOM.
        // It does not create a child document. Explosion and release do not read this field; each line is issued directly.
        //
        // The cost: a finished good as a component (a kit or a set) cannot be chosen today.
        // If that business shows up, the question is whether it is sold on its own. It should
        // usually be its own semiFinished record, not a filter widened to "anything can be chosen".
        {
          key: "componentProductId",
          label: "Component product",
          type: "ref",
          ref: "product",
          required: true,
          refFilter: { productType: ["rawMaterial", "semiFinished", "packaging"], status: "active" },
        },
        {
          key: "parentLineNo",
          label: "Parent line no.",
          type: "number",
          help: "Parent and child of Add component inside this same BOM. It points at a lineNo on these lines. Explosion and release do not read this field",
        },
        { key: "unitQty", label: "Quantity per", type: "number", required: true },
        // The label carries the unit. `percent` is a bare number box. Labeled only "scrap rate",
        // users ask whether to enter 0.05 or 5. Those readings differ by 100x, and both numbers would store.
        { key: "lossRate", label: "Scrap rate (%)", type: "percent", required: true },
        {
          key: "unit",
          label: "Unit",
          type: "enum",
          required: true,
          refDefault: { from: "product", match: "componentProductId", through: null, field: "mainUnit" },
          unitChoice: { match: "componentProductId", factorInto: "unitFactor" },
        },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        {
          key: "baseUnitQty",
          label: "Main-unit quantity",
          type: "number",
          calculate: { op: "mul", args: [{ field: "unitQty" }, { field: "unitFactor" }] },
        },
        // The default for "default issue warehouse" is the product's "default warehouse".
        // The two cells say the same thing, one on the product and one on the BOM line.
        // It used to be required with no default, so every BOM line meant picking the same
        // warehouse again from the product file. A BOM with dozens of lines meant copying it dozens of times.
        // Override is deliberate: the same screw can issue from the hardware warehouse on product A
        // and from the line-side warehouse on product B. That is this BOM's decision. The product file only supplies the starting value.
        {
          key: "defaultIssueWarehouseId",
          label: "Default issue warehouse",
          type: "ref",
          ref: "warehouse",
          required: true,
          refDefault: { from: "product", match: "componentProductId", through: null, field: "defaultWarehouseId" },
          help: "Selecting a component prefills the product's default warehouse. This line can override it",
        },
        { key: "remark", label: "Line remark", type: "text" },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    // One active record inside the coordinate: a product may have only one active BOM at a time.
    // When a version becomes active, the product's other active versions are dropped to disabled
    // in the same transaction. Creating V2 and activating it disables V1.
    // Downstream (production orders, material requirements, production tasks, sales-to-production)
    // always takes the one that is active now.
    singleActiveWithin: { within: ["productId"], status: "active", supersedeTo: "disabled" },
    statuses: [
      { key: "active", label: "Active", color: "green", initial: true, editable: "none" },
      { key: "disabled", label: "Disabled", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Re-enable", confirm: true },
      {
        code: "createVersion",
        from: "active",
        to: "active",
        action: "New version from this",
        confirm: true,
      },
    ],
  },

  preconditions: [
    {
      id: "lines_required",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "A BOM with no component lines cannot explode a material requirement, so production planning cannot use it",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "quantity_positive",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "Component quantity per must be greater than zero. A return or a substitute is not a negative BOM line",
      check: { primitive: "lines_all", left: { ref: "$line.unitQty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "loss_non_negative",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "Scrap rate cannot be negative. A negative scrap rate would silently shrink the production requirement",
      check: { primitive: "lines_all", left: { ref: "$line.lossRate" }, op: "gte", right: { value: 0 } },
    },
    // "One active BOM per product at a time" is guaranteed by lifecycle `singleActiveWithin`
    // (activating a version drops the product's other active versions to disabled). It no longer
    // depends on a unique field or a related_agg precondition.
    // The next two preconditions cover something else: the BOM structure is legal at the moment
    // it becomes active, which is separate from which version is active.
    // A deep cycle (A→B→A) fails fast in the release-time recursive exploder, which carries a
    // visited set. This only blocks a direct self-reference.
    // A cycle has no symptom when the BOM is created. It blows up when material requirements
    // are exploded, and the failure is infinite recursion rather than a sentence a person can read.
    {
      id: "no_self_component",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "A BOM component cannot be the product itself. A direct self-reference makes material-requirement explosion recurse forever",
      check: {
        primitive: "lines_all",
        left: { ref: "$line.componentProductId" },
        op: "ne",
        right: { ref: "$bill.productId" },
      },
    },
    {
      id: "no_recursive_component_cycle",
      onTransition: "*",
      onCreate: true,
      source: "gate",
      level: "block",
      why: "An active BOM cannot point back to itself through a semi-finished chain, or production release would explode forever",
      message: "This BOM has an indirect cycle. Follow the product chain in the message, fix it, then activate again",
      check: {
        primitive: "recursive_ref_free",
        entity: "bom",
        root: "productId",
        lines: "lines",
        component: "componentProductId",
        child: null,
        activeStatus: "active",
      },
    },
    {
      id: "last_active_bom",
      onTransition: "disable",
      source: "gate",
      level: "warn",
      // The default sentence "bom row count is 1, at least 2 required" is read as
      // "the system requires at least two BOMs", which is the opposite of this warning.
      message: "This is the product's last active BOM version. After it is disabled, new production orders cannot explode material requirements. Continue only if you still want to disable it",
      why: "This may be the product's last active BOM. After it is disabled, production orders cannot explode material requirements",
      check: {
        primitive: "related_agg",
        from: "bom",
        through: null,
        match: "productId",
        on: "productId",
        agg: "count",
        measure: null,
        where: { status: "active" },
        op: "gte",
        right: { value: 2 },
        // The row set selected by where includes this document (it is active right now), so nothing extra is added.
        plus: null,
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "productId", "version", "effectiveDate", "status"],
      filters: ["status", "productId", "effectiveDate"],
      searchable: ["code", "version"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Version", fields: ["code", "productId", "version", "effectiveDate"] },
      { title: "Components", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
    // Multiple levels are the same-document parentLineNo edit tree. The explosion panel no longer drills into a child BOM version on another document.
    explosion: {
      entity: "productId",
      lines: "lines",
      component: "componentProductId",
      childBom: null,
      qty: "baseUnitQty",
      loss: "lossRate",
      stop: null,
      activeStatus: "active",
      // A product has only one active version at a time. The exploder's status=active hit is that version.
      // It does not need a "default pointer" sort.
      preferred: null,
      label: "version",
    },
  },
});
