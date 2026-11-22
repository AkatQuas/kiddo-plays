import { defineModule } from "@open-erp/metamodel";

/** Product routing version. Lines freeze execution order, rates, the team, and quality or subcontract requirements. */
export default defineModule({
  label: "Process",
  // Maintained on the page only. Export and import are not open.
  capabilities: { export: false, import: false },
  numbering: { prefix: "ROUTE", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Routing code", type: "string", primary: true, auto: true },
    // The value set matches `bom.productId` word for word, for the same reason: a routing is
    // how this thing is made, and a purchased item (rawMaterial / packaging) is not made in-house.
    // Building operations, a rate, and a team for a purchased button is an entry error that does
    // not fail until someone tries to schedule it.
    //
    // The original request was "only semiFinished may be chosen". The set taken here is
    // `[semiFinished, finished]`: finished goods obviously need a routing too (the suit-sewing
    // route is one). Leaving only semiFinished would make every finished good unschedulable.
    // Sharing the BOM's value set is deliberate. The two correspond one to one (a BOM has a routing).
    // If the sets drift, products end up with a material list and no operations, or the reverse, and each side is still legal on its own.
    //
    // Why `status` is included is in the BOM header comment: after a routing is active, productId
    // is not on the whitelist, so history never hits it and the filter can be carried.
    {
      key: "productId",
      label: "Product",
      type: "ref",
      ref: "product",
      required: true,
      refFilter: { canProduce: true, status: "active" },
    },
    // The unique coordinate is `productId × version`, the same shape as `bom.version`:
    //   · version unique alone makes "women's commuter suit V1.0" collide with "men's business suit V1.0";
    //   · productId unique alone means each product can have only one routing, and versioning is gone.
    {
      key: "version",
      label: "Version",
      type: "string",
      required: true,
      unique: true,
      uniqueWith: ["productId"],
      help: "Version numbers cannot repeat on the same product. Different products may both be called V1.0",
    },
    /**
     * Process type (3.5.0): how the operations on this route advance relative to each other.
     *
     * It is the criterion for schedule sequence checks, not a registration slot:
     *   · Sequential production: the next operation must start after the previous one finishes (parallel ones take the latest finish);
     *   · Parallel production: operations start together and times are not checked against each other;
     *   · Unordered production: any order is fine, and times are not checked either.
     * The production-task schedule screen uses this cell to decide whether to block "operation 2 starts before operation 1".
     *
     * Use `options`, not a choiceSet. These three levels are three branches of kernel behavior
     * (each has a check that is already implemented). They are not a vocabulary the business can add to or delete.
     * Making it a dictionary would let the business add a fourth level, "mixed production", that no code understands.
     * That is the inert value AGENTS.md says must not be exposed.
     */
    {
      key: "processType",
      label: "Process type",
      type: "enum",
      options: ["Sequential production", "Parallel production", "Unordered production"],
      required: true,
      help: "Sequential means the next operation waits for the previous one to finish. Parallel or unordered means operation times are not checked against each other",
    },
    {
      key: "lines",
      label: "Operation lines",
      type: "subtable",
      ref: "routingLine",
      fields: [
        { key: "sequence", label: "Operation sequence", type: "number", required: true },
        { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
        // The operation master supplies the starting rate. This route for a specific product can change it.
        // After the route is active the whole document is not editable, so the final rate stays frozen
        // on this route version and is not rewritten when the operation master changes price later.
        {
          key: "pieceRate",
          label: "Piece rate",
          type: "money",
          required: true,
          refDefault: { from: "operation", match: "operationId", through: null, field: "pieceRate" },
          help: "Selecting an operation prefills this from the operation master. This routing line can override it. Dispatch uses it as the assignment's starting piece rate",
        },
        {
          key: "hourlyRateUnit",
          label: "Hourly-rate unit",
          type: "string",
          snapshot: { from: "operation", match: "operationId", through: null, field: "hourlyRateUnit" },
          // After the close-down to hours this cell is always "hour", and it is still frozen.
          // Price and its unit are stored apart so that, if more units open later, a historical line can still say which unit it was priced in.
          help: "Frozen from the operation master. This release is always Per hour, so the hourly price is the price per hour",
        },
        // Fields below take a default from the operation master. The route can change each line.
        //
        // The time unit above and these fields deliberately use two mechanisms. The difference is one sentence:
        //   · the time unit is `snapshot`: frozen, and a person may not change it, so price and unit are not split apart;
        //   · the rate and these `refDefault` fields are starting values a person may change. The operation master
        //     supplies the default basis (the field names say "default team" and "default time per piece"). The route can override them per product.
        //
        // These fields used to have no default. After choosing an operation the user copied each cell from the operation master.
        // That is the acceptance item "related information was not brought in; the related information must be linked".
        // Rate and time unit already come across. The other cells on the same screen must be prefilled too, not look like only half was brought in.
        {
          key: "standardTimePerPiece",
          label: "Default time per piece",
          type: "number",
          // This used to say "leave blank to keep the operation master's basis", and no code kept it
          // (the declaration was the only mention, with zero consumers). That promise could not land.
          // At entry the master value is written in. After the routing is active, lines are not on the
          // whitelist, so what freezes must be the number from that moment. Otherwise a later change
          // of basis on the master would rewrite historical route times, and every screen would still look normal.
          refDefault: { from: "operation", match: "operationId", through: null, field: "standardTimePerPiece" },
          help: "Selecting an operation prefills this from the operation master. This routing line can override it",
        },
        {
          key: "defaultTeamId",
          label: "Default production team",
          type: "ref",
          ref: "orgUnit",
          required: true,
          // The meaning is a team node. It uses the same narrowing as the production-task operation line `teamId`,
          // the assignment `teamId`, and the operation master `defaultTeamId`. Otherwise a workshop or factory
          // filled upstream explodes as REF_FILTER_MISMATCH only when dispatch is pushed.
          // That narrowing must match the source cell (`operation.defaultTeamId`) word for word, or refDefault
          // does not hold: if the source is wider than the target, the prefilled value is one this cell's dropdown cannot choose.
          refFilter: { orgType: "team" },
          refDefault: { from: "operation", match: "operationId", through: null, field: "defaultTeamId" },
          help: "Selecting an operation prefills this from the operation master. Another product can use its own usual team",
        },
        {
          key: "assignmentRatio",
          label: "1:1 assignment ratio",
          type: "number",
          required: true,
          refDefault: { from: "operation", match: "operationId", through: null, field: "assignmentRatio" },
          help: "Selecting an operation prefills this from the operation master. Enter 1 when one operation output is one finished good. Another product can change the ratio on this routing",
        },
        {
          key: "requiresApproval",
          label: "Needs approval",
          type: "bool",
          // Optional. When blank, downstream treats it as approval required (`!== false`). Choosing an operation still prefills it via refDefault, and it can be changed per product.
          refDefault: { from: "operation", match: "operationId", through: null, field: "requiresApproval" },
          help: "Selecting an operation prefills this from the operation master. Another product can override it. Blank means approval is required",
        },
        // The same three levels as `operation.outsourcingMode`. This cell is this route's own decision
        // (the same plating operation is sent out on product A and made in-house on product B), so it is
        // an overridable `refDefault`, not a `snapshot`. The master supplies the starting value. The route makes the final call.
        {
          key: "outsourcingMode",
          label: "Operation subcontract",
          type: "enum",
          options: ["No subcontract", "Optional subcontract", "Full subcontract"],
          required: true,
          refDefault: { from: "operation", match: "operationId", through: null, field: "outsourcingMode" },
        },
        {
          key: "workInstruction",
          label: "Work instruction",
          type: "text",
          refDefault: { from: "operation", match: "operationId", through: null, field: "workInstruction" },
          help: "Written for the operator and shown on the work-report screen. It is not the line remark. Selecting an operation prefills it from the operation master, and this routing line can override it",
        },
        { key: "remark", label: "Line remark", type: "text" },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  // Version discipline (the compromise that an active record can still change remark):
  //   · Create starts at `active`. The product's previous active version is dropped to disabled
  //     in the same transaction by `singleActiveWithin`.
  //   · active: the whitelist is only `remark`. Do not open `lines`.
  //     Changing the operation structure means creating a new version (created active, the old one disabled).
  //     Do not edit lines on the active document.
  //   · disabled: `editable: "none"`. Re-enable uses `enable`, passes the same structure gates, and drops the product's other active versions.
  // The day someone puts lines on the active whitelist, the process a production task cites is rewritten in retrospect,
  // and every screen still looks normal, with no error.
  lifecycle: {
    // One active record inside the coordinate: a product may have only one active routing at a time.
    // When create or re-enable enters active, the product's other active versions are dropped to disabled
    // in the same transaction. Downstream (production orders, production tasks, sales-to-production)
    // always takes the one that is active now.
    singleActiveWithin: { within: ["productId"], status: "active", supersedeTo: "disabled" },
    statuses: [
      {
        key: "active",
        label: "Active",
        color: "green",
        initial: true,
        editable: "whitelist",
        editableFields: ["remark"],
      },
      { key: "disabled", label: "Disabled", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Re-enable", confirm: true },
    ],
  },

  preconditions: [
    // Create gate: onCreate requires onTransition to be *. A * rule itself is not evaluated on an edge (resolvePreconditions excludes onCreate).
    {
      id: "lines_required",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "A routing with no operation lines cannot be scheduled or dispatched, so it cannot become the active version",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "sequence_positive",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "Operation sequence must be a positive number. Zero or a negative number has no executable order",
      check: { primitive: "lines_all", left: { ref: "$line.sequence" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "piece_rate_non_negative",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "Piece rate cannot be negative. Enter zero when piece rate is not used",
      check: { primitive: "lines_all", left: { ref: "$line.pieceRate" }, op: "gte", right: { value: 0 } },
    },
    {
      id: "routing_product_makeable",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      message: "Only semi-finished goods and finished goods have a routing. Raw materials and packaging are purchased and have no in-house operations to schedule",
      why: "A routing says how this thing is made, and a purchased item is not made in-house. Building operations, rates, and teams for a raw material is an entry error. If it does not fail, it sits there until someone tries to schedule it",
      check: {
        primitive: "ref_field_compare",
        via: "productId",
        entity: "product",
        through: null,
        field: "canProduce",
        op: "eq",
        right: { value: true },
      },
    },
    // Re-enable uses the same structure gates as create. onCreate rules are not evaluated on an edge, so a second copy must be attached.
    {
      id: "lines_required_on_enable",
      onTransition: "enable",
      source: "invariant",
      level: "block",
      why: "A routing with no operation lines cannot be scheduled or dispatched, so it cannot become the active version again",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "sequence_positive_on_enable",
      onTransition: "enable",
      source: "invariant",
      level: "block",
      why: "Operation sequence must be a positive number. Zero or a negative number has no executable order",
      check: { primitive: "lines_all", left: { ref: "$line.sequence" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "piece_rate_non_negative_on_enable",
      onTransition: "enable",
      source: "invariant",
      level: "block",
      why: "Piece rate cannot be negative. Enter zero when piece rate is not used",
      check: { primitive: "lines_all", left: { ref: "$line.pieceRate" }, op: "gte", right: { value: 0 } },
    },
    {
      id: "routing_product_makeable_on_enable",
      onTransition: "enable",
      source: "invariant",
      level: "block",
      message: "Only semi-finished goods and finished goods have a routing. Raw materials and packaging are purchased and have no in-house operations to schedule",
      why: "The product's use may have changed before re-enable. A purchased item can no longer be an active routing",
      check: {
        primitive: "ref_field_compare",
        via: "productId",
        entity: "product",
        through: null,
        field: "canProduce",
        op: "eq",
        right: { value: true },
      },
    },
    {
      id: "last_active_routing",
      onTransition: "disable",
      source: "gate",
      level: "warn",
      // The default sentence "routing row count is 1, at least 2 required" is read as "the system requires at least two routings".
      message: "This is the product's last active routing. Keep at least one active routing",
      why: "This may be the product's last active routing. After it is disabled, production orders cannot explode operations",
      check: {
        primitive: "related_agg",
        from: "routing",
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
      columns: ["code", "productId", "version", "processType", "status"],
      filters: ["status", "productId", "processType"],
      searchable: ["code", "version"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Version", fields: ["code", "productId", "version", "processType"] },
      { title: "Operation lines", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
