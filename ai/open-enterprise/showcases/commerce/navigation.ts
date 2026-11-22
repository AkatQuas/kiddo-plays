import { defineNavigation } from "@open-erp/metamodel";

export default defineNavigation({
  groups: [
    {
      code: "master",
      label: "Products and parties",
      items: [
        { module: "product" },
        { module: "warehouse" },
        { module: "supplier" },
        { module: "customer" },
      ],
    },
    {
      code: "stock",
      label: "Stock movement",
      items: [
        { module: "goodsReceipt" },
        { module: "shipment" },
      ],
    },
  ],
});
