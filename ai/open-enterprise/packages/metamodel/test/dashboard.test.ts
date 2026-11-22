import { describe, expect, it } from "vitest";
import { defineDashboard, normalizeDashboard } from "../src/index.js";

const base = (card: Readonly<Record<string, unknown>>) => ({
  code: "home",
  label: "Home",
  version: "3.0.0",
  cards: [card],
  quickQuestions: [],
  shortcuts: [],
  reportTeaser: false,
});

describe("dashboard v3 declaration", () => {
  it("radio integration can be repeated and areas of support loaded in order of define Domain and loader", () => {
    const once = defineDashboard(base({
      key: "rate",
      label: "Completion rate",
      unit: "%",
      measure: {
        type: "ratio",
        numerator: { type: "count", module: "task", filters: [] },
        denominator: { type: "count", module: "task", filters: [] },
      },
      compare: { basis: "previous_day", unavailable: "No snapshot for yesterday" },
      betterWhen: "higher",
      severity: "auto",
    }));

    expect(normalizeDashboard(once)).toEqual(once);
    expect(once.cards[0]).toMatchObject({
      measure: { type: "ratio", precision: 1 },
      compare: { basis: "previous_day", unavailable: "No snapshot for yesterday" },
    });
  });

  it("rejection of indicators that cannot be even by date but claim yesterday's value", () => {
    expect(() => defineDashboard(base({
      key: "rate",
      label: "Completion rate",
      unit: "%",
      measure: { type: "count", module: "task", filters: [] },
      compare: "previous_day",
      betterWhen: "higher",
      severity: "auto",
    }))).toThrow("this measure cannot reconstruct yesterday's value");
  });

  it("rejects old target fields to prevent uncalculated targets from re-entering the protocol", () => {
    expect(() => defineDashboard(base({
      key: "rate",
      label: "Completion rate",
      unit: "%",
      measure: { type: "unsupported", reason: "No measure yet" },
      compare: null,
      target: { value: 80, label: "Target 80%" },
      severity: "auto",
    }))).toThrow(/unknown key "target"/);
  });

  it("allow Dashboard to repeat the order delivery cycle frozen in daily newspapers and not recalculate the calibration on a real-time path", () => {
    const dashboard = defineDashboard(base({
      key: "averageDeliveryCycle",
      label: "Average order lead time",
      unit: "days",
      measure: { type: "snapshot", source: "dailyReport", field: "averageDeliveryCycleDays" },
      compare: "previous_day",
      betterWhen: "lower",
      severity: "auto",
    }));

    expect(dashboard.cards[0]?.measure).toEqual({
      type: "snapshot",
      source: "dailyReport",
      field: "averageDeliveryCycleDays",
    });
  });
});
