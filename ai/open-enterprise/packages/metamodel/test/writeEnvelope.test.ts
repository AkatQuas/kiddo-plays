import { describe, expect, it } from "vitest";
import {
  classifyWriteEnvelope,
  defineFixtureModule,
  describeHoistedEnvelope,
  hoistMisplacedLines,
  omitMatchingSystemWriteKeys,
  singleState,
  unacceptableWriteKeys,
} from "../src/index.js";

const schema = defineFixtureModule({
  code: "skuLike",
  label: "SKU sample",
  domain: "test",
  numbering: { prefix: "SK", seqScope: "day" },
  fields: [
    { key: "name", label: "SKU name", type: "string", required: true },
    { key: "kind", label: "Category", type: "enum", options: ["Finished goods", "Material"], required: true },
    {
      key: "flag",
      label: "Production material",
      type: "bool",
      hidden: true,
      systemGenerated: true,
      createDefaultBy: { field: "kind", values: { "Finished goods": false, Material: false } },
      help: "A system-generated field cannot be changed by create or edit.",
    },
    { key: "code", label: "Number", type: "string", primary: true, auto: true },
  ],
  lifecycle: singleState("active", "Active", "green"),
  views: {
    list: { columns: ["name", "kind"], filters: [], searchable: ["name"] },
    form: [{ title: "Info", fields: ["name", "kind"] }],
  },
});

describe("write Envelope 3: System Supply Value Ignore / Script Reject / Unknown Key Reject", () => {
  it("read back (start hand)", () => {
    const payload = { name: "Dress", kind: "Finished goods", flag: false };
    const classified = classifyWriteEnvelope(schema.fields, payload);
    expect(classified.ignored).toEqual([
      expect.objectContaining({ key: "flag", reason: expect.stringContaining("was ignored") }),
    ]);
    expect(classified.conflicts).toEqual([]);
    expect(unacceptableWriteKeys(schema.fields, payload, "header")).toEqual([]);
    expect(omitMatchingSystemWriteKeys(schema.fields, payload)["flag"]).toBeUndefined();
    expect(omitMatchingSystemWriteKeys(schema.fields, payload)["name"]).toBe("Dress");
  });

  it("scribble True Refusal and say that the goods file is returned", () => {
    const payload = { name: "Dress", kind: "Finished goods", flag: true };
    const classified = classifyWriteEnvelope(schema.fields, payload);
    expect(classified.ignored).toEqual([]);
    expect(classified.conflicts).toHaveLength(1);
    expect(classified.conflicts[0]?.message).toContain("system-generated field");
    expect(classified.conflicts[0]?.message).not.toMatch(/wrote successfully/);
    expect(unacceptableWriteKeys(schema.fields, payload, "header")).toEqual(["flag"]);
  });

  it("undeclared Key still refuses", () => {
    expect(unacceptableWriteKeys(schema.fields, { name: "x", kind: "Finished goods", fooBar: 1 }, "header")).toEqual(["fooBar"]);
  });

  it("auto Single still refuses: cannot calculate the value to be written and cannot be returned to the same value Read it.", () => {
    expect(unacceptableWriteKeys(schema.fields, { name: "x", kind: "Finished goods", code: "ITEM20260101-001" }, "header")).toEqual([
      "code",
    ]);
    expect(classifyWriteEnvelope(schema.fields, { name: "x", kind: "Finished goods", code: "ITEM20260101-001" })).toEqual({
      ignored: [],
      conflicts: [],
    });
  });

  it("edit Inventory: The same as the library true is ignored and conflicted with false", () => {
    const stored = { name: "Suit", kind: "Finished goods", flag: true };
    const same = classifyWriteEnvelope(schema.fields, { flag: true }, "user", stored);
    expect(same.ignored.map((item) => item.key)).toEqual(["flag"]);
    expect(same.conflicts).toEqual([]);
    const steal = classifyWriteEnvelope(schema.fields, { flag: false }, "user", stored);
    expect(steal.ignored).toEqual([]);
    expect(steal.conflicts[0]?.message).toContain("system-generated field");
  });

  it("platform keys still do not enter the gate", () => {
    expect(unacceptableWriteKeys(schema.fields, { id: "x", status: "active", name: "n", kind: "Finished goods" }, "header")).toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// script pocket (KDocs#143)
//
// two at the scene, the cause was the same card contract.
// and "see that one" and stuff the machine in his head:
//
//   1 agent's bill create:
//   2 Open-create-confirm: Idem, but top-level lines are displays in Chinese Group
//      ["Property": "Silver Splash Targets Total", "Quantity": "20"}] So you hit a "lines must be the object" first --
//      it's in the same envelope.
// ---------------------------------------------------------------------------
const withLines = defineFixtureModule({
  code: "billLike",
  label: "A document with lines",
  domain: "test",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true },
    { key: "customerId", label: "Customer", type: "string" },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "billLikeLine",
      fields: [
        { key: "productId", label: "Product", type: "string", required: true },
        { key: "qty", label: "Quantity", type: "number", required: true },
      ],
    },
  ],
  lifecycle: singleState("draft", "draft", "gray"),
  views: {
    list: { columns: ["code"], filters: [] },
    form: [{ title: "Main", fields: ["code", "customerId"] }],
  },
});

const ROWS = [{ productId: "p-1", qty: 20 }, { productId: "p-2", qty: 100 }];

describe("hoistMisplaced Lines: in one shape without changing any value", () => {
  it("move back lines when they are directly row arrays", () => {
    const out = hoistMisplacedLines(withLines, { code: "B-1", lines: ROWS }, {});
    expect(out.moved).toEqual(["lines"]);
    expect(out.lines).toEqual({ lines: ROWS });
    expect(out.header).toEqual({ code: "B-1" });
    expect(out.droppedLines).toBe(false);
  });

  it("🔴 On-site version: header.lines.lines. Group", () => {
    const display = [{ Product: "Silver sputter target", Quantity: "20 pcs" }];
    const out = hoistMisplacedLines(withLines, { code: "B-2", lines: { lines: ROWS } }, display);
    expect(out.moved).toEqual(["lines"]);
    expect(out.lines).toEqual({ lines: ROWS });
    // the top one can't be a legitimate envelope, and the real line has been found.
    expect(out.droppedLines).toBe(true);
    expect(describeHoistedEnvelope(out).join("\n")).toContain("was discarded");
  });

  it("🔴 Both places give the same watch and don't move -- two conflicting statements.", () => {
    const explicit = { lines: [{ productId: "p-9", qty: 1 }] };
    const out = hoistMisplacedLines(withLines, { code: "B-3", lines: ROWS }, explicit);
    expect(out.moved).toEqual([]);
    expect(out.lines).toBe(explicit);
    expect(out.header).toEqual({ code: "B-3", lines: ROWS });
  });

  it("if you don't know the shape in the table, you can't guess.", () => {
    const out = hoistMisplacedLines(withLines, { code: "B-4", lines: "Two lines, 20 each" }, {});
    expect(out.moved).toEqual([]);
    expect(out.droppedLines).toBe(false);
  });

  it("🔴 When there's no detail in the table, you don't even touch illegal toplines -- let it report mistakes, and don't send an empty envelope.", () => {
    const display = [{ Product: "Silver sputter target" }];
    const out = hoistMisplacedLines(withLines, { code: "B-5" }, display);
    expect(out.moved).toEqual([]);
    expect(out.lines).toBe(display);
  });

  it("back as it is when you put it right, describe HoistedEnvelope is empty", () => {
    const given = { lines: ROWS };
    const out = hoistMisplacedLines(withLines, { code: "B-6" }, given);
    expect(out.moved).toEqual([]);
    expect(out.lines).toBe(given);
    expect(describeHoistedEnvelope(out)).toEqual([]);
  });

  it("no detailed module returns as it is -- it does not have the wrong pocket this time Yes.", () => {
    const out = hoistMisplacedLines(schema, { name: "Dress", lines: ROWS }, undefined);
    expect(out.moved).toEqual([]);
    expect(out.header).toEqual({ name: "Dress", lines: ROWS });
  });

  /**
   Online `bill_create salesOrder`：`lines.lines` To** a line object** instead of a row array,
   * All right, all right, all right, all right, all right, all right. `[]`"lines.lines must be arrays."
   * there is no morphological difference between a row and a row in a natural language, and it is inevitable that the brackets are missing from the model.
   */
  describe("only one line was given: a set of arrays, but empty objects were not.", () => {
    it("line objects are automatically handled by one line and reported as such", () => {
      const one = { productId: "p-1", qty: 2321, price: 26.34, unit: "set" };
      const out = hoistMisplacedLines(withLines, { code: "B-7" }, { lines: one });
      expect(out.wrapped).toEqual(["lines"]);
      expect(out.lines).toEqual({ lines: [one] });
      expect(describeHoistedEnvelope(out).join("\n")).toContain("even one row must be written as");
    });

    it("🔴 Blank object unset... `{}` It's a \"no detail.\"", () => {
      const given = { lines: {} };
      const out = hoistMisplacedLines(withLines, { code: "B-8" }, given);
      expect(out.wrapped).toEqual([]);
      expect(out.lines).toBe(given);
    });

    it("it's already the array.", () => {
      const given = { lines: ROWS };
      const out = hoistMisplacedLines(withLines, { code: "B-9" }, given);
      expect(out.wrapped).toEqual([]);
      expect(out.lines).toBe(given);
    });

    it("two layers of envelopes remain strayRows, not single lines", () => {
      const out = hoistMisplacedLines(withLines, { code: "B-10", lines: { lines: ROWS } }, {});
      expect(out.moved).toEqual(["lines"]);
      expect(out.wrapped).toEqual([]);
      expect(out.lines).toEqual({ lines: ROWS });
    });

    it("it's a single-line object that's in the table -- it's already numbered when you move. Group", () => {
      const one = { productId: "p-9", qty: 1 };
      const out = hoistMisplacedLines(withLines, { code: "B-11", lines: one }, {});
      expect(out.moved).toEqual(["lines"]);
      // arranged arrays in strayRows without repeating a numbered
      expect(out.wrapped).toEqual([]);
      expect(out.lines).toEqual({ lines: [one] });
      expect(out.header).toEqual({ code: "B-11" });
    });

    it("this type of string will remain unbridled.", () => {
      const given = { lines: "Two lines, 20 each" };
      const out = hoistMisplacedLines(withLines, { code: "B-12" }, given);
      expect(out.wrapped).toEqual([]);
      expect(out.lines).toBe(given);
    });
  });

  it("change the envelope to a patch, not a header.", () => {
    const out = hoistMisplacedLines(withLines, { lines: ROWS }, {});
    expect(describeHoistedEnvelope(out, "patch")[0]).toContain("patch.lines → lines.lines");
  });
});
