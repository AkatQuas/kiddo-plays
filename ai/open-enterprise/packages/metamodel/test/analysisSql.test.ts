import { describe, expect, it } from "vitest";
import { defineFixtureModule, analysisCatalogOf, checkAnalysisSql, validateAnalysisSql, prepareAgentAnalysisSql, injectTenantPredicates, injectScopedWhere, physicalAliasesInScope, leftJoinAliasesInScope, aliasScopePredicate, type ModuleSchema } from "../src/index.js";

function stubRef(code: string): ModuleSchema {
  return defineFixtureModule({
    code,
    label: code,
    domain: "demo",
    fields: [{ key: "code", label: "Code", type: "string", primary: true, required: true }],
    lifecycle: {
      statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
  });
}

const order = defineFixtureModule({
  code: "purchaseOrder",
  label: "Purchase order",
  domain: "procurement",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    { key: "totalAmount", label: "Amount", type: "money", required: true },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "taxPrice", label: "Tax-inclusive price", type: "money", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [{ key: "draft", label: "draft", color: "gray", initial: true, terminal: true }],
    transitions: [],
  },
  views: {
    list: { columns: ["code", "supplierId", "totalAmount"], filters: ["status"], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code", "supplierId", "totalAmount", "lines"] }],
  },
});

const catalog = analysisCatalogOf([order, stubRef("supplier"), stubRef("product")]);

describe("anallysis sql gate", () => {
  it("sELECT", () => {
    const checked = checkAnalysisSql(
      catalog,
      `SELECT l.product_id, h.supplier_id,
              SUM(l.tax_price * l.qty) / NULLIF(SUM(l.qty), 0) AS weighted_tax_price
         FROM oe_purchase_order_lines l
         INNER JOIN oe_purchase_order h ON l.bill_id = h.id
        WHERE h.id = $1
        GROUP BY l.product_id, h.supplier_id
        LIMIT 20`,
      ["po-1"],
    );
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.value.relations).toEqual(["oe_purchase_order", "oe_purchase_order_lines"]);
    }
  });

  it("rejected DDL/ DML", () => {
    const checked = checkAnalysisSql(catalog, "DELETE FROM oe_purchase_order WHERE id = $1", ["x"]);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_NOT_READONLY");
  });

  it("reject outside of directory", () => {
    const checked = checkAnalysisSql(catalog, "SELECT COUNT(*) AS n FROM pg_stat_activity LIMIT 1");
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues.some((issue) => issue.code === "ANALYSIS_SQL_RELATION_UNKNOWN" || issue.code === "ANALYSIS_SQL_SCHEMA_NOT_ALLOWED")).toBe(true);
  });

  it("reject undeclared LIMIT returned query", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT status, COUNT(*) AS n FROM oe_purchase_order GROUP BY status",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_LIMIT_REQUIRED");
  });

  it("validate, turn the first issue into Analysis SqlError.", () => {
    expect(() => validateAnalysisSql(catalog, "UPDATE oe_purchase_order SET status = $1", ["x"])).toThrow(/ANALYSIS_SQL/);
  });

  /**
   * 🔴 `SELECT DISTINCT x` and `SELECT x … GROUP BY x` It's the same thing. It can't be treated in two ways.
   *
   * on site (line): The model uses the skill caliber to ask, "Who did?"
   * `SELECT DISTINCT worker_id … LIMIT 20`He was sentenced to "no return" for refusing to return.
   * And the rewriting of the gate `bill_list(processReport, fields:["workerId"])` ** Not at all.**
   * i can't answer that question — the round went for nothing.
   */
  it("🔴 SELECT DISTINCT is a contract, not a backwards line -- read with GRUP BY, do not treat it as written", () => {
    const distinct = checkAnalysisSql(
      catalog,
      "SELECT DISTINCT status FROM oe_purchase_order LIMIT 20",
    );
    expect(distinct.ok).toBe(true);
    // gROUP BY, which is semanticly equivalent to it, is already released; both must be treated equally
    const grouped = checkAnalysisSql(
      catalog,
      "SELECT status FROM oe_purchase_order GROUP BY status LIMIT 20",
    );
    expect(grouped.ok).toBe(true);
  });

  it("dISTINCT is still bound by the LIMIT gate -- it's a \"return,\" not a \"no limit.\"", () => {
    const checked = checkAnalysisSql(catalog, "SELECT DISTINCT status FROM oe_purchase_order");
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_LIMIT_REQUIRED");
  });

  it("the same sentence without DISTINCT is still blocked -- don't let it loose to \"have self\"", () => {
    const checked = checkAnalysisSql(catalog, "SELECT status FROM oe_purchase_order LIMIT 20");
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
  });

  // 🔴 On the line, it's clear: "What receipt orders exceed mission requirements." The model was right. SQL was turned down twice.
  // and given the way out, bill list** can't express the word** (it can only compare a single modular field to a constant, but it can't do it).
  // there is neither a task line nor a field vs field. It then returns to take an article-by-article logarithm:
  // 13 tools/ 76 seconds, and this SQL 0.1 is finished.
  //
  // the contract did not take place only in GROUP BY - two tables were sifted together by "the amount here > the amount over there."
  // the term is in itself a return.
  it("cross-Specific Size Release - This type of word bill list cannot be expressed", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT l.id, l.qty FROM oe_purchase_order_lines l" +
        " INNER JOIN oe_purchase_order h ON l.bill_id = h.id" +
        " WHERE l.qty > h.total_amount LIMIT 20",
    );
    expect(checked.ok, JSON.stringify(checked.ok ? {} : checked.issues)).toBe(true);
  });

  it("it's two tables in two -- semantics, not writing.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT l.id FROM oe_purchase_order_lines l" +
        " INNER JOIN oe_purchase_order h ON l.bill_id = h.id" +
        " WHERE (l.qty - h.total_amount) > 0 LIMIT 20",
    );
    expect(checked.ok).toBe(true);
  });

  // ⚠️ ⚠️ 。 。 。 。 。 。 。 。 。 The equivalent connection written in the WHERE is still to put together two tables in reverse.
  // bill list's refLabels can cover it, release the gate and tear it down.
  it("the equivalent connection in WHERE does not count as the contract -- it's just a reverse.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT l.id, l.qty FROM oe_purchase_order_lines l, oe_purchase_order h" +
        " WHERE l.bill_id = h.id LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
  });

  // the cross-table comparison in ON is a connection key, not a filter; only JOIN is not enough to explain the return of this query Pass.
  it("only JOIN, no crossword, is still blocked.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT l.id, l.qty FROM oe_purchase_order_lines l" +
        " INNER JOIN oe_purchase_order h ON l.bill_id = h.id LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
  });

  it("single scale and constant ratio size are not cross-table -- that's the job of bill list", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT l.id, l.qty FROM oe_purchase_order_lines l WHERE l.qty > 100 LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
  });

  // The second part of the CTE section is: `), ` — `)` and `,` It's all non-word characters, there's no word boundary in the middle.
  // It used to be before comma. `\b`So the second CTE was never caught and rejected as an undeclared statement.
  // SQL is right, but ANALYSIS SQL RELATION UNKNOWN, two rounds of white.
  it("every part of the CTE recognizes.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "WITH issue AS (SELECT bill_id, qty FROM oe_purchase_order_lines)," +
        " head AS (SELECT id, total_amount FROM oe_purchase_order)" +
        " SELECT i.bill_id, SUM(i.qty) AS n FROM issue i INNER JOIN head h ON i.bill_id = h.id" +
        " GROUP BY i.bill_id LIMIT 20",
    );
    expect(checked.ok, checked.ok ? "" : JSON.stringify(checked.issues.map((x) => [x.code, x.path]))).toBe(true);
  });

  it("three CTEs, too -- not just the second.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "WITH a AS (SELECT id FROM oe_purchase_order), b AS (SELECT id FROM oe_purchase_order)," +
        " c AS (SELECT id FROM oe_purchase_order)" +
        " SELECT a.id, COUNT(*) AS n FROM a INNER JOIN b ON a.id = b.id INNER JOIN c ON a.id = c.id" +
        " GROUP BY a.id LIMIT 20",
    );
    expect(checked.ok).toBe(true);
  });

  it("and still don't use the undeclared watch for CTE -- this knife can't untie the gate.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "WITH a AS (SELECT id FROM oe_purchase_order) SELECT x.id, COUNT(*) AS n FROM not_declared x GROUP BY x.id LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_RELATION_UNKNOWN");
  });

  it("* The first knife pointed at the bill list", () => {
    const checked = checkAnalysisSql(catalog, "SELECT * FROM oe_purchase_order LIMIT 20");
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
      expect(checked.issues[0]?.example).toContain('"use":"bill_list"');
    }
  });

  it("rejection of unaccompanied detail, SELECT, first shot to bill list", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT l.id, l.qty FROM oe_purchase_order_lines l LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
      expect(checked.issues[0]?.example).toContain('"module":"purchaseOrder"');
    }
  });

  // ---------------------------------------------------------------------------
  // 🔴 The rewriting proposal must be a copy of **.
  //
  // Online: SQL Yes `FROM oe_purchase_order_lines l JOIN oe_purchase_order h`，
  // the table is detailed, and it is recommended that it be written as Fields: [Specific breakdown...]. Model copy QUERY FIED UNKNOWN;
  // "There is no projection column." On both occasions, we failed to follow our lead.
  // bill list can only project the headline, but not the structure.
  // ---------------------------------------------------------------------------
  it("SQL:fields are only given to the headline, and they don't fit the details.", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT h.code, l.line_no, l.qty FROM oe_purchase_order_lines l" +
        " INNER JOIN oe_purchase_order h ON l.bill_id = h.id LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    const rewrite = JSON.parse(checked.issues[0]!.example) as {
      rewriteExample: { fields: string[] };
      note?: string;
    };
    expect(rewrite.rewriteExample.fields).toContain("code");
    for (const lineOnly of ["lineNo", "qty", "line_no"]) {
      expect(rewrite.rewriteExample.fields, `${lineOnly} is a line column, bill_list cannot supply it`).not.toContain(lineOnly);
    }
    // if you don't get rid of it, you'll have to tell me where to get those columns. Send
    expect(rewrite.note ?? "").toContain("get");
  });

  it("detailed filter belt through prefix -- copy to use", () => {
    const checked = checkAnalysisSql(
      catalog,
      "SELECT h.code FROM oe_purchase_order_lines l INNER JOIN oe_purchase_order h ON l.bill_id = h.id" +
        " WHERE l.product_id IN ('a','b') LIMIT 20",
    );
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    const rewrite = JSON.parse(checked.issues[0]!.example) as {
      rewriteExample: { query: { where?: { field?: string } } };
    };
    expect(rewrite.rewriteExample.query.where?.field).toBe("lines.productId");
  });

  it("SQL on the watch is the same as usual -- this knife is not recommended in the table", () => {
    const checked = checkAnalysisSql(catalog, "SELECT code, status FROM oe_purchase_order LIMIT 20");
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    const rewrite = JSON.parse(checked.issues[0]!.example) as {
      rewriteExample: { fields: string[] };
      note?: string;
    };
    expect(rewrite.rewriteExample.fields).toEqual(expect.arrayContaining(["code", "status"]));
    expect(rewrite.note).toBeUndefined();
  });

  it("unknown presentation error list of all library entries, uninterrupted", () => {
    const checked = checkAnalysisSql(
      catalog,
      `SELECT l.price, SUM(l.qty) AS qty
         FROM oe_purchase_order_lines l
        GROUP BY l.price
        LIMIT 20`,
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      const unknown = checked.issues.find((issue) => issue.code === "ANALYSIS_SQL_COLUMN_UNKNOWN");
      expect(unknown).toBeDefined();
      expect(unknown?.expected).toMatch(/\d+/);
      expect(unknown?.expected).toContain("tax_price");
      expect(unknown?.expected).toContain("qty");
    }
  });

  it("reject LEFT JOIN, correctUsage to give INNER JOIN writing for the real table of contents", () => {
    const checked = checkAnalysisSql(
      catalog,
      `SELECT s.code, COUNT(*) AS n
         FROM oe_supplier s
         LEFT JOIN oe_purchase_order h ON h.supplier_id = s.id
        GROUP BY s.code
        LIMIT 20`,
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      const outer = checked.issues.find((issue) => issue.code === "ANALYSIS_SQL_OUTER_JOIN");
      expect(outer).toBeDefined();
      expect(outer?.example).toMatch(/INNER JOIN/);
      expect(outer?.example).not.toMatch(/LEFT JOIN/i);
      expect(outer?.example).not.toContain("oe_sales_order");
      const names = new Set(catalog.relations.map((relation) => relation.name));
      const used = [...(outer?.example ?? "").matchAll(/oe_[a-z0-9_]+/g)].map((match) => match[0]);
      expect(used.length).toBeGreaterThan(1);
      for (const table of used) expect(names.has(table), table).toBe(true);
    }
  });
});

const customer = defineFixtureModule({
  code: "customer",
  label: "Customer record",
  domain: "sales",
  fields: [
    { key: "code", label: "Code", type: "string", primary: true, required: true },
    { key: "name", label: "Customer name", type: "string", required: true },
    { key: "address", label: "Address", type: "string" },
  ],
  lifecycle: {
    statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
    transitions: [],
  },
    views: { list: { columns: ["code", "name"], filters: [], searchable: ["code", "name"] }, form: [{ title: "Basics", fields: ["code", "name", "address"] }] },
});

const salesOrder = defineFixtureModule({
  code: "salesOrder",
  label: "Sales order",
  domain: "sales",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    { key: "totalAmount", label: "Amount", type: "money", required: true },
  ],
  lifecycle: {
    statuses: [{ key: "done", label: "completed", color: "green", initial: true, terminal: true }],
    transitions: [],
  },
  views: {
    list: { columns: ["code", "customerId", "totalAmount"], filters: ["status"], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code", "customerId", "totalAmount"] }],
  },
});

const salesCatalog = analysisCatalogOf([salesOrder, customer]);

describe("analysis sql gate: summary of sales by customer", () => {
  it("release the header amount of INNER JOIN's client name ranking SELECT", () => {
    const checked = checkAnalysisSql(
      salesCatalog,
      `SELECT c.name AS customer_name, SUM(h.total_amount) AS sales
         FROM oe_sales_order h
         INNER JOIN oe_customer c ON h.customer_id = c.id
        GROUP BY c.id, c.name
        ORDER BY sales DESC
        LIMIT 20`,
    );
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.value.relations).toEqual(["oe_customer", "oe_sales_order"]);
    }
  });

  it("no return. IN 51, first shot to bill list, no report TOO MANY PARAMS", () => {
    const names = Array.from({ length: 51 }, (_, i) => `Customer${i}`);
    const placeholders = names.map((_, i) => `$${i + 1}`).join(", ");
    const checked = checkAnalysisSql(
      salesCatalog,
      `SELECT code, name, address FROM oe_customer WHERE name IN (${placeholders}) LIMIT 20`,
      names,
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
      expect(checked.issues.some((issue) => issue.code === "ANALYSIS_SQL_TOO_MANY_PARAMS")).toBe(false);
      expect(checked.issues[0]?.example).toContain('"use":"bill_list"');
      expect(checked.issues[0]?.example).toContain('"module":"customer"');
      expect(checked.issues[0]?.example).toContain('"code"');
      expect(checked.issues[0]?.example).toContain('"address"');
      expect(checked.issues[0]?.correction).not.toMatch(/17/);
    }
  });

  it("unaccompanied LIMIT 51 First cut to bill list", () => {
    const checked = checkAnalysisSql(
      salesCatalog,
      "SELECT code, name, address FROM oe_customer LIMIT 51",
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_USE_BILL_LIST");
      expect(checked.issues.some((issue) => issue.code === "ANALYSIS_SQL_TOO_MANY_PARAMS")).toBe(false);
      expect(checked.issues[0]?.example).toContain('"use":"bill_list"');
    }
  });

  it("yes, but too many arguments to say unapproval.", () => {
    const ids = Array.from({ length: 33 }, (_, i) => `id-${i}`);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const checked = checkAnalysisSql(
      salesCatalog,
      `SELECT status, COUNT(*) AS n FROM oe_sales_order WHERE id IN (${placeholders}) GROUP BY status LIMIT 20`,
      ids,
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues[0]?.code).toBe("ANALYSIS_SQL_TOO_MANY_PARAMS");
      expect(checked.issues[0]?.correction).toMatch(/split into several queries/);
    }
  });

  it("lEFT JOIN from the client was rejected as ANALISIS SQL OUTER JOIN", () => {
    const checked = checkAnalysisSql(
      salesCatalog,
      `SELECT c.name AS customer_name, SUM(h.total_amount) AS sales
         FROM oe_customer c
         LEFT JOIN oe_sales_order h ON h.customer_id = c.id
        GROUP BY c.id, c.name
        ORDER BY sales DESC
        LIMIT 20`,
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues.some((issue) => issue.code === "ANALYSIS_SQL_OUTER_JOIN")).toBe(true);
    }
  });
});

/**
 * 🔴 The return of 500 on line: When a table search does not contain an alias, the key word at the end is taken as an alias.
 *
 * `FROM oe_purchase_order WHERE status = $1` Lee. `WHERE` It's an alias. `where`，
 :: Spell it when you inject the tenant condition `"where".tenant_id = $1` - PostgreSQL syntax error, whole 500.
 * and it's the most common way to write no aliases.
 *(It is estimated that the price of the offer in "which purchase prices are significantly higher" is the price of SQL.
 */
describe("it's not an alias.", () => {
  const noAlias = [
    ["where", "SELECT status, COUNT(*) AS n FROM oe_purchase_order WHERE status = $1 GROUP BY status LIMIT 20"],
    ["group", "SELECT status, COUNT(*) AS n FROM oe_purchase_order GROUP BY status LIMIT 20"],
    ["order", "SELECT status, COUNT(*) AS n FROM oe_purchase_order ORDER BY status LIMIT 20"],
    ["limit", "SELECT COUNT(*) AS n FROM oe_purchase_order LIMIT 20"],
  ] as const;

  for (const [keyword, sql] of noAlias) {
    it(`\`${keyword}\` is not treated as an alias`, () => {
      const checked = checkAnalysisSql(catalog, sql, keyword === "where" ? ["awaitingReceipt"] : []);
      expect(checked.ok, JSON.stringify(checked.ok ? {} : checked.issues)).toBe(true);
      if (!checked.ok) return;
      // an alias is the form itself when no aliases are written; no keywords appear
      expect(Object.keys(checked.value.aliases)).toEqual(["oe_purchase_order"]);
    });
  }

  it("it looks like a keyword.", () => {
    const checked = checkAnalysisSql(
      catalog,
      'SELECT "where".status, COUNT(*) AS n FROM oe_purchase_order AS "where" GROUP BY "where".status LIMIT 20',
      [],
    );
    expect(checked.ok, JSON.stringify(checked.ok ? {} : checked.issues)).toBe(true);
    if (checked.ok) expect(Object.keys(checked.value.aliases)).toEqual(["where"]);
  });
});

describe("injectTenantPredicates Injected by SELECT", () => {
  it("the inner aliases of the relevant sub-search do not mention the outer WHERE", () => {
    const sql = `SELECT count(*)::int AS value FROM oe_purchase_order r
      WHERE r.total_amount - coalesce((
        SELECT sum(l.qty) FROM oe_purchase_order_lines l
        WHERE l.bill_id = r.id
      ), 0) > 0`;
    const injected = injectTenantPredicates(
      { sql, params: [], relations: ["oe_purchase_order", "oe_purchase_order_lines"], aliases: { r: "oe_purchase_order", l: "oe_purchase_order_lines" } },
      "t-demo",
    );
    expect(injected.sql).toMatch(/WHERE r\.tenant_id = \$1 AND/);
    expect(injected.sql).toMatch(/WHERE l\.tenant_id = \$1 AND/);
    expect(injected.sql).not.toMatch(/WHERE r\.tenant_id = \$1 AND l\.tenant_id/);
    expect(injected.params).toEqual(["t-demo"]);
  });
});

describe("injectScopedhere Press SELECT Enter", () => {
  it("union branch injected WHERE and separated from Union All by blank", () => {
    const sql = `SELECT 'stockIn'::text AS module, si.id, si.code FROM oe_stock_in si
  UNION ALL
  SELECT 'stockOut'::text AS module, so.id, so.code FROM oe_stock_out so`;
    const injected = injectScopedWhere(sql, (aliases) =>
      aliases.map((alias) => `${alias}.tenant_id = $1`).join(" AND ") || null,
    );
    expect(injected).toMatch(/si\.tenant_id = \$1\s+UNION ALL/i);
    expect(injected).toMatch(/so\.tenant_id = \$1\s*$/i);
    expect(injected).not.toMatch(/\$1UNION/i);
  });

  it("wHERE injected at the end of the session with a line comment Okay.", () => {
    const sql = `SELECT 'stockIn'::text AS module, si.id, si.code FROM oe_stock_in si -- comment`;
    const injected = injectScopedWhere(sql, (aliases) =>
      aliases.map((alias) => `${alias}.tenant_id = $1`).join(" AND ") || null,
    );
    expect(injected).toMatch(/si\.tenant_id = \$1/);
    expect(injected).not.toMatch(/--[^\n]*WHERE/i);
  });

  it("external aliases are not written in the accounts.", () => {
    const sql = `SELECT p.id, w.id FROM oe_product p
      CROSS JOIN oe_warehouse w
      LEFT JOIN (SELECT * FROM oe_effect_ledger WHERE target = 'stock') l
        ON l.subject_id = p.id AND l.scope_id = w.id
      WHERE ($1::text IS NULL OR w.id = $1)
      GROUP BY p.id, w.id`;
    const injected = injectScopedWhere(sql, (aliases) => (aliases.includes("w") ? "w.id IN ($2)" : null));
    expect(injected).toMatch(/WHERE w\.id IN \(\$2\) AND/);
    expect(injected).not.toMatch(/oe_effect_ledger WHERE w\.id/);
  });
});

function injectedTenant(sql: string, params: readonly unknown[] = []) {
  return injectTenantPredicates(
    { sql, params, relations: [], aliases: {} },
    "t-demo",
  );
}

describe("the LEFT JOIN tenant word is written on ON", () => {
  it("lEFT JOIN when it hits another tenant's dimensions, the tenant's word is \"on\" and it's not filtered out.", () => {
    const sql = `SELECT f.id, w.name
FROM oe_process_assignment f
INNER JOIN oe_process_assignment_source_line h ON h.bill_id = f.id
LEFT JOIN oe_worker w ON w.id = f.worker_id
WHERE f.status = 'awaitingProduction'`;
    expect(physicalAliasesInScope(sql)).toEqual(["f", "h", "w"]);
    expect(leftJoinAliasesInScope(sql)).toEqual(["w"]);
    const injected = injectedTenant(sql);
    expect(injected.sql).toMatch(/LEFT JOIN oe_worker w ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$1/);
    expect(injected.sql).toContain("INNER JOIN oe_process_assignment_source_line h ON h.bill_id = f.id");
    expect(injected.sql).not.toMatch(/h\.bill_id = f\.id AND h\.tenant_id/);
    const where = injected.sql.slice(injected.sql.search(/\bWHERE\b/i));
    expect(where).toContain("f.tenant_id = $1");
    expect(where).toContain("h.tenant_id = $1");
    expect(where).not.toContain("w.tenant_id");
    expect(injected.params).toEqual(["t-demo"]);
  });

  it("two LEFT JOINs, one ON and the other with their tenant id, FROM tables still at WHERE", () => {
    const sql = `SELECT f.id, w.name, t.name
FROM oe_process_assignment f
LEFT JOIN oe_worker w ON w.id = f.worker_id
LEFT JOIN oe_team t ON t.id = f.team_id
WHERE f.status = 'awaitingProduction'`;
    const injected = injectedTenant(sql);
    expect(injected.sql).toMatch(/LEFT JOIN oe_worker w ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$1/);
    expect(injected.sql).toMatch(/LEFT JOIN oe_team t ON \(t\.id = f\.team_id\) AND t\.tenant_id = \$1/);
    const where = injected.sql.slice(injected.sql.search(/\bWHERE\b/i));
    expect(where).toContain("f.tenant_id = $1");
    expect(where).not.toContain("w.tenant_id");
    expect(where).not.toContain("t.tenant_id");
    expect(injected.params).toEqual(["t-demo"]);
    expect(injected.sql).not.toMatch(/\$2/);
  });

  it("lEFT JOIN Sub-Query does not add \"ON Tenant\" to the outer aliases, the inner layer FROM is still searching for WHERE", () => {
    const sql = `SELECT f.id
FROM oe_process_assignment f
LEFT JOIN (SELECT * FROM oe_effect_ledger WHERE target = 'stock') l
  ON l.subject_id = f.id`;
    const injected = injectedTenant(sql);
    expect(injected.sql).toMatch(
      /FROM oe_effect_ledger WHERE oe_effect_ledger\.tenant_id = \$1 AND target = 'stock'/,
    );
    expect(injected.sql).toMatch(/ON l\.subject_id = f\.id/);
    expect(injected.sql).not.toMatch(/l\.tenant_id/);
    expect(injected.sql).not.toMatch(/oe_effect_ledger WHERE[^)]*f\.tenant_id/);
    expect(injected.sql).toMatch(/WHERE f\.tenant_id = \$1/);
    expect(leftJoinAliasesInScope(sql)).toEqual([]);
    expect(injected.params).toEqual(["t-demo"]);
  });

  it("lEFT OUTER JOIN also put the tenant word in ON", () => {
    const sql = `SELECT f.id, w.name
FROM oe_process_assignment f
LEFT OUTER JOIN oe_worker w ON w.id = f.worker_id
WHERE f.status = 'awaitingProduction'`;
    const injected = injectedTenant(sql);
    expect(injected.sql).toMatch(
      /LEFT OUTER JOIN oe_worker w ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$1/,
    );
    const where = injected.sql.slice(injected.sql.search(/\bWHERE\b/i));
    expect(where).toContain("f.tenant_id = $1");
    expect(where).not.toContain("w.tenant_id");
  });

  it("lEFT JOIN for the physics of the missing O.N.", () => {
    const sql = `SELECT f.id
FROM oe_process_assignment f
LEFT JOIN oe_worker w
WHERE f.status = 'awaitingProduction'`;
    const injected = injectedTenant(sql);
    expect(injected.sql).toMatch(/LEFT JOIN oe_worker w ON w\.tenant_id = \$1/);
    const where = injected.sql.slice(injected.sql.search(/\bWHERE\b/i));
    expect(where).toContain("f.tenant_id = $1");
    expect(where).not.toContain("w.tenant_id");
  });

  it("the same term as the tenant in the O.K.", () => {
    const sql = `SELECT f.id, w.name
FROM oe_process_assignment f
LEFT JOIN oe_worker w ON (w.id = f.worker_id) AND w.tenant_id = $1
WHERE f.status = 'awaitingProduction'`;
    const injected = injectedTenant(sql);
    expect(injected.sql.match(/w\.tenant_id = \$1/g)).toEqual(["w.tenant_id = $1"]);
    expect(injected.sql).toContain("WHERE f.tenant_id = $1 AND f.status = 'awaitingProduction'");
  });

  it("lEFT JOIN shares the next tenant slot with FROM when bound parameters already exist", () => {
    const injected = injectedTenant(
      `SELECT f.id, w.name
FROM oe_process_assignment f
LEFT JOIN oe_worker w ON w.id = f.worker_id
WHERE f.status = $1`,
      ["awaitingProduction"],
    );
    expect(injected.params).toEqual(["awaitingProduction", "t-demo"]);
    expect(injected.sql).toMatch(/ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$2/);
    expect(injected.sql).toContain("WHERE f.tenant_id = $2 AND f.status = $1");
    const where = injected.sql.slice(injected.sql.search(/\bWHERE\b/i));
    expect(where).not.toContain("w.tenant_id");
  });

  it("rIGHT JOIN, Normal JOIN, CROSS JOIN, FULL JOIN still has the name of the tenant.", () => {
    const sql = `SELECT f.id, h.id, w.name, t.name, c.id
FROM oe_process_assignment f
CROSS JOIN oe_warehouse c
JOIN oe_team h ON h.id = f.team_id
RIGHT JOIN oe_worker w ON w.id = f.worker_id
FULL JOIN oe_customer t ON t.id = f.customer_id
WHERE f.status = 'awaitingProduction'`;
    const injected = injectedTenant(sql);
    const whereAt = injected.sql.search(/\bWHERE\b/i);
    expect(injected.sql.slice(0, whereAt)).not.toContain("tenant_id");
    const where = injected.sql.slice(whereAt);
    for (const alias of ["f", "c", "h", "w", "t"]) {
      expect(where).toContain(`${alias}.tenant_id = $1`);
    }
    expect(injected.params).toEqual(["t-demo"]);
  });

  it("lEFT JOIN in CTE and LEFT JOIN in the ON of this field", () => {
    const sql = `WITH p_fact_0 AS (
  SELECT f.id
  FROM oe_process_assignment f
  LEFT JOIN oe_worker w ON w.id = f.worker_id
  WHERE f.status = 'awaitingProduction'
)
SELECT m.id, t.name
FROM p_fact_0 m
LEFT JOIN oe_team t ON t.id = m.team_id`;
    const injected = injectedTenant(sql);
    expect(injected.sql).toMatch(/LEFT JOIN oe_worker w ON \(w\.id = f\.worker_id\) AND w\.tenant_id = \$1/);
    expect(injected.sql).toMatch(/LEFT JOIN oe_team t ON \(t\.id = m\.team_id\) AND t\.tenant_id = \$1/);
    const whereAt = injected.sql.indexOf("WHERE");
    const innerWhere = injected.sql.slice(whereAt, injected.sql.indexOf(")", whereAt));
    expect(innerWhere).toContain("f.tenant_id = $1");
    expect(innerWhere).not.toContain("w.tenant_id");
    expect(injected.sql).not.toMatch(/m\.tenant_id/);
    expect(injected.sql).not.toMatch(/p_fact_0\.tenant_id/);
    expect(injected.params).toEqual(["t-demo"]);
  });
});

describe("aliasScopePredicate", () => {
  it("left connection (w.id IS NULL OR (w.team id = $2)), non-left connection returns as it is", () => {
    expect(aliasScopePredicate("w", "w.team_id = $2", true)).toBe("(w.id IS NULL OR (w.team_id = $2))");
    expect(aliasScopePredicate("w", "w.team_id = $2", false)).toBe("w.team_id = $2");
    expect(aliasScopePredicate("l", "false", true)).toBe("(l.id IS NULL OR (false))");
    expect(aliasScopePredicate("l", "l.bill_id IN (SELECT 1)", false)).toBe("l.bill_id IN (SELECT 1)");
  });
});

describe('agent default contract result budget',()=>{
 it('lIMIT is only missing for a valid aggregate of 20, keeping parameters, conditions, sorting',()=>{
  const prepared=prepareAgentAnalysisSql(catalog,"SELECT status, SUM(total_amount) AS amount FROM oe_purchase_order WHERE supplier_id = $1 GROUP BY status ORDER BY status; -- tail",['supplier']);
  expect(prepared.defaultLimitApplied).toBe(true);expect(prepared.validated.sql).toContain('ORDER BY status LIMIT 20');expect(prepared.validated.params).toEqual(['supplier']);
 });
 it('the visible small ceiling remains unchanged',()=>{const prepared=prepareAgentAnalysisSql(catalog,'SELECT COUNT(*) AS n FROM oe_purchase_order LIMIT 1');expect(prepared.defaultLimitApplied).toBe(false);expect(prepared.validated.sql).toContain('LIMIT 1');});
 it.each(['SELECT code FROM oe_purchase_order','DELETE FROM oe_purchase_order','SELECT COUNT(*) FROM pg_stat_activity','SELECT COUNT(*) FROM oe_purchase_order LIMIT 100','SELECT COUNT(*) FROM oe_purchase_order; SELECT COUNT(*) FROM oe_purchase_order','SELECT COUNT(*) FROM oe_purchase_order WHERE supplier_id = $1'])('other rejections are not waived by the default budget: %s',sql=>{expect(()=>prepareAgentAnalysisSql(catalog,sql)).toThrow();});
});
