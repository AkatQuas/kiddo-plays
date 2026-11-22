import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Goods receipt",
  numbering: { prefix: "IN", seqScope: "day" },
  fields: [
    { key: "code", label: "Receipt no.", type: "string", primary: true, auto: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    { key: "warehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse", required: true },
    {
      key: "lines",
      label: "Receipt lines",
      type: "subtable",
      ref: "goodsReceiptLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "quantity", label: "Quantity", type: "number", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "pending", label: "awaitingInbound", color: "amber", initial: true },
      { key: "received", label: "Received", color: "green", editable: "none" },
      { key: "voided", label: "voided", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "receive",
        from: "pending",
        to: "received",
        action: "Confirm receipt",
        primary: true,
        effects: [
          {
            target: "stock",
            op: "in",
            subject: "$line.productId",
            scope: "$bill.warehouseId",
            amount: "{$line.quantity}",
            reverseOn: ["void"],
          },
        ],
      },
      { code: "void", from: "received", to: "voided", action: "Void", confirm: true },
    ],
  },
  views: {
    list: { columns: ["code", "supplierId", "warehouseId"], searchable: ["code"] },
    form: [{ title: "Receipt", fields: ["code", "supplierId", "warehouseId", "lines"] }],
  },
});
