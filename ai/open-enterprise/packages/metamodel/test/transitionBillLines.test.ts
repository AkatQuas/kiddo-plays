import { describe, expect, it } from "vitest";
import { checkTransientLines, normalizeTransition, normalizeTransitionParams } from "../src/index.js";

const lineField = {
  key: "workers",
  label: "Staffing",
  type: "subtable",
  ref: "temporaryWorkerAllocation",
  required: true,
  fields: [
    { key: "workerId", label: "Staff", type: "ref", ref: "employee", required: true },
    { key: "qty", label: "Reported quantity", type: "number", required: true },
    { key: "mode", label: "Allocation method", type: "enum", options: ["Average", "Sequence", "Custom"], required: true },
  ],
} as const;

function edge(param: Readonly<Record<string, unknown>>): unknown {
  return { code: "report", from: "inProduction", to: "reported", action: "Work report", params: [param] };
}

describe("structure Contracts for Transmission Param.bilLines", () => {
  it("enum Parameters declare a fixed candidate and share a value gate with a normal enum field", () => {
    const transition = normalizeTransition(
      edge({
        key: "allocationMethod",
        label: "Allocation method",
        type: "enum",
        options: ["Split evenly", "Allocate in order", "Split freely"],
      }),
    );
    expect(transition.params[0]?.options).toEqual([
      { value: "Split evenly", label: "Split evenly" },
      { value: "Allocate in order", label: "Allocate in order" },
      { value: "Split freely", label: "Split freely" },
    ]);
    expect(normalizeTransitionParams(transition, { allocationMethod: "Allocate in order" }).issues).toEqual([]);
    expect(normalizeTransitionParams(transition, { allocationMethod: "Fill anything" }).issues).toMatchObject([
      { code: "ENUM_NOT_IN_OPTIONS", path: "allocationMethod" },
    ]);
    expect(() => normalizeTransition(edge({ key: "allocationMethod", label: "Allocation method", type: "enum" }))).toThrow(/must declare at least one options entry/);
    expect(() => normalizeTransition(edge({ key: "reason", label: "Reason", type: "text", options: ["x"] }))).toThrow(/options is meaningful only on an enum/);
  });

  it("billLines must take linefield and must be a layer subtable", () => {
    expect(() => normalizeTransition(edge({ key: "workers", label: "Staffing", type: "billLines" }))).toThrow(
      /must declare lineField/,
    );
    expect(() =>
      normalizeTransition(
        edge({
          key: "workers",
          label: "Staffing",
          type: "billLines",
          lineField: { key: "workers", label: "Staffing", type: "string" },
        }),
      ),
    ).toThrow(/must be a subtable that declares columns/);
  });

  it("not billLines does not accept linefield, and the unknown key on the column is still rejected by normalizefield closed gate", () => {
    expect(() =>
      normalizeTransition(edge({ key: "reason", label: "Reason", type: "text", lineField })),
    ).toThrow(/lineField is meaningful only on a billLines/);
    expect(() =>
      normalizeTransition(
        edge({
          key: "workers",
          label: "Staffing",
          type: "billLines",
          lineField: { ...lineField, fields: [{ ...lineField.fields[1], invented: true }] },
        }),
      ),
    ).toThrow(/invented/);
  });

  it("temporary breakdown repeats the normal line value: mandatory, full number and count report", () => {
    const param = normalizeTransition(
      edge({ key: "workers", label: "Staffing", type: "billLines", lineField }),
    ).params[0];
    if (param?.lineField === null || param?.lineField === undefined) throw new Error("the case is missing lineField");
    const checked = checkTransientLines(param.lineField, [{ workerId: "E1", qty: "Not a number", mode: "Random" }, {}]);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.issues.map((issue) => issue.code)).toEqual([
      "TYPE_MISMATCH",
      "ENUM_NOT_IN_OPTIONS",
      "REQUIRED_BLANK",
      "REQUIRED_BLANK",
      "REQUIRED_BLANK",
    ]);
  });

  it("only parameter entry returns regularized lines: numbers rounded by field accuracy, empty string harvest nuld, unknown column loud rejection", () => {
    const transition = normalizeTransition(
      edge({ key: "workers", label: "Staffing", type: "billLines", lineField }),
    );
    const checked = normalizeTransitionParams(transition, {
      workers: [{ workerId: " E1 ", qty: 1.23456789, mode: "Average" }],
    });
    expect(checked.issues).toEqual([]);
    expect(checked.params).toEqual({ workers: [{ workerId: "E1", qty: 1.234568, mode: "Average" }] });
    expect(() =>
      normalizeTransitionParams(transition, {
        workers: [{ workerId: "E1", qty: 1, mode: "Average", invented: true }],
      }),
    ).toThrow(/invented/);
  });

  it("the opening line must be filled with the missing: the reference that is filled in the bullet window is closed only in quantity", () => {
    const transition = normalizeTransition(
      edge({ key: "workers", label: "Staffing", type: "billLines", lineField }),
    );
    const prepared = normalizeTransitionParams(
      transition,
      { workers: [{ qty: 2 }] },
      { allowMissingRequired: true },
    );
    expect(prepared.issues).toEqual([]);
    expect(prepared.params).toEqual({ workers: [{ qty: 2 }] });

    const executing = normalizeTransitionParams(transition, { workers: [{ qty: 2 }] });
    expect(executing.issues.map((issue) => issue.code)).toContain("REQUIRED_BLANK");
    expect(executing.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["workers[0].workerId", "workers[0].mode"]),
    );
  });

  it("linefield coordinates must be consistent with parameters and refuse system supply mechanisms that cannot be provided at the action input stage", () => {
    expect(() =>
      normalizeTransition(
        edge({ key: "workers", label: "Staffing", type: "billLines", lineField: { ...lineField, key: "lines" } }),
      ),
    ).toThrow(/key \/ label \/ required must match the parameter itself/);
    expect(() =>
      normalizeTransition(
        edge({
          key: "workers",
          label: "Staffing",
          type: "billLines",
          required: false,
          lineField,
        }),
      ),
    ).toThrow(/completeness rules/);
    expect(() =>
      normalizeTransition(
        edge({
          key: "workers",
          label: "Staffing",
          type: "billLines",
          lineField: {
            ...lineField,
            fields: [{ key: "code", label: "Line number", type: "string", primary: true, auto: true }],
          },
        }),
      ),
    ).toThrow(/do not support system-supplied fields/);
    const filtered = normalizeTransition(
      edge({
        key: "workers",
        label: "Staffing",
        type: "billLines",
        lineField: {
          ...lineField,
          fields: [
            {
              ...lineField.fields[0],
              refFilter: { status: "active", productionOrgId: { from: "$bill.teamId" } },
            },
            lineField.fields[1],
            lineField.fields[2],
          ],
        },
      }),
    );
    expect(filtered.params[0]?.lineField?.fields?.find((column) => column.key === "workerId")?.refFilter).toEqual({
      status: "active",
      productionOrgId: { from: "$bill.teamId" },
    });
  });

  it("fixed action detail to declare hidden columns and read-only columns, and column coordinates must be real and not conflicting", () => {
    const transition = normalizeTransition(
      edge({
        key: "workers",
        label: "Staffing",
        type: "billLines",
        lineField,
        fixedRows: true,
        hiddenColumns: ["workerId"],
        readOnlyColumns: ["qty"],
      }),
    );
    expect(transition.params[0]).toMatchObject({
      fixedRows: true,
      hiddenColumns: ["workerId"],
      readOnlyColumns: ["qty"],
    });
    expect(() =>
      normalizeTransition(edge({
        key: "workers", label: "Staffing", type: "billLines", lineField,
        hiddenColumns: ["missing"],
      })),
    ).toThrow(/line column "missing" does not exist/);
    expect(() =>
      normalizeTransition(edge({
        key: "workers", label: "Staffing", type: "billLines", lineField,
        hiddenColumns: ["qty"], readOnlyColumns: ["qty"],
      })),
    ).toThrow(/cannot be both hidden and readOnly/);
  });
});
