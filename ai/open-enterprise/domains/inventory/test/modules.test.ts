import {
  creatableFields,
  editableFields,
  type Field,
  isSystemSupplied,
  type ModuleSchema,
  sealModule,
  supplyOf,
  unacceptableWriteKeys,
  validateModule,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import productDraft from "../modules/product.js";
import productFamilyDraft from "../modules/productFamily.ts";
import warehouseDraft from "../modules/warehouse.js";
import stockInDraft from "../modules/stockIn.js";
import stockOutDraft from "../modules/stockOut.js";
import inventoryDomain from "../domain.js";
import inventoryAuthorization from "../authorization.ts";
import { INVENTORY_UNIT_CHOICE_SET, INVENTORY_UNITS } from "../unitChoices.ts";

const product = sealModule(productDraft, { code: "product", domain: "inventory" });
const productFamily = sealModule(productFamilyDraft, { code: "productFamily", domain: "inventory" });
const warehouse = sealModule(warehouseDraft, { code: "warehouse", domain: "inventory" });
const stockIn = sealModule(stockInDraft, { code: "stockIn", domain: "inventory" });
const stockOut = sealModule(stockOutDraft, { code: "stockOut", domain: "inventory" });

/**
 * Whether the declaration still has a gate that compares units line by line
 * (the same check used in production, outsourcing, and sales).
 *
 * `NormalizedCheck.params` is `unknown` (each primitive has its own shape, and the kernel
 * does not widen the type), so the shape is judged here rather than by the type. What is
 * judged is existence: once unit candidates and conversion are constrained by unitChoice,
 * comparing units again at approval is both redundant and blocks a legal auxiliary unit.
 *
 * This inventory copy also recognizes one extra field name. Stock-in and stock-out compare
 * `product.mainUnit` (after the header/line split the base unit sits on the header). Production
 * and subcontract documents compare `unit` on the source line. Both names must be recognized.
 * Recognizing only one lets the other half slip through.
 */
const unitCompareIds = (module: ModuleSchema): readonly string[] =>
  module.preconditions
    .filter((rule) => {
      const check = rule.check;
      const field = (check?.params as { readonly field?: unknown } | undefined)?.field;
      return check?.primitive === "ref_field_compare" && (field === "unit" || field === "mainUnit");
    })
    .map((rule) => rule.id);

/**
 * Synonym fold for units of measure: different writings of the same unit collapse to one key.
 *
 * This table is the criterion for the "no duplicates" gate. `new Set(options)` cannot stand in
 * for it: dedupe only catches two identical strings, and the enum exists to kill writings that
 * differ but mean the same quantity (the original note on product.ts: "kg / KG / kilogram").
 * If both `kg` and `Kilogram` appear in the options, this gate goes red. That is the case it exists to stop.
 *
 * Case is covered by `toLowerCase()` (`KG` / `Kg` / `kg` are the same class), so the table only
 * lists cross-spelling aliases. When a new unit is an alias of one already here, add one row.
 *
 * Piece/unit and strip/rod are not folded. In a garment plant they are different counting habits
 * (a button versus a suit cannot share a unit; a zipper and a binding strip are also different
 * on a stock count). Folding them would fail a normal model. The bar is "two writings of the
 * same physical quantity", not "roughly the same idea".
 */
const UNIT_SYNONYM_CLASS: Readonly<Record<string, string>> = {
  kilogram: "kg",
  kilo: "kg",
  gram: "g",
  meter: "m",
  metre: "m",
  liter: "L",
  litre: "L",
  ton: "t",
  tonne: "t",
};

const unitClassOf = (unit: string): string => (UNIT_SYNONYM_CLASS[unit] ?? unit).toLowerCase();

describe("Warehouse master fields", () => {
  it("warehouse address is editable on the form and stays off the list", () => {
    expect(warehouse.numbering).toEqual({ prefix: "WH", seqScope: "tenant" });
    expect(warehouse.fields.map((field) => field.key)).toEqual([
      "code",
      "name",
      "company",
      "department",
      "contact",
      "contactPhone",
      "address",
    ]);
    expect(warehouse.fields.find((field) => field.key === "address")).toMatchObject({
      label: "Address",
      type: "text",
    });
    expect(warehouse.fields.find((field) => field.key === "address")?.hidden).toBeUndefined();
    expect(warehouse.fields.find((field) => field.key === "name")).toMatchObject({ required: true });
    expect(warehouse.fields.filter((field) => !["code", "name"].includes(field.key)).every((field) => field.required !== true)).toBe(true);
    expect(warehouse.views.list.columns).not.toContain("address");
    expect(warehouse.views.list.filters ?? []).not.toContain("address");
    expect(warehouse.views.form).toEqual([{
      title: "Basic information",
      fields: ["code", "name", "company", "department", "contact", "contactPhone", "address"],
    }]);
  });

  it("no longer declares the warehouse fields that were removed", () => {
    const keys = warehouse.fields.map((field) => field.key);
    expect(keys).not.toEqual(expect.arrayContaining(["manager", "allowNegativeStock", "remark"]));
  });

  it("warehouse posting has an observable reversing edge", () => {
    for (const schema of [stockIn, stockOut]) {
      for (const transition of schema.lifecycle.transitions) {
        for (const effect of transition.effects.filter((item) => item.target === "stock")) {
          expect(
            effect.reverseOn.length,
            `${schema.code}.${transition.code} stock ${effect.op} has no reversing edge`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("an ordinary warehouse clerk cannot change a warehouse-level negative-stock policy", () => {
    const grantOf = (role: string, module: string) => {
      const fragment = inventoryAuthorization.roles.find((item) => item.code === role);
      const grant = fragment?.grants.find((item) => "module" in item && item.module === module);
      return grant && "module" in grant ? grant : undefined;
    };
    const clerk = grantOf("warehouse-clerk", "warehouse");
    expect(clerk?.actions ?? []).not.toContain("update");
    expect(clerk?.actions ?? []).not.toContain("create");
    expect(clerk?.fields).toBe("all");
    const admin = grantOf("tenant-admin", "warehouse");
    expect(admin?.actions).toContain("update");
    expect(admin?.fields).toBe("all");
  });
});
describe("Simplified stock-in", () => {
  it("is created as pending review and uses the demo header fields", () => {
    expect(stockIn.label).toBe("Stock in");
    expect(stockIn.numbering).toEqual({ prefix: "SI", seqScope: "day" });
    expect(stockIn.fields.map((field) => field.key)).toEqual([
      "code",
      "type",
      "warehouseId",
      "applicant",
      "applyTime",
      "productionReceiptId",
      "productionTaskId",
      "lines",
      "remark",
    ]);
    // Stock-in type is bound to the choice set `inventory.stockInType`: `options` is always null
    // (the kernel gate that makes choiceSet and options exclusive). The old three values match
    // the dictionary codes character for character, so the switch needed no data migration.
    const inType = stockIn.fields.find((field) => field.key === "type");
    expect(inType?.choiceSet).toBe("inventory.stockInType");
    expect(inType?.options).toBeNull();
    expect(stockIn.fields.find((field) => field.key === "applicant")).toMatchObject({
      type: "string",
      person: { role: "receiver", via: "self" },
    });
    expect(stockIn.fields.find((field) => field.key === "applyTime")).toMatchObject({ required: false });
    expect(stockIn.fields.find((field) => field.key === "productionReceiptId")).toMatchObject({
      type: "ref",
      ref: "productionReceipt",
      hidden: true,
    });
    expect(stockIn.fields.find((field) => field.key === "productionTaskId")).toMatchObject({
      type: "ref",
      ref: "productionTask",
    });
    expect(stockIn.preconditions.find((rule) => rule.id === "production_task_required_for_receipt")).toMatchObject({
      onTransition: "approve",
      when: { primitive: "field_compare", params: { left: { ref: "$bill.type" }, op: "eq", right: { value: "productionReceipt" } } },
      check: { primitive: "required_fields", params: { fields: ["productionTaskId"] } },
    });
    expect(stockIn.preconditions.find((rule) => rule.id === "production_receipt_product_matches_task")).toMatchObject({
      onTransition: "approve",
      check: { primitive: "ref_field_compare", params: { via: { from: "bill", field: "productionTaskId" }, entity: "productionTask", field: "productId" } },
    });
    expect(stockIn.views.form.flatMap((group) => group.fields)).not.toEqual(expect.arrayContaining(["auditUser", "auditTime"]));
    expect(stockIn.lifecycle.statuses.map((status) => status.key)).toEqual(["pending", "approved", "voided"]);
    expect(stockIn.lifecycle.statuses.find((status) => status.key === "pending")).toMatchObject({
      initial: true,
      label: "pendingReview",
    });
    expect(stockIn.lifecycle.statuses.find((status) => status.key === "pending")?.editable).not.toBe("none");
  });

  it("lines store a product snapshot and approval requires a positive quantity", () => {
    const lines = stockIn.fields.find((field) => field.key === "lines")?.fields ?? [];
    expect(lines.map((field) => field.key)).toEqual([
      "productId",
      "productCode",
      "productName",
      "unit",
      "unitFactor",
      "quantity",
      "baseQty",
      "batchNo",
      "remark",
    ]);
    expect(lines.find((field) => field.key === "productCode")).toMatchObject({ snapshot: { from: "product", match: "productId", field: "code" } });
    expect(lines.find((field) => field.key === "productName")).toMatchObject({ snapshot: { from: "product", match: "productId", field: "name" } });
    expect(lines.find((field) => field.key === "unit")).toMatchObject({ type: "enum", unitChoice: { match: "productId", factorInto: "unitFactor" } });
    expect(lines.find((field) => field.key === "baseQty")).toMatchObject({ calculate: { op: "mul", args: [{ field: "quantity" }, { field: "unitFactor" }] } });
    expect(lines.find((field) => field.key === "productType")).toBeUndefined();
    expect(lines.find((field) => field.key === "spec")).toBeUndefined();
    expect(stockIn.preconditions.find((rule) => rule.id === "lines_required")).toMatchObject({
      onTransition: "approve",
      check: { primitive: "lines_not_empty" },
    });
    expect(stockIn.preconditions.find((rule) => rule.id === "quantity_positive")).toMatchObject({
      onTransition: "approve",
      check: { primitive: "lines_all" },
    });
  });

  it("approving a stock-in posts stock", () => {
    const transitions = stockIn.lifecycle.transitions;
    expect(transitions.map((transition) => transition.code)).toEqual(["approve", "void"]);
    expect(transitions.find((transition) => transition.code === "submit")).toBeUndefined();
    expect(transitions.find((transition) => transition.code === "reject")).toBeUndefined();
    expect(stockIn.lifecycle.transitions.find((transition) => transition.code === "approve")).toMatchObject({
      from: "pending",
      to: "approved",
      effects: [expect.objectContaining({ target: "stock", op: "in" })],
    });
    expect(stockIn.preconditions.filter((rule) => rule.onTransition === "void").map((rule) => rule.id)).toEqual(["void_stock_available"]);
    expect(transitions.find((transition) => transition.code === "void")).toMatchObject({ from: "approved", to: "voided" });
    expect("planners" in stockIn).toBe(false);
    expect(stockIn.fields.some((field) => field.key === "requestId")).toBe(false);
    expect(stockIn.fields.some((field) => field.key === "demandSourceType")).toBe(false);
    expect(stockIn.fields.some((field) => field.key === "supplierId")).toBe(false);
    expect(stockIn.fields.some((field) => field.key === "customerId")).toBe(false);
  });
});

describe("Simplified stock-out", () => {
  it("is created as pending review and uses the demo header fields", () => {
    expect(stockOut.label).toBe("Stock out");
    expect(stockOut.numbering).toEqual({ prefix: "SO", seqScope: "day" });
    expect(stockOut.fields.map((field) => field.key)).toEqual([
      "code",
      "type",
      "warehouseId",
      "applicant",
      "applyTime",
      "lines",
      "remark",
    ]);
    // Stock-out type is bound to the choice set `inventory.stockOutType`: `options` is always null
    // (the kernel gate that makes choiceSet and options exclusive). Candidates live in the
    // tenant-configurable dictionary. The switch included migration 0025, which rewrote stored `SO_*` values to dictionary codes.
    const outType = stockOut.fields.find((field) => field.key === "type");
    expect(outType?.choiceSet).toBe("inventory.stockOutType");
    expect(outType?.options).toBeNull();
    expect(stockOut.lifecycle.statuses.map((status) => status.key)).toEqual(["pending", "approved", "voided"]);
    expect(stockOut.lifecycle.statuses.find((status) => status.key === "pending")).toMatchObject({
      initial: true,
      label: "pendingReview",
    });
    expect(stockOut.lifecycle.statuses.find((status) => status.key === "pending")?.editable).not.toBe("none");
  });

  it("lines store a product snapshot and approval requires a positive quantity", () => {
    const lines = stockOut.fields.find((field) => field.key === "lines")?.fields ?? [];
    expect(lines.map((field) => field.key)).toEqual([
      "productId",
      "productCode",
      "productName",
      "unit",
      "unitFactor",
      "quantity",
      "baseQty",
      "baseUnitPrice",
      "batchNo",
      "remark",
    ]);
    expect(lines.find((field) => field.key === "productCode")).toMatchObject({ snapshot: { from: "product", match: "productId", field: "code" } });
    expect(lines.find((field) => field.key === "productName")).toMatchObject({ snapshot: { from: "product", match: "productId", field: "name" } });
    expect(lines.find((field) => field.key === "unit")).toMatchObject({ type: "enum", unitChoice: { match: "productId", factorInto: "unitFactor" } });
    expect(lines.find((field) => field.key === "baseQty")).toMatchObject({ calculate: { op: "mul", args: [{ field: "quantity" }, { field: "unitFactor" }] } });
    expect(stockOut.preconditions.find((rule) => rule.id === "lines_required")).toMatchObject({ onTransition: "approve", check: { primitive: "lines_not_empty" } });
    expect(stockOut.preconditions.find((rule) => rule.id === "quantity_positive")).toMatchObject({ onTransition: "approve", check: { primitive: "lines_all" } });
  });

  it("approving a stock-out posts stock", () => {
    const transitions = stockOut.lifecycle.transitions;
    expect(transitions.map((transition) => transition.code)).toEqual(["approve", "void"]);
    expect(transitions.find((transition) => transition.code === "submit")).toBeUndefined();
    expect(transitions.find((transition) => transition.code === "reject")).toBeUndefined();
    expect(transitions.find((transition) => transition.code === "approve")).toMatchObject({
      from: "pending",
      to: "approved",
      effects: [expect.objectContaining({ target: "stock", op: "out" })],
    });
    expect(transitions.find((transition) => transition.code === "void")).toMatchObject({ from: "approved", to: "voided" });
  });
});

describe("Inventory unit-of-measure contract", () => {
  it.each([product, stockIn, stockOut].map((module) => [module.code, module] as const))(
    "%s passes the single-module semantic gate",
    (_code, module) => {
      expect(validateModule(module).errors).toEqual([]);
    },
  );

  it("a new SKU can set the base unit; after it is active, spec, barcode, image, and remarks stay editable", () => {
    const creatable = creatableFields(product);
    const editable = editableFields(product, "active");

    expect(creatable).toContain("mainUnit");
    expect(creatable).not.toContain("code");
    expect(editable).toEqual(expect.arrayContaining(["name", "spec", "barcode", "imageUrl", "remark"]));
    expect(editable).not.toContain("code");
    expect(editable).not.toContain("mainUnit");
    expect(editable).not.toContain("auxUnit");
    expect(editable).not.toContain("conversionRate");
  });

  // Unit rule: from a single snapshot to "primary/auxiliary candidates + a frozen base quantity".
  //
  // This used to pin "missing or changed unit cannot be approved", implemented on `approve` as
  // `stock_in_unit_matches_product` / `stock_out_unit_matches_product`
  // (`ref_field_compare`, comparing `product.mainUnit` on every line). Both were removed.
  // `lines.unit` may now be the product's primary or auxiliary unit. Save freezes unitFactor and
  // baseQty together, and later stock and source remaining quantity consume only baseQty.
  // "10 boxes" is no longer treated as "10 pieces".
  it.each([
    ["Simplified stock-in", stockIn],
    ["Simplified stock-out", stockOut],
  ] as const)("%s lets the unit be the product primary or auxiliary unit, and freezes the factor and the primary-unit quantity", (_label, module) => {
    const columns = module.fields.find((field) => field.key === "lines")?.fields ?? [];
    const unit = columns.find((field) => field.key === "unit");
    const unitFactor = columns.find((field) => field.key === "unitFactor");
    const baseQty = columns.find((field) => field.key === "baseQty");
    const productId = columns.find((field) => field.key === "productId");

    expect(unit).toMatchObject({
      type: "enum",
      required: true,
      unitChoice: { match: "productId", factorInto: "unitFactor" },
    });
    expect(isSystemSupplied(unit as Field, columns)).toBe(false);
    expect(isSystemSupplied(unitFactor as Field, columns)).toBe(true);
    expect(supplyOf(unitFactor as Field, columns)).toBe("unitFactor");
    expect(isSystemSupplied(baseQty as Field, columns)).toBe(true);
    expect(supplyOf(baseQty as Field, columns)).toBe("calculate");
    expect(productId).toMatchObject({ type: "ref", ref: "product" });
    // An auxiliary unit is a legal choice. The old "must equal the primary unit" gate must not grow back.
    expect(unitCompareIds(module)).toEqual([]);
  });

});

describe("Standalone SKU master", () => {
  it("primary and auxiliary units use the inventory system dictionary", () => {
    const unitSet = inventoryDomain.choiceSets.find((set) => set.code === INVENTORY_UNIT_CHOICE_SET);
    expect(unitSet).toBeDefined();
    expect(unitSet?.label).toBe("Unit of measure");
    expect(unitSet?.items).toEqual([...INVENTORY_UNITS].map((item) => ({ ...item, retired: false })));
  });

  it("the product master number prefix is HPDA, and the list sorts by created time descending", () => {
    expect(productFamily.numbering).toEqual({ prefix: "HPDA", seqScope: "day" });
    expect(productFamily.views.list.defaultSort).toEqual({ field: "createdAt", desc: true });
  });

  it("the product master only classifies; the product header itself is the stock SKU", () => {
    expect(product.fields.find((field) => field.key === "productFamilyId")).toMatchObject({
      type: "ref",
      ref: "productFamily",
      required: true,
    });
    expect(product.fields.some((field) => field.type === "subtable")).toBe(false);
  });

  it("the SKU form shows only spec, barcode, unit, and remarks", () => {
    expect(product.views.form.flatMap((group) => group.fields)).toEqual([
      "spec",
      "barcode",
      "mainUnit",
      "remark",
    ]);
  });

  it("product type supplies purchase, sales, and production defaults, and the three flags stay editable business facts", () => {
    const defaults = Object.fromEntries(
      ["canPurchase", "canSell", "canProduce"].map((key) => [key, product.fields.find((field) => field.key === key)?.createDefaultBy]),
    );
    expect(defaults).toEqual({
      canPurchase: { field: "productType", values: { finished: false, semiFinished: false, rawMaterial: true, packaging: true } },
      canSell: { field: "productType", values: { finished: true, semiFinished: true, rawMaterial: false, packaging: false } },
      canProduce: { field: "productType", values: { finished: true, semiFinished: true, rawMaterial: false, packaging: false } },
    });
  });

  it("the master carries the stock unit of measure — mainUnit / defaultWarehouseId sit on the header", () => {
    const keys = product.fields.map((field) => field.key);
    expect(keys).toContain("mainUnit");
    expect(keys).toContain("defaultWarehouseId");
    expect(product.unitSet).toEqual({ main: "mainUnit", auxiliary: "auxUnit", conversionRate: "conversionRate" });
    // The simplified stock-out stores the unit the user entered. It no longer depends on a warehouse-demand conversion chain.
    const stockOutUnit = stockOut.fields.find((field) => field.key === "lines")?.fields?.find((field) => field.key === "unit");
    expect(stockOutUnit).toMatchObject({ type: "enum", required: true, unitChoice: { match: "productId", factorInto: "unitFactor" } });
    // The source is required: that is what keeps the freeze chain non-null. Without it, every place
    // that freezes a unit from product silently freezes an empty value.
    // The type is `enum`, not `string`. A unit is a closed candidate (a dropdown). Free text grows
    // three writings ("kg / KG / kilogram"), and the ledger sums bare qty with no conversion axis,
    // so those three writings land in the same balance.
    expect(product.fields.find((field) => field.key === "mainUnit")).toMatchObject({
      type: "enum",
      required: true,
    });
    // Auxiliary unit and conversion rate are not required. `unitSetIssuesOf` makes them both filled
    // or both empty. Leaving them empty when there is no second unit is legal. Marking them required
    // fights that contract (pair filled or pair empty, and auxiliary ≠ primary), so a single-unit
    // product cannot be created: matching the primary unit is a duplicate, leaving it empty fails
    // required, and both ends are blocked. Most products have one unit, so the first brick of the
    // main flow cannot be laid. The only criterion is `unitSet`.
    expect(product.fields.find((field) => field.key === "auxUnit")).toMatchObject({
      type: "enum",
      required: false,
    });
    expect(product.fields.find((field) => field.key === "conversionRate")?.required ?? false).toBe(false);
  });

  // Unit-of-measure enum rules.
  //
  // Deliberately not pinned to a fixed list of strings. That assertion welds "which units are in
  // use" into the test. Adding a unit forces a test edit, and the person editing only pastes the
  // new value from the failure, so the gate becomes an echo. What is pinned is the three reasons
  // this enum exists.
  it("primary and auxiliary units share one set, are non-empty, and have no synonym duplicates", () => {
    const mainUnit = product.fields.find((field) => field.key === "mainUnit");
    const auxUnit = product.fields.find((field) => field.key === "auxUnit");
    const options = inventoryDomain.choiceSets
      .find((set) => set.code === INVENTORY_UNIT_CHOICE_SET)
      ?.items
      .filter((item) => !item.retired)
      .map((item) => item.label) ?? [];

    // 1. Non-empty: an empty dropdown is indistinguishable from "this feature is broken", and a required field cannot be filled.
    expect(options.length).toBeGreaterThan(0);
    // 2. Same set: conversionRate means "1 auxiliary unit = N primary units".
    //    If the two sides are not the same set of dimensions, that sentence refers to nothing.
    expect(mainUnit?.choiceSet).toBe(INVENTORY_UNIT_CHOICE_SET);
    expect(auxUnit?.choiceSet).toBe(INVENTORY_UNIT_CHOICE_SET);
    expect(mainUnit?.options).toBeNull();
    expect(auxUnit?.options).toBeNull();
    // 3. No synonym duplicates — see `unitClassOf` above.
    const classes = options.map(unitClassOf);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("shop-floor units use a readable label and include bundle and barrel, so stored codes are not shown as values outside the candidate set", () => {
    const options = inventoryDomain.choiceSets
      .find((set) => set.code === INVENTORY_UNIT_CHOICE_SET)
      ?.items
      .filter((item) => !item.retired)
      .map((item) => item.label) ?? [];
    expect(options).toEqual(expect.arrayContaining(["Meter", "Bundle", "Barrel"]));
    expect(options).not.toContain("m");
  });

  it("production-material flags are owned by the product master and do not appear on the standalone SKU edit form", () => {
    const active = product.lifecycle.statuses.find((s) => s.key === "active");
    expect(active).toBeDefined();
    if (active?.editable !== "whitelist") {
      throw new Error("active is not a whitelist; the test assumption is stale");
    }
    expect(active.editableFields).not.toEqual(expect.arrayContaining(["canPurchase", "canSell", "canProduce"]));
  });

  it("unknown keys are still rejected", () => {
    expect(unacceptableWriteKeys(product.fields, { productType: "finished", fooBar: 1 }, "header")).toEqual(["fooBar"]);
  });

  it("two lifecycle states: active ↔ disabled, both ways, and neither is terminal", () => {
    expect(product.lifecycle.statuses.map((status) => status.key)).toEqual(["active", "disabled"]);
    expect(product.lifecycle.transitions.map((transition) => transition.code)).toEqual(["disable", "enable"]);
    expect(product.preconditions).toEqual([
      expect.objectContaining({
        id: "enable_family_active",
        onTransition: "enable",
        level: "block",
      }),
    ]);
    // "Delete" is not an edge on this state machine. It is a framework fact (`billRepo.assertRemovable`)
    // and it holds automatically for every module that refs product. Declaring a `deleted` terminal
    // status would be a second copy of the same rule, and that copy only watches the modules someone
    // remembered on the day they wrote it.
    expect(product.lifecycle.statuses.some((status) => status.terminal)).toBe(false);
  });
});
