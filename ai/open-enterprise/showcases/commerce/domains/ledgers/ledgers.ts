import { defineLedgers } from "@open-erp/metamodel";

/** The commerce showcase shares the manufacturing ledger rules: inventory quantity by warehouse, payables amount by supplier. */
export const ledgers = defineLedgers({
  books: ["finance", "inventory"],
  ledgers: {
    stock: {
      label: "Inventory",
      subject: "product",
      scope: "warehouse",
      ops: { in: 1, out: -1 },
      measure: "quantity",
      book: "inventory",
      nonNegative: true,
    },
    ap: {
      label: "Payables",
      subject: "supplier",
      scope: null,
      ops: { reserve: 1, release: -1, in: 1, out: -1 },
      measure: "money",
      book: "finance",
    },
  },
});
