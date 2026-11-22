import { describe, expect, it } from "vitest";
import { normalizeModule, singleState } from "@open-erp/metamodel";
import { writeKeyRejectionMessages } from "../src/repo/billRepo.js";

describe("write-key rejection field copy", () => {
  it("uses the declared name for a known field, and does not guess a label or expose the code for an unknown field", () => {
    const schema = normalizeModule({ label: "Test bill", views: { list: { columns: ["code"] } }, lifecycle: singleState("active", "Active", "green"), fields: [
      { key: "code", label: "Doc no.", type: "string", auto: true },
      { key: "total", label: "Total", type: "number", derive: { kind: "formula", expr: { value: 1 } } },
    ] }, "test");
    expect(writeKeyRejectionMessages(schema.fields, ["code", "total", "xNoDeclaration"])).toEqual([
      '"Doc no." is generated automatically by the system; do not fill it in by hand',
      '"Total" is computed by the system; do not fill it in by hand',
      "the submission contains a field this form does not have; ask the assistant to rearrange it",
    ]);
  });
});
