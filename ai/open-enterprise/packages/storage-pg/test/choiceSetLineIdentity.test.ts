import { describe, expect, it } from "vitest";
import { replacementLineIdentities } from "../src/repo/billRepo.js";
import { unchangedExistingLineValue } from "../src/repo/choiceSetRepo.js";

const existing = {
  lines: [
    { id: "line-a", lineNo: 1, costType: "retiredA", remark: "A" },
    { id: "line-b", lineNo: 2, costType: "active", remark: "B" },
  ],
} as const;
const byId = new Map(existing.lines.map((row) => [row.id, row]));

describe("line choiceSet history is judged by stable line identity", () => {
  it("after the first line is deleted, a disabled code cannot move onto the old second line through the new array index", () => {
    const next = { id: "line-b", costType: "retiredA", remark: "B" };
    expect(unchangedExistingLineValue(next, byId, "costType")).toBe(false);
  });

  it("reordering does not block saving the same line's original value, and a replaced or new line has no exemption", () => {
    expect(unchangedExistingLineValue(
      { id: "line-a", costType: "retiredA", remark: "other field changed" },
      byId,
      "costType",
    )).toBe(true);
    expect(unchangedExistingLineValue({ id: "line-b", costType: "retiredA" }, byId, "costType")).toBe(false);
    expect(unchangedExistingLineValue({ costType: "retiredA" }, byId, "costType")).toBe(false);
  });

  it("an id in the update envelope must belong to this bill's same line table, and must not be repeated", () => {
    expect(replacementLineIdentities(
      { lines: [{ id: "line-b", costType: "active" }, { costType: "active" }] },
      existing,
      "Save test bill",
    ).get("lines")).toEqual(new Set(["line-b"]));

    expect(() => replacementLineIdentities(
      { lines: [{ id: "foreign-line", costType: "active" }] },
      existing,
      "Save test bill",
    )).toThrow(/does not belong to the current document/);
    expect(() => replacementLineIdentities(
      { lines: [{ id: "line-a", costType: "retiredA" }, { id: "line-a", costType: "retiredA" }] },
      existing,
      "Save test bill",
    )).toThrow(/more than once/);
  });
});
