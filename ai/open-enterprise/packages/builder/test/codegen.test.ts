import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { genDb, snake } from "../src/codegen.js";

const DOMAINS = path.resolve(fileURLToPath(new URL("../../../domains", import.meta.url)));
const GENERATED = path.resolve(fileURLToPath(new URL("../../../tables/src", import.meta.url)));

async function generated(): Promise<Map<string, string>> {
  const { files } = await genDb(DOMAINS);
  return new Map(files.map((f) => [f.path, f.content]));
}

/**
 * take the product and throw it if you can't.
 *
 No, no, no. `?? ""` Bottom: Following the subsequent assertion, `not.toContain`, and ** empty string meets all
 * negative assertion**. The three R22s of the product file name change (or a module is removed) and the "Patron field is not created"
 * the regression line becomes a green empty turn together, and that is why the document exists.
 */
function mustGet(files: Map<string, string>, name: string): string {
  const hit = files.get(name);
  if (hit === undefined) {
    throw new Error(`generated output has no "${name}". Present: ${[...files.keys()].join(", ")}`);
  }
  return hit;
}

describe("snake", () => {
  it("camelCase spin snake case", () => {
    expect(snake("salesOrder")).toBe("sales_order");
    expect(snake("totalAmount")).toBe("total_amount");
    expect(snake("code")).toBe("code");
  });
});

describe("generating products and statements are not allowed to drift.", () => {
  it("🔴 A table definition for the warehouse = products generated from domains/", async () => {
    // Without this gate, add a field to the sales order, forget to run. `yarn gen:db`，
    // yarn test with yarn typecheck
    // the old one in the barn. Render the input box after startup and save it with a non-existent column value.
    // the report says PG's "column does not exist" - the problem is on the side of the statement, the symptoms are on the endurance level.
    //
    // it also eliminates the use of hand-written lists of names: the collection itself is in contrast. Internal
    const onDisk = new Map(
      readdirSync(GENERATED)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => [f, readFileSync(path.join(GENERATED, f), "utf8")] as const),
    );
    const fresh = await generated();
    expect(fresh.size).toBeGreaterThan(1);

    const hint = "run `yarn gen:db` again and commit the output";
    expect([...fresh.keys()].sort(), hint).toEqual([...onDisk.keys()].sort());
    for (const [name, content] of fresh) {
      expect(onDisk.get(name), `${name} does not match the declaration — ${hint}`).toBe(content);
    }
  });
});

describe("genDb", () => {
  it("platform personnel catalogue by joint tenant/platform UID identification, general operating document maintains global master key", async () => {
    const files = await generated();
    expect(mustGet(files, "subject.ts")).toContain('primaryKey({ name: "oe_subject_pkey", columns: [t.tenantId, t.id] })');
    expect(mustGet(files, "subject.ts")).toContain('id: text("id").notNull()');
    expect(mustGet(files, "salesOrder.ts")).toContain('id: text("id").primaryKey()');
  });
  it("platform field supplemented by generator, not read from declaration", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    for (const col of ["id", "tenant_id", "org_id", "status", "revision", "created_at", "created_by", "updated_at", "updated_by"]) {
      expect(so).toContain(`"${col}"`);
    }
    expect(so).toContain('revision: integer("revision").notNull().default(1)');
  });

  // 🔴 It's the same "no balance sheet" discipline that's on the surface: it counts when a query is made.
  it("no column for rollup and lookup field", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    expect(so).not.toContain("shipped_qty"); // rollup
    expect(so).not.toContain("customer_name"); // lookup
  });

  it("formula field does not create column", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    // amount on line is the same discipline as "no balance sheet" when searching for it. Formula
    expect(so).not.toMatch(/^\s*amount:/m);
  });

  it("subtable without columns and a table", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    expect(so).not.toMatch(/^\s*lines: /m);
    expect(so).toContain('pgTable(\n  "oe_sales_order_lines"');
    // it's true that the column from the table came from Field.fields.
    expect(so).toContain('numeric("qty"');
    expect(so).toContain('text("product_id")');
  });

  it("point back to the head of the table from the top of the table -- details must follow when the draft is deleted", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    expect(so).toContain('.references(() => salesOrder.id, { onDelete: "cascade" })');
  });

  it("primary field is the only one in the tenant -- two identical documents are disaster.", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    expect(so).toContain('uniqueIndex("oe_sales_order_code_uq").on(t.tenantId, t.code)');
  });

  // These two were nailed. `product.barcode` Go on. After the product file is "the class of goods plus the specification line"
  // Barcode moved into line and pressed `FIELD_UNIQUE_ON_LINE` I can't hang up that line of return.
  // There is no carrier. ** The gate hasn't changed.`defectType.name` Same thing.
  // the field on the table is unique. To delete them would be to leave no line of return for such errors as the "denantId".
  it("🔴 Unique field sends the only index with a range of tenantId - missing the tenant is the cross-tenant", async () => {
    // the result of missing tenantId is not a mistake: a tenant's name is B, and the tenant can't fill it out anymore.
    // and the rejection itself revealed "other tenants have this value."
    const files = await generated();
    expect(mustGet(files, "defectType.ts")).toContain(
      'uniqueIndex("oe_defect_type_name_uq").on(t.tenantId, t.name)',
    );
    expect(mustGet(files, "customer.ts")).toContain(
      'uniqueIndex("oe_customer_name_uq").on(t.tenantId, t.name)',
    );
    expect(mustGet(files, "supplier.ts")).toContain(
      'uniqueIndex("oe_supplier_name_uq").on(t.tenantId, t.name)',
    );
  });

  it("🔴 Unique Index does not have where - PG default NULLS DISTINCT, all records that are not filled in", async () => {
    // A collection of records that do not record the value is a legal state of business. Add `where col is not null` It's the same behavior.
    // add a more hard-to-read statement; the real risk is on the opposite side - what form it takes to write it in a partial index,
    // or let an empty string fall.
    const defectType = mustGet(await generated(), "defectType.ts");
    const line = defectType.split("\n").find((l) => l.includes("oe_defect_type_name_uq"));
    expect(line).toBeDefined();
    expect(line).not.toContain(".where(");
  });

  it("no long index of modules without unique declarations -- this cell is declared, not opened by default", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    // so there's only two frames on it:
    // primary (single tenant) and line number from the table (bil id, line no)
    expect(so.match(/uniqueIndex\("oe_sales_order[a-z_]*_uq"\)/g)).toEqual([
      'uniqueIndex("oe_sales_order_code_uq")',
      'uniqueIndex("oe_sales_order_lines_no_uq")',
    ]);
  });

  it("no Null", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    expect(so).toContain('text("customer_id").notNull()'); // required: true
    expect(so).toContain('text("remark")'); // i don't have to fill it.
    expect(so).not.toContain('text("remark").notNull()');
  });

  it("generatedSequence fields are listed and not Null - mandatory in billing matters", async () => {
    const bom = mustGet(await generated(), "bom.ts");
    expect(bom).toContain('version: text("version").notNull()');
  });

  it("systemGenerated empty - actualStartat was not written when scheduled", async () => {
    const task = mustGet(await generated(), "productionTask.ts");
    expect(task).toContain('actualStartAt: timestamp("actual_start_at", { withTimezone: true })');
    expect(task).not.toContain('actualStartAt: timestamp("actual_start_at", { withTimezone: true }).notNull()');
  });

  // there was also a "plannerupplied" here, which was just a system-generated channel contract, without coding artificially empty source coordinates.
  // Not Null. It's the only living sample. `warehouseDemand`（`direction` / `sourceType` /
  // `warehouseMode` / `sourceCode` Four rows of PlannerSupplied and empty)
  // clean up and delete; every planner Supplid field in the product catalogue is not Null at this time.
  // the assertion that there are no burden-bearers can only be constant. ** Add this to the blank field when the Planner Superlid + appears again. **
  // But this side of the empty column is now from below. `snapshot.optional` The one with
  // `packages/builder/test/gate.test.ts` In the last few days, the "scrambling list" was secured.

  it("auto takes number fields with columns and not Null - do not create column diversions with Deve", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    // auto is a system supply but a column; no column is created
    expect(so).toContain('text("code").notNull()');
    expect(so).not.toContain("shipped_qty"); // rollup
  });

  // This nail is a downgrade with no symptoms**:`salesOrder.lines.unit` Original `required: true`
  // ⇒ NOT NULL. `snapshot` After that, required has to be removed.
  // if the watch side does not recognize snapshot, this column will be silently returned from NOT NULL to fullable...
  // the net effect of a "strengthen unit calibre" modification is to remove an existing physical constraint.
  // And diff is just a few tables missing. `.notNull()`。
  //
  // The air is split between two gates:`SNAPSHOT_MATCH_OPTIONAL`(Coordinates have to be filled in. ⇒ Quote must be there.)
  // + `checkCrossReferences` . The source is not an empty guarantee (refer to the existence of a reference to obtain value).
  it("🔴 snapshot freeze listed and not Null - same as auto / lineAgg, not new", async () => {
    const files = await generated();
    // the old way of the watch hasn't changed.
    expect(mustGet(files, "salesOrder.ts")).toContain('text("customer_id").notNull()');
    // the details of the units frozen: required have been removed (no markers) and the column is still not Null.
    // 🔴 `stockIn` / `stockOut` It was removed from this list: after the list was aligned with the demo, the list was removed.
    // Theirs. `unit` is ** common crossword** (no longer snapshot) and column empty is the correct result and not the downgrade.
    // staying on the list will give the correct statement red and force the next person to add it back to not Null.
    // The block is still secured by the two below. `salesDelivery` Yes. `through: "lines"` Yes.
    // refLine form - Both coordinates cover one.
    for (const [file, column] of [
      ["salesOrder.ts", "unit"],
      ["salesDelivery.ts", "unit"],
    ] as const) {
      expect(mustGet(files, file), `${file} column ${column} lost notNull`).toContain(`text("${column}").notNull()`);
    }
    // simplified stockIn does not register batches and does not generate spec columns.
  });

  it("snapshot.optional target column is empty; regular snapshot with a source is still NOT NULL", async () => {
    const files = await generated();
    // An ancestral snapshot of the tree:`parentOrgId` The empty top tissue has no superiors to freeze.
    // `optional: true`The column must be empty.
    const orgUnit = mustGet(files, "orgUnit.ts");
    expect(orgUnit).toContain('ancWorkshopId: text("anc_workshop_id"),');
    expect(orgUnit).not.toContain('ancWorkshopId: text("anc_workshop_id").notNull()');

    // inverted nailing: Add a new option that does not ease the normal snapshot.
    expect(mustGet(files, "salesDelivery.ts")).toContain('unit: text("unit").notNull()');
  });

  it("numeric, no floating point - 0.1 + 0.2 must equal 0.3", async () => {
    const so = mustGet(await generated(), "salesOrder.ts");
    expect(so).toContain('numeric("total_amount", { precision: 18, scale: 4 })'); // money
    // the number of cross-commodity tableheads, which did not have a common matrix, had been deleted; the number of main units fell on each commodity item.
    expect(so).toContain('numeric("base_qty", { precision: 18, scale: 6 })'); // number
    expect(so).not.toContain('numeric("total_qty"');
    expect(so).not.toContain("doublePrecision");
    expect(so).not.toContain("real(");
  });

  it("\"Don't change your hand\" banner.", async () => {
    for (const content of (await generated()).values()) {
      expect(content).toContain("Do not hand-edit");
    }
  });
});
