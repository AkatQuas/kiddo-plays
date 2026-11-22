import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import receivableBillDraft from "../modules/receivableBill.js";
import receivableReceiptDraft from "../modules/receivableReceipt.js";

const receivableBill = sealModule(receivableBillDraft, { code: "receivableBill", domain: "sales" });
const receivableReceipt = sealModule(receivableReceiptDraft, { code: "receivableReceipt", domain: "sales" });

describe("receipt field display contract", () => {
  it("accounting mode reuses the receivable-bill value set and provides labels", () => {
    expect(receivableReceipt.fields.find((field) => field.key === "accountingType")).toMatchObject({
      type: "enum",
      options: [
        { value: "ledger", label: "Ledger" },
        { value: "detail", label: "Detail" },
      ],
      snapshot: { from: "receivableBill", match: "receivableBillId", field: "accountingType" },
    });
  });
});

describe("receivable and receipt numbers match the payable shape", () => {
  it("the receivable bill number may be typed, and is not auto", () => {
    expect(validateModule(receivableBill).errors).toEqual([]);
    expect(receivableBill.fields.find((field) => field.key === "code")).toMatchObject({
      type: "string",
      primary: true,
      required: true,
      auto: false,
    });
    expect(receivableBill.numbering).toEqual({ prefix: "YSDD", seqScope: "day" });
  });

  it("the receipt number may be typed, and is not auto", () => {
    expect(validateModule(receivableReceipt).errors).toEqual([]);
    expect(receivableReceipt.fields.find((field) => field.key === "code")).toMatchObject({
      type: "string",
      primary: true,
      required: true,
      auto: false,
    });
    expect(receivableReceipt.numbering).toEqual({ prefix: "SKD", seqScope: "day" });
  });
});
