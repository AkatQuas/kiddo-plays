import { describe, expect, it } from "vitest";
import { applyCreateDefaultByChange, applyCreateDefaults, defineFixtureModule, singleState, validateModule } from "../src/index.js";

const schema = defineFixtureModule({
  code: "workLog",
  label: "Work record",
  domain: "test",
  fields: [
    { key: "code", label: "Number", type: "string", primary: true },
    { key: "businessDate", label: "Business date", type: "date", createDefault: "today" },
    { key: "reportedAt", label: "Report time", type: "datetime", createDefault: "now" },
  ],
  lifecycle: singleState("active", "Active", "green"),
  views: { list: { columns: ["code", "businessDate"], filters: [], searchable: ["code"] }, form: [{ title: "Record", fields: ["code", "businessDate", "reportedAt"] }] },
});

describe("createDefault", () => {
  it("today/now by operational time zone, visible value priority", () => {
    const now = new Date("2026-08-05T16:30:00.000Z");
    const result = applyCreateDefaults(schema, { reportedAt: "2026-08-01T00:00:00.000Z" }, {}, now, "Asia/Shanghai");
    expect(result.header["businessDate"]).toBe("2026-08-06");
    expect(result.header["reportedAt"]).toBe("2026-08-01T00:00:00.000Z");
  });

  it("visible Null means that the user is emptied and is not covered by default Back", () => {
    const result = applyCreateDefaults(schema, { reportedAt: null }, {}, new Date("2026-08-05T08:00:00.000Z"), "Asia/Shanghai");
    expect(result.header["reportedAt"]).toBeNull();
  });

  it("deny the default semantics to the wrong field type", () => {
    expect(() =>
      defineFixtureModule({
        code: "badDefault",
        label: "Wrong default",
        domain: "test",
        fields: [{ key: "name", label: "Name", type: "string", primary: true, createDefault: "today" }],
        lifecycle: singleState("active", "Active", "green"),
        views: { list: { columns: ["name"], filters: [], searchable: [] }, form: [{ title: "Info", fields: ["name"] }] },
      }),
    ).toThrow(/may be attached only to a date field/);
  });

  it("closed classification is required to give default value, visible overlay always priority", () => {
    const capability = defineFixtureModule({
      code: "capabilityDefault",
      label: "Capability default",
      domain: "test",
      fields: [
        { key: "code", label: "Number", type: "string", primary: true },
        { key: "kind", label: "Category", type: "enum", options: ["Finished goods", "Material"], required: true },
        {
          key: "canSell",
          label: "Sellable",
          type: "bool",
          required: true,
          createDefaultBy: { field: "kind", values: { "Finished goods": true, "Material": false } },
        },
      ],
      lifecycle: singleState("active", "Active", "green"),
      views: { list: { columns: ["code", "kind", "canSell"], filters: [], searchable: [] }, form: [{ title: "Info", fields: ["code", "kind", "canSell"] }] },
    });
    expect(validateModule(capability).errors).toEqual([]);
    expect(applyCreateDefaults(capability, { kind: "Finished goods" }, {}, new Date(), "UTC").header["canSell"]).toBe(true);
    expect(applyCreateDefaults(capability, { kind: "Finished goods", canSell: false }, {}, new Date(), "UTC").header["canSell"]).toBe(false);
    expect(applyCreateDefaultByChange(capability.fields, { kind: "Material", canSell: false }, { kind: "Finished goods", canSell: false }, "kind")["canSell"]).toBe(true);
  });

  it("disaggregation map less than one candidate for modeling gate rejected", () => {
    expect(() => defineFixtureModule({
        code: "badCapabilityDefault",
        label: "Wrong capability default",
        domain: "test",
        fields: [
          { key: "code", label: "Number", type: "string", primary: true },
          { key: "kind", label: "Category", type: "enum", options: ["A", "B"] },
          { key: "enabled", label: "Enabled", type: "bool", createDefaultBy: { field: "kind", values: { A: true, C: false } } },
        ],
        lifecycle: singleState("active", "Active", "green"),
        views: { list: { columns: ["code"], filters: [], searchable: [] }, form: [{ title: "Info", fields: ["code", "kind", "enabled"] }] },
      })).toThrow(/FIELD_CREATE_DEFAULT_BY_NOT_CLOSED/);
  });
});
