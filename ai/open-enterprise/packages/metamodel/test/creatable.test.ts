import { describe, expect, it } from "vitest";
import { defineFixtureModule, normalizeFixtureModule, withPushOrigins, type ModuleSchema } from "../src/index.js";

/**
 * `ModuleSchema.creatable` - Where does this module come from?
 *
 :: With `postsToLedger` It's the same rule. It's not. `MODULE_KEYS` In there, the statement will be closed.
 * two sources have two layers of vision, one of which nails both -- one of the first, "no one can build data."
 * the module header is in the menu, there is a list page, there is a "New" button, and the point-in is not filled in by a user.
 * there is no single word on the screen that says why.
 */

function moduleWith(lines: readonly unknown[], extra: Record<string, unknown> = {}): unknown {
  return {
    code: "alpha",
    label: "Document A",
    domain: "d1",
    numbering: { prefix: "A", seqScope: "day" },
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true, auto: true },
      { key: "partyId", label: "Counterparty", type: "ref", ref: "party", required: true },
      { key: "lines", label: "Lines", type: "subtable", ref: "alphaLine", fields: lines },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", initial: true },
        { key: "done", terminal: true },
      ],
      transitions: [{ code: "done", from: "draft", to: "done", action: "Close out" }],
    },
    views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "partyId", "lines"] }] },
    ...extra,
  };
}

const PLAIN_LINE = [{ key: "qty", label: "Quantity", type: "number", required: true }];

/** A legal refLine plus its companion ref. The caller decides `required`, and both sides use the same tier. */
function refLineColumns(required: boolean): readonly unknown[] {
  return [
    { key: "orderId", label: "Order", type: "ref", ref: "beta", required },
    { key: "orderLineId", label: "Order line", type: "refLine", ref: "beta", through: "lines", required },
    { key: "qty", label: "Quantity", type: "number", required: true },
  ];
}

/** The only shape that can block a new handmade shape: accompanying ref to fill and pair to leave blank */
const BLOCKED_LINE: readonly unknown[] = [
  { key: "orderId", label: "Order", type: "ref", ref: "beta", required: true },
  { key: "orderLineId", label: "Order line", type: "refLine", ref: "beta", through: "lines" },
  { key: "qty", label: "Quantity", type: "number", required: true },
];

describe("manually buildable: mandatory fields for which the renderer cannot provide value", () => {
  it("the normal fields are filled out by users.", () => {
    expect(normalizeFixtureModule(moduleWith(PLAIN_LINE)).creatable.manual).toBe(true);
  });

  it("🔴 Both have to be filled in. Manually built: singles take back line at a time id, accompanied by join from resolveRefs", () => {
    // this is a symmetrical flip after the drop of the "two-part menur": formerly refLine was
    // `NO_MANUAL_INPUT_TYPES` In, this shape is manual: false.
    // when the tunnel was built, there was only one verdict -- ** to fill in the rest of it.
    // and "line quotes" is the guarantee of the source: the user has to choose a line and the service has to fill it in.
    const { creatable } = normalizeFixtureModule(moduleWith(refLineColumns(true)));
    expect(creatable.manual).toBe(true);
    expect(creatable.blockers).toEqual([]);
  });

  it("🔴 Ref + Unrefillable refLine platinum still cannot be built (this is not about rendering channels, it is permanent)", () => {
    // the value of the accompanying column is only added from the jump of join in refLine, and the client is not allowed to write; line references leave space.
    // This column has no source. The entire system supply field is checked by the gate.`fillable`），
    // so it's not 400, it's PG's NOT NULL -- a user input problem becomes 500 that doesn't understand.
    //
    // This is the one on which we rely:`NO_MANUAL_INPUT_TYPES` The first type of output is not produced after it is empty.
    // and these are the holes in the declaration itself, and none of the retrofitting powers can be filled. Let's go.
    const { creatable } = normalizeFixtureModule(moduleWith(BLOCKED_LINE));
    expect(creatable.manual).toBe(false);
    expect(creatable.blockers.map((b) => b.path)).toEqual(["lines.orderId"]);
    // the report will tell you how to fix it.
    expect(creatable.blockers[0]?.why).toContain("also make");
  });

  it("both of them have to be filled.", () => {
    expect(normalizeFixtureModule(moduleWith(refLineColumns(false))).creatable.manual).toBe(true);
  });

  it("the statement was rejected by the 7th concept -- it's extrapolation, not declaration.", () => {
    expect(() => normalizeFixtureModule(moduleWith(PLAIN_LINE, { creatable: { manual: true } }))).toThrow(/creatable/);
  });

  it("to fill +systemGenerated zirconium (write path supply, user has no access)", () => {
    const { creatable } = normalizeFixtureModule(
      moduleWith(PLAIN_LINE, {
        fields: [
          { key: "code", label: "Document number", type: "string", primary: true, auto: true },
          { key: "partyId", label: "Counterparty", type: "ref", ref: "party", required: true },
          { key: "syncedAt", label: "Synced at", type: "datetime", required: true, systemGenerated: true },
          { key: "lines", label: "Lines", type: "subtable", ref: "alphaLine", fields: PLAIN_LINE },
        ],
      }),
    );
    expect(creatable.manual).toBe(false);
    expect(creatable.blockers.map((b) => b.path)).toEqual(["syncedAt"]);
    expect(creatable.blockers[0]?.why).toContain("supplied by the server write path");
  });
});

describe("buildable below: only the whole sheet can be seen", () => {
  const source = (push: unknown | null): ModuleSchema =>
    defineFixtureModule({
      code: "beta",
      label: "Document B",
      domain: "d1",
      numbering: { prefix: "B", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        { key: "lines", label: "Lines", type: "subtable", ref: "betaLine", fields: PLAIN_LINE },
      ],
      lifecycle: {
        statuses: [
          { key: "draft", initial: true },
          { key: "done", terminal: true },
        ],
        transitions: [
          push === null
            ? { code: "go", from: "draft", to: "done", action: "Close out" }
            : { code: "go", from: "draft", to: "done", action: "Push document A", push },
        ],
      },
      views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "lines"] }] },
    });

  // target intentionally uses the shape that can't be built** (must fill in the companion ref + non-refline):
  // "Manual:false's the only way to make it."
  // the target will prove it, and the last assertion will be empty because of the manual truth.
  const target = (): ModuleSchema => defineFixtureModule(moduleWith(BLOCKED_LINE));

  it("🔴 PushedFrom in a single module view is nuld, not[ ] -- the syntax is the opposite", () => {
    // `[]` It's "I checked, no one pushed it."`null` It's "not checked in the module list."
    // Degraded. `[]` A modular sheet that omits assembly steps will make each module look like an impossible one.
    // and that's what the interface will do.
    expect(target().creatable.pushedFrom).toBeNull();
  });

  it("\"Who's side\" will be filled back in after assembly.", () => {
    const [beta, alpha] = withPushOrigins([source("alpha"), target()]);
    expect(alpha?.creatable.pushedFrom).toEqual([
      { module: "beta", moduleLabel: "Document B", transition: "go", action: "Push document A" },
    ]);
    // no one in turn pushed it to the B: Checked it, no.
    expect(beta?.creatable.pushedFrom).toEqual([]);
  });

  it("write generatedOnly Directly; Normal push does not add but generate blocker", () => {
    expect(() => source({ module: "alpha", generatedOnly: true })).toThrow(
      /a Planner-produced target is generated only/,
    );
    const [beta, alpha] = withPushOrigins([
      source("alpha"),
      normalizeFixtureModule(moduleWith(PLAIN_LINE)),
    ]);
    expect(alpha?.creatable.manual).toBe(true);
    expect(alpha?.creatable.blockers).toEqual([]);
    expect(alpha?.creatable.pushedFrom).toEqual([
      { module: "beta", moduleLabel: "Document B", transition: "go", action: "Push document A" },
    ]);
    expect(beta?.creatable.manual).toBe(true);
  });

  it("planner Generating Paths and Transtion.push Walking Together and Heavy", () => {
    const [beta, alpha] = withPushOrigins([source("alpha"), target()], [
      { target: "alpha", module: "beta", moduleLabel: "Document B", transition: "go", action: "Push document A" },
      {
        target: "alpha",
        module: "gamma",
        moduleLabel: "Document C",
        transition: "make",
        action: "Create document A",
      },
    ]);
    expect(alpha?.creatable.pushedFrom).toEqual([
      { module: "beta", moduleLabel: "Document B", transition: "go", action: "Push document A" },
      { module: "gamma", moduleLabel: "Document C", transition: "make", action: "Create document A" },
    ]);
    expect(beta?.creatable.pushedFrom).toEqual([]);
    expect(alpha?.creatable.manual).toBe(false);
    expect(alpha?.creatable.blockers).toContainEqual(expect.objectContaining({
      path: "creatable",
      why: expect.stringContaining("generated by the system only from confirmed source-document facts"),
    }));
  });

  it("there's no push pointing at it.", () => {
    const [, alpha] = withPushOrigins([source(null), target()]);
    expect(alpha?.creatable).toMatchObject({ manual: false, pushedFrom: [] });
  });

  it("🔴 There's only the mandatory quote \"directed upstream\" and the initial state locks it.", () => {
    // the category of receivables: clients/values/dates are snapshots, hand-made only a bill of account,
    // and the white list does not let go of that — equal to the absence of artificial billing channels.
    const pushOnlyTarget = (): ModuleSchema =>
      defineFixtureModule({
        code: "alpha",
        label: "Document A",
        domain: "d1",
        numbering: { prefix: "A", seqScope: "day" },
        fields: [
          { key: "code", label: "Document number", type: "string", primary: true, auto: true },
          { key: "sourceId", label: "Source document B", type: "ref", ref: "beta", required: true },
          {
            key: "partyId",
            label: "Counterparty",
            type: "ref",
            ref: "party",
            snapshot: { from: "beta", match: "sourceId", through: null, field: "partyId" },
          },
          { key: "remark", label: "Remark", type: "text" },
        ],
        lifecycle: {
          statuses: [
            {
              key: "draft",
              initial: true,
              editable: "whitelist",
              editableFields: ["remark"],
            },
            { key: "done", terminal: true },
          ],
          transitions: [{ code: "done", from: "draft", to: "done", action: "Close out" }],
        },
        views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "sourceId", "partyId"] }] },
      });

    const [beta, alpha] = withPushOrigins([source("alpha"), pushOnlyTarget()]);
    expect(alpha?.creatable.manual).toBe(false);
    expect(alpha?.creatable.blockers.map((b) => b.path)).toEqual(["sourceId"]);
    expect(alpha?.creatable.pushedFrom).toEqual([
      { module: "beta", moduleLabel: "Document B", transition: "go", action: "Push document A" },
    ]);
    // i can still build it myself.
    expect(beta?.creatable.manual).toBe(true);
  });
});
