import { defineNavigation } from "@open-erp/metamodel";

/**
 * Business grouping source. The sidebar, the permission tree, the data-scope tree, and `/api/navigation` all project from here.
 * Order inside a group follows the PC 3.5.0 menu. Hidden items sit at the end of the group.
 */
export default defineNavigation({
  groups: [
    {
      code: "master",
      label: "Master data",
      items: [
        { module: "customer" },
        { module: "supplier" },
        { module: "productFamily" },
        { module: "orgUnit" },
        { module: "worker" },
        { module: "subject", hidden: true },
        { module: "bom" },
        { module: "operation" },
        { module: "routing" },
        { module: "equipment" },
        { module: "mold" },
        { module: "warehouse" },
        { module: "defectType" },
        { module: "product", hidden: true },
      ],
    },
    {
      code: "sales",
      label: "Sales",
      items: [
        { module: "salesOrder" },
        { module: "receivableBill" },
        { module: "receivableReceipt" },
        { module: "salesInvoice" },
      ],
    },
    {
      code: "purchase",
      label: "Procurement",
      items: [
        { module: "purchasePlan" },
        { module: "purchaseOrder" },
        { module: "purchaseReceipt" },
        { module: "purchaseReturn" },
        { module: "purchasePayable" },
        { module: "purchaseInvoice" },
        { module: "purchasePayment" },
      ],
    },
    {
      code: "outsourcing",
      label: "Subcontracting",
      items: [
        { module: "subcontractOrder" },
        { module: "subcontractIssue" },
        { module: "subcontractReceipt" },
        { module: "subcontractReturn" },
        { module: "subcontractMaterialReturn" },
      ],
    },
    {
      code: "production",
      label: "Production",
      groups: [
        {
          code: "production-make",
          label: "Manufacturing",
          items: [
            { module: "productionOrder" },
            { module: "productionTask" },
            { module: "processAssignment" },
            { module: "processReport" },
          ],
        },
        {
          code: "production-material",
          label: "Materials and finished goods",
          items: [
            { module: "materialRequirement" },
            { module: "materialIssue" },
            { module: "materialReturn" },
            { module: "productionReceipt" },
          ],
        },
      ],
    },
    {
      code: "inventory",
      label: "Inventory",
      items: [
        { module: "stockIn" },
        { module: "stockOut" },
        { module: "salesDelivery" },
      ],
    },
    {
      code: "report",
      label: "Reports",
      items: [
        { surface: "production-report" },
        { module: "performanceSettlement" },
        { surface: "delivery-report" },
        { surface: "stock-query" },
        { module: "dailyReport" },
      ],
    },
  ],
});
