import { defineDomain } from "@open-erp/metamodel";

export default defineDomain({
  label: "Sales",
  choiceSets: [
    {
      code: "sales.orderSource",
      label: "Order source",
      items: [
        { code: "retail", label: "Retail" },
        { code: "b2b", label: "B2B" },
        { code: "export", label: "Export" },
        { code: "afterSales", label: "After-sales" },
        { code: "trial", label: "Trial" },
      ],
    },
    {
      code: "sales.customerServicePriority",
      label: "Customer service priority",
      items: [
        { code: "normal", label: "Normal" },
        { code: "key", label: "Key" },
        { code: "urgent", label: "Urgent" },
      ],
    },
    {
      // There is no separate finance domain yet. Sales owns the declaration, and procurement payments reuse the same code.
      code: "sales.paymentMethod",
      label: "Payment method",
      items: [
        { code: "bankTransfer", label: "Bank transfer" },
        { code: "bankAcceptance", label: "Bank acceptance" },
        { code: "cash", label: "Cash" },
        { code: "other", label: "Other" },
      ],
    },
  ],
  moduleSettings: [
    {
      /**
       * Accounting mode for a receivable bill.
       *
       * Ledger: one receivable amount on the whole bill. Lines only trace the source.
       * Detail: one receivable amount per sales order. The sum equals the bill total.
       *
       * Before changing this, confirm there is no open sales order. Non-terminal orders
       * come from the sales-order lifecycle. Bills already created keep the mode frozen
       * at creation and ignore this setting.
       */
      code: "sales.accountingType",
      module: "receivableBill",
      label: "Receivable accounting mode",
      description: "Controls whether a new receivable bill uses ledger mode (one amount for the whole bill) or detail mode (allocated per sales order). Existing bills are unchanged.",
      effectiveWhen: "Receivable bills created after save use the new mode. Bills already created keep the mode they were created with.",
      changeGuard: { kind: "noOpenBills", module: "salesOrder" },
      defaultOption: "ledger",
      options: [
        {
          code: "ledger",
          label: "Ledger",
          description: "Enter one receivable amount for the whole bill. Lines only trace the source.",
        },
        {
          code: "detail",
          label: "Detail",
          description: "Enter a receivable amount for each linked sales order. The sum is the bill total.",
        },
      ],
    },
  ],
});
