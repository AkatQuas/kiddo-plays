import { describe, expect, it } from "vitest";
import { allocateBaseQuantity, allocateHoursByQuantity } from "@open-erp/metamodel";

describe("Splitting one quantity across several workers", () => {
  it("an even split keeps six decimal places and the last worker absorbs the remainder", () => {
    expect(allocateBaseQuantity(10, "Split evenly", [
      { workerId: "a" },
      { workerId: "b" },
      { workerId: "c" },
    ])).toEqual([
      { workerId: "a", baseQty: 3.333333 },
      { workerId: "b", baseQty: 3.333333 },
      { workerId: "c", baseQty: 3.333334 },
    ]);
  });

  it("a sequential split fills each worker up to that worker's cap", () => {
    expect(allocateBaseQuantity(10, "Split in sequence", [
      { workerId: "a", baseQty: 4 },
      { workerId: "b", baseQty: 8 },
      { workerId: "c", baseQty: 3 },
    ])).toEqual([
      { workerId: "a", baseQty: 4 },
      { workerId: "b", baseQty: 6 },
    ]);
  });

  it("a free split is rejected when the quantities do not add up", () => {
    expect(() => allocateBaseQuantity(10, "Split freely", [
      { workerId: "a", baseQty: 4 },
      { workerId: "b", baseQty: 5 },
    ])).toThrow("must equal the quantity to allocate");
  });

  it("a repeated worker, or caps that cannot cover the quantity, is rejected", () => {
    expect(() => allocateBaseQuantity(10, "Split evenly", [
      { workerId: "a" },
      { workerId: "a" },
    ])).toThrow("cannot select assignee");
    expect(() => allocateBaseQuantity(10, "Split in sequence", [
      { workerId: "a", baseQty: 9 },
    ])).toThrow("capacity is insufficient");
  });

  it("hours are split by reported quantity and the last share absorbs the remainder", () => {
    expect(allocateHoursByQuantity(1, [1, 1, 1])).toEqual([0.333333, 0.333333, 0.333334]);
  });
});
