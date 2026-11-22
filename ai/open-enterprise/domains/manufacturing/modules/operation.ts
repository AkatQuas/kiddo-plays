import { defineModule, singleState } from "@open-erp/metamodel";

/** Operation definition. Routing lines cite the pricing defaults here and override them for the product's actual process. */
export default defineModule({
  label: "Operations",
  numbering: { prefix: "OPER", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Operation code", type: "string", primary: true, auto: true },
    // An operation appears on a routing by name ("turn the outside diameter", "finish grind").
    // Two operations with the same name make the maintainer pick one at random, and their
    // rates may differ. The wage slip that comes out still looks completely normal.
    { key: "name", label: "Operation name", type: "string", required: true, unique: true },
    { key: "alias", label: "Operation alias", type: "string" },
    // Pricing is optional. The default team and the assignment ratio must be set when the operation master is maintained, for the routing and for dispatch.
    { key: "pieceRate", label: "Piece rate (per product main unit)", type: "money", help: "The wage for one main unit of qualified quantity. Quantity in an auxiliary unit must be converted to the main unit before pricing" },
    { key: "hourlyRate", label: "Hourly price (per hour)", type: "money", help: "How much one hour pays. The system prices only by the hour. Convert a per-minute or per-day rate to a per-hour price before entering it" },
    /**
     * 3.5.x: the time basis is closed down to "hour" only, and it changed from optional to required.
     *
     * This cell used to offer minute / hour / day. The conversion factor has no place in the
     * model (an expression node is only field / value / op / orElse, with no conditional form
     * and nowhere to hold an enum-to-factor map). Only one of the three options could settle
     * a wage. The other two were inert values: the master saved fine, and "Settle" at month
     * end was blocked by `hourly_rate_unit_supported`, after hundreds of work reports were
     * already entered. An option that can never be chosen is worse than no option. It looks supported.
     *
     * Making it required is the load-bearing part of this change, not a casual tightening.
     * Left optional, an empty value is snapshotted all the way into the routing, the assignment,
     * and the work report. `compare()` on `eq` treats one side empty and the other not as
     * not equal. Empty does not pass. It blocks. In one production dataset, 86 of 112 approved work reports
     * had an empty time unit. None of them could settle a wage, and the work-report screen
     * never mentioned "time unit" anywhere. Once it is required, the source is guaranteed
     * non-empty, the five snapshot columns become NOT NULL together, and this kind of empty
     * value can no longer be stored (historical empties are corrected once by data migration).
     *
     * To bring minute / day back, expression nodes must be able to express an enum-to-factor
     * map first, and then this options list and the wage gate must open together. Opening
     * only one side puts the inert value back.
     */
    {
      key: "hourlyRateUnit",
      label: "Hourly-rate unit",
      type: "enum",
      options: ["Per hour"],
      required: true,
      help: "Wages in this release are calculated by the hour. If the rate was agreed per minute or per day, convert it to a per-hour price in the field above",
    },
    {
      key: "standardTimePerPiece",
      label: "Default time per piece",
      type: "number",
      help: "How long one main unit takes. Used for scheduling and performance hours. Once it is on a routing, that value is frozen on the routing line",
    },
    {
      key: "standardTimeUnit",
      label: "Time-per-piece unit",
      type: "enum",
      options: ["Per minute", "Per hour", "Per day"],
      help: "Unit of measure for the default time per piece",
    },
    /**
     * Which equipment or mold this operation needs (3.5.0).
     *
     * What is stored is the type, not one machine. The process says "this operation is done
     * on sewing equipment". Which sewing machine it is assigned to today is decided at
     * scheduling (the production task's line-occupancy lines pick the equipment). Writing a
     * specific machine into the operation master means every process that cites it dies when that machine goes in for repair.
     *
     * The type shares one dictionary with the equipment master and the mold master
     * (`manufacturing.equipmentType` / `manufacturing.moldType`). Free text written separately
     * lets "sewing equipment" and "stitching equipment" both exist, and a filter by type never finds all of them.
     */
    {
      key: "equipmentType",
      label: "Equipment type",
      type: "enum",
      choiceSet: "manufacturing.equipmentType",
      help: "Which class of equipment this operation needs. Blank means equipment cannot be chosen when scheduling. Filled means only in-use equipment of that class",
    },
    {
      key: "moldType",
      label: "Mold type",
      type: "enum",
      choiceSet: "manufacturing.moldType",
      help: "Which class of mold this operation needs. Blank means a mold cannot be chosen when scheduling. Filled means only an in-use mold of that class",
    },
    {
      key: "defaultTeamId",
      label: "Default team",
      type: "ref",
      ref: "orgUnit",
      // A new operation must have a default team. Existing operations have no trustworthy source to backfill, so the column stays nullable.
      requiredOnManualCreate: true,
      refFilter: { orgType: "team" },
    },
    { key: "requiresApproval", label: "Needs approval", type: "bool", required: true },
    {
      key: "assignmentRatio",
      label: "1:1 assignment ratio",
      type: "number",
      // A new operation must have a ratio. Existing empty values are not rewritten with a made-up number.
      requiredOnManualCreate: true,
      help: "The ratio between what this operation produces and the target product. If one operation output is one finished good, keep the assignment ratio at 1:1",
    },
    // Three levels are not wording, and a bool cannot say them. "Optional subcontract" is
    // sent out only when capacity is short (in-house by default). "Full subcontract" means
    // this operation has no in-house capability (plating, heat treatment), so scheduling must
    // create a subcontract order directly instead of an assignment. Folding both into one
    // true leaves "can this operation be assigned to our own team?" unanswerable.
    // The consumer is the subcontract domain: `subcontractOrder.lines.outsourcingMode` looks
    // this field up, and the `operations_allow_outsourcing` gate uses it to decide whether the operation can go to a supplier.
    {
      key: "outsourcingMode",
      label: "Operation subcontract",
      type: "enum",
      options: ["No subcontract", "Optional subcontract", "Full subcontract"],
      required: true,
      help: "No subcontract means in-house only. Optional subcontract means in-house by default, and it can be sent out when capacity is short. Full subcontract means there is no in-house capability, so scheduling creates a subcontract order directly",
    },
    {
      key: "workInstruction",
      label: "Work instruction",
      type: "text",
      help: "Written for the operator, and shown on the work-report screen. It is not remark, which is written by a maintainer for a maintainer",
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: singleState("active", "Active", "green"),

  views: {
    list: {
      columns: ["code", "name", "alias", "equipmentType", "moldType", "pieceRate", "hourlyRate", "hourlyRateUnit", "defaultTeamId", "assignmentRatio", "outsourcingMode"],
      // primary is still code (the tenant-unique number). A reference cell shows the name, not the code or the id.
      referenceLabel: ["name"],
      filters: ["requiresApproval", "outsourcingMode", "defaultTeamId", "equipmentType", "moldType"],
      searchable: ["code", "name", "alias"],
      defaultSort: { field: "createdAt", desc: true },
      hideStatus: true,
    },
    form: [
      { title: "Operation", fields: ["code", "name", "alias", "defaultTeamId", "assignmentRatio"] },
      { title: "Pricing", fields: ["pieceRate", "hourlyRate", "hourlyRateUnit", "standardTimePerPiece", "standardTimeUnit"] },
      { title: "Production requirements", fields: ["requiresApproval", "outsourcingMode", "equipmentType", "moldType"] },
      { title: "Work instruction", fields: ["workInstruction"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
