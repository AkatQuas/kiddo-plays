import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@open-erp/loader";
import {
  allTableComments,
  businessTableComments,
  FRAMEWORK_TABLE_COMMENTS,
  renderCommentSql,
} from "../src/dbComments.js";

const domainsRoot = path.resolve(fileURLToPath(new URL("../../../domains", import.meta.url)));

describe("dbComments", () => {
  it("sales-order header and line comments come from the module label and help", async () => {
    const catalog = await loadCatalog({ domainsRoot });
    const tables = businessTableComments(catalog);
    const header = tables.find((t) => t.table === "oe_sales_order");
    const lines = tables.find((t) => t.table === "oe_sales_order_lines");
    expect(header, "the sales order table should exist").toBeDefined();
    expect(lines, "the sales order line table should exist").toBeDefined();
    expect(header!.comment).toBe("Sales order · Sales (module salesOrder)");
    expect(header!.comment).toMatch(/Sales/);
    const code = header!.columns.find((c) => c.name === "code");
    expect(code?.comment).toMatch(/Order no\./);
    expect(code?.comment).toMatch(/XS-20260803-0001/);
    expect(header!.columns.find((c) => c.name === "customer_id")?.comment).toBe("Customer");
    expect(header!.columns.find((c) => c.name === "status")?.comment).toBe("Status");
    expect(lines!.columns.find((c) => c.name === "bill_id")?.comment).toBe("Header bill ID");
  });

  it("framework tables are complete and do not collide with business table names", async () => {
    const catalog = await loadCatalog({ domainsRoot });
    const all = allTableComments(catalog);
    const names = all.map((t) => t.table);
    expect(new Set(names).size).toBe(names.length);
    for (const fw of FRAMEWORK_TABLE_COMMENTS) {
      expect(names, `missing framework table ${fw.table}`).toContain(fw.table);
    }
  });

  it("renderCommentSql emits executable COMMENT ON", async () => {
    const catalog = await loadCatalog({ domainsRoot });
    const sql = renderCommentSql(allTableComments(catalog).slice(0, 1));
    expect(sql).toMatch(/^COMMENT ON TABLE "/m);
    expect(sql).toMatch(/^COMMENT ON COLUMN "/m);
  });
});
