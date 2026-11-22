import { assertLedgerCatalog, defineLedgers } from "@open-erp/metamodel";

/**
 * Product ledger catalog. Two ledgers, each with a period sub-ledger.
 * The old receivable ledger `ar` left with the old chain.
 * Cash and general-ledger catalogs left with the funding-account capability
 * (`subject` used to be the removed `account` ledger).
 * defineLedgers only checks shape. The assertions below run when this file loads.
 * Fixture catalogs must not copy them. This catalog does not add stock.reserve.
 * Adding a ledger still needs no DDL: the ledger name is a column value.
 */
export const ledgers = defineLedgers({
  books: ["finance", "inventory"],
  ledgers: {
    stock: {
      label: "Stock",
      subject: "product",
      scope: "warehouse",
      ops: { in: 1, out: -1 },
      measure: "quantity",
      book: "inventory",
      nonNegative: true,
    },
    ap: {
      label: "Accounts payable",
      subject: "supplier",
      scope: null,
      ops: { reserve: 1, release: -1, in: 1, out: -1 },
      measure: "money",
      book: "finance",
    },
  },
});
assertLedgerCatalog(ledgers);
