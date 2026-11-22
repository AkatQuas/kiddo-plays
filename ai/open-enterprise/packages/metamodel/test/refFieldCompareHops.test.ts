// ---------------------------------------------------------------------------
// `ref_field_compare` Two jumps. `via` - Upstream.
//
// two kinds of real card points that can't be answered:
//   • Sequenced production: this track can be measured ** Front track** qualified. The road ahead is in the order of the task.
//     from the list, the job is assigned to the task course - two jumps.
//   • Document flow: “Customs of invoices must be equal to those from which the bill of deposit is drawn”, “Has the upcoming parade in this business closed?”
//
// the only way around was to add a snapshot to the downstream list and freeze down the upper one: an extra column of storage,
// one more source, and the snapshot is the value of the moment ** was carried out, and the upstream changes were not the same.
//
// 🔴 Depth** hard cap 2**, not "sufficient" but ** two jumps are still static **:
// Every jump is written in the statement.`checkCrossReferences` It's not here.
// Whether the module to which you refer is the same as the next drop point;`describe` And print the complete path.
// three jumps, one drop, one set, one set, the gate, one look.
// And the full value of the original language is that. Deeper connection. `derive.lookup`。
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  checkDependencies,
  describeCheck,
  evaluateTransition,
  fieldLabelsOf,
  normalizeFixtureModule,
  validateModule,
  type RuleQuery,
} from "../src/index.js";

const NOW = new Date("2026-08-05T00:00:00Z");

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

/*:: Completion of the warehouse: the warehouse must be equivalent to the completed warehouse on the "Property Task " , its source order */
function receipt(check: Record<string, unknown>): Raw {
  return structuredClone({
    code: "receipt",
    label: "Finished-goods receipt",
    domain: "productionReceive",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "taskId", label: "Production task", type: "ref", ref: "task", required: true },
      { key: "warehouseId", label: "Receipt warehouse", type: "ref", ref: "warehouse", required: true },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "done", label: "Received", terminal: true },
      ],
      transitions: [{ code: "confirm", from: "draft", to: "done", action: "Confirm receipt" }],
    },
    preconditions: [
      {
        id: "warehouse_matches_order",
        onTransition: "confirm",
        source: "gate",
        level: "block",
        why: "Finished goods must enter the completion warehouse named on the order",
        check,
      },
    ],
    views: { list: { columns: ["code"] } },
  }) as Raw;
}

const TWO_HOP = {
  primitive: "ref_field_compare",
  via: "$bill.taskId.sourceOrderId",
  entity: "task",
  through: null,
  then: { entity: "order", through: null },
  field: "completionWarehouseId",
  op: "eq",
  right: { ref: "$bill.warehouseId" },
};

describe("two Jumps via: Declarion Layer", () => {
  it("🔴 Two jumps is valid without prejudice to the static verification of this module (via the first paragraph remains the same on this list)", () => {
    expect(validateModule(normalizeFixtureModule(receipt(TWO_HOP))).errors).toEqual([]);
  });

  it("not a single word has changed.", () => {
    const one = {
      primitive: "ref_field_compare",
      via: "$bill.taskId",
      entity: "task",
      through: null,
      field: "status",
      op: "eq",
      right: { value: "inProgress" },
    };
    const module = normalizeFixtureModule(receipt(one));
    expect(validateModule(module).errors).toEqual([]);
    const check = module.preconditions[0]?.check;
    expect((check?.params as { then: unknown }).then).toBeNull();
  });

  it("🔴 Three jumps are rejected in the modelling period, and they say why not let go later?", () => {
    expect(() =>
      normalizeFixtureModule(receipt({ ...TWO_HOP, via: "$bill.taskId.sourceOrderId.customerId" })),
    ).toThrow(/the cap is 2/);
    expect(() =>
      normalizeFixtureModule(receipt({ ...TWO_HOP, via: "$bill.taskId.sourceOrderId.customerId" })),
    ).toThrow(/derive\.lookup/);
  });

  it("The depth cap is structural:`then` One more jump in there.", () => {
    expect(() =>
      normalizeFixtureModule(
        receipt({ ...TWO_HOP, then: { entity: "order", through: null, then: { entity: "customer", through: null } } }),
      ),
    ).toThrow();
  });

  it("paths and droppoints must be paired: two sections of path are not then ⇒ rejected (no module to be counted when requesting value)", () => {
    const { then: _drop, ...withoutHop } = TWO_HOP;
    expect(() => normalizeFixtureModule(receipt(withoutHop))).toThrow(/two-hop path/);
  });

  it("inversely: give it to then, but write only one path.", () => {
    expect(() => normalizeFixtureModule(receipt({ ...TWO_HOP, via: "$bill.taskId" }))).toThrow(/only one hop/);
  });

  it("🔴 You're gonna have to recognize two of them.", () => {
    const check = normalizeFixtureModule(receipt(TWO_HOP)).preconditions[0]?.check;
    expect(check).toBeTruthy();
    if (!check) return;
    expect(checkDependencies(check).externalFields).toEqual([
      { module: "task", field: "sourceOrderId" },
      { module: "order", field: "completionWarehouseId" },
    ]);
  });

  it("describe print** complete path** -- only the end of the print will allow people to find their own non-existent production orders.", () => {
    const module = normalizeFixtureModule(receipt(TWO_HOP));
    const check = module.preconditions[0]?.check;
    if (!check) return;
    const text = describeCheck(check, fieldLabelsOf(module, module.lifecycle.transitions[0]!));
    expect(text).toContain('"Production task" points to task');
    expect(text).toContain("field \"sourceOrderId\" points to order");
    expect(text).toContain("completionWarehouseId");
  });
});

describe("two jumps to via: value", () => {
  /*:: Two tables: task#t-1 — order#o-1 */
  const store: Record<string, Record<string, Record<string, unknown>>> = {
    task: {
      "t-1": { id: "t-1", sourceOrderId: "o-1" },
      "t-orphan": { id: "t-orphan", sourceOrderId: null },
      "t-dangling": { id: "t-dangling", sourceOrderId: "o-gone" },
    },
    order: {
      "o-1": { id: "o-1", completionWarehouseId: "wh-1" },
    },
  };

  const query: RuleQuery = {
    get: async (entity, id) => store[entity]?.[String(id)] ?? null,
    list: async () => [],
    balance: async () => {
      throw new Error("this case must not query a balance");
    },
  };

  const decide = async (bill: Record<string, unknown>) =>
    (
      await evaluateTransition(
        {
          module: normalizeFixtureModule(receipt(TWO_HOP)),
          bill: { id: "r-1", status: "draft", ...bill },
          lines: [],
          params: {},
          actor: {},
          now: NOW,
          query,
        },
        "confirm",
      )
    ).checks.find((c) => c.id === "warehouse_matches_order");

  it("both jumps walk, worth the same.", async () => {
    expect((await decide({ taskId: "t-1", warehouseId: "wh-1" }))?.ok).toBe(true);
  });

  it("both jumps are of varying value, and the main word is the finish line**", async () => {
    const hit = await decide({ taskId: "t-1", warehouseId: "wh-2" });
    expect(hit?.ok).toBe(false);
    expect(hit?.detail).toContain("points to order");
    expect(hit?.detail).toContain("wh-1");
  });

  it("🔴 The first jump is empty, fail-closed, saying ** on the list**", async () => {
    const hit = await decide({ taskId: null, warehouseId: "wh-1" });
    expect(hit?.ok).toBe(false);
    expect(hit?.detail).toContain('"Production task" is blank');
  });

  it("🔴 The second jump is empty, fail-closed, saying ** Upstream ** - two sentences, two modifications", async () => {
    const hit = await decide({ taskId: "t-orphan", warehouseId: "wh-1" });
    expect(hit?.ok).toBe(false);
    // break to the second jump: the main phrase must be the one that points to the production task first.
    expect(hit?.detail).toContain('"Production task" points to task');
    expect(hit?.detail).toContain("\"sourceOrderId\" is blank");
    // 🔴 Don't turn into the first jump: the user will add a production task that is not empty on his own form.
    expect(hit?.detail).not.toContain('"Production task" is blank');
  });

  it("the second jump points to a record that doesn't exist.", async () => {
    const hit = await decide({ taskId: "t-dangling", warehouseId: "wh-1" });
    expect(hit?.ok).toBe(false);
    expect(hit?.detail).toContain("\"sourceOrderId\" points to order#o-gone does not exist");
  });
});
