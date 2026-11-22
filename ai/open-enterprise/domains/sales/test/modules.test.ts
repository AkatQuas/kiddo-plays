import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, requireModule } from "@open-erp/loader";
import {
  availableTransitions,
  editableFields,
  evaluateTransition,
  isSystemSupplied,
  validateModule,
  type Field,
  type ModuleSchema,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

/**
 * Whether any gate still compares `unit` line by line.
 *
 * `NormalizedCheck.params` is `unknown` (each primitive has its own shape, and the kernel does not flatten that into the type),
 * so the shape is judged here rather than by the type. What is judged is presence: unitChoice already limits the candidates and freezes
 * the standard quantity. Requiring equality with one source unit at approval would wrongly reject a legal alternate unit.
 */
const unitCompareIds = (module: ModuleSchema): readonly string[] =>
  module.preconditions
    .filter((rule) => {
      const check = rule.check;
      return (
        check?.primitive === "ref_field_compare" && (check.params as { readonly field?: unknown }).field === "unit"
      );
    })
    .map((rule) => rule.id);


// Loaded through the loader, not a relative import: moving a module does not break the test,
// and this path is the same one the server and CLI use, so the test sees the real load result.
const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});

const customer = requireModule(catalog, "customer").schema;
const salesOrder = requireModule(catalog, "salesOrder").schema;
const salesDelivery = requireModule(catalog, "salesDelivery").schema;

const MODULES = [customer, salesOrder, salesDelivery];
const product = requireModule(catalog, "product").schema;
/** The sample shape applies to every module in the repo, not only the three in sales. */
const ALL_MODULES = [...catalog.modules.values()].map((m) => m.schema);

const NOW = new Date("2026-07-29T00:00:00Z");
// `balance` is how the available-quantity primitive (available_sufficient) reads: stock asks how much a warehouse still has,
// payables ask how much is still owed to a supplier. A stub of 0 means nobody has posted against this document yet
const NO_DATA = { get: async () => null, list: async () => [], balance: async () => 0 };

/** The warehouse has enough. When another rule is under test, do not let the stock gate take the verdict. */
const AMPLE_STOCK = async (): Promise<number> => 1000;

describe("sample modules pass every semantic gate", () => {
  it.each(MODULES.map((m) => [m.code, m] as const))("%s", (_code, module) => {
    expect(validateModule(module).errors).toEqual([]);
  });
});

describe("coverage of the six concepts the template must demonstrate", () => {
  it("the sales-order date defaults to today in the business time zone and can still be overridden", () => {
    expect(salesOrder.fields.find((field) => field.key === "orderDate")?.createDefault).toBe("today");
  });

  it("the sales-issue date defaults to today in the business time zone and can still be set to the real issue date before confirm", () => {
    expect(salesDelivery.fields.find((field) => field.key === "deliveryDate")?.createDefault).toBe("today");
  });

  it("a sales issue must pick a customer first, and at create it excludes completed or cancelled sales orders", () => {
    const lines = salesDelivery.fields.find((field) => field.key === "lines")?.fields ?? [];
    const orderId = lines.find((field) => field.key === "orderId");

    expect(orderId).toMatchObject({ type: "ref", ref: "salesOrder", required: true });
    expect(orderId?.refFilter).toEqual({
      customerId: { from: "$bill.customerId" },
      status: "inProgress",
    });

    expect(lines.find((field) => field.key === "productId")?.snapshot).toEqual({
      from: "salesOrder",
      match: "orderLineId",
      through: "lines",
      field: "productId",
    });

    // Add lines = filter orders by customer, then expand and pick order lines (not product SKUs)
    expect(salesDelivery.views.createFrom).toEqual([{
      path: "lines.orderLineId",
      label: "Add lines",
      sourceStatuses: ["inProgress"],
      sourceRemaining: { header: null, line: "lines.openBaseQty" },
    }]);
  });

  it("master data has a lifecycle too, and does not use an enabled boolean", () => {
    expect(customer.lifecycle.statuses.map((s) => s.key)).toEqual(["active", "disabled"]);
    expect(customer.fields.some((f) => f.key === "enabled")).toBe(false);
  });

  it("a platform field can be referenced by a view without being declared", () => {
    expect(customer.fields.some((f) => f.key === "status")).toBe(false);
    expect(customer.views.list.filters).toContain("status");
  });

  it("a sales order posts nothing, so an irreversible edge must set confirm itself", () => {
    // An order is a promise, not a fact. The whole module has zero effects. The first posting is on the issue document.
    // Pin that first, because the rest of this discipline stands on it
    for (const t of salesOrder.lifecycle.transitions) expect(t.effects).toEqual([]);
    expect(salesOrder.lifecycle.transitions.every((t) => !t.postsToLedger)).toBe(true);

    // The consequence, and what this test actually guards: `postsToLedger` is always false, so
    // the confirm dialog is not earned by posting (ActionBar is `confirm || postsToLedger`).
    // "Ask before an irreversible action" has only the confirm leg in this module.
    // Omitting it does not error. One mis-click pushes the document into a terminal state.
    //
    // The criterion is coverage, not a hand-copied list. A new user-facing edge into a terminal state that forgets confirm fails here.
    // An internal edge is not a button. The planner runs it in the same transaction, and a dialog has nowhere to land.
    const terminals = new Set(salesOrder.lifecycle.statuses.filter((s) => s.terminal).map((s) => s.key));
    const toTerminal = salesOrder.lifecycle.transitions.filter((t) => terminals.has(t.to) && !t.internal);
    expect(toTerminal.length).toBeGreaterThan(1);
    for (const t of toTerminal) expect([t.code, t.confirm]).toEqual([t.code, true]);
    expect(salesOrder.lifecycle.transitions.some((t) => t.code === "releaseToComplete")).toBe(false);

    // The return edge asks too: it sends an effective document, with downstream already moving, back to approval
    const unapprove = salesOrder.lifecycle.transitions.find((t) => t.code === "unapprove");
    expect(unapprove?.confirm).toBe(true);

    // The other way is pinned too: a forward edge should not set confirm. A dialog on every step is the same as no dialog.
    // People learn to confirm without reading, which is the moment the rules above exist to catch
    for (const code of ["approve", "ship", "to_production"]) {
      expect([code, salesOrder.lifecycle.transitions.find((t) => t.code === code)?.confirm]).toEqual([code, false]);
    }
  });

  it("a sales order reserves only pending review and shipped, and no longer includes warehouse shipping", () => {
    const occupying = salesOrder.fields
      .find((field) => field.key === "lines")
      ?.fields?.find((field) => field.key === "occupyingBaseQty");
    expect(occupying?.derive).toMatchObject({
      kind: "rollup",
      from: "salesDelivery",
      measure: "baseQty",
      where: { status: ["pendingReview", "shipped"] },
    });
  });

  it("a sales issue posts on confirm, and is no longer handed to the warehouse", () => {
    const confirm = salesDelivery.lifecycle.transitions.find((t) => t.code === "confirm");
    expect(confirm).toMatchObject({
      from: "pendingReview",
      to: "shipped",
      primary: true,
      push: null,
    });
    expect(confirm?.effects.map((e) => `${e.target}.${e.op}`)).toEqual(["stock.out"]);
    expect(salesDelivery.lifecycle.transitions.find((t) => t.code === "releaseDemand")).toBeUndefined();
    expect(salesDelivery.lifecycle.statuses.map((s) => s.key)).toEqual(["pendingReview", "shipped", "cancelled"]);
  });











});

describe("sample module field defaults", () => {



  it("the sales chain uses block and warn; the negative-stock branch has moved down into warehouse work", () => {
    const levels = new Set(MODULES.flatMap((m) => m.preconditions.map((p) => p.level)));
    expect(levels).toContain("block");
    expect(levels).toContain("warn");
    expect(levels).not.toContain("route");
  });

  it("a route level always has an exit", () => {
    const routes = MODULES.flatMap((m) => m.preconditions).filter((p) => p.level === "route");
    expect(routes.every((p) => p.exit !== null)).toBe(true);
  });

  it("all three handoff kinds are used", () => {
    const kinds = new Set(MODULES.flatMap((m) => m.handoff.map((h) => h.kind)));
    expect(kinds).toEqual(new Set(["todo", "notify", "remind"]));
  });

  it("invariants stay on and cannot be turned off", () => {
    const invariants = MODULES.flatMap((m) => m.preconditions).filter((p) => p.source === "invariant");
    expect(invariants.length).toBeGreaterThan(0);
    expect(invariants.every((p) => p.enabled)).toBe(true);
  });

  it("every rule has a why, for people and for AI", () => {
    const all = MODULES.flatMap((m) => [...m.preconditions.map((p) => p.why), ...m.handoff.map((h) => h.why)]);
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((w) => w.length > 10)).toBe(true);
  });

  it("a self-loop push edge must carry its own duplicate guard, because the optimistic lock always holds on that edge", () => {
    // The criterion is coverage, not "does ship_more have that gate". The next self-loop push
    // (the receiving edge on a purchase order in receiving has the same shape) does not inherit a guard, and a missing one has no symptom.
    // A double-click in the UI is two downstream drafts, and the second one says nothing.
    //
    // The guard can live only on the declaration. The optimistic lock in `setStatus` is `where status = from`.
    // When from === to the second call still matches (billRepo.ts says so, and says the guard is an idempotency key).
    // A normal erp-web edge `runTransition` does not send an idempotency key (only a planner edge `runPlannedTransition` does).
    // A self-loop push is a normal edge, so the guard can live only on the declaration.
    for (const m of MODULES) {
      const selfLoopPushes = m.lifecycle.transitions.filter((t) => t.push && t.from === t.to);
      for (const edge of selfLoopPushes) {
        const guards = m.preconditions.filter((p) => p.onTransition === edge.code);
        expect(
          guards.length,
          `${m.code}.${edge.code} is a self-loop push with no precondition: a double-click would create two ${edge.push} drafts`,
        ).toBeGreaterThan(0);
      }
    }
  });

  // Unit basis: primary and alternate candidates, freeze the standard quantity, and settle across documents on that quantity.
  //
  // The sales chain used to have two `ref_field_compare` rules: `salesOrder.order_unit_matches_product`
  // (on submit, against the product record) and `salesDelivery.delivery_unit_matches_source_line`
  // (on confirm, against the order line). Both were removed. An alternate unit is a legal choice, and the comparison treated it as a wrong entry.
  //
  // Deleting those two turned no test red (nothing in this domain pinned them), so this one was added.
  // Deleting a gate while no assertion takes over is the hole this change most easily leaves.
  // unitChoice now freezes unitFactor and baseQty. The ledger and over-issue consume only baseQty.
  it("sales-chain units are optional: the order takes the product candidates, and the issue inherits the upstream start value but can still switch", () => {
    const orderUnit = salesOrder.fields.find((f) => f.key === "lines")?.fields?.find((f) => f.key === "unit");
    const deliveryUnit = salesDelivery.fields.find((f) => f.key === "lines")?.fields?.find((f) => f.key === "unit");

    expect(orderUnit?.unitChoice).toEqual({ match: "productId", factorInto: "unitFactor" });
    expect(deliveryUnit?.unitChoice).toEqual({ match: "productId", factorInto: "unitFactor" });
    expect(orderUnit?.required).toBe(true);
    expect(deliveryUnit?.required).toBe(true);
    expect(deliveryUnit?.refDefault).toEqual({
      from: "salesOrder",
      match: "orderLineId",
      through: "lines",
      field: "unit",
    });

    for (const [module, unit] of [
      [salesOrder, orderUnit],
      [salesDelivery, deliveryUnit],
    ] as const) {
      const columns = module.fields.find((f) => f.key === "lines")?.fields ?? [];
      expect(isSystemSupplied(unit as Field, columns)).toBe(false);
      expect(isSystemSupplied(columns.find((f) => f.key === "unitFactor") as Field, columns)).toBe(true);
      expect(isSystemSupplied(columns.find((f) => f.key === "baseQty") as Field, columns)).toBe(true);
      const match = columns.find((f) => f.key === unit?.unitChoice?.match);
      expect(match?.required === true || isSystemSupplied(match as Field, columns)).toBe(true);
      expect(unitCompareIds(module)).toEqual([]);
    }

    // The product's units are still a closed enum. A consuming document may choose only that product's primary or alternate unit.
    expect(product.fields.find((f) => f.key === "mainUnit")).toMatchObject({ type: "enum", required: true });

    // This assertion changed direction once. The two halves pin different things.
    //
    // It used to pin the structural block "`product.spec` is not required, so spec cannot be frozen", and it said
    // that when spec became a snapshot someone would come back and change this assertion. That day arrived.
    // Inventory made `product.spec` `required: true` (the criterion is on that line in product.ts:
    // a SKU with an empty spec looks identical to its siblings in every dropdown and every document line,
    // which is why that layer exists). The block is gone.
    //
    // So the first half now pins the new premise: the source is required. Without it, every spec freeze below silently loses
    // its non-empty guarantee, and `checkCrossReferences` reports only where a snapshot is actually declared.
    const productSpec = product.fields.find((f) => f.key === "spec");
    expect(productSpec).toMatchObject({ type: "string", required: true });

    const orderSpec = salesOrder.fields.find((f) => f.key === "lines")?.fields?.find((f) => f.key === "spec");
    const deliverySpec = salesDelivery.fields.find((f) => f.key === "lines")?.fields?.find((f) => f.key === "spec");
    expect(orderSpec?.refDefault).toEqual({ from: "product", match: "productId", through: null, field: "spec" });
    // The issue hop is not broken, and not one word of it may change: it freezes from the order line, not from the product structure.
    // Freezing from the product record would let a later master-data spec change make the issue disagree with the order,
    // while each document still "matches the product record". That is the lookup path that was rejected, again.
    expect(deliverySpec?.snapshot).toEqual({
      from: "salesOrder",
      match: "orderLineId",
      through: "lines",
      field: "spec",
    });
    // Issue spec is a strict snapshot. Order spec is an overridable default from the choice. They are not the same write semantics.
    const deliveryColumns = salesDelivery.fields.find((f) => f.key === "lines")?.fields ?? [];
    expect(isSystemSupplied(deliverySpec as Field, deliveryColumns)).toBe(true);
    expect(deliveryColumns.find((f) => f.key === deliverySpec?.snapshot?.match)?.required).toBe(true);
    const orderColumns = salesOrder.fields.find((f) => f.key === "lines")?.fields ?? [];
    expect(isSystemSupplied(orderSpec as Field, orderColumns)).toBe(false);
  });

  it("when the issue unit changes, price is recomputed from the primary-unit net price and does not copy the upstream business price", () => {
    const orderColumns = salesOrder.fields.find((field) => field.key === "lines")?.fields ?? [];
    const deliveryColumns = salesDelivery.fields.find((field) => field.key === "lines")?.fields ?? [];

    expect(orderColumns.find((field) => field.key === "baseNetPrice")?.calculate).toEqual({
      op: "div",
      args: [{ field: "netPrice" }, { field: "unitFactor" }],
    });
    expect(deliveryColumns.find((field) => field.key === "baseUnitPrice")?.snapshot).toEqual({
      from: "salesOrder",
      match: "orderLineId",
      through: "lines",
      field: "baseNetPrice",
    });
    expect(deliveryColumns.find((field) => field.key === "price")?.calculate).toEqual({
      op: "mul",
      args: [{ field: "baseUnitPrice" }, { field: "unitFactor" }],
    });

    const priceGuard = salesDelivery.preconditions.find((rule) => rule.id === "delivery_price_matches_source_line");
    expect(priceGuard?.check).toMatchObject({
      primitive: "ref_field_compare",
      params: { field: "baseNetPrice", right: { ref: "$line.baseUnitPrice" } },
    });
  });
});

// The sample is training material for AI, and it is more persuasive than the docs, so these two shapes of the sample itself are pinned
describe("the sample must not teach the wrong shape: confirm and master data", () => {
  it("an edge that posts does not set confirm; confirm only means ask even though nothing posts", () => {
    // Writing it does not change behavior (ActionBar is confirm || postsToLedger), but a person copying it
    // learns "a posting edge sets confirm". Then `grep confirm` as "which edges need a person to confirm"
    // is a list that both misses (an approve with effects and no confirm) and includes too much.
    // Pin which edges really post first. The other side (zero effects of its own, listed in someone else's reverseOn)
    // is derived. It must be visible before confirm is removed, or a confirm that should stay gets removed.
    // The whole sales-order module has zero effects, so this list is empty. Its confirm stands alone
    expect(salesOrder.lifecycle.transitions.filter((t) => t.postsToLedger)).toEqual([]);
    const delivering = salesDelivery.lifecycle.transitions.filter((t) => t.postsToLedger);
    expect(delivering.map((t) => t.code)).toEqual(["confirm"]);

    // The gate judges every module. Narrowing it to one module means the next person who adds a module steps on it anyway
    const offenders = ALL_MODULES.flatMap((m) =>
      m.lifecycle.transitions.filter((t) => t.postsToLedger && t.confirm && t.effects?.length).map((t) => `${m.code}.${t.code}`),
    );
    expect(offenders).toEqual([]);
  });

  it("confirm stays on edges that do not post but still need a question, and the sample still shows it", () => {
    const asked = ALL_MODULES.flatMap((m) =>
      m.lifecycle.transitions.filter((t) => t.confirm).map((t) => `${m.code}.${t.code}`),
    );
    expect(asked).toContain("customer.disable");
    expect(asked).toContain("product.disable");
  });

  it("the two master-data samples have one answer for the same shape: two states that switch both ways, and neither is terminal", () => {
    // A terminal state has no outgoing edge. One mis-clicked Disable leaves no button that can bring it back. Only a database edit can
    for (const master of [customer, product]) {
      expect(master.lifecycle.statuses.map((s) => s.key)).toEqual(["active", "disabled"]);
      expect(master.lifecycle.statuses.some((s) => s.terminal)).toBe(false);
      expect(availableTransitions(master, "disabled").map((t) => t.code)).toEqual(["enable"]);
    }
  });
});

describe("engine: buttons and editable fields are derived, not declared", () => {
  it("create starts at pending review, approval is available, there is no submit or withdraw, and pending review has no cancel edge", () => {
    expect(salesOrder.lifecycle.statuses.find((s) => s.initial)).toMatchObject({
      key: "pendingReview",
      label: "pendingReview",
      editable: "full",
    });
    expect(salesOrder.lifecycle.statuses.some((s) => s.key === "draft")).toBe(false);
    expect(salesOrder.lifecycle.transitions.some((t) => t.code === "submit" || t.code === "withdraw")).toBe(false);
    expect(salesOrder.lifecycle.transitions.some((t) => t.code === "cancel" && t.from === "pendingReview")).toBe(false);
    expect(availableTransitions(salesOrder, "pendingReview").map((t) => t.code)).toEqual(["approve"]);
  });

  it("the edges available in progress are computed from the graph", () => {
    expect(availableTransitions(salesOrder, "inProgress").map((t) => t.code)).toEqual([
      "unapprove",
      "ship",
      "complete",
      "cancelRunning",
      "to_production",
    ]);
  });

  it("release to production is an in-progress self-loop, and what is left uses the same action again", () => {
    expect(salesOrder.lifecycle.transitions.filter((t) => t.push === "productionOrder")).toEqual([
      expect.objectContaining({ code: "to_production", from: "inProgress", to: "inProgress", action: "Release to production" }),
    ]);
    expect(editableFields(salesOrder, "inProgress")).toEqual(["promiseDate", "warehouseId", "contract", "remark"]);
  });

  it("a whitelist status releases only the fields on the whitelist", () => {
    // `contract` was added later, and that was a decision: a contract scan is evidence of the commercial terms, not the terms.
    // The signed scan almost always arrives after approval. The old assertion no longer holds
    // because the whitelist really changed, not because this gate loosened. It still judges "exactly these, and not one more".
    // Order is field-declaration order, not the order written in the whitelist (`contract` is declared before `remark`).
    // That is what this title means by derived: the whitelist decides which fields are released, not how they are ordered.
    // `warehouseId` was added later, and that was also a decision: the warehouse is a logistics decision, not a commercial term,
    // and its own cell says the warehouse is often unknown at order time and waits on warehouse scheduling, which is after approval.
    // While it was locked, an order with no warehouse reached a dead end after approval: Ship produced a 400 on the downstream draft
    // (the issue warehouse is required), and the cell on the order page had no required marker and could not be edited.
    expect(editableFields(salesOrder, "inProgress")).toEqual(["promiseDate", "warehouseId", "contract", "remark"]);
    // None of the commercial terms are released. That is what "once effective, the document cannot move" actually means
    for (const locked of ["customerId", "orderDate", "lines"]) {
      expect(editableFields(salesOrder, "inProgress")).not.toContain(locked);
    }
  });

  it("pending review can edit every non-derived field, and derived fields are excluded", () => {
    const fields = editableFields(salesOrder, "pendingReview");
    expect(fields).toContain("customerId");
    expect(fields).not.toContain("shippedQty"); // rollup
    expect(fields).not.toContain("customerName"); // lookup
  });

  it("a terminal state is not editable", () => {
    expect(editableFields(salesOrder, "completed")).toEqual([]);
  });
});

describe("engine: evaluation returns a plan and does not execute it", () => {
  it("cancelling in progress produces no reversal candidates; a sales order never posted, so there is nothing to undo", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-2", status: "inProgress", totalAmount: 30000, customerId: "c1" },
        lines: [],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: NO_DATA,
      },
      "cancelRunning",
    );
    // An empty `reversals` is a conclusion, not "not implemented yet". The order has zero effects.
    // Reversal candidates come from effects declared on other edges. No effect means no candidate.
    // A candidate here would mean someone posted on the order without deciding who undoes it
    expect(decision.plan.forward).toEqual([]);
    expect(decision.plan.reversals).toEqual([]);
  });

  it("a disabled customer is a hard block", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-4", status: "pendingReview", totalAmount: 150000, customerId: "c1" },
        lines: [{ id: "l1", productId: "p1" }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: { get: async () => ({ status: "disabled" }), list: async () => [], balance: async () => 0 },
      },
      "approve",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
  });

  it("an active customer is allowed, and approval posts nothing", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-5", status: "pendingReview", totalAmount: 80000, customerId: "c1", orderDate: "2026-07-01", promiseDate: "2026-08-01" },
        lines: [{ id: "l1", productId: "p1", qty: 10, price: 100, netPrice: 100 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        // `get` feeds both customer and product. Approve carries `customer_active`,
        // `order_product_active`, and `order_product_sellable`. Missing one is a fail-closed failure
        // (`ref_field_compare` rejects a value it cannot read)
        query: {
          get: async () => ({ status: "active", canSell: true }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );

    expect(decision.verdict.pass).toBe(true);
    // Approval is only a promise: the document enters inProgress, and the ledger does not move.
    // The first posting is at confirm issue (`stock out`). The receivable is posted by the receivable bill pushed from it
    expect(decision.plan.forward).toEqual([]);
    expect(decision.plan.reversals).toEqual([]);
  });

  // A behavior test of the criterion. The declaration (the value set and the candidate filter are the same value) is pinned in
  // `productRefFilter.test.ts`. Both are required: that file keeps the dropdown and the gate saying the same sentence,
  // and this file keeps that sentence actually blocking. Testing only the declaration lets a changed primitive fail both in silence
  it("an order selling raw material cannot be approved; if the product is changed after the order is entered, only this gate catches it", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-6", status: "pendingReview", totalAmount: 3600, customerId: "c1" },
        lines: [{ id: "l1", productId: "p1" }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        // The product is still active (`order_product_active` passes), but it is not enabled for sale
        query: {
          get: async () => ({ status: "active", canSell: false }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "order_product_sellable")).toMatchObject({
      level: "block",
      ok: false,
    });
  });

  // WB-BUG-37: no required marker, but a required constraint.
  // The warehouse is genuinely optional on the order (optional at save and at approval), but the pushed issue document's cell is `required`.
  // Without this gate, `ship` verdict is pass, and the failure happens when the pushed draft is created.
  // The 400 coordinate is the issue document's `warehouseId`, and the user standing on the sales order sees no cell turn red.
  it("an order with no ship-from warehouse cannot Ship, and the reason names that cell on this document", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        // The promise date is filled (that gate is on approve and must not take this verdict). The warehouse is empty
        bill: { id: "so-7", status: "inProgress", totalAmount: 500, customerId: "c1", warehouseId: null },
        lines: [{ id: "l1", productId: "p1", qty: 5, openBaseQty: 5 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: NO_DATA,
      },
      "ship",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    const gate = decision.checks.find((check) => check.id === "ship_warehouse_required");
    expect(gate).toMatchObject({ level: "block", ok: false });
    // It names this document's cell. Naming the issue warehouse would send the user looking for a cell this page does not have
    expect(gate?.detail).toContain("Ship-from warehouse");
  });

  it("after the ship-from warehouse is filled, Ship is allowed, because the in-progress whitelist releases that cell", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-7", status: "inProgress", totalAmount: 500, customerId: "c1", warehouseId: "wh-sh" },
        lines: [{ id: "l1", productId: "p1", qty: 5, openBaseQty: 5 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: NO_DATA,
      },
      "ship",
    );

    expect(decision.verdict.pass).toBe(true);
    // The premise that the gate can actually change the value: this cell is writable in inProgress, or the previous case is a dead end
    expect(editableFields(salesOrder, "inProgress")).toContain("warehouseId");
  });

  // Raw material and packaging cannot open a production order, but they can be sold (canSell and canProduce are independent).
  // It used to be a whole-order gate `to_production_product_producible`: one line that cannot be produced blocked the finished-goods lines too.
  // Releasable quantity is now multiplied by can-produce, so a raw-material line is 0. The dialog does not list them,
  // and when the whole order cannot be produced the button disappears. This test is the "all raw material, nothing releasable" case.
  it("when the whole order is raw material it cannot be released to production, because there is no releasable quantity", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-8", status: "inProgress", totalAmount: 900, customerId: "c1", warehouseId: "wh-sh" },
        lines: [{ id: "l1", productId: "p-raw", openProductionQty: 0 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ status: "active", canProduce: false }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "to_production",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "has_open_production_qty_to_production")).toMatchObject({
      level: "block",
      ok: false,
    });
    expect(salesOrder.preconditions.some((one) => one.id === "to_production_product_producible")).toBe(false);
  });

  it("finished goods and raw material on one order still let the finished-goods line release to production", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-8b", status: "inProgress", totalAmount: 1400, customerId: "c1", warehouseId: "wh-sh" },
        lines: [
          { id: "l-fg", productId: "p-fg", openProductionQty: 10 },
          { id: "l-rm", productId: "p-rm", openProductionQty: 0 },
        ],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ status: "active", canProduce: true }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "to_production",
    );

    expect(decision.verdict.pass).toBe(true);
  });

  it("an order for finished goods can be released to production with zero stock; release to production was never a stock gate", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-9", status: "inProgress", totalAmount: 500, customerId: "c1", warehouseId: "wh-sh" },
        // `openProductionQty` is the 3.5.x remainder for a partial release to production.
        // That edge requires at least one line that can still move
        lines: [{ id: "l1", productId: "p1", openProductionQty: 10 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        // `balance` is always 0: this document has none of the goods. Release to production still passes.
        // Make-to-order exists to make goods that are not on hand
        query: {
          get: async () => ({ status: "active", canProduce: true }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "to_production",
    );

    expect(decision.verdict.pass).toBe(true);
  });

  it("over-issue is blocked, and the error carries the actual number", async () => {
    const decision = await evaluateTransition(
      {
        module: salesDelivery,
        // The source is on the line (the premise of a combined issue). Ordered quantity is brought in by a line lookup
        bill: { id: "d-1", status: "pendingReview", totalAmount: 3000, customerId: "c1", warehouseId: "w1", deliveryDate: "2026-08-06" },
        lines: [{ orderId: "so-1", orderLineId: "sol-1", orderLineBaseQty: 100, orderWarehouseId: "w1", productId: "p1", qty: 30, unit: "pcs", unitFactor: 1, baseQty: 30, baseUnitPrice: 100 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ warehouseId: "w1", status: "inProgress", customerId: "c1", productId: "p1", baseNetPrice: 100 }),
          list: async () => [{ baseQty: 80 }, { baseQty: 40 }], // issued 120 > order 100
          balance: AMPLE_STOCK,
        },
      },
      "confirm",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    const overShip = decision.checks.find((c) => c.id === "not_over_ship");
    expect(overShip?.ok).toBe(false);
    expect(overShip?.detail).toContain("120");
  });

  it("a rule explains itself in words a person and an AI can read", async () => {
    const decision = await evaluateTransition(
      {
        module: salesDelivery,
        bill: { id: "d-2", status: "pendingReview", totalAmount: 3000, customerId: "c1", warehouseId: "w1", deliveryDate: "2026-08-06" },
        lines: [{ orderId: "so-1", orderLineId: "sol-1", orderLineBaseQty: 100, orderWarehouseId: "w1", productId: "p1", qty: 30, unit: "pcs", unitFactor: 1, baseQty: 30, baseUnitPrice: 100 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: { get: async () => ({ warehouseId: "w1", status: "inProgress", customerId: "c1", productId: "p1", baseNetPrice: 100 }), list: async () => [{ baseQty: 10 }], balance: AMPLE_STOCK },
      },
      "confirm",
    );

    const overShip = decision.checks.find((c) => c.id === "not_over_ship");
    expect(overShip?.rule).toContain("shipped");
    // The kernel words a sum as total. The module does not own that sentence.
    expect(overShip?.rule).toContain("total");
  });

  // A date field's real value is a 'YYYY-MM-DD' string (that is what a Postgres date column reads as through drizzle).
  // If this soft rule throws SchemaError while comparing dates, approve changes from a warning into "cannot move".
  // A rule declared as warn is treated as block, and its nature has changed.
  async function approveWith(dates: { orderDate: unknown; promiseDate: unknown }) {
    return await evaluateTransition(
      {
        module: salesOrder,
        // Promise-date rules: `approve_fields_required` blocks only `promiseDate`. The warehouse is optional and does not need to be filled.
        bill: { id: "so-7", status: "pendingReview", totalAmount: 1000, customerId: "c1", ...dates },
        lines: [{ id: "l1", productId: "p1", unit: "ea", qty: 10, price: 100, netPrice: 100 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ status: "active", canSell: true, mainUnit: "ea", auxUnit: "case", conversionRate: 10 }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );
  }

  it("a backwards promise date only warns, and a string date must not make evaluation throw", async () => {
    const decision = await approveWith({ orderDate: "2026-02-10", promiseDate: "2026-02-01" });

    expect(decision.checks.find((c) => c.id === "promise_date_sane")?.ok).toBe(false);
    expect(decision.verdict.pass).toBe(false);
    expect(decision.verdict.pass === false && decision.verdict.level).toBe("warn");
  });

  it("a normal promise date passes, for both string and Date values", async () => {
    for (const dates of [
      { orderDate: "2026-02-01", promiseDate: "2026-02-10" },
      { orderDate: new Date("2026-02-01"), promiseDate: new Date("2026-02-10") },
      { orderDate: "2026-02-01", promiseDate: new Date("2026-02-01") },
    ]) {
      const decision = await approveWith(dates);
      expect(decision.checks.find((c) => c.id === "promise_date_sane")?.ok).toBe(true);
      expect(decision.verdict.pass).toBe(true);
    }
  });

  it("taking an edge the current status does not allow throws", async () => {
    await expect(
      evaluateTransition(
        {
          module: salesOrder,
          bill: { id: "so-6", status: "pendingReview", totalAmount: 100 },
          lines: [],
          params: {},
          actor: { id: "u1" },
          now: NOW,
          query: NO_DATA,
        },
        "ship",
      ),
    // The kernel still wraps the action names. Ship and Approve are the labels this module now declares.
    ).rejects.toThrow('This document is "pendingReview" and cannot "Ship" (ship). What can be done now: "Approve" (approve).');
  });
});

describe("sales issue posts on confirm", () => {
  it("the fulfillment document keeps only pending review, shipped, and cancelled", () => {
    expect(salesDelivery.lifecycle.transitions.map((edge) => edge.code)).toEqual(["cancel", "confirm"]);
    /**
     * Sales-order status collapses to pendingReview, then inProgress, then completed or cancelled.
     * Shipment progress is line quantity. In production is the downstream production order. Neither occupies a header status such as awaitingShipment, shipping, or inProduction.
     */
    expect(salesOrder.lifecycle.statuses.map((status) => status.key)).toEqual([
      "pendingReview",
      "inProgress",
      "completed",
      "cancelled",
    ]);
  });
});

describe("a sales issue does not take the warehouse job's posting responsibility", () => {
  it("a three-line issue posts on confirm and only deducts stock", async () => {
    const decision = await evaluateTransition(
      {
        module: salesDelivery,
        bill: {
          id: "d-3",
          status: "pendingReview",
          totalAmount: 7200,
          customerId: "c1",
          warehouseId: "wh-sh",
          deliveryDate: "2026-08-06",
        },
        lines: [
          { orderId: "so-1", orderLineId: "sol-1", orderLineBaseQty: 1000, orderWarehouseId: "wh-sh", productId: "p1", qty: 10, unitFactor: 1, baseQty: 10, baseUnitPrice: 120 },
          { orderId: "so-2", orderLineId: "sol-2", orderLineBaseQty: 1000, orderWarehouseId: "wh-sh", productId: "p2", qty: 20, unitFactor: 1, baseQty: 20, baseUnitPrice: 120 },
          { orderId: "so-3", orderLineId: "sol-3", orderLineBaseQty: 1000, orderWarehouseId: "wh-sh", productId: "p3", qty: 30, unitFactor: 1, baseQty: 30, baseUnitPrice: 120 },
        ],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async (_entity, id, through) => ({
            warehouseId: "wh-sh",
            status: "inProgress",
            customerId: "c1",
            productId: through === "lines" ? `p${String(id).slice(-1)}` : undefined,
            baseNetPrice: 120,
          }),
          list: async () => [],
          balance: AMPLE_STOCK,
        },
      },
      "confirm",
    );

    expect(decision.verdict.pass).toBe(true);
    expect(decision.plan.forward.map((effect) => `${effect.target}.${effect.op}`)).toEqual([
      "stock.out",
      "stock.out",
      "stock.out",
    ]);
  });



});

// ─────────────────────────────────────────────────────────────────────────────
// The order warehouse is for display and trace only. It does not constrain the actual issue warehouse.
//
// `orderWarehouseId` keeps the order's original warehouse id. `warehouseId` is this issue's real warehouse and the stock-posting coordinate.
// A mismatch is legal business and must not produce a block or a warn.
// ─────────────────────────────────────────────────────────────────────────────
describe("a sales issue may use an issue warehouse different from the order warehouse", () => {
  const orderWarehouse = salesDelivery.fields
    .find((f) => f.key === "lines")
    ?.fields?.find((f) => f.key === "orderWarehouseId");

  it("on the declaration, ref points at warehouse, and the value is looked up unchanged from the order header warehouseId", () => {
    // ref means the renderer knows this cell should look up candidates (FormPage.refEntityByField accepts only type==='ref')
    expect(orderWarehouse?.type).toBe("ref");
    expect(orderWarehouse?.ref).toBe("warehouse");
    expect(orderWarehouse?.derive).toEqual({
      kind: "lookup",
      from: "salesOrder",
      through: null,
      match: "orderId",
      field: "warehouseId",
    });
    // Derived means no column and no write entry. A client that sends it hits the key gate
    const columns = salesDelivery.fields.find((f) => f.key === "lines")?.fields ?? [];
    expect(isSystemSupplied(orderWarehouse as Field, columns)).toBe(true);

    expect(salesDelivery.fields.find((f) => f.key === "warehouseId")?.type).toBe("ref");
  });

  it("confirming issue from a different warehouse does not create a warehouse-match check", async () => {
    const decision = await evaluateTransition(
      {
        module: salesDelivery,
        bill: { id: "d-9", status: "pendingReview", customerId: "c1", warehouseId: "wh-sh", totalAmount: 1200, deliveryDate: "2026-08-06" },
        lines: [
          {
            orderId: "so-1",
            orderLineId: "sol-1",
            orderWarehouseId: "wh-bj",
            productId: "p1",
            qty: 10,
            unit: "pcs",
            unitFactor: 1,
            baseQty: 10,
            orderLineBaseQty: 100,
            baseUnitPrice: 120,
            price: 120,
          },
        ],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ status: "inProgress", customerId: "c1", productId: "p1", baseNetPrice: 120 }),
          list: async () => [],
          balance: AMPLE_STOCK,
        },
      },
      "confirm",
    );

    expect(decision.checks.find((c) => c.id === "warehouse_matches_order")).toBeUndefined();
    expect(decision.verdict.pass).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A pending-review document entered wrong can be deleted, and it can also be cancelled.
//
// A sales order has no draft, no submit, and no withdraw. Create starts at pending review.
// Pending review can be deleted. A document that has taken an edge cannot. Cancel can leave a cancelled record, and it is not the only exit.
// A pure push product (creatable.manual === false, such as a receivable) still cannot be deleted.
// ─────────────────────────────────────────────────────────────────────────────
describe("the initial state can be deleted; a document that has taken an edge cannot", () => {
  it.each([
    ["salesDelivery", salesDelivery],
  ] as const)("%s initial state has a cancel edge into a terminal state", (_code, module) => {
    const initial = module.lifecycle.statuses.find((s) => s.initial)?.key;
    const terminals = new Set(module.lifecycle.statuses.filter((s) => s.terminal).map((s) => s.key));
    const exits = module.lifecycle.transitions.filter((t) => t.from === initial && terminals.has(t.to) && t.effects.length === 0);
    expect(exits.length).toBeGreaterThanOrEqual(1);
    for (const edge of exits) {
      // Zero effects: the initial state never posted, so there is no ledger entry to undo. Posting here would reverse
      // a reservation that does not exist, and the reversal side would look for a ledger row that does not match
      expect(edge.effects).toEqual([]);
      // It does not post, so postsToLedger is derived false, and the confirm dialog is not earned by it.
      // This layer must set confirm explicitly (ask even though nothing posts). Cancel is irreversible
      expect(edge.postsToLedger).toBe(false);
      // That sentence used to live only in a comment, and the criterion did not follow. This loop judged "has an exit / zero effects /
      // postsToLedger=false" and missed confirm itself. The two tests that pin confirm
      // covered only salesOrder and salesReceipt, so the cancel edges of receivable and salesDelivery
      // stayed `confirm: false` and the suite stayed green. Omitting it does not error. One mis-click
      // pushes the document into a terminal state. The criterion lives in the loop, so the next new draft-exit edge that omits it fails too
      expect([`${module.code}.${edge.code}`, edge.confirm]).toEqual([`${module.code}.${edge.code}`, true]);
    }
  });


  it("the in-progress cancel edge on a sales order sets confirm; an irreversible edge that does not post has only that to ask", () => {
    const cancel = salesOrder.lifecycle.transitions.find((t) => t.code === "cancelRunning");
    expect(cancel).toMatchObject({ from: "inProgress", to: "cancelled", confirm: true });
    expect(salesOrder.lifecycle.statuses.find((s) => s.key === "cancelled")?.terminal).toBe(true);
  });


  /**
   * The new receivable is not a hand-entered draft. Warehouse completion forms it directly, and it can leave only through the warehouse's internal reversal.
   * A pure push product has creatable.manual === false, so the declaration itself cannot be deleted.
   */
});

// ─────────────────────────────────────────────────────────────────────────────
// Optional while pending review and required before approval, and a number the user cannot know must not be required
// ─────────────────────────────────────────────────────────────────────────────
describe("required at create: only what is actually known at order time", () => {
  it("ship-from warehouse and promise date are not required; approve blocks only the promise date, not the warehouse", () => {
    for (const key of ["warehouseId", "promiseDate"]) {
      expect(salesOrder.fields.find((f) => f.key === key)?.required, `${key} is still required`).toBe(false);
    }
    const rule = salesOrder.preconditions.find((p) => p.id === "approve_fields_required");
    expect(rule?.onTransition).toBe("approve");
    expect(rule?.level).toBe("block");
    expect(rule?.check?.params).toEqual({ fields: ["promiseDate"] });
    expect(salesOrder.preconditions.some((p) => p.id === "submit_fields_required" || p.onTransition === "submit")).toBe(
      false,
    );
    // The hard warehouse gate is on the downstream issue document, not on sales-order approval
    expect(salesDelivery.fields.find((f) => f.key === "warehouseId")?.required).toBe(true);
  });

  it("after the promise date is no longer required, an empty value against promise_date_sane is a readable failure, not a 500", async () => {
    // This cell used to stay `required` on purpose. `promise_date_sane` uses `gte`,
    // an order comparison schemaFails on empty (`orderable` in `primitives.ts`),
    // and `evaluateTransition` did not isolate one rule, so one warn turned the whole approve edge
    // into "evaluation throws": no verdict, no checks, and the plan dropped.
    // After the kernel isolated each rule that premise was gone, so this cell was relaxed with it.
    // This test pins that pairing: the edge still returns a verdict, and the rule that throws affects only itself.
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-9", status: "pendingReview", totalAmount: 1000, customerId: "c1", orderDate: "2026-02-01", promiseDate: null },
        lines: [{ id: "l1", productId: "p1", unit: "ea", qty: 10, price: 100, netPrice: 100 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ status: "active", canSell: true, mainUnit: "ea", auxUnit: "case", conversionRate: 10 }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );
    // 1. The edge returned a verdict (it used to throw here, and nothing could be read)
    expect(decision.checks.length).toBeGreaterThan(0);
    // 2. The rule that throws affects only itself, and it is not treated as a pass (fail-open is the fallback this system must not have)
    const sane = decision.checks.find((c) => c.id === "promise_date_sane");
    expect(sane?.ok).toBe(false);
    // 3. The verdict comes from the stricter layer: a missing promise date is a block (required), not a warn
    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    const required = decision.checks.find((c) => c.id === "approve_fields_required");
    expect(required?.ok).toBe(false);
    // End-to-end assertion that the message reports the label, not the key. Detail used to be "promiseDate",
    // a word the user cannot find on the form. Falling back to the key would turn nothing red.
    // The kernel still prefixes the missing-field sentence. Promise date is this module's label.
    expect(required?.detail).toBe("Missing required fields: Promise date");
  });

  it("with a promise date and no ship-from warehouse, approve passes; the warehouse is required again on the issue document", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-8", status: "pendingReview", totalAmount: 1000, customerId: "c1", orderDate: "2026-02-01", promiseDate: "2026-02-10" },
        lines: [{ id: "l1", productId: "p1", unit: "ea", qty: 10, price: 100, netPrice: 100 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: {
          get: async () => ({ status: "active", canSell: true, mainUnit: "ea", auxUnit: "case", conversionRate: 10 }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );
    const check = decision.checks.find((c) => c.id === "approve_fields_required");
    expect(check?.ok).toBe(true);
    expect(decision.verdict.pass).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Allowance (the discount amount) is built on amount, and does not write the discount formula a second time
// ─────────────────────────────────────────────────────────────────────────────
describe("the allowance column on the line", () => {
  const columns = salesOrder.fields.find((f) => f.key === "lines")?.fields ?? [];
  const discountAmount = columns.find((f) => f.key === "discountAmount");

  it("the formula cites amount, not discount; the discount basis has only one place", () => {
    expect(discountAmount?.type).toBe("money");
    expect(discountAmount?.derive?.kind).toBe("formula");
    // Expand to a string to see what it cites. Citing `discount` means the discount formula was written a second time.
    // The day it becomes a tiered discount the two copies drift, and the symptom is allowance not matching list price minus net price.
    // Both numbers claim to be right
    const expr = JSON.stringify(discountAmount?.derive);
    expect(expr).toContain('"amount"');
    expect(expr).not.toContain('"discount"');
    expect(expr).not.toContain('"netPrice"');
  });

  it("derived, so it is not stored; a stored discount amount would drift from price and discount", () => {
    expect(isSystemSupplied(discountAmount as Field, columns)).toBe(true);
    expect(discountAmount?.lineAgg).toBeNull();
  });
});
