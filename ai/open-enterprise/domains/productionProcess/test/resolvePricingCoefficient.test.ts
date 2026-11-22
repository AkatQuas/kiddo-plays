import { describe, expect, it } from "vitest";

import { resolveWorkerPricingCoefficient } from "../modules/processReport/resolvePricingCoefficient.js";

describe("resolveWorkerPricingCoefficient", () => {
  it("prefers the coefficient on the matching default-operation line", () => {
    expect(
      resolveWorkerPricingCoefficient(
        {
          header: { pricingCoefficient: 1.2 },
          lines: {
            defaultOperations: [
              { operationId: "op-a", pricingCoefficient: 1.5 },
              { operationId: "op-b", pricingCoefficient: 2 },
            ],
          },
        },
        "op-b",
      ),
    ).toBe(2);
  });

  it("falls back to the worker header when the matching line has an empty coefficient", () => {
    expect(
      resolveWorkerPricingCoefficient(
        {
          header: { pricingCoefficient: 1.2 },
          lines: { defaultOperations: [{ operationId: "op-a", pricingCoefficient: null }] },
        },
        "op-a",
      ),
    ).toBe(1.2);
  });

  it("uses the worker header when no line matches; returns null when both are empty", () => {
    expect(
      resolveWorkerPricingCoefficient(
        {
          header: { pricingCoefficient: 1.2 },
          lines: { defaultOperations: [{ operationId: "op-a", pricingCoefficient: 2 }] },
        },
        "op-other",
      ),
    ).toBe(1.2);
    expect(
      resolveWorkerPricingCoefficient({ header: {}, lines: {} }, "op-a"),
    ).toBeNull();
  });
});
