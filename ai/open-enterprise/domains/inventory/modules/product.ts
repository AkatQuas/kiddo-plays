import { defineModule } from "@open-erp/metamodel";
import { PRODUCT_TYPES } from "../productTypes.ts";
import { INVENTORY_UNIT_CHOICE_SET } from "../unitChoices.ts";

/**
 * SKU master.
 *
 * Each product row is one SKU that can be purchased, sold, produced, and stocked on its own.
 * The product master only classifies. Spec, barcode, unit of measure, and business use all sit
 * on the SKU header. Stock effects still cite productId, so the existing sales, purchasing, BOM,
 * production, and inventory chains keep the same stable subject without a line-level effect subject.
 */
export default defineModule({
  label: "SKU",
  // Custom fields are open to the tenant: this table gains a `custom jsonb` column and a GIN index.
  // This chain (product → sales order → production order → production task → dispatch / delivery)
  // is where industry-specific fields most often need to pass through, so it is opened first.
  // To open another table, add the same line and ship it.
  customFields: true,
  numbering: { prefix: "SKU", seqScope: "day" },
  unitSet: { main: "mainUnit", auxiliary: "auxUnit", conversionRate: "conversionRate" },
  fields: [
    /**
     * Platform daily serial (`SKU-20260910-0002`).
     *
     * This is not the product code. That name belongs to `familyCode` below — the number the
     * business already quotes outside the system (`HPDA-20260910-0010`), and the cell labeled
     * "Product code" on the product master. Two columns with the same name put two "Product code"
     * columns side by side on the list, and a person has to guess which one to quote to a customer.
     * The model has the same problem: pick the wrong cell in a projection and the code in the
     * answer does not exist in the other system.
     */
    { key: "code", label: "SKU serial", type: "string", primary: true, auto: true },
    {
      key: "productFamilyId",
      label: "Product master",
      type: "ref",
      ref: "productFamily",
      required: true,
      refFilter: { status: "active" },
    },
    { key: "name", label: "Product name", type: "string", required: true },
    /**
     * Product code — the one on the product master (filled by hand since 3.5.0, the number the
     * business quotes outside, such as `MJ-0012`).
     *
     * `code` (SKU serial) is a different thing. The serial is issued by the platform by day
     * (`SKU-20260803-0001`). The product code is the number the business was already using.
     * When someone picks a product they quote the product code, so it must be in `referenceLabel`
     * and `searchable`. Without that, a customer calls with the product code and the dropdown finds nothing.
     *
     * Use `lookup`, not a snapshot. If the product code changes, the SKU display should follow.
     * It is the code of the same thing, not a historical fact frozen on this SKU.
     */
    {
      key: "familyCode",
      label: "Product code",
      type: "string",
      derive: { kind: "lookup", from: "productFamily", match: "productFamilyId", field: "code" },
    },
    { key: "spec", label: "Spec", type: "string", required: true },
    { key: "barcode", label: "Barcode", type: "string", unique: true, help: "Optional. Inside one tenant, one barcode maps to one SKU" },
    {
      key: "productType",
      label: "Product type",
      type: "enum",
      options: PRODUCT_TYPES,
      required: true,
      help: "Finished goods, semi-finished goods, raw material, or packaging. Whether it can be purchased, sold, or produced is decided by the three flags below",
    },
    // 3.5.0: free text was closed into the choice set `inventory.productCategory`. See domain.ts.
    { key: "category", label: "Product category", type: "enum", choiceSet: "inventory.productCategory" },
    {
      key: "canPurchase",
      label: "Can purchase",
      type: "bool",
      hidden: true,
      createDefaultBy: { field: "productType", values: { finished: false, semiFinished: false, rawMaterial: true, packaging: true } },
    },
    {
      key: "canSell",
      label: "Can sell",
      type: "bool",
      hidden: true,
      createDefaultBy: { field: "productType", values: { finished: true, semiFinished: true, rawMaterial: false, packaging: false } },
    },
    {
      key: "canProduce",
      label: "Can produce",
      type: "bool",
      hidden: true,
      createDefaultBy: { field: "productType", values: { finished: true, semiFinished: true, rawMaterial: false, packaging: false } },
    },
    { key: "mainUnit", label: "Primary unit", type: "enum", choiceSet: INVENTORY_UNIT_CHOICE_SET, required: true },
    { key: "auxUnit", label: "Auxiliary unit", type: "enum", choiceSet: INVENTORY_UNIT_CHOICE_SET, help: "Optional. Fill it together with the conversion rate, or leave both empty" },
    { key: "conversionRate", label: "Conversion rate", type: "number", help: "1 auxiliary unit = N primary units" },
    { key: "defaultWarehouseId", label: "Default warehouse", type: "ref", ref: "warehouse" },
    { key: "imageUrl", label: "Image", type: "attachment" },
    // Blank is not 0. 0 means "not one short is allowed". Blank means "this spec is not warned".
    // Validation and the query surface treat those as different. Do not collapse them.
    {
      key: "safetyStockQty",
      label: "Safety stock",
      type: "number",
      help: "A stock warning fires when the cross-warehouse total is at or below this quantity. Blank means this product is not warned",
    },
    { key: "unitPrice", label: "Piece rate", type: "money", help: "Used for piece-rate pay" },
    { key: "customProduction", label: "Make to order", type: "bool" },
    { key: "inStockProduction", label: "Make to stock", type: "bool" },
    { key: "remark", label: "Remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      {
        key: "active",
        label: "Active",
        color: "green",
        initial: true,
        editable: "whitelist",
        editableFields: [
          "productFamilyId", "name", "spec", "barcode", "productType", "category",
          "defaultWarehouseId", "imageUrl", "safetyStockQty", "unitPrice", "customProduction",
          "inStockProduction", "remark",
        ],
      },
      { key: "disabled", label: "Disabled", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Enable again" },
    ],
  },
  preconditions: [
    {
      id: "enable_family_active",
      onTransition: "enable",
      source: "code",
      level: "block",
      why: "After the product master is disabled, its SKUs cannot be enabled on their own. Otherwise the parent stays locked while a child can still be referenced downstream",
      message: "The product master is still disabled, so this SKU cannot be enabled on its own. Enable the product master first, then enable the SKU",
      check: {
        primitive: "ref_field_compare",
        via: "productFamilyId",
        entity: "productFamily",
        through: null,
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    },
  ],
  views: {
    list: {
      // The first list column is the product code (the number the business quotes), not the platform serial.
      // The serial does not appear anywhere on the product-master page. Putting it first makes people treat it
      // as the code to quote to a customer. It stays searchable and projectable. It just does not take a list column.
      columns: ["familyCode", "name", "spec", "barcode", "productType", "category", "mainUnit", "defaultWarehouseId"],
      /**
       * The product picker must distinguish specs of the same style at a glance.
       * It used to be "SKU number, name, spec", so "navy suit 170/92A" and "navy suit 175/96A"
       * were clipped to the same text in a narrow dropdown and a wrong pick was invisible.
       * Product code plus spec and barcode make the four segments unique on any screen.
       * The kernel allows four cells. The unit stays off the label; the line already has its own unit column.
       */
      referenceLabel: ["name", "familyCode", "spec", "barcode"],
      filters: ["productType", "category"],
      searchable: ["code", "familyCode", "name", "spec", "barcode"],
      defaultSort: { field: "createdAt", desc: true },
      hideStatus: true,
    },
    form: [
      { title: "SKU", fields: ["spec", "barcode", "mainUnit", "remark"] },
    ],
  },
});
