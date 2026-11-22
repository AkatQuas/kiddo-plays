import { defineDomain } from "@open-erp/metamodel";

export default defineDomain({
  label: "Operations",
  line: { code: "production", label: "Production" },
  moduleSettings: [
    {
      /**
       * Where the piece-rate cell on dispatch gets its starting value.
       *
       * Both sources are real and they can disagree:
       *   · The routing operation rate (`routing.lines.pieceRate`) is what this operation
       *     is worth on this product. It is frozen on the routing when the routing becomes
       *     active, so the same operation can have a different price on another product.
       *   · The operation master rate (`operation.pieceRate`) is the general rate for this operation.
       * Which one is the default is a management decision, so it is a setting.
       *
       * It only affects the starting value. The dispatch cell can still be edited, and the
       * edited value is frozen on the assignment (`processAssignment.pieceRate`). Pay uses
       * that frozen copy. Changing the setting does not rewrite work already dispatched.
       */
      code: "production.pieceRateSource",
      module: "processAssignment",
      label: "Assignment piece-rate source",
      description: "Whether the piece rate in the dispatch dialog defaults to the operation rate frozen on the routing, or to the general rate on the operation master. Either can be edited by hand at dispatch.",
      effectiveWhen: "Dispatch dialogs opened after save use the new source. Work already dispatched keeps the piece rate frozen at that time.",
      defaultOption: "routing",
      options: [
        {
          code: "routing",
          label: "Routing operation piece rate",
          description: "Uses the piece rate of this operation on the routing frozen by this production task. The same operation can have a different price on another product.",
        },
        {
          code: "operation",
          label: "Operation master piece rate",
          description: "Uses the general piece rate on the operation master, and ignores the price this product adjusted on the routing.",
        },
      ],
    },
    {
      code: "production.taskCompletionMode",
      module: "productionTask",
      label: "Production task completion mode",
      description: "The task is completed directly once every operation's qualified quantity reaches the plan and no assignment is still open. Manual confirmation and automatic completion use the same shop-floor rule. This affects only tasks released after the setting is saved.",
      effectiveWhen: "Production tasks released after save use the new choice. Tasks already released keep their completion mode.",
      defaultOption: "manual",
      options: [
        {
          code: "manual",
          label: "Confirm completion manually",
          description: "The task is completed once every operation's qualified quantity reaches the plan. Same rule as automatic completion.",
        },
        {
          code: "automatic",
          label: "Complete automatically",
          description: "The task is completed once every operation's qualified quantity reaches the plan. Same rule as manual confirmation.",
        },
      ],
    },
  ],
});
