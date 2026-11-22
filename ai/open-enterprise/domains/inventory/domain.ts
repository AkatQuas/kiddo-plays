import { defineDomain } from "@open-erp/metamodel";
import { INVENTORY_UNIT_CHOICE_SET, INVENTORY_UNITS } from "./unitChoices.ts";

export default defineDomain({
  label: "Inventory",
  // Menu order lives on the workspace root navigation.ts, not on the domain.
  choiceSets: [
    {
      code: "inventory.stockInType",
      label: "Stock-in type",
      items: [
        { code: "inventoryGain", label: "Inventory gain" },
        { code: "sampleReturn", label: "Sample return" },
        { code: "productionReceipt", label: "Production completion receipt" },
        { code: "other", label: "Other stock-in" },
      ],
    },
    {
      /**
       * Product category — maintained as a choice set since 3.5.0.
       *
       * It used to be free text (`category: string`). Free text already failed twice in this
       * system (supplier level, order source): one category grows three spellings, then a
       * filter by category never returns the full set, and each row still looks correct on its own.
       *
       * `item.code` is the stable identity that is stored. `label` is only the current display
       * name, so a wording change does not touch existing rows and does not rebuild indexes.
       * That is the shape the requirement "do not rebuild indexes when the wording changes" asks for.
       *
       * Existing databases may still hold free-text values from before the dictionary. They are
       * not in this set, so the list shows them as stored, but the next edit must pick from the
       * dictionary. That is a one-time cleanup cost, written here so it is not treated as a bug.
       */
      code: "inventory.productCategory",
      label: "Product category",
      // Seed values follow the categories this workspace already uses (garment manufacturing),
      // not a generic list invented from scratch. If the first dictionary values do not match
      // existing data, product masters open with every category blank.
      items: [
        { code: "suit", label: "Suit" },
        { code: "fabric", label: "Fabric" },
        { code: "garmentAccessory", label: "Garment accessory" },
        { code: "interlining", label: "Interlining" },
        { code: "lining", label: "Lining" },
        { code: "cutPiece", label: "Cut piece" },
        { code: "packaging", label: "Packaging" },
        { code: "other", label: "Other" },
      ],
    },
    {
      /**
       * Primary and auxiliary units — maintained as a choice set since 3.5.0.
       *
       * `code` is the stored identity. `label` is the on-screen wording. Do not use the display
       * name as the code: operators may rename a unit, and that rename must not invalidate the
       * unit identity on stock, receipts, issues, and historical documents.
       *
       * Existing Chinese unit values were rewritten to these stable codes by a migration.
       * Downstream `unitChoice` displays the English label from this dictionary.
       */
      code: INVENTORY_UNIT_CHOICE_SET,
      label: "Unit of measure",
      items: [...INVENTORY_UNITS],
    },
    {
      code: "inventory.stockOutType",
      label: "Stock-out type",
      items: [
        { code: "inventoryLoss", label: "Inventory loss" },
        { code: "scrap", label: "Scrap" },
        { code: "sampleLoan", label: "Sample loan" },
        { code: "other", label: "Other stock-out" },
      ],
    },
  ],
});
