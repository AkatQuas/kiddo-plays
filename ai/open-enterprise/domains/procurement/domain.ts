import { defineDomain } from "@open-erp/metamodel";

export default defineDomain({
  label: "Procurement",
  choiceSets: [
    {
      code: "procurement.supplierLevel",
      label: "Supplier level",
      items: [
        { code: "strategic", label: "Strategic" },
        { code: "preferred", label: "Preferred" },
        { code: "standard", label: "Standard" },
        { code: "eliminated", label: "Eliminated" },
      ],
    },
  ],
  moduleSettings: [
    {
      /**
       * Accounting mode for the purchase payable statement.
       *
       * Total: the whole payable carries one amount and is not tied to specific purchase-order lines.
       * Detail: each linked purchase order gets its own payable amount, and the lines sum to the payable total.
       *
       * Before changing this, confirm there is no purchase order still open. "Open" is derived from the
       * purchase-order lifecycle. Documents already created keep the mode frozen at creation and ignore this setting.
       */
      code: "procurement.accountingMode",
      module: "purchasePayable",
      label: "Purchase payable accounting mode",
      description: "Controls whether a new purchase payable uses total mode (one amount for the document) or detail mode (an amount per linked purchase order). Existing documents are unchanged.",
      effectiveWhen: "Payables created after save use the new mode. Documents already created keep the mode they were created with.",
      changeGuard: { kind: "noOpenBills", module: "purchaseOrder" },
      defaultOption: "total",
      options: [
        {
          code: "total",
          label: "Total",
          description: "Enter one payable amount for the whole document, without splitting it across purchase orders.",
        },
        {
          code: "detail",
          label: "Detail",
          description: "Enter a payable amount for each linked purchase order. The lines sum to the payable total.",
        },
      ],
    },
  ],
});
