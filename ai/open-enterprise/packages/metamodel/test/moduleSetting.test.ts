import { describe, expect, it } from "vitest";
import { defineFixtureDomain, normalizeModuleSetting } from "../src/index.js";

const RAW = {
  code: "production.taskCompletionMode",
  module: "productionTask",
  label: "How the production task is completed",
  description: "Decides how a newly released task is completed.",
  effectiveWhen: "Tasks released after save take effect.",
  defaultOption: "manual",
  options: [
    { code: "manual", label: "Manual confirm", description: "Confirmed by the owner." },
    { code: "automatic", label: "Auto complete" },
  ],
} as const;

describe("module Settings for Code Declaration", () => {
  it("full retention of code branches, defaults and the modules to which they belong, unwritten options for description to be full", () => {
    expect(normalizeModuleSetting(RAW)).toEqual({
      ...RAW,
      changeGuard: null,
      options: [
        RAW.options[0],
        { ...RAW.options[1], description: null },
      ],
    });
  });

  it("domain default is not set and set code within the same domain cannot repeat", () => {
    expect(defineFixtureDomain({ code: "demo", label: "Demo" }).moduleSettings).toEqual([]);
    expect(() => defineFixtureDomain({
      code: "demo",
      label: "Demo",
      moduleSettings: [RAW, RAW],
    })).toThrow(/moduleSettings declared "production.taskCompletionMode" more than once/);
  });

  it("only true multiple branches are allowed as settings, and the default value must belong to the realized option", () => {
    expect(() => normalizeModuleSetting({ ...RAW, options: [RAW.options[0]] })).toThrow(/at least two implemented branches/);
    expect(() => normalizeModuleSetting({ ...RAW, defaultOption: "invented" })).toThrow(/is not in options/);
    expect(() => normalizeModuleSetting({
      ...RAW,
      options: [RAW.options[0], { code: "manual", label: "Another manual branch" }],
    })).toThrow(/declared "manual" more than once/);
  });

  it("set coordinates and object keys to close, not to insert any configuration into the statement while running", () => {
    expect(() => normalizeModuleSetting({ ...RAW, code: "taskCompletionMode" })).toThrow(/dotted lowerCamel/);
    expect(() => normalizeModuleSetting({ ...RAW, runtimeField: true })).toThrow(/unknown key/);
    expect(() => normalizeModuleSetting({
      ...RAW,
      options: [...RAW.options, { code: "third", label: "Manual confirm" }],
    })).toThrow(/declared "Manual confirm" more than once/);
    expect(() => normalizeModuleSetting({
      ...RAW,
      changeGuard: { kind: "invented", module: "productionTask" },
    })).toThrow(/changeGuard.kind accepts only/);
  });

  it("retain module coordinates setting unsolved files before change", () => {
    expect(normalizeModuleSetting({
      ...RAW,
      changeGuard: { kind: "noOpenBills", module: "productionOrder" },
    }).changeGuard).toEqual({ kind: "noOpenBills", module: "productionOrder" });
  });
});
