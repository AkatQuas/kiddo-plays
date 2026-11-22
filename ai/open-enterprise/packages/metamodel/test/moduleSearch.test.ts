// ---------------------------------------------------------------------------
// module found retrieval - word weighted and stable sorting
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  buildModuleSearchDocs,
  searchModules,
  defineFixtureModule,
  type ModuleSchema,
} from "../src/index.js";

function bill(code: string, label: string, extraFields: readonly Record<string, unknown>[] = []): ModuleSchema {
  return defineFixtureModule({
    code,
    label,
    domain: "sales",
    fields: [
      { key: "code", label: "Document number", type: "string", required: true, primary: true },
      ...extraFields,
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", color: "gray", initial: true },
        { key: "completed", label: "completed", color: "green", terminal: true },
      ],
      transitions: [{ code: "done", from: "draft", to: "completed", action: "Complete" }],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
  });
}

const domains = new Map([["sales", "Sales"]]);

describe("searchModules", () => {
  it("empty query does not return full volume directory", () => {
    const docs = buildModuleSearchDocs([bill("alphaMod", "Document A"), bill("betaMod", "Document B")], domains);
    expect(searchModules(docs, "")).toEqual([]);
    expect(searchModules(docs, "   ")).toEqual([]);
  });

  it("no sufficient match to return empty Group", () => {
    const docs = buildModuleSearchDocs([bill("alphaMod", "Document A")], domains);
    expect(searchModules(docs, "xyzzyfoobar")).toEqual([]);
    expect(searchModules(docs, "warehouse")).toEqual([]);
  });

  it("the generic word management does not return module just because the domain name is hit", () => {
    const docs = buildModuleSearchDocs([bill("alphaMod", "Document A"), bill("betaMod", "Document B")], domains);
    expect(searchModules(docs, "Admin")).toEqual([]);
  });

  it("sort equal fractions by module stable", () => {
    const docs = buildModuleSearchDocs(
      [bill("zetaMod", "Test piece"), bill("alphaMod", "Test piece")],
      domains,
    );
    expect(searchModules(docs, "Test piece").map((hit) => hit.module)).toEqual(["alphaMod", "zetaMod"]);
    expect(searchModules(docs, "Test piece").map((hit) => hit.module)).toEqual(
      searchModules(docs, "Test piece").map((hit) => hit.module),
    );
  });

  it("module name hits more than domain name", () => {
    const named = bill("salesOrder", "Sales order");
    const other = bill("otherBill", "Other entry", [{ key: "note", label: "Remark", type: "text" }]);
    const docs = buildModuleSearchDocs([named, other], domains);
    expect(searchModules(docs, "Sales order").map((hit) => hit.module)).toEqual(["salesOrder"]);
  });

  it("return field only four times the location is required and the identifier is Modeule", () => {
    const docs = buildModuleSearchDocs([bill("alphaMod", "Document A")], domains);
    expect(searchModules(docs, "Document A")).toEqual([
      { module: "alphaMod", label: "Document A", domain: "sales", domainLabel: "Sales" },
    ]);
    expect(searchModules(docs, "Document A")[0]).not.toHaveProperty("code");
    expect(searchModules(docs, "Document A")[0]).not.toHaveProperty("statuses");
  });

  it("returns up to 5", () => {
    const modules = ["a", "b", "c", "d", "e", "f", "g"].map((suffix) => bill(`mod${suffix}`, `Shared part${suffix}`));
    const docs = buildModuleSearchDocs(modules, domains);
    expect(searchModules(docs, "Shared part")).toHaveLength(5);
  });

  it("spoken fillers do not split a declared business word", () => {
    const issue = bill("materialIssue", "Shop-floor material issue");
    const docs = buildModuleSearchDocs([issue, bill("otherBill", "Misc registry")], domains);
    expect(searchModules(docs, "issue a bit of material").map((hit) => hit.module)).toEqual(["materialIssue"]);
    expect(searchModules(docs, "help me issue a bit of material").map((hit) => hit.module)).toEqual(["materialIssue"]);
    expect(searchModules(docs, "please help me issue a bit of material").map((hit) => hit.module)).toEqual(["materialIssue"]);
  });

  it("ship and issue name the same warehouse action, without a module alias", () => {
    const delivery = bill("salesDelivery", "sales issue");
    const invoice = bill("salesInvoice", "sales invoice");
    const docs = buildModuleSearchDocs([delivery, invoice], domains);
    expect(searchModules(docs, "sales ship").map((hit) => hit.module)[0]).toBe("salesDelivery");
    expect(searchModules(docs, "sales issue").map((hit) => hit.module)[0]).toBe("salesDelivery");
  });

  it("separate speech fill does not constitute sufficient match", () => {
    const docs = buildModuleSearchDocs([bill("alphaMod", "Document A")], domains);
    expect(searchModules(docs, "kind of")).toEqual([]);
    expect(searchModules(docs, "please")).toEqual([]);
  });
});
