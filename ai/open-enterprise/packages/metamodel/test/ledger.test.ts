import { afterEach, describe, expect, it } from "vitest";
import {
  assertLedgerCatalog,
  defineLedgers,
  installLedgerCatalog,
  isDefinedLedgers,
  ledgerContract,
  listLedgerCodes,
  normalizeEffect,
} from "../src/index.js";

afterEach(() => {
  installLedgerCatalog(null);
});

const stock = {
  label: "Stock",
  subject: "product",
  scope: "warehouse" as const,
  ops: { in: 1 as const, out: -1 as const },
  measure: "quantity" as const,
  book: "inventory",
};

const catalogRaw = {
  books: ["finance", "inventory"],
  ledgers: {
    stock,
    ar: {
      label: "Receivable",
      subject: "customer",
      scope: null,
      ops: { reserve: 1, release: -1, in: 1, out: -1 },
      measure: "money",
      book: "finance",
    },
  },
};

describe("defineLedgers", () => {
  it("only recipients passing through the entrance", () => {
    const catalog = defineLedgers(catalogRaw);
    expect(isDefinedLedgers(catalog)).toBe(true);
    expect(catalog.books).toEqual(["finance", "inventory"]);
    expect(catalog.ledgers["stock"]?.ops.reserve).toBeUndefined();
    expect(catalog.ledgers["ar"]?.ops.reserve).toBe(1);
    expect(catalog.ledgers["stock"]?.nonNegative).toBe(false);
    expect(catalog.ledgers["ar"]?.nonNegative).toBe(false);
  });

  it("no, no, no, no, no.", () => {
    const catalog = defineLedgers({
      books: ["inventory"],
      ledgers: { stock: { ...stock, nonNegative: true } },
    });
    expect(catalog.ledgers["stock"]?.nonNegative).toBe(true);
    installLedgerCatalog(catalog);
    expect(ledgerContract("stock")).toEqual({ subject: "product", scope: "warehouse", nonNegative: true });

    const omitted = defineLedgers({ books: ["inventory"], ledgers: { stock } });
    expect(omitted.ledgers["stock"]?.nonNegative).toBe(false);
    installLedgerCatalog(omitted);
    expect(ledgerContract("stock").nonNegative).toBe(false);

    const explicitFalse = defineLedgers({
      books: ["inventory"],
      ledgers: { stock: { ...stock, nonNegative: false } },
    });
    expect(explicitFalse.ledgers["stock"]?.nonNegative).toBe(false);
  });

  it("no, no, no.", () => {
    expect(() =>
      defineLedgers({
        books: ["inventory"],
        ledgers: { stock: { ...stock, nonNegative: "true" } },
      }),
    ).toThrow(/must be a boolean/);
  });

  it("empty watch, unknown key, missing scope, unknown op, fifth invent", () => {
    expect(() => defineLedgers({})).toThrow(/must be an array/);
    expect(() => defineLedgers({ books: [], ledgers: { stock } })).toThrow(/books must not be empty/);
    expect(() => defineLedgers({ books: ["inventory"], ledgers: {} })).toThrow(/ledgers must not be empty/);
    expect(() => defineLedgers({ books: ["inventory"], ledgers: { stock }, extra: 1 })).toThrow(/unknown key/);
    expect(() =>
      defineLedgers({
        books: ["inventory"],
        ledgers: { stock: { label: "Stock", subject: "product", ops: { in: 1 }, measure: "quantity", book: "inventory" } },
      }),
    ).toThrow(/scope must/);
    expect(() =>
      defineLedgers({
        books: ["inventory"],
        ledgers: { stock: { ...stock, ops: { invent: 1 } } },
      }),
    ).toThrow(/unknown key|unknown/);
    expect(() =>
      defineLedgers({
        books: ["inventory"],
        ledgers: { stock: { ...stock, ops: { in: 1, out: -1, invent: 1 } } },
      }),
    ).toThrow(/unknown key/);
    expect(() =>
      defineLedgers({
        books: ["inventory"],
        ledgers: { stock: { ...stock, book: "missing" } },
      }),
    ).toThrow(/is not in the books list/);
  });

  it("listLedgerCode / nonmalizeEffect explicitly misst and do not return to kernel", () => {
    installLedgerCatalog(null);
    expect(() => listLedgerCodes()).toThrow(/is not loaded/);
    expect(() =>
      normalizeEffect({ target: "stock", op: "in", subject: "$bill.productId", scope: "$bill.warehouseId", amount: 1 }),
    ).toThrow(/is not loaded/);
  });

  it("load directory and reject unknown target by directory", () => {
    installLedgerCatalog(
      defineLedgers({
        books: ["inventory"],
        ledgers: { stock: { ...stock, subject: "product", scope: null } },
      }),
    );
    expect(listLedgerCodes()).toEqual(["stock"]);
    expect(() =>
      normalizeEffect({ target: "invented", op: "in", subject: "$bill.productId", amount: 1 }),
    ).toThrow(/invented/);
    expect(() =>
      normalizeEffect({ target: "ar", op: "in", subject: "$bill.customerId", amount: 1 }),
    ).toThrow(/unknown/);
  });
});

describe("assertLedgerCatalog", () => {
  const ar = {
    label: "Receivable",
    subject: "customer",
    scope: null,
    ops: { reserve: 1 as const, release: -1 as const, in: 1 as const, out: -1 as const },
    measure: "money" as const,
    book: "finance",
  };

  it("quantity+scope declaration nonnegative release; money declaration rejected", () => {
    const allowed = defineLedgers({
      books: ["inventory", "finance"],
      ledgers: {
        stock: { ...stock, nonNegative: true },
        ar,
      },
    });
    expect(() => assertLedgerCatalog(allowed)).not.toThrow();

    const money = defineLedgers({
      books: ["finance"],
      ledgers: { ar: { ...ar, nonNegative: true } },
    });
    expect(() => assertLedgerCatalog(money)).toThrow(/measure=money/);
  });
});

describe("product Directory", () => {
  it("inventory statement only", () => {
    expect(ledgerContract("stock")).toEqual({ subject: "product", scope: "warehouse", nonNegative: true });
    expect(ledgerContract("ap")).toEqual({ subject: "supplier", scope: null, nonNegative: false });
  });
});
