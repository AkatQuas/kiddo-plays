import {
  defineFixtureModule,
  editableFields,
  evaluateTransition,
  isReverseQueryable,
  normalizeQuery,
  relationsOf,
  reverseQueryFieldOf,
  sealModule,
  singleState,
  validateModule,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import salesInvoiceDraft from "../modules/salesInvoice.js";

const salesInvoice = sealModule(salesInvoiceDraft, { code: "salesInvoice", domain: "sales" });

const customerTarget = defineFixtureModule({
  code: "customer",
  label: "Customer",
  domain: "sales",
  fields: [{ key: "name", label: "Customer name", type: "string", required: true, primary: true }],
  lifecycle: singleState("active", "Active", "green"),
  views: {
    list: { columns: ["name"], searchable: ["name"] },
    form: [{ title: "Basics", fields: ["name"] }],
  },
});
const salesOrderTarget = defineFixtureModule({
  code: "salesOrder",
  label: "Sales order",
  domain: "sales",
  fields: [{ key: "code", label: "Order no.", type: "string", required: true, primary: true }],
  lifecycle: singleState("completed", "completed", "green"),
  views: {
    list: { columns: ["code"], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code"] }],
  },
});
const receivableReceiptTarget = defineFixtureModule({
  code: "receivableReceipt",
  label: "Receipt",
  domain: "sales",
  fields: [{ key: "code", label: "Receipt no.", type: "string", required: true, primary: true }],
  lifecycle: singleState("completed", "completed", "green"),
  views: {
    list: { columns: ["code"], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code"] }],
  },
});
const NOW = new Date("2026-07-31T00:00:00.000Z");
const ACTOR = { id: "finance-1" };
const BILL = {
  id: "invoice-1",
  status: "pendingReview",
  customerId: "customer-1",
  companyName: "Example Technology Ltd",
  companyAddress: "1 Example Road",
  phoneNumber: "0755-12345678",
  bankName: "Example Bank",
  bankAccount: "6222000000000000",
  taxNo: "91440300EXAMPLE",
  invoiceNo: "044001900001",
  invoiceDate: "2026-07-31",
  invoiceAmount: 50_000,
  sourceFileRef: "file:sales-invoice/2026/07/044001900001.pdf",
};

function field(key: string) {
  const found = salesInvoice.fields.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`salesInvoice is missing field ${key}`);
  return found;
}

describe("invoice request module", () => {
  it("passes the semantic gates and freezes customer, face, and source-file facts", () => {
    expect(validateModule(salesInvoice).errors).toEqual([]);
    expect(salesInvoice.numbering).toEqual({ prefix: "XSFP", seqScope: "day" });
    expect(salesInvoice.fields.map((item) => item.key)).toEqual([
      "code",
      "customerId",
      "companyName",
      "taxNo",
      "companyAddress",
      "phoneNumber",
      "bankName",
      "bankAccount",
      "invoiceNo",
      "invoiceDate",
      "invoiceAmount",
      "sourceFileRef",
      "orderLinks",
      "remark",
    ]);
    expect(field("customerId")).toMatchObject({ type: "ref", ref: "customer", required: true });
    expect(field("invoiceAmount")).toMatchObject({ type: "money", required: true });
    expect(field("sourceFileRef")).toMatchObject({ type: "string", required: false });
    expect(field("companyName").refDefault).toMatchObject({ from: "customer", match: "customerId", field: "name" });
    expect(field("taxNo").refDefault).toMatchObject({ from: "customer", match: "customerId", field: "taxNo" });
    expect(field("companyAddress").refDefault).toMatchObject({
      from: "customer",
      match: "customerId",
      field: "invoiceAddress",
    });
    expect(field("phoneNumber").refDefault).toMatchObject({
      from: "customer",
      match: "customerId",
      field: "invoicePhone",
    });
    expect(field("bankName").refDefault).toMatchObject({ from: "customer", match: "customerId", field: "invoiceBank" });
    expect(field("bankAccount").refDefault).toMatchObject({
      from: "customer",
      match: "customerId",
      field: "invoiceAccount",
    });
    expect(salesInvoice.views.list.columns).toEqual([
      "code",
      "invoiceNo",
      "customerId",
      "companyName",
      "companyAddress",
      "phoneNumber",
      "bankName",
      "bankAccount",
      "invoiceDate",
      "invoiceAmount",
      "status",
    ]);
  });

  it("order links may be empty or many, orders are only in progress or completed, and the receipt is optional", () => {
    const orderLinks = field("orderLinks");
    expect(orderLinks).toMatchObject({ type: "subtable", ref: "salesInvoiceOrderLink" });
    expect(orderLinks.fields?.find((item) => item.key === "salesOrderId")).toMatchObject({
      type: "ref",
      ref: "salesOrder",
      required: true,
      refFilter: { status: ["inProgress", "completed"] },
    });
    expect(orderLinks.fields?.find((item) => item.key === "receiptId")).toMatchObject({
      type: "ref",
      ref: "receivableReceipt",
      required: false,
      label: "Receipt no.",
    });
    expect(salesInvoice.preconditions.some((rule) => rule.check?.primitive === "lines_not_empty")).toBe(false);

    const relations = relationsOf(
      [customerTarget, salesOrderTarget, receivableReceiptTarget, salesInvoice],
      "salesInvoice",
    );
    expect(relations.outbound.map((relation) => [relation.to, relation.field, relation.via])).toEqual([
      ["customer", "customerId", "bill"],
      ["salesOrder", "salesOrderId", "line"],
      ["receivableReceipt", "receiptId", "line"],
    ]);
    expect(relations.outbound.every(isReverseQueryable)).toBe(true);
    expect(relations.outbound.map(reverseQueryFieldOf)).toEqual([
      "customerId",
      "orderLinks.salesOrderId",
      "orderLinks.receiptId",
    ]);
  });

  it("a general query can filter by customer, date, invoice number, and linked sales order", () => {
    const query = normalizeQuery(salesInvoice, {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "customerId", op: "eq", value: "customer-1" },
          {
            kind: "cond",
            field: "invoiceDate",
            op: "between",
            value: ["2026-07-01", "2026-07-31"],
          },
          { kind: "cond", field: "orderLinks.salesOrderId", op: "eq", value: "sales-order-1" },
        ],
      },
      search: "044001900001",
      sort: [{ field: "invoiceDate", desc: true }],
      limit: 100,
    });
    expect(query.where).toMatchObject({ kind: "group", join: "and" });
    expect(query.search).toBe("044001900001");
  });

  it("after issue the invoice profile is frozen, and void keeps a traceable terminal state", () => {
    expect(salesInvoice.lifecycle.statuses.find((s) => s.initial)).toMatchObject({
      key: "pendingReview",
      label: "pendingReview",
      editable: "full",
    });
    expect(salesInvoice.lifecycle.statuses.some((s) => s.key === "draft")).toBe(false);
    expect(editableFields(salesInvoice, "pendingReview")).toEqual([
      "customerId",
      "companyName",
      "taxNo",
      "companyAddress",
      "phoneNumber",
      "bankName",
      "bankAccount",
      "invoiceNo",
      "invoiceDate",
      "invoiceAmount",
      "sourceFileRef",
      "orderLinks",
      "remark",
    ]);
    expect(editableFields(salesInvoice, "invoiced")).toEqual(["sourceFileRef", "remark"]);
    expect(editableFields(salesInvoice, "voided")).toEqual([]);
    expect(salesInvoice.lifecycle.transitions.map((edge) => `${edge.code}:${edge.from}->${edge.to}`)).toEqual([
      "issue:pendingReview->invoiced",
      "void:invoiced->voided",
    ]);
    expect(salesInvoice.lifecycle.transitions.some((t) => t.code === "submit" || t.code === "withdraw" || t.code === "reject")).toBe(false);
  });

  it("the invoice amount must still be positive, is not compared with the sales-order total, and customer status is read again at issue", async () => {
    const invalidAmount = await evaluateTransition(
      {
        module: salesInvoice,
        bill: { ...BILL, invoiceAmount: 0 },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: { get: async () => ({ status: "active" }), list: async () => [], balance: async () => 0 },
      },
      "issue",
    );
    expect(invalidAmount.verdict).toMatchObject({ pass: false, level: "block" });
    expect(invalidAmount.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([
      "invoice_amount_positive",
    ]);

    // Tax number, invoice number, and invoice date may be empty and still pass the face gate. Only a disabled customer is blocked
    const cannotIssue = await evaluateTransition(
      {
        module: salesInvoice,
        bill: { ...BILL, status: "pendingReview", taxNo: "", invoiceNo: "", invoiceDate: null },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "disabled" }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "issue",
    );
    expect(cannotIssue.verdict).toMatchObject({ pass: false, level: "block" });
    expect(cannotIssue.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([
      "customer_active",
    ]);

    const canIssueWithoutFace = await evaluateTransition(
      {
        module: salesInvoice,
        bill: { ...BILL, status: "pendingReview", taxNo: "", invoiceNo: "", invoiceDate: null },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "active" }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "issue",
    );
    expect(canIssueWithoutFace.verdict).toMatchObject({ pass: true });

    const exceedsOrder = await evaluateTransition(
      {
        module: salesInvoice,
        bill: { ...BILL, invoiceAmount: 100_000 },
        lines: [{ salesOrderId: "sales-order-1", receiptId: null }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: { get: async () => ({ status: "active" }), list: async () => [], balance: async () => 0 },
      },
      "issue",
    );
    expect(exceedsOrder.verdict).toMatchObject({ pass: true });
  });
});
