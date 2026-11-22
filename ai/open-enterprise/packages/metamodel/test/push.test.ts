import { describe, expect, it } from "vitest";
import { normalizeTransition } from "../src/index.js";

const edge = (push: unknown) => ({
  code: "generate",
  from: "draft",
  to: "done",
  action: "Generate",
  push,
});

describe("transtion.push Normalization", () => {
  it("keep string semantics and standardize a pair of fine maps of objects into the only real source", () => {
    const stringPush = normalizeTransition(edge("target"));
    expect(stringPush).toMatchObject({
      push: "target",
      pushLine: null,
    });
    const objectPush = normalizeTransition(edge({
      module: "target",
      line: { source: "requestLines", target: "operationLines" },
    }));
    expect(objectPush).toMatchObject({
      push: "target",
      pushLine: { source: "requestLines", target: "operationLines" },
    });
  });

  it("object and line are closed shapes and do not accept multiple arrays or second mapping", () => {
    expect(() => normalizeTransition(edge({ module: "target", line: [{ source: "a", target: "b" }] }))).toThrow(
      /push\.line.*object/,
    );
    expect(() => normalizeTransition(edge({
      module: "target",
      line: { source: "a", target: "b", another: { source: "c", target: "d" } },
    }))).toThrow(/push\.line.*unknown key.*another/);
    expect(() => normalizeTransition(edge({ module: "target", lines: { source: "a", target: "b" } }))).toThrow(
      /push.*unknown key.*lines/,
    );
  });

  it("write rejected Only, object form has no line and refused", () => {
    const forbidden = /a Planner-produced target is generated only\. It must not be written by hand/;
    for (const push of [
      { module: "target", generatedOnly: true },
      { module: "target", generatedOnly: false },
      { module: "target", generatedOnly: "yes" },
      { module: "target", line: { source: "a", target: "b" }, generatedOnly: true },
    ]) {
      let thrown: unknown;
      try {
        normalizeTransition(edge(push));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      if (!(thrown instanceof Error)) throw new Error("generatedOnly must be rejected directly");
      expect(thrown.message).toMatch(forbidden);
      expect(thrown.message).not.toContain("unknown key");
    }
    expect(() => normalizeTransition(edge({ module: "target" }))).toThrow(
      /the object form must declare line; otherwise write the module code as a string/,
    );
  });

  it("remaining is null, empty string rejected", () => {
    expect(normalizeTransition(edge("target")).remaining).toBeNull();
    expect(normalizeTransition({ ...edge("target"), remaining: "lines.openQty" }).remaining).toBe("lines.openQty");
    expect(() => normalizeTransition({ ...edge("target"), remaining: "" })).toThrow(/remaining/);
  });
});
