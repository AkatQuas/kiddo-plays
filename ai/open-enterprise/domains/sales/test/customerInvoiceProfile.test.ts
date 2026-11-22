import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { uniqueSitesOf, unacceptableWriteKeys, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const customer = requireModule(catalog, "customer").schema;
const salesInvoice = requireModule(catalog, "salesInvoice").schema;

describe("invoice profile is copied from the customer and frozen on the invoice", () => {
  it("declaration, form, and write surface have no invoiceTitle, and the invoice profile keeps tax number and bank account", () => {
    expect(validateModule(customer).errors).toEqual([]);
    expect(customer.fields.map((field) => field.key)).not.toContain("invoiceTitle");
    const formFields = customer.views.form.flatMap((section) => section.fields);
    expect(formFields).not.toContain("invoiceTitle");
    expect(formFields).toEqual(
      expect.arrayContaining(["name", "taxNo", "invoiceAddress", "invoicePhone", "invoiceBank", "invoiceAccount"]),
    );
    const billing = customer.views.form.find((section) => section.title === "Invoice profile");
    expect(billing?.fields).toEqual(["taxNo", "invoiceAddress", "invoicePhone", "invoiceBank", "invoiceAccount"]);
    expect(unacceptableWriteKeys(customer.fields, { name: "sample", invoiceTitle: "must-not-persist" }, "header")).toEqual([
      "invoiceTitle",
    ]);
  });

  it("customer name is unique in the tenant, and the short name is not", () => {
    const name = customer.fields.find((field) => field.key === "name");
    const shortName = customer.fields.find((field) => field.key === "shortName");
    expect(name).toMatchObject({ type: "string", required: true, unique: true });
    expect(shortName?.unique).toBe(false);
    expect(uniqueSitesOf(customer, { name: "Acme" })).toEqual([
      { key: "name", path: "name", label: "Customer name", value: "Acme", with: [] },
    ]);
    expect(uniqueSitesOf(customer, { shortName: "Acme" })).toEqual([]);
  });

  it("the invoice request has no invoice title, and the six invoice fields start from the customer record and can be edited", () => {
    expect(salesInvoice.fields.map((field) => field.key)).not.toContain("invoiceTitle");
    const defaults = Object.fromEntries(
      salesInvoice.fields
        .filter((field) => field.refDefault?.from === "customer")
        .map((field) => [field.key, field.refDefault?.field]),
    );
    expect(defaults).toEqual({
      companyName: "name",
      taxNo: "taxNo",
      companyAddress: "invoiceAddress",
      phoneNumber: "invoicePhone",
      bankName: "invoiceBank",
      bankAccount: "invoiceAccount",
    });
  });
});
