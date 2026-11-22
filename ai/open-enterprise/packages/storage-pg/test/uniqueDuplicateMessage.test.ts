import { describe, expect, it } from "vitest";
import type { UniqueSite } from "@open-erp/metamodel";
import { uniqueDuplicateMessage } from "../src/repo/billRepo.js";

function archive(over: { readonly code?: string; readonly label?: string } = {}) {
  return {
    code: over.code ?? "archive",
    label: over.label ?? "personnel archive",
  };
}

function site(over: Partial<UniqueSite> = {}): UniqueSite {
  return {
    key: over.key ?? "userId",
    path: over.path ?? "userId",
    label: over.label ?? "platform user",
    value: over.value ?? "subj-1",
    with: over.with ?? [],
  };
}

describe("@uniqueDuplicateMessage: not ref", () => {
  it("fields maintain original sentences without occupation records", () => {
    expect(
      uniqueDuplicateMessage({
        schema: archive(),
        site: site({ key: "name", path: "name", label: "name", value: "Alpha" }),
        field: { type: "string" as const },
        submittedText: "Alpha",
      }),
    ).toBe('the name you entered, "Alpha", already exists; enter it again');
  });

  it("date, to ISOString, do not insert local time zone sentence into the file", () => {
    const at = new Date("2026-01-02T03:04:05.000Z");
    expect(
      uniqueDuplicateMessage({
        schema: archive(),
        site: site({ key: "bizDate", path: "bizDate", label: "business date", value: at }),
        field: { type: "date" as const },
        submittedText: "",
      }),
    ).toBe(`the business date you entered, "${at.toISOString()}", already exists; enter it again`);
  });

  it("composite only keep the \"other module\" sentence unoccupied", () => {
    expect(
      uniqueDuplicateMessage({
        schema: archive({ label: "bill of materials" }),
        site: site({
          key: "version",
          path: "version",
          label: "version",
          value: "V1.0",
          with: [{ key: "productId", value: "p-1", label: "product" }],
        }),
        field: { type: "string" as const },
        submittedText: "V1.0",
      }),
    ).toBe(
      'the "V1.0" filled in "version" is already registered on another bill of materials — ' +
        'given the same "product", version cannot be repeated; check it and use another',
    );
  });
});

describe("uniqueDuplicateMessage: ref", () => {
  it("fields only refer to the value of this submission, without indicating occupation line", () => {
    expect(
      uniqueDuplicateMessage({
        schema: archive(),
        site: site(),
        field: { type: "ref" as const },
        submittedText: "Alex",
      }),
    ).toBe('the platform user you entered, "Alex", already exists; enter it again');
  });

  it("composite Only use the \"other module\" sentence, refLabel", () => {
    expect(
      uniqueDuplicateMessage({
        schema: archive({ label: "process route" }),
        site: site({
          key: "productId",
          path: "productId",
          label: "product",
          value: "p-1",
          with: [{ key: "version", value: "V1.0", label: "version" }],
        }),
        field: { type: "ref" as const },
        submittedText: "motor",
      }),
    ).toBe(
      'the "motor" filled in "product" is already registered on another process route — ' +
        'given the same "version", product cannot be repeated; check it and use another',
    );
  });

  it("if you can't spell the label, you can't throw it back. id", () => {
    expect(() =>
      uniqueDuplicateMessage({
        schema: archive(),
        site: site(),
        field: { type: "ref" as const },
        submittedText: "",
      }),
    ).toThrow(/cannot compose a human reference label/);
  });
});
