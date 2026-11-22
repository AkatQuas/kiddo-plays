import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { run, type Sink } from "../src/cli.js";
import { catalog, type CatalogModule } from "../src/index.js";

const DOMAINS = path.resolve(fileURLToPath(new URL("../../../domains", import.meta.url)));

function sink(): Sink & { text(): string } {
  const parts: string[] = [];
  return {
    write: (t: string) => {
      parts.push(t);
    },
    text: () => parts.join(""),
  };
}

/** Single-module contract. `catalog` selectors are mutually exclusive, and the module branch always returns CatalogModule. */
async function contractOf(module: string): Promise<CatalogModule> {
  return await catalog(DOMAINS, { kind: "module", module }) as CatalogModule;
}

/*:: Run one command and get stdout/ stderr/ exit code */
async function cli(...argv: string[]): Promise<{ out: string; err: string; code: number }> {
  const out = sink();
  const err = sink();
  const code = await run(argv, out, err);
  return { out: out.text(), err: err.text(), code };
}

describe("catalog: single-module static contracts", () => {
  it("the next slide is a direct display of normative targets and line maps", async () => {
    const result = await contractOf("purchasePlan");
    // Not without a line map `line`I don't know. The contract does not leave empty keys.
    expect(result.transitions?.find((transition) => transition.code === "to_order")?.push)
      .toEqual({ module: "purchaseOrder" });
  });

  it("inheritedFrom - the exit is not naked.", async () => {
    // the interface and the CLI have to mark the source: an unwritten rule on this side blocks it, doesn't say where it came from.
    // the user will change a non-existent statement next.
    const result = await contractOf("purchaseOrder");
    const exception = result.transitions?.find((t) => t.code === "approve_plan");
    const inherited = exception?.guards?.filter((g) => g.inheritedFrom !== undefined) ?? [];
    expect(inherited.map((g) => g.id)).toContain("supplier_active");
    expect(inherited.every((g) => g.inheritedFrom === "approve")).toBe(true);
    // think of it as the non-inheritance of the exit: that's what this side was designed to bypass.
    expect(exception?.guards?.map((g) => g.id)).not.toContain("plan_orders_use_plan_approval");
  });

  it("🔴 It's a relationship you can't check in on -- the gap can't be empty. White", async () => {
    // if the gap is blank, it will be read as "no downstream documentation."
    const result = await contractOf("salesOrder");
    const all = [...(result.references ?? []), ...(result.referencedBy ?? [])];
    expect(all.length).toBeGreaterThan(0);

    // 🔴 The verdict is “is it a single item or a fine line”, not “extends the table or a table”.
    // the line-line product Id is hanging on the line, but it points to the head** of the commodity, so it's recheckable--
    // "Who used the product?"
    const inbound = (await contractOf("product")).referencedBy ?? [];
    const fromLine = inbound.filter((r) => r.through !== undefined);
    expect(fromLine.length).toBeGreaterThan(0);
    expect(fromLine.every((r) => r.toLine === undefined && r.reverseQueryField !== undefined)).toBe(true);

    // the category that can't really reverse: points to a line** (refLine). OrderLineid
    // it's an order line. id, make it match the order line. id.
    const orderInbound = (await contractOf("salesOrder")).referencedBy ?? [];
    const toLine = orderInbound.find((r) => r.field === "orderLineId");
    expect(toLine).toMatchObject({ through: "lines", toLine: true, toThrough: "lines" });
    expect(toLine?.reverseQueryField).toBeUndefined();
    // the same citation from the watch can be rechecked -- the combination of "relevant documents" from the library depends on it.
    const toBill = orderInbound.find((r) => r.field === "orderId");
    expect(toBill?.toLine).toBeUndefined();
    expect(toBill?.reverseQueryField).toBeTruthy();
  });

  it("i'll tell you who to put it on.", async () => {
    const result = await contractOf("salesDelivery");
    const confirm = result.transitions?.find((t) => t.code === "confirm");
    expect(confirm?.postsToLedger).toEqual([
      "stock out {$line.baseQty} (per line) posted to $line.productId × $bill.warehouseId",
    ]);
  });

  it("formula Rendering Adult Words with UI", async () => {
    const result = await contractOf("salesOrder");
    const lines = result.fields.find((f) => f.key === "lines");
    const amount = lines?.columns?.find((c) => c.key === "amount");
    expect(amount?.systemSupplied).toBe(true);
    expect(amount?.formula).toBeTruthy();
  });

  it("🔴 The only tenant in the master identifier is derived from ** - there's no word in the module source code.", async () => {
    // This is one of the most advanced steps of the Sankri:`primary` Fields By `FIELD_UNIQUE_WITH_PRIMARY` Order.
    // It is forbidden to mark it unique again, yet the table builder really emits `uniqueIndex(tenant_id, column)`.
    // if you don't print it, the FDE will use the extra plain and the client will have to answer "the only one in the source code."
    // and Curly's index will answer for us on the second list.
    const result = await contractOf("salesOrder");
    const primary = result.fields.filter((f) => f.primary);
    expect(primary).toHaveLength(1);
    expect(primary[0]).toMatchObject({ unique: "primary" });

    // "There's no word in the source code" is not a word. `unique` It's not even a word.
    // Yeah. `product.code` There's one on the library. `uniqueIndex(tenant_id, code)`。
    // once this assertion is not established, it means that the singularity becomes a declarative position -- and then, explain, this is no longer a decryption.
    const source = await readFile(path.join(DOMAINS, result.file), "utf8");
    expect(source).not.toMatch(/\bunique\b/);
  });

  it("the auto-labeled unique is separated from the main identifier -- 400 a 409 after the crash", async () => {
    // after the synthesis of a boolean, there is no answer on the extlain:
    // declared to double the application layer (400 + field by field UNIQUE DUPLICATE, can mark).
    // primary is not visible on all platform pick-up numbers, weight checker structures. The collision number is only possible at the same time (409)
    // 🔴 Carrier from `product.barcode` I got it. `defectType`: The product of the product archive, "Property family + specification line"
    // Then barcode move into line, press `FIELD_UNIQUE_ON_LINE` Can't hang up again.
    const result = await contractOf("defectType");
    const name = result.fields.find((f) => f.key === "name");
    expect(name).toMatchObject({ unique: "declared" });
    expect(name?.primary).toBeUndefined();
    expect(result.fields.find((f) => f.key === "code")).toMatchObject({ unique: "primary", primary: true });
    // 🔴 The only ** does not contain the required **: PG's only index default NULLS DISTINCT, the key that produces the empty string,
    // A collection of unfilled records has been kept. Here it is. `code` Nailed (only but not necessary).
    // ⚠️ Gap Note: ** "Useable declared UNique + empty" does not have a full carrier today**
    // existing declared unique fields (defectType.name /Operation.name /warehouse.name /customer.name /supplier.name)
    // all of them. The caliber is still guarded by the codegen's "unique index" where.
    // but there's only one of those half-barrells on this side.
    expect(result.fields.find((f) => f.key === "code")?.required).toBeUndefined();
  });

  it("the user's obligation is to be printed, not the column NOT NULL - the system supply field does not pretend to be filled", async () => {
    // the tableside auto / lineAgg column is the same not Null, but it's not something to fill out**
    // （`FIELD_REQUIRED_SYSTEM_SUPPLIED` Even declarations are prohibited. It'll make you feel better.
    // find a non-existent input box; their explanation belongs to the subpply
    const result = await contractOf("salesOrder");
    const totalAmount = result.fields.find((f) => f.key === "totalAmount");
    expect(totalAmount).toMatchObject({ supply: "lineAgg" });
    expect(totalAmount?.required).toBeUndefined();
    const customerId = result.fields.find((f) => f.key === "customerId");
    expect(customerId).toMatchObject({ required: true });
    expect(customerId?.supply).toBeUndefined();
    expect(customerId?.unique).toBeUndefined();
  });

  it("🔴 The only constant line in the column is nuld -- there is no index from the table", async () => {
    // Detailed unique by `FIELD_UNIQUE_ON_LINE` Rejected (sole/ non-repeated list of entire tenants)
    // both readings are valid and cannot be guessed by location) and the meter is not the only index from any business.
    // if we do this, we'll have a non-existent constraint.
    const result = await contractOf("salesOrder");
    const lines = result.fields.find((f) => f.key === "lines");
    expect(lines?.columns?.length).toBeGreaterThan(0);
    expect(lines?.columns?.every((c) => c.unique === undefined)).toBe(true);
    // the breakdown is always meaningful (it is compiled from the table NOT NULL)
    expect(lines?.columns?.some((c) => c.required)).toBe(true);
  });

  it("refLine's watch-head companionref clearly marked as system attribution, no longer impersonating fillable fields", async () => {
    const result = await contractOf("salesDelivery");
    const lines = result.fields.find((field) => field.key === "lines");
    const order = lines?.columns?.find((field) => field.key === "orderId");
    expect(order).toMatchObject({ systemSupplied: true, supply: "refOwner" });
    expect(order?.formula).toContain("Order line");
  });
});

describe("CLI shell: error silent", () => {
  it("unknown command and missing parameter: exit code not zero / original throw, silent success", async () => {
    const unknown = await cli("nope", "--domains", DOMAINS);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain("Unknown command");
    // selfctor's no priority in rebuffing each other: reporting the wrongs for both, not returning an answer that the caller didn't want.
    await expect(cli("catalog", "--module", "warehouse", "--need", "subtable", "--domains", DOMAINS))
      .rejects.toThrow(/selectors are mutually exclusive/);
  });
});

// ---------------------------------------------------------------------------
// 🔴 "Status = valid" says the condition, and where ** it is satisfied.**
//
// the parent organization can only be attached to an effective organization; if only "select one", the user does not know to go to the organization first.
// this post is part of our special coverage Syria Protests 2011. This section is filtered with ** self-referenced ** status, which is still on the real business chain, and uses generic extrapolation capability
// nailed on both sides of explain (JSON and text).
//(The list was originally pegged to the program CostSheet.corretionOfID, which was cleared with no menu entry.
// ---------------------------------------------------------------------------
describe("cross-module pre-actions in candidate conditions", () => {
  it("the condition says, \"Where are we going to do what?\"", async () => {
    const result = await contractOf("orgUnit");
    const parentOrgId = result.fields.find((f) => f.key === "parentOrgId");
    // the conditions themselves are printed the same - the sentence is added to, not replaced
    expect(parentOrgId?.refFilter).toContain("status = active");
    // 🔴 It's not a well-articulated sentence that comes out: contracts don't work for the user.
    // "To which module, to which state, to which side, to which side, to which, angent decides what to say."
    expect(parentOrgId?.refFilterRemedy).toEqual([
      {
        module: "orgUnit",
        label: "Organizations",
        status: "active",
        via: [{ transition: "enable", action: "Re-enable", from: "disabled" }],
      },
    ]);
  });

  it("the one with no status condition doesn't grow a word.", async () => {
    const result = await contractOf("orgUnit");
    // there is no equivalent of refFilter at all: absent, not a non-full position
    expect(result.fields.find((f) => f.key === "address")?.refFilterRemedy).toBeUndefined();
  });

  it("we can't get to a state without a word \"to execute\" -- the main data activity is the beginning, not the edge.", async () => {
    const result = await contractOf("processAssignment");
    // `operationId` The condition is... `status = active`, the action of the operation is the beginning
    expect(result.fields.find((f) => f.key === "operationId")?.refFilter).toContain("status = active");
    expect(result.fields.find((f) => f.key === "operationId")?.refFilterRemedy).toBeUndefined();
  });
});
