// ---------------------------------------------------------------------------
// Ledger catalog — the mechanism of the ledger catalog (L1)
//
// This is not a seventh concept, and it is not a module / surface / insight: no table of its own, no state machine.
// It is the declaration entry for "which ledgers exist, which ops each allows, what the signs are, and whose head they hang on".
// The product catalog lives in `domains/ledgers/` (L2); module `effects` declarations (L3) are not edited here.
//
// Zero IO. Loading and the cross-module existence gate live in the loader; this file only establishes shape and the credential.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireArray,
  requireCoordinateSegment,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import { EFFECT_OPS, type EffectOp, type EffectTarget } from "../schema/effects.js";
import { type PeriodBook } from "../schema/period.js";

export const LEDGER_MEASURES = ["quantity", "money"] as const;
export type LedgerMeasure = (typeof LEDGER_MEASURES)[number];

export interface LedgerDefinition {
  readonly code: string;
  readonly label: string;
  readonly subject: string;
  readonly scope: string | null;
  readonly ops: Readonly<Partial<Record<EffectOp, 1 | -1>>>;
  readonly measure: LedgerMeasure;
  readonly book: string;
  /** After posting, the balance at this coordinate must not go negative. Default / false = do not block. Policy is written on the contract; the framework only executes the attribute. */
  readonly nonNegative: boolean;
}

export interface LedgerCatalog {
  readonly books: readonly string[];
  readonly ledgers: Readonly<Record<string, LedgerDefinition>>;
}

/** The loader does not guess from function shape whether the registry passed through the kernel entry. */
export const DEFINED_LEDGERS_BY_KERNEL = Symbol.for("open-erp.definedLedgers");

const LEDGER_DEF_KEYS = ["label", "subject", "scope", "ops", "measure", "book", "nonNegative"] as const;
const LEDGER_CATALOG_KEYS = ["books", "ledgers"] as const;

let activeLedgerCatalog: LedgerCatalog | null = null;

/**
 * Request-level override. `undefined` means we are not inside an engine instance, so fall back to the process default catalog.
 * `null` means this instance explicitly has no ledgers. The loader uses it to keep multiple domain sets apart.
 */
let ledgerCatalogOverlay: (() => LedgerCatalog | null | undefined) | null = null;

export function installLedgerCatalog(catalog: LedgerCatalog | null): void {
  activeLedgerCatalog = catalog;
}

export function bindLedgerCatalogOverlay(
  read: (() => LedgerCatalog | null | undefined) | null,
): void {
  ledgerCatalogOverlay = read;
}

function currentLedgerCatalog(): LedgerCatalog | null {
  if (ledgerCatalogOverlay) {
    const scoped = ledgerCatalogOverlay();
    if (scoped !== undefined) return scoped;
  }
  return activeLedgerCatalog;
}

export function peekLedgerCatalog(): LedgerCatalog | null {
  return currentLedgerCatalog();
}

export function catalogHasLedgers(catalog: LedgerCatalog | null | undefined): catalog is LedgerCatalog {
  return catalog !== null && catalog !== undefined && Object.keys(catalog.ledgers).length > 0;
}

function requireLedgerCatalog(): LedgerCatalog {
  const catalog = currentLedgerCatalog();
  if (catalog === null) {
    schemaFail("ledger catalog is not loaded yet: call activateLedgerCatalog / installLedgerCatalog first (the product catalog is in domains/ledgers)");
  }
  return catalog;
}

/** Ledger code list. Only the loaded catalog counts; an unloaded catalog fails explicitly. */
export function listLedgerCodes(): readonly EffectTarget[] {
  return Object.keys(requireLedgerCatalog().ledgers);
}

/** Period-book list. Only the loaded catalog counts. */
export function listPeriodBooks(): readonly PeriodBook[] {
  return requireLedgerCatalog().books as PeriodBook[];
}

export function ledgerDefinitionOf(target: string): LedgerDefinition {
  const catalog = requireLedgerCatalog();
  const def = catalog.ledgers[target];
  if (def === undefined) {
    schemaFail(`unknown posting target "${target}"; choices: ${Object.keys(catalog.ledgers).join(" / ")}`);
  }
  return def;
}

/**
 * The inventory ledger that carries a warehouse dimension. Inventory reports and the availability panel use this one; callers do not hard-code a ledger code.
 * The catalog must contain exactly one ledger with `measure=quantity` and `scope !== null`.
 */
export function inventoryLedgerDefinition(): LedgerDefinition {
  const matches = Object.values(requireLedgerCatalog().ledgers).filter(
    (def) => def.measure === "quantity" && def.scope !== null,
  );
  if (matches.length !== 1) {
    schemaFail(
      `the inventory read model needs exactly one quantity ledger with a warehouse dimension (measure=quantity and a non-null scope); the catalog has ${String(matches.length)}`,
    );
  }
  const only = matches[0];
  if (only === undefined || only.scope === null) {
    schemaFail("the inventory read model needs exactly one quantity ledger with a warehouse dimension");
  }
  return only;
}

export function ledgerContract(target: string): {
  readonly subject: string;
  readonly scope: string | null;
  readonly nonNegative: boolean;
} {
  const def = ledgerDefinitionOf(target);
  return { subject: def.subject, scope: def.scope, nonNegative: def.nonNegative === true };
}

export function ledgerLabel(target: string): string {
  return ledgerDefinitionOf(target).label;
}

export function ledgerOpSigns(target: string): Readonly<Partial<Record<EffectOp, 1 | -1>>> {
  return ledgerDefinitionOf(target).ops;
}

function requireSign(value: unknown, at: string): 1 | -1 {
  if (value === 1 || value === -1) return value;
  schemaFail(`${at} must be 1 or -1 (the sign and the allowed op are the same table; an op without a sign is not allowed)`);
}

/** Shape gate for one ledger. Registries go through `defineLedgers`. */
export function defineLedger(raw: unknown, at = "ledger"): LedgerDefinition {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, [...LEDGER_DEF_KEYS, "code"] as const, at);
  const code =
    obj["code"] === undefined
      ? requireCoordinateSegment(at.slice(at.lastIndexOf(".") + 1), `${at} code`)
      : requireCoordinateSegment(obj["code"], `${at}.code`);
  if (obj["scope"] === undefined) {
    schemaFail(`${at}.scope must explicitly be null or an entity code — omitting it must not be read as one-dimensional`);
  }
  const scopeRaw = obj["scope"];
  const scope =
    scopeRaw === null ? null : requireCoordinateSegment(scopeRaw, `${at}.scope`);
  const opsRaw = requireObject(obj["ops"], `${at}.ops`);
  assertClosedKeys(opsRaw, EFFECT_OPS, `${at}.ops`);
  const ops: Partial<Record<EffectOp, 1 | -1>> = {};
  for (const op of EFFECT_OPS) {
    if (opsRaw[op] === undefined) continue;
    ops[op] = requireSign(opsRaw[op], `${at}.ops.${op}`);
  }
  if (Object.keys(ops).length === 0) {
    schemaFail(`${at}.ops must not be empty — a ledger must define at least one signed op`);
  }
  const positive = EFFECT_OPS.filter((op) => ops[op] === 1);
  if (positive.length === 0) {
    schemaFail(`${at}.ops has no positive op — the sign table is wrong, and a signed sum would be meaningless`);
  }
  const nonNegativeRaw = obj["nonNegative"];
  if (nonNegativeRaw !== undefined && typeof nonNegativeRaw !== "boolean") {
    schemaFail(`${at}.nonNegative must be a boolean`);
  }
  return {
    code,
    label: requireText(obj["label"], `${at}.label`),
    subject: requireCoordinateSegment(obj["subject"], `${at}.subject`),
    scope,
    ops: Object.freeze(ops),
    measure: requireEnum(obj["measure"], LEDGER_MEASURES, `${at}.measure`),
    book: requireCoordinateSegment(obj["book"], `${at}.book`),
    nonNegative: nonNegativeRaw === true,
  };
}

export function defineLedgers(raw: unknown): LedgerCatalog {
  const obj = requireObject(raw, "ledgers");
  assertClosedKeys(obj, LEDGER_CATALOG_KEYS, "ledgers");
  const booksRaw = requireArray(obj["books"], "ledgers.books");
  if (!booksRaw.length) schemaFail("ledgers.books must not be empty — do not export this named value when there are no period books");
  const books: string[] = [];
  for (const [index, entry] of booksRaw.entries()) {
    const book = requireCoordinateSegment(entry, `ledgers.books[${String(index)}]`);
    if (books.includes(book)) schemaFail(`ledgers.books declares "${book}" more than once`);
    books.push(book);
  }

  const ledgersRaw = requireObject(obj["ledgers"], "ledgers.ledgers");
  const entries = Object.entries(ledgersRaw);
  if (!entries.length) schemaFail("ledgers.ledgers must not be empty — do not export this named value when there are no ledgers");
  const ledgers: Record<string, LedgerDefinition> = {};
  for (const [code, value] of entries) {
    requireCoordinateSegment(code, "ledgers.ledgers code");
    const valueObj = requireObject(value, `ledgers.ledgers.${code}`);
    if (valueObj["code"] !== undefined && valueObj["code"] !== code) {
      schemaFail(`ledgers.ledgers.${code}.code "${String(valueObj["code"])}" must match key "${code}"`);
    }
    const defined = defineLedger({ ...valueObj, code }, `ledgers.ledgers.${code}`);
    if (!books.includes(defined.book)) {
      schemaFail(
        `ledgers.ledgers.${code}.book "${defined.book}" is not in the books list (${books.join(" / ")})`,
      );
    }
    ledgers[code] = defined;
  }

  const out: LedgerCatalog = { books: Object.freeze(books), ledgers };
  Object.defineProperty(out, DEFINED_LEDGERS_BY_KERNEL, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return out;
}

export function isDefinedLedgers(value: unknown): value is LedgerCatalog {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_LEDGERS_BY_KERNEL] === true
  );
}

/**
 * Catalog self-check. The kernel no longer holds a snapshot of five ledgers; closure is the catalog's own invariants:
 * every ledger has a positive op, book is in books, quantity must land on a scope, reserve/release are a reversed pair,
 * and money must not declare nonNegative.
 */
export function assertLedgerCatalog(catalog: LedgerCatalog): void {
  const codes = Object.keys(catalog.ledgers);
  if (codes.length === 0) schemaFail("the ledger catalog is empty");
  const usedBooks = new Set<string>();
  for (const def of Object.values(catalog.ledgers)) {
    usedBooks.add(def.book);
    if (def.measure === "quantity" && def.scope === null) {
      schemaFail(`ledger catalog "${def.code}" with measure=quantity must have a scope (inventory lands in a warehouse)`);
    }
    if (def.measure === "money" && def.scope !== null) {
      schemaFail(`ledger catalog "${def.code}" with measure=money does not accept a scope`);
    }
    if (def.measure === "money" && def.nonNegative) {
      schemaFail(`ledger catalog "${def.code}" with measure=money must not declare nonNegative`);
    }
    const paired: ReadonlyArray<readonly [EffectOp, EffectOp]> = [
      ["reserve", "release"],
      ["in", "out"],
    ];
    for (const [forward, reverse] of paired) {
      const a = def.ops[forward];
      const b = def.ops[reverse];
      if (a === undefined && b === undefined) continue;
      if (a === undefined || b === undefined) {
        schemaFail(`ledger catalog "${def.code}" must declare ${forward}/${reverse} as a pair`);
      }
      if (a + b !== 0) {
        schemaFail(`ledger catalog "${def.code}" must give ${forward} and ${reverse} opposite signs, otherwise a reversal doubles the balance instead of offsetting it`);
      }
    }
  }
  for (const book of catalog.books) {
    if (!usedBooks.has(book)) schemaFail(`ledger catalog books "${book}" is not referenced by any ledger`);
  }
}

/** @deprecated The kernel snapshot is retired; this is the same as `assertLedgerCatalog`. */
export const assertLedgerCatalogMatchesKernel = assertLedgerCatalog;
