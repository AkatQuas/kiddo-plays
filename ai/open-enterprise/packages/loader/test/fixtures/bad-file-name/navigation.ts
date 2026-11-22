import { defineNavigation } from "@open-erp/metamodel";

export default defineNavigation({
  groups: [
    {
      code: "fixture",
      label: "fixture",
      items: [
        { module: "alphaBeta", hidden: true },
      ],
    },
  ],
});
