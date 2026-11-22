// ---------------------------------------------------------------------------
// 7th Original language: comparison of available quantities
//
// two real bug regression lines:
//   • Checks with ceilings only over ceilings, without looking at occupied ones - caps 500,000, already at 18400 hours, 490,000 sheets were released Okay.
//   • There's no one to check the superstocks — the Pinghukura, 120 commercial men's suits can identify 200.
// the two are the same issue ( "this is enough to cover"), so they are used twice in the same original language.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  describeCheck,
  evaluateCheck,
  normalizeCheck,
  normalizeFixtureModule,
  validateModule,
  type FieldLabels,
  type RuleContext,
  type RuleQuery,
} from "../src/index.js";

// take doubles —

interface QueryLog {
  readonly balances: string[];
}

/**
 * `balance` Just eat. `target × subjectId × scopeId` Triple group.
 * 🔴 The doubles also follow the contractual fall: stock lack scopeId does not allow it to be reduced to cross-barrel aggregate.
 */
function fakeQuery(
  ledger: Readonly<Record<string, number>>,
  rows: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
  log: QueryLog = { balances: [] },
): RuleQuery {
  return {
    get: (entity, id) => Promise.resolve(rows[`${entity}#${String(id)}`] ?? null),
    list: () => Promise.resolve([]),
    balance: (target, subjectId, scopeId) => {
      if (target === "stock" && !scopeId) {
        throw new Error(`balance lookup: stock is kept per warehouse; without it the only number is a cross-warehouse total`);
      }
      const key = `${target}:${subjectId}${scopeId ? `:${scopeId}` : ""}`;
      log.balances.push(key);
      const hit = ledger[key];
      if (hit === undefined) throw new Error(`stand-in ledger has no "${key}" — a missing balance must not be treated as 0`);
      return Promise.resolve(hit);
    },
  };
}

/**
 * This list of field names for example. It's real. `fieldLabelsOf(module, edge)` (a) Calculate from the statement;
 * here's a handwritten note that's supposed to be nailed to the point where "it's a word that the user can read on the form":
 Before `available_sufficient` Here. `$line.qty`That's inside the engine, not on the interface.
 */
const LABELS: FieldLabels = {
  bill: { warehouseId: "Shipping warehouse", supplierId: "Supplier", totalAmount: "Order amount" },
  line: { productId: "Product", qty: "Quantity" },
  param: {},
};

function contextOf(
  bill: Readonly<Record<string, unknown>>,
  lines: readonly Readonly<Record<string, unknown>>[],
  query: RuleQuery,
): RuleContext {
  return {
    bill,
    lines,
    params: {},
    actor: { roles: [] },
    labels: LABELS,
    now: new Date("2026-07-27T00:00:00Z"),
    query,
  };
}

const STOCK_CHECK = {
  primitive: "available_sufficient",
  target: "stock",
  subject: "$line.productId",
  scope: "$bill.warehouseId",
  need: "$line.qty",
};

/** Level with upper limit: Available = upper limit on file — net billing of the subject */
const LIMIT_CHECK = {
  primitive: "available_sufficient",
  target: "ap",
  subject: "$bill.supplierId",
  need: "$bill.totalAmount",
  limit: { via: "supplierId", entity: "supplier", field: "payableLimit" },
};

// request: net balance —

describe("available = account balance (not given)", () => {
  it("release as soon as there's enough balance, detail brings the actual number.", async () => {
    const ctx = contextOf(
      { warehouseId: "wh-sh" },
      [{ productId: "p-shaft-45", qty: 100 }],
      fakeQuery({ "stock:p-shaft-45:wh-sh": 120 }),
    );
    const out = await evaluateCheck(normalizeCheck(STOCK_CHECK), ctx);
    expect(out.ok).toBe(true);
    expect(out.detail).toContain("120");
  });

  it("🔴 120 in Shanghai, 200 in Shanghai: stop and say what line, how much is missing", async () => {
    const ctx = contextOf(
      { warehouseId: "wh-sh" },
      [{ productId: "p-shaft-45", qty: 200 }],
      fakeQuery({ "stock:p-shaft-45:wh-sh": 120 }),
    );
    const out = await evaluateCheck(normalizeCheck(STOCK_CHECK), ctx);
    expect(out.ok).toBe(false);
    expect(out.detail).toBe("line 1 product \"p-shaft-45\" short by 80");
  });

  it("case-by-case: only those lines that were underreported, the line numbers were the location in the detail.", async () => {
    const ctx = contextOf(
      { warehouseId: "wh-sh" },
      [
        { productId: "p-bolt-m8", qty: 100 },
        { productId: "p-shaft-45", qty: 200 },
        { productId: "p-motor-750", qty: 50 },
      ],
      fakeQuery({
        "stock:p-bolt-m8:wh-sh": 12000,
        "stock:p-shaft-45:wh-sh": 120,
        "stock:p-motor-750:wh-sh": 36,
      }),
    );
    const out = await evaluateCheck(normalizeCheck(STOCK_CHECK), ctx);
    expect(out.ok).toBe(false);
    expect(out.detail).toContain("line 2");
    expect(out.detail).toContain("short by 80");
    expect(out.detail).toContain("line 3");
    expect(out.detail).toContain("short by 14");
    expect(out.detail).not.toContain("line 1 ");
  });

  it("disaggregation of the same commodity into two rows is cumulative: two rows are sufficient and combined not enough", async () => {
    const ctx = contextOf(
      { warehouseId: "wh-sh" },
      [
        { productId: "p-shaft-45", qty: 80 },
        { productId: "p-shaft-45", qty: 80 },
      ],
      fakeQuery({ "stock:p-shaft-45:wh-sh": 120 }),
    );
    const out = await evaluateCheck(normalizeCheck(STOCK_CHECK), ctx);
    expect(out.ok).toBe(false);
    expect(out.detail).toBe("line 2 product \"p-shaft-45\" short by 40");
  });

  it("the sentence is passed without a single line: \"Don't take it as enough.\"", async () => {
    const ctx = contextOf({ warehouseId: "wh-sh" }, [], fakeQuery({}));
    const out = await evaluateCheck(normalizeCheck(STOCK_CHECK), ctx);
    expect(out.ok).toBe(false);
    expect(out.detail).toContain("not judged does not mean enough");
  });

  it("🔴 If you can't get the balance, you can't get zero.", async () => {
    const ctx = contextOf({ warehouseId: "wh-bj" }, [{ productId: "p-shaft-45", qty: 1 }], fakeQuery({}));
    await expect(evaluateCheck(normalizeCheck(STOCK_CHECK), ctx)).rejects.toThrow(/a missing balance must not be treated as 0/);
  });

  it("not available: not available for specific commodities Let's go.", async () => {
    const ctx = contextOf({ warehouseId: "wh-sh" }, [{ qty: 10 }], fakeQuery({ "stock:x:wh-sh": 1 }));
    await expect(evaluateCheck(normalizeCheck(STOCK_CHECK), ctx)).rejects.toThrow(/\$line\.productId has no value/);
  });
});

// request: the amount - occupied - —

describe("available = maximum - occupied (to leave)", () => {
  const supplier = { "supplier#s-hongtu": { id: "s-hongtu", payableLimit: 500000 } };

  it("🔴 The bug: 500000 cap, 18400 49000, must be stopped.", async () => {
    const ctx = contextOf({ supplierId: "s-hongtu", totalAmount: 490000 }, [], fakeQuery({ "ap:s-hongtu": 18400 }, supplier));
    const out = await evaluateCheck(normalizeCheck(LIMIT_CHECK), ctx);
    expect(out.ok).toBe(false);
    // it's the only thing that's gonna let go of this set of numbers -- the difference is the missing part.
    expect(out.detail).toContain("short by 8400");
  });

  it("single release within the available amount", async () => {
    const ctx = contextOf({ supplierId: "s-hongtu", totalAmount: 4800 }, [], fakeQuery({ "ap:s-hongtu": 18400 }, supplier));
    const out = await evaluateCheck(normalizeCheck(LIMIT_CHECK), ctx);
    expect(out.ok).toBe(true);
    expect(out.detail).toContain("available 481600");
  });

  it("if you can't get a ceiling field, you can throw it.", async () => {
    const ctx = contextOf(
      { supplierId: "s-null", totalAmount: 100 },
      [],
      fakeQuery({ "ap:s-null": 0 }, { "supplier#s-null": { id: "s-null" } }),
    );
    // throw, and say which one of the files ** has not been filled out - not the "capable sufficient..." engine term.
    // the phrase is "unfilled" and "misfilled": this is unfilled.
    await expect(evaluateCheck(normalizeCheck(LIMIT_CHECK), ctx)).rejects.toThrow(
      /supplier "payableLimit" is blank/,
    );
  });

  it("it's not a breakdown.", async () => {
    const ctx = contextOf({ supplierId: "s-none", totalAmount: 100 }, [], fakeQuery({ "ap:s-none": 0 }));
    const out = await evaluateCheck(normalizeCheck(LIMIT_CHECK), ctx);
    expect(out.ok).toBe(false);
    expect(out.detail).toContain("supplier#s-none does not exist");
  });

  it("the same subject only checks the balance once: line by line shouldn't ask for the account.", async () => {
    const log: QueryLog = { balances: [] };
    const ctx = contextOf(
      { warehouseId: "wh-sh" },
      [
        { productId: "p-shaft-45", qty: 10 },
        { productId: "p-shaft-45", qty: 10 },
      ],
      fakeQuery({ "stock:p-shaft-45:wh-sh": 120 }, {}, log),
    );
    await evaluateCheck(normalizeCheck(STOCK_CHECK), ctx);
    expect(log.balances).toEqual(["stock:p-shaft-45:wh-sh"]);
  });
});

// - Self-interpretation: both algorithms have to say —, —

describe("describe()", () => {
  it("the net balance is the account balance.", () => {
    expect(describeCheck(normalizeCheck(STOCK_CHECK), LABELS)).toBe(
      "Stock available quantity (ledger balance) must be not less than each line's \"Quantity\", counted by \"Product\" x \"Shipping warehouse\"",
    );
  });

  it("you have to say \"minus occupied\" on the upper shelf.", () => {
    expect(describeCheck(normalizeCheck(LIMIT_CHECK), LABELS)).toBe(
      "Accounts payable available quantity (supplier payableLimit minus already used) must be not less than \"Order amount\", counted by \"Supplier\"",
    );
  });

  /**
   * The account's gone `TARGET_TEXT`（`effects.ts` That one, the note says, "There's only one real source."
   ♪ Once upon a time it was printed here ♪ `p.target`, the gate on the interface says "stock availability..." and the same screen preview.
   * the panel says "inventory" - both methods of the same account. The cross-modular vocabulary doesn't reach it: it's the module code.
   * With field key, and `target` It is a closed list of accounts to which they go and which does not belong to any module.
   *（`supplier` / `payableLimit` Those two ** are ** modules and fields from `foreignGlossary` In service translation.
   */
  it("🔴 The account name is not allowed in English -- it doesn't belong to any module, the vocabulary doesn't reach it.", () => {
    for (const check of [STOCK_CHECK, LIMIT_CHECK]) {
      const text = describeCheck(normalizeCheck(check), LABELS);
      expect(text).not.toMatch(/(?<![A-Za-z])(stock|ar|ap|gl)(?![A-Za-z])/);
    }
  });
});

// the gates of the regulatory period —

describe("parameter gates (standardization period, consistent with the treatment of the same matter)", () => {
  it("🔴 Stock missing scope rejected: stock left unloaded, \"which silo is enough\" unsolved", () => {
    expect(() =>
      normalizeCheck({ primitive: "available_sufficient", target: "stock", subject: "$line.productId", need: "$line.qty" }),
    ).toThrow(/scope is missing/);
  });

  it("not stock gave scope rejected: no reading of a \"store\" to account for", () => {
    expect(() => normalizeCheck({ ...LIMIT_CHECK, scope: "$bill.warehouseId" })).toThrow(/does not accept scope/);
  });

  it("i'm going to take it to the top: I've tried every one of them, but I'm not going to take it. Volume", () => {
    expect(() => normalizeCheck({ ...STOCK_CHECK, need: "$bill.qty" })).toThrow(/need must also come from a detail line/);
  });

  it("coordinate syntax is the same as effects: $param. Reject", () => {
    expect(() => normalizeCheck({ ...STOCK_CHECK, scope: "$param.warehouseId" })).toThrow(/\$bill\.field/);
  });

  it("target is closed.", () => {
    expect(() => normalizeCheck({ ...STOCK_CHECK, target: "inventory" })).toThrow(/target/);
  });

  it("key closed for limit", () => {
    expect(() =>
      normalizeCheck({ ...LIMIT_CHECK, limit: { via: "supplierId", entity: "supplier", field: "payableLimit", op: "gte" } }),
    ).toThrow(/unknown key/);
  });
});

// 

interface Raw {
  code: string;
  label: string;
  domain: string;
  fields: unknown[];
  lifecycle: { statuses: unknown[]; transitions: unknown[] };
  preconditions: unknown[];
  views: unknown;
  [key: string]: unknown;
}

/*:: Minimum form of the bill: a schedule + a route to "superstock release" */
function delivery(): Raw {
  return structuredClone({
    code: "salesDelivery",
    label: "Sales issue",
    domain: "sales",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
      { key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse", required: true },
      { key: "qty", label: "Quantity", type: "number", required: true },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "salesDeliveryLine",
        fields: [
          { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
          { key: "qty", label: "Quantity", type: "number", required: true },
        ],
      },
    ],
    lifecycle: {
      statuses: [
        { key: "Awaiting pick", label: "Awaiting pick", initial: true },
        { key: "shipped", label: "shipped", terminal: true },
      ],
      transitions: [
        { code: "confirm", from: "Awaiting pick", to: "shipped", action: "Confirm issue", primary: true },
        { code: "confirm_over_stock", from: "Awaiting pick", to: "shipped", action: "Allow over stock", confirm: true },
      ],
    },
    preconditions: [
      {
        id: "stock_sufficient",
        onTransition: "confirm",
        source: "gate",
        level: "route",
        exit: "confirm_over_stock",
        why: "A stock shortage is not an absolute ban; it is routed to the warehouse supervisor",
        check: structuredClone(STOCK_CHECK),
      },
    ],
    views: { list: { columns: ["code", "qty"] } },
  });
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

function checkOf(raw: Raw): Record<string, unknown> {
  return (raw.preconditions[0] as { check: Record<string, unknown> }).check;
}

describe("coordinated gates (same as effects)", () => {
  it("baseline: Coordinates are right. Release.", () => {
    expect(errorCodes(delivery())).toEqual([]);
  });

  it("🔴 Subject indicates the wrong entity: stock must fall on the project", () => {
    const raw = delivery();
    checkOf(raw)["subject"] = "$bill.customerId";
    // curstomerId in front of the table points to a Customer, and stop to prevent
    expect(errorCodes(raw)).toContain("PRECONDITION_SUBJECT_WRONG_ENTITY");
  });

  it("scope points to the wrong entity: the dimension of the warehouse must ref", () => {
    const raw = delivery();
    checkOf(raw)["scope"] = "$bill.customerId";
    expect(errorCodes(raw)).toContain("PRECONDITION_SUBJECT_WRONG_ENTITY");
  });

  it("subject quotes non-existent columns", () => {
    const raw = delivery();
    checkOf(raw)["subject"] = "$line.goodsId";
    expect(errorCodes(raw)).toContain("PRECONDITION_SUBJECT_FIELD_UNKNOWN");
  });

  it("subject is not a reference field: the number of columns cannot be recorded", () => {
    const raw = delivery();
    checkOf(raw)["subject"] = "$line.qty";
    expect(errorCodes(raw)).toContain("PRECONDITION_SUBJECT_NOT_REF");
  });

  it("need to quote columns not included in the schedule", () => {
    const raw = delivery();
    checkOf(raw)["need"] = "$line.quantity";
    expect(errorCodes(raw)).toContain("PRECONDITION_NEED_FIELD_UNKNOWN");
  });

  it("but there's no breakdown of the module: which one is not supported", () => {
    const raw = delivery();
    raw.fields = raw.fields.filter((f) => (f as { key: string }).key !== "lines");
    expect(errorCodes(raw)).toContain("PRECONDITION_LINE_NO_SUBTABLE");
  });

  it("two schedules, $line.", () => {
    const raw = delivery();
    raw.fields.push({
      key: "extras",
      label: "Gift",
      type: "subtable",
      ref: "salesDeliveryExtraLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product" },
        { key: "qty", label: "Quantity", type: "number" },
      ],
    });
    expect(errorCodes(raw)).toContain("PRECONDITION_LINE_AMBIGUOUS");
  });
});

describe("maximum source gate", () => {
  function order(limit: unknown): Raw {
    return structuredClone({
      code: "purchaseOrder",
      label: "Purchase order",
      domain: "procurement",
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true },
        { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
        { key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse" },
        { key: "totalAmount", label: "Amount", type: "money", required: true },
      ],
      lifecycle: {
        statuses: [
          { key: "pendingReview", label: "pendingReview", initial: true },
          { key: "awaitingReceipt", label: "awaitingReceipt", terminal: true },
        ],
        transitions: [
          { code: "approve", from: "pendingReview", to: "awaitingReceipt", action: "Approve", primary: true },
          { code: "approve_exception", from: "pendingReview", to: "awaitingReceipt", action: "Exceptional release", confirm: true },
        ],
      },
      preconditions: [
        {
          id: "payable_within_limit",
          onTransition: "approve",
          source: "gate",
          level: "route",
          exit: "approve_exception",
          why: "When the amount exceeds this supplier's payable exposure, route it to a higher approval",
          check: { ...structuredClone(LIMIT_CHECK), limit },
        },
      ],
      views: { list: { columns: ["code", "totalAmount"] } },
    });
  }

  it("baseline: via is the supplier external key, entity is supplier, release", () => {
    expect(errorCodes(order({ via: "supplierId", entity: "supplier", field: "payableLimit" }))).toEqual([]);
  });

  it("via is not a field of this module", () => {
    expect(errorCodes(order({ via: "vendorId", entity: "supplier", field: "payableLimit" }))).toContain(
      "PRECONDITION_LIMIT_VIA_UNKNOWN",
    );
  });

  it("via is not a quote field: the upper limit is in the file that was quoted Let's go.", () => {
    expect(errorCodes(order({ via: "totalAmount", entity: "supplier", field: "payableLimit" }))).toContain(
      "PRECONDITION_LIMIT_VIA_NOT_REF",
    );
  });

  it("🔴 via refers to an entity that does not match the list.entity: the upper limit will be wrongly lifted by the entity", () => {
    expect(errorCodes(order({ via: "warehouseId", entity: "supplier", field: "payableLimit" }))).toContain(
      "PRECONDITION_LIMIT_ENTITY_MISMATCH",
    );
  });
});

describe("change the exit gate.", () => {
  it("🔴 The point of departure is different from that of the blocked: the document cannot be pressed at this time, and the rules are silent.", () => {
    const raw = delivery();
    raw.lifecycle.statuses.push({ key: "draft", label: "draft" });
    // the exit was changed from "draft" to "draft".
    (raw.lifecycle.transitions[1] as { from: string }).from = "draft";
    raw.lifecycle.transitions.push({ code: "submit", from: "draft", to: "Awaiting pick", action: "Submit" });
    expect(errorCodes(raw)).toContain("PRECONDITION_EXIT_UNREACHABLE");
  });
});
