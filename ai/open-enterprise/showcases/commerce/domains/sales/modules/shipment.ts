import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Sales shipment",
  numbering: { prefix: "OUT", seqScope: "day" },
  fields: [
    { key: "code", label: "Shipment no.", type: "string", primary: true, auto: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    { key: "warehouseId", label: "Shipping warehouse", type: "ref", ref: "warehouse", required: true },
    {
      key: "lines",
      label: "Shipment lines",
      type: "subtable",
      ref: "shipmentLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "quantity", label: "Quantity", type: "number", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "pending", label: "awaitingShipment", color: "amber", initial: true },
      { key: "shipped", label: "shipped", color: "green", editable: "none" },
      { key: "voided", label: "voided", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "ship",
        from: "pending",
        to: "shipped",
        action: "Confirm shipment",
        primary: true,
        effects: [
          {
            target: "stock",
            op: "out",
            subject: "$line.productId",
            scope: "$bill.warehouseId",
            amount: "{$line.quantity}",
            reverseOn: ["void"],
          },
        ],
      },
      { code: "void", from: "shipped", to: "voided", action: "Void", confirm: true },
    ],
  },
  views: {
    list: { columns: ["code", "customerId", "warehouseId"], searchable: ["code"] },
    form: [{ title: "Shipment", fields: ["code", "customerId", "warehouseId", "lines"] }],
  },
});
