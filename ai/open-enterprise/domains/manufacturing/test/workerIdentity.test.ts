import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import workerDraft from "../modules/worker.js";

const worker = sealModule(workerDraft, { code: "worker", domain: "manufacturing" });

describe("Production worker platform identity binding", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(worker).errors).toEqual([]);
  });

  it("the team is required on create and nullable once stored, so the organization side can detach the worker", () => {
    const productionOrgId = worker.fields.find((field) => field.key === "productionOrgId");
    expect(productionOrgId).toMatchObject({
      type: "ref",
      ref: "orgUnit",
      required: false,
      requiredOnManualCreate: true,
    });
  });

  it("pricing coefficient: the header is hidden and not on the form; the default operation line can be filled; the empty-means-1 gate is in the wage report and the resolve test", () => {
    expect(worker.fields.find((field) => field.key === "pricingCoefficient")).toMatchObject({
      type: "number",
      required: false,
      hidden: true,
    });
    expect(worker.views.form.some((section) => section.fields.includes("pricingCoefficient"))).toBe(false);
    const defaultOps = worker.fields.find((field) => field.key === "defaultOperations");
    const lineCoef = defaultOps?.fields?.find((field) => field.key === "pricingCoefficient");
    expect(lineCoef).toMatchObject({
      type: "number",
      required: false,
      defaultFrom: { header: "pricingCoefficient" },
    });
    expect(lineCoef?.hidden).not.toBe(true);
  });

  it("platform userId is a queryable, searchable person-binding fact", () => {
    const platformUserId = worker.fields.find((field) => field.key === "platformUserId");
    expect(platformUserId).toMatchObject({
      type: "ref",
      ref: "subject",
      required: false,
      unique: true,
      derive: null,
      refFilter: { status: "active" },
      person: { role: "owner", via: "self" },
    });
    expect(worker.views.list.columns).toContain("platformUserId");
    expect(worker.views.list.searchable).toContain("platformUserId");
  });
});
