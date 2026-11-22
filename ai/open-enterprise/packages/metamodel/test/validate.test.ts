import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, singleState, validateModule } from "../src/index.js";

interface Raw {
  code: string;
  label: string;
  domain: string;
  fields: unknown[];
  lifecycle: { statuses: unknown[]; transitions: unknown[] };
  views: unknown;
  [key: string]: unknown;
}

/*:: A statement of the minimum available purchase order. One in one in each case and one in another. */
function purchaseOrder(): Raw {
  return structuredClone({
    code: "purchaseOrder",
    label: "Purchase order",
    domain: "procurement",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
      { key: "totalAmount", label: "Amount", type: "money", required: true },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        // Don't change after the check. `supplierId`: the pen is hanging on it.
        // this is what EFFECT COORD FIED EDITABLE looked at.
        // non-final default: "Full" so it has to narrow -- modules that copy the default will step Let's go.
        { key: "pending", label: "awaitingReceipt", color: "blue", editable: "whitelist", editableFields: ["totalAmount"] },
        { key: "done", label: "completed", color: "green", terminal: true },
      ],
      transitions: [
        {
          code: "approve",
          from: "draft",
          to: "pending",
          action: "Approve",
          primary: true,
          // open side of the purchase. This is EFFECT SUBJECT.
          effects: [
            { target: "ap", op: "reserve", subject: "$bill.supplierId", amount: "{totalAmount}", reverseOn: ["unapprove", "finish"] },
          ],
        },
        { code: "unapprove", from: "pending", to: "draft", action: "Unapprove" },
        { code: "finish", from: "pending", to: "done", action: "Complete", primary: true },
      ],
    },
    views: { list: { columns: ["code", "supplierId", "totalAmount"] } },
  });
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

describe("eFFECT COORD FIELLD EDITABLE -- the coordinates drift, release is not the right thing to do.", () => {
  it("we can still change the coordinates.", () => {
    const raw = purchaseOrder();
    // putting "awaiting Receipt" back to the default full: suppliers can change at this point, and ap reserve is on top of it.
    raw.lifecycle.statuses = raw.lifecycle.statuses.map((s) =>
      (s as { key: string }).key === "pending" ? { key: "pending", label: "awaitingReceipt", color: "blue" } : s,
    );
    expect(errorCodes(raw)).toContain("EFFECT_COORD_FIELD_EDITABLE");
  });

  it("checked for accessibility and ** bypassed back to roll ** - Back to roll and walk the bill is gone.", () => {
    const raw = purchaseOrder();
    // draft is the end point of unapprove, where supplierId can of course be changed; unapprove can't walk,
    // so it's not supposed to be red. The baseline example (leaved) has been covered, and here it's visible nailing around this half.
    expect(errorCodes(raw)).toEqual([]);
  });

  it("coordinates are released without a white list -- coordinates fields are collected, not the whole state", () => {
    const raw = purchaseOrder();
    raw.lifecycle.statuses = raw.lifecycle.statuses.map((s) =>
      (s as { key: string }).key === "pending"
        ? { key: "pending", label: "awaitingReceipt", color: "blue", editable: "whitelist", editableFields: ["totalAmount"] }
        : s,
    );
    expect(errorCodes(raw)).toEqual([]);
  });
});

describe("7th Concept Gate", () => {
  it("the blacklist key gives a direct destination, not just \"not allowed.\"", () => {
    expect(() => normalizeFixtureModule({ ...purchaseOrder(), notifications: [] })).toThrow(/handoff/);
    expect(() => normalizeFixtureModule({ ...purchaseOrder(), actions: [] })).toThrow(/primary/);
    expect(() => normalizeFixtureModule({ ...purchaseOrder(), hooks: [] })).toThrow(/source:'code'/);
    expect(() => normalizeFixtureModule({ ...purchaseOrder(), permissions: {} })).toThrow(/RBAC/);
  });

  it("unknown keys outside the white list are rejected", () => {
    expect(() => normalizeFixtureModule({ ...purchaseOrder(), whatever: 1 })).toThrow(/unknown key/);
  });

  it("the embedded layer key is also closed.", () => {
    const raw = purchaseOrder();
    (raw.lifecycle.transitions[0] as Record<string, unknown>)["onSuccess"] = "doSomething";
    expect(() => normalizeFixtureModule(raw)).toThrow(/unknown key/);
  });
});

describe("requiredOnManualCreate", () => {
  it("a manual fill field that rejects duplicated, hidden or system supply", () => {
    const required = purchaseOrder();
    (required.fields[2] as Record<string, unknown>)["requiredOnManualCreate"] = true;
    expect(errorCodes(required)).toContain("FIELD_MANUAL_CREATE_REQUIRED_REDUNDANT");

    const hidden = purchaseOrder();
    hidden.fields.push({ key: "reason", label: "Reason", type: "text", hidden: true, requiredOnManualCreate: true });
    expect(errorCodes(hidden)).toContain("FIELD_MANUAL_CREATE_REQUIRED_HIDDEN");

    const planner = purchaseOrder();
    planner.fields.push({ key: "sourceType", label: "Source", type: "string", plannerSupplied: true, requiredOnManualCreate: true });
    expect(errorCodes(planner)).toContain("FIELD_MANUAL_CREATE_REQUIRED_UNFILLABLE");
  });
});

describe("quote candidate literacy", () => {
  it("only visible labels accept fields that can be read directly, reject ref and amount", () => {
    const raw = purchaseOrder();
    const list = (raw.views as { list: Record<string, unknown> }).list;
    list["referenceLabel"] = ["code", "supplierId", "totalAmount"];
    expect(errorCodes(raw)).toContain("VIEW_REFERENCE_LABEL_UNREADABLE");
  });

  it("encoding and text fields make visible reference labels", () => {
    const raw = purchaseOrder();
    const list = (raw.views as { list: Record<string, unknown> }).list;
    list["referenceLabel"] = ["code"];
    expect(errorCodes(raw)).toEqual([]);
  });
});

describe("eFFECT REVERSE UNREACHABLE - Permanent Lockup", () => {
  it("baseline: reverseOn covers two ways out, release", () => {
    expect(errorCodes(purchaseOrder())).toEqual([]);
  });

  it("declares that the anti-censorship will be awarded red: normal process approve→finish will never go back to trial Nuclear", () => {
    const raw = purchaseOrder();
    const approve = raw.lifecycle.transitions[0] as { effects: { reverseOn: string[] }[] };
    approve.effects[0]!.reverseOn = ["unapprove"];

    const report = validateModule(normalizeFixtureModule(raw));
    expect(report.ok).toBe(false);
    const hit = report.errors.find((e) => e.code === "EFFECT_REVERSE_UNREACHABLE");
    expect(hit).toBeDefined();
    // we have to point out which path is missing. Side
    expect(hit!.message).toContain("done");
    expect(hit!.message).toContain("stays posted forever");
  });

  it("no statement at all on the reverseOn report MissING, no UNREACHABLE", () => {
    const raw = purchaseOrder();
    const approve = raw.lifecycle.transitions[0] as { effects: Record<string, unknown>[] };
    delete approve.effects[0]!["reverseOn"];

    const codes = errorCodes(raw);
    expect(codes).toContain("EFFECT_REVERSE_MISSING");
    expect(codes).not.toContain("EFFECT_REVERSE_UNREACHABLE");
  });

  it("reverseOn points to non-existent sides", () => {
    const raw = purchaseOrder();
    const approve = raw.lifecycle.transitions[0] as { effects: { reverseOn: string[] }[] };
    approve.effects[0]!.reverseOn = ["cancel"];
    expect(errorCodes(raw)).toContain("EFFECT_REVERSE_UNKNOWN");
  });

  it("amount quotes non-existent tablehead fields", () => {
    const raw = purchaseOrder();
    const approve = raw.lifecycle.transitions[0] as { effects: { amount: string }[] };
    approve.effects[0]!.amount = "{grandTotal}";
    expect(errorCodes(raw)).toContain("EFFECT_AMOUNT_FIELD_UNKNOWN");
  });

  it("amount does not recognize an expression - the amount of the account must come from the fact that it was written down", () => {
    const raw = purchaseOrder();
    const approve = raw.lifecycle.transitions[0] as { effects: { amount: string }[] };
    approve.effects[0]!.amount = "{totalAmount} * 0.3";
    expect(() => normalizeFixtureModule(raw)).toThrow(/only a numeric literal/);
  });
});

describe("status chart gate", () => {
  it("deny loading of the same transfer code when repeating a declaration", () => {
    const raw = purchaseOrder();
    raw.lifecycle.transitions.push({ code: "finish", from: "pending", to: "done", action: "Complete" });
    expect(() => normalizeFixtureModule(raw)).toThrow(/\(code, from\) declared "finish@pending" more than once/);
  });

  it("same translation code valid from different states", () => {
    const raw = purchaseOrder();
    raw.lifecycle.transitions.push({ code: "finish", from: "draft", to: "done", action: "Complete", effects: [] });
    expect(() => normalizeFixtureModule(raw)).not.toThrow();
  });

  it("it's not final.", () => {
    const raw = purchaseOrder();
    raw.lifecycle.statuses.push({ key: "stuck", label: "Hold" });
    raw.lifecycle.transitions.push({ code: "hold", from: "pending", to: "stuck", action: "Hold" });
    expect(errorCodes(raw)).toContain("STATUS_ORPHAN");
  });

  it("the island's state is out of reach.", () => {
    const raw = purchaseOrder();
    raw.lifecycle.statuses.push({ key: "void", label: "Void", terminal: true });
    expect(errorCodes(raw)).toContain("STATUS_UNREACHABLE");
  });

  it("no beginnings.", () => {
    const raw = purchaseOrder();
    delete (raw.lifecycle.statuses[0] as Record<string, unknown>)["initial"];
    expect(errorCodes(raw)).toContain("STATUS_NO_INITIAL");
  });

  it("two main buttons in the same state = no main button", () => {
    const raw = purchaseOrder();
    (raw.lifecycle.transitions[1] as Record<string, unknown>)["primary"] = true;
    expect(errorCodes(raw)).toContain("TRANSITION_MULTI_PRIMARY");
  });
});

describe("the individual life cycle of the primary data is a legal form.", () => {
  it("it's both a first and a last-minute rule.", () => {
    const supplier: Raw = {
      code: "supplier",
      label: "Supplier",
      domain: "procurement",
      fields: [
        { key: "code", label: "Code", type: "string", primary: true },
        { key: "name", label: "Name", type: "string", required: true },
      ],
      lifecycle: {
        statuses: [{ key: "active", label: "Active", initial: true, terminal: true, editable: "full" }],
        transitions: [],
      },
      views: { list: { columns: ["code", "name"] } },
    };
    expect(errorCodes(supplier)).toEqual([]);
  });

  it("singlestate() is a full gate and can be edited - the hand copy is missing, editable is silently turned into read-only", () => {
    const lifecycle = singleState();
    expect(errorCodes({
      code: "supplier",
      label: "Supplier",
      domain: "procurement",
      fields: [
        { key: "code", label: "Code", type: "string", primary: true },
        { key: "name", label: "Name", type: "string", required: true },
      ],
      lifecycle: { statuses: [...lifecycle.statuses], transitions: [...lifecycle.transitions] },
      views: { list: { columns: ["code", "name"] } },
    })).toEqual([]);
    expect(lifecycle.statuses[0]?.editable).toBe("full");
    expect(lifecycle.transitions).toHaveLength(0);
  });
});

describe("system supply field", () => {
  it("the derivative field cannot be marked -- user does not fill its entry", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "receivedQty",
      label: "Received quantity",
      type: "number",
      required: true,
      derive: { kind: "rollup", from: "purchaseReceipt", match: "orderId", measure: "sum(qty)" },
    });
    expect(errorCodes(raw)).toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });

  it("systemGenerated allows required - write path supply, column NOT NULL and block manual creation", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "syncedAt",
      label: "Synced at",
      type: "datetime",
      required: true,
      systemGenerated: true,
    });
    expect(errorCodes(raw)).not.toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });

  it("count does not accept field parameters", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "receiptCount",
      label: "Receipt count",
      type: "number",
      derive: { kind: "rollup", from: "purchaseReceipt", match: "orderId", measure: "count(qty)" },
    });
    expect(() => normalizeFixtureModule(raw)).toThrow(/count does not take a field argument/);
  });

  it("local coordinates of rollup are visible, and the default shape is compatible", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "receivedQty",
      label: "Received quantity",
      type: "number",
      derive: { kind: "rollup", from: "purchaseReceipt", match: "orderId", measure: "sum(qty)" },
    });
    const normalized = normalizeFixtureModule(raw);
    expect(normalized.fields.find((field) => field.key === "receivedQty")?.derive).toEqual({
      kind: "rollup",
      from: "purchaseReceipt",
      match: "orderId",
      through: null,
      agg: "sum",
      measure: "qty",
      where: null,
    });

    raw.fields.push({
      key: "receivedBySupplier",
      label: "Supplier received",
      type: "number",
      derive: { kind: "rollup", from: "purchaseReceipt", match: "supplierId", on: "supplierId", measure: "sum(qty)" },
    });
    expect(normalizeFixtureModule(raw).fields.find((field) => field.key === "receivedBySupplier")?.derive).toMatchObject({ on: "supplierId" });
  });

  it("rollup does not repeat the platform on", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "receivedQty",
      label: "Received quantity",
      type: "number",
      derive: { kind: "rollup", from: "purchaseReceipt", match: "orderId", on: "id", measure: "sum(qty)" },
    });
    expect(() => normalizeFixtureModule(raw)).toThrow(/when aggregating by this layer's id, omit on/);
  });

  it("lookup does not accept rollup exclusive on", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "supplierName",
      label: "Supplier name",
      type: "string",
      derive: { kind: "lookup", from: "supplier", match: "supplierId", on: "supplierId", field: "name" },
    });
    expect(() => normalizeFixtureModule(raw)).toThrow(/unknown key "on"/);
  });
});

// three (options /ref / fields) must be closed in both directions.
// it's not "a little looser" to look straight. It's a completely irrelevant point:
// `{type:'string', ref:'customer'}` Will be reported by the Loader checkcrossReferences
// the module "customer" does not exist, and the guide is to build a module, and the real thing to do is delete this ref.
describe("type-specific keys on fields, also closed in reverse", () => {
  it("non enum field belt options is rejected - Modellers think they have a limit on the take-up value, and there are practically no limits to it", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "grade", label: "Level", type: "string", options: ["A", "B"] });
    expect(() => normalizeFixtureModule(raw)).toThrow(/options is meaningful only on an enum field/);
  });

  it("not ref field belts ref is rejected -- otherwise \"modules do not exist\" is reported and people will build a module that they don't need at all", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "note", label: "Remark", type: "text", ref: "remark" });
    expect(() => normalizeFixtureModule(raw)).toThrow(/ref is meaningful only on a ref, refLine, or subtable field/);
  });

  it("subtable ref is** from table name** not module code, not rejected", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [{ key: "qty", label: "Quantity", type: "number" }],
    });
    expect(errorCodes(raw)).toEqual([]);
  });
});

describe("columns from tables (subtable.fields)", () => {
  const withLines = (lines: unknown): Raw => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "lines", label: "Lines", type: "subtable", ref: "purchaseOrderLine", fields: lines });
    return raw;
  };

  it("subtable must declare column - undeclared unrenderable", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "lines", label: "Lines", type: "subtable", ref: "purchaseOrderLine" });
    expect(() => normalizeFixtureModule(raw)).toThrow(/must declare its columns with fields/);
  });

  it("the column statement can be deciphered and the renderer defined as a column", () => {
    const raw = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qty", label: "Quantity", type: "number", required: true },
    ]);
    const lines = normalizeFixtureModule(raw).fields.find((f) => f.key === "lines");
    expect(lines?.fields?.map((f) => f.key)).toEqual(["productId", "qty"]);
    expect(errorCodes(raw)).toEqual([]);
  });

  it("only one layer: no more subtables from the table column", () => {
    const raw = withLines([
      { key: "sub", label: "Child lines", type: "subtable", ref: "x", fields: [{ key: "a", type: "string" }] },
    ]);
    expect(() => normalizeFixtureModule(raw)).toThrow(/Lines are only one level deep/);
  });

  it("nonsubtable field belt field is rejected -- it's written in the wrong place, not a redundant key that can be ignored", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "note", label: "Remark", type: "string", fields: [{ key: "a", type: "string" }] });
    expect(() => normalizeFixtureModule(raw)).toThrow(/meaningful only on a subtable field/);
  });

  it("column key is the only one from the list", () => {
    const raw = withLines([
      { key: "qty", label: "Quantity", type: "number" },
      { key: "qty", label: "Another quantity", type: "number" },
    ]);
    expect(() => normalizeFixtureModule(raw)).toThrow(/more than once/);
  });

  // drill down: two field gates not because it's in the lines. Okay.
  it("also no shadow platform fields from the table", () => {
    const raw = withLines([{ key: "status", label: "Line status", type: "string" }]);
    expect(errorCodes(raw)).toContain("FIELD_SHADOWS_PLATFORM");
  });

  it("also do not fill out derivative field markers from the column in the table.", () => {
    const raw = withLines([
      {
        key: "shipped",
        label: "Shipped",
        type: "number",
        required: true,
        derive: { kind: "rollup", from: "x", match: "y", measure: "sum(qty)" },
      },
    ]);
    expect(errorCodes(raw)).toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });

  it("refLine ref: the former is an input, the latter is a countercheck column written by the warehouse", () => {
    const raw = withLines([
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder", required: true },
      { key: "orderLineId", label: "Purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines", required: true },
    ]);
    expect(errorCodes(raw)).toEqual([]);
  });

  it("refLine without a peer watch attendantref refuses: otherwise the documents cannot be rechecked", () => {
    const raw = withLines([
      { key: "orderLineId", label: "Purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines", required: true },
    ]);
    expect(errorCodes(raw)).toContain("REF_LINE_NO_BILL_PARTNER");
  });

  it("multiple ref or refLines appear with the same target, meaning rejection: automatic attribution cannot match", () => {
    const twoBills = withLines([
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder" },
      { key: "otherOrderId", label: "Another purchase order", type: "ref", ref: "purchaseOrder" },
      { key: "orderLineId", label: "Purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines" },
    ]);
    expect(errorCodes(twoBills)).toContain("REF_LINE_BILL_PARTNER_AMBIGUOUS");

    const twoLines = withLines([
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder" },
      { key: "orderLineId", label: "Purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines" },
      { key: "otherOrderLineId", label: "Another purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines" },
    ]);
    expect(errorCodes(twoLines)).toContain("REF_LINE_BILL_PARTNER_AMBIGUOUS");
  });

  it("ref. refowowner can specify the accompanying column when there are multiple ref", () => {
    const raw = withLines([
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder" },
      { key: "settlementOrderId", label: "Settle the purchase order", type: "ref", ref: "purchaseOrder" },
      {
        key: "orderLineId",
        label: "Purchase order line",
        type: "refLine",
        ref: "purchaseOrder",
        through: "lines",
        refOwner: "orderId",
      },
    ]);
    expect(errorCodes(raw)).toEqual([]);
  });

  it("refLine.refOwner must point to peer module ref and cannot be shared by two refLine", () => {
    const wrong = withLines([
      { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier" },
      { key: "orderLineId", label: "Purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines", refOwner: "supplierId" },
    ]);
    expect(errorCodes(wrong)).toContain("REF_LINE_OWNER_INVALID");

    const duplicate = withLines([
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder" },
      { key: "firstLineId", label: "Row one", type: "refLine", ref: "purchaseOrder", through: "lines", refOwner: "orderId" },
      { key: "secondLineId", label: "Row two", type: "refLine", ref: "purchaseOrder", through: "lines", refOwner: "orderId" },
    ]);
    expect(errorCodes(duplicate)).toContain("REF_LINE_OWNER_DUPLICATE");
  });

  // snapshots —
  //
  // and `lookup` There's only one difference, but it determines history:`lookup` Read the current value for each query without falling down;
  // `snapshot` There are columns, values are taken when saving. The unit/ specification on the transaction sheet is not available `lookup`—
  // main data revision session** reverse rewriting of business facts that have occurred**.
  //
  // "Does it make sense in this module?"
  // "Whether this field is on the source module, it's not empty, it's not empty." It's a cross-module.
  // `checkCrossReferences`- One-module checkers at a time are blind to those structures.
  it("the match of snapshot must be on the same floor: the snapshot at the top does not point to the line Let's go.", () => {
    const raw = withLines([{ key: "productId", label: "Product", type: "ref", ref: "product", required: true }]);
    raw.fields.push({
      key: "unit",
      label: "Unit",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "unit" },
    });
    expect(errorCodes(raw)).toContain("SNAPSHOT_MATCH_UNKNOWN");
  });

  it("mchat for snapshot must be ref / refLine - take a normal field and coordinate nothing for join", () => {
    const raw = withLines([
      { key: "productName", label: "Product name", type: "string", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productName", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(raw)).toContain("SNAPSHOT_MATCH_NOT_REF");
  });

  it("the snapshot from must match the cell to the match -- otherwise it's the line in the other watch that coincides with id", () => {
    const raw = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "supplier", match: "productId", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(raw)).toContain("SNAPSHOT_FROM_MISMATCH");
  });

  it("snapshot through must match the citation coordinates of the match --ref is watch, refLine is lined", () => {
    const raw = withLines([
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder", required: true },
      { key: "orderLineId", label: "Purchase order line", type: "refLine", ref: "purchaseOrder", through: "lines", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        // the coordinates are line-level, though, and they're full -- they're both text columns, andjoin comes up with a line.
        snapshot: { from: "purchaseOrder", match: "orderLineId", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(raw)).toContain("SNAPSHOT_THROUGH_MISMATCH");
  });

  // 🔴 This is the other side of the gate with the "refLine required to be paired."
  // freezing listed on the watch side is unconditional, not Null, and the value is only quoted from the match: watch left empty Time
  // the writing path does not produce a reference coordinate.
  // a user input problem becomes 500.
  it("🔴 Match for snapshot must always be filled - Select the coordinates + not Null column = a path to the PG before blowing up", () => {
    const raw = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product" },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(raw)).toContain("SNAPSHOT_MATCH_OPTIONAL");

    // the coordinates will be closed.
    const ok = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(ok)).toEqual([]);
  });

  it("snapshot.optional visible allows match to be empty; normal snapshot gates are not relaxed", () => {
    const optional = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product" },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "unit", optional: true },
      },
    ]);
    expect(errorCodes(optional)).not.toContain("SNAPSHOT_MATCH_OPTIONAL");
    const normalized = normalizeFixtureModule(optional);
    const lines = normalized.fields.find((field) => field.key === "lines")?.fields ?? [];
    expect(lines.find((field) => field.key === "unit")?.snapshot?.optional).toBe(true);

    expect(() =>
      normalizeFixtureModule(
        withLines([
          { key: "productId", label: "Product", type: "ref", ref: "product" },
          {
            key: "unit",
            label: "Unit",
            type: "string",
            snapshot: { from: "product", match: "productId", through: null, field: "unit", optional: "yes" },
          },
        ]),
      ),
    ).toThrow(/snapshot\.optional.*boolean/);
  });

  it("snapshot.optional unresolved match", () => {
    const raw = withLines([
      {
        key: "productId",
        label: "Product",
        type: "ref",
        ref: "product",
        derive: { kind: "lookup", from: "source", match: "sourceId", through: null, field: "productId" },
      },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "unit", optional: true },
      },
    ]);
    expect(errorCodes(raw)).toContain("SNAPSHOT_MATCH_UNRESOLVED");
  });

  it("snapshot is not allowed to mark required - it does not have a user entry, it is not empty by match + source is not empty Cash", () => {
    const raw = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        required: true,
        snapshot: { from: "product", match: "productId", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(raw)).toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });

  it("snapshot crosses with Délive / auto / LineAgg - only one system supply source for one field", () => {
    const raw = withLines([
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "unit" },
        derive: { kind: "lookup", from: "product", through: null, match: "productId", field: "unit" },
      },
    ]);
    expect(() => normalizeFixtureModule(raw)).toThrow(/mutually exclusive/);
  });

  it("refDefault must point to the same level of reference, but fields are still writeable", () => {
    const ok = withLines([
      { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
      {
        key: "pieceRate",
        label: "Piece rate",
        type: "money",
        required: true,
        refDefault: { from: "operation", match: "operationId", through: null, field: "pieceRate" },
      },
    ]);
    expect(errorCodes(ok)).toEqual([]);

    const bad = withLines([
      { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
      {
        key: "pieceRate",
        label: "Piece rate",
        type: "money",
        refDefault: { from: "supplier", match: "operationId", through: null, field: "pieceRate" },
      },
    ]);
    expect(errorCodes(bad)).toContain("REF_DEFAULT_FROM_MISMATCH");
  });
});

describe("main axis (subject x scope)", () => {
  /*change the approve side of the effect to a given declaration */
  const withEffect = (effect: Record<string, unknown>): Raw => {
    const raw = purchaseOrder();
    (raw.lifecycle.transitions[0] as { effects: unknown[] }).effects = [effect];
    return raw;
  };
  const base = { target: "ap", op: "reserve", amount: "{totalAmount}", reverseOn: ["unapprove", "finish"] };

  // 🔴 The meaning of the gate: No one can say whose account it is.
  it("the object is dropped if it's missing and wrongly stated to whom to write it down.", () => {
    expect(() => normalizeFixtureModule(withEffect(base))).toThrow(/subject is missing/);
    expect(() => normalizeFixtureModule(withEffect(base))).toThrow(/supplier/);
  });

  it("subject writing closed: only $bil. / $line.", () => {
    expect(() => normalizeFixtureModule(withEffect({ ...base, subject: "supplierId" }))).toThrow(/the form is/);
  });

  it("subject means the wrong entity is rejected - accounts payable cannot be charged to the client", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "customerId", label: "Customer", type: "ref", ref: "customer" });
    (raw.lifecycle.transitions[0] as { effects: unknown[] }).effects = [{ ...base, subject: "$bill.customerId" }];
    expect(errorCodes(raw)).toContain("EFFECT_SUBJECT_WRONG_ENTITY");
  });

  it("the subject is not directed at the rejected quote field", () => {
    expect(errorCodes(withEffect({ ...base, subject: "$bill.totalAmount" }))).toContain("EFFECT_SUBJECT_NOT_REF");
  });

  it("object pointed to non-existent fields rejected", () => {
    expect(errorCodes(withEffect({ ...base, subject: "$bill.vendorId" }))).toContain("EFFECT_SUBJECT_FIELD_UNKNOWN");
  });

  // 🔴 If we don't settle down, we'll never figure out if Shanghai's got enough.
  it("stop must have scope", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "productId", label: "Product", type: "ref", ref: "product" });
    (raw.lifecycle.transitions[0] as { effects: unknown[] }).effects = [
      { target: "stock", op: "in", subject: "$bill.productId", amount: "{totalAmount}", reverseOn: ["unapprove", "finish"] },
    ];
    expect(() => normalizeFixtureModule(raw)).toThrow(/must land on warehouse/);
  });

  // 🔴 Infiltration trap: a statementable, all-existing modelling gates, result balance reverse and zero symptoms
  it("🔴 Stock does not accept reserv / release - symbol undefined, presets the availability**", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "productId", label: "Product", type: "ref", ref: "product" });
    raw.fields.push({ key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse" });
    for (const op of ["reserve", "release"] as const) {
      const bad = structuredClone(raw);
      (bad.lifecycle.transitions[0] as { effects: unknown[] }).effects = [
        {
          target: "stock", op, subject: "$bill.productId", scope: "$bill.warehouseId",
          amount: "{totalAmount}", reverseOn: ["unapprove", "finish"],
        },
      ];
      // if you're wrong, tell me why it's the opposite.
      expect(() => normalizeFixtureModule(bad)).toThrow(/does not accept op/);
      expect(() => normalizeFixtureModule(bad)).toThrow(/available goes up/);
    }
  });

  it("in / out as usual - this gate narrows the promise Trail", () => {
    const raw = purchaseOrder();
    raw.fields.push({ key: "productId", label: "Product", type: "ref", ref: "product" });
    raw.fields.push({ key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse" });
    (raw.lifecycle.transitions[0] as { effects: unknown[] }).effects = [
      {
        target: "stock", op: "in", subject: "$bill.productId", scope: "$bill.warehouseId",
        amount: "{totalAmount}", reverseOn: ["unapprove", "finish"],
      },
    ];
    expect(() => normalizeFixtureModule(raw)).not.toThrow();
  });

  it("the balance of the remaining four books is open, reserv / releasing one word -- plus it's right.", () => {
    expect(() => normalizeFixtureModule(withEffect({ ...base, subject: "$bill.supplierId" }))).not.toThrow();
  });

  it("not stock does not accept scope - there is no reading in a warehouse", () => {
    expect(() => normalizeFixtureModule(withEffect({ ...base, subject: "$bill.supplierId", scope: "$bill.whatever" }))).toThrow(
      /one-dimensional/,
    );
  });

  it("quote $line but no details of the module were rejected", () => {
    expect(errorCodes(withEffect({ ...base, subject: "$line.supplierId", amount: "{$line.qty}" }))).toContain(
      "EFFECT_LINE_NO_SUBTABLE",
    );
  });

  // 🔴 Each line is marked at the head of the chart = double N, and every single item is legal.
  it("line-by-line amount must also come from line", () => {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [{ key: "supplierId", label: "Supplier", type: "ref", ref: "supplier" }],
    });
    (raw.lifecycle.transitions[0] as { effects: unknown[] }).effects = [{ ...base, subject: "$line.supplierId" }];
    expect(() => normalizeFixtureModule(raw)).toThrow(/the ledger would double/);
  });
});

describe("pROCONDITION EXIT UNREACHABLE - Unable to reach the rerouting exit", () => {
  const routed = (exit: string): Raw => {
    const raw = purchaseOrder();
    raw["preconditions"] = [
      {
        id: "needs_manager",
        onTransition: "approve",
        source: "gate",
        level: "route",
        exit,
        message: "Needs a supervisor",
        why: "Going over the limit is not an absolute ban; it needs a more senior person to take the risk",
        check: { primitive: "field_compare", left: { ref: "$bill.totalAmount" }, op: "lte", right: { value: 1000 } },
      },
    ];
    return raw;
  };

  // 🔴 ♪ There's ♪ ♪ Go get, the same lesson ♪
  it("the exit exists, but it's not in the current state -- the user's rerouting will find the button absent.", () => {
    // approve from draft, finish from pending
    const codes = errorCodes(routed("finish"));
    expect(codes).toContain("PRECONDITION_EXIT_UNREACHABLE");
    expect(codes).not.toContain("PRECONDITION_EXIT_UNKNOWN");
  });

  it("the exit is set at the same point as the blocked side.", () => {
    const raw = routed("altApprove");
    raw.lifecycle.transitions.push({ code: "altApprove", from: "draft", to: "pending", action: "Exceptional release" });
    expect(errorCodes(raw)).toEqual([]);
  });

  it("there's no exit to report UNKNOWN, no UNREACHABLE.", () => {
    const codes = errorCodes(routed("nope"));
    expect(codes).toContain("PRECONDITION_EXIT_UNKNOWN");
    expect(codes).not.toContain("PRECONDITION_EXIT_UNREACHABLE");
  });
});

describe("ref field compare source coordinates", () => {
  function withLineReference(): Raw {
    const raw = purchaseOrder();
    raw.fields.push({
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [
        { key: "sourceId", label: "Source document", type: "ref", ref: "sourceOrder", required: true },
        {
          key: "sourceLineId",
          label: "Source line",
          type: "refLine",
          ref: "sourceOrder",
          through: "lines",
          required: true,
        },
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      ],
    });
    raw["preconditions"] = [
      {
        id: "product_matches_source",
        onTransition: "approve",
        source: "invariant",
        level: "block",
        why: "The posted product must come from the referenced source line; changing only this document's product coordinate is not enough",
        check: {
          primitive: "ref_field_compare",
          via: "$line.sourceLineId",
          entity: "sourceOrder",
          through: "lines",
          field: "productId",
          op: "eq",
          right: { ref: "$line.productId" },
        },
      },
    ];
    return raw;
  }

  it("\"refLine + entity + through three to release", () => {
    expect(errorCodes(withLineReference())).toEqual([]);
  });

  it("check the target with normal ref. Modeling period directly denied.", () => {
    const raw = withLineReference();
    const preconditions = raw["preconditions"] as { check: Record<string, unknown> }[];
    preconditions[0]!.check["via"] = "$line.sourceId";
    expect(errorCodes(raw)).toContain("PRECONDITION_REF_VIA_NOT_REF_LINE");
  });

  it("refLine's self-declared through is inconsistent with the rule reading layer, and modelling period is directly rejected", () => {
    const raw = withLineReference();
    const preconditions = raw["preconditions"] as { check: Record<string, unknown> }[];
    preconditions[0]!.check["through"] = "items";
    expect(errorCodes(raw)).toContain("PRECONDITION_REF_THROUGH_MISMATCH");
  });

  it("via points to entities that are inconsistent with rules entity, modelling period directly denied", () => {
    const raw = withLineReference();
    const preconditions = raw["preconditions"] as { check: Record<string, unknown> }[];
    preconditions[0]!.check["entity"] = "anotherOrder";
    expect(errorCodes(raw)).toContain("PRECONDITION_REF_ENTITY_MISMATCH");
  });
});

describe("lines required if ref field", () => {
  function withConditionalLines(): Raw {
    const raw = purchaseOrder();
    raw["preconditions"] = [
      {
        id: "detail_lines_required",
        onTransition: "approve",
        source: "invariant",
        level: "block",
        why: "When the referenced document requires line-by-line application, lines must be present",
        check: {
          primitive: "lines_required_if_ref_field",
          via: "supplierId",
          entity: "supplier",
          field: "settlementMode",
          values: ["detail"],
        },
      },
    ];
    return raw;
  }

  it("table header ref to be readable by single module when aligned with the target entity Check", () => {
    expect(errorCodes(withConditionalLines())).toEqual([]);
  });

  it("via is not rejected at ref", () => {
    const raw = withConditionalLines();
    const preconditions = raw["preconditions"] as { check: Record<string, unknown> }[];
    preconditions[0]!.check["via"] = "totalAmount";
    expect(errorCodes(raw)).toContain("PRECONDITION_LINES_REQUIRED_VIA_NOT_REF");
  });

  it("via-directed entity refused if it was inconsistent with the rules entity", () => {
    const raw = withConditionalLines();
    const preconditions = raw["preconditions"] as { check: Record<string, unknown> }[];
    preconditions[0]!.check["entity"] = "customer";
    expect(errorCodes(raw)).toContain("PRECONDITION_LINES_REQUIRED_ENTITY_MISMATCH");
  });
});
