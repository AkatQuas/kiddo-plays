import { defineModule } from "@open-erp/metamodel";
import { PRODUCT_TYPES } from "../productTypes.ts";
import { INVENTORY_UNIT_CHOICE_SET } from "../unitChoices.ts";

export default defineModule({
  label: "Product master",
  // Custom fields are open to the tenant: this table gains a `custom jsonb` column and a GIN index.
  // This chain (product → sales order → production order → production task → dispatch / delivery)
  // is where industry-specific fields most often need to pass through, so it is opened first.
  // To open another table, add the same line and ship it.
  customFields: true,
  // The product code is suggested by the platform and may still be edited. Uniqueness is still
  // backed by the primary key and the database unique constraint.
  numbering: { prefix: "HPDA", seqScope: "day" },
  fields: [
    // Product code: required. The form shows a suggested value the user may change. On save it is an ordinary writable field.
    { key: "code", label: "Product code", type: "string", primary: true, required: true },
    { key: "name", label: "Product name", type: "string", required: true },
    { key: "productType", label: "Product type", type: "enum", options: PRODUCT_TYPES, required: true },
    // 3.5.0: free text was closed into the choice set `inventory.productCategory`. See domain.ts.
    { key: "category", label: "Product category", type: "enum", choiceSet: "inventory.productCategory" },
    { key: "mainUnit", label: "Primary unit", type: "enum", choiceSet: INVENTORY_UNIT_CHOICE_SET, required: true },
    { key: "auxUnit", label: "Auxiliary unit", type: "enum", choiceSet: INVENTORY_UNIT_CHOICE_SET },
    { key: "conversionRate", label: "Conversion rate", type: "number" },
    { key: "defaultWarehouseId", label: "Default warehouse", type: "ref", ref: "warehouse" },
    { key: "remark", label: "Remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      { key: "active", label: "Active", color: "green", initial: true, editable: "whitelist", editableFields: ["code", "name", "productType", "category", "mainUnit", "auxUnit", "conversionRate", "defaultWarehouseId", "remark"] },
      { key: "disabled", label: "Disabled", color: "gray", editable: "whitelist", editableFields: ["name", "productType", "category", "mainUnit", "auxUnit", "conversionRate", "defaultWarehouseId", "remark"] },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Enable again" },
    ],
  },
  preconditions: [],
  views: {
    list: {
      columns: ["code", "name", "productType", "category", "mainUnit"],
      filters: ["productType", "category"],
      searchable: ["code", "name"],
      // 3.5.0: default sort is created time, newest first.
      // It used to be updatedAt, so an old product whose remarks were edited once floated above a product just created.
      defaultSort: { field: "createdAt", desc: true },
      hideStatus: true,
    },
    composite: {
      child: "product",
      parentField: "productFamilyId",
      commands: {
        childInherits: {
          // Fields inherited from the parent. The test is: same name and type on the child, not a primary key,
          // not a system column, and not in `own`.
          // `name` is required on the SKU. Omitting it fails create with REQUIRED_BLANK.
          inherit: [
            "name",
            "productType",
            "category",
            "mainUnit",
            "auxUnit",
            "conversionRate",
            "defaultWarehouseId",
          ],
          // Parent fields that cannot change once a child exists.
          frozen: ["mainUnit", "auxUnit", "conversionRate"],
          // Fields that belong only to the child.
          own: ["spec", "barcode", "safetyStockQty", "remark", "imageUrl"],
        },
        generators: {
          // Barcode: empty, cleared, or the placeholder sent back unchanged → generate `PA-<20 chars>`.
          barcode: {
            strategy: "uuid",
            prefix: "PA-",
            placeholder: "Generated on save",
          },
        },
        validations: [
          // Auxiliary unit and conversion rate must both be filled or both be empty.
          {
            rule: "requireTogether",
            fields: ["auxUnit", "conversionRate"],
            message: "Auxiliary unit and conversion rate must both be filled or both be left empty",
          },
          // Product code format.
          {
            rule: "pattern",
            field: "code",
            pattern: "^[A-Za-z0-9-]{2,64}$",
            message: "Product code may contain only letters, digits, and hyphens, and must be at least 2 characters",
          },
          // Child spec uniqueness.
          {
            rule: "uniqueChild",
            field: "spec",
            message: "Product spec cannot repeat under the same product master",
          },
        ],
        saveOptions: {
          minChildren: 1,
        },
      },
    },
    form: [
      { title: "Product", fields: ["code", "name", "productType", "category", "mainUnit", "auxUnit", "conversionRate", "defaultWarehouseId"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
