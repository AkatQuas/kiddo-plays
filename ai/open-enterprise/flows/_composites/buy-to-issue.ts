// ---------------------------------------------------------------------------
// Core path · material supply — when material is short, from purchasing through issue to the shop floor.
//
// This is the supply line for the production path, not a segment of it. It runs only when material is short.
// When stock is already there, the shop floor just issues it, and purchasing should not appear in the demo.
// So this is its own path, not two steps forced into the middle of production.
//
// Purchase receipt posts one inventory entry. Material can be issued only after it is in stock.
// Issue is required here (the point of this path is to get material to the shop floor),
// and optional on the production path (skip it when stock is already there). The same flow is required on one path
// and not on the other. Only the path layer can say that. The flow itself cannot.
// ---------------------------------------------------------------------------

import { defineComposite } from "@open-erp/metamodel";

export default defineComposite({
  label: "Core path · purchase through issue",
  purpose: "When production is short of material: how it is purchased, received, and issued to the shop floor",
  roles: ["buyer", "warehouse-clerk", "production-coordinator", "inventory-manager"],
  links: [
    { flow: "purchase-to-receipt", say: "Place the purchase order and receive it into stock" },
    { flow: "material-issue-return", say: "The shop floor issues material against the production task. What is left comes back" },
  ],
});
