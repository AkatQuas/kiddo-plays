import { defineDomain } from "@open-erp/metamodel";

export default defineDomain({
  label: "Order management",
  line: { code: "production", label: "Production" },
  // These two dictionaries have no caller. The only module that used them, the production
  // cost sheet, was removed with the menu-less entry cleanup.
  // Keeping them is required: `packages/builder/src/choiceSetIdentities.ts` says a product
  // dictionary cannot be deleted, and a published identity must keep being declared in TS
  // (both are already in `domains/choice-set-identities.json`). A tenant may already have
  // changed the codes. Deleting them would drop that configuration.
  choiceSets: [
    {
      code: "production.unitCostSource",
      label: "Unit cost source",
      items: [
        { code: "movingAverage", label: "Purchase moving weighted average" },
        { code: "standardPrice", label: "Product standard price" },
        { code: "subcontractSettlement", label: "Subcontract settlement price" },
        { code: "manual", label: "Manual valuation" },
      ],
    },
    {
      code: "production.operatingCostType",
      label: "Operating cost type",
      items: [
        { code: "rent", label: "Rent" },
        { code: "utilities", label: "Utilities" },
        { code: "labor", label: "Labor" },
        { code: "other", label: "Other issue" },
      ],
    },
  ],
});
